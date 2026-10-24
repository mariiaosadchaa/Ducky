// Ducky: віртуальний холодильник, морозилка й шафа. Замінює довгий список комори компактним екраном для телефона:
// вкладки-місця, полиці з плитками продуктів, пошук, швидкі дії по дотику. Дані ті самі (state.products),
// додається лише поле loc ('fridge' | 'pantry'); морозилка = p.frozen, як і раніше.
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || !window.DuckyExtras || !VIEWS.pantry) return;
  const X = window.DuckyExtras;
  const LS = 'ducky.pantryTab';
  let tab = 'fridge'; try { tab = localStorage.getItem(LS) || 'fridge'; } catch (e) { /* ок */ }
  let q = ''; let onlySoon = false;

  const PLACES = [['fridge', 'Холодильник', '🧊'], ['freezer', 'Морозилка', '❄️'], ['pantry', 'Шафа', '🥫']];
  const DRY = /крупа|рис\b|гречк|макарон|спагет|борошно|цукор|сіль|олі[яї]|оцет|консерв|чай\b|кава|какао|печиво|цибул|часник|картопл|сухар|мюслі|пластів|горіх|мед\b|варення|соус|спец|приправ|хліб|батон|булк/i;
  function whereIs(p) {
    if (p.frozen) return 'freezer';
    if (p.loc === 'fridge' || p.loc === 'pantry') return p.loc;
    return DRY.test(p.name || '') ? 'pantry' : 'fridge';
  }
  const SHELVES = [
    ['Молочне й яйця', /молок|кефір|йогурт|сир\b|сири|сиров|вершк|масло|сметан|яйц|творог|кисломол|ряжанк|плавлен/i],
    ['М\'ясо й риба', /м'яс|мяс|курк|куря|свин|яловичин|фарш|ковбас|сосис|шинк|бекон|риб|лосос|форел|кревет/i],
    ['Овочі, фрукти, зелень', /овоч|фрукт|яблук|банан|груш|помідор|томат|огірк|морк|капуст|перець|салат|зелен|кріп|петруш|лимон|апельсин|гриб|броколі|кабачок|буряк|ягод/i],
    ['Готове й соуси', /суп|борщ|котлет|готов|салат|соус|кетчуп|майонез|гірчиц|паштет|хумус/i],
  ];
  const shelfOf = (p) => { for (const [n, re] of SHELVES) if (re.test(p.name || '')) return n; return 'Інше'; };
  const amount = (p) => [p.qty, p.weight].filter(Boolean).join(' · ');
  const dleft = (p) => (typeof daysLeft === 'function' ? daysLeft(p.exp) : null);

  function badge(p) {
    const d = dleft(p);
    if (d === null) return null;
    if (d < 0) return h('span', { class: 'fr-b bad' }, 'прострочено');
    if (d <= 3) return h('span', { class: 'fr-b soon' }, d === 0 ? 'сьогодні' : d + ' дн.');
    return null;
  }

  function actions(p) {
    let close = null; const go = (fn) => () => { close(); fn(); };
    const loc = whereIs(p);
    const mv = (to, label) => h('button', { class: 'fr-act', type: 'button', onclick: go(() => {
      if (to === 'freezer') { if (!p.frozen) X.toggleFreeze(p); return; }
      if (p.frozen) { p.loc = to; X.toggleFreeze(p); return; }   // розморозка спитає, на скільки днів
      p.loc = to; save(); render();
    }) }, label);
    const body = h('div', { class: 'fr-sheet' },
      h('p', { class: 'mute', style: 'margin:0 0 12px' }, [amount(p), p.exp ? 'до ' + fmtDate(p.exp) : 'без терміну', p.store].filter(Boolean).join(' · ')),
      h('div', { class: 'fr-acts' },
        h('button', { class: 'fr-act pri', type: 'button', onclick: go(() => X.useProduct(p)) }, '🍳 Готую'),
        h('button', { class: 'fr-act', type: 'button', onclick: go(() => X.editProduct(p)) }, '✏️ Змінити'),
        h('button', { class: 'fr-act', type: 'button', onclick: go(() => { X.archiveProduct(p, 'used'); save(); render(); }) }, '✅ Закінчилось'),
        h('button', { class: 'fr-act', type: 'button', onclick: go(() => { X.archiveProduct(p, 'thrown'); save(); render(); }) }, '🗑 Викинула')),
      h('div', { class: 'tag', style: 'margin:14px 0 6px' }, 'Перемістити'),
      h('div', { class: 'fr-acts' },
        loc !== 'fridge' ? mv('fridge', '🧊 У холодильник') : null,
        loc !== 'freezer' ? mv('freezer', '❄️ У морозилку') : null,
        loc !== 'pantry' ? mv('pantry', '🥫 У шафу') : null));
    close = X.openModal(p.name, body);
  }

  function addSheet() {
    let close = null;
    const f = { name: '', qty: '', weight: '', exp: '', loc: tab === 'freezer' ? 'freezer' : tab };
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
    const inp = (label, k, attrs) => h('label', {}, label, h('input', { ...attrs, value: f[k], oninput: (e) => { f[k] = e.target.value; } }));
    const seg = h('div', { class: 'fr-seg' }, PLACES.map(([k, n, ic]) => h('button', { type: 'button', class: f.loc === k ? 'on' : '', onclick: (e) => { f.loc = k; [...seg.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } }, ic + ' ' + n)));
    const body = h('div', {},
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
        h('div', { style: 'grid-column:1/-1' }, inp('Продукт', 'name', { list: 'dl-products', autocomplete: 'off', placeholder: 'Напр.: молоко' })),
        inp('Кількість', 'qty', { placeholder: '2 шт' }), inp('Вага / обʼєм', 'weight', { placeholder: '1 л' }),
        h('div', { style: 'grid-column:1/-1' }, inp('Придатний до', 'exp', { type: 'date' }))),
      h('div', { class: 'tag', style: 'margin:14px 0 6px' }, 'Куди покласти'), seg,
      h('div', { class: 'toolbar', style: 'margin-top:16px' },
        h('button', { class: 'primary', type: 'button', style: 'min-height:46px', onclick: () => {
          const name = f.name.trim(); if (!name) { msg.textContent = 'Вкажіть назву.'; return; }
          state.products.push({ id: uid(), name, qty: f.qty.trim(), weight: f.weight.trim(), store: '', price: null, bought: todayISO(), exp: f.exp || null,
            loc: f.loc === 'freezer' ? 'fridge' : f.loc, ...(f.loc === 'freezer' ? { frozen: true, frozenAt: todayISO(), expBefore: f.exp || null, exp: f.exp || addDaysISO(90) } : {}) });
          save(); close(); render();
        } }, 'Додати'),
        h('button', { class: 'link', type: 'button', onclick: () => close() }, 'Скасувати')), msg);
    close = X.openModal('Додати продукт', body);
  }
  const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function tile(p) {
    return h('button', { class: 'fr-t' + (dleft(p) !== null && dleft(p) < 0 ? ' old' : ''), type: 'button', onclick: () => actions(p), 'aria-label': p.name + (amount(p) ? ', ' + amount(p) : '') },
      h('span', { class: 'fr-ic' }, icon(productIcon(p.name))),
      h('span', { class: 'fr-n' }, p.name),
      h('span', { class: 'fr-q' }, amount(p) || '—'),
      badge(p));
  }

  function unit() {
    const all = state.products.filter((p) => whereIs(p) === tab);
    const ql = q.trim().toLowerCase();
    let list = all.filter((p) => !ql || String(p.name).toLowerCase().includes(ql));
    if (onlySoon) list = list.filter((p) => { const d = dleft(p); return d !== null && d <= 3; });
    const groups = new Map();
    for (const p of list.sort((a, b) => (a.exp || '9999').localeCompare(b.exp || '9999'))) {
      const k = tab === 'freezer' ? 'Заморожене' : tab === 'pantry' ? (DRY.test(p.name) ? 'Сухі запаси' : 'Інше') : shelfOf(p);
      if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p);
    }
    const shelves = [...groups.entries()].map(([k, ps]) => h('section', { class: 'fr-shelf' }, h('div', { class: 'fr-sl' }, k + ' · ' + ps.length), h('div', { class: 'fr-grid' }, ps.map(tile))));
    return h('div', { class: 'fr-unit fr-' + tab },
      shelves.length ? shelves : h('p', { class: 'empty', style: 'text-align:center;padding:24px 8px' }, all.length ? 'Нічого не знайдено.' : tab === 'fridge' ? 'У холодильнику порожньо. Напиши в полі вище, що купила, або додай вручну.' : tab === 'freezer' ? 'Морозилка порожня. Заморожене з\'явиться тут.' : 'У шафі порожньо.'));
  }

  function view() {
    const out = VIEWS.__pantryBase();
    const counts = { fridge: 0, freezer: 0, pantry: 0 }; for (const p of state.products) counts[whereIs(p)]++;
    const soon = state.products.filter((p) => { const d = dleft(p); return d !== null && d <= 3; }).length;
    // що беремо зі старого екрана
    const ai = []; const rest = []; let todayEl = null; let recent = null;
    for (const el of out.slice(2)) {
      if (!el || !el.classList) continue;
      const t = el.textContent || '';
      if (el.classList.contains('stats')) continue;
      if (el.classList.contains('grid')) { const st = el.querySelector('.stack'); if (st && st.lastElementChild) recent = st.lastElementChild; continue; }
      if (/^Комора словами|^З команд iPhone/.test(t.trim())) { ai.push(el); continue; }
      if (/^Морозилка/.test(t.trim())) continue;
      if (/^Що приготувати сьогодні/i.test(t.trim())) { todayEl = el; continue; }
      rest.push(el);
    }
    const search = h('input', { type: 'search', class: 'fr-search', placeholder: 'Пошук продукту', 'aria-label': 'Пошук продукту', value: q, enterkeyhint: 'search', oninput: (e) => { q = e.target.value; const u = document.querySelector('.fr-unit'); if (u) u.replaceWith(unit()); } });
    const tabs = h('div', { class: 'fr-tabs', role: 'tablist' }, PLACES.map(([k, n, ic]) => h('button', { type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', class: tab === k ? 'on' : '', onclick: () => { tab = k; try { localStorage.setItem(LS, k); } catch (e) { /* ок */ } render(); } },
      h('span', { class: 'fr-ti' }, ic), h('span', {}, n), h('b', {}, String(counts[k])))));
    const chips = h('div', { class: 'fr-chips' },
      h('button', { type: 'button', class: 'fr-chip' + (onlySoon ? ' on' : ''), onclick: () => { onlySoon = !onlySoon; render(); } }, '⏳ Скоро зіпсуються' + (soon ? ' · ' + soon : '')),
      h('button', { type: 'button', class: 'fr-chip add', onclick: addSheet }, '＋ Додати вручну'));
    const more = h('details', { class: 'card fr-more' }, h('summary', {}, 'Ще інструменти'), h('div', { class: 'fr-more-in' }, ...rest, recent || ''));
    return [...header('Мої запаси', 'Що вдома', 'сьогодні'), ...ai, h('div', { class: 'fr-wrap' }, tabs, search, chips, unit()), todayEl, more].filter(Boolean);
  }

  VIEWS.__pantryBase = VIEWS.pantry;
  VIEWS.pantry = view;
})();
