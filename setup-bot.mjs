// Встраивает webapp в бота: кнопка меню рядом с полем ввода + описание.
// Запуск: node setup-bot.mjs   (берёт BOT_TOKEN и WEBAPP_URL из .env)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const { BOT_TOKEN, WEBAPP_URL } = env;
if (!BOT_TOKEN) throw new Error('Заполни BOT_TOKEN в .env');

const call = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
};

const me = await call('getMe', {});
await call('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Обмен', web_app: { url: WEBAPP_URL } },
});
await call('setMyDescription', { description: 'P2P-обмен подарками без гаранта. Жми «Обмен» внизу 👇' });
await call('setMyShortDescription', { short_description: 'P2P-обмен подарками (демо)' });

console.log(`Готово: @${me.username} → ${WEBAPP_URL}`);
console.log(`Прямая ссылка: https://t.me/${me.username}?startapp`);
