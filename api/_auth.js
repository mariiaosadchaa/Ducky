'use strict';
// Перевіряє користувача через Supabase: Bearer-токен -> /auth/v1/user.
async function requireUser(req) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return { error: 'Сервер не налаштований (SUPABASE_URL / SUPABASE_ANON_KEY).', status: 500 };
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: 'Потрібно увійти.', status: 401 };
  let r;
  try {
    r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
  } catch (e) { return { error: 'Не вдалося перевірити вхід.', status: 502 }; }
  if (!r.ok) return { error: 'Сесія недійсна. Увійдіть знову.', status: 401 };
  const u = await r.json();
  if (!u || !u.id) return { error: 'Сесія недійсна. Увійдіть знову.', status: 401 };
  return { user: u };
}
module.exports = { requireUser };
