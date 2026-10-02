/* Theme toggle. Tier 0 build: no motion layer yet, so there is no reveal
   observer here — every element on the page is visible at rest, which is also
   the rule the motion layer has to keep when it lands (an element hidden in
   base CSS and revealed only inside @supports is invisible forever in Firefox
   and WebKit). The pre-paint half of the theme runs inline in <head>. */

(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function activeTheme() {
    return root.getAttribute('data-theme') || systemTheme();
  }

  function syncLabel() {
    var next = activeTheme() === 'light' ? 'dark' : 'light';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  toggle.addEventListener('click', function () {
    var next = activeTheme() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* private mode or blocked storage — the theme still applies for this visit */
    }
    syncLabel();
  });

  syncLabel();

  /* Keep a focused nav link fully in view. The row scrolls horizontally on
     narrow screens, and browsers only auto-scroll an element that is entirely
     outside the scroller — a partially visible link keeps its focus ring
     clipped and nothing fires. block:'nearest' stops the page jumping too. */
  var navList = document.querySelector('.site-nav ul');
  if (navList) {
    navList.addEventListener('focusin', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a') : null;
      if (link && typeof link.scrollIntoView === 'function') {
        link.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
    });
  }

  /* Follow the OS while the visitor has never pressed the toggle. */
  if (window.matchMedia) {
    var q = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function () { if (!root.hasAttribute('data-theme')) syncLabel(); };
    if (q.addEventListener) q.addEventListener('change', onChange);
    else if (q.addListener) q.addListener(onChange);
  }
})();

/* ─────────────── Stage B: the preview-then-confirm gate ───────────────
   A state machine over a data attribute, not an animation. Every state is
   reachable with transitions suppressed, so the gate stays fully operable
   under prefers-reduced-motion — that is not a degraded page, it is the page
   for anyone who asked for less motion.

   The controls are injected visible only here, so with JavaScript off the
   poster above stands alone and there are no dead buttons. */

(function () {
  'use strict';

  var flow = document.querySelector('.flow');
  var demo = flow && flow.querySelector('.gate-demo');
  if (!demo) return;

  var decision = demo.querySelector('.gate-decision');
  var status = demo.querySelector('.gate-status');

  var MESSAGES = {
    low: 'Low-risk write committed. Policy let it through \u2014 no approval asked for, nothing waiting.',
    held: 'High-risk write held at the gate. Nothing has landed yet; it is waiting on a decision.',
    approved: 'Approved. The write committed \u2014 and only now.',
    rejected: 'Rejected. Nothing landed. The request goes back to proposed, and the system is unchanged.'
  };

  function set(state) {
    flow.setAttribute('data-state', state);
    decision.hidden = (state !== 'held');
    status.textContent = MESSAGES[state];
    /* Focus is deliberately not moved. The live region announces the change;
       taking focus would move it out from under whoever pressed the button. */
  }

  demo.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('button') : null;
    if (!el) return;
    var send = el.getAttribute('data-send');
    var decide = el.getAttribute('data-decide');
    if (send === 'low') set('low');
    else if (send === 'high') set('held');
    else if (decide === 'approve') set('approved');
    else if (decide === 'reject') set('rejected');
  });

  demo.hidden = false;
})();

