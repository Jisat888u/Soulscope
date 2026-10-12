// Точка входа: шапка, роутинг по hash, поиск (Ctrl+K), тема, язык.
import { A, state, setState, onState, loadAssets, getMeta, patchInfo, hName, heroImg, esc, pct, fmtNum, timeAgo, initTooltips, roleName, periodLabel } from './core.js';
import { loadPatches, latestBalancePatch } from './patches.js';
import { initMotion, leaveView, moveTabInk, themeTransition } from './motion.js';

const ROUTES = {
  home: () => import('./views/home.js'),
  tier: () => import('./views/tier.js'),
  heroes: () => import('./views/heroes.js'),
  hero: () => import('./views/hero.js'),
  counters: () => import('./views/counters.js'),
  patches: () => import('./views/patches.js'),
  duos: () => import('./views/duos.js'),
  ranks: () => import('./views/ranks.js'),
};

const app = document.getElementById('app');
let renderToken = 0;

function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const name = ROUTES[parts[0]] ? parts[0] : 'home';
  return { name, args: parts.slice(1), query: new URLSearchParams(query) };
}

/* ---------- статистика посещений (GoatCounter) ---------- */
// Сайт одностраничный (hash-роутинг), поэтому каждую вкладку отправляем как отдельную страницу:
// #/tier → /tier, #/hero/13 → /hero/13. Параметры (?e=…) не считаем — это один и тот же раздел.
// На localhost count.js сам ничего не отправляет.
let lastTracked = null;
function track() {
  const path = '/' + (location.hash.replace(/^#\/?/, '').split('?')[0] || '');
  if (path === lastTracked) return; // смена фильтров перерисовывает страницу, но это не новый просмотр
  const send = () => {
    if (!window.goatcounter?.count) return false;
    window.goatcounter.count({ path });
    lastTracked = path;
    return true;
  };
  if (!send()) document.querySelector('script[data-goatcounter]')?.addEventListener('load', send, { once: true });
}

let lastRouteKey = null;
async function render() {
  const token = ++renderToken;
  const route = parseHash();
  // смена раздела (а не фильтров) — с плавным переходом и прокруткой наверх
  const key = `${route.name}/${route.args.join('/')}`;
  const routeChanged = lastRouteKey !== null && key !== lastRouteKey;
  lastRouteKey = key;
  track();
  document.querySelectorAll('#tabs a').forEach((a) => {
    const r = a.dataset.route;
    a.classList.toggle('active', r === route.name || (r === 'heroes' && route.name === 'hero'));
  });
  moveTabInk();
  try {
    const [mod] = await Promise.all([ROUTES[route.name](), routeChanged ? leaveView(app) : null]);
    if (token !== renderToken) return;
    if (routeChanged) window.scrollTo(0, 0);
    app.classList.remove('view-leave');
    await mod.render(app, { ...route, alive: () => token === renderToken });
  } catch (e) {
    console.error(e);
    app.classList.remove('view-leave');
    if (token === renderToken) app.innerHTML = `<div class="error"><b>Ошибка отрисовки.</b> ${esc(e.message)}</div>`;
  }
}

/* ---------- шапка ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  try { localStorage.setItem('dt.theme', state.theme); } catch {}
}
function initHeader() {
  const langBtn = document.getElementById('langBtn');
  const sync = () => (langBtn.textContent = state.lang === 'en' ? 'EN' : 'RU');
  sync();
  langBtn.addEventListener('click', () => { setState({ lang: state.lang === 'en' ? 'ru' : 'en' }); sync(); });
  document.getElementById('themeBtn').addEventListener('click', () =>
    themeTransition(() => { setState({ theme: state.theme === 'light' ? 'dark' : 'light' }); applyTheme(); }),
  );
  document.getElementById('searchBtn').addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) { e.preventDefault(); openSearch(); }
  });
  applyTheme();
}

async function updateTicker() {
  const el = document.getElementById('ticker');
  try {
    const meta = await getMeta();
    const top = [...meta.list].sort((a, b) => b.wr - a.wr).slice(0, 14);
    const items = `<span class="tk"><b>${fmtNum(meta.totalMatches)}</b>&nbsp;матчей · ${esc(periodLabel())}</span>
      ${top.map((x) => `<a class="tk" href="#/hero/${x.id}">${heroImg(x.hero, 'sm')}${esc(hName(x.hero))} <b class="${x.wr >= 0.5 ? 'good' : 'bad'}">${pct(x.wr)}</b></a>`).join('')}`;
    // контент дублируется, чтобы бегущая строка шла бесшовно (сдвиг на -50%)
    el.innerHTML = `<div class="ticker-inner has-track">
      <span class="live">LIVE</span>
      <div class="ticker-viewport"><div class="ticker-track" style="--marquee-dur:${top.length * 4}s">${items}<span aria-hidden="true" style="display:contents">${items}</span></div></div>
    </div>`;
    el.querySelectorAll('.hicon').forEach((i) => (i.style.cssText = 'width:18px;height:18px;border-radius:4px'));
  } catch {
    el.innerHTML = '<div class="ticker-inner"><span class="live">LIVE</span><span class="tk muted">API статистики временно недоступно</span></div>';
  }
}

/* ---------- раскладка и анимации ---------- */
// Реальная высота липкой шапки → отступ для липких заголовков таблиц; переполнение навигации → маска.
function watchLayout() {
  const header = document.querySelector('header.site');
  const nav = document.getElementById('tabs');
  const measure = () => {
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    nav.classList.toggle('overflowing', nav.scrollWidth > nav.clientWidth + 1);
    moveTabInk(); // выравнивание навигации могло смениться — подчёркивание пересчитываем
  };
  // замер в следующем кадре — после того как раскладка и шрифты применились
  const sync = () => requestAnimationFrame(measure);
  const ro = new ResizeObserver(sync);
  ro.observe(header);
  ro.observe(nav);
  window.addEventListener('resize', sync);
  document.fonts?.ready.then(sync);
  sync();
}

// Индекс элемента среди соседей → CSS-переменная --i для анимаций «лесенкой».
const STAGGER = '.tile, tbody > tr, .hcard, .item, .mu, .mini-row, .duo-card, .hchange, .threat, .ability, .kpi, .skill-grid > .c, .rk-card, .rk-col';
function stagger(nodes) {
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    const els = node.matches(STAGGER) ? [node] : node.querySelectorAll(STAGGER);
    for (const el of els) {
      let i = 0;
      for (let s = el.previousElementSibling; s && i < 30; s = s.previousElementSibling) if (s.className === el.className) i++;
      el.style.setProperty('--i', i);
    }
  }
}
function watchStagger() {
  // MutationObserver срабатывает до отрисовки кадра — задержки успевают примениться к новым элементам
  new MutationObserver((muts) => muts.forEach((m) => stagger(m.addedNodes))).observe(app, { childList: true, subtree: true });
}

/* ---------- поиск ---------- */
function openSearch() {
  if (document.querySelector('.modal-back')) return;
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal"><input type="text" placeholder="Найти героя (RU или EN)…" autocomplete="off" /><div class="results"></div></div>`;
  document.body.appendChild(back);
  const input = back.querySelector('input');
  const results = back.querySelector('.results');
  let sel = 0, list = [];
  const close = () => back.remove();
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    list = A.heroes
      .filter((h) => !q || h.en.toLowerCase().includes(q) || h.ru.toLowerCase().includes(q))
      .sort((a, b) => hName(a).localeCompare(hName(b)))
      .slice(0, 12);
    sel = Math.min(sel, Math.max(0, list.length - 1));
    results.innerHTML = list.length
      ? list.map((h, i) => `<div class="res ${i === sel ? 'sel' : ''}" data-i="${i}">${heroImg(h, 'sm')}<b>${esc(hName(h))}</b><span class="muted">${esc(state.lang === 'en' ? h.ru : h.en)}</span><span class="r2">${roleName(h.type)}</span></div>`).join('')
      : '<div class="empty">Ничего не найдено</div>';
  };
  const go = (h) => { close(); location.hash = `#/hero/${h.id}`; };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && list[sel]) go(list[sel]);
    if (e.key === 'Escape') close();
  });
  results.addEventListener('click', (e) => { const r = e.target.closest('.res'); if (r) go(list[+r.dataset.i]); });
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  draw();
  input.focus();
}

/* ---------- старт ---------- */
async function start() {
  initHeader();
  initTooltips();
  watchLayout();
  watchStagger();
  initMotion(app);
  app.innerHTML = '<div class="loading"><div class="spinner"></div>Загружаем героев и предметы…</div>';
  try {
    await loadAssets();
    document.getElementById('assetsInfo').textContent = `ассеты от ${new Date(A.updated).toLocaleDateString('ru-RU')}`;
  } catch (e) {
    app.innerHTML = `<div class="error"><b>Не найден data/assets.json.</b> Запустите <code>node scripts/update-assets.mjs</code> и откройте сайт через локальный сервер.</div>`;
    return;
  }

  // Патчи нужны для «Текущий патч» и баннера — грузим параллельно с первой отрисовкой.
  const patchesReady = loadPatches()
    .then((patches) => {
      const p = latestBalancePatch(patches);
      if (!p) return;
      patchInfo.start = Math.floor(p.date.getTime() / 1000);
      patchInfo.title = p.title.replace(/^Minor Update\s*-\s*/i, '');
      patchInfo.date = p.date;
      const banner = document.getElementById('banner');
      banner.innerHTML = `Патч <b>${esc(patchInfo.title)}</b> вышел ${esc(timeAgo(p.date))} — <a href="#/patches">кто стал сильнее, а кто слабее →</a>`;
      banner.classList.remove('hidden');
    })
    .catch(() => {});

  if (state.period === 'patch') await patchesReady;
  window.addEventListener('hashchange', render);
  onState((patch) => {
    if ('badge' in patch || 'period' in patch || 'lang' in patch) {
      render();
      updateTicker();
    }
  });
  render();
  updateTicker();
}

start();
