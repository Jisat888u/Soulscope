// Главная: приветствие, мета по ролям (как колонки позиций у D2PT), последний патч, топ связок.
import { sampleWarning, getMeta, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroImg, heroLink, tierBadge, wrClass, patchInfo, periodLabel, rankLabel, timeAgo, hero, statParams, ensureHeroes } from '../core.js';
import { ROLES, ROLE_ORDER } from '../knowledge.js';
import { loadPatches, latestBalancePatch } from '../patches.js';
import { api } from '../api.js';

export async function render(root, { alive }) {
  root.innerHTML = filterBar() + loading();
  bindFilterBar(root);
  let meta;
  try {
    meta = await getMeta();
  } catch (e) {
    if (alive()) root.innerHTML = filterBar() + errorBox(e);
    bindFilterBar(root);
    return;
  }
  if (!alive()) return;

  const best = [...meta.list].sort((a, b) => b.wr - a.wr)[0];
  const popular = [...meta.list].sort((a, b) => b.pick - a.pick)[0];
  const riser = [...meta.list].filter((x) => x.dwr != null).sort((a, b) => b.dwr - a.dwr)[0];

  const roleCol = (type) => {
    const list = meta.list.filter((x) => x.hero.type === type).slice(0, 6);
    return `<div class="role-col">
      <div class="role-col-head"><b><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${ROLES[type].color}"></span>${ROLES[type].ru}</b><small>матчи · WR · тир</small></div>
      ${list
        .map(
          (x, i) => `<a class="mini-row" href="#/hero/${x.id}">
            <span class="rank">${i + 1}</span>${heroImg(x.hero)}
            <span style="min-width:0"><div class="hname" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(hName(x.hero))}</div>
              <div class="meta"><span>${fmtNum(x.matches)}</span><span class="${wrClass(x.wr)}">${pct(x.wr)}</span></div></span>
            <span class="right">${tierBadge(x.tier)}<span class="muted num" style="font-size:11px">${x.rating}/100</span></span>
            <span class="bar"><i style="width:${x.rating}%"></i></span>
          </a>`,
        )
        .join('')}
    </div>`;
  };

  root.innerHTML = `
    ${filterBar()}
    ${sampleWarning(meta)}
    <section class="section panel hero-panel">
      <div style="z-index:1">
        <div class="eyebrow">Deadlock · аналитика матчей</div>
        <h1 style="margin-top:8px">Добро пожаловать в dlck.trck</h1>
        <p>Deadlock Tracker собирает статистику публичных матчей и превращает её в понятные решения: кого пикать, что собирать против конкретного состава, что поменял последний патч и с кем выходить на линию.</p>
        <div class="stat-chips">
          <span>Проанализировано <b>${fmtNum(meta.totalMatches)}</b> матчей · ${esc(periodLabel())} · ${esc(rankLabel())}</span>
          ${best ? `<span>Лучший WR: ${heroImg(best.hero, 'sm')}<b>${esc(hName(best.hero))}</b> <span class="good">${pct(best.wr)}</span></span>` : ''}
          ${popular ? `<span>Самый популярный: ${heroImg(popular.hero, 'sm')}<b>${esc(hName(popular.hero))}</b> ${pct(popular.pick, 0)} матчей</span>` : ''}
          ${riser ? `<span>Растёт: ${heroImg(riser.hero, 'sm')}<b>${esc(hName(riser.hero))}</b> <span class="good">+${(riser.dwr * 100).toFixed(1)}</span></span>` : ''}
        </div>
      </div>
      <a class="patch-card" href="#/patches">
        <div class="k">Текущий патч</div>
        <div class="v">${esc(patchInfo.title || '—')}</div>
        <div class="ago">${patchInfo.date ? esc(timeAgo(patchInfo.date)) : 'загрузка…'}</div>
      </a>
    </section>

    <section class="section panel">
      <div class="sec-head">
        <div><div class="eyebrow">Мета · ${esc(periodLabel())}</div><h2>Сильнейшие герои по ролям</h2><div class="sub">Рейтинг учитывает винрейт (сглаженный по объёму матчей) и популярность.</div></div>
        <a class="btn" href="#/tier">Полный тир-лист →</a>
      </div>
      <div class="role-cols">${ROLE_ORDER.map(roleCol).join('')}</div>
    </section>

    <section class="section grid-2">
      <div class="panel" id="homePatch">${loading('Читаем патчноуты…')}</div>
      <div class="panel" id="homeDuos">${loading('Считаем связки…')}</div>
    </section>
  `;
  bindFilterBar(root);
  renderPatchTeaser(root.querySelector('#homePatch'), alive);
  renderDuoTeaser(root.querySelector('#homeDuos'), alive, meta);
}

async function renderPatchTeaser(el, alive) {
  try {
    const patches = await loadPatches();
    const p = latestBalancePatch(patches);
    if (!alive() || !p) return;
    const buffs = p.heroes.filter((h) => h.verdict.key === 'buff');
    const nerfs = p.heroes.filter((h) => h.verdict.key === 'nerf');
    const mixed = p.heroes.filter((h) => h.verdict.key === 'mixed' || h.verdict.key === 'neutral');
    const group = (title, list, cls) =>
      list.length
        ? `<div style="margin-top:12px"><div class="pill ${cls}" style="display:inline-block">${title} · ${list.length}</div>
            <div class="row" style="margin-top:8px">${list.map((h) => `<a href="#/hero/${h.id}" data-tip="${esc(hName(hero(h.id)))}: ${esc(h.tldr)}">${heroImg(hero(h.id))}</a>`).join('')}</div></div>`
        : '';
    el.innerHTML = `<div class="sec-head"><div><div class="eyebrow">Патч-трекер</div><h2>${esc(p.title)}</h2><div class="sub">${esc(timeAgo(p.date))}</div></div><a class="btn" href="#/patches">Все изменения →</a></div>
      <div style="padding:0 20px 18px">
        ${p.curated ? `<p class="prose" style="margin:0">${esc(p.curated.tldr)}</p>` : ''}
        ${group('Баффы', buffs, 'buff')}${group('Нерфы', nerfs, 'nerf')}${group('Смешанные', mixed, 'mixed')}
        ${!p.heroes.length && !p.curated ? '<div class="muted">В этом патче нет правок героев.</div>' : ''}
      </div>`;
  } catch (e) {
    if (alive()) el.innerHTML = `<div class="pad">${errorBox(e)}</div>`;
  }
}

async function renderDuoTeaser(el, alive, meta) {
  try {
    const rows = await api('/v1/analytics/hero-synergy-stats', statParams({ same_lane_filter: true, min_matches: 150 }));
    await ensureHeroes(rows.flatMap((r) => [r.hero_id1, r.hero_id2]));
    if (!alive()) return;
    const minM = Math.max(150, Math.round(meta.totalMatches * 0.002));
    const top = rows
      .filter((r) => r.matches_played >= minM && meta.byId.has(r.hero_id1) && meta.byId.has(r.hero_id2))
      .map((r) => ({ ...r, wr: r.wins / r.matches_played }))
      .sort((a, b) => b.wr - a.wr)
      .slice(0, 6);
    el.innerHTML = `<div class="sec-head"><div><div class="eyebrow">Линия</div><h2>Лучшие связки на линии</h2><div class="sub">Пары союзников на одной линии, мин. ${fmtNum(minM)} матчей</div></div><a class="btn" href="#/duos">Все связки →</a></div>
      <div class="mu-list" style="border-top:1px solid var(--line)">
        ${top
          .map(
            (r) => `<div class="mu"><div class="pair-cell">${heroLink(hero(r.hero_id1), { cls: 'sm' })}<span class="plus">+</span>${heroLink(hero(r.hero_id2), { cls: 'sm' })}</div>
              <span class="m num">${fmtNum(r.matches_played)} игр</span><b class="num good">${pct(r.wr)}</b></div>`,
          )
          .join('') || '<div class="empty">Недостаточно данных</div>'}
      </div>`;
  } catch (e) {
    if (alive()) el.innerHTML = `<div class="pad">${errorBox(e)}</div>`;
  }
}
