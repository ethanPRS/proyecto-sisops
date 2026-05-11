/**
 * space_states.js — "Space Process States" (Mission Control)
 *
 * Renders each scheduled process as a spaceship in one of four zones
 * (Launch Pad / CPU Active / Ready Orbit / Hyperspace) on a futuristic
 * canvas next to the Live Cores panel. Threads orbit their parent ship
 * as drones; forks appear as cloned ships connected by soft galactic
 * lines.
 *
 * Hooked from gantt.js → updateLiveView(result, t).
 */

(function () {
  'use strict';

  const W = 480;
  const H = 320;

  const State = {
    canvas: null,
    ctx: null,
    initialized: false,
    stars: [],          // background twinkling stars
    warpGhosts: [],     // ships exiting hyperspace { pid, x, y, t, life }
    lastSeen: {},       // pid → last known state (to detect transitions)
  };

  function pidColor(pid) {
    if (typeof window.pidColor === 'function') return window.pidColor(pid);
    const palette = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];
    return palette[pid % palette.length];
  }

  function setup() {
    if (State.initialized) return true;
    const canvas = document.getElementById('sps-canvas');
    if (!canvas) return false;
    canvas.width = W;
    canvas.height = H;
    State.canvas = canvas;
    State.ctx = canvas.getContext('2d');
    // Pre-seed background stars (deterministic positions)
    for (let i = 0; i < 60; i++) {
      State.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.4,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    State.initialized = true;
    return true;
  }

  /* ── Background ────────────────────────────────────────────────────── */
  function drawBackground(ctx, now) {
    // Deep space gradient
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W);
    g.addColorStop(0, '#101635');
    g.addColorStop(0.5, '#070A1E');
    g.addColorStop(1, '#02030A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars
    State.stars.forEach(s => {
      const a = 0.4 + Math.sin(now / 700 + s.twinkle) * 0.4;
      ctx.fillStyle = `rgba(199, 210, 254, ${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });

    // Faint grid overlay (mission control vibe)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let xx = 40; xx < W; xx += 40) {
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke();
    }
    for (let yy = 40; yy < H; yy += 40) {
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
  }

  /* ── Zones ─────────────────────────────────────────────────────────── */
  // Layout (5 zones in a 3x2 grid; center-bottom cell is a decorative gap):
  //   ┌─────────┬─────────┬─────────┐
  //   │   NEW   │ RUNNING │ WAITING │  ← top row
  //   ├─────────┼─────────┼─────────┤
  //   │  READY  │  ·····  │  TERM.  │  ← bottom row (center decorative)
  //   └─────────┴─────────┴─────────┘
  const CW = W / 3;
  const RH = H / 2;
  const ZONES = {
    new:        { x: 0 * CW, y: 0,  w: CW, h: RH, label: 'LAUNCH PAD (NEW)',         color: '#94A3B8' },
    running:    { x: 1 * CW, y: 0,  w: CW, h: RH, label: 'CPU ACTIVE (RUNNING)',     color: '#3B82F6' },
    waiting:    { x: 2 * CW, y: 0,  w: CW, h: RH, label: 'I/O DOCK (WAITING)',       color: '#EF4444' },
    ready:      { x: 0 * CW, y: RH, w: CW, h: RH, label: 'READY ORBIT (READY)',      color: '#FBBF24' },
    terminated: { x: 2 * CW, y: RH, w: CW, h: RH, label: 'HYPERSPACE (TERMINATED)',  color: '#A855F7' },
  };

  function drawZones(ctx, now) {
    Object.entries(ZONES).forEach(([key, z]) => {
      // Zone outline
      ctx.strokeStyle = z.color + '55';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(z.x + 4, z.y + 4, z.w - 8, z.h - 8);
      ctx.setLineDash([]);

      // Label (smaller font, top-centered for narrower cells)
      ctx.fillStyle = z.color;
      ctx.font = 'bold 7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = z.color;
      ctx.shadowBlur = 6;
      ctx.fillText(z.label, z.x + z.w / 2, z.y + 16);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    });

    // Decorative center-bottom cell (lifecycle "compass")
    const cxc = 1 * CW + CW / 2;
    const cyc = RH + RH / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(cxc, cyc, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6366F1';
    ctx.font = 'bold 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LIFECYCLE', cxc, cyc - 4);
    ctx.font = '6px "JetBrains Mono", monospace';
    ctx.fillStyle = '#A5B4FC';
    ctx.fillText('new→ready→run', cxc, cyc + 8);
    ctx.fillText('↔ wait → term', cxc, cyc + 18);
    ctx.textAlign = 'left';
    ctx.restore();

    // Orbital ring inside Ready zone
    const ro = ZONES.ready;
    const rcx = ro.x + ro.w / 2;
    const rcy = ro.y + ro.h / 2 + 6;
    const rrx = ro.w * 0.34;
    const rry = ro.h * 0.22;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(rcx, rcy, rrx, rry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Docking pads in Launch Pad zone
    const lp = ZONES.new;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fillRect(lp.x + 12, lp.y + lp.h - 14, lp.w - 24, 4);

    // Space station with blinking red lights inside WAITING zone
    const wz = ZONES.waiting;
    const sx = wz.x + wz.w / 2;
    const sy = wz.y + wz.h / 2 + 6;
    // Station body (rectangular hub)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(sx - 24, sy - 6, 48, 12);
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx - 24, sy - 6, 48, 2);
    // Docking arms
    ctx.fillRect(sx - 30, sy - 1, 6, 2);
    ctx.fillRect(sx + 24, sy - 1, 6, 2);
    // Blinking lights (red)
    const blink = Math.floor(now / 400) % 2 === 0;
    [-18, -6, 6, 18].forEach((ox, i) => {
      const on = ((Math.floor(now / 300) + i) % 2 === 0);
      ctx.fillStyle = on ? '#EF4444' : '#7F1D1D';
      if (on) { ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 6; }
      ctx.fillRect(sx + ox - 1, sy - 4, 2, 2);
      ctx.shadowBlur = 0;
    });
    // Antenna
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(sx - 1, sy - 14, 2, 8);
    ctx.fillStyle = blink ? '#EF4444' : '#1F2937';
    ctx.fillRect(sx - 1, sy - 16, 2, 2);
  }

  /* ── Sprites ───────────────────────────────────────────────────────── */
  // Generic spaceship: triangle pointing right, with wings + cockpit
  function drawShip(ctx, x, y, size, color, opts) {
    const facing = (opts && opts.facing) || 0;   // angle in radians
    const thrust = !!(opts && opts.thrust);
    const now = (opts && opts.now) || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);

    // Glow halo (running ships)
    if (thrust) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }

    // Wings (back triangles)
    ctx.fillStyle = color + 'AA';
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.7);
    ctx.lineTo(-size * 0.7, -size * 0.3);
    ctx.lineTo(-size * 0.3, -size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.7);
    ctx.lineTo(-size * 0.7, size * 0.3);
    ctx.lineTo(-size * 0.3, size * 0.1);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.55, -size * 0.45);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.55, size * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Cockpit window
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size * 0.15, 0, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color + 'CC';
    ctx.beginPath();
    ctx.arc(size * 0.18, 0, size * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Thrust plume
    if (thrust) {
      const flick = Math.sin(now / 60) * 0.4 + 1;
      const plume = size * 0.9 * flick;
      const grad = ctx.createLinearGradient(-size * 0.4, 0, -size * 0.4 - plume, 0);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, '#60A5FA');
      grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.25);
      ctx.lineTo(-size * 0.4 - plume, 0);
      ctx.lineTo(-size * 0.4, size * 0.25);
      ctx.closePath();
      ctx.fill();

      // Inner hot core
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.12);
      ctx.lineTo(-size * 0.4 - plume * 0.5, 0);
      ctx.lineTo(-size * 0.4, size * 0.12);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // Small drone (thread): tiny diamond with light antenna
  function drawDrone(ctx, x, y, color, blink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = color;
    ctx.shadowBlur = blink ? 6 : 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(3, 0); ctx.lineTo(0, 3); ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Tiny antenna
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(0, -6);
    ctx.stroke();
    if (blink) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-0.8, -7, 1.6, 1.6);
    }
    ctx.restore();
  }

  // Docking station: rounded pad with blinking lights
  function drawDock(ctx, x, y, w, blink) {
    ctx.save();
    ctx.translate(x, y);
    // Pad
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-w / 2, 0, w, 4);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-w / 2, 0, w, 1);
    // Blink lights
    [-w/2 + 4, w/2 - 4].forEach(lx => {
      ctx.fillStyle = blink ? '#F59E0B' : '#1F2937';
      ctx.fillRect(lx - 1, -2, 2, 2);
    });
    ctx.restore();
  }

  // Hyperspace warp ghost — fading streak
  function drawWarpGhost(ctx, x, y, color, life) {
    ctx.save();
    ctx.globalAlpha = life;
    const len = 60 * (1 - life);
    const grad = ctx.createLinearGradient(x - len, y, x + 20, y);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = grad;
    ctx.fillRect(x - len, y - 2, len + 20, 4);
    // Sparks
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const sx = x - len + (i * len) / 3;
      ctx.fillRect(sx, y - 1, 2, 2);
    }
    ctx.restore();
  }

  /* ── State computation ─────────────────────────────────────────────── */
  function computeStates(result, t) {
    const tick = Math.floor(t);
    const tickFrac = t - tick;
    const processes = result.metrics || [];
    const gantt = result.gantt || [];

    // Active PID at the current and previous ticks
    function pidAt(tt) {
      for (const e of gantt) {
        if (e.pid < 0) continue;
        if (e.start <= tt && tt < e.end) return e.pid;
      }
      return null;
    }
    const runningPid = pidAt(tick);
    const prevRunningPid = tick > 0 ? pidAt(tick - 1) : null;

    const states = {};   // pid → 'new' | 'ready' | 'running' | 'waiting' | 'terminated'
    for (const p of processes) {
      if (p.completion_time <= tick) {
        states[p.pid] = 'terminated';
      } else if (p.arrival_time > tick) {
        states[p.pid] = 'new';
      } else if (p.pid === runningPid) {
        states[p.pid] = 'running';
      } else if (
        // Just-preempted: was running last tick, not running now → brief
        // WAITING transition during the first ~40% of the new tick (saving
        // context / waiting for next slot — visually demonstrates the I/O
        // dock state defined by the classic OS lifecycle).
        p.pid === prevRunningPid && tickFrac < 0.4
      ) {
        states[p.pid] = 'waiting';
      } else {
        states[p.pid] = 'ready';
      }
    }
    return { states, processes, runningPid };
  }

  /* ── Main render ───────────────────────────────────────────────────── */
  function render(result, t) {
    if (!setup()) return;
    if (!result || !result.metrics || result.metrics.length === 0) return;

    const ctx = State.ctx;
    const now = performance.now();

    // Hide the empty placeholder once we have data
    const empty = document.getElementById('sps-empty');
    if (empty) empty.classList.add('hidden');

    // Background + zones
    drawBackground(ctx, now);
    drawZones(ctx, now);

    const { states, processes } = computeStates(result, t);
    const appProcs = (window.AppState && window.AppState.processes) || [];

    // Detect new transitions to terminated → spawn warp ghost
    processes.forEach(p => {
      const cur = states[p.pid];
      const prev = State.lastSeen[p.pid];
      if (cur === 'terminated' && prev !== 'terminated') {
        const z = ZONES.terminated;
        State.warpGhosts.push({
          pid: p.pid,
          x: z.x + z.w * 0.35,
          y: z.y + z.h / 2,
          t: 0,
          life: 1,
        });
      }
      State.lastSeen[p.pid] = cur;
    });

    // Group processes by state for layout
    const byState = { new: [], ready: [], running: [], waiting: [], terminated: [] };
    processes.forEach(p => byState[states[p.pid]].push(p));

    // ── Fork connection lines (drawn first, behind ships) ────────────
    if (window.AppState && window.AppState.forksEnabled) {
      processes.forEach(parent => {
        const appP = appProcs.find(ap => ap.pid === parent.pid);
        if (!appP || !appP.forks || appP.forks.length === 0) return;
        const parentState = states[parent.pid];
        const parentPos = positionFor(parent, parentState, byState[parentState], now, t);
        if (!parentPos) return;
        appP.forks.forEach((f, fi) => {
          // Child clone position: drift away from parent in zone
          const childAngle = (fi / appP.forks.length) * Math.PI * 2 + now / 2000;
          const childX = parentPos.x + Math.cos(childAngle) * 26;
          const childY = parentPos.y + Math.sin(childAngle) * 18;
          // Galactic-map line (gradient, dashed)
          ctx.save();
          ctx.strokeStyle = pidColor(parent.pid) + '88';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(parentPos.x, parentPos.y);
          ctx.lineTo(childX, childY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          // Mini child ship
          drawShip(ctx, childX, childY, 6, pidColor(parent.pid), { facing: childAngle, now });
        });
      });
    }

    // ── Hyperspace ghosts (animated) ─────────────────────────────────
    State.warpGhosts = State.warpGhosts.filter(g => g.life > 0);
    State.warpGhosts.forEach(g => {
      g.life -= 0.02;
      g.x += 4;
      drawWarpGhost(ctx, g.x, g.y, pidColor(g.pid), Math.max(0, g.life));
    });

    // ── Draw ships per zone ──────────────────────────────────────────
    processes.forEach(p => {
      const st = states[p.pid];
      const pos = positionFor(p, st, byState[st], now, t);
      if (!pos) return;
      const color = pidColor(p.pid);

      // Ship-state visuals
      if (st === 'new') {
        // Docked at launch pad — ship sits with countdown
        drawDock(ctx, pos.x, pos.y + 16, 28, Math.floor(now / 400) % 2 === 0);
        drawShip(ctx, pos.x, pos.y, 11, color, { facing: -Math.PI / 2, now });
        // Countdown label
        const togo = Math.max(0, p.arrival_time - Math.floor(t));
        ctx.fillStyle = '#FBBF24';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`T-${togo}`, pos.x, pos.y + 30);
      } else if (st === 'ready') {
        // Floating in orbit (slow drift)
        drawShip(ctx, pos.x, pos.y, 10, color, { facing: pos.angle, now });
      } else if (st === 'running') {
        // Active flight with thrust
        drawShip(ctx, pos.x, pos.y, 14, color, { facing: 0, thrust: true, now });
        // Pulsing aura
        const pulse = (Math.sin(now / 200) + 1) * 0.5;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.25 + pulse * 0.4;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (st === 'waiting') {
        // Docked at the I/O station with intermittent red lights
        ctx.save();
        // Tether line to station
        const stCx = ZONES.waiting.x + ZONES.waiting.w / 2;
        const stCy = ZONES.waiting.y + ZONES.waiting.h / 2 + 6;
        ctx.strokeStyle = '#EF4444' + '88';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(stCx, stCy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawShip(ctx, pos.x, pos.y, 10, color, { facing: Math.PI, now });
        // Small "I/O" badge pulse
        const pulse = (Math.sin(now / 220) + 1) * 0.5;
        ctx.fillStyle = `rgba(239,68,68,${0.35 + pulse * 0.4})`;
        ctx.fillRect(pos.x - 10, pos.y + 12, 20, 9);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 7px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('I/O', pos.x, pos.y + 19);
        ctx.textAlign = 'left';
      } else if (st === 'terminated') {
        // Faded outline — show pid in a small badge
        ctx.save();
        ctx.globalAlpha = 0.45;
        drawShip(ctx, pos.x, pos.y, 8, color, { facing: 0, now });
        ctx.restore();
      }

      // PID label
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.pid}`, pos.x, pos.y + (st === 'new' ? -22 : -18));
      ctx.textAlign = 'left';

      // ── Threads as orbiting drones ────────────────────────────────
      if (window.AppState && window.AppState.threadsEnabled) {
        const appP = appProcs.find(ap => ap.pid === p.pid);
        if (appP && appP.threads && appP.threads.length > 0) {
          const droneR = (st === 'running') ? 24 : 18;
          appP.threads.forEach((thread, ti) => {
            const angle = (ti / appP.threads.length) * Math.PI * 2 +
                          now / (st === 'running' ? 400 : 900);
            const dx = pos.x + Math.cos(angle) * droneR;
            const dy = pos.y + Math.sin(angle) * droneR * 0.6;
            const blink = Math.floor(now / 200 + ti) % 2 === 0;
            drawDrone(ctx, dx, dy, color, blink);
          });
        }
      }
    });
  }

  /* ── Positioning helper ────────────────────────────────────────────── */
  function positionFor(proc, st, peers, now, t) {
    const z = ZONES[st];
    if (!z) return null;
    const idx = peers.findIndex(p => p.pid === proc.pid);
    const total = peers.length;

    if (st === 'new') {
      // Line up on the launch pad
      const slotW = (z.w - 32) / Math.max(1, total);
      const x = z.x + 16 + slotW * (idx + 0.5);
      const y = z.y + z.h - 30;
      return { x, y };
    }

    if (st === 'ready') {
      // Orbit around the center of the zone
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2 + 8;
      const rx = z.w * 0.32;
      const ry = z.h * 0.18;
      const angle = (idx / Math.max(1, total)) * Math.PI * 2 + now / 3000;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      return { x, y, angle: angle + Math.PI / 2 };
    }

    if (st === 'running') {
      // Stack vertically inside CPU zone (multi-core support)
      const slotH = (z.h - 40) / Math.max(1, total);
      const y = z.y + 28 + slotH * (idx + 0.5);
      const x = z.x + z.w * 0.5;
      return { x, y };
    }

    if (st === 'waiting') {
      // Hover near the docking station with a slight orbit drift
      const cx = z.x + z.w / 2;
      const cy = z.y + z.h / 2 - 14;
      const slotW = (z.w - 30) / Math.max(1, total);
      const x = z.x + 15 + slotW * (idx + 0.5);
      const y = cy + Math.sin(now / 400 + idx) * 3;
      return { x, y };
    }

    if (st === 'terminated') {
      // Drift to the right edge (after warp)
      const slotH = (z.h - 32) / Math.max(1, total);
      const y = z.y + 24 + slotH * (idx + 0.5);
      const x = z.x + z.w * 0.5;
      return { x, y };
    }

    return null;
  }

  /* ── Public API ────────────────────────────────────────────────────── */
  function reset() {
    State.warpGhosts = [];
    State.lastSeen = {};
    if (State.canvas && State.ctx) {
      State.ctx.clearRect(0, 0, W, H);
      const empty = document.getElementById('sps-empty');
      if (empty) empty.classList.remove('hidden');
    }
  }

  // Expose
  window.updateSpaceStates = render;
  window.resetSpaceStates = reset;
})();
