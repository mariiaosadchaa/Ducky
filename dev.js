'use strict';
// Локальний сервер для розробки: node dev.js (або npm run dev). Без залежностей, без кешу.
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'web');
const PORT = Number(process.env.PORT) || 3000;

// Змінні середовища: файл .env.local у корені проєкту (не потрапляє в git) + Supabase з web/config.js
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* файлу немає — це нормально */ }
try {
  const cfg = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const u = /supabaseUrl:\s*'([^']+)'/.exec(cfg); const k = /supabaseAnonKey:\s*'([^']+)'/.exec(cfg);
  if (u && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = u[1];
  if (k && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = k[1];
} catch (e) { /* ігноруємо */ }

// /api/<назва> виконує файл api/<назва>.js так само, як це робить Vercel
function runApi(name, req, res) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) { res.writeHead(404); return res.end('{}'); }
  const file = path.join(__dirname, 'api', name + '.js');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Немає такого API.' })); }
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 6e6) req.destroy(); else chunks.push(c); });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { /* порожнє тіло */ }
    delete require.cache[require.resolve(file)];   // зміни в api/ підхоплюються без перезапуску
    Promise.resolve(require(file)(Object.assign(req, { body }), res)).catch((e) => {
      console.error(e); if (!res.headersSent) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Помилка сервера.' })); }
    });
  });
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) return runApi(p.slice(5), req, res);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Не знайдено: ' + p); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log('\n  Ducky: http://localhost:' + PORT + '\n  ШІ: ' + (process.env.GEMINI_API_KEY ? 'ключ Gemini знайдено' : process.env.ANTHROPIC_API_KEY ? 'ключ Anthropic знайдено' : 'немає ключа (створіть файл .env.local, див. docs/deploy-auth.md)') + '\n  Зміни у файлах видно після Ctrl+F5. Зупинити: Ctrl+C.\n');
}).on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? 'Порт ' + PORT + ' зайнятий. Закрийте інше вікно з сервером або запустіть: set PORT=3001 && npm run dev' : e.message);
  process.exit(1);
});
