'use strict';
// Розумний збіг продуктів «за змістом»: «курка» = «куряче філе» = «Куриное филе»; «м'ясо» знаходить свинину й курку.
// Працює без інтернету: словник понять (українська й російська) + категорії. Нічого не вигадує про ціни чи запаси.
(function () {
  const L = '(?<![а-яіїєґ])';   // початок слова (\b не працює з кирилицею)
  // [ключ, регулярний вираз за початком слова, категорія, виключення (ключі, які скасовують це поняття)]
  const C = [
    ['chicken', 'кур(а|и|у|ц|ин|яч|ят|к)|курк|кури|курча|бройлер|гомілк|голінк|крил|крыл|окороч', 'meat'],
    ['turkey', 'індик|індич|индейк|индюш', 'meat'],
    ['pork', 'свин|шийк|ошеек|шия$|карбонад|рулька|реберц', 'meat'],
    ['beef', 'яловичин|говяд|говядин|телятин|телятин|вирізк|антрекот', 'meat'],
    ['mince', 'фарш', 'meat'],
    ['sausage', 'ковбас|сосиск|сардельк|шинк|бекон|салямі|салями|сервелат|сало', 'meat'],
    ['meat', "м['’ʼ]?яс|мяс|птиц", 'meat'],
    ['fish', 'риб|рыб|лосос|сьомг|семг|форел|скумбр|оселед|сельд|тунец|тунц|минта|хек|короп|карп|тілапі|судак|окун|тріск|треск|дорадо|сибас', 'fish'],
    ['seafood', 'креветк|кальмар|мідії|мидии|краб|морепродукт', 'fish'],
    ['milk', 'молок|молоч(?![нк])', 'dairy', ['plantmilk']],
    ['plantmilk', '(банан|мигдал|миндал|соєв|соев|вівсян|овсян|кокос)\\S*\\s+молок', 'drink'],
    ['cream', 'вершк(и|ів|ам|ах|ами|у|ок)?(?![а-яіїєґ])|сливк|сливок', 'dairy'],
    ['sourcream', 'сметан', 'dairy'],
    ['kefir', 'кефір|кефир|ряжанк|простокваш|айран', 'dairy'],
    ['yogurt', 'йогурт|иогурт', 'dairy'],
    ['cottage', 'творог|твор(іг|ог)|кисломолоч', 'dairy'],
    ['butter', 'масл(о|а|у)(?![а-яіїєґ])|вершков', 'dairy', ['oil']],
    ['oil', 'олі|олив|соняшн|подсолн|рослинн|растительн|кукурудзян', ''],
    ['cheese', 'сир(?![а-яіїєґ])|сира(?![а-яіїєґ])|сиру|сири(?![а-яіїєґ])|сыр|пармез|моцар|гауд|чедд|бринз|фета|маскарп|рікот|рикот|едам|маасд|сулугун|плавлен', 'dairy', ['cottage']],
    ['egg', 'яйц|яєц|яйк', 'dairy'],
    ['bread', 'хліб|хлеб|батон|булк|багет|лаваш|тост', 'grain'],
    ['flour', 'борошн|мука|мук(?![а-яіїєґ])', 'grain'],
    ['buckwheat', 'греч', 'grain'],
    ['rice', 'рис(?![а-яіїєґ])|рису|рисов', 'grain'],
    ['oats', 'вівс|овс|геркулес', 'grain'],
    ['millet', 'пшон|пшен', 'grain'],
    ['semolina', 'манк', 'grain'],
    ['pasta', 'макарон|спагет|локшин|вермішел|вермишел|пенне|фузіл|лапш|паста(?![а-яіїєґ])', 'grain', ['tomatopaste']],
    ['gnocchi', 'ньок', 'grain'],
    ['potato', 'картопл|картошк|картофел', 'veg', ['fries']],
    ['fries', 'фрі(?![а-яіїєґ])|фри(?![а-яіїєґ])', ''],
    ['carrot', 'морк', 'veg'],
    ['onion', 'цибул|лук(?![а-яіїєґ])|лука|репчат', 'veg'],
    ['garlic', 'часник|чеснок', 'veg'],
    ['tomatopaste', 'томатн\\S*\\s+паст|кетчуп|томат\\S*\\s+соус', ''],
    ['tomato', 'помідор|помидор|томат', 'veg', ['tomatopaste']],
    ['cucumber', 'огірк|огурц', 'veg'],
    ['cabbage', 'капуст', 'veg'],
    ['beet', 'буряк|свекл|бурак', 'veg'],
    ['bellpepper', 'перець\\s+(солод|болгар)|перец\\s+(слад|болгар)|(солод|болгар|слад)\\S*\\s+пере[цч]|паприк', 'veg'],
    ['pepper', 'перець|перец', 'spice', ['bellpepper']],
    ['mushroom', 'гриб|шампіньйон|шампиньон|печериц|лисичк', 'veg'],
    ['zucchini', 'кабачк|цукіні|цуккини', 'veg'],
    ['eggplant', 'баклажан', 'veg'],
    ['greens', 'зелень|кріп|петрушк|укроп|базилік|базилик|кінз|кинз', 'veg'],
    ['lettuce', 'салат(?![а-яіїєґ]*\\s+олів)', 'veg'],
    ['apple', 'яблук|яблок', 'fruit'],
    ['banana', 'банан', 'fruit', ['plantmilk']],
    ['citrus', 'апельсин|мандарин|лимон|грейпфрут', 'fruit'],
    ['pear', 'груш', 'fruit'],
    ['berry', 'полуниц|клубник|малин|чорниц|черник|ягод|смородин|вишн|черешн', 'fruit'],
    ['grape', 'виноград', 'fruit'],
    ['salt', 'сіль|соль', 'spice'],
    ['sugar', 'цукор|сахар', 'sweet'],
    ['honey', 'мед(?![а-яіїєґ])|меду|мед\\s|варення|джем', 'sweet'],
    ['chocolate', 'шоколад|цукерк|конфет', 'sweet'],
    ['cookies', 'печиво|печенье|вафл|тістечк|торт', 'sweet'],
    ['coffee', 'кава|кофе|кави', 'drink'],
    ['tea', 'чай', 'drink'],
    ['juice', 'сік(?![а-яіїєґ])|соку|сок(?![а-яіїєґ])|лимонад', 'drink'],
    ['water', 'вода|воду|воды', 'drink'],
    ['nuts', 'горіх|орех|мигдал|миндал|фундук|арахіс|арахис|ізюм|изюм', ''],
    ['beans', 'квасол|фасол|сочевиц|чечевиц|нут(?![а-яіїєґ])|горошок|горох', 'grain'],
  ];
  const CATS = [
    ['meat', "м['’ʼ]?яс|мяс|птиц|м'ясн"], ['dairy', 'молочн|молочк'], ['veg', 'овоч|овощ'], ['fruit', 'фрукт|ягод'],
    ['grain', 'круп|бакалі|каш'], ['fish', 'риб|рыб|морепродукт'], ['drink', 'напо|напит'], ['sweet', 'солодощ|сладк|десерт'], ['spice', 'спеці|специ|приправ'],
  ].map(([k, re]) => [k, new RegExp(L + '(' + re + ')', 'i')]);
  const RX = C.map(([id, re, cat, not]) => ({ id, cat, not: not || [], re: new RegExp(L + '(' + re + ')', 'i') }));

  const clean = (s) => String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/ы/g, 'и').replace(/э/g, 'е').replace(/ъ/g, '')
    .replace(/[^a-zа-яіїєґ'’ʼ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const memo = new Map();
  function concepts(name) {
    const s = clean(name); if (!s) return { ids: new Set(), cats: new Set() };
    if (memo.has(s)) return memo.get(s);
    const ids = new Set();
    for (const r of RX) if (r.re.test(s)) ids.add(r.id);
    for (const r of RX) if (ids.has(r.id)) for (const n of r.not) { if (ids.has(n)) ids.delete(r.id); }
    const cats = new Set();
    for (const r of RX) if (ids.has(r.id) && r.cat) cats.add(r.cat);
    for (const [k, re] of CATS) if (re.test(s)) cats.add(k);
    // «Плавлений сир» — це сир, а не «кисломолочне»; «сир кисломолочний» — це творог: cottage перемагає cheese
    if (ids.has('cottage')) ids.delete('cheese');
    const out = { ids, cats };
    if (memo.size > 3000) memo.clear();
    memo.set(s, out);
    return out;
  }
  const STOP = new Set(['для', 'без', 'або', 'зі', 'із', 'по', 'на', 'та', 'і', 'з', 'в', 'у']);
  const stems = (s) => clean(s).split(/[\s-]+/).filter((t) => t.length >= 3 && !STOP.has(t)).map((t) => t.slice(0, 5));
  // збіг: «що шукаємо» (інгредієнт, запит) проти назви продукту
  const MEATS = ['pork', 'beef', 'chicken', 'turkey', 'meat', 'mince'];
  // вода, окріп, лід — є завжди, купувати не треба
  const ALWAYS = new RegExp('^((холодн|тепл|гаряч|крижан|льодян|ледян|кип[’\'ʼ]?ячен|питн|фільтрован|очищен|чист)\\S*\\s+)?(вод(а|и|у|і|ою)|окріп|окропу|кип[’\'ʼ]?яток|кип[’\'ʼ]?ятку|лід|льод|лед)(?![а-яіїєґ])', 'i');
  window.foodAlways = (name) => ALWAYS.test(clean(name));
  function matchOne(query, name) {
    const q = concepts(query); const p = concepts(name);
    const cq = clean(query); const cn = clean(name);
    if (!cq || !cn) return false;
    if (cq === cn) return true;
    if (q.ids.size) {
      // усі названі поняття мають бути в продукті; «м'ясо» — будь-яке м'ясо; «фарш» можна зробити з будь-якого м'яса
      return [...q.ids].every((id) => p.ids.has(id)
        || (id === 'meat' && p.cats.has('meat'))
        || (id === 'mince' && !p.ids.has('sausage') && MEATS.some((m) => p.ids.has(m))));
    }
    if (q.cats.size) return [...q.cats].some((c) => p.cats.has(c));
    // невідоме слово: збіг за основами слів або підрядок (від 4 літер)
    const a = stems(query); const b = stems(name);
    if (a.length && a.every((x) => b.includes(x))) return true;
    return cq.length >= 4 && (cn.includes(cq) || (cn.length >= 4 && cq.includes(cn)));
  }
  // збіг: «що шукаємо» (інгредієнт, запит) проти назви продукту; «А або Б» — досить будь-якого
  function foodMatch(query, name) {
    if (window.foodAlways(query)) return true;
    const alts = String(query == null ? '' : query).split(/\s+(?:або|чи|или)\s+|\s*\/\s*/i).filter(Boolean);
    return (alts.length > 1 ? alts : [query]).some((a) => matchOne(a, name));
  }
  window.foodMatch = foodMatch;
  window.foodConcepts = concepts;
  // пошук у списку продуктів: спершу за змістом, а також простий підрядок
  window.foodSearch = (query, list, get) => {
    const q = clean(query); if (!q) return list;
    return list.filter((x) => { const n = get ? get(x) : x; return foodMatch(query, n) || clean(n).includes(q); });
  };
})();

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
  const matches = (p, key) => foodMatch(key, p.name);
  function stockOf(name, min) {
    const key = norm(name);
    const list = state.products.filter((p) => isActive(p) && matches(p, key));
    if (!list.length) return { known: true, base: 0 };
    let sum = 0; let ok = false;
    for (const p of list) { const q = parseQty(measureOf(p)); if (q && q.t === min.t) { sum += q.v; ok = true; } }
    return ok ? { known: true, base: sum } : { known: false, base: 0 };
  }
  const hasIng = (ing) => state.products.some((p) => foodMatch(ing, p.name));

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
  const hiddenShop = () => state.shopHidden || (state.shopHidden = {});
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
    const hid = hiddenShop();
    return [...map.values()].filter((it) => !hid[it.key] || it.src.has('вручну'));
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
      h('span', { class: 'mute shop-p' }, priceOf(i.name) != null ? money(priceOf(i.name)) : '—'),
      h('button', { class: 'link shop-x', type: 'button', title: 'Прибрати зі списку', 'aria-label': 'Прибрати зі списку: ' + i.name, onclick: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (i.src.has('вручну')) state.shopManual = manual().filter((m) => norm(m.name) !== i.key);
        hiddenShop()[i.key] = true; delete dn[i.key];
        save(); render();
      } }, '✕')))
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
        manual().length ? h('button', { class: 'link', type: 'button', onclick: () => { state.shopManual = []; save(); render(); } }, 'Прибрати додані вручну') : null,
        Object.keys(hiddenShop()).length ? h('button', { class: 'link', type: 'button', onclick: () => { state.shopHidden = {}; save(); render(); } }, 'Повернути прибрані (' + Object.keys(hiddenShop()).length + ')') : null),
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
        const res = await X.callApi('/api/import-recipe', /^https?:\/\/\S+$/i.test(v) ? { url: v, servings: Number((state.profile || {}).servings) || 2 } : { text: v, servings: Number((state.profile || {}).servings) || 2 });
        const r = res.recipe;
        const buy = r.ings.filter((i) => !hasIng(i));
        msg.textContent = res.source === 'site' ? 'Готово, розібрано без ШІ. Перевірте й збережіть.' : 'Готово (розібрано ШІ). Перевірте й збережіть.';
        const saved = h('span', { class: 'mute' });
        out.replaceChildren(h('div', { class: 'card' },
          h('div', { class: 'tag' }, r.tech || 'Імпорт'), h('h3', {}, r.title),
          h('div', { class: 'mute' }, [r.minutes && r.minutes + ' хв', r.servings && r.servings + ' порц.'].filter(Boolean).join(' · ') || ' '),
          h('div', { class: 'kv', style: 'align-items:flex-start' }, h('span', { class: 'mute' }, 'Інгредієнти'), h('ul', { style: 'list-style:none;margin:0;padding:0;text-align:right' }, r.ings.map((i) => h('li', {}, i)))),
          h('div', { class: 'kv', style: 'align-items:flex-start' }, h('span', { class: 'mute' }, 'Докупити'), buy.length ? h('ul', { style: 'list-style:none;margin:0;padding:0;text-align:right' }, buy.map((i) => h('li', {}, i))) : h('span', {}, 'нічого')),
          r.steps.length ? h('details', { class: 'steps' }, h('summary', {}, 'Приготування'), h('ol', {}, r.steps.map((t) => h('li', {}, t)))) : null,
          h('button', { class: 'ghost', type: 'button', onclick: (e) => {
            state.recipes.push({ id: uid(), title: r.title, tech: r.tech, minutes: r.minutes, servings: r.servings, ings: r.ings, steps: r.steps });
            save(); e.target.disabled = true; saved.textContent = 'Збережено'; render();
          } }, 'Зберегти'), saved));
      } catch (e) { msg.textContent = e.message; }
      btn.disabled = false;
    } }, 'Розібрати рецепт');
    return h('div', { class: 'card', style: 'margin-bottom:28px' }, h('div', { class: 'tag' }, 'Рецепт із посилання'),
      h('p', { class: 'mute', style: 'margin:8px 0 12px' }, 'Спершу розбираємо без ШІ, перераховуємо на ваші порції й перекладаємо українською; ШІ підключається лише якщо не вийшло.'), box, h('div', { style: 'margin-top:12px' }, btn), msg, out);
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
      const useSoon = soon.filter((p) => r.ings.some((i) => foodMatch(i, p.name)));
      const like = r.ings.filter((i) => likes.some((l) => norm(i).includes(l) || foodMatch(l, i))).length;
      const fz = frozenFor(r);
      return { r, missing, useSoon, fz, score: missing.length * 10 - useSoon.length * 6 - like * 3 + fz.length * 2 };
    }).sort((a, b) => a.score - b.score).slice(0, 3);
  }
  function list(s) { return String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean); }
  // Розморожувати наперед має сенс для м'яса, риби, готових страв; жири, спеції й бакалію пропускаємо
  const NO_THAW = /масл|олі|олій|сіл|цукор|борошн|спец|перець|оцет|дріжд|розпушув|мед\b|кориц|паприк|лавров/i;
  function thawTips() {
    const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
    const out = []; const seen = new Set();
    [[0, 'сьогодні'], [1, 'завтра']].forEach(([off, label]) => {
      for (const [mk] of MEALS) {
        const t = (state.menu || {})[dayIdx(off) + '-' + mk]; const r = t && byTitle.get(norm(t)); if (!r) continue;
        for (const p of frozenFor(r)) {
          const k = norm(p.name);
          if (NO_THAW.test(p.name) || seen.has(k)) continue;
          seen.add(k); out.push({ p, label });
        }
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
      fz.map((p) => h('div', { class: 'kv row-line', style: 'flex-wrap:wrap;gap:4px 12px' }, h('span', {}, p.name + (qtyText(p) ? ' · ' + qtyText(p) : '')),
        h('span', {}, h('span', { class: 'mute' }, 'до ' + fmtDate(p.exp) + ' '),
          h('button', { class: 'link', type: 'button', onclick: () => editProduct(p) }, 'Змінити'), ' ',
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
  // ---------- вивантаження комори ----------
  const REASON_TXT = { used: 'використано', thrown: 'викинуто', removed: 'прибрано' };
  function exportRows(withArchive) {
    const rows = state.products.map((p) => ({ n: p.name, q: p.qty || '', w: p.weight || '', st: p.store || '', pr: p.price, b: p.bought || '', e: p.exp || '', where: p.frozen ? 'морозилка' : 'комора', why: '' }));
    if (withArchive) for (const a of state.archive || []) rows.push({ n: a.name, q: a.qty || '', w: a.weight || '', st: a.store || '', pr: a.price, b: a.bought || '', e: a.exp || '', where: 'архів', why: (REASON_TXT[a.reason] || '') + (a.archivedAt ? ' ' + fmtDate(a.archivedAt) : '') });
    return rows;
  }
  function exportText(withArchive) {
    const rows = exportRows(withArchive);
    const groups = ['комора', 'морозилка', 'архів'];
    const out = ['Ducky · комора на ' + fmtDate(todayISO()), ''];
    for (const g of groups) {
      const l = rows.filter((r) => r.where === g); if (!l.length) continue;
      out.push(g.toUpperCase() + ' (' + l.length + ')');
      for (const r of l) out.push('• ' + r.n + [r.q, r.w].filter(Boolean).map((x) => ' · ' + x).join('') + (r.e ? ' · до ' + fmtDate(r.e) : '') + (r.st ? ' · ' + r.st : '') + (r.pr != null ? ' · ' + r.pr + ' ₴' : '') + (r.why ? ' · ' + r.why : ''));
      out.push('');
    }
    return out.join('\n').trim() + '\n';
  }
  function exportCsv(withArchive) {
    const cell = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const head = ['Продукт', 'Кількість', "Вага / об'єм", 'Магазин', 'Ціна, ₴', 'Куплено', 'Придатний до', 'Де', 'Що сталось'];
    const lines = [head, ...exportRows(withArchive).map((r) => [r.n, r.q, r.w, r.st, r.pr == null ? '' : String(r.pr).replace('.', ','), r.b, r.e, r.where, r.why])];
    return '\ufeff' + lines.map((l) => l.map(cell).join(';')).join('\r\n') + '\r\n';
  }
  function saveFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportCard() {
    const arch = h('input', { type: 'checkbox', id: 'exArch' });
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:10px 0 0' });
    const stamp = () => todayISO();
    const total = () => state.products.length + (arch.checked ? (state.archive || []).length : 0);
    const go = (fn) => () => { if (!total()) { msg.textContent = 'Комора порожня, вивантажувати нічого.'; return; } try { fn(); } catch (e) { msg.textContent = 'Не вдалося: ' + e.message; } };
    return h('div', { class: 'card', style: 'margin-top:28px' }, h('h2', {}, 'Вивантажити комору'),
      h('p', { class: 'mute', style: 'margin:0 0 12px' }, 'Весь список у текст для повідомлення, у таблицю для Excel або у резервну копію.'),
      h('label', { class: 'check', for: 'exArch', style: 'margin-bottom:12px;display:flex;gap:8px;align-items:center' }, arch, 'Додати архів'),
      h('div', { class: 'toolbar' },
        h('button', { class: 'ghost', type: 'button', onclick: go(async () => {
          try { await navigator.clipboard.writeText(exportText(arch.checked)); msg.textContent = 'Скопійовано. Можна вставити в повідомлення чи нотатки.'; }
          catch (e) { msg.textContent = 'Не вдалося скопіювати автоматично. Завантажте файл .txt.'; }
        }) }, 'Скопіювати текстом'),
        h('button', { class: 'ghost', type: 'button', onclick: go(() => { saveFile('ducky-komora-' + stamp() + '.txt', exportText(arch.checked), 'text/plain;charset=utf-8'); msg.textContent = 'Файл .txt завантажено.'; }) }, 'Файл .txt'),
        h('button', { class: 'ghost', type: 'button', onclick: go(() => { saveFile('ducky-komora-' + stamp() + '.csv', exportCsv(arch.checked), 'text/csv;charset=utf-8'); msg.textContent = 'Файл .csv завантажено. Відкривається в Excel і Google Таблицях.'; }) }, 'Таблиця .csv'),
        h('button', { class: 'ghost', type: 'button', onclick: go(() => { saveFile('ducky-rezerv-' + stamp() + '.json', JSON.stringify({ app: 'ducky', exported: stamp(), products: state.products, archive: state.archive || [], receipts: state.receipts, recipes: state.recipes, menu: state.menu }, null, 2), 'application/json'); msg.textContent = 'Резервну копію .json завантажено.'; }) }, 'Копія .json')),
      msg);
  }

  const origPantry = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = origPantry();
    out.splice(3, 0, todayCard());
    const fc = freezerCard();
    if (fc) { const ai = out.findIndex((el) => el && el.classList && el.classList.contains('archive')); out.splice(ai < 0 ? out.length : ai, 0, fc); }
    out.push(exportCard());
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
    const store = h('input', { list: 'dl-stores', autocomplete: 'off', placeholder: 'Магазин (необов\'язково)', 'aria-label': 'Магазин для всіх' });
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
    const inp = (label, k, attrs = {}) => h('label', {}, label, k === 'qty' ? qtyInput({ value: f[k], onInput: (v) => { f[k] = v; } }) : h('input', { value: f[k], ...attrs, oninput: (e) => { f[k] = e.target.value; } }));
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
        h('div', { style: 'grid-column:1/-1' }, inp('Продукт', 'name', { list: 'dl-products', autocomplete: 'off' })), inp('Кількість', 'qty', { placeholder: '2 шт' }), inp('Вага / об\'єм', 'weight', { placeholder: '500 г' }), inp('Магазин', 'store', { list: 'dl-stores', autocomplete: 'off' }),
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
          k === 'qty' ? qtyInput({ value: l.qty, onInput: (v) => { l.qty = v; } }) : h('input', { 'aria-label': ph, placeholder: ph, type, list: k === 'name' ? 'dl-products' : null, autocomplete: k === 'name' ? 'off' : null, value: l[k], step: type === 'number' ? '0.01' : null, min: type === 'number' ? '0' : null, oninput: (e) => { l[k] = e.target.value; upd(); } })),
        h('button', { class: 'link', type: 'button', onclick: () => { lines.splice(i, 1); draw(); upd(); } }, 'Видалити'))));
    };
    draw(); upd();
    let armed = false;
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px' },
        h('label', {}, 'Магазин', h('input', { list: 'dl-stores', autocomplete: 'off', value: f.store, oninput: (e) => { f.store = e.target.value; } })),
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
      const MEAL_ICON = { b: 'sun', l: 'bowl', d: 'moon' };
      const today = dayIdx(0);
      const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
      const statusEl = (title) => {
        const t = String(title || '').trim();
        if (!t) return h('span', { class: 'st no' }, 'не заплановано');
        const r = byTitle.get(norm(t));
        if (!r) return h('span', { class: 'st no' }, 'немає рецепта');
        const miss = r.ings.filter((i) => !hasIng(i)).length;
        return miss === 0 ? h('span', { class: 'st ok' }, icon('check'), 'все є') : h('span', { class: 'st bad' }, icon('cart'), 'докупити ' + miss);
      };
      const cards = h('div', { class: 'daycards' }, DAYS.map((d, di) => h('div', { class: 'daycard' + (di === today ? ' today' : '') },
        h('header', {}, h('b', {}, DAY_FULL[di]), h('span', {}, di === today ? 'сьогодні' : '')),
        MEALS.map(([mk, ml]) => {
          const st = h('div', { class: 'st-wrap' }, statusEl((state.menu || {})[di + '-' + mk]));
          return h('div', { class: 'mrow' }, h('span', { class: 'mi', title: ml }, icon(MEAL_ICON[mk])),
            h('div', { class: 'mb' },
              h('input', { list: 'recipeTitles', placeholder: ml, value: (state.menu || {})[di + '-' + mk] || '', 'aria-label': ml + ' ' + d,
                oninput: (e) => { const o = orig[ml + ', ' + d]; if (o) { o.value = e.target.value; o.dispatchEvent(new Event('input')); } st.replaceChildren(statusEl(e.target.value)); } }),
              st));
        }))));
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


  // ---------- Дім: планувальник (чиста логіка, без DOM) ----------
  (function (root) {
    const pad = (n) => String(n).padStart(2, '0');
    const localISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
    const wdOf = (iso) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;      // Пн = 0
    const diff = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
    const hm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : 18 * 60; };
    const fmtHM = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
    // порядок у кімнаті: спершу пил, потім пилосос, у кінці вологе прибирання підлоги
    const stepOf = (title) => {
      const t = String(title || '').toLowerCase();
      if (/(?<![а-яіїєґ])(пил(?!ос)|протер|поверхн|полиц)/.test(t)) return 1;
      if (/пилосос|підмест|підмет/.test(t)) return 3;
      if (/підлог|швабр|помит.*пол|мокре/.test(t)) return 4;
      return 2;
    };
    const DEF_W = [0, 1, 2, 3, 4].map(() => [[18 * 60 + 30, 19 * 60 + 15]]).concat([[[10 * 60, 12 * 60 + 30]], [[11 * 60, 13 * 60]]]);
    const DEF_HOURS = DEF_W.map((w) => ({ w: w.map((x) => [fmtHM(x[0]), fmtHM(x[1])]) }));
    // години на день: «вікна» (до двох), напр. 19:00–20:00 і 08:00–08:20; старий формат start+min теж читається
    const hoursFrom = (arr) => DEF_W.map((dw, i) => {
      const h = (Array.isArray(arr) ? arr : [])[i] || {}; let wins;
      if (h.off) wins = [];
      else if (Array.isArray(h.w)) wins = h.w.map((x) => [hm(x[0]), hm(x[1])]).filter((x) => x[1] > x[0]);
      else if (h.start || h.min != null) { const st = hm(h.start || fmtHM(dw[0][0])); const m = h.min == null || h.min === '' ? dw[0][1] - dw[0][0] : Math.max(0, Number(h.min) || 0); wins = m > 0 ? [[st, st + m]] : []; }
      else wins = dw;
      wins.sort((a, b) => a[0] - b[0]);
      const cap = wins.reduce((s2, x) => s2 + (x[1] - x[0]), 0);
      return { start: fmtHM(wins[0] ? wins[0][0] : 18 * 60), min: cap, wins };
    });
    const hoursOf = (home) => hoursFrom(home.hours);
    // кілька людей: у кожного свій графік (hoursBy), справи розподіляються між ними
    const peopleOf = (home) => { const seen = new Set(); return (Array.isArray(home.people) ? home.people : []).map((x) => String(x || '').trim()).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())); };
    const hoursFor = (home, name) => hoursFrom(((home.hoursBy || {})[name]) || home.hours);

    // Склад «що й коли»: кожна справа має «строк» і вікно, в якому її можна переносити
    function candidates(home, today, horizonEnd) {
      const out = [];
      const rec = (home.chores || []).map((c) => ({ ...c, _t: 'chore' })).concat((home.tasks || []).filter((t) => !t.done && Number(t.every) > 0).map((t) => ({ ...t, _t: 'task', must: t.prio === 'high', room: t.room || null })));
      rec.forEach((c, idx) => {
        const every = Math.max(1, Number(c.every) || 7);
        const last = c.last || null;
        let next = last ? addDays(last, every) : addDays(today, c.must ? 0 : idx % Math.min(every, 7));
        if (c.wd != null && c.wd !== '' && !isNaN(Number(c.wd))) {
          const base = next < today ? today : next; const w = Number(c.wd);
          next = addDays(base, (w - wdOf(base) + 7) % 7);
        }
        const flex = c.wd != null && c.wd !== '' ? 0 : every >= 14 ? 3 : every >= 7 ? 2 : every >= 3 ? 1 : 0;
        const slack = c.must || (c.wd != null && c.wd !== '') ? 0 : every >= 7 ? 2 : every >= 3 ? 1 : 0;
        for (let k = 0; k < 40; k++) {
          const due = k === 0 ? next : addDays(next < today ? today : next, k * every);
          if (due > (k === 0 ? addDays(horizonEnd, flex) : horizonEnd)) break;
          const overdue = due < today;
          const fl = k === 0 ? flex : 0;
          let lo = overdue ? today : addDays(due, -fl); if (lo < today) lo = today;
          let hi = overdue ? (c.must ? today : addDays(today, Math.min(2, slack + 1))) : addDays(due, slack);
          if (c.snooze && k === 0 && lo < c.snooze) { lo = c.snooze; if (hi < lo) hi = lo; }
          let pinned = false;
          if (k === 0 && c.pin && c.pin >= today) { if (c.pin > horizonEnd) continue; lo = c.pin; hi = c.pin; pinned = true; }
          if (hi > horizonEnd) hi = horizonEnd;
          if (lo > hi) continue;
          out.push({ key: (c._t === 'task' ? 't:' : 'c:') + c.id + (k ? '#' + k : ''), type: c._t, id: c.id, title: c.title, room: c.room, minutes: Math.max(1, Number(c.minutes) || (c._t === 'task' ? 20 : 15)), must: !!c.must, due, overdue, lo, hi, fixed: c.wd != null && c.wd !== '', who: c.who || '', after: c.after || null, last: c.last || null, forced: pinned || !!c.must || overdue && !!c.must, step: c._t === 'task' ? 0 : stepOf(c.title), prio: c._t === 'task' ? (c.prio || 'norm') : 'norm', repeat: c._t === 'task' });
        }
      });
      (home.tasks || []).forEach((t) => {
        if (t.done || Number(t.every) > 0) return;
        const due = t.due || null; const overdue = !!due && due < today;
        let lo = today; if (t.snooze && t.snooze > lo) lo = t.snooze;
        let hi = due ? (due < today ? today : due) : (t.prio === 'high' ? addDays(today, 1) : horizonEnd);
        if (hi > horizonEnd) hi = horizonEnd;
        let pinned = false;
        if (t.pin && t.pin >= today) { if (t.pin > horizonEnd) return; lo = t.pin; hi = t.pin; pinned = true; }
        if (hi < lo) hi = lo;
        if (lo > horizonEnd) return;
        out.push({ who: t.who || '', after: t.after || null, last: t.last || null, key: 't:' + t.id, type: 'task', id: t.id, title: t.title, room: t.room || null, minutes: Math.max(1, Number(t.minutes) || 20), must: false, due, overdue, lo, hi, forced: pinned || overdue || (t.prio === 'high' && !!due && due <= horizonEnd && hi === lo), step: 0, prio: t.prio || 'norm' });
      });
      return out;
    }

    function planOne(home, today, opts) {
      const n = (opts && opts.days) || 7;
      const horizonEnd = addDays(today, n - 1);
      const hours = (opts && opts.hours) || hoursOf(home);
      const days = Array.from({ length: n }, (_, i) => { const date = addDays(today, i); const hh = hours[wdOf(date)]; return { date, wd: wdOf(date), cap: hh.min, start: hh.start, wins: hh.wins, items: [], load: 0 }; });
      const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
      const rank = (c) => (c.forced ? 0 : c.prio === 'high' ? 1 : c.type === 'chore' || c.due ? 2 : 3);
      const cand = ((opts && opts.cand) || candidates(home, today, horizonEnd)).sort((a, b) => rank(a) - rank(b) || (a.hi < b.hi ? -1 : a.hi > b.hi ? 1 : 0) || b.minutes - a.minutes);
      const unplaced = []; const waiting = []; const placedAt = {};
      const lookup = (key) => (/^c:/.test(key) ? (home.chores || []).find((x) => 'c:' + x.id === key) : (home.tasks || []).find((x) => 't:' + x.id === key));
      const placeOne = (c) => {
        if (c.after && !/#/.test(c.key)) {
          if (placedAt[c.after] != null) { if (placedAt[c.after] > c.lo) c.lo = placedAt[c.after]; if (c.lo > c.hi) { waiting.push(c); return; } }
          else { const a = lookup(c.after); if (!(a && a.last && (!c.last || a.last >= c.last))) { waiting.push(c); return; } }
        }
        let best = null;
        for (let d = c.lo; d <= c.hi; d = addDays(d, 1)) {
          const day = byDate[d]; if (!day) continue;
          const after = day.load + c.minutes;
          const over = after > day.cap;
          if (over && !c.forced) continue;
          let score = after / Math.max(day.cap, 30);
          if (day.cap === 0) score += 5;
          if (over) score += 3;                                            // обов'язкове лізе в день лише якщо інакше нікуди
          if (c.type === 'chore') score += Math.abs(diff(d, c.due)) * 0.12;
          else if (!c.due) score += diff(d, today) * 0.03;
          if (c.room && day.items.some((x) => x.room === c.room)) score -= 0.35;   // прибирання кімнати разом
          if (!best || score < best.score) best = { day, score };
        }
        if (best) { best.day.items.push({ ...c, date: best.day.date }); best.day.load += c.minutes; if (!/#/.test(c.key)) placedAt[c.key] = best.day.date; } else unplaced.push(c);
      };
      cand.filter((c) => !c.after).forEach(placeOne);
      cand.filter((c) => c.after).forEach(placeOne);
      // вирівнювання: переносимо справи з перевантажених днів на легші, у межах дозволеного вікна (від lo до hi).
      // Якщо «заповнювати вільний час» увімкнено, справу можна поставити й раніше, але не більш ніж за 4 дні до строку.
      const fillOn = home.fill !== false;
      const ratio = (d, extra) => (d.cap > 0 ? (d.load + (extra || 0)) / d.cap : d.load > 0 ? 99 : 0);
      for (let guard = 0; guard < 400; guard++) {
        let best = null;
        for (const src of days) {
          const rs = ratio(src); if (rs <= 0) continue;
          for (const it of src.items) {
            if (it.forced || it.fixed || it.after || /#/.test(it.key)) continue;
            for (const tgt of days) {
              if (tgt === src || tgt.cap <= 0 || tgt.load + it.minutes > tgt.cap) continue;
              const okWin = tgt.date >= it.lo && tgt.date <= it.hi;
              const okEarly = fillOn && tgt.date < src.date && diff(it.due || src.date, tgt.date) <= 4;
              if (!okWin && !okEarly) continue;
              const rt = ratio(tgt, it.minutes);
              const gain = rs - rt;                       // скільки виграємо у вирівнюванні
              if (gain <= 0.05) continue;
              if (!best || gain > best.gain) best = { src, tgt, it, gain };
            }
          }
        }
        if (!best) break;
        best.src.items.splice(best.src.items.indexOf(best.it), 1); best.src.load -= best.it.minutes;
        best.tgt.items.push({ ...best.it, date: best.tgt.date }); best.tgt.load += best.it.minutes;
      }
      // порядок у дні: окремі задачі, далі кімнати за порядком у списку, у кімнаті пил → підлога
      const roomIdx = (id) => { const i = (home.rooms || []).findIndex((r) => r.id === id); return i < 0 ? 99 : i; };
      for (const day of days) {
        day.items.sort((a, b) => {
          const ta = a.type === 'task' && !a.room ? 0 : 1; const tb = b.type === 'task' && !b.room ? 0 : 1;
          if (ta !== tb) return ta - tb;
          if (ta === 0) return (a.prio === 'high' ? 0 : 1) - (b.prio === 'high' ? 0 : 1) || a.minutes - b.minutes;
          return roomIdx(a.room) - roomIdx(b.room) || a.step - b.step || a.minutes - b.minutes;
        });
        for (let pass = 0; pass < 3; pass++) for (const it of day.items.slice()) {
          if (!it.after) continue; const ai = day.items.findIndex((x) => x.key === it.after); const bi = day.items.indexOf(it);
          if (ai >= 0 && bi < ai) { day.items.splice(bi, 1); day.items.splice(day.items.findIndex((x) => x.key === it.after) + 1, 0, it); }
        }
        let wi = 0; let t = day.wins.length ? day.wins[0][0] : 18 * 60;
        for (const it of day.items) {
          while (wi < day.wins.length - 1 && t + it.minutes > day.wins[wi][1]) { wi++; t = day.wins[wi][0]; }
          it.startMin = t; it.endMin = t + it.minutes; t += it.minutes;
        }
      }
      return { days, unplaced, waiting };
    }

    // розподіл між кількома людьми: явні виконавці лишаються, решту ділимо за вільним часом кожного, кімнату прибирає одна людина
    function planWeek(home, today, opts) {
      const people = peopleOf(home);
      if (people.length < 2) return planOne(home, today, opts);
      const n = (opts && opts.days) || 7; const horizonEnd = addDays(today, n - 1);
      const cand = candidates(home, today, horizonEnd);
      const hrs = {}; const week = {}; const load = {};
      people.forEach((p) => { hrs[p] = hoursFor(home, p); week[p] = hrs[p].reduce((s2, x) => s2 + x.min, 0); load[p] = 0; });
      const nm = (x) => String(x || '').trim().toLowerCase();
      const byName = {}; people.forEach((p) => { byName[nm(p)] = p; });
      const base = (c) => c.key.replace(/#.*$/, '');
      const owner = new Map(); const explicit = new Set();
      for (const c of cand) { const p = byName[nm(c.who)]; if (p) { owner.set(base(c), p); explicit.add(base(c)); } if (owner.has(base(c))) load[owner.get(base(c))] += c.minutes; }
      const pick = (m) => people.slice().sort((a, b) => ((load[a] + m) / (week[a] || 1) + (week[a] ? 0 : 100)) - ((load[b] + m) / (week[b] || 1) + (week[b] ? 0 : 100)))[0];
      const groups = new Map();
      for (const c of cand) {
        if (owner.has(base(c)) || c.after) continue;
        const g = c.room ? 'r:' + c.room : 'k:' + base(c);
        if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c);
      }
      [...groups.values()].sort((a, b) => b.reduce((s2, x) => s2 + x.minutes, 0) - a.reduce((s2, x) => s2 + x.minutes, 0)).forEach((g) => {
        const m = g.reduce((s2, x) => s2 + x.minutes, 0); const p = pick(m); load[p] += m;
        g.forEach((c) => owner.set(base(c), p));
      });
      for (const c of cand) {   // залежні справи йдуть до того, хто робить попередню
        if (owner.has(base(c))) continue;
        const p = owner.get(c.after) || pick(c.minutes); load[p] += c.minutes; owner.set(base(c), p);
      }
      const per = {};
      people.forEach((p) => {
        const mine = cand.filter((c) => owner.get(base(c)) === p).map((c) => ({ ...c, who: p, auto: !explicit.has(base(c)) }));
        per[p] = planOne(home, today, { ...opts, hours: hrs[p], cand: mine });
      });
      const days = per[people[0]].days.map((d, i) => {
        const items = []; const caps = {}; const loads = {}; let cap = 0; let ld = 0;
        people.forEach((p) => { const dd = per[p].days[i]; caps[p] = dd.cap; loads[p] = dd.load; cap += dd.cap; ld += dd.load; items.push(...dd.items); });
        items.sort((a, b) => a.startMin - b.startMin);
        return { date: d.date, wd: d.wd, cap, load: ld, caps, loads, items };
      });
      return { days, unplaced: people.flatMap((p) => per[p].unplaced), waiting: people.flatMap((p) => per[p].waiting), people, per };
    }
    root.DuckyPlan = { planWeek, localISO, addDays, wdOf, diff, hoursOf, hoursFrom, hoursFor, peopleOf, fmtHM, DEF_HOURS, stepOf };
  })(typeof window !== 'undefined' ? window : globalThis);

  // ---------- ДІМ: прибирання, задачі й розклад на день ----------
  // ----- Спільний «Дім»: злиття змін двох людей, кожну справу окремо -----
  // Кожна кімната, справа й задача має мітку часу зміни (mt). Видалення пам'ятається (del), позначки «зроблено» ведуться по кожній парі день+справа (lg).
  (function homeMerge(root) {
    const COLS = ['rooms', 'chores', 'tasks'];
    const hashOf = (x) => { const c = {}; for (const k of Object.keys(x)) if (k !== 'mt' && k !== 'mh') c[k] = x[k]; const t = JSON.stringify(c); let n = 5381; for (let i = 0; i < t.length; i++) n = ((n * 33) ^ t.charCodeAt(i)) >>> 0; return n.toString(36) + t.length; };
    const settingsOf = (hm) => JSON.stringify([hm.hours || [], hm.fill !== false]);
    function stamp(hm, now) {
      if (!hm || typeof hm !== 'object') return;
      if (!hm.del || typeof hm.del !== 'object') hm.del = {};
      const cur = {};
      for (const c of COLS) {
        cur[c] = [];
        for (const x of (Array.isArray(hm[c]) ? hm[c] : [])) {
          if (!x || !x.id) continue;
          cur[c].push(x.id);
          const hh = hashOf(x); if (x.mh !== hh) { x.mt = now; x.mh = hh; }
        }
        if (hm.known && Array.isArray(hm.known[c])) for (const id of hm.known[c]) if (!cur[c].includes(id) && !hm.del[id]) hm.del[id] = now;
      }
      hm.known = cur;
      const sg = settingsOf(hm); if (hm.sh !== sg) { hm.sh = sg; hm.smt = now; }
      // люди та їхні графіки: кожен графік зливається окремо, за часом зміни
      const prj = JSON.stringify(hm.pri || null); if (hm.prh !== prj) { hm.prh = prj; hm.prmt = now; }
      const pj = JSON.stringify(hm.people || []); if (hm.pph !== pj) { hm.pph = pj; hm.pmt = now; }
      if (hm.hoursBy && typeof hm.hoursBy === 'object') {
        if (!hm.hbh) hm.hbh = {}; if (!hm.hbm) hm.hbm = {};
        for (const nme of Object.keys(hm.hoursBy)) { const t = JSON.stringify(hm.hoursBy[nme]); if (hm.hbh[nme] !== t) { hm.hbh[nme] = t; hm.hbm[nme] = now; } }
      }
      // «зроблено»: кожна пара день+справа це окремий запис [1|0, час]
      if (!hm.lg || typeof hm.lg !== 'object') hm.lg = {};
      const log = hm.log && typeof hm.log === 'object' ? hm.log : {};
      for (const d of Object.keys(log)) for (const k of log[d]) { const r = hm.lg[d + '|' + k]; if (!r || r[0] !== 1) hm.lg[d + '|' + k] = [1, now]; }
      for (const key of Object.keys(hm.lg)) {
        const r = hm.lg[key]; const i = key.indexOf('|'); const d = key.slice(0, i); const k = key.slice(i + 1);
        if (r[0] === 1 && !(log[d] || []).includes(k)) hm.lg[key] = [0, now];
        if (r[1] < now - 30 * 864e5) delete hm.lg[key];
      }
      for (const id of Object.keys(hm.del)) if (hm.del[id] < now - 30 * 864e5) delete hm.del[id];
    }
    function merge(L, R, now) {
      if (!R || typeof R !== 'object') return L;
      if (!L || typeof L !== 'object') return R;
      now = now || Date.now();
      stamp(L, now);
      const out = { ...R, ...L };
      const del = { ...(R.del || {}) }; for (const id of Object.keys(L.del || {})) del[id] = Math.max(del[id] || 0, L.del[id]);
      out.del = del;
      for (const c of COLS) {
        const m = new Map();
        for (const x of (Array.isArray(R[c]) ? R[c] : [])) if (x && x.id) m.set(x.id, x);
        for (const x of (Array.isArray(L[c]) ? L[c] : [])) { if (!x || !x.id) continue; const o = m.get(x.id); if (!o || (x.mt || 0) >= (o.mt || 0)) m.set(x.id, x); }
        out[c] = [...m.values()].filter((x) => !(del[x.id] && del[x.id] >= (x.mt || 0)));
      }
      if ((R.smt || 0) > (L.smt || 0)) { out.hours = R.hours; out.fill = R.fill; out.sh = R.sh; out.smt = R.smt; }
      const lg = { ...(R.lg || {}) };
      for (const key of Object.keys(L.lg || {})) { const a = L.lg[key]; const b = lg[key]; if (!b || a[1] >= b[1]) lg[key] = a; }
      out.lg = lg;
      const log = {};
      for (const key of Object.keys(lg)) if (lg[key][0] === 1) { const i = key.indexOf('|'); (log[key.slice(0, i)] || (log[key.slice(0, i)] = [])).push(key.slice(i + 1)); }
      out.log = log;
      out.hist = { ...(R.hist || {}), ...(L.hist || {}) };
      if ((R.prmt || 0) > (L.prmt || 0)) { out.pri = R.pri; out.prmt = R.prmt; out.prh = R.prh; }
      if ((R.pmt || 0) > (L.pmt || 0)) { out.people = R.people; out.pmt = R.pmt; out.pph = R.pph; }
      const hb = { ...(R.hoursBy || {}) }; const hbm = { ...(R.hbm || {}) }; const hbh = { ...(R.hbh || {}) };
      for (const nme of Object.keys(L.hoursBy || {})) { if (!(nme in hb) || ((L.hbm || {})[nme] || 0) >= (hbm[nme] || 0)) { hb[nme] = L.hoursBy[nme]; hbm[nme] = (L.hbm || {})[nme] || 0; hbh[nme] = (L.hbh || {})[nme]; } }
      out.hoursBy = hb; out.hbm = hbm; out.hbh = hbh;
      stamp(out, now);
      return out;
    }
    root.DuckyMerge = { stamp, merge };
  })(typeof window !== 'undefined' ? window : globalThis);

  // підключення до збереження: мітки часу при кожному save, злиття перед відправкою у спільну базу
  (function homeSync() {
    if (typeof window === 'undefined') return;
    const M = window.DuckyMerge;
    const baseSave = save;
    save = function () { try { if (state && state.home) M.stamp(state.home, Date.now()); } catch (e) { /* не заважаємо збереженню */ } return baseSave.apply(this, arguments); };
    const basePush = pushRemote;
    pushRemote = async function () {
      if (scope === 'me' || !remote || !user || !remoteReady) return basePush();
      const T = 'ducky_household_data'; const hid = scope;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (scope !== hid) return;
        const cur = await sb.from(T).select('data, updated_at').eq('household_id', hid).maybeSingle();
        if (cur.error) { setSync('Не вдалося зберегти', true); return; }
        let changed = false;
        if (cur.data && cur.data.data && cur.data.data.home) {
          const before = JSON.stringify(state.home);
          state.home = M.merge(state.home, cur.data.data.home, Date.now());
          changed = before !== JSON.stringify(state.home);
          saveLocal();
        }
        const at = new Date().toISOString();
        const res = cur.data
          ? await sb.from(T).update({ data: state, updated_at: at, updated_by: user.id }).eq('household_id', hid).eq('updated_at', cur.data.updated_at).select('household_id')
          : await sb.from(T).upsert({ household_id: hid, data: state, updated_at: at, updated_by: user.id });
        if (res.error) { setSync('Не вдалося зберегти', true); return; }
        if (!cur.data || (res.data && res.data.length)) {
          setSync('Збережено');
          if (changed) { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) pendingRemote = true; else render(); }
          return;
        }
      }
      setSync('Не вдалося зберегти: хтось змінює одночасно. Спробуй ще раз.', true);
    };
  })();

  (function homeMode() {
    const P = window.DuckyPlan;
    const MODE_KEY = 'ducky.mode';
    const HOME_TABS = [['h_today', 'Сьогодні'], ['h_week', 'Розклад'], ['h_clean', 'Прибирання'], ['h_tasks', 'Задачі'], ['h_stats', 'Успіхи'], ['h_time', 'Мій час']];
    const KITCHEN_TABS = TABS.slice();
    let kTab = 'pantry'; let hTab = 'h_today';
    const isHome = () => store.get(MODE_KEY) === 'home';
    const todayD = () => P.localISO(new Date());
    const HM = () => {
      if (!state.home || typeof state.home !== 'object') state.home = {};
      const x = state.home;
      for (const k of ['rooms', 'chores', 'tasks', 'hours']) if (!Array.isArray(x[k])) x[k] = [];
      if (!x.log || typeof x.log !== 'object') x.log = {};
      return x;
    };
    const dayName = (iso, long) => new Date(iso + 'T12:00:00').toLocaleDateString('uk-UA', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
    const mins = (m) => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + ' год' + (m % 60 ? ' ' + (m % 60) + ' хв' : '') : m + ' хв'; };
    const WD = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
    const EVERY = [[1, 'щодня'], [2, 'раз на 2 дні'], [3, 'раз на 3 дні'], [7, 'щотижня'], [14, 'раз на 2 тижні'], [30, 'щомісяця'], [90, 'раз на 3 місяці']];
    const everyLabel = (n) => (EVERY.find((e) => e[0] === Number(n)) || [0, 'раз на ' + n + ' дн.'])[1];
    const roomName = (id) => { const r = HM().rooms.find((x) => x.id === id); return r ? r.name : ''; };
    const cases = (n, a) => { const m10 = n % 10; const m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? a[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? a[1] : a[2]); };
    let whoFilter = '';
    const whoNames = () => { const hm = HM(); const set = new Set([user && user.name, ...people()].filter(Boolean)); [...hm.chores, ...hm.tasks].forEach((x) => { if (x.who) set.add(x.who); }); return [...set]; };
    // ----- кілька людей: хто я, чиї справи показувати -----
    const people = () => P.peopleOf(HM());
    const multi = () => people().length >= 2;
    const lc = (x) => String(x || '').trim().toLowerCase();
    const meKey = () => 'ducky.me.' + (user ? user.id : '') + '.' + scope;
    const meKnown = () => { const sv = store.get(meKey()); return !!sv && people().includes(sv); };
    const meName = () => {
      const ps = people(); if (!ps.length) return (user && user.name) || '';
      const sv = store.get(meKey()); if (sv && ps.includes(sv)) return sv;
      const u = lc(user && user.name); return ps.find((x) => lc(x) === u) || ps.find((x) => u && (lc(x).startsWith(u) || u.startsWith(lc(x)))) || ps[0];
    };
    const VW_KEY = 'ducky.vw';
    const viewWho = () => { const v = store.get(VW_KEY); return v === 'other' || v === 'all' ? v : 'me'; };
    const inView = (i) => {
      if (!multi()) return true; const v = viewWho(); if (v === 'all') return true;
      const mine = !i.who || lc(i.who) === lc(meName()); return v === 'me' ? mine : !mine;
    };
    const othersLabel = () => { const o = people().filter((x) => x !== meName()); return o.length ? o.join(', ') : 'Інші'; };
    const capView = (caps, total) => {
      if (!multi() || !caps) return total; const v = viewWho(); const me = meName();
      if (v === 'me') return caps[me]; if (v === 'other') return Object.keys(caps).filter((k) => k !== me).reduce((s2, k) => s2 + caps[k], 0); return total;
    };
    const whoBar = () => !multi() ? null : h('div', { class: 'toolbar', style: 'margin:12px 0;align-items:center' }, h('span', { class: 'mute' }, 'Показати:'),
      [['me', 'Мої'], ['other', othersLabel()], ['all', 'Усі разом']].map(([k, t]) => h('button', { class: viewWho() === k ? 'primary' : 'ghost', type: 'button', onclick: () => { store.set(VW_KEY, k); render(); } }, t)));
    const meAsk = () => !multi() || meKnown() ? null : h('div', { class: 'card', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Хто ти?'),
      h('p', { class: 'mute', style: 'margin:6px 0 10px' }, 'Обери своє імʼя, щоб бачити свої справи й свій графік.'),
      h('div', { class: 'toolbar' }, people().map((n) => h('button', { class: 'ghost', type: 'button', onclick: () => { store.set(meKey(), n); render(); } }, 'Я — ' + n))));
    const whoList = () => h('datalist', { id: 'dl-who' }, whoNames().map((n) => h('option', { value: n })));
    const afterOptions = (selfKey, cur) => {
      const hm = HM();
      return [h('option', { value: '' }, 'Без залежності'),
        ...hm.chores.filter((x) => 'c:' + x.id !== selfKey).map((x) => h('option', { value: 'c:' + x.id, selected: cur === 'c:' + x.id ? true : null }, (roomName(x.room) ? roomName(x.room) + ': ' : '') + x.title)),
        ...hm.tasks.filter((x) => 't:' + x.id !== selfKey && !x.done).map((x) => h('option', { value: 't:' + x.id, selected: cur === 't:' + x.id ? true : null }, 'Задача: ' + x.title))];
    };
    const afterLabel = (key) => { const hm = HM(); const x = /^c:/.test(key || '') ? hm.chores.find((c) => 'c:' + c.id === key) : hm.tasks.find((t) => 't:' + t.id === key); return x ? x.title : ''; };
    const PRIO = [['high', 'Висока'], ['norm', 'Звичайна'], ['low', 'Низька']];

    // ----- знімок плану на сьогодні: щоб список не стрибав, коли відмічаєш справи -----
    const sigOf = (hm) => JSON.stringify([hm.rooms.map((r) => [r.id, r.name]), hm.chores.map((c) => [c.id, c.who, c.after, c.title, c.room, c.every, c.minutes, c.must, c.wd, c.snooze, c.pin]),
      [hm.fill, hm.rooms.length], hm.tasks.map((t) => [t.id, t.who, t.after, t.title, t.due, t.minutes, t.prio, t.room, t.snooze, t.every, t.wd, t.pin, (t.subs || []).length]), hm.hours, hm.people || [], hm.hoursBy || {}]);
    const slim = (i) => ({ who: i.who, auto: i.auto, key: i.key, type: i.type, id: i.id, title: i.title, room: i.room, minutes: i.minutes, must: i.must, overdue: i.overdue, due: i.due, startMin: i.startMin, endMin: i.endMin });
    function todaySnap() {
      const hm = HM(); const today = todayD(); const sig = sigOf(hm);
      if (!hm.snap || hm.snap.date !== today || hm.snap.sig !== sig) {
        const same = hm.snap && hm.snap.date === today;
        const doneKeys = same ? (hm.log[today] || []) : [];
        const keep = same ? hm.snap.items.filter((i) => doneKeys.includes(i.key)) : [];
        // коли щось уже зроблено, вільний час не добираємо справами з наступних днів, щоб на місце зробленої не зʼявлялась нова
        const plan = P.planWeek(keep.length ? { ...hm, fill: false } : hm, today).days[0];
        const fresh = plan.items.filter((i) => !keep.some((k) => k.key === i.key)).map(slim);
        const items = keep.concat(fresh);
        hm.snap = { date: today, sig, items, cap: plan.cap, caps: plan.caps || null };
        for (const d of Object.keys(hm.log)) if (d < P.addDays(today, -20)) delete hm.log[d];
        save();
      }
      return hm.snap;
    }
    function tick(item, on) {
      const hm = HM(); const today = todayD();
      const log = hm.log[today] || (hm.log[today] = []);
      if (item.type === 'chore') {
        const c = hm.chores.find((x) => x.id === item.id);
        if (c) { if (on) { c.prevLast = c.last || null; c.last = today; } else { c.last = c.prevLast || null; } }
      } else {
        const t = hm.tasks.find((x) => x.id === item.id);
        if (t && Number(t.every) > 0) { if (on) { t.prevLast = t.last || null; t.last = today; (t.subs || []).forEach((x) => { x.done = false; }); } else t.last = t.prevLast || null; } else if (t) t.done = on;
      }
      const i = log.indexOf(item.key);
      if (on && i < 0) log.push(item.key); if (!on && i >= 0) log.splice(i, 1);
      save(); render(); setTimeout(() => { pushSync(false); }, 300);
    }
    function postpone(item) {
      const hm = HM(); const tomorrow = P.addDays(todayD(), 1);
      const x = item.type === 'chore' ? hm.chores.find((c) => c.id === item.id) : hm.tasks.find((t) => t.id === item.id);
      if (x) x.snooze = tomorrow;
      save(); render(); X.toast('Перенесено на завтра: ' + item.title);
    }

    // ----- Сьогодні -----
    const subsOf = (i) => { const t = i.type === 'task' ? HM().tasks.find((x) => x.id === i.id) : null; return t && t.subs && t.subs.length ? t.subs : null; };
    function setPin(item, date) {
      if (/#/.test(item.key)) { X.toast('Цей повтор переносити не можна. Перенеси найближчий.'); return; }
      const hm = HM();
      const x = item.type === 'chore' ? hm.chores.find((c) => c.id === item.id) : hm.tasks.find((t) => t.id === item.id);
      if (!x) return;
      x.pin = date; delete x.snooze; save(); render();
      X.toast('Перенесено: ' + item.title + ' → ' + (date === todayD() ? 'сьогодні' : dayName(date)));
    }
    function movePicker(item) {
      let closeFn = null; const today = todayD();
      closeFn = X.openModal('Перенести: ' + item.title, h('div', { class: 'sheet' },
        Array.from({ length: 7 }, (_, i) => P.addDays(today, i)).map((d, i) => h('button', { class: 'sheet-item', type: 'button', onclick: () => { closeFn(); setPin(item, d); } }, (i === 0 ? 'Сьогодні · ' : i === 1 ? 'Завтра · ' : '') + dayName(d)))));
    }
    function itemRow(i, dn, opts) {
      const rn = i.room ? roomName(i.room) : ''; const subs = subsOf(i);
      return h('label', { class: 'shop-row h-row' + (dn ? ' done' : '') },
        h('input', { type: 'checkbox', checked: dn ? true : null, disabled: opts && opts.readonly ? true : null, onchange: (e) => tick(i, e.target.checked) }),
        h('span', { class: 'shop-n' }, i.title,
          h('span', { class: 'mute' }, [subs && ' · ' + subs.filter((s) => s.done).length + '/' + subs.length, rn && ' · ' + rn, i.who && ' · ' + i.who, i.must && ' · обовʼязково', i.overdue && ' · прострочено'].filter(Boolean).join(''))),
        h('span', { class: 'tag h-time' }, P.fmtHM(i.startMin) + '–' + P.fmtHM(i.endMin)),
        h('span', { class: 'mute shop-p' }, mins(i.minutes)),
        opts && opts.readonly ? null : h('button', { class: 'link shop-x', type: 'button', title: 'Перенести', 'aria-label': 'Перенести: ' + i.title,
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); movePicker(i); } }, 'перенести'));
    }
    const isDoneNow = (i) => {
      const hm = HM(); const today = todayD();
      if ((hm.log[today] || []).includes(i.key)) return true;
      if (i.type === 'chore') return (hm.chores.find((c) => c.id === i.id) || {}).last === today;
      const t = hm.tasks.find((x) => x.id === i.id); return !!t && (t.done || (Number(t.every) > 0 && t.last === today));
    };
    const isMustItem = (i) => !!(i.must || i.overdue || i.prio === 'high');
    // серія: дні поспіль, коли зроблено всі обовʼязкові справи
    function streakInfo(hm, today) {
      const ok = (e) => e && e.md === e.mp && (e.d > 0 || e.p === 0);
      const hist = hm.hist || {}; let d = ok(hist[today]) && hist[today].p > 0 ? today : P.addDays(today, -1); let n = 0;
      for (let k = 0; k < 400; k++) {
        const e = hist[d];
        if (!e) break;
        if (!ok(e)) break;
        if (e.p > 0) n++;
        d = P.addDays(d, -1);
      }
      return n;
    }
    function freeTimeCard(snap, plan) {
      const hm = HM(); const out = h('div', { style: 'margin-top:12px' });
      const inp = h('input', { type: 'number', min: 1, max: 240, value: 15, 'aria-label': 'Скільки хвилин вільно', style: 'width:90px' });
      const go = () => {
        const n = Math.max(1, Number(inp.value) || 15);
        const pool = snap.items.filter((i) => !isDoneNow(i)).map((i) => ({ ...i, when: todayD() }));
        for (let k = 1; k < 4; k++) if (plan.days[k]) for (const i of plan.days[k].items) pool.push({ ...i, when: plan.days[k].date });
        const fit = pool.filter((i) => i.minutes <= n).sort((a, b) => (isMustItem(b) - isMustItem(a)) || (a.when < b.when ? -1 : a.when > b.when ? 1 : 0) || b.minutes - a.minutes).slice(0, 3);
        out.replaceChildren(...(fit.length ? fit.map((i) => h('div', { class: 'chore-row' },
          h('div', { class: 'chore-main' }, h('div', {}, i.title), h('div', { class: 'mute' }, mins(i.minutes) + ' · ' + (i.when === todayD() ? 'у плані на сьогодні' : 'планувалось ' + dayName(i.when)))),
          h('button', { class: 'ghost', type: 'button', onclick: () => { if (i.when === todayD()) tick(i, true); else setPin(i, todayD()); } }, i.when === todayD() ? 'Зроблено' : 'Взяти на сьогодні')))
          : [h('p', { class: 'mute', style: 'margin:6px 0' }, 'Нічого не вміщається в ' + n + ' хв. Спробуй більше часу.')]));
      };
      return h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Є вільний час?'),
        h('div', { class: 'toolbar', style: 'margin-top:8px;align-items:center' }, inp, h('span', { class: 'mute' }, 'хв'), h('button', { class: 'ghost', type: 'button', onclick: go }, 'Підібрати справу')), out);
    }
    // «Можу ще»: коли все зроблено, беремо на сьогодні справи з найближчих днів
    function moreCard(plan, snap) {
      const out = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
      const pool = []; const seen = new Set(snap.items.map((i) => i.key));
      for (let k = 1; k < 5; k++) if (plan.days[k]) for (const i of plan.days[k].items) if (!seen.has(i.key) && !/#/.test(i.key) && inView(i)) { seen.add(i.key); pool.push({ ...i, when: plan.days[k].date }); }
      pool.sort((a, b) => (isMustItem(b) - isMustItem(a)) || (a.when < b.when ? -1 : a.when > b.when ? 1 : 0));
      const take = (n) => {
        let sum = 0; const got = [];
        for (const i of pool) { if (got.length && sum + i.minutes > n) continue; got.push(i); sum += i.minutes; if (sum >= n) break; }
        if (!got.length) { out.textContent = 'Більше нічого не заплановано на найближчі дні. Додай справу в «Задачі» або «Прибирання».'; return; }
        const hm = HM();
        for (const i of got) { const x = i.type === 'chore' ? hm.chores.find((c) => c.id === i.id) : hm.tasks.find((t) => t.id === i.id); if (x) { x.pin = todayD(); delete x.snooze; } }
        save(); render(); X.toast('Додано на сьогодні: ' + got.map((g) => g.title).join(', '));
      };
      return h('div', { class: 'card', style: 'margin-top:16px' }, h('div', { class: 'tag' }, 'Можу ще'),
        h('p', { class: 'mute', style: 'margin:6px 0 10px' }, pool.length ? 'Усе на сьогодні зроблено. Є сили на більше? Візьму справи з найближчих днів.' : 'Усе на сьогодні зроблено, а в найближчі дні нічого не заплановано. Гарного відпочинку.'),
        pool.length ? h('div', { class: 'toolbar' }, [15, 30, 60].map((n) => h('button', { class: 'ghost', type: 'button', onclick: () => take(n) }, n === 60 ? 'Ще годину' : 'Ще ' + n + ' хв'))) : null, out);
    }
    function viewToday() {
      const hm = HM(); const today = todayD(); const snap = todaySnap();
      const plan = P.planWeek(hm, today);
      const names = whoNames().filter((n) => snap.items.some((i) => i.who === n));
      if (whoFilter && !names.includes(whoFilter)) whoFilter = '';
      const vis = multi() ? snap.items.filter(inView) : snap.items.filter((i) => !whoFilter || i.who === whoFilter || !i.who);
      const open0 = vis.filter((i) => !isDoneNow(i)); const dn = vis.filter((i) => isDoneNow(i));
      // режим «мало сил»: лишаємо обовʼязкове й найкоротше, до півгодини
      const low = hm.low === today; let open = open0;
      if (low) {
        const must = open0.filter(isMustItem); let sum = must.reduce((s, i) => s + i.minutes, 0);
        const extra = open0.filter((i) => !isMustItem(i)).sort((a, b) => a.minutes - b.minutes).filter((i) => { if (sum + i.minutes <= 30) { sum += i.minutes; return true; } return false; });
        const keep = new Set(must.concat(extra).map((i) => i.key)); open = open0.filter((i) => keep.has(i.key));
      }
      const hidden = open0.length - open.length;
      const total = snap.items.reduce((s, i) => s + i.minutes, 0); const doneMin = dn.reduce((s, i) => s + i.minutes, 0);
      const pct = total ? Math.round((doneMin / total) * 100) : 0;
      const empty = !hm.rooms.length && !hm.chores.length && !hm.tasks.length;
      // історія для серії
      const must = snap.items.filter(isMustItem);
      const entry = { p: snap.items.length, d: dn.length, mp: must.length, md: must.filter(isDoneNow).length };
      if (multi()) { const w = {}; snap.items.forEach((i) => { const k = i.who || '—'; const e2 = w[k] || (w[k] = [0, 0]); e2[0]++; if (isDoneNow(i)) e2[1]++; }); entry.w = w; }
      if (!hm.hist) hm.hist = {};
      const prev = hm.hist[today];
      if (!prev || prev.p !== entry.p || prev.d !== entry.d || prev.mp !== entry.mp || prev.md !== entry.md || JSON.stringify(prev.w || null) !== JSON.stringify(entry.w || null)) {
        hm.hist[today] = entry; for (const d of Object.keys(hm.hist)) if (d < P.addDays(today, -90)) delete hm.hist[d]; save();
      }
      const streak = streakInfo(hm, today);
      return [...header('Дім · ' + dayName(today, true), 'Справи на', 'сьогодні'), meAsk(),
        priCard(),
        statsRow([['Залишилось справ', open0.length], ['Зроблено', dn.length], ['Серія днів поспіль', streak]]),
        snap.items.length
          ? h('div', { class: 'card' },
            h('div', { class: 'h-prog', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: 'width:' + pct + '%' })),
            h('p', { class: 'mute', style: 'margin:8px 0 14px' }, snap.items.length === dn.length ? 'Усе зроблено. Можна відпочивати.' : (low ? 'Режим «мало сил»: лишилось найважливіше. ' : '') + 'План на сьогодні: ' + mins(total) + (capView(snap.caps, snap.cap) ? ', у графіку ' + mins(capView(snap.caps, snap.cap)) : '') + '.'),
            h('div', {}, open.map((i) => itemRow(i, false)), dn.map((i) => itemRow(i, true))),
            hidden ? h('p', { class: 'note', style: 'margin:10px 0 0' }, 'Сховано ' + hidden + ' (залишаться в розкладі). Вимкни режим, щоб побачити все.') : null)
          : h('p', { class: 'empty' }, empty ? 'Поки порожньо. Додай кімнати й справи у розділі «Прибирання» та задачі у «Задачі». Розклад складеться сам.' : 'На сьогодні нічого не заплановано. Гарного відпочинку.'),
        multi() ? whoBar() : null,
        !multi() && names.length > 1 ? h('div', { class: 'toolbar', style: 'margin-top:12px' }, h('span', { class: 'mute' }, 'Чиї справи:'), ['', ...names].map((n) => h('button', { class: n === whoFilter ? 'primary' : 'ghost', type: 'button', onclick: () => { whoFilter = n; render(); } }, n || 'Усі'))) : null,
        h('div', { class: 'toolbar', style: 'margin-top:16px' },
          h('button', { class: low ? 'primary' : 'ghost', type: 'button', onclick: () => { hm.low = low ? null : today; save(); render(); } }, low ? 'Показати все' : 'Мало сил'),
          h('button', { class: 'ghost', type: 'button', onclick: () => { hm.snap = null; save(); render(); X.toast('Розклад на сьогодні перераховано'); } }, 'Перепланувати')),
        snap.items.length && open0.length === 0 ? moreCard(plan, snap) : null,
        freeTimeCard(snap, plan),
        h('p', { class: 'note' }, 'Кнопка «перенести» ставить справу на інший день. Обовʼязкові справи не відкладаються автоматично. Серія рахується за днями, коли ти відкривала застосунок і закрила все обовʼязкове.')];
    }

    // ----- Розклад на тиждень (справи можна перетягувати між днями) -----
    // «Не вмістилось у графік»: коротко, з групуванням однакових справ
    function unplacedCard(list) {
      if (!list.length) return null;
      const groups = new Map();
      for (const u of list) { const g = groups.get(u.title) || { title: u.title, n: 0, min: 0, must: false }; g.n++; g.min += Number(u.minutes) || 0; g.must = g.must || !!(u.must || u.overdue); groups.set(u.title, g); }
      const rows = [...groups.values()].sort((a, b) => (b.must - a.must) || b.min - a.min);
      const total = rows.reduce((s, g) => s + g.min, 0);
      return h('details', { class: 'card unplaced', style: 'margin-top:16px' },
        h('summary', {}, 'Не вмістилось у графік: ' + cases(list.length, ['справа', 'справи', 'справ']) + (total ? ' · ' + mins(total) : '')),
        h('p', { class: 'mute', style: 'margin:8px 0' }, 'Ці справи чекають, поки зʼявиться вільний час. Збільш вікна в «Мій час» або зніми частину справ.'),
        h('ul', { class: 'h-list' }, rows.map((g) => h('li', {}, h('span', { class: 'h-n' }, g.title, g.must ? h('span', { class: 'gold-t' }, ' ★') : null), h('span', { class: 'mute' }, (g.n > 1 ? '×' + g.n + ' · ' : '') + mins(g.min))))),
        h('button', { class: 'link', type: 'button', onclick: () => { const b = [...document.querySelectorAll('nav button')].find((x) => /Мій час/.test(x.textContent)); if (b) b.click(); } }, 'Відкрити «Мій час»'));
    }
    function viewWeek() {
      const hm = HM(); const today = todayD(); const snap = todaySnap();
      const plan = P.planWeek(hm, today);
      const days = plan.days.map((d, i) => {
        const dd = i === 0 ? { ...d, items: snap.items, caps: snap.caps || d.caps } : d;
        const items = dd.items.filter(inView);
        return { ...dd, items, load: items.reduce((s, x) => s + x.minutes, 0), cap: capView(dd.caps, dd.cap) };
      });
      let drag = null;
      return [...header('Дім · 7 днів', 'Розклад на', 'тиждень'), meAsk(), whoBar(),
        h('div', { class: 'cards' }, days.map((d, i) => {
          const card = h('div', { class: 'card h-day' + (i === 0 ? ' gold' : ''),
            ondragover: (e) => { if (drag) { e.preventDefault(); card.classList.add('over'); } },
            ondragleave: () => card.classList.remove('over'),
            ondrop: (e) => { e.preventDefault(); card.classList.remove('over'); if (drag && drag.date !== d.date) { const it = drag.item; drag = null; setPin(it, d.date); } } },
            h('div', { class: 'tag' }, i === 0 ? 'Сьогодні' : dayName(d.date)),
            h('div', { class: 'mute' }, d.items.length ? cases(d.items.length, ['справа', 'справи', 'справ']) + ' · ' + mins(d.load) + (d.cap ? ' з ' + mins(d.cap) : ' · вихідний за графіком') : (d.cap ? 'Вільний день' : 'Вихідний за графіком')),
            d.items.length ? h('ul', { class: 'h-list' }, d.items.map((x) => {
              const dn = i === 0 && isDoneNow(x);
              return h('li', { class: dn ? 'done' : '', draggable: dn ? null : 'true',
                ondragstart: (e) => { drag = { item: x, date: d.date }; if (e.dataTransfer) { e.dataTransfer.setData('text/plain', x.key); e.dataTransfer.effectAllowed = 'move'; } },
                ondragend: () => { drag = null; } },
                h('span', { class: 'h-t' }, P.fmtHM(x.startMin)), h('span', { class: 'h-n' }, x.title, x.room ? h('span', { class: 'mute' }, ' · ' + roomName(x.room)) : null, x.must ? h('span', { class: 'gold-t' }, ' ★') : null, multi() && x.who ? h('span', { class: 'mute' }, ' · ' + x.who) : null),
                dn ? null : h('button', { class: 'link h-mv', type: 'button', title: 'Перенести', 'aria-label': 'Перенести: ' + x.title, onclick: () => movePicker(x) }, '⇄'));
            })) : null);
          return card;
        })),
        h('div', { class: 'toolbar', style: 'margin-top:16px' }, h('button', { class: 'ghost', type: 'button', onclick: () => { saveFile('rozklad-dim.ics', window.DuckyICS(days, roomName), 'text/calendar'); X.toast('Відкрий файл на айфоні й обери «Додати в Календар»'); } }, 'Додати розклад у Календар')),
        plan.waiting && plan.waiting.length ? h('p', { class: 'note' }, 'Чекають на попередню справу: ' + plan.waiting.map((w) => w.title + ' (після «' + afterLabel(w.after) + '»)').join('; ') + '.') : null,
        unplacedCard(plan.unplaced),
        h('p', { class: 'note' }, '★ означає обовʼязкову справу. Перетягни справу на інший день або натисни ⇄. Розклад перераховується сам, коли ти відмічаєш зроблене або змінюєш справи.')];
    }

    // ----- Прибирання -----
    function choreModal(chore, roomId) {
      const hm = HM(); let closeFn = null;
      const c = chore || { id: uid(), room: roomId || (hm.rooms[0] && hm.rooms[0].id), title: '', every: 7, minutes: 15, must: false, wd: null, last: null };
      const title = h('input', { value: c.title, placeholder: 'Наприклад: Помити підлогу', 'aria-label': 'Назва' });
      const room = h('select', { 'aria-label': 'Кімната' }, hm.rooms.map((r) => h('option', { value: r.id, selected: r.id === c.room ? true : null }, r.name)));
      const known = EVERY.some((e) => e[0] === Number(c.every));
      const every = h('select', { 'aria-label': 'Як часто' }, EVERY.map(([n, l]) => h('option', { value: n, selected: Number(c.every) === n ? true : null }, l)), h('option', { value: 0, selected: !known ? true : null }, 'Свій інтервал…'));
      const custom = h('input', { type: 'number', min: 1, max: 365, value: known ? '' : c.every, placeholder: 'Раз на скільки днів', 'aria-label': 'Свій інтервал, днів' });
      const minutes = h('input', { type: 'number', min: 1, max: 600, value: c.minutes, 'aria-label': 'Скільки хвилин' });
      const wd = h('select', { 'aria-label': 'День тижня' }, h('option', { value: '' }, 'Будь-який день'), WD.map((n, i) => h('option', { value: i, selected: c.wd != null && c.wd !== '' && Number(c.wd) === i ? true : null }, n)));
      const must = h('input', { type: 'checkbox', checked: c.must ? true : null });
      const who = h('input', { value: c.who || '', list: 'dl-who', placeholder: 'Хто робить (порожньо: розподілиться сам)', 'aria-label': 'Хто робить', autocomplete: 'off' });
      const after = h('select', { 'aria-label': 'Тільки після' }, afterOptions('c:' + c.id, c.after));
      const last = h('input', { type: 'date', value: c.last || '', 'aria-label': 'Востаннє робила' });
      const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
      let armed = false;
      const body = h('div', { style: 'display:grid;gap:12px' },
        h('label', {}, 'Що зробити', title), h('label', {}, 'Кімната', room),
        h('label', {}, 'Як часто', every), h('label', {}, 'Свій інтервал, днів (якщо обрано вище)', custom),
        h('label', {}, 'Скільки часу займає, хв', minutes),
        h('label', {}, 'Тільки в певний день тижня', wd),
        h('label', { style: 'display:flex;gap:10px;align-items:center;flex-direction:row;text-transform:none;letter-spacing:0;font-size:15px' }, must, 'Обовʼязково (не відкладати, ставити в розклад завжди)'),
        h('label', {}, 'Востаннє робила (необовʼязково)', last), h('label', {}, 'Хто робить', who), whoList(),
        h('label', {}, 'Робити тільки після (наприклад, підлогу після пилососу)', after),
        h('div', { class: 'toolbar' },
          h('button', { class: 'primary', type: 'button', onclick: () => {
            const t = title.value.trim(); if (!t) { msg.textContent = 'Напиши, що саме робити.'; return; }
            if (!room.value) { msg.textContent = 'Спершу додай кімнату.'; return; }
            const ev = Number(every.value) || Number(custom.value) || 7;
            Object.assign(c, { title: t, room: room.value, every: Math.max(1, Math.round(ev)), minutes: Math.max(1, Math.round(Number(minutes.value) || 15)), wd: wd.value === '' ? null : Number(wd.value), must: must.checked, last: last.value || null, who: who.value.trim(), after: after.value || null });
            if (!chore) hm.chores.push(c);
            save(); closeFn(); render();
          } }, 'Зберегти'),
          chore ? h('button', { class: 'link', type: 'button', onclick: (e) => {
            if (!armed) { armed = true; e.target.textContent = 'Натисни ще раз, щоб видалити'; return; }
            hm.chores = hm.chores.filter((x) => x.id !== c.id); save(); closeFn(); render();
          } }, 'Видалити') : null), msg);
      closeFn = X.openModal(chore ? 'Змінити справу' : 'Нова справа', body);
    }
    function roomModal(room) {
      const hm = HM(); let closeFn = null; let armed = false;
      const name = h('input', { value: room.name, 'aria-label': 'Назва кімнати' });
      closeFn = X.openModal('Кімната', h('div', { style: 'display:grid;gap:12px' }, h('label', {}, 'Назва', name),
        h('div', { class: 'toolbar' },
          h('button', { class: 'primary', type: 'button', onclick: () => { if (name.value.trim()) { room.name = name.value.trim(); save(); closeFn(); render(); } } }, 'Зберегти'),
          h('button', { class: 'link', type: 'button', onclick: (e) => {
            if (!armed) { armed = true; e.target.textContent = 'Видалити разом зі справами? Натисни ще раз'; return; }
            hm.rooms = hm.rooms.filter((r) => r.id !== room.id); hm.chores = hm.chores.filter((c) => c.room !== room.id);
            hm.tasks.forEach((t) => { if (t.room === room.id) t.room = null; }); save(); closeFn(); render();
          } }, 'Видалити кімнату'))));
    }
    function viewClean() {
      const hm = HM(); const today = todayD();
      const nameIn = h('input', { placeholder: 'Нова кімната: Кухня, Ванна…', 'aria-label': 'Нова кімната', list: 'dl-rooms' });
      const addRoom = () => { const v = nameIn.value.trim(); if (!v) return; if (!hm.rooms.some((r) => norm(r.name) === norm(v))) hm.rooms.push({ id: uid(), name: v }); save(); render(); };
      nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRoom(); } });
      const preset = () => { for (const n of ['Кухня', 'Ванна', 'Спальня', 'Вітальня', 'Передпокій']) if (!hm.rooms.some((r) => norm(r.name) === norm(n))) hm.rooms.push({ id: uid(), name: n }); save(); render(); };
      const cards = hm.rooms.map((r) => {
        const list = hm.chores.filter((c) => c.room === r.id);
        return h('div', { class: 'card' },
          h('div', { class: 'tag' }, 'Кімната'), h('h3', {}, r.name),
          list.length ? list.map((c) => {
            const nxt = c.last ? P.addDays(c.last, c.every) : null;
            const late = nxt && nxt < today;
            return h('div', { class: 'chore-row' },
              h('div', { class: 'chore-main' }, h('div', {}, c.title, c.must ? h('span', { class: 'gold-t' }, ' ★') : null),
                h('div', { class: 'mute' }, [everyLabel(c.every), mins(c.minutes), c.wd != null && c.wd !== '' ? 'у ' + WD[c.wd].toLowerCase() : null, c.after && afterLabel(c.after) ? 'після: ' + afterLabel(c.after) : null,
                  late ? 'прострочено' : null].filter(Boolean).join(' · '), ' ', agePill(c.last, c.every))),
              h('button', { class: 'ghost', type: 'button', onclick: () => { c.prevLast = c.last || null; c.last = today; save(); render(); X.toast('Відмічено: ' + c.title); } }, 'Зроблено'),
              h('button', { class: 'link', type: 'button', onclick: () => choreModal(c) }, 'Змінити'));
          }) : h('p', { class: 'mute', style: 'margin:4px 0' }, 'Ще немає справ.'),
          h('div', { class: 'toolbar', style: 'margin-top:10px' },
            h('button', { class: 'ghost', type: 'button', onclick: () => choreModal(null, r.id) }, 'Додати справу'),
            h('button', { class: 'link', type: 'button', onclick: () => roomModal(r) }, 'Кімната')));
      });
      return [...header('Дім · кімнати', 'Прибирання', 'по кімнатах'),
        h('div', { class: 'card', style: 'margin-bottom:28px' }, h('div', { class: 'tag' }, 'Додати кімнату'),
          h('datalist', { id: 'dl-rooms' }, ['Кухня', 'Ванна', 'Туалет', 'Спальня', 'Вітальня', 'Дитяча', 'Передпокій', 'Балкон', 'Кабінет'].map((n) => h('option', { value: n }))),
          h('div', { class: 'toolbar', style: 'margin-top:10px' }, nameIn, h('button', { class: 'primary', type: 'button', onclick: addRoom }, 'Додати'),
            hm.rooms.length ? null : h('button', { class: 'ghost', type: 'button', onclick: preset }, 'Додати типові кімнати'))),
        shareHint(), scope !== 'me' ? shareFromMine() : null,
        hm.rooms.length ? h('div', { class: 'cards' }, cards) : h('p', { class: 'empty' }, 'Додай кімнати, а в кожній справи: що, як часто, скільки часу. Познач «обовʼязково» те, що не можна пропускати.'),
        h('p', { class: 'note' }, 'Розклад сам розкладе справи по днях: обовʼязкові у свій день, прибирання однієї кімнати разом, спершу пил, потім пилосос і підлога.')];
    }

    // ----- лічильник «скільки днів тому робила» -----
    function agePill(last, every) {
      if (!last) return h('span', { class: 'age age-n' }, 'ще не робила');
      const ago = P.diff(todayD(), last); const r = ago / Math.max(1, Number(every) || 7);
      const cls = r <= 1 ? 'age-g' : r <= 1.5 ? 'age-y' : 'age-r';
      return h('span', { class: 'age ' + cls }, ago <= 0 ? 'сьогодні' : ago + ' дн. тому');
    }
    const subList = (t) => (t.subs && t.subs.length ? h('div', { class: 'h-subs' }, t.subs.map((s) => h('label', { class: 'h-sub' + (s.done ? ' done' : '') },
      h('input', { type: 'checkbox', checked: s.done ? true : null, onchange: (e) => { s.done = e.target.checked; save(); render(); } }), s.t))) : null);
    // ----- швидке додавання задачі текстом: «полити квіти щосереди 10 хв», «оплатити інтернет до 15.10 важливо» -----
    function parseQuick(raw) {
      let t = ' ' + String(raw || '').trim() + ' '; const o = { every: null, wd: null, due: null, minutes: null, prio: 'norm', bits: [] };
      const L = '(?<![а-яіїєґ])'; const R = '(?![а-яіїєґ])';
      const WDS = ['понеділ', 'вівтор', 'серед', 'четвер', 'п.?ятниц', 'субот', 'неділ'];
      const wdIdx = (s) => WDS.findIndex((w) => new RegExp('^' + w, 'i').test(s));
      const cut = (re, fn) => { const m = re.exec(t); if (!m) return false; fn(m); t = t.replace(m[0], ' '); return true; };
      const WDRX = '(понеділ|вівтор|серед|четвер|п.?ятниц|субот|неділ)[а-яіїєґ]*';
      cut(new RegExp(L + 'що' + WDRX, 'i'), (m) => { o.every = 7; o.wd = wdIdx(m[1]); o.bits.push('щотижня'); });
      cut(new RegExp(L + 'кожн[а-яіїєґ]*\\s+' + WDRX, 'i'), (m) => { o.every = 7; o.wd = wdIdx(m[1]); o.bits.push('щотижня'); });
      cut(new RegExp(L + 'що(дня|денно)' + R, 'i'), () => { o.every = 1; o.bits.push('щодня'); });
      cut(new RegExp(L + '(щотижня|щотиждня|раз\\s+на\\s+тиждень|кожен\\s+тиждень)' + R, 'i'), () => { o.every = 7; o.bits.push('щотижня'); });
      cut(new RegExp(L + '(щомісяця|раз\\s+на\\s+місяць|кожен\\s+місяць)' + R, 'i'), () => { o.every = 30; o.bits.push('щомісяця'); });
      cut(new RegExp(L + '(?:кожні|раз\\s+на)\\s+(\\d+)\\s*(дн[а-яіїєґ]*|тиж[а-яіїєґ]*|міс[а-яіїєґ]*)', 'i'), (m) => { const n = Number(m[1]); o.every = /^тиж/i.test(m[2]) ? n * 7 : /^міс/i.test(m[2]) ? n * 30 : n; o.bits.push('раз на ' + m[1] + ' ' + m[2]); });
      cut(new RegExp(L + '(\\d+(?:[.,]\\d+)?)\\s*(год[а-яіїєґ]*)', 'i'), (m) => { o.minutes = Math.round(parseFloat(m[1].replace(',', '.')) * 60); });
      cut(new RegExp(L + '(\\d+)\\s*(хв[а-яіїєґ]*)', 'i'), (m) => { o.minutes = Number(m[1]); });
      cut(new RegExp(L + '(важливо|терміново)' + R + '|!+', 'i'), () => { o.prio = 'high'; });
      const today = todayD();
      if (!o.every) {
        if (cut(new RegExp(L + 'післязавтра' + R, 'i'), () => { o.due = P.addDays(today, 2); }) || cut(new RegExp(L + 'завтра' + R, 'i'), () => { o.due = P.addDays(today, 1); }) || cut(new RegExp(L + 'сьогодні' + R, 'i'), () => { o.due = today; })) { /* готово */ }
        else if (cut(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/, (m) => { let y = m[3] ? Number(m[3]) : new Date().getFullYear(); if (y < 100) y += 2000; const d = y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); o.due = d < today && !m[3] ? (y + 1) + d.slice(4) : d; })) { /* готово */ }
        else cut(new RegExp(L + '(?:у|в|на|до)\\s+' + WDRX, 'i'), (m) => { const w = wdIdx(m[1]); o.due = P.addDays(today, ((w - P.wdOf(today) + 7) % 7) || 7); });
      }
      const title = t.replace(/(?<![а-яіїєґ])(до|у|в|на)\s*$/i, ' ').replace(/\s+/g, ' ').replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, '').trim();
      o.title = title ? title[0].toUpperCase() + title.slice(1) : String(raw || '').trim();
      return o;
    }
    window.DuckyQuick = parseQuick;

    // ----- Задачі -----
    function taskModal(task) {
      const hm = HM(); let closeFn = null; let armed = false;
      const t = task || { id: uid(), title: '', due: '', minutes: 30, prio: 'norm', room: '', done: false, every: null, wd: null, last: null };
      const evKnown = !t.every || EVERY.some((e) => e[0] === Number(t.every));
      const every = h('select', { 'aria-label': 'Повторювати' }, h('option', { value: '' }, 'Не повторювати'), EVERY.map(([n, l]) => h('option', { value: n, selected: Number(t.every) === n ? true : null }, l)), h('option', { value: 0, selected: !evKnown ? true : null }, 'Свій інтервал…'));
      const custom = h('input', { type: 'number', min: 1, max: 365, value: evKnown ? '' : t.every, placeholder: 'Раз на скільки днів', 'aria-label': 'Свій інтервал, днів' });
      const wd = h('select', { 'aria-label': 'День тижня' }, h('option', { value: '' }, 'Будь-який день'), WD.map((n, i) => h('option', { value: i, selected: t.wd != null && t.wd !== '' && Number(t.wd) === i ? true : null }, n)));
      const last = h('input', { type: 'date', value: t.last || '', 'aria-label': 'Востаннє робила' });
      const who = h('input', { value: t.who || '', list: 'dl-who', placeholder: 'Хто робить (порожньо: розподілиться сам)', 'aria-label': 'Хто робить', autocomplete: 'off' });
      const after = h('select', { 'aria-label': 'Тільки після' }, afterOptions('t:' + t.id, t.after));
      const subsIn = h('textarea', { rows: 3, 'aria-label': 'Підзадачі', placeholder: 'Підзадачі, кожна з нового рядка' }, (t.subs || []).map((x) => x.t).join('\n'));
      const title = h('input', { value: t.title, placeholder: 'Наприклад: Записатися до лікаря', 'aria-label': 'Задача' });
      const due = h('input', { type: 'date', value: t.due || '', 'aria-label': 'Зробити до' });
      const minutes = h('input', { type: 'number', min: 1, max: 600, value: t.minutes, 'aria-label': 'Хвилин' });
      const prio = h('select', { 'aria-label': 'Важливість' }, PRIO.map(([k, l]) => h('option', { value: k, selected: t.prio === k ? true : null }, l)));
      const room = h('select', { 'aria-label': 'Кімната' }, h('option', { value: '' }, 'Без кімнати'), hm.rooms.map((r) => h('option', { value: r.id, selected: t.room === r.id ? true : null }, r.name)));
      const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
      closeFn = X.openModal(task ? 'Змінити задачу' : 'Нова задача', h('div', { style: 'display:grid;gap:12px' },
        h('label', {}, 'Що зробити', title), h('label', {}, 'Зробити до (необовʼязково)', due), h('label', {}, 'Скільки часу, хв', minutes),
        h('label', {}, 'Важливість', prio), h('label', {}, 'Кімната (необовʼязково)', room),
        h('label', {}, 'Повторювати (для того, що робиш регулярно)', every), h('label', {}, 'Свій інтервал, днів (якщо обрано вище)', custom),
        h('label', {}, 'Тільки в певний день тижня', wd), h('label', {}, 'Востаннє робила (необовʼязково)', last),
        h('label', {}, 'Підзадачі (чек-лист, кожна з нового рядка)', subsIn), h('label', {}, 'Хто робить', who), whoList(),
        h('label', {}, 'Робити тільки після (необовʼязково)', after),
        h('div', { class: 'toolbar' },
          h('button', { class: 'primary', type: 'button', onclick: () => {
            if (!title.value.trim()) { msg.textContent = 'Напиши, що зробити.'; return; }
            const ev = every.value === '' ? null : (Number(every.value) || Number(custom.value) || 7);
            Object.assign(t, { title: title.value.trim(), due: ev ? null : (due.value || null), minutes: Math.max(1, Math.round(Number(minutes.value) || 30)), prio: prio.value, room: room.value || null, who: who.value.trim(), after: after.value || null,
              every: ev ? Math.max(1, Math.round(ev)) : null, wd: ev && wd.value !== '' ? Number(wd.value) : null, last: ev ? (last.value || null) : (t.last || null), done: ev ? false : t.done });
            const old = t.subs || []; t.subs = subsIn.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => ({ t: x, done: !!(old.find((o) => o.t === x) || {}).done }));
            if (!task) hm.tasks.push(t); save(); closeFn(); render();
          } }, 'Зберегти'),
          task ? h('button', { class: 'link', type: 'button', onclick: (e) => {
            if (!armed) { armed = true; e.target.textContent = 'Натисни ще раз, щоб видалити'; return; }
            hm.tasks = hm.tasks.filter((x) => x.id !== t.id); save(); closeFn(); render();
          } }, 'Видалити') : null), msg));
    }
    // у сімейній коморі: узяти вибрані справи зі своєї особистої комори
    function shareFromMine() {
      if (typeof scope === 'undefined' || scope === 'me' || !user) return null;
      const mine = (loadState(user.id).home) || {};
      const roomOf = (id) => ((mine.rooms || []).find((r) => r.id === id) || {}).name || '';
      const hm = HM();
      const key = (kind, title, room) => kind + '|' + String(title || '').trim().toLowerCase() + '|' + String(room || '').trim().toLowerCase();
      const have = new Set([...hm.chores.map((c) => key('c', c.title, c.room ? roomName(c.room) : '')), ...hm.tasks.map((t) => key('t', t.title, t.room ? roomName(t.room) : ''))]);
      const cand = [...(mine.chores || []).map((x) => ['c', x]), ...(mine.tasks || []).filter((t) => !t.done).map((x) => ['t', x])]
        .filter(([k, x]) => x && x.title && !have.has(key(k, x.title, x.room ? roomOf(x.room) : '')));
      if (!cand.length) return h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Зі своєї комори'), h('p', { class: 'mute', style: 'margin:6px 0 0' }, 'У «Моїй коморі» немає справ, яких тут ще нема.'));
      const boxes = cand.map(([k, x]) => h('input', { type: 'checkbox' }));
      const go = () => {
        const picked = cand.filter((c, i) => boxes[i].checked); if (!picked.length) { X.toast('Познач, що скопіювати'); return; }
        const roomId = (id) => {
          const nm = roomOf(id); if (!nm) return null;
          let r = hm.rooms.find((x) => x.name.trim().toLowerCase() === nm.trim().toLowerCase());
          if (!r) { r = { id: uid(), name: nm }; hm.rooms.push(r); }
          return r.id;
        };
        for (const [k, x] of picked) {
          const c = { ...x, id: uid(), room: x.room ? roomId(x.room) : null, after: null }; delete c.mt; delete c.mh; delete c.pin; delete c.snooze;
          (k === 'c' ? hm.chores : hm.tasks).push(c);
        }
        save(); render(); X.toast('Скопійовано: ' + picked.length);
      };
      return h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Зі своєї комори'),
        h('p', { class: 'mute', style: 'margin:6px 0 10px' }, 'Познач справи зі «Своєї комори», які хочеш зробити спільними. Вони скопіюються сюди, а твої особисті лишаться.'),
        cand.map(([k, x], i) => h('label', { class: 'check', style: 'display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-size:15px;padding:6px 0' }, boxes[i],
          h('span', {}, x.title, h('span', { class: 'mute' }, ' · ' + (k === 'c' ? 'прибирання' : 'задача') + (x.room && roomOf(x.room) ? ' · ' + roomOf(x.room) : ''))))),
        h('div', { class: 'toolbar', style: 'margin-top:10px' }, h('button', { class: 'primary', type: 'button', onclick: go }, 'Скопіювати вибране')));
    }
    // в особистій коморі: підказка, як зробити справи спільними
    function shareHint() {
      if (typeof scope === 'undefined' || scope !== 'me' || !user || typeof memberships === 'undefined' || !memberships.length) return null;
      const m = memberships[0];
      return h('div', { class: 'card', style: 'margin-bottom:28px' }, h('div', { class: 'tag' }, 'Спільне з сімʼєю'),
        h('p', { class: 'mute', style: 'margin:6px 0 10px' }, 'Це твоя особиста комора, її бачиш тільки ти. Щоб справи побачив(ла) інший учасник, відкрий «Сімʼя: ' + m.name + '» і познач, що скопіювати зі своєї комори.'),
        h('div', { class: 'toolbar' }, h('button', { class: 'primary', type: 'button', onclick: () => switchScope(m.id) }, 'Відкрити спільний простір')));
    }
    function viewTasks() {
      const hm = HM(); const today = todayD();
      const quick = h('input', { placeholder: 'Напр.: полити квіти 10 хв', enterkeyhint: 'done', autocomplete: 'off', 'aria-label': 'Нова задача' });
      const addQuick = () => {
        const v = quick.value.trim(); if (!v) return; const q = parseQuick(v);
        hm.tasks.push({ id: uid(), title: q.title, due: q.due, minutes: q.minutes || 30, prio: q.prio, room: null, done: false, every: q.every, wd: q.wd, last: null });
        save(); render(); X.toast('Додано: ' + q.title + (q.every ? ' · ' + everyLabel(q.every) : q.due ? ' · до ' + dayName(q.due) : ''));
      };
      quick.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addQuick(); } });
      const po = { high: 0, norm: 1, low: 2 };
      const rep = hm.tasks.filter((t) => Number(t.every) > 0 && inView(t));
      const open = hm.tasks.filter((t) => !t.done && !(Number(t.every) > 0) && inView(t)).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : po[a.prio || 'norm'] - po[b.prio || 'norm']);
      const done = hm.tasks.filter((t) => t.done && !(Number(t.every) > 0) && inView(t));
      const repRow = (t) => {
        const nxt = t.last ? P.addDays(t.last, t.every) : null; const isDone = t.last === today; const late = nxt && nxt < today;
        return h('div', { class: 'chore-row' + (isDone ? ' done' : '') },
          h('div', { class: 'chore-main' }, h('div', {}, t.title, t.prio === 'high' ? h('span', { class: 'gold-t' }, ' ★') : null),
            h('div', { class: 'mute' }, [everyLabel(t.every), mins(t.minutes), t.wd != null && t.wd !== '' ? 'у ' + WD[t.wd].toLowerCase() : null, t.room ? roomName(t.room) : null,
              late ? 'прострочено' : null].filter(Boolean).join(' · '), ' ', agePill(t.last, t.every)), subList(t)),
          h('button', { class: 'ghost', type: 'button', onclick: () => { if (isDone) { t.last = t.prevLast || null; } else { t.prevLast = t.last || null; t.last = today; (t.subs || []).forEach((x) => { x.done = false; }); } save(); render(); } }, isDone ? 'Скасувати' : 'Зроблено'),
          h('button', { class: 'link', type: 'button', onclick: () => taskModal(t) }, 'Змінити'));
      };
      const row = (t) => h('label', { class: 'shop-row h-row' + (t.done ? ' done' : '') },
        h('input', { type: 'checkbox', checked: t.done ? true : null, onchange: (e) => { t.done = e.target.checked; save(); render(); } }),
        h('span', { class: 'shop-n' }, t.title, h('span', { class: 'mute' }, [t.room && ' · ' + roomName(t.room), t.prio === 'high' && ' · важливо'].filter(Boolean).join(''))),
        h('span', { class: 'tag' + (t.due && t.due < today && !t.done ? ' warn' : '') }, t.due ? 'до ' + dayName(t.due) : 'без дати'),
        h('span', { class: 'mute shop-p' }, mins(t.minutes)),
        h('button', { class: 'link shop-x', type: 'button', onclick: (e) => { e.preventDefault(); e.stopPropagation(); taskModal(t); } }, 'Змінити'));
      return [...header('Дім · звичайні справи', 'Мої', 'задачі'), whoBar(),
        h('div', { class: 'card', style: 'margin-bottom:28px' }, h('div', { class: 'toolbar' }, quick, h('button', { class: 'primary', type: 'button', onclick: addQuick }, 'Додати'),
          h('button', { class: 'ghost', type: 'button', onclick: () => taskModal(null) }, 'З деталями'))),
        shareHint(), scope !== 'me' ? shareFromMine() : null,
        rep.length ? h('div', { class: 'card', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Повторювані'), rep.map(repRow)) : null,
        open.length ? h('div', { class: 'card' }, h('div', { class: 'tag' }, 'Разові'), open.flatMap((t) => [row(t), subList(t)])) : rep.length ? null : h('p', { class: 'empty' }, 'Задач немає. Додай першу: дедлайн і тривалість необовʼязкові, розклад сам знайде час.'),
        done.length ? h('details', { class: 'card', style: 'margin-top:20px' }, h('summary', {}, 'Виконані (' + done.length + ')'), done.map(row),
          h('button', { class: 'link', type: 'button', onclick: () => { hm.tasks = hm.tasks.filter((t) => !t.done); save(); render(); } }, 'Очистити виконані')) : null,
        h('p', { class: 'note' }, 'Задачі з дедлайном потрапляють у розклад до цієї дати, а прострочені одразу на сьогодні. Повторювані з\u02bcявляються в розкладі самі, а коли забуваєш, піднімаються на сьогодні.')];
    }

    // ----- сповіщення на телефоні (Web Push, коли застосунок закритий) -----
    const PUSH_KEY = 'ducky.push';
    const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
    let pushVapid = null; let pushSig = '';
    const pushItems = () => {
      const hm = HM(); const today = todayD(); const now = Date.now(); const out = [];
      const at = (date, m) => { const [y, mo, d] = date.split('-').map(Number); return new Date(y, mo - 1, d, Math.floor(m / 60), m % 60).getTime(); };
      const mineOnly = scope !== 'me' && meName();
      const add = (date, it, snapItem) => {
        if (mineOnly && it.who && lc(it.who) !== lc(meName())) return;
        if (snapItem && isDoneNow(it)) return;
        const t = at(date, it.startMin);
        if (t < now - 10 * 60000) return;
        out.push({ k: date + '|' + it.key, t: 'Дім · зараз', b: it.title + ' (' + mins(it.minutes) + ')', at: t });
      };
      if (hm.snap && hm.snap.date === today) for (const it of hm.snap.items) add(today, it, true);
      const plan = P.planWeek(hm, today);
      for (let k = 1; k < 3; k++) if (plan.days[k]) for (const it of plan.days[k].items) add(plan.days[k].date, it, false);
      return out;
    };
    async function pushSub(create) {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub && create) {
        if (!pushVapid) { const r = await X.callApi('/api/push', { action: 'key' }); if (!r.ready || !r.key) throw new Error('Сповіщення ще не налаштовані на сервері.'); pushVapid = r.key; }
        const raw = atob(pushVapid.replace(/-/g, '+').replace(/_/g, '/')); const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      return sub;
    }
    // повідомляє сервер про актуальні справи (викликається раз на пів хвилини й після змін)
    async function pushSync(force) {
      try {
        if (!user || !state || !state.home || store.get(PUSH_KEY) !== '1' || !pushSupported() || Notification.permission !== 'granted') return;
        const items = pushItems(); const sig = JSON.stringify(items.map((i) => i.k + i.at));
        if (!force && sig === pushSig) return;
        const sub = await pushSub(true); if (!sub) return;
        const j = sub.toJSON();
        await X.callApi('/api/push', { action: 'subscribe', sub: { endpoint: j.endpoint, keys: j.keys }, items });
        pushSig = sig;
      } catch (e) { /* без звʼязку: спробуємо наступного разу */ }
    }
    function pushCard() {
      const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
      const say = (t) => { msg.textContent = t; X.toast(t); };
      const box = h('input', { type: 'checkbox', checked: store.get(PUSH_KEY) === '1' ? true : null, disabled: pushSupported() ? null : true, onchange: async (e) => {
        const on = e.target.checked;
        try {
          if (on) {
            if (Notification.permission === 'default') await Notification.requestPermission();
            if (Notification.permission !== 'granted') throw new Error('Дозволь сповіщення для цього сайту в налаштуваннях телефона.');
            store.set(PUSH_KEY, '1'); await pushSub(true); pushSig = ''; await pushSync(true);
            say('Сповіщення на цьому пристрої увімкнено.');
          } else {
            store.set(PUSH_KEY, '0');
            const sub = await pushSub(false);
            if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); try { await X.callApi('/api/push', { action: 'unsubscribe', endpoint: ep }); } catch (er) { /* не критично */ } }
            say('Сповіщення на цьому пристрої вимкнено.');
          }
        } catch (err) { e.target.checked = false; store.set(PUSH_KEY, '0'); say(err.message || 'Не вдалося увімкнути сповіщення.'); }
      } });
      const test = h('button', { class: 'ghost', type: 'button', onclick: async () => {
        try {
          const sub = await pushSub(false); if (!sub) throw new Error('Спершу увімкни сповіщення.');
          await pushSync(true); await X.callApi('/api/push', { action: 'test', endpoint: sub.endpoint }); say('Надіслано. Має зʼявитись за кілька секунд.');
        } catch (err) { say(err.message || 'Не вдалося надіслати.'); }
      } }, 'Надіслати пробне');
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
      return h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Сповіщення на телефоні'),
        h('label', { class: 'check', style: 'display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-size:15px;margin-top:8px' }, box, 'Нагадувати про справи, навіть коли застосунок закритий'),
        h('div', { class: 'toolbar', style: 'margin-top:10px' }, test), msg,
        h('p', { class: 'note', style: 'margin:8px 0 0' }, pushSupported() ? (ios ? 'На iPhone спершу додай застосунок на екран «Додому»: Safari → Поділитись → «На екран Додому», і відкрий його звідти. Лише там сповіщення дозволені.' : 'Увімкни це на кожному пристрої, де хочеш отримувати нагадування.') : 'Цей браузер не підтримує сповіщення. На iPhone потрібен iOS 16.4 або новіший і застосунок, доданий на екран «Додому».'));
    }
    setInterval(() => { pushSync(false); }, 30000);
    setTimeout(() => { pushSync(false); }, 6000);

    // ----- Мій час (вікна часу на кожен день + нагадування) -----
    let timeWho = '';
    function viewTime() {
      const hm = HM(); const ps = people(); const isMulti = ps.length >= 2;
      const who = isMulti ? (ps.includes(timeWho) ? timeWho : meName()) : '';
      const getArr = () => {
        if (!isMulti) return hm.hours;
        if (!hm.hoursBy || typeof hm.hoursBy !== 'object') hm.hoursBy = {};
        if (!Array.isArray(hm.hoursBy[who])) hm.hoursBy[who] = JSON.parse(JSON.stringify(hm.hours || []));
        return hm.hoursBy[who];
      };
      const hours = isMulti ? P.hoursFor(hm, who) : P.hoursOf(hm);
      const note = h('p', { class: 'note', role: 'status' }, 'Зміни зберігаються одразу.');
      const rows = hours.map((hh, i) => {
        const w = hh.wins;
        const mk = (v, lbl) => h('input', { type: 'time', value: v == null ? '' : P.fmtHM(v), 'aria-label': lbl + ', ' + WD[i] });
        const off = h('input', { type: 'checkbox', checked: !hh.wins.length ? true : null, 'aria-label': 'Вихідний, ' + WD[i] });
        const a1 = mk(w[0] && w[0][0], 'Вікно 1 з'); const b1 = mk(w[0] && w[0][1], 'Вікно 1 до');
        const a2 = mk(w[1] && w[1][0], 'Вікно 2 з'); const b2 = mk(w[1] && w[1][1], 'Вікно 2 до');
        const upd = () => {
          const wins = [[a1.value, b1.value], [a2.value, b2.value]].filter((x) => x[0] && x[1]);
          getArr()[i] = off.checked ? { off: true, w: wins } : { w: wins.length ? wins : [['18:30', '19:15']] };
          save(); note.textContent = 'Збережено' + (isMulti ? ' для ' + who : '') + ': ' + (off.checked ? 'вихідний' : mins((isMulti ? P.hoursFor(hm, who) : P.hoursOf(hm))[i].min)) + ' · ' + WD[i];
        };
        for (const el of [off, a1, b1, a2, b2]) el.addEventListener('change', upd);
        const win2 = h('span', { class: 'time-w' }, a2, ' – ', b2);
        const addBtn = h('button', { class: 'link', type: 'button', onclick: () => { addBtn.replaceWith(win2); a2.focus(); } }, '+ додати ще');
        const second = w[1] ? win2 : addBtn;
        return h('div', { class: 'time-row' }, h('span', {}, WD[i]), h('label', { class: 'time-off' }, off, ' вихідний'),
          h('span', { class: 'time-w' }, a1, ' – ', b1), second);
      });
      const notifyBox = h('input', { type: 'checkbox', checked: hm.notify ? true : null, onchange: async (e) => {
        if (e.target.checked) {
          let ok = typeof Notification !== 'undefined' && Notification.permission === 'granted';
          if (!ok && typeof Notification !== 'undefined' && Notification.permission !== 'denied') { try { ok = (await Notification.requestPermission()) === 'granted'; } catch (err) { ok = false; } }
          hm.notify = true; save();
          X.toast(ok ? 'Нагадування увімкнено' : 'Браузер не дозволив сповіщення. Нагадування зʼявлятимуться лише на екрані застосунку.');
        } else { hm.notify = false; save(); }
      } });
      const peopleIn = h('input', { value: ps.join(', '), placeholder: 'Напр.: Марія, Дмитро', 'aria-label': 'Хто в сімʼї' });
      const peopleCard = h('div', { class: 'card', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Хто ділить справи'),
        h('p', { class: 'mute', style: 'margin:6px 0 10px' }, 'Впиши імена через кому (двоє або більше). Кожен вказує свій вільний час, а розклад розподіляє справи між вами й підписує, чиї вони. Справу можна закріпити за людиною в її налаштуваннях, тоді вона лишається за нею.'),
        h('div', { class: 'toolbar' }, peopleIn, h('button', { class: 'primary', type: 'button', onclick: () => {
          const list = peopleIn.value.split(',').map((x) => x.trim()).filter(Boolean); hm.people = list; hm.snap = null; save(); render();
          X.toast(list.length >= 2 ? 'Справи ділитимуться між: ' + list.join(', ') : 'Додай ще одне імʼя, щоб справи ділились');
        } }, 'Зберегти')),
        isMulti ? h('div', { class: 'toolbar', style: 'margin-top:12px;align-items:center' }, h('span', { class: 'mute' }, 'Я —'),
          ps.map((n) => h('button', { class: meName() === n ? 'primary' : 'ghost', type: 'button', onclick: () => { store.set(meKey(), n); timeWho = ''; hm.snap = hm.snap; render(); } }, n))) : null,
        isMulti ? h('div', { class: 'toolbar', style: 'margin-top:12px;align-items:center' }, h('span', { class: 'mute' }, 'Графік для:'),
          ps.map((n) => h('button', { class: who === n ? 'primary' : 'ghost', type: 'button', onclick: () => { timeWho = n; render(); } }, n))) : null);
      return [...header('Дім · графік', 'Скільки часу', 'маю'), peopleCard,
        h('div', { class: 'card' }, h('p', { class: 'mute', style: 'margin:0 0 12px' }, (isMulti ? 'Графік для: ' + who + '. ' : '') + 'Для кожного дня до двох «вікон», коли ' + (isMulti ? who : 'ти') + ' можна займатись домашніми справами, наприклад 08:00–08:20 і 19:00–20:00. Розклад ставить справи тільки у ці вікна.'), rows,
          h('button', { class: 'link', type: 'button', onclick: () => { if (isMulti) { if (!hm.hoursBy) hm.hoursBy = {}; hm.hoursBy[who] = []; } else hm.hours = []; save(); render(); } }, 'Повернути стандартний графік')),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Вільний час'),
          h('label', { class: 'check', style: 'display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-size:15px;margin-top:8px' },
            h('input', { type: 'checkbox', checked: hm.fill !== false ? true : null, onchange: (e) => { hm.fill = e.target.checked; save(); X.toast(e.target.checked ? 'Вільний час заповнюватиметься справами з найближчих днів' : 'Лише справи, що настав їхній строк'); } }),
            'Заповнювати вільний час справами з найближчих днів'),
          h('p', { class: 'note', style: 'margin:8px 0 0' }, 'Увімкнено: якщо в дні лишається час, у нього підтягуються справи, що мають бути за 1–4 дні. Вимкнено: у плані лише те, що вже настав строк, а решта часу вільна.')),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Нагадування'),
          h('label', { class: 'check', style: 'display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-size:15px;margin-top:8px' }, notifyBox, 'Нагадувати, коли настав час справи зі списку на сьогодні'),
          h('p', { class: 'note', style: 'margin:8px 0 0' }, 'Працює, поки застосунок відкритий. Щоб нагадувало й коли він закритий, увімкни сповіщення на телефоні нижче.')),
        pushCard(), note];
    }

    // нагадування: раз на пів хвилини дивимось, чи не час для справи
    const remindedKey = new Set();
    setInterval(() => {
      try {
        if (!user || !state || !state.home || !state.home.notify) return;
        const hm = state.home; const today = todayD();
        if (!hm.snap || hm.snap.date !== today) return;
        const now = new Date(); const cur = now.getHours() * 60 + now.getMinutes();
        for (const it of hm.snap.items) {
          const k = today + it.key;
          if (remindedKey.has(k) || isDoneNow(it) || cur < it.startMin || cur > it.startMin + 10) continue;
          remindedKey.add(k);
          const msg = 'Час: ' + it.title + ' (' + mins(it.minutes) + ')';
          X.toast(msg);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('Дім', { body: msg, tag: k }); } catch (e) { /* не всюди підтримується */ } }
        }
      } catch (e) { /* ігноруємо */ }
    }, 30000);


    // ----- пріоритети тижня: одна головна ціль і три найважливіші справи -----
    function priCard() {
      const hm = HM(); const today = todayD(); const wk = P.addDays(today, -P.wdOf(today));
      if (!hm.pri || hm.pri.wk !== wk) hm.pri = { wk, goal: '', gd: false, t: [{ t: '', d: false }, { t: '', d: false }, { t: '', d: false }] };
      const pr = hm.pri; while (pr.t.length < 3) pr.t.push({ t: '', d: false });
      const mk = (get, set, ph, big) => {
        const cb = h('input', { type: 'checkbox', checked: get().d ? true : null, 'aria-label': 'Зроблено', onchange: (e) => { set({ ...get(), d: e.target.checked }); save(); render(); if (e.target.checked) X.toast('Є! ' + (get().t || 'Пріоритет') + ' зроблено'); } });
        const tx = h('input', { value: get().t, placeholder: ph, 'aria-label': ph, style: big ? 'font-size:17px' : '' });
        tx.addEventListener('change', () => { set({ ...get(), t: tx.value.trim() }); save(); render(); });
        return h('div', { class: 'toolbar', style: 'align-items:center;gap:10px;margin:6px 0;flex-wrap:nowrap' }, cb, tx);
      };
      const all = [{ t: pr.goal, d: pr.gd }, ...pr.t].filter((x) => x.t); const dn = all.filter((x) => x.d).length;
      return h('div', { class: 'card', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Пріоритети тижня' + (all.length ? ' · ' + dn + '/' + all.length : '')),
        mk(() => ({ t: pr.goal, d: pr.gd }), (v) => { pr.goal = v.t; pr.gd = v.d; }, 'Головна ціль тижня, наприклад: генеральне в ванній', true),
        pr.t.map((_, i) => mk(() => pr.t[i], (v) => { pr.t[i] = v; }, 'Важлива справа ' + (i + 1))),
        h('p', { class: 'note', style: 'margin:8px 0 0' }, 'Оновлюється щопонеділка. Бачите обоє, якщо це спільний простір.'));
    }

    // ----- успіхи: тепловізор, тренд по тижнях, рівень, бос і підказки -----
    const LEVELS = [[0, 'Яєчко'], [15, 'Каченя'], [50, 'Юний плавець'], [120, 'Домашня качка'], [250, 'Качка-кухар'], [500, 'Володар ставка']];
    const SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    function viewStats() {
      const hm = HM(); const today = todayD(); const hist = hm.hist || {};
      const mon = P.addDays(today, -P.wdOf(today)); const start = P.addDays(mon, -77);
      const pctOf = (e) => (e && e.p > 0 ? e.d / e.p : null);
      const col = (date) => {
        if (date > today) return 'transparent'; const e = hist[date]; if (!e) return 'rgba(128,128,128,.10)';
        if (!e.p) return 'rgba(128,128,128,.18)'; const r = e.d / e.p;
        return r >= 1 ? 'rgba(var(--spark),.95)' : r >= .5 ? 'rgba(var(--spark),.55)' : r > 0 ? 'rgba(var(--spark),.28)' : 'rgba(224,122,95,.45)';
      };
      const grid = h('div', { style: 'display:grid;grid-template-columns:28px repeat(12,1fr);gap:4px;align-items:center;max-width:560px' },
        ...[0, 1, 2, 3, 4, 5, 6].flatMap((wd) => [h('span', { class: 'mute', style: 'font-size:12px' }, SHORT[wd]),
          ...Array.from({ length: 12 }, (_, w) => { const date = P.addDays(start, w * 7 + wd); const e = hist[date];
            return h('div', { title: dayName(date) + (e && e.p ? ': ' + e.d + ' з ' + e.p : date > today ? '' : ': немає даних'), style: 'aspect-ratio:1;min-height:16px;border:1px solid var(--line);background:' + col(date) }); })]));
      // тижні
      const weeks = Array.from({ length: 12 }, (_, k) => {
        const ws = P.addDays(mon, -7 * (11 - k)); let p = 0; let d = 0;
        for (let j = 0; j < 7; j++) { const e = hist[P.addDays(ws, j)]; if (e) { p += e.p; d += e.d; } }
        return { ws, p, d, pct: p ? Math.round((d / p) * 100) : null };
      });
      const wcol = (v) => (v >= 80 ? 'rgba(110,190,130,.85)' : v >= 50 ? 'rgba(var(--spark),.8)' : 'rgba(224,122,95,.8)');
      const bars = weeks.map((w) => h('div', { style: 'display:flex;align-items:center;gap:10px;margin:4px 0' },
        h('span', { class: 'mute', style: 'width:64px;font-size:13px' }, dayName(w.ws).replace(/^[^,]*,\s*/, '')),
        h('div', { style: 'flex:1;height:10px;background:rgba(128,128,128,.12)' }, w.pct == null ? null : h('div', { style: 'height:100%;width:' + w.pct + '%;background:' + wcol(w.pct) })),
        h('span', { style: 'width:44px;text-align:right;font-size:13px' }, w.pct == null ? '—' : w.pct + '%')));
      const cur = weeks[11]; const prv = weeks[10];
      const cmp = cur.pct != null && prv.pct != null ? (cur.pct - prv.pct === 0 ? 'Так само, як минулого тижня.' : (cur.pct > prv.pct ? 'Краще, ніж минулого тижня: +' : 'Гірше, ніж минулого тижня: −') + Math.abs(cur.pct - prv.pct) + ' п. п.') : 'Порівняння зʼявиться, коли буде два тижні даних.';
      // рівень
      const total = Object.keys(hist).reduce((s2, k) => s2 + (hist[k].d || 0), 0);
      let li = 0; LEVELS.forEach((l, i) => { if (total >= l[0]) li = i; });
      const nxt = LEVELS[li + 1]; const lvPct = nxt ? Math.round(((total - LEVELS[li][0]) / (nxt[0] - LEVELS[li][0])) * 100) : 100;
      const streak = streakInfo(hm, today);
      // бос: найбільш запущена повторювана справа
      const rec = hm.chores.map((c) => ({ title: c.title, room: c.room, every: Number(c.every) || 7, last: c.last }))
        .concat(hm.tasks.filter((t) => Number(t.every) > 0 && !t.done).map((t) => ({ title: t.title, room: t.room, every: Number(t.every), last: t.last })))
        .filter((c) => c.last).map((c) => ({ ...c, ago: P.diff(today, c.last), r: P.diff(today, c.last) / c.every })).filter((c) => c.r > 1).sort((a, b) => b.r - a.r);
      const boss = rec[0];
      // за днями тижня
      const byWd = Array.from({ length: 7 }, () => [0, 0]);
      for (const k of Object.keys(hist)) { const e = hist[k]; if (e && e.p > 0) { const w = P.wdOf(k); byWd[w][0] += e.p; byWd[w][1] += e.d; } }
      const ranked = byWd.map((v, i) => ({ i, pct: v[0] >= 3 ? Math.round((v[1] / v[0]) * 100) : null })).filter((x) => x.pct != null).sort((a, b) => b.pct - a.pct);
      // кімнати, які найдовше без уваги
      const roomAge = hm.rooms.map((r) => { const cs = hm.chores.filter((c) => c.room === r.id && c.last); if (!cs.length) return null; return { name: r.name, r: cs.reduce((s2, c) => s2 + P.diff(today, c.last) / (Number(c.every) || 7), 0) / cs.length }; }).filter(Boolean).sort((a, b) => b.r - a.r);
      // хто більше зробив цього тижня
      const per = {};
      if (multi()) for (let j = 0; j < 7; j++) { const e = hist[P.addDays(mon, j)]; if (e && e.w) for (const k of Object.keys(e.w)) { const a = per[k] || (per[k] = [0, 0]); a[0] += e.w[k][0]; a[1] += e.w[k][1]; } }
      const pk = Object.keys(per).filter((k) => k !== '—').sort((a, b) => per[b][1] - per[a][1]);
      const perCard = multi() && pk.length ? h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Цього тижня'),
        pk.map((k) => h('div', { style: 'display:flex;align-items:center;gap:10px;margin:6px 0' }, h('span', { style: 'width:110px' }, k),
          h('div', { style: 'flex:1;height:10px;background:rgba(128,128,128,.12)' }, h('div', { style: 'height:100%;width:' + (per[k][0] ? Math.round((per[k][1] / per[k][0]) * 100) : 0) + '%;background:rgba(var(--spark),.85)' })),
          h('span', { class: 'mute', style: 'width:70px;text-align:right;font-size:13px' }, per[k][1] + ' з ' + per[k][0]))),
        per[pk[0]][1] > (per[pk[1]] ? per[pk[1]][1] : -1) ? h('p', { class: 'mute', style: 'margin:8px 0 0' }, 'Більше зробив(ла): ' + pk[0] + '. Але ж це команда.') : h('p', { class: 'mute', style: 'margin:8px 0 0' }, 'Порівну. Гарна команда.')) : null;
      const enough = Object.keys(hist).length >= 5;
      const tips = [];
      if (enough && ranked.length >= 2) { tips.push('Найкращий день: ' + WD[ranked[0].i].toLowerCase() + ' (' + ranked[0].pct + '%).'); tips.push('Найважчий: ' + WD[ranked[ranked.length - 1].i].toLowerCase() + ' (' + ranked[ranked.length - 1].pct + '%). Можна поставити туди менше справ у «Мій час».'); }
      if (roomAge[0] && roomAge[0].r > 1) tips.push('Найдовше без уваги: ' + roomAge[0].name + '.');
      return [...header('Дім · успіхи', 'Мої', 'успіхи'),
        statsRow([['Серія днів поспіль', streak], ['Цей тиждень', cur.pct || 0, '%'], ['Зроблено за 90 днів', total]]),
        h('div', { class: 'card' }, h('div', { class: 'tag' }, 'Рівень каченяти'),
          h('h3', { style: 'margin:6px 0' }, LEVELS[li][1]),
          h('div', { class: 'h-prog', role: 'progressbar', 'aria-valuenow': lvPct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: 'width:' + lvPct + '%' })),
          h('p', { class: 'mute', style: 'margin:8px 0 0' }, nxt ? 'До рівня «' + nxt[1] + '» ще ' + (nxt[0] - total) + ' справ.' : 'Найвищий рівень. Ставок ваш.')),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Бос тижня'),
          boss ? h('p', { style: 'margin:6px 0 0' }, h('b', {}, boss.title), boss.room ? ' · ' + roomName(boss.room) : '', h('span', { class: 'mute' }, ' · не робили ' + boss.ago + ' дн., а норма раз на ' + boss.every + '. Переможіть, і серія подякує.'))
            : h('p', { class: 'mute', style: 'margin:6px 0 0' }, 'Боса немає: усе повторюване в нормі.')),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Останні 12 тижнів'), h('div', { style: 'margin-top:12px' }, grid),
          h('p', { class: 'note', style: 'margin:10px 0 0' }, 'Чим яскравіша клітинка, тим більше зроблено з плану. Червоні дні: нічого. Прозорі: ще немає даних.')),
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Виконання по тижнях'), h('div', { style: 'margin-top:10px' }, bars), h('p', { class: 'mute', style: 'margin:8px 0 0' }, cmp)),
        perCard,
        h('div', { class: 'card', style: 'margin-top:20px' }, h('div', { class: 'tag' }, 'Підказки'),
          tips.length ? h('ul', { style: 'margin:8px 0 0;padding-left:18px' }, tips.map((x) => h('li', {}, x))) : h('p', { class: 'mute', style: 'margin:6px 0 0' }, 'Підказки зʼявляться, коли накопичиться кілька днів історії.'))];
    }

    const clean = (fn) => () => fn().filter((x) => x != null && x !== false);
    Object.assign(VIEWS, { h_today: clean(viewToday), h_week: clean(viewWeek), h_clean: clean(viewClean), h_tasks: clean(viewTasks), h_time: clean(viewTime), h_stats: clean(viewStats) });

    // ----- перемикач режиму й навігація -----
    const modeBtn = h('button', { id: 'modeBtn', class: 'ghost', type: 'button' });
    const right = document.querySelector('header .right');
    if (right) right.insertBefore(modeBtn, document.getElementById('themeBtn'));
    function toggleMode() {
      if (isHome()) { hTab = state.tab; store.set(MODE_KEY, 'kitchen'); state.tab = kTab || 'pantry'; }
      else { kTab = state.tab; store.set(MODE_KEY, 'home'); state.tab = hTab || 'h_today'; }
      saveLocal(); render(); window.scrollTo(0, 0);
    }
    modeBtn.addEventListener('click', toggleMode);
    const HI = {
      h_today: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('circle', { cx: 12, cy: 12, r: 4 }), S('path', { d: 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4' })),
      h_week: () => ICON.menu(),
      h_clean: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M5 20h14 M8 20l1-9h6l1 9 M10 11V6a2 2 0 0 1 4 0v5' })),
      h_tasks: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('rect', { x: 4, y: 4, width: 16, height: 16 }), S('path', { d: 'M8 12l3 3 5-6' })),
      h_stats: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('path', { d: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2' })),
      h_time: () => S('svg', { viewBox: '0 0 24 24', class: 'ni' }, S('circle', { cx: 12, cy: 12, r: 8 }), S('path', { d: 'M12 7v5l3 2' })),
    };
    const prevRender = render;
    render = function () {           // eslint-disable-line no-func-assign
      const logged = !!(user && state);
      modeBtn.hidden = !logged;
      if (!logged) return prevRender();
      const home = isHome();
      modeBtn.textContent = home ? 'Кухня' : 'Дім';
      modeBtn.title = home ? 'Повернутися до кухні' : 'Режим «Дім»: прибирання й задачі';
      if (!home && /^h_/.test(state.tab)) state.tab = kTab || 'pantry';
      if (home && !/^h_/.test(state.tab)) { kTab = state.tab; state.tab = hTab || 'h_today'; }
      TABS.splice(0, TABS.length, ...(home ? HOME_TABS : KITCHEN_TABS));
      document.body.classList.toggle('home-mode', home);
      prevRender();
      if (home) {
        const nav = document.getElementById('nav');
        if (nav && !nav.hidden && mq.matches) {
          nav.replaceChildren(...HOME_TABS.map(([k, l]) => h('button', { type: 'button', 'aria-current': state.tab === k ? 'page' : null,
            onclick: () => { state.tab = k; hTab = k; saveLocal(); render(); } }, HI[k](), h('span', {}, l))));
        }
      }
    };
  })();

  // ---------- iPhone: швидке додавання, свайпи, посилання для Siri/Ярликів, календар, офлайн ----------
  (function mobileBoost() {
    const isHomeMode = () => store.get('ducky.mode') === 'home';
    const P = window.DuckyPlan;
    const fab = h('button', { id: 'fab', class: 'fab', type: 'button', hidden: true, 'aria-label': 'Швидко додати' }, '+');
    document.body.append(fab);

    // ----- швидке додавання -----
    function quickAdd() {
      let closeFn = null;
      const home = isHomeMode();
      const inp = h('input', { placeholder: home ? 'Напр.: полити квіти 10 хв' : 'Назва продукту', 'aria-label': 'Що додати', enterkeyhint: 'done', autocomplete: 'off', autocapitalize: 'sentences' });
      const done = (msg) => { closeFn(); save(); render(); X.toast(msg); };
      const val = () => inp.value.trim();
      const body = home
        ? h('div', { style: 'display:grid;gap:12px' }, inp,
          h('p', { class: 'note', style: 'margin:0' }, 'Можна писати як говориш: «щодня», «щосереди», «завтра», «до 15.10», «20 хв», «важливо».'),
          h('div', { class: 'toolbar' }, h('button', { class: 'primary', type: 'button', onclick: () => {
            const v = val(); if (!v) return; const q = window.DuckyQuick(v); const hm = state.home || (state.home = {}); (hm.tasks || (hm.tasks = [])).push({ id: uid(), title: q.title, due: q.due, minutes: q.minutes || 30, prio: q.prio, room: null, done: false, every: q.every, wd: q.wd, last: null });
            done('Додано задачу: ' + q.title);
          } }, 'Додати задачу')))
        : h('div', { style: 'display:grid;gap:12px' }, inp,
          h('div', { class: 'toolbar' },
            h('button', { class: 'primary', type: 'button', onclick: () => { const v = val(); if (!v) return; state.products.push({ id: uid(), name: v, qty: '', weight: '', store: '', price: null, bought: todayISO(), exp: null }); done('У коморі: ' + v); } }, 'У комору'),
            h('button', { class: 'ghost', type: 'button', onclick: () => { const v = val(); if (!v) return; const m = manual(); if (!m.some((x) => norm(x.name) === norm(v))) m.push({ id: uid(), name: v }); done('У покупках: ' + v); } }, 'У покупки')));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = body.querySelector('button.primary'); if (b) b.click(); } });
      closeFn = X.openModal(home ? 'Нова задача' : 'Швидко додати', body);
    }
    fab.addEventListener('click', quickAdd);

    // ----- посилання для Ярликів Siri та закладок: ?go=today|tasks|clean|week|shop|pantry  ?add=текст&to=task|shop|pantry -----
    let launched = false;
    function launchLinks() {
      if (launched) return; launched = true;
      let sp; try { sp = new URLSearchParams(location.search); } catch (e) { return; }
      const go = sp.get('go'); const add = (sp.get('add') || '').trim(); const to = sp.get('to') || '';
      if (!go && !add) return;
      const HT = { today: 'h_today', week: 'h_week', clean: 'h_clean', tasks: 'h_tasks', time: 'h_time' };
      const KT = { pantry: 'pantry', shop: 'shop', menu: 'menu', recipes: 'recipes' };
      let msg = '';
      if (add) {
        if (to === 'shop') { const m = manual(); if (!m.some((x) => norm(x.name) === norm(add))) m.push({ id: uid(), name: add }); store.set('ducky.mode', 'kitchen'); state.tab = 'shop'; msg = 'У покупках: ' + add; }
        else if (to === 'pantry') { state.products.push({ id: uid(), name: add, qty: '', weight: '', store: '', price: null, bought: todayISO(), exp: null }); store.set('ducky.mode', 'kitchen'); state.tab = 'pantry'; msg = 'У коморі: ' + add; }
        else { const q = window.DuckyQuick(add); const hm = state.home || (state.home = {}); (hm.tasks || (hm.tasks = [])).push({ id: uid(), title: q.title, due: q.due, minutes: q.minutes || 30, prio: q.prio, room: null, done: false, every: q.every, wd: q.wd, last: null }); store.set('ducky.mode', 'home'); state.tab = 'h_tasks'; msg = 'Додано задачу: ' + q.title; }
        save();
      } else if (HT[go]) { store.set('ducky.mode', 'home'); state.tab = HT[go]; }
      else if (KT[go]) { store.set('ducky.mode', 'kitchen'); state.tab = KT[go]; }
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ігноруємо */ }
      saveLocal(); render(); if (msg) X.toast(msg);
    }

    // ----- свайпи на списку «Сьогодні»: вправо зроблено, вліво перенести -----
    let sw = null;
    document.addEventListener('touchstart', (e) => {
      const row = e.target.closest && e.target.closest('.h-row'); if (!row || e.touches.length !== 1) { sw = null; return; }
      sw = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, on: false };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!sw) return; const t = e.touches[0]; const dx = t.clientX - sw.x; const dy = t.clientY - sw.y;
      if (!sw.on) { if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) sw.on = true; else if (Math.abs(dy) > 12) { sw = null; return; } else return; }
      sw.dx = dx; sw.row.style.transform = 'translateX(' + Math.max(-120, Math.min(120, dx * 0.7)) + 'px)'; sw.row.classList.toggle('sw-r', dx > 40); sw.row.classList.toggle('sw-l', dx < -40);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const endSwipe = () => {
      if (!sw) return; const { row, dx, on } = sw; sw = null;
      row.style.transform = ''; row.classList.remove('sw-r', 'sw-l');
      if (!on) return;
      if (dx > 90) { const c = row.querySelector('input[type=checkbox]'); if (c && !c.disabled) c.click(); }
      else if (dx < -90) { const b = row.querySelector('button'); if (b) b.click(); }
    };
    document.addEventListener('touchend', endSwipe, { passive: true });
    document.addEventListener('touchcancel', endSwipe, { passive: true });

    // ----- офлайн -----
    const setNet = () => {
      const el = document.getElementById('sync'); if (!el) return;
      if (!navigator.onLine) { el.textContent = 'Без мережі: зберігаємо на пристрої'; el.dataset.off = '1'; }
      else if (el.dataset.off) { delete el.dataset.off; el.textContent = ''; try { if (remote && remoteReady) pushRemote(); } catch (e) { /* ігноруємо */ } }
    };
    window.addEventListener('offline', setNet); window.addEventListener('online', setNet);

    // ----- календар iPhone: файл .ics з розкладом -----
    const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    window.DuckyICS = function (days, roomName) {
      const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ducky//Dim//UK', 'CALSCALE:GREGORIAN'];
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      for (const d of days) for (const it of d.items) {
        const ymd = d.date.replace(/-/g, ''); const f = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + String(m % 60).padStart(2, '0') + '00';
        out.push('BEGIN:VEVENT', 'UID:' + it.key.replace(/[^a-z0-9]/gi, '') + '-' + ymd + '@ducky', 'DTSTAMP:' + stamp,
          'DTSTART:' + ymd + 'T' + f(it.startMin), 'DTEND:' + ymd + 'T' + f(it.endMin),
          'SUMMARY:' + icsEsc(it.title), it.room ? 'LOCATION:' + icsEsc(roomName(it.room)) : null, 'DESCRIPTION:' + icsEsc(it.must ? 'Обовʼязково' : 'Дім · Ducky'),
          'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.title), 'TRIGGER:-PT5M', 'END:VALARM', 'END:VEVENT');
      }
      out.push('END:VCALENDAR'); return out.filter(Boolean).join('\r\n');
    };

    // ----- хуки до render -----
    const prev = render;
    render = function () {          // eslint-disable-line no-func-assign
      prev();
      fab.hidden = !(user && state);
      if (user && state) launchLinks();
    };
    window.addEventListener('load', setNet);
  })();

  Object.assign(X, { exportText, exportCsv, editProduct, editRecipe, editReceipt, parseListLocal, toggleFreeze, priceModal, shoppingItems, minShortages, parseQty, unitTable, todayPicks, thawTips });
  render();
})();
