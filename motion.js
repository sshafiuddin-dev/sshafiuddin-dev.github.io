/* Motion layer for the portfolio: hero sequence, scroll reveals, nav indicator, theme reveal,
   jump sweep and pointer springs. It is a progressive enhancement. With no Motion bundle, reduced
   motion, or any error, the page stays static and fully visible (everything we hide is tracked in
   `hidden` and restored). Uses the self-hosted vendor/motion.min.js (Motion, MIT). */
(() => {
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = window.Motion;

  /* The circular theme reveal is plain View Transitions, so it needs no library. */
  if (!calm) {
    window.swapTheme = (apply, btn) => {
      if (!document.startViewTransition) return apply();
      const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add('vt-theme');
      const vt = document.startViewTransition(apply);
      vt.ready.then(() => root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }
      )).catch(() => {});
      vt.finished.finally(() => root.classList.remove('vt-theme'));
    };
  }
  if (!M || calm) { root.classList.remove('js-motion'); return; }

  const { animate, inView, scroll, stagger, spring } = M;
  const hidden = [];
  const restore = () => {
    root.classList.remove('js-motion');
    hidden.forEach(el => { el.style.opacity = ''; el.style.translate = ''; el.style.rotate = ''; el.style.scale = ''; });
  };

  try {
    /* One place for every duration, distance, stagger and spring. */
    const T = {
      dur: { fast: .18, normal: .35, slow: .6, crawl: 1 },
      ease: [.22, 1, .36, 1],
      dist: { sm: 8, md: 14, lg: 24 },
      gap: { letters: .035, words: .06, chips: .04, list: .08 },
      spring: { snappy: { type: spring, bounce: .12, duration: .55 }, pop: { type: spring, bounce: .35, duration: .7 } },
      follow: { k: 220, c: 24 }, // pointer-driven springs
    };
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const hide = (els) => els.forEach(el => { el.style.opacity = '0'; hidden.push(el); });
    const once = (el, fn, opts) => { let done = false; inView(el, () => { if (!done) { done = true; fn(); } }, opts); };
    const up = (px) => [`0px ${px}px`, '0px 0px'];
    const capable = (navigator.hardwareConcurrency || 8) > 4; // decorative effects skip low-core devices
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ---------- Phase 1: hero sequence ---------- */
    const chars = $$('h1 .ch'), bits = $$('.hero-lede, .hero-sub, .hero-cta'), card = $$('.sod'), cells = $$('.sod .cell');
    hide([...chars, ...bits, ...card, ...cells]);
    $$('h2').forEach(h => { // words rise out of a mask; aria-label keeps the heading readable
      const text = h.textContent.trim().replace(/\s+/g, ' ');
      h.setAttribute('aria-label', text);
      h.textContent = '';
      text.split(' ').forEach((w, i, all) => {
        const o = document.createElement('span'), n = document.createElement('span');
        o.className = 'w'; o.setAttribute('aria-hidden', 'true'); n.className = 'wi'; n.textContent = w;
        n.style.translate = '0px 105%'; hidden.push(n);
        o.append(n); h.append(o); if (i < all.length - 1) h.append(' ');
      });
    });
    root.classList.remove('js-motion'); // our inline styles hold everything hidden from here

    animate(chars, { opacity: [0, 1], translate: up(T.dist.lg * 4.4), rotate: ['6deg', '0deg'] },
      { duration: .7, ease: T.ease, delay: stagger(T.gap.letters) });
    animate(bits, { opacity: [0, 1], translate: up(T.dist.md) }, { duration: .7, ease: T.ease, delay: stagger(.1, { startDelay: .55 }) });
    animate(card, { opacity: [0, 1], translate: up(T.dist.md) }, { duration: .8, ease: T.ease, delay: .35 });
    const ripple = (i) => .75 + Math.hypot(i % 7 - 3, Math.floor(i / 7) - 3) * .06; // outward from the matrix centre
    animate(cells, { opacity: [0, 1] }, { duration: .3, delay: ripple });
    animate(cells, { scale: [.2, 1] }, { ...T.spring.pop, delay: ripple });

    /* ---------- Phase 1: scroll reveals ---------- */
    $$('h2').forEach(h => {
      const inner = $$('.wi', h);
      once(h, () => animate(inner, { translate: ['0px 105%', '0px 0px'] }, { duration: .7, ease: T.ease, delay: stagger(T.gap.words) }), { amount: .6 });
    });
    $$('[data-reveal]:not(h2)').forEach(el => {
      const lines = $$('.job-log li', el), chips = $$('.grants li', el);
      hide([el, ...lines, ...chips]);
      once(el, () => {
        animate(el, { opacity: [0, 1], translate: up(T.dist.lg) }, { duration: T.dur.slow, ease: T.ease });
        if (chips.length) animate(chips, { opacity: [0, 1], translate: ['-8px 0px', '0px 0px'] }, { duration: .45, ease: T.ease, delay: stagger(T.gap.chips, { startDelay: .2 }) });
        if (lines.length) animate(lines, { opacity: [0, 1], translate: ['-8px 0px', '0px 0px'] }, { duration: .5, ease: T.ease, delay: stagger(T.gap.list, { startDelay: .3 }) });
      }, { amount: .2 });
    });

    /* stat count-up, now started by inView */
    $$('[data-count]').forEach(el => {
      const end = +el.dataset.count; el.textContent = '0';
      once(el, () => {
        const t0 = performance.now();
        (function tick(now) {
          const p = Math.min((now - t0) / 1400, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      }, { amount: .5 });
    });

    /* a rule per section that draws itself as you scroll into it */
    $$('main > section:not(.contact)').forEach(sec => {
      const rule = document.createElement('span');
      rule.className = 'rule'; rule.setAttribute('aria-hidden', 'true'); sec.prepend(rule);
      scroll(animate(rule, { transform: ['scaleX(0)', 'scaleX(1)'] }, { ease: 'linear' }), { target: sec, offset: ['start end', 'start 35%'] });
    });

    /* ---------- Phase 2: nav indicator that springs between links ---------- */
    const ul = document.querySelector('.nav-links');
    const ind = document.createElement('li');
    ind.className = 'nav-ind'; ind.setAttribute('aria-hidden', 'true'); ind.setAttribute('role', 'presentation');
    ul.append(ind); root.classList.add('has-ind');
    const pose = (a) => a ? `translateX(${a.offsetLeft}px) scaleX(${a.offsetWidth / ul.clientWidth})` : null;
    const current = () => { const m = new DOMMatrix(getComputedStyle(ind).transform); return `translateX(${m.m41}px) scaleX(${m.a})`; };
    const mark = () => ul.querySelector('a.active');
    const hovering = { link: null };
    const settle = () => {
      const to = pose(hovering.link || mark());
      if (!to) return;
      animate(ind, { transform: [current(), to] }, T.spring.snappy);
    };
    new MutationObserver(settle).observe(ul, { attributes: true, attributeFilter: ['class'], subtree: true });
    ul.addEventListener('pointerover', (e) => { const a = e.target.closest('a'); if (a) { hovering.link = a; settle(); } });
    ul.addEventListener('pointerleave', () => { hovering.link = null; settle(); });
    ul.addEventListener('focusin', (e) => { const a = e.target.closest('a'); if (a) { hovering.link = a; settle(); } });
    ul.addEventListener('focusout', () => { hovering.link = null; settle(); });
    addEventListener('resize', () => { const to = pose(hovering.link || mark()); if (to) ind.style.transform = to; });

    /* ---------- Phase 2: a sweep across the heading you jumped to ---------- */
    const arrived = (sec) => new Promise(res => {
      if (Math.abs(sec.getBoundingClientRect().top - 80) < 6) return res();
      const done = () => { clearTimeout(t); removeEventListener('scrollend', done); res(); };
      const t = setTimeout(done, 1300);
      addEventListener('scrollend', done, { once: true });
    });
    const sweep = async (id) => {
      const sec = document.getElementById(id), h = sec && sec.querySelector('h2');
      if (!h) return;
      await arrived(sec);
      const s = document.createElement('span');
      s.className = 'sweep'; s.setAttribute('aria-hidden', 'true'); h.append(s);
      await animate(s, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: .45, ease: T.ease }).finished;
      await animate(s, { opacity: [1, 0] }, { duration: .45 }).finished;
      s.remove();
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) sweep(a.getAttribute('href').slice(1));
    });
    document.addEventListener('jump', (e) => sweep(e.detail)); // fired by the t-code box

    /* ---------- Phase 3: pointer springs (fine pointers on capable devices) ---------- */
    const follow = (apply, init, { k, c } = T.follow) => {
      const v = { ...init }, vel = Object.fromEntries(Object.keys(init).map(n => [n, 0])), goal = { ...init };
      let raf = 0, last = 0;
      const tick = (now) => {
        const dt = Math.min((now - last) / 1000, .032); last = now; let moving = false;
        for (const n in v) {
          vel[n] += (-k * (v[n] - goal[n]) - c * vel[n]) * dt; v[n] += vel[n] * dt;
          if (Math.abs(vel[n]) > .01 || Math.abs(v[n] - goal[n]) > .01) moving = true;
        }
        if (moving) { apply(v, false); raf = requestAnimationFrame(tick); } else { raf = 0; Object.assign(v, goal); apply(v, true); }
      };
      return (to) => { Object.assign(goal, to); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    };

    /* matrix squares squash when pressed (works for touch too) */
    cells.forEach(el => {
      const set = follow((v, rest) => { el.style.scale = rest && v.s === 1 ? '' : String(v.s); }, { s: 1 }, { k: 420, c: 24 });
      el.addEventListener('pointerdown', () => set({ s: .78 }));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => set({ s: 1 })));
    });

    if (fine && capable) {
      /* buttons lean toward the pointer */
      const magnets = $$('.hero-cta .btn, .btn-send').map(el => ({
        el, set: follow((v, rest) => { el.style.translate = rest && !v.x && !v.y ? '' : `${v.x}px ${v.y}px`; }, { x: 0, y: 0 }),
      }));
      let queued = false;
      const lean = (e) => {
        if (queued) return; queued = true;
        requestAnimationFrame(() => {
          queued = false;
          magnets.forEach(({ el, set }) => {
            const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            const near = Math.hypot(dx, dy) < Math.max(r.width, r.height) * .9 + 30;
            const cap = (n) => Math.max(-9, Math.min(9, n * .25));
            set(near ? { x: cap(dx), y: cap(dy) } : { x: 0, y: 0 });
          });
        });
      };
      addEventListener('pointermove', lean, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => magnets.forEach(m => m.set({ x: 0, y: 0 })));

      /* project cards tilt toward the pointer */
      root.classList.add('has-tilt');
      $$('.project').forEach(el => {
        const set = follow((v, rest) => {
          el.style.transform = rest && !v.rx && !v.ry && !v.y ? '' : `perspective(800px) rotateX(${v.rx}deg) rotateY(${v.ry}deg) translateY(${v.y}px)`;
        }, { rx: 0, ry: 0, y: 0 });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          set({ rx: (.5 - py) * 7, ry: (px - .5) * 9, y: -4 });
        }, { passive: true });
        el.addEventListener('pointerleave', () => set({ rx: 0, ry: 0, y: 0 }));
      });
    }
  } catch (err) {
    console.error('Motion layer disabled:', err);
    restore();
  }
})();
