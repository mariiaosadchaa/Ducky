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
    save(); undo = snap; pending = null; draft = ''; off = new Set();
    msg = 'Готово: додано ' + add + ', прибрано ' + rm + ', змінено ' + up + '.';
    render();
  }

  function card() {
    const ta = h('textarea', { rows: 2, placeholder: 'Напр.: купила 2 л молока і 10 яєць; видали сир; зʼїли 300 г курки; приготували борщ на 4 людей', 'aria-label': 'Що змінити в коморі', enterkeyhint: 'send', autocapitalize: 'sentences', style: 'width:100%;box-sizing:border-box;font-size:16px;min-height:64px' });
    ta.value = draft; ta.addEventListener('input', () => { draft = ta.value; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); draft = ta.value; run(); } });
    const rows = pending ? lines(pending) : [];
    return h('div', { class: 'card pa', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Комора словами'),
      h('p', { class: 'mute', style: 'margin:8px 0 10px' }, 'Пиши як є: що купила (можна цілим списком), що з\'їли чи закінчилось, що викинула. Або що приготували й на скільки людей: я підберу витрачені продукти. Спершу покажу зміни, а ти підтвердиш.'),
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

  const orig = VIEWS.pantry;
  VIEWS.pantry = () => {
    const out = orig();
    const gi = out.findIndex((el) => el && el.classList && el.classList.contains('card') && /Додати списком/.test(el.textContent || ''));
    if (gi >= 0) {
      const old = out[gi]; old.style.marginBottom = '0';
      out.splice(gi, 1, card(), h('details', { class: 'card', style: 'margin-bottom:24px' }, h('summary', { style: 'min-height:44px;display:flex;align-items:center;cursor:pointer' }, 'Без ШІ: додати списком'), h('div', { style: 'margin-top:10px' }, old)));
    } else {
      const g2 = out.findIndex((el) => el && el.classList && el.classList.contains('grid'));
      out.splice(g2 < 0 ? out.length : g2, 0, card());
    }
    return out;
  };
})();
