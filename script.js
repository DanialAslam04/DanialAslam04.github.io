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

     Getting to that first row took three attempts, because the obvious
     measurement is not the right one. Driving the page and comparing travel
     to the delta you ASKED for measures the harness: Playwright's
     mouse.wheel doubles deltaY in a desktop context, and so does CDP's
     dispatchMouseEvent, so a request for 600 arrives as 1200. By that
     reading Lenis looks like it doubles, and it does not — it applies
     exactly the delta it is handed.

     The question that matters is what native does with the SAME delivered
     event, and there the difference is real and constant:

       delivered deltaY   native travel   Lenis travel
       200                100px (0.50x)   200px (1.00x)
       600                300px (0.50x)   600px (1.00x)
       1200               600px (0.50x)   1200px (1.00x)

     Chromium's own wheel handling scales a pixel-mode delta so that PHYSICAL
     travel stays constant, and Lenis does not, so the page goes further than
     the browser would have taken it for the same flick of the same wheel.

     The scaling is by device pixel ratio, which is why the multiplier cannot
     be a constant. Measured, one identical event, same page:

       viewport/dsf   delivered   native   x0.5    x0.5*dpr
       375  / 1       1100        550px    550px   550px
       1280 / 2       550         550px    275px   550px
       390  / 3       367         550px    183px   550px

     Native holds 550px throughout; a flat 0.5 only lands at dsf1, where it
     happened to be tuned. Real phones are dsf 2-3, so a constant would have
     left the page scrolling at a half to a third of native on exactly the
     devices most of the audience uses — the original defect inverted, and
     worse, because too slow reads as broken rather than merely slippery.

     Hence 0.5 * devicePixelRatio, recomputed when the ratio changes: DPR is
     not fixed for the life of a page, it moves when a window is dragged to
     another display or the browser is zoomed.

     This applies only to wheel input, so touch devices — which send no wheel
     events — are untouched; a mobile emulation driven by a synthetic wheel
     will read reduced traversal, and that is the harness, not the page.

     The tail is the second defect and it is measured in time, not distance:
     with duration 1.1 the page kept moving for 1082ms after the input
     stopped, so you overshot what you aimed at and then waited to find out
     where you landed. That reads as lag even though every frame arrived on
     time, which is why no frame-rate instrument ever caught it. A shorter
     duration brings the tail to roughly a native flick and it still starts
     moving sooner than native does. */
  var lenis = null;
  function wheelScale() { return .5 * (window.devicePixelRatio || 1); }
  if (!reduce && window.Lenis) {
    /* anchors:true because a native anchor jump and Lenis fight each other.
       The browser sets scrollY, then Lenis's next frame pulls it back toward
       its own targetScroll, and which wins is a race. Measured on a phone:
       four of five nav links landed and #build went to 295 instead of 2878
       while still setting location.hash — a link that changes the URL and
       does not travel is the worst form of this, because it looks like it
       worked. One scroller owns anchors now, so there is nothing to race. */
    lenis = new Lenis({ duration: .35, smoothWheel: true, wheelMultiplier: wheelScale(), anchors: true });
    window.__lenis = lenis;   /* so an instrument can isolate it without a rebuild */
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);

    /* Both option objects, deliberately. The wheel handler is installed on
       lenis.virtualScroll and reads ITS options — lenis.options is a
       different object, and writing only that one is a silent no-op. Tested:
       setting lenis.options alone changed nothing at all. Writing both means
       that if a future version consolidates them this keeps working, and if
       the internal moves again the worst case is a stale multiplier after a
       display change rather than a broken page. */
    function setWheelScale() {
      var v = wheelScale();
      if (!lenis) return;
      if (lenis.options) lenis.options.wheelMultiplier = v;
      if (lenis.virtualScroll && lenis.virtualScroll.options) {
        lenis.virtualScroll.options.wheelMultiplier = v;
      }
    }
    /* Drag the window to a display with a different pixel ratio and the
       tuning silently inverts, so track it. resize covers both causes — a
       display change and a zoom — and the guard means this costs a compare
       per resize and nothing else. */
    var dpr = window.devicePixelRatio || 1;
    window.addEventListener('resize', function () {
      var now = window.devicePixelRatio || 1;
      if (now === dpr) return;
      dpr = now;
      setWheelScale();
    });
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

  /* ---------------------- 4. the rail ----------------------
     Two node lists, deliberately, and they used to be one.

     The ticks mark sections: six now rather than thirteen, so the signal has
     fewer, heavier movements and the marks sit far enough apart to be read
     as a position rather than a texture. They carry no labels — the section
     names live on the dividers and in the right nav, and a third copy on
     the rail was three of the same six words on one screen.

     The live lighting marks BLOCKS — the three stages and the gate, which
     after the consolidation all live inside one section. The old code took
     querySelector('.unit') off the tick node, so collapsing to six ticks
     would have found only the first stage's unit and the other two would
     never have lit again. Separate lists, separate jobs. */
  (function () {
    var rail = document.getElementById('rail');
    if (!rail) return;
    var trace = rail.querySelector('.trace'), head = rail.querySelector('.head');

    var sections = [].slice.call(document.querySelectorAll('main > section'));
    var ticks = sections.map(function (sec) {
      var t = document.createElement('div');
      t.className = 'tick';
      rail.appendChild(t);
      return t;
    });
    var live = [].slice.call(document.querySelectorAll('[data-live]'));

    /* ---- the right-hand scrollbar ----
       A real control, not a second menu: track, proportional thumb, draggable,
       with the section marks the left rail carries so it orients as well as
       scrolls. Built here rather than in the markup so that with no JS there
       is no inert control sitting on the page pretending to work.

       aria-hidden deliberately. This is a pointer affordance for someone
       without a wheel; keyboard users already have arrows, Page keys and
       Home/End, and a half-built role="scrollbar" would be worse than an
       honest decoration beside working keyboard scrolling. */
    var vbar = document.createElement('div');
    vbar.className = 'vbar';
    vbar.setAttribute('aria-hidden', 'true');
    var vhit = document.createElement('div'); vhit.className = 'vbar-hit';
    var vthumb = document.createElement('div'); vthumb.className = 'vbar-thumb';
    vhit.appendChild(vthumb);
    vbar.appendChild(vhit);
    var vmarks = sections.map(function (sec) {
      var name = sec.getAttribute('data-rail');
      if (!name) return null;
      var m = document.createElement('div');
      m.className = 'vbar-mark';
      m.innerHTML = '<i></i><span>' + name + '</span>';
      m.dataset.target = sec.id;
      vbar.appendChild(m);
      return m;
    });
    document.body.appendChild(vbar);

    var trackTop = 0, trackH = 0, thumbH = 36, dragging = false, grabAt = 0;

    function goTo(y, immediate) {
      y = Math.max(0, Math.min(y, docH - vh));
      if (lenisRef()) lenisRef().scrollTo(y, { immediate: !!immediate });
      else window.scrollTo(0, y);
    }
    function lenisRef() { return window.__lenis || null; }

    function yFromPointer(clientY) {
      var span = Math.max(1, trackH - thumbH);
      var pos = Math.max(0, Math.min(clientY - trackTop - grabAt, span));
      return (pos / span) * Math.max(1, docH - vh);
    }

    vhit.addEventListener('pointerdown', function (e) {
      var r = vthumb.getBoundingClientRect();
      var onThumb = e.clientY >= r.top && e.clientY <= r.bottom;
      grabAt = onThumb ? (e.clientY - r.top) : thumbH / 2;
      dragging = true;
      vbar.classList.add('dragging');
      vhit.setPointerCapture(e.pointerId);
      goTo(yFromPointer(e.clientY), true);
      e.preventDefault();
    });
    vhit.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      goTo(yFromPointer(e.clientY), true);   /* immediate: a drag is 1:1 or it fights you */
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      vbar.classList.remove('dragging');
      try { vhit.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    vhit.addEventListener('pointerup', endDrag);
    vhit.addEventListener('pointercancel', endDrag);

    /* A mark is a destination, so it animates like any other jump. */
    vbar.addEventListener('click', function (e) {
      var m = e.target && e.target.closest ? e.target.closest('.vbar-mark') : null;
      if (!m) return;
      var sec = document.getElementById(m.dataset.target);
      if (!sec) return;
      var margin = parseFloat(getComputedStyle(sec).scrollMarginTop) || 0;
      goTo(sec.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - margin, reduce);
    });


    var tops = [], litState = [];
    var liveTops = [], liveHeights = [], liveUnits = [], liveOn = [];
    var docH = 1, vh = 1, ticking = false;
    var terminal = document.querySelector('.terminal'), terminalTop = 0, landed = false;

    /* Geometry is read on resize, not on scroll. Reading layout inside a
       scroll handler is the classic way a smooth page starts thrashing. */
    function layout() {
      vh = innerHeight;
      docH = Math.max(document.body.scrollHeight, 1);

      /* Pin only the bar's nav row on phones: the sticky offset is the
         identity row's height, which varies with how the bar wraps (121px at
         360, 61px at 414). Hard-coding one of those breaks the other, so it
         is measured here and read by CSS. Layout time only — never a frame. */
      var bar = document.querySelector('.bar'), barNav = document.querySelector('.bar-nav');
      if (bar && barNav) {
        var navH = barNav.offsetHeight;
        /* less 1px: subpixel bar heights otherwise park the nav row's own
           top border just above the viewport edge. */
        var idH = Math.max(0, bar.offsetHeight - navH - 1);
        var root = document.documentElement.style;
        root.setProperty('--bar-pin', (-idH) + 'px');
        root.setProperty('--bar-nav-h', navH + 'px');
        root.setProperty('--bar-h', bar.offsetHeight + 'px');
      }
      var y = window.scrollY || window.pageYOffset;
      if (terminal) terminalTop = terminal.getBoundingClientRect().top + y;
      tops = sections.map(function (s, i) {
        var top = s.getBoundingClientRect().top + y;
        ticks[i].style.top = ((top / docH) * vh) + 'px';
        return top;
      });
      var vr = vhit.getBoundingClientRect();
      trackTop = vr.top; trackH = vr.height;
      thumbH = Math.max(36, Math.round(trackH * Math.min(1, vh / docH)));
      vthumb.style.height = thumbH + 'px';          /* height here, never per frame */
      for (var k = 0; k < vmarks.length; k++) {
        if (!vmarks[k]) continue;
        vmarks[k].style.top = ((tops[k] / docH) * trackH) + 'px';
      }

      liveTops = live.map(function (el, i) {
        liveHeights[i] = el.offsetHeight;
        liveUnits[i] = el.querySelector('.unit') || el;
        return el.getBoundingClientRect().top + y;
      });
    }

    function paint() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = docH - vh;
      var p = max > 0 ? Math.min(y / max, 1) : 0;
      trace.style.transform = 'scaleY(' + p + ')';
      head.style.transform = 'translateY(' + (p * vh) + 'px)';
      /* transform only — a top/height write here is a layout every frame,
         which is the thing the trace was rewritten to avoid. */
      vthumb.style.transform = 'translateY(' + (p * (trackH - thumbH)) + 'px)';
      if (!landed && terminal && (terminalTop - y) < vh * 0.75) {
        terminal.classList.add('landed'); landed = true;   /* once, never looping */
      }
      /* Only write when the value actually changes. classList.toggle with a
         forced boolean still writes, and a write invalidates style whether
         or not the class moved. */
      for (var i = 0; i < sections.length; i++) {
        var lit = (tops[i] - y) < vh * 0.62;
        if (litState[i] !== lit) {
          litState[i] = lit;
          ticks[i].classList.toggle('lit', lit);
        }
      }
      for (var j = 0; j < live.length; j++) {
        var rel = liveTops[j] - y;
        var inView = rel < vh * 0.62 && rel + liveHeights[j] > vh * 0.2;
        var unit = liveUnits[j];
        if (liveOn[j] !== inView) { liveOn[j] = inView; unit.classList.toggle('live', inView); }
        /* The toolset filter latches rather than toggling. It carries
           information, not tone — "the tools outside this role are not
           reachable" is a fact about the system, so re-running it on every
           pass would make it a loop, and un-running it on scroll-past would
           unsay it. The dimmed items also carry visually-hidden "outside
           this role" text; the meaning must not live in opacity alone. */
        if (inView && live[j].hasAttribute('data-filter') && !unit.classList.contains('filtered')) {
          unit.classList.add('filtered');
        }
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
      /* The visible chip, not the button's full text — the button also holds
         the " — outside this role" that only a screen reader reads. */
      var face = btn.querySelector('.tool-face');
      return (face ? face.textContent : btn.textContent).trim();
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
      setState('approved', 'Approved. The write committed — <b>and not a moment before</b>.');
    });
    reject.addEventListener('click', function () {
      if (gate.dataset.state !== 'held') return;
      highT.textContent = 'Nothing landed'; highS.textContent = 'the request returns to proposed';
      setState('rejected', 'Rejected. <b>Nothing landed.</b> The system is unchanged.');
    });
  })();
})();
