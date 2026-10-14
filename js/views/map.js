// Теплокарта: где умирают и где дерутся на выбранном ранге, какие точки опасны.
// Данные — /v1/analytics/kill-death-stats (сетка по 128 игровых юнитов), подложка — миникарта из assets API.
// Обе команды сводятся к одному виду «ваша база снизу»: карта симметрична при повороте на 180°
// (проверено по данным: смерти одной команды, развёрнутые на 180°, совпадают с другой с корреляцией 0.99).
import { api } from '../api.js';
import { L, state, filterBar, bindFilterBar, loading, errorBox, esc, fmtNum, timeWindow, periodLabel, rankLabel } from '../core.js';
import { getMapAsset, loadImage, recolorMap, themeColors, mixRgb, ramp, modeBar } from './map-common.js';
import { renderFarm } from './farm.js';

const CELL = 128; // шаг сетки API в игровых юнитах
const SIGMA = 2; // сглаживание в клетках (~250 юнитов) — пятна вместо «шума» из отдельных клеток
const MIN_RISK_SHARE = 0.12; // риск показываем только там, где драк достаточно (доля от пика)
const RISK_FULL = 0.12; // отклонение риска (±12 п.п.), при котором цвет становится насыщенным

const PHASES = [
  { v: 'all', label: ['Весь матч', 'Whole match'] },
  { v: 'lane', label: ['Линия 0–10', 'Lane 0–10'], min: 0, max: 600 },
  { v: 'mid', label: ['Мидгейм 10–25', 'Mid 10–25'], min: 600, max: 1500 },
  { v: 'late', label: ['Лейт 25+', 'Late 25+'], min: 1500 },
];
const LAYERS = [
  { v: 'deaths', label: ['Смерти', 'Deaths'], sub: ['Где игроки умирают чаще всего', 'Where players die most often'] },
  { v: 'fights', label: ['Драки', 'Fights'], sub: ['Где идут стычки: позиции и убийц, и жертв', 'Where fights happen: both killers and victims'] },
  {
    v: 'risk',
    label: ['Риск', 'Risk'],
    sub: [
      'Где вы проигрываете стычки чаще, чем на других маршрутах на таком же расстоянии от базы',
      'Where you lose encounters more often than on other routes at the same distance from your base',
    ],
  },
];
const view = { mode: 'heat', layer: 'deaths', phase: 'all' };

/* ---------- данные ---------- */
function getKD(phase) {
  const p = PHASES.find((x) => x.v === phase);
  return api('/v1/analytics/kill-death-stats', {
    min_unix_timestamp: timeWindow().min,
    min_average_badge: state.badge || undefined,
    min_game_time_s: p.min || undefined,
    max_game_time_s: p.max,
  }, 30);
}

/** Сетки «ваших» смертей и убийств, развёрнутые так, что ваша база внизу. */
function buildGrids(rows, R) {
  const N = Math.ceil((2 * R) / CELL);
  const deaths = new Float32Array(N * N), kills = new Float32Array(N * N);
  // x вправо, y вверх; строка сетки считается сверху. Команда 1 играет сверху — её позиции поворачиваем на 180°.
  const idx = (x, y, team) => {
    if (team === 1) { x = -x - CELL; y = -y - CELL; }
    const i = Math.floor((x + R) / CELL), j = Math.floor((R - y - 1) / CELL);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  };
  for (const r of rows) {
    const T = r.killer_team;
    if (r.deaths) { const k = idx(r.position_x, r.position_y, 1 - T); if (k >= 0) deaths[k] += r.deaths; }
    if (r.kills) { const k = idx(r.position_x, r.position_y, T); if (k >= 0) kills[k] += r.kills; }
  }
  return { N, deaths, kills };
}

/** Разделимое гауссово размытие. */
function blur(src, N, sigma) {
  const rad = Math.ceil(sigma * 3);
  const kern = [];
  let sum = 0;
  for (let i = -rad; i <= rad; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); kern.push(v); sum += v; }
  for (let i = 0; i < kern.length; i++) kern[i] /= sum;
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let k = -rad; k <= rad; k++) { const xx = x + k; if (xx >= 0 && xx < N) s += src[y * N + xx] * kern[k + rad]; }
      tmp[y * N + x] = s;
    }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let k = -rad; k <= rad; k++) { const yy = y + k; if (yy >= 0 && yy < N) s += tmp[yy * N + x] * kern[k + rad]; }
      out[y * N + x] = s;
    }
  return out;
}

function percentile(arr, p) {
  const v = [...arr].filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 1;
}

/** Описание места на карте (координаты уже в виде «ваша база внизу»). */
function zoneName(x, y) {
  const r = Math.hypot(x, y);
  if (r < 1700) return L('Центр карты — яма Мид-босса', 'Map center — the Mid Boss pit');
  const side =
    x < -6500 ? L('левый край', 'left edge')
    : x < -2400 ? L('левый фланг', 'left flank')
    : x > 6500 ? L('правый край', 'right edge')
    : x > 2400 ? L('правый фланг', 'right flank')
    : L('центральная линия', 'center lane');
  if (y < -7600) return `${L('У вашей базы', 'Near your base')}, ${side}`;
  if (y > 7600) return `${L('У вражеской базы', 'Near the enemy base')}, ${side}`;
  if (Math.abs(y) < 2200) return `${L('Середина карты', 'Middle of the map')}, ${side}`;
  return `${y < 0 ? L('Ваша половина', 'Your half') : L('Вражеская половина', 'Enemy half')}, ${side}`;
}

/* ---------- страница ---------- */
export async function render(root, ctx) {
  const { alive } = ctx;
  const rerender = () => render(root, ctx);
  const bindModes = () =>
    root.querySelectorAll('[data-mapmode]').forEach((b) =>
      b.addEventListener('click', () => { if (view.mode !== b.dataset.mapmode) { view.mode = b.dataset.mapmode; rerender(); } }));
  if (view.mode === 'farm') return renderFarm(root, { alive, modeBar: modeBar('farm'), bindModes });

  root.innerHTML = filterBar() + loading(L('Загружаем карту и смерти…', 'Loading the map and deaths…'));
  bindFilterBar(root);
  let asset, rows, img;
  try {
    asset = await getMapAsset();
    [rows, img] = await Promise.all([getKD(view.phase), loadImage(asset.images.plain || asset.images.minimap)]);
  } catch (e) {
    if (alive()) { root.innerHTML = filterBar() + errorBox(e); bindFilterBar(root); }
    return;
  }
  if (!alive()) return;

  const R = asset.radius || 10752;
  const { N, deaths, kills } = buildGrids(rows, R);
  const dS = blur(deaths, N, SIGMA), kS = blur(kills, N, SIGMA);
  const fS = dS.map((v, i) => v + kS[i]);
  const total = deaths.reduce((s, v) => s + v, 0) || 1;

  // доли смертей: своя/чужая половина и центр
  let own = 0, center = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const v = deaths[j * N + i];
      if (!v) continue;
      const x = -R + (i + 0.5) * CELL, y = R - (j + 0.5) * CELL;
      if (y < 0) own += v;
      if (Math.hypot(x, y) < 1700) center += v;
    }

  const layer = LAYERS.find((l) => l.v === view.layer);
  const seg = (list, cur, attr) => `<div class="seg">${list.map((o) => `<button data-${attr}="${o.v}" class="${o.v === cur ? 'on' : ''}">${esc(L(...o.label))}</button>`).join('')}</div>`;
  const tile = (k, v, sub) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${sub}</div></div>`;
  const share = (x) => `${((x / total) * 100).toFixed(1)}%`;

  root.innerHTML = `
    ${filterBar()}
    <section class="section panel pad">
      <div class="map-head"><div class="eyebrow">${L('Карта', 'Map')} · ${esc(periodLabel())} · ${esc(rankLabel())}</div>${modeBar('heat')}</div>
      <h2>${L('Теплокарта смертей и драк', 'Death and fight heatmap')}</h2>
      <div class="sub">${L('Где чаще всего умирают игроки вашего ранга и какие точки опасны. Обе команды сведены к одному виду: ваша база всегда снизу.', 'Where players at your rank die most often and which spots are dangerous. Both teams are combined into one view: your base is always at the bottom.')}</div>
      <div class="rk-kpis map-kpis">
        ${tile(L('Смертей в выборке', 'Deaths in sample'), fmtNum(total), esc(L(...PHASES.find((p) => p.v === view.phase).label)))}
        ${tile(L('На своей половине', 'On your half'), share(own), L('ближе к вашей базе', 'closer to your base'))}
        ${tile(L('На чужой половине', 'On the enemy half'), share(total - own), L('ближе к базе врага', 'closer to the enemy base'))}
        ${tile(L('У Мид-босса', 'At the Mid Boss'), share(center), L('центр карты', 'map center'))}
      </div>
    </section>

    <section class="section map-layout">
      <div class="panel map-panel">
        <div class="map-wrap">
          <div class="map-tag">▲ ${L('База врага', 'Enemy base')}</div>
          <div class="map-box" id="mapWrap">
            <canvas id="mapCanvas" data-tip=" " role="img" aria-label="${esc(L(...layer.sub))}"></canvas>
            <div class="map-pins" id="mapPins"></div>
          </div>
          <div class="map-tag">▼ ${L('Ваша база', 'Your base')}</div>
        </div>
      </div>
      <div class="panel pad map-side">
        <div class="map-ctl"><label>${L('Слой', 'Layer')}</label>${seg(LAYERS, view.layer, 'layer')}</div>
        <div class="note" style="margin:6px 0 14px">${esc(L(...layer.sub))}</div>
        <div class="map-ctl"><label>${L('Время матча', 'Match time')}</label>${seg(PHASES, view.phase, 'phase')}</div>
        <div class="map-legend" id="mapLegend"></div>
        <h3 class="map-h3">${view.layer === 'risk' ? L('Самые невыгодные места', 'Most losing spots') : L('Самые опасные точки', 'Most dangerous spots')}</h3>
        <ol class="map-spots" id="mapSpots"></ol>
        <div class="note">${L('Цифры — по всем матчам выборки. «Риск» — доля стычек, в которых игрок вашей команды умер, а не убил. На своей половине он всегда выше, на чужой — ниже, поэтому рядом указано, какой он обычно на таком же расстоянии от базы.', 'Numbers cover all matches in the sample. "Risk" is the share of encounters where a player on your team died rather than got the kill. It is always higher on your half and lower on the enemy half, so the usual value at the same distance from your base is shown next to it.')}</div>
      </div>
    </section>`;
  bindFilterBar(root);
  bindModes();

  root.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => { view.layer = b.dataset.layer; rerender(); }));
  root.querySelectorAll('[data-phase]').forEach((b) => b.addEventListener('click', () => { view.phase = b.dataset.phase; rerender(); }));

  // значения слоя в каждой клетке: t ∈ [0,1] для цвета, risk — доля смертей
  const peakF = percentile(fS, 0.995);
  const riskOf = (k) => (fS[k] >= peakF * MIN_RISK_SHARE ? dS[k] / fS[k] : null);
  // Обычный риск на этой «глубине» карты (строке сетки): на своей половине вы всегда умираете чаще,
  // на чужой — убиваете, поэтому место сравниваем с соседними маршрутами на том же расстоянии от базы.
  const rowRaw = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    let d = 0, f = 0;
    for (let i = 0; i < N; i++) { const k = j * N + i; if (fS[k] >= peakF * MIN_RISK_SHARE) { d += dS[k]; f += fS[k]; } }
    rowRaw[j] = f ? d / f : NaN;
  }
  const rowBase = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    let s = 0, w = 0;
    for (let t = -6; t <= 6; t++) { const v = rowRaw[j + t]; if (Number.isFinite(v)) { const g = Math.exp(-(t * t) / 18); s += v * g; w += g; } }
    rowBase[j] = w ? s / w : 0.5;
  }
  const relRisk = (k) => { const r = riskOf(k); return r == null ? null : r - rowBase[Math.floor(k / N)]; };
  const scale = view.layer === 'deaths' ? percentile(dS, 0.995) : peakF;
  const value = (k) => (view.layer === 'deaths' ? dS[k] : fS[k]);

  /* --- горячие точки: локальные максимумы с подавлением соседей --- */
  const score = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    if (view.layer === 'risk') { const r = relRisk(k); score[k] = r == null || r < 0.03 ? 0 : r * Math.sqrt(fS[k]); } // разница меньше 3 п.п. — не повод для тревоги
    else score[k] = value(k);
  }
  const order = [...score.keys()].filter((k) => score[k] > 0).sort((a, b) => score[b] - score[a]);
  const spots = [];
  const SUPPRESS = 14; // клеток (~1800 юнитов) между точками
  const CENTER = 1700 / CELL; // яма Мид-босса — одна точка, сколько бы пиков в ней ни было
  const inCenter = (i, j) => Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) < CENTER;
  for (const k of order) {
    const i = k % N, j = Math.floor(k / N);
    if (spots.some((s) => Math.hypot(s.i - i, s.j - j) < SUPPRESS || (inCenter(i, j) && inCenter(s.i, s.j)))) continue;
    spots.push({ i, j, k });
    if (spots.length === 5) break;
  }
  const near = (s, rad) => {
    let d = 0, f = 0;
    for (let y = Math.max(0, s.j - rad); y <= Math.min(N - 1, s.j + rad); y++)
      for (let x = Math.max(0, s.i - rad); x <= Math.min(N - 1, s.i + rad); x++)
        if (Math.hypot(x - s.i, y - s.j) <= rad) { d += deaths[y * N + x]; f += deaths[y * N + x] + kills[y * N + x]; }
    return { d, risk: f ? d / f : null, usual: rowBase[s.j] };
  };
  const meanD = total / Math.max(1, [...fS].filter((v) => v > peakF * 0.01).length);
  spots.forEach((s, n) => {
    const x = -R + (s.i + 0.5) * CELL, y = R - (s.j + 0.5) * CELL;
    Object.assign(s, near(s, 5), { n: n + 1, zone: zoneName(x, y), left: ((s.i + 0.5) / N) * 100, top: ((s.j + 0.5) / N) * 100 });
    s.risk = riskOf(s.k) ?? s.risk; // те же сглаженные значения, что на карте и в подсказке
  });
  // соседние точки в одной зоне различаем номером: «…, левый фланг · 2»
  const seen = {};
  spots.forEach((s) => { seen[s.zone] = (seen[s.zone] || 0) + 1; if (seen[s.zone] > 1) s.zone += ` · ${seen[s.zone]}`; });
  root.querySelector('#mapSpots').innerHTML =
    spots
      .map(
        (s) => `<li data-spot="${s.n}"><span class="map-pin-n">${s.n}</span><div><b>${esc(s.zone)}</b>
          <div class="note">${L('смертей', 'of deaths')}: <b>${share(s.d)}</b>${s.risk != null ? ` · ${L('риск', 'risk')}: <b class="${s.risk > s.usual + 0.01 ? 'bad' : s.risk < s.usual - 0.01 ? 'good' : ''}">${(s.risk * 100).toFixed(0)}%</b> <span class="muted">(${L('обычно', 'usually')} ${(s.usual * 100).toFixed(0)}%)</span>` : ''}</div></div></li>`,
      )
      .join('') || `<li class="muted">${L('Недостаточно данных — расширьте период или ранг.', 'Not enough data — widen the period or rank.')}</li>`;
  root.querySelector('#mapPins').innerHTML = spots.map((s) => `<span class="map-pin" data-spot="${s.n}" style="left:${s.left}%;top:${s.top}%;--i:${s.n}">${s.n}</span>`).join('');
  const pinsBox = root.querySelector('#mapPins'), spotList = root.querySelector('#mapSpots');
  const hl = (n) => root.querySelectorAll('[data-spot]').forEach((el) => el.classList.toggle('hl', el.dataset.spot === n));
  [pinsBox, spotList].forEach((box) => {
    box.addEventListener('mouseover', (e) => hl(e.target.closest('[data-spot]')?.dataset.spot));
    box.addEventListener('mouseleave', () => hl(null));
  });

  /* --- легенда --- */
  const drawLegend = (c) => {
    const grad = view.layer === 'risk'
      ? `linear-gradient(90deg, rgb(${c.win}), rgb(${c.mid}), rgb(${c.lose}))`
      : `linear-gradient(90deg, ${c.heat.map((h) => `rgb(${h})`).join(',')})`;
    const [a, b] = view.layer === 'risk' ? [L('безопаснее соседних', 'safer than nearby'), L('опаснее соседних', 'riskier than nearby')] : [L('реже', 'fewer'), L('чаще', 'more')];
    root.querySelector('#mapLegend').innerHTML = `<div class="map-legend-bar" style="background:${grad}"></div>
      <div class="map-legend-lbl"><span>${a}</span>${view.layer === 'risk' ? `<span>${L('как обычно', 'typical')}</span>` : ''}<span>${b}</span></div>`;
  };

  /* --- отрисовка --- */
  const canvas = root.querySelector('#mapCanvas');
  const wrap = root.querySelector('#mapWrap');
  let base = null, colors = null, lastW = 0;
  const heatLayer = () => {
    const h = document.createElement('canvas');
    h.width = h.height = N;
    const g = h.getContext('2d');
    const id = g.createImageData(N, N);
    for (let k = 0; k < N * N; k++) {
      let rgb, a;
      if (view.layer === 'risk') {
        const r = relRisk(k);
        if (r == null) continue;
        const t = Math.max(-1, Math.min(1, r / RISK_FULL));
        rgb = t < 0 ? mixRgb(colors.mid, colors.win, -t) : mixRgb(colors.mid, colors.lose, t);
        a = 0.35 + 0.55 * Math.abs(t);
      } else {
        const t = Math.pow(Math.min(1, value(k) / scale), 0.7);
        if (t < 0.03) continue;
        rgb = ramp(colors.heat, t);
        a = Math.min(1, t * 2.2) * 0.9; // слабые значения растворяются в подложке
      }
      id.data.set([rgb[0], rgb[1], rgb[2], Math.round(a * 255)], k * 4);
    }
    g.putImageData(id, 0, 0);
    return h;
  };
  const draw = (force) => {
    const w = Math.round(wrap.clientWidth);
    if (!w || (!force && w === lastW)) return;
    lastW = w;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(w * dpr);
    canvas.style.width = canvas.style.height = w + 'px';
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(base, 0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'source-atop'; // тепло — только поверх улиц и зданий, не за краем карты
    g.drawImage(heatLayer(), 0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'source-over';
  };
  const paint = () => {
    colors = themeColors();
    base = recolorMap(img, colors);
    drawLegend(colors);
    draw(true);
  };
  paint();
  wrap.classList.add('ready');

  // перерисовка при смене ширины и темы; наблюдатели отключаются, когда страницу покинули
  const ro = new ResizeObserver(() => (alive() && document.body.contains(canvas) ? draw(false) : ro.disconnect()));
  ro.observe(wrap);
  const mo = new MutationObserver(() => (alive() && document.body.contains(canvas) ? paint() : mo.disconnect()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* --- подсказка при наведении --- */
  const tip = document.getElementById('tip');
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * N), j = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const k = j * N + i;
    const x = -R + (i + 0.5) * CELL, y = R - (j + 0.5) * CELL;
    if (fS[k] < peakF * 0.01) { tip.innerHTML = `<div class="td">${esc(zoneName(x, y))}<br><span class="muted">${L('здесь почти не дерутся', 'barely any fights here')}</span></div>`; return; }
    const ratio = dS[k] / meanD;
    const risk = riskOf(k), usual = rowBase[j];
    tip.innerHTML = `<div class="tt">${esc(zoneName(x, y))}</div><div class="td">${L('Смертей здесь', 'Deaths here')}: <b>${ratio >= 1 ? `${ratio.toFixed(1)}×` : `${(ratio * 100).toFixed(0)}%`}</b> ${ratio >= 1 ? L('от среднего по карте', 'the map average') : L('от среднего по карте', 'of the map average')}${risk != null ? `<br>${L('Ваша команда умирает в', 'Your team dies in')} <b class="${risk > usual + 0.01 ? 'bad' : risk < usual - 0.01 ? 'good' : ''}">${(risk * 100).toFixed(0)}%</b> ${L('стычек', 'of encounters')} <span class="muted">(${L('на этой глубине обычно', 'usual at this depth')} ${(usual * 100).toFixed(0)}%)</span>` : ''}</div>`;
  });
}
