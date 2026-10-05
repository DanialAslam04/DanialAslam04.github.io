/* Preview build — behaviour.
 *
 * Four things, all of them small on purpose: the policy gate, scroll reveals,
 * the reading rail, and the nav's current-section marker. Everything degrades
 * to a fully readable page if it never runs.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------- 1. reveals
     Anything already inside the first viewport is shown immediately rather
     than animated in. A reveal that hides what a reader is already looking
     at is not motion design, it is a blank screen. */
  var rv = [].slice.call(document.querySelectorAll('.rv'));
  if (!('IntersectionObserver' in window) || reduce.matches) {
    rv.forEach(function (e) { e.classList.add('in'); });
  } else {
    rv.forEach(function (e) {
      if (e.getBoundingClientRect().top < window.innerHeight) e.classList.add('in');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    rv.forEach(function (e) { if (!e.classList.contains('in')) io.observe(e); });

    // Nothing may stay hidden because an observer never fired — a stuck
    // reveal is indistinguishable from missing content.
    setTimeout(function () { rv.forEach(function (e) { e.classList.add('in'); }); }, 4000);
  }

  /* ---------------------------------------------------------- 2. the gate */
  var status = document.getElementById('gate-status');
  var controls = document.getElementById('gate-controls');
  var LINES = {
    idle:    'Nothing in flight.',
    low:     'Low-risk write committed. The policy let it through — nobody was asked.',
    high:    'High-risk write. Policy: hold at the gate. Waiting for approval.',
    approve: 'Approved. The write committed — and not a moment before.',
    reject:  'Rejected. Nothing landed, and nothing had to be undone.'
  };
  function say(k) {
    if (!status || !controls) return;
    status.textContent = LINES[k];
    controls.hidden = k !== 'high';
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var send = e.target.closest('[data-risk]');
    if (send) { say(send.getAttribute('data-risk') === 'high' ? 'high' : 'low'); return; }
    var act = e.target.closest('[data-act]');
    if (act && controls && !controls.hidden) say(act.getAttribute('data-act'));
  });

  /* ---------------------------------------------------------- 3. rail + current section
     One hairline of progress and a mark on the nav item being read. Both are
     derived from the same scroll handler so they can never disagree. */
  var rail = document.getElementById('rail');
  var links = [].slice.call(document.querySelectorAll('.bar-nav a[href^="#"]'));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var bar = document.querySelector('.bar');
  var ticking = false;

  function frame() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (rail) rail.style.width = (max > 0 ? (window.pageYOffset / max) * 100 : 0) + '%';

    var line = (bar ? bar.getBoundingClientRect().height : 0) + 24;
    var active = -1;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top <= line) active = i;
    }
    links.forEach(function (a, i) {
      if (i === active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();

  /* ---------------------------------------------------------- 4. anchors
     The header is sticky, so a native jump lands the heading underneath it.
     Measure the header rather than assume a height — it changes with the
     viewport, and a hard-coded number is wrong at the first breakpoint. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    var off = bar ? bar.getBoundingClientRect().height : 0;
    window.scrollTo({
      top: t.getBoundingClientRect().top + window.pageYOffset - off - 8,
      behavior: reduce.matches ? 'auto' : 'smooth'
    });
    t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });
})();
