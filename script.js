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
