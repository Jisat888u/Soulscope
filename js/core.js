// Общее ядро: состояние фильтров, ассеты, расчёт меты, HTML-компоненты.
import { api } from './api.js';
import { ROLES, ITEM_REASON, SLOT_REASON } from './knowledge.js';

/* ---------------- состояние ---------------- */
const DEFAULTS = { lang: 'ru', badge: 0, period: '7d', theme: 'dark' };
function loadState() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('dt.state') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
export const state = loadState();
const listeners = new Set();
export function onState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setState(patch) {
  Object.assign(state, patch);
  try { localStorage.setItem('dt.state', JSON.stringify(state)); } catch {}
  listeners.forEach((fn) => fn(patch));
}

/* ---------------- язык интерфейса ---------------- */
/** Строка на текущем языке: L('Тир-лист', 'Tier list'). */
export const L = (ru, en) => (state.lang === 'en' ? en : ru);
export const isEn = () => state.lang === 'en';
/** Объект { ru, en } → строка на текущем языке. */
export const tx = (o) => (o == null ? '' : typeof o === 'string' ? o : (state.lang === 'en' ? o.en : o.ru) ?? o.ru ?? o.en ?? '');
export const locale = () => (state.lang === 'en' ? 'en-US' : 'ru-RU');
/** Число с подписью: n(5, ['матч','матча','матчей'], ['match','matches']). */
export const nWord = (n, ru, en) => (state.lang === 'en' ? (n === 1 ? en[0] : en[1]) : plural(n, ...ru));

export const RANKS = [
  { v: 0, get label() { return L('Все ранги', 'All ranks'); } },
  { v: 71, label: 'Emissary+' },
  { v: 81, label: 'Oracle+' },
  { v: 91, label: 'Phantom+' },
  { v: 101, label: 'Ascendant+' },
  { v: 111, label: 'Eternus' },
];
export const PERIODS = [
  { v: 'patch', get label() { return L('Текущий патч', 'Current patch'); } },
  { v: '7d', get label() { return L('7 дней', '7 days'); } },
  { v: '14d', get label() { return L('14 дней', '14 days'); } },
  { v: '30d', get label() { return L('30 дней', '30 days'); } },
];

/** Начало текущего патча (unix, сек) — выставляется после загрузки патчей. */
export const patchInfo = { start: null, title: null, date: null };

const DAY = 86400;
export function nowRounded() {
  return Math.floor(Date.now() / 1000 / 600) * 600; // 10 минут — стабильные ключи кэша
}
/** Текущее окно статистики и предыдущее такой же длины (для Δ винрейта). */
export function timeWindow() {
  const now = nowRounded();
  let min;
  if (state.period === 'patch' && patchInfo.start) min = Math.floor(patchInfo.start / 600) * 600;
  else min = now - DAY * (parseInt(state.period, 10) || 7);
  const len = Math.max(now - min, DAY);
  return { min, max: now, prevMin: min - len, prevMax: min };
}
export function periodLabel() {
  if (state.period === 'patch' && patchInfo.start) return `${L('с патча', 'since patch')} ${patchInfo.title || ''}`.trim();
  const d = parseInt(state.period, 10) || 7;
  return L(`последние ${d} дней`, `last ${d} days`);
}
export function rankLabel() {
  return RANKS.find((r) => r.v === state.badge)?.label || RANKS[0].label;
}
export function statParams(extra = {}) {
  const w = timeWindow();
  return { min_unix_timestamp: w.min, min_average_badge: state.badge || undefined, ...extra };
}

/* ---------------- ассеты ---------------- */
export const A = { heroes: [], heroById: new Map(), items: [], itemById: new Map(), itemByCls: new Map(), ranks: [], seasons: [], updated: null };

export async function loadAssets() {
  const res = await fetch('data/assets.json');
  const data = await res.json();
  A.updated = data.updated;
  A.ranks = data.ranks || [];
  A.seasons = data.seasons || [];
  A.heroes = data.heroes;
  A.items = data.items;
  data.heroes.forEach((h) => A.heroById.set(h.id, h));
  data.items.forEach((i) => {
    A.itemById.set(i.id, i);
    A.itemByCls.set(i.cls, i);
  });
}

/** Догружает из API героев, которых ещё нет в снапшоте (новые релизы). */
export async function ensureHeroes(ids) {
  const missing = [...new Set(ids)].filter((id) => !A.heroById.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const [en, ru] = await Promise.all([
          api(`/v1/assets/heroes/${id}`, { language: 'english' }, 24 * 60),
          api(`/v1/assets/heroes/${id}`, { language: 'russian' }, 24 * 60).catch(() => null),
        ]);
        if (!en || en.player_selectable === false) return;
        const im = en.images || {};
        const h = {
          id,
          en: en.name,
          ru: ru?.name || en.name,
          cls: en.class_name,
          type: en.hero_type || 'unknown',
          tagsEn: en.tags || [],
          tagsRu: ru?.tags || en.tags || [],
          roleEn: en.description?.role || '',
          roleRu: ru?.description?.role || '',
          playEn: '',
          playRu: '',
          img: {
            sm: im.icon_image_small_webp || im.icon_image_small,
            card: im.icon_hero_card_webp || im.icon_hero_card,
            vert: im.top_bar_vertical_image_webp,
            bg: im.background_image_webp || im.background_image,
          },
          abilities: [],
          live: true,
        };
        A.heroes.push(h);
        A.heroById.set(id, h);
      } catch {
        /* герой не нашёлся — покажем заглушку */
      }
    }),
  );
}

export function hero(id) {
  return A.heroById.get(id) || { id, en: `Hero #${id}`, ru: `Герой #${id}`, type: 'unknown', img: {}, abilities: [], tagsEn: [], tagsRu: [], missing: true };
}
export const hName = (h) => (state.lang === 'en' ? h.en : h.ru) || h.en;
/* ранги: badge = tier * 10 + subrank (1–6) */
export const ROMAN_SUB = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
export const rankOf = (tier) => A.ranks.find((r) => r.tier === tier) || { tier, en: `Tier ${tier}`, ru: `Ранг ${tier}`, color: '#777', img: null };
export const rName = (r) => (state.lang === 'en' ? r.en : r.ru) || r.en;
export const badgeName = (badge) => `${rName(rankOf(Math.floor(badge / 10)))} ${ROMAN_SUB[badge % 10] || ''}`.trim();
export const badgeImg = (badge) => `https://api.deadlock-api.com/v1/assets/ranks/${Math.floor(badge / 10)}/${badge % 10}/image?format=webp`;
export const iName = (i) => (state.lang === 'en' ? i.en : i.ru) || i.en;
export const iDesc = (i) => (state.lang === 'en' ? i.descEn : i.descRu) || i.descEn || '';
export const itemReason = (i) => tx(ITEM_REASON[i.cls] || SLOT_REASON[i.slot]);

/* ---------------- мета / тир-лист ---------------- */
export const TIERS = [
  { key: 'splus', label: 'S+', min: 75 },
  { key: 's', label: 'S', min: 63 },
  { key: 'a', label: 'A', min: 53 },
  { key: 'b', label: 'B', min: 43 },
  { key: 'c', label: 'C', min: 33 },
  { key: 'd', label: 'D', min: -Infinity },
];
export const tierOf = (rating) => TIERS.find((t) => rating >= t.min);

const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1;
};

function computeMeta(rows, prevRows) {
  const prev = new Map((prevRows || []).map((r) => [r.hero_id, r]));
  const totalMatches = rows.reduce((s, r) => s + r.matches, 0) / 12 || 1;
  const K = 250; // байесовское сглаживание к 50%
  const list = rows
    .filter((r) => r.matches > 0 && A.heroById.has(r.hero_id))
    .map((r) => {
      const p = prev.get(r.hero_id);
      const wr = r.wins / r.matches;
      const wrPrev = p && p.matches >= 200 ? p.wins / p.matches : null;
      return {
        id: r.hero_id,
        hero: hero(r.hero_id),
        matches: r.matches,
        wins: r.wins,
        wr,
        wrAdj: (r.wins + 0.5 * K) / (r.matches + K),
        wrPrev,
        dwr: wrPrev == null ? null : wr - wrPrev,
        pick: r.matches / totalMatches,
        kda: (r.total_kills + r.total_assists) / Math.max(1, r.total_deaths),
        kills: r.total_kills / r.matches,
        deaths: r.total_deaths / r.matches,
        assists: r.total_assists / r.matches,
        dmg: r.total_player_damage / r.matches,
        nw: r.total_net_worth / r.matches,
        lh: r.total_last_hits / r.matches,
        acc: r.total_shots_hit / Math.max(1, r.total_shots_hit + r.total_shots_missed),
      };
    });
  const wrs = list.map((x) => x.wrAdj);
  const picks = list.map((x) => Math.log(x.pick));
  const mw = mean(wrs), sw = sd(wrs), mp = mean(picks), sp = sd(picks);
  for (const x of list) {
    const z = 0.8 * ((x.wrAdj - mw) / sw) + 0.2 * ((Math.log(x.pick) - mp) / sp);
    x.rating = Math.max(1, Math.min(99, Math.round(50 + 15 * z)));
    x.tier = tierOf(x.rating);
  }
  list.sort((a, b) => b.rating - a.rating);
  list.forEach((x, i) => (x.rank = i + 1));
  return { list, totalMatches, byId: new Map(list.map((x) => [x.id, x])) };
}

const metaCache = new Map();
/** Мета за текущее окно фильтров (+ предыдущее окно для Δ). */
export async function getMeta() {
  const w = timeWindow();
  const key = `${w.min}|${state.badge}`;
  if (metaCache.has(key)) return metaCache.get(key);
  const p = (async () => {
    const badge = state.badge || undefined;
    const [cur, prev] = await Promise.all([
      api('/v1/analytics/hero-stats', { min_unix_timestamp: w.min, min_average_badge: badge }),
      api('/v1/analytics/hero-stats', { min_unix_timestamp: w.prevMin, max_unix_timestamp: w.prevMax, min_average_badge: badge }).catch(() => []),
    ]);
    await ensureHeroes(cur.map((r) => r.hero_id));
    return computeMeta(cur, prev);
  })();
  metaCache.set(key, p);
  p.catch(() => metaCache.delete(key));
  return p;
}

/** Сырые hero-stats за произвольное окно (для патч-трекера). */
/** Интервалы длительности матча для графика «сила по ходу матча» (минуты). */
export const DURATION_BUCKETS = [
  { min: 0, max: 20, label: '<20' },
  { min: 20, max: 25, label: '20–25' },
  { min: 25, max: 30, label: '25–30' },
  { min: 30, max: 35, label: '30–35' },
  { min: 35, max: 40, label: '35–40' },
  { min: 40, max: 45, label: '40–45' },
  { min: 45, max: null, label: '45+' },
];

const durationCache = new Map();
/** hero-stats по каждому интервалу длительности (все герои сразу — один набор запросов на фильтр). */
export function getDurationStats() {
  const w = timeWindow();
  const key = `${w.min}|${state.badge}`;
  if (durationCache.has(key)) return durationCache.get(key);
  const p = Promise.all(
    DURATION_BUCKETS.map((b) =>
      api('/v1/analytics/hero-stats', {
        min_unix_timestamp: w.min,
        min_average_badge: state.badge || undefined,
        min_duration_s: b.min * 60,
        max_duration_s: b.max == null ? undefined : b.max * 60,
      }).then((rows) => new Map(rows.map((r) => [r.hero_id, r]))),
    ),
  );
  durationCache.set(key, p);
  p.catch(() => durationCache.delete(key));
  return p;
}

/** Души героя по минутам матча (среднее и разброс), с учётом фильтров ранга и периода. */
export function getSoulCurve(heroId) {
  return api('/v1/analytics/player-performance-curve', statParams({ hero_ids: heroId, resolution: 0 }), 60);
}

export function heroStatsWindow(min, max) {
  return api('/v1/analytics/hero-stats', { min_unix_timestamp: min, max_unix_timestamp: max, min_average_badge: state.badge || undefined }, 60);
}

/* ---------------- форматирование ---------------- */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : (x * 100).toFixed(d) + '%');
export function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
  return String(Math.round(n));
}
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
export function timeAgo(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 3600) { const m = Math.max(1, Math.round(s / 60)); return L(`${m} мин назад`, `${m} min ago`); }
  if (s < 86400) { const h = Math.round(s / 3600); return L(`${h} ${plural(h, 'час', 'часа', 'часов')} назад`, `${h} ${h === 1 ? 'hour' : 'hours'} ago`); }
  const d = Math.round(s / 86400);
  return L(`${d} ${plural(d, 'день', 'дня', 'дней')} назад`, `${d} ${d === 1 ? 'day' : 'days'} ago`);
}
export const fmtDate = (d) => new Date(d).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });

/* ---------------- компоненты ---------------- */
const PLACEHOLDER = 'img/logo.svg';
export function heroImg(h, cls = '') {
  return `<img class="hicon ${cls}" src="${esc(h.img?.sm || h.img?.card || PLACEHOLDER)}" alt="" loading="lazy" onerror="this.src='${PLACEHOLDER}'" />`;
}
export function heroLink(h, { cls = '', sub = '' } = {}) {
  return `<a class="hero-link" href="#/hero/${h.id}">${heroImg(h, cls)}<span style="min-width:0"><span class="hname">${esc(hName(h))}</span>${sub ? `<div class="role-tag">${sub}</div>` : ''}</span></a>`;
}
export const roleName = (type) => { const r = ROLES[type] || ROLES.unknown; return L(r.one, r.oneEn); };
export const rolesName = (type) => { const r = ROLES[type] || ROLES.unknown; return L(r.ru, r.en); };
export const tierBadge = (t) => `<span class="tier t-${t.key}">${t.label}</span>`;
export function ratingBar(r) {
  return `<div class="rating"><div class="bar"><i style="width:${r}%"></i></div><div class="val num">${r}<small>/100</small></div></div>`;
}
export function deltaHtml(d, digits = 1) {
  if (d == null) return '<span class="delta flat">—</span>';
  const v = d * 100;
  if (Math.abs(v) < 0.05) return '<span class="delta flat">0.0</span>';
  return `<span class="delta ${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲ +' : '▼ '}${v.toFixed(digits)}</span>`;
}
export const wrClass = (wr) => (wr >= 0.52 ? 'good' : wr <= 0.48 ? 'bad' : '');

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export function itemIcon(item) {
  return `<span class="ib slot-${item.slot}"><img src="${esc(item.img)}" alt="" loading="lazy" /><span class="t">${ROMAN[item.tier] || ''}</span></span>`;
}
/** Карточка предмета: иконка, название, подпись и правая колонка с цифрами. */
export function itemCard(item, { sub = '', right = '', reason = '' } = {}) {
  return `<div class="item slot-${item.slot}" data-item="${item.id}">
    ${itemIcon(item)}
    <div style="min-width:0"><div class="nm">${esc(iName(item))}</div>${sub ? `<div class="sub2">${sub}</div>` : ''}${reason ? `<span class="reason">${esc(reason)}</span>` : ''}</div>
    <div class="st">${right}</div>
  </div>`;
}

/** Предупреждение о маленькой выборке (узкий ранг + короткий период). */
export const sampleWarning = (meta) =>
  meta.totalMatches < 5000
    ? `<div class="error" style="margin-bottom:18px;padding:10px 14px">⚠ ${L(`Всего ${fmtNum(meta.totalMatches)} матчей в выборке — цифры могут сильно колебаться. Расширьте период или ранг для надёжных выводов.`, `Only ${fmtNum(meta.totalMatches)} matches in the sample — numbers may swing a lot. Widen the period or rank for reliable conclusions.`)}</div>`
    : '';

/** Заглушка загрузки: подпись со спиннером и мерцающие «скелетоны» по форме будущего контента. */
export const loading = (text = L('Загружаем данные…', 'Loading data…')) => `<div class="loading" aria-busy="true">
  <div class="loading-label"><div class="spinner"></div>${esc(text)}</div>
  <div class="sk-lines"><i class="skeleton" style="width:38%"></i><i class="skeleton" style="width:72%"></i><i class="skeleton" style="width:56%"></i></div>
  <div class="sk-blocks"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div>
</div>`;
export const errorBox = (e) =>
  `<div class="error"><b>${L('Не удалось загрузить данные.', 'Failed to load data.')}</b><br><span class="muted">${esc(e?.message || e)}</span><br><button class="btn" style="margin-top:10px" onclick="location.reload()">${L('Обновить страницу', 'Reload page')}</button></div>`;

export function segmented(options, value, attr) {
  return `<div class="seg">${options.map((o) => `<button data-${attr}="${o.v}" class="${String(o.v) === String(value) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
}

/** Общая панель фильтров (ранг, период). */
export function filterBar(extra = '') {
  return `<div class="filterbar" id="filters">
    <label>${L('Ранг', 'Rank')}</label>${segmented(RANKS, state.badge, 'badge')}
    <label>${L('Период', 'Period')}</label>${segmented(PERIODS, state.period, 'period')}
    ${extra}
  </div>`;
}
export function bindFilterBar(root) {
  root.querySelectorAll('[data-badge]').forEach((b) => b.addEventListener('click', () => setState({ badge: +b.dataset.badge })));
  root.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => setState({ period: b.dataset.period })));
}

/* ---------------- тултипы ---------------- */
export function initTooltips() {
  const tip = document.getElementById('tip');
  let current = null;
  const SLOT = { weapon: ['Оружие', 'Weapon'], vitality: ['Живучесть', 'Vitality'], spirit: ['Дух', 'Spirit'] };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-item],[data-tip]');
    if (el === current) return;
    current = el;
    if (!el) return tip.classList.remove('show');
    if (el.dataset.item) {
      const it = A.itemById.get(+el.dataset.item);
      if (!it) return;
      tip.innerHTML = `<div class="tt">${esc(iName(it))}</div><div class="tm">${SLOT[it.slot] ? L(...SLOT[it.slot]) : ''} · ${L('тир', 'tier')} ${it.tier} · ${fmtNum(it.cost)} ${L('душ', 'souls')}${it.active ? L(' · активный', ' · active') : ''}</div><div class="td">${esc(iDesc(it))}</div>`;
    } else {
      tip.innerHTML = `<div class="td">${el.dataset.tip}</div>`;
    }
    tip.classList.add('show');
  });
  document.addEventListener('mousemove', (e) => {
    if (!current) return;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  window.addEventListener('hashchange', () => { current = null; tip.classList.remove('show'); });
}
