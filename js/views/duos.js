// Лучшие связки на линии: пары союзников, стоявших на одной линии, по винрейту и синергии.
import { api } from '../api.js';
import { L, sampleWarning, A, getMeta, hero, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroLink, statParams, ensureHeroes, wrClass, periodLabel, rankLabel } from '../core.js';

const view = { heroId: 0, sort: 'wr', minMatches: 0, userMin: false, worst: false };

export async function render(root, { query, alive }) {
  if (query.get('hero')) view.heroId = +query.get('hero');
  root.innerHTML = filterBar() + loading(L('Считаем связки на линии…', 'Counting lane duos…'));
  bindFilterBar(root);
  let meta, rows;
  try {
    [meta, rows] = await Promise.all([getMeta(), api('/v1/analytics/hero-synergy-stats', statParams({ same_lane_filter: true, min_matches: 30 }))]);
    await ensureHeroes(rows.flatMap((r) => [r.hero_id1, r.hero_id2]));
  } catch (e) {
    if (alive()) { root.innerHTML = filterBar() + errorBox(e); bindFilterBar(root); }
    return;
  }
  if (!alive()) return;

  const autoMin = Math.max(100, Math.round(meta.totalMatches * 0.0015));
  if (!view.userMin) view.minMatches = autoMin;
  const pairs = rows
    .filter((r) => A.heroById.has(r.hero_id1) && A.heroById.has(r.hero_id2))
    .map((r) => {
      const a = meta.byId.get(r.hero_id1), b = meta.byId.get(r.hero_id2);
      const wr = r.wins / r.matches_played;
      const expected = a && b ? (a.wr + b.wr) / 2 : 0.5;
      return { a: r.hero_id1, b: r.hero_id2, n: r.matches_played, wr, syn: wr - expected, kills: (r.kills1 + r.kills2) / r.matches_played, deaths: (r.deaths1 + r.deaths2) / r.matches_played, nw: (r.networth1 + r.networth2) / r.matches_played };
    });

  const options = A.heroes.slice().sort((x, y) => hName(x).localeCompare(hName(y))).map((h) => `<option value="${h.id}">${esc(hName(h))}</option>`).join('');
  root.innerHTML = `
    ${filterBar()}
    ${sampleWarning(meta)}
    <section class="section">
      <div class="sec-head bare"><div><div class="eyebrow">${L('Линия', 'Lane')} · ${esc(periodLabel())} · ${esc(rankLabel())}</div><h2>${L('Лучшие связки на линию', 'Best lane duos')}</h2>
        <div class="sub">${L('Пары союзников, стоявших на одной линии. <b>Синергия</b> — насколько винрейт пары выше среднего винрейта двух героев по отдельности: показывает, что они реально усиливают друг друга, а не просто оба сильны.', 'Allied pairs that shared a lane. <b>Synergy</b> is how much higher the pair’s win rate is than the average of the two heroes’ individual win rates: it shows they actually boost each other, not just that both are strong.')}</div></div></div>
      <div class="filterbar">
        <label>${L('Герой', 'Hero')}</label><select id="dh"><option value="0">${L('Все пары', 'All pairs')}</option>${options}</select>
        <label>${L('Сортировка', 'Sort')}</label>
        <div class="seg"><button data-s="wr">${L('Винрейт', 'Win rate')}</button><button data-s="syn">${L('Синергия', 'Synergy')}</button><button data-s="n">${L('Популярность', 'Popularity')}</button></div>
        <button class="chip ${view.worst ? 'on' : ''}" id="dw">${L('Худшие пары', 'Worst pairs')}</button>
        <label>${L('Мин. матчей', 'Min. matches')}</label><input type="number" id="dm" min="20" step="50" value="${view.minMatches}" style="width:90px" />
      </div>
      <div class="duo-top" id="dtop"></div>
      <div class="panel section"><div class="table-wrap"><table class="data" id="dtable"></table></div></div>
    </section>`;
  bindFilterBar(root);
  const sel = root.querySelector('#dh');
  sel.value = String(view.heroId);

  const draw = () => {
    root.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', b.dataset.s === view.sort));
    const list = pairs
      .filter((p) => p.n >= view.minMatches)
      .filter((p) => !view.heroId || p.a === view.heroId || p.b === view.heroId)
      .sort((x, y) => (view.worst ? x[view.sort] - y[view.sort] : y[view.sort] - x[view.sort]));
    const ordered = (p) => (view.heroId && p.b === view.heroId ? [p.b, p.a] : [p.a, p.b]);

    root.querySelector('#dtop').innerHTML = list
      .slice(0, 3)
      .map((p, i) => {
        const [x, y] = ordered(p);
        const hx = hero(x), hy = hero(y);
        return `<div class="panel duo-card"><span class="rankno">${i + 1}</span>
          <div class="duo-pair"><a href="#/hero/${x}"><img src="${esc(hx.img.sm)}" alt="" /></a><span class="plus">+</span><a href="#/hero/${y}"><img src="${esc(hy.img.sm)}" alt="" /></a></div>
          <div class="duo-names">${esc(hName(hx))} <span class="muted">${L('и', '&amp;')}</span> ${esc(hName(hy))}</div>
          <div class="duo-stats">
            <div><div class="k">${L('Винрейт', 'Win rate')}</div><div class="v ${wrClass(p.wr)}">${pct(p.wr)}</div></div>
            <div><div class="k">${L('Синергия', 'Synergy')}</div><div class="v ${p.syn > 0 ? 'good' : 'bad'}">${p.syn > 0 ? '+' : ''}${(p.syn * 100).toFixed(1)}</div></div>
            <div><div class="k">${L('Матчи', 'Matches')}</div><div class="v">${fmtNum(p.n)}</div></div>
          </div></div>`;
      })
      .join('') || `<div class="empty panel">${L('Нет пар с таким количеством матчей — уменьшите порог.', 'No pairs with that many matches — lower the threshold.')}</div>`;

    root.querySelector('#dtable').innerHTML = `<thead><tr><th>#</th><th>${L('Связка', 'Duo')}</th><th class="r">${L('Винрейт', 'Win rate')}</th><th class="r" data-tip="${L('Винрейт пары минус средний винрейт двух героев', 'Pair win rate minus the average win rate of the two heroes')}">${L('Синергия', 'Synergy')}</th><th class="r">${L('Матчи', 'Matches')}</th><th class="r">${L('Убийства пары', 'Pair kills')}</th><th class="r">${L('Смерти пары', 'Pair deaths')}</th><th class="r">${L('Души пары', 'Pair souls')}</th></tr></thead>
      <tbody>${list
        .slice(0, 150)
        .map((p, i) => {
          const [x, y] = ordered(p);
          return `<tr><td class="muted num">${i + 1}</td><td><div class="pair-cell">${heroLink(hero(x), { cls: 'sm' })}<span class="plus">+</span>${heroLink(hero(y), { cls: 'sm' })}</div></td>
            <td class="r num ${wrClass(p.wr)}"><b>${pct(p.wr)}</b></td>
            <td class="r num"><span class="delta ${p.syn > 0.002 ? 'up' : p.syn < -0.002 ? 'down' : 'flat'}">${p.syn > 0 ? '+' : ''}${(p.syn * 100).toFixed(1)}</span></td>
            <td class="r num">${fmtNum(p.n)}</td><td class="r num">${p.kills.toFixed(1)}</td><td class="r num">${p.deaths.toFixed(1)}</td><td class="r num">${fmtNum(p.nw)}</td></tr>`;
        })
        .join('')}</tbody>`;
  };
  draw();

  sel.addEventListener('change', () => { view.heroId = +sel.value; draw(); });
  root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { view.sort = b.dataset.s; draw(); }));
  root.querySelector('#dw').addEventListener('click', (e) => { view.worst = !view.worst; e.target.classList.toggle('on', view.worst); draw(); });
  root.querySelector('#dm').addEventListener('change', (e) => { view.userMin = true; view.minMatches = Math.max(20, +e.target.value || autoMin); draw(); });
}
