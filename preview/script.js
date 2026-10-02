/* ============================================================================
   The page is the pipeline. Three independent pieces:
     1. the ambient field   — a system idling, canvas, pauses when unseen
     2. the rail            — scroll position IS the request's position
     3. the gate            — a state machine; the climax

   Reduced motion is a complete page, not a stripped one: the field renders
   once and still, scrolling is native, reveals are skipped, and the gate is
   fully operable.

   Nothing here is required for the content to be readable. Reveal from-states
   are set in JS precisely so that with JS off, nothing is hidden.
   ========================================================================== */

(function () {
  'use strict';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------- 1. ambient field ---------------------- */
  (function () {
    var c = document.getElementById('field');
    if (!c || !c.getContext) return;
    /* Canvas cannot read CSS tokens, so read them once here rather than
       keeping a second copy of the palette that drifts from the first. */
    var cs = getComputedStyle(document.documentElement);
    var SIG = (cs.getPropertyValue('--sig-rgb') || '255 84 54').trim().replace(/\s+/g, ',');
    var NODE = (cs.getPropertyValue('--cool-rgb') || '150 170 210').trim().replace(/\s+/g, ',');
    var x = c.getContext('2d'), w, h, dpr, nodes = [], pulses = [], running = false, spawnTimer = null;

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.width = innerWidth * dpr;
      h = c.height = innerHeight * dpr;
    }
    size();
    addEventListener('resize', size);

    for (var i = 0; i < 54; i++) {
      nodes.push({ x: Math.random(), y: Math.random(),
                   vx: (Math.random() - .5) * .00012, vy: (Math.random() - .5) * .00012 });
    }

    function spawn() {
      if (pulses.length > 5) return;
      var a = (Math.random() * nodes.length) | 0, b = (Math.random() * nodes.length) | 0;
      if (a !== b) pulses.push({ a: a, b: b, t: 0 });
    }

    function draw(animate) {
      x.clearRect(0, 0, w, h);
      var i, j;
      if (animate) {
        for (i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          n.x += n.vx; n.y += n.vy;
          if (n.x < 0 || n.x > 1) n.vx *= -1;
          if (n.y < 0 || n.y > 1) n.vy *= -1;
        }
      }
      x.lineWidth = dpr;
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < .16) {
            x.strokeStyle = 'rgba(' + NODE + ',' + (0.1 * (1 - d / .16)) + ')';
            x.beginPath(); x.moveTo(a.x * w, a.y * h); x.lineTo(b.x * w, b.y * h); x.stroke();
          }
        }
      }
      for (i = 0; i < nodes.length; i++) {
        x.fillStyle = 'rgba(' + NODE + ',.30)';
        x.beginPath(); x.arc(nodes[i].x * w, nodes[i].y * h, 1.1 * dpr, 0, 6.283); x.fill();
      }
      for (var p = pulses.length - 1; p >= 0; p--) {
        var pu = pulses[p]; pu.t += .012;
        if (pu.t >= 1) { pulses.splice(p, 1); continue; }
        var na = nodes[pu.a], nb = nodes[pu.b];
        var px = (na.x + (nb.x - na.x) * pu.t) * w, py = (na.y + (nb.y - na.y) * pu.t) * h;
        var g = x.createRadialGradient(px, py, 0, px, py, 14 * dpr);
        g.addColorStop(0, 'rgba(' + SIG + ',' + (0.55 * (1 - Math.abs(pu.t - .5) * 2)) + ')');
        g.addColorStop(1, 'rgba(' + SIG + ',0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, 14 * dpr, 0, 6.283); x.fill();
      }
    }

    function frame() { if (!running) return; draw(true); requestAnimationFrame(frame); }

    function start() {
      if (running || reduce) return;
      running = true; requestAnimationFrame(frame);
      if (!spawnTimer) spawnTimer = setInterval(spawn, 900);
    }
    function stop() {
      running = false;
      if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    }

    draw(false);                                   /* one still frame, always */
    if (reduce) return;                            /* and that is the whole field */
    start();
    /* The field is fixed and full-viewport, so the only time it is unseen is
       when the tab is. Burning a rAF loop and a timer there is free to stop. */
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
  })();

  /* ---------------------- 2. momentum scroll ---------------------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on('scroll', ScrollTrigger.update);
  }

  /* ---------------------- 3. line reveals ---------------------- */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.utils.toArray('.rv').forEach(function (el) {
      var lines = el.querySelectorAll(':scope > span');
      if (!lines.length) return;
      gsap.set(lines, { yPercent: 115, opacity: 0 });     /* from-state, at runtime */
      gsap.to(lines, {
        yPercent: 0, opacity: 1, duration: 1.05, stagger: .085, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  /* ---------- 3b. skills stagger: the differentiator lands last ---------- */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.utils.toArray('.field .grp').forEach(function (g) {
      var chips = g.querySelectorAll('li');
      if (!chips.length) return;
      gsap.set(chips, { opacity: 0, y: 10 });
      gsap.to(chips, {
        opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .035,
        delay: g.classList.contains('grp-lit') ? .18 : 0,
        scrollTrigger: { trigger: '.field', start: 'top 85%', once: true }
      });
    });
  }

  /* ---------------------- 4. the rail ---------------------- */
  (function () {
    var rail = document.getElementById('rail');
    if (!rail) return;
    var trace = rail.querySelector('.trace'), head = rail.querySelector('.head');
    /* One tick per section, plus one per Work panel — the request moving through
       three systems shows as three ticks close together in the band. */
    var sections = [].slice.call(document.querySelectorAll('main > section, [data-tick]'));
    var ticks = sections.map(function () {
      var t = document.createElement('div'); t.className = 'tick'; rail.appendChild(t); return t;
    });
    var tops = [], docH = 1, vh = 1, ticking = false;
    var terminal = document.querySelector('.terminal'), terminalTop = 0, landed = false;

    /* Geometry is read on resize, not on scroll. Reading layout inside a
       scroll handler is the classic way a smooth page starts thrashing. */
    function layout() {
      vh = innerHeight;
      docH = Math.max(document.body.scrollHeight, 1);
      if (terminal) terminalTop = terminal.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      tops = sections.map(function (s, i) {
        var top = s.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
        ticks[i].style.top = ((top / docH) * vh) + 'px';
        return top;
      });
    }
    function paint() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = docH - vh;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      trace.style.transform = 'scaleY(' + p + ')';
      head.style.transform = 'translateY(' + (p * vh) + 'px)';
      if (!landed && terminal && (terminalTop - y) < vh * 0.75) {
        terminal.classList.add('landed'); landed = true;   /* once, never looping */
      }
      for (var i = 0; i < sections.length; i++) {
        var rel = tops[i] - y;                         /* from cached geometry */
        var lit = rel < vh * 0.62;
        ticks[i].classList.toggle('lit', lit);
        var inView = lit && rel + sections[i].offsetHeight > vh * 0.2;
        var unit = sections[i].querySelector('.unit');
        if (unit) {
          unit.classList.toggle('live', inView);
          /* The toolset filter latches rather than toggling. It carries
             information, not tone — "the tools outside this role are not
             reachable" is a fact about the system, so re-running it on every
             pass would make it a loop, and un-running it on scroll-past would
             unsay it. The dimmed items also carry visually-hidden "outside
             this role" text; the meaning must not live in opacity alone. */
          if (inView && sections[i].hasAttribute('data-filter')) unit.classList.add('filtered');
        }
        /* Same reasoning: identity, once attached, stays attached. */
        if (inView && sections[i].hasAttribute('data-chip')) {
          var loose = sections[i].querySelector('.chip-loose');
          if (loose) loose.classList.add('lit');
        }
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }

    layout(); paint();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { layout(); paint(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); paint(); });
  })();

  /* ---------------------- 5. the gate ---------------------- */
  (function () {
    var gate = document.getElementById('gate');
    if (!gate) return;
    var status = gate.querySelector('.status');
    var approve = gate.querySelector('[data-act="approve"]');
    var reject = gate.querySelector('[data-act="reject"]');
    var highT = gate.querySelector('[data-high-t]'), highS = gate.querySelector('[data-high-s]');
    var lowT = gate.querySelector('[data-low-t]'), lowS = gate.querySelector('[data-low-s]');
    var DEF = { ht: highT.textContent, hs: highS.textContent, lt: lowT.textContent, ls: lowS.textContent };

    function reset() {
      highT.textContent = DEF.ht; highS.textContent = DEF.hs;
      lowT.textContent = DEF.lt; lowS.textContent = DEF.ls;
    }
    /* Approve and Reject are inert unless something is held — otherwise the
       panel can be driven to "approved" with nothing ever gated, and the
       demonstration contradicts the claim it exists to make. Disabled rather
       than hidden: the controls visibly exist and are inert until a write
       earns them, and they leave the tab order meanwhile. */
    function setState(s, msg) {
      gate.dataset.state = s;
      var held = (s === 'held');
      approve.disabled = !held;
      reject.disabled = !held;
      status.innerHTML = msg;
      /* Focus is deliberately not moved; the live region announces it. */
    }

    gate.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function () {
        reset();
        if (b.dataset.send === 'low') {
          lowT.textContent = 'Committed'; lowS.textContent = 'no approval needed';
          setState('low', 'Low-risk write committed. The policy let it through — <b>nobody was asked</b>.');
        } else {
          setState('held', 'High-risk write is <b>held at the gate</b>. Nothing has landed.');
        }
      });
    });
    approve.addEventListener('click', function () {
      if (gate.dataset.state !== 'held') return;        /* second guard, deliberate */
      highT.textContent = 'Committed'; highS.textContent = 'landed on your approval';
      setState('approved', 'Approved. The write committed — <b>and only now</b>.');
    });
    reject.addEventListener('click', function () {
      if (gate.dataset.state !== 'held') return;
      highT.textContent = 'Nothing landed'; highS.textContent = 'the request returns to proposed';
      setState('rejected', 'Rejected. <b>Nothing landed.</b> The system is unchanged.');
    });
  })();
})();
