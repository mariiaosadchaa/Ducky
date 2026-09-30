'use strict';
// Ducky: дані лише від користувача (localStorage). Жодних вигаданих цін чи запасів.

const KEY = 'ducky.v1';
const TABS = [
  ['pantry', 'Комора'], ['scan', 'Скан чека'], ['recipes', 'Рецепти'], ['menu', 'Меню'], ['stores', 'Магазини'],
];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MEALS = [['b', 'Сніданок'], ['l', 'Обід'], ['d', 'Вечеря']];
const APPLIANCES = ['', 'Мультиварка', 'Духовка', 'Хлібопічка', 'Плита', 'Інше'];

const USERS_KEY = 'ducky.users';
const SESSION_KEY = 'ducky.session';
const THEME_KEY = 'ducky.theme';
const SCOPE_KEY = 'ducky.scope.';

const defaults = () => ({ products: [], receipts: [], recipes: [], menu: {}, budget: '', tab: 'pantry', profile: {}, notified: {}, archive: [] });
let state = null;      // дані поточного користувача
let user = null;       // { id, name, email }
let authMode = 'register';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* пам'ять: ігноруємо */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ігноруємо */ } },
};
function loadState(id) {
  const s = store.get(KEY + '.' + id);
  return s && typeof s === 'object' ? { ...defaults(), ...s } : defaults();
}
// ---------- Supabase (той самий проєкт, що й у Rivna app) ----------
const cfg = window.DUCKY_CONFIG || {};
const remote = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
const sb = remote ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let remoteReady = false;   // true лише після успішного завантаження даних, щоб не затерти їх порожніми
let authReady = !remote;
let syncTimer = null;

function setSync(text, bad) {
  if (!$sync) return;
  $sync.textContent = text || '';
  $sync.className = 'sync' + (bad ? ' warn' : '');
}
// scope: 'me' = особиста комора, інакше id спільного домогосподарства (сімейна комора)
let scope = 'me';
let memberships = [];      // [{ id, name }] домогосподарства з Rivna app, де користувач є учасником
let channel = null;        // realtime-підписка на спільну комору
let pendingRemote = false; // прийшли зміни від іншого учасника, поки користувач друкував
const cacheId = () => (scope === 'me' ? user.id : 'h.' + scope);
function saveLocal() { if (state && user) store.set(KEY + '.' + cacheId(), state); }
function save() {
  if (!state || !user) return;
  saveLocal();
  if (remote && remoteReady) {
    clearTimeout(syncTimer);
    setSync('Зберігаємо…');
    syncTimer = setTimeout(pushRemote, 600);
  }
}
async function pushRemote() {
  if (!remote || !user || !remoteReady) return;
  const at = new Date().toISOString();
  const { error } = scope === 'me'
    ? await sb.from('ducky_data').upsert({ user_id: user.id, data: state, updated_at: at })
    : await sb.from('ducky_household_data').upsert({ household_id: scope, data: state, updated_at: at, updated_by: user.id });
  setSync(error ? 'Не вдалося зберегти' : 'Збережено', !!error);
}
async function loadMemberships() {
  memberships = [];
  try {
    const mem = await sb.from('household_members').select('household_id').eq('user_id', user.id);
    if (mem.error || !mem.data || !mem.data.length) return;
    const ids = [...new Set(mem.data.map((m) => m.household_id))];
    const hh = await sb.from('households').select('id, name').in('id', ids);
    const names = new Map((hh.data || []).map((x) => [x.id, x.name]));
    memberships = ids.map((id) => ({ id, name: names.get(id) || 'Сім\'я' }));
  } catch (e) { memberships = []; }
}
// завантажує дані поточного scope; true, якщо вдалося
async function loadScopeData() {
  const { data, error } = scope === 'me'
    ? await sb.from('ducky_data').select('data').eq('user_id', user.id).maybeSingle()
    : await sb.from('ducky_household_data').select('data').eq('household_id', scope).maybeSingle();
  if (error) return false;
  remoteReady = true;
  if (data && data.data && typeof data.data === 'object') { state = { ...defaults(), ...data.data }; setSync('Синхронізовано'); }
  else await pushRemote();              // першe використання: завантажуємо локальний кеш у базу
  return true;
}
function unsubscribeRealtime() {
  if (channel && sb) { try { sb.removeChannel(channel); } catch (e) { /* ігноруємо */ } }
  channel = null;
}
function subscribeRealtime() {
  unsubscribeRealtime();
  if (scope === 'me' || !sb.channel) return;
  const hid = scope;
  try {
    channel = sb.channel('ducky-h-' + hid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ducky_household_data', filter: 'household_id=eq.' + hid }, (p) => {
        const row = p && p.new;
        if (!row || !row.data || scope !== hid || row.updated_by === user.id) return;
        state = { ...defaults(), ...row.data, tab: state.tab };
        saveLocal(); setSync('Оновлено іншим учасником');
        const a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) pendingRemote = true; else render();
      })
      .subscribe();
  } catch (e) { channel = null; }
}
document.addEventListener('focusout', () => { if (pendingRemote) { pendingRemote = false; setTimeout(render, 0); } });

async function switchScope(next) {
  if (!user || next === scope) return;
  clearTimeout(syncTimer);
  if (remoteReady) await pushRemote();
  unsubscribeRealtime();
  scope = next; remoteReady = false;
  store.set(SCOPE_KEY + user.id, scope);
  state = loadState(cacheId());
  render();
  if (!(await loadScopeData())) {
    if (scope !== 'me') { scope = 'me'; store.set(SCOPE_KEY + user.id, scope); state = loadState(cacheId()); await loadScopeData(); setSync('Спільна комора недоступна. Перевірте SQL з docs/supabase.sql', true); }
    else setSync('Не вдалося завантажити дані', true);
  }
  subscribeRealtime();
  render();
}
async function enterRemote(sbUser) {
  if (user && user.id === sbUser.id) return;
  const meta = sbUser.user_metadata || {};
  user = { id: sbUser.id, name: meta.full_name || meta.name || (sbUser.email || '').split('@')[0], email: sbUser.email };
  scope = store.get(SCOPE_KEY + user.id) || 'me';
  state = loadState(cacheId());         // локальний кеш, поки вантажимо
  remoteReady = false;
  store.set('ducky.seen', 1);
  render();
  await loadMemberships();
  if (scope !== 'me' && !memberships.some((m) => m.id === scope)) { scope = 'me'; state = loadState(cacheId()); }
  let ok = await loadScopeData();
  if (!ok && scope !== 'me') {
    scope = 'me'; state = loadState(cacheId()); ok = await loadScopeData();
    if (ok) setSync('Спільна комора недоступна. Перевірте SQL з docs/supabase.sql', true);
  }
  if (!ok) { setSync('Не вдалося завантажити дані', true); render(); return; }
  subscribeRealtime();
  await loadRivnaBudget();
  render();
}
// ---------- бюджет із Rivna app (той самий Supabase, лише читання) ----------
let rivna = null;   // { options: [{ id, name, monthly, weekly, currency }] }
const localISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

async function loadRivnaBudget() {
  rivna = null;
  try {
    const mem = await sb.from('household_members').select('household_id, role').eq('user_id', user.id);
    if (mem.error || !mem.data || !mem.data.length) return;
    const ids = [...new Set(mem.data.map((m) => m.household_id))];
    const [hh, cats] = await Promise.all([
      sb.from('households').select('id, name').in('id', ids),
      sb.from('categories').select('id, household_id, name').in('household_id', ids).ilike('name', 'Продукти%'),
    ]);
    if (cats.error || !cats.data || !cats.data.length) return;
    const now = new Date();
    const today = localISO(now);
    const ym = today.slice(0, 7);
    const from = new Date(now); from.setDate(from.getDate() - 35);
    const to = new Date(now); to.setDate(to.getDate() + 35);
    const bud = await sb.from('budgets').select('household_id, category_id, month, limit_amount, currency, period_type')
      .in('category_id', cats.data.map((c) => c.id)).gte('month', localISO(from)).lte('month', localISO(to));
    if (bud.error || !bud.data) return;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const names = new Map((hh.data || []).map((x) => [x.id, x.name]));
    const roles = new Map(mem.data.map((m) => [m.household_id, m.role]));
    const per = new Map();
    for (const b of bud.data) {
      if (b.currency && String(b.currency).toUpperCase() !== 'UAH') continue;   // Ducky рахує в гривнях
      const p = String(b.period_type || '').toLowerCase();
      const amount = Number(b.limit_amount);
      if (!isFinite(amount) || amount <= 0) continue;
      let weekly = null; let monthly = null;
      if (p.includes('week') || p.includes('тиж')) {
        const end = new Date(b.month + 'T00:00:00'); end.setDate(end.getDate() + 7);
        if (b.month <= today && today < localISO(end)) { weekly = amount; monthly = (amount * daysInMonth) / 7; }
      } else if (String(b.month).slice(0, 7) === ym) {
        monthly = amount; weekly = (amount * 7) / daysInMonth;
      }
      if (weekly == null) continue;
      const cur = per.get(b.household_id) || { id: b.household_id, name: names.get(b.household_id) || '', monthly: 0, weekly: 0, currency: 'UAH' };
      cur.monthly += monthly; cur.weekly += weekly;
      per.set(b.household_id, cur);
    }
    const options = [...per.values()].sort((x, y) => (roles.get(y.id) === 'owner') - (roles.get(x.id) === 'owner'));
    if (options.length) rivna = { options };
  } catch (e) { rivna = null; }
}
function rivnaCurrent() {
  if (!rivna) return null;
  const want = scope !== 'me' ? scope : state.rivnaHousehold;
  return rivna.options.find((o) => o.id === want) || rivna.options[0];
}
function effectiveBudget() {
  const r = rivnaCurrent();
  if (r && state.budgetMode !== 'manual') return Math.round(r.weekly);
  return Number(state.budget) || 0;
}

const authError = (msg) => ({
  'Invalid login credentials': 'Невірна пошта або пароль.',
  'User already registered': 'Обліковий запис із такою поштою вже є. Увійдіть.',
  'Email not confirmed': 'Спершу підтвердьте пошту за листом.',
}[msg] || msg);

// ---------- реєстрація та вхід (локально, без сервера) ----------
const b64e = (u8) => btoa(String.fromCharCode(...u8));
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashPassword(pw, saltB64) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(saltB64), iterations: 150000, hash: 'SHA-256' }, key, 256);
  return b64e(new Uint8Array(bits));
}
const users = () => store.get(USERS_KEY) || [];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(name, email, pw, pw2) {
  if (!name.trim()) return 'Вкажіть ім\'я.';
  if (!EMAIL_RE.test(email.trim())) return 'Введіть коректну електронну пошту.';
  if (pw.length < 8) return 'Пароль має містити щонайменше 8 символів.';
  if (pw !== pw2) return 'Паролі не збігаються.';
  const list = users();
  if (list.some((u) => u.email === norm(email))) return 'Обліковий запис із такою поштою вже є. Увійдіть.';
  const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
  const u = { id: uid(), name: name.trim(), email: norm(email), salt, hash: await hashPassword(pw, salt) };
  store.set(USERS_KEY, [...list, u]);
  startSession(u);
  return null;
}
async function login(email, pw) {
  const u = users().find((x) => x.email === norm(email));
  // однакове повідомлення для неіснуючої пошти й неправильного пароля
  if (!u || (await hashPassword(pw, u.salt)) !== u.hash) return 'Невірна пошта або пароль.';
  startSession(u);
  return null;
}
function startSession(u) {
  store.set(SESSION_KEY, u.id);
  user = { id: u.id, name: u.name, email: u.email };
  state = loadState(u.id);
  render();
}
async function logout() {
  if (remote) { await sb.auth.signOut(); return; }   // далі спрацює onAuthStateChange
  store.del(SESSION_KEY);
  user = null; state = null; authMode = 'login';
  render();
}

// Запасний варіант, поки не завантажився розумний збіг (more.js перепризначить його)
if (typeof window.foodMatch !== 'function') window.foodMatch = (q, n) => { const a = String(q || '').trim().toLowerCase(); const b = String(n || '').trim().toLowerCase(); return !!a && !!b && (a === b || b.includes(a) || a.includes(b)); };
const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s) => String(s || '').trim().toLowerCase();
const money = (n) => (Math.round(n * 100) / 100).toLocaleString('uk-UA') + ' ₴';
const todayISO = () => new Date().toISOString().slice(0, 10);
// Кількість (штуки/упаковки) і вага/об'єм — окремі поля
// Кількість: число + випадаючий список одиниць (шт, уп, пач…). Значення зберігається рядком «2 шт».
const QTY_UNITS = [['шт', 'шт'], ['уп', 'упаковка'], ['пач', 'пачка'], ['пляш', 'пляшка'], ['банка', 'банка'], ['пакет', 'пакет'], ['порц', 'порція']];
function qtyInput(o = {}) {
  const raw = String(o.value == null ? '' : o.value).trim();
  const m = /^(\d+(?:[.,]\d+)?)\s*([а-яіїєґ]*)\.?$/i.exec(raw);
  const findUnit = (w) => { const t = String(w || '').toLowerCase(); const u = QTY_UNITS.find(([k]) => t && t.startsWith(k)) || (t.startsWith('штук') ? QTY_UNITS[0] : t.startsWith('упак') ? QTY_UNITS[1] : null); return u ? u[0] : null; };
  let num = ''; let unit = 'шт';
  if (raw) {
    if (m) { num = m[1]; unit = m[2] ? (findUnit(m[2]) || '') : ''; if (m[2] && !unit) { num = raw; } }
    else { num = raw; unit = ''; }
  }
  const numEl = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '2', 'aria-label': 'Кількість', value: num });
  const unitEl = h('select', { 'aria-label': 'Одиниця' }, h('option', { value: '' }, '—'), QTY_UNITS.map(([k, t]) => h('option', { value: k, title: t }, k)));
  unitEl.value = unit;
  const hidden = h('input', { type: 'hidden', name: o.name || null });
  const box = h('div', { class: 'qtybox' }, numEl, unitEl, hidden);
  const get = () => { const n = numEl.value.trim(); return n ? n + (unitEl.value ? ' ' + unitEl.value : '') : ''; };
  const sync = () => { hidden.value = get(); if (o.onInput) o.onInput(get()); };
  numEl.addEventListener('input', () => {   // «3 шт» у полі числа: одиниця сама перейде у список
    const t = /^\s*(\d+(?:[.,]\d+)?)\s*([а-яіїєґ]+)\.?\s*$/i.exec(numEl.value);
    const u = t && findUnit(t[2]);
    if (u) { numEl.value = t[1]; unitEl.value = u; }
    sync();
  }); unitEl.addEventListener('change', sync);
  hidden.value = get();
  Object.defineProperty(box, 'value', { get, set: (v) => { const t = qtyInput({ value: v }); numEl.value = t.querySelector('input').value; unitEl.value = t.querySelector('select').value; sync(); } });
  return box;
}
const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(кг|гр|г|мл|л|kg|g|ml|l)(?![а-яіїєґa-z])/i;
function splitQtyWeight(str) {
  const t = String(str == null ? '' : str).trim();
  if (!t) return { qty: '', weight: '' };
  const m = WEIGHT_RE.exec(t);
  if (!m) return { qty: t, weight: '' };
  const rest = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/[·,;xх×*]+\s*$|^\s*[·,;xх×*]+/g, '').replace(/\s+/g, ' ').trim();
  return { qty: rest, weight: m[0].trim() };
}
const qtyText = (p) => [p.qty, p.weight].filter(Boolean).join(' · ');
const measureOf = (p) => (p.weight || p.qty || '');
function migrateWeight(st) {
  if (!st) return;
  const fix = (o) => { if (o && o.weight === undefined) { const r = splitQtyWeight(o.qty); o.qty = r.qty; o.weight = r.weight; } };
  (st.products || []).forEach(fix);
  (st.archive || []).forEach(fix);
  (st.receipts || []).forEach((r) => (r.items || []).forEach(fix));
}
const daysLeft = (iso) => {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const t = new Date(todayISO() + 'T00:00:00');
  return Math.round((d - t) / 864e5);
};
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA') : '—');

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return e;
}

function field(label, name, attrs = {}) {
  return h('label', {}, label, h('input', { name, ...attrs }));
}

// ---------- дані ----------
function latestPrices() {
  // остання відома ціна за назвою продукту: { назва: { store: price } }
  const out = {};
  const sorted = [...state.receipts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const r of sorted) {
    for (const it of r.items) {
      if (it.price == null) continue;
      const k = norm(it.name);
      (out[k] ||= {})[r.store] = it.price;
    }
  }
  return out;
}
function lastKnownPrice(name, prices) {
  const p = prices[norm(name)];
  if (!p) return null;
  const vals = Object.values(p);
  return vals[vals.length - 1];
}
// «Що є вдома»: has(інгредієнт) шукає за змістом («курка» знаходить «куряче філе»), а не за точним текстом
const pantryNames = () => ({ has: (n) => state.products.some((p) => foodMatch(n, p.name)) });


// ---------- спільні блоки ----------
const fmtNum = (v) => v.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
function statsRow(items) {
  return h('div', { class: 'stats' }, items.map(([label, value, suffix]) =>
    h('div', { class: 'card stat' },
      h('div', { class: 'stat-n', 'data-count': value, 'data-suffix': suffix || '' }, fmtNum(value) + (suffix || '')),
      h('div', { class: 'stat-l' }, label))));
}
const receiptSum = (r) => r.items.reduce((s, i) => s + (i.price || 0), 0);
function spent30() {
  const from = new Date(); from.setDate(from.getDate() - 30);
  const f = localISO(from);
  return state.receipts.filter((r) => (r.date || '') >= f).reduce((s, r) => s + receiptSum(r), 0);
}
function recentCard() {
  const list = [...state.receipts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4);
  return h('div', { class: 'card' }, h('h2', {}, 'Останні чеки'),
    list.length
      ? list.map((r) => h('div', { class: 'kv row-line' }, h('span', {}, r.store + ' · ' + fmtDate(r.date)),
        h('span', {}, h('span', { class: 'gold-t' }, money(receiptSum(r))),
          window.DuckyExtras && window.DuckyExtras.editReceipt ? h('button', { class: 'link', type: 'button', onclick: () => window.DuckyExtras.editReceipt(r) }, 'Змінити') : null)))
      : h('p', { class: 'empty' }, 'Ще немає чеків. Додайте перший на вкладці «Скан чека».'));
}

// ---------- екрани ----------
function header(eyebrow, title, emphasis) {
  return [
    h('div', { class: 'eyebrow' }, eyebrow),
    h('h1', {}, title + ' ', h('em', {}, emphasis)),
  ];
}


// Іконки (лінійні, 24x24)
const ICONS = {
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6L7 7 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4',
  bowl: 'M3 11h18a9 9 0 0 1-18 0z M9 7c0-1.5 1-1.5 1-3 M14 7c0-1.5 1-1.5 1-3',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cart: 'M3 4h3l2 11h10l2-8H7 M9 19h.01 M17 19h.01',
  milk: 'M9 3h6l1 4 2 2v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-2z M6 12h12',
  jar: 'M7 4h10v3H7z M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z M6 12h12',
  cheese: 'M3 17V10l17-5v12z M3 17h17 M9 14h.01 M14 11h.01',
  egg: 'M12 3c3.5 0 6 6 6 10a6 6 0 0 1-12 0c0-4 2.5-10 6-10z',
  grain: 'M12 21V9 M12 9c-3 0-4-2-4-4 3 0 4 2 4 4z M12 9c3 0 4-2 4-4-3 0-4 2-4 4z M12 14c-3 0-4-2-4-4 3 0 4 2 4 4z M12 14c3 0 4-2 4-4-3 0-4 2-4 4z',
  bread: 'M5 10a4 4 0 0 1 3-6h8a4 4 0 0 1 3 6v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z M9 12v4 M15 12v4',
  meat: 'M14 4c4 0 7 3 6 7-1 3-4 4-7 4l-3 3a3 3 0 1 1-4-4l3-3c0-3 1-7 5-7z',
  fish: 'M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z M8 12h.01',
  veg: 'M12 8c-4 0-7 3-7 7s3 6 7 6 7-2 7-6-3-7-7-7z M12 8c0-2 1-4 3-5 M12 8c-1-2-3-3-5-3',
  fruit: 'M12 7c-4-2-8 1-7 6s4 8 7 8 6-3 7-8-3-8-7-6z M12 7c0-2 1-3 3-4',
  drink: 'M9 3h6v4l1 2v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l1-2z M8 13h8',
  sweet: 'M4 8l4-3 4 3 4-3 4 3v8l-4 3-4-3-4 3-4-3z',
  spice: 'M8 4h8v3H8z M7 7h10l-1 13H8z M10 12h4',
  frozen: 'M12 3v18 M4.5 7.5l15 9 M19.5 7.5l-15 9',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8',
  pot: 'M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M2 10h20 M9 6c0-1.5 1-1.5 1-3 M14 6c0-1.5 1-1.5 1-3',
  edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
  snow: 'M12 3v18 M4.5 7.5l15 9 M19.5 7.5l-15 9 M9.5 4.5L12 6.5l2.5-2 M9.5 19.5L12 17.5l2.5 2',
  trash: 'M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13',
  shop: 'M4 9l1-5h14l1 5 M4 9v11h16V9 M4 9h16',
};
const ICON_KEYS = [
  ['milk', /молок|кефір|ряжан|вершк|сливк|йогурт|молоч/i], ['jar', /сметан|майонез|варення|джем|мед\b|консерв|соус|кетчуп/i],
  ['cheese', /сир|сыр|масло вершк|бринз/i], ['egg', /яйц|яйк/i], ['grain', /круп|греч|рис|вівс|овс|пшон|макарон|борошн|мука|манк|локшин|паста|спагет/i],
  ['bread', /хліб|хлеб|батон|булк|лаваш|печив/i], ['meat', /м'яс|мяс|курк|куряч|свинин|яловичин|ковбас|сосиск|шинк|фарш|бекон|сало|балик/i],
  ['fish', /риб|лосос|тунец|тунц|оселед|креветк|краб/i], ['veg', /овоч|картопл|картошк|моркв*/i, ], ['fruit', /яблук|яблок|банан|груш|апельсин|лимон|ягод|виноград|полуниц|фрукт/i],
  ['drink', /вод|сік|сок\b|чай|кав|лимонад|пиво|вино|напій/i], ['sweet', /цукерк|шоколад|цукор|сахар|тістечк|торт|десерт|морозив/i],
  ['spice', /сіль|соль|перець|спец|приправ|оцет|олі/i], ['frozen', /заморож|пельмен|вареник/i],
];
ICON_KEYS[8][1] = /овоч|картопл|картошк|морквин|морков|капуст|цибул|помідор|огірок|огурц|буряк|часник|перець солод/i;
function productIcon(name) { const n = String(name || ''); for (const [k, re] of ICON_KEYS) if (re.test(n)) return k; return 'box'; }
function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'i'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.box); svg.append(p);
  return svg;
}

// Підказки назв: власні продукти користувача + короткий довідник поширених
const BASE_FOODS = ('Молоко,Кефір,Ряжанка,Йогурт,Сметана,Вершки,Масло вершкове,Сир твердий,Сир кисломолочний,Сир плавлений,Моцарела,Пармезан,Бринза,Яйця,'
  + 'Хліб,Батон,Лаваш,Борошно,Цукор,Сіль,Олія соняшникова,Олія оливкова,Оцет,Гречка,Рис,Вівсянка,Пшоно,Перлова крупа,Манка,Макарони,Спагеті,Локшина,'
  + 'Картопля,Морква,Цибуля,Часник,Буряк,Капуста,Помідори,Огірки,Перець солодкий,Броколі,Цвітна капуста,Гриби,Кабачок,Баклажан,Зелень,Салат,'
  + 'Яблука,Банани,Апельсини,Лимон,Груші,Виноград,Полуниця,Авокадо,Курка,Куряче філе,Курячі стегна,Свинина,Яловичина,Фарш,Ковбаса,Сосиски,Шинка,Бекон,Сало,'
  + 'Риба,Лосось,Оселедець,Тунець консервований,Креветки,Горошок консервований,Кукурудза консервована,Квасоля,Сочевиця,Нут,Томатна паста,Кетчуп,Майонез,Гірчиця,'
  + 'Чай,Кава,Вода,Сік,Мед,Варення,Шоколад,Печиво,Горіхи,Ізюм,Пельмені,Вареники,Заморожені овочі,Морозиво,Перець чорний,Лавровий лист,Паприка,Кориця,Дріжджі,Розпушувач').split(',');
const BASE_STORES = ['Сільпо', 'АТБ', 'Фора', 'Novus', 'Metro', 'Ашан', 'Varus', 'ЕКО маркет', 'Копійка', 'Мій маркет', 'Наш Край', 'Близенько', 'Аврора', 'Ринок', 'Магазин біля дому', 'Інтернет-замовлення'];
function refreshNames() {
  const seen = new Set(); const out = [];
  const add = (n) => { const t = String(n || '').trim(); const k = norm(t); if (t.length > 1 && !seen.has(k)) { seen.add(k); out.push(t); } };
  [...state.products, ...(state.archive || [])].forEach((p) => add(p.name));
  state.receipts.forEach((r) => (r.items || []).forEach((i) => add(i.name)));
  Object.values(state.barcodes || {}).forEach((b) => add(b && b.name));
  BASE_FOODS.forEach(add);
  // магазини: спершу ті, де вже купували, потім поширені мережі
  const shops = []; const seenS = new Set();
  const addS = (n) => { const t = String(n || '').trim(); const k = norm(t); if (t && !seenS.has(k)) { seenS.add(k); shops.push(t); } };
  state.receipts.forEach((r) => addS(r.store)); state.products.forEach((p) => addS(p.store)); (state.archive || []).forEach((p) => addS(p.store));
  BASE_STORES.forEach(addS);
  let ds = document.getElementById('dl-stores');
  if (!ds) { ds = document.createElement('datalist'); ds.id = 'dl-stores'; document.body.append(ds); }
  const sigS = shops.join('|');
  if (ds.dataset.sig !== sigS) { ds.dataset.sig = sigS; ds.replaceChildren(...shops.map((n) => h('option', { value: n }))); }
  let dl = document.getElementById('dl-products');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-products'; document.body.append(dl); }
  const sig = out.join('|');
  if (dl.dataset.sig !== sig) { dl.dataset.sig = sig; dl.replaceChildren(...out.map((n) => h('option', { value: n }))); }
}

function viewPantry() {
  const form = h('form', { class: 'row', onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name')).trim();
    if (!name) return;
    state.products.push({
      id: uid(), name, qty: String(f.get('qty')).trim(), weight: String(f.get('weight')).trim(), store: String(f.get('store')).trim(),
      price: f.get('price') === '' ? null : Number(f.get('price')), bought: todayISO(), exp: String(f.get('exp')) || null,
    });
    save(); render();
  } },
    field('Продукт', 'name', { required: true, list: 'dl-products', autocomplete: 'off', placeholder: 'Почніть вводити…' }), h('label', {}, 'Кількість', qtyInput({ name: 'qty' })), field('Вага / об\'єм', 'weight', { placeholder: '500 г' }),
    field('Магазин', 'store', { list: 'dl-stores', autocomplete: 'off', placeholder: 'Оберіть або впишіть' }), field('Ціна, ₴', 'price', { type: 'number', min: '0', step: '0.01' }),
    field('Придатний до', 'exp', { type: 'date' }),
    h('button', { class: 'primary', type: 'submit' }, 'Додати'));

  const items = state.products.filter((p) => !p.frozen).sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999'));
  const table = items.length
    ? h('div', { class: 'shelf' }, items.map((p) => {
      const dl = daysLeft(p.exp);
      const m = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(p.weight || '');
      const ex = window.DuckyExtras;
      const btn = (ic, title, fn) => h('button', { class: 'ib', type: 'button', title, 'aria-label': title, onclick: fn }, icon(ic));
      const note = [m && p.qty ? p.qty : '', dl === null ? '' : dl < 0 ? 'прострочено' : 'ще ' + dl + ' дн.'].filter(Boolean).join(' · ');
      return h('div', { class: 'lbl' },
        h('div', { class: 'lico' }, icon(productIcon(p.name))),
        h('div', { class: 'nm' }, p.name),
        h('div', { class: 'wt' }, m ? [m[1], h('small', {}, m[2])] : (p.qty || '—')),
        h('div', { class: dl !== null && dl <= 3 ? 'k warn' : 'k' }, note || (p.exp ? fmtDate(p.exp) : 'без терміну')),
        p.store ? h('div', { class: 'k st' }, icon('shop'), p.store) : null,
        h('div', { class: 'acts' },
          ex ? btn('pot', 'Готую', () => ex.useProduct(p)) : null,
          ex && ex.editProduct ? btn('edit', 'Змінити', () => ex.editProduct(p)) : null,
          ex && ex.toggleFreeze ? btn('snow', 'Заморозити', () => ex.toggleFreeze(p)) : null,
          btn('trash', 'Прибрати', () => {
            if (ex) ex.archiveProduct(p, 'removed'); else state.products = state.products.filter((x) => x.id !== p.id);
            save(); render();
          })));
    }))
    : h('p', { class: 'empty' }, 'У ставку порожньо. Додайте продукт вище або збережіть чек.');

  const soon = items.filter((p) => { const d = daysLeft(p.exp); return d !== null && d <= 3; });
  const side = h('div', { class: 'card gold' },
    h('h2', {}, 'Скоро зіпсуються'),
    soon.length
      ? soon.map((p) => h('div', { class: 'kv' }, h('span', {}, p.name),
        h('span', { class: 'warn' }, daysLeft(p.exp) < 0 ? 'прострочено' : fmtDate(p.exp))))
      : h('p', { class: 'empty' }, 'Нічого, що псується найближчі 3 дні.'));

  const stats = statsRow([['Продуктів у коморі', state.products.length], ['Скоро зіпсуються', soon.length],
    ['Чеків збережено', state.receipts.length], ['Витрачено за 30 днів', Math.round(spent30()), ' ₴']]);
  return [...header('Ставок запасів', 'Що вдома', 'сьогодні'), stats,
    h('div', { class: 'grid pantry-grid' }, h('div', { class: 'card' }, form, table), h('div', { class: 'stack' }, side, recentCard()))];
}

let draft = { store: '', date: todayISO(), lines: [{ name: '', qty: '', weight: '', price: '', exp: '' }] };
function viewScan() {
  const linesBox = h('div', { class: 'lines' });
  const totalEl = h('div', { class: 'total' });
  const updateTotal = () => {
    totalEl.textContent = money(draft.lines.reduce((s, l) => s + (Number(l.price) || 0), 0));
  };
  const drawLines = () => {
    linesBox.replaceChildren(...draft.lines.map((l, i) => h('div', { class: 'line' },
      ...[['name', 'Продукт', 'text'], ['qty', 'Кількість', 'text'], ['weight', 'Вага / об\'єм', 'text'], ['price', 'Ціна, ₴', 'number'], ['exp', 'Придатний до', 'date']].map(([k, ph, type]) =>
        k === 'qty' ? qtyInput({ value: l.qty, onInput: (v) => { l.qty = v; } }) : h('input', { 'aria-label': ph, placeholder: ph, type, list: k === 'name' ? 'dl-products' : null, autocomplete: k === 'name' ? 'off' : null, value: l[k], step: type === 'number' ? '0.01' : null, min: type === 'number' ? '0' : null,
          oninput: (e) => { l[k] = e.target.value; updateTotal(); } })),
      h('button', { class: 'link', type: 'button', onclick: () => {
        draft.lines.splice(i, 1); if (!draft.lines.length) draft.lines.push({ name: '', qty: '', weight: '', price: '', exp: '' }); drawLines(); updateTotal();
      } }, 'Видалити'))));
  };
  drawLines(); updateTotal();

  const msg = h('p', { class: 'note', role: 'status' });
  const form = h('div', { class: 'card' },
    h('div', { class: 'row', style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px' },
      h('label', {}, 'Магазин', h('input', { list: 'dl-stores', autocomplete: 'off', value: draft.store, oninput: (e) => { draft.store = e.target.value; } })),
      h('label', {}, 'Дата', h('input', { type: 'date', value: draft.date, oninput: (e) => { draft.date = e.target.value; } }))),
    linesBox,
    h('button', { class: 'ghost', type: 'button', onclick: () => { draft.lines.push({ name: '', qty: '', weight: '', price: '', exp: '' }); drawLines(); } }, 'Додати позицію'),
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin:24px 0 16px' },
      h('span', { class: 'mute' }, 'РАЗОМ'), totalEl),
    h('button', { class: 'primary', type: 'button', onclick: () => {
      const items = draft.lines.filter((l) => l.name.trim()).map((l) => ({
        name: l.name.trim(), qty: l.qty.trim(), weight: String(l.weight || '').trim(), price: l.price === '' ? null : Number(l.price), exp: l.exp || null,
      }));
      if (!draft.store.trim() || !items.length) { msg.textContent = 'Вкажіть магазин і хоча б одну позицію.'; return; }
      state.receipts.push({ id: uid(), store: draft.store.trim(), date: draft.date || todayISO(), items });
      for (const it of items) {
        state.products.push({ id: uid(), name: it.name, qty: it.qty, weight: it.weight, store: draft.store.trim(), price: it.price, bought: draft.date, exp: it.exp });
      }
      draft = { store: '', date: todayISO(), lines: [{ name: '', qty: '', weight: '', price: '', exp: '' }] };
      state.tab = 'pantry'; save(); render();
    } }, 'Додати в комору'),
    msg,
    h('p', { class: 'note' }, 'Автоматичне розпізнавання фото чека буде пізніше. Поки що позиції вводяться вручну.'));
  const tip = h('div', { class: 'card gold' }, h('h2', {}, 'Порада'),
    h('p', { class: 'mute' }, 'Вписуйте ціну за упаковку: так Ducky зможе порівняти магазини. Дату придатності вказуйте для продуктів, що швидко псуються.'));
  return [...header('Скан чека', 'Чек у', 'комору'), h('div', { class: 'grid' }, form, h('div', { class: 'stack' }, recentCard(), tip))];
}

function viewRecipes() {
  const form = h('form', { class: 'row', onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get('title')).trim();
    const ings = String(f.get('ings')).split(',').map((s) => s.trim()).filter(Boolean);
    if (!title || !ings.length) return;
    state.recipes.push({ id: uid(), title, tech: String(f.get('tech')), minutes: Number(f.get('minutes')) || null,
      servings: Number(f.get('servings')) || null, ings });
    save(); render();
  } },
    field('Назва страви', 'title', { required: true }),
    h('label', {}, 'Техніка', h('select', { name: 'tech' }, APPLIANCES.map((a) => h('option', { value: a }, a || 'Не важливо')))),
    field('Хвилин', 'minutes', { type: 'number', min: '1' }), field('Порцій', 'servings', { type: 'number', min: '1' }),
    h('label', { style: 'grid-column:1/-1' }, 'Інгредієнти (через кому)', h('input', { name: 'ings', required: true, placeholder: 'гречка, цибуля, курка' })),
    h('button', { class: 'primary', type: 'submit' }, 'Зберегти рецепт'));

  const have = pantryNames();
  const prices = latestPrices();
  const list = state.recipes.map((r) => {
    const buy = r.ings.filter((i) => !have.has(norm(i)));
    return { r, buy, got: r.ings.length - buy.length };
  }).sort((a, b) => a.buy.length - b.buy.length);

  const cards = list.length
    ? h('div', { class: 'cards' }, list.map(({ r, buy, got }) => {
      const known = buy.map((i) => lastKnownPrice(i, prices)).filter((x) => x != null);
      const cost = known.length ? money(known.reduce((s, x) => s + x, 0)) + (known.length < buy.length ? ' (частково)' : '') : '—';
      return h('div', { class: 'card' },
        h('div', { class: 'tag' }, r.tech || 'Рецепт'), h('h3', {}, r.title),
        h('div', { class: 'mute' }, [r.minutes && r.minutes + ' хв', r.servings && r.servings + ' порц.'].filter(Boolean).join(' · ') || ' '),
        h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Є вдома'), h('span', {}, got + ' з ' + r.ings.length)),
        h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Докупити'), h('span', {}, buy.length ? buy.join(', ') : 'нічого')),
        h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Вартість докупівлі'), h('span', { class: 'gold-t' }, buy.length ? cost : '0 ₴')),
        window.DuckyExtras ? h('button', { class: 'ghost', type: 'button', onclick: () => window.DuckyExtras.cookRecipe(r) }, 'Приготувала') : null,
        window.DuckyExtras && window.DuckyExtras.editRecipe ? h('button', { class: 'link', type: 'button', onclick: () => window.DuckyExtras.editRecipe(r) }, 'Змінити') : null,
        r.steps && r.steps.length ? h('details', { class: 'steps' }, h('summary', {}, 'Приготування'), h('ol', {}, r.steps.map((t) => h('li', {}, t)))) : null,
        h('button', { class: 'link', type: 'button', onclick: () => { state.recipes = state.recipes.filter((x) => x.id !== r.id); save(); render(); } }, 'Видалити'));
    }))
    : h('p', { class: 'empty' }, 'Додайте перший рецепт. Ducky покаже, що з нього вже є вдома, а що докупити.');
  const ready = list.filter((x) => !x.buy.length).length;
  const stats = statsRow([['Рецептів', state.recipes.length], ['Можна готувати зараз', ready], ['Продуктів у коморі', state.products.length]]);
  return [...header('Рецепти', 'З того, що', 'є вдома'), stats,
    h('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr) minmax(0,2fr)' },
      h('div', { class: 'card' }, h('h2', {}, 'Новий рецепт'), form), cards)];
}

function viewMenu() {
  const shopBox = h('div', { class: 'card gold' });
  const drawShop = () => {
    const have = pantryNames(); const prices = latestPrices();
    const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
    const need = new Map();
    for (const v of Object.values(state.menu)) {
      const r = byTitle.get(norm(v));
      if (!r) continue;
      for (const i of r.ings) if (!have.has(norm(i))) need.set(norm(i), i);
    }
    const names = [...need.values()];
    const known = names.map((n) => lastKnownPrice(n, prices)).filter((x) => x != null);
    const sum = known.reduce((s, x) => s + x, 0);
    const budget = effectiveBudget();
    shopBox.replaceChildren(
      h('h2', {}, 'Список покупок'),
      ...(names.length ? names.map((n) => h('div', { class: 'kv' }, h('span', {}, n),
        h('span', { class: 'mute' }, lastKnownPrice(n, prices) != null ? money(lastKnownPrice(n, prices)) : '—')))
        : [h('p', { class: 'empty' }, 'Впишіть у меню назви збережених рецептів, і тут з\'явиться, що докупити.')]),
      h('div', { style: 'border-top:1px solid var(--line);margin-top:16px;padding-top:12px' },
        h('div', { class: 'mute' }, 'РАЗОМ' + (known.length < names.length ? ' (за відомими цінами)' : '')),
        h('div', { class: 'total' }, money(sum)),
        budget ? h('div', { class: sum > budget ? 'warn' : 'mute' }, 'Бюджет: ' + money(budget) + (sum > budget ? ' (перевищено)' : '')) : null));
  };
  const dl = h('datalist', { id: 'recipeTitles' }, state.recipes.map((r) => h('option', { value: r.title })));
  const table = h('div', { class: 'scroll' }, h('table', { class: 'menu' },
    h('tr', {}, h('th', {}, ''), DAYS.map((d) => h('th', {}, d))),
    MEALS.map(([mk, ml]) => h('tr', {}, h('td', { class: 'mute' }, ml),
      DAYS.map((_, di) => h('td', {}, h('input', { list: 'recipeTitles', 'aria-label': ml + ', ' + DAYS[di], value: state.menu[di + '-' + mk] || '',
        oninput: (e) => { state.menu[di + '-' + mk] = e.target.value; save(); drawShop(); } })))))));
  drawShop();
  const budgetBox = h('div', { style: 'margin-bottom:20px' });
  const refresh = () => { drawBudget(); drawShop(); };
  function drawBudget() {
    const r = rivnaCurrent();
    if (r && state.budgetMode !== 'manual') {
      budgetBox.replaceChildren(h('div', { class: 'card gold', style: 'max-width:540px' },
        h('div', { class: 'tag' }, 'Бюджет тижня · з Rivna app'),
        h('div', { class: 'total' }, money(Math.round(r.weekly))),
        h('div', { class: 'mute' }, 'Ліміт категорії «Продукти» на місяць: ' + money(r.monthly) + (r.name ? ' · ' + r.name : '')),
        rivna.options.length > 1 ? h('label', { style: 'margin-top:12px' }, 'Домогосподарство',
          h('select', { onchange: (e) => { state.rivnaHousehold = e.target.value; save(); refresh(); } },
            rivna.options.map((o) => h('option', { value: o.id, selected: o.id === r.id ? true : null }, o.name || 'Без назви')))) : null,
        h('button', { class: 'link', type: 'button', onclick: () => { state.budgetMode = 'manual'; save(); refresh(); } }, 'Вказати вручну')));
    } else {
      budgetBox.replaceChildren(
        h('label', { style: 'max-width:240px' }, 'Тижневий бюджет, ₴',
          h('input', { type: 'number', min: '0', value: state.budget, oninput: (e) => { state.budget = e.target.value; save(); drawShop(); } })),
        ...(r ? [h('button', { class: 'link', type: 'button', onclick: () => { state.budgetMode = 'rivna'; save(); refresh(); } }, 'Взяти з Rivna app')] : []));
    }
  }
  drawBudget();
  return [...header('Меню на тиждень', 'Сім днів', 'без хаосу'), budgetBox, dl,
    h('div', { class: 'grid', style: 'grid-template-columns:minmax(0,2fr) minmax(260px,1fr)' }, h('div', { class: 'card' }, table), shopBox)];
}

function viewStores() {
  const prices = latestPrices();
  const stores = [...new Set(state.receipts.map((r) => r.store))].sort();
  const names = Object.keys(prices).sort();
  let body;
  if (!names.length) {
    body = h('p', { class: 'empty' }, 'Немає даних. Збережіть чеки з цінами з різних магазинів, і Ducky порівняє їх.');
  } else {
    body = h('div', { class: 'scroll' }, h('table', {},
      h('tr', {}, h('th', {}, 'Продукт'), stores.map((s) => h('th', {}, s)), h('th', {}, 'Вигідніше')),
      names.map((n) => {
        const row = prices[n]; const vals = Object.entries(row);
        const best = vals.length > 1 ? vals.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
        return h('tr', {}, h('td', { class: 'name' }, n),
          stores.map((s) => h('td', {}, row[s] != null ? h('span', { class: best && best[0] === s ? 'best' : 'mute' }, money(row[s])) : h('span', { class: 'mute' }, '—'))),
          h('td', { class: 'gold-t' }, best ? best[0] : 'мало даних'));
      })));
  }
  const compared = names.filter((n) => Object.keys(prices[n]).length > 1).length;
  const stats = statsRow([['Чеків', state.receipts.length], ['Магазинів', stores.length], ['Товарів у порівнянні', compared]]);
  return [...header('Аналіз цін', 'Де купувати', 'вигідніше'), stats, h('div', { class: 'card' }, body),
    h('p', { class: 'note' }, 'Порівняння лише за вашими чеками, за останньою ціною. Порівнюйте однакові упаковки.')];
}

const VIEWS = { pantry: viewPantry, scan: viewScan, recipes: viewRecipes, menu: viewMenu, stores: viewStores };

function emblem() {
  const d = h('div', { class: 'auth-emblem', 'aria-hidden': 'true' });
  const f = (k, pts, style) => '<polygon class="facet" style="--k:' + k + ';' + style + '" points="' + pts + '"/>';
  d.innerHTML = '<svg viewBox="0 0 100 100">'
    + '<g fill="none" stroke="currentColor" stroke-width="1.2"><ellipse class="rp" cx="50" cy="85" rx="30" ry="6"/><ellipse class="rp" style="animation-delay:1s" cx="50" cy="85" rx="30" ry="6"/><ellipse class="rp" style="animation-delay:2s" cx="50" cy="85" rx="30" ry="6"/></g>'
    + f(0, '12,62 40,46 64,52 86,66 56,80 34,80', 'fill:var(--duck-body)')
    + f(1, '50,52 58,30 76,34 70,52', 'fill:var(--duck-body)')
    + f(2, '40,46 64,52 40,72', 'fill:#fff;opacity:.28')
    + f(3, '12,62 40,72 34,80', 'fill:#000;opacity:.18')
    + f(4, '40,72 56,80 34,80', 'fill:#000;opacity:.1')
    + f(5, '58,30 76,34 64,44', 'fill:#fff;opacity:.3')
    + f(6, '74,36 94,43 74,48', 'fill:var(--duck-beak)')
    + '<circle class="eye" cx="67" cy="39" r="2.4" style="fill:var(--duck-eye)"/></svg>';
  return d;
}

function viewAuthRemote() {
  if (authMode === 'recovery') {
    const msg = h('p', { class: 'form-error', role: 'alert' });
    return [h('div', { class: 'auth' },
      h('div', { class: 'eyebrow' }, 'Відновлення доступу'), h('h1', {}, 'Новий', ' ', h('em', {}, 'пароль')),
      h('div', { class: 'card' }, h('form', { class: 'auth-form', onsubmit: async (e) => {
        e.preventDefault();
        const pw = String(new FormData(e.target).get('pw'));
        if (pw.length < 8) { msg.textContent = 'Пароль має містити щонайменше 8 символів.'; return; }
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) { msg.textContent = authError(error.message); return; }
        authMode = 'login'; render();
      } }, h('label', {}, 'Новий пароль', h('input', { name: 'pw', type: 'password', autocomplete: 'new-password' })), msg,
      h('button', { class: 'primary', type: 'submit' }, 'Зберегти пароль'))))];
  }
  const isReg = authMode === 'register';
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const info = h('p', { class: 'note', role: 'status' });
  const email = h('input', { name: 'email', type: 'email', autocomplete: 'email' });
  const form = h('form', { class: 'auth-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg.textContent = ''; info.textContent = '';
    const mail = String(f.get('email')).trim(); const pw = String(f.get('pw'));
    if (!EMAIL_RE.test(mail)) { msg.textContent = 'Введіть коректну електронну пошту.'; return; }
    if (isReg) {
      if (!String(f.get('name')).trim()) { msg.textContent = 'Вкажіть ім\'я.'; return; }
      if (pw.length < 8) { msg.textContent = 'Пароль має містити щонайменше 8 символів.'; return; }
      if (pw !== String(f.get('pw2'))) { msg.textContent = 'Паролі не збігаються.'; return; }
      const { data, error } = await sb.auth.signUp({ email: mail, password: pw, options: { data: { full_name: String(f.get('name')).trim() } } });
      if (error) { msg.textContent = authError(error.message); return; }
      if (!data.session) info.textContent = 'Ми надіслали лист для підтвердження. Перейдіть за посиланням у ньому, потім увійдіть.';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: mail, password: pw });
      if (error) msg.textContent = authError(error.message);
    }
  } },
    isReg && h('label', {}, 'Ім\'я', h('input', { name: 'name', autocomplete: 'name' })),
    h('label', {}, 'Електронна пошта', email),
    h('label', {}, 'Пароль', h('input', { name: 'pw', type: 'password', autocomplete: isReg ? 'new-password' : 'current-password' })),
    isReg && h('label', {}, 'Повторіть пароль', h('input', { name: 'pw2', type: 'password', autocomplete: 'new-password' })),
    msg,
    h('button', { class: 'primary', type: 'submit' }, isReg ? 'Створити обліковий запис' : 'Увійти'),
    !isReg && h('button', { class: 'link', type: 'button', onclick: async () => {
      msg.textContent = ''; info.textContent = '';
      const mail = email.value.trim();
      if (!EMAIL_RE.test(mail)) { msg.textContent = 'Спершу введіть пошту у поле вище.'; return; }
      const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname });
      if (error) msg.textContent = authError(error.message); else info.textContent = 'Якщо така пошта є, ми надіслали лист для відновлення.';
    } }, 'Забули пароль?'));
  return [h('div', { class: 'auth' },
    emblem(),
    h('div', { class: 'eyebrow' }, isReg ? 'Ласкаво просимо' : 'З поверненням'),
    h('h1', {}, isReg ? 'Створіть свій' : 'Увійдіть у свій', ' ', h('em', {}, 'ставок')),
    h('div', { class: 'card' },
      h('button', { class: 'ghost wide', type: 'button', onclick: async () => {
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
        if (error) msg.textContent = authError(error.message);
      } }, 'Увійти через Google'),
      h('div', { class: 'or' }, 'або поштою'), form, info),
    h('p', { class: 'note' }, isReg ? 'Уже є обліковий запис? ' : 'Ще немає облікового запису? ',
      h('button', { class: 'link', type: 'button', onclick: () => { authMode = isReg ? 'login' : 'register'; render(); } },
        isReg ? 'Увійти' : 'Зареєструватися')),
    h('p', { class: 'note' }, 'Обліковий запис спільний із Rivna app: увійдіть тією ж поштою та паролем або через Google.'))];
}

function viewAuth() {
  if (remote) return viewAuthRemote();
  const isReg = authMode === 'register';
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'auth-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    msg.textContent = '';
    if (!(window.crypto && crypto.subtle)) { msg.textContent = 'Цей браузер не підтримує безпечне збереження пароля.'; return; }
    const err = isReg
      ? await register(String(f.get('name')), String(f.get('email')), String(f.get('pw')), String(f.get('pw2')))
      : await login(String(f.get('email')), String(f.get('pw')));
    if (err) msg.textContent = err;
  } },
    isReg && h('label', {}, 'Ім\'я', h('input', { name: 'name', autocomplete: 'name' })),
    h('label', {}, 'Електронна пошта', h('input', { name: 'email', type: 'email', autocomplete: 'email' })),
    h('label', {}, 'Пароль', h('input', { name: 'pw', type: 'password', autocomplete: isReg ? 'new-password' : 'current-password' })),
    isReg && h('label', {}, 'Повторіть пароль', h('input', { name: 'pw2', type: 'password', autocomplete: 'new-password' })),
    msg,
    h('button', { class: 'primary', type: 'submit' }, isReg ? 'Створити обліковий запис' : 'Увійти'));
  return [h('div', { class: 'auth' },
    emblem(),
    h('div', { class: 'eyebrow' }, isReg ? 'Ласкаво просимо' : 'З поверненням'),
    h('h1', {}, isReg ? 'Створіть свій' : 'Увійдіть у свій', ' ', h('em', {}, 'ставок')),
    h('div', { class: 'card' }, form),
    h('p', { class: 'note' }, isReg ? 'Уже є обліковий запис? ' : 'Ще немає облікового запису? ',
      h('button', { class: 'link', type: 'button', onclick: () => { authMode = isReg ? 'login' : 'register'; render(); } },
        isReg ? 'Увійти' : 'Зареєструватися')),
    h('p', { class: 'note' }, 'Обліковий запис зберігається лише в цьому браузері, на вашому пристрої. Відновити пароль неможливо.'))];
}

const fxDone = (key) => { if (window.DuckyFX) window.DuckyFX.afterRender(key); };

function render() {
  const hasUser = !!user;
  $nav.hidden = !hasUser;
  $who.hidden = !hasUser;
  $logout.hidden = !hasUser;
  if (!hasUser && !authReady) { $view.replaceChildren(h('p', { class: 'empty' }, 'Завантаження…')); return; }
  if (!hasUser) { $view.replaceChildren(...viewAuth()); fxDone('auth-' + authMode); return; }
  $who.textContent = user.name;
  migrateWeight(state);
  refreshNames();
  drawScope();
  if (!VIEWS[state.tab]) state.tab = 'pantry';
  $nav.replaceChildren(...TABS.map(([k, t]) => h('button', { type: 'button', 'aria-current': k === state.tab ? 'page' : null,
    onclick: () => { state.tab = k; saveLocal(); render(); } }, t)));
  $view.replaceChildren(...VIEWS[state.tab]());
  fxDone(state.tab);
}

function applyTheme() {
  const saved = store.get(THEME_KEY);
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $theme.textContent = dark ? 'Світла тема' : 'Темна тема';
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = dark ? '#0b1220' : '#f4f6fb';
  if (window.DuckyFX) window.DuckyFX.refreshColors();
}

const $nav = document.getElementById('nav');
const $view = document.getElementById('view');
const $theme = document.getElementById('themeBtn');
const $who = document.getElementById('who');
const $logout = document.getElementById('logoutBtn');
const $sync = document.getElementById('sync');
const $scope = document.getElementById('scopeSel');
let scopeSig = '';
function drawScope() {
  const show = !!(user && remote && memberships.length);
  $scope.hidden = !show;
  if (!show) { scopeSig = ''; return; }
  const sig = scope + '|' + memberships.map((m) => m.id + m.name).join(',');
  if (sig === scopeSig) return;
  scopeSig = sig;
  $scope.replaceChildren(h('option', { value: 'me' }, 'Моя комора'),
    ...memberships.map((m) => h('option', { value: m.id }, 'Сім\'я: ' + m.name)));
  $scope.value = scope;
}
$scope.addEventListener('change', () => switchScope($scope.value));
$theme.addEventListener('click', () => {
  const go = () => {
    store.set(THEME_KEY, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    applyTheme();
  };
  const r = $theme.getBoundingClientRect();
  if (window.DuckyFX) window.DuckyFX.themeTransition(go, r.left + r.width / 2, r.top + r.height / 2); else go();
});
$logout.addEventListener('click', logout);
applyTheme();

// перший екран: реєстрація; якщо вже є сесія, відкриваємо комору
(function boot() {
  if (remote) {
    authMode = store.get('ducky.seen') ? 'login' : 'register';
    sb.auth.onAuthStateChange((event, session) => {
      authReady = true;
      if (event === 'PASSWORD_RECOVERY') { authMode = 'recovery'; }
      if (session && session.user && event !== 'PASSWORD_RECOVERY') {
        setTimeout(() => enterRemote(session.user), 0);   // не викликаємо supabase усередині колбека
      } else if (!session) {
        unsubscribeRealtime(); memberships = []; scope = 'me';
        user = null; state = null; remoteReady = false; rivna = null; setSync('');
        if (event === 'SIGNED_OUT') authMode = 'login';
        render();
      } else { render(); }
    });
    setTimeout(() => { if (!authReady) { authReady = true; render(); } }, 4000);
    render();
    return;
  }
  const sid = store.get(SESSION_KEY);
  const u = sid && users().find((x) => x.id === sid);
  if (u) { user = { id: u.id, name: u.name, email: u.email }; state = loadState(u.id); }
  else authMode = users().length ? 'login' : 'register';
  render();
})();
