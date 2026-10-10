// Ручная экспертиза: роли, профили угроз героев, контр-предметы, словарь для патчноутов.
// Профили угроз составлены по описаниям способностей (assets API) — цифры на сайте всегда из статистики.

export const ROLES = {
  marksman: { ru: 'Стрелки', one: 'Стрелок', color: 'var(--weapon)' },
  mystic: { ru: 'Мистики', one: 'Мистик', color: 'var(--spirit)' },
  brawler: { ru: 'Бойцы', one: 'Боец', color: 'var(--vitality)' },
  assassin: { ru: 'Ассасины', one: 'Ассасин', color: 'var(--rust)' },
  unknown: { ru: 'Другие', one: 'Герой', color: 'var(--muted)' },
};
export const ROLE_ORDER = ['marksman', 'mystic', 'brawler', 'assassin'];

/** Типы угроз и предметы (class_name без upgrade_), которые их закрывают. */
export const THREATS = {
  heal: {
    ru: 'Сильный хил и вампиризм',
    short: 'Хил',
    why: 'Срежьте входящее лечение — иначе урон просто «отхиливается».',
    items: ['healbane', 'toxic_bullets', 'rupture', 'spirit_burn'],
  },
  spirit: {
    ru: 'Спирит-бёрст',
    short: 'Спирит-урон',
    why: 'Много урона способностями: стакайте сопротивление духу и барьеры.',
    items: ['spirit_bubble', 'tech_purge', 'vex_barrier', 'absorbing_armor', 'counterspell', 'self_bubble'],
  },
  gun: {
    ru: 'Урон с оружия',
    short: 'Стрелки',
    why: 'Основной урон идёт пулями: сопротивление пулям и обезоруживание.',
    items: ['weapon_shielding', 'improved_bullet_armor', 'metal_skin', 'return_fire', 'greater_withering_whip', 'deflecting_armor'],
  },
  cc: {
    ru: 'Много контроля',
    short: 'Контроль',
    why: 'Оглушения, стяжки, хексы: снимайте и сокращайте дебаффы.',
    items: ['debuff_reducer', 'reduce_debuff_duration', 'auto_cleanse', 'unstoppable', 'counterspell'],
  },
  dot: {
    ru: 'Урон со временем',
    short: 'DoT',
    why: 'Поджоги, яды и кровотечения: очищение и устойчивость к дебаффам.',
    items: ['debuff_reducer', 'reduce_debuff_duration', 'vex_barrier', 'health_stimpak'],
  },
  mobile: {
    ru: 'Высокая мобильность',
    short: 'Мобильность',
    why: 'Враг постоянно уходит и врывается: замедления, руты и запрет рывков.',
    items: ['slowing_bullets', 'containment', 'magic_slow', 'target_stun', 'aoe_root', 'cold_front'],
  },
  channel: {
    ru: 'Каст и ульты с каналом',
    short: 'Каналы',
    why: 'Сбивайте подготовку ульты безмолвием или оглушением.',
    items: ['targeted_silence', 'target_stun', 'proc_silence', 'glitch'],
  },
  tank: {
    ru: 'Танки с большим HP',
    short: 'Танки',
    why: 'Процентный урон и снижение сопротивлений пробивают толстяков.',
    items: ['magic_shock', 'aprounds', 'escalating_exposure', 'bullet_resist_shredder', 'tech_defense_shredders'],
  },
  melee: {
    ru: 'Ближний бой',
    short: 'Мили',
    why: 'Держите дистанцию и наказывайте ближние удары.',
    items: ['melee_rebuttal', 'containment', 'slowing_bullets', 'metal_skin'],
  },
  summons: {
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
  79: ['heal', 'cc', 'summons'], // Rem
  80: ['gun', 'melee', 'tank', 'cc'], // Silver
  81: ['spirit', 'heal', 'cc'], // Celeste
  84: ['tank', 'summons', 'gun'], // Rat King
  85: ['spirit', 'cc', 'summons'], // Solomon: слоны-зоны со спирит-уроном, обездвиживание ладьями, ульта-«мат»
  88: ['spirit', 'summons', 'cc', 'mobile'], // Baba
};

/** Подпись «зачем брать» для ситуативных предметов. */
const REASON_GROUPS = [
  ['Против хила', ['healbane', 'toxic_bullets', 'rupture', 'spirit_burn']],
  ['Против спирит-урона', ['spirit_bubble', 'tech_purge', 'vex_barrier', 'absorbing_armor', 'counterspell', 'self_bubble', 'diviners_kevlar', 'magic_shield']],
  ['Против стрелков', ['weapon_shielding', 'improved_bullet_armor', 'metal_skin', 'return_fire', 'greater_withering_whip', 'deflecting_armor', 'regenerating_bullet_shield', 'inhibitor']],
  ['Против контроля', ['debuff_reducer', 'reduce_debuff_duration', 'auto_cleanse', 'unstoppable']],
  ['Догнать / удержать', ['slowing_bullets', 'containment', 'magic_slow', 'target_stun', 'aoe_root', 'cold_front', 'arctic_blast']],
  ['Сбить каст', ['targeted_silence', 'proc_silence', 'glitch']],
  ['Против танков', ['magic_shock', 'aprounds', 'escalating_exposure', 'bullet_resist_shredder', 'tech_defense_shredders', 'magic_vulnerability']],
  ['Против мили', ['melee_rebuttal']],
  ['Сейв союзника', ['rescue_beam', 'guardian_ward', 'health_nova', 'restorative_locket', 'divine_barrier', 'healbuff']],
  ['Мобильность', ['warp_stone', 'rocket_booster', 'fleetfoot_boots', 'kinetic_sash', 'magic_carpet', 'icarus_wings', 'sprint_booster', 'cardio_calibrator', 'superior_stamina']],
  ['Выживание', ['cheat_death', 'colossus', 'veil_walker', 'shadow_strike']],
];
export const ITEM_REASON = {};
for (const [label, list] of REASON_GROUPS) for (const cls of list) ITEM_REASON[cls] ??= label;
export const SLOT_REASON = { weapon: 'Урон оружия', vitality: 'Живучесть', spirit: 'Сила способностей' };

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
];

/** Ручные сводки по крупным обновлениям, в которых нет построчных правок в API. */
export const CURATED_PATCHES = {
  'City Never Sleeps': {
    tldr: 'Крупнейшее обновление: переработанный Нью-Йорк, 6 новых героев с еженедельным релизом по голосованию, торговец Брокер и «порченые» предметы.',
    bullets: [
      'Карта: новые районы (Бродвей, Аптаун, Таймс-сквер, Гринвич, Сипорт), расширены Театр, Чайнатаун, Проклятый пустырь и Площадь.',
      'Новые нейтралы (Haunts) и объекты: Затопленная площадь (риск/награда), колокольня Чайнатауна, прочные ящики под тяжёлый удар, паровые решётки (невидимость + реген), контейнеры с перманентными баффами.',
      'Брокер: появляется около 30-й минуты и затем каждые ~15 минут, меняет предметы высоких тиров на «порченые» — сильнее, но со случайным минусом.',
      'Новые герои выходят по вторникам и пятницам в порядке голосования: Rat King (2 окт), Baba (6 окт), Solomon (9 окт), далее Nurse Harrow, Deadman Danny и Violet.',
      'Интерфейс: новые полоски здоровья (видно ульту, Rejuvenator, выносливость врага), расширенные пинги, фильтры и популярные предметы в магазине.',
      'Точечные правки героев: Graves теперь ломает ловушки Venator оружием, у Sinclair и Doorman исправлены баги, у Yamato — траектория удара в воздухе.',
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
  },
};
