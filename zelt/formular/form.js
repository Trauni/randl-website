'use strict';

const CONFIG = {
  contactUrl:  '/contact.php',
  minOpenTime: 3000,
  maxChars:    2000,
  stepLabels:  ['Kontakt', 'Adresse', 'Projekt', 'Details'],
  totalSteps:  4,
};

let currentStep  = 1;
let formOpenTime = Date.now();
let isSubmitting = false;

const form          = document.getElementById('inquiry-form');
const formCard      = document.getElementById('form-card');
const successScreen = document.getElementById('success-screen');
const btnNext       = document.getElementById('btn-next');
const btnBack       = document.getElementById('btn-back');
const btnSubmit     = document.getElementById('btn-submit');
const submitLabel   = document.getElementById('btn-submit-text');
const submitSpinner = document.getElementById('btn-submit-spinner');
const progressBar   = document.getElementById('progress-bar');
const stepDotsEl    = document.getElementById('step-dots');

document.addEventListener('DOMContentLoaded', () => {
  if (typeof RandlCaptcha !== 'undefined') {
    RandlCaptcha.render('#captcha-container');
  }
  buildProgressDots();
  updateProgress();
  bindServiceTiles();
  bindNavButtons();
  bindFormSubmit();
  bindCharCounter();
  bindLiveValidation();
});

function buildProgressDots() {
  stepDotsEl.innerHTML = '';
  CONFIG.stepLabels.forEach((label, i) => {
    const step = i + 1;
    const dot  = document.createElement('div');
    dot.className = 'pdot';
    dot.setAttribute('role', 'listitem');
    dot.id = `pdot-${step}`;
    dot.innerHTML = `
      <div class="pdot-circle" id="pdot-circle-${step}">${step}</div>
      <span class="pdot-label" id="pdot-label-${step}">${label}</span>
    `;
    stepDotsEl.appendChild(dot);
  });
}

function updateProgress() {
  const pct = (currentStep / CONFIG.totalSteps) * 100;
  progressBar.style.width = `${pct}%`;

  for (let i = 1; i <= CONFIG.totalSteps; i++) {
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

function goToStep(targetStep, direction = 'forward') {
  if (targetStep < 1 || targetStep > CONFIG.totalSteps) return;

  const current = document.getElementById(`step-${currentStep}`);
  current.classList.add('hidden');

  const next = document.getElementById(`step-${targetStep}`);
  next.classList.remove('hidden');

  requestAnimationFrame(() => {
    next.classList.remove('step-enter-right', 'step-enter-left');
    next.classList.add(direction === 'forward' ? 'step-enter-right' : 'step-enter-left');
  });

  currentStep = targetStep;
  updateProgress();
  updateNavButtons();
  hideGlobalError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavButtons() {
  btnBack.classList.toggle('hidden', currentStep === 1);
  if (currentStep === CONFIG.totalSteps) {
    btnNext.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  } else {
    btnNext.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  }
}

function bindNavButtons() {
  btnNext.addEventListener('click', () => {
    if (validateStep(currentStep)) goToStep(currentStep + 1, 'forward');
  });
  btnBack.addEventListener('click', () => goToStep(currentStep - 1, 'backward'));
}

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    valid = validateRequired('vorname',  'error-vorname')  && valid;
    valid = validateRequired('nachname', 'error-nachname') && valid;
    valid = validateEmail('email',       'error-email')    && valid;
    valid = validateRequired('telefon',  'error-telefon')  && valid;
  }

  if (step === 2) {
    valid = validateRequired('strasse', 'error-strasse') && valid;
    valid = validateRequired('plz',     'error-plz')     && valid;
    valid = validateRequired('ort',     'error-ort')     && valid;
  }

  if (step === 3) {
    valid = validateRequired('projektname',        'error-projektname')        && valid;
    valid = validateRequired('veranstaltungsort',  'error-veranstaltungsort')  && valid;
    valid = validateRequired('veranstaltungsdatum','error-veranstaltungsdatum')&& valid;
  }

  if (step === 4) {
    valid = validateCheckboxGroup('leistungen', 'error-leistungen')      && valid;
    valid = validateMinLength('beschreibung',   'error-beschreibung', 20) && valid;
    valid = validateChecked('datenschutz', 'error-datenschutz', 'Bitte Datenschutz bestätigen') && valid;
  }

  return valid;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function validateRequired(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const ok = !!field && field.value.trim().length > 0;
  setFieldState(field, errorId, ok);
  return ok;
}

function validateEmail(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field ? field.value.trim() : '');
  setFieldState(field, errorId, ok);
  return ok;
}

function validateMinLength(fieldId, errorId, min) {
  const field = document.getElementById(fieldId);
  const ok = !!field && field.value.trim().length >= min;
  setFieldState(field, errorId, ok);
  return ok;
}

function validateCheckboxGroup(name, errorId) {
  const checked = document.querySelectorAll(`input[name="${name}"]:checked`);
  const ok  = checked.length > 0;
  const err = document.getElementById(errorId);
  if (err) ok ? err.classList.remove('visible') : err.classList.add('visible');
  return ok;
}

function validateChecked(checkboxId, errorId, msg) {
  const el  = document.getElementById(checkboxId);
  const ok  = !!el && el.checked;
  const err = document.getElementById(errorId);
  if (err) {
    err.textContent = msg;
    ok ? err.classList.remove('visible') : err.classList.add('visible');
  }
  return ok;
}

function setFieldState(field, errorId, ok) {
  if (!field) return;
  field.classList.toggle('is-invalid', !ok);
  const err = document.getElementById(errorId);
  if (err) ok ? err.classList.remove('visible') : err.classList.add('visible');
}

function bindFormSubmit() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateStep(CONFIG.totalSteps)) return;

    if ((Date.now() - formOpenTime) < CONFIG.minOpenTime) {
      showGlobalError('Das Formular wurde zu schnell ausgefüllt.');
      return;
    }

    if (typeof RandlCaptcha !== 'undefined' && !RandlCaptcha.isValid()) {
      const box = document.querySelector('.rc-box');
      if (box) box.classList.add('rc-error');
      const h = document.getElementById('rc-hint');
      if (h && !h.classList.contains('rc-ok-text')) {
        h.className = 'rc-hint rc-err-text';
        h.textContent = 'Bitte den Sicherheitscheck abschließen.';
      }
      return;
    }

    await submitForm();
  });
}

async function submitForm() {
  isSubmitting = true;
  btnSubmit.disabled = true;

  if (submitLabel)  submitLabel.textContent = 'Wird gesendet…';
  if (submitSpinner) {
    submitSpinner.classList.remove('hidden');
    submitSpinner.classList.add('flex');
  }

  hideGlobalError();

  const leistungen = Array.from(
    document.querySelectorAll('input[name="leistungen"]:checked')
  ).map(cb => cb.value);

  const payload = {
    firma:    getValue('firma'),
    vorname:  getValue('vorname'),
    nachname: getValue('nachname'),
    email:    getValue('email'),
    telefon:  getValue('telefon'),

    adresse: {
      strasse: getValue('strasse'),
      plz:     getValue('plz'),
      ort:     getValue('ort'),
    },

    projekt: {
      name:                getValue('projektname'),
      veranstaltungsort:   getValue('veranstaltungsort'),
      veranstaltungsdatum: getValue('veranstaltungsdatum'),
      aufbau:              getValue('aufbaudatum'),
      abbau:               getValue('abbaudatum'),
    },

    leistungen:   leistungen,
    beschreibung: getValue('beschreibung'),
    quelle:       'webformular-zelt',
    timestamp:    new Date().toISOString(),
  };

  payload['cf-turnstile-response'] =
    document.querySelector('[name="cf-turnstile-response"]')?.value || '';

  try {
    const res = await fetch(CONFIG.contactUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.ok) { showSuccessScreen(); return; }
    throw new Error(data.error || 'Fehler');
  } catch (err) {
    console.error(err);

    isSubmitting = false;
    btnSubmit.disabled = false;

    if (submitLabel) submitLabel.textContent = 'Anfrage absenden';
    if (submitSpinner) {
      submitSpinner.classList.add('hidden');
      submitSpinner.classList.remove('flex');
    }

    showGlobalError('Fehler beim Senden. Bitte erneut versuchen oder direkt anrufen.');
  }
}

function bindServiceTiles() {
  document.querySelectorAll('.service-tile').forEach(tile => {
    const checkbox = tile.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    tile.classList.toggle('is-selected', checkbox.checked);

    checkbox.addEventListener('change', () => {
      tile.classList.toggle('is-selected', checkbox.checked);
      const err = document.getElementById('error-leistungen');
      const anyChecked = document.querySelectorAll('input[name="leistungen"]:checked').length > 0;
      if (err && anyChecked) err.classList.remove('visible');
    });
  });
}

function bindCharCounter() {
  const textarea = document.getElementById('beschreibung');
  const counter  = document.getElementById('char-counter');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 2000`;
    counter.style.color = len > 1800
      ? 'rgba(245,160,32,0.8)'
      : 'rgba(255,255,255,0.28)';
  });
}

function bindLiveValidation() {
  document.querySelectorAll('.field-input').forEach(input => {
    input.addEventListener('input', () => {
      if (input.value.trim()) {
        input.classList.remove('is-invalid', 'is-error');
        const err = document.getElementById(`error-${input.id}`);
        if (err) err.classList.remove('visible');
      }
    });
  });
}

function showGlobalError(msg) {
  const globalError   = document.getElementById('global-error');
  const globalErrText = document.getElementById('global-error-text');
  if (!globalError || !globalErrText) return;
  globalErrText.textContent = msg;
  globalError.classList.remove('hidden');
  globalError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideGlobalError() {
  const globalError = document.getElementById('global-error');
  if (globalError) globalError.classList.add('hidden');
}

function showSuccessScreen() {
  formCard.classList.add('hidden');
  successScreen.classList.remove('hidden');
}
