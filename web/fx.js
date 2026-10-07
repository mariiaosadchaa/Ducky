'use strict';
// Ducky: легкі ефекти в стилі iOS. Без фонових анімацій, canvas і слухачів руху миші.
// Лишилось: м'яка поява блоків, лічильники сум, «Кря!» на логотипі, плавна зміна теми.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // ----- «Кря!» при натисканні на логотип -----
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.setAttribute('role', 'button'); brand.setAttribute('tabindex', '0'); brand.setAttribute('aria-label', 'Ducky');
    const quack = () => {
      const q = document.createElement('div'); q.className = 'quack'; q.textContent = 'Кря!';
      const r = brand.getBoundingClientRect(); q.style.left = (r.left + 20) + 'px'; q.style.top = (r.top - 4) + 'px';
      document.body.append(q); setTimeout(() => q.remove(), 1200);
      if (reduce) return;
      brand.classList.remove('jump'); void brand.offsetWidth; brand.classList.add('jump');
    };
    brand.addEventListener('click', quack);
    brand.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); quack(); } });
  }

  // ----- поява екрана: короткий каскад і лічильники -----
  let lastKey = null;
  function stagger(scope) {
    const seen = new Set(); let i = 0;
    scope.querySelectorAll(':scope > *, .grid > *, .cards > *, .auth > *, .auth-emblem').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el); el.classList.add('reveal'); el.style.setProperty('--i', Math.min(i++, 8));
    });
  }
  function countUp(scope) {
    scope.querySelectorAll('.total, [data-count]').forEach((el) => {
      const data = el.hasAttribute('data-count');
      const target = data ? parseFloat(el.dataset.count) : parseFloat(el.textContent.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const suffix = data ? (el.dataset.suffix || '') : ' ₴';
      if (!isFinite(target) || target <= 0) return;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 700); const v = target * (1 - Math.pow(1 - k, 3));
        const frac = target % 1 ? 2 : 0;
        el.textContent = (k === 1 ? v : (frac ? v : Math.round(v))).toLocaleString('uk-UA', { maximumFractionDigits: frac, minimumFractionDigits: k === 1 ? frac : 0 }) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  window.DuckyFX = {
    afterRender(key) {
      const changed = key !== lastKey; lastKey = key;
      if (!changed || reduce) return;
      const view = document.getElementById('view');
      stagger(view); countUp(view);
    },
    // зміна теми: коротке розчинення замість кола
    themeTransition(apply) {
      if (reduce || !document.startViewTransition) { apply(); return; }
      document.startViewTransition(apply);
    },
    refreshColors() {},
  };
})();
