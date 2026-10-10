// Патч-трекер: список обновлений из Steam (обновляется сам), по героям — бафф/нерф,
// краткий вывод и реальное изменение винрейта до/после патча.
import { A, state, hero, loading, errorBox, esc, pct, fmtDate, timeAgo, hName, iName, heroImg, itemIcon, heroStatsWindow, rankLabel, segmented, RANKS, setState } from '../core.js';
import { loadPatches } from '../patches.js';

const view = { heroFilter: 0, onlyBalance: true, showOrig: false, open: null };
const DAY = 86400;

export async function render(root, { query, alive }) {
  if (query.get('hero')) view.heroFilter = +query.get('hero');
  root.innerHTML = loading('Читаем патчноуты…');
  let patches;
  try {
    patches = await loadPatches();
  } catch (e) {
    if (alive()) root.innerHTML = errorBox(e);
    return;
  }
  if (!alive()) return;
  if (view.open == null) view.open = patches.find((p) => p.type !== 'news')?.id;

  const heroOptions = A.heroes
    .slice()
    .sort((a, b) => hName(a).localeCompare(hName(b)))
    .map((h) => `<option value="${h.id}" ${view.heroFilter === h.id ? 'selected' : ''}>${esc(hName(h))}</option>`)
    .join('');

  root.innerHTML = `
    <div class="filterbar">
      <label>Ранг (для винрейта)</label>${segmented(RANKS, state.badge, 'badge')}
      <label>Герой</label><select id="pf"><option value="0">Все герои</option>${heroOptions}</select>
      <button class="chip ${view.onlyBalance ? 'on' : ''}" id="pb">Баланс и новые герои</button>
      <button class="chip ${view.showOrig ? 'on' : ''}" id="po">Оригинал (EN)</button>
    </div>
    <section class="section">
      <div class="sec-head bare"><div><div class="eyebrow">Обновляется автоматически из Steam</div><h2>Патч-трекер</h2>
        <div class="sub">По каждому герою: стал сильнее или слабее, что именно поменяли и как сдвинулся винрейт за неделю до и после патча (${esc(rankLabel())}).</div></div></div>
      <div id="plist"></div>
    </section>`;

  root.querySelectorAll('[data-badge]').forEach((b) => b.addEventListener('click', () => setState({ badge: +b.dataset.badge })));
  root.querySelector('#pf').addEventListener('change', (e) => { view.heroFilter = +e.target.value; draw(); });
  root.querySelector('#pb').addEventListener('click', (e) => { view.onlyBalance = !view.onlyBalance; e.target.classList.toggle('on', view.onlyBalance); draw(); });
  root.querySelector('#po').addEventListener('click', (e) => { view.showOrig = !view.showOrig; e.target.classList.toggle('on', view.showOrig); root.querySelectorAll('.changes').forEach((c) => c.classList.toggle('compact', !view.showOrig)); });

  const list = root.querySelector('#plist');
  const draw = () => {
    const shown = patches
      .filter((p) => !view.onlyBalance || p.type !== 'news' || p.curated)
      .filter((p) => !view.heroFilter || p.heroes.some((h) => h.id === view.heroFilter));
    list.innerHTML = shown.map((p) => patchHtml(p)).join('') || '<div class="empty">Нет патчей с изменениями этого героя в доступной истории.</div>';
    list.querySelectorAll('.patch.open').forEach((el) => loadImpact(el, patches.find((p) => p.id === el.dataset.id), alive));
  };
  list.addEventListener('click', (e) => {
    const head = e.target.closest('.patch-head');
    if (!head) return;
    const el = head.parentElement;
    el.classList.toggle('open');
    if (el.classList.contains('open')) loadImpact(el, patches.find((p) => p.id === el.dataset.id), alive);
  });
  draw();
}

function summaryPills(p) {
  const c = { buff: 0, nerf: 0, mixed: 0, neutral: 0 };
  p.heroes.forEach((h) => c[h.verdict.key]++);
  const pills = [];
  if (c.buff) pills.push(`<span class="pill buff">▲ ${c.buff} бафф</span>`);
  if (c.nerf) pills.push(`<span class="pill nerf">▼ ${c.nerf} нерф</span>`);
  if (c.mixed) pills.push(`<span class="pill mixed">◆ ${c.mixed} смешанно</span>`);
  if (p.items.length) pills.push(`<span class="pill neutral">${p.items.length} предм.</span>`);
  if (p.general.length) pills.push(`<span class="pill neutral">${p.general.length} общих</span>`);
  return pills.join('');
}

const changeLi = (c) => {
  const ar = c.effect === 'buff' ? '▲' : c.effect === 'nerf' ? '▼' : c.kind === 'fix' ? '✓' : '•';
  const label = c.kind !== 'num' && c.label ? `<span class="muted">${esc(c.label)}:</span> ` : '';
  const body = c.kind === 'num' ? esc(c.text) : esc(c.orig);
  return `<li class="${c.effect}"><span class="ar">${ar}</span><span>${c.ability ? `<span class="ab">${esc(c.ability)}</span> · ` : ''}${label}${body}${c.kind === 'num' ? `<span class="orig">${esc(c.orig)}</span>` : ''}</span></li>`;
};

function patchHtml(p) {
  const typeLabel = p.type === 'news' && p.curated ? 'Новый герой' : { major: 'Крупное обновление', balance: 'Баланс', news: 'Новости' }[p.type];
  const heroes = view.heroFilter ? p.heroes.filter((h) => h.id === view.heroFilter) : p.heroes;
  const open = view.open === p.id || !!view.heroFilter;
  return `<div class="panel patch ${open ? 'open' : ''}" data-id="${esc(p.id)}">
    <div class="patch-head">
      <span class="date">${fmtDate(p.date)}</span>
      <h3>${esc(p.title)}</h3>
      <span class="ptype ${p.type}">${typeLabel}</span>
      <div class="patch-sum">${summaryPills(p)}</div>
      <span class="spacer"></span>
      <span class="muted" style="font-size:12px">${esc(timeAgo(p.date))}</span>
      <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
    <div class="patch-body">
      ${p.curated ? `<div class="curated"><b>Коротко:</b> ${esc(p.curated.tldr)}<ul>${p.curated.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      ${p.type !== 'balance' && p.paragraphs.length ? `<div class="prose" style="margin-top:12px">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" style="max-height:220px" />` : ''}${p.paragraphs.slice(0, 4).map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
      ${heroes.length ? `<div class="notes-block"><h3>Герои</h3><div class="hero-changes">${heroes.map((h) => heroChangeHtml(h)).join('')}</div></div>` : ''}
      ${p.items.length && !view.heroFilter ? `<div class="notes-block"><h3>Предметы</h3><div class="hero-changes">${p.items.map(itemChangeHtml).join('')}</div></div>` : ''}
      ${p.general.length && !view.heroFilter ? `<div class="notes-block"><h3>Общие изменения</h3><ul class="changes ${view.showOrig ? '' : 'compact'} panel" style="background:var(--panel-2)">${p.general.map(changeLi).join('')}</ul></div>` : ''}
      <div class="note" style="margin-top:14px"><a href="${esc(p.link)}" target="_blank" rel="noopener">Оригинальные патчноуты в Steam ↗</a></div>
    </div>
  </div>`;
}

function heroChangeHtml(h) {
  const he = hero(h.id);
  return `<div class="hchange ${h.verdict.key}" data-hero="${h.id}">
    <div class="hchange-head">
      <a class="hero-link" href="#/hero/${h.id}">${heroImg(he)}<span class="hname">${esc(hName(he))}</span></a>
      <div class="verdict"><span class="pill ${h.verdict.key}">${esc(h.verdict.label)}</span><div class="wr" data-wr>винрейт: …</div></div>
    </div>
    <div class="tldr">${esc(h.tldr)}</div>
    <ul class="changes ${view.showOrig ? '' : 'compact'}">${h.changes.map(changeLi).join('')}</ul>
  </div>`;
}

function itemChangeHtml(i) {
  const it = A.itemById.get(i.id);
  return `<div class="hchange ${i.verdict.key}">
    <div class="hchange-head"><span class="item" style="all:unset;display:flex;gap:10px;align-items:center" data-item="${i.id}">${it ? itemIcon(it) : ''}<b>${esc(it ? iName(it) : '')}</b></span>
      <div class="verdict"><span class="pill ${i.verdict.key}">${esc(i.verdict.label)}</span></div></div>
    <div class="tldr">${esc(i.tldr)}</div>
    <ul class="changes ${view.showOrig ? '' : 'compact'}">${i.changes.map(changeLi).join('')}</ul>
  </div>`;
}

/** Подгружает винрейт героев за 7 дней до и после патча. */
async function loadImpact(el, p, alive) {
  if (!p || !p.heroes.length || el.dataset.impact) return;
  el.dataset.impact = '1';
  const t = Math.floor(p.date.getTime() / 1000 / 600) * 600;
  const now = Math.floor(Date.now() / 1000 / 600) * 600;
  const afterEnd = Math.min(t + 7 * DAY, now);
  const setAll = (fn) => el.querySelectorAll('[data-hero]').forEach((c) => (c.querySelector('[data-wr]').innerHTML = fn(+c.dataset.hero)));
  if (afterEnd - t < DAY / 2) {
    setAll(() => 'винрейт: данные копятся');
    return;
  }
  try {
    const [before, after] = await Promise.all([heroStatsWindow(t - 7 * DAY, t), heroStatsWindow(t, afterEnd)]);
    if (!alive()) return;
    const b = new Map(before.map((r) => [r.hero_id, r]));
    const a = new Map(after.map((r) => [r.hero_id, r]));
    setAll((id) => {
      const rb = b.get(id), ra = a.get(id);
      if (!ra || ra.matches < 200) return 'винрейт: мало матчей';
      const wa = ra.wins / ra.matches;
      if (!rb || rb.matches < 200) return `винрейт после: <b>${pct(wa)}</b>`;
      const wb = rb.wins / rb.matches;
      const d = (wa - wb) * 100;
      return `винрейт ${pct(wb)} → <b>${pct(wa)}</b> <span class="delta ${d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat'}">${d > 0 ? '+' : ''}${d.toFixed(1)}</span>`;
    });
  } catch {
    setAll(() => 'винрейт: API недоступно');
  }
}
