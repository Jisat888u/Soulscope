// Ранги: распределение игроков по рангам и подрангам, «где вы» относительно остальных.
import { api } from '../api.js';
import { A, state, loading, errorBox, esc, fmtNum, plural, segmented, rankOf, rName, badgeName, badgeImg, ROMAN_SUB, nowRounded } from '../core.js';

const PERIODS = [
  { v: 'season', label: 'Весь сезон' },
  { v: '30', label: '30 дней' },
  { v: '7', label: '7 дней' },
];
const view = { period: 'season', myBadge: readMyBadge() };

function readMyBadge() {
  try { return +localStorage.getItem('dt.myBadge') || 0; } catch { return 0; }
}
function saveMyBadge(b) {
  try { localStorage.setItem('dt.myBadge', String(b)); } catch {}
}

const pctTxt = (x, d = 1) => (x * 100).toFixed(x < 0.01 && x > 0 ? 2 : d) + '%';
const fmtFull = (n) => n.toLocaleString('ru-RU');

/** Текущий интервал рейтингового сезона (для подписи и даты окончания). */
function currentInterval() {
  const now = Date.now() / 1000;
  for (const s of A.seasons) for (const i of s.intervals) if (now >= i.start_timestamp && now < i.end_timestamp) return { season: s, interval: i };
  return null;
}

export async function render(root, { alive }) {
  const head = () => `<div class="filterbar"><label>Период</label>${segmented(PERIODS, view.period, 'rperiod')}
    <span class="note">За период считается ранг игрока после его последнего рейтингового матча; игроки на калибровке не учитываются.</span></div>`;
  root.innerHTML = head() + loading('Считаем игроков по рангам…');
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

  const tile = (k, v, sub = '') => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="note">${sub}</div>` : ''}</div>`;
  const badgeChip = (r) => `<span class="row" style="gap:6px;flex-wrap:nowrap"><img src="${esc(badgeImg(r.badge))}" alt="" class="rk-badge" loading="lazy" />${esc(badgeName(r.badge))}</span>`;

  root.innerHTML = `
    ${head()}
    <section class="section panel pad">
      <div class="eyebrow">${ci ? esc(ci.season.name) + (ci.season.intervals.length > 1 ? ` · интервал ${ci.interval.interval}` : '') : 'Рейтинговый режим'}</div>
      <h2>Распределение рангов</h2>
      <div class="sub">Сколько игроков сидит на каждом ранге и какой процент сообщества вы обгоняете.</div>
      <div class="rk-kpis">
        ${tile('Игроков с рангом', fmtNum(total), fmtFull(total))}
        ${tile('Медианный ранг', median ? badgeChip(median) : '—', 'половина игроков ниже')}
        ${tile('Самый массовый', badgeChip(mode), `${pctTxt(mode.share)} игроков`)}
        ${tile('Порог топ-1%', badgeChip(top1), 'и выше')}
        ${tile('Конец сезона', seasonEnd ? seasonEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '—', seasonEnd ? `через ${Math.max(0, Math.ceil((seasonEnd - Date.now()) / 864e5))} ${plural(Math.max(0, Math.ceil((seasonEnd - Date.now()) / 864e5)), 'день', 'дня', 'дней')}` : '')}
      </div>
    </section>

    <section class="section grid-2 rk-top">
      <div class="panel pad">
        <div class="eyebrow">Калькулятор</div>
        <h2>Где вы среди игроков?</h2>
        <div class="rk-tiers" id="rkPickTier">${tiers
          .map((t) => `<button class="rk-pick ${Math.floor(view.myBadge / 10) === t.tier ? 'on' : ''}" data-tier="${t.tier}" title="${esc(rName(t.rank))}"><img src="${esc(t.rank.img)}" alt="" /><span>${esc(rName(t.rank))}</span></button>`)
          .join('')}</div>
        <div class="row" style="margin-top:12px"><label class="note" style="text-transform:uppercase;letter-spacing:.12em">Деление</label>
          <div class="seg" id="rkPickSub">${[1, 2, 3, 4, 5, 6].map((s) => `<button data-sub="${s}" class="${view.myBadge % 10 === s ? 'on' : ''}">${ROMAN_SUB[s]}</button>`).join('')}</div></div>
        <div id="rkResult" class="rk-result"></div>
      </div>
      <div class="panel">
        <div class="sec-head"><div><div class="eyebrow">Ранги</div><h2>Доля игроков по рангам</h2></div></div>
        <div class="rk-cards">${tiers
          .map(
            (t) => `<div class="rk-card" style="--rk:${esc(t.rank.color)}">
              <img src="${esc(t.rank.img)}" alt="" loading="lazy" />
              <div style="min-width:0"><div class="rk-name">${esc(rName(t.rank))}</div><div class="note">${esc(state.lang === 'en' ? t.rank.ru : t.rank.en)} · ${fmtNum(t.players)}</div>
                <div class="rk-meter"><i style="width:${(t.share / Math.max(...tiers.map((x) => x.share))) * 100}%"></i></div></div>
              <div class="rk-val"><b>${pctTxt(t.share)}</b><div class="note">топ ${pctTxt(t.top)}</div></div>
            </div>`,
          )
          .join('')}</div>
      </div>
    </section>

    <section class="section panel">
      <div class="sec-head"><div><div class="eyebrow">Подробно</div><h2>Игроки по подрангам</h2>
        <div class="sub">Каждый столбец — деление ранга (I–VI), высота — доля всех игроков с рангом. <span class="rk-key"><i></i>ваш ранг</span></div></div></div>
      <div class="rk-chart-wrap"><div class="rk-chart" id="rkChart"></div></div>
      <details class="rk-details"><summary>Таблица по всем подрангам</summary>
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
                (r) => `<div class="rk-col ${r.badge === view.myBadge ? 'me' : ''}" data-badge="${r.badge}" data-tip="<b>${esc(badgeName(r.badge))}</b><br>${pctTxt(r.share, 2)} игроков · ${fmtFull(r.players)}<br>выше ${pctTxt(r.below)} · топ ${pctTxt(r.top)}">
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
        <div class="rk-hero">топ ${pctTxt(r.top)}</div>
        <div class="prose">Вы выше <b>${pctTxt(r.below)}</b> игроков. На этом делении ещё ${pctTxt(r.share, 2)} сообщества (${fmtFull(r.players)} чел.).</div></div>`;
  };

  root.querySelector('#rkTable').innerHTML = `<thead><tr><th>Подранг</th><th class="r">Игроки</th><th class="r">Доля</th><th class="r">Выше чем</th><th class="r">Топ</th></tr></thead>
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
