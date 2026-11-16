/* ═══════════════════════════════════════════════════════════════════
   RANDL GROUP — Cloudflare Turnstile Wrapper
   Drop-in Ersatz für das Custom-CAPTCHA.

   SETUP (einmalig, ~2 Minuten):
   1. Gehe zu https://dash.cloudflare.com → "Turnstile" → "Add site"
   2. Domain: randl.group (und Subdomains)
   3. Widget-Typ: "Managed" (zeigt Haken wenn OK, Challenge wenn verdächtig)
   4. Kopiere den "Site Key" und ersetze TURNSTILE_SITE_KEY unten.
   5. Fertig — kein Server-Code nötig für Client-Validierung.

   API (identisch zum Custom-CAPTCHA):
     RandlCaptcha.render(containerSelector)
     RandlCaptcha.isValid()  → boolean
     RandlCaptcha.reset()
   ═══════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // ── Konfiguration ────────────────────────────────────────────────
  // Testkey '1x00000000000000000000AA' funktioniert sofort (always pass).
  // Ersetze ihn mit deinem echten Site Key von dash.cloudflare.com/turnstile
  const SITE_KEY = '0x4AAAAAAC0h0mMQ8XCtbKgn';  // ← HIER deinen Key eintragen

  // ── State ────────────────────────────────────────────────────────
  let _container  = null;
  let _widgetId   = null;
  let _valid      = false;
  let _scriptLoaded = false;

  // ── CSS ──────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('rc-css')) return;
    const s = document.createElement('style');
    s.id = 'rc-css';
    s.textContent = `
      .rc-wrap { margin-top: .25rem; }
      .rc-label {
        font-size: .73rem; font-weight: 500;
        letter-spacing: .07em; text-transform: uppercase;
        color: var(--text-2, rgba(255,255,255,.5));
        margin-bottom: .6rem; display: block;
      }
      .rc-label .rc-req { color: #f5a020; }
      .rc-box {
        background: var(--panel, #0d1020);
        border: 1px solid var(--panel-border, #222840);
        border-radius: 12px;
        padding: 1rem 1.1rem;
        transition: border-color .25s;
        display: flex; align-items: center; justify-content: center; min-height: 68px;
      }
      .rc-box.rc-error   { border-color: rgba(239,68,68,.5); }
      .rc-box.rc-success { border-color: rgba(34,197,94,.45); }
      .rc-err-hint {
        font-size: .72rem; color: rgba(239,68,68,.75);
        margin-top: .4rem; display: none;
      }
      .rc-err-hint.visible { display: block; }
      /* Turnstile iframe fits our dark theme */
      .cf-turnstile iframe { border-radius: 8px !important; }
    `;
    document.head.appendChild(s);
  }

  // ── Load Turnstile script ─────────────────────────────────────────
  function loadScript(cb) {
    if (_scriptLoaded) { cb(); return; }
    if (document.getElementById('cf-turnstile-script')) {
      // Already loading — wait for it
      document.getElementById('cf-turnstile-script').addEventListener('load', cb);
      return;
    }
    const script = document.createElement('script');
    script.id  = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => { _scriptLoaded = true; cb(); };
    document.head.appendChild(script);
  }

  // ── Render ────────────────────────────────────────────────────────
  function render(containerSelector) {
    _container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;
    if (!_container) return;

    _valid    = false;
    _widgetId = null;

    injectCSS();

    _container.innerHTML = `
      <div class="rc-wrap">
        <span class="rc-label">Sicherheitscheck <span class="rc-req">*</span></span>
        <div class="rc-box" id="rc-box">
          <div id="rc-turnstile-target"></div>
        </div>
        <span class="rc-err-hint" id="rc-err-hint">Bitte den Sicherheitscheck abschließen.</span>
      </div>
    `;

    loadScript(() => {
      if (typeof turnstile === 'undefined') return;
      _widgetId = turnstile.render('#rc-turnstile-target', {
        sitekey:   SITE_KEY,
        theme: 'auto',
        language:  'de',
        callback:  (token) => {
          _valid = !!token;
          const box  = document.getElementById('rc-box');
          const hint = document.getElementById('rc-err-hint');
          if (box)  { box.classList.remove('rc-error'); box.classList.add('rc-success'); }
          if (hint) hint.classList.remove('visible');
          _container.dispatchEvent(new CustomEvent('captcha:success'));
        },
        'expired-callback': () => {
          _valid = false;
        },
        'error-callback': () => {
          _valid = false;
        },
      });
    });
  }

  // ── isValid — called by form.js on submit ─────────────────────────
  function isValid() {
    if (_valid) return true;
    // Turnstile sets a hidden input — check it as fallback
    const input = _container
      ? _container.querySelector('[name="cf-turnstile-response"]')
      : document.querySelector('[name="cf-turnstile-response"]');
    if (input && input.value) { _valid = true; return true; }
    // Show error
    const box  = document.getElementById('rc-box');
    const hint = document.getElementById('rc-err-hint');
    if (box)  box.classList.add('rc-error');
    if (hint) hint.classList.add('visible');
    return false;
  }

  // ── reset ─────────────────────────────────────────────────────────
  function reset() {
    _valid = false;
    if (typeof turnstile !== 'undefined' && _widgetId !== null) {
      try { turnstile.reset(_widgetId); } catch(e) {}
    } else if (_container) {
      render(_container);
    }
  }

  // ── Public API ────────────────────────────────────────────────────
  global.RandlCaptcha = { render, isValid, reset };

})(window);

