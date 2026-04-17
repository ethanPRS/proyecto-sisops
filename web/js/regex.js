/**
 * regex.js — Regex Data Extraction UI State Machine
 */

const RegexState = {
  rawText: "",
  matches: [],
  currentStep: 0,
  playing: false,
  timer: null,
  speedMultiplier: 1.0,
  baseDelayMs: 300
};

/* ═══════════════════════════════════════════════════════════════════════
   Extract Regex
   ═══════════════════════════════════════════════════════════════════════ */
async function extractRegex() {
  const text = document.getElementById('regex-input').value.trim();
  if (!text) {
    showToast('Ingresa texto para analizar', 'warning');
    return;
  }

  const activeFilter = document.querySelector('.filter-chip.active');
  const filterCat = activeFilter ? activeFilter.dataset.cat : 'all';
  const categories = filterCat === 'all' ? null : [filterCat];

  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.textContent = '⏳ Extrayendo...';

  regexPause(); // Detener si estaba corriendo

  try {
    const result = await apiCall('/api/regex/extract', {
      text: text,
      categories: categories,
    });

    initRegexSimulation(result, text);
    showToast(`${result.total_matches} coincidencias. Usa los controles para ver el progreso.`, 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Extraer Datos';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   State Machine Core
   ═══════════════════════════════════════════════════════════════════════ */
function initRegexSimulation(result, rawText) {
  RegexState.rawText = rawText;
  RegexState.matches = result.matches || [];
  RegexState.currentStep = 0;
  
  const playbackEl = document.getElementById('regex-playback');
  if (RegexState.matches.length > 0) {
    playbackEl.style.display = 'flex';
  } else {
    playbackEl.style.display = 'none';
  }
  
  const inputEl = document.getElementById('regex-input');
  const backdrop = document.getElementById('regex-backdrop');
  if (inputEl && backdrop) {
    inputEl.style.display = 'none';
    backdrop.style.display = 'block';
  }
  
  renderRegexStep(0);
  
  if (RegexState.matches.length > 0) {
    regexPlay();
  }
}

function renderRegexStep(stepIndex) {
  const matches = RegexState.matches;
  stepIndex = Math.max(0, Math.min(stepIndex, matches.length));
  RegexState.currentStep = stepIndex;
  
  document.getElementById('regex-step-counter').textContent = `${stepIndex} / ${matches.length}`;
  document.getElementById('regex-match-count').textContent = `${stepIndex} matches`;
  
  const statIds = ['regex-dates', 'regex-emails', 'regex-phones', 'regex-names', 'regex-addresses'];
  for (const id of statIds) document.getElementById(id).textContent = '0';
  const counts = { date: 0, email: 0, phone: 0, name: 0, address: 0 };
  
  const tbody = document.getElementById('regex-tbody');
  tbody.innerHTML = '';
  
  const backdrop = document.getElementById('regex-backdrop');
  let lines = RegexState.rawText ? RegexState.rawText.split('\n').map(escapeHtml) : [];

  if (matches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding:var(--space-xl);">No se encontraron coincidencias</td></tr>`;
    if (backdrop) backdrop.innerHTML = lines.join('\n');
    return;
  }
  
  const categoryIcons = { date: '📅', email: '📧', phone: '📞', name: '👤', address: '🏠' };
  const pIcons = {
    date: '<i class="ph ph-calendar"></i>',
    email: '<i class="ph ph-envelope"></i>',
    phone: '<i class="ph ph-phone"></i>',
    name: '<i class="ph ph-user"></i>',
    address: '<i class="ph ph-house"></i>',
  };

  const matchesToRender = matches.slice(0, stepIndex);
  let lastLineNumber = 0;

  for (let i = 0; i < matchesToRender.length; i++) {
    const m = matchesToRender[i];
    
    if (counts[m.category] !== undefined) counts[m.category]++;
    const idMap = { date: 'regex-dates', email: 'regex-emails', phone: 'regex-phones', name: 'regex-names', address: 'regex-addresses' };
    if (idMap[m.category]) {
      document.getElementById(idMap[m.category]).textContent = counts[m.category];
    }
    
    const tr = document.createElement('tr');
    if (i === matchesToRender.length - 1) {
      tr.style.animation = 'fadeSlideIn 0.3s ease both';
    }
    
    tr.innerHTML = `
      <td>
        <span class="badge badge-${getCategoryBadgeClass(m.category)}">
          ${pIcons[m.category] || categoryIcons[m.category]} ${m.category}
        </span>
      </td>
      <td>
        <span class="match-highlight ${m.category}">${escapeHtml(m.value)}</span>
      </td>
      <td class="text-mono text-muted">${m.line_number}</td>
    `;
    tbody.appendChild(tr);
    
    if (lines.length > 0) {
      const l = m.line_number - 1;
      if (l >= 0 && l < lines.length) {
        const escapedVal = escapeHtml(m.value);
        lines[l] = lines[l].replace(escapedVal, `<span class="match-highlight ${m.category}">${escapedVal}</span>`);
      }
    }
    lastLineNumber = m.line_number;
  }

  if (backdrop) backdrop.innerHTML = lines.join('\n');

  // Scrolling sync
  const wrapper = tbody.closest('.table-wrapper');
  if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
  if (backdrop && stepIndex > 0) {
    backdrop.scrollTop = (lastLineNumber - 1) * 20; 
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Playback Controls
   ═══════════════════════════════════════════════════════════════════════ */
function regexPlay() {
  if (RegexState.currentStep >= RegexState.matches.length) {
    RegexState.currentStep = 0; // loops
  }
  RegexState.playing = true;
  const playBtn = document.getElementById('regex-btn-play');
  playBtn.innerHTML = '<i class="ph ph-pause"></i> Pause';
  playBtn.classList.remove('btn-primary');
  playBtn.classList.add('btn-warning');
  regexScheduleNext();
}

function regexPause() {
  RegexState.playing = false;
  if (RegexState.timer) clearTimeout(RegexState.timer);
  const playBtn = document.getElementById('regex-btn-play');
  playBtn.innerHTML = '<i class="ph ph-play"></i> Play';
  playBtn.classList.remove('btn-warning');
  playBtn.classList.add('btn-primary');
}

function regexTogglePlay() {
  if (RegexState.playing) regexPause();
  else regexPlay();
}

function regexScheduleNext() {
  if (!RegexState.playing) return;
  if (RegexState.currentStep >= RegexState.matches.length) {
    regexPause();
    return;
  }
  RegexState.timer = setTimeout(() => {
    regexStepNext();
    regexScheduleNext();
  }, RegexState.baseDelayMs / RegexState.speedMultiplier);
}

function regexStepNext() {
  if (RegexState.currentStep < RegexState.matches.length) {
    renderRegexStep(RegexState.currentStep + 1);
  } else {
    regexPause();
  }
}

function regexStepPrev() {
  regexPause();
  if (RegexState.currentStep > 0) {
    renderRegexStep(RegexState.currentStep - 1);
  }
}

function regexStepReset() {
  regexPause();
  renderRegexStep(0);
}

function regexStepEnd() {
  regexPause();
  renderRegexStep(RegexState.matches.length);
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */
function getCategoryBadgeClass(category) {
  const map = { date: 'purple', email: 'pink', phone: 'purple', name: 'success', address: 'warning' };
  return map[category] || 'purple';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ═══════════════════════════════════════════════════════════════════════
   Event Listeners
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Load sample text
  const textarea = document.getElementById('regex-input');
  if (textarea && !textarea.value.trim()) {
    textarea.value = `Juan Pérez nació el 15/03/1990 en Monterrey.
Su correo es juan.perez@company.com y su teléfono es +52 (81) 1234-5678.
Vive en 456 Avenida Col. Del Valle, Monterrey.

María García contactó el 2024-01-20.
Email: maria.garcia@email.org
Teléfono: (81) 9876-5432
Dirección: 789 Calle Hidalgo Col. Centro

La reunión fue programada para January 15, 2025.
Enviar documentos a docs@universidad.edu
Contacto alternativo: +1 555-123-4567

Roberto Martínez trabaja en 100 Main St, Suite 200.
Su información: roberto@tech.io, 15/06/1985.`;
  }

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('regex-backdrop').style.display = 'none';
      document.getElementById('regex-input').style.display = 'block';
      const text = document.getElementById('regex-input').value.trim();
      if (text) {
        regexPause();
        extractRegex();
      }
    });
  });

  // Switch back to edit mode
  document.getElementById('regex-backdrop').addEventListener('click', () => {
    regexPause();
    document.getElementById('regex-backdrop').style.display = 'none';
    const input = document.getElementById('regex-input');
    input.style.display = 'block';
    input.focus();
    // Hide controls
    document.getElementById('regex-playback').style.display = 'none';
  });

  // Controls UI bindings
  document.getElementById('regex-btn-play').addEventListener('click', regexTogglePlay);
  document.getElementById('regex-btn-next').addEventListener('click', regexStepNext);
  document.getElementById('regex-btn-prev').addEventListener('click', regexStepPrev);
  document.getElementById('regex-btn-reset').addEventListener('click', regexStepReset);
  document.getElementById('regex-btn-end').addEventListener('click', regexStepEnd);

  const speedSlider = document.getElementById('regex-speed');
  const speedLabel = document.getElementById('regex-speed-label');
  if (speedSlider && speedLabel) {
    speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      speedLabel.textContent = val.toFixed(1) + 'x';
      RegexState.speedMultiplier = val;
    });
  }
});

window.extractRegex = extractRegex;
