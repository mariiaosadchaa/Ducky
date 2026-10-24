// Ducky: розклад по годинах. Чисте ядро (без DOM) + екран «Сьогодні по годинах».
// Вхід: вільні вікна по днях тижня, справи з планувальника, готування з меню, похід у магазин.
// Вихід: блоки з точним часом початку й кінця. Нічого не вигадується: час береться з вікон користувача,
// тривалість — з рецепта чи справи (якщо рецепт без хвилин, показуємо оцінку з позначкою «~»).
(function (root) {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? Math.min(24 * 60, +m[1] * 60 + +m[2]) : null; };
  const fmt = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const BUF = 5;            // пауза між блоками, хв
  const MIN_SLOT = 5;
  const PART = { morning: [0, 12 * 60], day: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] };
  const DEFAULT_COOK = 30;  // оцінка, якщо у рецепта немає хвилин
  const SHOP_MIN = 45;

  const DEFAULT_WIN = {
    work: [{ s: '07:00', e: '08:30' }, { s: '18:30', e: '22:00' }],   // пн–пт
    rest: [{ s: '09:00', e: '13:00' }, { s: '15:00', e: '21:00' }],   // сб–нд
  };
  const DEFAULT_MEALS = { b: '08:00', l: '13:00', d: '19:00' };

  // вікна дня у хвилинах: [[start,end],…], відсортовані й злиті
  function windowsOf(win, wd) {
    let raw = win && Array.isArray(win[wd]) ? win[wd] : (wd < 5 ? DEFAULT_WIN.work : DEFAULT_WIN.rest);
    const list = raw.map((w) => [toMin(w.s), toMin(w.e)]).filter((w) => w[0] != null && w[1] != null && w[1] - w[0] >= MIN_SLOT).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const w of list) { const last = out[out.length - 1]; if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]); else out.push([w[0], w[1]]); }
    return out;
  }
  const totalOf = (wins) => wins.reduce((s, w) => s + (w[1] - w[0]), 0);

  // вільні проміжки: масив [s,e]; carve вирізає зайняте
  function carve(free, s, e) {
    const out = [];
    for (const w of free) {
      if (e <= w[0] || s >= w[1]) { out.push(w); continue; }
      if (s > w[0]) out.push([w[0], s]);
      if (e < w[1]) out.push([e, w[1]]);
    }
    return out;
  }
  // найраніший проміжок на dur хв, починаючи не раніше from (і в межах вікна prefer, якщо вдасться)
  function firstFit(free, dur, from, prefer, limit) {
    const tryIn = (lo, hi) => {
      for (const w of free) {
        const s = Math.max(w[0], from == null ? 0 : from, lo == null ? 0 : lo); const e = Math.min(w[1], hi == null ? 1e9 : hi, limit == null ? 1e9 : limit);
        if (e - s >= dur) return s;
      }
      return null;
    };
    if (prefer) { const s = tryIn(prefer[0], prefer[1]); if (s != null) return s; }
    return tryIn(null, null);
  }
  // найпізніший проміжок, що закінчується не пізніше deadline
  function lastFit(free, dur, deadline) {
    for (let i = free.length - 1; i >= 0; i--) {
      const w = free[i]; const end = Math.min(w[1], deadline);
      if (end - dur >= w[0]) return end - dur;
    }
    return null;
  }

  // Готування з меню на дату: [{meal, title, at, minutes, active, est, tech}]
  function cooksOf(menu, recipes, meals, wd, shortTech) {
    const out = [];
    for (const mk of ['b', 'l', 'd']) {
      const title = String((menu && menu[wd + '-' + mk]) || '').trim();
      if (!title) continue;
      const r = (recipes || []).find((x) => String(x.title || '').trim().toLowerCase() === title.toLowerCase());
      const known = !!(r && Number(r.minutes) > 0);
      const minutes = known ? Number(r.minutes) : DEFAULT_COOK;
      const tech = r && r.tech ? String(r.tech) : '';
      const passive = shortTech && shortTech.test(tech);       // мультиварка/хлібопічка: поруч треба бути лише на старті
      const at = toMin((meals && meals[mk]) || DEFAULT_MEALS[mk]);
      out.push({ meal: mk, title, at, minutes, active: passive ? Math.min(15, minutes) : minutes, est: !known, tech });
    }
    return out;
  }

  // Розклад одного дня.
  // in: { wins, cooks, shop, items, now (хв від півночі, лише для сьогодні) }
  // items: [{key,type,title,minutes,must,overdue,prio,...}] у порядку, який дав планувальник
  function scheduleDay(inp) {
    const now = inp.now == null ? null : inp.now;
    let free = inp.wins.map((w) => [w[0], w[1]]);
    const blocks = []; const unplaced = [];
    const put = (b) => { blocks.push(b); free = carve(free, b.start - 0, b.end + BUF); };

    // 1. готування: фіксований час їжі, ставимо якнайпізніше до нього
    for (const c of (inp.cooks || []).slice().sort((a, b) => a.at - b.at)) {
      if (now != null && c.at < now - 15) continue;                  // страва вже мала бути готова
      const tail = c.minutes - c.active;                            // скільки техніка готує сама
      const deadline = c.at - tail;
      const area = now != null ? carve(free, 0, now) : free;
      let s = lastFit(area, c.active, deadline); let late = false;
      if (s == null) { s = firstFit(area, c.active, now); late = s != null; }
      if (s == null) { unplaced.push({ kind: 'cook', title: c.title, minutes: c.active, reason: 'немає вільного вікна' }); continue; }
      put({ kind: 'cook', key: 'cook:' + c.meal, title: c.title, start: s, end: s + c.active, meal: c.meal, mealAt: c.at, est: c.est, late: late || s + c.minutes > c.at, passive: tail > 0, readyAt: s + c.minutes, ahead: c.at - (s + c.minutes) > 120 });
    }
    // 2. магазин
    if (inp.shop) {
      const area = now != null ? carve(free, 0, now) : free;
      const s = firstFit(area, inp.shop.minutes, null, [16 * 60, 20 * 60 + 30]);
      if (s == null) unplaced.push({ kind: 'shop', title: 'Магазин', minutes: inp.shop.minutes, reason: 'немає вільного вікна' });
      else put({ kind: 'shop', key: 'shop', title: 'Магазин', start: s, end: s + inp.shop.minutes, count: inp.shop.count });
    }
    // 3. справи й задачі: у порядку планувальника (пил → пилосос → підлога), послідовно, без стрибків назад
    let cursor = now != null ? now : 0;
    const area0 = now != null ? carve(free, 0, now) : free;
    free = area0;
    // 2б. власний список на день: спершу з терміном «до» (за зростанням), далі без терміну, у порядку списку
    const mine = (inp.mine || []).filter((x) => !x.done).map((x, i) => ({ ...x, ord: x.order != null ? x.order : i + 0.5 }))
      .sort((a, b) => (a.by == null) - (b.by == null) || ((a.by || 0) - (b.by || 0)) || a.ord - b.ord);
    for (const m of mine) {
      const dur = Math.max(5, Math.round(Number(m.minutes) || 20));
      const s = firstFit(free, dur, null, PART[m.pref] || null, m.by);
      if (s == null) { unplaced.push({ kind: 'my', key: 'my:' + m.id, title: m.title, minutes: dur, by: m.by, mine: m, reason: m.by != null ? 'не встигаю до ' + fmt(m.by) : 'не вмістилось у вільні години' }); continue; }
      put({ kind: 'my', key: 'my:' + m.id, title: m.title, start: s, end: s + dur, by: m.by, mine: m });
    }
    // Пріоритет справ: 1 призначене на цей день уручну (додане сьогодні, з терміном на сьогодні, закріплене), 2 обовʼязкове й важливе,
    // 3 звичайне, 4 перенесене з минулого. Усередині групи лишається порядок планувальника (кімнати, пил → підлога).
    const rank = (it) => {
      if (it.pinned || (it.type === 'task' && inp.date && (it.added === inp.date || it.due === inp.date))) return 1;
      if (it.must || it.prio === 'high') return 2;
      if (it.overdue) return 4;
      return 3;
    };
    const ordered = (inp.items || []).map((it, i) => ({ it, i, r: rank(it) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it);
    for (const it of ordered) {
      const dur = Math.max(5, Math.round(Number(it.minutes) || 15));
      let s = firstFit(free, dur, cursor);
      if (s == null) s = firstFit(free, dur, null);            // дірка раніше курсора
      if (s == null) { unplaced.push({ kind: it.type === 'task' ? 'task' : 'chore', key: it.key, title: it.title, minutes: dur, item: it, reason: 'не вмістилось у вільні години' }); continue; }
      put({ kind: it.type === 'task' ? 'task' : 'chore', key: it.key, title: it.title, start: s, end: s + dur, item: it });
      cursor = s + dur + BUF;
    }
    blocks.sort((a, b) => a.start - b.start);
    return { blocks, unplaced, free, windows: inp.wins, freeTotal: totalOf(inp.wins), busy: blocks.reduce((s, b) => s + (b.end - b.start), 0) };
  }

  // Ємність дня для планувальника справ: вільні хвилини мінус готування й магазин
  function capacityOf(wins, cooks, shopHere) {
    let cap = totalOf(wins);
    for (const c of cooks || []) cap -= c.active + BUF;
    if (shopHere) cap -= SHOP_MIN + BUF;
    return Math.max(15, cap);
  }

  root.DuckyDay = { toMin, fmt, windowsOf, totalOf, cooksOf, scheduleDay, capacityOf, DEFAULT_WIN, DEFAULT_MEALS, DEFAULT_COOK, SHOP_MIN, BUF };
})(typeof window !== 'undefined' ? window : globalThis);

// ---------- Екран «Сьогодні по годинах» (лише в браузері) ----------
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.DuckyHomeAPI || typeof VIEWS === 'undefined') return;
  const D = window.DuckyDay; const A = window.DuckyHomeAPI; const P = A.P; const X = window.DuckyExtras;
  const TECH = /мультивар|хлібопіч/i;
  const WDN = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
  const LIST_KEY = 'ducky.todayList';
  const AI_KEY = 'ducky.aiPlan';
  let selDate = null;

  const personKey = (p) => p || A.meName() || (user && user.name) || 'me';
  const winOf = (hm, p) => { const all = hm.win && typeof hm.win === 'object' ? hm.win : {}; return all[personKey(p)] || null; };
  // вільні вікна на конкретну дату: окреме налаштування на дату (hm.winOn) або шаблон дня тижня
  const winsOn = (hm, date, person) => {
    const o = hm.winOn && hm.winOn[personKey(person) + '|' + date]; const wd = P.wdOf(date);
    return Array.isArray(o) ? D.windowsOf({ [wd]: o }, wd) : D.windowsOf(winOf(hm, person), wd);
  };
  const mealsOf = (hm) => ({ ...D.DEFAULT_MEALS, ...(hm.meals || {}) });
  const cooksFor = (hm, wd) => D.cooksOf(state.menu, state.recipes, mealsOf(hm), wd, TECH);

  // планувальник справ дізнається, скільки вільних хвилин у кожного дня
  P.capHook = (hm, today, person) => {
    const cap = {};
    for (let i = 0; i < 28; i++) {
      const date = P.addDays(today, i); const wd = P.wdOf(date);
      cap[date] = D.capacityOf(winsOn(hm, date, person), cooksFor(hm, wd), false);
    }
    return cap;
  };

  // у який із найближчих 3 днів іти в магазин: де найбільше вільного часу
  function shopDate(hm, today) {
    if (!A.openShopCount()) return null;
    let best = null;
    for (let i = 0; i < 3; i++) {
      const date = P.addDays(today, i); const wd = P.wdOf(date);
      const free = D.capacityOf(winsOn(hm, date, null), cooksFor(hm, wd), false);
      if (!best || free > best.free + 30) best = { date, free };
    }
    return best.date;
  }

  function build(date) {
    const hm = A.HM(); const today = A.todayD(); const idx = P.diff(date, today);
    const wd = P.wdOf(date); const wins = winsOn(hm, date, null);
    const plan = P.planWeek(hm, today);
    const src = idx === 0 ? A.todaySnap().items : ((plan.days[idx] || { items: [] }).items);
    const mine = src.filter(A.inView);
    const doneItems = idx === 0 ? mine.filter(A.isDoneNow) : [];
    const open = idx === 0 ? mine.filter((i) => !A.isDoneNow(i)) : mine;
    const nowD = new Date(); const now = idx === 0 ? nowD.getHours() * 60 + nowD.getMinutes() : null;
    const sd = shopDate(hm, today);
    const cnt = A.openShopCount();
    const list = listOf(hm, date);
    const myTasks = list.calc ? list.items.map((x) => ({ id: x.id, title: x.title, minutes: (x.ai && !x.userMin ? x.ai.minutes : x.minutes), done: !!x.done, by: x.by ? D.toMin(x.by) : null, order: x.ai ? x.ai.order : null, pref: x.ai ? x.ai.part : null, note: x.ai ? x.ai.note : '', aiMin: !!(x.ai && !x.userMin) })) : [];
    const r = D.scheduleDay({ wins, cooks: cooksFor(hm, wd), shop: sd === date ? { minutes: D.SHOP_MIN, count: cnt } : null, items: open, mine: myTasks, now, date });
    const myDone = list.items.filter((x) => x.done);
    return { ...r, date, idx, wd, doneItems, myDone, list, now, hasWins: wins.length > 0 };
  }

  const ICON = { cook: '🍲', shop: '🛒', chore: '🧹', task: '✅', my: '📝' };
  // власний список на день: hm.dayList[дата] = { calc, items: [{id,title,minutes,by,done}] }
  function listOf(hm, date) {
    if (!hm.dayList || typeof hm.dayList !== 'object') hm.dayList = {};
    const l = hm.dayList[date];
    return l && Array.isArray(l.items) ? l : { calc: false, items: [] };
  }
  function listRW(hm, date) {
    if (!hm.dayList || typeof hm.dayList !== 'object') hm.dayList = {};
    if (!hm.dayList[date] || !Array.isArray(hm.dayList[date].items)) hm.dayList[date] = { calc: false, items: [] };
    const cut = P.addDays(A.todayD(), -14); for (const d of Object.keys(hm.dayList)) if (d < cut) delete hm.dayList[d];
    return hm.dayList[date];
  }
  // «Подзвонити 15 хв до 14:00» -> назва, хвилини, термін
  function parseTask(text) {
    let t = String(text || '').trim(); let by = null; let minutes = null;
    let m = /\s+до\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:год\.?)?\s*$/i.exec(t) || /\s+до\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:год\.?)?(?=\s)/i.exec(t);
    if (m && +m[1] <= 24) { by = D.fmt(Math.min(24 * 60 - 1, +m[1] * 60 + +(m[2] || 0))); t = t.replace(m[0], ''); }
    m = /\s+(\d{1,3})\s*(?:хвилин[а-яіїєґ]*|хв\.?)(?![а-яіїєґ])/i.exec(t); if (m) { minutes = +m[1]; t = t.replace(m[0], ''); }
    return { title: t.trim(), minutes, by };
  }
  const dur = (m) => (m >= 60 ? Math.floor(m / 60) + ' год' + (m % 60 ? ' ' + (m % 60) + ' хв' : '') : m + ' хв');

  function dayMap(r) {
    const A0 = 6 * 60; const B0 = 24 * 60; const pc = (m) => Math.max(0, Math.min(100, ((m - A0) / (B0 - A0)) * 100));
    const seg = (s, e, cls, title) => h('span', { class: 'dm-seg ' + cls, title: title || null, style: 'left:' + pc(s) + '%;width:' + Math.max(0.8, pc(e) - pc(s)) + '%' });
    const ticks = [6, 9, 12, 15, 18, 21, 24].map((hh) => h('span', { class: 'dm-tick', style: 'left:' + pc(hh * 60) + '%' }, hh === 24 ? '' : String(hh)));
    return h('div', { class: 'dm', role: 'img', 'aria-label': 'Мапа дня: вільні вікна й заплановане' },
      h('div', { class: 'dm-track' }, r.windows.map((w) => seg(w[0], w[1], 'dm-win')), r.blocks.map((b) => seg(b.start, b.end, 'dm-' + b.kind, b.title)),
        r.now != null && r.now >= A0 ? h('span', { class: 'dm-now', style: 'left:' + pc(r.now) + '%' }) : null),
      h('div', { class: 'dm-ticks' }, ticks));
  }

  function goKitchen(tab) { store.set('ducky.mode', 'kitchen'); state.tab = tab; saveLocal(); render(); window.scrollTo(0, 0); }

  function blockRow(b, r) {
    const isNow = r.now != null && r.now >= b.start && r.now < b.end;
    const it = b.item; const today = r.idx === 0;
    const sub = [D.fmt(b.start) + '–' + D.fmt(b.end), dur(b.end - b.start)];
    if (b.kind === 'cook') {
      if (b.passive) sub.push('готово ~' + D.fmt(b.readyAt));
      sub.push((b.meal === 'b' ? 'сніданок' : b.meal === 'l' ? 'обід' : 'вечеря') + ' ' + D.fmt(b.mealAt));
      if (b.est) sub.push('~час за оцінкою');
      if (b.ahead) sub.push('наперед');
      if (b.late) sub.push('не встигаю до часу');
    }
    if (b.kind === 'shop') sub.push(b.count + ' поз.');
    if (b.kind === 'my' && b.by != null) sub.push('до ' + D.fmt(b.by));
    if (b.kind === 'my' && b.mine && b.mine.note) sub.push('ШІ: ' + b.mine.note);
    if (b.kind === 'my' && b.mine && b.mine.aiMin) sub.push('~час за оцінкою ШІ');
    if (it && it.room) { const rn = A.roomName(it.room); if (rn) sub.push(rn); }
    if (it && A.multi() && it.who) sub.push(it.who);
    if (it && (it.must || it.overdue)) sub.push(it.overdue ? 'з минулого' : 'обовʼязково');
    const main = h('div', { class: 'tl-main' }, h('div', { class: 'tl-t' }, ICON[b.kind] + ' ' + b.title), h('div', { class: 'tl-s' }, sub.join(' · ')));
    const right = (b.kind === 'chore' || b.kind === 'task') && it
      ? [today ? h('input', { type: 'checkbox', class: 'tl-chk', 'aria-label': 'Зроблено: ' + b.title, onchange: (e) => { A.tick(it, e.target.checked); render(); } }) : null,
        h('button', { class: 'tl-more', type: 'button', 'aria-label': 'Змінити: ' + b.title, onclick: () => A.itemMenu(it) }, '⋯')]
      : b.kind === 'my' ? [h('input', { type: 'checkbox', class: 'tl-chk', 'aria-label': 'Зроблено: ' + b.title, onchange: (e) => { const hm = A.HM(); const x = listRW(hm, r.date).items.find((y) => y.id === b.mine.id); if (x) { x.done = e.target.checked; save(); render(); } } })]
      : [h('button', { class: 'tl-more', type: 'button', 'aria-label': b.kind === 'shop' ? 'Відкрити покупки' : 'Відкрити меню', onclick: () => goKitchen(b.kind === 'shop' ? 'shop' : 'menu') }, '›')];
    return h('div', { class: 'tl-row tl-' + b.kind + (isNow ? ' now' : '') + (b.late ? ' late' : '') },
      h('div', { class: 'tl-time' }, D.fmt(b.start)), h('div', { class: 'tl-card' }, main, h('div', { class: 'tl-act' }, right)));
  }

  function timeline(r) {
    const out = [];
    const wins = r.windows;
    wins.forEach((w, wi) => {
      if (wi > 0) { const gs = wins[wi - 1][1]; out.push(h('div', { class: 'tl-busy' }, 'Зайнято · ' + D.fmt(gs) + '–' + D.fmt(w[0]))); }
      const inW = r.blocks.filter((b) => b.start >= w[0] && b.start < w[1]);
      const used = inW.reduce((s, b) => s + (b.end - b.start), 0);
      out.push(h('div', { class: 'tl-win' }, D.fmt(w[0]) + '–' + D.fmt(w[1]), h('span', {}, ' · вільно ' + dur(Math.max(0, (w[1] - w[0]) - used)))));
      let cur = r.now != null ? Math.max(w[0], r.now) : w[0];
      inW.forEach((b) => {
        if (b.start - cur >= 20) out.push(h('div', { class: 'tl-gap' }, 'вільно ' + dur(b.start - cur)));
        out.push(blockRow(b, r)); cur = Math.max(cur, b.end);
      });
      if (w[1] - cur >= 20 && w[1] > (r.now == null ? 0 : r.now)) out.push(h('div', { class: 'tl-gap' }, 'вільно ' + dur(w[1] - cur) + ' · до ' + D.fmt(w[1])));
    });
    return out;
  }

  function nextCard(r) {
    if (r.idx !== 0 || r.now == null) return null;
    const cur = r.blocks.find((b) => r.now >= b.start && r.now < b.end);
    const nxt = r.blocks.find((b) => b.start > r.now);
    if (!cur && !nxt) return null;
    return h('div', { class: 'card gold tl-next' },
      cur ? h('div', {}, h('span', { class: 'tag' }, 'Зараз'), h('div', { class: 'tl-nt' }, ICON[cur.kind] + ' ' + cur.title), h('div', { class: 'mute' }, 'до ' + D.fmt(cur.end))) : null,
      nxt ? h('div', { style: cur ? 'margin-top:10px' : '' }, h('span', { class: 'tag' }, 'Далі о ' + D.fmt(nxt.start)), h('div', { class: cur ? 'mute' : 'tl-nt' }, ICON[nxt.kind] + ' ' + nxt.title + (cur ? '' : ' · ' + dur(nxt.end - nxt.start)))) : null);
  }

  function strip(today) {
    const chips = Array.from({ length: 7 }, (_, i) => {
      const date = P.addDays(today, i); const on = (selDate || today) === date;
      const lbl = i === 0 ? 'Сьогодні' : new Date(date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric' });
      return h('button', { class: 'day-chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: () => { selDate = date; render(); } }, lbl);
    });
    return h('div', { class: 'day-strip', role: 'group', 'aria-label': 'День' }, chips);
  }

  // ----- вільні години -----
  function hoursSheet() {
    const hm = A.HM(); const cur = winOf(hm) || {};
    const draft = {}; for (let wd = 0; wd < 7; wd++) draft[wd] = (Array.isArray(cur[wd]) ? cur[wd] : (wd < 5 ? D.DEFAULT_WIN.work : D.DEFAULT_WIN.rest)).map((w) => ({ s: w.s, e: w.e }));
    const meals = { ...mealsOf(hm) };
    let closeFn = null; const box = h('div', { class: 'hrs' });
    const draw = () => {
      box.replaceChildren(
        h('p', { class: 'note', style: 'margin:0 0 12px' }, 'Впиши години, коли ти вдома й вільна: ранок, вечір, вихідні. Справи, готування й похід у магазин складуться саме в ці вікна. Решту часу вважаю зайнятим (робота, дорога).'),
        h('div', { class: 'toolbar', style: 'margin-bottom:10px' },
          h('button', { class: 'ghost', type: 'button', onclick: () => { for (let d = 1; d < 5; d++) draft[d] = draft[0].map((w) => ({ ...w })); draw(); } }, 'Пн → усі будні'),
          h('button', { class: 'ghost', type: 'button', onclick: () => { draft[6] = draft[5].map((w) => ({ ...w })); draw(); } }, 'Сб → Нд')),
        ...WDN.map((nm, wd) => h('div', { class: 'hrs-day' }, h('div', { class: 'tag' }, nm),
          draft[wd].length ? draft[wd].map((w, i) => h('div', { class: 'hrs-row' },
            h('input', { type: 'time', step: '300', value: w.s, 'aria-label': nm + ': початок', onchange: (e) => { w.s = e.target.value; } }), h('span', { class: 'mute' }, '–'),
            h('input', { type: 'time', step: '300', value: w.e, 'aria-label': nm + ': кінець', onchange: (e) => { w.e = e.target.value; } }),
            h('button', { class: 'link', type: 'button', 'aria-label': 'Прибрати вікно', onclick: () => { draft[wd].splice(i, 1); draw(); } }, '✕')))
            : h('p', { class: 'mute', style: 'margin:4px 0' }, 'Вільного часу немає: справи сюди не ставляться.'),
          h('button', { class: 'link', type: 'button', onclick: () => { const l = draft[wd][draft[wd].length - 1]; draft[wd].push({ s: l ? l.e : '18:00', e: '22:00' }); draw(); } }, '+ вікно'))),
        h('div', { class: 'hrs-day' }, h('div', { class: 'tag' }, 'Коли їм'),
          h('div', { class: 'hrs-row' }, [['b', 'Сніданок'], ['l', 'Обід'], ['d', 'Вечеря']].map(([k, t]) => h('label', { class: 'hrs-meal' }, h('span', { class: 'mute' }, t), h('input', { type: 'time', step: '300', value: meals[k], onchange: (e) => { meals[k] = e.target.value; } }))))),
        h('div', { class: 'toolbar', style: 'margin-top:16px' },
          h('button', { class: 'primary', type: 'button', onclick: () => {
            const clean = {}; for (let wd = 0; wd < 7; wd++) clean[wd] = draft[wd].filter((w) => D.toMin(w.s) != null && D.toMin(w.e) != null && D.toMin(w.e) - D.toMin(w.s) >= 5);
            if (!hm.win || typeof hm.win !== 'object') hm.win = {}; hm.win[personKey()] = clean; hm.meals = meals; hm.snap = null; save(); closeFn(); render(); X.toast('Години збережено, розклад перераховано');
          } }, 'Зберегти'),
          h('button', { class: 'ghost', type: 'button', onclick: () => closeFn() }, 'Скасувати')));
    };
    draw(); closeFn = X.openModal('Мої вільні години', box);
  }

  // картка «Задачі на день» з кнопкою «Розрахувати»
  let draftTitle = ''; let draftMin = ''; let draftBy = '';
  function listCard(r) {
    const hm = A.HM(); const date = r.date; const l = listOf(hm, date);
    const open = l.items.filter((x) => !x.done);
    const title = h('input', { value: draftTitle, placeholder: 'Напр.: подзвонити в банк 15 хв до 14:00', 'aria-label': 'Нова задача', enterkeyhint: 'done', autocomplete: 'off', autocapitalize: 'sentences' });
    const mins = h('input', { type: 'number', inputmode: 'numeric', min: '5', step: '5', value: draftMin, placeholder: '20', 'aria-label': 'Скільки хвилин' });
    const by = h('input', { type: 'time', step: '300', value: draftBy, 'aria-label': 'Виконати до' });
    title.addEventListener('input', () => { draftTitle = title.value; }); mins.addEventListener('input', () => { draftMin = mins.value; }); by.addEventListener('change', () => { draftBy = by.value; });
    const add = () => {
      const q = parseTask(title.value); if (!q.title) { title.focus(); return; }
      const rw = listRW(hm, date);
      rw.items.push({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: q.title, minutes: Math.max(5, Number(mins.value) || q.minutes || 20), userMin: !!(Number(mins.value) || q.minutes), by: by.value || q.by || null, done: false });
      rw.calc = false; draftTitle = ''; draftMin = ''; draftBy = ''; save(); render();
    };
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    const stale = open.length > 0 && !l.calc;
    const aiOn = store.get(AI_KEY) === '1';
    const finish = (msg) => {
      const rr = build(date);
      const bad = rr.unplaced.filter((u) => u.kind === 'my').length; const ok = rr.blocks.filter((b) => b.kind === 'my').length;
      render(); X.toast((msg ? msg + ' ' : '') + (bad ? 'Розподілено ' + ok + ', не вмістилось ' + bad : 'Розподілено: ' + ok));
    };
    const calc = async (ev) => {
      const rw = listRW(hm, date); rw.calc = true;
      if (!aiOn) { rw.items.forEach((x) => { delete x.ai; }); save(); finish(''); return; }
      const btn = ev && ev.currentTarget; if (btn) { btn.disabled = true; btn.textContent = 'ШІ думає…'; }
      try {
        const wins = winsOn(hm, date, null).map((w) => [D.fmt(w[0]), D.fmt(w[1])]);
        const nowD = new Date(); const nowS = r.idx === 0 ? D.fmt(nowD.getHours() * 60 + nowD.getMinutes()) : null;
        const res = await X.callApi('/api/plan-day', { date, now: nowS, windows: wins,
          tasks: rw.items.filter((x) => !x.done).map((x) => ({ id: x.id, title: x.title, minutes: x.userMin ? x.minutes : null, by: x.by })) });
        const by = new Map(res.tasks.map((t) => [t.id, t]));
        rw.items.forEach((x) => { const t = by.get(x.id); if (t) x.ai = { minutes: t.minutes, part: t.part, order: t.order, note: t.note, aiMin: !x.userMin }; else delete x.ai; });
        save(); finish('');
      } catch (e) {
        rw.items.forEach((x) => { delete x.ai; }); save(); finish('ШІ недоступний (' + e.message + '). Розрахувала без нього.');
      }
    };
    return h('div', { class: 'card dl' }, h('div', { class: 'tag' }, 'Задачі на день'),
      open.length ? h('ul', { class: 'dl-list' }, open.map((x) => h('li', {},
        h('span', { class: 'dl-t' }, x.title, h('span', { class: 'mute' }, ' · ' + dur(x.minutes) + (x.by ? ' · до ' + x.by : ''))),
        h('button', { class: 'link', type: 'button', 'aria-label': 'Прибрати: ' + x.title, onclick: () => { const rw = listRW(hm, date); rw.items = rw.items.filter((y) => y.id !== x.id); rw.calc = false; save(); render(); } }, '✕'))))
        : h('p', { class: 'mute', style: 'margin:6px 0 10px' }, 'Впиши, що треба зробити, і за потреби «до котрої години». Потім натисни «Розрахувати».'),
      title,
      h('div', { class: 'dl-row' }, h('label', {}, h('span', { class: 'mute' }, 'Хвилин'), mins), h('label', {}, h('span', { class: 'mute' }, 'Виконати до'), by),
        h('button', { class: 'ghost', type: 'button', onclick: add }, '+ Додати')),
      h('div', { class: 'toolbar', style: 'margin-top:12px' },
        h('button', { class: stale || (open.length && !l.calc) ? 'primary' : 'ghost', type: 'button', disabled: open.length ? null : true, onclick: calc }, l.calc && open.length ? 'Розрахувати знову' : 'Розрахувати'),
        h('label', { class: 'dl-ai' }, h('input', { type: 'checkbox', checked: aiOn ? true : null, onchange: (e) => { store.set(AI_KEY, e.target.checked ? '1' : ''); render(); } }), h('span', {}, 'Розумний розрахунок (ШІ)')),
        stale ? h('span', { class: 'mute' }, 'Список змінено: розрахуй, щоб він з’явився в розкладі') : null));
  }

  // ----- текстові команди для розкладу -----
  let cmdDraft = ''; let cmdBusy = false; let cmdMsg = ''; let cmdPending = null; let cmdUndo = null;
  const hmText = (arr) => (arr && arr.length ? arr.map((w) => w.s + '–' + w.e).join(', ') : 'немає вільних годин');
  const dlabel = (iso) => (iso === A.todayD() ? 'сьогодні' : A.dayName(iso));
  function cmdItems(r) {
    const out = new Map();
    for (const b of r.blocks) if (b.item && (b.kind === 'chore' || b.kind === 'task')) out.set(b.item.key, { ref: b.item.key, kind: 'plan', title: b.title, minutes: b.end - b.start, item: b.item });
    for (const u of r.unplaced) if (u.item) out.set(u.item.key, { ref: u.item.key, kind: 'plan', title: u.title, minutes: u.minutes, item: u.item });
    for (const x of r.list.items) if (!x.done) out.set('my:' + x.id, { ref: 'my:' + x.id, kind: 'my', title: x.title, minutes: x.minutes, by: x.by || null, mine: x });
    return out;
  }
  function cmdLines(res, r) {
    const items = cmdItems(r); const out = [];
    for (const a of res.actions) {
      const it = items.get(a.ref);
      if (a.op === 'add') out.push({ sign: '+', cls: 'pa-add', text: 'Додати (' + dlabel(a.date) + '): ' + a.title + (a.minutes ? ' · ' + dur(a.minutes) : '') + (a.by ? ' · до ' + a.by : '') });
      else if (a.op === 'remove' && it) out.push({ sign: '−', cls: 'pa-rm', text: 'Прибрати: ' + it.title });
      else if (a.op === 'edit' && it) out.push({ sign: '✎', cls: 'pa-up', text: 'Змінити: ' + it.title + ' → ' + [a.title, a.minutes && dur(a.minutes), a.by === '' ? 'без терміну' : a.by && 'до ' + a.by].filter(Boolean).join(' · ') });
      else if (a.op === 'move' && it) out.push({ sign: '→', cls: 'pa-up', text: 'Перенести: ' + it.title + ' → ' + dlabel(a.date) });
      else if (a.op === 'done' && it) out.push({ sign: '✓', cls: 'pa-add', text: 'Зроблено: ' + it.title });
      else if (a.op === 'hours') out.push({ sign: '⏱', cls: 'pa-up', text: 'Вільні години (' + dlabel(a.date) + '): ' + hmText(a.windows) });
    }
    return out;
  }
  async function cmdRun(r) {
    const text = cmdDraft.trim();
    if (text.length < 2) { cmdMsg = 'Напишіть, що змінити, наприклад: «перенеси прибирання на завтра».'; render(); return; }
    cmdBusy = true; cmdMsg = ''; cmdPending = null; render();
    try {
      const hm = A.HM(); const nowD = new Date();
      const tasks = [...cmdItems(r).values()].map((t) => ({ ref: t.ref, kind: t.kind, title: t.title, minutes: t.minutes, by: t.by || null }));
      const res = await X.callApi('/api/plan-edit', { text, today: A.todayD(), date: r.date, now: D.fmt(nowD.getHours() * 60 + nowD.getMinutes()),
        windows: winsOn(hm, r.date, null).map((w) => [D.fmt(w[0]), D.fmt(w[1])]), tasks });
      cmdPending = { res, date: r.date };
      if (!cmdLines(res, r).length && !(res.unclear || []).length) { cmdPending = null; cmdMsg = 'Не знайшла змін для розкладу.'; }
    } catch (e) { cmdMsg = e.message; }
    cmdBusy = false; render();
  }
  function cmdApply(r) {
    if (!cmdPending) return;
    const hm = A.HM(); const today = A.todayD(); const items = cmdItems(r);
    const snap = JSON.parse(JSON.stringify(state.home));
    let n = 0; const skipped = [];
    for (const a of cmdPending.res.actions) {
      const it = items.get(a.ref);
      if (a.op === 'add') { const rw = listRW(hm, a.date); rw.items.push({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: a.title, minutes: a.minutes || 20, userMin: !!a.minutes, by: a.by || null, done: false }); rw.calc = true; n++; }
      else if (a.op === 'remove' && it && it.mine) { const rw = listRW(hm, r.date); rw.items = rw.items.filter((y) => y.id !== it.mine.id); n++; }
      else if (a.op === 'edit' && it && it.mine) { if (a.title) it.mine.title = a.title; if (a.minutes) { it.mine.minutes = a.minutes; it.mine.userMin = true; } if (a.by !== undefined) it.mine.by = a.by || null; delete it.mine.ai; n++; }
      else if (a.op === 'move' && it && it.item) { if (A.pinQuiet(it.item, a.date)) n++; else skipped.push(it.title); }
      else if (a.op === 'done' && it) { if (it.mine) { it.mine.done = true; n++; } else if (r.idx === 0 && it.item) { A.markDoneQuiet(it.item); n++; } else skipped.push(it.title + ' (відмітити можна лише сьогодні)'); }
      else if (a.op === 'hours') {
        if (!hm.winOn || typeof hm.winOn !== 'object') hm.winOn = {};
        hm.winOn[personKey() + '|' + a.date] = a.windows;
        const cut = P.addDays(today, -14); for (const k of Object.keys(hm.winOn)) if (k.split('|')[1] < cut) delete hm.winOn[k];
        n++;
      }
    }
    hm.snap = null; save(); cmdUndo = snap; cmdPending = null; cmdDraft = '';
    cmdMsg = 'Готово: змін ' + n + '.' + (skipped.length ? ' Не вдалося: ' + skipped.join(', ') + '.' : '');
    render();
  }
  function cmdCard(r) {
    const ta = h('textarea', { rows: 2, placeholder: 'Напр.: перенеси прибирання на завтра, додай подзвонити в банк до 14:00', 'aria-label': 'Що змінити в розкладі', enterkeyhint: 'send', autocapitalize: 'sentences', style: 'width:100%;box-sizing:border-box;font-size:16px;min-height:64px' });
    ta.value = cmdDraft; ta.addEventListener('input', () => { cmdDraft = ta.value; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cmdDraft = ta.value; cmdRun(r); } });
    const rows = cmdPending && cmdPending.date === r.date ? cmdLines(cmdPending.res, r) : [];
    const unclear = cmdPending && cmdPending.date === r.date ? (cmdPending.res.unclear || []) : [];
    return h('div', { class: 'card pa', style: 'margin-bottom:14px' }, h('div', { class: 'tag' }, 'Змінити розклад словами'),
      h('p', { class: 'mute', style: 'margin:8px 0 10px' }, 'Напиши, що перенести, додати, прибрати чи відмітити, або що сьогодні вільна лише до певної години. Я покажу зміни, а ти підтвердиш.'),
      ta,
      h('div', { class: 'toolbar', style: 'margin-top:10px' }, h('button', { class: 'primary', type: 'button', style: 'min-height:46px;flex:1 1 auto', disabled: cmdBusy ? true : null, onclick: () => cmdRun(r) }, cmdBusy ? 'Думаю…' : 'Показати зміни')),
      rows.length || unclear.length ? h('div', { class: 'pa-prev' }, h('div', { class: 'tag', style: 'margin:12px 0 6px' }, 'Ось що зміниться'),
        h('ul', { class: 'pa-list' }, rows.map((x) => h('li', { class: x.cls }, h('b', {}, x.sign), h('span', {}, x.text)))),
        unclear.length ? h('p', { class: 'note', style: 'margin:6px 0' }, 'Не зрозуміла: ' + unclear.join('; ') + '.') : null,
        h('div', { class: 'toolbar', style: 'margin-top:10px' },
          rows.length ? h('button', { class: 'primary', type: 'button', style: 'min-height:46px', onclick: () => cmdApply(r) }, 'Застосувати') : null,
          h('button', { class: 'ghost', type: 'button', style: 'min-height:46px', onclick: () => { cmdPending = null; render(); } }, 'Скасувати'))) : null,
      cmdMsg ? h('p', { class: 'note', role: 'status', style: 'margin:10px 0 0' }, cmdMsg) : null,
      cmdUndo && !cmdPending ? h('button', { class: 'link', type: 'button', style: 'min-height:44px', onclick: () => { state.home = cmdUndo; cmdUndo = null; cmdMsg = 'Останню зміну скасовано.'; save(); render(); } }, 'Скасувати останню зміну') : null);
  }

  function viewPlan() {
    const hm = A.HM(); const today = A.todayD();
    if (!selDate || selDate < today || P.diff(selDate, today) > 6) selDate = today;
    const r = build(selDate);
    const isToday = r.idx === 0;
    const pct = r.freeTotal ? Math.min(100, Math.round((r.busy / r.freeTotal) * 100)) : 0;
    const summary = !r.hasWins ? 'У цей день немає вільних годин.' : (r.blocks.length ? r.blocks.length + ' ' + (r.blocks.length === 1 ? 'блок' : 'блоків') + ' · зайнято ' + dur(r.busy) + ' із ' + dur(r.freeTotal) + ' вільних' : 'Нічого не заплановано. Вільно ' + dur(r.freeTotal) + '.');
    return [...header('Дім · ' + A.dayName(selDate, true), 'Мій день по', 'годинах'), strip(today), nextCard(r), listCard(r), cmdCard(r),
      h('div', { class: 'card tl-sum' }, h('div', { class: 'mute', style: 'margin-bottom:10px' }, summary), dayMap(r),
        h('div', { class: 'tl-legend' }, [['dm-win', 'вільно'], ['dm-my', 'мої задачі'], ['dm-cook', 'готування'], ['dm-chore', 'справи'], ['dm-task', 'задачі'], ['dm-shop', 'магазин']].map(([c, t]) => h('span', {}, h('i', { class: 'dm-seg-i ' + c }), t)))),
      r.hasWins ? h('div', { class: 'tl' }, timeline(r)) : h('p', { class: 'empty' }, 'Додай вільні години, і я розкладу справи по годинах.'),
      r.unplaced.length ? h('details', { class: 'card unplaced', open: true, style: 'margin-top:14px' },
        h('summary', {}, 'Не вмістилось в години: ' + r.unplaced.length),
        h('p', { class: 'mute', style: 'margin:8px 0' }, 'Додай вільне вікно, скороти справу, зсунь термін або перенеси на інший день.'),
        h('ul', { class: 'h-list' }, r.unplaced.map((u) => h('li', {}, h('span', { class: 'h-n' }, (ICON[u.kind] || '') + ' ' + u.title), h('span', { class: 'mute' }, dur(u.minutes) + (u.kind === 'my' ? ' · ' + u.reason : '')),
          u.item ? h('button', { class: 'link h-mv', type: 'button', onclick: () => A.itemMenu(u.item) }, '⇄') : null)))) : null,
      (r.doneItems.length || r.myDone.length) ? h('details', { class: 'card', style: 'margin-top:14px' }, h('summary', {}, 'Зроблено: ' + (r.doneItems.length + r.myDone.length)),
        h('ul', { class: 'h-list' }, r.myDone.map((x) => h('li', { class: 'done' }, h('span', { class: 'h-n' }, x.title), h('span', { class: 'mute' }, dur(x.minutes)),
          h('button', { class: 'link h-mv', type: 'button', onclick: () => { x.done = false; save(); render(); } }, 'скасувати'))), r.doneItems.map((i) => h('li', { class: 'done' }, h('span', { class: 'h-n' }, i.title), h('span', { class: 'mute' }, dur(i.minutes)),
          h('button', { class: 'link h-mv', type: 'button', onclick: () => { A.tick(i, false); render(); } }, 'скасувати'))))) : null,
      h('div', { class: 'toolbar tl-tools' },
        h('button', { class: 'primary', type: 'button', onclick: hoursSheet }, 'Мої вільні години'),
        h('button', { class: 'ghost', type: 'button', onclick: () => { hm.snap = null; save(); render(); X.toast('Розклад перераховано'); } }, 'Перепланувати'),
        h('button', { class: 'ghost', type: 'button', onclick: () => { store.set(LIST_KEY, '1'); render(); } }, 'Списком'))];
  }

  const oldToday = VIEWS.h_today;
  VIEWS.h_today = () => {
    if (store.get(LIST_KEY) === '1') {
      const out = oldToday();
      out.push(h('div', { class: 'toolbar', style: 'margin-top:12px' }, h('button', { class: 'ghost', type: 'button', onclick: () => { store.set(LIST_KEY, ''); render(); } }, 'По годинах')));
      return out;
    }
    return viewPlan().filter((x) => x != null && x !== false);
  };
})();
