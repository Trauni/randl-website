/* ═══════════════════════════════════════════════════════════════════
   RANDL GROUP — Cookie Consent
   DSGVO-konform, kein externes CDN, passt zum Dark-CI
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'randl_cookie_consent';
  const EXPIRE_DAYS = 180;

  // ── Helpers ──────────────────────────────────────────────────────
  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  }
  function getCookie(name) {
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : null;
  }
  function getConsent() {
    try { return JSON.parse(getCookie(STORAGE_KEY) || 'null'); } catch { return null; }
  }
  function saveConsent(obj) {
    setCookie(STORAGE_KEY, JSON.stringify(obj), EXPIRE_DAYS);
  }

  // ── CSS ───────────────────────────────────────────────────────────
  const css = `
    #cc-banner {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 99999;
      background: #111520;
      border-top: 1px solid #222840;
      box-shadow: 0 -8px 40px rgba(0,0,0,.55);
      padding: 1.25rem clamp(1rem,4vw,3rem);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
      font-family: 'DM Sans', system-ui, sans-serif;
      transform: translateY(100%);
      transition: transform .4s cubic-bezier(.22,1,.36,1);
    }
    #cc-banner.cc-visible { transform: translateY(0); }

    #cc-text {
      font-size: .82rem;
      color: rgba(255,255,255,.5);
      line-height: 1.6;
      max-width: 640px;
      flex: 1;
    }
    #cc-text a {
      color: #ff0000;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    #cc-text strong { color: rgba(255,255,255,.8); font-weight: 500; }

    #cc-buttons {
      display: flex;
      gap: .75rem;
      align-items: center;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .cc-btn {
      display: inline-flex; align-items: center;
      padding: .55rem 1.3rem;
      border-radius: 8px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: .8rem; font-weight: 600;
      cursor: pointer; border: none;
      white-space: nowrap;
      transition: opacity .2s, transform .15s;
    }
    .cc-btn:hover { opacity: .88; transform: translateY(-1px); }
    .cc-btn:active { transform: translateY(0); }

    .cc-btn-accept {
      background: linear-gradient(135deg, #C33E2F, #C33E2F);
      color: #000;
    }
    .cc-btn-essential {
      background: transparent;
      color: rgba(255,255,255,.5);
      border: 1px solid #222840;
    }
    .cc-btn-essential:hover {
      border-color: rgba(245,160,32,.35);
      color: rgba(255,255,255,.8);
      background: rgba(245,160,32,.05);
    }

    /* Settings modal */
    #cc-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.7);
      z-index: 100000;
      display: flex; align-items: flex-end; justify-content: center;
      padding: 0 1rem 1rem;
      opacity: 0; pointer-events: none;
      transition: opacity .3s;
    }
    #cc-modal-overlay.cc-open { opacity: 1; pointer-events: auto; }

    #cc-modal {
      background: #111520;
      border: 1px solid #222840;
      border-radius: 16px;
      padding: 2rem;
      max-width: 540px; width: 100%;
      box-shadow: 0 -4px 60px rgba(0,0,0,.6);
      transform: translateY(20px);
      transition: transform .35s cubic-bezier(.22,1,.36,1);
      font-family: 'DM Sans', system-ui, sans-serif;
    }
    #cc-modal-overlay.cc-open #cc-modal { transform: translateY(0); }

    .cc-modal-title {
      font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
      font-size: 1.3rem; font-weight: 700;
      letter-spacing: .05em; text-transform: uppercase;
      color: rgba(255,255,255,.9);
      margin-bottom: 1rem;
    }
    .cc-modal-text {
      font-size: .82rem; color: rgba(255,255,255,.45);
      line-height: 1.65; margin-bottom: 1.5rem;
    }

    .cc-toggle-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: .9rem 0;
      border-top: 1px solid #222840;
    }
    .cc-toggle-label {
      font-size: .84rem; font-weight: 500;
      color: rgba(255,255,255,.75);
    }
    .cc-toggle-desc {
      font-size: .73rem; color: rgba(255,255,255,.35);
      margin-top: .2rem; line-height: 1.45;
    }

    .cc-toggle {
      position: relative; flex-shrink: 0;
      width: 40px; height: 22px; cursor: pointer;
    }
    .cc-toggle input { display: none; }
    .cc-track {
      position: absolute; inset: 0;
      border-radius: 11px;
      background: #222840;
      transition: background .2s;
    }
    .cc-toggle input:checked + .cc-track { background: #ff0000; }
    .cc-thumb {
      position: absolute;
      width: 16px; height: 16px;
      background: #fff;
      border-radius: 50%;
      top: 3px; left: 3px;
      transition: transform .2s;
      pointer-events: none;
    }
    .cc-toggle input:checked ~ .cc-thumb { transform: translateX(18px); }
    .cc-toggle.cc-required .cc-track { background: rgba(245,160,32,.3); cursor: not-allowed; }

    .cc-modal-actions {
      display: flex; gap: .75rem; margin-top: 1.5rem; justify-content: flex-end;
    }

    @media (max-width: 480px) {
      #cc-banner { flex-direction: column; align-items: flex-start; }
      #cc-buttons { width: 100%; }
      .cc-btn { flex: 1; justify-content: center; }
    }
  `;

  // ── Inject CSS ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Build Banner HTML ─────────────────────────────────────────────
  function buildBanner() {
    const banner = document.createElement('div');
    banner.id = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie-Einstellungen');
    banner.innerHTML = `
      <div id="cc-text">
        <strong>Wir verwenden Cookies.</strong>
        Neben technisch notwendigen Cookies setzen wir Analytics-Cookies ein, um unsere Website zu verbessern.
        Weitere Infos in unserer <a href="/datenschutz">Datenschutzerklärung</a>.
      </div>
      <div id="cc-buttons">
        <button class="cc-btn cc-btn-essential" id="cc-btn-settings">Einstellungen</button>
        <button class="cc-btn cc-btn-essential" id="cc-btn-essential">Nur notwendige</button>
        <button class="cc-btn cc-btn-accept" id="cc-btn-accept">Alle akzeptieren</button>
      </div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('cc-visible')));
    return banner;
  }

  // ── Build Modal ───────────────────────────────────────────────────
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'cc-modal-overlay';
    overlay.innerHTML = `
      <div id="cc-modal" role="dialog" aria-modal="true" aria-label="Cookie-Einstellungen">
        <div class="cc-modal-title">Cookie-Einstellungen</div>
        <p class="cc-modal-text">
          Wählen Sie, welche Cookies Sie zulassen möchten. Notwendige Cookies sind für die
          Funktionsfähigkeit der Website erforderlich und können nicht deaktiviert werden.
        </p>

        <div class="cc-toggle-row">
          <div>
            <div class="cc-toggle-label">Notwendige Cookies</div>
            <div class="cc-toggle-desc">Session, Sicherheit, Formularfunktion. Immer aktiv.</div>
          </div>
          <label class="cc-toggle cc-required">
            <input type="checkbox" checked disabled />
            <div class="cc-track"></div>
            <div class="cc-thumb"></div>
          </label>
        </div>

        <div class="cc-toggle-row">
          <div>
            <div class="cc-toggle-label">Analyse & Performance</div>
            <div class="cc-toggle-desc">Hilft uns zu verstehen, wie die Website genutzt wird (z. B. Seitenaufrufe).</div>
          </div>
          <label class="cc-toggle">
            <input type="checkbox" id="cc-toggle-analytics" />
            <div class="cc-track"></div>
            <div class="cc-thumb"></div>
          </label>
        </div>

        <div class="cc-modal-actions">
          <button class="cc-btn cc-btn-essential" id="cc-modal-save">Auswahl speichern</button>
          <button class="cc-btn cc-btn-accept" id="cc-modal-accept-all">Alle akzeptieren</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });
    return overlay;
  }

  let modal = null;
  function openModal() {
    if (!modal) modal = buildModal();
    modal.classList.add('cc-open');
    document.getElementById('cc-modal-accept-all').onclick = () => acceptAll();
    document.getElementById('cc-modal-save').onclick = () => {
      const analytics = document.getElementById('cc-toggle-analytics').checked;
      saveConsent({ necessary: true, analytics, timestamp: Date.now() });
      hideBanner();
      closeModal();
      dispatchEvent(analytics);
    };
  }
  function closeModal() {
    if (modal) modal.classList.remove('cc-open');
  }

  let banner = null;
  function hideBanner() {
    if (banner) {
      banner.style.transform = 'translateY(100%)';
      setTimeout(() => { if (banner) banner.remove(); banner = null; }, 400);
    }
  }

  function acceptAll() {
    saveConsent({ necessary: true, analytics: true, timestamp: Date.now() });
    hideBanner();
    closeModal();
    dispatchEvent(true);
  }
  function essentialOnly() {
    saveConsent({ necessary: true, analytics: false, timestamp: Date.now() });
    hideBanner();
    dispatchEvent(false);
  }
  function dispatchEvent(analytics) {
    window.dispatchEvent(new CustomEvent('cc:consent', { detail: { analytics } }));
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    const existing = getConsent();
    if (existing && (Date.now() - existing.timestamp) < EXPIRE_DAYS * 86400000) {
      dispatchEvent(existing.analytics);
      return;
    }
    banner = buildBanner();
    document.getElementById('cc-btn-accept').onclick    = acceptAll;
    document.getElementById('cc-btn-essential').onclick = essentialOnly;
    document.getElementById('cc-btn-settings').onclick  = openModal;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.RandlCookieConsent = { getConsent, openSettings: openModal };
})();
