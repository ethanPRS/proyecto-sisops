/**
 * comparison.js — Algorithm Comparison v3
 *
 * Features:
 *  - Tabs Scheduling vs Paginación (separados)
 *  - Selección de 2–4 / 2–5 algoritmos con tarjetas
 *  - Canvas animado en tiempo real (play/pause/stop/velocidad)
 *  - Mario corre sobre las barras, salta en context switch
 *  - Visualización de procesos, threads (Toad) y forks (Mario Clone)
 *  - Tabla con fórmulas explicadas que se rellena en vivo
 *  - Mensajes de caso de uso + explicación detallada por algoritmo
 *  - Mismo estilo visual que la pantalla de Scheduling
 */

/* ═══════════════════════════════════════════════════════════════════════
   Metadatos
   ═══════════════════════════════════════════════════════════════════════ */

const SCHEDULING_META = {
  'FCFS': {
    short: 'First-Come, First-Served',
    formula: 'WT = CT − AT − BT   |   TAT = CT − AT   |   RT = Primera_CPU − AT',
    explanation: 'No-preemptivo. Ejecuta los procesos en el orden exacto en que llegaron. Simple de implementar pero puede causar el efecto "convoy": un proceso largo bloquea a todos los cortos detrás de él.',
    useCase: 'Colas de impresión, sistemas batch donde el orden de llegada es justo.',
    complexity: 'O(n) — solo requiere una cola FIFO.',
    starvation: '❌ No ocurre',
    preemptive: '❌ No preemptivo',
  },
  'SJF': {
    short: 'Shortest Job First',
    formula: 'WT = CT − AT − BT   |   TAT = CT − AT   |   Selección: min(BT disponibles)',
    explanation: 'Elige siempre el proceso con menor burst time entre los disponibles. Óptimo en términos de tiempo de espera promedio, pero requiere conocer el burst time de antemano.',
    useCase: 'Compiladores batch, servidores donde el tamaño de las tareas es conocido.',
    complexity: 'O(n log n) — requiere ordenar por burst time en cada tick.',
    starvation: '⚠️ Sí puede ocurrir (procesos largos)',
    preemptive: '❌ No preemptivo',
  },
  'HRRN': {
    short: 'Highest Response Ratio Next',
    formula: 'RR = (WT_actual + BT) / BT   |   Selección: max(RR)',
    explanation: 'Calcula el Response Ratio de cada proceso listo. Combina la prioridad por burst corto (SJF) con la antigüedad del proceso (cuánto lleva esperando), eliminando el starvation.',
    useCase: 'Sistemas mixtos batch/interactivo que necesitan justicia y eficiencia.',
    complexity: 'O(n) por decisión — calcula RR de todos los procesos en cola.',
    starvation: '✅ No ocurre (aging implícito)',
    preemptive: '❌ No preemptivo',
  },
  'Round Robin': {
    short: 'Quantum configurable',
    formula: 'WT = TAT − BT   |   TAT = CT − AT   |   Quantum Q define duración máxima de cada slice',
    explanation: 'Cada proceso recibe la CPU por un máximo de Q unidades (quantum). Si no termina, vuelve al final de la cola circular. Garantiza que ningún proceso espere más de (n-1)×Q unidades.',
    useCase: 'Sistemas interactivos, terminales, shells — baja latencia de respuesta.',
    complexity: 'O(1) por decisión — el siguiente proceso está al frente de la cola circular.',
    starvation: '✅ No ocurre',
    preemptive: '✅ Preemptivo',
  },
  'SRTF': {
    short: 'Shortest Remaining Time First',
    formula: 'WT = TAT − BT   |   Selección: min(remaining_burst) entre TODOS los listos',
    explanation: 'Versión preemptiva de SJF. En cada tick, si llega un proceso con menor tiempo restante que el actual, se preempta. Minimiza el tiempo de espera total pero con mayor overhead de context switch.',
    useCase: 'Servidores web de alto rendimiento donde el tamaño de cada request es conocido.',
    complexity: 'O(n) por tick — compara remaining burst de todos los procesos listos.',
    starvation: '⚠️ Sí puede ocurrir',
    preemptive: '✅ Preemptivo',
  },
  'Priority (Preemptive)': {
    short: 'Prioridad preemptiva',
    formula: 'Selección: min(priority) disponible   |   Preempta si llega proceso con mayor prioridad',
    explanation: 'Asigna a cada proceso un número de prioridad. Siempre corre el proceso listo de mayor prioridad. Si llega uno de mayor prioridad, preempta al actual. Requiere aging para evitar starvation.',
    useCase: 'Kernels de SO (interrupciones > kernel > usuario > idle), sistemas de tiempo real.',
    complexity: 'O(log n) con heap de prioridad.',
    starvation: '⚠️ Sí puede ocurrir (procesos de baja prioridad)',
    preemptive: '✅ Preemptivo',
  },
  'Multilevel Queue': {
    short: 'Colas por categoría fija',
    formula: 'Cola 0 (alta pri) → Cola 1 → Cola 2 (baja pri)   |   Cola superior vacía antes de bajar',
    explanation: 'Divide los procesos en colas permanentes por tipo (sistema, interactivo, batch). Cada cola tiene su propio algoritmo interno. Un proceso nunca cambia de cola. Las colas superiores tienen prioridad absoluta.',
    useCase: 'SO con clases bien definidas: procesos de sistema, usuario y batch.',
    complexity: 'O(k×n) donde k = número de colas.',
    starvation: '⚠️ Sí (colas inferiores bloqueadas si las superiores no se vacían)',
    preemptive: '✅ Entre colas',
  },
  'MLFQ': {
    short: 'Multilevel Feedback Queue',
    formula: 'Nuevo proceso → Cola 0 (alta pri, quantum corto) → si agota quantum sube → Cola n (baja pri, quantum largo)',
    explanation: 'Similar a MLQ pero los procesos SÍ cambian de cola según su comportamiento. Procesos CPU-bound bajan de prioridad al agotar su quantum; procesos I/O-bound se mantienen arriba. Aprende el patrón de uso sin necesitar burst times.',
    useCase: 'Sistemas de propósito general modernos. El Linux CFS y Windows NT comparten estos principios.',
    complexity: 'O(k) por decisión, k = colas activas.',
    starvation: '✅ Controlado con aging periódico',
    preemptive: '✅ Preemptivo',
  },
};

const PAGING_META = {
  'FIFO': {
    short: 'First-In, First-Out',
    formula: 'Evictar la página que lleva MÁS tiempo en memoria (la más antigua)',
    explanation: 'La página que llegó primero es la primera en salir. Simple de implementar con una cola FIFO. Sufre la paradoja de Bélady: aumentar el número de frames puede aumentar los page faults.',
    useCase: 'Referencia base para comparar algoritmos. Sistemas embebidos con memoria muy limitada.',
    complexity: 'O(1) por acceso.',
    belady: '⚠️ Sí sufre la anomalía de Bélady',
  },
  'LRU': {
    short: 'Least Recently Used',
    formula: 'Evictar la página con el timestamp de acceso más antiguo → min(last_access_time)',
    explanation: 'Evicta la página que NO fue usada hace más tiempo. Explota el principio de localidad temporal: si una página se usó recientemente, probablemente se usará de nuevo pronto. Costoso en hardware puro.',
    useCase: 'Linux (aproximado con bit de referencia), Windows, la mayoría de SO modernos.',
    complexity: 'O(1) con hashtable + lista doblemente enlazada.',
    belady: '✅ No sufre la anomalía',
  },
  'Optimal': {
    short: 'Algoritmo de Bélady (teórico)',
    formula: 'Evictar la página que será usada MÁS TARDE en el futuro (o nunca)',
    explanation: 'Requiere conocer el futuro de la cadena de referencias. Imposible de implementar online. Se usa como benchmark teórico para medir la distancia entre algoritmos reales y el óptimo.',
    useCase: 'Evaluación teórica, análisis de traces de memoria, benchmarking académico.',
    complexity: 'O(n×f) donde n = longitud cadena, f = frames.',
    belady: '✅ No sufre la anomalía (es el óptimo)',
  },
  'Clock': {
    short: 'Reloj circular (segunda oportunidad)',
    formula: 'Avanzar puntero; si bit_ref=1 → limpiar y avanzar; si bit_ref=0 → evictar',
    explanation: 'El puntero recorre un buffer circular de frames. Si el frame apuntado tiene bit de referencia=1, le da "segunda oportunidad" (limpia el bit y avanza). Si es 0, lo evicta. Aproxima LRU con O(1) overhead.',
    useCase: 'Linux page daemon (kswapd), implementaciones reales de VM por eficiencia.',
    complexity: 'O(n) amortizado, O(1) caso promedio.',
    belady: '✅ No sufre la anomalía',
  },
  'Second Chance': {
    short: 'Enhanced Clock (bit dirty)',
    formula: '(ref=0, dirty=0) → evictar primero   |   (ref=0, dirty=1) → segunda oportunidad   |   (ref=1, *) → limpiar ref y avanzar',
    explanation: 'Enhanced Clock con dos bits: referencia (R) y modificación (dirty D). Prioriza evictar páginas no referenciadas y limpias (no hay I/O de swap). Reduce el costo de escritura a disco al evictar páginas sucias solo cuando no queda otra opción.',
    useCase: 'Sistemas con mucho I/O de swap donde el costo de escribir una página dirty es alto.',
    complexity: 'O(n) amortizado.',
    belady: '✅ No sufre la anomalía',
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   Player state
   ═══════════════════════════════════════════════════════════════════════ */

const CompPlayer = {
  results: null,        // array de { name, data, color }
  totalTime: 0,
  currentTick: 0,
  playing: false,
  speed: 1.0,
  rafId: null,
  lastFrame: 0,
  category: 'scheduling',
  marios: [],           // one Mario per algorithm
  tableRows: [],        // DOM rows for live fill
};

/* ═══════════════════════════════════════════════════════════════════════
   Selector state
   ═══════════════════════════════════════════════════════════════════════ */

const CompState = {
  category: 'scheduling',
  selected: [],
  numCores: 4,
};

/* ═══════════════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════════════ */

function initComparison() {
  if (document.getElementById('comp-algo-grid').children.length === 0) {
    buildAlgoCards('scheduling');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Navegación de categoría
   ═══════════════════════════════════════════════════════════════════════ */

function setCompCategory(cat) {
  CompState.category = cat;
  CompState.selected = [];

  document.getElementById('comp-tab-sched').classList.toggle('active', cat === 'scheduling');
  document.getElementById('comp-tab-page').classList.toggle('active', cat === 'paging');

  const maxSel = cat === 'scheduling' ? 4 : 5;
  document.getElementById('comp-algo-hint').textContent =
    `Selecciona 2–${maxSel} algoritmos de ${cat === 'scheduling' ? 'scheduling' : 'paginación'}`;

  document.getElementById('comp-sched-opts').style.display = cat === 'scheduling' ? 'flex' : 'none';
  document.getElementById('comp-page-opts').style.display  = cat === 'paging'     ? 'flex' : 'none';

  buildAlgoCards(cat);
  clearCompResults();
  updateSelCount();
  document.getElementById('btn-run-comparison').disabled = true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Tarjetas de algoritmos
   ═══════════════════════════════════════════════════════════════════════ */

function buildAlgoCards(cat) {
  const grid = document.getElementById('comp-algo-grid');
  grid.innerHTML = '';
  const meta = cat === 'scheduling' ? SCHEDULING_META : PAGING_META;

  Object.entries(meta).forEach(([name, info], i) => {
    const color = PID_COLORS[i % PID_COLORS.length];
    const card = document.createElement('div');
    card.className = 'comp-algo-card';
    card.dataset.name = name;
    card.innerHTML = `
      <div style="font-weight:700;font-size:12px;color:var(--text-primary);margin-bottom:2px">${name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${info.short}</div>
      <div style="font-size:9px;color:var(--text-muted);line-height:1.4;opacity:0.7">${info.preemptive || info.belady || ''}</div>
    `;
    card.addEventListener('click', () => toggleAlgoCard(card, name, color));
    grid.appendChild(card);
  });
}

function toggleAlgoCard(card, name, color) {
  const maxSel = CompState.category === 'scheduling' ? 4 : 5;
  const isSelected = CompState.selected.includes(name);
  if (isSelected) {
    CompState.selected = CompState.selected.filter(n => n !== name);
    card.style.borderColor = '';
    card.style.background = '';
    card.style.boxShadow = '';
  } else {
    if (CompState.selected.length >= maxSel) return;
    CompState.selected.push(name);
    card.style.borderColor = color;
    card.style.background = color + '18';
    card.style.boxShadow = `0 0 0 2px ${color}55`;
  }
  updateSelCount();
  document.getElementById('btn-run-comparison').disabled = CompState.selected.length < 2;
}

function updateSelCount() {
  const max = CompState.category === 'scheduling' ? 4 : 5;
  document.getElementById('comp-sel-count').textContent =
    `${CompState.selected.length} / ${max} seleccionados`;
}

function setCompCores(val) {
  CompState.numCores = parseInt(val);
  document.getElementById('comp-cores-label').textContent = `${val} core${val > 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Ejecutar comparación → fetch → iniciar animación
   ═══════════════════════════════════════════════════════════════════════ */

async function runComparison() {
  if (CompState.selected.length < 2) return;
  if (CompState.category === 'scheduling' && AppState.processes.length === 0) {
    showToast('Agrega procesos primero en la pantalla de Processes', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-comparison');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> Ejecutando threads…';

  const log = document.getElementById('comp-thread-log');
  log.textContent = `⚙  ${CompState.selected.length} threads | ${CompState.numCores} core(s) | ${Math.min(CompState.selected.length, CompState.numCores)} en paralelo…`;

  clearCompResults();
  stopCompPlayer();

  try {
    let apiResults;
    if (CompState.category === 'scheduling') {
      const quantum = parseInt(document.getElementById('comp-quantum').value) || 2;
      apiResults = await apiCall('/api/schedule/compare-selected', {
        algorithms: CompState.selected,
        quantum,
        num_cores: CompState.numCores,
        processes: AppState.processes,
      });
    } else {
      const refRaw = document.getElementById('comp-ref-string').value;
      const refStr = refRaw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0);
      const frames = parseInt(document.getElementById('comp-frames').value) || 3;
      if (!refStr.length) { showToast('Cadena de referencia inválida', 'warning'); return; }
      apiResults = await apiCall('/api/page-replacement/compare', {
        algorithms: CompState.selected,
        reference_string: refStr,
        num_frames: frames,
        num_cores: CompState.numCores,
      });
    }

    const n = Object.values(apiResults).filter(d => !d.error).length;
    log.textContent = `✓  ${n} threads completados`;
    showToast(`${n} algoritmos comparados`, 'success');

    buildResultUI(apiResults);

  } catch (err) {
    log.textContent = `❌  ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> Comparar';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Construir UI de resultados
   ═══════════════════════════════════════════════════════════════════════ */

function buildResultUI(apiResults) {
  const container = document.getElementById('comp-results');
  const entries = Object.entries(apiResults).filter(([, d]) => !d.error);
  if (!entries.length) return;

  const isSched = CompState.category === 'scheduling';
  const meta    = isSched ? SCHEDULING_META : PAGING_META;

  // ── Panel de procesos ───────────────────────────────────────────────
  const vis = typeof getEffectiveVisibility === 'function' ? getEffectiveVisibility() : { threadsVisible: false, forksVisible: false };

  let processVis = '';
  if (isSched && AppState.processes.length > 0) {
    const pTiles = AppState.processes.map((p, i) => {
      const color = PID_COLORS[i % PID_COLORS.length];
      const threadBadges = (vis.threadsVisible && p.threads && p.threads.length)
        ? p.threads.map(t => `<span style="font-size:9px;background:#2563eb33;color:#60a5fa;border:1px solid #3b82f666;border-radius:4px;padding:1px 5px;margin-left:3px">🧵 T${t.tid}</span>`).join('')
        : '';
      const forkBadges = (vis.forksVisible && p.forks && p.forks.length)
        ? p.forks.map(f => `<span style="font-size:9px;background:#10b98133;color:#34d399;border:1px solid #10b98166;border-radius:4px;padding:1px 5px;margin-left:3px">⑂ F${f.fid}</span>`).join('')
        : '';
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;border-radius:8px;border:1px solid ${color}55;background:${color}11;min-width:70px">
        <div style="font-weight:700;font-size:13px;color:${color}">P${p.pid}</div>
        <div style="font-size:10px;color:var(--text-muted)">BT=${p.burst_time} AT=${p.arrival_time}</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px">${threadBadges}${forkBadges}</div>
      </div>`;
    }).join('');
    processVis = `<div class="card mb-md">
      <div class="card-title"><span class="card-icon"><i class="ph ph-stack"></i></span>Procesos en comparación</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0">${pTiles}</div>
    </div>`;
  }

  // ── Canvas de comparación ───────────────────────────────────────────
  const canvasSection = `
    <div class="card mb-md">
      <div class="card-title flex-between">
        <div><span class="card-icon"><i class="ph ph-chart-bar"></i></span>Comparación en tiempo real</div>
        <span id="comp-tick-label" style="font-size:11px;color:var(--text-muted)">t = 0</span>
      </div>
      <div id="comp-canvas-container" style="position:relative;width:100%;overflow:hidden;background:rgba(248,250,252,0.03);border-radius:8px;border:1px solid var(--border)">
        <canvas id="comp-canvas" style="display:block;width:100%"></canvas>
      </div>

      <!-- Controles de playback — mismo estilo que Scheduling -->
      <div class="playback-controls" id="comp-playback" style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="comp-btn-reset" title="Reset" style="border-radius:50%" onclick="compSeek(0)">
          <i class="ph ph-skip-back"></i>
        </button>
        <button class="btn btn-secondary btn-sm" id="comp-btn-step-back" title="Paso atrás" style="border-radius:50%" onclick="compStep(-1)">
          <i class="ph ph-rewind"></i>
        </button>
        <button class="btn btn-primary" id="comp-btn-play" style="border-radius:24px;padding:8px 28px;font-size:1.05rem;font-weight:700" onclick="toggleCompPlay()">
          <i class="ph ph-play"></i> Play
        </button>
        <button class="btn btn-secondary btn-sm" id="comp-btn-step-fwd" title="Paso adelante" style="border-radius:50%" onclick="compStep(1)">
          <i class="ph ph-fast-forward"></i>
        </button>
        <button class="btn btn-secondary btn-sm" id="comp-btn-stop" title="Detener" style="border-radius:50%" onclick="stopCompPlayer()">
          <i class="ph ph-stop"></i>
        </button>
        <span id="comp-step-counter" style="margin:0 8px;font-size:12px;color:var(--text-muted);min-width:60px">0 / 0</span>
        <div class="playback-speed" style="margin-left:4px;display:flex;align-items:center;gap:6px">
          <label for="comp-speed" style="margin:0;font-size:11px;color:var(--text-muted)">Velocidad</label>
          <input type="range" id="comp-speed" min="0.25" max="4" step="0.25" value="1" style="width:80px" oninput="setCompSpeed(this.value)">
          <span id="comp-speed-label" style="font-size:11px;font-weight:600;background:rgba(255,255,255,0.12);padding:2px 7px;border-radius:6px;color:#fff;border:1px solid rgba(255,255,255,0.18)">1.0x</span>
        </div>
      </div>
    </div>`;

  // ── Tabla con fórmulas ──────────────────────────────────────────────
  const isS = isSched;
  const headers = isS
    ? ['Algoritmo', 'Core', 'Avg WT', 'Avg TAT', 'Avg RT', 'CPU %', 'Ctx Sw.', 'Sim ms']
    : ['Algoritmo', 'Core', 'Page Faults', 'Hit Rate %', 'Fault Rate %', 'Frames', 'Sim ms'];

  const formulaHeader = isS
    ? `<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border-left:3px solid var(--accent)">
        📐 <strong>Fórmulas:</strong>
        WT = CT − AT − BT &nbsp;|&nbsp;
        TAT = CT − AT &nbsp;|&nbsp;
        RT = Primera_CPU − AT &nbsp;|&nbsp;
        CPU% = (Tiempo_ocupado / Tiempo_total) × 100
      </div>`
    : `<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;padding:6px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border-left:3px solid var(--accent)">
        📐 <strong>Fórmulas:</strong>
        Page Fault Rate = (Fallos / Longitud_cadena) × 100 &nbsp;|&nbsp;
        Hit Rate = 100 − Fault Rate
      </div>`;

  const tableRows = entries.map(([name, d], i) => {
    const color = PID_COLORS[i % PID_COLORS.length];
    const core  = i % CompState.numCores;
    return isS
      ? `<tr id="comp-row-${i}">
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${name}</td>
          <td>Core ${core}</td>
          <td id="comp-cell-wt-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-tat-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-rt-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-cpu-${i}" class="comp-live-cell">—</td>
          <td>${d.context_switches ?? '—'}</td>
          <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1) + ' ms' : '—'}</td>
        </tr>`
      : `<tr id="comp-row-${i}">
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${name}</td>
          <td>Core ${core}</td>
          <td id="comp-cell-pf-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-hr-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-fr-${i}" class="comp-live-cell">—</td>
          <td>${d.num_frames ?? '—'}</td>
          <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1) + ' ms' : '—'}</td>
        </tr>`;
  }).join('');

  const tableSection = `
    <div class="card mb-md">
      <div class="card-title"><span class="card-icon"><i class="ph ph-clipboard-text"></i></span>Tabla de métricas</div>
      ${formulaHeader}
      <div class="table-wrapper">
        <table id="comp-metrics-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;

  // ── Explicaciones detalladas ────────────────────────────────────────
  const explanations = entries.map(([name], i) => {
    const m = meta[name]; if (!m) return '';
    const color = PID_COLORS[i % PID_COLORS.length];
    const extra = isSched
      ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          <span style="font-size:10px;padding:2px 10px;border-radius:99px;background:${color}22;border:1px solid ${color}55;color:${color}">${m.preemptive}</span>
          <span style="font-size:10px;padding:2px 10px;border-radius:99px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-muted)">${m.starvation}</span>
          <span style="font-size:10px;padding:2px 10px;border-radius:99px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-muted)">📊 ${m.complexity}</span>
        </div>`
      : `<div style="margin-top:8px"><span style="font-size:10px;padding:2px 10px;border-radius:99px;background:${color}22;border:1px solid ${color}55;color:${color}">${m.belady}</span></div>`;

    return `<div style="border-left:3px solid ${color};padding:10px 14px;margin-bottom:10px;background:var(--bg-card);border-radius:0 8px 8px 0">
      <div style="font-weight:700;font-size:13px;color:${color};margin-bottom:3px">${name} — ${m.short}</div>
      <div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-bottom:6px;padding:4px 8px;background:rgba(255,255,255,0.04);border-radius:4px">${m.formula}</div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">${m.explanation}</div>
      ${extra}
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px">💡 <em>${m.useCase}</em></div>
    </div>`;
  }).join('');

  const explSection = `
    <div class="card mb-md">
      <div class="card-title"><span class="card-icon"><i class="ph ph-lightbulb"></i></span>Algoritmos: explicación detallada</div>
      ${explanations}
    </div>`;

  container.innerHTML = processVis + canvasSection + tableSection + explSection;

  // ── Agregar estilo de celdas live ───────────────────────────────────
  if (!document.getElementById('comp-live-style')) {
    const s = document.createElement('style');
    s.id = 'comp-live-style';
    s.textContent = `
      .comp-live-cell { transition: color .3s, background .3s; }
      .comp-live-cell.updated { color: #6EEB83 !important; background: rgba(110,235,131,0.12) !important; }
      .comp-algo-card { padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);cursor:pointer;transition:all .15s;user-select:none; }
      .comp-algo-card:hover { border-color: var(--accent); }
      #comp-tab-sched.active, #comp-tab-page.active { background:rgba(110,235,131,0.15);color:var(--accent);border-color:var(--accent); }
      .comp-summary-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px; }
    `;
    document.head.appendChild(s);
  }

  // ── Iniciar canvas con todos los datos ─────────────────────────────
  initCompCanvas(entries);
}

/* ═══════════════════════════════════════════════════════════════════════
   Canvas de comparación animado
   ═══════════════════════════════════════════════════════════════════════ */

const COMP_MARIO_SCALE = 2;   // 32×32 sprites — más pequeños para caber varios
const COMP_MARIO_W = 16 * COMP_MARIO_SCALE;
const COMP_MARIO_H = 16 * COMP_MARIO_SCALE;
const COMP_BAR_H   = 28;
const COMP_ROW_GAP = 14;
const COMP_LEFT    = 120;
const COMP_TOP     = 20;
const COMP_BOTTOM  = 30;

function initCompCanvas(entries) {
  const isSched = CompState.category === 'scheduling';
  const canvas  = document.getElementById('comp-canvas');
  const container = document.getElementById('comp-canvas-container');
  if (!canvas) return;

  // Calcular dimensiones
  const nAlgos  = entries.length;
  const height  = COMP_TOP + nAlgos * (COMP_BAR_H + COMP_ROW_GAP) + COMP_BOTTOM + 20;
  const dpr     = window.devicePixelRatio || 1;
  const cw      = container.clientWidth || 800;

  canvas.width  = cw * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Calcular total time
  let totalTime = 1;
  if (isSched) {
    entries.forEach(([, d]) => {
      if (d.gantt && d.gantt.length) {
        const t = Math.max(...d.gantt.map(e => e.end));
        if (t > totalTime) totalTime = t;
      }
    });
  } else {
    entries.forEach(([, d]) => {
      if (d.ref_length && d.ref_length > totalTime) totalTime = d.ref_length;
    });
  }

  // Init Mario states (one per algo)
  CompPlayer.marios = entries.map(([name, d], i) => ({
    name, x: COMP_LEFT, y: 0, frame: 0, frameTimer: 0,
    jumping: false, jumpVel: 0, baseY: 0,
    lastBlock: null, visible: false,
    color: PID_COLORS[i % PID_COLORS.length],
  }));

  // Guardar state
  CompPlayer.results  = entries;
  CompPlayer.totalTime = totalTime;
  CompPlayer.currentTick = 0;
  CompPlayer.category = CompState.category;

  const scale = (cw - COMP_LEFT - 20) / totalTime;

  document.getElementById('comp-step-counter').textContent = `0 / ${totalTime}`;

  // Función de render
  function render() {
    const tick = CompPlayer.currentTick;
    const w    = cw;

    ctx.clearRect(0, 0, w, height);
    ctx.fillStyle = 'rgba(8,8,24,0.97)';
    ctx.fillRect(0, 0, w, height);

    // Eje X — línea de tiempo
    const axisY = COMP_TOP + nAlgos * (COMP_BAR_H + COMP_ROW_GAP);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(COMP_LEFT, axisY); ctx.lineTo(w - 10, axisY); ctx.stroke();

    // Ticks de tiempo
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    for (let t = 0; t <= totalTime; t++) {
      const x = COMP_LEFT + t * scale;
      ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, axisY + 4); ctx.stroke();
      if (t % Math.max(1, Math.round(totalTime / 10)) === 0) ctx.fillText(t, x, axisY + 14);
    }

    entries.forEach(([name, d], idx) => {
      const color = PID_COLORS[idx % PID_COLORS.length];
      const rowY  = COMP_TOP + idx * (COMP_BAR_H + COMP_ROW_GAP);
      const mario = CompPlayer.marios[idx];

      // Etiqueta del algoritmo
      ctx.fillStyle = color;
      ctx.font = `bold 11px "Inter", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(name.length > 12 ? name.slice(0, 11) + '…' : name, COMP_LEFT - 6, rowY + COMP_BAR_H / 2 + 4);

      if (isSched) {
        // ── Barras de Gantt por algoritmo ──────────────────────────
        const gantt = d.gantt || [];
        gantt.forEach(entry => {
          if (entry.end <= tick) {
            // Bloque completamente revelado
            const x  = COMP_LEFT + entry.start * scale;
            const bw = (entry.end - entry.start) * scale;
            if (entry.pid < 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.05)';
            } else {
              const pidColor = PID_COLORS[entry.pid % PID_COLORS.length];
              const grad = ctx.createLinearGradient(x, rowY, x, rowY + COMP_BAR_H);
              grad.addColorStop(0, pidColor + 'EE');
              grad.addColorStop(1, pidColor + '88');
              ctx.fillStyle = grad;
            }
            roundRect(ctx, x, rowY, bw, COMP_BAR_H, 4);
            ctx.fill();

            // PID label
            if (entry.pid >= 0 && bw > 16) {
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`P${entry.pid}`, x + bw / 2, rowY + COMP_BAR_H / 2 + 3);
            }
          } else if (entry.start < tick) {
            // Bloque parcialmente revelado
            const x   = COMP_LEFT + entry.start * scale;
            const bw  = (tick - entry.start) * scale;
            const pidC = entry.pid >= 0 ? PID_COLORS[entry.pid % PID_COLORS.length] : 'rgba(255,255,255,0.05)';
            ctx.fillStyle = pidC + '99';
            roundRect(ctx, x, rowY, bw, COMP_BAR_H, 4);
            ctx.fill();
          }
        });

        // Línea de revelado
        const revealX = COMP_LEFT + tick * scale;
        ctx.strokeStyle = color + 'BB';
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(revealX, rowY - 2); ctx.lineTo(revealX, rowY + COMP_BAR_H + 2); ctx.stroke();
        ctx.setLineDash([]);

        // Actualizar Mario para este algoritmo
        updateCompMario(mario, idx, d.gantt, tick, scale, rowY);
        if (mario.visible) {
          drawCompMarioSprite(ctx, mario.x, mario.y, mario.jumping, mario.frame);
        }

        // Actualizar celdas de tabla en vivo
        updateLiveCellsSched(idx, d, tick, totalTime);

      } else {
        // ── Barras de paginación ─────────────────────────────────────
        const steps = d.steps || [];
        const visibleSteps = Math.min(Math.floor(tick), steps.length);
        const barMaxW = w - COMP_LEFT - 20;
        const stepW   = barMaxW / (steps.length || 1);

        for (let s = 0; s < visibleSteps; s++) {
          const step  = steps[s];
          const x     = COMP_LEFT + s * stepW;
          const isFault = step.fault;
          ctx.fillStyle = isFault ? '#EF444488' : '#10B98155';
          roundRect(ctx, x, rowY, stepW - 2, COMP_BAR_H, 3);
          ctx.fill();
          if (stepW > 14) {
            ctx.fillStyle = isFault ? '#fca5a5' : '#6ee7b7';
            ctx.font = '8px monospace'; ctx.textAlign = 'center';
            ctx.fillText(step.page_requested, x + stepW / 2 - 1, rowY + COMP_BAR_H / 2 + 3);
          }
        }

        // Mini Mario corriendo sobre los steps
        if (visibleSteps > 0) {
          const mX = COMP_LEFT + (visibleSteps - 0.5) * stepW - COMP_MARIO_W / 2;
          const mY = rowY - COMP_MARIO_H;
          mario.frame = Math.floor(tick * 4) % 4;
          drawCompMarioSprite(ctx, mX, mY, false, mario.frame);
        }

        updateLiveCellsPage(idx, d, Math.floor(tick), steps.length);
      }
    });

    // Cursor de tiempo global
    const cursorX = COMP_LEFT + tick * scale;
    ctx.strokeStyle = 'rgba(110,235,131,0.8)';
    ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, axisY); ctx.stroke();
    ctx.setLineDash([]);

    document.getElementById('comp-tick-label').textContent = `t = ${tick.toFixed(1)}`;
    document.getElementById('comp-step-counter').textContent = `${Math.round(tick)} / ${totalTime}`;
  }

  CompPlayer.renderFn = render;
  render();
}

/* ═══════════════════════════════════════════════════════════════════════
   Mario por algoritmo (versión compacta)
   ═══════════════════════════════════════════════════════════════════════ */

function updateCompMario(mario, idx, gantt, tick, scale, rowY) {
  const ganttReal = (gantt || []).filter(e => e.pid >= 0);
  if (!ganttReal.length || tick <= 0) { mario.visible = false; return; }
  mario.visible = true;

  let running = null;
  for (const e of ganttReal) {
    if (tick > e.start && tick <= e.end) { running = e; break; }
  }

  const targetX = running
    ? COMP_LEFT + Math.min(running.end, tick) * scale - COMP_MARIO_W / 2
    : COMP_LEFT + tick * scale - COMP_MARIO_W / 2;
  mario.x += (targetX - mario.x) * 0.18;

  mario.baseY = rowY - COMP_MARIO_H - 2;

  if (running && running.pid !== mario.lastBlock && mario.lastBlock !== null && !mario.jumping) {
    mario.jumping = true; mario.jumpVel = -90;
  }
  if (running) mario.lastBlock = running.pid;

  const dt = 1 / 60;
  if (mario.jumping) {
    mario.y += mario.jumpVel * dt;
    mario.jumpVel += 280 * dt;
    if (mario.y >= mario.baseY) { mario.y = mario.baseY; mario.jumping = false; mario.jumpVel = 0; }
  } else {
    mario.y = mario.baseY;
    mario.frameTimer = (mario.frameTimer || 0) + dt;
    if (mario.frameTimer >= 0.125) { mario.frameTimer = 0; mario.frame = (mario.frame + 1) % 4; }
  }
}

function drawCompMarioSprite(ctx, mx, my, jumping, frame) {
  // MARIO_SPRITE_FRAMES es una const global de gantt.js (carga antes que comparison.js)
  if (typeof MARIO_SPRITE_FRAMES === 'undefined') return;
  const runKeys = typeof MARIO_RUN_KEYS !== 'undefined' ? MARIO_RUN_KEYS : ['stand','run1','run2','run1'];
  const frameKey = jumping ? 'jump' : runKeys[frame % 4];
  const grid = MARIO_SPRITE_FRAMES[frameKey] || MARIO_SPRITE_FRAMES.stand;
  const s = COMP_MARIO_SCALE;
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const c = grid[row][col];
      if (c === null) continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(mx + col * s), Math.round(my + row * s), s, s);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ═══════════════════════════════════════════════════════════════════════
   Actualización de celdas de tabla en vivo
   ═══════════════════════════════════════════════════════════════════════ */

function updateLiveCellsSched(idx, d, tick, totalTime) {
  const frac = Math.min(tick / totalTime, 1);
  const flash = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    const newVal = val;
    if (el.textContent !== newVal) {
      el.textContent = newVal;
      el.classList.remove('updated');
      void el.offsetWidth;
      el.classList.add('updated');
    }
  };
  if (frac > 0.05) {
    flash(`comp-cell-wt-${idx}`,  (d.avg_waiting    * frac).toFixed(2));
    flash(`comp-cell-tat-${idx}`, (d.avg_turnaround * frac).toFixed(2));
    flash(`comp-cell-rt-${idx}`,  (d.avg_response   * frac).toFixed(2));
    flash(`comp-cell-cpu-${idx}`, (d.cpu_utilization * frac).toFixed(1) + '%');
  }
  if (frac >= 0.99) {
    flash(`comp-cell-wt-${idx}`,  d.avg_waiting.toFixed(2));
    flash(`comp-cell-tat-${idx}`, d.avg_turnaround.toFixed(2));
    flash(`comp-cell-rt-${idx}`,  d.avg_response.toFixed(2));
    flash(`comp-cell-cpu-${idx}`, d.cpu_utilization.toFixed(1) + '%');
  }
}

function updateLiveCellsPage(idx, d, step, total) {
  const frac = total > 0 ? Math.min(step / total, 1) : 0;
  const flash = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== val) {
      el.textContent = val;
      el.classList.remove('updated');
      void el.offsetWidth;
      el.classList.add('updated');
    }
  };
  if (d.steps && step > 0) {
    const stepsNow  = d.steps.slice(0, step);
    const faults    = stepsNow.filter(s => s.fault).length;
    const hitRate   = ((step - faults) / step * 100).toFixed(1);
    const faultRate = (faults / step * 100).toFixed(1);
    flash(`comp-cell-pf-${idx}`, String(faults));
    flash(`comp-cell-hr-${idx}`, hitRate);
    flash(`comp-cell-fr-${idx}`, faultRate + '%');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Controles de playback
   ═══════════════════════════════════════════════════════════════════════ */

function toggleCompPlay() {
  if (!CompPlayer.renderFn) return;
  CompPlayer.playing = !CompPlayer.playing;
  const btn = document.getElementById('comp-btn-play');
  if (CompPlayer.playing) {
    btn.innerHTML = '<i class="ph ph-pause"></i> Pause';
    CompPlayer.lastFrame = performance.now();
    compAnimate();
  } else {
    btn.innerHTML = '<i class="ph ph-play"></i> Play';
    cancelAnimationFrame(CompPlayer.rafId);
  }
}

function compAnimate(ts) {
  if (!CompPlayer.playing) return;
  ts = ts || performance.now();
  const dt = Math.min((ts - CompPlayer.lastFrame) / 1000, 0.1);
  CompPlayer.lastFrame = ts;
  CompPlayer.currentTick = Math.min(
    CompPlayer.currentTick + dt * CompPlayer.speed * 2,
    CompPlayer.totalTime
  );
  CompPlayer.renderFn();
  if (CompPlayer.currentTick >= CompPlayer.totalTime) {
    CompPlayer.playing = false;
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar';
    return;
  }
  CompPlayer.rafId = requestAnimationFrame(compAnimate);
}

function stopCompPlayer() {
  CompPlayer.playing = false;
  cancelAnimationFrame(CompPlayer.rafId);
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Play';
}

function compSeek(t) {
  stopCompPlayer();
  CompPlayer.currentTick = Math.max(0, Math.min(t, CompPlayer.totalTime));
  if (CompPlayer.renderFn) CompPlayer.renderFn();
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Play';
}

function compStep(dir) {
  stopCompPlayer();
  CompPlayer.currentTick = Math.max(0, Math.min(
    CompPlayer.currentTick + dir,
    CompPlayer.totalTime
  ));
  if (CompPlayer.renderFn) CompPlayer.renderFn();
}

function setCompSpeed(val) {
  CompPlayer.speed = parseFloat(val);
  const lbl = document.getElementById('comp-speed-label');
  if (lbl) lbl.textContent = parseFloat(val).toFixed(2).replace(/\.?0+$/, '') + 'x';
}

function clearCompResults() {
  stopCompPlayer();
  document.getElementById('comp-results').innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════════════════
   Exports
   ═══════════════════════════════════════════════════════════════════════ */
window.runComparison   = runComparison;
window.initComparison  = initComparison;
window.setCompCategory = setCompCategory;
window.setCompCores    = setCompCores;
window.toggleCompPlay  = toggleCompPlay;
window.stopCompPlayer  = stopCompPlayer;
window.compSeek        = compSeek;
window.compStep        = compStep;
window.setCompSpeed    = setCompSpeed;

/* Auto-inicializar cuando se navega a Comparison
   Funciona tanto si app.js tiene el hook como si no */
(function () {
  function tryInit() {
    const grid = document.getElementById('comp-algo-grid');
    if (grid && grid.children.length === 0) initComparison();
  }

  // Hook en el botón de nav si existe
  document.addEventListener('DOMContentLoaded', () => {
    const navBtn = document.getElementById('nav-comparison');
    if (navBtn) navBtn.addEventListener('click', tryInit);

    // También inicializar si la pantalla ya está activa al cargar
    const screen = document.getElementById('screen-comparison');
    if (screen && screen.classList.contains('active')) tryInit();
  });
})();