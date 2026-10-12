// «Сила по ходу матча»: винрейт героя в зависимости от длительности матча.
// Короткие матчи выигрывают герои ранней игры, длинные — лейт-герои.
import { A, L, getDurationStats, getSoulCurve, DURATION_BUCKETS, esc, fmtNum, errorBox, loading } from '../core.js';

const MIN_SAMPLE = 150; // меньше матчей в интервале — точка считается ненадёжной

const TYPES = {
  early: {
    label: ['Сильнее в начале', 'Early-game hero'],
    advice: [
      'Давите с линии, забирайте объекты и старайтесь закончить матч до 30-й минуты: чем дольше игра, тем слабее герой.',
      'Pressure your lane, take objectives and try to end before minute 30: the longer the game, the weaker the hero.',
    ],
  },
  late: {
    label: ['Лейт-герой', 'Late-game hero'],
    advice: [
      'Переживите раннюю игру, спокойно фармите и не форсируйте драки: со временем герой становится только сильнее.',
      'Survive the early game, farm calmly and don’t force fights: the hero only gets stronger over time.',
    ],
  },
  mid: {
    label: ['Пик в мидгейме', 'Mid-game peak'],
    advice: [
      'Окно силы — середина матча: собирайте ключевые предметы к этому времени и навязывайте драки вокруг мид-босса.',
      'The power window is mid-game: have your key items by then and force fights around the Mid Boss.',
    ],
  },
  flat: {
    label: ['Ровный по ходу матча', 'Consistent all match'],
    advice: [
      'По сравнению с другими героями длительность матча почти не влияет на его силу — его можно брать под любой темп игры.',
      'Compared to other heroes, match length barely affects its strength — it fits any game tempo.',
    ],
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

/** Души к моменту времени (сек): линейная интерполяция кривой.
 *  avg — в среднем у игроков на герое; target — среднее + 0.5σ ≈ уровень лучших ~30% игроков. */
function soulsAt(curve, sec) {
  const pts = (curve || []).filter((c) => c.net_worth_std > 0 || c.game_time <= 900); // σ=0 — одиночные затяжные матчи
  if (!pts.length || sec < pts[0].game_time || sec > pts.at(-1).game_time) return null;
  let k = pts.findIndex((c) => c.game_time >= sec);
  if (k <= 0) k = 1;
  const a = pts[k - 1], b = pts[k];
  const f = (sec - a.game_time) / (b.game_time - a.game_time || 1);
  const avg = a.net_worth_avg + (b.net_worth_avg - a.net_worth_avg) * f;
  const std = a.net_worth_std + (b.net_worth_std - a.net_worth_std) * f;
  return { avg, target: avg + 0.5 * std };
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
  el.innerHTML = loading(L('Считаем винрейт по длительности матча…', 'Calculating win rate by match length…'));
  let buckets, curve;
  try {
    // кривая душ не обязательна: без неё график всё равно покажем
    [buckets, curve] = await Promise.all([getDurationStats(), getSoulCurve(heroId).catch(() => null)]);
  } catch (e) {
    if (alive()) el.innerHTML = errorBox(e);
    return;
  }
  if (!alive()) return;

  const typical = typicalCurve(buckets);
  const points = DURATION_BUCKETS.map((b, i) => {
    const r = buckets[i].get(heroId);
    const n = r?.matches || 0;
    // время для душ: середина интервала; для «<20» — 17.5 мин (такие матчи обычно длятся 15–20 минут)
    const soulMin = b.max == null ? b.min + 2.5 : b.min === 0 ? 17.5 : (b.min + b.max) / 2;
    return { ...b, i, n, wr: n ? r.wins / n : null, typ: typical[i], mid: b.max == null ? b.min + 5 : (b.min + b.max) / 2, soulMin, souls: soulsAt(curve, soulMin * 60) };
  });
  const shown = points.filter((p) => p.n > 0);
  if (shown.length < 2) {
    el.innerHTML = `<div class="empty">${L('Недостаточно матчей за выбранный период — попробуйте расширить период или ранг.', 'Not enough matches for the selected period — try widening the period or rank.')}</div>`;
    return;
  }

  const v = classify(points);
  const t = v && TYPES[v.type];
  // пик силы — интервал с наибольшим преимуществом над типичным героем
  const peak = v ? points[v.best.i] : null;
  const peakSouls = peak?.souls;
  const pp = (x) => `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
  el.innerHTML = `
    <div class="pc-head">
      ${t ? `<span class="pc-type pc-${v.type}">${L(...t.label)}</span>` : ''}
      <div class="pc-text">${
        v
          ? L(
              `${v.early != null && v.late != null ? `В матчах до 30 минут — <b>${(v.early * 100).toFixed(1)}%</b> (${pp(v.earlyRel)} п.п. к типичному герою), после 35 минут — <b>${(v.late * 100).toFixed(1)}%</b> (${pp(v.lateRel)} п.п.). ` : ''}${v.type === 'mid' ? `Пик — в матчах <b>${v.best.label} мин</b>. ` : ''}${peakSouls ? `К пику силы (<b>${esc(peak.label)} мин</b>) старайтесь иметь <b>~${fmtNum(peakSouls.target)} душ</b> — в среднем у игроков на герое ${fmtNum(peakSouls.avg)}. ` : ''}`,
              `${v.early != null && v.late != null ? `In matches under 30 minutes — <b>${(v.early * 100).toFixed(1)}%</b> (${pp(v.earlyRel)} pp vs a typical hero), after 35 minutes — <b>${(v.late * 100).toFixed(1)}%</b> (${pp(v.lateRel)} pp). ` : ''}${v.type === 'mid' ? `The peak is in <b>${v.best.label} min</b> matches. ` : ''}${peakSouls ? `By the power peak (<b>${esc(peak.label)} min</b>) aim for <b>~${fmtNum(peakSouls.target)} souls</b> — the average player on this hero has ${fmtNum(peakSouls.avg)}. ` : ''}`,
            ) + L(...t.advice)
          : L('Пока мало матчей, чтобы уверенно сказать, когда герой сильнее.', 'Too few matches yet to say confidently when the hero is strongest.')
      }</div>
    </div>
    <div class="pc-chart" role="img" aria-label="${L('Винрейт героя по длительности матча', 'Hero win rate by match length')}"></div>
    <div class="note" style="padding:0 20px 16px">${L(
      `Точка — винрейт героя во всех матчах такой длительности. Тонкая линия — типичный герой (медиана всех героев): вердикт считается относительно неё. Под осью: «души» — цель к середине интервала (столько душ к этой минуте у лучших ~30% игроков на герое), «матчей» — размер выборки. Полые точки — меньше ${MIN_SAMPLE} матчей, им не стоит доверять.`,
      `Each dot is the hero’s win rate across all matches of that length. The thin line is a typical hero (median of all heroes): the verdict is relative to it. Below the axis: "souls" is the target at the middle of the interval (what the top ~30% of players on this hero have by that minute), "matches" is the sample size. Hollow dots have fewer than ${MIN_SAMPLE} matches and shouldn’t be trusted.`,
    )}</div>`;

  const box = el.querySelector('.pc-chart');
  let lastW = 0;
  const draw = () => {
    if (box.clientWidth === lastW) return;
    lastW = box.clientWidth;
    drawChart(box, points, peak);
  };
  draw();
  // перерисовываем под ширину контейнера, чтобы подписи не масштабировались вместе с SVG
  const ro = new ResizeObserver(() => { if (!document.body.contains(box)) return ro.disconnect(); draw(); });
  ro.observe(box);
}

function drawChart(box, points, peak) {
  const W = Math.max(320, box.clientWidth || 640);
  const hasSouls = points.some((p) => p.souls);
  const H = hasSouls ? 326 : 300;
  const m = { l: 52, r: 66, t: 40, b: hasSouls ? 70 : 52 };
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
    <text class="pc-typlabel" x="${m.l + pw + 6}" y="${y(lastP.typ) + 4}">${L('типичный', 'typical')}</text>
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
        const min = L('мин', 'min');
        const tip = p.wr == null
          ? `<b>${esc(p.label)} ${min}</b><br>${L('нет матчей', 'no matches')}`
          : `<b>${esc(p.label)} ${min}</b><br>${L('винрейт', 'win rate')} ${fmt(p.wr)} · ${fmtNum(p.n)} ${L('матчей', 'matches')}<br>${L('типичный герой', 'typical hero')}: ${fmt(p.typ)} (${p.wr >= p.typ ? '+' : ''}${((p.wr - p.typ) * 100).toFixed(1)} ${L('п.п.', 'pp')})${p.souls ? `<br>${L('души к', 'souls by')} ~${Math.round(p.soulMin)} ${min}: ${L('цель', 'target')} ${fmtNum(p.souls.target)} · ${L('в среднем', 'average')} ${fmtNum(p.souls.avg)}` : ''}${p.n < MIN_SAMPLE ? `<br>${L('мало данных', 'too little data')}` : ''}`;
        return `<g class="pc-hit" data-tip="${tip}" style="--i:${p.i}">
          <rect x="${cx - colW / 2}" y="${m.t}" width="${colW}" height="${ph}" fill="transparent"/>
          <line class="pc-cross" x1="${cx}" x2="${cx}" y1="${m.t}" y2="${m.t + ph}"/>
          ${p.wr == null ? '' : `<circle class="pc-dot ${p.n < MIN_SAMPLE ? 'weak' : ''}" cx="${cx}" cy="${y(p.wr)}" r="5"/>`}
          ${label}
          <text class="pc-xtick" x="${cx}" y="${m.t + ph + 20}" text-anchor="middle">${esc(p.label)}</text>
          ${hasSouls ? `<text class="pc-xsouls ${p === peak ? 'peak' : ''}" x="${cx}" y="${m.t + ph + 38}" text-anchor="middle">${p.souls ? fmtNum(p.souls.target) : '—'}</text>` : ''}
          <text class="pc-xsub" x="${cx}" y="${m.t + ph + (hasSouls ? 56 : 36)}" text-anchor="middle">${p.n ? fmtNum(p.n) : '—'}</text>
        </g>`;
      })
      .join('')}
    ${peakCallout()}
    ${hasSouls ? `<text class="pc-rowlabel" x="${m.l - 8}" y="${m.t + ph + 38}" text-anchor="end">${L('души', 'souls')}</text>` : ''}
    <text class="pc-rowlabel" x="${m.l - 8}" y="${m.t + ph + (hasSouls ? 56 : 36)}" text-anchor="end">${L('матчей', 'matches')}</text>
    <text class="pc-rowlabel" x="${m.l - 8}" y="${m.t + ph + 20}" text-anchor="end">${L('мин', 'min')}</text>
  </svg>`;

  /** Плашка «Пик силы · ~26K душ» над точкой пика. */
  function peakCallout() {
    if (!peak || peak.wr == null) return '';
    const txt = peak.souls ? `${L('Пик силы', 'Power peak')} · ~${fmtNum(peak.souls.target)} ${L('душ', 'souls')}` : L('Пик силы', 'Power peak');
    const w = txt.length * 6.7 + 20, h = 22;
    const cx = Math.min(Math.max(x(peak.i), m.l + w / 2), m.l + pw - w / 2);
    const py = y(peak.wr);
    // над точкой (и над подписью винрейта), а если не помещается сверху — под точкой
    const above = py - 30 - h >= 2;
    const top = above ? py - 30 - h : py + 30;
    return `<g class="pc-peak">
      <rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="11"/>
      <text x="${cx}" y="${top + 15}" text-anchor="middle">${esc(txt)}</text>
    </g>`;
  }
}
