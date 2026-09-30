'use strict';
// Локальний сервер для розробки: node dev.js (або npm run dev). Без залежностей, без кешу.
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'web');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Не знайдено: ' + p); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log('\n  Ducky: http://localhost:' + PORT + '\n  Зміни у файлах видно після Ctrl+F5. Зупинити: Ctrl+C.\n');
}).on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? 'Порт ' + PORT + ' зайнятий. Закрийте інше вікно з сервером або запустіть: set PORT=3001 && npm run dev' : e.message);
  process.exit(1);
});
