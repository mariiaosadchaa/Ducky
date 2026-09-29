'use strict';
// Ducky · додаткові можливості: профіль, графіки, штрихкод, сповіщення, автоменю, фото чека (ШІ), рецепти від ШІ, PWA.
// Працює поверх app.js (спільні глобальні змінні: state, user, h, render, save, VIEWS, TABS ...).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
    return e;
  }
  const list = (s) => String(s || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const words = (s) => list(s).map(norm);
  const TECH = APPLIANCES.filter((a) => a && a !== 'Інше');

  // ---------- профіль ----------
  function profile() {
    const p = state.profile || (state.profile = {});
    if (!p.servings) p.servings = 2;
    if (!Array.isArray(p.appliances)) p.appliances = [];
    return p;
  }

  function viewProfile() {
    const p = profile();
    const set = (k, v) => { p[k] = v; save(); };
    const text = (label, k, ph) => h('label', {}, label, h('input', { value: p[k] || '', placeholder: ph || '', oninput: (e) => set(k, e.target.value) }));
    const techBox = h('div', { class: 'checks' }, TECH.map((t) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: p.appliances.includes(t) ? true : null, onchange: (e) => {
        p.appliances = e.target.checked ? [...new Set([...p.appliances, t])] : p.appliances.filter((x) => x !== t); save();
      } }), t)));
    const notifyMsg = h('p', { class: 'note', role: 'status' });
    const notifySupported = 'Notification' in window;
    const notify = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.notify ? true : null, disabled: notifySupported ? null : true, onchange: async (e) => {
      if (!e.target.checked) { p.notify = false; save(); notifyMsg.textContent = 'Сповіщення вимкнено.'; return; }
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') { e.target.checked = false; p.notify = false; notifyMsg.textContent = 'Браузер не дозволив сповіщення. Дозвольте їх у налаштуваннях сайту.'; save(); return; }
      p.notify = true; save(); notifyMsg.textContent = 'Готово: попередимо про продукти, що скоро псуються.';
      checkExpiry(true);
    } }), 'Сповіщати, коли продукти скоро псуються');
    const form = h('div', { class: 'card' },
      h('h2', {}, 'Ваш смак і кухня'),
      h('div', { class: 'row', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px' },
        h('label', {}, 'Скільки порцій зазвичай', h('input', { type: 'number', min: '1', max: '12', value: p.servings, oninput: (e) => set('servings', Number(e.target.value) || 2) })),
        h('label', {}, 'Дієта', h('select', { onchange: (e) => set('diet', e.target.value) },
          ['', 'Вегетаріанська', 'Веганська', 'Без глютену', 'Без лактози'].map((d) => h('option', { value: d, selected: (p.diet || '') === d ? true : null }, d || 'Без обмежень'))))),
      h('div', { class: 'tag', style: 'margin-bottom:8px' }, 'Техніка'), techBox,
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:20px' },
        text('Алергії (через кому)', 'allergies', 'арахіс, лактоза'),
        text('Не їмо (через кому)', 'avoid', 'гриби, печінка'),
        text('Любимо (через кому)', 'likes', 'курка, гречка, сир')),
      h('div', { style: 'margin-top:20px' }, notify, notifyMsg));
    const tip = h('div', { class: 'card gold' }, h('h2', {}, 'Навіщо це'),
      h('p', { class: 'mute' }, 'Профіль враховують автоматичне меню та підказки рецептів від ШІ: алергії й «не їмо» виключають страви, техніка обмежує вибір, а «любимо» додає бали.'));
    return [...header('Профіль', 'Ваш', 'ставок'), h('div', { class: 'grid' }, form, h('div', { class: 'stack' }, tip, installCard()))];
  }

  // ---------- графіки витрат ----------
  const weekStart = (iso) => {
    const x = new Date(iso + 'T00:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return localISO(x);
  };
  function weeklyTotals(n) {
    const start = new Date(weekStart(todayISO()) + 'T00:00:00');
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(start); d.setDate(d.getDate() - 7 * i); weeks.push({ from: localISO(d), sum: 0 }); }
    const idx = new Map(weeks.map((w, i) => [w.from, i]));
    for (const r of state.receipts) {
      const i = idx.get(weekStart(r.date || todayISO()));
      if (i != null) weeks[i].sum += receiptSum(r);
    }
    return weeks;
  }
  function ring(value, max) {
    const R = 54; const C = 2 * Math.PI * R;
    const ratio = max > 0 ? Math.min(value / max, 1) : 0;
    const over = max > 0 && value > max;
    return S('svg', { viewBox: '0 0 140 140', class: 'ring', role: 'img', 'aria-label': 'Витрати тижня' },
      S('circle', { cx: 70, cy: 70, r: R, class: 'ring-bg' }),
      S('circle', { cx: 70, cy: 70, r: R, class: 'ring-fg' + (over ? ' over' : ''), 'stroke-dasharray': C.toFixed(1), 'stroke-dashoffset': (C * (1 - ratio)).toFixed(1), transform: 'rotate(-90 70 70)' }),
      S('text', { x: 70, y: 66, class: 'ring-n', 'text-anchor': 'middle' }, max > 0 ? Math.round((value / max) * 100) + '%' : '—'),
      S('text', { x: 70, y: 86, class: 'ring-l', 'text-anchor': 'middle' }, 'бюджету'));
  }
  function bars(items, budget) {
    const W = 560; const H = 220; const padL = 8; const padB = 28; const padT = 16;
    const max = Math.max(1, budget || 0, ...items.map((i) => i.value));
    const bw = (W - padL * 2) / items.length;
    const g = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bars', role: 'img', 'aria-label': 'Витрати по тижнях' });
    items.forEach((it, i) => {
      const hgt = ((H - padB - padT) * it.value) / max;
      const x = padL + i * bw + bw * 0.18; const w = bw * 0.64; const y = H - padB - hgt;
      const bar = S('rect', { x, y, width: w, height: Math.max(hgt, it.value > 0 ? 2 : 0), class: 'bar' + (budget && it.value > budget ? ' over' : ''), rx: 2, style: `--i:${i}` });
      bar.append(S('title', {}, it.label + ': ' + money(it.value)));
      g.append(bar);
      g.append(S('text', { x: x + w / 2, y: H - 9, class: 'bar-l', 'text-anchor': 'middle' }, it.label));
      if (it.value > 0) g.append(S('text', { x: x + w / 2, y: Math.max(y - 5, 10), class: 'bar-v', 'text-anchor': 'middle' }, Math.round(it.value)));
    });
    if (budget) {
      const y = H - padB - ((H - padB - padT) * budget) / max;
      g.append(S('line', { x1: 0, x2: W, y1: y, y2: y, class: 'bud-line' }));
      g.append(S('text', { x: W - 2, y: y - 4, class: 'bud-l', 'text-anchor': 'end' }, 'бюджет ' + Math.round(budget)));
    }
    return g;
  }
  function viewCharts() {
    const budget = effectiveBudget();
    const weeks = weeklyTotals(8);
    const cur = weeks[weeks.length - 1].sum;
    const items = weeks.map((w) => ({ label: w.from.slice(8, 10) + '.' + w.from.slice(5, 7), value: w.sum }));
    const byStore = new Map();
    for (const r of state.receipts) byStore.set(r.store || '—', (byStore.get(r.store || '—') || 0) + receiptSum(r));
    const stores = [...byStore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topMax = stores.length ? stores[0][1] : 1;
    const avg = weeks.filter((w) => w.sum > 0);
    const stats = statsRow([['Цього тижня', Math.round(cur), ' ₴'], ['Бюджет тижня', Math.round(budget), ' ₴'],
      ['Середнє за тиждень', avg.length ? Math.round(avg.reduce((s, w) => s + w.sum, 0) / avg.length) : 0, ' ₴']]);
    const empty = !state.receipts.length;
    const left = budget ? budget - cur : null;
    return [...header('Графіки', 'Куди йдуть', 'гроші'), stats,
      h('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr) minmax(0,2fr)' },
        h('div', { class: 'card ringcard' }, h('h2', {}, 'Тиждень'), ring(cur, budget),
          h('p', { class: left != null && left < 0 ? 'warn' : 'mute', style: 'text-align:center;margin:8px 0 0' },
            left == null ? 'Вкажіть бюджет у меню, щоб бачити залишок.' : left >= 0 ? 'Залишилось ' + money(left) : 'Перевищено на ' + money(-left))),
        h('div', { class: 'card' }, h('h2', {}, 'Останні 8 тижнів'), empty ? h('p', { class: 'empty' }, 'Додайте чеки, і тут з\'являться стовпчики.') : bars(items, budget))),
      h('div', { class: 'card', style: 'margin-top:28px' }, h('h2', {}, 'По магазинах'),
        stores.length ? stores.map(([n, v], i) => h('div', { class: 'hbar' },
          h('span', { class: 'hb-n' }, n), h('span', { class: 'hb-t' }, h('span', { class: 'hb-f', style: `width:${Math.max(3, (v / topMax) * 100)}%;--i:${i}` })), h('span', { class: 'gold-t' }, money(v))))
          : h('p', { class: 'empty' }, 'Поки немає чеків.')),
      h('p', { class: 'note' }, 'Розрахунок лише за вашими чеками. Тиждень рахується з понеділка.')];
  }

  // ---------- модальне вікно ----------
  function openModal(title, body, onClose) {
    const prev = document.activeElement;
    const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); if (onClose) onClose(); if (prev && prev.focus) prev.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const ov = h('div', { class: 'modal-ov', onclick: (e) => { if (e.target === ov) close(); } },
      h('div', { class: 'modal card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'modal-h' }, h('h2', {}, title), h('button', { class: 'link', type: 'button', onclick: close }, 'Закрити')), body));
    document.body.append(ov);
    document.addEventListener('keydown', onKey);
    const first = ov.querySelector('input,button'); if (first) first.focus();
    return close;
  }

  // ---------- штрихкод ----------
  async function lookupBarcode(code) {
    const known = (state.barcodes || {})[code];
    if (known) return { ...known, source: 'ваша комора' };
    try {
      const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=product_name,product_name_uk,brands,quantity');
      if (!r.ok) return null;
      const j = await r.json();
      if (j.status !== 1 || !j.product) return null;
      const p = j.product;
      const name = [p.product_name_uk || p.product_name, p.brands && String(p.brands).split(',')[0]].filter(Boolean).join(' · ');
      return name ? { name, qty: p.quantity || '', source: 'Open Food Facts' } : null;
    } catch (e) { return null; }
  }

  function scanBarcode() {
    let stream = null; let stopped = false; let closeFn = null;
    const stop = () => { stopped = true; if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    const msg = h('p', { class: 'note', role: 'status' });
    const box = h('div', {});
    const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
    const manual = h('input', { inputmode: 'numeric', placeholder: 'Наприклад 4820000000000', 'aria-label': 'Штрихкод' });
    const supported = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    async function handle(code) {
      code = String(code).replace(/\D/g, '');
      if (code.length < 8) { msg.textContent = 'Штрихкод має містити щонайменше 8 цифр.'; return; }
      stop(); video.hidden = true;
      msg.textContent = 'Шукаємо ' + code + '…';
      const info = await lookupBarcode(code);
      msg.textContent = info ? 'Знайдено (' + info.source + '). Перевірте й додайте.' : 'У базі немає такого товару. Введіть назву, ми запам\'ятаємо її.';
      const f = { name: info ? info.name : '', qty: info ? info.qty : '', store: '', price: '', exp: '' };
      const inp = (label, k, attrs = {}) => h('label', {}, label, h('input', { value: f[k], ...attrs, oninput: (e) => { f[k] = e.target.value; } }));
      box.replaceChildren(h('div', { class: 'row', style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' },
        h('div', { style: 'grid-column:1/-1' }, inp('Продукт', 'name', { required: true })),
        inp('Кількість', 'qty'), inp('Магазин', 'store'),
        inp('Ціна, ₴', 'price', { type: 'number', min: '0', step: '0.01' }), inp('Придатний до', 'exp', { type: 'date' })),
        h('button', { class: 'primary', type: 'button', style: 'margin-top:16px', onclick: () => {
          if (!f.name.trim()) { msg.textContent = 'Вкажіть назву продукту.'; return; }
          state.products.push({ id: uid(), name: f.name.trim(), qty: f.qty.trim(), store: f.store.trim(),
            price: f.price === '' ? null : Number(f.price), bought: todayISO(), exp: f.exp || null });
          (state.barcodes ||= {})[code] = { name: f.name.trim(), qty: f.qty.trim() };
          save(); closeFn(); render();
        } }, 'Додати в комору'));
    }

    const content = h('div', {},
      supported ? video : h('p', { class: 'note' }, 'Цей браузер не вміє читати штрихкоди з камери. Введіть цифри вручну (працює в Chrome на Android та десктопі).'),
      box,
      h('div', { class: 'row', style: 'display:flex;gap:8px;margin-top:12px;align-items:flex-end' },
        h('label', { style: 'flex:1' }, 'Або введіть код вручну', manual),
        h('button', { class: 'ghost', type: 'button', onclick: () => handle(manual.value) }, 'Знайти')),
      msg);
    closeFn = openModal('Сканування штрихкоду', content, stop);
    if (!supported) return;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) { stop(); return; }
        video.srcObject = stream; await video.play();
        const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        msg.textContent = 'Наведіть камеру на штрихкод.';
        const loop = async () => {
          if (stopped) return;
          try { const r = await det.detect(video); if (r && r.length) { handle(r[0].rawValue); return; } } catch (e) { /* наступна спроба */ }
          setTimeout(loop, 350);
        };
        loop();
      } catch (e) { msg.textContent = 'Немає доступу до камери. Введіть код вручну.'; }
    })();
  }

  // ---------- сповіщення про терміни ----------
  function notifyNow(title, body) {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'ducky-expiry' }));
      } else new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch (e) { /* ігноруємо */ }
  }
  function checkExpiry(force) {
    if (!state || !user || !state.profile || !state.profile.notify) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const today = todayISO();
    const notified = state.notified || (state.notified = {});
    const soon = state.products.filter((p) => { const d = daysLeft(p.exp); return d !== null && d <= 2 && (force || notified[p.id] !== today); });
    if (!soon.length) return;
    for (const p of soon) notified[p.id] = today;
    for (const k of Object.keys(notified)) if (!state.products.some((p) => p.id === k)) delete notified[k];
    const names = soon.slice(0, 4).map((p) => p.name).join(', ') + (soon.length > 4 ? ' та ще ' + (soon.length - 4) : '');
    notifyNow('Ducky: скоро зіпсується', names);
    save();
  }

  // ---------- автоматичне меню ----------
  function eligibleRecipes() {
    const p = profile();
    const ban = [...words(p.allergies), ...words(p.avoid)];
    return state.recipes.filter((r) => {
      if (ban.length && r.ings.some((i) => ban.some((b) => norm(i).includes(b)))) return false;
      if (p.appliances.length && r.tech && r.tech !== 'Плита' && !p.appliances.includes(r.tech)) return false;
      return true;
    });
  }
  function autoMenu(opts) {
    const o = { overwrite: false, meals: ['l', 'd'], ...(opts || {}) };
    const pool = eligibleRecipes();
    if (!pool.length) return { filled: 0, reason: state.recipes.length ? 'Усі рецепти виключені профілем (алергії, техніка).' : 'Спершу додайте рецепти.' };
    const p = profile();
    const likes = words(p.likes);
    const have = pantryNames();
    const soonSet = new Set(state.products.filter((x) => { const d = daysLeft(x.exp); return d !== null && d <= 4; }).map((x) => norm(x.name)));
    const prices = latestPrices();
    const budget = effectiveBudget();
    const byTitle = new Map(state.recipes.map((r) => [norm(r.title), r]));
    if (o.overwrite) for (const k of Object.keys(state.menu)) if (o.meals.includes(k.split('-')[1])) delete state.menu[k];
    const used = new Map(); const need = new Map();
    const addNeed = (r) => { for (const i of r.ings) if (!have.has(norm(i))) need.set(norm(i), i); };
    for (const v of Object.values(state.menu)) { const r = byTitle.get(norm(v)); if (r) { used.set(r.id, (used.get(r.id) || 0) + 1); addNeed(r); } }
    const priceOf = (n) => lastKnownPrice(n, prices);
    let cost = [...need.values()].reduce((s, n) => s + (priceOf(n) || 0), 0);
    let filled = 0; let prev = null;
    for (let di = 0; di < 7; di++) {
      for (const mk of ['b', 'l', 'd']) {
        if (!o.meals.includes(mk)) continue;
        const key = di + '-' + mk;
        if (state.menu[key]) { prev = byTitle.get(norm(state.menu[key])) || prev; continue; }
        let best = null; let bestScore = Infinity;
        for (const r of pool) {
          const fresh = r.ings.filter((i) => !have.has(norm(i)) && !need.has(norm(i)));
          const addCost = fresh.reduce((s, n) => s + (priceOf(n) || 0), 0);
          let sc = fresh.length * 10 + (used.get(r.id) || 0) * 15;
          sc -= r.ings.filter((i) => soonSet.has(norm(i))).length * 6;
          sc -= r.ings.filter((i) => likes.some((l) => norm(i).includes(l))).length * 3;
          if (r.meal && r.meal !== mk) sc += 20;
          if (prev && prev.id === r.id) sc += 30;
          if (budget && cost + addCost > budget) sc += 25;
          if (sc < bestScore) { bestScore = sc; best = r; }
        }
        if (!best) continue;
        state.menu[key] = best.title;
        used.set(best.id, (used.get(best.id) || 0) + 1);
        const fresh = best.ings.filter((i) => !have.has(norm(i)) && !need.has(norm(i)));
        cost += fresh.reduce((s, n) => s + (priceOf(n) || 0), 0);
        addNeed(best); prev = best; filled++;
      }
    }
    return { filled, cost, over: budget && cost > budget ? cost - budget : 0 };
  }

  function menuToolbar() {
    const o = { overwrite: false, meals: ['l', 'd'] };
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:12px 0 0' });
    const meal = (mk, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.meals.includes(mk) ? true : null, onchange: (e) => {
      o.meals = e.target.checked ? [...new Set([...o.meals, mk])] : o.meals.filter((x) => x !== mk);
    } }), label);
    return h('div', { class: 'card', style: 'margin-bottom:20px' },
      h('div', { class: 'tag' }, 'Автоменю'),
      h('div', { class: 'toolbar' }, MEALS.map(([mk, ml]) => meal(mk, ml)),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { o.overwrite = e.target.checked; } }), 'Замінити заповнене'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          if (!o.meals.length) { msg.textContent = 'Оберіть хоча б один прийом їжі.'; return; }
          const res = autoMenu(o);
          if (!res.filled) { msg.textContent = res.reason || 'Немає вільних клітинок для заповнення.'; return; }
          save(); render();
          const m = document.querySelector('#autoMenuMsg');
          if (m) m.textContent = 'Заповнено ' + res.filled + ' страв. ' + (res.over ? 'Докупівля перевищує бюджет на ' + money(res.over) + '.' : '');
        } }, 'Скласти меню')),
      msg, h('p', { id: 'autoMenuMsg', class: 'note', role: 'status', style: 'margin:6px 0 0' }),
      h('p', { class: 'note', style: 'margin:6px 0 0' }, 'Спершу беруться страви, для яких майже все вже є вдома, з урахуванням продуктів, що псуються, профілю та бюджету.'));
  }

  // ---------- виклики ШІ ----------
  async function callApi(path, body) {
    if (!remote) throw new Error('ШІ працює після входу через обліковий запис на опублікованому сайті.');
    if (location.protocol === 'file:') throw new Error('ШІ доступний лише на опублікованому сайті, не з файлу.');
    const { data } = await sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) throw new Error('Потрібно увійти.');
    let r;
    try { r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Немає зв\'язку з сервером.'); }
    let j = null; try { j = await r.json(); } catch (e) { /* не JSON */ }
    if (!r.ok) throw new Error((j && j.error) || (r.status === 404 ? 'ШІ ще не підключено на сервері (немає /api).' : 'Помилка сервера ' + r.status));
    return j;
  }
  async function downscale(file, max) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Не вдалося прочитати фото.')); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82).split(',')[1];
    } finally { URL.revokeObjectURL(url); }
  }
  const readB64 = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('Не вдалося прочитати файл.'));
    fr.readAsDataURL(file);
  });
  async function scanReceipt(file) {
    if (file.type === 'application/pdf') {
      if (file.size > 2900000) throw new Error('PDF завеликий (понад 2,9 МБ). Зробіть скріншот чека.');
      return callApi('/api/scan-receipt', { image: await readB64(file), mediaType: 'application/pdf' });
    }
    const image = await downscale(file, 1500);
    return callApi('/api/scan-receipt', { image, mediaType: 'image/jpeg' });
  }
  function suggestRecipes(count) {
    const p = profile();
    return callApi('/api/suggest-recipes', {
      pantry: state.products.map((x) => x.name),
      expiring: state.products.filter((x) => { const d = daysLeft(x.exp); return d !== null && d <= 3; }).map((x) => x.name),
      appliances: p.appliances, allergies: list(p.allergies), avoid: list(p.avoid), likes: list(p.likes), diet: p.diet || '',
      servings: p.servings, count: count || 3,
    });
  }

  function toast(text) {
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), 5000);
  }
  function saveDraft() {
    const store = draft.store.trim();
    const items = draft.lines.filter((l) => l.name.trim()).map((l) => ({
      name: l.name.trim(), qty: String(l.qty || '').trim(), price: l.price === '' ? null : Number(l.price), exp: l.exp || null }));
    if (!store || !items.length) return false;
    state.receipts.push({ id: uid(), store, date: draft.date || todayISO(), items });
    for (const it of items) state.products.push({ id: uid(), name: it.name, qty: it.qty, store, price: it.price, bought: draft.date, exp: it.exp });
    draft = { store: '', date: todayISO(), lines: [{ name: '', qty: '', price: '', exp: '' }] };
    state.tab = 'pantry'; save(); render();
    return items.length;
  }
  let receiptUI = null;   // поточний блок на екрані «Скан чека»
  async function processReceipt(file) {
    const ui = receiptUI;
    if (!file || !ui) return;
    if (!(/^image\//.test(file.type) || file.type === 'application/pdf')) { ui.msg('Підходить фото, скріншот або PDF.'); return; }
    ui.busy(true); ui.msg('Розпізнаємо чек… це займає до 20 секунд.');
    try {
      const res = await scanReceipt(file);
      draft = { store: res.store || '', date: res.date || todayISO(),
        lines: res.items.map((i) => ({ name: i.name, qty: i.qty || '', price: i.price == null ? '' : String(i.price), exp: '' })) };
      if (profile().autoSaveReceipt && draft.store.trim()) {
        const n = saveDraft();
        if (n) { toast('Чек додано в комору: ' + n + ' позицій. Перевірте їх у списку.'); return; }
      }
      render();
      const m = document.querySelector('#receiptMsg');
      if (m) m.textContent = 'Розпізнано позицій: ' + res.items.length + '. ' + (draft.store ? '' : 'Вкажіть магазин. ') + 'Перевірте назви й ціни перед збереженням.';
    } catch (err) { ui.msg(err.message); ui.busy(false); }
  }
  document.addEventListener('paste', (e) => {
    if (!user || !state || state.tab !== 'scan' || !e.clipboardData) return;
    const f = [...e.clipboardData.files].find((x) => /^image\//.test(x.type) || x.type === 'application/pdf');
    if (f) { e.preventDefault(); processReceipt(f); }
  });
  ['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (state && state.tab === 'scan') e.preventDefault(); }));

  function receiptPhotoBlock() {
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:8px 0 0' });
    const input = h('input', { type: 'file', accept: 'image/*,application/pdf', hidden: true, onchange: (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = '';
      processReceipt(f);
    } });
    const zone = h('div', { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Додати фото, скріншот або PDF чека',
      onclick: () => input.click(),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
      ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
      ondragleave: () => zone.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); zone.classList.remove('over'); processReceipt(e.dataTransfer && e.dataTransfer.files[0]); } },
      h('div', { class: 'dz-t' }, 'Додайте чек: ШІ розпізнає й впише все сам'),
      h('div', { class: 'mute dz-s' }, 'Перетягніть сюди фото, скріншот чи PDF, натисніть щоб обрати файл, або вставте скріншот через Ctrl+V.'));
    receiptUI = { msg: (t) => { msg.textContent = t; }, busy: (b) => { zone.classList.toggle('busy', b); } };
    const auto = h('label', { class: 'check', style: 'margin-top:12px' },
      h('input', { type: 'checkbox', checked: profile().autoSaveReceipt ? true : null, onchange: (e) => { profile().autoSaveReceipt = e.target.checked; save(); } }),
      'Одразу зберігати в комору без перевірки');
    return h('div', { class: 'photo-block' }, input, zone, auto, msg,
      h('p', { id: 'receiptMsg', class: 'note', role: 'status', style: 'margin:8px 0 0' }));
  }

  function aiRecipesCard() {
    const out = h('div', { class: 'cards', style: 'margin-top:16px' });
    const msg = h('p', { class: 'note', role: 'status', style: 'margin:12px 0 0' });
    const btn = h('button', { class: 'primary', type: 'button', onclick: async () => {
      if (!state.products.length) { msg.textContent = 'Спершу додайте продукти в комору.'; return; }
      btn.disabled = true; msg.textContent = 'Качка думає над рецептами…'; out.replaceChildren();
      try {
        const res = await suggestRecipes(3);
        msg.textContent = 'Ось що можна приготувати. Збережіть те, що сподобалось.';
        out.replaceChildren(...res.recipes.map((r) => {
          const have = pantryNames();
          const buy = r.ings.filter((i) => !have.has(norm(i)));
          const saved = h('span', { class: 'mute' });
          return h('div', { class: 'card' },
            h('div', { class: 'tag' }, r.tech || 'Від ШІ'), h('h3', {}, r.title),
            h('div', { class: 'mute' }, [r.minutes && r.minutes + ' хв', r.servings && r.servings + ' порц.'].filter(Boolean).join(' · ') || ' '),
            h('div', { class: 'kv' }, h('span', { class: 'mute' }, 'Докупити'), h('span', {}, buy.length ? buy.join(', ') : 'нічого')),
            r.steps.length ? h('details', { class: 'steps' }, h('summary', {}, 'Приготування'), h('ol', {}, r.steps.map((t) => h('li', {}, t)))) : null,
            h('button', { class: 'ghost', type: 'button', onclick: (e) => {
              state.recipes.push({ id: uid(), title: r.title, tech: r.tech, minutes: r.minutes, servings: r.servings, ings: r.ings, steps: r.steps });
              save(); e.target.disabled = true; saved.textContent = 'Збережено'; render();
            } }, 'Зберегти'), saved);
        }));
      } catch (e) { msg.textContent = e.message; }
      btn.disabled = false;
    } }, 'Запропонувати рецепти від ШІ');
    return h('div', { class: 'card gold', style: 'margin-bottom:28px' }, h('div', { class: 'tag' }, 'Ідеї від ШІ'),
      h('p', { class: 'mute', style: 'margin:8px 0 16px' }, 'З продуктів у коморі, з урахуванням профілю: техніки, алергій і того, що скоро псується.'),
      btn, msg, out);
  }

  // ---------- PWA: встановлення ----------
  let deferredInstall = null;
  const $install = document.getElementById('installBtn');
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if ($install && !isStandalone()) $install.hidden = false; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; if ($install) $install.hidden = true; });
  async function doInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) { /* ігноруємо */ }
    deferredInstall = null; if ($install) $install.hidden = true;
  }
  if ($install) $install.addEventListener('click', doInstall);
  function installCard() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return h('div', { class: 'card' }, h('h2', {}, 'Застосунок на телефоні'),
      isStandalone() ? h('p', { class: 'mute' }, 'Ducky вже встановлено на цьому пристрої.')
        : deferredInstall ? [h('p', { class: 'mute' }, 'Додайте Ducky на головний екран, і він відкриватиметься як звичайний застосунок.'), h('button', { class: 'ghost', type: 'button', onclick: doInstall }, 'Встановити')]
          : h('p', { class: 'mute' }, ios ? 'На iPhone: натисніть «Поділитися» в Safari, потім «На екран Додому».' : 'У Chrome відкрийте меню ⋮ і виберіть «Встановити застосунок» або «Додати на головний екран».'));
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-режим необов'язковий */ }); });
  }

  // ---------- підключення до app.js ----------
  TABS.push(['charts', 'Графіки'], ['profile', 'Профіль']);
  VIEWS.charts = viewCharts;
  VIEWS.profile = viewProfile;

  const origPantry = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = origPantry();
    const bar = h('div', { class: 'card toolbar-card', style: 'margin-bottom:24px' },
      h('div', { class: 'toolbar' },
        h('button', { class: 'ghost', type: 'button', onclick: scanBarcode }, 'Сканувати штрихкод'),
        h('span', { class: 'mute' }, 'Наведіть камеру на штрихкод: назва підставиться сама, ціну й термін ви впишете.')));
    out.splice(3, 0, bar);
    return out;
  };
  const origScan = VIEWS.scan;
  VIEWS.scan = () => {
    const out = origScan();
    const grid = out[out.length - 1];
    const card = grid && grid.firstChild;
    if (card) card.prepend(receiptPhotoBlock());
    return out;
  };
  const origRecipes = VIEWS.recipes;
  VIEWS.recipes = () => { const out = origRecipes(); out.splice(3, 0, aiRecipesCard()); return out; };
  const origMenu = VIEWS.menu;
  VIEWS.menu = () => { const out = origMenu(); out.splice(2, 0, menuToolbar()); return out; };

  setInterval(() => checkExpiry(false), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(false); });

  window.DuckyExtras = { autoMenu, scanBarcode, scanReceipt, suggestRecipes, checkExpiry, weeklyTotals, eligibleRecipes };
  render();   // перемальовуємо: з'явились нові вкладки
})();
