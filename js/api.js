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
        if (res.status === 429) throw new Error('Слишком много запросов к API (429), попробуйте через минуту');
        if (!res.ok) throw new Error(`API ${res.status}`);
        const text = await res.text();
        const data = JSON.parse(text);
        mem.set(key, { t: Date.now(), d: data });
        writeStore(key, data, text);
        return data;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (s) return s.d; // устаревшие данные лучше, чем ничего
    throw lastErr;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
