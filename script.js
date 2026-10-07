/* Portfolio C — the policy gate.
 *
 * In the artifact this was React state. The conversion to a static page drops
 * the runtime, so the interaction is rebuilt here in plain JS against the same
 * markup. Behaviour is the artifact's: a low-risk write commits without asking,
 * a high-risk write stops and waits for a decision.
 *
 * Everything is defensive about missing nodes — if the markup ever changes
 * shape, the page should still render and scroll rather than throw on load.
 */
(function () {
  'use strict';

  var status = document.getElementById('gate-status');
  var controls = document.getElementById('gate-controls');
  if (!status || !controls) return;

  var LINES = {
    idle:    'Nothing in flight.',
    low:     'Low-risk write committed. The policy let it through — nobody was asked.',
    high:    'High-risk write. Policy: hold at the gate. Waiting for approval.',
    approve: 'Approved. The write committed — and not a moment before.',
    reject:  'Rejected. Nothing landed, and nothing had to be undone.'
  };

  function say(key) {
    status.textContent = LINES[key];
    // the controls only exist while a decision is actually outstanding
    controls.hidden = key !== 'high';
  }

  document.addEventListener('click', function (e) {
    var send = e.target.closest ? e.target.closest('[data-risk]') : null;
    if (send) { say(send.getAttribute('data-risk') === 'high' ? 'high' : 'low'); return; }

    var act = e.target.closest ? e.target.closest('[data-act]') : null;
    if (act && !controls.hidden) { say(act.getAttribute('data-act')); }
  });

  /* Smooth in-page scrolling, honouring the OS reduced-motion setting. The
     artifact's anchors jumped; a sticky header makes a jump land under the bar,
     so offset by its height. */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    // The header is sticky and, on a phone, wraps to three rows — so a naive
    // jump lands the heading underneath it. Measure whatever is actually
    // sticky at the top rather than assuming a fixed height or a fixed path
    // through the DOM, because the conversion changed the nesting once already.
    var offset = 0;
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var cs = getComputedStyle(all[i]);
      if (cs.position === 'sticky' && parseFloat(cs.top || '999') <= 1) {
        offset = Math.max(offset, all[i].getBoundingClientRect().height);
        break;
      }
    }
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 12;
    window.scrollTo({ top: top, behavior: reduce.matches ? 'auto' : 'smooth' });
    // move keyboard focus too, or the skip link and nav are visual-only
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
})();

/* Portfolio C — the mobile header menu.
 *
 * Deliberately a second IIFE: the gate block above returns early when its
 * nodes are absent, and the menu must not be collateral damage of that.
 *
 * The CSS collapse is gated on .s1[data-nav], set here and nowhere else, so
 * no-JS keeps the old wrapped header with every link reachable rather than a
 * header with a dead button.
 */
(function () {
  'use strict';

  var bar  = document.querySelector('.s1');
  var btn  = document.getElementById('nav-toggle');
  var menu = document.getElementById('nav-menu');
  if (!bar || !btn || !menu) return;

  function near(e, sel) {
    return e.target && e.target.closest ? e.target.closest(sel) : null;
  }
  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
  function set(open) {
    bar.setAttribute('data-nav', open ? 'open' : 'closed');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    // the label names the action, not the state, or a screen reader reads the
    // button as "open menu" at the exact moment the menu is open
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  set(false);

  btn.addEventListener('click', function (e) {
    e.stopPropagation();          // keep the document handler from re-closing it
    set(!isOpen());
  });

  // a tap on a link dismisses the panel; the smooth scroll in the block above
  // still runs, and reads the sticky height correctly because the panel is
  // absolute and never changed that height
  menu.addEventListener('click', function (e) { if (near(e, 'a[href]')) set(false); });

  document.addEventListener('click', function (e) {
    if (isOpen() && !near(e, '.s3')) set(false);
  });

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) { set(false); btn.focus(); }
  });

  /* Rotating to landscape or widening past the breakpoint must not leave the
     panel latched open behind a header that no longer has a button to close
     it. addListener is the deprecated spelling, kept because Safari only
     learned addEventListener on MediaQueryList in 14. */
  var wide = window.matchMedia('(min-width:680px)');
  function onWide() { if (wide.matches && isOpen()) set(false); }
  if (wide.addEventListener) { wide.addEventListener('change', onWide); }
  else if (wide.addListener) { wide.addListener(onWide); }
})();
