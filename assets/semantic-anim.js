(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // ---------- timeline cards stagger reveal ----------
  var timelineCards = document.querySelectorAll('.hx-timeline-card');
  if (timelineCards.length && 'IntersectionObserver' in window) {
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          setTimeout(function () {
            e.target.classList.add('is-revealed');
          }, idx * 100);
          tio.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });

    timelineCards.forEach(function (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-40px)';
      tio.observe(card);
    });
  }

  // ---------- cut cards reveal ----------
  var cutCards = document.querySelectorAll('.hx-cut-card');
  if (cutCards.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          setTimeout(function () {
            e.target.classList.add('is-revealed');
          }, (idx % 2) * 120);
          cio.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });

    cutCards.forEach(function (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      cio.observe(card);
    });
  }

  // ---------- add reveal styles ----------
  var style = document.createElement('style');
  style.textContent = `
    .hx-timeline-card.is-revealed,
    .hx-cut-card.is-revealed {
      opacity: 1 !important;
      transform: none !important;
      transition: opacity 0.6s cubic-bezier(.2,.7,.2,1), transform 0.6s cubic-bezier(.2,.7,.2,1);
    }
  `;
  document.head.appendChild(style);
})();
