/**
 * comparison.js — Algorithm Comparison v4
 *
 * Cambios vs v3:
 *  - UN solo botón "▶ Comparar & Reproducir" — ejecuta la API y arranca la animación automáticamente
 *  - Gantt GRANDE (BAR_H=52px) con estilo Mario: bloques con gradiente 3D, borde inferior oscuro,
 *    etiqueta de PID estilo pixel-font, fondo de ladrillos/piso, igual que los juegos de Mario
 *  - Barras animadas de la versión anterior integradas (versión colorida per-algo)
 *  - Más gráficas: WT, TAT, RT, CPU%, Ctx Switches, Timeline de gantt comparativo
 *  - Layout organizado en secciones colapsables: Gantt → Métricas vivas → Gráficas de barras → Tabla → Explicaciones
 *  - Mario corre + salta en cada uno de los gantts
 *  - Gráfica de barras vertical animada (Chart.js-style en canvas) debajo del Gantt
 */

/* ═══════════════════════════════════════════════════════════════════════
   Metadatos de algoritmos
   ═══════════════════════════════════════════════════════════════════════ */

const SCHEDULING_META = {
  'FCFS':                  { short:'First-Come, First-Served',   formula:'WT = CT−AT−BT  |  TAT = CT−AT  |  RT = 1ª CPU − AT', explanation:'No-preemptivo. Los procesos se ejecutan en el orden exacto de llegada. Puede causar el "efecto convoy" cuando un proceso largo bloquea a todos los cortos.', useCase:'Colas de impresión y sistemas batch.', preemptive:'❌ No preemptivo', starvation:'❌ No ocurre', complexity:'O(n)' },
  'SJF':                   { short:'Shortest Job First',          formula:'Selección: min(BT disponibles)  |  WT = CT−AT−BT', explanation:'Elige el proceso con menor burst time. Óptimo en WT promedio, pero requiere conocer el burst time de antemano y puede causar starvation.', useCase:'Compiladores batch, servidores donde se conoce el tamaño de la tarea.', preemptive:'❌ No preemptivo', starvation:'⚠️ Puede ocurrir', complexity:'O(n log n)' },
  'HRRN':                  { short:'Highest Response Ratio Next', formula:'RR = (WT_actual + BT) / BT  |  Selección: max(RR)', explanation:'Calcula el Response Ratio de cada proceso. Combina la prioridad por burst corto con aging implícito — elimina starvation sin sacrificar eficiencia.', useCase:'Sistemas mixtos batch/interactivo que necesitan justicia y eficiencia.', preemptive:'❌ No preemptivo', starvation:'✅ No ocurre', complexity:'O(n)' },
  'Round Robin':            { short:'Quantum configurable',        formula:'Cada proceso recibe hasta Q unidades  |  espera máx = (n−1)×Q', explanation:'Cada proceso recibe la CPU por un máximo de Q unidades (quantum). Si no termina, vuelve al final de la cola circular. Garantiza equidad y baja latencia.', useCase:'Sistemas interactivos, terminales SSH, shells.', preemptive:'✅ Preemptivo', starvation:'✅ No ocurre', complexity:'O(1)' },
  'SRTF':                  { short:'Shortest Remaining Time',     formula:'Preempta si llega proceso con menor tiempo restante  |  min(remaining_burst)', explanation:'Variante preemptiva de SJF. En cada tick compara el tiempo restante de todos los procesos. Mayor overhead de context switch, pero minimiza el WT total.', useCase:'Servidores web de alto rendimiento donde se conoce el tamaño de la request.', preemptive:'✅ Preemptivo', starvation:'⚠️ Puede ocurrir', complexity:'O(n) por tick' },
  'Priority (Preemptive)': { short:'Prioridad preemptiva',        formula:'Selección: min(priority)  |  Preempta si llega mayor prioridad', explanation:'Siempre corre el proceso de mayor prioridad disponible. Preempta al actual si llega uno de mayor prioridad. Requiere aging para evitar starvation de procesos de baja prioridad.', useCase:'Kernels de SO, interrupciones hardware, sistemas de tiempo real.', preemptive:'✅ Preemptivo', starvation:'⚠️ Puede ocurrir', complexity:'O(log n)' },
  'Multilevel Queue':       { short:'Colas por categoría fija',    formula:'Cola_0 (alta) → Cola_1 → Cola_n (baja)  |  sin migración de cola', explanation:'Divide procesos en colas permanentes por tipo (sistema, interactivo, batch). Cada cola tiene su propio algoritmo. Los procesos nunca cambian de cola.', useCase:'SO con clases bien definidas: procesos de sistema, usuario y batch.', preemptive:'✅ Entre colas', starvation:'⚠️ Colas inferiores', complexity:'O(k×n)' },
  'MLFQ':                  { short:'Multilevel Feedback Queue',   formula:'Nuevo → Cola_0 (quantum corto)  |  agota quantum → baja cola  |  I/O → sube cola', explanation:'Los procesos cambian de cola según su comportamiento. CPU-bound bajan de prioridad; I/O-bound se mantienen arriba. Aprende el patrón de uso sin necesitar burst times.', useCase:'Sistemas de propósito general modernos. Linux CFS comparte estos principios.', preemptive:'✅ Preemptivo', starvation:'✅ Controlado con aging', complexity:'O(k)' },
};

const PAGING_META = {
  'FIFO':          { short:'First-In, First-Out',        formula:'Evictar: página más antigua en memoria', explanation:'La página que llegó primero es la primera en salir. Simple con una cola FIFO. Sufre la paradoja de Bélady.', useCase:'Sistemas embebidos con memoria muy limitada.', belady:'⚠️ Sufre anomalía de Bélady' },
  'LRU':           { short:'Least Recently Used',         formula:'Evictar: min(last_access_time) → página menos usada recientemente', explanation:'Evicta la página que no fue usada hace más tiempo. Explota la localidad temporal. La más usada en la práctica.', useCase:'Linux (aproximado con bit ref), Windows, la mayoría de SO modernos.', belady:'✅ No sufre anomalía' },
  'Optimal':       { short:'Bélady (teórico)',            formula:'Evictar: página que se usará MÁS tarde en el futuro', explanation:'Requiere conocer el futuro. Imposible de implementar online. Referencia teórica de benchmark.', useCase:'Evaluación teórica, análisis de traces de memoria.', belady:'✅ No sufre anomalía (es el óptimo)' },
  'Clock':         { short:'Reloj circular',              formula:'bit_ref=1 → limpiar y avanzar  |  bit_ref=0 → evictar', explanation:'Puntero circular sobre frames. Da segunda oportunidad a páginas referenciadas recientemente. Aproxima LRU con O(1).', useCase:'Linux page daemon (kswapd), implementaciones reales de VM.', belady:'✅ No sufre anomalía' },
  'Second Chance': { short:'Enhanced Clock',              formula:'(R=0, D=0)→evictar  |  (R=0, D=1)→segunda oportunidad  |  (R=1,*)→limpiar R', explanation:'Clock con bit dirty. Prioriza evictar páginas limpias no referenciadas. Reduce I/O de swap.', useCase:'Sistemas con alto costo de escritura a disco al hacer swap.', belady:'✅ No sufre anomalía' },
};

/* ═══════════════════════════════════════════════════════════════════════
   Paleta Mario para bloques
   ═══════════════════════════════════════════════════════════════════════ */

// Colores Mario por PID (más vibrantes que PID_COLORS genérico)
const MARIO_BLOCK_COLORS = [
  { top:'#FF4545', mid:'#E52521', dark:'#8B0000' }, // rojo Mario
  { top:'#5BAEF2', mid:'#2563EB', dark:'#1E3A7A' }, // azul
  { top:'#4DD670', mid:'#10B981', dark:'#065F46' }, // verde
  { top:'#FFCF3B', mid:'#F59E0B', dark:'#92400E' }, // naranja/amarillo
  { top:'#C084FC', mid:'#8B5CF6', dark:'#4C1D95' }, // morado
  { top:'#F472B6', mid:'#EC4899', dark:'#831843' }, // rosa
  { top:'#22D3EE', mid:'#0891B2', dark:'#164E63' }, // cyan
  { top:'#A3E635', mid:'#65A30D', dark:'#365314' }, // lima
];

function marioBlockColor(pid) {
  return MARIO_BLOCK_COLORS[pid % MARIO_BLOCK_COLORS.length];
}

/* ═══════════════════════════════════════════════════════════════════════
   Estado
   ═══════════════════════════════════════════════════════════════════════ */

const CompPlayer = {
  results: null, totalTime: 0, currentTick: 0,
  playing: false, speed: 1.0, rafId: null, lastFrame: 0,
  category: 'scheduling', marios: [], renderFn: null,
};

const CompState = {
  category: 'scheduling', selected: [], numCores: 4,
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
   Categoría
   ═══════════════════════════════════════════════════════════════════════ */

function setCompCategory(cat) {
  CompState.category = cat;
  CompState.selected = [];
  document.getElementById('comp-tab-sched').classList.toggle('active', cat === 'scheduling');
  document.getElementById('comp-tab-page').classList.toggle('active', cat === 'paging');
  const max = cat === 'scheduling' ? 4 : 5;
  document.getElementById('comp-algo-hint').textContent =
    `Selecciona 2–${max} algoritmos de ${cat === 'scheduling' ? 'scheduling' : 'paginación'}`;
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
      <div style="font-weight:700;font-size:12px;color:var(--text-primary);margin-bottom:3px">${name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${info.short}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${info.preemptive ? `<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${color}22;border:1px solid ${color}44;color:${color}">${info.preemptive}</span>` : ''}
        ${info.belady     ? `<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${color}22;border:1px solid ${color}44;color:${color}">${info.belady}</span>` : ''}
      </div>
    `;
    card.addEventListener('click', () => toggleAlgoCard(card, name, color));
    grid.appendChild(card);
  });
}

function toggleAlgoCard(card, name, color) {
  const max = CompState.category === 'scheduling' ? 4 : 5;
  const isSelected = CompState.selected.includes(name);
  if (isSelected) {
    CompState.selected = CompState.selected.filter(n => n !== name);
    card.style.borderColor = '';
    card.style.background = '';
    card.style.boxShadow = '';
  } else {
    if (CompState.selected.length >= max) return;
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
  document.getElementById('comp-sel-count').textContent = `${CompState.selected.length} / ${max} seleccionados`;
}

function setCompCores(val) {
  CompState.numCores = parseInt(val);
  document.getElementById('comp-cores-label').textContent = `${val} core${val > 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Ejecutar — UN solo botón que hace fetch + arranca animación
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
  log.textContent = `⚙  ${CompState.selected.length} threads | ${CompState.numCores} core(s)…`;

  clearCompResults();
  stopCompPlayer();

  try {
    let apiResults;
    if (CompState.category === 'scheduling') {
      const quantum = parseInt(document.getElementById('comp-quantum').value) || 2;
      apiResults = await apiCall('/api/schedule/compare-selected', {
        algorithms: CompState.selected, quantum,
        num_cores: CompState.numCores, processes: AppState.processes,
      });
    } else {
      const refRaw = document.getElementById('comp-ref-string').value;
      const refStr = refRaw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0);
      const frames = parseInt(document.getElementById('comp-frames').value) || 3;
      if (!refStr.length) { showToast('Cadena de referencia inválida', 'warning'); return; }
      apiResults = await apiCall('/api/page-replacement/compare', {
        algorithms: CompState.selected, reference_string: refStr,
        num_frames: frames, num_cores: CompState.numCores,
      });
    }

    const n = Object.values(apiResults).filter(d => !d.error).length;
    log.textContent = `✓  ${n} threads completados`;
    showToast(`${n} algoritmos comparados`, 'success');

    buildResultUI(apiResults);
    // Autoplay inmediato
    setTimeout(() => {
      if (CompPlayer.renderFn && !CompPlayer.playing) startCompPlay();
    }, 120);

  } catch (err) {
    log.textContent = `❌  ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> ▶ Comparar';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Construir UI de resultados
   ═══════════════════════════════════════════════════════════════════════ */

function buildResultUI(apiResults) {
  const container = document.getElementById('comp-results');
  const entries   = Object.entries(apiResults).filter(([, d]) => !d.error);
  if (!entries.length) return;
  const isSched = CompState.category === 'scheduling';
  const meta    = isSched ? SCHEDULING_META : PAGING_META;

  // ── Estilos locales (inyectar una vez) ──────────────────────────────
  if (!document.getElementById('comp-v4-style')) {
    const s = document.createElement('style');
    s.id = 'comp-v4-style';
    s.textContent = `
      .comp-live-cell { transition: color .25s, background .25s; }
      .comp-live-cell.flash { color:#6EEB83 !important; background:rgba(110,235,131,.12) !important; }
      .comp-section { margin-bottom:16px; }
      .comp-section-title {
        font-size:12px; font-weight:700; color:var(--text-secondary);
        text-transform:uppercase; letter-spacing:.06em;
        margin-bottom:8px; display:flex; align-items:center; gap:6px;
      }
      .comp-metrics-row {
        display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px;
      }
      .comp-metric-tile {
        background:var(--bg-card); border:1px solid var(--border); border-radius:10px;
        padding:12px 14px; text-align:center;
      }
      .comp-metric-tile .val { font-size:22px; font-weight:700; color:var(--accent); margin:4px 0 2px; }
      .comp-metric-tile .lbl { font-size:10px; color:var(--text-muted); }
      .comp-metric-tile .sub { font-size:11px; color:var(--text-secondary); }
      .comp-winner { outline:2px solid #6EEB83; outline-offset:2px; }
      .comp-bar-charts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      @media (max-width:700px) { .comp-bar-charts { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(s);
  }

  // ── Panel de procesos ───────────────────────────────────────────────
  const vis = typeof getEffectiveVisibility === 'function'
    ? getEffectiveVisibility() : { threadsVisible:false, forksVisible:false };

  let procPanel = '';
  if (isSched && AppState.processes.length > 0) {
    const tiles = AppState.processes.map((p, i) => {
      const c = PID_COLORS[i % PID_COLORS.length];
      const tb = (vis.threadsVisible && p.threads && p.threads.length)
        ? p.threads.map(t => `<span style="font-size:9px;background:#2563eb33;color:#60a5fa;border:1px solid #3b82f666;border-radius:4px;padding:1px 5px;margin-right:2px">🧵T${t.tid}</span>`).join('') : '';
      const fb = (vis.forksVisible && p.forks && p.forks.length)
        ? p.forks.map(f => `<span style="font-size:9px;background:#10b98133;color:#34d399;border:1px solid #10b98166;border-radius:4px;padding:1px 5px;margin-right:2px">⑂F${f.fid}</span>`).join('') : '';
      return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;border-radius:8px;border:1.5px solid ${c}55;background:${c}11;min-width:68px">
        <div style="font-weight:800;font-size:14px;color:${c}">P${p.pid}</div>
        <div style="font-size:9px;color:var(--text-muted)">BT=${p.burst_time} AT=${p.arrival_time}</div>
        <div>${tb}${fb}</div>
      </div>`;
    }).join('');
    procPanel = `<div class="card comp-section">
      <div class="comp-section-title"><i class="ph ph-stack"></i> Procesos en comparación</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${tiles}</div>
    </div>`;
  }

  // ── Gantt canvas GRANDE ─────────────────────────────────────────────
  const ganttSection = `
    <div class="card comp-section" id="comp-gantt-card">
      <div class="comp-section-title" style="justify-content:space-between">
        <span><i class="ph ph-chart-bar"></i> Gantt comparativo en tiempo real</span>
        <span id="comp-tick-label" style="font-size:11px;color:var(--text-muted);font-weight:400;text-transform:none">t = 0</span>
      </div>
      <div id="comp-canvas-container" style="position:relative;width:100%;border-radius:8px;overflow:hidden;background:#080814;border:1px solid rgba(255,255,255,0.08)">
        <canvas id="comp-canvas" style="display:block;width:100%"></canvas>
      </div>
      <!-- Controles integrados (UN solo set, sin botón Play separado) -->
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(0)" title="Reset"><i class="ph ph-skip-back"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(-1)" title="Paso atrás"><i class="ph ph-rewind"></i></button>
        <button class="btn btn-primary" id="comp-btn-play" style="border-radius:24px;padding:7px 24px;font-size:1rem;font-weight:700" onclick="toggleCompPlay()">
          <i class="ph ph-pause"></i> Pausar
        </button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(1)" title="Paso adelante"><i class="ph ph-fast-forward"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(CompPlayer.totalTime)" title="Ir al final"><i class="ph ph-skip-forward"></i></button>
        <span id="comp-step-counter" style="font-size:12px;color:var(--text-muted);min-width:58px">0 / 0</span>
        <div style="display:flex;align-items:center;gap:6px;margin-left:6px">
          <label for="comp-speed" style="font-size:11px;color:var(--text-muted)">Velocidad</label>
          <input type="range" id="comp-speed" min="0.25" max="4" step="0.25" value="1" style="width:76px" oninput="setCompSpeed(this.value)">
          <span id="comp-speed-label" style="font-size:11px;font-weight:600;background:rgba(255,255,255,0.12);padding:2px 7px;border-radius:6px;color:#fff;border:1px solid rgba(255,255,255,0.16)">1x</span>
        </div>
      </div>
    </div>`;

  // ── Métricas vivas ──────────────────────────────────────────────────
  const isS = isSched;
  const metricTiles = entries.map(([name, d], i) => {
    const c = PID_COLORS[i % PID_COLORS.length];
    return `<div class="comp-metric-tile" id="comp-mtile-${i}">
      <div style="font-size:10px;font-weight:700;color:${c};margin-bottom:4px">${name}</div>
      ${isS ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;text-align:left">
          <div><div style="font-size:9px;color:var(--text-muted)">WT</div><div id="comp-cell-wt-${i}" class="comp-live-cell" style="font-size:15px;font-weight:700;color:#fff">—</div></div>
          <div><div style="font-size:9px;color:var(--text-muted)">TAT</div><div id="comp-cell-tat-${i}" class="comp-live-cell" style="font-size:15px;font-weight:700;color:#fff">—</div></div>
          <div><div style="font-size:9px;color:var(--text-muted)">RT</div><div id="comp-cell-rt-${i}" class="comp-live-cell" style="font-size:15px;font-weight:700;color:#fff">—</div></div>
          <div><div style="font-size:9px;color:var(--text-muted)">CPU%</div><div id="comp-cell-cpu-${i}" class="comp-live-cell" style="font-size:15px;font-weight:700;color:#fff">—</div></div>
        </div>` : `
        <div><div style="font-size:9px;color:var(--text-muted)">Faults</div><div id="comp-cell-pf-${i}" class="comp-live-cell" style="font-size:20px;font-weight:700;color:#fff">—</div></div>
        <div style="font-size:10px;color:var(--text-muted)">Hit <span id="comp-cell-hr-${i}" class="comp-live-cell">—</span></div>`}
    </div>`;
  }).join('');

  const metricsSection = `
    <div class="comp-section">
      <div class="comp-section-title"><i class="ph ph-activity"></i> Métricas en vivo</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;padding:5px 10px;background:rgba(110,235,131,0.06);border-radius:6px;border-left:3px solid var(--accent)">
        📐 ${isS
          ? 'WT = CT−AT−BT &nbsp;|&nbsp; TAT = CT−AT &nbsp;|&nbsp; RT = 1ª CPU−AT &nbsp;|&nbsp; CPU% = Tiempo_ocupado/Tiempo_total × 100'
          : 'Fault Rate = Fallos/Longitud_cadena × 100 &nbsp;|&nbsp; Hit Rate = 100 − Fault Rate'}
      </div>
      <div class="comp-metrics-row">${metricTiles}</div>
    </div>`;

  // ── Gráficas de barras (canvas 2D) ──────────────────────────────────
  const barChartsSection = isS ? `
    <div class="comp-section">
      <div class="comp-section-title"><i class="ph ph-chart-bar"></i> Comparación de métricas</div>
      <div class="comp-bar-charts">
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Avg Waiting Time (ms)</div><div style="height:160px;position:relative"><canvas id="comp-bc-wt"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Avg Turnaround Time (ms)</div><div style="height:160px;position:relative"><canvas id="comp-bc-tat"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Avg Response Time (ms)</div><div style="height:160px;position:relative"><canvas id="comp-bc-rt"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">CPU Utilization (%)</div><div style="height:160px;position:relative"><canvas id="comp-bc-cpu"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Context Switches</div><div style="height:160px;position:relative"><canvas id="comp-bc-ctx"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Simulation Time (ms)</div><div style="height:160px;position:relative"><canvas id="comp-bc-sim"></canvas></div></div>
      </div>
    </div>` : `
    <div class="comp-section">
      <div class="comp-section-title"><i class="ph ph-chart-bar"></i> Comparación de métricas</div>
      <div class="comp-bar-charts">
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Page Faults totales</div><div style="height:160px;position:relative"><canvas id="comp-bc-pf"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Fault Rate (%)</div><div style="height:160px;position:relative"><canvas id="comp-bc-fr"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Hit Rate (%)</div><div style="height:160px;position:relative"><canvas id="comp-bc-hr"></canvas></div></div>
        <div class="card" style="padding:12px"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Simulation Time (ms)</div><div style="height:160px;position:relative"><canvas id="comp-bc-sim"></canvas></div></div>
      </div>
    </div>`;

  // ── Tabla comparativa ───────────────────────────────────────────────
  const hdrs = isS
    ? ['Algoritmo','Core','Avg WT','Avg TAT','Avg RT','CPU %','Ctx Sw.','Sim ms']
    : ['Algoritmo','Core','Page Faults','Hit Rate %','Fault Rate %','Frames','Sim ms'];

  const tableRows = entries.map(([name, d], i) => {
    const c = PID_COLORS[i % PID_COLORS.length];
    const core = i % CompState.numCores;
    return isS
      ? `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td>Core ${core}</td>
          <td id="comp-cell-wt2-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-tat2-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-rt2-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-cpu2-${i}" class="comp-live-cell">—</td>
          <td>${d.context_switches ?? '—'}</td>
          <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1) : '—'}</td>
        </tr>`
      : `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td>Core ${i % CompState.numCores}</td>
          <td id="comp-cell-pf2-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-hr2-${i}" class="comp-live-cell">—</td>
          <td id="comp-cell-fr2-${i}" class="comp-live-cell">—</td>
          <td>${d.num_frames ?? '—'}</td>
          <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1) : '—'}</td>
        </tr>`;
  }).join('');

  const tableSection = `
    <div class="card comp-section">
      <div class="comp-section-title"><i class="ph ph-clipboard-text"></i> Tabla de métricas</div>
      <div class="table-wrapper">
        <table><thead><tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody></table>
      </div>
    </div>`;

  // ── Explicaciones ───────────────────────────────────────────────────
  const explSection = `
    <div class="card comp-section">
      <div class="comp-section-title"><i class="ph ph-lightbulb"></i> Algoritmos: fórmulas y casos de uso</div>
      ${entries.map(([name], i) => {
        const m = meta[name]; if (!m) return '';
        const c = PID_COLORS[i % PID_COLORS.length];
        const badges = [
          m.preemptive && `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.preemptive}</span>`,
          m.starvation && `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.starvation}</span>`,
          m.complexity && `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.complexity}</span>`,
          m.belady     && `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.belady}</span>`,
        ].filter(Boolean).join(' ');
        return `<div style="border-left:3px solid ${c};padding:10px 14px;margin-bottom:10px;background:var(--bg-surface);border-radius:0 8px 8px 0">
          <div style="font-weight:700;font-size:13px;color:${c};margin-bottom:3px">${name} — <span style="font-weight:400;color:var(--text-secondary)">${m.short}</span></div>
          <div style="font-size:10px;color:var(--text-muted);font-family:monospace;margin-bottom:6px;padding:4px 8px;background:rgba(255,255,255,.04);border-radius:4px">${m.formula}</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.65;margin-bottom:6px">${m.explanation}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">${badges}</div>
          <div style="font-size:11px;color:var(--text-muted)">💡 <em>${m.useCase}</em></div>
        </div>`;
      }).join('')}
    </div>`;

  container.innerHTML = procPanel + ganttSection + metricsSection + barChartsSection + tableSection + explSection;

  // Iniciar canvas Gantt grande
  initCompCanvas(entries);

  // Dibujar gráficas de barras estáticas (se actualizarán al final de la animación)
  setTimeout(() => drawAllBarCharts(entries, isSched), 80);
}

/* ═══════════════════════════════════════════════════════════════════════
   Canvas Gantt GRANDE con estilo Mario
   ═══════════════════════════════════════════════════════════════════════ */

const COMP_BAR_H   = 52;   // barras grandes
const COMP_ROW_GAP = 18;
const COMP_LEFT    = 140;
const COMP_TOP     = 16;
const COMP_BOTTOM  = 36;
const COMP_MARIO_SCALE = 2;
const COMP_MARIO_W = 16 * COMP_MARIO_SCALE;
const COMP_MARIO_H = 16 * COMP_MARIO_SCALE;

function initCompCanvas(entries) {
  const isSched = CompState.category === 'scheduling';
  const canvas  = document.getElementById('comp-canvas');
  const cont    = document.getElementById('comp-canvas-container');
  if (!canvas || !cont) return;

  const nAlgos = entries.length;
  const height  = COMP_TOP + nAlgos * (COMP_BAR_H + COMP_ROW_GAP) + COMP_BOTTOM + 24;
  const dpr     = window.devicePixelRatio || 1;
  const cw      = cont.clientWidth || 900;

  canvas.width  = cw * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Total time
  let totalTime = 1;
  if (isSched) {
    entries.forEach(([, d]) => {
      if (d.gantt && d.gantt.length) totalTime = Math.max(totalTime, Math.max(...d.gantt.map(e => e.end)));
    });
  } else {
    entries.forEach(([, d]) => { if (d.ref_length) totalTime = Math.max(totalTime, d.ref_length); });
  }

  CompPlayer.marios = entries.map(() => ({
    x: COMP_LEFT, y: 0, frame: 0, frameTimer: 0,
    jumping: false, jumpVel: 0, baseY: 0, lastBlock: null, visible: false,
  }));

  CompPlayer.results   = entries;
  CompPlayer.totalTime = totalTime;
  CompPlayer.currentTick = 0;
  CompPlayer.category  = CompState.category;

  const scale = (cw - COMP_LEFT - 24) / totalTime;

  document.getElementById('comp-step-counter').textContent = `0 / ${totalTime}`;

  function drawMarioBlock(ctx, x, y, w, h, pidIdx) {
    if (w <= 0) return;
    const c = marioBlockColor(pidIdx);
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, x + 2, y + 3, w, h, 5); ctx.fill();
    // Cara principal
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0,   c.top);
    grad.addColorStop(0.5, c.mid);
    grad.addColorStop(1,   c.dark);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 5); ctx.fill();
    // Highlight superior (brillo Mario)
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, x + 2, y + 2, w - 4, h * 0.3, 3); ctx.fill();
    // Borde inferior oscuro
    ctx.fillStyle = c.dark;
    roundRect(ctx, x, y + h - 4, w, 4, [0,0,5,5]); ctx.fill();
    // Etiqueta PID
    if (w > 22) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = `bold ${Math.min(11, Math.max(7, w / 4))}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`P${pidIdx}`, x + w / 2, y + h / 2 + 4);
    }
  }

  function drawIdleBlock(ctx, x, y, w, h) {
    if (w <= 0) return;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, x, y, w, h, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 5); ctx.stroke();
  }

  function drawFloor(ctx, y, w) {
    // Piso estilo Mario: línea marrón + textura
    ctx.fillStyle = '#3D1A00';
    ctx.fillRect(COMP_LEFT, y, w - COMP_LEFT - 24, 4);
    ctx.fillStyle = '#5B2D00';
    ctx.fillRect(COMP_LEFT, y + 1, w - COMP_LEFT - 24, 2);
  }

  function render() {
    const tick = CompPlayer.currentTick;
    const w    = cw;
    const axisY = COMP_TOP + nAlgos * (COMP_BAR_H + COMP_ROW_GAP);

    ctx.clearRect(0, 0, w, height);

    // Fondo con patrón de cielo Mario (noche/espacio)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#04040F');
    bgGrad.addColorStop(1, '#080820');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, height);

    // Estrellas de fondo pixeladas
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const stars = [[30,8],[90,15],[180,6],[260,12],[350,5],[440,18],[510,9],[600,14],[700,7],[800,11]];
    stars.forEach(([sx,sy]) => { if (sx < w) ctx.fillRect(sx, sy, 2, 2); });

    // Grid lines verticales suaves
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1; ctx.setLineDash([2,4]);
    for (let t = 0; t <= totalTime; t++) {
      const x = COMP_LEFT + t * scale;
      ctx.beginPath(); ctx.moveTo(x, COMP_TOP); ctx.lineTo(x, axisY); ctx.stroke();
    }
    ctx.setLineDash([]);

    entries.forEach(([name, d], idx) => {
      const rowY  = COMP_TOP + idx * (COMP_BAR_H + COMP_ROW_GAP);
      const mario = CompPlayer.marios[idx];
      const color = PID_COLORS[idx % PID_COLORS.length];

      // Fondo de la fila (tierra Mario)
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      roundRect(ctx, COMP_LEFT - 4, rowY - 2, w - COMP_LEFT - 18, COMP_BAR_H + 4, 6);
      ctx.fill();

      // Etiqueta del algoritmo con estilo
      ctx.fillStyle = color;
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(name.length > 14 ? name.slice(0,13)+'…' : name, COMP_LEFT - 10, rowY + COMP_BAR_H / 2 + 4);
      // Badge de índice
      ctx.fillStyle = color + '33';
      roundRect(ctx, COMP_LEFT - 128, rowY + COMP_BAR_H / 2 - 9, 18, 18, 9);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(idx + 1, COMP_LEFT - 119, rowY + COMP_BAR_H / 2 + 4);

      if (isSched) {
        const gantt = d.gantt || [];

        // Barra base vacía
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        roundRect(ctx, COMP_LEFT, rowY, (w - COMP_LEFT - 24), COMP_BAR_H, 5);
        ctx.fill();

        gantt.forEach(entry => {
          const x = COMP_LEFT + entry.start * scale;
          if (entry.end <= tick) {
            const bw = (entry.end - entry.start) * scale;
            if (entry.pid < 0) drawIdleBlock(ctx, x, rowY, bw, COMP_BAR_H);
            else drawMarioBlock(ctx, x, rowY, bw, COMP_BAR_H, entry.pid);
          } else if (entry.start < tick) {
            const bw = (tick - entry.start) * scale;
            if (entry.pid < 0) drawIdleBlock(ctx, x, rowY, bw, COMP_BAR_H);
            else {
              const c = marioBlockColor(entry.pid);
              ctx.globalAlpha = 0.6;
              drawMarioBlock(ctx, x, rowY, bw, COMP_BAR_H, entry.pid);
              ctx.globalAlpha = 1;
            }
          }
        });

        // Piso de la fila
        drawFloor(ctx, rowY + COMP_BAR_H, w);

        // Mario
        updateCompMario(mario, idx, d.gantt, tick, scale, rowY);
        if (mario.visible && typeof MARIO_SPRITE_FRAMES !== 'undefined') {
          drawCompMarioSprite(ctx, mario.x, mario.y, mario.jumping, mario.frame);
        }

        // Actualizar celdas
        updateLiveCellsSched(idx, d, tick, totalTime);

      } else {
        // Paginación: bloques por step
        const steps = d.steps || [];
        const visN  = Math.min(Math.floor(tick), steps.length);
        const bMaxW = w - COMP_LEFT - 24;
        const sw    = bMaxW / (steps.length || 1);

        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        roundRect(ctx, COMP_LEFT, rowY, bMaxW, COMP_BAR_H, 5); ctx.fill();

        for (let s = 0; s < visN; s++) {
          const st = steps[s];
          const x  = COMP_LEFT + s * sw;
          if (st.fault) {
            drawMarioBlock(ctx, x, rowY, sw - 1, COMP_BAR_H, 0); // rojo = fault
          } else {
            ctx.fillStyle = '#10B98166';
            roundRect(ctx, x, rowY, sw - 1, COMP_BAR_H, 3); ctx.fill();
            ctx.fillStyle = '#6ee7b7';
            ctx.font = `${Math.min(9, sw * 0.5)}px monospace`; ctx.textAlign = 'center';
            if (sw > 12) ctx.fillText(st.page_requested, x + sw / 2, rowY + COMP_BAR_H / 2 + 4);
          }
        }
        drawFloor(ctx, rowY + COMP_BAR_H, w);
        if (visN > 0 && typeof MARIO_SPRITE_FRAMES !== 'undefined') {
          const mX = COMP_LEFT + (visN - 0.5) * sw - COMP_MARIO_W / 2;
          const mY = rowY - COMP_MARIO_H - 2;
          mario.frame = Math.floor(tick * 4) % 4;
          drawCompMarioSprite(ctx, mX, mY, false, mario.frame);
        }
        updateLiveCellsPage(idx, d, Math.floor(tick), steps.length);
      }
    });

    // Eje X
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(COMP_LEFT, axisY + 6); ctx.lineTo(w - 20, axisY + 6); ctx.stroke();

    // Ticks de tiempo
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.round(totalTime / 12));
    for (let t = 0; t <= totalTime; t += step) {
      const x = COMP_LEFT + t * scale;
      ctx.beginPath(); ctx.moveTo(x, axisY + 4); ctx.lineTo(x, axisY + 10); ctx.stroke();
      ctx.fillText(t, x, axisY + 22);
    }

    // Cursor de tiempo (línea verde neón)
    const cursorX = COMP_LEFT + tick * scale;
    ctx.strokeStyle = '#6EEB83';
    ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.shadowColor = '#6EEB83'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, axisY); ctx.stroke();
    ctx.shadowBlur = 0; ctx.setLineDash([]);

    // Tick label
    document.getElementById('comp-tick-label').textContent = `t = ${tick.toFixed(1)}`;
    document.getElementById('comp-step-counter').textContent = `${Math.round(tick)} / ${totalTime}`;
  }

  CompPlayer.renderFn = render;
  render();
}

/* ═══════════════════════════════════════════════════════════════════════
   Mario helpers
   ═══════════════════════════════════════════════════════════════════════ */

function updateCompMario(mario, idx, gantt, tick, scale, rowY) {
  const real = (gantt || []).filter(e => e.pid >= 0);
  if (!real.length || tick <= 0) { mario.visible = false; return; }
  mario.visible = true;
  let running = null;
  for (const e of real) { if (tick > e.start && tick <= e.end) { running = e; break; } }
  const targetX = running
    ? COMP_LEFT + Math.min(running.end, tick) * scale - COMP_MARIO_W / 2
    : COMP_LEFT + tick * scale - COMP_MARIO_W / 2;
  mario.x += (targetX - mario.x) * 0.2;
  mario.baseY = rowY - COMP_MARIO_H - 2;
  if (running && running.pid !== mario.lastBlock && mario.lastBlock !== null && !mario.jumping) {
    mario.jumping = true; mario.jumpVel = -95;
  }
  if (running) mario.lastBlock = running.pid;
  const dt = 1/60;
  if (mario.jumping) {
    mario.y += mario.jumpVel * dt; mario.jumpVel += 290 * dt;
    if (mario.y >= mario.baseY) { mario.y = mario.baseY; mario.jumping = false; mario.jumpVel = 0; }
  } else {
    mario.y = mario.baseY;
    mario.frameTimer = (mario.frameTimer||0) + dt;
    if (mario.frameTimer >= 0.13) { mario.frameTimer = 0; mario.frame = (mario.frame+1)%4; }
  }
}

function drawCompMarioSprite(ctx, mx, my, jumping, frame) {
  if (typeof MARIO_SPRITE_FRAMES === 'undefined') return;
  const runKeys = typeof MARIO_RUN_KEYS !== 'undefined' ? MARIO_RUN_KEYS : ['stand','run1','run2','run1'];
  const key  = jumping ? 'jump' : runKeys[frame % 4];
  const grid = MARIO_SPRITE_FRAMES[key] || MARIO_SPRITE_FRAMES.stand;
  const s    = COMP_MARIO_SCALE;
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const col = grid[r][c];
      if (col === null) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(mx + c*s), Math.round(my + r*s), s, s);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (Array.isArray(r)) {
    // [tl, tr, br, bl]
    const [tl,tr,br,bl] = r.map(v => Math.max(0,v));
    ctx.beginPath();
    ctx.moveTo(x+tl,y);
    ctx.lineTo(x+w-tr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+tr);
    ctx.lineTo(x+w,y+h-br); ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
    ctx.lineTo(x+bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-bl);
    ctx.lineTo(x,y+tl); ctx.quadraticCurveTo(x,y,x+tl,y);
    ctx.closePath();
    return;
  }
  r = Math.max(0, Math.min(r, w/2, h/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

/* ═══════════════════════════════════════════════════════════════════════
   Gráficas de barras (canvas 2D estático)
   ═══════════════════════════════════════════════════════════════════════ */

function drawBarChartStatic(canvasId, labels, values, winnerFn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cont = canvas.parentElement;
  const W = cont.clientWidth || 300;
  const H = cont.clientHeight || 160;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const L=40, R=12, T=10, B=36;
  const cw = W-L-R, ch = H-T-B;
  const maxV = Math.max(...values, 0.01);
  const niceMax = Math.ceil(maxV * 1.15) || 1;
  const barCount = values.length;
  const gap = 8;
  const bw  = Math.min((cw - gap*(barCount+1)) / barCount, 60);
  const startX = L + (cw - (barCount*bw + gap*(barCount-1))) / 2;

  ctx.fillStyle = 'rgba(8,8,20,0.0)'; ctx.fillRect(0,0,W,H);

  // Y grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
  for (let i=0;i<=4;i++) {
    const y = T + (ch/4)*i;
    ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(W-R,y); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='8px monospace'; ctx.textAlign='right';
    ctx.fillText((niceMax*(1-i/4)).toFixed(1), L-4, y+3);
  }
  ctx.setLineDash([]);

  // Bars
  values.forEach((v, i) => {
    const x   = startX + i * (bw + gap);
    const bh  = (v / niceMax) * ch;
    const y   = T + ch - bh;
    const c   = marioBlockColor(i);
    const isW = winnerFn ? winnerFn(v, values) : false;

    const grad = ctx.createLinearGradient(x, y, x, y+bh);
    grad.addColorStop(0, c.top); grad.addColorStop(1, c.mid);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, bw, bh, 4); ctx.fill();
    if (isW) {
      ctx.strokeStyle = '#6EEB83'; ctx.lineWidth = 2;
      roundRect(ctx, x-1, y-1, bw+2, bh+2, 5); ctx.stroke();
      ctx.fillStyle='#6EEB83'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
      ctx.fillText('★', x+bw/2, y-4);
    }
    // Valor
    ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
    ctx.fillText(v.toFixed(1), x+bw/2, y-2-(isW?6:0));
    // Label
    ctx.fillStyle = isW ? '#6EEB83' : 'rgba(255,255,255,0.45)';
    ctx.font = `${isW?'bold ':''} 8px sans-serif`; ctx.textAlign='center';
    const lbl = labels[i].length>8 ? labels[i].slice(0,7)+'…' : labels[i];
    ctx.fillText(lbl, x+bw/2, T+ch+14);
  });
}

function drawAllBarCharts(entries, isSched) {
  const names  = entries.map(([n]) => n);
  const minWin = (v, arr) => v === Math.min(...arr);
  const maxWin = (v, arr) => v === Math.max(...arr);

  if (isSched) {
    drawBarChartStatic('comp-bc-wt',  names, entries.map(([,d])=>d.avg_waiting),     minWin);
    drawBarChartStatic('comp-bc-tat', names, entries.map(([,d])=>d.avg_turnaround),   minWin);
    drawBarChartStatic('comp-bc-rt',  names, entries.map(([,d])=>d.avg_response),     minWin);
    drawBarChartStatic('comp-bc-cpu', names, entries.map(([,d])=>d.cpu_utilization),  maxWin);
    drawBarChartStatic('comp-bc-ctx', names, entries.map(([,d])=>d.context_switches||0), minWin);
    drawBarChartStatic('comp-bc-sim', names, entries.map(([,d])=>d.elapsed_ms||0),    minWin);
  } else {
    drawBarChartStatic('comp-bc-pf',  names, entries.map(([,d])=>d.total_faults||0),  minWin);
    drawBarChartStatic('comp-bc-fr',  names, entries.map(([,d])=>d.fault_rate||0),    minWin);
    drawBarChartStatic('comp-bc-hr',  names, entries.map(([,d])=>d.hit_rate||0),      maxWin);
    drawBarChartStatic('comp-bc-sim', names, entries.map(([,d])=>d.elapsed_ms||0),    minWin);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Celdas de tabla en vivo
   ═══════════════════════════════════════════════════════════════════════ */

function flash(id, val) {
  const el = document.getElementById(id); if (!el) return;
  if (el.textContent === val) return;
  el.textContent = val;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 600);
}

function updateLiveCellsSched(idx, d, tick, totalTime) {
  const f = Math.min(tick / totalTime, 1);
  if (f < 0.03) return;
  const fin = f >= 0.99;
  const wt  = fin ? d.avg_waiting.toFixed(2)    : (d.avg_waiting    * f).toFixed(2);
  const tat = fin ? d.avg_turnaround.toFixed(2)  : (d.avg_turnaround * f).toFixed(2);
  const rt  = fin ? d.avg_response.toFixed(2)    : (d.avg_response   * f).toFixed(2);
  const cpu = fin ? d.cpu_utilization.toFixed(1) : (d.cpu_utilization* f).toFixed(1);
  // tiles
  flash(`comp-cell-wt-${idx}`,  wt);
  flash(`comp-cell-tat-${idx}`, tat);
  flash(`comp-cell-rt-${idx}`,  rt);
  flash(`comp-cell-cpu-${idx}`, cpu+'%');
  // tabla
  flash(`comp-cell-wt2-${idx}`,  wt);
  flash(`comp-cell-tat2-${idx}`, tat);
  flash(`comp-cell-rt2-${idx}`,  rt);
  flash(`comp-cell-cpu2-${idx}`, cpu+'%');
}

function updateLiveCellsPage(idx, d, step, total) {
  if (step <= 0 || !d.steps) return;
  const now    = d.steps.slice(0, step);
  const faults = now.filter(s => s.fault).length;
  const hr     = ((step - faults) / step * 100).toFixed(1);
  const fr     = (faults / step * 100).toFixed(1);
  flash(`comp-cell-pf-${idx}`, String(faults));
  flash(`comp-cell-hr-${idx}`, hr+'%');
  flash(`comp-cell-pf2-${idx}`, String(faults));
  flash(`comp-cell-hr2-${idx}`, hr);
  flash(`comp-cell-fr2-${idx}`, fr);
}

/* ═══════════════════════════════════════════════════════════════════════
   Controles de playback
   ═══════════════════════════════════════════════════════════════════════ */

function startCompPlay() {
  if (!CompPlayer.renderFn || CompPlayer.playing) return;
  CompPlayer.playing = true;
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-pause"></i> Pausar';
  CompPlayer.lastFrame = performance.now();
  compAnimate();
}

function toggleCompPlay() {
  if (!CompPlayer.renderFn) return;
  if (CompPlayer.playing) {
    CompPlayer.playing = false;
    cancelAnimationFrame(CompPlayer.rafId);
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Reanudar';
  } else {
    if (CompPlayer.currentTick >= CompPlayer.totalTime) CompPlayer.currentTick = 0;
    startCompPlay();
  }
}

function compAnimate(ts) {
  if (!CompPlayer.playing) return;
  ts = ts || performance.now();
  const dt = Math.min((ts - CompPlayer.lastFrame) / 1000, 0.1);
  CompPlayer.lastFrame = ts;
  CompPlayer.currentTick = Math.min(CompPlayer.currentTick + dt * CompPlayer.speed * 2, CompPlayer.totalTime);
  CompPlayer.renderFn();
  if (CompPlayer.currentTick >= CompPlayer.totalTime) {
    CompPlayer.playing = false;
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar';
    // Dibujar gráficas finales
    if (CompPlayer.results) drawAllBarCharts(CompPlayer.results, CompState.category === 'scheduling');
    return;
  }
  CompPlayer.rafId = requestAnimationFrame(compAnimate);
}

function stopCompPlayer() {
  CompPlayer.playing = false;
  cancelAnimationFrame(CompPlayer.rafId);
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Reanudar';
}

function compSeek(t) {
  stopCompPlayer();
  CompPlayer.currentTick = Math.max(0, Math.min(Number(t), CompPlayer.totalTime));
  if (CompPlayer.renderFn) CompPlayer.renderFn();
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Reanudar';
}

function compStep(dir) {
  stopCompPlayer();
  CompPlayer.currentTick = Math.max(0, Math.min(CompPlayer.currentTick + dir, CompPlayer.totalTime));
  if (CompPlayer.renderFn) CompPlayer.renderFn();
}

function setCompSpeed(val) {
  CompPlayer.speed = parseFloat(val);
  const lbl = document.getElementById('comp-speed-label');
  if (lbl) lbl.textContent = parseFloat(val).toFixed(2).replace(/\.?0+$/,'') + 'x';
}

function clearCompResults() {
  stopCompPlayer();
  const r = document.getElementById('comp-results');
  if (r) r.innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════════════════
   Exports + auto-init
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

(function () {
  function tryInit() {
    const grid = document.getElementById('comp-algo-grid');
    if (grid && grid.children.length === 0) initComparison();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const navBtn = document.getElementById('nav-comparison');
    if (navBtn) navBtn.addEventListener('click', tryInit);
    const screen = document.getElementById('screen-comparison');
    if (screen && screen.classList.contains('active')) tryInit();
  });
})();