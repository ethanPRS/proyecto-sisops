/**
 * app.js — Main SPA Controller for OS Simulator
 *
 * Handles navigation, process state, API communication,
 * toast notifications, and particle background.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */
const API_BASE = window.location.origin;

const PID_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#84CC16",
  "#0EA5E9",
  "#D946EF",
  "#22C55E",
  "#EAB308",
  "#06B6D4",
  "#A855F7",
];

function pidColor(pid) {
  return PID_COLORS[pid % PID_COLORS.length];
}

/* ═══════════════════════════════════════════════════════════════════════
   Execution mode helpers
   ═══════════════════════════════════════════════════════════════════════ */
const EXEC_MODE_META = {
  'Secuencial':     { icon: 'ph-clock',         color: '#64748B', label: 'Sequential' },
  'Multithreading': { icon: 'ph-git-branch',    color: '#2563EB', label: 'Multithreading' },
  'Concurrency':    { icon: 'ph-arrows-merge',  color: '#F97316', label: 'Concurrency' },
  'Parallelism':    { icon: 'ph-cpu',           color: '#8B5CF6', label: 'Parallelism' },
  'Multiprocessing':{ icon: 'ph-house-line',    color: '#10B981', label: 'Multiprocessing' },
};

function getExecutionMode() {
  return (window.AppState && window.AppState.executionMode) || 'Concurrency';
}

function getEffectiveVisibility() {
  const mode = getExecutionMode();
  const showsThreads = mode === 'Multithreading' || mode === 'Concurrency' || mode === 'Parallelism';
  const showsForks   = mode === 'Concurrency' || mode === 'Parallelism';
  return {
    mode,
    threadsVisible: !!(window.AppState && window.AppState.threadsEnabled) && showsThreads,
    forksVisible:   !!(window.AppState && window.AppState.forksEnabled) && showsForks,
  };
}

function updateExecutionModeBadge() {
  const badge = document.getElementById('gantt-mode-badge');
  if (!badge) return;
  const meta = EXEC_MODE_META[getExecutionMode()] || EXEC_MODE_META['Concurrency'];
  badge.innerHTML = `<i class="ph ${meta.icon}"></i> ${meta.label}`;
  badge.style.color = meta.color;
  badge.style.borderColor = meta.color + '55';
  badge.style.background = meta.color + '15';
}

window.getEffectiveVisibility = getEffectiveVisibility;
window.getExecutionMode = getExecutionMode;

/* ═══════════════════════════════════════════════════════════════════════
   Global State
   ═══════════════════════════════════════════════════════════════════════ */
const AppState = {
  processes: [],
  nextPid: 1,
  lastScheduleResult: null,
  lastComparisonResult: null,
  numCores: 1,
  threadsEnabled: false,
  forksEnabled: false,
  executionMode: 'Concurrency',
};

/* ═══════════════════════════════════════════════════════════════════════
   Navigation
   ═══════════════════════════════════════════════════════════════════════ */
function initNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const screens = document.querySelectorAll(".screen");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;

      // Update nav active state
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Switch screen
      screens.forEach((s) => {
        s.classList.remove("active");
        // Force reflow for animation restart
        void s.offsetWidth;
      });
      const targetScreen = document.getElementById(`screen-${target}`);
      if (targetScreen) {
        targetScreen.classList.add("active");
        // Re-trigger tracking-in-expand on the screen's heading so the
        // typography effect plays every time the user navigates here.
        const heading = targetScreen.querySelector('h2[id^="heading-"]');
        if (heading && heading.classList.contains('tracking-in-expand')) {
          heading.classList.remove('tracking-in-expand');
          void heading.offsetWidth;       // force reflow
          heading.classList.add('tracking-in-expand');
        }
        if (target === 'comparison' && typeof initComparison === 'function') {
          initComparison();
        }
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Toast Notifications
   ═══════════════════════════════════════════════════════════════════════ */
function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  const icons = {
    success: '<i class="ph ph-check-circle"></i>',
    error: '<i class="ph ph-x-circle"></i>',
    info: '<i class="ph ph-info"></i>',
    warning: '<i class="ph ph-warning-circle"></i>',
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '<i class="ph ph-info"></i>'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════════════
   API Helper
   ═══════════════════════════════════════════════════════════════════════ */
async function apiCall(endpoint, data = null) {
  try {
    const options = {
      method: data ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  } catch (err) {
    showToast(`API Error: ${err.message}`, "error");
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Process Management
   ═══════════════════════════════════════════════════════════════════════ */
function renderProcessTable() {
  const tbody = document.getElementById("process-tbody");
  const empty = document.getElementById("empty-processes");
  const countEl = document.getElementById("process-count");
  const thThreads = document.getElementById("th-threads");
  const thForks = document.getElementById("th-forks");

  countEl.textContent = AppState.processes.length;

  // Show/hide threads & forks columns
  if (thThreads) {
    thThreads.style.display = AppState.threadsEnabled ? '' : 'none';
  }
  if (thForks) {
    thForks.style.display = AppState.forksEnabled ? '' : 'none';
  }

  if (AppState.processes.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  let html = '';
  AppState.processes.forEach((p, i) => {
    const threads = p.threads || [];
    const forks = p.forks || [];
    const threadCount = threads.length;
    const forkCount = forks.length;
    const maxThreads = 4;
    const maxForks = 3;
    const canAddThread = AppState.threadsEnabled && threadCount < maxThreads;
    const canAddFork = AppState.forksEnabled && forkCount < maxForks;

    const threadCell = AppState.threadsEnabled
      ? `<td>
          <div class="thread-actions-cell">
            <button class="btn-add-thread" onclick="addThread(${p.pid})" title="Añadir thread" ${!canAddThread ? 'disabled' : ''}>
              <i class="ph ph-plus"></i>
            </button>
            <span class="thread-count-badge">${threadCount}/${maxThreads}</span>
          </div>
        </td>`
      : '';

    const forkCell = AppState.forksEnabled
      ? `<td>
          <div class="fork-actions-cell">
            <button class="btn-add-fork" onclick="addFork(${p.pid})" title="Añadir fork (proceso hijo)" ${!canAddFork ? 'disabled' : ''}>
              <i class="ph ph-plus"></i>
            </button>
            <span class="fork-count-badge">${forkCount}/${maxForks}</span>
          </div>
        </td>`
      : '';

    html += `
    <tr style="animation: fadeSlideIn 0.3s ease ${i * 0.05}s both;">
      <td>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pidColor(p.pid)};margin-right:8px;"></span>
        P${p.pid}
      </td>
      <td>${p.arrival_time}</td>
      <td>${p.burst_time}</td>
      <td>${p.priority}</td>
      <td>${p.num_pages}</td>
      ${threadCell}
      ${forkCell}
      <td>
        <button class="btn-remove" onclick="removeProcess(${p.pid})" title="Eliminar proceso" aria-label="Eliminar proceso P${p.pid}">✕</button>
      </td>
    </tr>`;

    // Render thread sub-rows
    if (AppState.threadsEnabled && threads.length > 0) {
      threads.forEach((t, ti) => {
        const tColor = pidColor(p.pid) + 'AA';
        const threadTd = AppState.threadsEnabled ? '<td></td>' : '';
        const forkTd = AppState.forksEnabled ? '<td></td>' : '';
        html += `
        <tr class="thread-sub-row" style="animation-delay: ${(i * 0.05) + (ti * 0.03)}s">
          <td>
            <span class="thread-pid-label">
              <i class="ph ph-git-branch"></i>
              <span class="thread-dot" style="background:${tColor}"></span>
              P${p.pid}.T${t.tid}
            </span>
          </td>
          <td>${p.arrival_time}</td>
          <td>${t.burst_time}</td>
          <td>${p.priority}</td>
          <td>—</td>
          ${threadTd}
          ${forkTd}
          <td>
            <button class="btn-remove-thread" onclick="removeThread(${p.pid}, ${t.tid})" title="Eliminar thread">✕</button>
          </td>
        </tr>`;
      });
    }

    // Render fork sub-rows
    if (AppState.forksEnabled && forks.length > 0) {
      forks.forEach((f, fi) => {
        const threadTd = AppState.threadsEnabled ? '<td></td>' : '';
        const forkTd = AppState.forksEnabled ? '<td></td>' : '';
        html += `
        <tr class="fork-sub-row" style="animation-delay: ${(i * 0.05) + (fi * 0.03)}s">
          <td>
            <span class="fork-pid-label">
              <i class="ph ph-git-fork"></i>
              <span class="fork-dot" style="background:#10B981"></span>
              P${p.pid}⑂F${f.fid}
            </span>
          </td>
          <td>${p.arrival_time + (f.delay || 0)}</td>
          <td>${f.burst_time}</td>
          <td>${p.priority}</td>
          <td>—</td>
          ${threadTd}
          ${forkTd}
          <td>
            <button class="btn-remove-fork" onclick="removeFork(${p.pid}, ${f.fid})" title="Eliminar fork">✕</button>
          </td>
        </tr>`;
      });
    }
  });

  tbody.innerHTML = html;
}

function addProcess() {
  const arrival = parseInt(document.getElementById("input-arrival").value) || 0;
  const burst = parseInt(document.getElementById("input-burst").value) || 1;
  const priority =
    parseInt(document.getElementById("input-priority").value) || 0;
  const pages = parseInt(document.getElementById("input-pages").value) || 1;

  if (burst < 1) {
    showToast("Burst time debe ser ≥ 1", "warning");
    return;
  }

  const process = {
    pid: AppState.nextPid++,
    arrival_time: arrival,
    burst_time: burst,
    priority: priority,
    num_pages: pages,
    threads: [],
    forks: [],
  };

  AppState.processes.push(process);
  renderProcessTable();
  showToast(`Proceso P${process.pid} agregado`, "success");
}

function removeProcess(pid) {
  AppState.processes = AppState.processes.filter((p) => p.pid !== pid);
  renderProcessTable();
}

function clearProcesses() {
  AppState.processes = [];
  AppState.nextPid = 1;
  renderProcessTable();
  showToast("All processes cleared", "info");
}

/* ═══════════════════════════════════════════════════════════════════════
   Sample Datasets  (7 variantes — se elige una random distinta a la anterior)
   ═══════════════════════════════════════════════════════════════════════ */
const SAMPLE_SETS = [
  // 0 — Clásico balanceado (sin threads/forks)
  {
    label: 'Clásico balanceado',
    procs: [
      { pid:1, arrival_time:0, burst_time:5, priority:2, num_pages:3 },
      { pid:2, arrival_time:1, burst_time:3, priority:1, num_pages:2 },
      { pid:3, arrival_time:2, burst_time:8, priority:3, num_pages:4 },
      { pid:4, arrival_time:3, burst_time:2, priority:4, num_pages:1 },
      { pid:5, arrival_time:4, burst_time:4, priority:2, num_pages:2 },
      { pid:6, arrival_time:6, burst_time:6, priority:3, num_pages:3 },
    ],
    threads: { 1:[{tid:1,burst_time:2},{tid:2,burst_time:3}], 3:[{tid:1,burst_time:3},{tid:2,burst_time:2}], 5:[{tid:1,burst_time:4}] },
    forks:   { 2:[{fid:1,burst_time:2,delay:1}], 3:[{fid:1,burst_time:3,delay:1},{fid:2,burst_time:2,delay:2}] },
  },
  // 1 — Muchos threads, sin forks
  {
    label: 'Heavy Multithreading',
    procs: [
      { pid:1, arrival_time:0, burst_time:10, priority:1, num_pages:4 },
      { pid:2, arrival_time:0, burst_time:8,  priority:2, num_pages:3 },
      { pid:3, arrival_time:2, burst_time:6,  priority:3, num_pages:2 },
      { pid:4, arrival_time:3, burst_time:12, priority:1, num_pages:5 },
      { pid:5, arrival_time:5, burst_time:4,  priority:2, num_pages:2 },
    ],
    threads: {
      1:[{tid:1,burst_time:3},{tid:2,burst_time:3},{tid:3,burst_time:4}],
      2:[{tid:1,burst_time:2},{tid:2,burst_time:2},{tid:3,burst_time:2},{tid:4,burst_time:2}],
      4:[{tid:1,burst_time:4},{tid:2,burst_time:4},{tid:3,burst_time:4}],
    },
    forks: {},
  },
  // 2 — Muchos forks, sin threads
  {
    label: 'Fork Storm',
    procs: [
      { pid:1, arrival_time:0, burst_time:8,  priority:3, num_pages:3 },
      { pid:2, arrival_time:1, burst_time:6,  priority:2, num_pages:2 },
      { pid:3, arrival_time:2, burst_time:10, priority:1, num_pages:4 },
      { pid:4, arrival_time:4, burst_time:5,  priority:3, num_pages:2 },
      { pid:5, arrival_time:5, burst_time:7,  priority:2, num_pages:3 },
    ],
    threads: {},
    forks: {
      1:[{fid:1,burst_time:3,delay:1},{fid:2,burst_time:2,delay:2}],
      2:[{fid:1,burst_time:2,delay:1}],
      3:[{fid:1,burst_time:4,delay:1},{fid:2,burst_time:3,delay:2},{fid:3,burst_time:2,delay:3}],
      5:[{fid:1,burst_time:3,delay:1},{fid:2,burst_time:3,delay:2}],
    },
  },
  // 3 — Rafagas cortas, alta concurrencia (Round Robin ideal)
  {
    label: 'Ráfagas Cortas RR',
    procs: [
      { pid:1, arrival_time:0, burst_time:2, priority:1, num_pages:1 },
      { pid:2, arrival_time:0, burst_time:3, priority:2, num_pages:1 },
      { pid:3, arrival_time:1, burst_time:2, priority:1, num_pages:2 },
      { pid:4, arrival_time:1, burst_time:4, priority:3, num_pages:2 },
      { pid:5, arrival_time:2, burst_time:2, priority:2, num_pages:1 },
      { pid:6, arrival_time:2, burst_time:3, priority:1, num_pages:2 },
      { pid:7, arrival_time:3, burst_time:2, priority:3, num_pages:1 },
    ],
    threads: {},
    forks: {},
  },
  // 4 — Mix completo: threads + forks en distintos procesos
  {
    label: 'Mix Threads + Forks',
    procs: [
      { pid:1, arrival_time:0, burst_time:9,  priority:2, num_pages:4 },
      { pid:2, arrival_time:1, burst_time:5,  priority:1, num_pages:2 },
      { pid:3, arrival_time:2, burst_time:7,  priority:3, num_pages:3 },
      { pid:4, arrival_time:3, burst_time:4,  priority:4, num_pages:2 },
      { pid:5, arrival_time:4, burst_time:11, priority:1, num_pages:5 },
      { pid:6, arrival_time:5, burst_time:6,  priority:2, num_pages:3 },
    ],
    threads: {
      1:[{tid:1,burst_time:3},{tid:2,burst_time:3}],
      5:[{tid:1,burst_time:3},{tid:2,burst_time:4},{tid:3,burst_time:4}],
    },
    forks: {
      2:[{fid:1,burst_time:2,delay:1}],
      3:[{fid:1,burst_time:3,delay:1},{fid:2,burst_time:2,delay:2}],
      6:[{fid:1,burst_time:3,delay:1}],
    },
  },
  // 5 — Proceso largo dominante (convoy effect visible)
  {
    label: 'Efecto Convoy',
    procs: [
      { pid:1, arrival_time:0,  burst_time:20, priority:3, num_pages:6 },
      { pid:2, arrival_time:0,  burst_time:2,  priority:1, num_pages:1 },
      { pid:3, arrival_time:1,  burst_time:3,  priority:2, num_pages:1 },
      { pid:4, arrival_time:2,  burst_time:2,  priority:1, num_pages:1 },
      { pid:5, arrival_time:3,  burst_time:1,  priority:1, num_pages:1 },
    ],
    threads: { 1:[{tid:1,burst_time:8},{tid:2,burst_time:8}] },
    forks:   {},
  },
  // 6 — Llegadas tardías + prioridades extremas
  {
    label: 'Llegadas Tardías',
    procs: [
      { pid:1, arrival_time:0,  burst_time:4,  priority:1, num_pages:2 },
      { pid:2, arrival_time:5,  burst_time:6,  priority:4, num_pages:3 },
      { pid:3, arrival_time:8,  burst_time:3,  priority:2, num_pages:2 },
      { pid:4, arrival_time:10, burst_time:8,  priority:5, num_pages:4 },
      { pid:5, arrival_time:12, burst_time:5,  priority:3, num_pages:2 },
      { pid:6, arrival_time:15, burst_time:2,  priority:1, num_pages:1 },
    ],
    threads: { 4:[{tid:1,burst_time:3},{tid:2,burst_time:3}] },
    forks:   { 2:[{fid:1,burst_time:2,delay:1},{fid:2,burst_time:2,delay:2}] },
  },
];

let _lastSampleIdx = -1;

function loadSampleProcesses() {
  // Pick a random index different from the last one
  let idx;
  do { idx = Math.floor(Math.random() * SAMPLE_SETS.length); }
  while (idx === _lastSampleIdx && SAMPLE_SETS.length > 1);
  _lastSampleIdx = idx;

  const set = SAMPLE_SETS[idx];

  // Auto-enable toggles if this dataset has threads / forks
  const hasThreads = Object.keys(set.threads).length > 0;
  const hasForks   = Object.keys(set.forks).length > 0;

  if (hasThreads && !AppState.threadsEnabled) {
    AppState.threadsEnabled = true;
    const t = document.getElementById('toggle');
    const txt = document.getElementById('threads-status-text');
    if (t) t.checked = true;
    if (txt) { txt.textContent = 'Enabled'; txt.classList.add('active'); }
  }
  if (hasForks && !AppState.forksEnabled) {
    AppState.forksEnabled = true;
    const f = document.getElementById('toggle-forks');
    const txt = document.getElementById('forks-status-text');
    if (f) f.checked = true;
    if (txt) { txt.textContent = 'Enabled'; txt.classList.add('active'); }
  }

  AppState.processes = set.procs.map(p => ({
    ...p,
    threads: AppState.threadsEnabled ? (set.threads[p.pid] || []) : [],
    forks:   AppState.forksEnabled   ? (set.forks[p.pid]   || []) : [],
  }));

  AppState.nextPid = Math.max(...AppState.processes.map(p => p.pid)) + 1;
  renderProcessTable();

  const extras = [];
  if (hasThreads) extras.push('threads');
  if (hasForks)   extras.push('forks');
  const tail = extras.length ? ` · ${extras.join(' + ')}` : '';
  showToast(`Sample #${idx + 1}: ${set.label}${tail}`, 'success');
}

/* ═══════════════════════════════════════════════════════════════════════
   Thread Management
   ═══════════════════════════════════════════════════════════════════════ */
function addThread(pid) {
  const process = AppState.processes.find(p => p.pid === pid);
  if (!process) return;
  if (!process.threads) process.threads = [];
  if (process.threads.length >= 4) {
    showToast('Maximum 4 threads per process', 'warning');
    return;
  }
  const nextTid = process.threads.length > 0
    ? Math.max(...process.threads.map(t => t.tid)) + 1
    : 1;
  const burstTime = Math.max(1, Math.floor(process.burst_time / (process.threads.length + 2)));
  process.threads.push({ tid: nextTid, burst_time: burstTime });
  renderProcessTable();
  showToast(`Thread T${nextTid} added to P${pid}`, 'success');
}

function removeThread(pid, tid) {
  const process = AppState.processes.find(p => p.pid === pid);
  if (!process || !process.threads) return;
  process.threads = process.threads.filter(t => t.tid !== tid);
  renderProcessTable();
}

window.addThread = addThread;
window.removeThread = removeThread;

/* ═══════════════════════════════════════════════════════════════════════
   Fork Management
   ═══════════════════════════════════════════════════════════════════════ */
function addFork(pid) {
  const process = AppState.processes.find(p => p.pid === pid);
  if (!process) return;
  if (!process.forks) process.forks = [];
  if (process.forks.length >= 3) {
    showToast('Maximum 3 forks per process', 'warning');
    return;
  }
  const nextFid = process.forks.length > 0
    ? Math.max(...process.forks.map(f => f.fid)) + 1
    : 1;
  const burstTime = Math.max(1, Math.ceil(process.burst_time / 2));
  const delay = process.forks.length + 1;
  process.forks.push({ fid: nextFid, burst_time: burstTime, delay });
  renderProcessTable();
  showToast(`Fork F${nextFid} added to P${pid}`, 'success');
}

function removeFork(pid, fid) {
  const process = AppState.processes.find(p => p.pid === pid);
  if (!process || !process.forks) return;
  process.forks = process.forks.filter(f => f.fid !== fid);
  renderProcessTable();
}

window.addFork = addFork;
window.removeFork = removeFork;

/* ═══════════════════════════════════════════════════════════════════════
   CSV Import
   ═══════════════════════════════════════════════════════════════════════
   Expected columns (header is required, case-insensitive, order-flexible):
     PID, Arrival, Burst, Priority, Pages, Threads, Forks

   Threads / Forks accept:
     - empty or "0" / "-" → none
     - single integer N → N children, parent burst auto-split
     - semicolon-separated burst times → "2;3" → two children with those bursts
   ═══════════════════════════════════════════════════════════════════════ */
function parseCSVLine(line) {
  // Minimal CSV split: supports quoted fields with commas inside.
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseChildrenSpec(spec, parentBurst) {
  // Returns an array of { burst_time }. Empty / "0" / "-" → [].
  if (spec == null) return [];
  const s = String(spec).trim();
  if (s === '' || s === '0' || s === '-') return [];

  // Semicolon-separated burst times wins over a plain integer.
  if (s.includes(';')) {
    return s.split(';')
      .map(x => parseInt(x.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0)
      .map(burst_time => ({ burst_time }));
  }

  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return [];
  // Plain count → split parent burst across N children.
  const each = Math.max(1, Math.floor(parentBurst / (n + 1)));
  return Array.from({ length: n }, () => ({ burst_time: each }));
}

function importProcessesFromCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    showToast('Empty CSV', 'warning');
    return;
  }

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const required = ['pid', 'arrival', 'burst', 'priority', 'pages'];
  const missing = required.filter(c => !header.includes(c));
  if (missing.length) {
    showToast(`CSV missing columns: ${missing.join(', ')}`, 'error');
    return;
  }

  const colIdx = (name) => header.indexOf(name);
  const idx = {
    pid: colIdx('pid'),
    arrival: colIdx('arrival'),
    burst: colIdx('burst'),
    priority: colIdx('priority'),
    pages: colIdx('pages'),
    threads: colIdx('threads'),       // -1 if absent
    forks: colIdx('forks'),
  };

  const processes = [];
  let anyThreads = false, anyForks = false;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const pid = parseInt(cells[idx.pid], 10);
    const arrival = parseInt(cells[idx.arrival], 10);
    const burst = parseInt(cells[idx.burst], 10);
    const priority = parseInt(cells[idx.priority], 10);
    const pages = parseInt(cells[idx.pages], 10);

    if (!Number.isFinite(pid) || !Number.isFinite(burst) || burst < 1) {
      skipped++; continue;
    }

    const threadsSpec = idx.threads >= 0 ? cells[idx.threads] : '';
    const forksSpec = idx.forks >= 0 ? cells[idx.forks] : '';

    const threads = parseChildrenSpec(threadsSpec, burst)
      .slice(0, 4)
      .map((t, k) => ({ tid: k + 1, burst_time: t.burst_time }));

    const forks = parseChildrenSpec(forksSpec, burst)
      .slice(0, 3)
      .map((f, k) => ({ fid: k + 1, burst_time: f.burst_time, delay: k + 1 }));

    if (threads.length) anyThreads = true;
    if (forks.length) anyForks = true;

    processes.push({
      pid,
      arrival_time: Number.isFinite(arrival) ? arrival : 0,
      burst_time: burst,
      priority: Number.isFinite(priority) ? priority : 0,
      num_pages: Number.isFinite(pages) && pages > 0 ? pages : 1,
      threads,
      forks,
    });
  }

  if (processes.length === 0) {
    showToast('No valid rows found in the CSV', 'error');
    return;
  }

  // Auto-enable toggles if the CSV brought threads/forks
  if (anyThreads && !AppState.threadsEnabled) {
    AppState.threadsEnabled = true;
    const t = document.getElementById('toggle');
    const txt = document.getElementById('threads-status-text');
    if (t) t.checked = true;
    if (txt) { txt.textContent = 'Activado'; txt.classList.add('active'); }
  }
  if (anyForks && !AppState.forksEnabled) {
    AppState.forksEnabled = true;
    const f = document.getElementById('toggle-forks');
    const txt = document.getElementById('forks-status-text');
    if (f) f.checked = true;
    if (txt) { txt.textContent = 'Activado'; txt.classList.add('active'); }
  }

  AppState.processes = processes;
  AppState.nextPid = Math.max(...processes.map(p => p.pid)) + 1;
  renderProcessTable();

  const tail = skipped ? ` (${skipped} invalid rows skipped)` : '';
  showToast(`Imported ${processes.length} processes from CSV${tail}`, 'success');
}

function handleCSVFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importProcessesFromCSV(String(reader.result || ''));
  reader.onerror = () => showToast('Error leyendo el archivo', 'error');
  reader.readAsText(file);
  e.target.value = '';   // allow re-importing the same file
}

/* ═══════════════════════════════════════════════════════════════════════
   Simulation Runner
   ═══════════════════════════════════════════════════════════════════════ */
async function runSimulation() {
  if (AppState.processes.length === 0) {
    showToast("Add at least one process before running", "warning");
    return;
  }

  const algo = document.getElementById("algo-select").value;
  const quantum = parseInt(document.getElementById("quantum-input").value) || 2;

  const runBtn = document.getElementById("btn-run-simulation");
  runBtn.disabled = true;
  runBtn.innerHTML =
    '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div> Running...';

  try {
    const result = await apiCall("/api/schedule", {
      algorithm: algo,
      quantum: quantum,
      processes: AppState.processes,
    });

    AppState.lastScheduleResult = result;

    // Update scheduling screen
    // Switch to scheduling screen
    document.querySelector('[data-screen="scheduling"]').click();

    // Force reflow/paint un momentito si es necesario, pero click() debe ser sincrono.
    // Update scheduling screen
    updateSchedulingStats(result);
    setTimeout(() => {
      drawGanttChart(result);
      if (window.updateLiveMetricsTable) {
        window.updateLiveMetricsTable(result, 0);
      }
    }, 50);

    // Update status bar
    document.getElementById("status-text").textContent =
      `Simulation complete — ${algo} | Avg TAT: ${result.avg_turnaround} | CPU: ${result.cpu_utilization}%`;

    showToast(`${algo} simulation completed successfully`, "success");
  } catch (err) {
    // Error already shown by apiCall
  } finally {
    runBtn.disabled = false;
    runBtn.innerHTML = "▶️ Run Simulation";
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Scheduling Stats
   ═══════════════════════════════════════════════════════════════════════ */
function updateSchedulingStats(result) {
  const algoEl = document.getElementById("heading-scheduling");
  algoEl.textContent = result.algorithm + " Scheduling";

  // Re-trigger the tracking-in-expand animation
  algoEl.classList.remove("tracking-in-expand");
  void algoEl.offsetWidth; // force reflow
  algoEl.classList.add("tracking-in-expand");

  document.getElementById("stat-avg-tat").textContent = result.avg_turnaround;
  document.getElementById("stat-avg-wt").textContent = result.avg_waiting;
  document.getElementById("stat-avg-rt").textContent = result.avg_response;
  document.getElementById("stat-cpu-util").textContent =
    result.cpu_utilization + "%";
  document.getElementById("stat-ctx-sw").textContent = result.context_switches;

  // Sticky game link update
  const stickyLink = document.getElementById("sticky-game-link");
  if (stickyLink) {
    if (result.algorithm === "FCFS") {
      stickyLink.style.display = "flex";
      stickyLink.href = "fcfs_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play FCFS (Mario)";
      document.getElementById("sticky-game-icon").className =
        "ph ph-game-controller";
    } else if (result.algorithm === "SJF") {
      stickyLink.style.display = "flex";
      stickyLink.href = "sjf_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play SJF (Mario)";
      document.getElementById("sticky-game-icon").className = "ph ph-rocket";
    } else if (result.algorithm === "HRRN") {
      stickyLink.style.display = "flex";
      stickyLink.href = "hrrn_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play HRRN (Mario)";
      document.getElementById("sticky-game-icon").className = "ph ph-star";
    } else if (result.algorithm === "Round Robin") {
      stickyLink.style.display = "flex";
      stickyLink.href = "rr_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play Round Robin (Mario)";
      document.getElementById("sticky-game-icon").className =
        "ph ph-arrows-clockwise";
    } else if (result.algorithm === "Multilevel Queue") {
      stickyLink.style.display = "flex";
      stickyLink.href = "multilevel_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play Multilevel Queue (Mario)";
      document.getElementById("sticky-game-icon").className =
        "ph ph-arrows-clockwise";
    } else if (result.algorithm === "MLFQ") {
      stickyLink.style.display = "flex";
      stickyLink.href = "mlfq_game.html";
      document.getElementById("sticky-game-text").textContent =
        "Play MLFQ (Mario)";
      document.getElementById("sticky-game-icon").className =
        "ph ph-arrows-clockwise";
    } else {
      stickyLink.style.display = "none";
    }
  }

  // Mario Algo Tooltip update
  const tooltipBtn = document.getElementById("algo-mario-tooltip");
  const popupTitle = document.getElementById("algo-popup-title");
  const popupDesc = document.getElementById("algo-popup-desc");
  if (tooltipBtn && popupTitle && popupDesc) {
    tooltipBtn.style.display = "flex";
    popupTitle.textContent = result.algorithm;
    let desc = "";
    switch (result.algorithm) {
      case "FCFS":
        desc =
          'First-Come, First-Served: The first process to arrive in the ready queue is the first to receive the CPU. It is non-preemptive. Its simplicity is ideal, but it often suffers from the "convoy effect" (short processes waiting for a long one).';
        break;
      case "SJF":
        desc =
          "Shortest Job First: Selects the process with the shortest CPU burst time available. Minimizes the average waiting time, but can cause starvation for longer processes.";
        break;
      case "HRRN":
        desc =
          'Highest Response Ratio Next: Dynamically selects the process with the highest "Response Ratio", calculated as (Waiting + Burst) / Burst. It is the cure for starvation, as patience mathematically increases the value of the process.';
        break;
      case "Round Robin":
        desc =
          'Round Robin: Each process is assigned a "Quantum" or maximum time interval. If it does not finish within that Quantum, it is paused and sent to the back of the queue. Very fair, ideal for interactive and time-sharing systems.';
        break;
      case "SRTF":
        desc =
          "Shortest Remaining Time First: The preemptive version of SJF. If a new process arrives with a shorter burst than the remaining time of the current process, the system pauses it to execute the faster one first.";
        break;
      case "Priority (Preemptive)":
        desc =
          "Priority Scheduling (Preemptive): The CPU is always assigned to the process with the highest priority. If a more important process lands in the queue, it preempts the current one from the CPU immediately.";
        break;
      case "Multilevel Queue":
        desc =
          "Multilevel Queues: The system maintains several strictly separated queues (by priority or type). Each process is assigned to a single queue permanently based on its characteristics.";
        break;
      case "MLFQ":
        desc =
          'Multilevel Feedback Queue: Multiple interconnected queues. Processes can "move up" or "move down" in priority depending on their behavior. If a process uses too much CPU, it moves down a queue; if it waits too long, it moves up a level.';
        break;
      default:
        desc = "CPU Scheduling simulation.";
        break;
    }
    popupDesc.textContent = desc;
  }
}

window.updateLiveMetricsTable = function (result, t) {
  const tbody = document.getElementById("metrics-tbody");
  if (!tbody || !result) return;
  const tick = Math.max(0, Math.floor(t));
  const gantt = result.gantt || [];

  // Find first start times for RT
  const firstStarts = {};
  for (const entry of gantt) {
    if (entry.pid < 0) continue;
    if (!(entry.pid in firstStarts)) {
      firstStarts[entry.pid] = entry.start;
    }
  }

  tbody.innerHTML = result.metrics
    .map((m, i) => {
      // Has Arrived?
      if (m.arrival_time > tick) {
        return `
        <tr style="opacity: 0.5">
          <td>
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pidColor(m.pid)};margin-right:8px;"></span>
            P${m.pid}
          </td>
          <td>${m.arrival_time}</td>
          <td>${m.burst_time}</td>
          <td colspan="4" class="text-muted" style="text-align:center;font-style:italic">Arrives at t=${m.arrival_time}...</td>
        </tr>`;
      }

      const completed = m.completion_time <= tick;
      const hasStarted =
        firstStarts[m.pid] !== undefined && firstStarts[m.pid] <= tick;

      // Completion Time
      let compHtml = completed
        ? `<strong>${m.completion_time}</strong>`
        : `<span class="text-muted">⏳ in progress</span>`;

      // RT
      let rtHtml = "—";
      if (hasStarted) {
        rtHtml = `<span style="font-size:0.75rem; color:var(--info)">${firstStarts[m.pid]} - ${m.arrival_time}</span> = <strong>${m.response_time}</strong>`;
      } else {
        rtHtml = `<span class="text-muted">waiting for CPU...</span>`;
      }

      // TAT
      let tatHtml = "—";
      if (completed) {
        tatHtml = `<span style="font-size:0.75rem; color:var(--purple-main)">${m.completion_time} - ${m.arrival_time}</span> = <strong>${m.turnaround_time}</strong>`;
      } else {
        tatHtml = `<span class="text-muted text-mono">t=${tick - m.arrival_time}</span>`;
      }

      // WT
      let wtHtml = "—";
      if (completed) {
        wtHtml = `<span style="font-size:0.75rem; color:var(--warning)">${m.turnaround_time} - ${m.burst_time}</span> = <strong>${m.waiting_time}</strong>`;
      } else {
        // Calculate live WT = (tick - arrival) - time_on_cpu
        let cpuTime = 0;
        for (const entry of gantt) {
          if (entry.pid === m.pid && entry.start < tick) {
            cpuTime += Math.min(entry.end, tick) - entry.start;
          }
        }
        const liveWt = tick - m.arrival_time - cpuTime;
        wtHtml = `<span class="text-muted text-mono">acum: ${liveWt}</span>`;
      }

      return `
      <tr style="${completed ? "background: rgba(34, 197, 94, 0.05);" : ""}">
        <td>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pidColor(m.pid)};margin-right:8px;"></span>
          <strong>P${m.pid}</strong>
        </td>
        <td>${m.arrival_time}</td>
        <td>${m.burst_time}</td>
        <td>${compHtml}</td>
        <td>${tatHtml}</td>
        <td>${wtHtml}</td>
        <td>${rtHtml}</td>
      </tr>
    `;
    })
    .join("");
};

/* ═══════════════════════════════════════════════════════════════════════
   Quantum Visibility Toggle
   ═══════════════════════════════════════════════════════════════════════ */
function updateQuantumVisibility() {
  const algo = document.getElementById("algo-select").value;
  const group = document.getElementById("quantum-group");
  const needsQuantum = ["Round Robin", "MLFQ"];
  group.style.display = needsQuantum.includes(algo) ? "block" : "none";

  const fcfsContainer = document.getElementById("fcfs-game-link-container");
  if (fcfsContainer) {
    fcfsContainer.style.display =
      algo === "FCFS" ||
      algo === "SJF" ||
      algo === "HRRN" ||
      algo === "Round Robin" ||
      algo === "SRTF" ||
      algo === "Priority (Preemptive)" ||
      algo === "Multilevel Queue" ||
      algo === "MLFQ"
        ? "flex"
        : "none";
    const btnFCFS = document.getElementById("btn-fcfs-game");
    const btnSJF = document.getElementById("btn-sjf-game");
    const btnHRRN = document.getElementById("btn-hrrn-game");
    const btnRR = document.getElementById("btn-rr-game");
    const btnSRTF = document.getElementById("btn-srtf-game");
    const btnPRIO = document.getElementById("btn-pri-game");
    const btnmulti = document.getElementById("btn-multi-game");
    const btnMLFQ = document.getElementById("btn-mlfq-game");
    if (btnFCFS) btnFCFS.style.display = algo === "FCFS" ? "flex" : "none";
    if (btnSJF) btnSJF.style.display = algo === "SJF" ? "flex" : "none";
    if (btnHRRN) btnHRRN.style.display = algo === "HRRN" ? "flex" : "none";
    if (btnRR) btnRR.style.display = algo === "Round Robin" ? "flex" : "none";
    if (btnSRTF) btnSRTF.style.display = algo === "SRTF" ? "flex" : "none";
    if (btnPRIO)
      btnPRIO.style.display =
        algo === "Priority (Preemptive)" ? "flex" : "none";
    if (btnmulti)
      btnmulti.style.display = algo === "Multilevel Queue" ? "flex" : "none";
    if (btnMLFQ) btnMLFQ.style.display = algo === "MLFQ" ? "flex" : "none";
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Particles Background
   ═══════════════════════════════════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById("particles-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  let animationId;

  // Check reduced motion
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReducedMotion) return;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 15000);
    for (let i = 0; i < Math.min(count, 60); i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(37, 99, 235, ${p.alpha * 0.7})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }

    animationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Connection Check
   ═══════════════════════════════════════════════════════════════════════ */
async function checkConnection() {
  try {
    await apiCall("/api/algorithms");
    document.getElementById("connection-dot").style.background =
      "var(--success)";
    document.getElementById("connection-text").textContent = "Connected";
  } catch {
    document.getElementById("connection-dot").style.background = "var(--error)";
    document.getElementById("connection-text").textContent = "Disconnected";
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initParticles();
  renderProcessTable();
  updateQuantumVisibility();
  checkConnection();
  const btnMemGame = document.getElementById("btn-memory-game");
  if (btnMemGame) btnMemGame.addEventListener("click", openMemoryGame);

  const btnGalaxyGame = document.getElementById("btn-galaxy-game");
  if (btnGalaxyGame) btnGalaxyGame.addEventListener("click", openGalaxyGame);

  // Process management
  document
    .getElementById("btn-add-process")
    .addEventListener("click", addProcess);
  document
    .getElementById("btn-load-sample")
    .addEventListener("click", loadSampleProcesses);
  document
    .getElementById("btn-clear-processes")
    .addEventListener("click", clearProcesses);
  const csvBtn = document.getElementById("btn-import-csv");
  const csvInput = document.getElementById("input-csv-file");
  const csvDialog = document.getElementById("csv-import-dialog");
  const csvDialogPick = document.getElementById("csv-dialog-pick");
  const csvDialogCancel = document.getElementById("csv-dialog-cancel");
  const csvDialogClose = document.getElementById("csv-dialog-close-btn");
  if (csvBtn && csvInput && csvDialog) {
    csvBtn.addEventListener("click", () => {
      if (typeof csvDialog.showModal === "function") csvDialog.showModal();
      else csvInput.click();   // fallback for ancient browsers
    });
    csvInput.addEventListener("change", handleCSVFileChange);
    if (csvDialogPick) {
      csvDialogPick.addEventListener("click", () => {
        csvDialog.close();
        csvInput.click();
      });
    }
    if (csvDialogCancel) csvDialogCancel.addEventListener("click", () => csvDialog.close());
    if (csvDialogClose) csvDialogClose.addEventListener("click", () => csvDialog.close());
    // Click on backdrop closes the dialog
    csvDialog.addEventListener("click", (e) => {
      if (e.target === csvDialog) csvDialog.close();
    });
  }
  document
    .getElementById("btn-run-simulation")
    .addEventListener("click", runSimulation);
  document
    .getElementById("algo-select")
    .addEventListener("change", updateQuantumVisibility);

  // Cores slider
  const coresSlider = document.getElementById("cores-slider");
  const coresValueBadge = document.getElementById("cores-value-badge");
  if (coresSlider && coresValueBadge) {
    coresSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      AppState.numCores = val;
      coresValueBadge.textContent = val;
      coresValueBadge.classList.remove('pop');
      void coresValueBadge.offsetWidth;
      coresValueBadge.classList.add('pop');
    });
  }

  // Thread toggle
  const threadsToggle = document.getElementById("toggle");
  const threadsStatusText = document.getElementById("threads-status-text");
  if (threadsToggle) {
    threadsToggle.addEventListener("change", (e) => {
      AppState.threadsEnabled = e.target.checked;
      if (threadsStatusText) {
        threadsStatusText.textContent = e.target.checked ? 'Enabled' : 'Disabled';
        threadsStatusText.classList.toggle('active', e.target.checked);
      }
      if (!e.target.checked) {
        AppState.processes.forEach(p => { p.threads = []; });
      }
      renderProcessTable();
    });
  }

  // Execution mode select
  const execModeSelect = document.getElementById("exec-mode-select");
  if (execModeSelect) {
    AppState.executionMode = execModeSelect.value || 'Concurrency';
    updateExecutionModeBadge();
    execModeSelect.addEventListener("change", (e) => {
      AppState.executionMode = e.target.value;
      updateExecutionModeBadge();
      // Re-render the Gantt if a result is already on screen
      if (AppState.lastScheduleResult && typeof window.drawGanttChart === 'function') {
        window.drawGanttChart(AppState.lastScheduleResult);
      }
      if (AppState.executionMode === 'Parallelism' && AppState.numCores < 2) {
        showToast('Parallelism requires at least 2 cores. Increase the CPU Cores slider.', 'warning');
      }
      // Sync Modos CPU tab to the selected execution mode
      const modeMap = {
        'Concurrency':     'concurrency',
        'Multithreading':  'multithreading',
        'Parallelism':     'parallelism',
        'Multiprocessing': 'multiprocessing',
      };
      const mapped = modeMap[e.target.value];
      if (mapped && window.ExecModes) {
        window.ExecModes.setMode(mapped);
      }
    });
  }

  // Fork toggle
  const forksToggle = document.getElementById("toggle-forks");
  const forksStatusText = document.getElementById("forks-status-text");
  if (forksToggle) {
    forksToggle.addEventListener("change", (e) => {
      AppState.forksEnabled = e.target.checked;
      if (forksStatusText) {
        forksStatusText.textContent = e.target.checked ? 'Enabled' : 'Disabled';
        forksStatusText.classList.toggle('active', e.target.checked);
      }
      if (!e.target.checked) {
        AppState.processes.forEach(p => { p.forks = []; });
      }
      renderProcessTable();
    });
  }

  // Keyboard shortcut: Enter to add process
  ["input-arrival", "input-burst", "input-priority", "input-pages"].forEach(
    (id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") addProcess();
      });
    },
  );

  // Memory
  document
    .getElementById("btn-allocate-memory")
    .addEventListener("click", () => {
      if (typeof allocateMemory === "function") allocateMemory();
    });

  // Page replacement
  document.getElementById("btn-run-pr").addEventListener("click", () => {
    if (typeof runPageReplacement === "function") runPageReplacement();
  });

  // Comparison
  document
    .getElementById("btn-run-comparison")
    .addEventListener("click", () => {
      if (typeof runComparison === "function") runComparison();
    });

  // CSV extract
  document.getElementById("btn-extract").addEventListener("click", () => {
    if (typeof extractRegex === "function") extractRegex();
  });

  // Concurrency
  document
    .getElementById("btn-run-concurrency")
    .addEventListener("click", () => {
      if (typeof runConcurrency === "function") runConcurrency();
    });

  // Concurrency toggle
  document.querySelectorAll(".toggle-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".toggle-option")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Regex filter chips
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
});

function openMemoryGame() {
  window.open("memory_game.html", "_blank");
}

function openGalaxyGame() {
  window.open("page_replace_game.html", "_blank");
}
window.openMemoryGame = openMemoryGame;
window.openGalaxyGame = openGalaxyGame;

/* Export for other modules */
window.AppState = AppState;
window.pidColor = pidColor;
window.PID_COLORS = PID_COLORS;
window.apiCall = apiCall;
window.showToast = showToast;