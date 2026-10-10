// Список активных героев: поиск, фильтр по роли, карточки с тиром и винрейтом.
import { A, getMeta, filterBar, bindFilterBar, loading, esc, pct, hName, tierBadge, wrClass, roleName } from '../core.js';
import { ROLES, ROLE_ORDER } from '../knowledge.js';

const view = { role: 'all', q: '', sort: 'rating' };

export async function render(root, { alive }) {
  root.innerHTML = filterBar() + loading();
  bindFilterBar(root);
  let meta = null;
  try { meta = await getMeta(); } catch { /* карточки покажем и без статистики */ }
  if (!alive()) return;

  root.innerHTML = `
    ${filterBar()}
    <section class="section">
      <div class="sec-head bare">
        <div><div class="eyebrow">${A.heroes.length} активных героев</div><h2>Герои и актуальные билды</h2>
          <div class="sub">Откройте героя: сборка по фазам игры из реальных матчей, ситуативные предметы, порядок прокачки и матчапы.</div></div>
        <div class="row">
          <input type="search" id="hq" placeholder="Поиск героя…" value="${esc(view.q)}" />
          <select id="hsort">
            <option value="rating">По рейтингу</option><option value="wr">По винрейту</option><option value="pick">По популярности</option><option value="name">По имени</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-bottom:14px">${[['all', 'Все роли', 'var(--accent)'], ...ROLE_ORDER.map((r) => [r, ROLES[r].ru, ROLES[r].color])]
        .map(([v, l, c]) => `<button class="chip ${view.role === v ? 'on' : ''}" data-role="${v}"><span class="dot" style="background:${c}"></span>${l}</button>`)
        .join('')}</div>
      <div class="hero-grid" id="hgrid"></div>
    </section>`;
  bindFilterBar(root);
  root.querySelector('#hsort').value = view.sort;

  const draw = () => {
    const q = view.q.trim().toLowerCase();
    const list = A.heroes
      .filter((h) => view.role === 'all' || h.type === view.role)
      .filter((h) => !q || h.en.toLowerCase().includes(q) || h.ru.toLowerCase().includes(q))
      .map((h) => ({ h, m: meta?.byId.get(h.id) }))
      .sort((a, b) => {
        if (view.sort === 'name') return hName(a.h).localeCompare(hName(b.h));
        const k = view.sort;
        return (b.m?.[k] ?? -1) - (a.m?.[k] ?? -1);
      });
    root.querySelector('#hgrid').innerHTML =
      list
        .map(
          ({ h, m }) => `<a class="hcard" href="#/hero/${h.id}">
            <img class="art" src="${esc(h.img.vert || h.img.card || h.img.sm)}" alt="" loading="lazy" />
            <div class="shade"></div>
            <span class="type-dot">${roleName(h.type)}</span>
            ${m ? tierBadge(m.tier) : ''}
            <div class="info"><div class="nm">${esc(hName(h))}</div>
              <div class="meta"><span>${m ? `WR <b class="${wrClass(m.wr)}">${pct(m.wr)}</b>` : '—'}</span><span>${m ? `пик ${pct(m.pick, 0)}` : ''}</span></div></div>
          </a>`,
        )
        .join('') || '<div class="empty">Герои не найдены</div>';
  };
  draw();

  root.querySelector('#hq').addEventListener('input', (e) => { view.q = e.target.value; draw(); });
  root.querySelector('#hsort').addEventListener('change', (e) => { view.sort = e.target.value; draw(); });
  root.querySelectorAll('[data-role]').forEach((b) =>
    b.addEventListener('click', () => {
      view.role = b.dataset.role;
      root.querySelectorAll('[data-role]').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    }),
  );
}
