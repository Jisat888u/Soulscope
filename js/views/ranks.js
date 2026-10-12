// Ранги: распределение игроков по рангам и подрангам, «где вы» относительно остальных.
import { api } from '../api.js';
import { A, state, L, locale, loading, errorBox, esc, fmtNum, plural, segmented, rankOf, rName, badgeName, badgeImg, ROMAN_SUB, nowRounded } from '../core.js';

const PERIODS = [
  { v: 'season', get label() { return L('Весь сезон', 'Whole season'); } },
  { v: '30', get label() { return L('30 дней', '30 days'); } },
  { v: '7', get label() { return L('7 дней', '7 days'); } },
];
const view = { period: 'season', myBadge: readMyBadge() };

function readMyBadge() {
  try { return +localStorage.getItem('dt.myBadge') || 0; } catch { return 0; }
}
function saveMyBadge(b) {
  try { localStorage.setItem('dt.myBadge', String(b)); } catch {}
}

const pctTxt = (x, d = 1) => (x * 100).toFixed(x < 0.01 && x > 0 ? 2 : d) + '%';
const fmtFull = (n) => n.toLocaleString(locale());

/** Текущий интервал рейтингового сезона (для подписи и даты окончания). */
function currentInterval() {
  const now = Date.now() / 1000;
  for (const s of A.seasons) for (const i of s.intervals) if (now >= i.start_timestamp && now < i.end_timestamp) return { season: s, interval: i };
  return null;
}

export async function render(root, { alive }) {
  const head = () => `<div class="filterbar"><label>${L('Период', 'Period')}</label>${segmented(PERIODS, view.period, 'rperiod')}
    <span class="note">${L('За период считается ранг игрока после его последнего рейтингового матча; игроки на калибровке не учитываются.', 'A player’s rank after their last ranked match in the period is counted; players still in placement are excluded.')}</span></div>`;
  root.innerHTML = head() + loading(L('Считаем игроков по рангам…', 'Counting players by rank…'));
  const bindHead = () =>
    root.querySelectorAll('[data-rperiod]').forEach((b) => b.addEventListener('click', () => { view.period = b.dataset.rperiod; render(root, { alive }); }));
  bindHead();

  let rows;
  try {
    const min = view.period === 'season' ? undefined : nowRounded() - +view.period * 86400;
    rows = await api('/v1/players/rank/distribution', { min_unix_timestamp: min }, 30);
  } catch (e) {
    if (alive()) { root.innerHTML = head() + errorBox(e); bindHead(); }
    return;
  }
  if (!alive()) return;

  // badge → игроки; считаем доли и перцентили (от низшего ранга к высшему)
  const data = rows
    .filter((r) => r.rank >= 1 && r.subrank >= 1)
    .map((r) => ({ badge: r.badge, tier: r.rank, sub: r.subrank, players: r.players }))
    .sort((a, b) => a.badge - b.badge);
  const total = data.reduce((s, r) => s + r.players, 0) || 1;
  let below = 0;
  for (const r of data) {
    r.share = r.players / total;
    r.below = below / total; // доля игроков ниже этого подранга
    below += r.players;
    r.top = 1 - r.below; // этот подранг и выше
  }
  const tiers = [...new Set(data.map((r) => r.tier))].map((t) => {
    const subs = data.filter((r) => r.tier === t);
    const players = subs.reduce((s, r) => s + r.players, 0);
    return { tier: t, rank: rankOf(t), subs, players, share: players / total, top: subs[0].top };
  });

  const median = data.find((r) => r.below + r.share >= 0.5);
  const mode = [...data].sort((a, b) => b.players - a.players)[0];
  const top1 = [...data].reverse().find((r) => r.top >= 0.01) || data.at(-1);
  const ci = currentInterval();
  const seasonEnd = ci ? new Date(ci.interval.end_timestamp * 1000) : null;

  if (!data.some((r) => r.badge === view.myBadge)) view.myBadge = median?.badge || data[0].badge;

  const days = seasonEnd ? Math.max(0, Math.ceil((seasonEnd - Date.now()) / 864e5)) : 0;
  const tile = (k, v, sub = '') => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="note">${sub}</div>` : ''}</div>`;
  const badgeChip = (r) => `<span class="row" style="gap:6px;flex-wrap:nowrap"><img src="${esc(badgeImg(r.badge))}" alt="" class="rk-badge" loading="lazy" />${esc(badgeName(r.badge))}</span>`;

  root.innerHTML = `
    ${head()}
    <section class="section panel pad">
      <div class="eyebrow">${ci ? esc(L(ci.season.name, ci.season.nameEn || ci.season.name)) + (ci.season.intervals.length > 1 ? ` · ${L('интервал', 'interval')} ${ci.interval.interval}` : '') : L('Рейтинговый режим', 'Ranked mode')}</div>
      <h2>${L('Распределение рангов', 'Rank distribution')}</h2>
      <div class="sub">${L('Сколько игроков сидит на каждом ранге и какой процент сообщества вы обгоняете.', 'How many players are at each rank and what share of the community you’re ahead of.')}</div>
      <div class="rk-kpis">
        ${tile(L('Игроков с рангом', 'Ranked players'), fmtNum(total), fmtFull(total))}
        ${tile(L('Медианный ранг', 'Median rank'), median ? badgeChip(median) : '—', L('половина игроков ниже', 'half of players are below'))}
        ${tile(L('Самый массовый', 'Most common'), badgeChip(mode), `${pctTxt(mode.share)} ${L('игроков', 'of players')}`)}
        ${tile(L('Порог топ-1%', 'Top 1% threshold'), badgeChip(top1), L('и выше', 'and above'))}
        ${tile(L('Конец сезона', 'Season ends'), seasonEnd ? `<span>${seasonEnd.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}</span>` : '—', seasonEnd ? L(`через ${days} ${plural(days, 'день', 'дня', 'дней')}`, `in ${days} ${days === 1 ? 'day' : 'days'}`) : '')}
      </div>
    </section>

    <section class="section grid-2 rk-top">
      <div class="panel pad">
        <div class="eyebrow">${L('Калькулятор', 'Calculator')}</div>
        <h2>${L('Где вы среди игроков?', 'Where do you stand?')}</h2>
        <div class="rk-tiers" id="rkPickTier">${tiers
          .map((t) => `<button class="rk-pick ${Math.floor(view.myBadge / 10) === t.tier ? 'on' : ''}" data-tier="${t.tier}" title="${esc(rName(t.rank))}"><img src="${esc(t.rank.img)}" alt="" /><span>${esc(rName(t.rank))}</span></button>`)
          .join('')}</div>
        <div class="row" style="margin-top:12px"><label class="note" style="text-transform:uppercase;letter-spacing:.12em">${L('Деление', 'Division')}</label>
          <div class="seg" id="rkPickSub">${[1, 2, 3, 4, 5, 6].map((s) => `<button data-sub="${s}" class="${view.myBadge % 10 === s ? 'on' : ''}">${ROMAN_SUB[s]}</button>`).join('')}</div></div>
        <div id="rkResult" class="rk-result"></div>
      </div>
      <div class="panel">
        <div class="sec-head"><div><div class="eyebrow">${L('Ранги', 'Ranks')}</div><h2>${L('Доля игроков по рангам', 'Share of players by rank')}</h2></div></div>
        <div class="rk-cards">${tiers
          .map(
            (t) => `<div class="rk-card" style="--rk:${esc(t.rank.color)}">
              <img src="${esc(t.rank.img)}" alt="" loading="lazy" />
              <div style="min-width:0"><div class="rk-name">${esc(rName(t.rank))}</div><div class="note">${esc(state.lang === 'en' ? t.rank.ru : t.rank.en)} · ${fmtNum(t.players)}</div>
                <div class="rk-meter"><i style="width:${(t.share / Math.max(...tiers.map((x) => x.share))) * 100}%"></i></div></div>
              <div class="rk-val"><b>${pctTxt(t.share)}</b><div class="note">${L('топ', 'top')} ${pctTxt(t.top)}</div></div>
            </div>`,
          )
          .join('')}</div>
      </div>
    </section>

    <section class="section panel">
      <div class="sec-head"><div><div class="eyebrow">${L('Подробно', 'Details')}</div><h2>${L('Игроки по подрангам', 'Players by division')}</h2>
        <div class="sub">${L('Каждый столбец — деление ранга (I–VI), высота — доля всех игроков с рангом.', 'Each bar is a rank division (I–VI); height is the share of all ranked players.')} <span class="rk-key"><i></i>${L('ваш ранг', 'your rank')}</span></div></div></div>
      <div class="rk-chart-wrap"><div class="rk-chart" id="rkChart"></div></div>
      <details class="rk-details"><summary>${L('Таблица по всем подрангам', 'Table of all divisions')}</summary>
        <div class="table-wrap"><table class="data" id="rkTable"></table></div></details>
    </section>`;
  bindHead();

  const drawChart = () => {
    const maxShare = Math.max(...data.map((r) => r.share));
    const step = [0.005, 0.01, 0.02, 0.025, 0.05].find((s) => maxShare / s <= 5) || 0.05;
    const yMax = Math.ceil(maxShare / step) * step;
    const ticks = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v);
    const label = (r) => r.badge === view.myBadge || r === mode;
    root.querySelector('#rkChart').innerHTML = `
      <div class="rk-plot">
        ${ticks.map((v) => `<div class="rk-grid" style="bottom:${(v / yMax) * 100}%"><span>${(v * 100).toFixed(step < 0.01 ? 1 : 0)}%</span></div>`).join('')}
        <div class="rk-bars">${tiers
          .map(
            (t) => `<div class="rk-group">${t.subs
              .map(
                (r) => `<div class="rk-col ${r.badge === view.myBadge ? 'me' : ''}" data-badge="${r.badge}" data-tip="<b>${esc(badgeName(r.badge))}</b><br>${pctTxt(r.share, 2)} ${L('игроков', 'of players')} · ${fmtFull(r.players)}<br>${L('выше', 'above')} ${pctTxt(r.below)} · ${L('топ', 'top')} ${pctTxt(r.top)}">
                  ${label(r) ? `<span class="rk-cap" style="bottom:calc(${(r.share / yMax) * 100}% + 4px)">${pctTxt(r.share)}</span>` : ''}
                  <i style="height:${(r.share / yMax) * 100}%"></i></div>`,
              )
              .join('')}</div>`,
          )
          .join('')}</div>
      </div>
      <div class="rk-axis">${tiers.map((t) => `<div class="rk-group-label"><img src="${esc(t.rank.img)}" alt="" loading="lazy" /><span>${esc(rName(t.rank))}</span></div>`).join('')}</div>`;
  };

  const drawResult = () => {
    const r = data.find((x) => x.badge === view.myBadge);
    if (!r) return;
    root.querySelector('#rkResult').innerHTML = `
      <img src="${esc(badgeImg(r.badge))}" alt="" class="rk-result-img" />
      <div><div class="note">${esc(badgeName(r.badge))}</div>
        <div class="rk-hero">${L('топ', 'top')} ${pctTxt(r.top)}</div>
        <div class="prose">${L(
          `Вы выше <b>${pctTxt(r.below)}</b> игроков. На этом делении ещё ${pctTxt(r.share, 2)} сообщества (${fmtFull(r.players)} чел.).`,
          `You’re above <b>${pctTxt(r.below)}</b> of players. This division holds another ${pctTxt(r.share, 2)} of the community (${fmtFull(r.players)} players).`,
        )}</div></div>`;
  };

  root.querySelector('#rkTable').innerHTML = `<thead><tr><th>${L('Подранг', 'Division')}</th><th class="r">${L('Игроки', 'Players')}</th><th class="r">${L('Доля', 'Share')}</th><th class="r">${L('Выше чем', 'Above')}</th><th class="r">${L('Топ', 'Top')}</th></tr></thead>
    <tbody>${[...data]
      .reverse()
      .map((r) => `<tr><td>${badgeChip(r)}</td><td class="r num">${fmtFull(r.players)}</td><td class="r num">${pctTxt(r.share, 2)}</td><td class="r num">${pctTxt(r.below)}</td><td class="r num">${pctTxt(r.top)}</td></tr>`)
      .join('')}</tbody>`;

  const setBadge = (b) => {
    view.myBadge = b;
    saveMyBadge(b);
    root.querySelectorAll('.rk-pick').forEach((x) => x.classList.toggle('on', +x.dataset.tier === Math.floor(b / 10)));
    root.querySelectorAll('#rkPickSub button').forEach((x) => x.classList.toggle('on', +x.dataset.sub === b % 10));
    drawChart();
    drawResult();
  };
  root.querySelector('#rkPickTier').addEventListener('click', (e) => {
    const p = e.target.closest('[data-tier]');
    if (p) setBadge(+p.dataset.tier * 10 + (view.myBadge % 10 || 1));
  });
  root.querySelector('#rkPickSub').addEventListener('click', (e) => {
    const p = e.target.closest('[data-sub]');
    if (p) setBadge(Math.floor(view.myBadge / 10) * 10 + +p.dataset.sub);
  });
  root.querySelector('#rkChart').addEventListener('click', (e) => {
    const c = e.target.closest('[data-badge]');
    if (c) setBadge(+c.dataset.badge);
  });
  drawChart();
  drawResult();
}
