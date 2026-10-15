// Ручная экспертиза: роли, профили угроз героев, контр-предметы, словарь для патчноутов.
// Профили угроз составлены по описаниям способностей (assets API) — цифры на сайте всегда из статистики.

export const ROLES = {
  marksman: { ru: 'Стрелки', en: 'Marksmen', one: 'Стрелок', oneEn: 'Marksman', color: 'var(--weapon)' },
  mystic: { ru: 'Мистики', en: 'Mystics', one: 'Мистик', oneEn: 'Mystic', color: 'var(--spirit)' },
  brawler: { ru: 'Бойцы', en: 'Brawlers', one: 'Боец', oneEn: 'Brawler', color: 'var(--vitality)' },
  assassin: { ru: 'Ассасины', en: 'Assassins', one: 'Ассасин', oneEn: 'Assassin', color: 'var(--rust)' },
  unknown: { ru: 'Другие', en: 'Other', one: 'Герой', oneEn: 'Hero', color: 'var(--muted)' },
};
export const ROLE_ORDER = ['marksman', 'mystic', 'brawler', 'assassin'];

/** Типы угроз и предметы (class_name без upgrade_), которые их закрывают. */
export const THREATS = {
  heal: {
    en: 'Strong healing and lifesteal',
    shortEn: 'Healing',
    whyEn: 'Cut incoming healing — otherwise your damage just gets healed back.',
    ru: 'Сильный хил и вампиризм',
    short: 'Хил',
    why: 'Срежьте входящее лечение — иначе урон просто «отхиливается».',
    items: ['healbane', 'toxic_bullets', 'rupture', 'spirit_burn'],
  },
  spirit: {
    en: 'Spirit burst',
    shortEn: 'Spirit damage',
    whyEn: 'Lots of ability damage: stack spirit resist and barriers.',
    ru: 'Спирит-бёрст',
    short: 'Спирит-урон',
    why: 'Много урона способностями: стакайте сопротивление духу и барьеры.',
    items: ['spirit_bubble', 'tech_purge', 'vex_barrier', 'absorbing_armor', 'counterspell', 'self_bubble'],
  },
  gun: {
    en: 'Gun damage',
    shortEn: 'Gunners',
    whyEn: 'Most damage comes from bullets: bullet resist and disarms.',
    ru: 'Урон с оружия',
    short: 'Стрелки',
    why: 'Основной урон идёт пулями: сопротивление пулям и обезоруживание.',
    items: ['weapon_shielding', 'improved_bullet_armor', 'metal_skin', 'return_fire', 'greater_withering_whip', 'deflecting_armor'],
  },
  cc: {
    en: 'Heavy crowd control',
    shortEn: 'Crowd control',
    whyEn: 'Stuns, pulls, hexes: cleanse and shorten debuffs.',
    ru: 'Много контроля',
    short: 'Контроль',
    why: 'Оглушения, стяжки, хексы: снимайте и сокращайте дебаффы.',
    items: ['debuff_reducer', 'reduce_debuff_duration', 'auto_cleanse', 'unstoppable', 'counterspell'],
  },
  dot: {
    en: 'Damage over time',
    shortEn: 'DoT',
    whyEn: 'Burns, poisons and bleeds: cleanses and debuff resistance.',
    ru: 'Урон со временем',
    short: 'DoT',
    why: 'Поджоги, яды и кровотечения: очищение и устойчивость к дебаффам.',
    items: ['debuff_reducer', 'reduce_debuff_duration', 'vex_barrier', 'health_stimpak'],
  },
  mobile: {
    en: 'High mobility',
    shortEn: 'Mobility',
    whyEn: 'The enemy keeps escaping and diving in: slows, roots and dash denial.',
    ru: 'Высокая мобильность',
    short: 'Мобильность',
    why: 'Враг постоянно уходит и врывается: замедления, руты и запрет рывков.',
    items: ['slowing_bullets', 'containment', 'magic_slow', 'target_stun', 'aoe_root', 'cold_front'],
  },
  channel: {
    en: 'Channeled casts and ultimates',
    shortEn: 'Channels',
    whyEn: 'Interrupt ultimate wind-ups with silence or stuns.',
    ru: 'Каст и ульты с каналом',
    short: 'Каналы',
    why: 'Сбивайте подготовку ульты безмолвием или оглушением.',
    items: ['targeted_silence', 'target_stun', 'proc_silence', 'glitch'],
  },
  tank: {
    en: 'High-HP tanks',
    shortEn: 'Tanks',
    whyEn: 'Percent damage and resist shred break through tanky heroes.',
    ru: 'Танки с большим HP',
    short: 'Танки',
    why: 'Процентный урон и снижение сопротивлений пробивают толстяков.',
    items: ['magic_shock', 'aprounds', 'escalating_exposure', 'bullet_resist_shredder', 'tech_defense_shredders'],
  },
  melee: {
    en: 'Melee',
    shortEn: 'Melee',
    whyEn: 'Keep your distance and punish melee hits.',
    ru: 'Ближний бой',
    short: 'Мили',
    why: 'Держите дистанцию и наказывайте ближние удары.',
    items: ['melee_rebuttal', 'containment', 'slowing_bullets', 'metal_skin'],
  },
  summons: {
    en: 'Summons and zones',
    shortEn: 'Summons',
    whyEn: 'Minions, turrets and zones: area damage clears them faster.',
    ru: 'Призывы и зоны',
    short: 'Призывы',
    why: 'Миньоны, турели и зоны: урон по площади зачищает их быстрее.',
    items: ['non_player_bonus', 'chain_lightning', 'tech_damage_pulse', 'split_shot'],
  },
};

export const HERO_THREATS = {
  1: ['spirit', 'dot', 'mobile'], // Infernus
  2: ['spirit', 'channel', 'cc'], // Seven
  3: ['gun', 'mobile'], // Vindicta
  4: ['heal', 'spirit'], // Lady Geist
  6: ['tank', 'heal', 'melee', 'cc'], // Abrams
  7: ['gun', 'cc', 'mobile'], // Wraith
  8: ['summons', 'heal', 'gun'], // McGinnis
  10: ['cc', 'gun', 'spirit'], // Paradox
  11: ['channel', 'heal', 'cc'], // Dynamo
  12: ['heal', 'tank', 'mobile'], // Kelvin
  13: ['gun', 'channel', 'mobile'], // Haze
  14: ['gun', 'mobile', 'cc'], // Holliday
  15: ['cc', 'channel', 'spirit'], // Bebop
  16: ['spirit', 'mobile', 'melee'], // Calico
  17: ['gun', 'spirit'], // Grey Talon
  18: ['tank', 'channel', 'heal', 'cc'], // Mo & Krill
  19: ['melee', 'mobile', 'dot', 'gun'], // Shiv
  20: ['heal', 'cc', 'spirit'], // Ivy
  25: ['tank', 'gun', 'cc', 'channel'], // Warden
  27: ['melee', 'mobile', 'heal'], // Yamato
  31: ['mobile', 'cc', 'channel', 'melee'], // Lash
  35: ['cc', 'heal', 'spirit'], // Viscous
  50: ['spirit', 'mobile', 'dot', 'channel'], // Pocket
  52: ['gun', 'heal', 'cc'], // Mirage
  58: ['gun', 'dot', 'mobile', 'cc'], // Vyper
  60: ['spirit', 'cc'], // Sinclair
  63: ['spirit', 'mobile', 'cc', 'gun'], // Mina
  64: ['melee', 'dot', 'spirit', 'mobile'], // Drifter
  65: ['gun', 'cc'], // Venator
  66: ['tank', 'spirit', 'heal', 'dot'], // Victor
  67: ['spirit', 'heal', 'cc'], // Paige
  69: ['cc', 'spirit', 'mobile'], // The Doorman
  72: ['melee', 'cc', 'tank'], // Billy
  76: ['summons', 'spirit', 'cc'], // Graves
  77: ['melee', 'mobile', 'cc'], // Apollo
  78: ['spirit', 'mobile', 'dot', 'cc'], // Deadman Danny: ракеты с меткой, полёт на ранце, горящее топливо, ульта-захват
  79: ['heal', 'cc', 'summons'], // Rem
  80: ['gun', 'melee', 'tank', 'cc'], // Silver
  81: ['spirit', 'heal', 'cc'], // Celeste
  84: ['tank', 'summons', 'gun'], // Rat King
  85: ['spirit', 'cc', 'summons'], // Solomon: слоны-зоны со спирит-уроном, обездвиживание ладьями, ульта-«мат»
  88: ['spirit', 'summons', 'cc', 'mobile'], // Baba
};

/** Подпись «зачем брать» для ситуативных предметов. */
const REASON_GROUPS = [
  [{ ru: 'Против хила', en: 'Anti-heal' }, ['healbane', 'toxic_bullets', 'rupture', 'spirit_burn']],
  [{ ru: 'Против спирит-урона', en: 'Vs spirit damage' }, ['spirit_bubble', 'tech_purge', 'vex_barrier', 'absorbing_armor', 'counterspell', 'self_bubble', 'diviners_kevlar', 'magic_shield']],
  [{ ru: 'Против стрелков', en: 'Vs gunners' }, ['weapon_shielding', 'improved_bullet_armor', 'metal_skin', 'return_fire', 'greater_withering_whip', 'deflecting_armor', 'regenerating_bullet_shield', 'inhibitor']],
  [{ ru: 'Против контроля', en: 'Vs crowd control' }, ['debuff_reducer', 'reduce_debuff_duration', 'auto_cleanse', 'unstoppable']],
  [{ ru: 'Догнать / удержать', en: 'Chase / lock down' }, ['slowing_bullets', 'containment', 'magic_slow', 'target_stun', 'aoe_root', 'cold_front', 'arctic_blast']],
  [{ ru: 'Сбить каст', en: 'Interrupt casts' }, ['targeted_silence', 'proc_silence', 'glitch']],
  [{ ru: 'Против танков', en: 'Vs tanks' }, ['magic_shock', 'aprounds', 'escalating_exposure', 'bullet_resist_shredder', 'tech_defense_shredders', 'magic_vulnerability']],
  [{ ru: 'Против мили', en: 'Vs melee' }, ['melee_rebuttal']],
  [{ ru: 'Сейв союзника', en: 'Save an ally' }, ['rescue_beam', 'guardian_ward', 'health_nova', 'restorative_locket', 'divine_barrier', 'healbuff']],
  [{ ru: 'Мобильность', en: 'Mobility' }, ['warp_stone', 'rocket_booster', 'fleetfoot_boots', 'kinetic_sash', 'magic_carpet', 'icarus_wings', 'sprint_booster', 'cardio_calibrator', 'superior_stamina']],
  [{ ru: 'Выживание', en: 'Survival' }, ['cheat_death', 'colossus', 'veil_walker', 'shadow_strike']],
];
export const ITEM_REASON = {};
for (const [label, list] of REASON_GROUPS) for (const cls of list) ITEM_REASON[cls] ??= label;
export const SLOT_REASON = { weapon: { ru: 'Урон оружия', en: 'Weapon damage' }, vitality: { ru: 'Живучесть', en: 'Survivability' }, spirit: { ru: 'Сила способностей', en: 'Ability power' } };

/** Словарь для коротких переводов строк патчноутов. Ключи — в нижнем регистре. */
export const STAT_RU = {
  'base cooldown': 'Базовая перезарядка',
  cooldown: 'Перезарядка',
  'damage reduction': 'Снижение урона',
  'bullet damage': 'Урон пули',
  'base bullet damage': 'Базовый урон пули',
  'bullet base damage': 'Базовый урон пули',
  'gun falloff range': 'Дальность спада урона оружия',
  'copy duration': 'Длительность копии',
  'copied cooldown': 'Перезарядка копии',
  'flag duration': 'Длительность флага',
  'weapon damage': 'Урон оружия',
  'spirit damage': 'Спирит-урон',
  'melee damage': 'Урон ближнего боя',
  'heavy melee damage': 'Урон тяжёлого удара',
  'light melee damage': 'Урон лёгкого удара',
  damage: 'Урон',
  'base damage': 'Базовый урон',
  'damage per second': 'Урон в секунду',
  dps: 'Урон в секунду',
  radius: 'Радиус',
  duration: 'Длительность',
  'charge duration': 'Длительность заряда',
  'move speed': 'Скорость бега',
  'bonus move speed': 'Бонус к скорости',
  'sprint speed': 'Скорость спринта',
  range: 'Дальность',
  'cast range': 'Дальность каста',
  'falloff range': 'Дальность спада урона',
  'base hp regen': 'Базовая регенерация HP',
  'hp regen': 'Регенерация HP',
  'health regen': 'Регенерация HP',
  health: 'Здоровье',
  'base health': 'Базовое здоровье',
  'max health': 'Максимум здоровья',
  'bonus health': 'Бонус к здоровью',
  'health per boon': 'Здоровье за уровень',
  'spirit scaling': 'Масштаб от духа',
  'spirit power': 'Сила духа',
  'fire rate': 'Скорострельность',
  'bonus fire rate': 'Бонус скорострельности',
  ammo: 'Боезапас',
  'clip size': 'Магазин',
  'reload time': 'Время перезарядки оружия',
  slow: 'Замедление',
  'movement slow': 'Замедление',
  'stun duration': 'Длительность оглушения',
  'silence duration': 'Длительность безмолвия',
  lifesteal: 'Вампиризм',
  'spirit lifesteal': 'Спирит-вампиризм',
  'bullet lifesteal': 'Вампиризм пуль',
  heal: 'Лечение',
  healing: 'Лечение',
  barrier: 'Барьер',
  cost: 'Стоимость',
  'bullet resist': 'Сопротивление пулям',
  'spirit resist': 'Сопротивление духу',
  'bullet velocity': 'Скорость пули',
  'projectile speed': 'Скорость снаряда',
  'cast delay': 'Задержка каста',
  'cast time': 'Время каста',
  'stamina': 'Выносливость',
  charges: 'Заряды',
  'charge time': 'Время заряда',
  'bullet shield': 'Щит от пуль',
  'spirit shield': 'Щит от духа',
  'debuff resist': 'Сопротивление дебаффам',
  'headshot damage': 'Урон в голову',
  'bonus damage': 'Бонусный урон',
  'width': 'Ширина',
  'length': 'Длина',
  'max stacks': 'Макс. стаков',
  'channel duration': 'Длительность канала',
  'dash distance': 'Дальность рывка',
  'pull speed': 'Скорость притяжения',
  'max range': 'Макс. дальность',
  'min range': 'Мин. дальность',
  'souls': 'Души',
  'bounty': 'Награда',
  'respawn time': 'Время возрождения',
};

/** Параметры, у которых «меньше — лучше» (для определения баффа/нерфа). */
export const INVERSE_STATS = [
  'cooldown', 'cost', 'cast delay', 'cast time', 'delay', 'reload time', 'reload duration', 'windup', 'spread',
  'self damage', 'self-damage', 'recovery', 'arm time', 'lockout', 'penalty', 'respawn', 'charge time', 'wind up',
  'time to', 'channel time', 'drain', 'health cost', 'falloff start', 'deploy time', 'min charge',
  'slow effectiveness', 'damage taken', 'incoming damage',
];

/** Ручные сводки по крупным обновлениям, в которых нет построчных правок в API. */
export const CURATED_PATCHES = {
  'City Never Sleeps': {
    tldr: 'Крупнейшее обновление: переработанный Нью-Йорк, 6 новых героев с еженедельным релизом по голосованию, торговец Брокер и «порченые» предметы.',
    bullets: [
      'Карта: новые районы (Бродвей, Аптаун, Таймс-сквер, Гринвич, Сипорт), расширены Театр, Чайнатаун, Проклятый пустырь и Площадь.',
      'Новые нейтралы (Haunts) и объекты: Затопленная площадь (риск/награда), колокольня Чайнатауна, прочные ящики под тяжёлый удар, паровые решётки (невидимость + реген), контейнеры с перманентными баффами.',
      'Брокер: появляется около 30-й минуты и затем каждые ~15 минут, меняет предметы высоких тиров на «порченые» — сильнее, но со случайным минусом.',
      'Новые герои выходят по вторникам и пятницам в порядке голосования: Rat King (2 окт), Baba (6 окт), Solomon (9 окт), Deadman Danny (13 окт); последние два героя — 16 окт и позже.',
      'Интерфейс: новые полоски здоровья (видно ульту, Rejuvenator, выносливость врага), расширенные пинги, фильтры и популярные предметы в магазине.',
      'Точечные правки героев: Graves теперь ломает ловушки Venator оружием, у Sinclair и Doorman исправлены баги, у Yamato — траектория удара в воздухе.',
    ],
    tldrEn: 'The biggest update yet: a reworked New York, 6 new heroes released weekly by community vote, the Broker merchant and "tainted" items.',
    bulletsEn: [
      'Map: new districts (Broadway, Uptown, Times Square, Greenwich, Seaport); the Theater, Chinatown, Cursed Lot and Plaza were expanded.',
      'New neutrals (Haunts) and objectives: the Flooded Plaza (risk/reward), the Chinatown bell tower, sturdy crates for heavy melee, steam grates (invisibility + regen), containers with permanent buffs.',
      'The Broker: appears around minute 30 and then every ~15 minutes, trading high-tier items for "tainted" ones — stronger, but with a random downside.',
      'New heroes release on Tuesdays and Fridays in vote order: Rat King (Oct 2), Baba (Oct 6), Solomon (Oct 9), Deadman Danny (Oct 13); the last two heroes arrive from Oct 16.',
      'UI: new health bars (showing ultimate, Rejuvenator and enemy stamina), expanded pings, shop filters and popular items.',
      'Targeted hero fixes: Graves can now break Venator traps with his gun, Sinclair and Doorman bugs fixed, Yamato’s aerial strike trajectory adjusted.',
    ],
  },
  // Анонсы новых героев (type: 'news' — не считаются балансным патчем)
  'Listen up, Crumbums! Your King is here.': {
    type: 'news',
    tldr: 'Новый герой — Rat King (боец). Первый герой из набора City Never Sleeps.',
    bullets: [
      'Scrap Grenade — граната из хлама, бьёт несколько раз пулевым уроном и замедляет; её можно отбить ближним ударом.',
      'Rat Swarm — крысы прыгают на врагов, наносят урон со временем и снижают сопротивление пулям.',
      'Royal Pestments — броня-барьер от макс. здоровья, пока она цела, пули могут отражаться в стрелка.',
      'Rule, Ratannia! (ульта) — знамя: союзникам рядом скорость, иммунитет к замедлениям и снижение входящего урона.',
    ],
    tldrEn: 'New hero — Rat King (brawler). The first hero from the City Never Sleeps lineup.',
    bulletsEn: [
      'Scrap Grenade — a junk grenade that hits several times for bullet damage and slows; it can be knocked back with a melee hit.',
      'Rat Swarm — rats leap at enemies, dealing damage over time and reducing bullet resist.',
      'Royal Pestments — a max-HP barrier armor; while it holds, bullets can ricochet back at the shooter.',
      'Rule, Ratannia! (ultimate) — a banner: nearby allies get speed, slow immunity and reduced incoming damage.',
    ],
  },
  'Mind the Birds!': {
    type: 'news',
    tldr: 'Новый герой — Baba (мистик), старушка с голубями из Центрального парка. Конец первого рейтингового сезона перенесён на 5 ноября.',
    bullets: [
      'Threadsap — нить по прицелу: спирит-урон и кража силы духа врага; пока сила украдена, пули наносят доп. урон.',
      'Granny Long Legs — скамейка «встаёт на ноги»: скорость, высокие прыжки, сопротивление дебаффам и ближним ударам.',
      'Baba’s Brew — чайник, эффект которого меняется по кругу: барьер союзникам, безмолвие или ожог со снижением сопротивления духу.',
      'Feed The Birds (ульта) — хлеб с накапливаемым замедлением, затем стая голубей: урон и превращение целей в голубей.',
    ],
    tldrEn: 'New hero — Baba (mystic), the pigeon lady from Central Park. The end of the first ranked season moved to November 5.',
    bulletsEn: [
      'Threadsap — a thread at your crosshair: spirit damage and steals the enemy’s spirit power; while stolen, bullets deal bonus damage.',
      'Granny Long Legs — the bench "stands up": speed, high jumps, debuff and melee resistance.',
      'Baba’s Brew — a teapot whose effect cycles: a barrier for allies, a silence, or a burn that lowers spirit resist.',
      'Feed The Birds (ultimate) — bread with a stacking slow, then a flock of pigeons: damage and turning targets into pigeons.',
    ],
  },
  'Fairfax Industries Employee Spotlight': {
    type: 'news',
    tldr: 'Новый герой — Deadman Danny (стрелок), «лучший продавец» Fairfax Industries с ракетомётом и реактивным ранцем. Следующий герой — 16 октября, осталось два.',
    bullets: [
      'Strix Salvo — залп ракет, которые втыкаются в землю по линии и взрываются с задержкой или рядом с врагом: спирит-урон и метка; заряженный выстрел по помеченному врагу снимает метку и наносит доп. урон.',
      'Chimera Mk1 — полёт на ранце, пока держите прыжок; ранец копит жар и при перегреве пикирует вниз со взрывом, подбрасывая врагов рядом.',
      'Jettison Fuel — струя горящего топлива: урон оружием со временем и снижение сопротивления пулям, в конце — мощный выброс со спирит-уроном, который отбрасывает самого Дэнни; охлаждает ранец.',
      'Close The Deal (ульта) — хватает врага, взлетает с ним и обрушивается на землю: спирит-урон обоим, по врагам ниже 50% здоровья — больше.',
      'Против него: сопротивление духу, замедления и обездвиживание против полётов, снятие дебаффов против ульты.',
    ],
    tldrEn: 'New hero — Deadman Danny (marksman), Fairfax Industries’ star salesman with a rocket launcher and a jetpack. The next hero arrives on October 16; two remain.',
    bulletsEn: [
      'Strix Salvo — a salvo of missiles that lodge into the ground along a line and explode after a delay or near an enemy: spirit damage and a mark; a charged shot on a marked enemy consumes the mark for bonus damage.',
      'Chimera Mk1 — fly while holding jump; the jetpack builds heat and, when it overheats, dives to the ground with an explosion that launches nearby enemies.',
      'Jettison Fuel — a stream of burning fuel: weapon damage over time and bullet resist shred, ending in a big spirit-damage backblast that knocks Danny back; vents the jetpack.',
      'Close The Deal (ultimate) — grabs an enemy, flies up and crashes down: spirit damage to both, more against enemies below 50% health.',
      'Countering him: spirit resist, slows and immobilizes against flight, cleanses against the ultimate.',
    ],
  },
  'Make Your Move.': {
    type: 'news',
    tldr: 'Новый герой — Solomon (мистик), шахматист, который играет городом как доской. Вышел 9 октября, в Международный день шахмат.',
    bullets: [
      'Setup Bishop — ставит слона, который стоит бесконечно; слона можно двигать (замедление и спирит-урон по пути), после паузы активируются диагональные клетки с уроном.',
      'Kingside Knight — делает союзника «конём»: выносливость и барьер, прыжок с неуязвимостью; на себя — «король» с двойным барьером.',
      'Rook Battery — пара ладей летит вперёд: спирит-урон и обездвиживание, отражается от стен, по повторному нажатию расходится в стороны.',
      'Develop Queen (ульта) — «мат»: запирает врагов; на II улучшении казнит героев ниже 200 HP.',
      'Против него: снятие дебаффов (обездвиживание и ульта), сопротивление духу, не стоять на диагоналях от слонов.',
    ],
    tldrEn: 'New hero — Solomon (mystic), a chess master who plays the city like a board. Released October 9, International Chess Day.',
    bulletsEn: [
      'Setup Bishop — places a bishop that lasts indefinitely; it can be moved (slowing and dealing spirit damage along the way), and after a pause its diagonal squares activate for damage.',
      'Kingside Knight — turns an ally into a "knight": stamina and a barrier, plus an invulnerable jump; on yourself — a "king" with a double barrier.',
      'Rook Battery — a pair of rooks flies forward: spirit damage and immobilize, bounces off walls, and splits sideways on recast.',
      'Develop Queen (ultimate) — "checkmate": traps enemies; at upgrade II it executes heroes below 200 HP.',
      'Countering him: cleanses (for the immobilize and ultimate), spirit resist, and don’t stand on a bishop’s diagonals.',
    ],
  },
};
