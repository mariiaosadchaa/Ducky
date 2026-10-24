// Ducky: поле «Скажи Ducky» у коморі. Пишеш текстом, що купила, закінчилось чи викинула; ШІ пропонує зміни,
// ти підтверджуєш, і застосунок їх вносить. Нічого не змінюється без підтвердження, останню зміну можна скасувати.
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || !window.DuckyExtras) return;
  const X = window.DuckyExtras;
  let draft = ''; let busy = false; let msg = ''; let pending = null; let undo = null; let off = new Set();
  const isW = (t) => /(^|\d|\s)(г|кг|мл|л|g|kg|ml|l)\.?$/i.test(String(t || '').trim());
  const REASON = { used: 'використано', thrown: 'викинуто', removed: 'прибрано' };
  const qtyText = (q, w) => [q, w].filter(Boolean).join(' · ');

  function lines(p) {
    const byId = new Map(state.products.map((x) => [x.id, x]));
    const out = [];
    p.actions.forEach((a, i) => {
      const n0 = out.length;
      if (a.op === 'add') out.push({ sign: '+', cls: 'pa-add', text: 'Додати: ' + a.name + (qtyText(a.qty, a.weight) ? ' · ' + qtyText(a.qty, a.weight) : '') + (a.exp ? ' · до ' + a.exp : '') + (a.price != null ? ' · ' + a.price + ' ₴' : '') });
      else if (a.op === 'remove') { const x = byId.get(a.id); if (x) out.push({ sign: '−', cls: 'pa-rm', text: 'Прибрати: ' + x.name + ' (' + REASON[a.reason] + ')' }); }
      else if (a.op === 'update') { const x = byId.get(a.id); if (x) out.push({ sign: '✎', cls: 'pa-up', text: 'Змінити: ' + x.name + ' · ' + (qtyText(x.qty, x.weight) || 'без кількості') + ' → ' + (qtyText(a.qty || x.qty, a.weight || x.weight)) }); }
      else if (a.op === 'use') { const x = byId.get(a.id); if (x) out.push({ sign: '−', cls: 'pa-rm', text: 'Витрачено: ' + x.name + (a.used ? ' · ' + a.used + (a.exp ? ' (орієнтовно)' : '') : '') + (a.left === '' ? ' · закінчиться' : a.left ? ' · лишиться ' + a.left : ' · кількість не змінюю, перевір сама') }); }
      for (let k = n0; k < out.length; k++) out[k].i = i;
    });
    return out;
  }

  async function run() {
    const text = draft.trim();
    if (text.length < 2) { msg = 'Напишіть, що змінити, наприклад: «купила 2 л молока, закінчився хліб».'; render(); return; }
    const wipe = /(видал|прибер|очист|викин|спиш)\S*\s+(усі|всі|все|всю|повністю)?\s*(продукти|продуктів|комору|комору|їжу|все)\s*[.!]?$/i.test(text) || /^(очисти|видали|прибери)\s+комору\s*[.!]?$/i.test(text);
    if (wipe) {
      if (!state.products.length) { msg = 'Комора вже порожня.'; render(); return; }
      pending = { actions: state.products.map((p) => ({ op: 'remove', id: p.id, reason: 'removed' })), notFound: [] }; off = new Set();
      msg = 'Приберу всі продукти (' + state.products.length + '). Зніми галочки з тих, що лишити. Усе потрапить в «Архів», і зміну можна скасувати.'; render(); return;
    }
    busy = true; msg = ''; pending = null; render();
    try {
      const res = await X.callApi('/api/edit-pantry', { text, today: todayISO(), products: state.products.map((p) => ({ id: p.id, name: p.name, qty: p.qty || '', weight: p.weight || '' })) });
      pending = res; off = new Set();
      if (!lines(res).length && !(res.notFound || []).length) { pending = null; msg = 'Не знайшла змін для комори.'; }
    } catch (e) { msg = e.message; }
    busy = false; render();
  }

  function apply() {
    if (!pending) return;
    const snap = JSON.parse(JSON.stringify({ products: state.products, archive: state.archive || [] }));
    let add = 0; let rm = 0; let up = 0;
    for (let i = 0; i < pending.actions.length; i++) {
      const a = pending.actions[i]; if (off.has(i)) continue;
      if (a.op === 'add') { state.products.push({ id: uid(), name: a.name, qty: a.qty || '', weight: a.weight || '', store: a.store || '', price: a.price == null ? null : a.price, bought: todayISO(), exp: a.exp || null }); add++; }
      else if (a.op === 'remove') { const p = state.products.find((x) => x.id === a.id); if (p) { X.archiveProduct(p, a.reason); rm++; } }
      else if (a.op === 'update') { const p = state.products.find((x) => x.id === a.id); if (p) { if (a.qty) p.qty = a.qty; if (a.weight) p.weight = a.weight; up++; } }
      else if (a.op === 'use') {
        const p = state.products.find((x) => x.id === a.id); if (!p) continue;
        if (a.left === '') { X.archiveProduct(p, 'used'); rm++; }
        else if (a.left) { if (isW(a.left)) p.weight = a.left; else p.qty = a.left; up++; }
      }
    }
    save(); undo = snap; pending = null; draft = ''; off = new Set(); if (inboxIds.length) clearInbox(inboxIds).then(render);
    msg = 'Готово: додано ' + add + ', прибрано ' + rm + ', змінено ' + up + '.';
    render();
  }

  // ---------- швидкі команди iPhone: черга з Supabase ----------
  const SB = () => (typeof sb !== 'undefined' && sb && typeof user !== 'undefined' && user) ? sb : null;
  let inbox = []; let inboxLoaded = false; let inboxIds = []; let key = null; let keyOpen = false; let keyMsg = '';
  async function loadInbox() {
    const c = SB(); if (!c) return;
    try {
      const r = await c.from('ducky_inbox').select('id, text, created_at').order('created_at', { ascending: true }).limit(50);
      inboxLoaded = true;
      if (r.error) return;
      const next = r.data || [];
      if (next.length !== inbox.length || next.some((x, i) => !inbox[i] || inbox[i].id !== x.id)) { inbox = next; render(); }
    } catch (e) { /* без мережі */ }
  }
  async function loadKey() {
    const c = SB(); if (!c) return;
    const r = await c.from('ducky_inbox_keys').select('key').maybeSingle();
    if (r.error) { keyMsg = 'Таблиці для команд ще немає. Виконайте SQL з docs/supabase.sql (розділ «Швидкі команди iPhone»).'; render(); return; }
    key = r.data ? r.data.key : null; render();
  }
  async function makeKey() {
    const c = SB(); if (!c) return;
    const a = new Uint8Array(24); crypto.getRandomValues(a);
    const k = [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
    const r = await c.from('ducky_inbox_keys').upsert({ user_id: user.id, key: k });
    if (r.error) { keyMsg = 'Не вдалося створити ключ: ' + r.error.message; render(); return; }
    key = k; keyMsg = 'Новий ключ створено. Старі команди з попереднім ключем більше не працюватимуть.'; render();
  }
  function takeInbox() {
    if (!inbox.length) return;
    inboxIds = inbox.map((x) => x.id);
    draft = inbox.map((x) => x.text).join('. ');
    run();
  }
  async function clearInbox(ids) {
    const c = SB(); if (!c || !ids.length) return;
    try { await c.from('ducky_inbox').delete().in('id', ids); } catch (e) { /* лишиться в черзі */ }
    inbox = inbox.filter((x) => !ids.includes(x.id)); inboxIds = [];
  }
  function inboxCard() {
    const url = (window.DUCKY_CONFIG && window.DUCKY_CONFIG.supabaseUrl || '').replace(/\/+$/, '') + '/rest/v1/rpc/ducky_inbox_add';
    const anon = window.DUCKY_CONFIG && window.DUCKY_CONFIG.supabaseAnonKey || '';
    const copy = (t, label) => h('button', { class: 'ghost', type: 'button', style: 'min-height:44px', onclick: async () => { try { await navigator.clipboard.writeText(t); keyMsg = label + ' скопійовано.'; } catch (e) { keyMsg = 'Не вдалося скопіювати. Затисніть текст і скопіюйте вручну.'; } render(); } }, 'Копіювати ' + label);
    const box = (t) => h('input', { value: t, readonly: true, 'aria-label': t.slice(0, 20), style: 'width:100%;box-sizing:border-box;font-size:14px;margin:4px 0 8px', onfocus: (e) => e.target.select() });
    return h('details', { class: 'card', style: 'margin-bottom:20px', open: keyOpen ? true : null, ontoggle: (e) => { keyOpen = e.target.open; if (keyOpen && key === null && !keyMsg) loadKey(); } },
      h('summary', { style: 'min-height:44px;display:flex;align-items:center;cursor:pointer' }, 'Швидкі команди iPhone'),
      h('div', { style: 'margin-top:10px' },
        h('p', { class: 'mute', style: 'margin:0 0 10px' }, 'Створи на iPhone команду, яка надсилає текст («додай молоко 200 мл», «видали плавлений сир Гриби»). Він потрапить сюди в чергу, а ти підтвердиш зміни.'),
        !SB() ? h('p', { class: 'note' }, 'Потрібно увійти в акаунт з хмарою.')
          : key ? h('div', {},
            h('div', { class: 'tag' }, 'Адреса (URL)'), box(url), copy(url, 'адресу'),
            h('div', { class: 'tag', style: 'margin-top:10px' }, 'Твій ключ (нікому не показуй)'), box(key), copy(key, 'ключ'),
            h('div', { class: 'tag', style: 'margin-top:10px' }, 'Публічний ключ Supabase (apikey)'), box(anon), copy(anon, 'apikey'),
            h('ol', { style: 'margin:14px 0 0;padding-left:20px;line-height:1.5' },
              h('li', {}, 'У застосунку «Команди» натисни «+» і додай дію «Диктувати текст» (або «Запитати введення»).'),
              h('li', {}, 'Додай «Отримати вміст URL». Встав адресу, Метод: POST, Тіло запиту: JSON.'),
              h('li', {}, 'Заголовки: apikey = публічний ключ вище; Content-Type = application/json.'),
              h('li', {}, 'У JSON додай два поля, обидва «Текст»: p_key = твій ключ, p_text = змінна «Надиктований текст».'),
              h('li', {}, 'Назви команду «Комора» і додай на головний екран або запускай голосом: «Привіт, Siri, Комора».')),
            h('button', { class: 'link', type: 'button', style: 'min-height:44px;margin-top:6px', onclick: makeKey }, 'Створити новий ключ'))
          : h('button', { class: 'primary', type: 'button', style: 'min-height:46px', onclick: makeKey }, 'Створити ключ'),
        keyMsg ? h('p', { class: 'note', role: 'status', style: 'margin:10px 0 0' }, keyMsg) : null));
  }
  function queueCard() {
    if (!inbox.length || pending) return null;
    return h('div', { class: 'card pa', style: 'margin-bottom:20px;border-color:var(--gold)' }, h('div', { class: 'tag' }, 'З команд iPhone: ' + inbox.length),
      h('ul', { class: 'pa-list', style: 'margin-top:8px' }, inbox.map((x) => h('li', {}, h('span', {}, '«' + x.text + '»')))),
      h('div', { class: 'toolbar', style: 'margin-top:10px' },
        h('button', { class: 'primary', type: 'button', style: 'min-height:46px', disabled: busy ? true : null, onclick: takeInbox }, busy ? 'Думаю…' : 'Розібрати'),
        h('button', { class: 'ghost', type: 'button', style: 'min-height:46px', onclick: () => clearInbox(inbox.map((x) => x.id)).then(render) }, 'Очистити')));
  }

  function card() {
    const ta = h('textarea', { rows: 2, placeholder: 'купила молоко 2 л; видали сир; приготували борщ на 4', 'aria-label': 'Що змінити в коморі', enterkeyhint: 'send', autocapitalize: 'sentences', style: 'width:100%;box-sizing:border-box;font-size:16px;min-height:56px' });
    ta.value = draft; ta.addEventListener('input', () => { draft = ta.value; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); draft = ta.value; run(); } });
    const rows = pending ? lines(pending) : [];
    return h('div', { class: 'card pa', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Комора словами'),
      h('p', { class: 'mute', style: 'margin:8px 0 10px' }, 'Що купила, зʼїли, викинула чи приготували (і на скільки людей). Покажу зміни, ти підтвердиш.'),
      ta,
      h('div', { class: 'toolbar', style: 'margin-top:10px' }, h('button', { class: 'primary', type: 'button', style: 'min-height:46px;flex:1 1 auto', disabled: busy ? true : null, onclick: run }, busy ? 'Думаю…' : 'Показати зміни')),
      rows.length || (pending && (pending.notFound || []).length) ? h('div', { class: 'pa-prev' }, h('div', { class: 'tag', style: 'margin:12px 0 6px' }, 'Ось що зміниться'),
        h('ul', { class: 'pa-list' }, rows.map((r) => h('li', { class: r.cls }, h('input', { type: 'checkbox', checked: off.has(r.i) ? null : true, 'aria-label': 'Застосувати: ' + r.text, style: 'width:26px;height:26px;flex:none', onchange: (e) => { if (e.target.checked) off.delete(r.i); else off.add(r.i); } }), h('b', {}, r.sign), h('span', {}, r.text)))),
        pending.actions.some((a) => a.op === 'use' && a.exp) ? h('p', { class: 'note', style: 'margin:6px 0' }, 'Кількості для страви орієнтовні. Зніми галочку з того, що не треба списувати.') : null,
        pending.notFound && pending.notFound.length ? h('p', { class: 'note', style: 'margin:6px 0' }, 'Немає в коморі, тому не чіпаю: ' + pending.notFound.join(', ') + '.') : null,
        h('div', { class: 'toolbar', style: 'margin-top:10px' },
          rows.length ? h('button', { class: 'primary', type: 'button', style: 'min-height:46px', onclick: apply }, 'Застосувати') : null,
          h('button', { class: 'ghost', type: 'button', style: 'min-height:46px', onclick: () => { pending = null; render(); } }, 'Скасувати'))) : null,
      msg ? h('p', { class: 'note', role: 'status', style: 'margin:10px 0 0' }, msg) : null,
      undo && !pending ? h('button', { class: 'link', type: 'button', style: 'min-height:44px', onclick: () => { state.products = undo.products; state.archive = undo.archive; undo = null; msg = 'Останню зміну скасовано.'; save(); render(); } }, 'Скасувати останню зміну') : null);
  }

  const refresh = () => { if (document.visibilityState !== 'hidden') loadInbox(); };
  document.addEventListener('visibilitychange', refresh); setTimeout(refresh, 1500); setInterval(refresh, 60000);
  const orig = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = orig();
    const gi = out.findIndex((el) => el && el.classList && el.classList.contains('card') && /Додати списком/.test(el.textContent || ''));
    if (gi >= 0) {
      const old = out[gi]; old.style.marginBottom = '0';
      out.splice(gi, 1, ...[queueCard(), card(), inboxCard()].filter(Boolean), h('details', { class: 'card', style: 'margin-bottom:24px' }, h('summary', { style: 'min-height:44px;display:flex;align-items:center;cursor:pointer' }, 'Без ШІ: додати списком'), h('div', { style: 'margin-top:10px' }, old)));
    } else {
      const g2 = out.findIndex((el) => el && el.classList && el.classList.contains('grid'));
      out.splice(g2 < 0 ? out.length : g2, 0, ...[queueCard(), card(), inboxCard()].filter(Boolean));
    }
    return out;
  };
})();
