/**
 * comparison.js — Algorithm Comparison v7
 *
 * Cambios vs v6:
 *  - Un canvas por algoritmo (cada uno en su propio card con título)
 *  - Mario corregido: baseY sobre la barra, dt real del requestAnimationFrame
 *  - Cores horizontales: mismos bloques animados que gantt.js pero en fila horizontal
 *    (core-live-bar rotado: track horizontal, bloques en row, llenan de izquierda a derecha)
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

/* ═══ Estado global ═══════════════════════════════════════════════════ */
// CompPlayer ahora es un array, uno por algoritmo
const CompPlayers = [];   // [{ canvas, ctx, mario, renderFn, totalTime, currentTick, playing, ... }]
let   CompAnimId  = null; // único rAF loop para todos los players
let   CompBarAnimId = null;

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
  stopCompPlayer();

  try {
    clearCompResults();
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
    setTimeout(() => startCompPlayer(), 150);
  } catch(err) {
    log.textContent = `❌  ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> ▶ Comparar';
  }
}

/* ═══ Core schedules (misma lógica que gantt.js) ═════════════════════ */
function buildCompCoreSchedules(algoGantt, numCores) {
  const schedules = Array.from({ length: Math.max(numCores,1) }, ()=>[]);
  if (numCores <= 1) {
    algoGantt.filter(e=>e.pid>=0).forEach(e =>
      schedules[0].push({ pid:e.pid, start:e.start, end:e.end, label:`P${e.pid}` })
    );
    return schedules;
  }
  const pidToCore = {}; let nextCore = 0;
  for (const e of algoGantt) {
    if (e.pid < 0) continue;
    if (!(e.pid in pidToCore)) { pidToCore[e.pid]=nextCore; nextCore=(nextCore+1)%numCores; }
    schedules[pidToCore[e.pid]].push({ pid:e.pid, start:e.start, end:e.end, label:`P${e.pid}` });
  }
  return schedules;
}

/* ═══ Cores horizontales — mismos bloques de gantt.js pero en fila ═══ */
const COMP_CORE_BLOCKS = 12;

function buildCompCorePanelHTML(algoIdx, numCores, algoColor) {
  const gridId = `comp-cores-grid-${algoIdx}`;
  // Exact same structure as cores-live-grid in gantt.js
  const coreBars = Array.from({ length: numCores }, (_,c) => {
    const blocks = Array.from({length:COMP_CORE_BLOCKS}, (_,bi) =>
      `<div class="core-live-block" data-idx="${bi}"></div>`
    ).join('');
    return `<div class="core-live-bar is-idle" data-core="${c}" style="flex:1 1 0;max-width:80px;min-width:30px">
      <div class="core-live-pid" data-role="pid">IDLE</div>
      <div class="core-live-bar-track" style="height:80px">
        <div class="core-live-blocks" data-role="blocks">${blocks}</div>
      </div>
      <div class="core-live-percent" data-role="percent">0%</div>
      <div class="core-live-label" style="color:${algoColor};font-size:9px;text-align:center;margin-top:2px">C${c+1}</div>
    </div>`;
  }).join('');
  return `<div id="${gridId}" class="cores-live-grid" style="padding:0;gap:3px;display:flex;flex-wrap:nowrap;justify-content:center">${coreBars}</div>`;
}

function updateCompCorePanel(algoIdx, coreSchedules, tick, totalTime) {
  const grid = document.getElementById(`comp-cores-grid-${algoIdx}`);
  if (!grid) return;
  const finished = totalTime > 0 && tick >= totalTime;
  const denom = Math.max(tick, 0.0001);

  for (let c = 0; c < coreSchedules.length; c++) {
    const bar = grid.querySelector(`.core-live-bar[data-core="${c}"]`);
    if (!bar) continue;
    const blocksWrap = bar.querySelector('[data-role="blocks"]');
    const pidEl      = bar.querySelector('[data-role="pid"]');
    const pctEl      = bar.querySelector('[data-role="percent"]');
    const schedule   = coreSchedules[c];

    let active = 0, running = null;
    for (const e of schedule) {
      if (e.start >= tick) break;
      const visibleEnd = Math.min(e.end, tick);
      active += Math.max(0, visibleEnd - e.start);
      if (e.start <= tick && tick < e.end) running = e;
    }

    const rawPercent = tick > 0 ? Math.round((active / denom) * 100) : 0;
    const clamped = finished ? 0 : Math.max(0, Math.min(100, rawPercent));
    const litCount = Math.round((clamped / 100) * COMP_CORE_BLOCKS);

    if (running && !finished) bar._lastColor = pidColor(running.pid);
    const color = bar._lastColor || pidColor(running ? running.pid : 0);

    const blocks = blocksWrap.querySelectorAll('.core-live-block');
    blocks.forEach((block, i) => {
      const isLit = i >= COMP_CORE_BLOCKS - litCount;
      block.classList.toggle('is-lit', isLit);
      if (isLit) { block.style.background = color; block.style.borderColor = color; }
      else        { block.style.background = ''; block.style.borderColor = ''; }
    });

    if (running && !finished) {
      pidEl.textContent       = running.label || `P${running.pid}`;
      pidEl.style.background  = color;
      pidEl.style.color       = '#fff';
      pidEl.style.borderColor = color;
      bar.classList.add('is-active'); bar.classList.remove('is-idle');
    } else {
      pidEl.textContent = 'IDLE';
      pidEl.style.background = pidEl.style.color = pidEl.style.borderColor = '';
      bar.classList.add('is-idle'); bar.classList.remove('is-active');
    }
    pctEl.textContent = clamped + '%';
  }
}

/* ═══ UI principal ════════════════════════════════════════════════════ */
function buildResultUI(apiResults) {
  const container = document.getElementById('comp-results');
  const entries   = Object.entries(apiResults).filter(([,d])=>!d.error);
  if (!entries.length) return;
  const isSched = CompState.category==='scheduling';
  const meta    = isSched ? SCHEDULING_META : PAGING_META;
  const appProcs = (window.AppState && window.AppState.processes) || [];

  // Inyectar estilos
  if (!document.getElementById('comp-v7-style')) {
    const s = document.createElement('style');
    s.id = 'comp-v7-style';
    s.textContent = `
      .comp-live-cell{transition:color .2s,background .2s;font-size:18px;font-weight:700;color:#fff}
      .comp-live-cell.flash{color:#6EEB83!important;background:rgba(110,235,131,.14)!important}
      .comp-analysis{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px}
      .comp-analysis h4{font-size:13px;font-weight:700;color:var(--accent);margin:0 0 10px}
      .comp-analysis p{font-size:12px;color:var(--text-secondary);line-height:1.7;margin:0 0 8px}
      .comp-analysis .winner-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:700}
      .comp-analysis ul{margin:6px 0 10px 16px;font-size:12px;color:var(--text-secondary);line-height:1.8}
      /* ── cuadrícula 2×2 de gantt cards ── */
      .comp-gantt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
      @media(max-width:700px){.comp-gantt-grid{grid-template-columns:1fr}}
      .comp-card-span2{grid-column:1 / -1}
      /* ── card por algoritmo ── */
      .comp-algo-card-result{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
      .comp-algo-card-header{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border)}
      .comp-algo-card-title{font-size:12px;font-weight:700}
      .comp-algo-card-meta{font-size:9px;color:var(--text-muted)}
      .comp-algo-canvas-wrap{background:#03030E;position:relative;width:100%}
      /* ── cores section ── */
      .comp-cores-section{padding:8px 10px;border-top:1px solid var(--border)}
      .comp-cores-section .cores-live-grid{padding:0;gap:6px}
      .comp-cores-section .core-live-bar-track{height:120px}

      /* ── compactar panel de cores comparativo: matar whitespace vertical ── */
      #comp-results .cores-live-grid{padding:0!important;margin:0!important;min-height:0!important}
      #comp-results .core-live-bar{padding:4px 2px!important;margin:0!important;gap:2px!important;justify-content:flex-start!important;min-height:0!important}
      #comp-results .core-live-pid{margin:0!important;padding:2px 6px!important;font-size:10px!important;line-height:1.2!important}
      #comp-results .core-live-bar-track{margin:0!important;height:80px!important}
      #comp-results .core-live-blocks{height:100%!important;margin:0!important}
      #comp-results .core-live-percent{margin:2px 0 0 0!important;font-size:11px!important;line-height:1.2!important}
      #comp-results .core-live-label{margin:1px 0 0 0!important;line-height:1.2!important}
    `;
    document.head.appendChild(s);
  }

  // Panel procesos
  const vis = typeof getEffectiveVisibility==='function' ? getEffectiveVisibility() : {threadsVisible:false,forksVisible:false};
  let procPanel = '';
  if (isSched && appProcs.length>0) {
    const tiles = appProcs.map((p,i)=>{
      const c = PID_COLORS[i%PID_COLORS.length];
      const tb = (vis.threadsVisible&&p.threads&&p.threads.length)
        ? p.threads.map(t=>`<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:#2563eb33;border:1px solid #3b82f666;color:#60a5fa;margin:1px">🧵T${t.tid} bt=${t.burst_time}</span>`).join('') : '';
      const fb = (vis.forksVisible&&p.forks&&p.forks.length)
        ? p.forks.map(f=>`<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:#10b98133;border:1px solid #10b98166;color:#34d399;margin:1px">⑂F${f.fid} bt=${f.burst_time}</span>`).join('') : '';
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 8px;border-radius:8px;border:1.5px solid ${c}55;background:${c}11;min-width:80px">
        <div style="font-weight:800;font-size:14px;color:${c}">P${p.pid}</div>
        <div style="font-size:9px;color:var(--text-muted)">BT=${p.burst_time} AT=${p.arrival_time}</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:3px">${tb}${fb}</div>
      </div>`;
    }).join('');
    procPanel = `<div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px"><i class="ph ph-stack"></i> Procesos en comparación</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px">${tiles}</div>
    </div>`;
  }

  // Análisis
  const analysisHTML = `<div id="comp-analysis-section" style="margin-bottom:12px"></div>`;

  // Leyenda threads/forks
  const legendHTML = isSched ? `
    <div style="display:flex;gap:16px;font-size:10px;color:var(--text-muted);margin-bottom:12px;flex-wrap:wrap">
      <span>🍄 <strong style="color:var(--accent)">Mario</strong> = Proceso principal</span>
      ${vis.threadsVisible ? '<span>🐸 <strong style="color:#60a5fa">Toad clone</strong> = Thread (barra translúcida punteada)</span>' : ''}
      ${vis.forksVisible   ? '<span>👥 <strong style="color:#34d399">Clone</strong> = Fork (gradiente verde)</span>' : ''}
    </div>` : '';

  // Cards de Gantt — cuadrícula de 2 columnas, max 4 cards
  // 1 algo  → 1 col span 2 | 2 algos → 2 cols | 3 → 2+1(span2) | 4 → 2x2
  const ganttCardsHTML = (() => {
    const cards = entries.map(([name,d], i) => {
      const color = PID_COLORS[i%PID_COLORS.length];
      const meta  = isSched ? SCHEDULING_META[name] : PAGING_META[name];
      const shortDesc = meta ? meta.short : '';
      const coresSection = ''; // cores van en panel separado debajo del grid
      // 3 algos: último ocupa columna completa
      const spanFull = (entries.length === 3 && i === 2) || entries.length === 1;
      return `<div class="comp-algo-card-result${spanFull ? ' comp-card-span2' : ''}" id="comp-algo-result-${i}">
        <div class="comp-algo-card-header" style="border-left:4px solid ${color}">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px;font-weight:900;color:${color};opacity:.4;font-family:var(--font-mono)">${i+1}</span>
            <div>
              <div class="comp-algo-card-title" style="color:${color};font-size:12px">${name}</div>
              <div class="comp-algo-card-meta" style="font-size:9px">${shortDesc}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-muted);flex-wrap:wrap">
            ${isSched ? `<span>WT:<strong id="hdr-wt-${i}" style="color:${color};margin-left:3px">—</strong></span>
            <span>CPU:<strong id="hdr-cpu-${i}" style="color:${color};margin-left:3px">—</strong></span>` :
            `<span>Faults:<strong id="hdr-pf-${i}" style="color:${color};margin-left:3px">—</strong></span>
             <span>Hit:<strong id="hdr-hr-${i}" style="color:${color};margin-left:3px">—</strong></span>`}
            <span style="font-size:9px;background:${color}22;border:1px solid ${color}44;padding:1px 6px;border-radius:99px">Core ${i%CompState.numCores+1}</span>
          </div>
        </div>
        <div class="comp-algo-canvas-wrap">
          <canvas id="comp-canvas-${i}" style="display:block;width:100%"></canvas>
        </div>
        ${coresSection}
      </div>`;
    });
    const coresPanel = isSched ? (() => {
      const algoRows = entries.map(([name,d], i) => {
        const color = PID_COLORS[i%PID_COLORS.length];
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:0;justify-content:flex-start">
  <div style="font-size:10px;font-weight:700;color:${color};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;margin:0">${i+1}. ${name}</div>
  ${buildCompCorePanelHTML(i, CompState.numCores, color)}
</div>`;
      }).join('');
      return `<div class="card" style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px"><i class="ph ph-cpu"></i> Cores en tiempo real — todos los algoritmos</div>
        <div style="display:flex;gap:12px;align-items:flex-start">${algoRows}</div>
      </div>`;
    })() : '';
    return `<div class="comp-gantt-grid">${cards.join('')}</div>${coresPanel}`;
  })();

  // Controles de playback globales
  const controlsHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em"><i class="ph ph-play-circle"></i> Controles de reproducción</span>
        <span id="comp-tick-label" style="font-size:11px;color:var(--text-muted)">t = 0</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(0)" title="Reset"><i class="ph ph-skip-back"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(-1)"><i class="ph ph-rewind"></i></button>
        <button class="btn btn-primary" id="comp-btn-play" style="border-radius:24px;padding:7px 24px;font-size:1rem;font-weight:700" onclick="toggleCompPlay()">
          <i class="ph ph-pause"></i> Pausar
        </button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compStep(1)"><i class="ph ph-fast-forward"></i></button>
        <button class="btn btn-secondary btn-sm" style="border-radius:50%" onclick="compSeek(CompPlayer_getTotalTime())"><i class="ph ph-skip-forward"></i></button>
        <span id="comp-step-counter" style="font-size:12px;color:var(--text-muted);min-width:58px">0 / 0</span>
        <div style="display:flex;align-items:center;gap:6px;margin-left:4px">
          <label for="comp-speed" style="font-size:11px;color:var(--text-muted)">Velocidad</label>
          <input type="range" id="comp-speed" min="0.25" max="4" step="0.25" value="1" style="width:76px" oninput="setCompSpeed(this.value)">
          <span id="comp-speed-label" style="font-size:11px;font-weight:600;background:rgba(255,255,255,.12);padding:2px 7px;border-radius:6px;color:#fff;border:1px solid rgba(255,255,255,.16)">1x</span>
        </div>
      </div>
    </div>`;

  // Tabla de métricas
  const hasThreads = isSched && vis.threadsVisible && appProcs.some(p=>p.threads&&p.threads.length);
  const hasForks   = isSched && vis.forksVisible   && appProcs.some(p=>p.forks&&p.forks.length);

  const formulaBar = isSched
    ? `<div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;padding:6px 10px;background:rgba(110,235,131,.06);border-radius:6px;border-left:3px solid var(--accent);line-height:1.8">
        📐 WT = CT−AT−BT &nbsp;|&nbsp; TAT = CT−AT &nbsp;|&nbsp; CPU% = ocupado/total×100
        ${hasThreads ? '&nbsp;|&nbsp; 🧵 Threads = subprocesos en mismo espacio de memoria' : ''}
        ${hasForks   ? '&nbsp;|&nbsp; ⑂ Forks = procesos hijo con memoria independiente' : ''}
      </div>`
    : `<div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;padding:6px 10px;background:rgba(110,235,131,.06);border-radius:6px;border-left:3px solid var(--accent);line-height:1.8">
        📐 Fault Rate = Fallos/total×100 &nbsp;|&nbsp; Hit Rate = (100−FaultRate)
      </div>`;

  const schedHdrs = ['Algoritmo','Core',
    `Avg WT<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(CT−AT−BT)</span>`,
    `Avg TAT<br><span style="font-size:9px;font-weight:400;color:var(--text-muted)">(CT−AT)</span>`,
    `CPU %`, `Ctx Sw`,
    ...(hasThreads?[`🧵 Threads`]:[]),
    ...(hasForks  ?[`⑂ Forks`  ]:[]),
    `Sim ms`];
  const pageHdrs  = ['Algoritmo','Core','Page Faults','Hit Rate %','Fault Rate %','Frames','Sim ms'];
  const hdrs = isSched ? schedHdrs : pageHdrs;
  const colSpan = hdrs.length;

  const totalT = hasThreads ? appProcs.reduce((s,p)=>s+(p.threads?p.threads.length:0),0) : 0;
  const totalF = hasForks   ? appProcs.reduce((s,p)=>s+(p.forks  ?p.forks.length  :0),0) : 0;

  const tableRows = entries.map(([name,d],i)=>{
    const c = PID_COLORS[i%PID_COLORS.length];
    return isSched
      ? `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td style="text-align:center"><span style="padding:2px 8px;border-radius:99px;background:${c}18;border:1px solid ${c}44;font-size:10px;color:${c}">Core ${i%CompState.numCores+1}</span></td>
          <td id="ct-wt-${i}"  class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-tat-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-cpu-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td style="text-align:center;color:var(--text-muted)">${d.context_switches??'—'}</td>
          ${hasThreads?`<td style="text-align:center"><span style="padding:2px 8px;border-radius:99px;background:#2563eb22;border:1px solid #3b82f644;color:#60a5fa;font-size:11px;font-weight:700">🧵 ${totalT}</span></td>`:''}
          ${hasForks  ?`<td style="text-align:center"><span style="padding:2px 8px;border-radius:99px;background:#10b98122;border:1px solid #10b98144;color:#34d399;font-size:11px;font-weight:700">⑂ ${totalF}</span></td>`:''}
          <td style="text-align:center;color:var(--text-muted);font-size:11px">${d.elapsed_ms!=null?d.elapsed_ms.toFixed(1):'—'}</td>
        </tr>`
      : `<tr>
          <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${name}</td>
          <td style="text-align:center;color:var(--text-muted);font-size:11px">Core ${i%CompState.numCores}</td>
          <td id="ct-pf-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-hr-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td id="ct-fr-${i}" class="comp-live-cell" style="font-size:13px;text-align:center">—</td>
          <td style="text-align:center;color:var(--text-muted)">${d.num_frames??'—'}</td>
          <td style="text-align:center;color:var(--text-muted);font-size:11px">${d.elapsed_ms!=null?d.elapsed_ms.toFixed(1):'—'}</td>
        </tr>`;
  }).join('');

  const avgRow = isSched
    ? `<tr id="comp-avg-row" style="display:none;background:rgba(110,235,131,.06);font-style:italic">
        <td style="font-size:11px;font-weight:700;color:var(--text-secondary)">Promedio</td><td>—</td>
        <td id="avg-wt" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-tat" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-cpu" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td>—</td>${hasThreads?'<td>—</td>':''}${hasForks?'<td>—</td>':''}
        <td>—</td>
      </tr>
      <tr id="comp-winner-row" style="display:none">
        <td colspan="${colSpan}" id="comp-winner-cell" style="text-align:center;padding:8px;font-size:12px;border-top:1px solid var(--border)"></td>
      </tr>`
    : `<tr id="comp-avg-row" style="display:none;background:rgba(110,235,131,.06);font-style:italic">
        <td style="font-size:11px;font-weight:700;color:var(--text-secondary)">Promedio</td><td>—</td>
        <td id="avg-pf" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-hr" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td id="avg-fr" style="text-align:center;font-size:12px;font-weight:600">—</td>
        <td>—</td><td>—</td>
      </tr>
      <tr id="comp-winner-row" style="display:none">
        <td colspan="${colSpan}" id="comp-winner-cell" style="text-align:center;padding:8px;font-size:12px;border-top:1px solid var(--border)"></td>
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

  // Gráficas
  const bcDefs = isSched
    ? [{id:'cbc-wt',title:'Avg Waiting Time',higher:false},{id:'cbc-tat',title:'Avg Turnaround',higher:false},{id:'cbc-cpu',title:'CPU %',higher:true}]
    : [{id:'cbc-pf',title:'Page Faults',higher:false},{id:'cbc-hr',title:'Hit Rate %',higher:true},{id:'cbc-fr',title:'Fault Rate %',higher:false}];

  const barChartsHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px"><i class="ph ph-chart-bar"></i> Comparación visual</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${bcDefs.map(bc=>`<div>
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;text-align:center">${bc.title}</div>
          <div style="position:relative;height:300px"><canvas id="${bc.id}" style="width:100%;height:300px;border-radius:6px"></canvas></div>
        </div>`).join('')}
      </div>
    </div>`;

  const explHTML = `
    <div class="card">
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px"><i class="ph ph-lightbulb"></i> Algoritmos: análisis y casos de uso</div>
      ${entries.map(([name],i)=>{
        const m = meta[name]; if (!m) return '';
        const c = PID_COLORS[i%PID_COLORS.length];
        const b1=m.preemptive?`<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.preemptive}</span>`:'';
        const b2=m.starvation?`<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.starvation}</span>`:'';
        const b3=m.complexity?`<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text-muted)">${m.complexity}</span>`:'';
        const b4=m.belady    ?`<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:${c}22;border:1px solid ${c}55;color:${c}">${m.belady}</span>`:'';
        return `<div style="border-left:3px solid ${c};padding:10px 14px;margin-bottom:10px;background:var(--bg-surface);border-radius:0 8px 8px 0">
          <div style="font-weight:700;font-size:13px;color:${c};margin-bottom:3px">${name} <span style="font-weight:400;color:var(--text-secondary)">— ${m.short}</span></div>
          <div style="font-size:10px;color:var(--text-muted);font-family:monospace;margin-bottom:6px;padding:4px 8px;background:rgba(255,255,255,.04);border-radius:4px">${m.formula}</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.65;margin-bottom:6px">${m.explanation}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">${b1}${b2}${b3}${b4}</div>
          <div style="font-size:11px;color:var(--text-muted)">💡 <em>${m.useCase}</em></div>
        </div>`;
      }).join('')}
    </div>`;

  container.innerHTML = procPanel + legendHTML + controlsHTML + ganttCardsHTML + tableHTML + barChartsHTML + analysisHTML + explHTML;

  buildProcessSubtables(entries, isSched);

  // Inicializar un canvas por algoritmo
  CompPlayers.length = 0;
  entries.forEach(([name,d], i) => {
    const player = initOneCanvas(i, name, d, appProcs, entries, isSched);
    CompPlayers.push(player);
  });

  // Registrar core schedules
  if (isSched) {
    entries.forEach(([,d], i) => {
      CompPlayers[i].coreSchedules = buildCompCoreSchedules(d.gantt||[], CompState.numCores);
    });
  }

  startBarChartAnimation(entries, isSched);
}

/* ═══ Un canvas por algoritmo ════════════════════════════════════════ */
const COMP_BAR_H   = 28;
const COMP_ROW_GAP = 5;
const COMP_LEFT    = 130;
const COMP_TOP     = 36;
const COMP_BOTTOM  = 36;
const CMS = 2;
const CMW = 16*CMS, CMH = 16*CMS;

function initOneCanvas(algoIdx, algoName, d, appProcs, entries, isSched) {
  const canvas = document.getElementById(`comp-canvas-${algoIdx}`);
  const cont   = canvas ? canvas.parentElement : null;
  if (!canvas || !cont) return null;

  const vis = (typeof getEffectiveVisibility==='function')
    ? getEffectiveVisibility()
    : { threadsVisible:!!(window.AppState&&window.AppState.threadsEnabled),
        forksVisible:  !!(window.AppState&&window.AppState.forksEnabled) };

  // ── Construir filas (igual que gantt.js) ───────────────────────────
  const gantt    = d.gantt || [];
  const basePids = [...new Set(gantt.filter(e=>e.pid>=0).map(e=>e.pid))].sort((a,b)=>a-b);
  const rows = [], rowKeyToIndex = {};

  if (isSched) {
    basePids.forEach(pid => {
      rowKeyToIndex[String(pid)] = rows.length;
      rows.push({ label:`P${pid}`, pid, tid:null, fid:null, isThread:false, isFork:false });
      const proc = appProcs.find(p=>p.pid===pid);
      if (vis.threadsVisible && proc && proc.threads && proc.threads.length) {
        proc.threads.forEach(t => {
          rowKeyToIndex[`${pid}.t${t.tid}`] = rows.length;
          rows.push({ label:`P${pid}.T${t.tid}`, pid, tid:t.tid, fid:null, isThread:true, isFork:false, burstTime:t.burst_time });
        });
      }
      if (vis.forksVisible && proc && proc.forks && proc.forks.length) {
        proc.forks.forEach(f => {
          rowKeyToIndex[`${pid}.f${f.fid}`] = rows.length;
          rows.push({ label:`P${pid}⑂F${f.fid}`, pid, tid:null, fid:f.fid, isThread:false, isFork:true, burstTime:f.burst_time, forkDelay:f.delay||0 });
        });
      }
    });
  }

  const rowCount = Math.max(rows.length, 1);

  // Thread gantt
  const threadGantt = [];
  if (isSched && vis.threadsVisible) {
    basePids.forEach(pid => {
      const proc = appProcs.find(p=>p.pid===pid);
      if (!proc||!proc.threads||!proc.threads.length) return;
      const pw = gantt.filter(e=>e.pid===pid);
      let cursor = 0;
      proc.threads.forEach(t => {
        let rem = t.burst_time;
        for (const win of pw) {
          if (rem<=0) break;
          const ws = Math.max(win.start, cursor); if (ws>=win.end) continue;
          const used = Math.min(win.end-ws, rem);
          threadGantt.push({ pid, tid:t.tid, start:ws, end:ws+used, rowKey:`${pid}.t${t.tid}` });
          cursor = ws+used; rem -= used;
        }
      });
    });
  }

  // Fork gantt
  const forkGantt = [];
  if (isSched && vis.forksVisible) {
    basePids.forEach(pid => {
      const proc = appProcs.find(p=>p.pid===pid);
      if (!proc||!proc.forks||!proc.forks.length) return;
      const pw = gantt.filter(e=>e.pid===pid);
      if (!pw.length) return;
      const pFirst = Math.min(...pw.map(w=>w.start));
      proc.forks.forEach(f => {
        let rem = f.burst_time, cursor = pFirst+(f.delay||0);
        for (const win of pw) {
          if (rem<=0) break;
          if (win.end<=cursor) continue;
          const ws = Math.max(win.start, cursor); if (ws>=win.end) continue;
          const used = Math.min(win.end-ws, rem);
          forkGantt.push({ pid, fid:f.fid, start:ws, end:ws+used, rowKey:`${pid}.f${f.fid}` });
          cursor = ws+used; rem -= used;
        }
      });
    });
  }

  // ── Dimensiones ──────────────────────────────────────────────────────
  const totalTime = isSched && gantt.length
    ? Math.max(...gantt.map(e=>e.end))
    : (d.ref_length || 1);

  const height = COMP_TOP + rowCount*(COMP_BAR_H+COMP_ROW_GAP) + COMP_BOTTOM;
  const dpr    = window.devicePixelRatio || 1;
  const cw     = cont.clientWidth || 900;

  canvas.width  = cw*dpr; canvas.height = height*dpr;
  canvas.style.height = height+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const scale = (cw - COMP_LEFT - 20) / totalTime;

  // ── Mario state ──────────────────────────────────────────────────────
  const mario = { x:COMP_LEFT, y:0, frame:0, frameTimer:0, jumping:false, jumpVel:0, baseY:0, lastBlock:null, visible:false };

  // ── Draw helpers ─────────────────────────────────────────────────────
  function _pColor(pid) {
    return typeof window.pidColor==='function' ? window.pidColor(pid) : PID_COLORS[pid%PID_COLORS.length];
  }

  function _roundRect(x,y,w,h,r) {
    r = Math.max(0,Math.min(r,w/2,h/2));
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  function drawProcessBar(x,y,w,h,pid) {
    if (w<=0) return;
    const color=_pColor(pid);
    const grad=ctx.createLinearGradient(x,y,x+w,y+h);
    grad.addColorStop(0,color); grad.addColorStop(1,color+'CC');
    const bx=x+1,by=y+1,bw=Math.max(w-2,2),bh=h-2;
    ctx.beginPath(); ctx.moveTo(bx+6,by); ctx.lineTo(bx+bw-6,by);
    ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+6); ctx.lineTo(bx+bw,by+bh-6);
    ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-6,by+bh); ctx.lineTo(bx+6,by+bh);
    ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-6); ctx.lineTo(bx,by+6);
    ctx.quadraticCurveTo(bx,by,bx+6,by); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
    if (bw>32){ctx.fillStyle='#fff';ctx.font='bold 11px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(`P${pid}`,bx+bw/2,by+bh*.62);ctx.textAlign='left';}
  }

  function drawIdleBar(x,y,w,h) {
    if (w<=1) return;
    ctx.fillStyle='rgba(148,163,184,0.18)'; _roundRect(x,y,w,h,4); ctx.fill();
    ctx.save(); ctx.strokeStyle='rgba(148,163,184,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    _roundRect(x+.5,y+.5,w-1,h-1,4); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(148,163,184,0.12)'; ctx.lineWidth=1; ctx.beginPath();
    for(let d2=-h;d2<w+h;d2+=8){ctx.moveTo(x+d2,y);ctx.lineTo(x+d2+h,y+h);}
    ctx.stroke(); ctx.restore();
    if(w>28){ctx.fillStyle='rgba(148,163,184,0.5)';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('IDLE',x+w/2,y+h/2+3);}
  }

  function drawThreadBar(x,y,w,h,pid,tid) {
    if (w<=0) return;
    const color=_pColor(pid);
    const grad=ctx.createLinearGradient(x,y,x+w,y+h);
    grad.addColorStop(0,color+'99'); grad.addColorStop(1,color+'55');
    const bx=x+1,by=y+1,bw=Math.max(w-2,2),bh=h-2;
    ctx.beginPath(); ctx.moveTo(bx+6,by); ctx.lineTo(bx+bw-6,by);
    ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+6); ctx.lineTo(bx+bw,by+bh-6);
    ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-6,by+bh); ctx.lineTo(bx+6,by+bh);
    ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-6); ctx.lineTo(bx,by+6);
    ctx.quadraticCurveTo(bx,by,bx+6,by); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(bx,by+1); ctx.lineTo(bx+bw,by+1); ctx.stroke(); ctx.setLineDash([]);
    if(bw>36){ctx.fillStyle='#fff';ctx.font='italic 9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(`T${tid}`,bx+bw/2,by+bh*.62);ctx.textAlign='left';}
  }

  function drawForkBar(x,y,w,h,pid,fid) {
    if (w<=0) return;
    const parentColor=_pColor(pid);
    const grad=ctx.createLinearGradient(x,y,x+w,y+h);
    grad.addColorStop(0,parentColor+'CC'); grad.addColorStop(1,'#10B981');
    const bx=x+1,by=y+1,bw=Math.max(w-2,2),bh=h-2;
    ctx.beginPath(); ctx.moveTo(bx+6,by); ctx.lineTo(bx+bw-6,by);
    ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+6); ctx.lineTo(bx+bw,by+bh-6);
    ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-6,by+bh); ctx.lineTo(bx+6,by+bh);
    ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-6); ctx.lineTo(bx,by+6);
    ctx.quadraticCurveTo(bx,by,bx+6,by); ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
    ctx.fillStyle='#10B981'; ctx.fillRect(bx,by,3,bh);
    if(bw>36){ctx.fillStyle='#fff';ctx.font='bold 9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(`⑂F${fid}`,bx+bw/2,by+bh*.62);ctx.textAlign='left';}
  }

  // ── Render ────────────────────────────────────────────────────────────
  function render(tick) {
    ctx.clearRect(0,0,cw,height);

    // Fondo oscuro Mario
    const bg=ctx.createLinearGradient(0,0,0,height);
    bg.addColorStop(0,'#03030E'); bg.addColorStop(1,'#070720');
    ctx.fillStyle=bg; ctx.fillRect(0,0,cw,height);

    // Estrellas (pocas, aleatorias por algoIdx)
    ctx.fillStyle='rgba(255,255,255,0.3)';
    for(let s=0;s<6;s++){
      const sx=(algoIdx*137+s*71)%cw, sy=(s*43+algoIdx*19)%30+4;
      ctx.fillRect(sx,sy,2,2);
    }

    const axisY = COMP_TOP + rowCount*(COMP_BAR_H+COMP_ROW_GAP);

    // Líneas de tiempo verticales
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1; ctx.setLineDash([2,4]);
    for(let t=0;t<=totalTime;t++){
      const x=COMP_LEFT+t*scale;
      ctx.beginPath(); ctx.moveTo(x,COMP_TOP); ctx.lineTo(x,axisY); ctx.stroke();
    }
    ctx.setLineDash([]);

    if (isSched) {
      // ── Labels de fila ───────────────────────────────────────────────
      rows.forEach((r,i)=>{
        const ry = COMP_TOP + i*(COMP_BAR_H+COMP_ROW_GAP);
        ctx.fillStyle = r.isFork ? '#10B981' : (r.isThread ? _pColor(r.pid)+'AA' : _pColor(r.pid));
        if (r.isThread) ctx.font='italic 9px "JetBrains Mono",monospace';
        else if(r.isFork) ctx.font='bold 9px "JetBrains Mono",monospace';
        else ctx.font='bold 11px "Inter",sans-serif';
        ctx.globalAlpha = r.isThread?0.75 : (r.isFork?0.9:1);
        ctx.textAlign='right';
        const indent = r.isThread?4 : (r.isFork?2:0);
        ctx.fillText(r.label, COMP_LEFT-8-indent, ry+COMP_BAR_H*.62);
        ctx.globalAlpha=1;
      });

      // ── Barras proceso ───────────────────────────────────────────────
      for (const entry of gantt) {
        if (entry.start >= tick) continue;
        const visEnd = Math.min(entry.end, tick);
        const x = COMP_LEFT+entry.start*scale;
        const w = (visEnd-entry.start)*scale;
        if (entry.pid < 0) {
          drawIdleBar(x, COMP_TOP, w, COMP_BAR_H);
        } else {
          const ri = rowKeyToIndex[String(entry.pid)] ?? 0;
          drawProcessBar(x, COMP_TOP+ri*(COMP_BAR_H+COMP_ROW_GAP), w, COMP_BAR_H, entry.pid);
        }
      }

      // ── Barras thread ────────────────────────────────────────────────
      for (const te of threadGantt) {
        if (te.start >= tick) continue;
        const ri = rowKeyToIndex[te.rowKey]; if (ri===undefined) continue;
        const w = (Math.min(te.end,tick)-te.start)*scale;
        drawThreadBar(COMP_LEFT+te.start*scale, COMP_TOP+ri*(COMP_BAR_H+COMP_ROW_GAP), w, COMP_BAR_H, te.pid, te.tid);
      }

      // ── Barras fork ──────────────────────────────────────────────────
      for (const fe of forkGantt) {
        if (fe.start >= tick) continue;
        const ri = rowKeyToIndex[fe.rowKey]; if (ri===undefined) continue;
        const w = (Math.min(fe.end,tick)-fe.start)*scale;
        drawForkBar(COMP_LEFT+fe.start*scale, COMP_TOP+ri*(COMP_BAR_H+COMP_ROW_GAP), w, COMP_BAR_H, fe.pid, fe.fid);
      }

      // ── Mario ─────────────────────────────────────────────────────────
      updateMario(mario, gantt.filter(e=>e.pid>=0), tick, scale, cw, rowKeyToIndex);
      if (mario.visible && typeof MARIO_SPRITE_FRAMES!=='undefined')
        drawMarioSprite(ctx, mario.x, mario.y, mario.jumping, mario.frame);

    } else {
      // Paginación
      const steps=d.steps||[];
      const visN=Math.min(Math.floor(tick),steps.length);
      const bMaxW=cw-COMP_LEFT-20;
      const sw=steps.length>0?bMaxW/steps.length:bMaxW;
      ctx.fillStyle='rgba(255,255,255,.02)'; _roundRect(COMP_LEFT,COMP_TOP,bMaxW,COMP_BAR_H,5); ctx.fill();
      for(let s=0;s<visN;s++){
        const st=steps[s], x=COMP_LEFT+s*sw;
        if(st.fault){ drawProcessBar(x,COMP_TOP,sw-1,COMP_BAR_H,0); }
        else{
          ctx.fillStyle='#10B98166'; _roundRect(x,COMP_TOP,sw-1,COMP_BAR_H,3); ctx.fill();
          if(sw>12){ctx.fillStyle='#6ee7b7';ctx.font=`${Math.min(9,sw*.5)}px monospace`;ctx.textAlign='center';ctx.fillText(st.page_requested,x+sw/2,COMP_TOP+COMP_BAR_H/2+4);}
        }
      }
    }

    // Eje X
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(COMP_LEFT,axisY+8); ctx.lineTo(cw-12,axisY+8); ctx.stroke();
    const step=Math.max(1,Math.round(totalTime/12));
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='9px monospace'; ctx.textAlign='center';
    for(let t=0;t<=totalTime;t+=step){
      const x=COMP_LEFT+t*scale;
      ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.moveTo(x,axisY+6); ctx.lineTo(x,axisY+12); ctx.stroke();
      ctx.fillText(t,x,axisY+25);
    }

    // Cursor neón
    const cx2=COMP_LEFT+tick*scale;
    ctx.save(); ctx.shadowColor='#6EEB83'; ctx.shadowBlur=8;
    ctx.strokeStyle='#6EEB83'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx2,0); ctx.lineTo(cx2,axisY+4); ctx.stroke();
    ctx.restore(); ctx.setLineDash([]);
  }

  return { canvas, ctx, render, totalTime, coreSchedules:null, algoIdx, algoName:algoName, mario, d, isSched };
}

// ── Mario: corre sobre la barra del proceso activo ──
// rowY = y de la fila del proceso activo en el canvas
function updateMario(mario, realGantt, tick, scale, cw, rowKeyToIndex) {
  if (!realGantt.length || tick <= 0) { mario.visible=false; return; }
  mario.visible = true;

  // Bloque que corre ahora
  let running = null;
  for (const e of realGantt) {
    if (tick > e.start && tick <= e.end) { running=e; break; }
  }

  // X: sigue el frente del bloque activo
  const tx = running
    ? COMP_LEFT + Math.min(running.end, tick)*scale - CMW/2
    : COMP_LEFT + tick*scale - CMW/2;
  mario.x += (tx - mario.x) * 0.18;
  mario.x = Math.max(COMP_LEFT, Math.min(mario.x, cw - CMW - 4));

  // Y base: encima de la barra del proceso activo
  // La fila del proceso = COMP_TOP + rowIdx*(COMP_BAR_H+COMP_ROW_GAP)
  // Mario pisa la parte superior de la barra: sus pies en rowY → y = rowY - CMH
  const rowIdx = (running && rowKeyToIndex) ? (rowKeyToIndex[String(running.pid)] || 0) : 0;
  const rowY   = COMP_TOP + rowIdx * (COMP_BAR_H + COMP_ROW_GAP);
  mario.baseY  = rowY - CMH;  // pies encima de la barra

  // Salto en context switch — salta hacia arriba UNA altura de barra
  if (running && mario.lastBlock !== null && running.pid !== mario.lastBlock && !mario.jumping) {
    mario.jumping = true;
    mario.jumpVel = -(COMP_BAR_H * 5);  // ~140px/s hacia arriba con COMP_BAR_H=28
  }
  if (running) mario.lastBlock = running.pid;

  const dt = 1/60;
  if (mario.jumping) {
    mario.y       += mario.jumpVel * dt;
    mario.jumpVel += (COMP_BAR_H * 18) * dt;   // gravedad proporcional
    // Asegurar que no se va por arriba del canvas
    if (mario.y < 0) mario.y = 0;
    if (mario.y >= mario.baseY) {
      mario.y = mario.baseY; mario.jumping = false; mario.jumpVel = 0;
    }
  } else {
    mario.y = mario.baseY;
    mario.frameTimer = (mario.frameTimer||0) + dt;
    if (mario.frameTimer >= 0.12) { mario.frameTimer=0; mario.frame=(mario.frame+1)%4; }
  }
}

function drawMarioSprite(ctx, mx, my, jumping, frame) {
  if (typeof MARIO_SPRITE_FRAMES==='undefined') return;
  const keys = typeof MARIO_RUN_KEYS!=='undefined' ? MARIO_RUN_KEYS : ['stand','run1','run2','run1'];
  const key  = jumping ? 'jump' : keys[frame%4];
  const grid = MARIO_SPRITE_FRAMES[key] || MARIO_SPRITE_FRAMES.stand;
  const s = CMS;
  for(let r=0;r<16;r++) for(let c=0;c<16;c++){
    const col=grid[r][c]; if(col===null) continue;
    ctx.fillStyle=col; ctx.fillRect(Math.round(mx+c*s),Math.round(my+r*s),s,s);
  }
}

function roundRect(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

/* ═══ Loop de animación global ════════════════════════════════════════ */
let _compPlaying = false;
let _compSpeed   = 1.0;
let _compLastTs  = 0;

function CompPlayer_getTotalTime() {
  if (!CompPlayers.length) return 0;
  return Math.max(...CompPlayers.map(p=>p ? p.totalTime : 0));
}

function CompPlayer_getCurrentTick() {
  if (!CompPlayers.length) return 0;
  return CompPlayers[0] ? CompPlayers[0]._tick||0 : 0;
}

function _compTick(ts) {
  if (!_compPlaying) return;
  const dt   = Math.min((ts - _compLastTs)/1000, 0.1);
  _compLastTs = ts;
  const step  = dt * _compSpeed * 2;
  const total = CompPlayer_getTotalTime();

  let finished = true;
  CompPlayers.forEach((p, i) => {
    if (!p) return;
    p._tick = Math.min((p._tick||0) + step, p.totalTime);
    if (p._tick < p.totalTime) finished = false;
    p.render(p._tick);

    // Actualizar cores
    if (p.coreSchedules) updateCompCorePanel(i, p.coreSchedules, p._tick, p.totalTime);

    // Actualizar celdas en vivo
    if (p.isSched) updateLiveCellsSched(i, p.d, p._tick, p.totalTime);
    else           updateLiveCellsPage (i, p.d, Math.floor(p._tick), p.d.steps ? p.d.steps.length : 1);

    // Header del card
    updateCardHeader(i, p.d, p._tick, p.totalTime, p.isSched);
  });

  const tick = CompPlayer_getCurrentTick();
  const el = document.getElementById('comp-tick-label');
  if (el) el.textContent = `t = ${tick.toFixed(1)}`;
  const sc = document.getElementById('comp-step-counter');
  if (sc) sc.textContent = `${Math.round(tick)} / ${total}`;

  if (finished) {
    _compPlaying = false;
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar';
    fillTableFinal(Object.entries(Object.fromEntries(CompPlayers.filter(Boolean).map(p=>[p.algoName,p.d]))), CompPlayers[0]&&CompPlayers[0].isSched);
    return;
  }
  CompAnimId = requestAnimationFrame(_compTick);
}

function updateCardHeader(i, d, tick, totalTime, isSched) {
  const f = Math.min(tick/totalTime, 1);
  if (isSched) {
    const wt  = document.getElementById(`hdr-wt-${i}`);
    const tat = document.getElementById(`hdr-tat-${i}`);
    const cpu = document.getElementById(`hdr-cpu-${i}`);
    if (wt)  wt.textContent  = (d.avg_waiting*f).toFixed(2);
    if (tat) tat.textContent = (d.avg_turnaround*f).toFixed(2);
    if (cpu) cpu.textContent = (d.cpu_utilization*f).toFixed(1)+'%';
  } else {
    const pf = document.getElementById(`hdr-pf-${i}`);
    const hr = document.getElementById(`hdr-hr-${i}`);
    if (pf) pf.textContent = d.total_faults || '—';
    if (hr) hr.textContent = d.hit_rate ? d.hit_rate.toFixed(1)+'%' : '—';
  }
}

function startCompPlayer() {
  if (!CompPlayers.length) return;
  _compPlaying = true;
  _compLastTs  = performance.now();
  CompPlayers.forEach(p => { if (p) p._tick = 0; });
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = '<i class="ph ph-pause"></i> Pausar';
  CompAnimId = requestAnimationFrame(_compTick);
}

function toggleCompPlay() {
  if (_compPlaying) {
    _compPlaying = false;
    cancelAnimationFrame(CompAnimId);
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Reanudar';
  } else {
    const total = CompPlayer_getTotalTime();
    if (CompPlayer_getCurrentTick() >= total) CompPlayers.forEach(p=>{ if(p) p._tick=0; });
    _compPlaying = true;
    _compLastTs  = performance.now();
    const btn = document.getElementById('comp-btn-play');
    if (btn) btn.innerHTML = '<i class="ph ph-pause"></i> Pausar';
    CompAnimId = requestAnimationFrame(_compTick);
  }
}

function stopCompPlayer() {
  _compPlaying = false;
  cancelAnimationFrame(CompAnimId);
  cancelAnimationFrame(CompBarAnimId);
}

function compSeek(t) {
  stopCompPlayer();
  const total = CompPlayer_getTotalTime();
  const tick  = Math.max(0, Math.min(Number(t), total));
  CompPlayers.forEach((p,i) => {
    if (!p) return;
    p._tick = tick;
    p.render(tick);
    if (p.coreSchedules) updateCompCorePanel(i, p.coreSchedules, tick, p.totalTime);
    updateCardHeader(i, p.d, tick, p.totalTime, p.isSched);
  });
  const el = document.getElementById('comp-tick-label'); if (el) el.textContent=`t = ${tick.toFixed(1)}`;
  const sc = document.getElementById('comp-step-counter'); if (sc) sc.textContent=`${Math.round(tick)} / ${total}`;
  const btn = document.getElementById('comp-btn-play');
  if (btn) btn.innerHTML = tick>=total ? '<i class="ph ph-arrow-counter-clockwise"></i> Reiniciar' : '<i class="ph ph-play"></i> Reanudar';
}

function compStep(dir) {
  stopCompPlayer();
  const total = CompPlayer_getTotalTime();
  const cur   = CompPlayer_getCurrentTick();
  compSeek(cur + dir);
}

function setCompSpeed(val) {
  _compSpeed = parseFloat(val);
  const lbl = document.getElementById('comp-speed-label');
  if (lbl) lbl.textContent = parseFloat(val).toFixed(2).replace(/\.?0+$/,'')+'x';
}

/* ═══ Celdas en vivo ══════════════════════════════════════════════════ */
function flashCell(id,val){
  const el=document.getElementById(id); if(!el)return;
  if(el.dataset.finalVal===val)return;
  el.textContent=val;
  if(el.dataset.locked)return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'),500);
}
function lockCell(id,val){
  const el=document.getElementById(id); if(!el)return;
  el.textContent=val; el.dataset.finalVal=val; el.dataset.locked='1'; el.style.color='var(--text-primary)';
}
const _liveWT={};
function updateLiveCellsSched(idx,d,tick,totalTime){
  const f=Math.min(tick/totalTime,1); if(f<0.02)return;
  const fin=f>=0.99;
  const wt =fin?d.avg_waiting.toFixed(2)   :(d.avg_waiting   *f).toFixed(2);
  const tat=fin?d.avg_turnaround.toFixed(2):(d.avg_turnaround*f).toFixed(2);
  const cpu=fin?d.cpu_utilization.toFixed(1)+'%':(d.cpu_utilization*f).toFixed(1)+'%';
  if(fin){lockCell(`ct-wt-${idx}`,wt);lockCell(`ct-tat-${idx}`,tat);lockCell(`ct-cpu-${idx}`,cpu);}
  else{flashCell(`ct-wt-${idx}`,wt);flashCell(`ct-tat-${idx}`,tat);flashCell(`ct-cpu-${idx}`,cpu);
    _liveWT[idx]=parseFloat(wt);
    const vals=Object.values(_liveWT);
    if(vals.length>=2){const minV=Math.min(...vals);Object.entries(_liveWT).forEach(([i,v])=>{const el=document.getElementById(`ct-wt-${i}`);if(el){el.style.fontWeight=v===minV?'800':'400';el.style.textDecoration=v===minV?'underline':'none';}});}
  }
  if(CompPlayers.length) updateSubtablesLive(CompPlayers.map(p=>p?[p.algoName,p.d]:[]).filter(Boolean), tick, totalTime);
}
function updateLiveCellsPage(idx,d,step,total){
  if(step<=0||!d.steps)return;
  const now=d.steps.slice(0,step);
  const faults=now.filter(s=>s.fault).length;
  const hr=((step-faults)/step*100).toFixed(1)+'%';
  const fr=(faults/step*100).toFixed(1)+'%';
  const fin=step>=total;
  if(fin){lockCell(`ct-pf-${idx}`,String(faults));lockCell(`ct-hr-${idx}`,hr.replace('%',''));lockCell(`ct-fr-${idx}`,fr.replace('%',''));}
  else{flashCell(`ct-pf-${idx}`,String(faults));flashCell(`ct-hr-${idx}`,hr.replace('%',''));flashCell(`ct-fr-${idx}`,fr.replace('%',''));}
}

/* ═══ Gráficas de barras ══════════════════════════════════════════════ */
function startBarChartAnimation(entries,isSched){
  cancelAnimationFrame(CompBarAnimId);
  const bcDefs=isSched
    ?[{id:'cbc-wt',fn:(d,f)=>d.avg_waiting*f,higher:false},{id:'cbc-tat',fn:(d,f)=>d.avg_turnaround*f,higher:false},{id:'cbc-cpu',fn:(d,f)=>d.cpu_utilization*f,higher:true}]
    :[{id:'cbc-pf',fn:(d,f)=>(d.total_faults||0)*f,higher:false},{id:'cbc-hr',fn:(d,f)=>(d.hit_rate||0)*f,higher:true},{id:'cbc-fr',fn:(d,f)=>(d.fault_rate||0)*f,higher:false}];
  const names=entries.map(([n])=>n);
  function loop(){
    const frac=CompPlayers.length&&CompPlayers[0]&&CompPlayers[0].totalTime>0?Math.min((CompPlayers[0]._tick||0)/CompPlayers[0].totalTime,1):0;
    bcDefs.forEach(bc=>{
      const vals=entries.map(([,d])=>bc.fn(d,frac));
      const nMax=Math.max(...entries.map(([,d])=>bc.fn(d,1)),0.001)*1.18;
      drawBarChartMario(bc.id,names,vals,bc.higher,nMax);
    });
    if(_compPlaying||frac<1){CompBarAnimId=requestAnimationFrame(loop);}
    else{bcDefs.forEach(bc=>{const vals=entries.map(([,d])=>bc.fn(d,1));drawBarChartMario(bc.id,names,vals,bc.higher,Math.max(...entries.map(([,d])=>bc.fn(d,1)),0.001)*1.18);});generateAnalysis(entries,isSched);}
  }
  loop();
}

function drawBarChartMario(canvasId,labels,values,higherIsBetter,nMax){
  const canvas=document.getElementById(canvasId); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.clientWidth||280, H=300;
  canvas.width=W; canvas.height=H; canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const YAXIS=46,R=12,TOP=40,BOTTOM=64,chartH=H-TOP-BOTTOM,plotW=W-YAXIS-R;
  if(!nMax||nMax<=0)nMax=Math.max(...values,0.001)*1.18;
  ctx.clearRect(0,0,W,H); ctx.fillStyle='rgba(14,12,32,0.96)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.strokeRect(YAXIS,TOP,plotW,chartH);
  ctx.save();
  for(let i=0;i<=5;i++){
    const pct=i/5,y=TOP+chartH*(1-pct),val=(nMax/1.18)*pct;
    ctx.strokeStyle=i===0?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.06)';
    ctx.lineWidth=i===0?1.5:1; ctx.setLineDash(i===0?[]:[3,4]);
    ctx.beginPath();ctx.moveTo(YAXIS,y);ctx.lineTo(W-R,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='9px monospace';ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.fillText(val>=10?val.toFixed(1):val.toFixed(2),YAXIS-5,y);
  }
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(YAXIS,TOP);ctx.lineTo(YAXIS,TOP+chartH);ctx.stroke();ctx.restore();
  const n=labels.length,gap=Math.max(10,plotW*0.07),bw=Math.max(28,(plotW-gap*(n+1))/n);
  const totalBarsW=n*bw+gap*(n+1),startX=YAXIS+(plotW-totalBarsW)/2+gap;
  const isWinner=v=>higherIsBetter?v===Math.max(...values):v===Math.min(...values);
  values.forEach((v,i)=>{
    const x=startX+i*(bw+gap),barH=Math.max((v/nMax)*chartH,v>0?4:0),y=TOP+chartH-barH,c=marioBlockColor(i),win=isWinner(v);
    ctx.fillStyle='rgba(0,0,0,0.3)';roundRect(ctx,x+2,y+3,bw,barH,6);ctx.fill();
    const grad=ctx.createLinearGradient(x,y,x,y+barH);grad.addColorStop(0,c.top);grad.addColorStop(0.5,c.mid);grad.addColorStop(1,c.dark);
    ctx.fillStyle=grad;roundRect(ctx,x,y,bw,barH,6);ctx.fill();
    if(barH>10){ctx.fillStyle='rgba(255,255,255,0.18)';roundRect(ctx,x+3,y+3,bw-6,Math.min(barH*.25,10),3);ctx.fill();}
    if(win){ctx.save();ctx.strokeStyle='#FFD700';ctx.lineWidth=2.5;ctx.shadowColor='#FFD700';ctx.shadowBlur=12;roundRect(ctx,x-1.5,y-1.5,bw+3,barH+3,7);ctx.stroke();ctx.restore();}
    ctx.save();ctx.textAlign='center';ctx.textBaseline='bottom';
    if(win){const tw=ctx.measureText(v.toFixed(1)).width;ctx.fillStyle='rgba(255,215,0,0.15)';roundRect(ctx,x+bw/2-tw/2-6,y-28,tw+12,20,4);ctx.fill();ctx.fillStyle='#FFD700';ctx.font='bold 15px monospace';}
    else{ctx.font='bold 13px monospace';ctx.fillStyle='rgba(255,255,255,0.88)';}
    ctx.fillText(v.toFixed(1),x+bw/2,y-8);ctx.restore();
    ctx.save();ctx.textAlign='center';ctx.textBaseline='top';
    const maxLW=bw+gap*.5,words=labels[i].split(/\s+/),lines=[];let cur='';ctx.font='11px "Inter",sans-serif';
    words.forEach(w=>{const test=cur?cur+' '+w:w;if(ctx.measureText(test).width<=maxLW)cur=test;else{if(cur)lines.push(cur);cur=w;}});if(cur)lines.push(cur);
    const nameLines=lines.slice(0,2),baseY=TOP+chartH+10;
    nameLines.forEach((ln,li)=>{ctx.font=win?'bold 11px "Inter",sans-serif':'11px "Inter",sans-serif';ctx.fillStyle=win?c.top:'rgba(255,255,255,0.7)';ctx.fillText(ln,x+bw/2,baseY+li*14);});
    if(win){ctx.font='bold 10px "Inter",sans-serif';ctx.fillStyle='#FFD700';ctx.fillText('★ MEJOR',x+bw/2,baseY+nameLines.length*14+3);}
    ctx.restore();
  });
}

/* ═══ Análisis comparativo ════════════════════════════════════════════ */
function generateAnalysis(entries,isSched){
  const section=document.getElementById('comp-analysis-section'); if(!section)return;
  const appProcs=(window.AppState&&window.AppState.processes)||[];
  const vis=typeof getEffectiveVisibility==='function'?getEffectiveVisibility():{threadsVisible:false,forksVisible:false};
  const hasT=isSched&&vis.threadsVisible&&appProcs.some(p=>p.threads&&p.threads.length);
  const hasF=isSched&&vis.forksVisible  &&appProcs.some(p=>p.forks  &&p.forks.length);
  if(isSched){
    const sw=[...entries].sort((a,b)=>a[1].avg_waiting-b[1].avg_waiting);
    const sc=[...entries].sort((a,b)=>b[1].cpu_utilization-a[1].cpu_utilization);
    const sx=[...entries].sort((a,b)=>(a[1].context_switches||0)-(b[1].context_switches||0));
    const bwt=sw[0],wwt=sw[sw.length-1],bcpu=sc[0],bctx=sx[0],wctx=sx[sx.length-1];
    const c_bwt=PID_COLORS[entries.findIndex(([n])=>n===bwt[0])%PID_COLORS.length];
    const c_bcpu=PID_COLORS[entries.findIndex(([n])=>n===bcpu[0])%PID_COLORS.length];
    const diff=bwt[1].avg_waiting>0?((wwt[1].avg_waiting-bwt[1].avg_waiting)/bwt[1].avg_waiting*100).toFixed(0):0;
    const totalT=hasT?appProcs.reduce((s,p)=>s+(p.threads?p.threads.length:0),0):0;
    const totalF=hasF?appProcs.reduce((s,p)=>s+(p.forks  ?p.forks.length  :0),0):0;
    const tNote=hasT?`<p><strong>🧵 Threads (${totalT}):</strong> Comparten memoria del proceso padre. Los algoritmos preemptivos (${entries.filter(([n])=>SCHEDULING_META[n]&&SCHEDULING_META[n].preemptive&&SCHEDULING_META[n].preemptive.includes('✅')).map(([n])=>n).join(', ')||'ninguno'}) los intercalan con mayor granularidad, reduciendo latencia percibida a costa de más context switches.</p>`:'';
    const fNote=hasF?`<p><strong>⑂ Forks (${totalF}):</strong> Procesos hijo con copia de memoria independiente (copy-on-write). Aparecen como entidades separadas al scheduler, lo que puede aumentar el WT si el scheduler no distingue por prioridad entre padre e hijo.</p>`:'';
    section.innerHTML=`<div class="comp-analysis">
      <h4>🏆 Análisis comparativo de resultados</h4>
      <p><strong>Menor Waiting Time:</strong> <span class="winner-badge" style="background:${c_bwt}22;border:1px solid ${c_bwt}55;color:${c_bwt}">★ ${bwt[0]} — ${bwt[1].avg_waiting.toFixed(2)} ms</span> ${wwt[0]!==bwt[0]?`vs <strong>${wwt[0]}</strong> (${wwt[1].avg_waiting.toFixed(2)} ms). Diferencia: <strong>${diff}%</strong>.`:''}</p>
      <p><strong>Mayor CPU:</strong> <span class="winner-badge" style="background:${c_bcpu}22;border:1px solid ${c_bcpu}55;color:${c_bcpu}">★ ${bcpu[0]} — ${bcpu[1].cpu_utilization.toFixed(1)}%</span></p>
      <p><strong>Ctx switches:</strong> <strong>${bctx[0]}</strong> (${bctx[1].context_switches||0}) vs <strong>${wctx[0]}</strong> (${wctx[1].context_switches||0}).</p>
      ${tNote}${fNote}
      <p><strong>Cores (${CompState.numCores}):</strong> PID→Core round-robin por orden de llegada. Algoritmos preemptivos redistribuyen en cada quantum; no-preemptivos mantienen un proceso en el mismo core hasta terminar.</p>
      <ul>${entries.map(([name,d])=>{const m=SCHEDULING_META[name];if(!m)return'';
        return`<li><strong>${name}</strong> — WT: ${d.avg_waiting.toFixed(2)}, CPU: ${d.cpu_utilization.toFixed(1)}%, Ctx: ${d.context_switches||0}. ${name===bwt[0]?'✅ Mejor WT. ':''} ${name===bcpu[0]?'✅ Mejor CPU. ':''} ${m.starvation&&m.starvation.includes('⚠️')?'⚠️ Starvation posible.':''}</li>`;
      }).join('')}</ul>
    </div>`;
  }else{
    const sf=[...entries].sort((a,b)=>a[1].total_faults-b[1].total_faults);
    const bf=sf[0],wf=sf[sf.length-1],c_bf=PID_COLORS[entries.findIndex(([n])=>n===bf[0])%PID_COLORS.length];
    section.innerHTML=`<div class="comp-analysis">
      <h4>🏆 Análisis comparativo de paginación</h4>
      <p><strong>Menos Page Faults:</strong> <span class="winner-badge" style="background:${c_bf}22;border:1px solid ${c_bf}55;color:${c_bf}">★ ${bf[0]} — ${bf[1].total_faults} fallos</span> vs <strong>${wf[0]}</strong> (${wf[1].total_faults} fallos).</p>
      <ul>${entries.map(([name,d])=>{const m=PAGING_META[name];if(!m)return'';
        return`<li><strong>${name}</strong> — ${d.total_faults} fallos, Hit Rate: ${d.hit_rate.toFixed(1)}%. ${name===bf[0]?'✅ Menor page faults. ':''} ${m.belady&&m.belady.includes('⚠️')?'⚠️ Bélady.':m.belady?'✅ Sin anomalía.':''}</li>`;
      }).join('')}</ul>
    </div>`;
  }
}

/* ═══ Subtablas + tabla final ═════════════════════════════════════════ */
function buildProcessSubtables(entries,isSched){
  const container=document.getElementById('comp-process-subtables');
  if(!container)return; if(!isSched){container.innerHTML='';return;}
  const html=entries.map(([name,d],ei)=>{
    const color=PID_COLORS[ei%PID_COLORS.length]; const metrics=d.metrics||[]; if(!metrics.length)return'';
    const rows=metrics.map((m,mi)=>{const pc=PID_COLORS[m.pid%PID_COLORS.length];
      return`<tr><td style="font-weight:700;text-align:center;color:#222"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${pc};margin-right:4px;vertical-align:middle"></span>P${m.pid}</td>
        <td style="text-align:center;color:#555;font-size:11px">${m.arrival_time}</td><td style="text-align:center;color:#555;font-size:11px">${m.burst_time}</td>
        <td id="stct-${ei}-${mi}" style="text-align:center;color:#222">—</td><td id="sttat-${ei}-${mi}" style="text-align:center;color:#222">—</td><td id="stwt-${ei}-${mi}" style="text-align:center;color:#222">—</td></tr>`;
    }).join('');
    return`<div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:${color};margin-bottom:5px;display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${name}</div>
      <div class="table-wrapper"><table style="font-size:11px;background:#fff;color:#111">
        <thead><tr style="background:${color}22;color:#333"><th style="text-align:center">PID</th><th style="text-align:center">AT</th><th style="text-align:center">BT</th><th style="text-align:center">CT</th><th style="text-align:center">TAT</th><th style="text-align:center">WT</th></tr></thead>
        <tbody>${rows}<tr style="background:#f5f5f5;font-style:italic"><td colspan="4" style="text-align:right;font-size:10px;color:#666;padding-right:8px">Promedio:</td><td id="stavgtat-${ei}" style="text-align:center;font-weight:700;color:#111">—</td><td id="stavgwt-${ei}" style="text-align:center;font-weight:700;color:#111">—</td></tr></tbody>
      </table></div>
    </div>`;
  }).join('');
  container.innerHTML=`<div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-top:12px;border-top:1px solid var(--border)"><i class="ph ph-function"></i> Cálculo por proceso</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px">${html}</div>`;
}

function updateSubtablesLive(entries,tick,totalTime,force){
  if(!entries)return;
  entries.forEach(([name,d],ei)=>{
    const metrics=d.metrics||[],frac=Math.min(tick/totalTime,1),fin=frac>=0.99||force;
    let sumT=0,sumW=0,cnt=0;
    metrics.forEach((m,mi)=>{
      const ctF=totalTime>0?(m.completion_time/totalTime):1;
      if(frac<ctF*.98&&!fin)return;
      const setCell=(id,val)=>{const el=document.getElementById(id);if(el&&(force||el.textContent!==String(val)))el.textContent=val;};
      setCell(`stct-${ei}-${mi}`,m.completion_time??'—');
      setCell(`sttat-${ei}-${mi}`,fin?`${m.completion_time}−${m.arrival_time} = ${m.turnaround_time}`:m.turnaround_time??'—');
      setCell(`stwt-${ei}-${mi}`, fin?`${m.turnaround_time}−${m.burst_time} = ${m.waiting_time}`:m.waiting_time??'—');
      sumT+=m.turnaround_time||0;sumW+=m.waiting_time||0;cnt++;
    });
    if(cnt>0){const sa=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};sa(`stavgtat-${ei}`,(sumT/cnt).toFixed(2));sa(`stavgwt-${ei}`,(sumW/cnt).toFixed(2));}
  });
}

function fillTableFinal(entries,isSched){
  if(!entries||!entries.length)return;
  const avgRow=document.getElementById('comp-avg-row'),winnerRow=document.getElementById('comp-winner-row'),winnerCell=document.getElementById('comp-winner-cell');
  if(!avgRow)return;
  if(isSched){
    const vwt=entries.map(([,d])=>d.avg_waiting),vtat=entries.map(([,d])=>d.avg_turnaround),vcpu=entries.map(([,d])=>d.cpu_utilization);
    const avg=arr=>arr.reduce((s,v)=>s+v,0)/arr.length;
    const aw=document.getElementById('avg-wt'),at=document.getElementById('avg-tat'),ac=document.getElementById('avg-cpu');
    if(aw)aw.textContent=avg(vwt).toFixed(2);if(at)at.textContent=avg(vtat).toFixed(2);if(ac)ac.textContent=avg(vcpu).toFixed(1)+'%';
    avgRow.style.display='';
    const minWT=Math.min(...vwt),maxCPU=Math.max(...vcpu);
    entries.forEach(([,d],i)=>{
      if(d.avg_waiting===minWT){const el=document.getElementById(`ct-wt-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
      if(d.cpu_utilization===maxCPU){const el=document.getElementById(`ct-cpu-${i}`);if(el){el.style.fontWeight='900';el.style.color=PID_COLORS[i%PID_COLORS.length];}}
    });
    const wi=vwt.indexOf(minWT),wn=entries[wi][0],wc=PID_COLORS[wi%PID_COLORS.length];
    if(winnerCell)winnerCell.innerHTML=`🏆 <strong>Mejor:</strong> <span style="padding:2px 12px;border-radius:99px;background:${wc}22;border:1px solid ${wc}55;color:${wc};font-weight:700;margin:0 6px">${wn}</span> — WT: ${minWT.toFixed(2)} ms, CPU: ${entries[wi][1].cpu_utilization.toFixed(1)}%`;
    if(winnerRow)winnerRow.style.display='';
    buildProcessSubtables(entries,true);
    updateSubtablesLive(entries,1,1,true);
  }else{
    const vpf=entries.map(([,d])=>d.total_faults||0),vhr=entries.map(([,d])=>d.hit_rate||0),vfr=entries.map(([,d])=>d.fault_rate||0);
    const avg=arr=>arr.reduce((s,v)=>s+v,0)/arr.length;
    ['avg-pf','avg-hr','avg-fr'].forEach((id,ii)=>{const el=document.getElementById(id);if(el)el.textContent=[vpf,vhr,vfr][ii].reduce((s,v)=>s+v,0)/[vpf,vhr,vfr][ii].length+(['',' %',' %'][ii]);});
    avgRow.style.display='';
    const minPF=Math.min(...vpf),wi=vpf.indexOf(minPF),wn=entries[wi][0],wc=PID_COLORS[wi%PID_COLORS.length];
    if(winnerCell)winnerCell.innerHTML=`🏆 <strong>Mejor:</strong> <span style="padding:2px 12px;border-radius:99px;background:${wc}22;border:1px solid ${wc}55;color:${wc};font-weight:700;margin:0 6px">${wn}</span> — ${minPF} faults, Hit Rate: ${entries[wi][1].hit_rate.toFixed(1)}%`;
    if(winnerRow)winnerRow.style.display='';
  }
}


/* ═══ Utilidades ══════════════════════════════════════════════════════ */
function clearCompResults() {
  stopCompPlayer();
  const r = document.getElementById('comp-results');
  if (r) r.innerHTML = '';
}

/* ═══ Exports + auto-init ═════════════════════════════════════════════ */
window.runComparison  = runComparison;
window.initComparison = initComparison;
window.setCompCategory= setCompCategory;
window.setCompCores   = setCompCores;
window.toggleCompPlay = toggleCompPlay;
window.stopCompPlayer = stopCompPlayer;
window.compSeek       = compSeek;
window.compStep       = compStep;
window.setCompSpeed   = setCompSpeed;
window.updateCompQuantumVisibility = updateCompQuantumVisibility;

(function(){
  function tryInit(){ const g=document.getElementById('comp-algo-grid'); if(g&&g.children.length===0) initComparison(); }
  document.addEventListener('DOMContentLoaded',()=>{
    const nb=document.getElementById('nav-comparison'); if(nb)nb.addEventListener('click',tryInit);
    const sc=document.getElementById('screen-comparison'); if(sc&&sc.classList.contains('active'))tryInit();
  });
})();