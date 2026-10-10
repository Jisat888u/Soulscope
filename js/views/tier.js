// Тир-лист: визуальные ряды S+…D и подробная сортируемая таблица.
import { sampleWarning, getMeta, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroLink, tierBadge, ratingBar, deltaHtml, wrClass, TIERS, periodLabel, rankLabel, roleName } from '../core.js';
import { ROLES, ROLE_ORDER } from '../knowledge.js';

const view = { role: 'all', sort: 'rating', asc: false, q: '' };

const COLS = [
  { key: 'rank', label: '#', get: (x) => x.rank },
  { key: 'name', label: 'Герой', get: (x) => hName(x.hero) },
  { key: 'rating', label: 'Тир / рейтинг', get: (x) => x.rating },
  { key: 'wr', label: 'Винрейт', get: (x) => x.wr, r: true },
  { key: 'dwr', label: 'Δ WR', get: (x) => x.dwr ?? -1, r: true, tip: 'Изменение винрейта относительно предыдущего периода такой же длины' },
  { key: 'pick', label: 'Пикрейт', get: (x) => x.pick, r: true },
  { key: 'matches', label: 'Матчи', get: (x) => x.matches, r: true },
  { key: 'kda', label: 'KDA', get: (x) => x.kda, r: true },
  { key: 'dmg', label: 'Урон / матч', get: (x) => x.dmg, r: true },
  { key: 'nw', label: 'Души / матч', get: (x) => x.nw, r: true },
];

export async function render(root, { alive }) {
  root.innerHTML = filterBar() + loading();
  bindFilterBar(root);
  let meta;
  try {
    meta = await getMeta();
  } catch (e) {
    if (alive()) { root.innerHTML = filterBar() + errorBox(e); bindFilterBar(root); }
    return;
  }
  if (!alive()) return;

  const roleChips = `<div class="row">${[['all', 'Все роли', 'var(--accent)'], ...ROLE_ORDER.map((r) => [r, ROLES[r].ru, ROLES[r].color])]
    .map(([v, l, c]) => `<button class="chip ${view.role === v ? 'on' : ''}" data-role="${v}"><span class="dot" style="background:${c}"></span>${l}</button>`)
    .join('')}</div>`;

  root.innerHTML = `
    ${filterBar()}
    ${sampleWarning(meta)}
    <section class="section panel">
      <div class="sec-head">
        <div><div class="eyebrow">Мета · ${esc(periodLabel())} · ${esc(rankLabel())}</div><h2>Тир-лист героев</h2>
          <div class="sub">${fmtNum(meta.totalMatches)} матчей. Тир = рейтинг 0–100: 80% — винрейт со сглаживанием по объёму выборки, 20% — популярность.</div></div>
        ${roleChips}
      </div>
      <div class="tier-rows" id="tierRows"></div>
    </section>
    <section class="section panel">
      <div class="sec-head">
        <div><div class="eyebrow">Подробно</div><h2>Статистика героев</h2></div>
        <input type="search" id="tierSearch" placeholder="Фильтр по имени…" value="${esc(view.q)}" />
      </div>
      <div class="table-wrap"><table class="data" id="tierTable"></table></div>
    </section>`;
  bindFilterBar(root);

  const draw = () => {
    const list = meta.list.filter((x) => (view.role === 'all' || x.hero.type === view.role));
    root.querySelector('#tierRows').innerHTML = TIERS.map((t) => {
      const heroes = list.filter((x) => x.tier.key === t.key);
      return `<div class="tier-row"><div class="tier-label" style="background:var(--t-${t.key})">${t.label}</div>
        <div class="tier-heroes">${
          heroes
            .map(
              (x) => `<a class="tile" href="#/hero/${x.id}" data-tip="<b>${esc(hName(x.hero))}</b> · ${roleName(x.hero.type)}<br>WR ${pct(x.wr)} · пик ${pct(x.pick)} · ${fmtNum(x.matches)} матчей · рейтинг ${x.rating}">
                <img src="${esc(x.hero.img.sm || x.hero.img.card)}" alt="" loading="lazy" />
                <span class="n">${esc(hName(x.hero))}</span><span class="w num ${wrClass(x.wr)}">${pct(x.wr)}</span></a>`,
            )
            .join('') || '<span class="muted" style="padding:20px 6px;font-size:12px">—</span>'
        }</div></div>`;
    }).join('');

    const q = view.q.trim().toLowerCase();
    const col = COLS.find((c) => c.key === view.sort) || COLS[2];
    const rows = list
      .filter((x) => !q || x.hero.en.toLowerCase().includes(q) || x.hero.ru.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = col.get(a), vb = col.get(b);
        const d = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return view.asc ? d : -d;
      });
    root.querySelector('#tierTable').innerHTML = `
      <thead><tr>${COLS.map((c) => `<th class="sortable ${c.r ? 'r' : ''} ${view.sort === c.key ? 'sorted' + (view.asc ? ' asc' : '') : ''}" data-sort="${c.key}" ${c.tip ? `data-tip="${esc(c.tip)}"` : ''}>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (x) => `<tr>
          <td class="muted num">${x.rank}</td>
          <td>${heroLink(x.hero, { sub: roleName(x.hero.type) })}</td>
          <td><div class="row" style="flex-wrap:nowrap">${tierBadge(x.tier)}${ratingBar(x.rating)}</div></td>
          <td class="r num ${wrClass(x.wr)}"><b>${pct(x.wr)}</b></td>
          <td class="r num">${deltaHtml(x.dwr)}</td>
          <td class="r num">${pct(x.pick)}</td>
          <td class="r num">${fmtNum(x.matches)}</td>
          <td class="r num">${x.kda.toFixed(2)}</td>
          <td class="r num">${fmtNum(x.dmg)}</td>
          <td class="r num">${fmtNum(x.nw)}</td>
        </tr>`,
        )
        .join('')}</tbody>`;
  };
  draw();

  root.querySelectorAll('[data-role]').forEach((b) =>
    b.addEventListener('click', () => {
      view.role = b.dataset.role;
      root.querySelectorAll('[data-role]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }),
  );
  root.querySelector('#tierSearch').addEventListener('input', (e) => { view.q = e.target.value; draw(); });
  root.querySelector('#tierTable').addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    if (view.sort === th.dataset.sort) view.asc = !view.asc;
    else { view.sort = th.dataset.sort; view.asc = th.dataset.sort === 'name' || th.dataset.sort === 'rank'; }
    draw();
  });
}
