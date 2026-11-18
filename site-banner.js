/* SITE-BANNER-v1 – Hinweisbalken für randl.group.
   Konfiguration: /site-banner.json (Pflege im Mitarbeiterportal).
   Sync aus localStorage, dann fetch. Nur textContent, Fehler still. */
(function () {
  'use strict';
  var KEY = 'randl-site-banner';
  var CSS_ID = 'site-banner-css';
  var STYLES = { rot: 1, dunkel: 1, hell: 1 };

  // Fallback-Hexwerte nur hier: nicht jede Seite lädt /style.css
  var CSS = [
    '.site-banner{position:relative;z-index:50;box-sizing:border-box;',
    'display:flex;align-items:center;justify-content:center;flex-wrap:wrap;',
    'gap:.4rem .8rem;min-height:44px;padding:.45rem 1rem;text-align:center;',
    'font-family:"Barlow Condensed",sans-serif;font-weight:600;font-size:.95rem;',
    'letter-spacing:.12em;text-transform:uppercase;line-height:1.25;',
    'text-decoration:none;color:#fff;background:var(--spark-dark,#a83020)}',
    'a.site-banner{cursor:pointer}',
    '.site-banner--rot{background:var(--spark-dark,#a83020);color:#fff}',
    '.site-banner--dunkel{background:var(--panel,#111520);',
    'color:var(--text-1,rgba(255,255,255,.92));',
    'border-bottom:1px solid var(--panel-border,#222840)}',
    '.site-banner--hell{background:#f0eeea;color:#1a1a1a;',
    'border-bottom:1px solid #e0ddd8}',
    '[data-theme="light"] .site-banner--dunkel{background:#111520;',
    'color:#fff}',
    '.site-banner__badge{display:inline-block;padding:.1rem .65rem;',
    'border-radius:999px;background:#fff;color:#a83020;font-size:.78rem;',
    'letter-spacing:.14em}',
    '.site-banner--dunkel .site-banner__badge{background:#a83020;color:#fff}',
    '.site-banner--hell .site-banner__badge{background:#a83020;color:#fff}',
    '.site-banner__link{text-decoration:underline;text-underline-offset:3px;',
    'white-space:nowrap}',
    'a.site-banner:hover .site-banner__link,a.site-banner:focus-visible ',
    '.site-banner__link{text-decoration-thickness:2px}',
    'a.site-banner:focus-visible{outline:2px solid currentColor;',
    'outline-offset:-4px}',
    '@media print{.site-banner{display:none}}'
  ].join('');

  function isActive(cfg, now) {
    if (!cfg || cfg.enabled !== true || !cfg.text) return false;
    if (cfg.startAt) {
      var s = Date.parse(cfg.startAt);
      if (!isNaN(s) && s > now) return false;
    }
    if (cfg.endAt) {
      var e = Date.parse(cfg.endAt);
      if (!isNaN(e) && e <= now) return false;
    }
    return true;
  }

  function safeUrl(u) {
    if (typeof u !== 'string' || !u) return '';
    if (u.charAt(0) === '/' && u.charAt(1) !== '/') return u;
    if (/^https:\/\//i.test(u)) return u;
    return '';
  }

  function setHeight(px) {
    document.documentElement.style.setProperty(
      '--site-banner-h', px + 'px');
  }

  function remove() {
    var old = document.querySelector('.site-banner');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    setHeight(0);
  }

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function render(cfg) {
    if (!isActive(cfg, Date.now())) { remove(); return; }
    if (!document.body) return;
    ensureCss();
    var style = STYLES[cfg.style] ? cfg.style : 'rot';
    var url = safeUrl(cfg.linkUrl);
    var el = document.createElement(url ? 'a' : 'div');
    el.className = 'site-banner site-banner--' + style;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Hinweis');
    if (url) {
      el.setAttribute('href', url);
      if (/^https:/i.test(url)) el.setAttribute('rel', 'noopener');
    }
    if (cfg.badge) {
      var b = document.createElement('span');
      b.className = 'site-banner__badge';
      b.textContent = String(cfg.badge);
      el.appendChild(b);
    }
    var t = document.createElement('span');
    t.className = 'site-banner__text';
    t.textContent = String(cfg.text);
    el.appendChild(t);
    if (url && cfg.linkLabel) {
      var l = document.createElement('span');
      l.className = 'site-banner__link';
      l.textContent = String(cfg.linkLabel) + ' →';
      el.appendChild(l);
    }
    var old = document.querySelector('.site-banner');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    document.body.insertBefore(el, document.body.firstChild);
    setHeight(el.offsetHeight);
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeCache(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  try { render(readCache()); } catch (e) {}

  var bucket = Math.floor(Date.now() / 300000);
  try {
    fetch('/site-banner.json?v=' + bucket, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg || typeof cfg !== 'object') return;
        writeCache(cfg);
        render(cfg);
      })
      .catch(function () {});
  } catch (e) {}

  window.addEventListener('resize', function () {
    var el = document.querySelector('.site-banner');
    if (el) setHeight(el.offsetHeight);
  });
})();
