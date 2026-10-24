// Ducky: поле «Скажи Ducky» у коморі. Пишеш текстом, що купила, закінчилось чи викинула; ШІ пропонує зміни,
// ти підтверджуєш, і застосунок їх вносить. Нічого не змінюється без підтвердження, останню зміну можна скасувати.
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || !window.DuckyExtras) return;
  const X = window.DuckyExtras;
  let draft = ''; let busy = false; let msg = ''; let pending = null; let undo = null;
  const REASON = { used: 'використано', thrown: 'викинуто', removed: 'прибрано' };
  const qtyText = (q, w) => [q, w].filter(Boolean).join(' · ');

  function lines(p) {
    const byId = new Map(state.products.map((x) => [x.id, x]));
    const out = [];
    for (const a of p.actions) {
      if (a.op === 'add') out.push({ sign: '+', cls: 'pa-add', text: 'Додати: ' + a.name + (qtyText(a.qty, a.weight) ? ' · ' + qtyText(a.qty, a.weight) : '') + (a.exp ? ' · до ' + a.exp : '') + (a.price != null ? ' · ' + a.price + ' ₴' : '') });
      else if (a.op === 'remove') { const x = byId.get(a.id); if (x) out.push({ sign: '−', cls: 'pa-rm', text: 'Прибрати: ' + x.name + ' (' + REASON[a.reason] + ')' }); }
      else if (a.op === 'update') { const x = byId.get(a.id); if (x) out.push({ sign: '✎', cls: 'pa-up', text: 'Змінити: ' + x.name + ' · ' + (qtyText(x.qty, x.weight) || 'без кількості') + ' → ' + (qtyText(a.qty || x.qty, a.weight || x.weight)) }); }
    }
    return out;
  }

  async function run() {
    const text = draft.trim();
    if (text.length < 2) { msg = 'Напишіть, що змінити, наприклад: «купила 2 л молока, закінчився хліб».'; render(); return; }
    busy = true; msg = ''; pending = null; render();
    try {
      const res = await X.callApi('/api/edit-pantry', { text, today: todayISO(), products: state.products.map((p) => ({ id: p.id, name: p.name, qty: p.qty || '', weight: p.weight || '' })) });
      pending = res;
      if (!lines(res).length && !(res.notFound || []).length) { pending = null; msg = 'Не знайшла змін для комори.'; }
    } catch (e) { msg = e.message; }
    busy = false; render();
  }

  function apply() {
    if (!pending) return;
    const snap = JSON.parse(JSON.stringify({ products: state.products, archive: state.archive || [] }));
    let add = 0; let rm = 0; let up = 0;
    for (const a of pending.actions) {
      if (a.op === 'add') { state.products.push({ id: uid(), name: a.name, qty: a.qty || '', weight: a.weight || '', store: a.store || '', price: a.price == null ? null : a.price, bought: todayISO(), exp: a.exp || null }); add++; }
      else if (a.op === 'remove') { const p = state.products.find((x) => x.id === a.id); if (p) { X.archiveProduct(p, a.reason); rm++; } }
      else if (a.op === 'update') { const p = state.products.find((x) => x.id === a.id); if (p) { if (a.qty) p.qty = a.qty; if (a.weight) p.weight = a.weight; up++; } }
    }
    save(); undo = snap; pending = null; draft = '';
    msg = 'Готово: додано ' + add + ', прибрано ' + rm + ', змінено ' + up + '.';
    render();
  }

  function card() {
    const ta = h('textarea', { rows: 2, placeholder: 'Напр.: купила 2 л молока і 10 яєць, закінчився хліб, викинула сир', 'aria-label': 'Що змінити в коморі', enterkeyhint: 'send', autocapitalize: 'sentences', style: 'width:100%;box-sizing:border-box;font-size:16px;min-height:64px' });
    ta.value = draft; ta.addEventListener('input', () => { draft = ta.value; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); draft = ta.value; run(); } });
    const rows = pending ? lines(pending) : [];
    return h('div', { class: 'card pa', style: 'margin-bottom:20px' }, h('div', { class: 'tag' }, 'Скажи Ducky'),
      h('p', { class: 'mute', style: 'margin:8px 0 10px' }, 'Напиши своїми словами, що купила, що закінчилось чи що викинула. Я покажу зміни, а ти підтвердиш.'),
      ta,
      h('div', { class: 'toolbar', style: 'margin-top:10px' }, h('button', { class: 'primary', type: 'button', style: 'min-height:46px;flex:1 1 auto', disabled: busy ? true : null, onclick: run }, busy ? 'Думаю…' : 'Показати зміни')),
      rows.length || (pending && (pending.notFound || []).length) ? h('div', { class: 'pa-prev' }, h('div', { class: 'tag', style: 'margin:12px 0 6px' }, 'Ось що зміниться'),
        h('ul', { class: 'pa-list' }, rows.map((r) => h('li', { class: r.cls }, h('b', {}, r.sign), h('span', {}, r.text)))),
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
    let gi = out.findIndex((el) => el && el.classList && el.classList.contains('card') && /Додати списком/.test(el.textContent || ''));
    if (gi < 0) gi = out.findIndex((el) => el && el.classList && el.classList.contains('grid'));
    out.splice(gi < 0 ? out.length : gi, 0, card());
    return out;
  };
})();
