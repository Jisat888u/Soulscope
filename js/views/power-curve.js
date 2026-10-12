// «Сила по ходу матча»: винрейт героя в зависимости от длительности матча.
// Короткие матчи выигрывают герои ранней игры, длинные — лейт-герои.
import { A, getDurationStats, DURATION_BUCKETS, esc, fmtNum, errorBox, loading } from '../core.js';

const MIN_SAMPLE = 150; // меньше матчей в интервале — точка считается ненадёжной

const TYPES = {
  early: {
    label: 'Сильнее в начале',
    advice: 'Давите с линии, забирайте объекты и старайтесь закончить матч до 30-й минуты: чем дольше игра, тем слабее герой.',
  },
  late: {
    label: 'Лейт-герой',
    advice: 'Переживите раннюю игру, спокойно фармите и не форсируйте драки: со временем герой становится только сильнее.',
  },
  mid: {
    label: 'Пик в мидгейме',
    advice: 'Окно силы — середина матча: собирайте ключевые предметы к этому времени и навязывайте драки вокруг мид-босса.',
  },
  flat: {
    label: 'Ровный по ходу матча',
    advice: 'По сравнению с другими героями длительность матча почти не влияет на его силу — его можно брать под любой темп игры.',
  },
};

/** Винрейт «типичного героя» в каждом интервале — медиана по всем героям с достаточной выборкой.
 *  Нужна, чтобы один доминирующий герой (например, имба в коротких матчах) не делал всех остальных «лейтовыми». */
function typicalCurve(buckets) {
  return buckets.map((map) => {
    const wrs = [...map.values()].filter((r) => A.heroById.has(r.hero_id) && r.matches >= MIN_SAMPLE).map((r) => r.wins / r.matches).sort((a, b) => a - b);
    if (!wrs.length) return 0.5;
    const k = wrs.length >> 1;
    return wrs.length % 2 ? wrs[k] : (wrs[k - 1] + wrs[k]) / 2;
  });
}

/** Классификация по взвешенной линейной регрессии винрейта от длительности. */
function classify(points) {
  const ok = points.filter((p) => p.n >= MIN_SAMPLE).map((p) => ({ ...p, rel: p.wr - p.typ }));
  if (ok.length < 3) return null;
  const W = ok.reduce((s, p) => s + p.n, 0);
  const mx = ok.reduce((s, p) => s + p.n * p.mid, 0) / W;
  const my = ok.reduce((s, p) => s + p.n * p.rel, 0) / W;
  const sxy = ok.reduce((s, p) => s + p.n * (p.mid - mx) * (p.rel - my), 0);
  const sxx = ok.reduce((s, p) => s + p.n * (p.mid - mx) ** 2, 0) || 1;
  const swing = (sxy / sxx) * 30; // изменение преимущества над типичным героем за 30 минут матча
  const best = ok.reduce((a, b) => (b.rel > a.rel ? b : a));
  const worst = ok.reduce((a, b) => (b.rel < a.rel ? b : a));
  const edges = Math.max(ok[0].rel, ok.at(-1).rel);
  const bestIdx = ok.indexOf(best);
  // средний винрейт ранней (до 30 мин) и поздней (35+ мин) игры — для понятного текста
  const avg = (list) => {
    const n = list.reduce((acc, p) => acc + p.n, 0);
    return n ? list.reduce((acc, p) => acc + p.n * p.wr, 0) / n : null;
  };
  const earlyPts = ok.filter((p) => p.max != null && p.max <= 30);
  const latePts = ok.filter((p) => p.min >= 35);
  const early = avg(earlyPts);
  const late = avg(latePts);
  const relAvg = (list) => {
    const n = list.reduce((acc, p) => acc + p.n, 0);
    return n ? list.reduce((acc, p) => acc + p.n * p.rel, 0) / n : null;
  };
  const earlyRel = relAvg(earlyPts);
  const lateRel = relAvg(latePts);
  let type = 'flat';
  if (swing <= -0.03) type = 'early';
  else if (swing >= 0.03) type = 'late';
  else if (bestIdx > 0 && bestIdx < ok.length - 1 && best.rel - edges >= 0.015) type = 'mid';
  return { type, swing, best, worst, early, late, earlyRel, lateRel };
}

export async function renderPowerCurve(el, heroId, alive) {
  el.innerHTML = loading('Считаем винрейт по длительности матча…');
  let buckets;
  try {
    buckets = await getDurationStats();
  } catch (e) {
    if (alive()) el.innerHTML = errorBox(e);
    return;
  }
  if (!alive()) return;

  const typical = typicalCurve(buckets);
  const points = DURATION_BUCKETS.map((b, i) => {
    const r = buckets[i].get(heroId);
    const n = r?.matches || 0;
    return { ...b, i, n, wr: n ? r.wins / n : null, typ: typical[i], mid: b.max == null ? b.min + 5 : (b.min + b.max) / 2 };
  });
  const shown = points.filter((p) => p.n > 0);
  if (shown.length < 2) {
    el.innerHTML = '<div class="empty">Недостаточно матчей за выбранный период — попробуйте расширить период или ранг.</div>';
    return;
  }

  const v = classify(points);
  const t = v && TYPES[v.type];
  const pp = (x) => `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
  el.innerHTML = `
    <div class="pc-head">
      ${t ? `<span class="pc-type pc-${v.type}">${t.label}</span>` : ''}
      <div class="pc-text">${
        v
          ? `${v.early != null && v.late != null ? `В матчах до 30 минут — <b>${(v.early * 100).toFixed(1)}%</b> (${pp(v.earlyRel)} п.п. к типичному герою), после 35 минут — <b>${(v.late * 100).toFixed(1)}%</b> (${pp(v.lateRel)} п.п.). ` : ''}${v.type === 'mid' ? `Пик — в матчах <b>${v.best.label} мин</b>. ` : ''}${t.advice}`
          : 'Пока мало матчей, чтобы уверенно сказать, когда герой сильнее.'
      }</div>
    </div>
    <div class="pc-chart" role="img" aria-label="Винрейт героя по длительности матча"></div>
    <div class="note" style="padding:0 20px 16px">Точка — винрейт героя во всех матчах такой длительности. Тонкая линия — типичный герой (медиана всех героев): вердикт считается относительно неё. Под осью — сколько матчей в выборке. Полые точки — меньше ${MIN_SAMPLE} матчей, им не стоит доверять.</div>`;

  const box = el.querySelector('.pc-chart');
  let lastW = 0;
  const draw = () => {
    if (box.clientWidth === lastW) return;
    lastW = box.clientWidth;
    drawChart(box, points);
  };
  draw();
  // перерисовываем под ширину контейнера, чтобы подписи не масштабировались вместе с SVG
  const ro = new ResizeObserver(() => { if (!document.body.contains(box)) return ro.disconnect(); draw(); });
  ro.observe(box);
}

function drawChart(box, points) {
  const W = Math.max(320, box.clientWidth || 640);
  const H = 300;
  const m = { l: 46, r: 66, t: 28, b: 52 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const vals = [...points.filter((p) => p.wr != null).map((p) => p.wr), ...points.map((p) => p.typ)];

  // ось Y: чистые деления, 50% всегда в диапазоне
  const lo = Math.min(0.5, ...vals), hi = Math.max(0.5, ...vals);
  const step = hi - lo > 0.16 ? 0.05 : hi - lo > 0.06 ? 0.025 : 0.01;
  const yMin = Math.floor((lo - step * 0.4) / step) * step;
  const yMax = Math.ceil((hi + step * 0.4) / step) * step;
  const ticks = [];
  for (let y = yMin; y <= yMax + 1e-9; y += step) ticks.push(+y.toFixed(4));

  const x = (i) => m.l + (pw / points.length) * (i + 0.5);
  const y = (wr) => m.t + ph - ((wr - yMin) / (yMax - yMin)) * ph;
  const seg = points.filter((p) => p.wr != null);
  const line = seg.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.wr).toFixed(1)}`).join(' ');
  const y50 = y(0.5);
  const typLine = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.typ).toFixed(1)}`).join(' ');
  const lastP = points.at(-1);
  const area = `${line} L${x(seg.at(-1).i).toFixed(1)},${y50.toFixed(1)} L${x(seg[0].i).toFixed(1)},${y50.toFixed(1)} Z`;

  // прямые подписи — только лучшая и худшая надёжные точки
  const reliable = seg.filter((p) => p.n >= MIN_SAMPLE);
  const best = reliable.length ? reliable.reduce((a, b) => (b.wr > a.wr ? b : a)) : null;
  const worst = reliable.length ? reliable.reduce((a, b) => (b.wr < a.wr ? b : a)) : null;
  const fmt = (wr) => (wr * 100).toFixed(1) + '%';
  const colW = pw / points.length;

  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${ticks
      .map((tv) => `<line class="pc-grid ${Math.abs(tv - 0.5) < 1e-6 ? 'pc-50' : ''}" x1="${m.l}" x2="${W - m.r}" y1="${y(tv)}" y2="${y(tv)}"/>
        <text class="pc-ytick ${Math.abs(tv - 0.5) < 1e-6 ? 'pc-ytick-50' : ''}" x="${m.l - 8}" y="${y(tv) + 4}" text-anchor="end">${(tv * 100).toFixed(step < 0.025 ? 0 : step === 0.025 ? 1 : 0)}%</text>`)
      .join('')}
    <path class="pc-typ" d="${typLine}"/>
    <text class="pc-typlabel" x="${m.l + pw + 6}" y="${y(lastP.typ) + 4}">типичный</text>
    <path class="pc-area" d="${area}"/>
    <path class="pc-line" d="${line}" pathLength="1"/>
    ${points
      .map((p) => {
        const cx = x(p.i);
        const label =
          p.wr == null
            ? ''
            : (p === best || p === worst) && best !== worst
              ? `<text class="pc-dlabel" x="${cx}" y="${p === best ? y(p.wr) - 12 : y(p.wr) + 20}" text-anchor="middle">${fmt(p.wr)}</text>`
              : '';
        const tip = p.wr == null
          ? `<b>${esc(p.label)} мин</b><br>нет матчей`
          : `<b>${esc(p.label)} мин</b><br>винрейт ${fmt(p.wr)} · ${fmtNum(p.n)} матчей<br>типичный герой: ${fmt(p.typ)} (${p.wr >= p.typ ? '+' : ''}${((p.wr - p.typ) * 100).toFixed(1)} п.п.)${p.n < MIN_SAMPLE ? '<br>мало данных' : ''}`;
        return `<g class="pc-hit" data-tip="${tip}" style="--i:${p.i}">
          <rect x="${cx - colW / 2}" y="${m.t}" width="${colW}" height="${ph}" fill="transparent"/>
          <line class="pc-cross" x1="${cx}" x2="${cx}" y1="${m.t}" y2="${m.t + ph}"/>
          ${p.wr == null ? '' : `<circle class="pc-dot ${p.n < MIN_SAMPLE ? 'weak' : ''}" cx="${cx}" cy="${y(p.wr)}" r="5"/>`}
          ${label}
          <text class="pc-xtick" x="${cx}" y="${m.t + ph + 20}" text-anchor="middle">${esc(p.label)}</text>
          <text class="pc-xsub" x="${cx}" y="${m.t + ph + 36}" text-anchor="middle">${p.n ? fmtNum(p.n) : '—'}</text>
        </g>`;
      })
      .join('')}
    <text class="pc-xsub" x="${W - m.r}" y="${m.t - 12}" text-anchor="end">длительность матча, мин →</text>
  </svg>`;
}
