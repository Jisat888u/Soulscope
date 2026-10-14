// Клиент Deadlock API с кэшем в памяти и sessionStorage.
export const API_BASE = 'https://api.deadlock-api.com';

const mem = new Map();
const inflight = new Map();
const MAX_STORE = 1_500_000; // большие ответы не кладём в sessionStorage

function buildUrl(path, params) {
  const u = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    u.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return u.toString();
}

function readStore(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return { t, d };
  } catch {
    return null;
  }
}

function writeStore(key, data, text) {
  if (text.length > MAX_STORE) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    try { sessionStorage.clear(); } catch {}
  }
}

/* ---------- запасной снимок (data/snapshot.json) ----------
   robots.txt у api.deadlock-api.com запрещает поисковым роботам любые запросы, поэтому без снимка
   Google видел главную с ошибкой. Снимок обновляется при публикации (scripts/update-snapshot.mjs)
   и подходит только для фильтров по умолчанию: все ранги, последние 7 дней. */
const NARROW = ['min_average_badge', 'hero_id', 'hero_ids', 'enemy_hero_ids', 'account_ids', 'min_duration_s', 'max_duration_s', 'min_game_time_s', 'max_game_time_s'];
const DAY = 86400;
function snapshotKey(path, params) {
  if (NARROW.some((k) => params[k] != null && params[k] !== '')) return null;
  if (params.min_unix_timestamp) {
    const span = (params.max_unix_timestamp || Date.now() / 1000) - params.min_unix_timestamp;
    if (span < 6 * DAY || span > 8 * DAY) return null; // другой период — снимок не подходит
  }
  return path + (params.max_unix_timestamp ? '#prev' : '') + (params.same_lane_filter ? '#lane' : '');
}
let snapshot = null;
async function fromSnapshot(path, params) {
  const key = snapshotKey(path, params);
  if (!key) return undefined;
  snapshot ??= fetch('data/snapshot.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const snap = await snapshot;
  const data = snap?.entries?.[key];
  if (data === undefined) return undefined;
  // сообщаем интерфейсу, что цифры из сохранённого снимка (app.js показывает плашку с датой)
  window.dispatchEvent(new CustomEvent('dt:snapshot', { detail: { updated: snap.updated } }));
  return data;
}

/** GET запрос к API. ttlMin — сколько минут ответ считается свежим. */
export async function api(path, params = {}, ttlMin = 30) {
  const url = buildUrl(path, params);
  const key = 'dt.api:' + url;
  const now = Date.now();
  const ttl = ttlMin * 60_000;

  const m = mem.get(key);
  if (m && now - m.t < ttl) return m.d;
  const s = readStore(key);
  if (s && now - s.t < ttl) {
    mem.set(key, s);
    return s.d;
  }
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url);
        if (res.status === 429) throw new Error(document.documentElement.lang === 'en' ? 'Too many API requests (429), try again in a minute' : 'Слишком много запросов к API (429), попробуйте через минуту');
        if (!res.ok) throw new Error(`API ${res.status}`);
        const text = await res.text();
        const data = JSON.parse(text);
        mem.set(key, { t: Date.now(), d: data });
        writeStore(key, data, text);
        return data;
      } catch (e) {
        lastErr = e;
        // сетевая ошибка (запрос заблокирован или нет связи) — одна быстрая повторная попытка, дальше снимок
        if (e instanceof TypeError && attempt >= 1) break;
        await new Promise((r) => setTimeout(r, (e instanceof TypeError ? 300 : 600) * (attempt + 1)));
      }
    }
    if (s) return s.d; // устаревшие данные лучше, чем ничего
    const snap = await fromSnapshot(path, params);
    if (snap !== undefined) return snap;
    throw lastErr;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
