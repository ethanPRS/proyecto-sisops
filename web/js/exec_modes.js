/**
 * exec_modes.js — Retro CPU Execution Mode Visualizer
 *
 * Auto-playing pixel-art animations (Mario theme) for the four execution
 * modes. Inherits processes from window.AppState. Mirrors the Gantt's
 * playback pattern (play/pause/speed/tick) but draws themed scenes.
 *
 * Turn A: Concurrency + Parallelism.
 * Turn B (next): Multiprocessing + Multithreading.
 */

(function () {
  'use strict';

  /* ═════════════════════════════════════════════════════════════════
     Constants
     ═════════════════════════════════════════════════════════════════ */
  const CANVAS_W = 800;
  const CANVAS_H = 340;
  const TICKS_PER_SEC = 2;   // baseline tick rate at 1x (matches Gantt)
  const MAX_PROCS_VISIBLE = 6;

  const MODE_INFO = {
    concurrency: {
      label: 'Concurrencia',
      title: 'CPU Stage — Concurrencia',
      color: '#F97316',
      tip: 'Mario alternando tareas rápidamente. Suelta las pinzas, machaca el aguacate, y corre a ver los empalmes.',
    },
    parallelism: {
      label: 'Paralelismo',
      title: 'CPU Stage — Paralelismo',
      color: '#2563EB',
      tip: 'Mario voltea la carne mientras Luigi destapa bebidas. Trabajo 100% simultáneo y sin interrupciones.',
    },
    multiprocessing: {
      label: 'Multiprocesamiento',
      title: 'CPU Stage — Multiprocesamiento',
      color: '#8B5CF6',
      tip: 'Mario y Bowser en patios separados. Espacios aislados, si uno hace crash el otro no se entera.',
    },
    multithreading: {
      label: 'Multithreading',
      title: 'CPU Stage — Multithreading',
      color: '#10B981',
      tip: 'Comparten mesa y hielera. Rapidísimo, pero si Peach y Bowser agarran las mismas pinzas a la vez → race condition.',
    },
  };

  // Mario costume palettes — block-pixel style
  const COSTUMES = {
    mario:  { hat: '#E63946', shirt: '#E63946', overalls: '#1D4ED8', skin: '#FCD8B5', hair: '#5C2C0D', shoes: '#3E1F0A' },
    luigi:  { hat: '#22C55E', shirt: '#22C55E', overalls: '#1D4ED8', skin: '#FCD8B5', hair: '#5C2C0D', shoes: '#3E1F0A' },
    peach:  { hat: '#F472B6', shirt: '#FFFFFF', overalls: '#F472B6', skin: '#FCD8B5', hair: '#FBBF24', shoes: '#7C2D12' },
    toad:   { hat: '#EF4444', shirt: '#FFFFFF', overalls: '#1D4ED8', skin: '#FCD8B5', hair: '#FFFFFF', shoes: '#3E1F0A' },
    chef:   { hat: '#FFFFFF', shirt: '#FFFFFF', overalls: '#E63946', skin: '#FCD8B5', hair: '#5C2C0D', shoes: '#3E1F0A' },
  };

  /* ═════════════════════════════════════════════════════════════════
     State
     ═════════════════════════════════════════════════════════════════ */
  const State = {
    mode: 'concurrency',
    processes: [],
    schedule: null,
    totalTime: 0,
    currentTick: 0,
    playing: false,
    rafId: null,
    lastFrame: 0,
    speed: 1,
    soundEnabled: true,
    canvas: null,
    ctx: null,

    // Per-mode transient animation state
    chefX: 0,
    chefTargetX: 0,
    chefBob: 0,
    lastActivePid: -1,
    poofs: [],            // [{x, y, t, life}]
    coins: [],            // [{x, y, vx, vy, t, life, color}]
    karts: [],            // [{lane, x, frame, pid, finished, finishedAt}]
    sparkles: [],         // [{x, y, t, life}]

    initialized: false,
  };

  /* ═════════════════════════════════════════════════════════════════
     Sound — synthesized retro NES-style beeps via Web Audio API
     ═════════════════════════════════════════════════════════════════ */
  const Sound = {
    ctx: null,
    init() {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) this.ctx = new Ctx();
      } catch (e) { /* silent */ }
    },
    beep(freq, duration, type, vol) {
      if (!State.soundEnabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(g).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    },
    noise(duration, freq, vol) {
      if (!State.soundEnabled || !this.ctx) return;
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, duration * ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1000;
      const g = ctx.createGain();
      g.gain.value = vol || 0.05;
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start();
    },
    coin() {
      this.beep(988, 0.05, 'square', 0.06);
      setTimeout(() => this.beep(1319, 0.16, 'square', 0.05), 45);
    },
    poof() { this.noise(0.08, 700, 0.04); },
    contextSwitch() {
      this.beep(440, 0.04, 'square', 0.035);
      setTimeout(() => this.beep(220, 0.05, 'square', 0.035), 30);
    },
    cheer() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.beep(f, 0.12, 'square', 0.05), i * 90));
    },
    start() { this.beep(660, 0.10, 'square', 0.06); },
    finish() { this.beep(880, 0.12, 'square', 0.05); setTimeout(() => this.beep(1319, 0.20, 'square', 0.05), 100); },
  };

  /* ═════════════════════════════════════════════════════════════════
     Sprite drawers — block-pixel style
     ═════════════════════════════════════════════════════════════════ */
  function pidColor(pid) {
    if (typeof window.pidColor === 'function') return window.pidColor(pid);
    const palette = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];
    return palette[pid % palette.length];
  }

  /* ── Pixel-art sprite system ─────────────────────────────────────── */
  // Each sprite is a multiline string. Whitespace is ignored, '.' is transparent,
  // any other char is looked up in the palette.
  function parseSprite(str) {
    return str.split('\n')
      .map(s => s.replace(/[ \t]/g, ''))
      .filter(s => s.length > 0);
  }

  function drawPixelSprite(ctx, x, y, scale, grid, palette, opts) {
    const s = scale;
    const flipX = opts && opts.flipX;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (!col) continue;
        const cx = flipX ? (row.length - 1 - c) : c;
        ctx.fillStyle = col;
        ctx.fillRect(x + cx * s, y + r * s, s, s);
      }
    }
  }

  function lighten(hex, amt) {
    const m = hex.replace('#','').match(/.{2}/g);
    if (!m) return hex;
    const rgb = m.map(h => Math.min(255, Math.round(parseInt(h, 16) * (1 + amt))));
    return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* ── Sprite library ──────────────────────────────────────────────── */
  // Chef Mario — 16w × 18h. Big poofy hat, mustache, white apron with red knot.
  const SPRITE_CHEF_STAND = parseSprite(`
    ....wwwwwwww....
    ..wwwwwwwwwwww..
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    ..wwwwwwwwwwww..
    wwwwwwwwwwwwwwww
    wwwwwwwwwwwwwwww
    ..bsssspppsssbb.
    .bsssp..p.psssb.
    .bsssp.Ep.psssb.
    .bsspppppppssssb
    ..ssspppppppss..
    ..ssbbbbbbbbss..
    ...sssssssssss..
    ..awwwwrrwwwwa..
    .aawwwwwwwwwwaa.
    .h.aawwwwwwaa.h.
  `);

  // Chef Mario — stirring frame (arm raised over pot)
  const SPRITE_CHEF_STIR = parseSprite(`
    ....wwwwwwww....
    ..wwwwwwwwwwww..
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    ..wwwwwwwwwwww..
    wwwwwwwwwwwwwwww
    wwwwwwwwwwwwwwww
    ..bsssspppsssbb.
    .bsssp..p.psssbs
    .bsssp.Ep.psssbs
    .bsspppppppsssss
    ..ssspppppppss..
    ..ssbbbbbbbbss..
    ...sssssssssss..
    ..awwwwrrwwwwa..
    .aawwwwwwwwwwaa.
    .h.aawwwwwwaa.h.
  `);

  // Mario Kart — 24w × 22h. Inspired by classic SNES MK pixel art.
  const SPRITE_KART_F0 = parseSprite(`
    ........rrrrrrrr........
    ......rrrrrrrrrrrr......
    .....rrrrwwwrwwwwrrr....
    ....rrrrwMMwrwMMwrrrr...
    ....rrrrrrrrrrrrrrrr....
    ....rrrrrrrrrrrrrrrr....
    ....hhsssssspsssshh.....
    ....hssspsspspsssh......
    ....hsspEpsspspEsh......
    .....sssspsspsspss......
    .....ssbbbbsbbbbss......
    ......ssssssssssss......
    .......rrrrrrrrrr.......
    ......rrrrrrrrrrr.......
    ....KKBBBBccccBBBBKK....
    ...KKBBBBccccccBBBBKK...
    ..KKBBBBcccccccBBBBBKK..
    ..KBBBBBBBBBBBBBBBBBBK..
    ..K.................K..
    ..K.................K..
    GGGG.............GGGG..
    GxxG.............GxxG..
    GGGG.............GGGG..
  `);

  const SPRITE_KART_F1 = parseSprite(`
    ........rrrrrrrr........
    ......rrrrrrrrrrrr......
    .....rrrrwwwrwwwwrrr....
    ....rrrrwMMwrwMMwrrrr...
    ....rrrrrrrrrrrrrrrr....
    ....rrrrrrrrrrrrrrrr....
    ....hhsssssspsssshh.....
    ....hssspsspspsssh......
    ....hsspEpsspspEsh......
    .....sssspsspsspss......
    .....ssbbbbsbbbbss......
    ......ssssssssssss......
    .......rrrrrrrrrr.......
    ......rrrrrrrrrrr.......
    ....KKBBBBccccBBBBKK....
    ...KKBBBBccccccBBBBKK...
    ..KKBBBBcccccccBBBBBKK..
    ..KBBBBBBBBBBBBBBBBBBK..
    ..K.................K..
    ..K.................K..
    GGGG.............GGGG..
    GGxxG............GGxxG.
    GGGG.............GGGG..
  `);

  function kartPalette(bodyColor) {
    return {
      r: '#E63946',         // hat / decoration
      h: '#5C2C0D',         // hair edge
      s: '#FCD8B5',         // skin
      p: '#5C2C0D',         // hair / mustache color but distinct usage
      b: '#5C2C0D',         // mustache (brown)
      E: '#0F172A',         // eyes
      w: '#FFFFFF',         // hat M base
      M: '#E63946',         // M letters (red on white background)
      B: bodyColor,         // kart body (PID color)
      c: lighten(bodyColor, 0.35),  // kart accent (cyan-ish)
      K: '#0F172A',         // kart outline
      G: '#94A3B8',         // wheels (silver)
      x: '#1F2937',         // wheel hub center
    };
  }

  function chefPalette(accentColor) {
    return {
      w: '#FFFFFF',         // hat / apron
      a: '#E5E7EB',         // apron shadow
      b: '#5C2C0D',         // hair / mustache / brown
      s: '#FCD8B5',         // skin
      p: '#5C2C0D',         // hair clusters
      r: accentColor || '#E63946',  // apron knot color (varies per chef)
      E: '#0F172A',         // eyes
      h: '#3E1F0A',         // shoes (dark brown)
    };
  }

  // Castle — 22w × 24h. Stone bricks, red flag, lit window.
  const SPRITE_CASTLE = parseSprite(`
    .........rfff.........
    .........rfff.........
    .........rfff.........
    .........rfff.........
    .........FFFF.........
    ..G.G..GGGGGGGG..G.G..
    ..GgG..G......G..GgG..
    ..GgG..G..ww..G..GgG..
    .GGGG..G..ww..G..GGGG.
    .GggG..GGGGGGGG..GggG.
    .GggG.................
    .GGGG.GGGGGGGGGGGG.GGG
    .....GGggggggggggGG...
    .....GgGGGGGGGGGGgG...
    .....GgGggggggggGgG...
    .....GgGggdoorggGgG...
    .....GgGgg....ggGgG...
    .....GgGgg.kk.ggGgG...
    .....GgGgg.kk.ggGgG...
    .....GgGgg.kk.ggGgG...
    .....GgGgg.kk.ggGgG...
    GGGGGGgGgggggggggGgGGG
    yyyyyyygggggggggggyyyy
    yyyyyyyyyyyyyyyyyyyyyy
  `);

  function castlePalette(active, accent) {
    return {
      G: active ? '#475569' : '#334155',   // dark stone outline
      g: active ? '#64748B' : '#475569',   // mid stone fill
      F: '#0F172A',                        // flagpole top
      f: '#94A3B8',                        // flagpole shaft
      r: '#E63946',                        // flag
      w: active ? '#FCD34D' : '#1F2937',   // window light
      d: '#0F172A',                        // door arch outline (we'll handle)
      o: '#1F2937',                        // door fill
      k: active ? accent || '#FCD34D' : '#374151',  // door details / activity glow
      y: '#65A30D',                        // grass
    };
  }

  // Green warp pipe — 12w × 14h. Used for fork events.
  const SPRITE_PIPE = parseSprite(`
    GGGGGGGGGGGG
    GbbbbbbbbbbG
    GbggggggggbG
    GbggggggggbG
    GGGGGGGGGGGG
    .GbbbbbbbbG.
    .GbggggggbG.
    .GbggggggbG.
    .GbggggggbG.
    .GbggggggbG.
    .GbggggggbG.
    .GbggggggbG.
    .GGGGGGGGGG.
    ............
  `);

  const PIPE_PALETTE = {
    G: '#0F172A',     // pipe outline (dark green-black)
    b: '#16A34A',     // pipe lighter band
    g: '#22C55E',     // pipe main fill
  };

  // 1-Up green mushroom — 12w × 12h
  const SPRITE_MUSHROOM = parseSprite(`
    ...gggggggg.
    ..ggwwwwwwgg
    .gwwwwwwwwwg
    gwwggggggwwg
    gwwggggggwwg
    gggggggggggg
    .ssspppsssss
    ..sspppspppp
    ...spppsppps
    ...sssssssss
    ....hh..hh..
    ....hh..hh..
  `);

  const MUSHROOM_PALETTE = {
    g: '#22C55E',         // mushroom green cap
    w: '#FFFFFF',         // white spots / face
    s: '#FCD8B5',         // skin (face)
    p: '#0F172A',         // eyes
    h: '#3E1F0A',         // shoes (no shoes, repurposed for stem shadow)
  };

  // Treasure chest — 14w × 10h. Used for shared memory in MT and per-castle in MP.
  const SPRITE_CHEST = parseSprite(`
    KKKKKKKKKKKKKK
    KbbbbbbbbbbbbK
    KbyyyyKKyyyybK
    KbyyKKKKKKyybK
    KbyKKlocKKybbK
    KKKKKKKKKKKKKK
    .KbbbbbbbbbbK.
    .Kbb.bbbb.bbK.
    .KbbbbbbbbbbK.
    .KKKKKKKKKKKK.
  `);

  const CHEST_PALETTE = {
    K: '#0F172A',         // outline
    b: '#92400E',         // wood
    y: '#FCD34D',         // gold trim
    l: '#475569',         // lock metal
    o: '#0F172A',         // lock hole
    c: '#0F172A',         // (fallback)
  };

  // Mini Mario (8w × 12h) — for multithreading scene
  const SPRITE_MINI_MARIO_STAND = parseSprite(`
    .rrrrrr.
    rrrwwrrr
    bbsspbbb
    .ssspss.
    .ssbbss.
    ..ssss..
    rrrrrrrr
    rbbbbbbr
    rbbBBbbr
    rrBBBBrr
    .rr..rr.
    hh....hh
  `);

  const SPRITE_MINI_MARIO_RUN = parseSprite(`
    .rrrrrr.
    rrrwwrrr
    bbsspbbb
    .ssspss.
    .ssbbss.
    ..ssss..
    rrrrrrrr
    rbbbbbbr
    rbbBBbbr
    rBBBBBBr
    rh....hr
    .h....h.
  `);

  function miniMarioPalette(costume) {
    const c = COSTUMES[costume] || COSTUMES.mario;
    return {
      r: c.hat,
      w: '#FFFFFF',
      s: '#FCD8B5',
      p: '#5C2C0D',
      b: '#5C2C0D',
      B: c.overalls,
      h: c.shoes,
    };
  }

  // 8x12 block-pixel Mario. (x,y) is top-left. Frame: 0=stand, 1/2=run, 3=jump
  function drawMario(ctx, x, y, scale, costumeName, frame) {
    const c = COSTUMES[costumeName] || COSTUMES.mario;
    const s = scale;
    const px = (cx, cy, w, h) => ctx.fillRect(x + cx * s, y + cy * s, w * s, h * s);

    // hat
    ctx.fillStyle = c.hat;
    px(1, 0, 6, 1); px(0, 1, 8, 1); px(0, 2, 8, 1);
    // hair sides + back
    ctx.fillStyle = c.hair;
    px(0, 3, 1, 2); px(7, 3, 1, 2);
    // face (skin)
    ctx.fillStyle = c.skin;
    px(1, 3, 6, 3);
    // eyes
    ctx.fillStyle = '#0F172A';
    px(3, 4, 1, 1);
    // mustache
    ctx.fillStyle = c.hair;
    px(2, 5, 4, 1);
    // shirt
    ctx.fillStyle = c.shirt;
    px(0, 6, 8, 2);
    // overalls
    ctx.fillStyle = c.overalls;
    px(1, 8, 6, 3);
    // arms (animate slightly with frame for run cycle)
    const armOffset = (frame === 1) ? -1 : (frame === 2 ? 1 : 0);
    ctx.fillStyle = c.shirt;
    px(0, 6 + (frame === 3 ? -1 : 0), 1, 2);
    px(7, 6 + (frame === 3 ? -1 : 0), 1, 2);
    // shoes
    ctx.fillStyle = c.shoes;
    if (frame === 3) {           // jump: legs together
      px(2, 11, 4, 1);
    } else if (frame === 1) {    // run frame A
      px(0 + armOffset, 11, 3, 1);
      px(5, 11, 3, 1);
    } else if (frame === 2) {    // run frame B
      px(0, 11, 3, 1);
      px(5 + armOffset, 11, 3, 1);
    } else {                     // stand
      px(0, 11, 3, 1);
      px(5, 11, 3, 1);
    }
  }

  // Cooking pot — black pot with liquid (process color)
  function drawPot(ctx, x, y, scale, color, fillPct, active) {
    const s = scale;
    const px = (cx, cy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + cx*s, y + cy*s, w*s, h*s); };
    // rim
    px(0, 0, 12, 1, '#1F2937');
    px(1, 1, 10, 1, '#374151');
    // body
    px(0, 2, 12, 6, '#0F172A');
    px(1, 3, 10, 5, '#1F2937');
    // liquid (filled bottom-up by 1-fillPct)
    const liquidH = Math.round(5 * fillPct);
    if (liquidH > 0) {
      const top = 8 - liquidH;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1*s, y + top*s, 10*s, liquidH*s);
      // bubbles when active
      if (active && Math.random() < 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        const bx = x + (2 + Math.random()*8) * s;
        const by = y + (top + Math.random()*Math.max(1,liquidH-1)) * s;
        ctx.fillRect(bx, by, s, s);
      }
    }
    // handles
    px(-1, 3, 1, 2, '#1F2937');
    px(12, 3, 1, 2, '#1F2937');
    // glow if active
    if (active) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 12*s, 8*s);
      ctx.restore();
    }
  }

  // Stove — gray base with control knobs
  function drawStove(ctx, x, y, scale, active) {
    const s = scale;
    const px = (cx, cy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + cx*s, y + cy*s, w*s, h*s); };
    px(0, 0, 14, 1, '#475569');
    px(0, 1, 14, 5, '#64748B');
    // burner
    px(2, 0, 10, 1, active ? '#F97316' : '#94A3B8');
    if (active) {
      // tiny flames
      ctx.fillStyle = '#FBBF24';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + (3 + i*2) * s, y - 1 * s, s, s);
      }
    }
    // knobs
    px(1, 4, 1, 1, '#0F172A');
    px(12, 4, 1, 1, '#0F172A');
  }

  // Coin — yellow circle with $
  function drawCoin(ctx, x, y, scale, frame) {
    const s = scale;
    const flip = frame % 4;
    const w = (flip === 0 || flip === 2) ? 6 : 3;
    const off = (6 - w) / 2;
    ctx.fillStyle = '#FCD34D';
    ctx.fillRect(x + off*s, y, w*s, 6*s);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(x + (off+w-1)*s, y, s, 6*s);
    if (flip === 0) {
      ctx.fillStyle = '#92400E';
      ctx.fillRect(x + (off+1)*s, y + 2*s, s, 2*s);
    }
  }

  // Smoke puff — expanding ring of pixel squares
  function drawPuff(ctx, x, y, scale, life) {
    // life: 0..1
    const r = (1 - life) * 14 * scale;
    const alpha = life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#E2E8F0';
    const s = scale * 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(x + Math.cos(a) * r - s/2, y + Math.sin(a) * r - s/2, s, s);
    }
    ctx.restore();
  }

  // Sparkle — small + cross
  function drawSparkle(ctx, x, y, scale, life) {
    ctx.save();
    ctx.globalAlpha = life;
    ctx.fillStyle = '#FBBF24';
    const s = scale;
    ctx.fillRect(x - 0.5*s, y - 2*s, s, s);
    ctx.fillRect(x - 0.5*s, y + 1*s, s, s);
    ctx.fillRect(x - 2*s, y - 0.5*s, s, s);
    ctx.fillRect(x + 1*s, y - 0.5*s, s, s);
    ctx.fillRect(x - 0.5*s, y - 0.5*s, s, s);
    ctx.restore();
  }

  // Mario Kart sprite — Mario in a kart, ~24x22 internal pixels.
  function drawKart(ctx, x, y, scale, color, frame) {
    // Soft shadow under the kart
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x + 2 * scale, y + 22 * scale, 20 * scale, 1.5 * scale);
    const grid = (frame % 2 === 0) ? SPRITE_KART_F0 : SPRITE_KART_F1;
    drawPixelSprite(ctx, x, y, scale, grid, kartPalette(color));
  }

  // Detailed chef Mario — ~16x18, two frames (stand/stir).
  // Optional accent tints the apron knot so multiple chefs look distinct.
  function drawChef(ctx, x, y, scale, frame, accentColor) {
    const grid = (frame % 2 === 0) ? SPRITE_CHEF_STAND : SPRITE_CHEF_STIR;
    drawPixelSprite(ctx, x, y, scale, grid, chefPalette(accentColor));
  }

  // Checkered finish flag
  function drawFinishLine(ctx, x, yTop, yBot) {
    const w = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, yTop, w, yBot - yTop);
    ctx.fillStyle = '#0F172A';
    for (let cy = yTop; cy < yBot; cy += 6) {
      const offset = ((cy - yTop) / 6) % 2 === 0 ? 0 : 3;
      ctx.fillRect(x + offset, cy, 3, 3);
      ctx.fillRect(x + (3 - offset), cy + 3, 3, 3);
    }
  }

  // Trophy — small pixel cup
  function drawTrophy(ctx, x, y, scale, bob) {
    const s = scale;
    const px = (cx, cy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + cx*s, y + cy*s + bob, w*s, h*s); };
    px(1, 0, 6, 1, '#FCD34D');
    px(0, 1, 8, 2, '#FBBF24');
    px(1, 3, 6, 1, '#F59E0B');
    px(2, 4, 4, 1, '#FBBF24');
    px(3, 5, 2, 1, '#F59E0B');
    px(2, 6, 4, 1, '#92400E');
  }

  /* ═════════════════════════════════════════════════════════════════
     Schedule builders
     ═════════════════════════════════════════════════════════════════ */

  // Concurrency: Round-Robin with quantum=1, 1 core
  // Returns { timeline: [pidAtT0, pidAtT1, ...], totalTime, perProc: {pid: {remaining, total, started}} }
  function buildConcurrencySchedule(processes) {
    const timeline = [];
    const remaining = {};
    const total = {};
    const arrivals = {};
    processes.forEach(p => {
      remaining[p.pid] = p.burst_time;
      total[p.pid] = p.burst_time;
      arrivals[p.pid] = p.arrival_time || 0;
    });
    const ready = [];
    const arrived = new Set();
    let t = 0;
    const totalWork = processes.reduce((a, p) => a + p.burst_time, 0);
    const safety = totalWork + processes.length * 4;   // guard
    while (timeline.length < safety) {
      // arrivals up to t
      processes
        .slice()
        .sort((a, b) => a.arrival_time - b.arrival_time)
        .forEach(p => {
          if (!arrived.has(p.pid) && p.arrival_time <= t && remaining[p.pid] > 0) {
            arrived.add(p.pid);
            ready.push(p.pid);
          }
        });
      if (ready.length === 0) {
        // are we done?
        const done = Object.values(remaining).every(r => r <= 0);
        if (done) break;
        // idle tick — advance to next arrival
        timeline.push(-1);
        t++;
        continue;
      }
      const pid = ready.shift();
      timeline.push(pid);
      remaining[pid]--;
      t++;
      // re-add arrivals that came in during this tick
      processes.forEach(p => {
        if (!arrived.has(p.pid) && p.arrival_time <= t && remaining[p.pid] > 0) {
          arrived.add(p.pid);
          ready.push(p.pid);
        }
      });
      if (remaining[pid] > 0) ready.push(pid);
    }
    return { timeline, totalTime: timeline.length, total, remaining: { ...total } };
  }

  // Multiprocessing — top-N processes by burst, each on its own simulated CPU.
  // Each "castle" runs independently in parallel from t=0.
  // Returns { castles: [{pid, burst, forks: [{fid, t, burst}]}], totalTime }
  function buildMultiprocessingSchedule(processes) {
    const top = processes.slice().sort((a, b) => b.burst_time - a.burst_time).slice(0, 4);
    const castles = top.map(p => ({
      pid: p.pid,
      burst: p.burst_time,
      forks: (p.forks || []).map(f => ({
        fid: f.fid,
        spawnAt: Math.max(1, f.delay || 1),
        burst: f.burst_time || 1,
      })),
    }));
    const totalTime = Math.max(...castles.map(c =>
      Math.max(c.burst, ...c.forks.map(f => f.spawnAt + f.burst))
    ));
    return { castles, totalTime };
  }

  // Multithreading — collect all threads from all processes (or treat each
  // process as 1 implicit thread) and round-robin them on a single CPU.
  // Returns { timeline: [{pid, tid} or null per tick], threads, totalTime }
  function buildMultithreadingSchedule(processes) {
    const threads = [];
    processes.forEach(p => {
      if (p.threads && p.threads.length > 0) {
        p.threads.forEach(t => threads.push({ pid: p.pid, tid: t.tid, burst: t.burst_time }));
      } else {
        threads.push({ pid: p.pid, tid: 0, burst: p.burst_time });
      }
    });
    const remaining = threads.map(t => t.burst);
    const total = remaining.reduce((a, b) => a + b, 0);
    const timeline = [];
    let i = 0;
    let safety = total + threads.length * 4;
    while (timeline.length < total && safety-- > 0) {
      // find next thread with remaining work
      let scanned = 0;
      while (scanned < threads.length && remaining[i] <= 0) {
        i = (i + 1) % threads.length;
        scanned++;
      }
      if (remaining[i] <= 0) break;
      timeline.push({ pid: threads[i].pid, tid: threads[i].tid, idx: i });
      remaining[i]--;
      i = (i + 1) % threads.length;
    }
    return { timeline, threads, totalTime: timeline.length };
  }

  // Parallelism: assign each process to earliest-available core (ignore arrival
  // for simplicity beyond the start).
  function buildParallelismSchedule(processes, numCores) {
    const cores = Array.from({ length: Math.max(1, numCores) }, () => []);
    const coreEnd = new Array(cores.length).fill(0);
    const sorted = processes.slice().sort((a, b) => a.arrival_time - b.arrival_time);
    sorted.forEach(p => {
      // find earliest available core
      let best = 0;
      for (let c = 1; c < cores.length; c++) {
        if (coreEnd[c] < coreEnd[best]) best = c;
      }
      const start = Math.max(coreEnd[best], p.arrival_time);
      const end = start + p.burst_time;
      cores[best].push({ pid: p.pid, start, end, burst: p.burst_time });
      coreEnd[best] = end;
    });
    const totalTime = Math.max(...coreEnd);
    return { lanes: cores, totalTime };
  }

  /* ═════════════════════════════════════════════════════════════════
     Renderers
     ═════════════════════════════════════════════════════════════════ */

  function clearStage(ctx, bgGradient) {
    ctx.fillStyle = bgGradient || '#1E293B';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawHUDText(ctx, text, x, y, color, size) {
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold ${size || 12}px "JetBrains Mono", monospace`;
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color || '#F8FAFC';
    ctx.fillText(text, x, y);
  }

  /* ── Concurrency: BurgerTime chef ─────────────────────────────── */
  function renderConcurrency(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched) return;

    // Background — outdoor BBQ patio sunset
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#92400E');   // warm sunset orange
    grad.addColorStop(0.5, '#78350F');
    grad.addColorStop(1, '#451A03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars / evening sky dots
    ctx.fillStyle = 'rgba(255,255,200,0.3)';
    for (let yy = 0; yy < 80; yy += 18) {
      for (let xx = 20; xx < CANVAS_W; xx += 60) {
        ctx.fillRect(xx + (yy % 30), yy + 4, 2, 2);
      }
    }

    const tick = State.currentTick;
    const tIdx = Math.min(Math.floor(tick), sched.timeline.length - 1);
    const activePid = sched.timeline[tIdx];

    // Etiquetas para los platillos del asador
    const PLATILLOS = ['Agujas', 'Empalmes', 'Guacamole', 'Salchicha', 'Carne', 'Mollejas'];

    // Layout pots (= platillos en el asador)
    const procs = State.processes;
    const visible = procs.slice(0, MAX_PROCS_VISIBLE);
    const padX = 60;
    const slotW = (CANVAS_W - padX * 2) / Math.max(1, visible.length);
    const stoveY = 220;

    // Floor / counter
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(0, stoveY + 50, CANVAS_W, CANVAS_H - stoveY - 50);
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, stoveY + 48, CANVAS_W, 2);

    // Compute remaining burst per pid up to current tick
    const remaining = {};
    visible.forEach(p => { remaining[p.pid] = p.burst_time; });
    for (let i = 0; i < tIdx; i++) {
      const pp = sched.timeline[i];
      if (pp >= 0 && remaining[pp] > 0) remaining[pp]--;
    }

    // Detect context switch → spawn poof + sound
    if (activePid !== State.lastActivePid && activePid >= 0 && State.lastActivePid >= 0) {
      const oldIdx = visible.findIndex(p => p.pid === State.lastActivePid);
      if (oldIdx >= 0) {
        const px = padX + slotW * (oldIdx + 0.5);
        State.poofs.push({ x: px, y: stoveY - 20, t: 0, life: 0.6 });
      }
      Sound.contextSwitch();
    }
    if (activePid !== State.lastActivePid && activePid >= 0) {
      // sparkles on new active stove
      const newIdx = visible.findIndex(p => p.pid === activePid);
      if (newIdx >= 0) {
        const px = padX + slotW * (newIdx + 0.5);
        for (let i = 0; i < 4; i++) {
          State.sparkles.push({ x: px + (Math.random() - 0.5) * 30, y: stoveY - 10 + (Math.random() - 0.5) * 10, t: 0, life: 0.5 });
        }
      }
    }
    State.lastActivePid = activePid;

    // Draw stoves and pots
    visible.forEach((p, i) => {
      const cx = padX + slotW * (i + 0.5);
      const stoveX = cx - 7 * 4;
      const isActive = (activePid === p.pid);
      drawStove(ctx, stoveX, stoveY + 30, 4, isActive);
      const fillPct = remaining[p.pid] / p.burst_time;
      const potX = cx - 6 * 4;
      drawPot(ctx, potX, stoveY - 8, 4, pidColor(p.pid), fillPct, isActive);

      // Platillo label
      const platillo = PLATILLOS[(p.pid - 1) % PLATILLOS.length];
      drawHUDText(ctx, platillo, cx - 28, stoveY + 80, pidColor(p.pid), 9);
      drawHUDText(ctx, `${remaining[p.pid]}/${p.burst_time}t`, cx - 20, stoveY + 96, '#CBD5E1', 10);

      // "Burning" indicator if not visited too long (= remaining > 0 and not active for >= burst_time ticks before)
      // Simple heuristic: if their last activity was long ago, draw red exclamation
      let lastSeen = -1;
      for (let i = tIdx - 1; i >= 0; i--) {
        if (sched.timeline[i] === p.pid) { lastSeen = i; break; }
      }
      if (remaining[p.pid] > 0 && (tIdx - lastSeen) > 4) {
        // draw "!" warning
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx + 18, stoveY - 28, 4, 12);
        ctx.fillRect(cx + 18, stoveY - 12, 4, 4);
      }
    });

    // Chef Mario position (target = center above active pot)
    let targetX = -100;
    if (activePid >= 0) {
      const idx = visible.findIndex(p => p.pid === activePid);
      if (idx >= 0) targetX = padX + slotW * (idx + 0.5) - 16;
    }
    State.chefTargetX = targetX;
    // smooth tween
    if (State.chefX === 0 && targetX > 0) State.chefX = targetX; // initial snap
    State.chefX += (State.chefTargetX - State.chefX) * Math.min(1, dt * 14);
    State.chefBob += dt * 8;

    // Draw chef Mario above active stove (detailed sprite, 16x18 @ scale 3)
    if (activePid >= 0 && targetX > 0) {
      const bobY = Math.sin(State.chefBob) * 2;
      const stirFrame = Math.floor(State.chefBob) % 2;   // alternate stir frames
      drawChef(ctx, State.chefX - 24, stoveY - 78 + bobY, 3, stirFrame);
      // tiny "stir" line dropping from arm into pot
      if (Math.abs(State.chefTargetX - State.chefX) < 4 && stirFrame === 1) {
        ctx.fillStyle = '#92400E';   // wooden spoon
        ctx.fillRect(State.chefX + 26, stoveY - 28 + bobY, 3, 14);
      }
    }

    // Update and draw poofs
    State.poofs = State.poofs.filter(p => p.t < p.life);
    State.poofs.forEach(p => {
      p.t += dt;
      const pct = 1 - (p.t / p.life);
      drawPuff(ctx, p.x, p.y, 2, pct);
    });

    // Update and draw sparkles
    State.sparkles = State.sparkles.filter(s => s.t < s.life);
    State.sparkles.forEach(s => {
      s.t += dt;
      const pct = 1 - (s.t / s.life);
      drawSparkle(ctx, s.x, s.y, 2, pct);
    });

    // HUD — Carnita Asada
    drawHUDText(ctx, `Tick: ${tIdx} / ${sched.totalTime}`, 14, 22, '#FBBF24', 13);
    drawHUDText(ctx, `Mario solo · ${visible.length} platillos en el asador`, 14, 40, '#FED7AA', 11);
    drawHUDText(ctx, '🥩 Da vuelta a la carne, suelta, machaca aguacate, corre a ver los empalmes...', 14, CANVAS_H - 14, '#FED7AA', 11);
  }

  /* ── Parallelism: N chefs in N parallel kitchen stations ───────── */
  function renderParallelism(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched) return;

    // Background — kitchen wall (orange brick) + counter
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(1, '#451A03');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Brick pattern
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let yy = 0; yy < 200; yy += 22) {
      for (let xx = (yy / 22) % 2 === 0 ? 0 : 22; xx < CANVAS_W; xx += 44) {
        ctx.fillRect(xx, yy, 42, 20);
      }
    }

    // Wide kitchen counter at the bottom
    const counterY = 240;
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(0, counterY + 60, CANVAS_W, CANVAS_H - counterY - 60);
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, counterY + 58, CANVAS_W, 2);

    const lanes = sched.lanes;
    const numLanes = lanes.length;
    const padX = 40;
    const slotW = (CANVAS_W - padX * 2) / numLanes;
    const tick = State.currentTick;

    // Chef accent colors — each chef wears a different colored apron knot
    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6', '#FBBF24', '#A855F7'];

    lanes.forEach((laneSched, l) => {
      const cx = padX + slotW * (l + 0.5);
      const accent = CHEF_ACCENTS[l % CHEF_ACCENTS.length];

      // Lane progress
      const laneTotal = laneSched.length ? Math.max(...laneSched.map(e => e.end)) : 0;
      let workDone = 0;
      let activeEntry = null;
      for (const entry of laneSched) {
        if (entry.end <= tick) workDone = entry.end;
        else if (entry.start <= tick && tick < entry.end) {
          workDone = tick;
          activeEntry = entry;
          break;
        }
      }
      const progress = laneTotal > 0 ? workDone / laneTotal : 0;
      const finished = laneTotal > 0 && workDone >= laneTotal;

      // Cheer ONCE on finish
      let kart = State.karts[l];
      if (!kart) { kart = { lane: l, finished: false, finishedAt: -1 }; State.karts[l] = kart; }
      if (finished && !kart.finished) {
        kart.finished = true;
        kart.finishedAt = tick;
        Sound.cheer();
      }

      // Core station — concrete top with stove
      const stationY = counterY;
      ctx.fillStyle = '#475569';
      ctx.fillRect(cx - 70, stationY + 50, 140, 14);
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 70, stationY + 64, 140, 4);

      // Stove + pot
      const stoveX = cx - 28;
      const stoveY = stationY + 16;
      drawStove(ctx, stoveX, stoveY + 30, 4, !!activeEntry);
      // Pot color: current PID being cooked, or gray if idle/done
      let potColor = '#94A3B8';
      if (activeEntry) potColor = pidColor(activeEntry.pid);
      else if (finished && laneSched.length) potColor = pidColor(laneSched[laneSched.length - 1].pid);
      // Pot fill: total work remaining in this lane / total
      const fillPct = laneTotal > 0 ? (laneTotal - workDone) / laneTotal : 0;
      const potX = cx - 24;
      drawPot(ctx, potX, stoveY - 8, 4, potColor, fillPct, !!activeEntry);

      // Chef Mario behind the pot — always visible (parallel = N chefs at once)
      // Stir frame offset by lane index so they don't all move in lockstep
      const phase = State.chefBob + l * 0.7;
      const bobY = Math.sin(phase * 8) * 2;
      const stirFrame = Math.floor(phase * 4) % 2;
      // Idle chefs move less (frame 0 only)
      const frame = activeEntry ? stirFrame : 0;
      drawChef(ctx, cx - 24, stoveY - 78 + bobY, 3, frame, accent);

      // Wooden spoon when stirring active pot
      if (activeEntry && stirFrame === 1) {
        ctx.fillStyle = '#92400E';
        ctx.fillRect(cx + 26, stoveY - 28 + bobY, 3, 14);
      }

      // Lane label — personaje asignado
      const CHARS = ['Mario', 'Luigi', 'Toad', 'Yoshi', 'Peach', 'Wario'];
      drawHUDText(ctx, CHARS[l % CHARS.length], cx - 28, 100, accent, 9);

      // Lane progress bar
      const barX = cx - 60;
      const barY = 110;
      const barW = 120;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = accent;
      ctx.fillRect(barX, barY, barW * progress, 6);

      // Active PID label
      if (activeEntry) {
        drawHUDText(ctx, `P${activeEntry.pid}`, cx - 8, 130, pidColor(activeEntry.pid), 12);
      } else if (finished) {
        drawHUDText(ctx, '✓ DONE', cx - 18, 130, '#FBBF24', 11);
      } else {
        drawHUDText(ctx, 'idle', cx - 12, 130, '#CBD5E1', 11);
      }

      // Coin bursts when this lane completes a unit of work
      const ticked = Math.floor(tick);
      if (activeEntry && ticked > 0 && ((ticked + l) % 2) === 0) {
        // periodic coin pop near the pot
        const coinFrame = Math.floor(performance.now() / 100);
        drawCoin(ctx, cx + 18 + Math.sin(performance.now() / 200 + l) * 4,
                 stoveY - 36 - (Math.abs(Math.sin(phase * 8))) * 8, 2, coinFrame);
      }
    });

    // HUD: progress + speedup
    const totalSeq = State.processes.reduce((a, p) => a + p.burst_time, 0);
    const speedup = sched.totalTime > 0 ? (totalSeq / sched.totalTime) : 1;
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 22, '#FBBF24', 13);
    drawHUDText(ctx, `${numLanes} fontaneros en la parrilla · ${State.processes.length} procesos`, 14, 40, '#FED7AA', 11);
    drawHUDText(ctx, `⚡ Speedup ×${speedup.toFixed(2)} vs Mario solo (${totalSeq}t)`, 14, 60, '#FEF3C7', 11);
    drawHUDText(ctx, '🌮 Mario voltea la carne mientras Luigi destapa las bebidas — al mismo tiempo', 14, CANVAS_H - 14, '#FED7AA', 11);
  }

  /* ── Multiprocessing: N walled-off kitchens ────────────────────── */
  function renderMultiprocessing(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched || !sched.castles) return;

    // Background — dark night purple to emphasize separation
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#312E81');
    sky.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const tick = State.currentTick;
    const kitchens = sched.castles;   // reusing data shape: {pid, burst, forks}
    const N = kitchens.length;
    const padX = 24;
    const slotW = (CANVAS_W - padX * 2) / Math.max(1, N);
    const kitchenY = 60;
    const kitchenH = 230;

    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6'];

    // Title above all kitchens
    drawHUDText(ctx, '🏠 Cada proceso = su propio patio. Si Bowser quema su carne, Mario sigue cenando.', 14, 22, '#C4B5FD', 11);

    kitchens.forEach((k, i) => {
      const left = padX + slotW * i + 8;
      const right = padX + slotW * (i + 1) - 8;
      const kw = right - left;
      const accent = CHEF_ACCENTS[i % CHEF_ACCENTS.length];
      const isActive = tick < k.burst;
      const cpuTime = Math.min(k.burst, Math.max(0, tick));
      const pidCol = pidColor(k.pid);

      // ── Walls (the visual key for "isolation") ────────────────────
      const wallTh = 8;   // wall thickness
      // Wall outer/inner colors
      const wallOuter = '#0F172A';
      const wallStone = isActive ? '#475569' : '#334155';
      const wallStoneLight = isActive ? '#64748B' : '#475569';

      // Top wall (with stone bricks pattern)
      ctx.fillStyle = wallOuter;
      ctx.fillRect(left - 2, kitchenY, kw + 4, wallTh + 4);
      ctx.fillStyle = wallStone;
      ctx.fillRect(left, kitchenY + 2, kw, wallTh);
      ctx.fillStyle = wallStoneLight;
      // brick pattern in top wall
      for (let bx = left + 2; bx < right - 4; bx += 16) {
        ctx.fillRect(bx, kitchenY + 4, 12, 4);
      }

      // Left wall
      ctx.fillStyle = wallOuter;
      ctx.fillRect(left - 2, kitchenY, wallTh + 2, kitchenH);
      ctx.fillStyle = wallStone;
      ctx.fillRect(left, kitchenY, wallTh, kitchenH);
      ctx.fillStyle = wallStoneLight;
      for (let by = kitchenY + 4; by < kitchenY + kitchenH - 4; by += 14) {
        ctx.fillRect(left + 2, by, 4, 8);
      }

      // Right wall
      ctx.fillStyle = wallOuter;
      ctx.fillRect(right - wallTh, kitchenY, wallTh + 2, kitchenH);
      ctx.fillStyle = wallStone;
      ctx.fillRect(right - wallTh, kitchenY, wallTh, kitchenH);
      ctx.fillStyle = wallStoneLight;
      for (let by = kitchenY + 4; by < kitchenY + kitchenH - 4; by += 14) {
        ctx.fillRect(right - wallTh + 2, by, 4, 8);
      }

      // Bottom wall (floor base)
      ctx.fillStyle = wallOuter;
      ctx.fillRect(left - 2, kitchenY + kitchenH - 6, kw + 4, 8);

      // ── Interior ─────────────────────────────────────────────────
      const innerX = left + wallTh;
      const innerY = kitchenY + wallTh + 4;
      const innerW = kw - wallTh * 2;
      const innerH = kitchenH - wallTh - 8;

      // Wall paper / interior color (warm tone if active)
      const wallpaper = isActive ? '#7C2D12' : '#1F2937';
      ctx.fillStyle = wallpaper;
      ctx.fillRect(innerX, innerY, innerW, innerH);

      // Wood floor stripes
      ctx.fillStyle = '#92400E';
      ctx.fillRect(innerX, innerY + innerH - 24, innerW, 24);
      ctx.fillStyle = '#7C2D12';
      for (let fx = innerX; fx < innerX + innerW; fx += 14) {
        ctx.fillRect(fx, innerY + innerH - 24, 1, 24);
      }

      // PID badge inside top of kitchen
      ctx.save();
      ctx.fillStyle = pidCol;
      ctx.fillRect(innerX + innerW / 2 - 22, innerY + 4, 44, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${k.pid}`, innerX + innerW / 2, innerY + 14);
      ctx.textAlign = 'left';
      ctx.restore();

      // Stove + pot
      const stationCx = innerX + innerW / 2;
      const stoveScale = 3;
      const stoveX = stationCx - 7 * stoveScale;
      const stoveY = innerY + innerH - 60;
      drawStove(ctx, stoveX, stoveY + 24, stoveScale, isActive);
      const fillPct = k.burst > 0 ? (k.burst - cpuTime) / k.burst : 0;
      const potX = stationCx - 6 * stoveScale;
      drawPot(ctx, potX, stoveY - 6, stoveScale, pidCol, fillPct, isActive);

      // Chef Mario inside the kitchen (always visible — process has its own CPU)
      const phase = State.chefBob + i * 0.5;
      const bobY = Math.sin(phase * 8) * 2;
      const stirFrame = isActive ? (Math.floor(phase * 4) % 2) : 0;
      drawChef(ctx, stationCx - 24, stoveY - 70 + bobY, 3, stirFrame, accent);

      if (isActive && stirFrame === 1) {
        ctx.fillStyle = '#92400E';
        ctx.fillRect(stationCx + 26, stoveY - 22 + bobY, 3, 12);
      }

      // Memory chest (recipe book) — own private memory, on a small shelf
      const chestX = innerX + 6;
      const chestY = innerY + 26;
      // Shelf
      ctx.fillStyle = '#92400E';
      ctx.fillRect(chestX - 2, chestY + 22, 60, 3);
      drawPixelSprite(ctx, chestX, chestY, 3, SPRITE_CHEST, CHEST_PALETTE);
      // Coin counter on chest
      drawHUDText(ctx, `🪙 ${cpuTime}/${k.burst}`, chestX, chestY - 4, '#FCD34D', 10);
      ctx.fillStyle = '#A78BFA';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillText('PRIVATE', chestX + 6, chestY + 36);

      // ── Fork events: pipe drills through the WALL (between kitchens)
      k.forks.forEach((f, fi) => {
        if (tick < f.spawnAt) return;
        const popProgress = Math.min(1, (tick - f.spawnAt) / 1.5);
        // Pipe is horizontal, embedded in the right wall, pointing to next kitchen
        const pipeStartX = right - wallTh - 2;
        const pipeY = innerY + innerH - 80 + fi * 14;
        const pipeLength = 30;

        // Crack effect on the wall: small dust particles
        if (popProgress < 0.6) {
          ctx.fillStyle = '#94A3B8';
          for (let pp = 0; pp < 4; pp++) {
            ctx.fillRect(pipeStartX + Math.random() * 8 - 4,
                         pipeY + Math.random() * 16, 2, 2);
          }
        }

        // Horizontal pipe (use vertical sprite rotated conceptually — draw rect)
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(pipeStartX, pipeY - 2, pipeLength + 4, 16);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(pipeStartX + 1, pipeY, pipeLength + 2, 12);
        ctx.fillStyle = '#16A34A';
        ctx.fillRect(pipeStartX + 1, pipeY, pipeLength + 2, 3);
        ctx.fillStyle = '#15803D';
        ctx.fillRect(pipeStartX + 1, pipeY + 9, pipeLength + 2, 3);
        // Pipe mouth (slight expansion at end)
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(pipeStartX + pipeLength, pipeY - 4, 4, 20);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(pipeStartX + pipeLength + 1, pipeY - 2, 2, 16);

        // 1-Up mushroom emerging from pipe end
        if (popProgress > 0.4) {
          const emerge = Math.min(1, (popProgress - 0.4) / 0.6);
          const mushroomX = pipeStartX + pipeLength + 8 + emerge * 14;
          const mushroomY = pipeY - 14;
          drawPixelSprite(ctx, mushroomX, mushroomY, 2, SPRITE_MUSHROOM, MUSHROOM_PALETTE);
        }
      });

      // Floor label — patio aislado
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 PATIO AISLADO', innerX + innerW / 2, innerY + innerH - 4);
      ctx.textAlign = 'left';
      ctx.restore();
    });

    // HUD — Multiprocessing
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 40, '#A78BFA', 11);
    drawHUDText(ctx, '🏠 Patios separados · para pedir salsa hay que mandar un Toad a cruzar la calle',
                14, CANVAS_H - 14, '#C4B5FD', 11);
  }

  /* ── Multithreading: ONE kitchen, N chefs, ONE shared recipe book ─ */
  function renderMultithreading(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched || !sched.threads) return;

    // Background — single warm kitchen (no walls, single shared space)
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.55, '#9A3412');
    sky.addColorStop(0.56, '#451A03');
    sky.addColorStop(1, '#1C1917');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Brick wall pattern (background, single big kitchen)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let yy = 0; yy < 200; yy += 22) {
      for (let xx = (yy / 22) % 2 === 0 ? 0 : 22; xx < CANVAS_W; xx += 44) {
        ctx.fillRect(xx, yy, 42, 20);
      }
    }

    // Long shared kitchen counter
    const counterY = 240;
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, counterY, CANVAS_W, 20);
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(0, counterY + 20, CANVAS_W, 6);
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, counterY + 26, CANVAS_W, CANVAS_H - counterY - 26);
    // Counter wood grain stripes
    ctx.fillStyle = '#451A03';
    for (let cx = 0; cx < CANVAS_W; cx += 28) {
      ctx.fillRect(cx, counterY + 4, 1, 14);
    }

    const tick = State.currentTick;
    const tIdx = Math.min(Math.floor(tick), sched.timeline.length - 1);
    const threads = sched.threads;

    // Race condition detection: thread changed from prev tick to current tick.
    // Active during the first 35% of the tick to feel like a brief flash.
    let raceActive = false;
    if (tIdx >= 1 && tIdx < sched.timeline.length) {
      const cur = sched.timeline[tIdx];
      const prev = sched.timeline[tIdx - 1];
      if (cur && prev && (cur.pid !== prev.pid || cur.tid !== prev.tid)) {
        const tickFrac = tick - tIdx;
        raceActive = tickFrac < 0.35;
      }
    }

    // Screen shake on race
    let shakeX = 0, shakeY = 0;
    if (raceActive) {
      shakeX = (Math.random() - 0.5) * 4;
      shakeY = (Math.random() - 0.5) * 4;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── The SHARED RECIPE BOOK at the center, on a pedestal ──────────
    const bookW = 160;
    const bookH = 110;
    const bookX = CANVAS_W / 2 - bookW / 2;
    const bookY = 80;

    // Pedestal under the book
    ctx.fillStyle = '#475569';
    ctx.fillRect(bookX - 10, bookY + bookH, bookW + 20, 8);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(bookX - 10, bookY + bookH + 8, bookW + 20, 4);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bookX + 4, bookY + 4, bookW, bookH);

    // Book cover (red leather with gold trim) — flash red on race
    const coverColor = raceActive ? '#EF4444' : '#7F1D1D';
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(bookX - 2, bookY - 2, bookW + 4, bookH + 4);
    ctx.fillStyle = coverColor;
    ctx.fillRect(bookX, bookY, bookW, bookH);
    // Gold trim border
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 3;
    ctx.strokeRect(bookX + 4, bookY + 4, bookW - 8, bookH - 8);
    ctx.lineWidth = 1;

    // Book spine on the left
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(bookX, bookY, 8, bookH);

    // Shared resource label — Hielera Roja (shared cooler)
    ctx.save();
    ctx.fillStyle = '#FCD34D';
    ctx.font = 'bold 12px "Press Start 2P", "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🧊 HIELERA', CANVAS_W / 2, bookY + 32);
    ctx.font = '8px "Press Start 2P", "JetBrains Mono", monospace';
    ctx.fillStyle = '#FEF3C7';
    ctx.fillText('COMPARTIDA', CANVAS_W / 2, bookY + 50);
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = '#A7F3D0';
    ctx.fillText('sal, pinzas, limon', CANVAS_W / 2, bookY + 68);
    // Shared tick counter
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText(`🥤 ${tIdx}`, CANVAS_W / 2, bookY + 92);
    ctx.textAlign = 'left';
    ctx.restore();

    // Spine glow if race
    if (raceActive) {
      ctx.save();
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(239,68,68,0.5)';
      ctx.fillRect(bookX, bookY, bookW, bookH);
      ctx.restore();
    }

    // ── Chef Marios standing in a row at the counter ─────────────────
    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6', '#FBBF24', '#A855F7', '#06B6D4', '#EAB308'];
    const N = threads.length;
    const chefScale = N <= 4 ? 3 : 2;
    const chefW = 16 * chefScale;
    const chefH = 18 * chefScale;
    const padX = 60;
    const usableW = CANVAS_W - padX * 2;
    const slotW = usableW / Math.max(1, N);

    const activeIdx = (tIdx >= 0 && sched.timeline[tIdx]) ? sched.timeline[tIdx].idx : -1;

    threads.forEach((t, idx) => {
      const cx = padX + slotW * (idx + 0.5);
      const isActive = (idx === activeIdx);

      // Active chef leaps up toward the book; others stand at counter.
      const tickFrac = tick - Math.floor(tick);
      const leap = isActive ? Math.sin(tickFrac * Math.PI) : 0;
      const leapY = leap * 50;

      const phase = State.chefBob + idx * 0.7;
      const bobY = isActive ? 0 : Math.sin(phase * 6) * 1.5;
      const stirFrame = isActive ? (Math.floor(tickFrac * 4) % 2) : (Math.floor(phase * 2) % 2);

      const accent = CHEF_ACCENTS[idx % CHEF_ACCENTS.length];
      const baseY = counterY - chefH + 6;
      const chefY = baseY - leapY + bobY;
      const chefX = Math.round(cx - chefW / 2);

      drawChef(ctx, chefX, chefY, chefScale, stirFrame, accent);

      // Active chef's "reach" — arrow line toward the book
      if (isActive) {
        ctx.save();
        ctx.strokeStyle = pidColor(t.pid);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, chefY + 8);
        ctx.lineTo(CANVAS_W / 2, bookY + bookH / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Glow ring under active chef
      if (isActive) {
        ctx.save();
        ctx.strokeStyle = pidColor(t.pid);
        ctx.lineWidth = 2;
        ctx.shadowColor = pidColor(t.pid);
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(cx, baseY + chefH + 4, chefW / 2 + 6, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // PID/TID label
      const label = (t.tid > 0) ? `P${t.pid}.T${t.tid}` : `P${t.pid}`;
      drawHUDText(ctx, label, Math.round(cx - 24), counterY + 18, pidColor(t.pid), 10);
    });

    // ── Race condition banner ───────────────────────────────────────
    if (raceActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.fillRect(CANVAS_W / 2 - 200, 40, 400, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px "Press Start 2P", "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ RACE CONDITION', CANVAS_W / 2, 60);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FECACA';
      ctx.fillText('¡Peach y Bowser agarraron las mismas pinzas a la vez!', CANVAS_W / 2, 78);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.restore();   // shake

    // HUD — Multithreading carnita asada
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 22, '#34D399', 13);
    drawHUDText(ctx, `${threads.length} personajes · 1 asador · 1 hielera roja compartida`, 14, 40, '#A7F3D0', 11);
    drawHUDText(ctx, '🧊 Toad, Yoshi y Peach comparten sal, limon y pinzas. Si dos las agarran a la vez → ¡pleito!',
                14, CANVAS_H - 14, '#A7F3D0', 11);
  }

  /* ═════════════════════════════════════════════════════════════════
     Stage / Loop
     ═════════════════════════════════════════════════════════════════ */
  function setMode(mode) {
    if (!MODE_INFO[mode]) return;
    State.mode = mode;
    pause();
    State.currentTick = 0;
    State.lastActivePid = -1;
    State.chefX = 0;
    State.poofs = [];
    State.coins = [];
    State.karts = [];
    State.sparkles = [];

    // Update tabs
    document.querySelectorAll('.em-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    // Update screen modifier class for color theming
    const screen = document.getElementById('screen-exec-modes');
    if (screen) {
      screen.classList.remove('mode-concurrency', 'mode-parallelism', 'mode-multiprocessing', 'mode-multithreading');
      screen.classList.add('mode-' + mode);
    }
    // Title + tip
    const info = MODE_INFO[mode];
    const titleEl = document.getElementById('em-stage-title');
    if (titleEl) titleEl.textContent = info.title;
    const tipTitle = document.getElementById('em-tip-title');
    const tipText = document.getElementById('em-tip-text');
    if (tipTitle) tipTitle.textContent = info.label;
    if (tipText) tipText.textContent = info.tip;

    rebuildSchedule();
    render(0);
  }

  function rebuildSchedule() {
    const procs = State.processes;
    if (!procs || procs.length === 0) { State.schedule = null; State.totalTime = 0; updateStats(); return; }

    if (State.mode === 'concurrency') {
      State.schedule = buildConcurrencySchedule(procs);
      State.totalTime = State.schedule.totalTime;
    } else if (State.mode === 'parallelism') {
      const numCores = (window.AppState && window.AppState.numCores) || 1;
      State.schedule = buildParallelismSchedule(procs, numCores);
      State.totalTime = State.schedule.totalTime;
    } else if (State.mode === 'multiprocessing') {
      State.schedule = buildMultiprocessingSchedule(procs);
      State.totalTime = State.schedule.totalTime;
    } else if (State.mode === 'multithreading') {
      State.schedule = buildMultithreadingSchedule(procs);
      State.totalTime = State.schedule.totalTime;
    }
    updateStats();
  }

  function updateStats() {
    const card = document.getElementById('em-stats-card');
    if (!card) return;
    if (!State.processes.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    const totalSeq = State.processes.reduce((a, p) => a + p.burst_time, 0);
    const totalTime = State.totalTime || totalSeq;
    const throughput = totalTime > 0 ? (State.processes.length / totalTime).toFixed(2) : '—';
    const speedup = totalTime > 0 ? (totalSeq / totalTime).toFixed(2) : '1.00';

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('em-stat-time', totalTime + 't');
    setVal('em-stat-throughput', throughput + ' p/t');
    setVal('em-stat-speedup', '×' + speedup);
    setVal('em-stat-procs', String(State.processes.length));
  }

  function play() {
    if (!State.schedule || !State.processes.length) return;
    Sound.init();
    if (State.currentTick >= State.totalTime) State.currentTick = 0;
    State.playing = true;
    State.lastFrame = performance.now();
    Sound.start();
    updatePlayBtn();
    const step = (now) => {
      if (!State.playing) return;
      const dt = Math.min(0.1, (now - State.lastFrame) / 1000);
      State.lastFrame = now;
      State.currentTick += dt * TICKS_PER_SEC * State.speed;
      if (State.currentTick >= State.totalTime) {
        State.currentTick = State.totalTime;
        State.playing = false;
        Sound.finish();
        updatePlayBtn();
      }
      render(dt);
      if (State.playing) State.rafId = requestAnimationFrame(step);
    };
    State.rafId = requestAnimationFrame(step);
  }

  function pause() {
    State.playing = false;
    if (State.rafId) cancelAnimationFrame(State.rafId);
    updatePlayBtn();
  }

  function reset() {
    pause();
    State.currentTick = 0;
    State.lastActivePid = -1;
    State.chefX = 0;
    State.poofs = [];
    State.karts = [];
    State.sparkles = [];
    render(0);
  }

  function setSpeed(v) {
    State.speed = v;
    const lbl = document.getElementById('em-speed-label');
    if (lbl) lbl.textContent = v.toFixed(1) + 'x';
  }

  function render(dt) {
    if (!State.ctx) return;
    if (!State.processes.length) return;
    if (State.mode === 'concurrency') renderConcurrency(dt);
    else if (State.mode === 'parallelism') renderParallelism(dt);
    else if (State.mode === 'multiprocessing') renderMultiprocessing(dt);
    else if (State.mode === 'multithreading') renderMultithreading(dt);

    const tickEl = document.getElementById('em-tick');
    if (tickEl) tickEl.textContent = `t = ${Math.floor(State.currentTick)} / ${State.totalTime}`;
  }

  function updatePlayBtn() {
    const btn = document.getElementById('em-btn-play');
    if (!btn) return;
    btn.innerHTML = State.playing
      ? '<i class="ph ph-pause"></i> Pause'
      : '<i class="ph ph-play"></i> Play';
  }

  /* ═════════════════════════════════════════════════════════════════
     Wiring
     ═════════════════════════════════════════════════════════════════ */
  function refreshFromAppState() {
    const procs = (window.AppState && window.AppState.processes) || [];
    State.processes = procs.map(p => ({
      pid: p.pid,
      arrival_time: p.arrival_time || 0,
      burst_time: p.burst_time || 1,
      threads: (p.threads || []).slice(),
      forks: (p.forks || []).slice(),
    }));

    // Toggle empty-state vs stage
    const empty = document.getElementById('em-empty');
    const stage = document.getElementById('em-stage');
    const controls = document.getElementById('em-controls');
    const card = document.getElementById('em-stats-card');
    const hasProcs = State.processes.length > 0;
    if (empty) empty.style.display = hasProcs ? 'none' : '';
    if (stage) stage.style.display = hasProcs ? '' : 'none';
    if (controls) controls.style.display = hasProcs ? '' : 'none';
    if (card) card.style.display = hasProcs ? '' : 'none';

    if (hasProcs) rebuildSchedule();
    render(0);
  }

  function setupCanvas() {
    const canvas = document.getElementById('em-canvas');
    if (!canvas) return;
    State.canvas = canvas;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    State.ctx = canvas.getContext('2d');
    State.ctx.imageSmoothingEnabled = false;
  }

  function init() {
    if (State.initialized) return;
    State.initialized = true;
    setupCanvas();

    // Tab clicks
    document.querySelectorAll('.em-tab').forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });

    // Controls
    const playBtn = document.getElementById('em-btn-play');
    const resetBtn = document.getElementById('em-btn-reset');
    const speedInp = document.getElementById('em-speed');
    const soundBtn = document.getElementById('em-btn-sound');
    if (playBtn) playBtn.addEventListener('click', () => {
      if (State.playing) pause(); else play();
    });
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (speedInp) speedInp.addEventListener('input', (e) => setSpeed(parseFloat(e.target.value)));
    if (soundBtn) soundBtn.addEventListener('click', () => {
      State.soundEnabled = !State.soundEnabled;
      soundBtn.classList.toggle('muted', !State.soundEnabled);
      soundBtn.innerHTML = State.soundEnabled
        ? '<i class="ph ph-speaker-high"></i>'
        : '<i class="ph ph-speaker-slash"></i>';
      if (State.soundEnabled) Sound.init();
    });

    // Refresh whenever user navigates here
    document.querySelectorAll('[data-screen="exec-modes"]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(() => {
        // Sync mode from the execution-mode select before refreshing
        const modeMap = {
          'Concurrency':     'concurrency',
          'Multithreading':  'multithreading',
          'Parallelism':     'parallelism',
          'Multiprocessing': 'multiprocessing',
        };
        const appMode = window.AppState && window.AppState.executionMode;
        const mapped = modeMap[appMode] || 'concurrency';
        setMode(mapped);
        refreshFromAppState();
      }, 60));
    });

    // Default mode — read from select if already set, else concurrency
    const initModeMap = {
      'Concurrency':     'concurrency',
      'Multithreading':  'multithreading',
      'Parallelism':     'parallelism',
      'Multiprocessing': 'multiprocessing',
    };
    const initAppMode = window.AppState && window.AppState.executionMode;
    setMode(initModeMap[initAppMode] || 'concurrency');
    refreshFromAppState();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  // Expose for debugging
  window.ExecModes = { State, setMode, play, pause, reset, refreshFromAppState };
})();
