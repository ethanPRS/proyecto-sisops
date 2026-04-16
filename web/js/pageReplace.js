/**
 * pageReplace.js — Page Replacement Step-by-Step Animation
 *
 * Visualizes FIFO, LRU, Optimal, Clock, and Second Chance
 * algorithms with auto-play, step controls, and visual frame state.
 */

/* ═══════════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════════ */
const PRState = {
  result: null,
  currentStep: -1,
  playing: false,
  playInterval: null,
};


/* ═══════════════════════════════════════════════════════════════════════
   Run Page Replacement
   ═══════════════════════════════════════════════════════════════════════ */
async function runPageReplacement() {
  const algo = document.getElementById('pr-algo').value;
  const numFrames = parseInt(document.getElementById('pr-frames').value) || 3;
  const refInput = document.getElementById('pr-refstring').value.trim();

  // Parse reference string
  const refString = refInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  if (refString.length === 0) {
    showToast('Ingresa una reference string válida (números separados por comas)', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-pr');
  btn.disabled = true;

  try {
    const result = await apiCall('/api/page-replacement', {
      algorithm: algo,
      num_frames: numFrames,
      reference_string: refString,
    });

    PRState.result = result;
    PRState.currentStep = -1;
    stopAutoPlay();

    // Update stats
    document.getElementById('pr-total-faults').textContent = result.total_faults;
    document.getElementById('pr-fault-rate').textContent = result.fault_rate + '%';
    document.getElementById('pr-total-refs').textContent = result.reference_string.length;

    // Render reference string visual
    renderRefString(result);

    // Render initial frames
    renderFrames(result.num_frames);

    // Render step table
    renderStepTable(result);

    // Update step counter
    updateStepCounter();

    showToast(`${algo} completado — ${result.total_faults} page faults`, 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Render Functions
   ═══════════════════════════════════════════════════════════════════════ */
function renderRefString(result) {
  const container = document.getElementById('pr-ref-visual');
  container.innerHTML = result.reference_string.map((page, i) => {
    return `<div class="ref-page" id="ref-page-${i}" data-step="${i}">${page}</div>`;
  }).join('');
}

function renderFrames(numFrames) {
  const container = document.getElementById('pr-frames-visual');
  let html = '';
  for (let i = 0; i < numFrames; i++) {
    html += `<div class="page-frame" id="pf-${i}">—</div>`;
  }
  container.innerHTML = html;
}

function updateFrameVisual(step) {
  if (!step) return;

  const frames = step.frames_after;
  for (let i = 0; i < frames.length; i++) {
    const el = document.getElementById(`pf-${i}`);
    if (!el) continue;

    const page = frames[i];
    el.textContent = page !== null ? page : '—';
    el.className = 'page-frame';

    if (page !== null) {
      el.style.color = pidColor(page);
      el.style.borderColor = pidColor(page);
    } else {
      el.style.color = 'var(--text-muted)';
      el.style.borderColor = 'var(--border)';
    }
  }

  // Highlight fault/hit
  if (step.fault) {
    // Find which frame was added
    for (let i = 0; i < frames.length; i++) {
      if (frames[i] === step.page_requested) {
        const el = document.getElementById(`pf-${i}`);
        if (el) {
          el.classList.add('fault');
          setTimeout(() => el.classList.remove('fault'), 600);
        }
        break;
      }
    }
  } else {
    for (let i = 0; i < frames.length; i++) {
      if (frames[i] === step.page_requested) {
        const el = document.getElementById(`pf-${i}`);
        if (el) el.classList.add('hit');
        break;
      }
    }
  }
}

function updateRefStringVisual(stepIndex) {
  const refPages = document.querySelectorAll('.ref-page');
  refPages.forEach((el, i) => {
    el.classList.remove('current', 'processed', 'fault-page');
    if (i < stepIndex) {
      el.classList.add('processed');
      // Mark faults
      if (PRState.result && PRState.result.steps[i] && PRState.result.steps[i].fault) {
        el.classList.add('fault-page');
      }
    } else if (i === stepIndex) {
      el.classList.add('current');
    }
  });

  // Scroll current into view
  const current = document.getElementById(`ref-page-${stepIndex}`);
  if (current) {
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function updateStepCounter() {
  const total = PRState.result ? PRState.result.steps.length : 0;
  const current = PRState.currentStep + 1;
  document.getElementById('pr-step-counter').textContent = `Step ${current} / ${total}`;
}

function renderStepTable(result) {
  const tbody = document.getElementById('pr-steps-tbody');
  tbody.innerHTML = result.steps.map((s, i) => `
    <tr id="step-row-${i}" style="opacity: ${i <= PRState.currentStep ? 1 : 0.3};">
      <td class="text-mono">${s.step_number + 1}</td>
      <td><span style="color: ${pidColor(s.page_requested)}; font-weight: 700;">${s.page_requested}</span></td>
      <td>${s.fault
        ? '<span class="badge badge-error">FAULT</span>'
        : '<span class="badge badge-success">HIT</span>'
      }</td>
      <td>${s.page_evicted !== null ? `<span class="text-error">${s.page_evicted}</span>` : '—'}</td>
      <td class="text-mono">[${s.frames_after.map(f => f !== null ? f : '·').join(', ')}]</td>
      <td>${s.fault_count}</td>
    </tr>
  `).join('');
}

function highlightStepRow(stepIndex) {
  // Update opacity of all rows
  const rows = document.querySelectorAll('[id^="step-row-"]');
  rows.forEach((row, i) => {
    row.style.opacity = i <= stepIndex ? '1' : '0.3';
    row.style.background = i === stepIndex ? 'rgba(37, 99, 235, 0.12)' : 'transparent';
  });

  // Scroll row into view
  const row = document.getElementById(`step-row-${stepIndex}`);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Step Controls
   ═══════════════════════════════════════════════════════════════════════ */
function stepNext() {
  if (!PRState.result) return;
  const steps = PRState.result.steps;
  if (PRState.currentStep >= steps.length - 1) return;

  PRState.currentStep++;
  const step = steps[PRState.currentStep];

  updateFrameVisual(step);
  updateRefStringVisual(PRState.currentStep);
  updateStepCounter();
  highlightStepRow(PRState.currentStep);
}

function stepPrev() {
  if (!PRState.result || PRState.currentStep < 0) return;

  PRState.currentStep--;

  if (PRState.currentStep < 0) {
    // Reset frames
    renderFrames(PRState.result.num_frames);
    updateRefStringVisual(-1);
    updateStepCounter();
    highlightStepRow(-1);
    return;
  }

  const step = PRState.result.steps[PRState.currentStep];
  updateFrameVisual(step);
  updateRefStringVisual(PRState.currentStep);
  updateStepCounter();
  highlightStepRow(PRState.currentStep);
}

function stepReset() {
  if (!PRState.result) return;
  stopAutoPlay();
  PRState.currentStep = -1;
  renderFrames(PRState.result.num_frames);
  updateRefStringVisual(-1);
  updateStepCounter();
  highlightStepRow(-1);
}

function toggleAutoPlay() {
  if (PRState.playing) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

function startAutoPlay() {
  if (!PRState.result) return;
  PRState.playing = true;

  const playBtn = document.getElementById('pr-btn-play');
  playBtn.textContent = '⏸ Pause';
  playBtn.classList.remove('btn-primary');
  playBtn.classList.add('btn-secondary');

  PRState.playInterval = setInterval(() => {
    if (PRState.currentStep >= PRState.result.steps.length - 1) {
      stopAutoPlay();
      return;
    }
    stepNext();
  }, 500);
}

function stopAutoPlay() {
  PRState.playing = false;
  if (PRState.playInterval) {
    clearInterval(PRState.playInterval);
    PRState.playInterval = null;
  }

  const playBtn = document.getElementById('pr-btn-play');
  playBtn.textContent = '▶ Play';
  playBtn.classList.remove('btn-secondary');
  playBtn.classList.add('btn-primary');
}


/* ═══════════════════════════════════════════════════════════════════════
   Event Listeners
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pr-btn-next').addEventListener('click', stepNext);
  document.getElementById('pr-btn-prev').addEventListener('click', stepPrev);
  document.getElementById('pr-btn-reset').addEventListener('click', stepReset);
  document.getElementById('pr-btn-play').addEventListener('click', toggleAutoPlay);
});

window.runPageReplacement = runPageReplacement;
