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
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#0EA5E9', '#D946EF', '#22C55E', '#EAB308', '#06B6D4',
  '#A855F7',
];

function pidColor(pid) {
  return PID_COLORS[pid % PID_COLORS.length];
}


/* ═══════════════════════════════════════════════════════════════════════
   Global State
   ═══════════════════════════════════════════════════════════════════════ */
const AppState = {
  processes: [],
  nextPid: 1,
  lastScheduleResult: null,
  lastComparisonResult: null,
};


/* ═══════════════════════════════════════════════════════════════════════
   Navigation
   ═══════════════════════════════════════════════════════════════════════ */
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const screens = document.querySelectorAll('.screen');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.screen;

      // Update nav active state
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch screen
      screens.forEach(s => {
        s.classList.remove('active');
        // Force reflow for animation restart
        void s.offsetWidth;
      });
      const targetScreen = document.getElementById(`screen-${target}`);
      if (targetScreen) {
        targetScreen.classList.add('active');
      }
    });
  });
}


/* ═══════════════════════════════════════════════════════════════════════
   Toast Notifications
   ═══════════════════════════════════════════════════════════════════════ */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { 
    success: '<i class="ph ph-check-circle"></i>', 
    error: '<i class="ph ph-x-circle"></i>', 
    info: '<i class="ph ph-info"></i>', 
    warning: '<i class="ph ph-warning-circle"></i>' 
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '<i class="ph ph-info"></i>'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}


/* ═══════════════════════════════════════════════════════════════════════
   API Helper
   ═══════════════════════════════════════════════════════════════════════ */
async function apiCall(endpoint, data = null) {
  try {
    const options = {
      method: data ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  } catch (err) {
    showToast(`API Error: ${err.message}`, 'error');
    throw err;
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Process Management
   ═══════════════════════════════════════════════════════════════════════ */
function renderProcessTable() {
  const tbody = document.getElementById('process-tbody');
  const empty = document.getElementById('empty-processes');
  const countEl = document.getElementById('process-count');

  countEl.textContent = AppState.processes.length;

  if (AppState.processes.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = AppState.processes.map((p, i) => `
    <tr style="animation: fadeSlideIn 0.3s ease ${i * 0.05}s both;">
      <td>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pidColor(p.pid)};margin-right:8px;"></span>
        P${p.pid}
      </td>
      <td>${p.arrival_time}</td>
      <td>${p.burst_time}</td>
      <td>${p.priority}</td>
      <td>${p.num_pages}</td>
      <td>
        <button class="btn-remove" onclick="removeProcess(${p.pid})" title="Eliminar proceso" aria-label="Eliminar proceso P${p.pid}">✕</button>
      </td>
    </tr>
  `).join('');
}

function addProcess() {
  const arrival = parseInt(document.getElementById('input-arrival').value) || 0;
  const burst = parseInt(document.getElementById('input-burst').value) || 1;
  const priority = parseInt(document.getElementById('input-priority').value) || 0;
  const pages = parseInt(document.getElementById('input-pages').value) || 1;

  if (burst < 1) {
    showToast('Burst time debe ser ≥ 1', 'warning');
    return;
  }

  const process = {
    pid: AppState.nextPid++,
    arrival_time: arrival,
    burst_time: burst,
    priority: priority,
    num_pages: pages,
  };

  AppState.processes.push(process);
  renderProcessTable();
  showToast(`Proceso P${process.pid} agregado`, 'success');
}

function removeProcess(pid) {
  AppState.processes = AppState.processes.filter(p => p.pid !== pid);
  renderProcessTable();
}

function clearProcesses() {
  AppState.processes = [];
  AppState.nextPid = 1;
  renderProcessTable();
  showToast('Todos los procesos eliminados', 'info');
}

function loadSampleProcesses() {
  AppState.processes = [
    { pid: 1, arrival_time: 0, burst_time: 5, priority: 2, num_pages: 3 },
    { pid: 2, arrival_time: 1, burst_time: 3, priority: 1, num_pages: 2 },
    { pid: 3, arrival_time: 2, burst_time: 8, priority: 3, num_pages: 4 },
    { pid: 4, arrival_time: 3, burst_time: 2, priority: 4, num_pages: 1 },
    { pid: 5, arrival_time: 4, burst_time: 4, priority: 2, num_pages: 2 },
    { pid: 6, arrival_time: 6, burst_time: 6, priority: 3, num_pages: 3 },
  ];
  AppState.nextPid = 7;
  renderProcessTable();
  showToast('6 procesos de ejemplo cargados', 'success');
}


/* ═══════════════════════════════════════════════════════════════════════
   Simulation Runner
   ═══════════════════════════════════════════════════════════════════════ */
async function runSimulation() {
  if (AppState.processes.length === 0) {
    showToast('Agrega al menos un proceso antes de ejecutar', 'warning');
    return;
  }

  const algo = document.getElementById('algo-select').value;
  const quantum = parseInt(document.getElementById('quantum-input').value) || 2;

  const runBtn = document.getElementById('btn-run-simulation');
  runBtn.disabled = true;
  runBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div> Ejecutando...';

  try {
    const result = await apiCall('/api/schedule', {
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
    document.getElementById('status-text').textContent =
      `Simulation complete — ${algo} | Avg TAT: ${result.avg_turnaround} | CPU: ${result.cpu_utilization}%`;

    showToast(`Simulación ${algo} completada exitosamente`, 'success');
  } catch (err) {
    // Error already shown by apiCall
  } finally {
    runBtn.disabled = false;
    runBtn.innerHTML = '▶️ Ejecutar Simulación';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Scheduling Stats
   ═══════════════════════════════════════════════════════════════════════ */
function updateSchedulingStats(result) {
  const algoEl = document.getElementById('heading-scheduling');
  algoEl.textContent = result.algorithm + " Scheduling";
  
  // Re-trigger the tracking-in-expand animation
  algoEl.classList.remove('tracking-in-expand');
  void algoEl.offsetWidth; // force reflow
  algoEl.classList.add('tracking-in-expand');

  document.getElementById('stat-avg-tat').textContent = result.avg_turnaround;
  document.getElementById('stat-avg-wt').textContent = result.avg_waiting;
  document.getElementById('stat-avg-rt').textContent = result.avg_response;
  document.getElementById('stat-cpu-util').textContent = result.cpu_utilization + '%';
  document.getElementById('stat-ctx-sw').textContent = result.context_switches;

  // Sticky game link update
  const stickyLink = document.getElementById('sticky-game-link');
  if (stickyLink) {
    if (result.algorithm === 'FCFS') {
      stickyLink.style.display = 'flex';
      stickyLink.href = 'fcfs_game.html';
      document.getElementById('sticky-game-text').textContent = 'Jugar FCFS (Mario)';
      document.getElementById('sticky-game-icon').className = 'ph ph-game-controller';
    } else if (result.algorithm === 'SJF') {
      stickyLink.style.display = 'flex';
      stickyLink.href = 'sjf_game.html';
      document.getElementById('sticky-game-text').textContent = 'Jugar SJF (Mario)';
      document.getElementById('sticky-game-icon').className = 'ph ph-rocket';
    } else if (result.algorithm === 'HRRN') {
      stickyLink.style.display = 'flex';
      stickyLink.href = 'hrrn_game.html';
      document.getElementById('sticky-game-text').textContent = 'Jugar HRRN (Mario)';
      document.getElementById('sticky-game-icon').className = 'ph ph-star';
    } else if (result.algorithm === 'Round Robin') {
      stickyLink.style.display = 'flex';
      stickyLink.href = 'rr_game.html';
      document.getElementById('sticky-game-text').textContent = 'Jugar Round Robin (Mario)';
      document.getElementById('sticky-game-icon').className = 'ph ph-arrows-clockwise';
    } else if (result.algorithm === 'MLFQ') {
      stickyLink.style.display = 'flex';
      stickyLink.href = 'mlfq_game.html';
      document.getElementById('sticky-game-text').textContent = 'Jugar MLFQ (Mario)';
      document.getElementById('sticky-game-icon').className = 'ph ph-arrows-clockwise';
    } else {
      stickyLink.style.display = 'none';
    }
  }

  // Mario Algo Tooltip update
  const tooltipBtn = document.getElementById('algo-mario-tooltip');
  const popupTitle = document.getElementById('algo-popup-title');
  const popupDesc = document.getElementById('algo-popup-desc');
  if(tooltipBtn && popupTitle && popupDesc) {
    tooltipBtn.style.display = 'flex';
    popupTitle.textContent = result.algorithm;
    let desc = '';
    switch(result.algorithm) {
      case 'FCFS': desc = 'First-Come, First-Served: El primer proceso en llegar a la cola de listos es el primero en recibir CPU. Es no expulsivo. Su simplicidad es ideal, pero suele sufir del "efecto convoy" (procesos cortos esperando a uno largo).'; break;
      case 'SJF': desc = 'Shortest Job First: Selecciona el proceso con la ráfaga de CPU (Burst Time) más corta disponible. Minimiza el tiempo de espera promedio, pero puede causar inanición a los procesos más largos.'; break;
      case 'HRRN': desc = 'Highest Response Ratio Next: Selecciona dinámicamente aquel proceso con la mayor "Tasa de Respuesta", calculada como (Espera + Ráfaga) / Ráfaga. ¡Es la cura contra la inanición!, ya que la paciencia aumenta matemáticamente el valor del proceso.'; break;
      case 'Round Robin': desc = 'Round Robin: A cada proceso se le asigna un "Quantum" o intervalo máximo de tiempo. Si no termina en ese Quantum, es pausado y enviado al final de la cola. Muy equitativo, ideal para sistemas interactivos y de tiempo compartido.'; break;
      case 'SRTF': desc = 'Shortest Remaining Time First: La variante expulsiva de SJF. Si llega un nuevo proceso con una ráfaga más corta que el tiempo restante del proceso actual, el sistema lo pausa para ejecutar al más rápido primero.'; break;
      case 'Priority (Preemptive)': desc = 'Priority Scheduling (Expulsivo): La CPU se asigna siempre al proceso con la mayor prioridad. Si un proceso más importante aterriza en la cola, expulsa al actual de la CPU de inmediato.'; break;
      case 'Multilevel Queue': desc = 'Colas Multinivel: El sistema mantiene varías colas estrictamente separadas (por prioridad o tipo). Cada proceso es asignado a una sola cola de forma permanente según sus características.'; break;
      case 'MLFQ': desc = 'Multilevel Feedback Queue: Múltiples colas interconectadas. Los procesos pueden "subir" o "bajar" de prioridad dependiendo de su comportamiento. Si un proceso gasta mucho CPU, baja de cola; si espera demasiado, sube de nivel.'; break;
      default: desc = 'Simulación de planificación de la CPU.'; break;
    }
    popupDesc.textContent = desc;
  }
}

window.updateLiveMetricsTable = function(result, t) {
  const tbody = document.getElementById('metrics-tbody');
  if (!tbody || !result) return;
  const tick = Math.max(0, Math.floor(t));
  const gantt = result.gantt || [];
  
  // Find first start times for RT
  const firstStarts = {};
  for(const entry of gantt) {
    if (entry.pid < 0) continue;
    if (!(entry.pid in firstStarts)) {
      firstStarts[entry.pid] = entry.start;
    }
  }

  tbody.innerHTML = result.metrics.map((m, i) => {
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
          <td colspan="4" class="text-muted" style="text-align:center;font-style:italic">Llega en t=${m.arrival_time}...</td>
        </tr>`;
    }

    const completed = m.completion_time <= tick;
    const hasStarted = (firstStarts[m.pid] !== undefined) && (firstStarts[m.pid] <= tick);

    // Completion Time
    let compHtml = completed ? `<strong>${m.completion_time}</strong>` : `<span class="text-muted">⏳ en proceso</span>`;

    // RT
    let rtHtml = '—';
    if (hasStarted) {
      rtHtml = `<span style="font-size:0.75rem; color:var(--info)">${firstStarts[m.pid]} - ${m.arrival_time}</span> = <strong>${m.response_time}</strong>`;
    } else {
      rtHtml = `<span class="text-muted">esperando CPU...</span>`;
    }

    // TAT
    let tatHtml = '—';
    if (completed) {
      tatHtml = `<span style="font-size:0.75rem; color:var(--purple-main)">${m.completion_time} - ${m.arrival_time}</span> = <strong>${m.turnaround_time}</strong>`;
    } else {
      tatHtml = `<span class="text-muted text-mono">t=${tick - m.arrival_time}</span>`;
    }

    // WT
    let wtHtml = '—';
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
      const liveWt = (tick - m.arrival_time) - cpuTime;
      wtHtml = `<span class="text-muted text-mono">acum: ${liveWt}</span>`;
    }

    return `
      <tr style="${completed ? 'background: rgba(34, 197, 94, 0.05);' : ''}">
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
  }).join('');
};


/* ═══════════════════════════════════════════════════════════════════════
   Quantum Visibility Toggle
   ═══════════════════════════════════════════════════════════════════════ */
function updateQuantumVisibility() {
  const algo = document.getElementById('algo-select').value;
  const group = document.getElementById('quantum-group');
  const needsQuantum = ['Round Robin', 'MLFQ'];
  group.style.display = needsQuantum.includes(algo) ? 'block' : 'none';

  const fcfsContainer = document.getElementById('fcfs-game-link-container');
  if (fcfsContainer) {
    fcfsContainer.style.display = (algo === 'FCFS' || algo === 'SJF' || algo === 'HRRN' || algo === 'Round Robin') ? 'flex' : 'none';
    const btnFCFS = document.getElementById('btn-fcfs-game');
    const btnSJF = document.getElementById('btn-sjf-game');
    const btnHRRN = document.getElementById('btn-hrrn-game');
    const btnRR = document.getElementById('btn-rr-game');
    if (btnFCFS) btnFCFS.style.display = algo === 'FCFS' ? 'flex' : 'none';
    if (btnSJF) btnSJF.style.display = algo === 'SJF' ? 'flex' : 'none';
    if (btnHRRN) btnHRRN.style.display = algo === 'HRRN' ? 'flex' : 'none';
    if (btnRR) btnRR.style.display = algo === 'Round Robin' ? 'flex' : 'none';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Particles Background
   ═══════════════════════════════════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;

  // Check reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });
}


/* ═══════════════════════════════════════════════════════════════════════
   Connection Check
   ═══════════════════════════════════════════════════════════════════════ */
async function checkConnection() {
  try {
    await apiCall('/api/algorithms');
    document.getElementById('connection-dot').style.background = 'var(--success)';
    document.getElementById('connection-text').textContent = 'Connected';
  } catch {
    document.getElementById('connection-dot').style.background = 'var(--error)';
    document.getElementById('connection-text').textContent = 'Disconnected';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initParticles();
  renderProcessTable();
  updateQuantumVisibility();
  checkConnection();

  // Process management
  document.getElementById('btn-add-process').addEventListener('click', addProcess);
  document.getElementById('btn-load-sample').addEventListener('click', loadSampleProcesses);
  document.getElementById('btn-clear-processes').addEventListener('click', clearProcesses);
  document.getElementById('btn-run-simulation').addEventListener('click', runSimulation);
  document.getElementById('algo-select').addEventListener('change', updateQuantumVisibility);

  // Keyboard shortcut: Enter to add process
  ['input-arrival', 'input-burst', 'input-priority', 'input-pages'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') addProcess();
    });
  });

  // Memory
  document.getElementById('btn-allocate-memory').addEventListener('click', () => {
    if (typeof allocateMemory === 'function') allocateMemory();
  });

  // Page replacement
  document.getElementById('btn-run-pr').addEventListener('click', () => {
    if (typeof runPageReplacement === 'function') runPageReplacement();
  });

  // Comparison
  document.getElementById('btn-run-comparison').addEventListener('click', () => {
    if (typeof runComparison === 'function') runComparison();
  });

  // CSV extract
  document.getElementById('btn-extract').addEventListener('click', () => {
    if (typeof extractRegex === 'function') extractRegex();
  });

  // Concurrency
  document.getElementById('btn-run-concurrency').addEventListener('click', () => {
    if (typeof runConcurrency === 'function') runConcurrency();
  });

  // Concurrency toggle
  document.querySelectorAll('.toggle-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Regex filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});


/* Export for other modules */
window.AppState = AppState;
window.pidColor = pidColor;
window.PID_COLORS = PID_COLORS;
window.apiCall = apiCall;
window.showToast = showToast;
