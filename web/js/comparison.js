/**
 * comparison.js — Algorithm Comparison v5
 *
 * Fixes vs v4:
 *  - Canvas gantt más alto (BAR_H=56, más padding vertical)
 *  - Métricas en vivo NO desaparecen al terminar (bug flash resuelto)
 *  - Gráficas de barras animan en tiempo real (no solo al final)
 *  - Paginación canvas funciona con steps del API
 *  - Análisis comparativo automático generado (quién ganó, ventajas, desventajas)
 *  - Un solo botón Comparar→Pausar→Reanudar→Reiniciar
 */

/* ═══ Metadatos ═══════════════════════════════════════════════════════ */

const SCHEDULING_META = {
  'FCFS':                  { short:'First-Come, First-Served',   formula:'WT = CT−AT−BT  |  TAT = CT−AT  |  RT = 1ª CPU−AT', explanation:'No-preemptivo. Los procesos se ejecutan en el orden exacto de llegada. Puede causar el "efecto convoy" cuando un proceso largo bloquea a todos los cortos que llegaron después.', useCase:'Colas de impresión y sistemas batch donde el orden de llegada es justo.', preemptive:'❌ No preemptivo', starvation:'❌ No hay starvation', complexity:'O(n)' },
  'SJF':                   { short:'Shortest Job First',          formula:'Selección: min(BT disponibles)  |  WT = CT−AT−BT', explanation:'Elige el proceso con menor burst time. Óptimo en WT promedio, pero requiere conocer el burst time de antemano. Los procesos largos pueden quedar bloqueados indefinidamente.', useCase:'Compiladores batch, servidores donde se conoce el tamaño de la tarea de antemano.', preemptive:'❌ No preemptivo', starvation:'⚠️ Puede causar starvation', complexity:'O(n log n)' },
  'HRRN':                  { short:'Highest Response Ratio Next', formula:'RR = (WT_actual + BT) / BT  |  Selección: max(RR)', explanation:'Calcula el Response Ratio de cada proceso. Premia tanto al de burst corto como al que lleva más esperando. Elimina el starvation de forma natural sin mecanismos adicionales.', useCase:'Sistemas mixtos batch/interactivo que necesitan balancear eficiencia y justicia.', preemptive:'❌ No preemptivo', starvation:'✅ No hay starvation', complexity:'O(n) por decisión' },
  'Round Robin':            { short:'Quantum configurable',        formula:'Cada proceso recibe hasta Q unidades  |  espera máx = (n−1)×Q', explanation:'Cada proceso recibe la CPU por un máximo de Q unidades (quantum). Si no termina, regresa al final de la cola. Garantiza que ningún proceso espere más de (n-1)×Q unidades. El quantum óptimo depende del tipo de carga.', useCase:'Sistemas interactivos, terminales SSH, shells de tiempo compartido.', preemptive:'✅ Preemptivo', starvation:'✅ No hay starvation', complexity:'O(1) por decisión' },
  'SRTF':                  { short:'Shortest Remaining Time',     formula:'En cada tick: si llega proceso con menor tiempo restante → preempta  |  min(remaining)', explanation:'Variante preemptiva de SJF. En cada tick compara el tiempo restante de todos los procesos disponibles. Minimiza el tiempo de espera total pero genera más context switches y puede causar starvation severo en procesos largos.', useCase:'Servidores web de alto rendimiento donde se conoce el tamaño de la request.', preemptive:'✅ Preemptivo', starvation:'⚠️ Puede causar starvation', complexity:'O(n) por tick' },
  'Priority (Preemptive)': { short:'Prioridad preemptiva',        formula:'Selección: min(priority)  |  Si llega proceso con mayor prioridad → preempta', explanation:'Siempre ejecuta el proceso de mayor prioridad disponible. Preempta al proceso actual si llega uno de mayor prioridad. Sin mecanismo de aging puede dejar procesos de baja prioridad esperando indefinidamente.', useCase:'Kernels de SO, manejo de interrupciones de hardware, sistemas de tiempo real.', preemptive:'✅ Preemptivo', starvation:'⚠️ Requiere aging para evitar starvation', complexity:'O(log n) con heap' },
  'Multilevel Queue':       { short:'Colas por categoría fija',    formula:'Cola_0 (alta pri) → Cola_1 → Cola_n (baja)  |  proceso no cambia de cola', explanation:'Divide los procesos en colas permanentes por tipo (sistema, interactivo, batch). Cada cola tiene su propio algoritmo interno. Las colas superiores tienen prioridad absoluta sobre las inferiores.', useCase:'SO con clases bien definidas: procesos de sistema, procesos de usuario, procesos batch.', preemptive:'✅ Entre colas', starvation:'⚠️ Colas inferiores pueden quedar bloqueadas', complexity:'O(k×n), k = colas' },
  'MLFQ':                  { short:'Multilevel Feedback Queue',   formula:'Nuevo → Cola_0 (Q corto)  |  agota quantum → baja cola  |  hace I/O → sube cola', explanation:'Los procesos cambian de cola según su comportamiento real. Los CPU-bound bajan de prioridad al agotar su quantum; los I/O-bound se mantienen arriba por ser más interactivos. Aprende el patrón de uso sin necesitar burst times previos.', useCase:'Sistemas de propósito general modernos. Linux CFS y Windows NT comparten estos principios.', preemptive:'✅ Preemptivo', starvation:'✅ Controlado con aging periódico', complexity:'O(k) por decisión' },
};

const PAGING_META = {
  'FIFO':          { short:'First-In, First-Out',        formula:'Evictar: página con más tiempo en memoria (la más antigua)', explanation:'La página que llegó primero es la primera en salir. Simple de implementar con una cola FIFO. Sufre la paradoja de Bélady: añadir más frames puede aumentar los fallos de página.', useCase:'Sistemas embebidos con memoria muy limitada donde la simplicidad de implementación es clave.', belady:'⚠️ Sufre anomalía de Bélady' },
  'LRU':           { short:'Least Recently Used',         formula:'Evictar: min(last_access_time) → página menos usada recientemente', explanation:'Evicta la página que no fue accedida hace más tiempo. Explota el principio de localidad temporal. La aproximación más usada en la práctica; costosa en hardware puro.', useCase:'Linux (approximado con bit de referencia), Windows, la mayoría de SO modernos.', belady:'✅ No sufre anomalía de Bélady' },
  'Optimal':       { short:'Bélady (teórico)',            formula:'Evictar: página que se necesitará más tarde en el futuro (o nunca)', explanation:'Requiere conocer el futuro de la cadena de referencias. Imposible de implementar online. Sirve como benchmark teórico para medir qué tan lejos están los algoritmos reales del óptimo.', useCase:'Evaluación teórica y análisis offline de traces de memoria para comparar algoritmos.', belady:'✅ No sufre anomalía (es el óptimo)' },
  'Clock':         { short:'Reloj circular',              formula:'bit_ref=1 → limpiar y avanzar puntero  |  bit_ref=0 → evictar', explanation:'Puntero circular sobre frames. Da segunda oportunidad a páginas referenciadas recientemente limpiando su bit. Aproxima LRU con O(1) de overhead por sustitución.', useCase:'Linux page daemon (kswapd), implementaciones reales de VM donde el overhead importa.', belady:'✅ No sufre anomalía de Bélady' },
  'Second Chance': { short:'Enhanced Clock con bit dirty', formula:'(R=0,D=0) → evictar  |  (R=0,D=1) → segunda oportunidad  |  (R=1,*) → limpiar R', explanation:'Variante del Clock que añade el bit dirty (modificada). Prioriza evictar páginas no referenciadas y limpias. Reduce el I/O de swap al evitar escribir a disco páginas sucias cuando hay páginas limpias disponibles.', useCase:'Sistemas con alto costo de I/O de swap donde minimizar escrituras a disco es prioritario.', belady:'✅ No sufre anomalía de Bélady' },
};

/* ═══ Paleta Mario ════════════════════════════════════════════════════ */
const MARIO_BLOCK_COLORS = [
  { top:'#FF5E5E', mid:'#E52521', dark:'#8B1010' },
  { top:'#5BAEF2', mid:'#2563EB', dark:'#1E3A7A' },
  { top:'#4DD670', mid:'#10B981', dark:'#065F46' },
  { top:'#FFD65B', mid:'#F59E0B', dark:'#92400E' },
  { top:'#C084FC', mid:'#8B5CF6', dark:'#4C1D95' },
  { top:'#F472B6', mid:'#EC4899', dark:'#831843' },
  { top:'#22D3EE', mid:'#0891B2', dark:'#164E63' },
  { top:'#A3E635', mid:'#65A30D', dark:'#365314' },
];
function marioBlockColor(i) { return MARIO_BLOCK_COLORS[i % MARIO_BLOCK_COLORS.length]; }

/* ═══ Estado ══════════════════════════════════════════════════════════ */
const CompPlayer = {
  results:null, totalTime:0, currentTick:0,
  playing:false, speed:1.0, rafId:null, lastFrame:0,
  category:'scheduling', marios:[], renderFn:null,
  barAnimFrame: 0, barAnimId: null,
};
const CompState = { category:'scheduling', selected:[], numCores:4 };

/* ═══ Init ════════════════════════════════════════════════════════════ */
function initComparison() {
  if (document.getElementById('comp-algo-grid').children.length === 0)
    buildAlgoCards('scheduling');
}

/* ═══ Categoría ═══════════════════════════════════════════════════════ */
function setCompCategory(cat) {
  CompState.category = cat; CompState.selected = [];
  document.getElementById('comp-tab-sched').classList.toggle('active', cat==='scheduling');
  document.getElementById('comp-tab-page').classList.toggle('active',  cat==='paging');
  const max = cat==='scheduling' ? 4 : 5;
  document.getElementById('comp-algo-hint').textContent =
    `Selecciona 2–${max} algoritmos de ${cat==='scheduling'?'scheduling':'paginación'}`;
  document.getElementById('comp-sched-opts').style.display = cat==='scheduling'?'flex':'none';
  document.getElementById('comp-page-opts').style.display  = cat==='paging'    ?'flex':'none';
  buildAlgoCards(cat); clearCompResults(); updateSelCount(); updateCompQuantumVisibility();
  document.getElementById('btn-run-comparison').disabled = true;
}

/* ═══ Tarjetas ════════════════════════════════════════════════════════ */
function buildAlgoCards(cat) {
  const grid = document.getElementById('comp-algo-grid');
  grid.innerHTML = '';
  const meta = cat==='scheduling' ? SCHEDULING_META : PAGING_META;
  Object.entries(meta).forEach(([name, info], i) => {
    const color = PID_COLORS[i % PID_COLORS.length];
    const card  = document.createElement('div');
    card.className = 'comp-algo-card'; card.dataset.name = name;
    const badge = info.preemptive || info.belady || '';
    card.innerHTML = `
      <div style="font-weight:700;font-size:12px;color:var(--text-primary);margin-bottom:3px">${name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:5px;line-height:1.3">${info.short}</div>
      ${badge ? `<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:${color}22;border:1px solid ${color}44;color:${color}">${badge}</span>` : ''}
    `;
    card.addEventListener('click', () => toggleAlgoCard(card, name, color));
    grid.appendChild(card);
  });
}

function toggleAlgoCard(card, name, color) {
  const max = CompState.category==='scheduling' ? 4 : 5;
  const sel = CompState.selected.includes(name);
  if (sel) {
    CompState.selected = CompState.selected.filter(n => n!==name);
    card.style.cssText = '';
  } else {
    if (CompState.selected.length >= max) return;
    CompState.selected.push(name);
    card.style.borderColor = color;
    card.style.background  = color+'18';
    card.style.boxShadow   = `0 0 0 2px ${color}55`;
  }
  updateSelCount();
  if(CompState.category==='scheduling') updateCompQuantumVisibility();
  document.getElementById('btn-run-comparison').disabled = CompState.selected.length < 2;
}

function updateSelCount() {
  const max = CompState.category==='scheduling' ? 4 : 5;
  document.getElementById('comp-sel-count').textContent = `${CompState.selected.length} / ${max} seleccionados`;
}

/* ═══ Quantum visibility — solo para Round Robin y MLFQ ══════════════ */
function updateCompQuantumVisibility(){
  const needsQuantum = CompState.selected.some(n => n==='Round Robin' || n==='MLFQ');
  const el = document.getElementById('comp-quantum-row');
  if(el) el.style.display = needsQuantum ? 'flex' : 'none';
}

function setCompCores(val) {
  CompState.numCores = parseInt(val);
  document.getElementById('comp-cores-label').textContent = `${val} core${val>1?'s':''}`;
}

/* ═══ Ejecutar ════════════════════════════════════════════════════════ */
async function runComparison() {
  if (CompState.selected.length < 2) return;
  if (CompState.category==='scheduling' && AppState.processes.length===0) {
    showToast('Agrega procesos primero en la pantalla de Processes','warning'); return;
  }
  const btn = document.getElementById('btn-run-comparison');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:13px;height:13px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> Ejecutando threads…';
  const log = document.getElementById('comp-thread-log');
  log.textContent = `⚙  ${CompState.selected.length} threads | ${CompState.numCores} core(s)…`;
  clearCompResults(); stopCompPlayer();

  try {
    let apiResults;
    if (CompState.category==='scheduling') {
      const quantum = parseInt(document.getElementById('comp-quantum').value)||2;
      apiResults = await apiCall('/api/schedule/compare-selected', {
        algorithms:CompState.selected, quantum, num_cores:CompState.numCores,
        processes:AppState.processes,
      });
    } else {
      const refRaw = document.getElementById('comp-ref-string').value;
      const refStr = refRaw.split(/[\s,]+/).map(Number).filter(n=>!isNaN(n)&&n>=0);
      const frames = parseInt(document.getElementById('comp-frames').value)||3;
      if (!refStr.length) { showToast('Cadena de referencia inválida','warning'); return; }
      apiResults = await apiCall('/api/page-replacement/compare', {
        algorithms:CompState.selected, reference_string:refStr,
        num_frames:frames, num_cores:CompState.numCores,
      });
    }
    const n = Object.values(apiResults).filter(d=>!d.error).length;
    log.textContent = `✓  ${n} threads completados`;
    showToast(`${n} algoritmos comparados`,'success');
    buildResultUI(apiResults);
    setTimeout(() => { if (CompPlayer.renderFn && !CompPlayer.playing) startCompPlay(); }, 150);
  } catch(err) {
    log.textContent = `❌  ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> ▶ Comparar';
  }
}

/* ═══ UI principal ════════════════════════════════════════════════════ */
function buildResultUI(apiResults) {
  const container = document.getElementById('comp-results');
  const entries   = Object.entries(apiResults).filter(([,d])=>!d.error);
  if (!entries.length) return;
  const isSched = CompState.category==='scheduling';
  const meta    = isSched ? SCHEDULING_META : PAGING_META;

  // Estilos
  if (!document.getElementById('comp-v5-style')) {
    const s = document.createElement('style');
    s.id = 'comp-v5-style';
    s.textContent = `
      .comp-live-cell { transition:color .2s,background .2s; font-size:18px; font-weight:700; color:#fff; }
      .comp-live-cell.flash { color:#6EEB83 !important; background:rgba(110,235,131,.14) !important; }
      .comp-mtile { background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center; }
      .comp-mtile-name { font-size:11px;font-weight:700;margin-bottom:8px; }
      .comp-mtile-grid { display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:left; }
      .comp-mtile-kv { display:flex;flex-direction:column;gap:1px; }
      .comp-mtile-k  { font-size:9px;color:var(--text-muted); }
      .comp-bar-charts { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
      @media(max-width:700px){.comp-bar-charts{grid-template-columns:1fr}}
      .comp-bc-card { background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px; }
      .comp-bc-title { font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px; }
      .comp-analysis { background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px; }
      .comp-analysis h4 { font-size:13px;font-weight:700;color:var(--accent);margin:0 0 10px; }
      .comp-analysis p  { font-size:12px;color:var(--text-secondary);line-height:1.7;margin:0 0 8px; }
      .comp-analysis .winner-badge { display:inline-block;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:700; }
      .comp-analysis ul { margin:6px 0 10px 16px;font-size:12px;color:var(--text-secondary);line-height:1.8; }
    `;
    document.head.appendChild(s);
  }

  // Panel procesos
  let procPanel = '';
  if (isSched && AppState.processes.length>0) {
    const vis = typeof getEffectiveVisibility==='function' ? getEffectiveVisibility() : {threadsVisible:false,forksVisible:false};
    const tiles = AppState.processes.map((p,i)=>{
      const c = PID_COLORS[i%PID_COLORS.length];
      const tb = (vis.threadsVisible&&p.threads&&p.threads.length)
        ? p.threads.map(t=>`<span style="font-size:9px;background:#2563eb33;color:#60a5fa;border:1px solid #3b82f666;border-radius:4px;padding:1px 5px;margin-right:2px">🧵T${t.tid}</span>`).join('') : '';
      const fb = (vis.forksVisible&&p.forks&&p.forks.length)
        ? p.forks.map(f=>`<span style="font-size:9px;background:#10b98133;color:#34d399;border:1px solid #10b98166;border-radius:4px;padding:1px 5px;margin-right:2px">⑂F${f.fid}</span>`).join('') : '';
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 8px;border-radius:8px;border:1.5px solid ${c}55;background:${c}11;width:100%">
        <div style="font-weight:800;font-size:14px;color:${c}">P${p.pid}</div>
        <div style="font-size:9px;color:var(--text-muted)">BT=${p.burst_time} AT=${p.arrival_time}</div>
        <div>${tb}${fb}</div></div>`;
    }).join('');
    procPanel = `<div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px"><i class="ph ph-stack"></i> Procesos en comparación</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px">${tiles}</div>
    </div>`;
  }

  // Gantt
  const ganttHTML = `
    <div class="card" style="margin-bottom:12px" id="comp-gantt-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em"><i class="ph ph-chart-bar"></i> Gantt comparativo en tiempo real</span>
        <span id="comp-tick-label" style="font-size:11px;color:var(--text-muted)">t = 0</span>
      </div>
      <div id="comp-canvas-container" style="position:relative;width:100%;border-radius:8px;overflow:hidden;background:#05050F;border:1px solid rgba(255,255,255,0.07)">
        <canvas id="comp-canvas" style="display:block;width:100%"></canvas>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(0)" title="Reset"><i class="ph ph-skip-back"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(-1)"><i class="ph ph-rewind"></i></button>
        <button class="btn btn-primary" id="comp-btn-play" style="border-radius:24px;padding:7px 24px;font-size:1rem;font-weight:700" onclick="toggleCompPlay()">
          <i class="ph ph-pause"></i> Pausar
        </button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(1)"><i class="ph ph-fast-forward"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(CompPlayer.totalTime)"><i class="ph ph-skip-forward"></i></button>
        <span id="comp-step-counter" style="font-size:12px;color:var(--text-muted);min-width:58px">0 / 0</span>
        <div style="display:flex;align-items:center;gap:6px;margin-left:4px">
          <label for="comp-speed" style="font-size:11px;color:var(--text-muted)">Velocidad</label>
          <input type="range" id="comp-speed" min="0.25" max="4" step="0.25" value="1" style="width:76px" oninput="setCompSpeed(this.value)">
          <span id="comp-speed-label" style="font-size:11px;font-weight:600;background:rgba(255,255,255,.12);padding:2px 7px;border-radius:6px;color:#fff;border:1px solid rgba(255,255,255,.16)">1x</span>
        </div>
      </div>
    </div>`;
  // Análisis comparativo (generado dinámicamente al final)
  const analysisHTML = `<div id="comp-analysis-section" style="margin-bottom:12px"></div>`;


  // ── 3 gráficas de barras debajo de la tabla ─────────────────────────────
  const bcDefs = isSched
    ? [
        { id:'cbc-wt',  title:'Avg Waiting Time',    unit:'ms',  higher:false },
        { id:'cbc-tat', title:'Avg Turnaround Time',  unit:'ms',  higher:false },
        { id:'cbc-cpu', title:'CPU Utilization',      unit:'%',   higher:true  },
      ]
    : [
        { id:'cbc-pf',  title:'Page Faults',          unit:'',    higher:false },
        { id:'cbc-hr',  title:'Hit Rate',              unit:'%',   higher:true  },
        { id:'cbc-fr',  title:'Fault Rate',            unit:'%',   higher:false },
      ];

  const barChartsHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
        <i class="ph ph-chart-bar"></i> Comparación visual
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${bcDefs.map(bc=>`
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-align:center">${bc.title}</div>
            <div style="position:relative;height:300px">
              <canvas id="${bc.id}" style="width:100%;height:300px;border-radius:6px"></canvas>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Tabla mejorada con fórmulas, live-fill, fila de avg y ganador ─────────
  const formulaBar = isSched
    ? `<div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;padding:6px 10px;background:rgba(110,235,131,.06);border-radius:6px;border-left:3px solid var(--accent);line-height:1.8">
        📐 <strong>Fórmulas:</strong>
        WT = CT − AT − BT &nbsp;|&nbsp;
        TAT = CT − AT &nbsp;|&nbsp;
        RT = 1ª CPU − AT &nbsp;|&nbsp;
        CPU% = Tiempo_ocupado / Tiempo_total × 100 &nbsp;|&nbsp;
        Ctx Sw = cambios de proceso en CPU
      </div>`
    : `<div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;padding:6px 10px;background:rgba(110,235,131,.06);border-radius:6px;border-left:3px solid var(--accent);line-height:1.8">
        📐 <strong>Fórmulas:</strong>
        Page Fault Rate = Fallos / Longitud_cadena × 100 &nbsp;|&nbsp;
        Hit Rate = (Hits / Longitud_cadena) × 100 &nbsp;|&nbsp;
        Hit = página ya en memoria, evita acceso a disco
      </div>`;

  const schedHdrs = [
    `Algoritmo`,
    `Core`,
    `Avg WT<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(CT−AT−BT)</span>`,
    `Avg TAT<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(CT−AT)</span>`,
    `Avg RT<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(1ªCPU−AT)</span>`,
    `CPU %<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(ocupado/total)</span>`,
    `Ctx Sw`,
    `Sim ms`,
  ];
  const pageHdrs = [
    `Algoritmo`, `Core`,
    `Page Faults<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(accesos a disco)</span>`,
    `Hit Rate %<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(100−FaultRate)</span>`,
    `Fault Rate %<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(fallos/total×100)</span>`,
    `Frames`, `Sim ms`,
  ];
  const hdrs = isSched ? schedHdrs : pageHdrs;

  const tableRows = entries.map(([name,d],i)=>{
    const c = PID_COLORS[i%PID_COLORS.length];
    return isSched
      ? `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td style="color:var(--text-muted);font-size:11px">Core ${i%CompState.numCores}</td>
          <td id="ct-wt-${i}"  class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-tat-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-rt-${i}"  class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-cpu-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td style="text-align:center;color:var(--text-muted)">${d.context_switches??'—'}</td>
          <td style="text-align:center;color:var(--text-muted);font-size:11px">${d.elapsed_ms!=null?d.elapsed_ms.toFixed(1):'—'}</td>
        </tr>`
      : `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td style="color:var(--text-muted);font-size:11px">Core ${i%CompState.numCores}</td>
          <td id="ct-pf-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-hr-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-fr-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td style="text-align:center;color:var(--text-muted)">${d.num_frames??'—'}</td>
          <td style="text-align:center;color:var(--text-muted);font-size:11px">${d.elapsed_ms!=null?d.elapsed_ms.toFixed(1):'—'}</td>
        </tr>`;
  }).join('');

  // Filas de promedio y ganador (se rellenan cuando termina la animación)
  const avgRow = isSched
    ? `<tr id="comp-avg-row" style="background:rgba(110,235,131,.06);font-style:italic;display:none">
        <td style="font-size:11px;font-weight:700;color:var(--text-secondary)">Promedio</td>
        <td>—</td>
        <td id="avg-wt"  style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-tat" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-rt"  style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-cpu" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td>—</td><td>—</td>
      </tr>
      <tr id="comp-winner-row" style="display:none">
        <td colspan="8" id="comp-winner-cell" style="text-align:center;padding:8px;font-size:12px;border-top:1px solid var(--border)"></td>
      </tr>`
    : `<tr id="comp-avg-row" style="background:rgba(110,235,131,.06);font-style:italic;display:none">
        <td style="font-size:11px;font-weight:700;color:var(--text-secondary)">Promedio</td>
        <td>—</td>
        <td id="avg-pf" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-hr" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-fr" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td>—</td><td>—</td>
      </tr>
      <tr id="comp-winner-row" style="display:none">
        <td colspan="7" id="comp-winner-cell" style="text-align:center;padding:8px;font-size:12px;border-top:1px solid var(--border)"></td>
      </tr>`;

  const tableHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px"><i class="ph ph-clipboard-text"></i> Tabla de métricas</div>
      ${formulaBar}
      <div class="table-wrapper"><table>
        <thead><tr>${hdrs.map(h=>`<th style="font-size:11px">${h}</th>`).join('')}</tr></thead>
        <tbody id="comp-tbody">${tableRows}${avgRow}</tbody>
      </table></div>
      <div id="comp-process-subtables" style="margin-top:16px"></div>
    </div>`;

  // Explicaciones
  const explHTML = `
    <div class="card">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px"><i class="ph ph-lightbulb"></i> Algoritmos: fórmulas, análisis y casos de uso</div>
      ${entries.map(([name],i)=>{
        const m = meta[name]; if (!m) return '';
        const c = PID_COLORS[i%PID_COLORS.length];
        const b1 = m.preemptive ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.preemptive}</span>` : '';
        const b2 = m.starvation ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.starvation}</span>` : '';
        const b3 = m.complexity ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.complexity}</span>` : '';
        const b4 = m.belady     ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.belady}</span>` : '';
        return `<div style="border-left:3px solid ${c};padding:10px 14px;margin-bottom:10px;background:var(--bg-surface);border-radius:0 8px 8px 0">
          <div style="font-weight:700;font-size:13px;color:${c};margin-bottom:3px">${name} <span style="font-weight:400;color:var(--text-secondary)">— ${m.short}</span></div>
          <div style="font-size:10px;color:var(--text-muted);font-family:monospace;margin-bottom:6px;padding:4px 8px;background:rgba(255,255,255,.04);border-radius:4px">${m.formula}</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.65;margin-bottom:6px">${m.explanation}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">${b1}${b2}${b3}${b4}</div>
          <div style="font-size:11px;color:var(--text-muted)">💡 <em>${m.useCase}</em></div>
        </div>`;
      }).join('')}
    </div>`;

  container.innerHTML = procPanel + ganttHTML + tableHTML + barChartsHTML + analysisHTML + explHTML;

  buildProcessSubtables(entries, isSched);
  initCompCanvas(entries);
  startBarChartAnimation(entries, isSched);
}

/* ═══ Canvas Gantt (estilo Mario) ════════════════════════════════════ */
const COMP_BAR_H   = 70;
const COMP_ROW_GAP = 28;
const COMP_LEFT    = 148;
const COMP_TOP     = 46;
const COMP_BOTTOM  = 52;
const CMS = 2; // Mario sprite scale
const CMW = 16*CMS, CMH = 16*CMS;

function initCompCanvas(entries) {
  const isSched = CompState.category==='scheduling';
  const canvas  = document.getElementById('comp-canvas');
  const cont    = document.getElementById('comp-canvas-container');
  if (!canvas||!cont) return;

  const n = entries.length;
  const height = COMP_TOP + n*(COMP_BAR_H+COMP_ROW_GAP) + COMP_BOTTOM + 44;
  const dpr = window.devicePixelRatio||1;
  const cw  = cont.clientWidth||900;

  canvas.width  = cw*dpr; canvas.height = height*dpr;
  canvas.style.height = height+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  let totalTime = 1;
  if (isSched) {
    entries.forEach(([,d])=>{ if (d.gantt&&d.gantt.length) totalTime=Math.max(totalTime,Math.max(...d.gantt.map(e=>e.end))); });
  } else {
    entries.forEach(([,d])=>{ if (d.ref_length) totalTime=Math.max(totalTime,d.ref_length); });
  }

  CompPlayer.marios = entries.map(()=>({ x:COMP_LEFT,y:0,frame:0,frameTimer:0,jumping:false,jumpVel:0,baseY:0,lastBlock:null,visible:false }));
  CompPlayer.results  = entries;
  CompPlayer.totalTime = totalTime;
  CompPlayer.currentTick = 0;
  CompPlayer.category = CompState.category;
  document.getElementById('comp-step-counter').textContent = `0 / ${totalTime}`;

  const scale = (cw - COMP_LEFT - 28) / totalTime;

  function drawIdleBlock(ctx, x, y, w, h) {
  if (w <= 1) return;
  // Fondo gris oscuro
  ctx.fillStyle = 'rgba(60,60,80,0.55)';
  roundRect(ctx, x, y, w, h, 4); ctx.fill();
  // Borde punteado
  ctx.save();
  ctx.strokeStyle = 'rgba(150,150,180,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  roundRect(ctx, x+0.5, y+0.5, w-1, h-1, 4); ctx.stroke();
  ctx.setLineDash([]);
  // Hatch diagonal (estilo "no disponible")
  ctx.strokeStyle = 'rgba(120,120,150,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 8;
  for (let d2 = -h; d2 < w + h; d2 += step) {
    ctx.moveTo(x + d2, y);
    ctx.lineTo(x + d2 + h, y + h);
  }
  ctx.stroke();
  ctx.restore();
  // Etiqueta IDLE si hay espacio
  if (w > 28) {
    ctx.fillStyle = 'rgba(160,160,190,0.65)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IDLE', x + w / 2, y + h / 2 + 3);
  }
}

function drawMarioBlock(ctx, x, y, w, h, pidIdx) {
    if (w<=0) return;
    const c = marioBlockColor(pidIdx);
    // Sombra
    ctx.fillStyle='rgba(0,0,0,0.3)';
    roundRect(ctx,x+2,y+3,w,h,5); ctx.fill();
    // Gradiente 3D
    const g = ctx.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,c.top); g.addColorStop(0.45,c.mid); g.addColorStop(1,c.dark);
    ctx.fillStyle=g; roundRect(ctx,x,y,w,h,5); ctx.fill();
    // Brillo superior
    ctx.fillStyle='rgba(255,255,255,0.2)';
    roundRect(ctx,x+2,y+2,w-4,h*0.28,3); ctx.fill();
    // Borde inferior oscuro
    ctx.fillStyle=c.dark+'cc';
    roundRect(ctx,x+1,y+h-5,w-2,5,[0,0,5,5]); ctx.fill();
    // Etiqueta PID
    if (w>20) {
      const fs = Math.min(10,Math.max(7,w/5));
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.font=`bold ${fs}px "Press Start 2P",monospace`;
      ctx.textAlign='center';
      ctx.fillText(`P${pidIdx}`,x+w/2,y+h/2+fs*0.35);
    }
  }

  function render() {
    const tick = CompPlayer.currentTick;
    const axisY = COMP_TOP + n*(COMP_BAR_H+COMP_ROW_GAP);

    ctx.clearRect(0,0,cw,height);

    // Fondo
    const bg = ctx.createLinearGradient(0,0,0,height);
    bg.addColorStop(0,'#03030E'); bg.addColorStop(1,'#070720');
    ctx.fillStyle=bg; ctx.fillRect(0,0,cw,height);

    // Estrellas pixel
    ctx.fillStyle='rgba(255,255,255,0.4)';
    [[28,7],[85,13],[170,5],[255,11],[360,4],[450,17],[530,8],[640,13],[750,6],[860,10]].forEach(([sx,sy])=>{ if(sx<cw)ctx.fillRect(sx,sy,2,2); });

    // Columnas verticales suaves
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1; ctx.setLineDash([1,4]);
    for(let t=0;t<=totalTime;t++){const x=COMP_LEFT+t*scale;ctx.beginPath();ctx.moveTo(x,COMP_TOP);ctx.lineTo(x,axisY);ctx.stroke();}
    ctx.setLineDash([]);

    entries.forEach(([name,d],idx)=>{
      const rowY = COMP_TOP + idx*(COMP_BAR_H+COMP_ROW_GAP);
      const mario = CompPlayer.marios[idx];
      const color = PID_COLORS[idx%PID_COLORS.length];

      // Fondo fila
      ctx.fillStyle='rgba(255,255,255,0.015)';
      roundRect(ctx,COMP_LEFT-2,rowY-2,cw-COMP_LEFT-18,COMP_BAR_H+4,6); ctx.fill();

      // Label izquierdo
      ctx.font='bold 11px "Inter",sans-serif'; ctx.textAlign='right'; ctx.fillStyle=color;
      const lbl=name.length>13?name.slice(0,12)+'…':name;
      ctx.fillText(lbl,COMP_LEFT-12,rowY+COMP_BAR_H/2+4);
      // Número de orden
      ctx.fillStyle=color+'33'; roundRect(ctx,COMP_LEFT-136,rowY+COMP_BAR_H/2-10,20,20,10); ctx.fill();
      ctx.fillStyle=color; ctx.font='bold 10px monospace'; ctx.textAlign='center';
      ctx.fillText(idx+1,COMP_LEFT-126,rowY+COMP_BAR_H/2+4);

      if (isSched) {
        // Barra base
        ctx.fillStyle='rgba(255,255,255,0.025)';
        roundRect(ctx,COMP_LEFT,rowY,cw-COMP_LEFT-28,COMP_BAR_H,5); ctx.fill();

        (d.gantt||[]).forEach(entry=>{
          const x=COMP_LEFT+entry.start*scale;
          if (entry.end<=tick) {
            const bw=(entry.end-entry.start)*scale;
            if(entry.pid<0){ drawIdleBlock(ctx,x,rowY,bw,COMP_BAR_H); }
            else drawMarioBlock(ctx,x,rowY,bw,COMP_BAR_H,entry.pid);
          } else if (entry.start<tick) {
            const bw=(tick-entry.start)*scale;
            if(entry.pid<0){ ctx.globalAlpha=0.5; drawIdleBlock(ctx,x,rowY,bw,COMP_BAR_H); ctx.globalAlpha=1; }
            else{ctx.globalAlpha=0.55;drawMarioBlock(ctx,x,rowY,bw,COMP_BAR_H,entry.pid);ctx.globalAlpha=1;}
          }
        });

        // Piso Mario
        ctx.fillStyle='#2A0F00'; ctx.fillRect(COMP_LEFT,rowY+COMP_BAR_H,cw-COMP_LEFT-28,4);
        ctx.fillStyle='#4A1A00'; ctx.fillRect(COMP_LEFT,rowY+COMP_BAR_H+1,cw-COMP_LEFT-28,2);

        // Mario
        updateCompMario(mario,idx,d.gantt,tick,scale,rowY);
        if(mario.visible&&typeof MARIO_SPRITE_FRAMES!=='undefined')
          drawCompMarioSprite(ctx,mario.x,mario.y,mario.jumping,mario.frame);

        updateLiveCellsSched(idx,d,tick,totalTime);

      } else {
        // Paginación
        const steps=d.steps||[];
        const visN=Math.min(Math.floor(tick),steps.length);
        const bMaxW=cw-COMP_LEFT-28;
        const sw=steps.length>0?bMaxW/steps.length:bMaxW;

        ctx.fillStyle='rgba(255,255,255,.02)';
        roundRect(ctx,COMP_LEFT,rowY,bMaxW,COMP_BAR_H,5); ctx.fill();

        for(let s=0;s<visN;s++){
          const st=steps[s];
          const x=COMP_LEFT+s*sw;
          if(st.fault) drawMarioBlock(ctx,x,rowY,sw-1,COMP_BAR_H,0);
          else{
            ctx.fillStyle='#10B98166'; roundRect(ctx,x,rowY,sw-1,COMP_BAR_H,3); ctx.fill();
            if(sw>12){ctx.fillStyle='#6ee7b7';ctx.font=`${Math.min(9,sw*.5)}px monospace`;ctx.textAlign='center';ctx.fillText(st.page_requested,x+sw/2,rowY+COMP_BAR_H/2+4);}
          }
          // Número de frame
          if(sw>8){
            const fa=st.frames_after||[];
            ctx.fillStyle='rgba(255,255,255,.25)';
            ctx.font='7px monospace'; ctx.textAlign='center';
            fa.slice(0,3).forEach((f,fi)=>{if(f!=null)ctx.fillText(f,x+sw/2,rowY+COMP_BAR_H-10+(fi-1)*8);});
          }
        }

        // Piso
        ctx.fillStyle='#2A0F00'; ctx.fillRect(COMP_LEFT,rowY+COMP_BAR_H,bMaxW,4);

        // Mario sobre los pasos
        if(visN>0&&typeof MARIO_SPRITE_FRAMES!=='undefined'){
          const mX=COMP_LEFT+(visN-0.5)*sw-CMW/2;
          const mY=rowY-CMH-2;
          mario.frame=Math.floor(tick*5)%4;
          drawCompMarioSprite(ctx,mX,mY,false,mario.frame);
        }

        updateLiveCellsPage(idx,d,Math.floor(tick),steps.length);
      }
    });

    // Eje X
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(COMP_LEFT,axisY+8); ctx.lineTo(cw-20,axisY+8); ctx.stroke();

    // Ticks tiempo
    const step=Math.max(1,Math.round(totalTime/12));
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='9px "JetBrains Mono",monospace'; ctx.textAlign='center';
    for(let t=0;t<=totalTime;t+=step){
      const x=COMP_LEFT+t*scale;
      ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(x,axisY+6); ctx.lineTo(x,axisY+12); ctx.stroke();
      ctx.fillText(t,x,axisY+25);
    }

    // Cursor neón
    const cx2=COMP_LEFT+tick*scale;
    ctx.save(); ctx.shadowColor='#6EEB83'; ctx.shadowBlur=10;
    ctx.strokeStyle='#6EEB83'; ctx.lineWidth=2; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx2,0); ctx.lineTo(cx2,axisY+4); ctx.stroke();
    ctx.restore(); ctx.setLineDash([]);

    document.getElementById('comp-tick-label').textContent=`t = ${tick.toFixed(1)}`;
    document.getElementById('comp-step-counter').textContent=`${Math.round(tick)} / ${totalTime}`;
  }

  CompPlayer.renderFn = render;
  render();
}

/* ═══ Mario helpers ════════════════════════════════════════════════════ */
function updateCompMario(mario,idx,gantt,tick,scale,rowY){
  const real=(gantt||[]).filter(e=>e.pid>=0);
  if(!real.length||tick<=0){mario.visible=false;return;}
  mario.visible=true;
  let running=null;
  for(const e of real){if(tick>e.start&&tick<=e.end){running=e;break;}}
  const tx=running?COMP_LEFT+Math.min(running.end,tick)*scale-CMW/2:COMP_LEFT+tick*scale-CMW/2;
  mario.x+=(tx-mario.x)*.18;
  mario.baseY=rowY-CMH-2;
  if(running&&running.pid!==mario.lastBlock&&mario.lastBlock!==null&&!mario.jumping){mario.jumping=true;mario.jumpVel=-95;}
  if(running)mario.lastBlock=running.pid;
  const dt=1/60;
  if(mario.jumping){mario.y+=mario.jumpVel*dt;mario.jumpVel+=290*dt;if(mario.y>=mario.baseY){mario.y=mario.baseY;mario.jumping=false;mario.jumpVel=0;}}
  else{mario.y=mario.baseY;mario.frameTimer=(mario.frameTimer||0)+dt;if(mario.frameTimer>=0.12){mario.frameTimer=0;mario.frame=(mario.frame+1)%4;}}
}

function drawCompMarioSprite(ctx,mx,my,jumping,frame){
  if(typeof MARIO_SPRITE_FRAMES==='undefined')return;
  const keys=typeof MARIO_RUN_KEYS!=='undefined'?MARIO_RUN_KEYS:['stand','run1','run2','run1'];
  const key=jumping?'jump':keys[frame%4];
  const grid=MARIO_SPRITE_FRAMES[key]||MARIO_SPRITE_FRAMES.stand;
  const s=CMS;
  for(let r=0;r<16;r++)for(let c=0;c<16;c++){const col=grid[r][c];if(col===null)continue;ctx.fillStyle=col;ctx.fillRect(Math.round(mx+c*s),Math.round(my+r*s),s,s);}
}

function roundRect(ctx,x,y,w,h,r){
  if(Array.isArray(r)){
    const[tl,tr,br,bl]=r.map(v=>Math.max(0,v));
    ctx.beginPath();ctx.moveTo(x+tl,y);ctx.lineTo(x+w-tr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+tr);ctx.lineTo(x+w,y+h-br);ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);ctx.lineTo(x+bl,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-bl);ctx.lineTo(x,y+tl);ctx.quadraticCurveTo(x,y,x+tl,y);ctx.closePath();return;
  }
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

/* ═══ Celdas en vivo (FIX: no borrar al terminar) ════════════════════ */
function flashCell(id, val){
  const el=document.getElementById(id); if(!el)return;
  if(el.dataset.finalVal===val)return; // evitar re-render innecesario
  el.textContent=val;
  if(el.dataset.locked)return; // ya terminó, no flashear más
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'),500);
}

function lockCell(id, val){
  const el=document.getElementById(id); if(!el)return;
  el.textContent=val;
  el.dataset.finalVal=val;
  el.dataset.locked='1';
  el.style.color='var(--text-primary)';
}

function updateLiveCellsSched(idx,d,tick,totalTime){
  const f=Math.min(tick/totalTime,1);
  if(f<0.02)return;
  const fin=f>=0.99;
  const wt =fin?d.avg_waiting.toFixed(2)   :(d.avg_waiting   *f).toFixed(2);
  const tat=fin?d.avg_turnaround.toFixed(2):(d.avg_turnaround*f).toFixed(2);
  const rt =fin?d.avg_response.toFixed(2)  :(d.avg_response  *f).toFixed(2);
  const cpu=fin?d.cpu_utilization.toFixed(1)+'%':(d.cpu_utilization*f).toFixed(1)+'%';
  if(fin){
    lockCell(`ct-wt-${idx}`, wt); lockCell(`ct-tat-${idx}`, tat);
    lockCell(`ct-rt-${idx}`, rt); lockCell(`ct-cpu-${idx}`, cpu);
  } else {
    flashCell(`ct-wt-${idx}`, wt); flashCell(`ct-tat-${idx}`, tat);
    flashCell(`ct-rt-${idx}`, rt); flashCell(`ct-cpu-${idx}`, cpu);
    // Negrita en vivo: el que lleva menor WT hasta ahora
    highlightLiveWinner(idx, parseFloat(wt));
  }

  // Actualizar subtablas en tiempo real
  if(CompPlayer.results)
    updateSubtablesLive(CompPlayer.results, tick, totalTime);
}

// Resalta en tiempo real el algoritmo con menor WT hasta ahora
const _liveWT = {};
function highlightLiveWinner(idx, wt){
  _liveWT[idx] = wt;
  const vals = Object.values(_liveWT);
  if(vals.length < 2) return;
  const minVal = Math.min(...vals);
  Object.entries(_liveWT).forEach(([i, v])=>{
    const el = document.getElementById(`ct-wt-${i}`);
    if(!el) return;
    if(v === minVal){
      el.style.fontWeight = '800';
      el.style.textDecoration = 'underline';
    } else {
      el.style.fontWeight = '400';
      el.style.textDecoration = 'none';
    }
  });
}

function updateLiveCellsPage(idx,d,step,total){
  if(step<=0||!d.steps)return;
  const now=d.steps.slice(0,step);
  const faults=now.filter(s=>s.fault).length;
  const hr=((step-faults)/step*100).toFixed(1)+'%';
  const fr=(faults/step*100).toFixed(1)+'%';
  const fin=step>=total;
  if(fin){
    lockCell(`cv-pf-${idx}`,String(faults)); lockCell(`cv-hr-${idx}`,hr);
    lockCell(`cv-fr-${idx}`,fr);
    lockCell(`ct-pf-${idx}`,String(faults)); lockCell(`ct-hr-${idx}`,hr.replace('%',''));
    lockCell(`ct-fr-${idx}`,fr.replace('%',''));
  } else {
    flashCell(`cv-pf-${idx}`,String(faults)); flashCell(`cv-hr-${idx}`,hr);
    flashCell(`cv-fr-${idx}`,fr);
    flashCell(`ct-pf-${idx}`,String(faults)); flashCell(`ct-hr-${idx}`,hr.replace('%',''));
    flashCell(`ct-fr-${idx}`,fr.replace('%',''));
  }
}

/* ═══ Gráficas de barras animadas en tiempo real ══════════════════════ */
const _barState = {}; // { [canvasId]: { current: [], target: [] } }

function startBarChartAnimation(entries, isSched){
  cancelAnimationFrame(CompPlayer.barAnimId);

  const bcDefs = isSched
    ? [
        { id:'cbc-wt',  fn: (d,f)=>d.avg_waiting*f,        higher:false },
        { id:'cbc-tat', fn: (d,f)=>d.avg_turnaround*f,     higher:false },
        { id:'cbc-cpu', fn: (d,f)=>d.cpu_utilization*f,    higher:true  },
      ]
    : [
        { id:'cbc-pf',  fn: (d,f)=>(d.total_faults||0)*f,  higher:false },
        { id:'cbc-hr',  fn: (d,f)=>(d.hit_rate||0)*f,       higher:true  },
        { id:'cbc-fr',  fn: (d,f)=>(d.fault_rate||0)*f,     higher:false },
      ];

  const names = entries.map(([n])=>n);

  function loopDraw(){
    const frac = CompPlayer.totalTime>0 ? Math.min(CompPlayer.currentTick/CompPlayer.totalTime,1) : 0;
    bcDefs.forEach(bc=>{
      const vals = entries.map(([,d])=>bc.fn(d,frac));
      const nMax1 = Math.max(...entries.map(([,d])=>bc.fn(d,1)), 0.001) * 1.18;
      drawBarChartMario(bc.id, names, vals, bc.higher, nMax1);
    });
    if(CompPlayer.playing || frac<1){
      CompPlayer.barAnimId = requestAnimationFrame(loopDraw);
    } else {
      // Final: valores reales
      bcDefs.forEach(bc=>{
        const vals = entries.map(([,d])=>bc.fn(d,1));
        const nMaxF = Math.max(...entries.map(([,d])=>bc.fn(d,1)), 0.001) * 1.18;
        drawBarChartMario(bc.id, names, vals, bc.higher, nMaxF);
      });
      generateAnalysis(entries, isSched);
    }
  }
  loopDraw();
}

function drawBarChartMario(canvasId, labels, values, higherIsBetter, nMax){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.clientWidth || 280;
  const H = 300;
  canvas.width  = W;
  canvas.height = H;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const YAXIS  = 46;   // espacio eje Y izquierdo
  const R      = 12;   // margen derecho
  const TOP    = 40;   // espacio número arriba
  const BOTTOM = 64;   // espacio nombre + ★ abajo
  const chartH = H - TOP - BOTTOM;
  const plotW  = W - YAXIS - R;
  if(!nMax || nMax <= 0) nMax = Math.max(...values, 0.001) * 1.18;

  ctx.clearRect(0, 0, W, H);

  // Fondo — mismo tono oscuro del proyecto
  ctx.fillStyle = 'rgba(14,12,32,0.96)';
  ctx.fillRect(0, 0, W, H);

  // Borde sutil alrededor del área de gráfica
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(YAXIS, TOP, plotW, chartH);

  // ── Eje Y: líneas guía + etiquetas ──────────────────────────────────
  ctx.save();
  for (let i = 0; i <= 5; i++) {
    const pct = i / 5;
    const y   = TOP + chartH * (1 - pct);
    const val = (nMax / 1.18) * pct; // valor real (sin el 1.18 de padding)

    // Línea guía
    ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = i === 0 ? 1.5 : 1;
    ctx.setLineDash(i === 0 ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(YAXIS, y);
    ctx.lineTo(W - R, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta numérica
    ctx.fillStyle    = 'rgba(255,255,255,0.35)';
    ctx.font         = '9px "JetBrains Mono", monospace';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val >= 10 ? val.toFixed(1) : val.toFixed(2), YAXIS - 5, y);
  }
  // Línea vertical del eje
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(YAXIS, TOP);
  ctx.lineTo(YAXIS, TOP + chartH);
  ctx.stroke();
  ctx.restore();

  // ── Barras ───────────────────────────────────────────────────────────
  const n    = labels.length;
  const gap  = Math.max(10, plotW * 0.07);
  const bw   = Math.max(28, (plotW - gap * (n + 1)) / n);
  const totalBarsW = n * bw + gap * (n + 1);
  const startX     = YAXIS + (plotW - totalBarsW) / 2 + gap;

  const isWinner = (v) =>
    higherIsBetter ? v === Math.max(...values) : v === Math.min(...values);

  values.forEach((v, i) => {
    const x    = startX + i * (bw + gap);
    const barH = Math.max((v / nMax) * chartH, v > 0 ? 4 : 0);
    const y    = TOP + chartH - barH;
    const c    = marioBlockColor(i);
    const win  = isWinner(v);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, x + 2, y + 3, bw, barH, 6);
    ctx.fill();

    // Gradiente 3D Mario
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0,   c.top);
    grad.addColorStop(0.5, c.mid);
    grad.addColorStop(1,   c.dark);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, bw, barH, 6);
    ctx.fill();

    // Brillo superior
    if (barH > 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, x + 3, y + 3, bw - 6, Math.min(barH * 0.25, 10), 3);
      ctx.fill();
    }

    // Borde dorado ganador + glow
    if (win) {
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur  = 12;
      roundRect(ctx, x - 1.5, y - 1.5, bw + 3, barH + 3, 7);
      ctx.stroke();
      ctx.restore();
    }

    // ── Número encima de la barra ──────────────────────────────────────
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    if (win) {
      ctx.font      = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFD700';
      // Pequeño pill de fondo
      const tw = ctx.measureText(v.toFixed(1)).width;
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      roundRect(ctx, x + bw/2 - tw/2 - 6, y - 28, tw + 12, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.font      = 'bold 15px "JetBrains Mono", monospace';
    } else {
      ctx.font      = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
    }
    ctx.fillText(v.toFixed(1), x + bw / 2, y - 8);
    ctx.restore();

    // ── Nombre del algoritmo (hasta 2 líneas, word-wrap) ──────────────
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const maxLW  = bw + gap * 0.5;
    const words  = labels[i].split(/\s+/);
    const lines  = [];
    let cur = '';
    ctx.font = '11px "Inter", sans-serif';
    words.forEach(w => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width <= maxLW) cur = test;
      else { if (cur) lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    const nameLines = lines.slice(0, 2);
    const baseY = TOP + chartH + 10;

    nameLines.forEach((ln, li) => {
      ctx.font      = win ? 'bold 11px "Inter", sans-serif' : '11px "Inter", sans-serif';
      ctx.fillStyle = win ? c.top : 'rgba(255,255,255,0.7)';
      ctx.fillText(ln, x + bw / 2, baseY + li * 14);
    });

    if (win) {
      ctx.font      = 'bold 10px "Inter", sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('★ MEJOR', x + bw / 2, baseY + nameLines.length * 14 + 3);
    }
    ctx.restore();
  });
}

/* ═══ Análisis comparativo automático ════════════════════════════════ */
function generateAnalysis(entries, isSched){
  const section=document.getElementById('comp-analysis-section');
  if(!section)return;

  if(isSched){
    const sorted_wt  = [...entries].sort((a,b)=>a[1].avg_waiting   -b[1].avg_waiting);
    const sorted_cpu = [...entries].sort((a,b)=>b[1].cpu_utilization-a[1].cpu_utilization);
    const sorted_ctx = [...entries].sort((a,b)=>(a[1].context_switches||0)-(b[1].context_switches||0));
    const best_wt=sorted_wt[0], worst_wt=sorted_wt[sorted_wt.length-1];
    const best_cpu=sorted_cpu[0], best_ctx=sorted_ctx[0], worst_ctx=sorted_ctx[sorted_ctx.length-1];
    const c_bwt =PID_COLORS[entries.findIndex(([n])=>n===best_wt[0]) %PID_COLORS.length];
    const c_bcpu=PID_COLORS[entries.findIndex(([n])=>n===best_cpu[0])%PID_COLORS.length];
    const wtDiff=best_wt[1].avg_waiting>0?((worst_wt[1].avg_waiting-best_wt[1].avg_waiting)/best_wt[1].avg_waiting*100).toFixed(0):0;

    section.innerHTML=`<div class="comp-analysis">
      <h4>🏆 Análisis comparativo de resultados</h4>
      <p><strong>Menor Waiting Time:</strong>
        <span class="winner-badge" style="background:${c_bwt}22;border:1px solid ${c_bwt}55;color:${c_bwt}">★ ${best_wt[0]} — ${best_wt[1].avg_waiting.toFixed(2)} ms</span>
        ${worst_wt[0]!==best_wt[0]?` vs <strong>${worst_wt[0]}</strong> (${worst_wt[1].avg_waiting.toFixed(2)} ms). Diferencia: <strong>${wtDiff}%</strong>.`:''}
      </p>
      <p><strong>Mayor utilización de CPU:</strong>
        <span class="winner-badge" style="background:${c_bcpu}22;border:1px solid ${c_bcpu}55;color:${c_bcpu}">★ ${best_cpu[0]} — ${best_cpu[1].cpu_utilization.toFixed(1)}%</span>
        A mayor CPU%, menos tiempo ocioso. Los algoritmos preemptivos tienden a mantener la CPU más ocupada.
      </p>
      <p><strong>Menos context switches:</strong> <strong>${best_ctx[0]}</strong> (${best_ctx[1].context_switches||0}) vs <strong>${worst_ctx[0]}</strong> (${worst_ctx[1].context_switches||0}). Los context switches tienen costo real de hardware.</p>
      <p><strong>Ventajas y desventajas:</strong></p>
      <ul>${entries.map(([name,d])=>{
        const m=SCHEDULING_META[name];if(!m)return'';
        const isWinWT=name===best_wt[0],isWinCPU=name===best_cpu[0];
        return`<li><strong>${name}</strong> — WT: ${d.avg_waiting.toFixed(2)}, CPU: ${d.cpu_utilization.toFixed(1)}%, Ctx Sw: ${d.context_switches||0}.
          ${isWinWT?'✅ Mejor tiempo de espera. ':''} ${isWinCPU?'✅ Mejor uso de CPU. ':''}
          ${m.starvation&&m.starvation.includes('⚠️')?'⚠️ Puede causar starvation. ':''}
          ${m.preemptive&&m.preemptive.includes('❌')?'Bajo overhead (no preemptivo). ':''}
        </li>`;
      }).join('')}</ul>
      <p><strong>Cores:</strong> Con ${CompState.numCores} core(s), los algoritmos preemptivos (${entries.filter(([n])=>SCHEDULING_META[n]&&SCHEDULING_META[n].preemptive&&SCHEDULING_META[n].preemptive.includes('✅')).map(([n])=>n).join(', ')||'ninguno'}) aprovechan mejor el paralelismo redistribuyendo procesos en cada quantum.</p>
    </div>`;
  } else {
    const sorted_f=[...entries].sort((a,b)=>a[1].total_faults-b[1].total_faults);
    const best_f=sorted_f[0],worst_f=sorted_f[sorted_f.length-1];
    const c_bf=PID_COLORS[entries.findIndex(([n])=>n===best_f[0])%PID_COLORS.length];
    section.innerHTML=`<div class="comp-analysis">
      <h4>🏆 Análisis comparativo de paginación</h4>
      <p><strong>Menos Page Faults:</strong>
        <span class="winner-badge" style="background:${c_bf}22;border:1px solid ${c_bf}55;color:${c_bf}">★ ${best_f[0]} — ${best_f[1].total_faults} fallos</span>
        vs <strong>${worst_f[0]}</strong> (${worst_f[1].total_faults} fallos).
      </p>
      <ul>${entries.map(([name,d])=>{
        const m=PAGING_META[name];if(!m)return'';
        return`<li><strong>${name}</strong> — ${d.total_faults} fallos, Hit Rate: ${d.hit_rate.toFixed(1)}%.
          ${name===best_f[0]?'✅ Menor número de page faults. ':''}
          ${m.belady&&m.belady.includes('⚠️')?'⚠️ Sufre anomalía de Bélady. ':m.belady?'✅ No sufre anomalía. ':''}
        </li>`;
      }).join('')}</ul>
    </div>`;
  }
}

/* ═══ Subtablas por proceso ═══════════════════════════════════════════ */
function buildProcessSubtables(entries, isSched){
  const container=document.getElementById('comp-process-subtables');
  if(!container)return;
  if(!isSched){container.innerHTML='';return;}

  const tablesHtml=entries.map(([name,d],ei)=>{
    const color=PID_COLORS[ei%PID_COLORS.length];
    const metrics=d.metrics||[];
    if(!metrics.length)return'';
    const rows=metrics.map((m,mi)=>{
      const pidColor=PID_COLORS[m.pid%PID_COLORS.length];
      return`<tr id="str-${ei}-${mi}">
        <td style="font-weight:700;text-align:center;color:#222"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${pidColor};margin-right:4px;vertical-align:middle"></span>P${m.pid}</td>
        <td style="text-align:center;color:#555;font-size:11px">${m.arrival_time}</td>
        <td style="text-align:center;color:#555;font-size:11px">${m.burst_time}</td>
        <td id="stct-${ei}-${mi}" style="text-align:center;color:#222">—</td>
        <td id="sttat-${ei}-${mi}" style="text-align:center;color:#222">—</td>
        <td id="stwt-${ei}-${mi}" style="text-align:center;color:#222">—</td>
        <td id="strt-${ei}-${mi}" style="text-align:center;color:#222">—</td>
      </tr>`;
    }).join('');
    return`<div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:${color};margin-bottom:5px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${name}
      </div>
      <div class="table-wrapper">
        <table style="font-size:11px;background:#fff;color:#111">
          <thead><tr style="background:${color}22;color:#333">
            <th style="text-align:center;color:#333">PID</th>
            <th style="text-align:center;color:#333">AT</th>
            <th style="text-align:center;color:#333">BT</th>
            <th style="text-align:center;color:#333">CT</th>
            <th style="text-align:center;color:#333">TAT<br><span style="font-size:8px;font-weight:400;color:#666">(CT−AT)</span></th>
            <th style="text-align:center;color:#333">WT<br><span style="font-size:8px;font-weight:400;color:#666">(TAT−BT)</span></th>
            <th style="text-align:center;color:#333">RT<br><span style="font-size:8px;font-weight:400;color:#666">(1ªCPU−AT)</span></th>
          </tr></thead>
          <tbody>${rows}
            <tr style="background:#f5f5f5;font-style:italic">
              <td colspan="4" style="text-align:right;font-size:10px;color:#666;padding-right:8px">Promedio:</td>
              <td id="stavgtat-${ei}" style="text-align:center;font-weight:700;color:#111">—</td>
              <td id="stavgwt-${ei}" style="text-align:center;font-weight:700;color:#111">—</td>
              <td id="stavgrt-${ei}" style="text-align:center;font-weight:700;color:#111">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  container.innerHTML=`
    <div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-top:12px;border-top:1px solid var(--border)">
      <i class="ph ph-function"></i> Cálculo por proceso
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px">${tablesHtml}</div>`;
}

function updateSubtablesLive(entries, tick, totalTime, force){
  if(!entries) return;
  entries.forEach(([name, d], ei) => {
    const metrics = d.metrics || [];
    const frac = Math.min(tick / totalTime, 1);
    const fin  = frac >= 0.99 || force;
    let sumTAT=0, sumWT=0, sumRT=0, cnt=0;

    metrics.forEach((m, mi) => {
      const ctFrac = totalTime > 0 ? (m.completion_time / totalTime) : 1;
      if (frac < ctFrac * 0.98 && !fin) return;

      const ct  = m.completion_time;
      const at  = m.arrival_time;
      const bt  = m.burst_time;
      const tat = m.turnaround_time;
      const wt  = m.waiting_time;
      const rt  = m.response_time;

      // force=true: siempre escribir aunque el contenido sea igual (tras regenerar DOM)
      const setCell = (id, val) => {
        const el = document.getElementById(id);
        if (el && (force || el.textContent !== String(val))) el.textContent = val;
      };

      setCell(`stct-${ei}-${mi}`,  ct ?? '—');
      setCell(`sttat-${ei}-${mi}`, fin ? `${ct}−${at} = ${tat}`  : tat ?? '—');
      setCell(`stwt-${ei}-${mi}`,  fin ? `${tat}−${bt} = ${wt}`  : wt  ?? '—');
      setCell(`strt-${ei}-${mi}`,  fin ? `1ªCPU−${at} = ${rt}`  : rt  ?? '—');

      sumTAT += tat||0; sumWT += wt||0; sumRT += rt||0; cnt++;
    });

    if (cnt > 0) {
      const setAvg = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
      setAvg(`stavgtat-${ei}`, (sumTAT/cnt).toFixed(2));
      setAvg(`stavgwt-${ei}`,  (sumWT /cnt).toFixed(2));
      setAvg(`stavgrt-${ei}`,  (sumRT /cnt).toFixed(2));
    }
  });
}

/* ═══ Rellenar tabla final ════════════════════════════════════════════ */
function fillTableFinal(entries,isSched){
  if(!entries||!entries.length)return;
  const avgRow=document.getElementById('comp-avg-row');
  const winnerRow=document.getElementById('comp-winner-row');
  const winnerCell=document.getElementById('comp-winner-cell');
  if(!avgRow||!winnerRow)return;
  avgRow.style.background='rgba(255,255,255,0.04)';

  if(isSched){
    const vals_wt =entries.map(([,d])=>d.avg_waiting);
    const vals_tat=entries.map(([,d])=>d.avg_turnaround);
    const vals_rt =entries.map(([,d])=>d.avg_response);
    const vals_cpu=entries.map(([,d])=>d.cpu_utilization);
    const avg=(arr)=>(arr.reduce((s,v)=>s+v,0)/arr.length);
    document.getElementById('avg-wt') .textContent=avg(vals_wt).toFixed(2);
    document.getElementById('avg-tat').textContent=avg(vals_tat).toFixed(2);
    document.getElementById('avg-rt') .textContent=avg(vals_rt).toFixed(2);
    document.getElementById('avg-cpu').textContent=avg(vals_cpu).toFixed(1)+'%';
    avgRow.style.display='';
    const minWT=Math.min(...vals_wt),maxCPU=Math.max(...vals_cpu);
    entries.forEach(([,d],i)=>{
      if(d.avg_waiting===minWT){const el=document.getElementById(`ct-wt-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
      if(d.cpu_utilization===maxCPU){const el=document.getElementById(`ct-cpu-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
    });
    const winIdx=vals_wt.indexOf(minWT);
    const winName=entries[winIdx][0];
    const winColor=PID_COLORS[winIdx%PID_COLORS.length];
    winnerCell.innerHTML=`🏆 <strong>Mejor rendimiento general:</strong>
      <span style="padding:2px 12px;border-radius:99px;background:${winColor}22;border:1px solid ${winColor}55;color:${winColor};font-weight:700;margin:0 6px">${winName}</span>
      con el menor Waiting Time promedio (${minWT.toFixed(2)} ms). CPU: ${entries[winIdx][1].cpu_utilization.toFixed(1)}% — ${entries[winIdx][1].context_switches||0} context switches.`;
    winnerRow.style.display='';
    buildProcessSubtables(entries,true);
    // Forzar llenado final de subtablas con frac=1
    updateSubtablesLive(entries, CompPlayer.totalTime, CompPlayer.totalTime, true);
  } else {
    const vals_pf=entries.map(([,d])=>d.total_faults||0);
    const vals_hr=entries.map(([,d])=>d.hit_rate||0);
    const vals_fr=entries.map(([,d])=>d.fault_rate||0);
    const avg=(arr)=>(arr.reduce((s,v)=>s+v,0)/arr.length);
    document.getElementById('avg-pf').textContent=avg(vals_pf).toFixed(1);
    document.getElementById('avg-hr').textContent=avg(vals_hr).toFixed(1)+'%';
    document.getElementById('avg-fr').textContent=avg(vals_fr).toFixed(1)+'%';
    avgRow.style.display='';
    const minPF=Math.min(...vals_pf),maxHR=Math.max(...vals_hr);
    entries.forEach(([,d],i)=>{
      if((d.total_faults||0)===minPF){const el=document.getElementById(`ct-pf-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
      if((d.hit_rate||0)===maxHR){const el=document.getElementById(`ct-hr-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
    });
    const winIdx=vals_pf.indexOf(minPF);
    const winName=entries[winIdx][0];
    const winColor=PID_COLORS[winIdx%PID_COLORS.length];
    winnerCell.innerHTML=`🏆 <strong>Mejor rendimiento:</strong>
      <span style="padding:2px 12px;border-radius:99px;background:${winColor}22;border:1px solid ${winColor}55;color:${winColor};font-weight:700;margin:0 6px">${winName}</span>
      con solo ${minPF} page faults y Hit Rate de ${entries[winIdx][1].hit_rate.toFixed(1)}%.`;
    winnerRow.style.display='';
    buildProcessSubtables(entries,false);
    updateSubtablesLive(entries, CompPlayer.totalTime, CompPlayer.totalTime, true);
  }
}

/* ═══ Controles playback ══════════════════════════════════════════════ */
function startCompPlay(){
  if(!CompPlayer.renderFn||CompPlayer.playing)return;
  CompPlayer.playing=true;
  const btn=document.getElementById('comp-btn-play');
  if(btn)btn.innerHTML='<i class="ph ph-pause"></i> Pausar';
  CompPlayer.lastFrame=performance.now();
  compAnimate();
}

function toggleCompPlay(){
  if(!CompPlayer.renderFn)return;
  if(CompPlayer.playing){
    CompPlayer.playing=false;
    cancelAnimationFrame(CompPlayer.rafId);
    const btn=document.getElementById('comp-btn-play');
    if(btn)btn.innerHTML='<i class="ph ph-play"></i> Reanudar';
  } else {
    if(CompPlayer.currentTick>=CompPlayer.totalTime)CompPlayer.currentTick=0;
    startCompPlay();
  }
}

function compAnimate(ts){
  if(!CompPlayer.playing)return;
  ts=ts||performance.now();
  const dt=Math.min((ts-CompPlayer.lastFrame)/1000,0.1);
  CompPlayer.lastFrame=ts;
  CompPlayer.currentTick=Math.min(CompPlayer.currentTick+dt*CompPlayer.speed*2,CompPlayer.totalTime);
  CompPlayer.renderFn();
  if(CompPlayer.currentTick>=CompPlayer.totalTime){
    CompPlayer.playing=false;
    const btn=document.getElementById('comp-btn-play');
    if(btn)btn.innerHTML='<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar';
    fillTableFinal(CompPlayer.results,CompState.category==='scheduling');
    return;
  }
  CompPlayer.rafId=requestAnimationFrame(compAnimate);
}

function stopCompPlayer(){
  CompPlayer.playing=false;
  cancelAnimationFrame(CompPlayer.rafId);
  cancelAnimationFrame(CompPlayer.barAnimId);
}

function compSeek(t){
  stopCompPlayer();
  CompPlayer.currentTick=Math.max(0,Math.min(Number(t),CompPlayer.totalTime));
  if(CompPlayer.renderFn)CompPlayer.renderFn();
  const btn=document.getElementById('comp-btn-play');
  if(btn)btn.innerHTML=CompPlayer.currentTick>=CompPlayer.totalTime
    ?'<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar'
    :'<i class="ph ph-play"></i> Reanudar';
}

function compStep(dir){
  stopCompPlayer();
  CompPlayer.currentTick=Math.max(0,Math.min(CompPlayer.currentTick+dir,CompPlayer.totalTime));
  if(CompPlayer.renderFn)CompPlayer.renderFn();
}

function setCompSpeed(val){
  CompPlayer.speed=parseFloat(val);
  const lbl=document.getElementById('comp-speed-label');
  if(lbl)lbl.textContent=parseFloat(val).toFixed(2).replace(/\.?0+$/,'')+'x';
}

function clearCompResults(){
  stopCompPlayer();
  const r=document.getElementById('comp-results');
  if(r)r.innerHTML='';
}

/* ═══ Exports + auto-init ═════════════════════════════════════════════ */
window.runComparison  =runComparison;
window.initComparison =initComparison;
window.setCompCategory=setCompCategory;
window.setCompCores   =setCompCores;
window.toggleCompPlay =toggleCompPlay;
window.stopCompPlayer =stopCompPlayer;
window.compSeek       =compSeek;
window.compStep       =compStep;
window.setCompSpeed   =setCompSpeed;
window.updateCompQuantumVisibility=updateCompQuantumVisibility;

(function(){
  function tryInit(){const g=document.getElementById('comp-algo-grid');if(g&&g.children.length===0)initComparison();}
  document.addEventListener('DOMContentLoaded',()=>{
    const nb=document.getElementById('nav-comparison');
    if(nb)nb.addEventListener('click',tryInit);
    const sc=document.getElementById('screen-comparison');
    if(sc&&sc.classList.contains('active'))tryInit();
  });
})();