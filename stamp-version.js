'use strict';
// Під час деплою на Vercel підставляє в web/sw.js версію з хеша коміту.
// Завдяки цьому телефон сам помічає нову версію й показує екран «Оновити» (див. updater у web/extras.js).
const fs = require('fs');
const path = require('path');
try {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '';
  if (!sha) { console.log('stamp-version: немає VERCEL_GIT_COMMIT_SHA, версію в sw.js не змінюю'); process.exit(0); }
  const file = path.join(__dirname, 'web', 'sw.js');
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(/const CACHE = '[^']*';/, "const CACHE = 'ducky-" + sha.slice(0, 10) + "';");
  if (out !== src) fs.writeFileSync(file, out);
  console.log('stamp-version: ducky-' + sha.slice(0, 10));
} catch (e) { console.log('stamp-version: пропущено (' + e.message + ')'); }
process.exit(0);
