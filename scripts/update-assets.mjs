// Снимает компактный снапшот ассетов (герои, способности, предметы) из Deadlock API
// в data/assets.json. Запуск: node scripts/update-assets.mjs
// Сайт берёт имена/иконки отсюда, а героев, которых нет в снапшоте, догружает из API на лету.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API = 'https://api.deadlock-api.com/v1/assets';
const OUT = fileURLToPath(new URL('../data/assets.json', import.meta.url));

async function get(path, lang) {
  const url = `${API}${path}${path.includes('?') ? '&' : '?'}language=${lang}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`retry ${attempt}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

const stripHtml = (s) =>
  (s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const short = (s, n = 260) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function itemDesc(item) {
  const d = item.description || {};
  return short(stripHtml(d.desc || d.active || d.passive || ''));
}

// Описание способности. У свежих героев Valve иногда не публикует основной текст —
// тогда собираем его из описаний улучшений (T1–T3). «( )» — пустые плейсхолдеры клавиш.
function abilityDesc(a, upgradesLabel) {
  const d = a.description || {};
  const main = stripHtml(d.desc).replace(/\(\s*\)/g, '').replace(/\s+([:.,])/g, '$1');
  if (main) return short(main);
  const tiers = ['t1_desc', 't2_desc', 't3_desc']
    .map((k, i) => (d[k] ? `${'I'.repeat(i + 1)}: ${stripHtml(d[k])}` : ''))
    .filter(Boolean);
  return tiers.length ? short(`${upgradesLabel} ${tiers.join('; ')}`) : '';
}

// Русский перевод новых героев приходит наполовину английским — такой текст хуже оригинала.
const mostlyLatin = (s) => {
  const latin = (s.match(/[a-z]/gi) || []).length;
  const cyr = (s.match(/[а-яё]/gi) || []).length;
  return latin > cyr * 0.5;
};

async function main() {
  console.log('fetching heroes…');
  const [heroesEn, heroesRu] = await Promise.all([
    get('/heroes?only_active=true', 'english'),
    get('/heroes?only_active=true', 'russian'),
  ]);
  console.log('fetching upgrades & abilities…');
  const [upEn, upRu, abEn, abRu] = await Promise.all([
    get('/items/by-type/upgrade', 'english'),
    get('/items/by-type/upgrade', 'russian'),
    get('/items/by-type/ability', 'english'),
    get('/items/by-type/ability', 'russian'),
  ]);

  const ruHero = new Map(heroesRu.map((h) => [h.id, h]));
  const ruUp = new Map(upRu.map((i) => [i.id, i]));
  const abByClassEn = new Map(abEn.map((a) => [a.class_name, a]));
  const ruAb = new Map(abRu.map((a) => [a.id, a]));

  const heroes = heroesEn
    .filter((h) => h.player_selectable && !h.disabled)
    .map((h) => {
      const ru = ruHero.get(h.id) || h;
      const abilities = ['signature1', 'signature2', 'signature3', 'signature4']
        .map((slot) => abByClassEn.get(h.items?.[slot]))
        .filter(Boolean)
        .map((a) => {
          const r = ruAb.get(a.id) || a;
          const descEn = abilityDesc(a, 'Upgrades —');
          const descRu = abilityDesc(r, 'Улучшения —');
          return {
            id: a.id,
            en: a.name,
            ru: r.name,
            img: a.image_webp || a.image || null,
            descEn,
            descRu: !descRu || mostlyLatin(descRu) ? descEn.replace(/^Upgrades —/, 'Улучшения —') : descRu,
          };
        });
      return {
        id: h.id,
        en: h.name,
        ru: ru.name,
        cls: h.class_name,
        type: h.hero_type || 'unknown',
        tagsEn: h.tags || [],
        tagsRu: ru.tags || [],
        roleEn: h.description?.role || '',
        roleRu: ru.description?.role || '',
        playEn: stripHtml(h.description?.playstyle),
        playRu: stripHtml(ru.description?.playstyle),
        complexity: h.complexity || 0,
        img: {
          sm: h.images?.icon_image_small_webp || h.images?.icon_image_small,
          card: h.images?.icon_hero_card_webp || h.images?.icon_hero_card,
          vert: h.images?.top_bar_vertical_image_webp || h.images?.top_bar_vertical_image,
          bg: h.images?.background_image_webp || h.images?.background_image,
          mm: h.images?.minimap_image_webp || h.images?.minimap_image,
        },
        abilities,
      };
    });

  const items = upEn
    .filter((i) => i.shopable)
    .map((i) => {
      const ru = ruUp.get(i.id) || i;
      return {
        id: i.id,
        cls: i.class_name.replace(/^upgrade_/, ''),
        en: i.name,
        ru: ru.name,
        slot: i.item_slot_type,
        tier: i.item_tier,
        cost: i.cost,
        active: !!i.is_active_item,
        img: i.shop_image_webp || i.shop_image || i.image_webp || i.image,
        descEn: itemDesc(i),
        descRu: itemDesc(ru),
      };
    });

  console.log('fetching ranks & seasons…');
  const [ranksEn, ranksRu, seasonsRu, seasonsEn] = await Promise.all([
    get('/ranks', 'english'),
    get('/ranks', 'russian'),
    get('/ranked-seasons', 'russian').catch(() => []),
    get('/ranked-seasons', 'english').catch(() => []),
  ]);
  const ruRank = new Map(ranksRu.map((r) => [r.tier, r]));
  const ranks = ranksEn.map((r) => ({
    tier: r.tier,
    en: r.name,
    ru: ruRank.get(r.tier)?.name || r.name,
    color: r.color,
    img: r.images?.large_webp || r.images?.large || null,
    small: r.images?.small_webp || r.images?.chalk_webp || r.images?.large_webp || null,
  }));
  const seasons = (seasonsEn.length ? seasonsEn : seasonsRu).map((s, i) => ({
    name: seasonsRu[i]?.name || s.name,
    nameEn: s.name,
    intervals: s.intervals || [],
  }));

  // Перезаписываем файл только при реальных изменениях — иначе каждый запуск давал бы
  // новый коммит лишь из-за свежей даты снимка.
  const body = { heroes, items, ranks, seasons };
  try {
    const prev = JSON.parse(await readFile(OUT, 'utf8'));
    const { updated: _, ...prevBody } = prev;
    if (JSON.stringify(prevBody) === JSON.stringify(body)) {
      console.log(`без изменений: ${heroes.length} heroes, ${items.length} items`);
      return;
    }
  } catch {
    /* файла ещё нет — пишем с нуля */
  }
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...body }));
  console.log(`ok: ${heroes.length} heroes, ${items.length} items -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
