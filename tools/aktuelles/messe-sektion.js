<script>
/* MESSE-2026-v1 – Lightbox + Ausblendung nach der Messe */
(function () {
  'use strict';

  // 1) Ausblenden nach data-messe-bis
  var now = Date.now();
  var timed = document.querySelectorAll('[data-messe-bis]');
  for (var i = 0; i < timed.length; i++) {
    var until = Date.parse(timed[i].getAttribute('data-messe-bis'));
    if (!isNaN(until) && now >= until) timed[i].hidden = true;
  }

  // 2) Reveal des Messe-Separators (wie #sep1)
  var sep = document.getElementById('sep-messe');
  if (sep && !sep.hidden) {
    if (window.gsap && window.ScrollTrigger) {
      gsap.to(sep, {
        scrollTrigger: { trigger: sep, start: 'top 80%' },
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out'
      });
    } else {
      sep.style.opacity = 1;
      sep.style.transform = 'none';
    }
  }

  // 3) Lightbox
  var box = document.getElementById('messe-lightbox');
  var items = document.querySelectorAll('.messe-gal-item');
  if (!box || !items.length) return;
  var img = box.querySelector('.mlb-img');
  var cap = box.querySelector('.mlb-cap');
  var cnt = box.querySelector('.mlb-count');
  var btnClose = box.querySelector('.mlb-close');
  var btnPrev = box.querySelector('.mlb-prev');
  var btnNext = box.querySelector('.mlb-next');
  var idx = 0, opener = null, touchX = null;

  function show(n) {
    idx = (n + items.length) % items.length;
    var src = items[idx].querySelector('img');
    img.src = src.getAttribute('src');
    img.alt = src.getAttribute('alt') || '';
    cap.textContent = src.getAttribute('alt') || '';
    cnt.textContent = (idx + 1) + ' / ' + items.length;
  }
  function open(n) {
    opener = items[n];
    show(n);
    box.hidden = false;
    document.documentElement.classList.add('mlb-lock');
    btnClose.focus();
  }
  function close() {
    box.hidden = true;
    document.documentElement.classList.remove('mlb-lock');
    img.removeAttribute('src');
    if (opener) opener.focus();
  }
  for (var k = 0; k < items.length; k++) {
    (function (n) {
      items[n].addEventListener('click', function () { open(n); });
    })(k);
  }
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', function () { show(idx - 1); });
  btnNext.addEventListener('click', function () { show(idx + 1); });
  box.addEventListener('click', function (e) {
    if (e.target === box || e.target.classList.contains('mlb-stage')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'Tab') {
      var f = [btnClose, btnPrev, btnNext];
      var pos = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(pos + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });
  box.addEventListener('touchstart', function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
</script>
