'use strict';
// Сповіщення Ducky, коли застосунок закритий (Web Push, без сторонніх бібліотек).
//  POST (з входом):  {action:'key'|'subscribe'|'sync'|'unsubscribe'|'test', ...}
//  GET/POST ?token=CRON_SECRET: розсилає нагадування, час яких настав (викликає зовнішній пінгер щохвилини)
//  node api/push.js : друкує нову пару VAPID-ключів для змінних середовища
const crypto = require('crypto');
const { requireUser } = require('./_auth');
const { send } = require('./_claude');

const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// шифрування повідомлення за RFC 8291 (aes128gcm)
function encrypt(sub, text) {
  const ua = unb64u(sub.keys.p256dh); const auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(ua);
  const salt = crypto.randomBytes(16);
  const ikm = hkdf(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  return Buffer.concat([salt, Buffer.from([0, 0, 0x10, 0]), Buffer.from([asPub.length]), asPub, ct]);
}

function vapidJwt(endpoint, pub, priv, subject) {
  const x = b64u(unb64u(pub).subarray(1, 33)); const y = b64u(unb64u(pub).subarray(33, 65));
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: priv, x, y }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

async function pushTo(sub, payload, env) {
  const pub = env.VAPID_PUBLIC_KEY; const priv = env.VAPID_PRIVATE_KEY;
  const jwt = vapidJwt(sub.endpoint, pub, priv, env.VAPID_SUBJECT || 'mailto:ducky@example.com');
  const r = await fetch(sub.endpoint, { method: 'POST', body: encrypt(sub, JSON.stringify(payload)), headers: {
    Authorization: 'vapid t=' + jwt + ', k=' + pub, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '1800', Urgency: 'high' } });
  return r.status;
}

// ---- Supabase REST із сервісним ключем (таблиця ducky_push закрита для всіх, крім сервера) ----
function db(env) {
  const base = env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/ducky_push';
  const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'content-type': 'application/json' };
  const go = async (url, init) => { const r = await fetch(url, { ...init, headers: { ...H, ...(init && init.headers) } }); if (!r.ok) throw new Error('База: ' + r.status); const t = await r.text(); return t ? JSON.parse(t) : null; };
  return {
    upsert: (row) => go(base + '?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) }),
    patch: (q, row) => go(base + '?' + q, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) }),
    del: (q) => go(base + '?' + q, { method: 'DELETE' }),
    list: (q) => go(base + '?' + q),
  };
}
const eq = (v) => 'eq.' + encodeURIComponent(v);

const cleanItems = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 60).map((i) => ({
  k: String((i && i.k) || '').slice(0, 80), t: String((i && i.t) || '').slice(0, 120), b: String((i && i.b) || '').slice(0, 200), at: Number(i && i.at) || 0 })).filter((i) => i.k && i.at);
const validSub = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && s.keys.p256dh && s.keys.auth;

// розсилка: що настало за останні 20 хвилин і ще не надсилалось
async function runCron(env) {
  const D = db(env); const now = Date.now();
  const rows = await D.list('select=endpoint,sub,items,sent&limit=1000');
  let sentN = 0; let gone = 0;
  for (const row of rows || []) {
    const sent = new Set(row.sent || []);
    const due = (row.items || []).filter((i) => i.at <= now && i.at >= now - 20 * 60000 && !sent.has(i.k));
    if (!due.length) continue;
    let dead = false;
    for (const i of due) {
      try {
        const st = await pushTo(row.sub, { k: i.k, t: i.t, b: i.b, u: './?go=today' }, env);
        if (st === 404 || st === 410) { dead = true; break; }
        if (st >= 200 && st < 300) { sent.add(i.k); sentN++; }
      } catch (e) { console.error('push', e.message); }
    }
    if (dead) { await D.del('endpoint=' + eq(row.endpoint)); gone++; continue; }
    await D.patch('endpoint=' + eq(row.endpoint), { sent: [...sent].slice(-120) });
  }
  return { sent: sentN, removed: gone, rows: (rows || []).length };
}

module.exports = async (req, res) => {
  const env = process.env;
  const q = new URL(req.url || '/', 'http://x').searchParams;
  const ready = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);

  // виклик від пінгера
  if (q.get('token') !== null) {
    const want = env.CRON_SECRET || '';
    const got = String(q.get('token'));
    const ok = want.length >= 16 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) return send(res, 401, { error: 'Невірний токен.' });
    if (!ready) return send(res, 500, { error: 'Не задано ключі сповіщень на сервері.' });
    try { return send(res, 200, await runCron(env)); } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Лише POST.' });
  const a = await requireUser(req);
  if (a.error) return send(res, a.status, { error: a.error });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (b.action === 'key') return send(res, 200, { ready, key: ready ? env.VAPID_PUBLIC_KEY : null });
  if (!ready) return send(res, 503, { error: 'Сповіщення ще не налаштовані на сервері (див. docs/deploy-auth.md).' });
  const D = db(env);
  try {
    if (b.action === 'subscribe') {
      if (!validSub(b.sub)) return send(res, 400, { error: 'Некоректна підписка.' });
      await D.upsert({ endpoint: b.sub.endpoint, user_id: a.user.id, sub: { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } }, items: cleanItems(b.items), updated_at: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }
    if (b.action === 'sync') {
      await D.patch('endpoint=' + eq(String(b.endpoint || '')) + '&user_id=' + eq(a.user.id), { items: cleanItems(b.items), updated_at: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }
    if (b.action === 'unsubscribe') {
      await D.del('endpoint=' + eq(String(b.endpoint || '')) + '&user_id=' + eq(a.user.id));
      return send(res, 200, { ok: true });
    }
    if (b.action === 'test') {
      const rows = await D.list('select=sub&endpoint=' + eq(String(b.endpoint || '')) + '&user_id=' + eq(a.user.id));
      if (!rows || !rows.length) return send(res, 404, { error: 'Цей телефон ще не підписаний.' });
      const st = await pushTo(rows[0].sub, { k: 'test' + Date.now(), t: 'Дім 🦆', b: 'Сповіщення працюють. Кря!', u: './?go=today' }, env);
      return send(res, st >= 200 && st < 300 ? 200 : 502, st >= 200 && st < 300 ? { ok: true } : { error: 'Сервіс сповіщень відповів ' + st + '.' });
    }
  } catch (e) { return send(res, 500, { error: e.message || 'Помилка сервера.' }); }
  return send(res, 400, { error: 'Невідома дія.' });
};
module.exports._test = { encrypt, vapidJwt };

if (require.main === module) {
  const k = crypto.createECDH('prime256v1'); k.generateKeys();
  console.log('\nVAPID_PUBLIC_KEY=' + b64u(k.getPublicKey()) + '\nVAPID_PRIVATE_KEY=' + b64u(k.getPrivateKey()) + '\nCRON_SECRET=' + crypto.randomBytes(24).toString('hex') + '\n');
}
