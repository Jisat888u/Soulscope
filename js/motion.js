// Плавность интерфейса: переходы между страницами, появление блоков при прокрутке, счётчики чисел,
// «переезжающее» подчёркивание вкладок, плавная смена темы, проявление картинок, наклон карточек
// и кнопка «наверх». Всё отключается при системной настройке «уменьшить движение».

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- переход между страницами ---------- */
/** Плавно гасит текущую страницу перед показом новой. Вызывающий снимает класс сам. */
export async function leaveView(app) {
  if (reduced() || !app.firstElementChild || app.querySelector(':scope > .loading')) return;
  app.classList.add('view-leave');
  await wait(170);
}

/* ---------- подчёркивание активной вкладки ---------- */
let ink, inkReady = false;
export function moveTabInk() {
  const nav = document.getElementById('tabs');
  const active = nav?.querySelector('a.active');
  if (!ink || !active) return ink && (ink.style.opacity = '0');
  ink.style.opacity = '1';
  ink.style.width = active.offsetWidth - 24 + 'px';
  ink.style.transform = `translateX(${active.offsetLeft + 12}px)`;
  if (!inkReady) requestAnimationFrame(() => { inkReady = true; ink.classList.add('ready'); });
}
function initTabInk() {
  const nav = document.getElementById('tabs');
  if (!nav) return;
  ink = document.createElement('span');
  ink.className = 'tab-ink';
  nav.appendChild(ink);
  nav.classList.add('has-ink');
  new ResizeObserver(moveTabInk).observe(nav);
  document.fonts?.ready.then(moveTabInk);
}

/* ---------- плавная смена темы ---------- */
export function themeTransition(apply) {
  if (reduced()) return apply();
  if (document.startViewTransition) {
    // при быстрых повторных кликах браузер пропускает незавершённый переход — это не ошибка
    const t = document.startViewTransition(apply);
    [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p.catch(() => {}));
    return t;
  }
  const root = document.documentElement;
  root.classList.add('theme-anim');
  apply();
  setTimeout(() => root.classList.remove('theme-anim'), 450);
}

/* ---------- появление при прокрутке ---------- */
// Блоки ниже первого экрана ждут, пока до них докрутят; анимации внутри (строки, столбцы) стоят на паузе.
const revealIO = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('revealed');
        revealIO.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -6% 0px' })
  : null;
function prepareReveal(el) {
  if (!revealIO || reduced() || el.nodeType !== 1 || el.classList.contains('loading')) return;
  if (el.getBoundingClientRect().top < innerHeight * 0.92) return; // уже на экране — обычная анимация появления
  el.classList.add('pre-reveal');
  revealIO.observe(el);
}

/* ---------- счётчики чисел ---------- */
const COUNT_SEL = '.kpi .v, .stat-chips b, .duo-stats .v, .rk-hero, .rk-val b, .patch-card .v';
const NUM_RE = /^(\D*?)(\d+(?:\.\d+)?)(\s?[%KM]?)$/;
const countIO = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        countIO.unobserve(e.target);
        runCount(e.target);
      }
    })
  : null;
function prepareCount(el) {
  if (!countIO || reduced() || el.firstElementChild || el.dataset.counted) return;
  const m = NUM_RE.exec(el.textContent.trim());
  if (!m || +m[2] === 0) return;
  el.dataset.counted = '1';
  el.dataset.target = el.textContent.trim();
  countIO.observe(el);
}
function runCount(el) {
  const [, pre, num, suf] = NUM_RE.exec(el.dataset.target) || [];
  if (num == null) return;
  const to = +num, dec = (num.split('.')[1] || '').length, t0 = performance.now(), dur = 850;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = `${pre}${(to * eased).toFixed(dec)}${suf}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
    else el.textContent = el.dataset.target;
  };
  requestAnimationFrame(tick);
}

/* ---------- проявление картинок ---------- */
function prepareImg(img) {
  if (img.complete && img.naturalWidth) return;
  img.classList.add('img-pending');
  const done = () => { img.classList.remove('img-pending'); img.classList.add('img-in'); };
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
}

/* ---------- наклон карточек героев ---------- */
function initTilt() {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.hcard');
    if (!card || reduced() || e.pointerType !== 'mouse') return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
    card.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
  });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.hcard');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    }
  });
}

/* ---------- кнопка «наверх» ---------- */
function initToTop() {
  const btn = document.createElement('button');
  btn.className = 'to-top';
  btn.title = document.documentElement.lang === 'en' ? 'Back to top' : 'Наверх';
  btn.setAttribute('aria-label', btn.title);
  btn.dataset.tTitle = 'toTop'; // перевод при смене языка — в app.js
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 15l6-6 6 6"/></svg>';
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }));
  document.body.appendChild(btn);
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { btn.classList.toggle('show', scrollY > 700); ticking = false; });
  }, { passive: true });
}

/* ---------- запуск ---------- */
export function initMotion(app) {
  initTabInk();
  initTilt();
  initToTop();
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (m.target === app) prepareReveal(node);
        if (node.matches(COUNT_SEL)) prepareCount(node);
        node.querySelectorAll(COUNT_SEL).forEach(prepareCount);
        if (node.tagName === 'IMG') prepareImg(node);
        node.querySelectorAll('img').forEach(prepareImg);
      }
    }
  }).observe(app, { childList: true, subtree: true });
}
