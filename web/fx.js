'use strict';
// Візуальні ефекти Ducky. Не впливає на логіку застосунку.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // ----- живий фон -----
  const bg = document.createElement('div');
  bg.className = 'bg'; bg.setAttribute('aria-hidden', 'true'); bg.innerHTML = '<i></i><i></i><i></i>';
  document.body.prepend(bg);

  // ----- іскри, що пливуть угору -----
  let col = '217,191,140';
  const refreshColors = () => { col = getComputedStyle(root).getPropertyValue('--spark').trim() || col; };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!reduce && !coarse) {
    const cv = document.createElement('canvas');
    cv.id = 'sparks'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, parts = [], raf = 0;
    const mk = (bottom) => ({ x: Math.random() * W, y: bottom ? H + 10 : Math.random() * H, r: Math.random() * 1.9 + 0.4,
      vy: -(Math.random() * 0.28 + 0.06), vx: (Math.random() - 0.5) * 0.16, p: Math.random() * 6.28, s: Math.random() * 0.02 + 0.006 });
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: Math.min(70, Math.round((W * H) / 20000)) }, () => mk(false));
    };
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.p) * 0.12; p.y += p.vy; p.p += p.s * 3;
        if (p.y < -10) Object.assign(p, mk(true));
        const a = 0.12 + 0.55 * (0.5 + 0.5 * Math.sin(p.p));
        ctx.beginPath(); ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    size(); refreshColors(); tick();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf); else { cancelAnimationFrame(raf); tick(); }
    });
  }

  // ----- підсвітка під курсором та нахил карток -----
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    if (!reduce && c.parentElement && c.parentElement.classList.contains('cards')) {
      c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / r.height) * 8).toFixed(2) + 'deg');
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const c = e.target.closest && e.target.closest('.cards .card');
    if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
  });

  // ----- паралакс і магнітні кнопки (без кіл за курсором) -----
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('pointermove', (e) => {
      root.style.setProperty('--px', ((e.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
      root.style.setProperty('--py', ((e.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
      const btn = e.target.closest && e.target.closest('button.primary, button.ghost');
      if (btn) {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px');
        btn.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px');
      }
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const btn = e.target.closest && e.target.closest('button.primary, button.ghost');
      if (btn && !btn.contains(e.relatedTarget)) { btn.style.setProperty('--tx', '0px'); btn.style.setProperty('--ty', '0px'); }
    });
  }

  // ----- вибух іскор на головних кнопках -----
  function burst(x, y) {
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.4; const dist = 50 + Math.random() * 70;
      s.style.left = x + 'px'; s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.width = s.style.height = (3 + Math.random() * 6) + 'px';
      document.body.append(s); setTimeout(() => s.remove(), 1100);
    }
  }
  if (!reduce) {
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button.primary');
      if (!b) return;
      const r = b.getBoundingClientRect();
      burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
  }

  // ----- «Кря!» при натисканні на логотип -----
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.setAttribute('role', 'button'); brand.setAttribute('tabindex', '0'); brand.setAttribute('aria-label', 'Ducky');
    const quack = () => {
      const q = document.createElement('div'); q.className = 'quack'; q.textContent = 'Кря!';
      const r = brand.getBoundingClientRect(); q.style.left = (r.left + 20) + 'px'; q.style.top = (r.top - 4) + 'px';
      document.body.append(q); setTimeout(() => q.remove(), 1400);
      brand.classList.remove('jump'); void brand.offsetWidth; brand.classList.add('jump');
    };
    brand.addEventListener('click', quack);
    brand.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); quack(); } });
  }

  // ----- бульбашки у ставку -----
  const pond = document.querySelector('.pond');
  if (pond && !reduce) {
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('i'); b.className = 'bubble';
      const sz = 4 + Math.random() * 7;
      b.style.width = b.style.height = sz + 'px'; b.style.left = (5 + Math.random() * 90) + '%';
      b.style.animationDelay = (-Math.random() * 7) + 's'; b.style.animationDuration = (5 + Math.random() * 5) + 's';
      pond.append(b);
    }
  }

  // ----- поява екрана: слова, каскад, лічильники, індикатор навігації -----
  let lastKey = null; let lastInk = null;
  const word = (t, i) => { const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--wi', i); s.textContent = t; return s; };
  function splitWords(scope) {
    scope.querySelectorAll('h1').forEach((h1) => {
      let n = 0; const out = [];
      h1.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            out.push(/^\s+$/.test(tok) ? document.createTextNode(' ') : word(tok, n++));
          });
        } else { const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--wi', n++); s.append(node); out.push(s); }
      });
      h1.replaceChildren(...out);
    });
  }
  function stagger(scope) {
    const seen = new Set(); let i = 0;
    scope.querySelectorAll(':scope > *, .grid > *, .cards > *, .auth > *, .auth-emblem').forEach((el) => {
      if (seen.has(el) || el.tagName === 'H1') return;
      seen.add(el); el.classList.add('reveal'); el.style.setProperty('--i', i++);
    });
    let r = 0;
    scope.querySelectorAll('tr').forEach((el) => { el.classList.add('reveal'); el.style.setProperty('--i', 3 + r++ * 0.6); });
  }
  function countUp(scope) {
    scope.querySelectorAll('.total, [data-count]').forEach((el) => {
      const data = el.hasAttribute('data-count');
      const target = data ? parseFloat(el.dataset.count) : parseFloat(el.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const suffix = data ? (el.dataset.suffix || '') : ' ₴';
      if (!isFinite(target) || target <= 0) return;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 1100); const v = target * (1 - Math.pow(1 - k, 4));
        const frac = target % 1 ? 2 : 0;
        el.textContent = (k === 1 ? v : (frac ? v : Math.round(v))).toLocaleString('uk-UA', { maximumFractionDigits: frac, minimumFractionDigits: k === 1 ? frac : 0 }) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function placeInk() {
    const nav = document.getElementById('nav');
    const old = nav && nav.querySelector('.ink'); if (old) old.remove();
    const cur = nav && !nav.hidden && nav.querySelector('[aria-current="page"]');
    if (!cur) { lastInk = null; return; }
    const ink = document.createElement('span'); ink.className = 'ink';
    const to = { l: cur.offsetLeft, w: cur.offsetWidth };
    const from = lastInk || to;
    ink.style.left = from.l + 'px'; ink.style.width = from.w + 'px';
    nav.append(ink);
    requestAnimationFrame(() => requestAnimationFrame(() => { ink.style.left = to.l + 'px'; ink.style.width = to.w + 'px'; }));
    lastInk = to;
  }

  window.DuckyFX = {
    afterRender(key) {
      placeInk();
      const changed = key !== lastKey; lastKey = key;
      if (!changed || reduce) return;
      const view = document.getElementById('view');
      splitWords(view); stagger(view); countUp(view);
    },
    themeTransition(apply, x, y) {
      if (reduce || !document.startViewTransition) { apply(); refreshColors(); return; }
      const t = document.startViewTransition(() => { apply(); refreshColors(); });
      t.ready.then(() => {
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 800, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
    },
    refreshColors,
  };
})();
