// Карта фарма: сколько душ в каждой зоне джангла и самые выгодные маршруты по нему.
// Координаты кемпов, автоматов и ящиков — из /v1/assets/map. Цены — из игровых данных
// (/v1/assets/npc-units, /v1/assets/misc-entities) и Deadlock Wiki. Маршруты прокладываются
// по улицам: проходимость берётся из самой миникарты (тёмное — улица, светлое — здание).
import { L, esc, fmtNum, loading, errorBox, plural } from '../core.js';
import { getMapAsset, loadImage, recolorMap, themeColors, ramp } from './map-common.js';

const view = { show: 'routes', minute: 10, team: 0, focus: null };
const MINUTES = [5, 10, 15, 20, 30];
const SPEED = 300; // юнитов в секунду (~7,6 м/с) — бег со спринтом и подкатами
const STEP_MAX = 3800; // дальше — уже не соседняя точка, а переход через полкарты
const ROUTES_MAX = 3; // больше трёх линий на одной карте уже не различить по цвету
const G = 256; // сетка проходимости: клетка ≈ 84 юнита

/* ---------- души: игровые данные ---------- */
const grow = (m) => 1 + 0.0108 * m; // нейтралы дают на 1,08% больше за каждую минуту матча
const machine = (m) => 310 + 3.35 * m; // один автомат Sinner's Sacrifice
const crate = (m) => 0.6 * (23 + 2 * m); // ящик: 60% шанс на маленький шарик душ (23 + 2/мин)
const tough = (m) => 46 + 4 * m; // прочный ящик (тяжёлый удар): всегда большой шарик (46 + 4/мин)
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Типы точек: когда появляются, через сколько возвращаются, сколько секунд на зачистку и сколько душ (мин–макс). */
const KIND = {
  weak: { spawn: 120, respawn: 85, clear: 7, souls: (m) => [123 * grow(m), 123 * grow(m)], name: ['Слабый кемп', 'Small camp'], what: ['3 слабых нейтрала', '3 small Haunts'] },
  medium: { spawn: 300, respawn: 290, clear: 12, souls: (m) => [150 * grow(m), 204 * grow(m)], name: ['Средний кемп', 'Medium camp'], what: ['3 нейтрала: слабые и средние', '3 Haunts: small and medium'] },
  strong: { spawn: 480, respawn: 335, clear: 25, souls: (m) => [317 * grow(m), 543 * grow(m)], name: ['Сильный кемп', 'Large camp'], what: ['1 сильный + 2 средних или 3 сильных', '1 large + 2 medium, or 3 large'] },
  vault: { spawn: 480, respawn: 300, clear: 9, souls: (m) => [machine(m), machine(m)], name: ['Автомат', 'Sinner’s Sacrifice'], what: ['1 автомат Sinner’s Sacrifice (бить в ближнем бою)', '1 Sinner’s Sacrifice machine (melee only)'] },
  hybrid: { spawn: 480, respawn: 300, clear: 20, souls: (m) => [machine(m) + 82 * grow(m), 2 * machine(m) + 136 * grow(m)], name: ['Кемп с автоматом', 'Camp with Sinner’s Sacrifice'], what: ['1–2 автомата и до 2 нейтралов', '1–2 machines and up to 2 Haunts'] },
  bell: { spawn: 480, respawn: 300, clear: 40, souls: (m) => [3 * machine(m), 3 * machine(m)], name: ['Колокольня', 'Bell tower'], what: ['3 автомата Sinner’s Sacrifice; звон колокола слышит вся карта', '3 Sinner’s Sacrifice machines; the bell alerts the whole map'] },
  crate: { spawn: 180, respawn: 180, clear: 1.8, souls: (m) => [crate(m), crate(m)], name: ['Ящик', 'Crate'] },
  tough: { spawn: 180, respawn: 180, clear: 3, souls: (m) => [tough(m), tough(m)], name: ['Прочный ящик', 'Tough crate'] },
};
const kindOf = (c) => (c.kind !== 'vault' ? c.kind : /bell/.test(c.name) ? 'bell' : /_camp$/.test(c.name) ? 'hybrid' : 'vault');

/** Названия мест по внутренним именам кемпов. */
const PLACES = [
  [/chinatown_bell/, ['Колокольня Чайнатауна', 'Chinatown bell tower']],
  [/chinatown_fish/, ['Рыбный рынок Чайнатауна', 'Chinatown fish market']],
  [/chinatown_alley/, ['Переулок Чайнатауна', 'Chinatown alley']],
  [/chinatown_street/, ['Улица Чайнатауна', 'Chinatown street']],
  [/slums_garage/, ['Гараж в трущобах', 'Slums garage']],
  [/slums_warehouse/, ['Склад в трущобах', 'Slums warehouse']],
  [/slums_storage/, ['Кладовая в трущобах', 'Slums storage']],
  [/slums_bodega/, ['Подвал бодеги', 'Bodega basement']],
  [/slums_roof/, ['Крыша в трущобах', 'Slums rooftop']],
  [/slums_alley/, ['Переулок в трущобах', 'Slums alley']],
  [/sw_bodega/, ['Второй этаж бодеги', 'Bodega upstairs']],
  [/basketball/, ['Баскетбольная площадка', 'Basketball court']],
  [/dock_authority/, ['Управление порта', 'Dock Authority']],
  [/dock_camp/, ['Доки', 'Docks']],
  [/construction/, ['Стройка', 'Construction site']],
  [/hq_roof/, ['Крыша штаба', 'HQ rooftop']],
  [/hq_/, ['Штаб', 'HQ']],
  [/york_radio/, ['Радио «Йорк»', 'York Radio']],
  [/hotel/, ['Отель', 'Hotel']],
  [/nw_utility/, ['Подсобка у отеля', 'Utility room by the hotel']],
  [/se_utility/, ['Подсобка у аптеки', 'Utility room by the drug store']],
  [/nw_bank/, ['Банк', 'Bank']],
  [/drug_store/, ['Аптека', 'Drug store']],
  [/dept_store/, ['Универмаг', 'Department store']],
  [/oracle/, ['«Оракул»', 'Oracle']],
  [/nursery/, ['Детская', 'Nursery']],
  [/park_library_roof/, ['Крыша библиотеки', 'Library rooftop']],
  [/park_library/, ['Библиотека в парке', 'Park library']],
  [/park_chapel/, ['Часовня в парке', 'Park chapel']],
  [/park_gate/, ['Ворота парка', 'Park gate']],
  [/park_club/, ['Клуб в парке', 'Park club']],
  [/park_mansion/, ['Крыша особняка', 'Mansion rooftop']],
  [/sw_asylum/, ['Лечебница', 'Asylum']],
  [/theater_balcony/, ['Балкон театра', 'Theater balcony']],
  [/theater_stage/, ['Сцена театра', 'Theater stage']],
  [/theater_lobby/, ['Фойе театра', 'Theater lobby']],
  [/theater_down/, ['Подвал театра', 'Theater basement']],
  [/theater_upstairs|ne_theater/, ['Верхний этаж театра', 'Theater upstairs']],
  [/plaza_pit/, ['Яма на Площади', 'Plaza pit']],
  [/plaza_rink/, ['Каток на Площади', 'Plaza rink']],
  [/plaza_corner/, ['Угол Площади', 'Plaza corner']],
];
const placeOf = (name) => (PLACES.find(([re]) => re.test(name)) || [null, ['Кемп', 'Camp']])[1];

/* ---------- зоны: кемпы рядом друг с другом + ящики вокруг ---------- */
function buildZones(asset) {
  const pts = asset.neutral_camps.map((c) => ({ x: c.position[0], y: c.position[1], kind: kindOf(c), name: c.name }));
  // кемпы ближе 900 юнитов — одна зона («двойные кемпы», яма на Площади и т. п.)
  const zones = [];
  for (const p of pts) {
    const near = zones.filter((z) => z.camps.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 900));
    if (!near.length) zones.push({ camps: [p], crates: [] });
    else {
      near[0].camps.push(p);
      for (const z of near.slice(1)) { near[0].camps.push(...z.camps); zones.splice(zones.indexOf(z), 1); }
    }
  }
  // ящики: к ближайшей зоне в пределах 1100 юнитов, остальные — отдельные «склады ящиков» от 4 штук
  const loose = [];
  const boxes = [
    ...(asset.entities?.crates || []).map((c) => ({ x: c.position[0], y: c.position[1], kind: 'crate' })),
    ...(asset.entities?.tough_crates || []).map((c) => ({ x: c.position[0], y: c.position[1], kind: 'tough' })),
  ];
  for (const b of boxes) {
    let best = null, bd = 1100;
    for (const z of zones) for (const c of z.camps) { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < bd) { bd = d; best = z; } }
    if (best) best.crates.push(b);
    else loose.push(b);
  }
  const piles = [];
  for (const b of loose) {
    const near = piles.filter((p) => p.crates.some((q) => Math.hypot(q.x - b.x, q.y - b.y) < 650));
    if (!near.length) piles.push({ camps: [], crates: [b] });
    else {
      near[0].crates.push(b);
      for (const p of near.slice(1)) { near[0].crates.push(...p.crates); piles.splice(piles.indexOf(p), 1); }
    }
  }
  for (const p of piles) if (p.crates.length >= 4) zones.push(p);

  zones.forEach((z, id) => {
    z.id = id;
    const all = [...z.camps, ...z.crates];
    z.x = all.reduce((s, p) => s + p.x, 0) / all.length;
    z.y = all.reduce((s, p) => s + p.y, 0) / all.length;
    if (z.camps.length) {
      // в центре зоны — её главный кемп, чтобы метка стояла на месте, а не между зданиями
      const main = [...z.camps].sort((a, b) => KIND[b.kind].souls(10)[1] - KIND[a.kind].souls(10)[1])[0];
      z.main = main;
      z.x = main.x * 0.6 + z.x * 0.4;
      z.y = main.y * 0.6 + z.y * 0.4;
    }
  });
  return zones;
}

/** Души зоны на минуте m: [мин, макс], что входит и что ещё не появилось. */
function zoneValue(z, m) {
  const t = m * 60;
  const parts = new Map();
  let lo = 0, hi = 0, clear = 0, firstSpawn = Infinity;
  for (const p of [...z.camps, ...z.crates]) {
    const k = KIND[p.kind];
    firstSpawn = Math.min(firstSpawn, k.spawn);
    if (k.spawn > t) continue;
    const [a, b] = k.souls(m);
    lo += a; hi += b; clear += k.clear;
    const e = parts.get(p.kind) || { kind: p.kind, n: 0, lo: 0, hi: 0 };
    e.n++; e.lo += a; e.hi += b;
    parts.set(p.kind, e);
  }
  return { lo, hi, mid: (lo + hi) / 2, clear, parts: [...parts.values()], firstSpawn };
}

function zoneName(z, nearestCampZone) {
  if (z.main) {
    const base = L(...placeOf(z.main.name));
    return z.camps.length > 1 ? `${base} · ${z.camps.length} ${L(z.camps.length < 5 ? 'кемпа' : 'кемпов', 'camps')}` : base;
  }
  const n = nearestCampZone(z);
  return n ? `${L('Ящики', 'Crates')} (${L(...placeOf(n.main.name)).replace(/^./, (c) => c.toLowerCase())})` : L('Ящики', 'Crates');
}

/* ---------- проходимость и пути по улицам ---------- */
function buildWalk(img) {
  const S = img.naturalWidth;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, S, S).data;
  const f = S / G;
  const walk = new Uint8Array(G * G);
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      let ok = 0, n = 0;
      for (let y = Math.floor(j * f); y < Math.floor((j + 1) * f); y++)
        for (let x = Math.floor(i * f); x < Math.floor((i + 1) * f); x++) {
          const k = (y * S + x) * 4;
          n++;
          if (px[k + 3] > 100 && (px[k] + px[k + 1] + px[k + 2]) / 765 < 0.5) ok++;
        }
      walk[j * G + i] = ok * 2 >= n ? 1 : 0;
    }
  return walk;
}

/** Мини-куча для Дейкстры. */
class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.k.length; }
}

function makeGeo(walk, R) {
  const cellU = (2 * R) / G;
  const toCell = (x, y) => [Math.min(G - 1, Math.max(0, Math.floor((x + R) / cellU))), Math.min(G - 1, Math.max(0, Math.floor((R - y) / cellU)))];
  /** Ближайшая проходимая клетка (кемпы на крышах и в подвалах стоят «внутри» зданий). */
  const snap = (x, y) => {
    const [ci, cj] = toCell(x, y);
    for (let r = 0; r < 20; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i >= 0 && j >= 0 && i < G && j < G && walk[j * G + i]) return j * G + i;
        }
    return cj * G + ci;
  };
  const cache = new Map();
  /** Дейкстра от клетки: расстояния (в клетках) и предки для восстановления пути. */
  const from = (src) => {
    if (cache.has(src)) return cache.get(src);
    const dist = new Float32Array(G * G).fill(Infinity), prev = new Int32Array(G * G).fill(-1);
    const h = new Heap();
    dist[src] = 0;
    h.push(0, src);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (h.size) {
      const u = h.pop();
      const du = dist[u], ui = u % G, uj = (u / G) | 0;
      for (const [di, dj, w] of D) {
        const i = ui + di, j = uj + dj;
        if (i < 0 || j < 0 || i >= G || j >= G) continue;
        const v = j * G + i;
        if (!walk[v]) continue;
        if (di && dj && (!walk[uj * G + i] || !walk[j * G + ui])) continue; // не срезаем углы зданий
        const nd = du + w;
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(nd, v); }
      }
    }
    const res = { dist, prev };
    cache.set(src, res);
    return res;
  };
  const path = (a, b) => {
    const { prev } = from(a);
    const out = [];
    for (let v = b; v !== -1 && out.length < G * G; v = prev[v]) { out.push(v); if (v === a) break; }
    return out.reverse();
  };
  return { cellU, snap, from, path };
}

/* ---------- поиск маршрутов ---------- */
const MAX_STOPS = 5; // забег между волнами крипов, а не обход всего джангла
const MAX_TIME = 150; // секунд

/** Лучший маршрут среди точек idx: лучевой поиск, оценка — души за время с запасом 30 с на подход. */
function bestRoute(idx, nodes, D) {
  const score = (s) => s.souls / (s.clear + s.walk / SPEED + 30);
  let beam = idx.map((i) => ({ seq: [i], souls: nodes[i].v.mid, walk: 0, clear: nodes[i].v.clear }));
  let best = null;
  for (let depth = 1; depth < MAX_STOPS; depth++) {
    const next = [];
    for (const s of beam) {
      const last = s.seq[s.seq.length - 1];
      for (const j of idx) {
        const d = D[last][j];
        if (s.seq.includes(j) || !(d <= STEP_MAX)) continue;
        const t = { seq: [...s.seq, j], souls: s.souls + nodes[j].v.mid, walk: s.walk + d, clear: s.clear + nodes[j].v.clear };
        if (t.clear + t.walk / SPEED <= MAX_TIME) next.push(t);
      }
    }
    next.sort((a, b) => score(b) - score(a));
    beam = next.slice(0, 80);
    for (const s of beam) if (s.seq.length >= 3 && (!best || score(s) > score(best))) best = s;
  }
  return best;
}

/** До трёх непересекающихся маршрутов: лучший, затем лучший из оставшихся точек и т. д. */
function findRoutes(nodes, geo) {
  const D = nodes.map((a) => { const { dist } = geo.from(a.cell); return nodes.map((b) => dist[b.cell] * geo.cellU); });
  let left = nodes.map((_, i) => i);
  const out = [];
  while (out.length < ROUTES_MAX) {
    const s = bestRoute(left, nodes, D);
    if (!s) break;
    out.push(s);
    left = left.filter((i) => !s.seq.includes(i));
  }
  return out.map((s) => {
    const seq = s.seq.map((i) => nodes[i]);
    const time = s.clear + s.walk / SPEED;
    const [lo, hi] = seq.reduce((acc, nd) => [acc[0] + nd.v.lo, acc[1] + nd.v.hi], [0, 0]);
    return { seq, lo, hi, souls: s.souls, time, perMin: (s.souls / time) * 60, walk: s.walk };
  });
}

/* ---------- страница ---------- */
let cacheGeo = null;
export async function renderFarm(root, { alive, modeBar, bindModes }) {
  const head = (inner) => `<section class="section panel pad">
      <div class="map-head"><div class="eyebrow">${L('Карта', 'Map')} · ${L('фарм душ', 'soul farming')}</div>${modeBar}</div>
      <h2>${L('Карта фарма', 'Farm map')}</h2>
      <div class="sub">${L('Где лежат души и как их собрать быстрее всего. Ваша база снизу; цифры — на выбранную минуту матча.', 'Where the souls are and the fastest way to collect them. Your base is at the bottom; numbers are for the selected match minute.')}</div>
      ${inner || ''}
    </section>`;
  root.innerHTML = head() + loading(L('Загружаем карту и кемпы…', 'Loading the map and camps…'));
  bindModes();
  let asset, img;
  try {
    asset = await getMapAsset();
    img = await loadImage(asset.images.plain || asset.images.minimap);
  } catch (e) {
    if (alive()) { root.innerHTML = head() + errorBox(e); bindModes(); }
    return;
  }
  if (!alive()) return;

  const R = asset.radius || 10752;
  if (!cacheGeo || cacheGeo.asset !== asset) {
    const zones = buildZones(asset);
    const geo = makeGeo(buildWalk(img), R);
    zones.forEach((z) => (z.cell = geo.snap(z.x, z.y)));
    cacheGeo = { asset, zones, geo };
  }
  const { zones, geo } = cacheGeo;
  const m = view.minute;
  const own = (z) => (view.team === 0 ? z.y : -z.y) < 1800; // своя половина и середина карты
  const campZones = zones.filter((z) => z.main);
  const nearestCampZone = (z) => campZones.reduce((b, c) => (!b || Math.hypot(c.x - z.x, c.y - z.y) < Math.hypot(b.x - z.x, b.y - z.y) ? c : b), null);
  zones.forEach((z) => { z.v = zoneValue(z, m); z.name = zoneName(z, nearestCampZone); });
  // одинаковые названия (два разных катка на Площади и т. п.) различаем номером
  const seenNames = {};
  zones.forEach((z) => { seenNames[z.name] = (seenNames[z.name] || 0) + 1; if (seenNames[z.name] > 1) z.name += ` · ${seenNames[z.name]}`; });

  const nodes = zones.filter((z) => own(z) && z.v.mid > 0);
  const routes = view.show === 'routes' ? findRoutes(nodes, geo) : [];
  const shown = view.show === 'zones' ? zones.filter((z) => z.v.mid > 0 || z.v.firstSpawn > m * 60) : nodes;
  const ownTotal = nodes.reduce((s, z) => s + z.v.mid, 0);

  const seg = (list, cur, attr) => `<div class="seg">${list.map((o) => `<button data-${attr}="${o.v}" class="${String(o.v) === String(cur) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>`;
  const tile = (k, v, sub) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${sub}</div></div>`;
  const best = routes[0];

  root.innerHTML = `
    ${head(`<div class="rk-kpis map-kpis">
      ${tile(L('Душ на вашей стороне', 'Souls on your side'), `≈${fmtNum(ownTotal)}`, L(`на ${m}-й минуте, если собрать всё`, `at minute ${m}, if you take everything`))}
      ${tile(L('Кемпов и автоматов', 'Camps and machines'), String(nodes.reduce((s, z) => s + z.camps.length, 0)), L('своя половина и середина', 'your half and the middle'))}
      ${tile(L('Ящиков', 'Crates'), String(nodes.reduce((s, z) => s + z.crates.length, 0)), L('на вашей половине и в середине', 'on your half and in the middle'))}
      ${tile(L('Лучший маршрут', 'Best route'), best ? `≈${fmtNum(best.perMin)}` : '—', L('душ в минуту', 'souls per minute'))}
    </div>`)}

    <section class="section map-layout">
      <div class="panel map-panel">
        <div class="map-wrap">
          <div class="map-tag">▲ ${L('База врага', 'Enemy base')}</div>
          <div class="map-box" id="mapWrap">
            <canvas id="mapCanvas"></canvas>
            <svg class="farm-svg" id="farmSvg" role="img" aria-label="${esc(view.show === 'routes' ? L('Маршруты фарма', 'Farm routes') : L('Души по зонам карты', 'Souls by map zone'))}"></svg>
          </div>
          <div class="map-tag">▼ ${L('Ваша база', 'Your base')}</div>
        </div>
      </div>
      <div class="panel pad map-side">
        <div class="map-ctl"><label>${L('Показать', 'Show')}</label>${seg([{ v: 'routes', label: L('Маршруты фарма', 'Farm routes') }, { v: 'zones', label: L('Души по зонам', 'Souls by zone') }], view.show, 'fshow')}</div>
        <div class="map-ctl" style="margin-top:10px"><label>${L('Минута', 'Minute')}</label>${seg(MINUTES.map((x) => ({ v: x, label: `${x}:00` })), m, 'fmin')}</div>
        <div class="map-ctl" style="margin-top:10px"><label>${L('Ваша команда', 'Your team')}</label>${seg([{ v: 0, label: 'Hidden King' }, { v: 1, label: 'Archmother' }], view.team, 'fteam')}</div>
        <div id="farmSide"></div>
        <div class="note" style="margin-top:12px">${L(
          `Души — из игровых данных: слабый нейтрал 41, средний 68, сильный 181 (+1,08% в минуту), автомат Sinner’s Sacrifice 310 (+3,35 в минуту), ящик — 60% шанс на 23 души (+2 в минуту), прочный ящик — 46 (+4 в минуту). Состав средних и сильных кемпов зависит от места, поэтому указан диапазон. Время маршрута — бег ~7,6 м/с плюс зачистка; готовых данных о популярности маршрутов нет, поэтому они выбраны по выгоде — душам в минуту.`,
          `Souls come from game data: small Haunt 41, medium 68, large 181 (+1.08% per minute), Sinner’s Sacrifice 310 (+3.35 per minute), crate — 60% chance of 23 souls (+2 per minute), tough crate — 46 (+4 per minute). Medium and large camp composition depends on the location, so a range is shown. Route time is running at ~7.6 m/s plus clearing; there is no public data on route popularity, so routes are picked by profit — souls per minute.`,
        )}</div>
      </div>
    </section>`;
  bindModes();
  const rerender = () => renderFarm(root, { alive, modeBar, bindModes });
  root.querySelectorAll('[data-fshow]').forEach((b) => b.addEventListener('click', () => { view.show = b.dataset.fshow; view.focus = null; rerender(); }));
  root.querySelectorAll('[data-fmin]').forEach((b) => b.addEventListener('click', () => { view.minute = +b.dataset.fmin; view.focus = null; rerender(); }));
  root.querySelectorAll('[data-fteam]').forEach((b) => b.addEventListener('click', () => { view.team = +b.dataset.fteam; view.focus = null; rerender(); }));

  /* --- координаты: мир → доля ширины карты (с поворотом для команды сверху) --- */
  const frac = (x, y) => { let fx = (x + R) / (2 * R), fy = (R - y) / (2 * R); if (view.team === 1) { fx = 1 - fx; fy = 1 - fy; } return [fx, fy]; };
  const cellFrac = (c) => { let fx = ((c % G) + 0.5) / G, fy = (((c / G) | 0) + 0.5) / G; if (view.team === 1) { fx = 1 - fx; fy = 1 - fy; } return [fx, fy]; };

  /* --- боковая панель --- */
  const side = root.querySelector('#farmSide');
  const range = (lo, hi) => (fmtNum(lo) === fmtNum(hi) || hi - lo < 8 ? `≈${fmtNum((lo + hi) / 2)}` : `${fmtNum(lo)}–${fmtNum(hi)}`);
  if (view.show === 'routes') {
    side.innerHTML = `<h3 class="map-h3">${L('Самые выгодные маршруты', 'Most profitable routes')}</h3>
      <ol class="map-spots farm-routes">${routes
        .map(
          (r, i) => `<li data-route="${i}" class="${view.focus === i ? 'hl' : ''}"><span class="map-pin-n" style="background:var(--route-${i + 1})">${i + 1}</span><div style="min-width:0">
            <b>${esc(r.seq[0].name)} → ${esc(r.seq.at(-1).name)}</b>
            <div class="note">${r.seq.length} ${L(plural(r.seq.length, 'точка', 'точки', 'точек'), 'stops')} · <b>${range(r.lo, r.hi)}</b> ${L('душ', 'souls')} · ~${mmss(r.time)} · <b>${fmtNum(r.perMin)}</b> ${L('душ/мин', 'souls/min')}</div></div></li>`,
        )
        .join('') || `<li class="muted">${L('На этой минуте в джангле ещё пусто.', 'The jungle is still empty at this minute.')}</li>`}</ol>
      <div class="note">${L('Наведите на маршрут или стрелку на карте — покажем, сколько душ он даёт. Клик по маршруту оставит на карте только его.', 'Hover a route or its arrow on the map to see how many souls it gives. Click a route to show only it.')}</div>`;
  } else {
    const top = [...zones].filter((z) => z.v.mid > 0).sort((a, b) => b.v.mid - a.v.mid).slice(0, 8);
    side.innerHTML = `<div class="map-legend" id="farmLegend"></div>
      <h3 class="map-h3">${L('Самые богатые зоны', 'Richest zones')}</h3>
      <ol class="map-spots">${top
        .map((z, i) => `<li data-zone="${z.id}"><span class="map-pin-n">${i + 1}</span><div style="min-width:0"><b>${esc(z.name)}</b><div class="note">${range(z.v.lo, z.v.hi)} ${L('душ', 'souls')}</div></div></li>`)
        .join('')}</ol>`;
  }

  /* --- карта и слой --- */
  const canvas = root.querySelector('#mapCanvas');
  const wrap = root.querySelector('#mapWrap');
  const svg = root.querySelector('#farmSvg');
  const tip = document.getElementById('tip');
  let base = null, colors = null, lastW = 0;

  // пути маршрутов по улицам (в клетках сетки) — считаем один раз
  const routePaths = routes.map((r) => {
    const cells = [];
    for (let k = 1; k < r.seq.length; k++) {
      const p = geo.path(r.seq[k - 1].cell, r.seq[k].cell);
      cells.push(...(k > 1 ? p.slice(1) : p));
    }
    return simplify(cells.map(cellFrac), 0.004);
  });

  const zoneTip = (z) => {
    const rows = z.v.parts
      .map((p) => `<div>${p.n > 1 ? `${p.n} × ` : ''}${esc(L(...KIND[p.kind].name))}${KIND[p.kind].what ? ` <span class="muted">(${esc(L(...KIND[p.kind].what))})</span>` : ''} — <b>${range(p.lo, p.hi)}</b></div>`)
      .join('');
    const later = [...z.camps, ...z.crates].filter((p) => KIND[p.kind].spawn > m * 60);
    const laterTxt = later.length ? `<div class="muted">${L('Появятся позже', 'Spawn later')}: ${[...new Set(later.map((p) => `${L(...KIND[p.kind].name)} (${mmss(KIND[p.kind].spawn)})`))].join(', ')}</div>` : '';
    const resp = [...new Set(z.camps.map((p) => p.kind))].map((k) => `${L(...KIND[k].name)} — ${mmss(KIND[k].respawn)}`).join(', ');
    return `<div class="tt">${esc(z.name)}</div><div class="td">${z.v.mid > 0 ? `${L('Всего', 'Total')}: <b>${range(z.v.lo, z.v.hi)}</b> ${L('душ', 'souls')}${rows}` : ''}${laterTxt}${resp ? `<div class="muted">${L('Возрождение после зачистки', 'Respawn after clearing')}: ${resp}</div>` : ''}</div>`;
  };
  const routeTip = (r, i) =>
    `<div class="tt">${L('Маршрут', 'Route')} ${i + 1}: ${range(r.lo, r.hi)} ${L('душ', 'souls')}</div><div class="td">~${mmss(r.time)} · ${fmtNum(r.perMin)} ${L('душ в минуту', 'souls per minute')}<ol style="margin:6px 0 0;padding-left:18px">${r.seq
      .map((z) => `<li>${esc(z.name)} — ${range(z.v.lo, z.v.hi)}</li>`)
      .join('')}</ol></div>`;

  const draw = (force) => {
    const W = Math.round(wrap.clientWidth);
    if (!W || (!force && W === lastW)) return;
    lastW = W;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(W * dpr);
    canvas.style.width = canvas.style.height = W + 'px';
    const g = canvas.getContext('2d');
    g.save();
    if (view.team === 1) { g.translate(canvas.width, canvas.height); g.rotate(Math.PI); }
    g.drawImage(base, 0, 0, canvas.width, canvas.height);
    g.restore();

    svg.setAttribute('viewBox', `0 0 ${W} ${W}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', W);
    const P = ([fx, fy]) => [fx * W, fy * W];
    const fs = Math.max(10, Math.min(13, W / 52));
    if (view.show === 'routes') {
      const dots = shown
        .filter((z) => !routes.some((r) => r.seq.includes(z)))
        .map((z) => { const [x, y] = P(frac(z.x, z.y)); return `<circle class="farm-dot" cx="${x}" cy="${y}" r="3.5" data-tip=" " data-z="${z.id}"/>`; })
        .join('');
      const lines = routes
        .map((r, i) => {
          if (view.focus != null && view.focus !== i) return '';
          const d = smoothPath(routePaths[i].map(P));
          const stops = r.seq
            .map((z, k) => { const [x, y] = P(frac(z.x, z.y)); return `<g class="farm-stop" data-tip=" " data-z="${z.id}"><circle cx="${x}" cy="${y}" r="${fs * 0.85}" style="fill:var(--route-${i + 1})"/><text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" style="font-size:${fs * 0.95}px">${k + 1}</text></g>`; })
            .join('');
          return `<g class="farm-route" data-r="${i}" style="--rc:var(--route-${i + 1})">
            <path class="farm-casing" d="${d}"/><path class="farm-line" d="${d}" pathLength="1"/><g class="farm-arrows"></g>
            <path class="farm-hit" d="${d}" data-tip=" "/>${stops}</g>`;
        })
        .join('');
      svg.innerHTML = dots + lines;
      // стрелки вдоль пути — каждые ~70 px, по направлению движения
      svg.querySelectorAll('.farm-route').forEach((gr) => {
        const path = gr.querySelector('.farm-line');
        const len = path.getTotalLength();
        const step = Math.max(55, W / 11);
        let out = '';
        for (let s = step * 0.6; s < len - 8; s += step) {
          const a = path.getPointAtLength(s), b = path.getPointAtLength(Math.min(len, s + 2));
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          out += `<path d="M-5,-5 L4,0 L-5,5" transform="translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`;
        }
        gr.querySelector('.farm-arrows').innerHTML = out;
      });
    } else {
      const max = Math.max(...shown.map((z) => z.v.mid), 1);
      svg.innerHTML = [...shown]
        .sort((a, b) => a.v.mid - b.v.mid) // крупные поверх мелких
        .map((z) => {
          const [x, y] = P(frac(z.x, z.y));
          if (z.v.mid <= 0) {
            return `<g class="farm-zone later" data-tip=" " data-z="${z.id}"><circle cx="${x}" cy="${y}" r="${fs}"/><text x="${x}" y="${y + fs * 0.35}" text-anchor="middle" style="font-size:${fs * 0.8}px">${mmss(z.v.firstSpawn)}</text></g>`;
          }
          const t = Math.sqrt(z.v.mid / max);
          const r = fs * 0.78 + t * fs * 1.15;
          const [cr, cg, cb] = ramp(colors.heat, 0.15 + 0.85 * t);
          const dark = 0.15 + 0.85 * t > 0.55;
          return `<g class="farm-zone" data-tip=" " data-z="${z.id}"><circle cx="${x}" cy="${y}" r="${r}" style="fill:rgb(${cr | 0},${cg | 0},${cb | 0})"/>
            <text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" class="${dark ? 'ink-dark' : ''}" style="font-size:${r > fs * 1.5 ? fs : fs * 0.8}px">${fmtNum(z.v.mid)}</text></g>`;
        })
        .join('');
    }
  };

  const paint = () => {
    colors = themeColors();
    base = recolorMap(img, colors);
    const lg = root.querySelector('#farmLegend');
    if (lg) lg.innerHTML = `<div class="map-legend-bar" style="background:linear-gradient(90deg, ${colors.heat.map((h) => `rgb(${h})`).join(',')})"></div><div class="map-legend-lbl"><span>${L('меньше душ', 'fewer souls')}</span><span>${L('больше', 'more')}</span></div>`;
    draw(true);
  };
  paint();
  wrap.classList.add('ready');

  /* --- наведение и выбор --- */
  const highlight = (i) => {
    svg.classList.toggle('has-hl', i != null);
    svg.querySelectorAll('.farm-route').forEach((g) => g.classList.toggle('hl', +g.dataset.r === i));
    root.querySelectorAll('[data-route]').forEach((li) => li.classList.toggle('hl', +li.dataset.route === i || view.focus === +li.dataset.route));
  };
  svg.addEventListener('mousemove', (e) => {
    const zEl = e.target.closest('[data-z]');
    const rEl = e.target.closest('.farm-route');
    if (zEl) {
      const z = zones[+zEl.dataset.z];
      tip.innerHTML = zoneTip(z);
      if (rEl) highlight(+rEl.dataset.r);
    } else if (rEl) {
      const i = +rEl.dataset.r;
      tip.innerHTML = routeTip(routes[i], i);
      highlight(i);
    }
  });
  svg.addEventListener('mouseleave', () => highlight(null));
  side.addEventListener('mouseover', (e) => {
    const li = e.target.closest('[data-route]');
    highlight(li ? +li.dataset.route : null);
    const zl = e.target.closest('[data-zone]');
    svg.querySelectorAll('.farm-zone').forEach((g) => g.classList.toggle('hl', zl && g.dataset.z === zl.dataset.zone));
  });
  side.addEventListener('mouseleave', () => { highlight(null); svg.querySelectorAll('.farm-zone.hl').forEach((g) => g.classList.remove('hl')); });
  side.addEventListener('click', (e) => {
    const li = e.target.closest('[data-route]');
    if (!li) return;
    const i = +li.dataset.route;
    view.focus = view.focus === i ? null : i;
    root.querySelectorAll('[data-route]').forEach((x) => x.classList.toggle('hl', +x.dataset.route === view.focus));
    draw(true);
  });

  const ro = new ResizeObserver(() => (alive() && document.body.contains(canvas) ? draw(false) : ro.disconnect()));
  ro.observe(wrap);
  const mo = new MutationObserver(() => (alive() && document.body.contains(canvas) ? paint() : mo.disconnect()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ---------- геометрия линий ---------- */
/** Упрощение ломаной (Рамер — Дуглас — Пекер): из сотен клеток остаются изломы улиц. */
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}
/** Плавная кривая через точки (Catmull-Rom → кубические Безье). */
function smoothPath(p) {
  if (p.length < 2) return '';
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
