// Главная: приветствие, мета по ролям (как колонки позиций у D2PT), последний патч, топ связок.
import { L, tx, rolesName, sampleWarning, getMeta, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroImg, heroLink, tierBadge, wrClass, patchInfo, periodLabel, rankLabel, timeAgo, hero, statParams, ensureHeroes } from '../core.js';
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
      <div class="role-col-head"><b><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${ROLES[type].color}"></span>${rolesName(type)}</b><small>${L('матчи · WR · тир', 'matches · WR · tier')}</small></div>
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
        <div class="eyebrow">${L('Deadlock · аналитика матчей', 'Deadlock · match analytics')}</div>
        <h1 style="margin-top:8px">${L('Добро пожаловать в SoulScope', 'Welcome to SoulScope')}</h1>
        <p>${L('SoulScope собирает статистику публичных матчей и превращает её в понятные решения: кого пикать, что собирать против конкретного состава, что поменял последний патч и с кем выходить на линию.', 'SoulScope collects public match statistics and turns them into clear decisions: who to pick, what to build against a specific lineup, what the latest patch changed and who to lane with.')}</p>
        <div class="stat-chips">
          <span>${L('Проанализировано', 'Analyzed')} <b>${fmtNum(meta.totalMatches)}</b> ${L('матчей', 'matches')} · ${esc(periodLabel())} · ${esc(rankLabel())}</span>
          ${best ? `<span>${L('Лучший WR', 'Best WR')}: ${heroImg(best.hero, 'sm')}<b>${esc(hName(best.hero))}</b> <span class="good">${pct(best.wr)}</span></span>` : ''}
          ${popular ? `<span>${L('Самый популярный', 'Most popular')}: ${heroImg(popular.hero, 'sm')}<b>${esc(hName(popular.hero))}</b> ${pct(popular.pick, 0)} ${L('матчей', 'of matches')}</span>` : ''}
          ${riser ? `<span>${L('Растёт', 'Rising')}: ${heroImg(riser.hero, 'sm')}<b>${esc(hName(riser.hero))}</b> <span class="good">+${(riser.dwr * 100).toFixed(1)}</span></span>` : ''}
        </div>
      </div>
      <a class="patch-card" href="#/patches">
        <div class="k">${L('Текущий патч', 'Current patch')}</div>
        <div class="v">${esc(patchInfo.title || '—')}</div>
        <div class="ago">${patchInfo.date ? esc(timeAgo(patchInfo.date)) : L('загрузка…', 'loading…')}</div>
      </a>
    </section>

    <section class="section panel">
      <div class="sec-head">
        <div><div class="eyebrow">${L('Мета', 'Meta')} · ${esc(periodLabel())}</div><h2>${L('Сильнейшие герои по ролям', 'Strongest heroes by role')}</h2><div class="sub">${L('Рейтинг учитывает винрейт (сглаженный по объёму матчей) и популярность.', 'The rating combines win rate (smoothed by sample size) and popularity.')}</div></div>
        <a class="btn" href="#/tier">${L('Полный тир-лист →', 'Full tier list →')}</a>
      </div>
      <div class="role-cols">${ROLE_ORDER.map(roleCol).join('')}</div>
    </section>

    <section class="section grid-2">
      <div class="panel" id="homePatch">${loading(L('Читаем патчноуты…', 'Reading patch notes…'))}</div>
      <div class="panel" id="homeDuos">${loading(L('Считаем связки…', 'Counting duos…'))}</div>
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
            <div class="row" style="margin-top:8px">${list.map((h) => `<a href="#/hero/${h.id}" data-tip="${esc(hName(hero(h.id)))}: ${esc(tx(h.tldr))}">${heroImg(hero(h.id))}</a>`).join('')}</div></div>`
        : '';
    el.innerHTML = `<div class="sec-head"><div><div class="eyebrow">${L('Патч-трекер', 'Patch tracker')}</div><h2>${esc(p.title)}</h2><div class="sub">${esc(timeAgo(p.date))}</div></div><a class="btn" href="#/patches">${L('Все изменения →', 'All changes →')}</a></div>
      <div style="padding:0 20px 18px">
        ${p.curated ? `<p class="prose" style="margin:0">${esc(L(p.curated.tldr, p.curated.tldrEn || p.curated.tldr))}</p>` : ''}
        ${group(L('Баффы', 'Buffs'), buffs, 'buff')}${group(L('Нерфы', 'Nerfs'), nerfs, 'nerf')}${group(L('Смешанные', 'Mixed'), mixed, 'mixed')}
        ${!p.heroes.length && !p.curated ? `<div class="muted">${L('В этом патче нет правок героев.', 'This patch has no hero changes.')}</div>` : ''}
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
    el.innerHTML = `<div class="sec-head"><div><div class="eyebrow">${L('Линия', 'Lane')}</div><h2>${L('Лучшие связки на линии', 'Best lane duos')}</h2><div class="sub">${L(`Пары союзников на одной линии, мин. ${fmtNum(minM)} матчей`, `Allied pairs in the same lane, min. ${fmtNum(minM)} matches`)}</div></div><a class="btn" href="#/duos">${L('Все связки →', 'All duos →')}</a></div>
      <div class="mu-list" style="border-top:1px solid var(--line)">
        ${top
          .map(
            (r) => `<div class="mu"><div class="pair-cell">${heroLink(hero(r.hero_id1), { cls: 'sm' })}<span class="plus">+</span>${heroLink(hero(r.hero_id2), { cls: 'sm' })}</div>
              <span class="m num">${fmtNum(r.matches_played)} ${L('игр', 'games')}</span><b class="num good">${pct(r.wr)}</b></div>`,
          )
          .join('') || `<div class="empty">${L('Недостаточно данных', 'Not enough data')}</div>`}
      </div>`;
  } catch (e) {
    if (alive()) el.innerHTML = `<div class="pad">${errorBox(e)}</div>`;
  }
}
