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
