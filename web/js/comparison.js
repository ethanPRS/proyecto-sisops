/**
 * comparison.js — Algorithm Comparison Charts
 *
 * Runs all scheduling algorithms on the same process set
 * and renders animated bar charts using Canvas for:
 * - Avg Turnaround Time
 * - Avg Waiting Time
 * - Avg Response Time
 * - CPU Utilization
 */

/* ═══════════════════════════════════════════════════════════════════════
   Run Comparison
   ═══════════════════════════════════════════════════════════════════════ */
async function runComparison() {
  if (AppState.processes.length === 0) {
    showToast('Agrega procesos primero en la pantalla de Processes', 'warning');
    return;
  }

  const quantum = parseInt(document.getElementById('quantum-input').value) || 2;

  const btn = document.getElementById('btn-run-comparison');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;"></div> Comparando...';

  try {
    const results = await apiCall('/api/schedule/compare', {
      quantum: quantum,
      processes: AppState.processes,
    });

    AppState.lastComparisonResult = results;

    // Extract data for charts
    const algos = [];
    const tatValues = [];
    const wtValues = [];
    const rtValues = [];
    const cpuValues = [];
    const tableData = [];

    for (const [name, data] of Object.entries(results)) {
      if (data.error) continue;
      algos.push(name);
      tatValues.push(data.avg_turnaround);
      wtValues.push(data.avg_waiting);
      rtValues.push(data.avg_response);
      cpuValues.push(data.cpu_utilization);
      tableData.push(data);
    }

    // Draw charts
    drawBarChart('chart-tat', algos, tatValues, 'Avg Turnaround Time', 'time units');
    drawBarChart('chart-wt', algos, wtValues, 'Avg Waiting Time', 'time units');
    drawBarChart('chart-rt', algos, rtValues, 'Avg Response Time', 'time units');
    drawBarChart('chart-cpu', algos, cpuValues, 'CPU Utilization', '%');

    // Update table
    renderComparisonTable(algos, tableData);

    showToast(`${algos.length} algoritmos comparados exitosamente`, 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📊 Comparar Todos los Algoritmos';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Bar Chart Renderer
   ═══════════════════════════════════════════════════════════════════════ */
function drawBarChart(canvasId, labels, values, title, unit) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = 280;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  // Layout
  const LEFT = 60;
  const RIGHT = 24;
  const TOP = 16;
  const BOTTOM = 60;

  const chartW = width - LEFT - RIGHT;
  const chartH = height - TOP - BOTTOM;

  // Max value
  const maxVal = Math.max(...values, 0.01);
  const niceMax = Math.ceil(maxVal * 1.15);

  // Bar dimensions
  const barCount = values.length;
  const barGap = 12;
  const totalGap = barGap * (barCount + 1);
  const barWidth = Math.min((chartW - totalGap) / barCount, 60);
  const totalBarsWidth = barCount * barWidth + totalGap;
  const startX = LEFT + (chartW - totalBarsWidth) / 2 + barGap;

  // Check reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress = prefersReducedMotion ? 1 : 0;
  let animId;
  let hoveredIndex = -1;

  // Tooltip
  let tooltip = document.getElementById(canvasId + '-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = canvasId + '-tooltip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
  }

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hoveredIndex = -1;
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barGap);
      const barH = (values[i] / niceMax) * chartH * progress;
      const y = TOP + chartH - barH;

      if (mx >= x && mx <= x + barWidth && my >= y && my <= TOP + chartH) {
        hoveredIndex = i;
        const color = pidColor(i);
        tooltip.innerHTML = `<strong style="color:${color}">${labels[i]}</strong><br>${title}: ${values[i].toFixed(2)} ${unit}`;
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
        tooltip.classList.add('visible');
        canvas.style.cursor = 'pointer';
        render();
        return;
      }
    }

    tooltip.classList.remove('visible');
    canvas.style.cursor = 'default';
    render();
  };

  canvas.onmouseleave = () => {
    hoveredIndex = -1;
    tooltip.classList.remove('visible');
    render();
  };

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Y-axis grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = TOP + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(LEFT, y);
      ctx.lineTo(width - RIGHT, y);
      ctx.stroke();

      // Y-axis labels
      const val = (niceMax * (1 - i / gridLines)).toFixed(1);
      ctx.fillStyle = '#475569';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, LEFT - 8, y + 4);
    }
    ctx.setLineDash([]);

    // Bars
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * (barWidth + barGap);
      const barH = (values[i] / niceMax) * chartH * progress;
      const y = TOP + chartH - barH;

      // Bar gradient
      const color = pidColor(i);
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '88');

      // Draw rounded rect bar
      const r = Math.min(6, barWidth / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      
      ctx.fillStyle = grad;
      ctx.fill();

      if (i === hoveredIndex) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 0;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      } else {
        ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }

      // Value label on bar
      if (progress > 0.5) {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const valText = values[i].toFixed(1);
        ctx.fillText(valText, x + barWidth / 2, y - 6);
      }

      // X-axis label
      ctx.fillStyle = '#475569';
      ctx.font = '9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      const label = labels[i].length > 10 ? labels[i].slice(0, 9) + '…' : labels[i];
      ctx.fillText(label, x + barWidth / 2, TOP + chartH + 16);
    }

    // Animate
    if (progress < 1) {
      progress = Math.min(progress + 0.02, 1);
      animId = requestAnimationFrame(render);
    }
  }

  if (animId) cancelAnimationFrame(animId);
  render();
}


/* ═══════════════════════════════════════════════════════════════════════
   Comparison Table
   ═══════════════════════════════════════════════════════════════════════ */
function renderComparisonTable(algos, data) {
  const tbody = document.getElementById('comparison-tbody');

  // Find best values for highlighting
  const bestTAT = Math.min(...data.map(d => d.avg_turnaround));
  const bestWT = Math.min(...data.map(d => d.avg_waiting));
  const bestRT = Math.min(...data.map(d => d.avg_response));
  const bestCPU = Math.max(...data.map(d => d.cpu_utilization));

  tbody.innerHTML = data.map((d, i) => `
    <tr style="animation: fadeSlideIn 0.3s ease ${i * 0.05}s both;">
      <td style="font-weight:600;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PID_COLORS[i % PID_COLORS.length]};margin-right:8px;"></span>
        ${algos[i]}
      </td>
      <td class="${d.avg_turnaround === bestTAT ? 'text-success' : ''}" style="font-weight:${d.avg_turnaround === bestTAT ? '700' : '400'}">
        ${d.avg_turnaround}${d.avg_turnaround === bestTAT ? ' ⭐' : ''}
      </td>
      <td class="${d.avg_waiting === bestWT ? 'text-success' : ''}" style="font-weight:${d.avg_waiting === bestWT ? '700' : '400'}">
        ${d.avg_waiting}${d.avg_waiting === bestWT ? ' ⭐' : ''}
      </td>
      <td class="${d.avg_response === bestRT ? 'text-success' : ''}" style="font-weight:${d.avg_response === bestRT ? '700' : '400'}">
        ${d.avg_response}${d.avg_response === bestRT ? ' ⭐' : ''}
      </td>
      <td class="${d.cpu_utilization === bestCPU ? 'text-success' : ''}" style="font-weight:${d.cpu_utilization === bestCPU ? '700' : '400'}">
        ${d.cpu_utilization}%${d.cpu_utilization === bestCPU ? ' ⭐' : ''}
      </td>
      <td>${d.context_switches}</td>
    </tr>
  `).join('');
}

window.runComparison = runComparison;
