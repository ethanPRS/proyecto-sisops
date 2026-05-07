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

/* Clone Mario — exact Mario clone (same red/orange palette), 0.66x scale.
   Slight alpha + soft drop shadow distinguishes the duplicates from the
   original Mario without changing the character identity. */
const CLONE_SCALE = 2;   // 32×32 instead of 48×48
const CLONE_ALPHA = 0.92;

function drawCloneMarioSprite(ctx, mx, my, jumping, frame) {
  const frameKey = jumping ? 'jump' : MARIO_RUN_KEYS[frame % MARIO_RUN_KEYS.length];
  const grid = MARIO_SPRITE_FRAMES[frameKey] || MARIO_SPRITE_FRAMES.stand;
  const s = CLONE_SCALE;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * CLONE_ALPHA;
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
  ctx.globalAlpha = prevAlpha;
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
  const basePids = [...new Set(gantt.filter(e => e.pid >= 0).map(e => e.pid))].sort((a, b) => a - b);

  // Build row list: if threads enabled, interleave thread rows after each process
  const threadsEnabled = window.AppState && window.AppState.threadsEnabled;
  const appProcesses = (window.AppState && window.AppState.processes) || [];

  // rows: array of { label, pid, tid (null if process), isThread }
  const rows = [];
  const pidToRow = {};
  // Map: rowKey → row index.  rowKey = pid for process, `${pid}.${tid}` for thread
  const rowKeyToIndex = {};

  basePids.forEach(pid => {
    const rowIdx = rows.length;
    pidToRow[pid] = rowIdx;           // main Mario uses pidToRow
    rowKeyToIndex[`${pid}`] = rowIdx;
    rows.push({ label: `P${pid}`, pid, tid: null, isThread: false });

    if (threadsEnabled) {
      const proc = appProcesses.find(p => p.pid === pid);
      if (proc && proc.threads && proc.threads.length > 0) {
        proc.threads.forEach(t => {
          const tIdx = rows.length;
          rowKeyToIndex[`${pid}.${t.tid}`] = tIdx;
          rows.push({ label: `P${pid}.T${t.tid}`, pid, tid: t.tid, isThread: true, burstTime: t.burst_time });
        });
      }
    }
  });

  // Build thread gantt entries (earliest-core per thread row within its parent window)
  const threadGantt = [];  // { pid, tid, start, end, rowKey }
  if (threadsEnabled) {
    basePids.forEach(pid => {
      const proc = appProcesses.find(p => p.pid === pid);
      if (!proc || !proc.threads || proc.threads.length === 0) return;
      // Find parent process windows from gantt
      const parentWindows = gantt.filter(e => e.pid === pid);
      let cursor = 0;
      proc.threads.forEach(t => {
        let remaining = t.burst_time;
        for (const win of parentWindows) {
          if (remaining <= 0) break;
          const winStart = Math.max(win.start, cursor);
          if (winStart >= win.end) continue;
          const canUse = win.end - winStart;
          const used = Math.min(canUse, remaining);
          threadGantt.push({ pid, tid: t.tid, start: winStart, end: winStart + used, rowKey: `${pid}.${t.tid}` });
          cursor = winStart + used;
          remaining -= used;
        }
      });
    });
  }

  // Clone Mario state — one per thread row
  const cloneMarios = rows
    .filter(r => r.isThread)
    .map(r => ({ pid: r.pid, tid: r.tid, rowKey: `${r.pid}.${r.tid}`,
                 x: 0, y: 0, frame: 0, frameTimer: 0, jumping: false,
                 jumpVel: 0, baseY: 0, lastBlock: null, visible: false }));

  const pids = basePids;   // kept for Mario compat

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

  // Build live cores chart (one bar per core, updated each tick).
  // We use the actual Gantt timeline (not a re-synthesized parallel
  // schedule) so the live bars stay in sync with the animation: any tick
  // where some PID is running will light up the core that owns it.
  const liveNumCores = (window.AppState && window.AppState.numCores) || 1;
  const liveCoreSchedules = buildLiveCoreSchedules(result, liveNumCores);
  GanttPlayer.coreSchedules = liveCoreSchedules;
  GanttPlayer.numCores = liveNumCores;
  buildLiveCoresChart(liveCoreSchedules, liveNumCores);

  resetMarioState();

  const LEFT_MARGIN = 60;
  const RIGHT_MARGIN = 24;
  const TOP_MARGIN = 56;
  const BOTTOM_MARGIN = 40;
  const BAR_HEIGHT = 36;
  const ROW_GAP = 8;
  const CLONE_H = CLONE_SCALE * 16;  // 32px

  const rowCount = Math.max(rows.length, 1);
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

    // Row labels (left column)
    ctx.textAlign = 'left';
    rows.forEach((r, i) => {
      ctx.fillStyle = pidColor(r.pid);
      ctx.font = r.isThread
        ? 'italic 10px "JetBrains Mono", monospace'
        : 'bold 12px "Inter", sans-serif';
      ctx.globalAlpha = r.isThread ? 0.75 : 1;
      const y = TOP_MARGIN + i * (BAR_HEIGHT + ROW_GAP);
      ctx.fillText(r.label, r.isThread ? 8 : 12, y + BAR_HEIGHT * 0.62);
      ctx.globalAlpha = 1;
    });

    // Process bars
    for (const entry of gantt) {
      if (entry.pid < 0) continue;
      if (entry.start >= revealedTime) continue;

      const rowIdx = pidToRow[entry.pid] ?? 0;
      const visibleEnd = Math.min(entry.end, revealedTime);
      const x = LEFT_MARGIN + entry.start * scale;
      const barW = (visibleEnd - entry.start) * scale;
      const y = TOP_MARGIN + rowIdx * (BAR_HEIGHT + ROW_GAP);
      const color = pidColor(entry.pid);
      const grad = ctx.createLinearGradient(x, y, x + barW, y + BAR_HEIGHT);
      grad.addColorStop(0, color); grad.addColorStop(1, color + 'CC');
      const r = 6, bx = x+1, by = y+1, bw = Math.max(barW-2,2), bh = BAR_HEIGHT-2;
      ctx.beginPath();
      ctx.moveTo(bx+r,by); ctx.lineTo(bx+bw-r,by);
      ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+r);
      ctx.lineTo(bx+bw,by+bh-r);
      ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-r,by+bh);
      ctx.lineTo(bx+r,by+bh); ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-r);
      ctx.lineTo(bx,by+r); ctx.quadraticCurveTo(bx,by,bx+r,by);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      if (hoveredEntry === entry) { ctx.shadowColor=color; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0; }
      if (barW > 32) {
        ctx.fillStyle='#FFFFFF'; ctx.font='bold 11px "JetBrains Mono",monospace'; ctx.textAlign='center';
        ctx.fillText(`P${entry.pid}`, bx+bw/2, by+bh*0.62); ctx.textAlign='left';
      }
    }

    // Thread bars (drawn over parent track at the thread row)
    if (threadsEnabled) {
      for (const te of threadGantt) {
        if (te.start >= revealedTime) continue;
        const rowIdx = rowKeyToIndex[te.rowKey];
        if (rowIdx === undefined) continue;
        const visibleEnd = Math.min(te.end, revealedTime);
        const x = LEFT_MARGIN + te.start * scale;
        const barW = (visibleEnd - te.start) * scale;
        const y = TOP_MARGIN + rowIdx * (BAR_HEIGHT + ROW_GAP);
        const color = pidColor(te.pid);
        // Lighter shade of parent-process color so thread bars read as clones of the process
        const grad = ctx.createLinearGradient(x, y, x+barW, y+BAR_HEIGHT);
        grad.addColorStop(0, color + '99'); grad.addColorStop(1, color + '55');
        const r=6, bx=x+1, by=y+1, bw=Math.max(barW-2,2), bh=BAR_HEIGHT-2;
        ctx.beginPath();
        ctx.moveTo(bx+r,by); ctx.lineTo(bx+bw-r,by);
        ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+r); ctx.lineTo(bx+bw,by+bh-r);
        ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-r,by+bh);
        ctx.lineTo(bx+r,by+bh); ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-r);
        ctx.lineTo(bx,by+r); ctx.quadraticCurveTo(bx,by,bx+r,by);
        ctx.closePath();
        // Dashed top border to mark as thread
        ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth=1;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(bx,by+1); ctx.lineTo(bx+bw,by+1); ctx.stroke();
        ctx.setLineDash([]);
        if (bw > 36) {
          ctx.fillStyle='#fff'; ctx.font='italic 9px "JetBrains Mono",monospace'; ctx.textAlign='center';
          ctx.fillText(`T${te.tid}`, bx+bw/2, by+bh*0.62); ctx.textAlign='left';
        }
      }
    }

    // 🍄 MARIO — main Mario on process rows
    if (revealedTime > 0 && pids.length > 0) {
      updateMarioState(dt, revealedTime, gantt, pidToRow, pids,
        LEFT_MARGIN, TOP_MARGIN, BAR_HEIGHT, ROW_GAP, scale, axisY);
      if (Mario.visible) drawMarioSprite(ctx, Mario.x, Mario.y, Mario.jumping);
    }

    // 👾 CLONE MARIOS — one per thread, tracking along thread gantt
    if (threadsEnabled && revealedTime > 0) {
      cloneMarios.forEach(cm => {
        const tEntries = threadGantt.filter(te => te.rowKey === cm.rowKey);
        let runBlock = tEntries.find(te => revealedTime > te.start && revealedTime < te.end);
        const rowIdx = rowKeyToIndex[cm.rowKey];
        if (rowIdx === undefined) return;

        const hasWork = tEntries.some(te => te.start < revealedTime);
        cm.visible = hasWork;
        if (!cm.visible) return;

        // X position
        let targetX;
        if (runBlock) {
          targetX = LEFT_MARGIN + Math.min(runBlock.end, revealedTime) * scale - CLONE_SCALE*8;
        } else {
          const lastDone = tEntries.filter(te => te.end <= revealedTime);
          const lastEnd = lastDone.length ? Math.max(...lastDone.map(te => te.end)) : 0;
          targetX = LEFT_MARGIN + lastEnd * scale - CLONE_SCALE*8;
        }
        cm.x += (targetX - cm.x) * Math.min(1, dt * 14);

        // Y position
        const baseY = TOP_MARGIN + rowIdx * (BAR_HEIGHT + ROW_GAP) - CLONE_H;
        if (runBlock && cm.lastBlock !== runBlock && cm.lastBlock !== null && !cm.jumping) {
          cm.jumping = true; cm.jumpVel = -90;
        }
        cm.lastBlock = runBlock || cm.lastBlock;
        if (cm.jumping) {
          cm.y += cm.jumpVel * dt; cm.jumpVel += 280 * dt;
          if (cm.y >= baseY) { cm.y = baseY; cm.jumping = false; cm.jumpVel = 0; }
        } else { cm.y = baseY; }

        // Animate frame
        if (!cm.jumping) {
          cm.frameTimer = (cm.frameTimer || 0) + dt;
          if (cm.frameTimer >= 1/8) { cm.frameTimer=0; cm.frame=(cm.frame+1)%4; }
        }

        drawCloneMarioSprite(ctx, cm.x, cm.y, cm.jumping, cm.frame);
      });
    }

    // Update step counter + tick label
    const counter = document.getElementById('gantt-step-counter');
    if (counter) counter.textContent = `${Math.floor(revealedTime)} / ${totalTime}`;
    const tickLabel = document.getElementById('gantt-tick-label');
    if (tickLabel) tickLabel.textContent = `t = ${Math.floor(revealedTime)}`;

    // Sync state diagram + CPU + queue
    updateLiveView(result, revealedTime);

    // Sync live per-core bars
    if (GanttPlayer.coreSchedules) {
      updateLiveCoresChart(GanttPlayer.coreSchedules, revealedTime, GanttPlayer.totalTime);
    }

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

    // Thread bar hover (drawn on thread rows)
    if (threadsEnabled) {
      for (const te of threadGantt) {
        const rowIdx = rowKeyToIndex[te.rowKey];
        if (rowIdx === undefined) continue;
        const x = LEFT_MARGIN + te.start * scale;
        const barW = (te.end - te.start) * scale;
        const y = TOP_MARGIN + rowIdx * (BAR_HEIGHT + ROW_GAP);
        if (mx >= x && mx <= x + barW && my >= y && my <= y + BAR_HEIGHT) {
          tooltip.innerHTML = `<strong style="color:${pidColor(te.pid)}">Process ${te.pid} — Thread ${te.tid}</strong><br>Start: ${te.start} · End: ${te.end}<br>Duration: ${te.end - te.start}`;
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top = (e.clientY - 10) + 'px';
          tooltip.classList.add('visible');
          canvas.style.cursor = 'pointer';
          render(0);
          return;
        }
      }
    }

    // Process bar hover
    for (const entry of gantt) {
      if (entry.pid < 0) continue;
      const row = pidToRow[entry.pid] ?? 0;
      const x = LEFT_MARGIN + entry.start * scale;
      const barW = (entry.end - entry.start) * scale;
      const y = TOP_MARGIN + row * (BAR_HEIGHT + ROW_GAP);

      if (mx >= x && mx <= x + barW && my >= y && my <= y + BAR_HEIGHT) {
        hoveredEntry = entry;
        tooltip.innerHTML = `<strong style="color:${pidColor(entry.pid)}">Process ${entry.pid}</strong><br>Start: ${entry.start} · End: ${entry.end}<br>Duration: ${entry.end - entry.start}`;
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


/* ═══════════════════════════════════════════════════════════════════════
   Core Usage Timeline Visualization
   ═══════════════════════════════════════════════════════════════════════ */

const CORE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16', '#0EA5E9', '#D946EF',
  '#22C55E', '#EAB308', '#06B6D4', '#A855F7',
];

/**
 * Distribute Gantt entries across cores and build per-core schedules.
 * Uses round-robin assignment of processes to cores.
 */
function buildCoreSchedules(result, numCores) {
  const gantt = result.gantt || [];
  const processes = result.metrics || [];
  const threadsEnabled = window.AppState && window.AppState.threadsEnabled;
  const appProcesses = window.AppState ? window.AppState.processes : [];
  
  if (numCores <= 1) {
    // Single core — all work on core 0
    const entries = gantt.filter(e => e.pid >= 0).map(e => ({
      ...e,
      label: `P${e.pid}`,
      isThread: false,
    }));
    return [entries];
  }

  // Multi-core: distribute execution units across cores
  const units = []; // execution units (processes + their threads)
  
  if (threadsEnabled) {
    appProcesses.forEach(p => {
      if (p.threads && p.threads.length > 0) {
        // Process has threads — each thread is a schedulable unit
        p.threads.forEach(t => {
          units.push({
            pid: p.pid,
            tid: t.tid,
            arrival_time: p.arrival_time,
            burst_time: t.burst_time,
            label: `P${p.pid}.T${t.tid}`,
            isThread: true,
          });
        });
      } else {
        // Process without threads — it is the unit itself
        units.push({
          pid: p.pid,
          tid: null,
          arrival_time: p.arrival_time,
          burst_time: p.burst_time,
          label: `P${p.pid}`,
          isThread: false,
        });
      }
    });
  } else {
    processes.forEach(p => {
      units.push({
        pid: p.pid,
        tid: null,
        arrival_time: p.arrival_time,
        burst_time: p.burst_time,
        label: `P${p.pid}`,
        isThread: false,
      });
    });
  }

  // Sort by arrival time
  units.sort((a, b) => a.arrival_time - b.arrival_time);

  // Assign to cores with earliest-available-core strategy
  const coreEndTimes = new Array(numCores).fill(0);
  const coreSchedules = Array.from({ length: numCores }, () => []);

  units.forEach(unit => {
    // Find core with earliest availability after arrival
    let bestCore = 0;
    let bestTime = Infinity;
    for (let c = 0; c < numCores; c++) {
      const startTime = Math.max(coreEndTimes[c], unit.arrival_time);
      if (startTime < bestTime) {
        bestTime = startTime;
        bestCore = c;
      }
    }

    const startTime = Math.max(coreEndTimes[bestCore], unit.arrival_time);
    const endTime = startTime + unit.burst_time;
    
    coreSchedules[bestCore].push({
      pid: unit.pid,
      tid: unit.tid,
      start: startTime,
      end: endTime,
      label: unit.label,
      isThread: unit.isThread,
    });
    
    coreEndTimes[bestCore] = endTime;
  });

  return coreSchedules;
}

/**
 * Render the core usage timeline chart
 */
function drawCoreUsageChart(result) {
  const numCores = (window.AppState && window.AppState.numCores) || 1;
  const card = document.getElementById('core-usage-card');
  
  if (numCores <= 1) {
    if (card) card.style.display = 'none';
    return;
  }
  
  if (card) card.style.display = '';

  const container = document.getElementById('core-usage-container');
  const canvas = document.getElementById('core-usage-canvas');
  const ctx = canvas.getContext('2d');

  const coreSchedules = buildCoreSchedules(result, numCores);
  const totalTime = Math.max(...coreSchedules.map(cs => 
    cs.length > 0 ? Math.max(...cs.map(e => e.end)) : 0
  ), 1);

  // Layout
  const LEFT_MARGIN = 70;
  const RIGHT_MARGIN = 24;
  const TOP_MARGIN = 16;
  const BOTTOM_MARGIN = 36;
  const BAR_HEIGHT = 32;
  const ROW_GAP = 6;

  const neededHeight = TOP_MARGIN + numCores * (BAR_HEIGHT + ROW_GAP) + BOTTOM_MARGIN;

  const dpr = window.devicePixelRatio || 1;
  const width = container.clientWidth;
  canvas.width = width * dpr;
  canvas.height = neededHeight * dpr;
  canvas.style.height = neededHeight + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const chartW = width - LEFT_MARGIN - RIGHT_MARGIN;
  const scale = chartW / totalTime;

  let hoveredBlock = null;
  let hoveredCore = -1;

  function render() {
    ctx.clearRect(0, 0, width, neededHeight);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillRect(0, 0, width, neededHeight);

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
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

    // Draw each core row
    for (let c = 0; c < numCores; c++) {
      const y = TOP_MARGIN + c * (BAR_HEIGHT + ROW_GAP);

      // Core label
      ctx.fillStyle = CORE_COLORS[c % CORE_COLORS.length];
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Core ${c + 1}`, LEFT_MARGIN - 8, y + BAR_HEIGHT * 0.62);

      // Background track
      ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN + r, y);
      ctx.lineTo(LEFT_MARGIN + chartW - r, y);
      ctx.quadraticCurveTo(LEFT_MARGIN + chartW, y, LEFT_MARGIN + chartW, y + r);
      ctx.lineTo(LEFT_MARGIN + chartW, y + BAR_HEIGHT - r);
      ctx.quadraticCurveTo(LEFT_MARGIN + chartW, y + BAR_HEIGHT, LEFT_MARGIN + chartW - r, y + BAR_HEIGHT);
      ctx.lineTo(LEFT_MARGIN + r, y + BAR_HEIGHT);
      ctx.quadraticCurveTo(LEFT_MARGIN, y + BAR_HEIGHT, LEFT_MARGIN, y + BAR_HEIGHT - r);
      ctx.lineTo(LEFT_MARGIN, y + r);
      ctx.quadraticCurveTo(LEFT_MARGIN, y, LEFT_MARGIN + r, y);
      ctx.closePath();
      ctx.fill();

      // Idle segments (hatched pattern)
      const schedule = coreSchedules[c];
      let lastEnd = 0;
      schedule.forEach(entry => {
        if (entry.start > lastEnd) {
          // Idle gap
          const idleX = LEFT_MARGIN + lastEnd * scale;
          const idleW = (entry.start - lastEnd) * scale;
          ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.fillRect(idleX, y, idleW, BAR_HEIGHT);
          // Diagonal hatching
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 0.5;
          for (let hx = idleX; hx < idleX + idleW; hx += 8) {
            ctx.beginPath();
            ctx.moveTo(hx, y);
            ctx.lineTo(hx + BAR_HEIGHT, y + BAR_HEIGHT);
            ctx.stroke();
          }
        }
        lastEnd = entry.end;
      });

      // Process/thread bars
      schedule.forEach(entry => {
        const x1 = LEFT_MARGIN + entry.start * scale;
        const barW = (entry.end - entry.start) * scale;
        const color = pidColor(entry.pid);

        // Bar with slight transparency for threads
        const alpha = entry.isThread ? 'CC' : '';
        const grad = ctx.createLinearGradient(x1, y, x1 + barW, y + BAR_HEIGHT);
        grad.addColorStop(0, color + alpha);
        grad.addColorStop(1, color + (entry.isThread ? '99' : 'CC'));

        // Rounded bar
        const br = 4;
        ctx.beginPath();
        ctx.moveTo(x1 + br, y + 1);
        ctx.lineTo(x1 + barW - br, y + 1);
        ctx.quadraticCurveTo(x1 + barW, y + 1, x1 + barW, y + 1 + br);
        ctx.lineTo(x1 + barW, y + BAR_HEIGHT - 1 - br);
        ctx.quadraticCurveTo(x1 + barW, y + BAR_HEIGHT - 1, x1 + barW - br, y + BAR_HEIGHT - 1);
        ctx.lineTo(x1 + br, y + BAR_HEIGHT - 1);
        ctx.quadraticCurveTo(x1, y + BAR_HEIGHT - 1, x1, y + BAR_HEIGHT - 1 - br);
        ctx.lineTo(x1, y + 1 + br);
        ctx.quadraticCurveTo(x1, y + 1, x1 + br, y + 1);
        ctx.closePath();

        ctx.fillStyle = grad;
        ctx.fill();

        // Highlight on hover
        if (hoveredBlock === entry && hoveredCore === c) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Thread indicator (dashed top border)
        if (entry.isThread) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, y + 1);
          ctx.lineTo(x1 + barW, y + 1);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label
        if (barW > 28) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = entry.isThread ? '600 9px "JetBrains Mono", monospace' : 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(entry.label, x1 + barW / 2, y + BAR_HEIGHT * 0.62);
        }
      });
    }

    // Time axis
    ctx.fillStyle = '#475569';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const axisY = TOP_MARGIN + numCores * (BAR_HEIGHT + ROW_GAP);
    for (let t = 0; t <= totalTime; t++) {
      const x = LEFT_MARGIN + t * scale;
      ctx.fillText(t.toString(), x, axisY + 16);
    }
  }

  // Tooltip
  let tooltip = document.getElementById('core-usage-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'core-usage-tooltip';
    document.body.appendChild(tooltip);
  }

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    hoveredBlock = null;
    hoveredCore = -1;

    for (let c = 0; c < numCores; c++) {
      const y = TOP_MARGIN + c * (BAR_HEIGHT + ROW_GAP);
      for (const entry of coreSchedules[c]) {
        const x1 = LEFT_MARGIN + entry.start * scale;
        const barW = (entry.end - entry.start) * scale;
        if (mx >= x1 && mx <= x1 + barW && my >= y && my <= y + BAR_HEIGHT) {
          hoveredBlock = entry;
          hoveredCore = c;
          const typeLabel = entry.isThread ? 'Thread' : 'Process';
          tooltip.innerHTML = `<strong style="color:${pidColor(entry.pid)}">${entry.label}</strong> (${typeLabel})<br>Core ${c + 1} · t=${entry.start}→${entry.end} · Duration: ${entry.end - entry.start}`;
          tooltip.style.left = (e.clientX + 14) + 'px';
          tooltip.style.top = (e.clientY - 10) + 'px';
          tooltip.classList.add('visible');
          canvas.style.cursor = 'pointer';
          render();
          return;
        }
      }
    }

    tooltip.classList.remove('visible');
    canvas.style.cursor = 'default';
    render();
  };

  canvas.onmouseleave = () => {
    hoveredBlock = null;
    hoveredCore = -1;
    tooltip.classList.remove('visible');
    render();
  };

  render();

  // Build legend
  const legendContainer = document.getElementById('core-usage-legend');
  if (legendContainer) {
    const idleLegend = `<span class="core-legend-item"><span class="core-legend-dot" style="background:rgba(148,163,184,0.4)"></span>Idle</span>`;
    const processLegend = `<span class="core-legend-item"><span class="core-legend-dot" style="background:var(--brand-primary)"></span>Process</span>`;
    const threadLegend = window.AppState && window.AppState.threadsEnabled
      ? `<span class="core-legend-item"><span class="core-legend-dot" style="background:var(--brand-primary);opacity:0.7;border:1px dashed rgba(255,255,255,0.5)"></span>Thread</span>`
      : '';
    legendContainer.innerHTML = idleLegend + processLegend + threadLegend;
  }

  // Build per-core stats
  const statsRow = document.getElementById('core-stats-row');
  if (statsRow) {
    let html = '';
    for (let c = 0; c < numCores; c++) {
      const schedule = coreSchedules[c];
      const activeTime = schedule.reduce((s, e) => s + (e.end - e.start), 0);
      const utilization = totalTime > 0 ? Math.round((activeTime / totalTime) * 100) : 0;
      const coreColor = CORE_COLORS[c % CORE_COLORS.length];

      html += `
        <div class="core-stat-item">
          <span class="core-stat-label" style="color:${coreColor}">Core ${c + 1}</span>
          <span class="core-stat-value">${utilization}%</span>
          <div class="core-stat-bar">
            <div class="core-stat-bar-fill" style="width:${utilization}%;background:${coreColor}"></div>
          </div>
        </div>`;
    }

    // Average utilization
    const totalActive = coreSchedules.reduce((s, cs) => 
      s + cs.reduce((ss, e) => ss + (e.end - e.start), 0), 0
    );
    const avgUtil = totalTime > 0 ? Math.round((totalActive / (totalTime * numCores)) * 100) : 0;
    html += `
      <div class="core-stat-item">
        <span class="core-stat-label">Avg Util</span>
        <span class="core-stat-value">${avgUtil}%</span>
        <div class="core-stat-bar">
          <div class="core-stat-bar-fill" style="width:${avgUtil}%;background:var(--gradient-accent)"></div>
        </div>
      </div>`;

    statsRow.innerHTML = html;
  }
}

window.drawCoreUsageChart = drawCoreUsageChart;


/* ═══════════════════════════════════════════════════════════════════════
   Live per-core bars (replaces the state diagram)
   - One vertical bar per core
   - Bar color = currently running unit on that core
   - Bar height = utilization at the current tick
   - Updates every render frame in sync with the Gantt animation
   ═══════════════════════════════════════════════════════════════════════ */
const LIVE_CORE_BLOCKS = 12;  // segmented blocks per core bar

/**
 * Build per-core schedules straight from the actual Gantt timeline.
 *  - numCores === 1 → all entries go to core 0.
 *  - numCores > 1   → each PID is assigned to one core (round-robin in
 *    arrival order). All of that PID's Gantt slices stay on the same core
 *    with their original start/end, so the live bars track the animation
 *    instead of a re-synthesized parallel schedule.
 *
 * Threads (when enabled) are ignored here because the Gantt only emits
 * process-level entries; the live bars reflect process-level activity.
 */
function buildLiveCoreSchedules(result, numCores) {
  const gantt = (result && result.gantt) || [];
  const schedules = Array.from({ length: Math.max(numCores, 1) }, () => []);

  if (numCores <= 1) {
    for (const e of gantt) {
      if (e.pid < 0) continue;
      schedules[0].push({
        pid: e.pid, tid: null, start: e.start, end: e.end,
        label: `P${e.pid}`, isThread: false,
      });
    }
    return schedules;
  }

  // Multi-core: stable PID → core mapping (round-robin by arrival order)
  const pidToCore = {};
  let nextCore = 0;
  for (const e of gantt) {
    if (e.pid < 0) continue;
    if (!(e.pid in pidToCore)) {
      pidToCore[e.pid] = nextCore;
      nextCore = (nextCore + 1) % numCores;
    }
    const core = pidToCore[e.pid];
    schedules[core].push({
      pid: e.pid, tid: null, start: e.start, end: e.end,
      label: `P${e.pid}`, isThread: false,
    });
  }
  return schedules;
}


function buildLiveCoresChart(coreSchedules, numCores) {
  const grid = document.getElementById('cores-live-grid');
  if (!grid) return;

  grid.innerHTML = '';
  for (let c = 0; c < numCores; c++) {
    const wrap = document.createElement('div');
    wrap.className = 'core-live-bar is-idle';
    wrap.dataset.core = String(c);

    // Build N stacked block segments (top → bottom in DOM, visually filled
    // bottom-up via CSS column-reverse layout)
    const blocks = Array.from({ length: LIVE_CORE_BLOCKS }, (_, i) =>
      `<div class="core-live-block" data-idx="${i}"></div>`
    ).join('');

    wrap.innerHTML = `
      <div class="core-live-pid" data-role="pid">IDLE</div>
      <div class="core-live-bar-track">
        <div class="core-live-blocks" data-role="blocks">${blocks}</div>
      </div>
      <div class="core-live-percent" data-role="percent">0%</div>
      <div class="core-live-label">Core ${c + 1}</div>
    `;
    grid.appendChild(wrap);
  }

  // Tooltip element (single, reused)
  let tooltip = document.getElementById('cores-live-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'cores-live-tooltip';
    document.body.appendChild(tooltip);
  }

  grid.querySelectorAll('.core-live-bar').forEach(bar => {
    bar.addEventListener('mousemove', (e) => {
      const c = parseInt(bar.dataset.core, 10);
      const data = bar._coreData || {};
      const tick = Math.floor(GanttPlayer.currentTick || 0);
      const lines = [
        `<strong>Core ${c + 1}</strong>`,
        `Utilización: ${data.percent ?? 0}%`,
        data.runningLabel
          ? `Ejecutando: <strong>${data.runningLabel}</strong>`
          : 'Estado: <strong>IDLE</strong>',
        `Tick actual: t = ${tick}`,
      ];
      tooltip.innerHTML = lines.join('<br>');
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
      tooltip.classList.add('visible');
    });
    bar.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });

  // Initialize at t=0
  updateLiveCoresChart(coreSchedules, 0, GanttPlayer.totalTime || 1);
}

function updateLiveCoresChart(coreSchedules, tick, totalTime) {
  const grid = document.getElementById('cores-live-grid');
  if (!grid) return;

  // Live tick label in the card header
  const tickLabel = document.getElementById('cores-live-tick');
  if (tickLabel) tickLabel.textContent = `t = ${Math.floor(tick)}`;

  // When the animation has reached the end, the CPU is no longer processing
  // anything — flush every core to 0% / IDLE so the view doesn't keep showing
  // residual utilization from past activity.
  const finished = totalTime > 0 && tick >= totalTime;

  const denom = Math.max(tick, 0.0001);

  for (let c = 0; c < coreSchedules.length; c++) {
    const bar = grid.querySelector(`.core-live-bar[data-core="${c}"]`);
    if (!bar) continue;
    const blocksWrap = bar.querySelector('[data-role="blocks"]');
    const pidEl = bar.querySelector('[data-role="pid"]');
    const pctEl = bar.querySelector('[data-role="percent"]');

    const schedule = coreSchedules[c];

    // Active time accumulated up to current tick
    let active = 0;
    let running = null;
    for (const e of schedule) {
      if (e.start >= tick) break;
      const visibleEnd = Math.min(e.end, tick);
      active += Math.max(0, visibleEnd - e.start);
      if (e.start <= tick && tick < e.end) running = e;
    }

    const rawPercent = tick > 0 ? Math.round((active / denom) * 100) : 0;
    const clamped = finished ? 0 : Math.max(0, Math.min(100, rawPercent));

    // Number of lit blocks proportional to utilization (0 when finished)
    const litCount = Math.round((clamped / 100) * LIVE_CORE_BLOCKS);

    // Keep last-known color so paused states don't turn gray.
    // Only update the cached color when something is actively running.
    if (running && !finished) bar._lastColor = pidColor(running.pid);
    const color = bar._lastColor || pidColor(running ? running.pid : 0);

    const blocks = blocksWrap.querySelectorAll('.core-live-block');
    blocks.forEach((block, i) => {
      // Blocks fill from bottom (last index) up to (last - litCount + 1)
      const isLit = i >= LIVE_CORE_BLOCKS - litCount;
      block.classList.toggle('is-lit', isLit);
      if (isLit) {
        block.style.background = color;
        block.style.borderColor = color;
      } else {
        block.style.background = '';
        block.style.borderColor = '';
      }
    });

    if (running && !finished) {
      const label = running.label || `P${running.pid}`;
      pidEl.textContent = label;
      pidEl.style.background = color;
      pidEl.style.color = '#fff';
      pidEl.style.borderColor = color;

      bar.classList.add('is-active');
      bar.classList.remove('is-idle');

      bar._coreData = { percent: clamped, runningLabel: running.isThread
        ? `Process ${running.pid} — Thread ${running.tid}`
        : `Process ${running.pid}` };
    } else {
      pidEl.textContent = 'IDLE';
      pidEl.style.background = '';
      pidEl.style.color = '';
      pidEl.style.borderColor = '';

      bar.classList.add('is-idle');
      bar.classList.remove('is-active');

      bar._coreData = { percent: clamped, runningLabel: null };
    }

    pctEl.textContent = clamped + '%';
  }
}

window.buildLiveCoresChart = buildLiveCoresChart;
window.updateLiveCoresChart = updateLiveCoresChart;
