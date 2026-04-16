/**
 * memory.js — Memory Visualization Module
 *
 * Renders a grid of memory frames with animated allocation,
 * page tables per process, and utilization statistics.
 */

async function allocateMemory() {
  if (AppState.processes.length === 0) {
    showToast('Agrega procesos primero en la pantalla de Processes', 'warning');
    return;
  }

  const memSize = parseInt(document.getElementById('mem-size').value) || 1024;
  const pageSize = parseInt(document.getElementById('page-size').value) || 64;

  const btn = document.getElementById('btn-allocate-memory');
  btn.disabled = true;
  btn.textContent = '⏳ Asignando...';

  try {
    const result = await apiCall('/api/memory/allocate', {
      memory_size: memSize,
      page_size: pageSize,
      processes: AppState.processes,
    });

    renderMemoryGrid(result);
    renderPageTables(result);
    updateMemoryStats(result);
    showToast('Memoria asignada exitosamente', 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.textContent = '🧠 Asignar Memoria';
  }
}

function updateMemoryStats(result) {
  document.getElementById('mem-total-frames').textContent = result.num_frames;
  document.getElementById('mem-free-frames').textContent = result.free_frames;
  document.getElementById('mem-used-frames').textContent = result.used_frames;
  const util = result.num_frames > 0
    ? ((result.used_frames / result.num_frames) * 100).toFixed(1) + '%'
    : '0%';
  document.getElementById('mem-utilization').textContent = util;
}

function renderMemoryGrid(result) {
  const container = document.getElementById('memory-grid');
  const frameMap = result.frame_map || [];

  if (frameMap.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔲</div><p>No hay frames para mostrar.</p></div>';
    return;
  }

  container.innerHTML = frameMap.map((frame, i) => {
    const isFree = frame.is_free;
    const color = isFree ? 'transparent' : pidColor(frame.pid);
    const bgStyle = isFree ? '' : `background: ${color}; border-color: ${color};`;
    const label = isFree ? '—' : `P${frame.pid}`;
    const delay = i * 15; // stagger animation

    return `
      <div class="memory-frame ${isFree ? 'free' : 'allocated'}"
           style="${bgStyle} animation-delay: ${delay}ms;"
           title="Frame ${frame.frame_id}${isFree ? ' (Free)' : ` — P${frame.pid} pg${frame.page_number}`}">
        ${label}
        <span class="frame-id">${frame.frame_id}</span>
      </div>
    `;
  }).join('');
}

function renderPageTables(result) {
  const container = document.getElementById('page-tables-container');
  const pageTables = result.page_tables || {};

  if (Object.keys(pageTables).length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><p>No hay tablas de páginas.</p></div>';
    return;
  }

  let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md);">';

  for (const [pid, table] of Object.entries(pageTables)) {
    const color = pidColor(parseInt(pid));
    html += `
      <div class="card" style="border-left: 3px solid ${color}; padding: var(--space-md);">
        <div class="card-title" style="font-size: 0.85rem;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};"></span>
          Proceso P${pid}
        </div>
        <div class="table-wrapper">
          <table style="font-size:0.75rem;">
            <thead>
              <tr><th>Page</th><th>Frame</th></tr>
            </thead>
            <tbody>
              ${Object.entries(table).map(([page, frame]) => `
                <tr><td>pg${page}</td><td>fr${frame}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}

window.allocateMemory = allocateMemory;
