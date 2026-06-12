(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- scroll reveal ----------
  var revealEls = document.querySelectorAll('.hx-reveal');
  if (revealEls.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  // ---------- spectrum bars (random heights + delays) ----------
  var spectrum = document.querySelector('.hx-spectrum');
  if (spectrum && spectrum.children.length === 0) {
    var BARS = 64;
    for (var i = 0; i < BARS; i++) {
      var b = document.createElement('span');
      var delay = (Math.random() * 1.2).toFixed(2);
      var dur = (0.8 + Math.random() * 1.0).toFixed(2);
      var h = (20 + Math.random() * 80).toFixed(0);
      b.style.animationDelay = delay + 's';
      b.style.animationDuration = dur + 's';
      b.style.height = h + '%';
      spectrum.appendChild(b);
    }
  }

  // ---------- pipeline flowlines ----------
  var pipeline = document.querySelector('.hx-pipeline');
  if (pipeline) {
    var grid = pipeline.querySelector('.hx-pipeline-grid');
    var stages = pipeline.querySelectorAll('.hx-stage');
    if (grid && stages.length >= 2) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      var flowWrap = document.createElement('div');
      flowWrap.className = 'hx-flow';
      flowWrap.setAttribute('aria-hidden', 'true');
      flowWrap.appendChild(svg);
      pipeline.insertBefore(flowWrap, grid);
      pipeline.classList.add('has-flow');

      // gradient defs
      svg.innerHTML =
        '<defs>' +
          '<linearGradient id="hxFlowGrad" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#4cc9f0" stop-opacity="0.1"/>' +
            '<stop offset="50%" stop-color="#9d7bff" stop-opacity="0.9"/>' +
            '<stop offset="100%" stop-color="#4ad6c4" stop-opacity="0.1"/>' +
          '</linearGradient>' +
        '</defs>';

      function draw() {
        // clear paths/circles
        Array.prototype.slice.call(svg.querySelectorAll('path, circle')).forEach(function (n) { n.remove(); });

        var rect = pipeline.getBoundingClientRect();
        svg.setAttribute('viewBox', '0 0 ' + rect.width + ' ' + rect.height);
        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', rect.height);

        for (var i = 0; i < stages.length - 1; i++) {
          var a = stages[i].getBoundingClientRect();
          var b = stages[i + 1].getBoundingClientRect();

          var sameRow = Math.abs(a.top - b.top) < 20;
          var x1, y1, x2, y2;
          if (sameRow) {
            x1 = a.right - rect.left;
            y1 = a.top + a.height / 2 - rect.top;
            x2 = b.left - rect.left;
            y2 = b.top + b.height / 2 - rect.top;
          } else {
            x1 = a.left + a.width / 2 - rect.left;
            y1 = a.bottom - rect.top;
            x2 = b.left + b.width / 2 - rect.left;
            y2 = b.top - rect.top;
          }

          var mx = (x1 + x2) / 2;
          var d = sameRow
            ? 'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + x2 + ' ' + y2
            : 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + ((y1 + y2) / 2) + ', ' + x2 + ' ' + ((y1 + y2) / 2) + ', ' + x2 + ' ' + y2;

          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'hx-flow-line');
          path.setAttribute('d', d);
          path.setAttribute('id', 'hx-flow-' + i);
          svg.appendChild(path);

          if (!reduce) {
            var pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pulse.setAttribute('class', 'hx-flow-pulse');
            pulse.setAttribute('r', '3.2');
            var anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
            anim.setAttribute('dur', '2.4s');
            anim.setAttribute('repeatCount', 'indefinite');
            anim.setAttribute('begin', (i * 0.6) + 's');
            var mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
            mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#hx-flow-' + i);
            anim.appendChild(mp);
            pulse.appendChild(anim);
            svg.appendChild(pulse);
          }
        }
      }

      draw();
      var rafId;
      window.addEventListener('resize', function () {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(draw);
      });
    }
  }
})();
