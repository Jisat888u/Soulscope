// Контр-предметы: выбираете вражеских героев (и опционально своего) — получаете,
// что собирать: по профилю угроз состава и по статистике (рост винрейта предмета против этих героев).
import { api } from '../api.js';
import { A, state, L, rolesName, hero, filterBar, bindFilterBar, loading, errorBox, esc, pct, fmtNum, hName, heroImg, itemCard, itemReason, statParams, ensureHeroes } from '../core.js';
import { THREATS, HERO_THREATS, ROLES, ROLE_ORDER } from '../knowledge.js';

const sel = { enemies: [], mine: null, mode: 'enemy', role: 'all', q: '' };

function readQuery(query) {
  // без параметров (переход из меню) оставляем прошлый выбор; со ссылкой — берём состав из неё
  if (!query.has('e') && !query.has('me')) return;
  sel.enemies = [...new Set((query.get('e') || '').split(',').map(Number).filter((x) => x > 0))].slice(0, 6);
  sel.mine = +query.get('me') || null;
}
function writeQuery() {
  const q = new URLSearchParams();
  if (sel.enemies.length) q.set('e', sel.enemies.join(','));
  if (sel.mine) q.set('me', sel.mine);
  history.replaceState(null, '', '#/counters' + (q.toString() ? '?' + q : ''));
}

export async function render(root, { query, alive }) {
  readQuery(query);
  await ensureHeroes([...sel.enemies, sel.mine].filter(Boolean));
  if (!alive()) return;

  root.innerHTML = `
    ${filterBar()}
    <section class="section grid-2" style="grid-template-columns: minmax(0,1fr) minmax(0,1.25fr); align-items:start">
      <div class="panel pad">
        <div class="eyebrow">${L('Шаг 1 · соберите состав', 'Step 1 · build the lineup')}</div>
        <h2>${L('Против кого играем?', 'Who are we playing against?')}</h2>
        <div class="sub">${L('Выберите до 6 вражеских героев. Свой герой — по желанию: статистика станет точнее под вашу роль.', 'Pick up to 6 enemy heroes. Your own hero is optional: it makes the stats more precise for your role.')}</div>
        <div style="margin-top:16px" class="row">
          <div><div class="team-label sapphire">◆ ${L('Ваш герой', 'Your hero')}</div><div class="slots" id="mySlot"></div></div>
          <div><div class="team-label amber">◆ ${L('Вражеская команда', 'Enemy team')}</div><div class="slots" id="enemySlots"></div></div>
        </div>
        <div class="row" style="margin-top:16px">
          <div class="seg"><button data-mode="enemy" class="${sel.mode === 'enemy' ? 'on' : ''}">${L('Выбираю врагов', 'Picking enemies')}</button><button data-mode="mine" class="${sel.mode === 'mine' ? 'on' : ''}">${L('Выбираю себя', 'Picking myself')}</button></div>
          <span class="spacer"></span>
          <button class="btn" id="clearBtn">${L('Сбросить', 'Reset')}</button>
        </div>
        <div class="row" style="margin:14px 0 10px">
          <input type="search" id="pq" placeholder="${L('Поиск…', 'Search…')}" style="flex:1;min-width:120px" />
          ${[['all', L('Все', 'All')], ...ROLE_ORDER.map((r) => [r, rolesName(r)])].map(([v, l]) => `<button class="chip ${sel.role === v ? 'on' : ''}" data-prole="${v}">${l}</button>`).join('')}
        </div>
        <div class="picker" id="picker"></div>
      </div>
      <div id="results"></div>
    </section>`;
  bindFilterBar(root);

  const drawSlots = () => {
    const slot = (id, cls, i) =>
      id
        ? `<div class="slotbox filled ${cls}" data-remove="${cls === 'mine' ? 'mine' : i}" title="${L('Убрать', 'Remove')}">${heroImg(hero(id))}<span class="x">✕</span></div>`
        : `<div class="slotbox ${cls}">+</div>`;
    root.querySelector('#mySlot').innerHTML = slot(sel.mine, 'mine');
    root.querySelector('#enemySlots').innerHTML = Array.from({ length: 6 }, (_, i) => slot(sel.enemies[i], '', i)).join('');
    root.querySelectorAll('.slotbox .hicon').forEach((i) => (i.style.cssText = 'width:100%;height:100%;border:0;border-radius:0'));
  };
  const drawPicker = () => {
    const q = sel.q.toLowerCase();
    root.querySelector('#picker').innerHTML = A.heroes
      .filter((h) => (sel.role === 'all' || h.type === sel.role) && (!q || h.en.toLowerCase().includes(q) || h.ru.toLowerCase().includes(q)))
      .sort((a, b) => hName(a).localeCompare(hName(b)))
      .map((h) => {
        const on = sel.enemies.includes(h.id), mine = sel.mine === h.id;
        return `<button class="pick ${on ? 'on' : ''} ${mine ? 'mine' : ''} ${(sel.mode === 'enemy' && sel.enemies.length >= 6 && !on) ? 'dim' : ''}" data-pick="${h.id}" title="${esc(hName(h))}">
          <img src="${esc(h.img.sm || h.img.card)}" alt="" loading="lazy" /><span class="lbl">${esc(hName(h))}</span></button>`;
      })
      .join('');
  };
  const update = () => {
    writeQuery();
    drawSlots();
    drawPicker();
    renderResults(root.querySelector('#results'), alive);
  };

  // слушатель вешаем на секцию, а не на #app — она пересоздаётся при каждой отрисовке
  root.querySelector('section.grid-2').addEventListener('click', (e) => {
    const p = e.target.closest('[data-pick]');
    if (p) {
      const id = +p.dataset.pick;
      if (sel.mode === 'mine') {
        sel.mine = sel.mine === id ? null : id;
        sel.enemies = sel.enemies.filter((x) => x !== id);
      } else if (sel.enemies.includes(id)) sel.enemies = sel.enemies.filter((x) => x !== id);
      else if (sel.enemies.length < 6) {
        sel.enemies.push(id);
        if (sel.mine === id) sel.mine = null;
      }
      return update();
    }
    const r = e.target.closest('[data-remove]');
    if (r) {
      if (r.dataset.remove === 'mine') sel.mine = null;
      else sel.enemies.splice(+r.dataset.remove, 1);
      return update();
    }
    const m = e.target.closest('[data-mode]');
    if (m) {
      sel.mode = m.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b === m));
      return drawPicker();
    }
    const pr = e.target.closest('[data-prole]');
    if (pr) {
      sel.role = pr.dataset.prole;
      root.querySelectorAll('[data-prole]').forEach((b) => b.classList.toggle('on', b === pr));
      return drawPicker();
    }
    if (e.target.closest('#clearBtn')) {
      sel.enemies = [];
      sel.mine = null;
      return update();
    }
  });
  root.querySelector('#pq').addEventListener('input', (e) => { sel.q = e.target.value; drawPicker(); });
  update();
}

let resultsToken = 0;
async function renderResults(el, alive) {
  const token = ++resultsToken;
  const live = () => alive() && token === resultsToken;
  if (!sel.enemies.length) {
    el.innerHTML = L(
      `<div class="panel pad"><div class="eyebrow">Шаг 2</div><h2>Рекомендации появятся здесь</h2>
      <p class="prose">Добавьте хотя бы одного вражеского героя. Мы покажем:</p>
      <ul class="prose"><li><b>профиль угроз</b> состава — хил, спирит-бёрст, контроль, мобильность и т. д.;</li>
      <li><b>контр-предметы</b> под каждую угрозу с объяснением, зачем они нужны;</li>
      <li><b>предметы по статистике</b> — у каких покупок винрейт растёт именно против этих героев.</li></ul></div>`,
      `<div class="panel pad"><div class="eyebrow">Step 2</div><h2>Recommendations will appear here</h2>
      <p class="prose">Add at least one enemy hero. We’ll show:</p>
      <ul class="prose"><li>the lineup’s <b>threat profile</b> — healing, spirit burst, crowd control, mobility and so on;</li>
      <li><b>counter items</b> for each threat, with an explanation of why they help;</li>
      <li><b>items by statistics</b> — which purchases gain win rate specifically against these heroes.</li></ul></div>`,
    );
    return;
  }

  // 1. Профиль угроз (мгновенно, без API)
  const threatMap = new Map();
  for (const id of sel.enemies) {
    (HERO_THREATS[id] || []).forEach((t, i) => {
      const v = threatMap.get(t) || { key: t, heroes: [], weight: 0 };
      v.heroes.push(id);
      v.weight += 1 - i * 0.15; // первая угроза героя — основная
      threatMap.set(t, v);
    });
  }
  const threats = [...threatMap.values()].sort((a, b) => b.weight - a.weight);

  el.innerHTML = `<div class="panel">
      <div class="sec-head"><div><div class="eyebrow">${L('Шаг 2 · анализ состава', 'Step 2 · lineup analysis')}</div><h2>${L('Угрозы вражеской команды', 'Enemy team threats')}</h2></div></div>
      <div style="padding:0 20px 16px" class="threats">${threats
        .map(
          (t) => `<div class="threat" data-tip="${esc(L(THREATS[t.key].why, THREATS[t.key].whyEn))}"><div class="lvl">${Array.from({ length: 6 }, (_, i) => `<i class="${i < t.heroes.length ? 'on' : ''}"></i>`).join('')}</div>
            <div><b>${L(THREATS[t.key].short, THREATS[t.key].shortEn)}</b><div class="who">${t.heroes.map((id) => heroImg(hero(id), 'sm')).join('')}</div></div></div>`,
        )
        .join('')}</div>
      <div id="recs">${loading(L('Сравниваем винрейт предметов против выбранных героев…', 'Comparing item win rates against the selected heroes…'))}</div>
    </div>`;
  el.querySelectorAll('.who .hicon').forEach((i) => (i.style.cssText = 'width:20px;height:20px;border-radius:4px'));

  // 2. Статистика: винрейт предмета против каждого врага vs базовый
  let deltas;
  try {
    const base = statParams({ hero_id: sel.mine || undefined });
    const [baseline, ...perEnemy] = await Promise.all([
      api('/v1/analytics/item-stats', base),
      ...sel.enemies.map((e) => api('/v1/analytics/item-stats', { ...base, enemy_hero_ids: e })),
    ]);
    const minM = sel.mine ? 40 : 300;
    const baseMap = new Map(baseline.filter((r) => r.matches >= minM).map((r) => [r.item_id, r]));
    deltas = new Map();
    perEnemy.forEach((rows) => {
      // Против сильного героя винрейт ниже у всех предметов — вычитаем этот общий сдвиг,
      // чтобы осталось только то, насколько предмет лучше других именно против него.
      let wv = 0, mv = 0, wb = 0, mb = 0;
      for (const r of rows) {
        const b = baseMap.get(r.item_id);
        if (!b) continue;
        wv += r.wins; mv += r.matches; wb += b.wins; mb += b.matches;
      }
      const shift = mv && mb ? wv / mv - wb / mb : 0;
      for (const r of rows) {
        const b = baseMap.get(r.item_id);
        if (!b || r.matches < minM || !A.itemById.has(r.item_id)) continue;
        const d = r.wins / r.matches - b.wins / b.matches - shift;
        const v = deltas.get(r.item_id) || { sum: 0, n: 0, matches: 0, wins: 0 };
        v.sum += d;
        v.n++;
        v.matches += r.matches;
        v.wins += r.wins;
        deltas.set(r.item_id, v);
      }
    });
  } catch (e) {
    if (live()) el.querySelector('#recs').innerHTML = `<div style="padding:0 20px 20px">${errorBox(e)}</div>`;
    return;
  }
  if (!live()) return;

  const dOf = (itemId) => {
    const v = deltas.get(itemId);
    return v && v.n ? v.sum / v.n : null;
  };
  const deltaRight = (d, v) =>
    d == null
      ? `<span class="muted">—</span><small>${L('мало данных', 'too little data')}</small>`
      : `<span class="${d > 0.003 ? 'good' : d < -0.003 ? 'bad' : ''}">${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}</span><small>WR ${pct(v.wins / v.matches)}</small>`;

  // рекомендации по угрозам — сортируем предметы внутри группы по статистике
  const used = new Set();
  const groups = threats.slice(0, 4).map((t) => {
    const def = THREATS[t.key];
    const items = def.items
      .map((cls) => A.itemByCls.get(cls))
      .filter(Boolean)
      .map((it) => ({ it, d: dOf(it.id), v: deltas.get(it.id) }))
      .sort((a, b) => (b.d ?? -1) - (a.d ?? -1))
      .slice(0, 4);
    items.forEach((x) => used.add(x.it.id));
    const names = t.heroes.map((id) => esc(hName(hero(id)))).join(', ');
    return `<div class="rec-group"><h3>${L(def.ru, def.en)} <span class="pill neutral" style="font-size:11px">${t.heroes.length} ${L('из', 'of')} ${sel.enemies.length}</span></h3>
      <p>${esc(L(def.why, def.whyEn))} <span class="muted">${L('Источник угрозы', 'Threat source')}: ${names}.</span></p>
      <div class="item-grid">${items.map((x) => itemCard(x.it, { sub: `${fmtNum(x.it.cost)} ${L('душ', 'souls')} · ${L('тир', 'tier')} ${x.it.tier}`, right: deltaRight(x.d, x.v) })).join('')}</div></div>`;
  });

  const stat = [...deltas.entries()]
    .map(([id, v]) => ({ it: A.itemById.get(id), d: v.sum / v.n, v }))
    .filter((x) => x.v.n >= Math.ceil(sel.enemies.length / 2) && x.d > 0.004)
    .sort((a, b) => b.d - a.d)
    .slice(0, 12);

  el.querySelector('#recs').innerHTML = `
    <div class="rec-group" style="background:color-mix(in srgb,var(--accent) 5%,transparent)">
      <div class="eyebrow">${L('Шаг 3 · что собирать', 'Step 3 · what to build')}</div>
      <p style="margin-top:6px">${L(
        `Справа у предмета — <b>эффективность против состава</b>: на сколько процентных пунктов предмет выигрывает чаще против этих героев, чем обычно, с поправкой на общую силу врагов${sel.mine ? ` (только матчи на ${esc(hName(hero(sel.mine)))})` : ''}. Ниже — фактический винрейт с предметом.`,
        `On the right of each item is its <b>effectiveness against the lineup</b>: how many percentage points more often the item wins against these heroes than usual, adjusted for the enemies’ overall strength${sel.mine ? ` (only matches on ${esc(hName(hero(sel.mine)))})` : ''}. Below it — the actual win rate with the item.`,
      )}</p>
    </div>
    ${groups.join('')}
    <div class="rec-group"><h3>${L('По статистике матчей', 'By match statistics')}</h3>
      <p>${L('Предметы, которые сильнее всего поднимают винрейт именно против этого состава — даже если они не «классический» контр-пик.', 'Items that raise win rate the most against this specific lineup — even if they aren’t a "classic" counter.')}</p>
      <div class="item-grid">${stat.map((x) => itemCard(x.it, { reason: used.has(x.it.id) ? '' : itemReason(x.it), sub: `${fmtNum(x.it.cost)} ${L('душ', 'souls')}`, right: deltaRight(x.d, x.v) })).join('') || `<div class="muted">${L('Недостаточно данных — попробуйте расширить период или ранг.', 'Not enough data — try widening the period or rank.')}</div>`}</div>
    </div>`;
}
