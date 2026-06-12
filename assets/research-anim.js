(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // ---------- data stream particles on hero poster ----------
  var poster = document.querySelector('.hx-research-hero .hx-poster');
  if (poster) {
    var stream = document.createElement('div');
    stream.className = 'hx-data-stream';
    stream.setAttribute('aria-hidden', 'true');

    for (var i = 0; i < 12; i++) {
      var particle = document.createElement('span');
      particle.style.left = (Math.random() * 100) + '%';
      particle.style.animationDelay = (Math.random() * 3) + 's';
      particle.style.animationDuration = (2 + Math.random() * 2) + 's';
      stream.appendChild(particle);
    }

    poster.appendChild(stream);
  }

  // ---------- stagger reveal for direction cards ----------
  var dirCards = document.querySelectorAll('.hx-dir-card');
  if (dirCards.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          setTimeout(function () {
            e.target.classList.add('is-revealed');
          }, idx * 150);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });

    dirCards.forEach(function (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(40px)';
      io.observe(card);
    });
  }

  // ---------- question cards sequential reveal ----------
  var questions = document.querySelectorAll('.hx-question');
  if (questions.length && 'IntersectionObserver' in window) {
    var qio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          setTimeout(function () {
            e.target.classList.add('is-revealed');
          }, idx * 120);
          qio.unobserve(e.target);
        }
      });
    }, { threshold: 0.25 });

    questions.forEach(function (q) {
      q.style.opacity = '0';
      q.style.transform = 'translateX(-30px)';
      qio.observe(q);
    });
  }

  // ---------- library links wave reveal ----------
  var libLinks = document.querySelectorAll('.hx-lib-link');
  if (libLinks.length && 'IntersectionObserver' in window) {
    var lio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var idx = Array.prototype.indexOf.call(libLinks, e.target);
          setTimeout(function () {
            e.target.classList.add('is-revealed');
          }, (idx % 3) * 80);
          lio.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });

    libLinks.forEach(function (link) {
      link.style.opacity = '0';
      link.style.transform = 'scale(0.9)';
      lio.observe(link);
    });
  }

  // ---------- add reveal transition styles ----------
  var style = document.createElement('style');
  style.textContent = `
    .hx-dir-card.is-revealed,
    .hx-question.is-revealed,
    .hx-lib-link.is-revealed {
      opacity: 1 !important;
      transform: none !important;
      transition: opacity 0.6s cubic-bezier(.2,.7,.2,1), transform 0.6s cubic-bezier(.2,.7,.2,1);
    }

    .hx-data-stream {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 1;
      opacity: 0.6;
    }

    .hx-data-stream span {
      position: absolute;
      top: -10px;
      width: 2px;
      height: 20px;
      background: linear-gradient(to bottom, transparent, #4cc9f0, transparent);
      border-radius: 2px;
      animation: hxDataFlow 3s linear infinite;
      filter: drop-shadow(0 0 4px #4cc9f0);
    }

    @keyframes hxDataFlow {
      0% { top: -10px; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 110%; opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();
