/**
 * comparison.js — Algorithm Comparison v2
 *
 * Nuevas funciones:
 *  - Tabs: Scheduling vs Paginación (no se mezclan)
 *  - Selección de 2–4 algoritmos de scheduling ó 2–5 de paginación
 *  - Selector de cores (1/2/4/8) — enviado al backend para simular paralelismo
 *  - Mensaje de caso de uso real por algoritmo
 *  - Ganador resaltado con ★ en gráficas y tabla
 *  - Métricas extendidas (ctx switches, page faults, hit rate)
 */

/* ═══════════════════════════════════════════════════════════════════════
   Metadatos de algoritmos
   ═══════════════════════════════════════════════════════════════════════ */

const SCHEDULING_META = {
  'FCFS':                   { short: 'First-Come, First-Served',   useCase: 'Sistemas batch simples y colas de impresión. Sin starvation, pero penaliza procesos cortos que llegan tarde.' },
  'SJF':                    { short: 'Shortest Job First',          useCase: 'Entornos de tiempo compartido donde se conocen los burst times. Minimiza el tiempo de espera promedio pero puede causar starvation.' },
  'HRRN':                   { short: 'Highest Response Ratio Next', useCase: 'Sistemas mixtos batch/interactivo que necesitan prevenir starvation sin sacrificar eficiencia.' },
  'Round Robin':            { short: 'Quantum configurable',        useCase: 'Sistemas interactivos y de tiempo real. Garantiza equidad. El quantum debe calibrarse según la carga.' },
  'SRTF':                   { short: 'Shortest Remaining Time',     useCase: 'Minimiza el tiempo de espera total. Usada en servidores web. Alta complejidad y posible starvation en procesos largos.' },
  'Priority (Preemptive)':  { short: 'Prioridad preemptiva',        useCase: 'Kernels de SO y sistemas de tiempo real. Requiere mecanismos de aging para evitar starvation de baja prioridad.' },
  'Multilevel Queue':       { short: 'Colas por categoría fija',    useCase: 'Sistemas con clases de procesos bien definidas: sistema, interactivo, batch. Los procesos no cambian de cola.' },
  'MLFQ':                   { short: 'Feedback dinámico',           useCase: 'Sistemas de propósito general modernos. Aprende el comportamiento de cada proceso sin necesitar burst times.' },
};

const PAGING_META = {
  'FIFO':          { short: 'First-In, First-Out',        useCase: 'Implementación más simple. Sufre la anomalía de Bélady: más frames pueden dar más fallos de página.' },
  'LRU':           { short: 'Least Recently Used',         useCase: 'El más usado en la práctica (Linux, Windows). Aprovecha la localidad temporal. Se aproxima con bit de referencia.' },
  'Optimal':       { short: 'Bélady (teórico)',            useCase: 'Referencia teórica imposible en tiempo real. Sirve como benchmark para medir otros algoritmos.' },
  'Clock':         { short: 'Reloj circular',              useCase: 'Aproximación eficiente a LRU usada en Linux (page daemon). O(1) por sustitución, bajo overhead.' },
  'Second Chance': { short: 'Enhanced Clock',              useCase: 'Variante del Clock con bit dirty. Reduce I/O de swap priorizando la expulsión de páginas limpias.' },
};

/* ═══════════════════════════════════════════════════════════════════════
   Estado local de la pantalla
   ═══════════════════════════════════════════════════════════════════════ */

const CompState = {
  category: 'scheduling',   // 'scheduling' | 'paging'
  selected: [],
  numCores: 4,
  lastResults: null,
};

/* ═══════════════════════════════════════════════════════════════════════
   Init — se llama cuando se muestra la pantalla de Comparison
   ═══════════════════════════════════════════════════════════════════════ */

function initComparison() {
  buildAlgoCards('scheduling');
}

/* ═══════════════════════════════════════════════════════════════════════
   Cambio de categoría
   ═══════════════════════════════════════════════════════════════════════ */

function setCompCategory(cat) {
  CompState.category = cat;
  CompState.selected = [];

  document.getElementById('comp-tab-sched').classList.toggle('active', cat === 'scheduling');
  document.getElementById('comp-tab-page').classList.toggle('active', cat === 'paging');

  const maxSel = cat === 'scheduling' ? 4 : 5;
  // Mostrar/ocultar controles por categoría
  document.getElementById('comp-sched-opts').style.display = cat === 'scheduling' ? 'flex' : 'none';
  document.getElementById('comp-page-opts').style.display  = cat === 'paging'     ? 'flex' : 'none';

  document.getElementById('comp-algo-hint').textContent =
    `Selecciona 2–${maxSel} algoritmos de ${cat === 'scheduling' ? 'scheduling' : 'paginación'}`;

  buildAlgoCards(cat);
  clearCompResults();
  updateSelCount();
  document.getElementById('btn-run-comparison').disabled = true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Construir tarjetas de algoritmos
   ═══════════════════════════════════════════════════════════════════════ */

function buildAlgoCards(cat) {
  const grid = document.getElementById('comp-algo-grid');
  grid.innerHTML = '';
  const meta = cat === 'scheduling' ? SCHEDULING_META : PAGING_META;
  const colors = PID_COLORS;

  Object.entries(meta).forEach(([name, info], i) => {
    const color = colors[i % colors.length];
    const card = document.createElement('div');
    card.className = 'comp-algo-card';
    card.dataset.name = name;
    card.style.borderColor = 'var(--border)';
    card.innerHTML = `
      <div class="comp-algo-name" style="color:var(--text-primary);font-weight:600;font-size:13px">${name}</div>
      <div class="comp-algo-short" style="color:var(--text-muted);font-size:11px">${info.short}</div>
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
    card.style.borderColor = 'var(--border)';
    card.style.background = '';
    card.style.boxShadow = '';
  } else {
    if (CompState.selected.length >= maxSel) return;
    CompState.selected.push(name);
    card.style.borderColor = color;
    card.style.background = color + '18';
    card.style.boxShadow = `0 0 0 2px ${color}44`;
  }

  updateSelCount();
  document.getElementById('btn-run-comparison').disabled = CompState.selected.length < 2;
}

function updateSelCount() {
  const maxSel = CompState.category === 'scheduling' ? 4 : 5;
  document.getElementById('comp-sel-count').textContent =
    `${CompState.selected.length} / ${maxSel} seleccionados`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Cores
   ═══════════════════════════════════════════════════════════════════════ */

function setCompCores(val) {
  CompState.numCores = parseInt(val);
  document.getElementById('comp-cores-label').textContent = `${val} core${val > 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   Ejecutar comparación
   ═══════════════════════════════════════════════════════════════════════ */

async function runComparison() {
  if (CompState.selected.length < 2) return;

  if (CompState.category === 'scheduling' && AppState.processes.length === 0) {
    showToast('Agrega procesos primero en la pantalla de Processes', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-comparison');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Ejecutando threads...';

  const threadLog = document.getElementById('comp-thread-log');
  const nParallel = Math.min(CompState.selected.length, CompState.numCores);
  threadLog.textContent = `⚙  ${CompState.selected.length} threads lanzados | ${CompState.numCores} core(s) | ${nParallel} en paralelo…`;

  clearCompResults();

  try {
    let results;

    if (CompState.category === 'scheduling') {
      const quantum = parseInt(document.getElementById('comp-quantum').value) || 2;
      results = await apiCall('/api/schedule/compare-selected', {
        algorithms:  CompState.selected,
        quantum:     quantum,
        num_cores:   CompState.numCores,
        processes:   AppState.processes,
      });
    } else {
      const refStr = document.getElementById('comp-ref-string').value
        .split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0);
      const frames = parseInt(document.getElementById('comp-frames').value) || 3;
      if (refStr.length === 0) {
        showToast('Ingresa una cadena de referencia válida', 'warning');
        return;
      }
      results = await apiCall('/api/page-replacement/compare', {
        algorithms:       CompState.selected,
        reference_string: refStr,
        num_frames:       frames,
        num_cores:        CompState.numCores,
      });
    }

    CompState.lastResults = results;

    if (CompState.category === 'scheduling') {
      renderSchedResults(results);
    } else {
      renderPageResults(results);
    }

    const n = Object.keys(results).filter(k => !results[k].error).length;
    threadLog.textContent = `✓  ${n} threads completados`;
    showToast(`${n} algoritmos comparados`, 'success');

  } catch (err) {
    threadLog.textContent = `❌  Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-play"></i> Comparar';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Render: Scheduling
   ═══════════════════════════════════════════════════════════════════════ */

function renderSchedResults(results) {
  const container = document.getElementById('comp-results');
  const entries   = Object.entries(results).filter(([,d]) => !d.error);
  if (!entries.length) return;

  // Ganadores
  const bestWT  = entries.reduce((b, [n,d]) => d.avg_waiting    < b[1].avg_waiting    ? [n,d] : b, entries[0]);
  const bestTAT = entries.reduce((b, [n,d]) => d.avg_turnaround < b[1].avg_turnaround ? [n,d] : b, entries[0]);
  const bestRT  = entries.reduce((b, [n,d]) => d.avg_response   < b[1].avg_response   ? [n,d] : b, entries[0]);
  const bestCPU = entries.reduce((b, [n,d]) => d.cpu_utilization > b[1].cpu_utilization ? [n,d] : b, entries[0]);

  const algos   = entries.map(([n]) => n);
  const colors  = entries.map(([,], i) => PID_COLORS[i % PID_COLORS.length]);

  container.innerHTML = `
    <!-- Métricas resumen -->
    <div class="comp-summary-grid">
      ${metricCard('Mejor Waiting Time',    bestWT[0],  bestWT[1].avg_waiting.toFixed(2)   + ' ms')}
      ${metricCard('Mejor Turnaround',      bestTAT[0], bestTAT[1].avg_turnaround.toFixed(2) + ' ms')}
      ${metricCard('Mejor Response Time',   bestRT[0],  bestRT[1].avg_response.toFixed(2)  + ' ms')}
      ${metricCard('Mayor CPU Utilization', bestCPU[0], bestCPU[1].cpu_utilization.toFixed(1) + '%')}
    </div>

    <!-- Gráficas -->
    <div class="chart-grid" style="margin-top:16px">
      ${chartCard('comp-chart-wt',  'Avg Waiting Time (ms)')}
      ${chartCard('comp-chart-tat', 'Avg Turnaround Time (ms)')}
      ${chartCard('comp-chart-rt',  'Avg Response Time (ms)')}
      ${chartCard('comp-chart-cpu', 'CPU Utilization (%)')}
    </div>

    <!-- Tabla -->
    <div class="card mt-lg">
      <div class="card-title"><span class="card-icon"><i class="ph ph-clipboard-text"></i></span>Tabla de métricas</div>
      <div class="table-wrapper">
        <table id="comp-table-sched">
          <thead><tr>
            <th>Algoritmo</th><th>Core</th>
            <th>Avg WT</th><th>Avg TAT</th><th>Avg RT</th>
            <th>CPU %</th><th>Ctx Switches</th><th>Tiempo sim.</th>
          </tr></thead>
          <tbody id="comp-tbody-sched"></tbody>
        </table>
      </div>
    </div>

    <!-- Casos de uso -->
    <div class="card mt-lg">
      <div class="card-title"><span class="card-icon"><i class="ph ph-lightbulb"></i></span>¿Cuándo usar cada algoritmo?</div>
      <div id="comp-use-cases"></div>
    </div>
  `;

  // Dibujar gráficas
  drawBarChart('comp-chart-wt',  algos, entries.map(([,d]) => d.avg_waiting),     'Avg Waiting Time',    'ms',  bestWT[0]);
  drawBarChart('comp-chart-tat', algos, entries.map(([,d]) => d.avg_turnaround),  'Avg Turnaround',      'ms',  bestTAT[0]);
  drawBarChart('comp-chart-rt',  algos, entries.map(([,d]) => d.avg_response),    'Avg Response Time',   'ms',  bestRT[0]);
  drawBarChart('comp-chart-cpu', algos, entries.map(([,d]) => d.cpu_utilization), 'CPU Utilization',     '%',   bestCPU[0]);

  // Tabla
  const tbody = document.getElementById('comp-tbody-sched');
  tbody.innerHTML = entries.map(([name, d], i) => {
    const c = PID_COLORS[i % PID_COLORS.length];
    const core = i % CompState.numCores;
    const wBest = name === bestWT[0]  ? 'font-weight:700;color:var(--success)' : '';
    const tBest = name === bestTAT[0] ? 'font-weight:700;color:var(--success)' : '';
    return `<tr>
      <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:8px"></span>${name}</td>
      <td>Core ${core}</td>
      <td style="${wBest}">${d.avg_waiting.toFixed(2)}${name===bestWT[0]?' ★':''}</td>
      <td style="${tBest}">${d.avg_turnaround.toFixed(2)}${name===bestTAT[0]?' ★':''}</td>
      <td>${d.avg_response.toFixed(2)}</td>
      <td>${d.cpu_utilization.toFixed(1)}</td>
      <td>${d.context_switches}</td>
      <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1)+' ms' : '—'}</td>
    </tr>`;
  }).join('');

  // Casos de uso
  const uc = document.getElementById('comp-use-cases');
  uc.innerHTML = entries.map(([name], i) => {
    const m = SCHEDULING_META[name];
    if (!m) return '';
    const c = PID_COLORS[i % PID_COLORS.length];
    return `<div class="use-case-box" style="border-left:3px solid ${c};padding:8px 12px;margin-bottom:8px;background:var(--bg-card);border-radius:0 6px 6px 0">
      <div style="font-weight:600;font-size:13px;color:${c};margin-bottom:3px">${name} — <span style="font-weight:400">${m.short}</span></div>
      <div style="font-size:12px;color:var(--text-secondary)">${m.useCase}</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   Render: Paginación
   ═══════════════════════════════════════════════════════════════════════ */

function renderPageResults(results) {
  const container = document.getElementById('comp-results');
  const entries   = Object.entries(results).filter(([,d]) => !d.error);
  if (!entries.length) return;

  const bestFaults = entries.reduce((b,[n,d]) => d.total_faults < b[1].total_faults ? [n,d] : b, entries[0]);
  const bestRate   = entries.reduce((b,[n,d]) => d.fault_rate   < b[1].fault_rate   ? [n,d] : b, entries[0]);
  const algos = entries.map(([n]) => n);

  container.innerHTML = `
    <div class="comp-summary-grid">
      ${metricCard('Menos Page Faults', bestFaults[0], String(bestFaults[1].total_faults))}
      ${metricCard('Menor Fault Rate',  bestRate[0],  bestRate[1].fault_rate.toFixed(1) + '%')}
      ${metricCard('Frames usados',     '—',          String(entries[0][1].num_frames))}
      ${metricCard('Longitud ref str',  '—',          String(entries[0][1].ref_length))}
    </div>
    <div class="chart-grid" style="margin-top:16px">
      ${chartCard('comp-chart-pf',  'Page Faults totales')}
      ${chartCard('comp-chart-fr',  'Fault Rate (%)')}
    </div>
    <div class="card mt-lg">
      <div class="card-title"><span class="card-icon"><i class="ph ph-clipboard-text"></i></span>Tabla de métricas</div>
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Algoritmo</th><th>Core</th>
            <th>Page Faults</th><th>Hit Rate %</th><th>Fault Rate %</th>
            <th>Frames</th><th>Tiempo sim.</th>
          </tr></thead>
          <tbody id="comp-tbody-page"></tbody>
        </table>
      </div>
    </div>
    <div class="card mt-lg">
      <div class="card-title"><span class="card-icon"><i class="ph ph-lightbulb"></i></span>¿Cuándo usar cada algoritmo?</div>
      <div id="comp-use-cases-page"></div>
    </div>
  `;

  drawBarChart('comp-chart-pf', algos, entries.map(([,d]) => d.total_faults), 'Page Faults', '', bestFaults[0]);
  drawBarChart('comp-chart-fr', algos, entries.map(([,d]) => d.fault_rate),   'Fault Rate',  '%', bestRate[0]);

  const tbody = document.getElementById('comp-tbody-page');
  tbody.innerHTML = entries.map(([name, d], i) => {
    const c = PID_COLORS[i % PID_COLORS.length];
    const core = i % CompState.numCores;
    const best = name === bestFaults[0] ? 'font-weight:700;color:var(--success)' : '';
    return `<tr>
      <td style="font-weight:600"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:8px"></span>${name}</td>
      <td>Core ${core}</td>
      <td style="${best}">${d.total_faults}${name===bestFaults[0]?' ★':''}</td>
      <td>${d.hit_rate.toFixed(1)}</td>
      <td>${d.fault_rate.toFixed(1)}</td>
      <td>${d.num_frames}</td>
      <td>${d.elapsed_ms != null ? d.elapsed_ms.toFixed(1)+' ms' : '—'}</td>
    </tr>`;
  }).join('');

  const uc = document.getElementById('comp-use-cases-page');
  uc.innerHTML = entries.map(([name], i) => {
    const m = PAGING_META[name]; if (!m) return '';
    const c = PID_COLORS[i % PID_COLORS.length];
    return `<div style="border-left:3px solid ${c};padding:8px 12px;margin-bottom:8px;background:var(--bg-card);border-radius:0 6px 6px 0">
      <div style="font-weight:600;font-size:13px;color:${c};margin-bottom:3px">${name} — <span style="font-weight:400">${m.short}</span></div>
      <div style="font-size:12px;color:var(--text-secondary)">${m.useCase}</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers de render
   ═══════════════════════════════════════════════════════════════════════ */

function metricCard(label, algo, value) {
  return `<div class="card" style="text-align:center;padding:12px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${label}</div>
    <div style="font-size:20px;font-weight:700;color:var(--accent)">${value}</div>
    <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${algo}</div>
  </div>`;
}

function chartCard(canvasId, title) {
  return `<div class="card">
    <div class="card-title"><span class="card-icon"><i class="ph ph-chart-bar"></i></span>${title}</div>
    <div class="chart-container"><canvas id="${canvasId}" height="260"></canvas></div>
  </div>`;
}

function clearCompResults() {
  document.getElementById('comp-results').innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════════════════
   Bar Chart (actualizado con soporte winner)
   ═══════════════════════════════════════════════════════════════════════ */

function drawBarChart(canvasId, labels, values, title, unit, winnerLabel) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight > 0 ? container.clientHeight : 260;

  canvas.width  = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  const LEFT = 60, RIGHT = 24, TOP = 20, BOTTOM = 56;
  const chartW = width - LEFT - RIGHT;
  const chartH = height - TOP - BOTTOM;
  const maxVal = Math.max(...values, 0.01);
  const niceMax = Math.ceil(maxVal * 1.15);

  const barCount = values.length;
  const barGap = 12;
  const totalGap = barGap * (barCount + 1);
  const barWidth = Math.min((chartW - totalGap) / barCount, 70);
  const totalBarsW = barCount * barWidth + totalGap;
  const startX = LEFT + (chartW - totalBarsW) / 2 + barGap;

  let progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0;
  let animId, hoveredIndex = -1;

  let tooltip = document.getElementById(canvasId + '-tip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = canvasId + '-tip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
  }

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    hoveredIndex = -1;
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barGap);
      const barH = (values[i] / niceMax) * chartH * progress;
      const y = TOP + chartH - barH;
      if (mx >= x && mx <= x + barWidth && my >= y && my <= TOP + chartH) {
        hoveredIndex = i;
        const isWinner = labels[i] === winnerLabel;
        const color = PID_COLORS[i % PID_COLORS.length];
        tooltip.innerHTML = `<strong style="color:${color}">${labels[i]}${isWinner ? ' ★' : ''}</strong><br>${title}: ${values[i].toFixed(2)} ${unit}`;
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top  = (e.clientY - 10) + 'px';
        tooltip.classList.add('visible');
        canvas.style.cursor = 'pointer';
        render(); return;
      }
    }
    tooltip.classList.remove('visible');
    canvas.style.cursor = 'default';
    render();
  };
  canvas.onmouseleave = () => { hoveredIndex = -1; tooltip.classList.remove('visible'); render(); };

  function render() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    for (let i = 0; i <= 5; i++) {
      const y = TOP + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(width - RIGHT, y); ctx.stroke();
      ctx.fillStyle = '#475569'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
      ctx.fillText((niceMax * (1 - i/5)).toFixed(1), LEFT - 6, y + 4);
    }
    ctx.setLineDash([]);

    // Barras
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barGap);
      const barH = (values[i] / niceMax) * chartH * progress;
      const y = TOP + chartH - barH;
      const color = PID_COLORS[i % PID_COLORS.length];
      const isWinner = labels[i] === winnerLabel;
      const isHovered = i === hoveredIndex;

      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '88');

      const r = Math.min(6, barWidth / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, y + barH); ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath(); ctx.fillStyle = grad;

      if (isHovered || isWinner) {
        ctx.shadowColor = color; ctx.shadowBlur = isWinner ? 16 : 10;
      } else {
        ctx.shadowColor = 'rgba(15,23,42,0.12)'; ctx.shadowBlur = 4;
      }
      ctx.shadowOffsetY = 2; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // Valor + estrella ganador
      if (progress > 0.5) {
        ctx.fillStyle = isWinner ? '#059669' : '#0F172A';
        ctx.font = `${isWinner ? 'bold' : ''} 10px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(values[i].toFixed(1) + (isWinner ? ' ★' : ''), x + barWidth / 2, y - 6);
      }

      // Etiqueta eje X
      ctx.fillStyle = isWinner ? '#059669' : '#475569';
      ctx.font = `${isWinner ? 'bold' : ''} 9px sans-serif`;
      ctx.textAlign = 'center';
      const lbl = labels[i].length > 11 ? labels[i].slice(0, 10) + '…' : labels[i];
      ctx.fillText(lbl, x + barWidth / 2, TOP + chartH + 16);
    }

    // Título eje Y
    ctx.fillStyle = '#64748B'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(18, TOP + chartH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${title}${unit ? ' ('+unit+')' : ''}`, 0, 0); ctx.restore();

    if (progress < 1) { progress = Math.min(progress + 0.025, 1); animId = requestAnimationFrame(render); }
  }

  if (animId) cancelAnimationFrame(animId);
  render();
}

/* ═══════════════════════════════════════════════════════════════════════
   Exports
   ═══════════════════════════════════════════════════════════════════════ */
window.runComparison  = runComparison;
window.initComparison = initComparison;
window.setCompCategory = setCompCategory;
window.setCompCores   = setCompCores;