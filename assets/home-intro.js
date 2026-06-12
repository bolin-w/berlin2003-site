(function () {
  'use strict';

  var KEY = 'hx_intro_seen_v1';
  var intro = document.getElementById('hx-intro');
  if (!intro) return;

  // If already seen, hide immediately and exit
  try {
    if (sessionStorage.getItem(KEY)) {
      intro.classList.add('is-gone');
      return;
    }
  } catch (e) {}

  document.documentElement.classList.add('hx-intro-lock');
  document.body.classList.add('hx-intro-lock');

  // ---------- build radial spectrum bars ----------
  var bars = intro.querySelector('.hx-intro-bars');
  if (bars) {
    var BAR_COUNT = window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 40 : 56;
    var radius = 160;
    for (var i = 0; i < BAR_COUNT; i++) {
      var b = document.createElement('i');
      var angle = (i / BAR_COUNT) * 360;
      var delay = (Math.random() * 1.2).toFixed(2);
      var dur = (0.9 + Math.random() * 0.8).toFixed(2);
      b.style.transform = 'rotate(' + angle + 'deg) translate(0, -' + radius + 'px)';
      b.style.animationDelay = delay + 's';
      b.style.animationDuration = dur + 's';
      bars.appendChild(b);
    }
  }

  // ---------- floating particles ----------
  var pts = intro.querySelector('.hx-intro-particles');
  if (pts) {
    var PARTICLE_COUNT = window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 8 : 14;
    for (var j = 0; j < PARTICLE_COUNT; j++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.bottom = '-10px';
      p.style.animationDelay = (Math.random() * 6).toFixed(2) + 's';
      p.style.animationDuration = (4 + Math.random() * 4).toFixed(2) + 's';
      var hue = Math.random();
      if (hue > 0.66) { p.style.background = '#9d7bff'; p.style.boxShadow = '0 0 8px #9d7bff'; }
      else if (hue > 0.33) { p.style.background = '#4ad6c4'; p.style.boxShadow = '0 0 8px #4ad6c4'; }
      pts.appendChild(p);
    }
  }

  // ---------- per-letter title stagger ----------
  var letters = intro.querySelectorAll('.hx-intro-title span');
  letters.forEach(function (el, idx) {
    el.style.animationDelay = (0.4 + idx * 0.05) + 's';
  });

  // ---------- dismiss handlers ----------
  var dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    intro.classList.add('is-out');
    document.documentElement.classList.remove('hx-intro-lock');
    document.body.classList.remove('hx-intro-lock');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    setTimeout(function () { intro.classList.add('is-gone'); }, 500);
    window.removeEventListener('wheel', onWheel, { passive: true });
    window.removeEventListener('touchmove', onWheel, { passive: true });
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('click', onClick);
  }

  function onWheel(e) {
    dismiss();
  }
  function onKey(e) {
    dismiss();
  }
  function onClick(e) {
    dismiss();
  }

  // arm dismiss immediately for better UX
  setTimeout(function () {
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
  }, 350);

  // auto-dismiss safety net
  setTimeout(dismiss, 2200);
})();
