'use strict';

// ── N8N Platzhalter (für spätere Integration) ──────────────────────
const N8N_WEBHOOK = 'https://n8n.randlweb.de/webhook/GAS-UUID-HIER';
const CONTACT_URL = '/contact.php';

// ── Modus-Konfiguration ────────────────────────────────────────────
const MODES = {
  neukunde: {
    label:      'Neukunde',
    steps:      ['Kontakt', 'Adressen', 'Gasprofile', 'Lieferung'],
    totalSteps: 4,
    to:         'anfragen@randl.group',
    modus:      'neukunde',
    quelle:     'webformular-gas-neukunde',
  },
  bestellung: {
    label:      'Bestellung',
    steps:      ['Identifikation', 'Bestellung'],
    totalSteps: 2,
    to:         'bestellung@randl.group',
    modus:      'bestellung',
    quelle:     'webformular-gas-bestellung',
  },
};

let activeMode   = 'neukunde';
let currentStep  = 1;
let formOpenTime = Date.now();
let isSubmitting = false;

// ── DOM-Refs ───────────────────────────────────────────────────────
const form          = document.getElementById('inquiry-form');
const formCard      = document.getElementById('form-card');
const successScreen = document.getElementById('success-screen');
const btnNext       = document.getElementById('btn-next');
const btnBack       = document.getElementById('btn-back');
const btnSubmit     = document.getElementById('btn-submit');
const submitText    = document.getElementById('btn-submit-text');
const submitSpinner = document.getElementById('btn-submit-spinner');
const progressBar   = document.getElementById('progress-bar');
const stepDotsEl    = document.getElementById('step-dots');
const globalError   = document.getElementById('global-error');
const globalErrText = document.getElementById('global-error-text');

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindModeSwitch();
  activateMode('neukunde');
  bindNavButtons();
  bindFormSubmit();
  bindCharCounters();
  bindLiveValidation();
  bindRadioTiles();
  bindServiceTiles();
  bindAddressToggle();
});

// ── Modus-Umschalter ──────────────────────────────────────────────
function bindModeSwitch() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === activeMode) return;
      activateMode(mode);
    });
  });
}

function activateMode(mode) {
  activeMode  = mode;
  currentStep = 1;
  formOpenTime = Date.now();

  // Tabs updaten
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('mode-active', b.dataset.mode === mode);
  });

  // Alle Step-Sektionen verstecken
  document.querySelectorAll('.form-step').forEach(s => s.classList.add('hidden'));

  // Erste Step-Sektion des aktiven Modus zeigen
  const firstStep = document.querySelector(`[data-mode="${mode}"][data-step="1"]`);
  if (firstStep) firstStep.classList.remove('hidden');

  buildProgressDots();
  updateProgress();
  updateNavButtons();
  hideGlobalError();
  resetValidation();
}

// ── Progress ───────────────────────────────────────────────────────
function buildProgressDots() {
  const cfg = MODES[activeMode];
  stepDotsEl.innerHTML = '';
  cfg.steps.forEach((label, i) => {
    const step = i + 1;
    const dot  = document.createElement('div');
    dot.className = 'pdot';
    dot.id = `pdot-${step}`;
    dot.innerHTML = `<div class="pdot-circle" id="pdot-circle-${step}">${step}</div>
                     <span class="pdot-label">${label}</span>`;
    stepDotsEl.appendChild(dot);
  });
}

function updateProgress() {
  const cfg = MODES[activeMode];
  progressBar.style.width = `${(currentStep / cfg.totalSteps) * 100}%`;
  for (let i = 1; i <= cfg.totalSteps; i++) {
    const dot    = document.getElementById(`pdot-${i}`);
    const circle = document.getElementById(`pdot-circle-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < currentStep) {
      dot.classList.add('done');
      circle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 5l2.5 2.5 3.5-3.5"/></svg>`;
    } else {
      circle.textContent = i;
      if (i === currentStep) dot.classList.add('active');
    }
  }
}

// ── Navigation ─────────────────────────────────────────────────────
function goToStep(target, dir = 'forward') {
  const cfg = MODES[activeMode];
  if (target < 1 || target > cfg.totalSteps) return;

  const cur = document.querySelector(`[data-mode="${activeMode}"][data-step="${currentStep}"]`);
  if (cur) cur.classList.add('hidden');

  const next = document.querySelector(`[data-mode="${activeMode}"][data-step="${target}"]`);
  if (next) {
    next.classList.remove('hidden');
    requestAnimationFrame(() => {
      next.classList.remove('step-enter-right','step-enter-left');
      next.classList.add(dir === 'forward' ? 'step-enter-right' : 'step-enter-left');
    });
  }

  currentStep = target;
  updateProgress();
  updateNavButtons();
  hideGlobalError();
  // Lazy captcha render on last step
  const cfg2 = MODES[activeMode];
  if (target === cfg2.totalSteps && typeof RandlCaptcha !== 'undefined') {
    const containerId = activeMode === 'bestellung' ? '#captcha-container-b' : '#captcha-container-n';
    const box = document.querySelector(containerId);
    if (box && !box.querySelector('iframe')) {
      RandlCaptcha.render(containerId);
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavButtons() {
  const cfg = MODES[activeMode];
  btnBack.classList.toggle('hidden', currentStep === 1);
  if (currentStep === cfg.totalSteps) {
    btnNext.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  }
}

function bindNavButtons() {
  btnNext.addEventListener('click', () => {
    if (validateStep(activeMode, currentStep)) goToStep(currentStep + 1, 'forward');
  });
  btnBack.addEventListener('click', () => goToStep(currentStep - 1, 'backward'));
}

// ── Validation ─────────────────────────────────────────────────────
function validateStep(mode, step) {
  let ok = true;

  if (mode === 'neukunde') {
    if (step === 1) {
      ok = req('n-vorname','error-n-vorname','Vorname erforderlich') && ok;
      ok = req('n-nachname','error-n-nachname','Nachname erforderlich') && ok;
      ok = mail('n-email','error-n-email') && ok;
      ok = req('n-telefon','error-n-telefon','Telefon erforderlich') && ok;
    }
    if (step === 2) {
      ok = req('n-strasse','error-n-strasse','Straße erforderlich') && ok;
      ok = req('n-plz','error-n-plz','PLZ erforderlich') && ok;
      ok = req('n-ort','error-n-ort','Ort erforderlich') && ok;
      // Lieferanschrift wenn abweichend
      if (document.getElementById('lief-abweichend')?.checked) {
        ok = req('n-lief-strasse','error-n-lief-strasse','Lieferstraße erforderlich') && ok;
        ok = req('n-lief-plz','error-n-lief-plz','Liefer-PLZ erforderlich') && ok;
        ok = req('n-lief-ort','error-n-lief-ort','Lieferort erforderlich') && ok;
      }
    }
    if (step === 3) {
      ok = radioGroup('n-kundentyp','error-n-kundentyp','Bitte wählen') && ok;
      ok = chkGroup('n-gastypen','error-n-gastypen','Bitte mindestens eine Gasart wählen') && ok;
    }
    if (step === 4) {
      ok = radioGroup('n-lieferintervall','error-n-lieferintervall','Bitte Intervall wählen') && ok;
      ok = captchaOk() && ok;
      ok = chkBox('n-datenschutz','error-n-datenschutz','Bitte zustimmen') && ok;
    }
  }

  if (mode === 'bestellung') {
    if (step === 1) {
      ok = req('b-name','error-b-name','Name oder Kundennummer erforderlich') && ok;
    }
    if (step === 2) {
      ok = minLen('b-freitext','error-b-freitext',10,'Bitte Bestellung beschreiben (min. 10 Zeichen)') && ok;
      ok = captchaOk() && ok;
      ok = chkBox('b-datenschutz','error-b-datenschutz','Bitte zustimmen') && ok;
    }
  }

  return ok;
}

// ── Validation Helpers ─────────────────────────────────────────────
function v(id)   { const e = document.getElementById(id); return e ? e.value.trim() : ''; }

function setF(id, eid, ok, msg) {
  const el  = document.getElementById(id);
  const err = document.getElementById(eid);
  if (el)  el.classList.toggle('is-error', !ok);
  if (err) { if (msg) err.textContent = msg; ok ? err.classList.remove('visible') : err.classList.add('visible'); }
  return ok;
}

function req(id, eid, msg)     { return setF(id, eid, v(id).length > 0, msg); }
function mail(id, eid)         { return setF(id, eid, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v(id)), 'Gültige E-Mail erforderlich'); }
function minLen(id, eid, n, m) { return setF(id, eid, v(id).length >= n, m); }

function chkGroup(name, eid, msg) {
  const ok  = document.querySelectorAll(`input[name="${name}"]:checked`).length > 0;
  const err = document.getElementById(eid);
  if (err) { err.textContent = msg; ok ? err.classList.remove('visible') : err.classList.add('visible'); }
  return ok;
}

function radioGroup(name, eid, msg) {
  const ok  = !!document.querySelector(`input[name="${name}"]:checked`);
  const err = document.getElementById(eid);
  if (err) { err.textContent = msg; ok ? err.classList.remove('visible') : err.classList.add('visible'); }
  return ok;
}

function chkBox(id, eid, msg) {
  const el  = document.getElementById(id);
  const ok  = !!el && el.checked;
  const err = document.getElementById(eid);
  if (err) { err.textContent = msg; ok ? err.classList.remove('visible') : err.classList.add('visible'); }
  return ok;
}

function captchaOk() {
  if (typeof RandlCaptcha === 'undefined') return true;
  const ok  = RandlCaptcha.isValid();
  if (!ok) {
    const containerId = activeMode === 'bestellung' ? '#captcha-container-b' : '#captcha-container-n';
    const box = document.querySelector(containerId + ' .rc-box');
    if (box) {
      box.classList.add('rc-error');
      const h = box.querySelector('#rc-hint');
      if (h && !h.classList.contains('rc-ok-text')) {
        h.className = 'rc-hint rc-err-text';
        h.textContent = 'Bitte den Sicherheitscheck abschließen.';
      }
    }
  }
  return ok;
}

function resetValidation() {
  document.querySelectorAll('.is-error,.is-invalid').forEach(e => e.classList.remove('is-error','is-invalid'));
  document.querySelectorAll('.field-error.visible').forEach(e => e.classList.remove('visible'));
}

// ── Submit ─────────────────────────────────────────────────────────
function bindFormSubmit() {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateStep(activeMode, currentStep)) return;
    if ((Date.now() - formOpenTime) < 2000) return;
    await submitForm();
  });
}

async function submitForm() {
  isSubmitting    = true;
  btnSubmit.disabled = true;
  if (submitText)    submitText.classList.add('hidden');
  if (submitSpinner) { submitSpinner.classList.remove('hidden'); submitSpinner.classList.add('flex'); }
  hideGlobalError();

  const cfg     = MODES[activeMode];
  let   payload = { modus: cfg.modus, to: cfg.to, quelle: cfg.quelle, timestamp: new Date().toISOString() };

  if (activeMode === 'neukunde') {
    payload.vorname  = v('n-vorname');
    payload.nachname = v('n-nachname');
    payload.name     = `${v('n-vorname')} ${v('n-nachname')}`;
    payload.email    = v('n-email');
    payload.telefon  = v('n-telefon');
    payload.firma    = v('n-firma');
    payload.rechnung_email = v('n-rechnung-email');
    payload.kundentyp = document.querySelector('input[name="n-kundentyp"]:checked')?.value || '';
    payload.adresse  = { strasse: v('n-strasse'), plz: v('n-plz'), ort: v('n-ort'), land: v('n-land') };
    const liefAbw = document.getElementById('lief-abweichend')?.checked;
    payload.lieferanschrift_abweichend = !!liefAbw;
    if (liefAbw) {
      payload.lieferanschrift = { strasse: v('n-lief-strasse'), plz: v('n-lief-plz'), ort: v('n-lief-ort') };
    }
    const rechAbw = document.getElementById('rech-abweichend')?.checked;
    payload.rechnungsanschrift_abweichend = !!rechAbw;
    if (rechAbw) {
      payload.rechnungsanschrift = { strasse: v('n-rech-strasse'), plz: v('n-rech-plz'), ort: v('n-rech-ort') };
    }
    payload.gastypen    = Array.from(document.querySelectorAll('input[name="n-gastypen"]:checked')).map(c=>c.value);
    payload.gasprodukte = Array.from(document.querySelectorAll('input[name="n-gasprodukte"]:checked')).map(c=>c.value);
    payload.lieferintervall = document.querySelector('input[name="n-lieferintervall"]:checked')?.value || '';
    payload.anmerkungen = v('n-anmerkungen');
  }

  if (activeMode === 'bestellung') {
    payload.kundennummer = v('b-kundennummer');
    payload.name         = v('b-name');
    payload.email        = v('b-email');
    payload.telefon      = v('b-telefon');
    payload.freitext     = v('b-freitext');
  }

  payload['cf-turnstile-response'] = document.querySelector('[name="cf-turnstile-response"]')?.value || '';
  try {
    const r = await fetch(CONTACT_URL, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.ok) { showSuccessScreen(); return; }
    throw new Error(d.error || 'Fehler');
  } catch(err) {
    console.error(err);
    resetSubmitBtn();
    showGlobalError('Fehler beim Senden. Bitte direkt anrufen oder an anfragen@randl.group schreiben.');
  }
}

function resetSubmitBtn() {
  isSubmitting = false;
  btnSubmit.disabled = false;
  if (submitText)    submitText.classList.remove('hidden');
  if (submitSpinner) { submitSpinner.classList.add('hidden'); submitSpinner.classList.remove('flex'); }
}

// ── Service & Radio Tiles ──────────────────────────────────────────
function bindServiceTiles() {
  document.querySelectorAll('.service-tile').forEach(tile => {
    const cb = tile.querySelector('input[type="checkbox"]');
    if (!cb) return;
    tile.classList.toggle('is-selected', cb.checked);
    cb.addEventListener('change', () => {
      tile.classList.toggle('is-selected', cb.checked);
      const eid = `error-${cb.name}`;
      const err = document.getElementById(eid);
      if (err && document.querySelectorAll(`input[name="${cb.name}"]:checked`).length > 0)
        err.classList.remove('visible');
    });
  });
}

function bindRadioTiles() {
  document.querySelectorAll('.radio-tile input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => {
      // Deselect siblings
      document.querySelectorAll(`input[name="${r.name}"]`).forEach(s => {
        s.closest('.radio-tile')?.classList.toggle('is-selected', s.checked);
      });
      const err = document.getElementById(`error-${r.name}`);
      if (err) err.classList.remove('visible');
    });
  });
}

// ── Adress-Toggle (Lieferanschrift / Rechnungsanschrift) ───────────
function bindAddressToggle() {
  const liefToggle = document.getElementById('lief-abweichend');
  const rechToggle = document.getElementById('rech-abweichend');

  if (liefToggle) {
    liefToggle.addEventListener('change', () => {
      document.getElementById('lief-fields')?.classList.toggle('hidden', !liefToggle.checked);
    });
  }
  if (rechToggle) {
    rechToggle.addEventListener('change', () => {
      document.getElementById('rech-fields')?.classList.toggle('hidden', !rechToggle.checked);
      document.getElementById('rechnung-email-field')?.classList.toggle('hidden', !rechToggle.checked);
    });
  }
}

// ── Char Counter ───────────────────────────────────────────────────
function bindCharCounters() {
  document.querySelectorAll('textarea[data-counter]').forEach(ta => {
    const cEl = document.getElementById(ta.dataset.counter);
    const max = parseInt(ta.dataset.max || '2000');
    if (!cEl) return;
    ta.addEventListener('input', () => {
      const l = ta.value.length;
      cEl.textContent = `${l} / ${max}`;
      cEl.style.color = l > max * 0.9 ? 'rgba(245,160,32,.8)' : 'rgba(255,255,255,.28)';
    });
  });
}

// ── Char Counter (legacy alias) ────────────────────────────────────
function bindCharCounter() { bindCharCounters(); }

// ── Live Validation ────────────────────────────────────────────────
function bindLiveValidation() {
  document.querySelectorAll('.field-input').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('is-error','is-invalid');
      const err = document.getElementById(`error-${el.id}`);
      if (err) err.classList.remove('visible');
    });
  });
}

// ── Global Error ───────────────────────────────────────────────────
function showGlobalError(msg) {
  if (globalErrText) globalErrText.textContent = msg;
  if (globalError)   { globalError.classList.remove('hidden'); globalError.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}
function hideGlobalError() {
  if (globalError) globalError.classList.add('hidden');
}

// ── Success ────────────────────────────────────────────────────────
function showSuccessScreen() {
  const cfg = MODES[activeMode];
  const msgEl = document.getElementById('success-msg');
  if (msgEl) {
    if (cfg.modus === 'bestellung') {
      msgEl.textContent = 'Ihre Bestellung wurde an bestellung@randl.group übermittelt.';
    } else if (cfg.modus === 'neukunde') {
      msgEl.textContent = 'Ihre Neukundenanfrage wurde an anfragen@randl.group übermittelt.';
    } else {
      msgEl.textContent = 'Ihre Anfrage wurde an anfragen@randl.group übermittelt.';
    }
  }
  if (formCard)      formCard.classList.add('hidden');
  if (successScreen) successScreen.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
