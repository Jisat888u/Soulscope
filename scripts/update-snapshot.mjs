// Снимок статистики для главной страницы: data/snapshot.json.
// Зачем: robots.txt у api.deadlock-api.com запрещает поисковым роботам любые запросы,
// поэтому Google видел главную с ошибкой «Не удалось загрузить данные». Если API недоступно
// (робот или сбой API), js/api.js берёт данные отсюда — с настройками фильтров по умолчанию.
// Запуск: node scripts/update-snapshot.mjs (входит в npm run deploy и update-site.cmd).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://api.deadlock-api.com';
const OUT = fileURLToPath(new URL('../data/snapshot.json', import.meta.url));
const DAY = 86400;

async function get(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  for (let i = 0; i < 3; i++) {
    const res = await fetch(u);
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`${path}: API не ответило`);
}

// окна времени — как на сайте по умолчанию: последние 7 дней и 7 дней до них, все ранги
const now = Math.floor(Date.now() / 1000 / 600) * 600;
const min = now - 7 * DAY;

console.log('snapshot: hero stats, duos, patches…');
const [heroStats, heroStatsPrev, duos, patches] = await Promise.all([
  get('/v1/analytics/hero-stats', { min_unix_timestamp: min }),
  get('/v1/analytics/hero-stats', { min_unix_timestamp: min - 7 * DAY, max_unix_timestamp: min }),
  get('/v1/analytics/hero-synergy-stats', { min_unix_timestamp: min, same_lane_filter: true, min_matches: 150 }),
  get('/v2/patches'),
]);

// патчноуты — только свежие, чтобы файл оставался лёгким
const seen = new Set();
const recentPatches = patches
  .filter((p) => p.source === 'steam' && !seen.has(p.link) && seen.add(p.link))
  .sort((a, b) => new Date(b.pub_date) - new Date(a.pub_date))
  .slice(0, 12);

const snapshot = {
  updated: new Date().toISOString(),
  window: { min, max: now },
  entries: {
    '/v1/analytics/hero-stats': heroStats,
    '/v1/analytics/hero-stats#prev': heroStatsPrev,
    '/v1/analytics/hero-synergy-stats#lane': duos,
    '/v2/patches': recentPatches,
  },
};
writeFileSync(OUT, JSON.stringify(snapshot));
console.log(`snapshot ok: ${heroStats.length} heroes, ${duos.length} duos, ${recentPatches.length} patches -> ${OUT}`);
