'use strict';

const CONFIG = {
  contactUrl:  '/contact.php',
  minOpenTime: 1500,
  maxChars:    2000,
  stepLabels:  ['Kontakt', 'Adresse', 'Projekt'],
  totalSteps:  3,
};

let currentStep = 1;
const openedAt  = Date.now();

const form          = document.getElementById('inquiry-form');
const formCard      = document.getElementById('form-card');
const successScreen = document.getElementById('success-screen');
const progressBar   = document.getElementById('progress-bar');
const stepDotsWrap  = document.getElementById('step-dots');
const btnBack       = document.getElementById('btn-back');
const btnNext       = document.getElementById('btn-next');
const btnSubmit     = document.getElementById('btn-submit');
const btnSubmitTxt  = document.getElementById('btn-submit-text');
const btnSubmitSpn  = document.getElementById('btn-submit-spinner');
const globalError   = document.getElementById('global-error');
const globalErrorTxt= document.getElementById('global-error-text');
const charCounter   = document.getElementById('char-counter');
const beschreibung  = document.getElementById('beschreibung');

document.addEventListener('DOMContentLoaded', () => {
  if (typeof RandlCaptcha !== 'undefined') {
    RandlCaptcha.render('#captcha-container');
  }
  buildStepDots();
  updateUI();
  bindRadioTiles();
  bindCharCounter();
  form.addEventListener('submit', onSubmit);
  btnNext.addEventListener('click', onNext);
  btnBack.addEventListener('click', onBack);

  document.querySelectorAll('.field-input').forEach(el => {
    el.addEventListener('input',  () => clearFieldError(el));
    el.addEventListener('change', () => clearFieldError(el));
  });
});

function clearFieldError(el) {
  el.classList.remove('is-error');
  const err = document.getElementById(`error-${el.id}`);
  if (err) err.classList.remove('is-visible');
}

// ── Step Dots ──────────────────────────────────────────────────────
function buildStepDots() {
  stepDotsWrap.innerHTML = '';
  CONFIG.stepLabels.forEach((label, i) => {
    const step = i + 1;
    const dot  = document.createElement('div');
    dot.className = 'pdot';
    dot.setAttribute('role', 'listitem');
    dot.id = `pdot-${step}`;
    dot.innerHTML = `
      <div class="pdot-circle" id="pdot-circle-${step}">${step}</div>
      <span class="pdot-label" id="pdot-label-${step}">${label}</span>`;
    stepDotsWrap.appendChild(dot);
  });
}

function updateDots() {
  for (let s = 1; s <= CONFIG.totalSteps; s++) {
    const dot    = document.getElementById(`pdot-${s}`);
    const circle = document.getElementById(`pdot-circle-${s}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (s < currentStep) {
      dot.classList.add('done');
      circle.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 5l2.5 2.5 3.5-3.5"/></svg>`;
    } else {
      circle.textContent = s;
      if (s === currentStep) dot.classList.add('active');
    }
  }
}

function updateUI() {
  updateDots();
  progressBar.style.width = `${(currentStep / CONFIG.totalSteps) * 100}%`;
  btnBack.classList.toggle('hidden', currentStep === 1);
  const isLast = currentStep === CONFIG.totalSteps;
  btnNext.classList.toggle('hidden', isLast);
  btnSubmit.classList.toggle('hidden', !isLast);
  hideGlobalError();
}

function showStep(newStep, direction = 'forward') {
  const cur  = document.getElementById(`step-${currentStep}`);
  const next = document.getElementById(`step-${newStep}`);
  cur.classList.add('hidden');
  next.classList.remove('hidden');
  next.classList.add(direction === 'forward' ? 'step-enter-right' : 'step-enter-left');
  next.addEventListener('animationend', () => next.classList.remove('step-enter-right', 'step-enter-left'), { once: true });
  currentStep = newStep;
  updateUI();
  formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function onNext() { if (validateStep(currentStep) && currentStep < CONFIG.totalSteps) showStep(currentStep + 1, 'forward'); }
function onBack() { if (currentStep > 1) showStep(currentStep - 1, 'backward'); }

// ── Validation ─────────────────────────────────────────────────────
function validateStep(step) {
  let ok = true;
  if (step === 1) {
    ok = reqField('vorname',  'Bitte Vornamen eingeben')               && ok;
    ok = reqField('nachname', 'Bitte Nachnamen eingeben')              && ok;
    ok = reqEmail('email',    'Gültige E-Mail-Adresse erforderlich')   && ok;
    ok = reqField('telefon',  'Telefonnummer erforderlich')            && ok;
  }
  if (step === 2) {
    ok = reqField('strasse', 'Bitte Straße und Hausnummer eingeben')   && ok;
    ok = reqField('plz',     'PLZ erforderlich')                       && ok;
    ok = reqField('ort',     'Ort erforderlich')                       && ok;
  }
  if (step === 3) {
    ok = reqRadio('daten_vorhanden', 'error-daten_vorhanden', 'Bitte eine Option wählen') && ok;
    ok = reqMinLen('beschreibung', 20, 'Mindestens 20 Zeichen eingeben') && ok;
    ok = captchaOk() && ok;
    ok = reqChecked('datenschutz', 'error-datenschutz', 'Bitte Datenschutz bestätigen') && ok;
  }
  return ok;
}

function val(id)   { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
function markErr(id, hasErr) { const e = document.getElementById(id); if (e) e.classList.toggle('is-error', hasErr); }
function showErr(eid, msg) { const e = document.getElementById(eid); if (e) { e.textContent = msg; e.classList.add('is-visible'); } }
function clearErr(eid) { const e = document.getElementById(eid); if (e) e.classList.remove('is-visible'); }

function reqField(id, msg)      { const ok = val(id).length > 0; markErr(id,!ok); ok ? clearErr(`error-${id}`) : showErr(`error-${id}`,msg); return ok; }
function reqEmail(id, msg)      { const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(id)); markErr(id,!ok); ok ? clearErr(`error-${id}`) : showErr(`error-${id}`,msg); return ok; }
function reqMinLen(id, n, msg)  { const ok = val(id).length >= n; markErr(id,!ok); ok ? clearErr(`error-${id}`) : showErr(`error-${id}`,msg); return ok; }
function reqRadio(name, eid, msg) { const ok = !!document.querySelector(`input[name="${name}"]:checked`); ok ? clearErr(eid) : showErr(eid,msg); return ok; }
function reqChecked(id, eid, msg) { const ok = !!(document.getElementById(id)?.checked); ok ? clearErr(eid) : showErr(eid,msg); return ok; }

function captchaOk() {
  if (typeof RandlCaptcha === 'undefined') return true;
  const ok = RandlCaptcha.isValid();
  if (!ok) {
    const box = document.querySelector('#captcha-container .rc-box');
    if (box) box.classList.add('rc-error');
    const h = document.getElementById('rc-hint');
    if (h && !h.classList.contains('rc-ok-text')) { h.className='rc-hint rc-err-text'; h.textContent='Bitte den Sicherheitscheck abschließen.'; }
  }
  return ok;
}

// ── Radio Tiles ────────────────────────────────────────────────────
function bindRadioTiles() {
  document.querySelectorAll('.radio-tile input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => clearErr('error-daten_vorhanden'));
  });
}

// ── Char Counter ───────────────────────────────────────────────────
function bindCharCounter() {
  if (!beschreibung || !charCounter) return;
  beschreibung.addEventListener('input', () => {
    const len = beschreibung.value.length;
    if (len > CONFIG.maxChars) beschreibung.value = beschreibung.value.slice(0, CONFIG.maxChars);
    charCounter.textContent = `${Math.min(len, CONFIG.maxChars)} / ${CONFIG.maxChars}`;
    charCounter.style.color = len > CONFIG.maxChars * 0.9 ? 'rgba(245,160,32,0.8)' : 'rgba(255,255,255,0.28)';
  });
}

// ── Global Error ───────────────────────────────────────────────────
function showGlobalError(msg) { globalErrorTxt.textContent = msg; globalError.classList.remove('hidden'); globalError.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
function hideGlobalError()    { globalError.classList.add('hidden'); }

// ── Submit ─────────────────────────────────────────────────────────
async function onSubmit(e) {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  // Honeypot
  if (document.querySelector('input[name="website"]')?.value || document.querySelector('input[name="email_confirm"]')?.value) { showSuccessScreen(); return; }

  if (Date.now() - openedAt < CONFIG.minOpenTime) { showGlobalError('Bitte füllen Sie das Formular vollständig aus.'); return; }

  btnSubmit.disabled = true;
  btnSubmitTxt.classList.add('hidden');
  btnSubmitSpn.classList.remove('hidden'); btnSubmitSpn.classList.add('flex');
  hideGlobalError();

  const payload = {
    modus:   'anfrage',
    to:      'anfragen@randl.group',
    quelle:  'webformular-metall',
    name:    `${val('vorname')} ${val('nachname')}`,
    vorname: val('vorname'),
    nachname:val('nachname'),
    email:   val('email'),
    telefon: val('telefon'),
    firma:   val('firma'),
    adresse: { strasse: val('strasse'), plz: val('plz'), ort: val('ort'), land: val('land') },
    projekt: {
      daten_vorhanden: document.querySelector('input[name="daten_vorhanden"]:checked')?.value || '',
      beschreibung:    val('beschreibung'),
    },
    'cf-turnstile-response': document.querySelector('[name="cf-turnstile-response"]')?.value || '',
    timestamp: new Date().toISOString(),
  };

  try {
    const r = await fetch(CONFIG.contactUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const d = await r.json();
    if (d.ok) { showSuccessScreen(); return; }
    throw new Error(d.error || 'Fehler');
  } catch (err) {
    console.error(err);
    btnSubmit.disabled = false;
    btnSubmitTxt.classList.remove('hidden');
    btnSubmitSpn.classList.add('hidden'); btnSubmitSpn.classList.remove('flex');
    showGlobalError('Fehler beim Senden. Bitte direkt anrufen oder an anfragen@randl.group schreiben.');
  }
}

function showSuccessScreen() {
  formCard.classList.add('hidden');
  successScreen.classList.remove('hidden');
  successScreen.classList.add('anim-fade-up');
  window.scrollTo({ top:0, behavior:'smooth' });
}
