// Загрузка и разбор патчноутов: группировка по героям/предметам, бафф или нерф, краткие выводы.
import { api } from './api.js';
import { A } from './core.js';
import { STAT_RU, INVERSE_STATS, CURATED_PATCHES } from './knowledge.js';

const ALIASES = { doorman: 69, 'the doorman': 69, 'mo and krill': 18, 'mo & krill': 18, mo: 18, geist: 4, talon: 17, 'grey talon': 17, 'gray talon': 17 };

function nameIndex() {
  const heroes = new Map(Object.entries(ALIASES));
  for (const h of A.heroes) heroes.set(h.en.toLowerCase(), h.id);
  const items = new Map();
  for (const i of A.items) items.set(i.en.toLowerCase(), i.id);
  return { heroes, items };
}

function htmlToLines(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  doc.querySelectorAll('p,li,div,h1,h2,h3,h4,ul').forEach((e) => e.append('\n'));
  return doc.body.textContent
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function firstImage(html) {
  const m = /<img[^>]+src="([^"]+)"/i.exec(html || '');
  return m && /^https:\/\/[^"]*steamstatic\.com\//.test(m[1]) ? m[1] : null;
}

const firstNum = (s) => {
  const m = /[-+]?\d+(?:\.\d+)?/.exec(String(s).replace(',', '.'));
  return m ? parseFloat(m[0]) : null;
};

function translateStat(stat) {
  const m = /^(T[123]\s+)?(.*)$/i.exec(stat.trim());
  const prefix = m[1] ? m[1].toUpperCase() : '';
  const core = m[2].trim();
  const ru = STAT_RU[core.toLowerCase()];
  return prefix + (ru || core);
}

const isInverse = (stat) => {
  const s = stat.toLowerCase();
  return INVERSE_STATS.some((k) => s.includes(k));
};

const LBL = {
  fix: { ru: 'Исправление', en: 'Fix' },
  unpenalty: { ru: 'Убран минус', en: 'Downside removed' },
  removed: { ru: 'Убрано', en: 'Removed' },
  added: { ru: 'Новое', en: 'New' },
  rework: { ru: 'Переработка', en: 'Rework' },
  change: { ru: 'Изменение', en: 'Change' },
};

/** Разбирает одну строку изменения. Возвращает { ability, text: {ru,en}, label: {ru,en}, effect: buff|nerf|neutral, kind }. */
export function analyzeChange(rest) {
  let ability = '';
  let change = rest.trim();
  const dash = change.indexOf(' - ');
  if (dash > 0 && dash < 48) {
    ability = change.slice(0, dash).trim();
    change = change.slice(dash + 3).trim();
  }
  const out = { ability, orig: change, text: { ru: change, en: change }, effect: 'neutral', kind: 'change' };

  if (/^(fixed|fix|bug ?fix)/i.test(change)) return { ...out, kind: 'fix', label: LBL.fix };

  let stat, from, to, verb;
  let m = /^(.*?)\s+(increased|reduced|decreased|lowered|raised|improved)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s*\((.*)\))?\.?$/i.exec(change);
  if (m) [, stat, verb, from, to] = m;
  if (!m) {
    m = /^(increased|reduced|decreased|lowered|raised)\s+(.*?)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s*\((.*)\))?\.?$/i.exec(change);
    if (m) [, verb, stat, from, to] = m;
  }
  if (!m) {
    m = /^(.*?)\s+(?:changed\s+)?from\s+(.+?)\s+to\s+(.+?)(?:\s*\((.*)\))?\.?$/i.exec(change);
    if (m) [, stat, from, to] = m;
  }
  if (!m) {
    // «T1 +1m/s Move Speed to +2m/s Move Speed»
    m = /^(T[123])\s+(.+?)\s+to\s+(.+?)\.?$/i.exec(change);
    if (m) { stat = m[1] + ' ' + m[2].replace(/[-+\d.%a-z/]+\s/i, ''); from = m[2]; to = m[3]; }
  }

  if (stat != null && from != null) {
    const a = firstNum(from), b = firstNum(to);
    let up = null;
    if (a != null && b != null && a !== b) up = b > a;
    else if (verb) up = /increased|raised|improved/i.test(verb);
    if (up != null) {
      const good = isInverse(stat) ? !up : up;
      return {
        ...out,
        kind: 'num',
        effect: good ? 'buff' : 'nerf',
        text: { ru: `${translateStat(stat)}: ${from.trim()} → ${to.trim()}`, en: `${stat.trim()}: ${from.trim()} → ${to.trim()}` },
        up,
      };
    }
  }

  m = /^(.*?)\s+(increased|reduced|decreased|lowered|raised)\s+by\s+(.+?)\.?$/i.exec(change);
  if (m) {
    const up = /increased|raised/i.test(m[2]);
    const good = isInverse(m[1]) ? !up : up;
    return { ...out, kind: 'num', effect: good ? 'buff' : 'nerf', text: { ru: `${translateStat(m[1])}: ${up ? '+' : '−'}${m[3]}`, en: `${m[1].trim()}: ${up ? '+' : '−'}${m[3]}` } };
  }

  if (/\bno longer\b/i.test(change)) {
    const bad = /\bno longer\b.*\b(penalt|self|interrupt|cancel|require|cost|reduce[sd]? your|lose)/i.test(change);
    return { ...out, effect: bad ? 'buff' : 'nerf', label: bad ? LBL.unpenalty : LBL.removed };
  }
  if (/\b(can now|now also|now gains?|now grants?|added|now applies|now deals|now heals|now has)\b/i.test(change)) return { ...out, effect: 'buff', label: LBL.added };
  if (/\b(removed)\b/i.test(change)) return { ...out, effect: 'nerf', label: LBL.removed };
  if (/\b(rework|reworked|redesigned)\b/i.test(change)) return { ...out, label: LBL.rework };
  return { ...out, label: LBL.change };
}

function verdictOf(changes) {
  const b = changes.filter((c) => c.effect === 'buff').length;
  const n = changes.filter((c) => c.effect === 'nerf').length;
  if (!b && !n) return { key: 'neutral', label: { ru: 'Изменения', en: 'Changes' }, b, n };
  if (b && !n) return { key: 'buff', label: { ru: 'Бафф', en: 'Buff' }, b, n };
  if (n && !b) return { key: 'nerf', label: { ru: 'Нерф', en: 'Nerf' }, b, n };
  if (b >= n * 2) return { key: 'buff', label: { ru: 'Скорее бафф', en: 'Mostly buff' }, b, n };
  if (n >= b * 2) return { key: 'nerf', label: { ru: 'Скорее нерф', en: 'Mostly nerf' }, b, n };
  return { key: 'mixed', label: { ru: 'Смешанно', en: 'Mixed' }, b, n };
}

/** Краткий человеческий вывод по герою/предмету — сразу на двух языках. */
function tldr(changes, verdict) {
  return { ru: tldrIn(changes, verdict, 'ru'), en: tldrIn(changes, verdict, 'en') };
}
function tldrIn(changes, verdict, lang) {
  const en = lang === 'en';
  const byAb = new Map();
  for (const c of changes) {
    const k = c.ability || (en ? 'Base stats' : 'Базовые параметры');
    const v = byAb.get(k) || { b: 0, n: 0, total: 0 };
    v.total++;
    if (c.effect === 'buff') v.b++;
    if (c.effect === 'nerf') v.n++;
    byAb.set(k, v);
  }
  const up = [], down = [];
  for (const [k, v] of byAb) {
    if (v.b > v.n) up.push(k);
    else if (v.n > v.b) down.push(k);
  }
  const parts = [];
  if (up.length) parts.push(`${en ? 'buffed' : 'усилено'}: ${up.slice(0, 4).join(', ')}`);
  if (down.length) parts.push(`${en ? 'nerfed' : 'ослаблено'}: ${down.slice(0, 4).join(', ')}`);
  const fixes = changes.filter((c) => c.kind === 'fix').length;
  if (!parts.length) parts.push(fixes ? (en ? 'bug fixes with no impact on strength' : 'исправления багов без влияния на силу') : en ? 'mechanical changes' : 'механические изменения');
  const end = (en
    ? { buff: 'Verdict: stronger.', nerf: 'Verdict: weaker.', mixed: 'Verdict: about as strong as before, with shifted priorities.', neutral: '' }
    : { buff: 'Итог: стал сильнее.', nerf: 'Итог: стал слабее.', mixed: 'Итог: сила примерно на прежнем уровне, смещены акценты.', neutral: '' })[verdict.key];
  const s = parts.join('; ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '. ' + end;
}

function parsePatch(p, idx) {
  const lines = htmlToLines(p.content);
  const heroes = new Map();
  const items = new Map();
  const general = [];
  let section = '';
  for (const line of lines) {
    const sec = /^\[\s*(.+?)\s*\]$/.exec(line);
    if (sec) { section = sec[1]; continue; }
    if (!/^[-•*]\s*/.test(line)) continue;
    const text = line.replace(/^[-•*]\s*/, '');
    const colon = text.indexOf(':');
    let placed = false;
    if (colon > 0 && colon < 40) {
      const name = text.slice(0, colon).trim().toLowerCase();
      const rest = text.slice(colon + 1).trim();
      const hid = idx.heroes.get(name);
      const iid = idx.items.get(name);
      if (hid != null) {
        if (!heroes.has(hid)) heroes.set(hid, []);
        heroes.get(hid).push(analyzeChange(rest));
        placed = true;
      } else if (iid != null) {
        if (!items.has(iid)) items.set(iid, []);
        items.get(iid).push(analyzeChange(rest));
        placed = true;
      }
    }
    if (!placed) general.push({ ...analyzeChange(text), section });
  }

  const heroList = [...heroes].map(([id, changes]) => {
    const v = verdictOf(changes);
    return { id, changes, verdict: v, tldr: tldr(changes, v) };
  });
  heroList.sort((a, b) => (b.verdict.b + b.verdict.n) - (a.verdict.b + a.verdict.n));
  const itemList = [...items].map(([id, changes]) => {
    const v = verdictOf(changes);
    return { id, changes, verdict: v, tldr: tldr(changes, v) };
  });

  const title = (p.title || '').trim();
  const curated = CURATED_PATCHES[title] || null;
  const hasChanges = heroList.length || itemList.length || general.length >= 3;
  const type = curated ? curated.type || 'major' : hasChanges ? 'balance' : 'news';
  const paragraphs = type === 'news' || type === 'major' ? lines.filter((l) => !/^[-•*]/.test(l)).slice(0, 8) : [];

  return {
    id: p.guid?.text || p.link,
    title,
    date: new Date(p.pub_date),
    link: p.link,
    type,
    heroes: heroList,
    items: itemList,
    general,
    curated,
    paragraphs,
    image: firstImage(p.content),
  };
}

let cache = null;
export function loadPatches() {
  if (cache) return cache;
  cache = (async () => {
    const raw = await api('/v2/patches', {}, 20);
    const idx = nameIndex();
    const seen = new Set();
    return raw
      .filter((p) => p.source === 'steam')
      .filter((p) => (seen.has(p.link) ? false : seen.add(p.link)))
      .map((p) => parsePatch(p, idx))
      .sort((a, b) => b.date - a.date);
  })();
  cache.catch(() => (cache = null));
  return cache;
}

/** Последний патч, меняющий баланс (для «Текущий патч»). */
export const latestBalancePatch = (patches) => patches.find((p) => p.type !== 'news') || patches[0];
