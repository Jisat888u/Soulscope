// Страница героя: сборка по фазам, ситуативные предметы, прокачка, матчапы, способности.
import { api } from '../api.js';
import { renderPowerCurve } from './power-curve.js';
import { A, state, L, getMeta, hero, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroLink, tierBadge, deltaHtml, wrClass, itemCard, itemReason, statParams, roleName, periodLabel, rankLabel, ensureHeroes } from '../core.js';

const PHASES = [
  { key: 'start', label: ['Старт', 'Start'], sub: '0–5', max: 300, minUse: 0.15 },
  { key: 'early', label: ['Ранняя игра', 'Early game'], sub: '5–15', max: 900, minUse: 0.15 },
  { key: 'mid', label: ['Мидгейм', 'Mid game'], sub: '15–25', max: 1500, minUse: 0.1 },
  { key: 'late', label: ['Поздняя игра', 'Late game'], sub: '25+', max: Infinity, minUse: 0.05 },
];
const phaseOf = (t) => PHASES.find((p) => t < p.max);

export async function render(root, { args, alive }) {
  const id = +args[0];
  root.innerHTML = filterBar() + loading(L('Собираем билд героя…', 'Building the hero build…'));
  bindFilterBar(root);
  await ensureHeroes([id]);
  const h = hero(id);
  if (h.missing) {
    root.innerHTML = `<div class="empty">${L('Герой не найден.', 'Hero not found.')} <a class="btn" href="#/heroes">${L('К списку героев', 'Back to heroes')}</a></div>`;
    return;
  }

  let meta, items, abil;
  try {
    [meta, items, abil] = await Promise.all([
      getMeta(),
      api('/v1/analytics/item-stats', statParams({ hero_id: id })),
      api('/v1/analytics/ability-order-stats', statParams({ hero_id: id, min_matches: 20 })).catch(() => []),
    ]);
  } catch (e) {
    if (alive()) { root.innerHTML = filterBar() + errorBox(e); bindFilterBar(root); }
    return;
  }
  if (!alive()) return;
  const m = meta.byId.get(id);
  const heroMatches = m?.matches || Math.max(1, ...items.map((i) => i.matches));
  const heroWr = m?.wr ?? 0.5;

  const desc = state.lang === 'en' ? h.playEn || h.roleEn : h.playRu || h.roleRu;
  const tags = state.lang === 'en' ? h.tagsEn : h.tagsRu;

  root.innerHTML = `
    ${filterBar()}
    <section class="section panel hero-head">
      ${h.img.bg ? `<img class="bgimg" src="${esc(h.img.bg)}" alt="" />` : ''}<div class="fade"></div>
      <img class="portrait" src="${esc(h.img.card || h.img.sm)}" alt="" />
      <div>
        <div class="eyebrow">${roleName(h.type)} · ${esc(state.lang === 'en' ? h.ru : h.en)}</div>
        <h1 style="margin-top:6px">${esc(hName(h))}</h1>
        <div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        ${desc ? `<div class="desc">${esc(desc)}</div>` : ''}
      </div>
      <div class="kpis">
        <div class="kpi"><div class="k">${L('Тир', 'Tier')}</div><div class="v">${m ? `${tierBadge(m.tier)} <span class="muted" style="font-size:13px">${m.rating}/100</span>` : '—'}</div></div>
        <div class="kpi"><div class="k">${L('Винрейт', 'Win rate')}</div><div class="v ${m ? wrClass(m.wr) : ''}">${m ? pct(m.wr) : '—'} <span style="font-size:12px">${m ? deltaHtml(m.dwr) : ''}</span></div></div>
        <div class="kpi"><div class="k">${L('Пикрейт', 'Pick rate')}</div><div class="v">${m ? pct(m.pick) : '—'}</div></div>
        <div class="kpi"><div class="k">${L('Матчи', 'Matches')}</div><div class="v">${m ? fmtNum(m.matches) : '—'}</div></div>
        <div class="kpi"><div class="k">KDA</div><div class="v">${m ? `${m.kills.toFixed(1)}/${m.deaths.toFixed(1)}/${m.assists.toFixed(1)}` : '—'}</div></div>
        <div class="kpi"><div class="k">${L('Души / матч', 'Souls / match')}</div><div class="v">${m ? fmtNum(m.nw) : '—'}</div></div>
      </div>
    </section>

    <section class="section panel">
      <div class="sec-head"><div><div class="eyebrow">${L('Сила по ходу матча', 'Power over the match')} · ${esc(periodLabel())} · ${esc(rankLabel())}</div><h2>${L('Когда герой сильнее', 'When the hero is strongest')}</h2>
        <div class="sub">${L('Винрейт в зависимости от длительности матча: герои ранней игры выигрывают короткие матчи, лейт-герои — затяжные.', 'Win rate by match length: early-game heroes win short matches, late-game heroes win long ones.')}</div></div></div>
      <div id="powerCurve"></div>
    </section>

    <section class="section panel">
      <div class="sec-head"><div><div class="eyebrow">${L('Сборка', 'Build')} · ${esc(periodLabel())} · ${esc(rankLabel())}</div><h2>${L('Актуальный билд', 'Current build')}</h2>
        <div class="sub">${L('Самые покупаемые предметы в каждой фазе. Фаза — по среднему времени покупки. Справа: винрейт с предметом и доля матчей, где его купили.', 'The most purchased items in each phase, by average purchase time. On the right: win rate with the item and the share of matches where it was bought.')}</div></div></div>
      <div class="phases" id="phases"></div>
    </section>

    <section class="section grid-2">
      <div class="panel"><div class="sec-head"><div><div class="eyebrow">${L('По ситуации', 'Situational')}</div><h2>${L('Ситуативные предметы', 'Situational items')}</h2>
        <div class="sub">${L('Берут реже, но они заметно поднимают винрейт относительно других предметов той же фазы.', 'Bought less often, but they noticeably raise win rate compared to other items of the same phase.')}</div></div></div>
        <div style="padding:0 20px 18px" class="item-list" id="situational"></div></div>
      <div class="panel"><div class="sec-head"><div><div class="eyebrow">${L('Осторожно', 'Careful')}</div><h2>${L('Ловушки', 'Traps')}</h2>
        <div class="sub">${L('Популярные покупки, с которыми этот герой выигрывает реже, чем с альтернативами.', 'Popular purchases this hero wins less often with than with the alternatives.')}</div></div></div>
        <div style="padding:0 20px 18px" class="item-list" id="traps"></div></div>
    </section>

    <section class="section panel"><div class="sec-head"><div><div class="eyebrow">${L('Способности', 'Abilities')}</div><h2>${L('Порядок прокачки', 'Skill order')}</h2><div class="sub" id="abilSub"></div></div></div>
      <div style="padding:0 20px 18px" id="skills"></div></section>

    <section class="section grid-3" id="matchups">${loading(L('Считаем матчапы…', 'Counting matchups…'))}</section>

    ${h.abilities.length ? `<section class="section panel"><div class="sec-head"><div><div class="eyebrow">${L('Кит героя', 'Hero kit')}</div><h2>${L('Способности', 'Abilities')}</h2></div></div>
      <div class="abilities" style="padding:0 20px 20px">${h.abilities
        .map((a, i) => `<div class="ability"><img src="${esc(a.img)}" alt="" loading="lazy" /><div><div class="key">${i === 3 ? L('УЛЬТИМЕЙТ', 'ULTIMATE') : L('СПОСОБНОСТЬ ', 'ABILITY ') + (i + 1)}</div><div class="nm">${esc(state.lang === 'en' ? a.en : a.ru)}</div><div class="tx">${esc(state.lang === 'en' ? a.descEn : a.descRu)}</div></div></div>`)
        .join('')}</div></section>` : ''}
  `;
  bindFilterBar(root);

  renderBuild(root, items, heroMatches, heroWr);
  renderSkills(root, h, abil);
  renderMatchups(root.querySelector('#matchups'), id, heroMatches, alive);
  renderPowerCurve(root.querySelector('#powerCurve'), id, alive);
}

function renderBuild(root, raw, heroMatches, heroWr) {
  const items = raw
    .map((r) => ({ ...r, item: A.itemById.get(r.item_id), use: r.matches / heroMatches, wr: r.wins / Math.max(1, r.matches) }))
    .filter((r) => r.item && r.matches >= 20);
  items.forEach((r) => (r.phase = phaseOf(r.avg_buy_time_s).key));

  // базовый винрейт фазы — чтобы поздние предметы не выглядели «имбой» только из-за того, что их покупают выигрывающие
  const phaseAvg = {};
  for (const p of PHASES) {
    const list = items.filter((r) => r.phase === p.key);
    const w = list.reduce((s, r) => s + r.wins, 0), n = list.reduce((s, r) => s + r.matches, 0);
    phaseAvg[p.key] = n ? w / n : heroWr;
  }
  items.forEach((r) => (r.delta = r.wr - phaseAvg[r.phase]));

  const core = new Set();
  const souls = L('душ', 'souls'), ofMatches = L('матчей', 'of matches'), min = L('мин', 'min');
  const right = (r) => `<span class="${r.delta > 0.01 ? 'good' : r.delta < -0.01 ? 'bad' : ''}">${pct(r.wr)}</span><small>${pct(r.use, 0)} ${ofMatches}</small>`;
  root.querySelector('#phases').innerHTML = PHASES.map((p) => {
    const list = items
      .filter((r) => r.phase === p.key && r.use >= p.minUse)
      .sort((a, b) => b.use - a.use)
      .slice(0, 6);
    list.forEach((r) => core.add(r.item_id));
    return `<div class="phase"><div class="phase-head"><b>${L(...p.label)}</b><small>${p.sub} ${min}</small></div>
      <div class="item-list">${list.map((r) => itemCard(r.item, { sub: `${fmtNum(r.item.cost)} ${souls} · ~${Math.round(r.avg_buy_time_s / 60)} ${min}`, right: right(r) })).join('') || `<div class="muted" style="font-size:12px">${L('Недостаточно данных', 'Not enough data')}</div>`}</div></div>`;
  }).join('');

  const minM = Math.max(40, heroMatches * 0.01);
  const situ = items
    .filter((r) => !core.has(r.item_id) && r.use >= 0.02 && r.use <= 0.4 && r.matches >= minM && r.delta > 0.01)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);
  root.querySelector('#situational').innerHTML =
    situ.map((r) => itemCard(r.item, { reason: itemReason(r.item), sub: `${fmtNum(r.item.cost)} ${souls} · ${pct(r.use, 0)} ${ofMatches}`, right: `<span class="good">+${(r.delta * 100).toFixed(1)}</span><small>WR ${pct(r.wr)}</small>` })).join('') ||
    `<div class="muted">${L('Недостаточно данных за выбранный период.', 'Not enough data for the selected period.')}</div>`;

  const traps = items
    .filter((r) => r.use >= 0.05 && r.matches >= minM && r.delta < -0.015)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);
  root.querySelector('#traps').innerHTML =
    traps.map((r) => itemCard(r.item, { sub: `${pct(r.use, 0)} ${ofMatches} · ~${Math.round(r.avg_buy_time_s / 60)} ${min}`, right: `<span class="bad">${(r.delta * 100).toFixed(1)}</span><small>WR ${pct(r.wr)}</small>` })).join('') ||
    `<div class="muted">${L('Явных ловушек не найдено — популярные предметы работают.', 'No obvious traps — the popular items work.')}</div>`;
}

function renderSkills(root, h, rows) {
  const el = root.querySelector('#skills');
  const abIds = new Map(h.abilities.map((a, i) => [a.id, i]));
  const valid = (rows || []).filter((r) => r.abilities?.length && r.abilities.every((a) => abIds.has(a)));
  if (!valid.length || !h.abilities.length) {
    el.innerHTML = `<div class="muted">${L('Нет данных о прокачке за выбранный период.', 'No skill order data for the selected period.')}</div>`;
    return;
  }
  // самая популярная (почти) полная последовательность
  const full = valid.filter((r) => r.abilities.length >= 12).sort((a, b) => b.matches - a.matches)[0] || [...valid].sort((a, b) => b.abilities.length - a.abilities.length || b.matches - a.matches)[0];
  const seq = full.abilities;
  root.querySelector('#abilSub').textContent = L(
    `Самая частая полная прокачка: ${fmtNum(full.matches)} матчей, винрейт ${pct(full.wins / full.matches)}. ★ — открытие, цифры — уровень улучшения.`,
    `Most common full skill order: ${fmtNum(full.matches)} matches, ${pct(full.wins / full.matches)} win rate. ★ — unlock, numbers — upgrade level.`,
  );

  const counts = new Array(h.abilities.length).fill(0);
  const cells = h.abilities.map(() => new Array(seq.length).fill(''));
  seq.forEach((abId, step) => {
    const ai = abIds.get(abId);
    cells[ai][step] = counts[ai] === 0 ? '★' : String(counts[ai]);
    counts[ai]++;
  });

  // популярный порядок открытия способностей
  const unlocks = new Map();
  for (const r of valid) {
    const order = [...new Set(r.abilities)].slice(0, 4);
    if (order.length < Math.min(4, h.abilities.length)) continue;
    const k = order.join(',');
    const u = unlocks.get(k) || { order, matches: 0, wins: 0 };
    u.matches += r.matches;
    u.wins += r.wins;
    unlocks.set(k, u);
  }
  const topUnlocks = [...unlocks.values()].sort((a, b) => b.matches - a.matches).slice(0, 3);
  const abName = (a) => (state.lang === 'en' ? a.en : a.ru);

  el.innerHTML = `
    <div class="skill-wrap"><div class="skill-grid" style="grid-template-columns: 190px repeat(${seq.length}, 28px)">
      <div></div>${seq.map((_, i) => `<div class="hd">${i + 1}</div>`).join('')}
      ${h.abilities
        .map((a, ai) => `<div class="ab"><img src="${esc(a.img)}" alt="" />${esc(abName(a))}</div>${cells[ai].map((c) => `<div class="c ${c === '★' ? 'unlock' : c ? 'on' : ''}">${c}</div>`).join('')}`)
        .join('')}
    </div></div>
    ${topUnlocks.length ? `<div style="margin-top:16px"><div class="eyebrow" style="margin-bottom:8px">${L('Порядок открытия', 'Unlock order')}</div>
      <div class="row">${topUnlocks
        .map(
          (u) => `<div class="threat"><div class="row" style="gap:4px">${u.order
            .map((abId, i) => { const a = h.abilities[abIds.get(abId)]; return `${i ? '<span class="muted">›</span>' : ''}<img src="${esc(a.img)}" alt="" title="${esc(abName(a))}" style="width:26px;height:26px;border-radius:5px;background:var(--panel-3);padding:2px" />`; })
            .join('')}</div><div><b class="num ${wrClass(u.wins / u.matches)}">${pct(u.wins / u.matches)}</b><div class="muted" style="font-size:11px">${fmtNum(u.matches)} ${L('матчей', 'matches')}</div></div></div>`,
        )
        .join('')}</div></div>` : ''}`;
}

async function renderMatchups(el, id, heroMatches, alive) {
  try {
    const [counters, syn, lane] = await Promise.all([
      api('/v1/analytics/hero-counter-stats', statParams({ min_matches: 50 })),
      api('/v1/analytics/hero-synergy-stats', statParams({ min_matches: 50 })),
      api('/v1/analytics/hero-synergy-stats', statParams({ same_lane_filter: true, min_matches: 30 })),
    ]);
    if (!alive()) return;
    const minM = Math.max(50, Math.round(heroMatches * 0.004));
    const vs = counters
      .filter((r) => r.hero_id === id && r.matches_played >= minM && A.heroById.has(r.enemy_hero_id))
      .map((r) => ({ other: r.enemy_hero_id, wr: r.wins / r.matches_played, n: r.matches_played }));
    const pair = (rows, min) =>
      rows
        .filter((r) => (r.hero_id1 === id || r.hero_id2 === id) && r.matches_played >= min)
        .map((r) => ({ other: r.hero_id1 === id ? r.hero_id2 : r.hero_id1, wr: r.wins / r.matches_played, n: r.matches_played }))
        .filter((r) => A.heroById.has(r.other));
    const allies = pair(syn, minM).sort((a, b) => b.wr - a.wr).slice(0, 6);
    const lanes = pair(lane, Math.max(30, minM / 3)).sort((a, b) => b.wr - a.wr).slice(0, 6);
    const strong = [...vs].sort((a, b) => b.wr - a.wr).slice(0, 6);
    const weak = [...vs].sort((a, b) => a.wr - b.wr).slice(0, 6);

    const list = (rows) =>
      rows.map((r) => `<div class="mu">${heroLink(hero(r.other), { cls: 'sm' })}<span class="m num">${fmtNum(r.n)}</span><b class="num ${wrClass(r.wr)}">${pct(r.wr)}</b></div>`).join('') ||
      `<div class="empty">${L('Мало данных', 'Too little data')}</div>`;
    const box = (eyebrow, title, sub, rows) =>
      `<div class="panel"><div class="sec-head"><div><div class="eyebrow">${eyebrow}</div><h3 style="font-size:18px;margin-top:4px">${title}</h3><div class="sub">${sub}</div></div></div><div class="mu-list" style="border-top:1px solid var(--line)">${list(rows)}</div></div>`;
    el.innerHTML =
      box(L('Матчапы', 'Matchups'), L('Сильнее против', 'Strong against'), L('Ваш винрейт против этих героев', 'Your win rate against these heroes'), strong) +
      box(L('Матчапы', 'Matchups'), L('Слабее против', 'Weak against'), L('Здесь пригодятся контр-предметы', 'Counter items help here'), weak) +
      box(L('Связки', 'Duos'), L('Лучшие напарники на линии', 'Best lane partners'), `${L('Плюс лучшие союзники в целом', 'Plus the best allies overall')}: ${allies.slice(0, 3).map((a) => esc(hName(hero(a.other)))).join(', ') || '—'}`, lanes);
  } catch (e) {
    if (alive()) el.innerHTML = errorBox(e);
  }
}
