/* Theme toggle + on-scroll reveal. No dependencies.
   The pre-paint half of this (reading the stored theme, opting into the reveal
   animation) runs inline in <head> so neither one flashes before this file loads. */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- theme ---------- */

  var toggle = document.getElementById('theme-toggle');

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function activeTheme() {
    return root.getAttribute('data-theme') || systemTheme();
  }

  function syncToggleLabel() {
    if (!toggle) return;
    var next = activeTheme() === 'light' ? 'dark' : 'light';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = activeTheme() === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* private mode or blocked storage — the theme still applies for this visit */
      }
      syncToggleLabel();
    });
    syncToggleLabel();
  }

  /* Follow the OS if the visitor has never pressed the toggle. */
  if (window.matchMedia) {
    var query = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function () {
      if (!root.hasAttribute('data-theme')) syncToggleLabel();
    };
    if (query.addEventListener) query.addEventListener('change', onChange);
    else if (query.addListener) query.addListener(onChange);
  }

  /* ---------- reveal on scroll ---------- */

  if (!root.classList.contains('js-reveal')) return;

  var items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  items.forEach(function (item) { observer.observe(item); });
})();
