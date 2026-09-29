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

const defaults = () => ({ products: [], receipts: [], recipes: [], menu: {}, budget: '', tab: 'pantry' });
let state = null;      // дані поточного користувача
let user = null;       // { id, name, email }
let authMode = 'register';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* пам'ять: ігноруємо */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ігноруємо */ } },
};
function loadState(userId) {
  const s = store.get(KEY + '.' + userId);
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
function save() {
  if (!state || !user) return;
  store.set(KEY + '.' + user.id, state);
  if (remote && remoteReady) {
    clearTimeout(syncTimer);
    setSync('Зберігаємо…');
    syncTimer = setTimeout(pushRemote, 600);
  }
}
async function pushRemote() {
  if (!remote || !user || !remoteReady) return;
  const { error } = await sb.from('ducky_data').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
  setSync(error ? 'Не вдалося зберегти' : 'Збережено', !!error);
}
async function enterRemote(sbUser) {
  if (user && user.id === sbUser.id) return;
  const meta = sbUser.user_metadata || {};
  user = { id: sbUser.id, name: meta.full_name || meta.name || (sbUser.email || '').split('@')[0], email: sbUser.email };
  state = loadState(user.id);           // локальний кеш, поки вантажимо
  remoteReady = false;
  store.set('ducky.seen', 1);
  render();
  const { data, error } = await sb.from('ducky_data').select('data').eq('user_id', user.id).maybeSingle();
  if (error) { setSync('Не вдалося завантажити дані', true); return; }
  remoteReady = true;
  if (data && data.data && typeof data.data === 'object') { state = { ...defaults(), ...data.data }; setSync('Синхронізовано'); }
  else await pushRemote();              // перший вхід: завантажуємо локальний кеш у базу
  render();
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

const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s) => String(s || '').trim().toLowerCase();
const money = (n) => (Math.round(n * 100) / 100).toLocaleString('uk-UA') + ' ₴';
const todayISO = () => new Date().toISOString().slice(0, 10);
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
const pantryNames = () => new Set(state.products.map((p) => norm(p.name)));

// ---------- екрани ----------
function header(eyebrow, title, emphasis) {
  return [
    h('div', { class: 'eyebrow' }, eyebrow),
    h('h1', {}, title + ' ', h('em', {}, emphasis)),
  ];
}

function viewPantry() {
  const form = h('form', { class: 'row', onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name')).trim();
    if (!name) return;
    state.products.push({
      id: uid(), name, qty: String(f.get('qty')).trim(), store: String(f.get('store')).trim(),
      price: f.get('price') === '' ? null : Number(f.get('price')), bought: todayISO(), exp: String(f.get('exp')) || null,
    });
    save(); render();
  } },
    field('Продукт', 'name', { required: true }), field('Кількість', 'qty', { placeholder: '500 г' }),
    field('Магазин', 'store'), field('Ціна, ₴', 'price', { type: 'number', min: '0', step: '0.01' }),
    field('Придатний до', 'exp', { type: 'date' }),
    h('button', { class: 'primary', type: 'submit' }, 'Додати'));

  const items = [...state.products].sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999'));
  const table = items.length
    ? h('div', { class: 'scroll' }, h('table', {},
      h('tr', {}, ['Продукт', 'Кількість', 'Магазин', 'Придатний до', ''].map((t) => h('th', {}, t))),
      items.map((p) => {
        const dl = daysLeft(p.exp);
        return h('tr', {},
          h('td', { class: 'name' }, p.name), h('td', { class: 'mute' }, p.qty || '—'),
          h('td', { class: 'mute' }, p.store || '—'),
          h('td', { class: dl !== null && dl <= 3 ? 'warn' : 'mute' }, fmtDate(p.exp)),
          h('td', {}, h('button', { class: 'link', type: 'button', onclick: () => {
            state.products = state.products.filter((x) => x.id !== p.id); save(); render();
          } }, 'Прибрати')));
      })))
    : h('p', { class: 'empty' }, 'У ставку порожньо. Додайте продукт вище або збережіть чек.');

  const soon = items.filter((p) => { const d = daysLeft(p.exp); return d !== null && d <= 3; });
  const side = h('div', { class: 'card gold' },
    h('h2', {}, 'Скоро зіпсуються'),
    soon.length
      ? soon.map((p) => h('div', { class: 'kv' }, h('span', {}, p.name),
        h('span', { class: 'warn' }, daysLeft(p.exp) < 0 ? 'прострочено' : fmtDate(p.exp))))
      : h('p', { class: 'empty' }, 'Нічого, що псується найближчі 3 дні.'));

  return [...header('Ставок запасів', 'Що вдома', 'сьогодні'), h('div', { class: 'card' }, form, table), h('div', { style: 'height:24px' }), side];
}

let draft = { store: '', date: todayISO(), lines: [{ name: '', qty: '', price: '', exp: '' }] };
function viewScan() {
  const linesBox = h('div', { class: 'lines' });
  const totalEl = h('div', { class: 'total' });
  const updateTotal = () => {
    totalEl.textContent = money(draft.lines.reduce((s, l) => s + (Number(l.price) || 0), 0));
  };
  const drawLines = () => {
    linesBox.replaceChildren(...draft.lines.map((l, i) => h('div', { class: 'line' },
      ...[['name', 'Продукт', 'text'], ['qty', 'Кількість', 'text'], ['price', 'Ціна, ₴', 'number'], ['exp', 'Придатний до', 'date']].map(([k, ph, type]) =>
        h('input', { 'aria-label': ph, placeholder: ph, type, value: l[k], step: type === 'number' ? '0.01' : null, min: type === 'number' ? '0' : null,
          oninput: (e) => { l[k] = e.target.value; updateTotal(); } })),
      h('button', { class: 'link', type: 'button', onclick: () => {
        draft.lines.splice(i, 1); if (!draft.lines.length) draft.lines.push({ name: '', qty: '', price: '', exp: '' }); drawLines(); updateTotal();
      } }, 'Видалити'))));
  };
  drawLines(); updateTotal();

  const msg = h('p', { class: 'note', role: 'status' });
  const form = h('div', { class: 'card' },
    h('div', { class: 'row', style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px' },
      h('label', {}, 'Магазин', h('input', { value: draft.store, oninput: (e) => { draft.store = e.target.value; } })),
      h('label', {}, 'Дата', h('input', { type: 'date', value: draft.date, oninput: (e) => { draft.date = e.target.value; } }))),
    linesBox,
    h('button', { class: 'ghost', type: 'button', onclick: () => { draft.lines.push({ name: '', qty: '', price: '', exp: '' }); drawLines(); } }, 'Додати позицію'),
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin:24px 0 16px' },
      h('span', { class: 'mute' }, 'РАЗОМ'), totalEl),
    h('button', { class: 'primary', type: 'button', onclick: () => {
      const items = draft.lines.filter((l) => l.name.trim()).map((l) => ({
        name: l.name.trim(), qty: l.qty.trim(), price: l.price === '' ? null : Number(l.price), exp: l.exp || null,
      }));
      if (!draft.store.trim() || !items.length) { msg.textContent = 'Вкажіть магазин і хоча б одну позицію.'; return; }
      state.receipts.push({ id: uid(), store: draft.store.trim(), date: draft.date || todayISO(), items });
      for (const it of items) {
        state.products.push({ id: uid(), name: it.name, qty: it.qty, store: draft.store.trim(), price: it.price, bought: draft.date, exp: it.exp });
      }
      draft = { store: '', date: todayISO(), lines: [{ name: '', qty: '', price: '', exp: '' }] };
      state.tab = 'pantry'; save(); render();
    } }, 'Додати в комору'),
    msg,
    h('p', { class: 'note' }, 'Автоматичне розпізнавання фото чека буде пізніше. Поки що позиції вводяться вручну.'));
  return [...header('Скан чека', 'Чек у', 'комору'), form];
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
        h('button', { class: 'link', type: 'button', onclick: () => { state.recipes = state.recipes.filter((x) => x.id !== r.id); save(); render(); } }, 'Видалити'));
    }))
    : h('p', { class: 'empty' }, 'Додайте перший рецепт. Ducky покаже, що з нього вже є вдома, а що докупити.');
  return [...header('Рецепти', 'З того, що', 'є вдома'), h('div', { class: 'card' }, form), h('div', { style: 'height:24px' }), cards];
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
    const budget = Number(state.budget) || 0;
    shopBox.replaceChildren(
      h('h2', {}, 'Список покупок'),
      names.length ? names.map((n) => h('div', { class: 'kv' }, h('span', {}, n),
        h('span', { class: 'mute' }, lastKnownPrice(n, prices) != null ? money(lastKnownPrice(n, prices)) : '—')))
        : h('p', { class: 'empty' }, 'Впишіть у меню назви збережених рецептів, і тут з\'явиться, що докупити.'),
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
  const budget = h('label', { style: 'max-width:240px;margin-bottom:20px' }, 'Тижневий бюджет, ₴',
    h('input', { type: 'number', min: '0', value: state.budget, oninput: (e) => { state.budget = e.target.value; save(); drawShop(); } }));
  return [...header('Меню на тиждень', 'Сім днів', 'без хаосу'), budget, dl,
    h('div', { class: 'grid' }, h('div', { class: 'card' }, table), shopBox)];
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
  return [...header('Аналіз цін', 'Де купувати', 'вигідніше'), h('div', { class: 'card' }, body),
    h('p', { class: 'note' }, 'Порівняння лише за вашими чеками, за останньою ціною. Порівнюйте однакові упаковки.')];
}

const VIEWS = { pantry: viewPantry, scan: viewScan, recipes: viewRecipes, menu: viewMenu, stores: viewStores };

function emblem() {
  const d = h('div', { class: 'auth-emblem', 'aria-hidden': 'true' });
  d.innerHTML = '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round">'
    + '<circle class="ring" pathLength="1" cx="18" cy="18" r="16.5"/>'
    + '<path class="duck" pathLength="1" d="M11 22c0-5 3-9 8-9 3 0 5 2 5 4.5 0 1.5-.8 2.5-2 3M24 17l4 1-4 2M11 22c2 4 8 5 12 2"/>'
    + '<circle class="eye" cx="21" cy="15" r="0.8" fill="currentColor" stroke="none"/>'
    + '<path class="wave" d="M6 28q3-2 6 0t6 0t6 0t6 0" stroke-width="0.7"/>'
    + '<path class="wave b" d="M8 31q3-2 6 0t6 0t6 0" stroke-width="0.6"/></svg>';
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
  if (!VIEWS[state.tab]) state.tab = 'pantry';
  $nav.replaceChildren(...TABS.map(([k, t]) => h('button', { type: 'button', 'aria-current': k === state.tab ? 'page' : null,
    onclick: () => { state.tab = k; save(); render(); } }, t)));
  $view.replaceChildren(...VIEWS[state.tab]());
  fxDone(state.tab);
}

function applyTheme() {
  const saved = store.get(THEME_KEY);
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $theme.textContent = dark ? 'Світла тема' : 'Темна тема';
  if (window.DuckyFX) window.DuckyFX.refreshColors();
}

const $nav = document.getElementById('nav');
const $view = document.getElementById('view');
const $theme = document.getElementById('themeBtn');
const $who = document.getElementById('who');
const $logout = document.getElementById('logoutBtn');
const $sync = document.getElementById('sync');
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
        user = null; state = null; remoteReady = false; setSync('');
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
