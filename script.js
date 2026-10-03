/* ============================================================================
   The page is the pipeline. Three independent pieces:
     1. the rail            — scroll position IS the request's position
     2. the toolset         — call a tool, watch the boundary answer
     3. the gate            — a state machine; the climax

   Reduced motion is a complete page, not a stripped one: scrolling is native,
   reveals are skipped, and both the toolset and the gate stay fully operable.

   Nothing here is required for the content to be readable. Reveal from-states
   are set in JS precisely so that with JS off, nothing is hidden.
   ========================================================================== */

(function () {
  'use strict';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The ambient field used to live here: a canvas, a rAF loop, a spawn timer,
     a visibilitychange listener and a re-theme hook, all to suggest a system
     idling. The ground is now a 56px CSS grid and two breathing glows — the
     same idea, declared, with no main-thread cost and nothing to re-theme.
     ~95 lines and a per-frame loop removed. */

  /* ---------------------- 1a. nav focus ----------------------
     Its own block, deliberately. The last time this fix lived inside another
     section it was lost in a re-skin, and before that it sat below an early
     return and silently did not exist under reduced motion. Nothing above
     can skip it from here.

     The row scrolls horizontally on narrow screens, and a browser only
     auto-scrolls an element that is entirely outside the scroller — a
     partially visible link keeps its ring clipped and nothing fires.
     block:'nearest' stops the page jumping while it corrects. */
  (function () {
    var list = document.querySelector('.bar-nav ul');
    if (!list) return;
    list.addEventListener('focusin', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a && typeof a.scrollIntoView === 'function') {
        a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
    });
  })();

  /* ---------------------- 1b. theme ---------------------- */
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById('theme');
    if (!btn) return;
    function system() {
      return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    function active() { return root.getAttribute('data-theme') || system(); }
    function label() {
      btn.setAttribute('aria-label', 'Switch to ' + (active() === 'light' ? 'dark' : 'light') + ' theme');
    }
    btn.addEventListener('click', function () {
      root.setAttribute('data-theme', active() === 'light' ? 'dark' : 'light');
      try { localStorage.setItem('theme', root.getAttribute('data-theme')); } catch (e) {}
      label();
    });
    label();
    if (window.matchMedia) {
      var q = matchMedia('(prefers-color-scheme: light)');
      var on = function () { if (!root.hasAttribute('data-theme')) label(); };
      q.addEventListener ? q.addEventListener('change', on) : q.addListener && q.addListener(on);
    }
  })();

  /* ---------------------- 2. momentum scroll ----------------------
     The smoothing is the part that looks good. What was wrong was that the
     gesture had stopped meaning a distance:

                          input -> moving   travel for 600px   tail
       as built           49ms              1200px  (2.00x)    1082ms
       native             56ms              600px   (1.00x)    0ms
       now                37ms              600px   (1.00x)    345ms

     Two seconds of a page you did not ask for, every flick. You aimed at a
     section, sailed past it, and waited a full second to find out where you
     landed — which reads as lag even though every frame arrived on time, and
     which no frame-rate instrument could ever have caught.

     Lenis applies the wheel delta at twice its value: measured 2.00x at 150,
     300, 600 and 1200px and across a burst of four small events, so it is a
     constant factor and a multiplier is the right correction rather than a
     fudge. Halving it restores one-to-one; the shorter duration brings the
     tail down to roughly a native flick. It now starts moving sooner than
     native does. */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: .35, smoothWheel: true, wheelMultiplier: .5 });
    window.__lenis = lenis;   /* so an instrument can isolate it without a rebuild */
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on('scroll', ScrollTrigger.update);
  }

  /* ---------------------- 3. line reveals ---------------------- */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.utils.toArray('.rv').forEach(function (el) {
      var lines = el.querySelectorAll(':scope > span:not(.visually-hidden)');
      if (!lines.length) return;
      gsap.set(lines, { yPercent: 115, opacity: 0 });     /* from-state, at runtime */
      gsap.to(lines, {
        /* 1.05s put a three-line paragraph 1.22s from readable, and a fast
           scroller arrived at text still moving. What makes the page feel
           composed is the stagger — lines landing in sequence — not how long
           each line takes, so the duration came down and the sequence stayed. */
        yPercent: 0, opacity: 1, duration: .4, stagger: .06, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });
  }

  /* ---------- 3b. skills stagger ----------
     Measured, this was the slowest thing on the page: 1501ms worst case on
     mobile against a 17ms median everywhere else. Two causes, both here.

     The trigger was '.field' for every group, so one group arriving started
     all six sequences — by which time the later groups' chips were already
     on screen, waiting their turn in a queue that began off-screen. Each
     group now waits for itself.

     And the lit group carried a .18s delay so that "the differentiator lands
     last". That delay landed on Agentic AI, which is the content a recruiter
     came for, and made it the slowest block on the page. The group is
     already distinguished by colour and border; it does not also need to be
     late. The tell was that the worst case improved as scrolling got
     faster — a queue, not a duration.

     The stagger is now capped as a total rather than set per item, so a six
     chip group and a three chip group both finish in the same .12s. */
  if (window.gsap && window.ScrollTrigger && !reduce) {
    gsap.utils.toArray('.field .grp').forEach(function (g) {
      var chips = g.querySelectorAll('li');
      if (!chips.length) return;
      gsap.set(chips, { opacity: 0, y: 10 });
      gsap.to(chips, {
        opacity: 1, y: 0, duration: .3, ease: 'power2.out',
        stagger: { amount: .08 },
        scrollTrigger: { trigger: g, start: 'top 95%', once: true }
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
    var tops = [], heights = [], units = [], looses = [], litState = [], liveState = [];
    var docH = 1, vh = 1, ticking = false;
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
        heights[i] = s.offsetHeight;          /* read here, not every frame */
        units[i] = s.querySelector('.unit');  /* resolved once, not every frame */
        looses[i] = s.querySelector('.chip-loose');
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
        /* Only write when the value actually changes. classList.toggle with a
           forced boolean still writes, and a write invalidates style whether
           or not the class moved — thirteen ticks plus their units, every
           frame, was the bulk of the recalculation cost. */
        if (litState[i] !== lit) { litState[i] = lit; ticks[i].classList.toggle('lit', lit); }
        var inView = lit && rel + heights[i] > vh * 0.2;
        var unit = units[i];
        if (unit) {
          if (liveState[i] !== inView) { liveState[i] = inView; unit.classList.toggle('live', inView); }
          /* The toolset filter latches rather than toggling. It carries
             information, not tone — "the tools outside this role are not
             reachable" is a fact about the system, so re-running it on every
             pass would make it a loop, and un-running it on scroll-past would
             unsay it. The dimmed items also carry visually-hidden "outside
             this role" text; the meaning must not live in opacity alone. */
          if (inView && sections[i].hasAttribute('data-filter') && !unit.classList.contains('filtered')) unit.classList.add('filtered');
        }
        /* Same reasoning: identity, once attached, stays attached. */
        if (inView && looses[i] && !looses[i].classList.contains('lit')) looses[i].classList.add('lit');
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }

    layout(); paint();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { layout(); paint(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); paint(); });
  })();

  /* ---------------------- 4b. the toolset answers ----------------------
     The smallest honest version of "try something out of role". It makes no
     claim the page did not already make: the six strings and the allow/deny
     split are the ones that were rendered here before this was interactive,
     and the verdict is read from the markup's data-allow, not decided here.
     There is no authorisation model in this function — there is a lookup.

     States, all of them:
       S0  no JS, or no node          markup stands; the chips are labels and
                                      the sentence below them states the rule
       S1  JS present                 chips become operable, cursor changes
       S2  allowed tool called        chip lights, status names it
       S3  denied tool called         chip strikes through, status refuses
       S4  a second tool called       the previous verdict clears first, so
                                      two chips never both read as "current"
       S5  same tool called twice     status is cleared before it is rewritten
                                      so a live region re-announces identical
                                      text instead of staying silent
       S6  keyboard                   buttons, so Enter and Space already work
       S7  reduced motion             unchanged; this is state, not motion */
  (function () {
    var list = document.querySelector('.tools');
    var out  = document.querySelector('.tool-out');
    if (!list || !out) return;                                          /* S0 */

    var buttons = list.querySelectorAll('.tool');
    if (!buttons.length) return;
    list.classList.add('tools-live');                                   /* S1 */

    var REST = out.innerHTML;
    var pending = 0;

    function say(html) {
      /* A polite live region announces a change in text. Writing the same
         string twice is not a change, so the second refusal would be silent
         — which is exactly the case a visitor is most likely to produce. */
      if (pending) cancelAnimationFrame(pending);                       /* S5 */
      out.textContent = '';
      pending = requestAnimationFrame(function () {
        pending = 0;
        out.innerHTML = html;
      });
    }

    function name(btn) {
      return btn.firstChild && btn.firstChild.nodeValue
        ? btn.firstChild.nodeValue.trim()
        : btn.textContent.trim();
    }

    list.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.tool') : null;
      if (!btn) return;

      for (var i = 0; i < buttons.length; i++) {                        /* S4 */
        buttons[i].removeAttribute('data-said');
      }

      var allowed = btn.getAttribute('data-allow') === '1';
      btn.setAttribute('data-said', allowed ? 'allow' : 'deny');

      say(allowed                                                       /* S2 */
        ? '<code>' + name(btn) + '</code> returned. It is in this role\'s toolset.'
        : '<code>' + name(btn) + '</code> <b>refused.</b> Not filtered at the ' +
          'call — the agent never had that tool.');                     /* S3 */
    });
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
