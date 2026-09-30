'use strict';
// Ducky · v4: список покупок, мінімальні запаси, набори, ціна за одиницю, історія цін,
// рецепт із посилання, «що приготувати сьогодні», морозилка.
// Працює поверх app.js та extras.js.
(function () {
  const X = window.DuckyExtras;
  if (!X) return;
  const NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
    return e;
  }
  const slug = (s) => norm(s);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };

  // ---------- одиниці виміру ----------
  // t: w = вага (кг), v = об'єм (л), c = штуки. Значення в базових одиницях.
  const UNITS = { 'г': ['w', 0.001], 'гр': ['w', 0.001], 'кг': ['w', 1], 'мл': ['v', 0.001], 'л': ['v', 1], 'шт': ['c', 1], 'уп': ['c', 1], 'пач': ['c', 1] };
  const UNIT_LABEL = { w: 'кг', v: 'л', c: 'шт' };
  function parseQty(q) {
    const m = /^(\d+(?:[.,]\d+)?)\s*([^\d\s.,]*)\.?\s*$/i.exec(String(q || '').trim());
    if (!m) return null;
    const n = parseFloat(m[1].replace(',', '.'));
    const u = m[2].toLowerCase();
    if (!(n > 0) && !u) return null;
    if (u) { const d = UNITS[u]; return d ? { t: d[0], v: n * d[1], assumed: false } : null; }
    if (Number.isInteger(n)) return n >= 50 ? { t: 'w', v: n * 0.001, assumed: true } : { t: 'c', v: n, assumed: true };
    return { t: 'w', v: n, assumed: true };   // «0.183» з вагового чека: кілограми
  }

  // ---------- збіг продуктів ----------
  const isActive = (p) => p && p.name;
  const matches = (p, key) => { const n = norm(p.name); return n === key || n.includes(key); };
  function stockOf(name, min) {
    const key = norm(name);
    const list = state.products.filter((p) => isActive(p) && matches(p, key));
    if (!list.length) return { known: true, base: 0 };
    let sum = 0; let ok = false;
    for (const p of list) { const q = parseQty(measureOf(p)); if (q && q.t === min.t) { sum += q.v; ok = true; } }
    return ok ? { known: true, base: sum } : { known: false, base: 0 };
  }
  const hasIng = (ing) => { const k = norm(ing); return state.products.some((p) => { const n = norm(p.name); return n === k || n.includes(k) || k.includes(n); }); };

  // ---------- мінімальні запаси ----------
  const mins = () => state.mins || (state.mins = {});
  function minShortages() {
    const out = [];
    for (const [key, m] of Object.entries(mins())) {
      const need = m.n * UNITS[m.u][1];
      const cur = stockOf(m.name, { t: UNITS[m.u][0] });
      if (cur.known && cur.base + 1e-9 < need) out.push({ key, m, have: cur.base / UNITS[m.u][1] });
    }
    return out;
  }
  const fmtN = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

  // ---------- набори та часті покупки ----------
  const sets = () => state.sets || (state.sets = []);
  function frequent() {
    const cnt = new Map();
    for (const r of state.receipts) for (const it of r.items) { const k = norm(it.name); if (!k) continue; const c = cnt.get(k) || { name: it.name, n: 0 }; c.n++; cnt.set(k, c); }
    return [...cnt.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);
  }

  // ---------- список покупок ----------
  const manual = () => state.shopManual || (state.shopManual = []);
  const done = () => state.shopDone || (state.shopDone = {});
  function shoppingItems() {
    const map = new Map();
    const put = (name, src, note) => {
      const k = norm(name); if (!k) return;
      const it = map.get(k) || { key: k, name, src: new Set(), note: '' };
      it.src.add(src); if (note) it.note = note; map.set(k, it);
    };
    const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
    for (const v of Object.values(state.menu || {})) {
      const r = byTitle.get(norm(v)); if (!r) continue;
      for (const i of r.ings) if (!hasIng(i)) put(i, 'меню');
    }
    for (const s of minShortages()) put(s.m.name, 'мінімум', 'мінімум ' + fmtN(s.m.n) + ' ' + s.m.u + ', є ' + fmtN(s.have));
    for (const m of manual()) put(m.name, 'вручну');
    return [...map.values()];
  }

  function viewShop() {
    const items = shoppingItems();
    const prices = latestPrices();
    const priceOf = (n) => lastKnownPrice(n, prices);
    const dn = done();
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:10px 0 0' });
    const sumOf = (list) => list.reduce((s, i) => s + (priceOf(i.name) || 0), 0);
    const open = items.filter((i) => !dn[i.key]);
    const budget = effectiveBudget();

    const addInput = h('input', { list: 'shopNames', placeholder: 'Додати продукт', 'aria-label': 'Додати продукт' });
    const names = [...new Set([...state.products.map((p) => p.name), ...frequent().map((f) => f.name)])];
    const addNow = () => {
      const v = addInput.value.trim(); if (!v) return;
      if (!manual().some((m) => norm(m.name) === norm(v))) manual().push({ id: uid(), name: v });
      save(); render();
    };
    addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNow(); } });

    const rows = items.length ? items.map((i) => h('label', { class: 'shop-row' + (dn[i.key] ? ' done' : '') },
      h('input', { type: 'checkbox', checked: dn[i.key] ? true : null, onchange: (e) => { if (e.target.checked) dn[i.key] = true; else delete dn[i.key]; save(); render(); } }),
      h('span', { class: 'shop-n' }, i.name, i.note ? h('span', { class: 'mute' }, ' · ' + i.note) : null),
      h('span', { class: 'tag' }, [...i.src].join(', ')),
      h('span', { class: 'mute shop-p' }, priceOf(i.name) != null ? money(priceOf(i.name)) : '—')))
      : h('p', { class: 'empty' }, 'Список порожній. Тут з\'являться продукти з меню тижня, ті, що впали нижче мінімуму, і ті, що ви додасте самі.');

    const copyText = () => open.map((i) => '☐ ' + i.name + (i.note ? ' (' + i.note + ')' : '')).join('\n');
    const bought = () => {
      const marked = items.filter((i) => dn[i.key]);
      if (!marked.length) { msg.textContent = 'Відмітьте те, що купили.'; return; }
      for (const i of marked) state.products.push({ id: uid(), name: i.name, qty: '', weight: '', store: '', price: null, bought: todayISO(), exp: null });
      state.shopManual = manual().filter((m) => !dn[norm(m.name)]);
      state.shopDone = {};
      save(); render(); X.toast('Додано в комору: ' + marked.length + '. Кількість і ціни зручніше внести зі скану чека.');
    };
    const main = h('div', { class: 'card' },
      h('div', { class: 'row', style: 'display:flex;gap:8px;margin-bottom:16px' }, addInput, h('button', { class: 'ghost', type: 'button', onclick: addNow }, 'Додати')),
      h('datalist', { id: 'shopNames' }, names.map((n) => h('option', { value: n }))),
      h('div', {}, rows),
      h('div', { style: 'border-top:1px solid var(--line);margin-top:16px;padding-top:12px' },
        h('div', { class: 'mute' }, 'ЗАЛИШИЛОСЬ КУПИТИ' + (open.some((i) => priceOf(i.name) == null) ? ' (за відомими цінами)' : '')),
        h('div', { class: 'total' }, money(sumOf(open))),
        budget ? h('div', { class: sumOf(open) > budget ? 'warn' : 'mute' }, 'Бюджет тижня: ' + money(budget)) : null),
      h('div', { class: 'toolbar', style: 'margin-top:16px' },
        h('button', { class: 'primary', type: 'button', onclick: bought }, 'Купила відмічене → в комору'),
        h('button', { class: 'ghost', type: 'button', onclick: async () => {
          if (!open.length) { msg.textContent = 'Нічого копіювати.'; return; }
          try { await navigator.clipboard.writeText(copyText()); msg.textContent = 'Список скопійовано.'; }
          catch (e) { msg.textContent = 'Не вдалося скопіювати. Виділіть і скопіюйте вручну.'; }
        } }, 'Скопіювати'),
        manual().length ? h('button', { class: 'link', type: 'button', onclick: () => { state.shopManual = []; save(); render(); } }, 'Прибрати додані вручну') : null),
      msg);
    return [...header('Покупки', 'Що треба', 'купити'), h('div', { class: 'grid' }, main, h('div', { class: 'stack' }, minsCard(), setsCard(), frequentCard()))];
  }

  function minsCard() {
    const name = h('input', { list: 'shopNames', placeholder: 'Продукт', 'aria-label': 'Продукт', required: true });
    const num = h('input', { type: 'number', min: '0', step: '0.1', placeholder: '6', 'aria-label': 'Мінімум' });
    const unit = h('select', { 'aria-label': 'Одиниця' }, ['шт', 'г', 'кг', 'мл', 'л'].map((u) => h('option', { value: u }, u)));
    const list = Object.entries(mins());
    return h('div', { class: 'card' }, h('h2', {}, 'Мінімальні запаси'),
      h('p', { class: 'mute', style: 'margin:0 0 12px' }, 'Коли запас упаде нижче мінімуму, продукт сам з\'явиться в списку покупок.'),
      h('div', { class: 'row', style: 'display:grid;grid-template-columns:1fr 70px 70px auto;gap:8px;align-items:end' }, name, num, unit,
        h('button', { class: 'ghost', type: 'button', onclick: () => {
          const n = Number(num.value); const v = name.value.trim();
          if (!v || !(n > 0)) return;
          mins()[norm(v)] = { name: v, n, u: unit.value }; save(); render();
        } }, '+')),
      list.length ? list.map(([k, m]) => {
        const cur = stockOf(m.name, { t: UNITS[m.u][0] });
        const have = cur.known ? fmtN(cur.base / UNITS[m.u][1]) + ' ' + m.u : 'кількість не вказана';
        const low = cur.known && cur.base + 1e-9 < m.n * UNITS[m.u][1];
        return h('div', { class: 'kv row-line' }, h('span', {}, m.name + ' · мін. ' + fmtN(m.n) + ' ' + m.u),
          h('span', {}, h('span', { class: low ? 'warn' : 'mute' }, 'є ' + have + ' '),
            h('button', { class: 'link', type: 'button', onclick: () => { delete mins()[k]; save(); render(); } }, 'Прибрати')));
      }) : h('p', { class: 'empty' }, 'Ще немає мінімумів.'));
  }

  function setsCard() {
    const name = h('input', { placeholder: 'Назва набору', 'aria-label': 'Назва набору' });
    const its = h('input', { placeholder: 'молоко, яйця, хліб', 'aria-label': 'Продукти через кому' });
    const addSetToList = (s) => {
      let n = 0;
      for (const it of s.items) if (!manual().some((m) => norm(m.name) === norm(it))) { manual().push({ id: uid(), name: it }); n++; }
      save(); render(); X.toast('Додано в список: ' + n);
    };
    return h('div', { class: 'card' }, h('h2', {}, 'Набори'),
      h('p', { class: 'mute', style: 'margin:0 0 12px' }, 'Збережіть звичні покупки й додавайте їх у список одним кліком.'),
      sets().map((s) => h('div', { class: 'kv row-line' }, h('span', {}, s.name + ' (' + s.items.length + ')'),
        h('span', {}, h('button', { class: 'ghost', type: 'button', style: 'padding:6px 12px', onclick: () => addSetToList(s) }, 'У список'), ' ',
          h('button', { class: 'link', type: 'button', onclick: () => { state.sets = sets().filter((x) => x.id !== s.id); save(); render(); } }, 'Видалити')))),
      h('div', { style: 'display:grid;gap:8px;margin-top:12px' }, name, its,
        h('button', { class: 'ghost', type: 'button', onclick: () => {
          const items = its.value.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
          if (!name.value.trim() || !items.length) return;
          sets().push({ id: uid(), name: name.value.trim(), items }); save(); render();
        } }, 'Створити набір'),
        manual().length ? h('button', { class: 'link', type: 'button', onclick: () => {
          const nm = name.value.trim() || 'Набір ' + (sets().length + 1);
          sets().push({ id: uid(), name: nm, items: manual().map((m) => m.name) }); save(); render();
        } }, 'Зберегти поточний список як набір') : null));
  }

  function frequentCard() {
    const f = frequent();
    return h('div', { class: 'card' }, h('h2', {}, 'Ви купуєте часто'),
      f.length ? h('div', { class: 'chips' }, f.map((x) => h('button', { class: 'chip', type: 'button', title: 'Куплено разів: ' + x.n, onclick: () => {
        if (!manual().some((m) => norm(m.name) === norm(x.name))) manual().push({ id: uid(), name: x.name });
        save(); render();
      } }, '+ ' + x.name)))
        : h('p', { class: 'empty' }, 'Підказки з\'являться, коли продукт трапиться у двох чеках.'));
  }

  // ---------- ціна за одиницю та історія цін ----------
  function unitPrice(it) {
    const q = parseQty(measureOf(it));
    if (!q || it.price == null || !(q.v > 0)) return null;
    return { t: q.t, per: it.price / q.v, assumed: q.assumed };
  }
  function unitTable() {
    const sorted = [...state.receipts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const by = new Map();   // ключ -> тип -> магазин -> {per, assumed}
    for (const r of sorted) for (const it of r.items) {
      const u = unitPrice(it); if (!u) continue;
      const k = norm(it.name);
      const types = by.get(k) || by.set(k, { name: k, t: {} }).get(k);
      ((types.t[u.t] ||= {})[r.store] = { per: u.per, assumed: u.assumed });
    }
    const stores = [...new Set(state.receipts.map((r) => r.store))].sort();
    const rows = [];
    for (const v of by.values()) {
      const t = Object.keys(v.t).sort((a, b) => Object.keys(v.t[b]).length - Object.keys(v.t[a]).length)[0];
      rows.push({ name: v.name, t, cells: v.t[t] });
    }
    rows.sort((a, b) => Object.keys(b.cells).length - Object.keys(a.cells).length || a.name.localeCompare(b.name));
    return { rows, stores };
  }
  function unitCard() {
    const { rows, stores } = unitTable();
    let body;
    if (!rows.length) body = h('p', { class: 'empty' }, 'Потрібні чеки з кількістю (наприклад «500 г», «1 л», «0.183»). Тоді Ducky порахує ціну за кг, літр чи штуку.');
    else body = h('div', { class: 'scroll' }, h('table', {},
      h('tr', {}, h('th', {}, 'Продукт'), stores.map((s) => h('th', {}, s)), h('th', {}, 'Вигідніше')),
      rows.map((r) => {
        const vals = Object.entries(r.cells);
        const best = vals.length > 1 ? vals.reduce((a, b) => (b[1].per < a[1].per ? b : a)) : null;
        return h('tr', {}, h('td', { class: 'name' }, r.name),
          stores.map((s) => { const c = r.cells[s]; return h('td', {}, c ? h('span', { class: best && best[0] === s ? 'best' : 'mute' }, (c.assumed ? '≈ ' : '') + money(c.per) + '/' + UNIT_LABEL[r.t]) : h('span', { class: 'mute' }, '—')); }),
          h('td', { class: 'gold-t' }, best ? best[0] : 'мало даних'));
      })));
    return h('div', { class: 'card', style: 'margin-top:28px' }, h('h2', {}, 'Ціна за кг, літр і штуку'), body,
      h('p', { class: 'note' }, 'Так порівнюються різні за розміром упаковки. Знак ≈ означає, що одиницю вгадано: число без одиниці менше 50 з крапкою рахуємо кілограмами, ціле від 50 грамами, ціле менше 50 штуками.'));
  }

  const COLORS = ['var(--gold)', '#5b8def', '#d4715e', '#4fae86', '#a678d6'];
  function priceSeries(name) {
    const k = norm(name);
    const pts = [];
    const sorted = [...state.receipts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const r of sorted) for (const it of r.items) if (norm(it.name) === k && it.price != null) {
      pts.push({ date: r.date, store: r.store, pack: it.price, u: unitPrice(it) });
    }
    return pts;
  }
  function priceModal(name) {
    const pts = priceSeries(name);
    const types = new Set(pts.map((p) => (p.u ? p.u.t : '')));
    const useUnit = pts.length > 0 && types.size === 1 && !types.has('');
    const val = (p) => (useUnit ? p.u.per : p.pack);
    const label = useUnit ? '₴/' + UNIT_LABEL[[...types][0]] : '₴ за упаковку';
    const body = h('div', {});
    if (pts.length < 1) body.append(h('p', { class: 'empty' }, 'Немає чеків з ціною на цей продукт.'));
    else {
      const W = 520; const H = 220; const pl = 40; const pr = 12; const pt = 14; const pb = 30;
      const ts = pts.map((p) => new Date(p.date + 'T00:00:00').getTime());
      const t0 = Math.min(...ts); const t1 = Math.max(...ts);
      const vals = pts.map(val); let lo = Math.min(...vals); let hi = Math.max(...vals);
      if (hi - lo < 1e-6) { lo = lo * 0.9; hi = hi * 1.1 + 0.01; }
      const X_ = (t) => pl + (t1 === t0 ? (W - pl - pr) / 2 : ((t - t0) / (t1 - t0)) * (W - pl - pr));
      const Y_ = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
      const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bars', role: 'img', 'aria-label': 'Історія цін: ' + name });
      for (let i = 0; i <= 3; i++) {
        const v = lo + ((hi - lo) * i) / 3; const y = Y_(v);
        svg.append(S('line', { x1: pl, x2: W - pr, y1: y, y2: y, style: 'stroke:var(--line)' }));
        svg.append(S('text', { x: pl - 6, y: y + 3, class: 'bar-l', 'text-anchor': 'end' }, Math.round(v * 10) / 10));
      }
      const stores = [...new Set(pts.map((p) => p.store))];
      stores.forEach((st, si) => {
        const mine = pts.filter((p) => p.store === st);
        const c = COLORS[si % COLORS.length];
        svg.append(S('polyline', { fill: 'none', style: `stroke:${c};stroke-width:2`, points: mine.map((p) => X_(new Date(p.date + 'T00:00:00').getTime()).toFixed(1) + ',' + Y_(val(p)).toFixed(1)).join(' ') }));
        for (const p of mine) {
          const dot = S('circle', { cx: X_(new Date(p.date + 'T00:00:00').getTime()).toFixed(1), cy: Y_(val(p)).toFixed(1), r: 4, style: `fill:${c}` });
          dot.append(S('title', {}, st + ', ' + fmtDate(p.date) + ': ' + money(val(p)) + ' ' + label));
          svg.append(dot);
        }
      });
      svg.append(S('text', { x: pl, y: H - 8, class: 'bar-l' }, fmtDate(pts[0].date)));
      svg.append(S('text', { x: W - pr, y: H - 8, class: 'bar-l', 'text-anchor': 'end' }, fmtDate(pts[pts.length - 1].date)));
      body.append(svg,
        h('div', { class: 'legend' }, stores.map((st, si) => h('span', {}, h('i', { style: `background:${COLORS[si % COLORS.length]}` }), st))),
        h('p', { class: 'mute', style: 'margin:8px 0 0' }, 'Ціни: ' + label));
      if (pts.length >= 2) {
        const last = val(pts[pts.length - 1]);
        const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
        const d = ((last - avg) / avg) * 100;
        body.append(h('p', { class: Math.abs(d) < 7 ? 'mute' : d > 0 ? 'warn' : 'gold-t', style: 'margin:6px 0 0' },
          Math.abs(d) < 7 ? 'Остання ціна в межах звичайної.' : 'Остання ціна ' + (d > 0 ? 'вища' : 'нижча') + ' за середню на ' + Math.round(Math.abs(d)) + '%.'));
      } else body.append(h('p', { class: 'note' }, 'Одна ціна поки що. Додайте ще чеки, і з\'явиться динаміка.'));
    }
    X.openModal('Історія цін: ' + name, body);
  }

  // ---------- рецепт із посилання або тексту ----------
  function importCard() {
    const box = h('textarea', { rows: 3, placeholder: 'Вставте посилання на рецепт або весь текст рецепта', 'aria-label': 'Посилання або текст рецепта' });
    const out = h('div', { class: 'cards', style: 'margin-top:16px' });
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:12px 0 0' });
    const btn = h('button', { class: 'primary', type: 'button', onclick: async () => {
      const v = box.value.trim();
      if (v.length < 8) { msg.textContent = 'Вставте посилання або текст.'; return; }
      btn.disabled = true; msg.textContent = 'Розбираємо рецепт…'; out.replaceChildren();
      try {
        const res = await X.callApi('/api/import-recipe', /^https?:\/\/\S+$/i.test(v) ? { url: v } : { text: v });
        const r = res.recipe;
        const buy = r.ings.filter((i) => !hasIng(i));
        msg.textContent = 'Готово. Перевірте й збережіть.';
        const saved = h('span', { class: 'mute' });
        out.replaceChildren(h('div', { class: 'card' },
          h('div', { class: 'tag' }, r.tech || 'Імпорт'), h('h3', {}, r.title),
          h('div', { class: 'mute' }, [r.minutes && r.minutes + ' хв', r.servings && r.servings + ' порц.'].filter(Boolean).join(' · ') || ' '),
          h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Інгредієнти'), h('span', {}, r.ings.join(', '))),
          h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Докупити'), h('span', {}, buy.length ? buy.join(', ') : 'нічого')),
          r.steps.length ? h('details', { class: 'steps' }, h('summary', {}, 'Приготування'), h('ol', {}, r.steps.map((t) => h('li', {}, t)))) : null,
          h('button', { class: 'ghost', type: 'button', onclick: (e) => {
            state.recipes.push({ id: uid(), title: r.title, tech: r.tech, minutes: r.minutes, servings: r.servings, ings: r.ings, steps: r.steps });
            save(); e.target.disabled = true; saved.textContent = 'Збережено'; render();
          } }, 'Зберегти'), saved));
      } catch (e) { msg.textContent = e.message; }
      btn.disabled = false;
    } }, 'Розібрати рецепт');
    return h('div', { class: 'card', style: 'margin-bottom:28px' }, h('div', { class: 'tag' }, 'Рецепт із посилання'),
      h('p', { class: 'mute', style: 'margin:8px 0 12px' }, 'ШІ розкладе сторінку чи текст на інгредієнти, кроки й техніку.'), box, h('div', { style: 'margin-top:12px' }, btn), msg, out);
  }

  // ---------- що приготувати сьогодні ----------
  const dayIdx = (offset) => ((new Date().getDay() + 6) % 7 + offset) % 7;
  function frozenFor(r) {
    return r.ings.map((i) => state.products.find((p) => p.frozen && matches(p, norm(i)))).filter(Boolean);
  }
  function todayPicks() {
    const pool = X.eligibleRecipes();
    const soon = state.products.filter((p) => !p.frozen && (() => { const d = daysLeft(p.exp); return d !== null && d <= 3; })());
    const likes = list(state.profile && state.profile.likes).map(norm);
    return pool.map((r) => {
      const missing = r.ings.filter((i) => !hasIng(i));
      const useSoon = soon.filter((p) => r.ings.some((i) => matches(p, norm(i)) || norm(i).includes(norm(p.name))));
      const like = r.ings.filter((i) => likes.some((l) => norm(i).includes(l))).length;
      const fz = frozenFor(r);
      return { r, missing, useSoon, fz, score: missing.length * 10 - useSoon.length * 6 - like * 3 + fz.length * 2 };
    }).sort((a, b) => a.score - b.score).slice(0, 3);
  }
  function list(s) { return String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean); }
  function thawTips() {
    const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
    const out = [];
    [[0, 'сьогодні'], [1, 'завтра']].forEach(([off, label]) => {
      const seen = new Set();
      for (const [mk] of MEALS) {
        const t = (state.menu || {})[dayIdx(off) + '-' + mk]; const r = t && byTitle.get(norm(t)); if (!r) continue;
        for (const p of frozenFor(r)) if (!seen.has(p.id)) { seen.add(p.id); out.push({ p, label }); }
      }
    });
    return out;
  }
  function todayCard() {
    const picks = todayPicks();
    const tips = thawTips();
    return h('div', { class: 'card gold', style: 'margin-bottom:24px' }, h('div', { class: 'tag' }, 'Що приготувати сьогодні'),
      tips.length ? h('p', { class: 'warn', style: 'margin:8px 0' }, 'Розморозьте: ' + tips.map((t) => t.p.name + ' (' + t.label + ')').join(', ')) : null,
      picks.length ? h('div', { class: 'cards', style: 'margin-top:12px' }, picks.map(({ r, missing, useSoon, fz }) => h('div', { class: 'card' },
        h('div', { class: 'tag' }, r.tech || 'Рецепт'), h('h3', {}, r.title),
        h('div', { class: 'mute' }, [r.minutes && r.minutes + ' хв', r.servings && r.servings + ' порц.'].filter(Boolean).join(' · ') || ' '),
        h('div', { class: missing.length ? 'mute' : 'gold-t' }, missing.length ? 'Не вистачає: ' + missing.join(', ') : 'Усе є вдома'),
        useSoon.length ? h('div', { class: 'warn' }, 'Використає те, що скоро зіпсується: ' + useSoon.map((p) => p.name).join(', ')) : null,
        fz.length ? h('div', { class: 'mute' }, 'У морозилці: ' + fz.map((p) => p.name).join(', ')) : null,
        h('button', { class: 'ghost', type: 'button', onclick: () => X.cookRecipe(r) }, 'Приготувала'))))
        : h('p', { class: 'empty', style: 'margin:8px 0 0' }, state.recipes.length ? 'Профіль виключив усі рецепти (алергії чи техніка).' : 'Додайте рецепти, і тут з\'являться підказки на сьогодні.'));
  }

  // ---------- морозилка ----------
  function toggleFreeze(p) {
    let closeFn = null;
    const f = !!p.frozen;
    const inp = h('input', f ? { type: 'number', min: '1', max: '14', value: '2', 'aria-label': 'Днів' } : { type: 'date', value: addDays(90), min: todayISO(), 'aria-label': 'Зберігати до' });
    const body = h('div', {},
      h('label', {}, f ? 'Використати протягом, днів' : 'Зберігати в морозилці до', inp),
      h('p', { class: 'note' }, f ? 'Розморожене псується швидше, тому термін коротший.' : 'Дата придатності замінить попередню. Після розморожування ви вкажете новий короткий термін.'),
      h('button', { class: 'primary', type: 'button', onclick: () => {
        if (f) { p.frozen = false; p.exp = addDays(Math.max(1, Math.min(14, Number(inp.value) || 2))); delete p.expBefore; delete p.frozenAt; }
        else { p.frozen = true; p.frozenAt = todayISO(); p.expBefore = p.exp || null; p.exp = inp.value || addDays(90); }
        save(); closeFn(); render();
      } }, f ? 'Розморозити' : 'Заморозити'));
    closeFn = X.openModal((f ? 'Розморозити: ' : 'Заморозити: ') + p.name, body);
  }
  function freezerCard() {
    const fz = state.products.filter((p) => p.frozen).sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999'));
    if (!fz.length) return null;
    return h('div', { class: 'card', style: 'margin-top:28px' }, h('h2', {}, 'Морозилка'),
      fz.map((p) => h('div', { class: 'kv row-line' }, h('span', {}, p.name + (qtyText(p) ? ' · ' + qtyText(p) : '')),
        h('span', {}, h('span', { class: 'mute' }, 'до ' + fmtDate(p.exp) + ' '),
          h('button', { class: 'link', type: 'button', onclick: () => toggleFreeze(p) }, 'Розморозити'),
          ' ', h('button', { class: 'link', type: 'button', onclick: () => { X.archiveProduct(p, 'used'); save(); render(); } }, 'Використано')))));
  }

  // ---------- нагадування ----------
  function pushNote(title, body) {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'ducky-more' }));
      else new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch (e) { /* ігноруємо */ }
  }
  function checkReminders() {
    if (!state || !user || !state.profile || !state.profile.notify) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const key = 'more:' + todayISO();
    const notified = state.notified || (state.notified = {});
    if (notified[key]) return;
    const lines = [];
    const low = minShortages(); if (low.length) lines.push('Закінчується: ' + low.slice(0, 4).map((s) => s.m.name).join(', '));
    const th = thawTips().filter((t) => t.label === 'завтра'); if (th.length) lines.push('Розморозьте на завтра: ' + th.map((t) => t.p.name).join(', '));
    for (const k of Object.keys(notified)) if (k.startsWith('more:') && k !== key) delete notified[k];
    notified[key] = 1;
    if (lines.length) pushNote('Ducky', lines.join('. '));
    save();
  }
  setInterval(checkReminders, 30000);

  // ---------- підключення до екранів ----------
  VIEWS.shop = viewShop;
  TABS.splice(4, 0, ['shop', 'Покупки']);

  const origStores = VIEWS.stores;
  VIEWS.stores = () => {
    const out = origStores();
    out.splice(out.length - 1, 0, unitCard());
    for (const el of out) {
      if (!el || !el.querySelectorAll) continue;
      el.querySelectorAll('td.name').forEach((td) => {
        td.classList.add('clickable'); td.title = 'Історія цін';
        td.addEventListener('click', () => priceModal(td.textContent));
      });
    }
    return out;
  };
  const origPantry = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = origPantry();
    out.splice(3, 0, todayCard());
    const fc = freezerCard();
    if (fc) { const ai = out.findIndex((el) => el && el.classList && el.classList.contains('archive')); out.splice(ai < 0 ? out.length : ai, 0, fc); }
    return out;
  };
  const origRecipes = VIEWS.recipes;
  VIEWS.recipes = () => { const out = origRecipes(); out.splice(4, 0, importCard()); return out; };

  // ---------- додати комору списком (ШІ або спрощений розбір) ----------
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function parseListLocal(text, today) {
    const now = new Date((today || todayISO()) + 'T00:00:00');
    const U = '(кг|г|гр|л|мл|шт|уп|пач|пачк[а-яіїєґ]*|пляшк[а-яіїєґ]*|банк[а-яіїєґ]*|пакет[а-яіїєґ]*)';
    const lines = String(text || '').replace(/(\d),(\d)/g, '$1.$2').split(/[\n;,]+/);
    const out = [];
    for (let raw of lines) {
      let line = raw.replace(/^[\s\-–—•*·]+/, '').replace(/^\d+[.)]\s+/, '').trim();
      if (line.length < 2) continue;
      let exp = null; let price = null; let qty = '';
      let m = /(?:до|термін\w*|придатн\w*)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/i.exec(line);
      if (m) {
        let y = m[3] ? Number(m[3]) : now.getFullYear(); if (y < 100) y += 2000;
        let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
        if (!m[3] && d < now) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
        exp = localISO(d); line = line.replace(m[0], ' ');
      }
      m = /(\d+(?:\.\d+)?)\s*(?:грн|₴)/i.exec(line);
      if (m) { price = Number(m[1]); line = line.replace(m[0], ' '); }
      line = line.replace(/\s+/g, ' ').trim();
      if ((m = new RegExp('^(\\d+(?:\\.\\d+)?)\\s*' + U + '\\.?\\s+(.+)$', 'i').exec(line))) { qty = m[1] + ' ' + m[2].toLowerCase(); line = m[3]; }
      else if ((m = new RegExp('^(.+?)\\s*[-–:]?\\s*(\\d+(?:\\.\\d+)?)\\s*' + U + '\\.?$', 'i').exec(line))) { qty = m[2] + ' ' + m[3].toLowerCase(); line = m[1]; }
      else if ((m = /^(.+?)\s*[xх×]\s*(\d+)$/i.exec(line))) { qty = m[2] + ' шт'; line = m[1]; }
      else if ((m = /^(.+?)\s+(\d+(?:\.\d+)?)$/.exec(line))) { qty = m[2]; line = m[1]; }
      const name = line.replace(/[\s:–\-.]+$/, '').trim();
      if (name.length < 2 || /^\d+$/.test(name)) continue;
      out.push({ name: cap(name), ...splitQtyWeight(qty), exp, store: '', price });
    }
    return out.slice(0, 120);
  }
  function listCard() {
    const ta = h('textarea', { rows: 5, placeholder: 'Наприклад:\nмолоко 2 л\nяйця 10 шт\nсир пармезан 200 г до 15.10\nгречка 1 кг', 'aria-label': 'Список продуктів' });
    const store = h('input', { placeholder: 'Магазин (необов\'язково)', 'aria-label': 'Магазин для всіх' });
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:12px 0 0' });
    const undo = h('span', {});
    const btn = h('button', { class: 'primary', type: 'button', onclick: async () => {
      const text = ta.value.trim();
      if (text.length < 2) { msg.textContent = 'Вставте або впишіть список.'; return; }
      btn.disabled = true; undo.replaceChildren(); msg.textContent = 'Розпізнаємо список…';
      let items; let viaAi = true;
      try { items = (await X.callApi('/api/parse-list', { text, today: todayISO() })).items; }
      catch (e) { viaAi = false; items = parseListLocal(text, todayISO()); msg.textContent = 'ШІ недоступний (' + e.message + ') Розібрали спрощено. '; }
      btn.disabled = false;
      if (!items.length) { msg.textContent = 'Не вдалося знайти продукти. Впишіть по одному на рядок: «молоко 2 л».'; return; }
      const have = new Set(state.products.map((p) => norm(p.name)));
      const dup = items.filter((i) => have.has(norm(i.name))).map((i) => i.name);
      const ids = [];
      for (const i of items) {
        const id = uid(); ids.push(id);
        const sp = i.weight === undefined ? splitQtyWeight(i.qty) : { qty: i.qty || '', weight: i.weight || '' };
        state.products.push({ id, name: i.name, qty: sp.qty, weight: sp.weight, store: i.store || store.value.trim(), price: i.price == null ? null : i.price, bought: todayISO(), exp: i.exp || null });
      }
      save(); ta.value = '';
      render();
      const m2 = document.querySelector('#listMsg');
      if (m2) {
        m2.textContent = 'Додано в комору: ' + items.length + (viaAi ? '' : ' (спрощений розбір, перевірте)') + '.' + (dup.length ? ' Уже були в коморі: ' + dup.slice(0, 5).join(', ') + ' (додано окремими рядками).' : '') + ' ';
        m2.append(h('button', { class: 'link', type: 'button', onclick: () => {
          state.products = state.products.filter((p) => !ids.includes(p.id)); save(); render();
        } }, 'Скасувати'));
      }
    } }, 'Розпізнати й додати в комору');
    return h('div', { class: 'card', style: 'margin-bottom:24px' }, h('div', { class: 'tag' }, 'Додати списком'),
      h('p', { class: 'mute', style: 'margin:8px 0 12px' }, 'Вставте свій список як є: ШІ розпізнає продукти, кількість і терміни та сам заповнить комору.'),
      ta, h('div', { style: 'display:grid;gap:12px;margin-top:12px' }, store, btn), msg, h('p', { id: 'listMsg', class: 'note', role: 'status', style: 'margin:8px 0 0' }));
  }

  // ---------- редагування ----------
  function editProduct(p) {
    let closeFn = null;
    const f = { name: p.name, qty: p.qty || '', weight: p.weight || '', store: p.store || '', price: p.price == null ? '' : String(p.price), exp: p.exp || '' };
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
    const inp = (label, k, attrs = {}) => h('label', {}, label, h('input', { value: f[k], ...attrs, oninput: (e) => { f[k] = e.target.value; } }));
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
        h('div', { style: 'grid-column:1/-1' }, inp('Продукт', 'name')), inp('Кількість', 'qty', { placeholder: '2 шт' }), inp('Вага / об\'єм', 'weight', { placeholder: '500 г' }), inp('Магазин', 'store'),
        inp('Ціна, ₴', 'price', { type: 'number', min: '0', step: '0.01' }), inp('Придатний до', 'exp', { type: 'date' })),
      h('div', { class: 'toolbar', style: 'margin-top:16px' },
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const name = f.name.trim(); const price = f.price === '' ? null : Number(f.price);
          if (!name) { msg.textContent = 'Вкажіть назву.'; return; }
          if (price != null && !(price >= 0)) { msg.textContent = 'Ціна має бути числом.'; return; }
          p.name = name; p.qty = f.qty.trim(); p.weight = f.weight.trim(); p.store = f.store.trim(); p.price = price; p.exp = f.exp || null;
          save(); closeFn(); render();
        } }, 'Зберегти'),
        h('button', { class: 'link', type: 'button', onclick: () => closeFn() }, 'Скасувати')), msg);
    closeFn = X.openModal('Змінити: ' + p.name, body);
  }

  function editRecipe(r) {
    let closeFn = null;
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
    const title = h('input', { value: r.title, 'aria-label': 'Назва' });
    const tech = h('select', { 'aria-label': 'Техніка' }, APPLIANCES.map((a) => h('option', { value: a, selected: (r.tech || '') === a ? true : null }, a || 'Не важливо')));
    const minutes = h('input', { type: 'number', min: '1', value: r.minutes || '', 'aria-label': 'Хвилин' });
    const servings = h('input', { type: 'number', min: '1', value: r.servings || '', 'aria-label': 'Порцій' });
    const ings = h('textarea', { rows: 4, 'aria-label': 'Інгредієнти' }); ings.value = r.ings.join('\n');
    const steps = h('textarea', { rows: 5, 'aria-label': 'Кроки' }); steps.value = (r.steps || []).join('\n');
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
        h('label', { style: 'grid-column:1/-1' }, 'Назва страви', title), h('label', {}, 'Техніка', tech), h('label', {}, 'Хвилин', minutes),
        h('label', {}, 'Порцій', servings), h('div', {}),
        h('label', { style: 'grid-column:1/-1' }, 'Інгредієнти (кожен з нового рядка або через кому)', ings),
        h('label', { style: 'grid-column:1/-1' }, 'Приготування (кожен крок з нового рядка)', steps)),
      h('div', { class: 'toolbar', style: 'margin-top:16px' },
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const list2 = ings.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
          if (!title.value.trim() || !list2.length) { msg.textContent = 'Потрібні назва й хоча б один інгредієнт.'; return; }
          const oldTitle = r.title;
          r.title = title.value.trim(); r.tech = tech.value; r.minutes = Number(minutes.value) || null; r.servings = Number(servings.value) || null;
          r.ings = list2; r.steps = steps.value.split('\n').map((x) => x.trim()).filter(Boolean);
          // у меню назву рецепта тримаємо синхронною
          if (oldTitle !== r.title) for (const k of Object.keys(state.menu || {})) if (norm(state.menu[k]) === norm(oldTitle)) state.menu[k] = r.title;
          save(); closeFn(); render();
        } }, 'Зберегти'),
        h('button', { class: 'link', type: 'button', onclick: () => closeFn() }, 'Скасувати')), msg);
    closeFn = X.openModal('Змінити рецепт', body);
  }

  function editReceipt(r) {
    let closeFn = null;
    const f = { store: r.store || '', date: r.date || todayISO() };
    const lines = r.items.map((i) => ({ name: i.name, qty: i.qty || '', weight: i.weight || '', price: i.price == null ? '' : String(i.price), exp: i.exp || '' }));
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
    const box = h('div', { class: 'lines' });
    const total = h('div', { class: 'total' });
    const upd = () => { total.textContent = money(lines.reduce((s, l) => s + (Number(l.price) || 0), 0)); };
    const draw = () => {
      box.replaceChildren(...lines.map((l, i) => h('div', { class: 'line' },
        ...[['name', 'Продукт', 'text'], ['qty', 'Кількість', 'text'], ['weight', 'Вага / об\'єм', 'text'], ['price', 'Ціна, ₴', 'number'], ['exp', 'Придатний до', 'date']].map(([k, ph, type]) =>
          h('input', { 'aria-label': ph, placeholder: ph, type, value: l[k], step: type === 'number' ? '0.01' : null, min: type === 'number' ? '0' : null, oninput: (e) => { l[k] = e.target.value; upd(); } })),
        h('button', { class: 'link', type: 'button', onclick: () => { lines.splice(i, 1); draw(); upd(); } }, 'Видалити'))));
    };
    draw(); upd();
    let armed = false;
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px' },
        h('label', {}, 'Магазин', h('input', { value: f.store, oninput: (e) => { f.store = e.target.value; } })),
        h('label', {}, 'Дата', h('input', { type: 'date', value: f.date, oninput: (e) => { f.date = e.target.value; } }))),
      box, h('button', { class: 'ghost', type: 'button', onclick: () => { lines.push({ name: '', qty: '', weight: '', price: '', exp: '' }); draw(); } }, 'Додати позицію'),
      h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin:16px 0' }, h('span', { class: 'mute' }, 'РАЗОМ'), total),
      h('div', { class: 'toolbar' },
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const items = lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), qty: String(l.qty).trim(), weight: String(l.weight).trim(), price: l.price === '' ? null : Number(l.price), exp: l.exp || null }));
          if (!f.store.trim() || !items.length) { msg.textContent = 'Вкажіть магазин і хоча б одну позицію.'; return; }
          r.store = f.store.trim(); r.date = f.date || todayISO(); r.items = items; save(); closeFn(); render();
        } }, 'Зберегти'),
        h('button', { class: 'link', type: 'button', onclick: (e) => {
          if (!armed) { armed = true; e.target.textContent = 'Натисніть ще раз, щоб видалити чек'; return; }
          state.receipts = state.receipts.filter((x) => x !== r); save(); closeFn(); render();
        } }, 'Видалити чек')),
      msg, h('p', { class: 'note' }, 'Зміни в чеку впливають на ціни й графіки. Продукти в коморі, додані з цього чека, лишаються як були: змінюйте їх у «Коморі».'));
    closeFn = X.openModal('Змінити чек', body);
  }

  // ---------- мобільна версія (iPhone) ----------
  const mq = window.matchMedia('(max-width:700px)');
  const ICON = {
    pantry: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8' })),
    recipes: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M9 8h6 M9 12h6' })),
    scan: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M4 8h3l2-3h6l2 3h3v11H4z' }), S('circle', { cx: 12, cy: 13, r: 3.5 })),
    menu: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('rect', { x: 4, y: 5, width: 16, height: 15 }), S('path', { d: 'M4 10h16 M8 3v4 M16 3v4' })),
    shop: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M3 4h2l2.5 11h10L20 7H6.5' }), S('circle', { cx: 9, cy: 19, r: 1.3 }), S('circle', { cx: 17, cy: 19, r: 1.3 })),
    more: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('circle', { cx: 6, cy: 12, r: 1.4 }), S('circle', { cx: 12, cy: 12, r: 1.4 }), S('circle', { cx: 18, cy: 12, r: 1.4 })),
  };
  const PRIMARY = [['pantry', 'Комора'], ['recipes', 'Рецепти'], ['scan', 'Чек'], ['menu', 'Меню'], ['shop', 'Покупки']];
  function openMore() {
    let closeFn = null;
    const go = (k) => () => { state.tab = k; saveLocal(); closeFn(); render(); };
    const item = (label, fn) => h('button', { class: 'sheet-item', type: 'button', onclick: fn }, label);
    const btn = (id) => document.getElementById(id);
    closeFn = X.openModal('Ще', h('div', { class: 'sheet' },
      item('Магазини та ціни', go('stores')), item('Графіки', go('charts')), item('Профіль і налаштування', go('profile')),
      item('Змінити тему', () => { closeFn(); btn('themeBtn').click(); }),
      item('Вийти', () => { closeFn(); btn('logoutBtn').click(); })));
  }
  function mobileNav() {
    const nav = document.getElementById('nav');
    if (!nav || !mq.matches || nav.hidden || !user || !state) return;
    const cur = state.tab;
    const mk = (k, label, active, fn) => h('button', { type: 'button', 'aria-current': active ? 'page' : null, onclick: fn }, (ICON[k] || ICON.more)(), h('span', {}, label));
    nav.replaceChildren(...PRIMARY.map(([k, l]) => mk(k, l, cur === k, () => { state.tab = k; saveLocal(); render(); })),
      mk('more', 'Ще', !PRIMARY.some((p) => p[0] === cur), openMore));
  }
  const origRender = render;
  render = function () { origRender(); mobileNav(); };   // eslint-disable-line no-func-assign
  const onMq = () => render();
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

  // меню на телефоні: картки по днях замість широкої таблиці (значення синхронізуються з прихованою таблицею)
  const DAY_FULL = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];
  const origMenu2 = VIEWS.menu;
  VIEWS.menu = () => {
    const out = origMenu2();
    const grid = out.find((el) => el && el.classList && el.classList.contains('grid'));
    const tbl = grid && grid.querySelector('table.menu');
    if (tbl) {
      const sc = tbl.parentElement; sc.classList.add('menu-orig');
      const orig = {}; tbl.querySelectorAll('input').forEach((i) => { orig[i.getAttribute('aria-label')] = i; });
      const cards = h('div', { class: 'daycards' }, DAYS.map((d, di) => h('div', { class: 'daycard' },
        h('h3', {}, DAY_FULL[di]),
        MEALS.map(([mk, ml]) => h('label', {}, ml, h('input', { list: 'recipeTitles', value: (state.menu || {})[di + '-' + mk] || '', 'aria-label': ml + ' ' + d,
          oninput: (e) => { const o = orig[ml + ', ' + d]; if (o) { o.value = e.target.value; o.dispatchEvent(new Event('input')); } } }))))));
      sc.parentElement.insertBefore(cards, sc);
    }
    return out;
  };

  // підказка для iPhone: додати на екран «Додому» (інакше Safari стирає дані через 7 днів без відвідин)
  function iosBanner() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (!ios || standalone || store.get('ducky.iosTip')) return null;
    return h('div', { class: 'card gold tip', style: 'margin-bottom:20px' },
      h('div', {}, 'Щоб Ducky працював як застосунок і не забував вхід: у Safari натисніть «Поділитися», потім «На екран Додому».'),
      h('button', { class: 'link', type: 'button', onclick: (e) => { store.set('ducky.iosTip', 1); e.target.closest('.tip').remove(); } }, 'Зрозуміло'));
  }
  const origPantry2 = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = origPantry2(); const t = iosBanner(); if (t) out.splice(2, 0, t);
    const gi = out.findIndex((el) => el && el.classList && el.classList.contains('grid')); out.splice(gi < 0 ? out.length : gi, 0, listCard());
    return out;
  };

  Object.assign(X, { editProduct, editRecipe, editReceipt, parseListLocal, toggleFreeze, priceModal, shoppingItems, minShortages, parseQty, unitTable, todayPicks, thawTips });
  render();
})();
