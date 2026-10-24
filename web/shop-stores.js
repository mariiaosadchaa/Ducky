// Ducky: «Де купити вигідніше». Групує те, що лишилось купити, за магазином з найнижчою ціною з ваших чеків.
// Ціни беруться лише з чеків: нічого не вигадується; для продуктів без історії показуємо окремо.
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || !VIEWS.shop || !window.DuckyExtras || !window.DuckyExtras.shoppingItems) return;
  const X = window.DuckyExtras;
  const money2 = (v) => (typeof money === 'function' ? money(v) : Math.round(v) + ' ₴');

  function storePricesFor(name, prices) {
    const res = {};
    const add = (m) => { for (const [st, pr] of Object.entries(m || {})) if (pr != null && (res[st] == null || pr < res[st])) res[st] = pr; };
    const k = norm(name);
    if (prices[k]) add(prices[k]);
    else for (const key of Object.keys(prices)) if (foodMatch(name, key)) add(prices[key]);
    return res;
  }

  function groupEl(st, l) {
    const sum = l.reduce((x, y) => x + y.pr, 0);
    const lis = l.map((x) => h('li', { style: 'display:flex;justify-content:space-between;gap:8px;min-height:30px;align-items:center;font-size:15px' },
      h('span', {}, x.it.name), h('span', { class: 'mute' }, money2(x.pr) + (x.alt ? ' · в «' + x.alt[0] + '» ' + money2(x.alt[1]) : ''))));
    return h('div', { style: 'padding:10px 0;border-top:1px solid var(--line)' },
      h('div', { style: 'display:flex;justify-content:space-between;gap:8px;font-weight:700' }, h('span', {}, '🛒 ' + st), h('span', { class: 'gold-t' }, l.length + ' поз. · ' + money2(sum))),
      h('ul', { style: 'list-style:none;margin:6px 0 0;padding:0' }, ...lis));
  }

  function card() {
    const items = X.shoppingItems(); const dn = state.shopDone || {};
    const open = items.filter((i) => !dn[i.key]);
    if (!open.length) return null;
    const prices = latestPrices();
    const groups = new Map(); const unknown = [];
    for (const it of open) {
      const sp = storePricesFor(it.name, prices); const stores = Object.entries(sp);
      if (!stores.length) { unknown.push(it); continue; }
      stores.sort((a, b) => a[1] - b[1]);
      const [st, pr] = stores[0]; const alt = stores[1];
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st).push({ it, pr, alt });
    }
    if (!groups.size) return h('div', { class: 'card', style: 'margin-bottom:16px' }, h('div', { class: 'tag' }, 'Де купити вигідніше'),
      h('p', { class: 'mute', style: 'margin:8px 0 0' }, 'Поки немає цін у чеках для цих продуктів. Збережіть кілька чеків із різних магазинів на вкладці «Чек», і тут зʼявиться порівняння.'));
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const total = sorted.reduce((s, [, l]) => s + l.reduce((x, y) => x + y.pr, 0), 0);
    return h('div', { class: 'card', style: 'margin-bottom:16px' }, h('div', { class: 'tag' }, 'Де купити вигідніше'),
      h('p', { class: 'mute', style: 'margin:8px 0 6px' }, 'За останніми цінами з ваших чеків. Орієнтовно: ' + money2(total) + (unknown.length ? ' (ще ' + unknown.length + ' без ціни)' : '') + '.'),
      ...sorted.map(([st, l]) => groupEl(st, l)),
      unknown.length ? h('div', { style: 'padding:10px 0 0;border-top:1px solid var(--line)' }, h('div', { class: 'mute' }, 'Без цін у чеках: ' + unknown.map((i) => i.name).join(', '))) : null);
  }

  const orig = VIEWS.shop;
  VIEWS.shop = () => { const out = orig(); const c = card(); if (c) out.splice(2, 0, c); return out; };
})();
