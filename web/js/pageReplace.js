/**
 * pageReplace.js — Library Study Table Page Replacement
 * Redesigned for the "Study Table at a Library" analogy.
 */

/* ═══════════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════════ */
const PRState = {
  result: null,
  currentStep: -1,
  playing: false,
  faultCount: 0,
};

let _autoplayTimer = null;

/* ═══════════════════════════════════════════════════════════════════════
   Helpers — read UI values
   ═══════════════════════════════════════════════════════════════════════ */
function getSelectedAlgo() {
  const checked = document.querySelector('input[name="pr-algo-radio"]:checked');
  return checked ? checked.value : 'FIFO';
}

function getNumFrames() {
  const mem  = parseInt(document.getElementById('pr-mem-size').value)  || 256;
  const page = parseInt(document.getElementById('pr-page-size').value) || 64;
  return Math.max(1, Math.floor(mem / page));
}

function updateFramesCalc() {
  const mem   = parseInt(document.getElementById('pr-mem-size').value)  || 256;
  const page  = parseInt(document.getElementById('pr-page-size').value) || 64;
  const frames = Math.max(1, Math.floor(mem / page));

  const el = document.getElementById('pr-mem-size-val');
  if (el) el.textContent = mem >= 1024 ? (mem / 1024) + ' KB' : mem + ' B';

  const disp = document.getElementById('pr-frames-display');
  if (disp) disp.textContent = frames + ' frame' + (frames !== 1 ? 's' : '');

  const formula = document.getElementById('pr-calc-formula');
  if (formula) formula.textContent = frames;

  const sub = document.getElementById('pr-frames-calc') && document.getElementById('pr-frames-calc').querySelector('.pr-frames-calc-sub');
  if (sub) sub.innerHTML = `${mem} B ÷ ${page} B = <strong id="pr-calc-formula">${frames}</strong>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Run
   ═══════════════════════════════════════════════════════════════════════ */
async function runPageReplacement() {
  const algo = getSelectedAlgo();
  const numFrames = getNumFrames();
  const refInput = document.getElementById('pr-refstring').value.trim();

  const refString = refInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (refString.length === 0) {
    showToast('Enter a valid reference string (comma-separated numbers)', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-pr');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></div> Running...';

  try {
    const result = await apiCall('/api/page-replacement', {
      algorithm: algo,
      num_frames: numFrames,
      reference_string: refString,
    });

    PRState.result = result;
    PRState.currentStep = -1;
    PRState.faultCount = 0;
    stopAutoPlay();

    // Show badge with chosen algorithm
    const badge = document.getElementById('pr-algo-badge');
    if (badge) badge.textContent = algo;

    // Update giant fault counter
    updateFaultCounter(0, result.reference_string.length, result.total_faults, result.fault_rate);

    // Show canvas row
    const canvasRow = document.getElementById('pr-canvas-row');
    if (canvasRow) canvasRow.style.display = 'flex';

    // Clear event log
    clearLog();
    addLog('info', `📚 Simulation started — ${algo} | ${numFrames} frames | ${refString.length} references`);

    // Render ref string
    renderRefString(result);

    // Render initial (empty) table
    renderStudyTable(numFrames);

    // Update step counter
    updateStepCounter();

    showToast(`${algo} ready — ${result.total_faults} total page faults`, 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> Start Simulation';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Render Helpers
   ═══════════════════════════════════════════════════════════════════════ */
function renderRefString(result) {
  const container = document.getElementById('pr-ref-visual');
  if (!container) return;
  container.innerHTML = result.reference_string.map((page, i) =>
    `<div class="ref-page" id="ref-page-${i}" data-step="${i}">${page}</div>`
  ).join('');
}

function renderStudyTable(numFrames) {
  const container = document.getElementById('pr-frames-visual');
  if (!container) return;
  let html = '';
  for (let i = 0; i < numFrames; i++) {
    html += `
      <div class="pr-frame-slot" id="pf-${i}">
        <div class="pr-frame-index">Frame ${i + 1}</div>
        <div class="pr-frame-value" id="pf-val-${i}">—</div>
        <div class="pr-frame-sub" id="pf-sub-${i}"></div>
      </div>`;
  }
  container.innerHTML = html;
}

function updateStudyTable(step) {
  if (!step) return;
  const frames = step.frames_after;

  for (let i = 0; i < frames.length; i++) {
    const slot = document.getElementById(`pf-${i}`);
    const val  = document.getElementById(`pf-val-${i}`);
    const sub  = document.getElementById(`pf-sub-${i}`);
    if (!slot || !val) continue;

    const page = frames[i];
    val.textContent = page !== null ? `P${page}` : '—';

    slot.classList.remove('pr-frame-fault', 'pr-frame-hit', 'pr-frame-empty', 'pr-frame-evict');

    if (page === null) {
      slot.classList.add('pr-frame-empty');
      val.style.color = '';
      slot.style.setProperty('--frame-accent', 'var(--border)');
    } else {
      const color = pidColor(page);
      val.style.color = color;
      slot.style.setProperty('--frame-accent', color);
      if (page === step.page_requested) {
        if (step.fault) {
          slot.classList.add('pr-frame-fault');
          if (sub) sub.textContent = '📥 Loaded';
        } else {
          slot.classList.add('pr-frame-hit');
          if (sub) sub.textContent = '✅ Hit';
        }
      } else {
        if (sub && step.page_evicted !== null && page === step.page_evicted) {
          slot.classList.add('pr-frame-evict');
          if (sub) sub.textContent = '🗑️ Evicted';
        } else {
          if (sub) sub.textContent = '';
        }
      }
    }
  }
}

function updateRefStringVisual(stepIndex) {
  document.querySelectorAll('.ref-page').forEach((el, i) => {
    el.classList.remove('current', 'processed', 'fault-page');
    if (i < stepIndex) {
      el.classList.add('processed');
      if (PRState.result?.steps[i]?.fault) el.classList.add('fault-page');
    } else if (i === stepIndex) {
      el.classList.add('current');
    }
  });
  const cur = document.getElementById(`ref-page-${stepIndex}`);
  if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function updateStepCounter() {
  const total = PRState.result ? PRState.result.steps.length : 0;
  const current = PRState.currentStep + 1;
  const el = document.getElementById('pr-step-counter');
  if (el) el.textContent = `Step ${current} / ${total}`;
}

function updateFaultCounter(live, total, max, rate) {
  const numEl = document.getElementById('pr-total-faults');
  if (numEl) numEl.textContent = live;
  const rateEl = document.getElementById('pr-fault-rate');
  if (rateEl) rateEl.textContent = total > 0 ? ((live / total) * 100).toFixed(1) + '%' : '—';
  const refsEl = document.getElementById('pr-total-refs');
  if (refsEl) refsEl.textContent = total;
}

/* ═══════════════════════════════════════════════════════════════════════
   Event Log
   ═══════════════════════════════════════════════════════════════════════ */
function clearLog() {
  const log = document.getElementById('pr-event-log');
  if (log) log.innerHTML = '';
}

function addLog(type, msg) {
  const log = document.getElementById('pr-event-log');
  if (!log) return;
  const icons = { fault: '❌', hit: '✅', evict: '🗑️', info: 'ℹ️', reset: '🔄' };
  const colors = { fault: '#F87171', hit: '#34D399', evict: '#FBBF24', info: '#60A5FA', reset: '#A78BFA' };
  const entry = document.createElement('div');
  entry.className = 'pr-log-entry pr-log-' + type;
  entry.innerHTML = `
    <span class="pr-log-icon" style="color:${colors[type] || '#94A3B8'}">${icons[type] || '•'}</span>
    <span class="pr-log-msg">${msg}</span>
  `;
  log.insertBefore(entry, log.firstChild);
}

/* ═══════════════════════════════════════════════════════════════════════
   Step Controls
   ═══════════════════════════════════════════════════════════════════════ */
function stepNext() {
  if (!PRState.result) return;
  const steps = PRState.result.steps;
  if (PRState.currentStep >= steps.length - 1) { stopAutoPlay(); return; }

  PRState.currentStep++;
  const step = steps[PRState.currentStep];

  updateStudyTable(step);
  updateRefStringVisual(PRState.currentStep);
  updateStepCounter();

  // Live fault counter
  PRState.faultCount = step.fault_count;
  updateFaultCounter(step.fault_count, PRState.result.reference_string.length,
    PRState.result.total_faults, PRState.result.fault_rate);

  // Event log
  if (step.fault) {
    const evictMsg = step.page_evicted !== null ? ` — Folder <strong>${step.page_evicted}</strong> removed from table` : '';
    addLog('fault', `⚡ Page Fault! Page <strong>${step.page_requested}</strong> not on the table. Loaded into Frame ${
      step.frames_after.indexOf(step.page_requested) + 1}${evictMsg}`);
    if (step.page_evicted !== null) addLog('evict', `Evicted page <strong>${step.page_evicted}</strong> (${getSelectedAlgo()} strategy)`);
  } else {
    addLog('hit', `Page <strong>${step.page_requested}</strong> is already on the table — Hit! ✅`);
  }
}

function stepPrev() {
  if (!PRState.result || PRState.currentStep < 0) return;
  PRState.currentStep--;
  if (PRState.currentStep < 0) {
    renderStudyTable(PRState.result.num_frames);
    updateRefStringVisual(-1);
    updateFaultCounter(0, PRState.result.reference_string.length, PRState.result.total_faults, PRState.result.fault_rate);
    updateStepCounter();
    return;
  }
  const step = PRState.result.steps[PRState.currentStep];
  updateStudyTable(step);
  updateRefStringVisual(PRState.currentStep);
  updateFaultCounter(step.fault_count, PRState.result.reference_string.length, PRState.result.total_faults, PRState.result.fault_rate);
  updateStepCounter();
}

function stepReset() {
  if (!PRState.result) return;
  stopAutoPlay();
  PRState.currentStep = -1;
  PRState.faultCount = 0;
  renderStudyTable(PRState.result.num_frames);
  updateRefStringVisual(-1);
  updateFaultCounter(0, PRState.result.reference_string.length, PRState.result.total_faults, PRState.result.fault_rate);
  updateStepCounter();
  clearLog();
  addLog('reset', 'Table cleared — ready to replay');
}

function toggleAutoPlay() {
  PRState.playing ? stopAutoPlay() : startAutoPlay();
}

function startAutoPlay() {
  if (!PRState.result) return;
  PRState.playing = true;
  const btn = document.getElementById('pr-btn-play');
  if (btn) { btn.innerHTML = '<i class="ph ph-pause"></i> Pause'; btn.classList.replace('btn-primary', 'btn-secondary'); }

  function tick() {
    if (!PRState.playing) return;
    if (PRState.currentStep >= PRState.result.steps.length - 1) { stopAutoPlay(); return; }
    stepNext();
    const speed = parseFloat(document.getElementById('pr-speed')?.value || 1);
    _autoplayTimer = setTimeout(tick, 900 / speed);
  }
  tick();
}

function stopAutoPlay() {
  PRState.playing = false;
  clearTimeout(_autoplayTimer);
  const btn = document.getElementById('pr-btn-play');
  if (btn) { btn.innerHTML = '<i class="ph ph-play"></i> Play'; btn.classList.replace('btn-secondary', 'btn-primary'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   Random Reference String Generator
   ═══════════════════════════════════════════════════════════════════════ */
function generateRandomRefString() {
  const len   = 15 + Math.floor(Math.random() * 10);
  const range = 6  + Math.floor(Math.random() * 4);
  const seq   = Array.from({ length: len }, () => Math.floor(Math.random() * range));
  const el = document.getElementById('pr-refstring');
  if (el) el.value = seq.join(',');
}

/* ═══════════════════════════════════════════════════════════════════════
   Stepper helpers
   ═══════════════════════════════════════════════════════════════════════ */
function makeStepper(decId, incId, valId, min = 1, max = 8) {
  const dec = document.getElementById(decId);
  const inc = document.getElementById(incId);
  const val = document.getElementById(valId);
  if (!dec || !inc || !val) return;
  dec.addEventListener('click', () => {
    const v = parseInt(val.textContent);
    if (v > min) val.textContent = v - 1;
  });
  inc.addEventListener('click', () => {
    const v = parseInt(val.textContent);
    if (v < max) val.textContent = v + 1;
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   DOMContentLoaded
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Memory slider & page-size dropdown → recalculate frames
  const memSlider  = document.getElementById('pr-mem-size');
  const pageSelect = document.getElementById('pr-page-size');
  if (memSlider)  memSlider.addEventListener('input', updateFramesCalc);
  if (pageSelect) pageSelect.addEventListener('change', updateFramesCalc);
  updateFramesCalc();

  // Algorithm pills
  document.querySelectorAll('.pr-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pr-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  // Playback controls
  document.getElementById('pr-btn-next')?.addEventListener('click', stepNext);
  document.getElementById('pr-btn-prev')?.addEventListener('click', stepPrev);
  document.getElementById('pr-btn-reset')?.addEventListener('click', stepReset);
  document.getElementById('pr-btn-play')?.addEventListener('click', toggleAutoPlay);

  // Speed label
  document.getElementById('pr-speed')?.addEventListener('input', e => {
    const lbl = document.getElementById('pr-speed-label');
    if (lbl) lbl.textContent = parseFloat(e.target.value).toFixed(2).replace('.00', '') + 'x';
  });

  // Random generator
  document.getElementById('pr-btn-random')?.addEventListener('click', generateRandomRefString);

  // Event log clear
  document.getElementById('pr-log-clear')?.addEventListener('click', clearLog);

  // Steppers
  makeStepper('pr-step-a-dec', 'pr-step-a-inc', 'pr-step-a-val');
  makeStepper('pr-step-b-dec', 'pr-step-b-inc', 'pr-step-b-val');
  makeStepper('pr-step-c-dec', 'pr-step-c-inc', 'pr-step-c-val');
});

window.runPageReplacement = runPageReplacement;
