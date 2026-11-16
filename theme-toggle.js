/* ═══════════════════════════════════════════════════════════════════
   RANDL GROUP — Theme Toggle
   Erwartet: <button id="theme-toggle-btn"> irgendwo im DOM
   FOUC-Prevention: Inline-Script im <head> jeder Seite nötig!
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  const STORAGE_KEY = 'randl-theme';
  const DEFAULT     = 'light';

  const ICONS = {
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1"  x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1"  y1="12" x2="3"  y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
           </svg>`
  };

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateBtn(theme);
  }

  function updateBtn(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    // Im Light Mode zeigen wir Mond (= "wechsel zu Dark"), im Dark den Mond (= "wechsel zu Light")
    btn.innerHTML = theme === 'light' ? ICONS.dark : ICONS.light;
    btn.setAttribute('aria-label',
      theme === 'light' ? 'Dark Mode aktivieren' : 'Light Mode aktivieren'
    );
  }

  function toggleTheme() {
    const current = getTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    // data-theme wurde bereits durch FOUC-Script gesetzt —
    // hier nur den Button-Icon synchronisieren
    updateBtn(getTheme());

    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  document.addEventListener('DOMContentLoaded', initTheme);

  // Global verfügbar falls andere Scripts toggleTheme() brauchen
  window.randlTheme = { toggle: toggleTheme, get: getTheme, apply: applyTheme };
})();
