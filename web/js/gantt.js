/**
 * gantt.js — Animated Gantt Chart with Canvas + step-by-step playback
 *            + Mario Bros pixel-art sprite walking across processes
 *
 * Features:
 *   - Left-to-right reveal animation (play mode)
 *   - Step-by-step controls (prev/next/reset/end)
 *   - Speed control (0.25x - 4x)
 *   - Keyboard shortcuts (Space, arrows, R)
 *   - Live sync with state diagram + CPU + ready queue
 *   - Hover tooltips
 *   - 🍄 Mario pixel sprite that runs on bars and jumps on context switches
 */

/* ═══════════════════════════════════════════════════════════════════════
   Playback State (module-level)
   ═══════════════════════════════════════════════════════════════════════ */
const GanttPlayer = {
  result: null,
  totalTime: 0,
  currentTick: 0,         // Float: permite fracciones durante animacion
  playing: false,
  speed: 1.0,
  rafId: null,
  lastFrame: 0,
  pidToRow: {},
  pids: [],
  canvasCtx: null,
  canvasEl: null,
  containerEl: null,
  renderFn: null,
  lastDt: 0,              // delta time for Mario physics
};


/* ═══════════════════════════════════════════════════════════════════════
   🍄 MARIO SPRITE — High-quality 16×16 pixel art (from HRRN game)
   ═══════════════════════════════════════════════════════════════════════ */
const MARIO_SCALE = 3;   // each pixel = 3 canvas px → 48×48 sprite
const _m = null;
const _R = '#e52521';    // red — hat, shirt
const _S = '#fbd000';    // skin / yellow buttons
const _B = '#5b3a1e';    // brown — hair, shoes
const _O = '#f28030';    // orange — overalls

const MARIO_SPRITE_FRAMES = {
  stand: [
    [_m,_m,_m,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_R,_R,_R,_R,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m],
    [_m,_m,_B,_B,_B,_S,_S,_B,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m],
    [_m,_B,_B,_S,_S,_S,_S,_B,_B,_B,_B,_m,_m,_m,_m,_m],
    [_m,_m,_m,_S,_S,_S,_S,_S,_S,_S,_m,_m,_m,_m,_m,_m],
    [_m,_m,_O,_O,_R,_O,_O,_O,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_O,_O,_O,_R,_O,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_O,_R,_R,_O,_O,_O,_O,_O,_m,_m,_m,_m,_m],
    [_S,_S,_O,_R,_S,_S,_R,_O,_S,_S,_m,_m,_m,_m,_m,_m],
    [_S,_S,_S,_R,_S,_S,_R,_S,_S,_S,_m,_m,_m,_m,_m,_m],
    [_m,_m,_R,_R,_m,_m,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_B,_B,_B,_m,_m,_B,_B,_B,_m,_m,_m,_m,_m,_m,_m],
    [_B,_B,_B,_m,_m,_m,_m,_B,_B,_B,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
  ],
  run1: [
    [_m,_m,_m,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_R,_R,_R,_R,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m],
    [_m,_m,_B,_B,_B,_S,_S,_B,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m],
    [_m,_B,_B,_S,_S,_S,_S,_B,_B,_B,_B,_m,_m,_m,_m,_m],
    [_m,_m,_m,_S,_S,_S,_S,_S,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_O,_O,_R,_O,_O,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_O,_O,_O,_R,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_O,_R,_R,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m],
    [_S,_S,_O,_R,_S,_S,_R,_O,_S,_m,_m,_m,_m,_m,_m,_m],
    [_S,_S,_R,_S,_S,_R,_S,_S,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_R,_R,_m,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_R,_B,_B,_m,_B,_B,_R,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_B,_B,_m,_m,_m,_B,_B,_B,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
  ],
  run2: [
    [_m,_m,_m,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_R,_R,_R,_R,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m],
    [_m,_m,_B,_B,_B,_S,_S,_B,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m],
    [_m,_B,_B,_S,_S,_S,_S,_B,_B,_B,_B,_m,_m,_m,_m,_m],
    [_m,_m,_m,_S,_S,_S,_S,_S,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_O,_O,_R,_O,_O,_O,_m,_m,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_O,_R,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_R,_R,_O,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m],
    [_S,_O,_R,_S,_S,_R,_O,_O,_S,_m,_m,_m,_m,_m,_m,_m],
    [_S,_R,_S,_S,_R,_S,_S,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_R,_R,_m,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_B,_B,_m,_B,_B,_R,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_B,_B,_B,_B,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
  ],
  jump: [
    [_m,_m,_m,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_R,_R,_R,_R,_R,_R,_R,_R,_R,_m,_m,_m,_m,_m],
    [_m,_m,_B,_B,_B,_S,_S,_B,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m,_m],
    [_m,_B,_S,_B,_B,_S,_S,_S,_B,_S,_S,_S,_m,_m,_m,_m],
    [_m,_B,_B,_S,_S,_S,_S,_B,_B,_B,_B,_m,_m,_m,_m,_m],
    [_m,_m,_m,_S,_S,_S,_S,_S,_S,_m,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_R,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m,_m,_m],
    [_O,_O,_O,_O,_R,_O,_O,_O,_O,_O,_O,_m,_m,_m,_m,_m],
    [_O,_O,_O,_R,_R,_O,_O,_O,_O,_O,_m,_m,_m,_m,_m,_m],
    [_S,_S,_R,_S,_S,_R,_O,_S,_S,_m,_m,_m,_m,_m,_m,_m],
    [_m,_R,_S,_S,_R,_m,_S,_S,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_R,_R,_R,_R,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_B,_B,_B,_B,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
    [_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m,_m],
  ],
};

const MARIO_RUN_KEYS = ['stand', 'run1', 'run2', 'run1'];
const MARIO_W = 16 * MARIO_SCALE;   // 48px
const MARIO_H = 16 * MARIO_SCALE;   // 48px

/* Mario state object */
const Mario = {
  x: 0, y: 0,
  frame: 0, frameTimer: 0, FPS: 8,
  jumping: false, jumpVel: 0,
  baseY: 0, lastBlockPid: null,
  visible: false,
};

function resetMarioState() {
  Mario.x = 0; Mario.y = 0;
  Mario.frame = 0; Mario.frameTimer = 0;
  Mario.jumping = false; Mario.jumpVel = 0;
  Mario.baseY = 0; Mario.lastBlockPid = null;
  Mario.visible = false;
}

function drawMarioSprite(ctx, mx, my, jumping) {
  const frameKey = jumping ? 'jump' : MARIO_RUN_KEYS[Mario.frame % MARIO_RUN_KEYS.length];
  const grid = MARIO_SPRITE_FRAMES[frameKey] || MARIO_SPRITE_FRAMES.stand;
  const s = MARIO_SCALE;
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const c = grid[row][col];
      if (c === null) continue;
      ctx.fillStyle = c;
      ctx.fillRect(
        Math.round(mx + col * s),
        Math.round(my + row * s),
        s, s
      );
    }
  }
}

function updateMarioState(dt, tick, gantt, pidToRow, pids, LEFT_MARGIN, TOP_MARGIN, BAR_HEIGHT, ROW_GAP, scale, axisY) {
  if (tick <= 0 || pids.length === 0) { Mario.visible = false; return; }
  Mario.visible = true;

  // Find the currently running block
  let runningBlock = null;
  for (const entry of gantt) {
    if (entry.pid < 0) continue;
    if (tick > entry.start && tick < entry.end) { runningBlock = entry; break; }
  }

  // Target X — follow the front edge of the running block
  let targetX;
  if (runningBlock) {
    const endT = Math.min(runningBlock.end, tick);
    targetX = LEFT_MARGIN + endT * scale - MARIO_W / 2;
  } else {
    targetX = LEFT_MARGIN + tick * scale - MARIO_W / 2;
  }
  Mario.x += (targetX - Mario.x) * Math.min(1, dt * 14);

  // Target Y — on top of the process row bar
  let targetY;
  if (runningBlock) {
    const row = pidToRow[runningBlock.pid] ?? 0;
    targetY = TOP_MARGIN + row * (BAR_HEIGHT + ROW_GAP) - MARIO_H;
  } else {
    targetY = axisY - MARIO_H - 2;
  }
  Mario.baseY = targetY;

  // Detect context switch → trigger jump
  if (runningBlock) {
    if (runningBlock.pid !== Mario.lastBlockPid && Mario.lastBlockPid !== null && !Mario.jumping) {
      Mario.jumping = true;
      Mario.jumpVel = -120;
    }
    Mario.lastBlockPid = runningBlock.pid;
  }

  // Jump physics
  if (Mario.jumping) {
    Mario.y += Mario.jumpVel * dt;
    Mario.jumpVel += 320 * dt;
    if (Mario.y >= Mario.baseY) {
      Mario.y = Mario.baseY;
      Mario.jumping = false;
      Mario.jumpVel = 0;
    }
  } else {
    Mario.y = Mario.baseY;
  }

  // Cycle run frames
  if (!Mario.jumping) {
    Mario.frameTimer += dt;
    if (Mario.frameTimer >= 1 / Mario.FPS) {
      Mario.frameTimer = 0;
      Mario.frame = (Mario.frame + 1) % 4;   // cycles through stand→run1→run2→run1
    }
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Entry point — draws the Gantt for a new result
   ═══════════════════════════════════════════════════════════════════════ */
function drawGanttChart(result) {
  const container = document.getElementById('gantt-container');
  const canvas = document.getElementById('gantt-canvas');
  const ctx = canvas.getContext('2d');

  const gantt = result.gantt || [];
  if (gantt.length === 0) return;

  const totalTime = Math.max(...gantt.map(e => e.end));
  const pids = [...new Set(gantt.filter(e => e.pid >= 0).map(e => e.pid))].sort((a, b) => a - b);
  const pidToRow = {};
  pids.forEach((pid, i) => pidToRow[pid] = i);

  // Setup state
  GanttPlayer.result = result;
  GanttPlayer.totalTime = totalTime;
  GanttPlayer.currentTick = 0;
  GanttPlayer.pids = pids;
  GanttPlayer.pidToRow = pidToRow;
  GanttPlayer.canvasCtx = ctx;
  GanttPlayer.canvasEl = canvas;
  GanttPlayer.containerEl = container;
  GanttPlayer.lastDt = 0;

  // Reset Mario for this new simulation
  resetMarioState();

  // Layout constants — TOP_MARGIN increased for Mario jump headroom
  const LEFT_MARGIN = 60;
  const RIGHT_MARGIN = 24;
  const TOP_MARGIN = 56;    // extra space for the 48px Mario sprite + jump arc
  const BOTTOM_MARGIN = 40;
  const BAR_HEIGHT = 36;
  const ROW_GAP = 8;

  const rowCount = Math.max(pids.length, 1);
  const neededHeight = TOP_MARGIN + rowCount * (BAR_HEIGHT + ROW_GAP) + BOTTOM_MARGIN;

  // DPR setup
  const dpr = window.devicePixelRatio || 1;
  const width = container.clientWidth;
  canvas.width = width * dpr;
  canvas.height = neededHeight * dpr;
  canvas.style.height = neededHeight + 'px';
  ctx.scale(dpr, dpr);

  const chartW = width - LEFT_MARGIN - RIGHT_MARGIN;
  const scale = chartW / totalTime;
  const axisY = TOP_MARGIN + rowCount * (BAR_HEIGHT + ROW_GAP) + 4;

  let hoveredEntry = null;

  function render(dt) {
    dt = dt || 0;
    ctx.clearRect(0, 0, width, neededHeight);

    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(0, 0, width, neededHeight);

    const revealedTime = GanttPlayer.currentTick;

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let t = 0; t <= totalTime; t++) {
      const x = LEFT_MARGIN + t * scale;
      ctx.beginPath();
      ctx.moveTo(x, TOP_MARGIN);
      ctx.lineTo(x, neededHeight - BOTTOM_MARGIN);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Current tick vertical line
    if (revealedTime > 0 && revealedTime < totalTime) {
      const xTick = LEFT_MARGIN + revealedTime * scale;
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xTick, TOP_MARGIN - 4);
      ctx.lineTo(xTick, neededHeight - BOTTOM_MARGIN + 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Time axis labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let t = 0; t <= totalTime; t++) {
      const x = LEFT_MARGIN + t * scale;
      ctx.fillText(t.toString(), x, neededHeight - BOTTOM_MARGIN + 18);
    }

    // PID labels (left column)
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "Inter", sans-serif';
    for (const [pid, row] of Object.entries(pidToRow)) {
      ctx.fillStyle = pidColor(parseInt(pid));
      const y = TOP_MARGIN + row * (BAR_HEIGHT + ROW_GAP);
      ctx.fillText(`P${pid}`, 12, y + BAR_HEIGHT * 0.62);
    }

    // Bars
    for (const entry of gantt) {
      if (entry.pid < 0) continue;
      if (entry.start >= revealedTime) continue;

      const row = pidToRow[entry.pid] ?? 0;
      const visibleEnd = Math.min(entry.end, revealedTime);

      const x = LEFT_MARGIN + entry.start * scale;
      const barW = (visibleEnd - entry.start) * scale;
      const y = TOP_MARGIN + row * (BAR_HEIGHT + ROW_GAP);

      const color = pidColor(entry.pid);
      const grad = ctx.createLinearGradient(x, y, x + barW, y + BAR_HEIGHT);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + 'CC');

      const r = 6;
      const bx = x + 1;
      const by = y + 1;
      const bw = Math.max(barW - 2, 2);
      const bh = BAR_HEIGHT - 2;

      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.fill();

      if (hoveredEntry === entry) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (barW > 32) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`P${entry.pid}`, bx + bw / 2, by + bh * 0.62);
        ctx.textAlign = 'left';
      }
    }

    // 🍄 MARIO — update + draw on top of everything
    if (revealedTime > 0 && pids.length > 0) {
      updateMarioState(dt, revealedTime, gantt, pidToRow, pids,
        LEFT_MARGIN, TOP_MARGIN, BAR_HEIGHT, ROW_GAP, scale, axisY);
      if (Mario.visible) {
        drawMarioSprite(ctx, Mario.x, Mario.y, Mario.jumping);
      }
    }

    // Update step counter + tick label
    const counter = document.getElementById('gantt-step-counter');
    if (counter) counter.textContent = `${Math.floor(revealedTime)} / ${totalTime}`;
    const tickLabel = document.getElementById('gantt-tick-label');
    if (tickLabel) tickLabel.textContent = `t = ${Math.floor(revealedTime)}`;

    // Sync state diagram + CPU + queue
    updateLiveView(result, revealedTime);
    if (window.updateLiveMetricsTable) {
      window.updateLiveMetricsTable(result, revealedTime);
    }
  }

  GanttPlayer.renderFn = render;

  // Hover tooltip
  let tooltip = document.getElementById('gantt-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'gantt-tooltip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
  }

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hoveredEntry = null;
    for (const entry of gantt) {
      if (entry.pid < 0) continue;
      const row = pidToRow[entry.pid] ?? 0;
      const x = LEFT_MARGIN + entry.start * scale;
      const barW = (entry.end - entry.start) * scale;
      const y = TOP_MARGIN + row * (BAR_HEIGHT + ROW_GAP);

      if (mx >= x && mx <= x + barW && my >= y && my <= y + BAR_HEIGHT) {
        hoveredEntry = entry;
        tooltip.innerHTML = `<strong style="color:${pidColor(entry.pid)}">P${entry.pid}</strong><br>Start: ${entry.start} · End: ${entry.end}<br>Duration: ${entry.end - entry.start}`;
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
        tooltip.classList.add('visible');
        canvas.style.cursor = 'pointer';
        render(0);
        return;
      }
    }

    tooltip.classList.remove('visible');
    canvas.style.cursor = 'default';
    render(0);
  };

  canvas.onmouseleave = () => {
    hoveredEntry = null;
    tooltip.classList.remove('visible');
    render(0);
  };

  // Auto-play desde el inicio
  stopGantt();
  GanttPlayer.currentTick = 0;
  render(0);
  playGantt();
}


/* ═══════════════════════════════════════════════════════════════════════
   Playback functions
   ═══════════════════════════════════════════════════════════════════════ */
function playGantt() {
  if (!GanttPlayer.result || !GanttPlayer.renderFn) return;
  if (GanttPlayer.currentTick >= GanttPlayer.totalTime) {
    GanttPlayer.currentTick = 0;
    resetMarioState();
  }
  GanttPlayer.playing = true;
  GanttPlayer.lastFrame = performance.now();
  updatePlayButton();

  const step = (now) => {
    if (!GanttPlayer.playing) return;
    const dt = (now - GanttPlayer.lastFrame) / 1000;
    GanttPlayer.lastFrame = now;
    GanttPlayer.lastDt = dt;
    // Unidades: tiempo virtual por segundo = 2 ticks/s a 1x
    GanttPlayer.currentTick += dt * 2 * GanttPlayer.speed;
    if (GanttPlayer.currentTick >= GanttPlayer.totalTime) {
      GanttPlayer.currentTick = GanttPlayer.totalTime;
      GanttPlayer.playing = false;
      updatePlayButton();
    }
    GanttPlayer.renderFn(dt);
    if (GanttPlayer.playing) {
      GanttPlayer.rafId = requestAnimationFrame(step);
    }
  };
  GanttPlayer.rafId = requestAnimationFrame(step);
}

function pauseGantt() {
  GanttPlayer.playing = false;
  if (GanttPlayer.rafId) cancelAnimationFrame(GanttPlayer.rafId);
  updatePlayButton();
}

function stopGantt() {
  pauseGantt();
}

function togglePlayGantt() {
  if (GanttPlayer.playing) pauseGantt();
  else playGantt();
}

function stepGantt(delta) {
  if (!GanttPlayer.result) return;
  pauseGantt();
  GanttPlayer.currentTick = Math.max(0, Math.min(GanttPlayer.totalTime, Math.floor(GanttPlayer.currentTick) + delta));
  GanttPlayer.renderFn(0);
}

function resetGantt() {
  pauseGantt();
  GanttPlayer.currentTick = 0;
  resetMarioState();
  if (GanttPlayer.renderFn) GanttPlayer.renderFn(0);
}

function endGantt() {
  pauseGantt();
  GanttPlayer.currentTick = GanttPlayer.totalTime;
  if (GanttPlayer.renderFn) GanttPlayer.renderFn(0);
}

function setGanttSpeed(v) {
  GanttPlayer.speed = v;
  const label = document.getElementById('gantt-speed-label');
  if (label) label.textContent = `${v.toFixed(2)}x`;
}

function updatePlayButton() {
  const btn = document.getElementById('gantt-btn-play');
  if (!btn) return;
  btn.innerHTML = GanttPlayer.playing ? '⏸ Pause' : '▶ Play';
}


/* ═══════════════════════════════════════════════════════════════════════
   Live view: state diagram + CPU + ready queue
   ═══════════════════════════════════════════════════════════════════════ */
function updateLiveView(result, t) {
  const tick = Math.floor(t);

  // Determinar estado de cada proceso al tick t
  // Reglas:
  //   - new: arrival > tick
  //   - ready: arrival <= tick Y aun le falta burst Y no es el running
  //   - running: hay una entrada gantt con start <= tick < end y pid == p.pid
  //   - terminated: completion_time <= tick
  const states = { new: [], ready: [], running: [], terminated: [] };

  const processes = result.metrics || [];
  const gantt = result.gantt || [];

  // Determinar el PID corriendo ahora
  let runningPid = null;
  for (const entry of gantt) {
    if (entry.pid < 0) continue;
    if (entry.start <= tick && tick < entry.end) {
      runningPid = entry.pid;
      break;
    }
  }

  for (const p of processes) {
    if (p.completion_time <= tick) {
      states.terminated.push(p.pid);
    } else if (p.arrival_time > tick) {
      states.new.push(p.pid);
    } else if (p.pid === runningPid) {
      states.running.push(p.pid);
    } else {
      states.ready.push(p.pid);
    }
  }

  // Update state diagram
  const renderPids = (arr) => {
    if (arr.length === 0) return '—';
    return arr.map(pid => {
      const c = pidColor(pid);
      return `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px;"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>P${pid}</span>`;
    }).join(' ');
  };

  for (const st of ['new', 'ready', 'running', 'terminated']) {
    const el = document.getElementById(`state-pids-${st}`);
    if (el) el.innerHTML = renderPids(states[st]);
    const nodeEl = document.querySelector(`.state-node[data-state="${st}"]`);
    if (nodeEl) nodeEl.classList.toggle('has-pids', states[st].length > 0);
  }

  // Update CPU
  const cpuCore = document.getElementById('cpu-core');
  const cpuPid = document.getElementById('cpu-pid');
  if (cpuCore && cpuPid) {
    if (runningPid !== null && runningPid !== undefined) {
      cpuCore.classList.add('active');
      cpuPid.textContent = `P${runningPid}`;
      cpuPid.style.color = pidColor(runningPid);
      cpuCore.style.borderColor = pidColor(runningPid);
    } else {
      cpuCore.classList.remove('active');
      cpuPid.textContent = 'IDLE';
      cpuPid.style.color = '';
      cpuCore.style.borderColor = '';
    }
  }

  // Update ready queue
  const queueItems = document.getElementById('queue-items');
  if (queueItems) {
    if (states.ready.length === 0) {
      queueItems.innerHTML = '<span class="queue-empty">vacia</span>';
    } else {
      queueItems.innerHTML = states.ready.map(pid => {
        const c = pidColor(pid);
        return `<span class="queue-pid"><span class="queue-pid-dot" style="background:${c}"></span>P${pid}</span>`;
      }).join('');
    }
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Controls wiring
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const btnPlay = document.getElementById('gantt-btn-play');
  const btnPrev = document.getElementById('gantt-btn-prev');
  const btnNext = document.getElementById('gantt-btn-next');
  const btnReset = document.getElementById('gantt-btn-reset');
  const btnEnd = document.getElementById('gantt-btn-end');
  const speedInput = document.getElementById('gantt-speed');

  if (btnPlay) btnPlay.addEventListener('click', togglePlayGantt);
  if (btnPrev) btnPrev.addEventListener('click', () => stepGantt(-1));
  if (btnNext) btnNext.addEventListener('click', () => stepGantt(1));
  if (btnReset) btnReset.addEventListener('click', resetGantt);
  if (btnEnd) btnEnd.addEventListener('click', endGantt);
  if (speedInput) {
    speedInput.addEventListener('input', (e) => setGanttSpeed(parseFloat(e.target.value)));
  }

  // Keyboard shortcuts (solo activos si estamos en screen-scheduling)
  document.addEventListener('keydown', (e) => {
    const schedScreen = document.getElementById('screen-scheduling');
    if (!schedScreen || !schedScreen.classList.contains('active')) return;
    // Ignora si el foco esta en un input/textarea
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;

    if (e.code === 'Space') { e.preventDefault(); togglePlayGantt(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); stepGantt(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepGantt(1); }
    else if (e.key.toLowerCase() === 'r') { e.preventDefault(); resetGantt(); }
  });
});

window.drawGanttChart = drawGanttChart;
window.playGantt = playGantt;
window.pauseGantt = pauseGantt;
window.resetGantt = resetGantt;
