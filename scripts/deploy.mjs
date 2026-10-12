// Обновление опубликованного сайта одной командой: npm run deploy
//   1) скачивает свежие ассеты (герои, способности, предметы, ранги) — флаг --assets;
//   2) коммитит все изменения;
//   3) отправляет на GitHub — GitHub Pages перепубликует сайт за ~1 минуту.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = fileURLToPath(new URL('../data/assets.json', import.meta.url));
const KNOWLEDGE = fileURLToPath(new URL('../js/knowledge.js', import.meta.url));
const SITE = 'https://jisat888u.github.io/deadlock-tracker/';

function run(cmd, args, { quiet = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim() };
}
const heroIds = () => {
  try { return JSON.parse(readFileSync(ASSETS, 'utf8')).heroes.map((h) => ({ id: h.id, en: h.en })); } catch { return []; }
};

const withAssets = process.argv.includes('--assets');
const before = heroIds();

if (withAssets) {
  console.log('\n▶ Скачиваю свежие ассеты…');
  if (!run('node', ['scripts/update-assets.mjs']).ok) {
    console.error('✖ Не удалось скачать ассеты (API недоступно?). Сайт не изменён.');
    process.exit(1);
  }
  const known = new Set(before.map((h) => h.id));
  const fresh = heroIds().filter((h) => !known.has(h.id));
  const knowledge = readFileSync(KNOWLEDGE, 'utf8');
  const noProfile = heroIds().filter((h) => !new RegExp(`^\\s*${h.id}:`, 'm').test(knowledge));
  if (fresh.length) console.log(`★ Новые герои: ${fresh.map((h) => h.en).join(', ')}`);
  if (noProfile.length)
    console.log(`⚠ Нет профиля угроз для контр-предметов: ${noProfile.map((h) => h.en).join(', ')} — попросите Claude «обнови сайт», он допишет.`);
}

console.log('\n▶ Сохраняю изменения…');
run('git', ['add', '-A']);
const staged = !run('git', ['diff', '--cached', '--quiet'], { quiet: true }).ok;
if (staged) {
  const date = new Date().toLocaleDateString('ru-RU');
  if (!run('git', ['commit', '-q', '-m', `Обновление сайта ${date}`]).ok) {
    console.error('✖ Не удалось создать коммит.');
    process.exit(1);
  }
} else {
  console.log('  Новых изменений нет.');
}

const ahead = run('git', ['rev-list', '--count', '@{u}..HEAD'], { quiet: true });
if (ahead.ok && ahead.out === '0') {
  console.log(`\n✔ Всё уже опубликовано: ${SITE}`);
  process.exit(0);
}

console.log('\n▶ Отправляю на GitHub… (если откроется окно входа — войдите; ошибку «Неправильная строка привязки» можно закрыть, отправка всё равно пройдёт)');
if (!run('git', ['push']).ok) {
  console.error('✖ Не удалось отправить на GitHub. Проверьте интернет и вход в GitHub, затем запустите команду ещё раз.');
  process.exit(1);
}
console.log(`\n✔ Готово! Через ~1 минуту изменения будут на сайте: ${SITE}`);
