/* QueueZeroTwo penguin mascot. Vanilla JS, no dependencies.
   Sits on the footer edge, looks toward the pointer, reacts when poked, naps when idle.
   Sheets: /mascots/penguin-directions.webp and /mascots/penguin-reactions.webp (3x3 grids, 240x280 cells).
   Styling uses element.style (CSSOM) only, so it works under a strict style-src CSP. */
(function () {
  'use strict';
  var DIR = '/mascots/penguin-directions.webp', REA = '/mascots/penguin-reactions.webp';
  var W = 120, H = 140; /* 240x280 cell shown at half size = sharp on 2x screens */
  var NAMES = ['happy', 'heart', 'sparkles', 'surprised', 'stars', 'blush', 'sleep', 'dizzy', 'laugh'];
  var footer = document.querySelector('body > footer');
  if (!footer || document.getElementById('qzm')) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var wrap = document.createElement('div');
  wrap.id = 'qzm';
  wrap.setAttribute('aria-hidden', 'true'); /* decorative */
  var s = wrap.style;
  s.display = 'none'; s.justifyContent = 'center'; s.alignItems = 'flex-end';
  s.height = H + 'px'; s.marginBottom = '-1px'; s.pointerEvents = 'none'; s.overflow = 'hidden';

  var pet = document.createElement('div');
  var p = pet.style;
  p.position = 'relative'; p.width = W + 'px'; p.height = H + 'px'; p.pointerEvents = 'auto';
  p.cursor = 'pointer'; p.userSelect = 'none'; p.webkitUserSelect = 'none'; p.touchAction = 'manipulation';
  p.webkitTapHighlightColor = 'transparent';

  function layer(url) {
    var d = document.createElement('div'), q = d.style;
    q.position = 'absolute'; q.left = '0'; q.top = '0'; q.width = '100%'; q.height = '100%';
    q.backgroundImage = 'url(' + url + ')'; q.backgroundRepeat = 'no-repeat';
    q.backgroundSize = '300% 300%'; q.backgroundPosition = '50% 50%';
    pet.appendChild(d);
    return d;
  }
  var dirL = layer(DIR), reaL = layer(REA);
  reaL.style.opacity = '0';
  wrap.appendChild(pet);
  footer.parentNode.insertBefore(wrap, footer);

  function cell(el, c, r) { el.style.backgroundPosition = (c * 50) + '% ' + (r * 50) + '%'; }

  /* Show only once both sheets have loaded, so there is no blank flash. */
  var loaded = 0;
  function ready() { if (++loaded === 2) s.display = 'flex'; }
  [DIR, REA].forEach(function (u) {
    var i = new Image(); i.onload = ready;
    i.onerror = function () { wrap.remove(); };
    i.src = u;
  });

  /* Looking */
  var lx = null, ly = null, raf = 0, cur = '1,1', reacting = false, sleeping = false;
  function look() {
    raf = 0;
    if (reacting || sleeping) return;
    var c = 1, r = 1;
    if (!(reduce && reduce.matches) && lx !== null) {
      var b = pet.getBoundingClientRect(),
          dx = lx - (b.left + b.width / 2), dy = ly - (b.top + b.height * 0.45),
          d = Math.hypot(dx, dy);
      if (d > 50) {
        var nx = dx / d, ny = dy / d;
        c = nx < -0.38 ? 0 : nx > 0.38 ? 2 : 1;
        r = ny < -0.38 ? 0 : ny > 0.38 ? 2 : 1;
      }
    }
    if (c + ',' + r !== cur) { cur = c + ',' + r; cell(dirL, c, r); }
  }
  function sched() { if (!raf) raf = requestAnimationFrame(look); }

  /* Reactions */
  var rt = 0, pokes = [], lastR = -1;
  function react(name, ms) {
    var i = typeof name === 'number' ? name : NAMES.indexOf(name);
    if (i < 0 || i > 8) return;
    clearTimeout(rt);
    cell(reaL, i % 3, Math.floor(i / 3));
    reaL.style.opacity = '1';
    reacting = true;
    if (i === 6) { sleeping = true; reacting = false; return; } /* sleep stays until woken */
    rt = setTimeout(function () { reaL.style.opacity = '0'; reacting = false; sched(); }, ms || 1400);
  }
  function wake() {
    if (!sleeping) return;
    sleeping = false; reaL.style.opacity = '0'; sched();
  }
  pet.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var now = Date.now();
    pokes = pokes.filter(function (t) { return now - t < 2000; }); pokes.push(now);
    sleeping = false;
    if (pokes.length >= 4) { pokes = []; react(7, 1800); return; } /* poked too much: dizzy */
    var i; do { i = Math.floor(Math.random() * 9); } while (i === lastR || i === 6 || i === 7);
    lastR = i; react(i);
  });

  /* Idle nap */
  var idle = 0;
  function bump() {
    wake();
    clearTimeout(idle);
    idle = setTimeout(function () { if (!reacting) react(6); }, 45000);
  }
  function onMove(e) { lx = e.clientX; ly = e.clientY; bump(); sched(); }
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', function (e) { if (!pet.contains(e.target)) onMove(e); }, { passive: true });
  addEventListener('scroll', function () { bump(); sched(); }, { passive: true });
  addEventListener('keydown', bump, { passive: true });
  bump();

  /* Hooks for later: qzMascot.react('heart'), qzMascot.react('stars') on a win, etc. */
  window.qzMascot = { react: react, names: NAMES };
})();
