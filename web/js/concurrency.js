/**
 * concurrency.js — Concurrency Simulation & Timeline
 *
 * Runs N-thread simulation (safe/unsafe mode) and renders
 * a thread timeline using Canvas, showing race conditions.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Run Concurrency Simulation
   ═══════════════════════════════════════════════════════════════════════ */
async function runConcurrency() {
  const numThreads = parseInt(document.getElementById('conc-threads').value) || 4;
  const iterations = parseInt(document.getElementById('conc-iters').value) || 50;
  const useLock = document.querySelector('.toggle-option.active').dataset.lock === 'true';

  const btn = document.getElementById('btn-run-concurrency');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;"></div> Ejecutando...';

  try {
    const result = await apiCall('/api/concurrency', {
      num_threads: numThreads,
      iterations: iterations,
      use_lock: useLock,
    });

    displayConcurrencyResult(result);
    drawConcurrencyTimeline(result);
    renderConcurrencyTable(result);

    const msg = result.is_correct
      ? `✅ Resultado correcto: ${result.actual_value}`
      : `⚠️ Race condition detectado! Expected: ${result.expected_value}, Got: ${result.actual_value}`;
    showToast(msg, result.is_correct ? 'success' : 'warning');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶️ Ejecutar Simulación';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Display Result Banner
   ═══════════════════════════════════════════════════════════════════════ */
function displayConcurrencyResult(result) {
  const banner = document.getElementById('conc-result-banner');
  banner.classList.remove('hidden', 'correct', 'race');
  banner.classList.add(result.is_correct ? 'correct' : 'race');

  document.getElementById('conc-expected').textContent = result.expected_value;
  document.getElementById('conc-actual').textContent = result.actual_value;
  document.getElementById('conc-actual').style.color =
    result.is_correct ? 'var(--success)' : 'var(--error)';

  const verdict = document.getElementById('conc-verdict');
  if (result.is_correct) {
    verdict.textContent = '✅ CORRECTO';
    verdict.className = 'badge badge-success';
  } else {
    verdict.textContent = '⚠️ RACE CONDITION';
    verdict.className = 'badge badge-error';
  }

  document.getElementById('conc-duration').textContent =
    `Duration: ${(result.total_duration * 1000).toFixed(1)}ms`;
}


/* ═══════════════════════════════════════════════════════════════════════
   Thread Timeline Canvas
   ═══════════════════════════════════════════════════════════════════════ */
function drawConcurrencyTimeline(result) {
  const canvas = document.getElementById('concurrency-canvas');
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;

  const dpr = window.devicePixelRatio || 1;
  const width = container.clientWidth;

  const timelines = result.timelines || [];
  const numThreads = timelines.length;

  const LEFT = 80;
  const RIGHT = 24;
  const TOP = 16;
  const BOTTOM = 40;
  const BAR_H = 32;
  const GAP = 10;

  const height = TOP + numThreads * (BAR_H + GAP) + BOTTOM;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  const chartW = width - LEFT - RIGHT;

  // Find time range
  const maxTime = result.total_duration || 1;

  // Check reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress = prefersReducedMotion ? 1 : 0;
  let animId;

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Draw timelines
    for (let i = 0; i < numThreads; i++) {
      const tl = timelines[i];
      const y = TOP + i * (BAR_H + GAP);
      const color = pidColor(tl.thread_id);

      // Thread label
      ctx.fillStyle = color;
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Thread ${tl.thread_id}`, 8, y + BAR_H * 0.62);

      // Background track
      ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
      ctx.fillRect(LEFT, y, chartW, BAR_H);

      // Active bar
      const startX = LEFT + (tl.start_time / maxTime) * chartW;
      const endX = LEFT + (tl.end_time / maxTime) * chartW;
      const barW = (endX - startX) * progress;

      if (barW > 0) {
        const grad = ctx.createLinearGradient(startX, y, startX + barW, y);
        grad.addColorStop(0, color + 'DD');
        grad.addColorStop(1, color + '66');

        // Rounded rect
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(startX + r, y + 2);
        ctx.lineTo(startX + barW - r, y + 2);
        ctx.quadraticCurveTo(startX + barW, y + 2, startX + barW, y + 2 + r);
        ctx.lineTo(startX + barW, y + BAR_H - 2 - r);
        ctx.quadraticCurveTo(startX + barW, y + BAR_H - 2, startX + barW - r, y + BAR_H - 2);
        ctx.lineTo(startX + r, y + BAR_H - 2);
        ctx.quadraticCurveTo(startX, y + BAR_H - 2, startX, y + BAR_H - 2 - r);
        ctx.lineTo(startX, y + 2 + r);
        ctx.quadraticCurveTo(startX, y + 2, startX + r, y + 2);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Sombra suave (mas limpio sobre fondo claro)
        ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Event count label
        if (barW > 40 && progress > 0.7) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${tl.event_count} ops`, startX + barW / 2, y + BAR_H * 0.62);
        }
      }
    }

    // Time axis
    ctx.fillStyle = '#475569';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const timeY = TOP + numThreads * (BAR_H + GAP) + 16;
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const x = LEFT + (chartW / timeSteps) * i;
      const t = (maxTime / timeSteps) * i;
      ctx.fillText(t.toFixed(3) + 's', x, timeY);
    }

    // Race condition events visualization
    if (!result.is_correct && result.events && progress > 0.8) {
      // Draw some conflict markers
      const conflicts = findConflicts(result.events);
      ctx.fillStyle = 'rgba(255, 71, 87, 0.6)';
      for (const c of conflicts.slice(0, 20)) {
        const x = LEFT + (c.timestamp / maxTime) * chartW;
        const y1 = TOP + c.thread_id * (BAR_H + GAP) + BAR_H / 2;
        ctx.beginPath();
        ctx.arc(x, y1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (progress < 1) {
      progress = Math.min(progress + 0.015, 1);
      animId = requestAnimationFrame(render);
    }
  }

  if (animId) cancelAnimationFrame(animId);
  render();
}

function findConflicts(events) {
  // Find events where value_after !== value_before + 1 (race condition indicator)
  return events.filter(e =>
    e.action.includes('unsafe') && e.value_after !== e.value_before + 1
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   Concurrency Table
   ═══════════════════════════════════════════════════════════════════════ */
function renderConcurrencyTable(result) {
  const tbody = document.getElementById('conc-tbody');
  const timelines = result.timelines || [];

  tbody.innerHTML = timelines.map((tl, i) => `
    <tr style="animation: fadeSlideIn 0.3s ease ${i * 0.05}s both;">
      <td>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${pidColor(tl.thread_id)};margin-right:8px;"></span>
        Thread ${tl.thread_id}
      </td>
      <td class="text-mono">${tl.start_time.toFixed(4)}s</td>
      <td class="text-mono">${tl.end_time.toFixed(4)}s</td>
      <td class="text-mono">${((tl.end_time - tl.start_time) * 1000).toFixed(1)}ms</td>
      <td>${tl.event_count}</td>
    </tr>
  `).join('');
}

window.runConcurrency = runConcurrency;
