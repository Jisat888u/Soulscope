// Общее для обоих режимов вкладки «Карта»: ассет карты, подложка в цветах темы, цветовые шкалы.
import { api } from '../api.js';
import { L } from '../core.js';

/** Миникарта, радиус, кемпы и объекты карты (assets API). */
export function getMapAsset() {
  return api('/v1/assets/map', {}, 24 * 60);
}

/* ---------- цвета ---------- */
export const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** Цвет по шкале: stops — массив rgb, t ∈ [0,1]. */
export function ramp(stops, t) {
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  return mixRgb(stops[i], stops[i + 1], f - i);
}
export function themeColors() {
  return {
    heat: cssVar('--heat').split(',').map((s) => hex(s.trim())),
    win: hex(cssVar('--risk-win')),
    lose: hex(cssVar('--risk-lose')),
    mid: hex(cssVar('--risk-mid')),
    street: hex(cssVar('--map-street')),
    block: hex(cssVar('--map-block')),
  };
}

/* ---------- подложка: миникарта, перекрашенная в цвета темы ---------- */
const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src))
    imgCache.set(src, new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => { imgCache.delete(src); rej(new Error(L('Не удалось загрузить карту', 'Failed to load the map'))); };
      im.src = src;
    }));
  return imgCache.get(src);
}
/** Улицы на картинке тёмно-серые, здания белые, вокруг прозрачно — раскрашиваем по яркости. */
export function recolorMap(img, colors) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const l = (px[i] + px[i + 1] + px[i + 2]) / 765;
    const t = Math.max(0, Math.min(1, (l - 0.27) / 0.6));
    const [r, gg, b] = mixRgb(colors.street, colors.block, t);
    px[i] = r; px[i + 1] = gg; px[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Переключатель режимов вкладки: теплокарта / карта фарма. */
export const MODES = [
  { v: 'heat', label: ['Теплокарта', 'Heatmap'] },
  { v: 'farm', label: ['Карта фарма', 'Farm map'] },
];
export const modeBar = (cur) =>
  `<div class="seg map-modes" role="tablist">${MODES.map((m) => `<button data-mapmode="${m.v}" role="tab" aria-selected="${m.v === cur}" class="${m.v === cur ? 'on' : ''}">${L(...m.label)}</button>`).join('')}</div>`;
