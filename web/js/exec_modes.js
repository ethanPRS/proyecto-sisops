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
      label: 'Concurrency',
      title: 'BBQ Stage — Mario alone',
      color: '#F97316',
      tip: 'Mario alone at the grill: flips the agujas, hops to the molcajete to mash avocado, runs to the comal for tortillas. Only two hands — switches super fast between tasks.',
    },
    parallelism: {
      label: 'Parallelism',
      title: 'BBQ Stage — Luigi joins in',
      color: '#2563EB',
      tip: 'Luigi shows up to help. While Mario flips a sausage, Luigi pops cold drinks and slices limes. Two pairs of hands working at the exact same second.',
    },
    multiprocessing: {
      label: 'Multiprocessing',
      title: 'Multiprocessing — Two houses, two grills',
      color: '#8B5CF6',
      tip: 'Too many people came: two grills in two different yards. Each with its own cooler and tortillas. If Bowser burns his meat, Mario\'s BBQ keeps going. To talk to each other: send a Toad across the street.',
    },
    multithreading: {
      label: 'Multithreading',
      title: 'Multithreading — Everybody at one grill',
      color: '#10B981',
      tip: 'Toad, Yoshi, Peach (and Bowser who crashed the party) helping at the same grill. They share the cutting board, the seasoning, and the red cooler. If two grab the only tongs at the same time → race condition!',
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

  // Easing helpers for smooth tweens
  function lerp(a, b, t)     { return a + (b - a) * t; }
  function easeOutCubic(t)   { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t)    { return t * t * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ── Sprite library ──────────────────────────────────────────────── */

  // Carne / steak on grill — 12w × 6h. Three food variants by PID.
  const SPRITE_MEAT_AGUJAS = parseSprite(`
    .hhhhhhhhhh.
    rrcMrcMrcMrr
    rMrcMrcMrcMr
    rrcMrcMrcMrr
    .hhhhhhhhhh.
    ............
  `);

  const SPRITE_MEAT_SALCHICHA = parseSprite(`
    ............
    .pppppppppp.
    ppPPpppppppP
    ppppppPPpppP
    .pppppppppp.
    ............
  `);

  const SPRITE_MEAT_EMPALME = parseSprite(`
    ...wwwwwww..
    .wwccccccww.
    wccccGccccGc
    wccGcccccccc
    .wwccccccww.
    ...wwwwwww..
  `);

  const MEAT_PALETTE = {
    r: '#92400E',         // raw meat brown-red
    M: '#7C2D12',         // dark sear marks
    c: '#451A03',         // char/grill marks
    h: '#1C1917',         // skewer stick
    p: '#FECACA',         // sausage pink
    P: '#F87171',         // sausage darker
    w: '#F3F4F6',         // tortilla light
    G: '#6B7280',         // small char dot
  };

  // Asador (BBQ grill) — 30w × 12h. Long horizontal grill with grates.
  const SPRITE_ASADOR = parseSprite(`
    KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
    KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK
    KGgGgGgGgGgGgGgGgGgGgGgGgGgGGK
    KGgGgGgGgGgGgGgGgGgGgGgGgGgGGK
    KGgGgGgGgGgGgGgGgGgGgGgGgGgGGK
    KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK
    KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
    KK..........................KK
    KK..........................KK
    KK..........................KK
    KK..........................KK
    KK..........................KK
  `);

  function asadorPalette(active) {
    return {
      K: '#0F172A',
      b: active ? '#1F2937' : '#111827',
      G: active ? '#9CA3AF' : '#6B7280',
      g: active ? '#1F2937' : '#0F172A',
    };
  }

  // Molcajete with guacamole — 10w × 8h.
  const SPRITE_MOLCAJETE = parseSprite(`
    ..........
    .KKKKKKKK.
    KGGGgGGGGK
    KGgGGGggGK
    KGGGGgggGK
    .KGGggggK.
    .KKKKKKKK.
    .KK....KK.
  `);

  const MOLCAJETE_PALETTE = {
    K: '#1C1917',         // dark stone
    G: '#22C55E',         // guacamole green
    g: '#16A34A',         // darker green clusters
  };

  // Hielera (red ice cooler) — 14w × 12h.
  const SPRITE_HIELERA = parseSprite(`
    KKKKKKKKKKKKKK
    KhhhhhhhhhhhhK
    KhhhhhhhhhhhhK
    KKKKKKKKKKKKKK
    KrrrrrrrrrrrrK
    KrwwwwwIwwwwrK
    KrwwIwCwwEwwrK
    KrwwwwwwwwwwrK
    KrrrrrrrrrrrrK
    KKKKKKKKKKKKKK
    .K..........K.
    .K..........K.
  `);

  const HIELERA_PALETTE = {
    K: '#0F172A',
    h: '#FECACA',         // light red lid
    r: '#EF4444',         // red body
    w: '#FFFFFF',         // white "ICE" panel
    I: '#0F172A',         // letters
    C: '#0F172A',
    E: '#0F172A',
  };

  // BBQ tongs — 8w × 12h. Vertical pair of metal arms.
  const SPRITE_TONGS = parseSprite(`
    KK....KK
    KKK..KKK
    .KK..KK.
    .KK..KK.
    .KK..KK.
    ..K..K..
    ..K..K..
    ..KKKK..
    ...KK...
    ...KK...
    ...KK...
    ..KKKK..
  `);

  const TONGS_PALETTE = {
    K: '#1F2937',
  };

  // House (casa) — 22w × 18h. Simple Mexican-style with red tile roof.
  const SPRITE_HOUSE = parseSprite(`
    ..........TT..........
    .........TTTT.........
    ........TTTTTT........
    .......TTTTTTTT.......
    ......TTTTTTTTTT......
    .....TTTTTTTTTTTT.....
    ....TTTTTTTTTTTTTT....
    ...TTTTTTTTTTTTTTTT...
    ..wwwwwwwwwwwwwwwwww..
    ..wWWWwwwwwwwwwWWWww..
    ..wWyWwwwddddwwWyWww..
    ..wWyWwwwdoodwwWyWww..
    ..wWWWwwwdoodwwWWWww..
    ..wwwwwwwddddwwwwwww..
    ..wwwwwwwddddwwwwwww..
    KKKKKKKKKKKKKKKKKKKKKK
    .KK................KK.
    .KK................KK.
  `);

  function housePalette(active) {
    return {
      T: active ? '#DC2626' : '#7F1D1D',     // roof red
      w: '#F3F4F6',                           // wall white
      W: '#0F172A',                           // window frame
      y: active ? '#FCD34D' : '#374151',     // window light (lit if active)
      d: '#5C2C0D',                           // door wood
      o: '#F59E0B',                           // door knob
      K: '#1F2937',                           // ground line
    };
  }

  // Toad messenger — 8w × 10h. White body, red mushroom head.
  const SPRITE_TOAD = parseSprite(`
    .rrrrrr.
    rrwwwwrr
    rwwrrwwr
    rrwwwwrr
    .rrrrrr.
    ..wwww..
    .wsEEsw.
    .wssssw.
    ..wwww..
    ..h..h..
  `);

  const TOAD_PALETTE = {
    r: '#EF4444',         // mushroom red cap
    w: '#FFFFFF',         // white spots / body
    s: '#FCD8B5',         // skin
    E: '#0F172A',         // eyes
    h: '#3E1F0A',         // shoes
  };

  // Chef Mario — 16w × 24h. Friendly chibi style: poofy hat, clear eyes,
  // brown handlebar mustache, red scarf, white coat with buttons,
  // blue overalls, red shoes.
  const SPRITE_CHEF_STAND = parseSprite(`
    ....wwwwwwww....
    ..wwwwwwwwwwww..
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    ..wwwwwwwwwwww..
    ...wwwwwwwwww...
    aaaaaaaaaaaaaaaa
    .bssssssssssssb.
    .bssssssssssssb.
    .bsssEssssEsssb.
    .bssssssssssssb.
    ..sbbbbbbbbbbs..
    ...ssssssssss...
    ...rrrrrrrrrr...
    ..wrwwwwwwwwrw..
    .wwwwwwwwwwwwww.
    wwwwwwwwwwwwwwww
    wwbwwwwwwwwwwbww
    wwwwwwwwwwwwwwww
    .wwwwwwwwwwwwww.
    ...pppppppppp...
    ...pppp..pppp...
    ..rrrr....rrrr..
  `);

  // Chef stir frame — slight arm raise (subtle body shift)
  const SPRITE_CHEF_STIR = parseSprite(`
    ....wwwwwwww....
    ..wwwwwwwwwwww..
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    .wwwwwwwwwwwwww.
    ..wwwwwwwwwwww..
    ...wwwwwwwwww...
    aaaaaaaaaaaaaaaa
    .bssssssssssssb.
    .bssssssssssssb.
    .bsssEssssEsssb.
    .bssssssssssssb.
    ..sbbbbbbbbbbs..
    ...ssssssssss...
    ...rrrrrrrrrr...
    .wwrwwwwwwwwrww.
    wwwwwwwwwwwwwwww
    wwwwwwwwwwwwwwww
    wwbwwwwwwwwwwbww
    wwwwwwwwwwwwwwww
    .wwwwwwwwwwwwww.
    ...pppppppppp...
    ...pppp..pppp...
    ..rrrr....rrrr..
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
      w: '#FFFFFF',                  // hat / coat (white)
      a: '#374151',                  // hat band (dark gray)
      b: '#5C2C0D',                  // mustache / hair edge (brown)
      s: '#FCD8B5',                  // skin
      r: accentColor || '#E63946',   // scarf / shoes (accent — red default)
      E: '#0F172A',                  // eyes
      p: '#1E3A8A',                  // pants (dark blue overalls)
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

    // ── Sunset Escobedo backyard ──────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.35, '#DC2626');
    sky.addColorStop(0.5, '#F97316');
    sky.addColorStop(0.55, '#FCD34D');
    sky.addColorStop(0.56, '#7C3F00');
    sky.addColorStop(1, '#1C1917');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Distant neighborhood silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    [[20, 130, 70, 30], [110, 120, 50, 40], [180, 135, 60, 25],
     [610, 128, 60, 32], [690, 122, 70, 38]].forEach(([x, y, w, h]) => {
      // Simple house: triangle roof + body
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < w / 2; i++) ctx.fillRect(x + i, y - i, w - i * 2, 1);
    });

    // Papel picado bunting along the top
    const buntingColors = ['#EF4444', '#22C55E', '#FCD34D', '#3B82F6', '#EC4899'];
    for (let i = 0; i < 14; i++) {
      const bx = 30 + i * 55;
      const cIdx = i % buntingColors.length;
      ctx.fillStyle = buntingColors[cIdx];
      // small flag shape
      ctx.fillRect(bx, 2, 36, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bx + 2, 18, 32, 2);
    }
    // String of the bunting
    ctx.fillStyle = '#1C1917';
    for (let xx = 0; xx < CANVAS_W; xx += 4) ctx.fillRect(xx, 1, 2, 1);

    // Ground (patio tiles)
    const floorY = 270;
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, floorY, CANVAS_W, CANVAS_H - floorY);
    ctx.fillStyle = '#7C2D12';
    for (let yy = floorY; yy < CANVAS_H; yy += 16) {
      for (let xx = (yy / 16) % 2 === 0 ? 0 : 32; xx < CANVAS_W; xx += 64) {
        ctx.fillRect(xx, yy, 60, 14);
      }
    }

    const tick = State.currentTick;
    const tIdx = Math.min(Math.floor(tick), sched.timeline.length - 1);
    const activePid = sched.timeline[tIdx];

    const PLATILLOS = ['Agujas', 'Salchicha', 'Empalme', 'Carne', 'Costillas', 'Arrachera'];
    const FOOD_SPRITES = [SPRITE_MEAT_AGUJAS, SPRITE_MEAT_SALCHICHA, SPRITE_MEAT_EMPALME];

    const procs = State.processes;
    const visible = procs.slice(0, MAX_PROCS_VISIBLE);
    const padX = 70;
    const slotW = (CANVAS_W - padX * 2) / Math.max(1, visible.length);
    const grillY = 220;

    // ── Long asador ──────────────────────────────────────────────────
    const asadorX = padX - 20;
    const asadorEnd = CANVAS_W - padX + 20;
    const asadorW = asadorEnd - asadorX;

    // Asador legs
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(asadorX + 8, grillY + 24, 8, 50);
    ctx.fillRect(asadorEnd - 16, grillY + 24, 8, 50);

    // Asador frame (top + bottom)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(asadorX, grillY - 2, asadorW, 6);
    ctx.fillRect(asadorX, grillY + 24, asadorW, 4);
    // Asador body
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(asadorX + 2, grillY + 4, asadorW - 4, 20);
    // Grill grates (vertical bars)
    ctx.fillStyle = '#9CA3AF';
    for (let xx = asadorX + 6; xx < asadorEnd - 6; xx += 5) {
      ctx.fillRect(xx, grillY + 5, 2, 18);
    }

    // ── Compute remaining burst per pid ──────────────────────────────
    const remaining = {};
    visible.forEach(p => { remaining[p.pid] = p.burst_time; });
    for (let i = 0; i < tIdx; i++) {
      const pp = sched.timeline[i];
      if (pp >= 0 && remaining[pp] > 0) remaining[pp]--;
    }

    // Context switch → poof + sound
    if (activePid !== State.lastActivePid && activePid >= 0 && State.lastActivePid >= 0) {
      const oldIdx = visible.findIndex(p => p.pid === State.lastActivePid);
      if (oldIdx >= 0) {
        const px = padX + slotW * (oldIdx + 0.5);
        State.poofs.push({ x: px, y: grillY - 18, t: 0, life: 0.6 });
      }
      Sound.contextSwitch();
    }
    if (activePid !== State.lastActivePid && activePid >= 0) {
      const newIdx = visible.findIndex(p => p.pid === activePid);
      if (newIdx >= 0) {
        const px = padX + slotW * (newIdx + 0.5);
        for (let i = 0; i < 4; i++) {
          State.sparkles.push({ x: px + (Math.random() - 0.5) * 30, y: grillY - 8 + (Math.random() - 0.5) * 10, t: 0, life: 0.5 });
        }
      }
    }
    State.lastActivePid = activePid;

    // ── Draw food on asador ──────────────────────────────────────────
    visible.forEach((p, i) => {
      const cx = padX + slotW * (i + 0.5);
      const isActive = (activePid === p.pid);

      // Flames under active grill section
      if (isActive) {
        const t = performance.now() / 100;
        for (let f = 0; f < 5; f++) {
          const fx = cx - 24 + f * 12;
          const flameH = 6 + Math.sin(t + f) * 4;
          ctx.fillStyle = '#F97316';
          ctx.fillRect(fx, grillY + 4, 8, flameH);
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(fx + 2, grillY + 4, 4, flameH * 0.6);
        }
        // Glow under
        ctx.save();
        ctx.shadowColor = '#F97316';
        ctx.shadowBlur = 18;
        ctx.fillStyle = 'rgba(249,115,22,0.4)';
        ctx.fillRect(cx - 26, grillY + 6, 52, 16);
        ctx.restore();
      }

      // Meat / food sprite on top of grates
      const foodType = i % 3;
      const sprite = FOOD_SPRITES[foodType];
      const meatScale = 4;
      const meatW = sprite[0].length * meatScale;
      // Meat tinted by remaining: cooked = darker, raw = redder
      const cookedPct = 1 - (remaining[p.pid] / p.burst_time);
      const meatPalette = { ...MEAT_PALETTE };
      if (cookedPct > 0.6) meatPalette.r = '#7C2D12';
      else if (cookedPct > 0.3) meatPalette.r = '#92400E';
      drawPixelSprite(ctx, cx - meatW / 2, grillY - 18, meatScale, sprite, meatPalette);

      // Platillo label below
      const platillo = PLATILLOS[(p.pid - 1) % PLATILLOS.length];
      drawHUDText(ctx, platillo, cx - 22, grillY + 50, pidColor(p.pid), 10);
      drawHUDText(ctx, `${remaining[p.pid]}/${p.burst_time}t`, cx - 18, grillY + 64, '#FED7AA', 10);

      // "se quema!" warning if not visited too long
      let lastSeen = -1;
      for (let k = tIdx - 1; k >= 0; k--) {
        if (sched.timeline[k] === p.pid) { lastSeen = k; break; }
      }
      if (remaining[p.pid] > 0 && (tIdx - lastSeen) > 4) {
        const blink = Math.floor(performance.now() / 200) % 2 === 0;
        if (blink) {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('BURNING!', cx, grillY - 30);
          ctx.textAlign = 'left';
        }
      }
    });

    // ── Side props: molcajete (left) + hielera (right) ──────────────
    drawPixelSprite(ctx, 18, floorY - 32, 4, SPRITE_MOLCAJETE, MOLCAJETE_PALETTE);
    drawHUDText(ctx, 'Molcajete', 14, floorY + 12, '#A7F3D0', 9);
    drawPixelSprite(ctx, CANVAS_W - 78, floorY - 50, 4, SPRITE_HIELERA, HIELERA_PALETTE);
    drawHUDText(ctx, 'Hielera', CANVAS_W - 70, floorY + 12, '#FECACA', 9);

    // ── Chef Mario tweens to active platillo ────────────────────────
    let targetX = -100;
    if (activePid >= 0) {
      const idx = visible.findIndex(p => p.pid === activePid);
      if (idx >= 0) targetX = padX + slotW * (idx + 0.5) - 24;
    }
    State.chefTargetX = targetX;
    if (State.chefX === 0 && targetX > 0) State.chefX = targetX;
    State.chefX += (State.chefTargetX - State.chefX) * Math.min(1, dt * 14);
    State.chefBob += dt * 8;

    if (activePid >= 0 && targetX > 0) {
      const bobY = Math.sin(State.chefBob) * 2;
      const stirFrame = Math.floor(State.chefBob) % 2;
      drawChef(ctx, State.chefX, grillY - 78 + bobY, 3, stirFrame, '#E63946');
      // Wooden tongs (long brown rod) when stationary
      if (Math.abs(State.chefTargetX - State.chefX) < 4) {
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(State.chefX + 50, grillY - 30 + bobY, 4, 16);
        ctx.fillRect(State.chefX + 50, grillY - 30 + bobY, 4, 4);
        ctx.fillRect(State.chefX + 56, grillY - 30 + bobY, 4, 4);
      }
    }

    // Poofs + sparkles
    State.poofs = State.poofs.filter(p => p.t < p.life);
    State.poofs.forEach(p => { p.t += dt; drawPuff(ctx, p.x, p.y, 2, 1 - (p.t / p.life)); });
    State.sparkles = State.sparkles.filter(s => s.t < s.life);
    State.sparkles.forEach(s => { s.t += dt; drawSparkle(ctx, s.x, s.y, 2, 1 - (s.t / s.life)); });

    // HUD
    drawHUDText(ctx, `Tick: ${tIdx} / ${sched.totalTime}`, 14, 36, '#FBBF24', 13);
    drawHUDText(ctx, `Mario alone · ${visible.length} dishes on the grill`, 14, 54, '#FED7AA', 11);
    drawHUDText(ctx, '🔥 Two hands only: flip the meat, drop, hop to molcajete, run back to tortillas...',
                14, CANVAS_H - 14, '#FED7AA', 11);
  }

  /* ── Parallelism: N chefs in N parallel kitchen stations ───────── */
  function renderParallelism(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched) return;

    // Sunset patio (same as Concurrency for visual consistency)
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.35, '#DC2626');
    sky.addColorStop(0.5, '#F97316');
    sky.addColorStop(0.55, '#FCD34D');
    sky.addColorStop(0.56, '#7C3F00');
    sky.addColorStop(1, '#1C1917');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bunting
    const buntingColors = ['#EF4444', '#22C55E', '#FCD34D', '#3B82F6', '#EC4899'];
    for (let i = 0; i < 14; i++) {
      const bx = 30 + i * 55;
      ctx.fillStyle = buntingColors[i % buntingColors.length];
      ctx.fillRect(bx, 2, 36, 18);
    }
    ctx.fillStyle = '#1C1917';
    for (let xx = 0; xx < CANVAS_W; xx += 4) ctx.fillRect(xx, 1, 2, 1);

    // Patio floor
    const floorY = 270;
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, floorY, CANVAS_W, CANVAS_H - floorY);
    ctx.fillStyle = '#7C2D12';
    for (let yy = floorY; yy < CANVAS_H; yy += 16) {
      for (let xx = (yy / 16) % 2 === 0 ? 0 : 32; xx < CANVAS_W; xx += 64) {
        ctx.fillRect(xx, yy, 60, 14);
      }
    }

    const lanes = sched.lanes;
    const numLanes = lanes.length;
    const padX = 30;
    const slotW = (CANVAS_W - padX * 2) / numLanes;
    const tick = State.currentTick;
    const grillY = 220;

    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6'];
    const CHARS = ['Mario', 'Luigi', 'Peach', 'Toad'];
    const FOOD_SPRITES = [SPRITE_MEAT_AGUJAS, SPRITE_MEAT_SALCHICHA, SPRITE_MEAT_EMPALME];

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

      // Cheer once on finish
      let lf = State.karts[l];
      if (!lf) { lf = { lane: l, finished: false, finishedAt: -1 }; State.karts[l] = lf; }
      if (finished && !lf.finished) { lf.finished = true; lf.finishedAt = tick; Sound.cheer(); }

      // ── Per-station asador ─────────────────────────────────────────
      const grillW = Math.min(160, slotW - 24);

      // Legs
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(cx - grillW / 2 + 4, grillY + 24, 6, 50);
      ctx.fillRect(cx + grillW / 2 - 10, grillY + 24, 6, 50);
      // Frame
      ctx.fillRect(cx - grillW / 2, grillY - 2, grillW, 6);
      ctx.fillRect(cx - grillW / 2, grillY + 24, grillW, 4);
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(cx - grillW / 2 + 2, grillY + 4, grillW - 4, 20);
      // Grates
      ctx.fillStyle = '#9CA3AF';
      for (let xx = cx - grillW / 2 + 6; xx < cx + grillW / 2 - 6; xx += 5) {
        ctx.fillRect(xx, grillY + 5, 2, 18);
      }

      // Flames if active
      if (activeEntry) {
        const t = performance.now() / 100;
        for (let f = 0; f < 4; f++) {
          const fx = cx - 30 + f * 16;
          const flameH = 5 + Math.sin(t + f + l) * 4;
          ctx.fillStyle = '#F97316';
          ctx.fillRect(fx, grillY + 4, 8, flameH);
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(fx + 2, grillY + 4, 4, flameH * 0.6);
        }
      }

      // Meat on grill (color tints by remaining)
      const meatType = (activeEntry ? activeEntry.pid : (laneSched[0] ? laneSched[0].pid : 0)) % 3;
      const sprite = FOOD_SPRITES[meatType];
      const meatScale = 4;
      const meatW = sprite[0].length * meatScale;
      const meatPalette = { ...MEAT_PALETTE };
      if (progress > 0.6) meatPalette.r = '#7C2D12';
      else if (progress > 0.3) meatPalette.r = '#92400E';
      drawPixelSprite(ctx, cx - meatW / 2, grillY - 18, meatScale, sprite, meatPalette);

      // ── Chef behind asador (always visible — N chefs at once) ──────
      const phase = State.chefBob + l * 0.7;
      const bobY = Math.sin(phase * 8) * 2;
      const stirFrame = activeEntry ? (Math.floor(phase * 4) % 2) : 0;
      drawChef(ctx, cx - 24, grillY - 88 + bobY, 3, stirFrame, accent);

      // Tongs in hand when stirring
      if (activeEntry && stirFrame === 1) {
        ctx.fillStyle = '#1F2937';
        ctx.fillRect(cx + 26, grillY - 30 + bobY, 4, 16);
      }

      // Character label + active PID
      drawHUDText(ctx, CHARS[l % CHARS.length], cx - 18, 96, accent, 11);
      if (activeEntry) drawHUDText(ctx, `P${activeEntry.pid}`, cx - 10, 112, pidColor(activeEntry.pid), 11);
      else if (finished) drawHUDText(ctx, '✓ Done', cx - 18, 112, '#FBBF24', 10);
      else drawHUDText(ctx, 'idle', cx - 12, 112, '#CBD5E1', 10);

      // Progress bar
      const barX = cx - 50, barY = 124, barW = 100;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = accent;
      ctx.fillRect(barX, barY, barW * progress, 5);
    });

    // ── Side props (raza props on the patio) ────────────────────────
    drawPixelSprite(ctx, CANVAS_W - 70, floorY - 50, 4, SPRITE_HIELERA, HIELERA_PALETTE);

    // HUD
    const totalSeq = State.processes.reduce((a, p) => a + p.burst_time, 0);
    const speedup = sched.totalTime > 0 ? (totalSeq / sched.totalTime) : 1;
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 36, '#FBBF24', 13);
    drawHUDText(ctx, `${numLanes} chefs working at once · ${State.processes.length} processes`, 14, 54, '#FED7AA', 11);
    drawHUDText(ctx, `⚡ Speedup ×${speedup.toFixed(2)} vs Mario alone (${totalSeq}t)`, 14, 72, '#FEF3C7', 11);
    drawHUDText(ctx, '🌮 Luigi joined: 2+ pairs of hands working at the exact same second',
                14, CANVAS_H - 14, '#FED7AA', 11);
  }

  /* ── Multiprocessing: N walled-off kitchens ────────────────────── */
  function renderMultiprocessing(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched || !sched.castles) return;

    // ── Sunset patio sky ─────────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.35, '#DC2626');
    sky.addColorStop(0.5, '#F97316');
    sky.addColorStop(0.55, '#FCD34D');
    sky.addColorStop(0.56, '#7C3F00');
    sky.addColorStop(1, '#1C1917');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const tick = State.currentTick;
    const houses = sched.castles;   // schedule data shape: {pid, burst, forks}
    const N = houses.length;
    const padX = 30;
    const slotW = (CANVAS_W - padX * 2) / Math.max(1, N);

    // Street running across the middle (the shared road between casas)
    const streetY = 234;
    const streetH = 22;
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(0, streetY, CANVAS_W, streetH);
    // Street dashes
    ctx.fillStyle = '#FCD34D';
    for (let xx = 12; xx < CANVAS_W; xx += 36) {
      ctx.fillRect(xx, streetY + streetH / 2 - 2, 22, 3);
    }

    // Sidewalks (top + bottom of street)
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, streetY - 4, CANVAS_W, 4);
    ctx.fillRect(0, streetY + streetH, CANVAS_W, 4);

    // Grass / yard ground (above street)
    ctx.fillStyle = '#365314';
    ctx.fillRect(0, 180, CANVAS_W, streetY - 184);
    ctx.fillStyle = '#3F6212';
    for (let xx = 0; xx < CANVAS_W; xx += 8) {
      ctx.fillRect(xx + (xx % 16 === 0 ? 0 : 4), 180 + Math.floor((xx % 24) / 8), 2, 2);
    }

    const CHEF_NAMES = ['Mario', 'Luigi', 'Peach', 'Toad'];
    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6'];

    // Track Toad messengers (forks crossing the street)
    if (!State.toads) State.toads = [];

    houses.forEach((h, i) => {
      const left = padX + slotW * i + 4;
      const right = padX + slotW * (i + 1) - 4;
      const cx = (left + right) / 2;
      const yardW = right - left;
      const isActive = tick < h.burst;
      const cpuTime = Math.min(h.burst, Math.max(0, tick));
      const accent = CHEF_ACCENTS[i % CHEF_ACCENTS.length];

      // ── House (above the yard, decorative) ──────────────────────────
      const houseScale = Math.max(2, Math.min(4, Math.floor(yardW / 28)));
      const houseW = 22 * houseScale;
      const houseH = 18 * houseScale;
      const houseX = Math.round(cx - houseW / 2);
      const houseY = 30;
      drawPixelSprite(ctx, houseX, houseY, houseScale, SPRITE_HOUSE, housePalette(isActive));

      // Owner label above house
      drawHUDText(ctx, `${CHEF_NAMES[i % CHEF_NAMES.length]} (P${h.pid})`,
                  cx - 36, houseY - 8, accent, 11);

      // ── Yard fence (between house and street) ───────────────────────
      const yardY = houseY + houseH + 4;
      const yardH = streetY - 4 - yardY;

      // Picket fence sides (left + right separators)
      ctx.fillStyle = '#92400E';
      ctx.fillRect(left, yardY, 4, yardH);
      ctx.fillRect(right - 4, yardY, 4, yardH);
      // Top fence rail
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(left, yardY, yardW, 3);
      // Vertical pickets
      ctx.fillStyle = '#92400E';
      for (let xx = left + 8; xx < right - 4; xx += 12) {
        ctx.fillRect(xx, yardY + 3, 4, yardH - 3);
      }

      // ── Yard interior ───────────────────────────────────────────────
      const innerX = left + 6;
      const innerY = yardY + 6;
      const innerW = yardW - 12;
      const innerH = yardH - 8;

      // Yard ground
      ctx.fillStyle = '#3F6212';
      ctx.fillRect(innerX, innerY, innerW, innerH);
      // Grass tuft pattern
      ctx.fillStyle = '#365314';
      for (let xx = innerX + 4; xx < innerX + innerW - 2; xx += 16) {
        for (let yy = innerY + 4; yy < innerY + innerH - 4; yy += 14) {
          ctx.fillRect(xx, yy, 4, 2);
        }
      }

      // ── Asador inside the yard ──────────────────────────────────────
      const grillCx = innerX + innerW * 0.55;
      const grillY = innerY + innerH - 36;
      const grillW = Math.min(80, innerW * 0.5);

      // Legs
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(grillCx - grillW / 2 + 4, grillY + 14, 4, 18);
      ctx.fillRect(grillCx + grillW / 2 - 8, grillY + 14, 4, 18);
      // Frame
      ctx.fillRect(grillCx - grillW / 2, grillY - 2, grillW, 4);
      ctx.fillRect(grillCx - grillW / 2, grillY + 14, grillW, 3);
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(grillCx - grillW / 2 + 2, grillY + 2, grillW - 4, 12);
      // Grates
      ctx.fillStyle = '#9CA3AF';
      for (let xx = grillCx - grillW / 2 + 4; xx < grillCx + grillW / 2 - 4; xx += 4) {
        ctx.fillRect(xx, grillY + 3, 1, 11);
      }
      // Flames (if active)
      if (isActive) {
        const t = performance.now() / 100;
        for (let f = 0; f < 4; f++) {
          const fx = grillCx - grillW / 2 + 8 + f * (grillW / 5);
          const flameH = 4 + Math.sin(t + f + i) * 3;
          ctx.fillStyle = '#F97316';
          ctx.fillRect(fx, grillY + 2, 4, flameH);
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(fx + 1, grillY + 2, 2, flameH * 0.6);
        }
      }
      // Carne sprite on the grill
      const FOOD_SPRITES = [SPRITE_MEAT_AGUJAS, SPRITE_MEAT_SALCHICHA, SPRITE_MEAT_EMPALME];
      const sprite = FOOD_SPRITES[i % 3];
      const meatScale = 2;
      const meatW = sprite[0].length * meatScale;
      const meatPalette = { ...MEAT_PALETTE };
      const cookedPct = h.burst > 0 ? (cpuTime / h.burst) : 0;
      if (cookedPct > 0.6) meatPalette.r = '#7C2D12';
      else if (cookedPct > 0.3) meatPalette.r = '#92400E';
      drawPixelSprite(ctx, grillCx - meatW / 2, grillY - 8, meatScale, sprite, meatPalette);

      // ── Chef inside the yard (each yard has its own Mario) ─────────
      const phase = State.chefBob + i * 0.5;
      const bobY = Math.sin(phase * 8) * 2;
      const stirFrame = isActive ? (Math.floor(phase * 4) % 2) : 0;
      const chefScale = Math.max(2, Math.min(3, Math.floor(innerW / 60)));
      // Chef sprite is now 24 rows tall, position chef so feet are near grill top
      drawChef(ctx, grillCx - 8 * chefScale - 30, grillY - 24 * chefScale + bobY + 4,
               chefScale, stirFrame, accent);

      // ── Hielera (own, private) on the left side of yard ────────────
      const hieleraScale = Math.max(2, Math.min(3, Math.floor(innerW / 80)));
      drawPixelSprite(ctx, innerX + 6, innerY + innerH - 12 * hieleraScale - 6,
                      hieleraScale, SPRITE_HIELERA, HIELERA_PALETTE);

      // ── Coin counter (own private memory) ──────────────────────────
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(innerX + 4, innerY + 4, 70, 16);
      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`🪙 ${cpuTime}/${h.burst}`, innerX + 8, innerY + 16);
      ctx.restore();

      // ── Isolation badge (under the yard) ───────────────────────────
      ctx.save();
      ctx.fillStyle = isActive ? 'rgba(167,139,250,0.9)' : 'rgba(100,116,139,0.7)';
      ctx.fillRect(left + 4, yardY + yardH - 14, yardW - 8, 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 PRIVATE YARD', cx, yardY + yardH - 4);
      ctx.textAlign = 'left';
      ctx.restore();

      // ── Forks → Toad messenger crosses the street to next house ───
      h.forks.forEach((f) => {
        if (tick < f.spawnAt) return;
        // Spawn a Toad if not yet tracked
        const key = `${h.pid}-${f.fid}`;
        let toad = State.toads.find(t => t.key === key);
        if (!toad) {
          toad = {
            key,
            srcX: cx,
            dstX: i + 1 < N ? padX + slotW * (i + 1) + slotW / 2 : cx + 200,
            spawnedAt: f.spawnAt,
            duration: 2.5,    // 2.5 ticks to cross
          };
          State.toads.push(toad);
        }
        const elapsed = tick - toad.spawnedAt;
        if (elapsed < 0) return;
        const progress = Math.min(1, elapsed / toad.duration);
        const tx = toad.srcX + (toad.dstX - toad.srcX) * progress;
        const ty = streetY + streetH / 2 - 18 + Math.abs(Math.sin(elapsed * 6)) * 4;
        drawPixelSprite(ctx, Math.round(tx - 12), Math.round(ty), 3,
                        SPRITE_TOAD, TOAD_PALETTE);
        // Speech bubble: "¡salsa!"
        if (progress < 0.9) {
          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(tx - 4, ty - 12, 36, 10);
          ctx.fillStyle = '#0F172A';
          ctx.font = '7px "JetBrains Mono", monospace';
          ctx.fillText('salsa!', tx - 1, ty - 4);
          ctx.restore();
        }
      });
    });

    // ── Top HUD ────────────────────────────────────────────────────
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 22, '#FBBF24', 13);
    drawHUDText(ctx, `${N} houses · ${N} isolated grills · each with its own cooler and meat`,
                14, CANVAS_H - 28, '#FED7AA', 10);
    drawHUDText(ctx, '🏠 If Bowser burns his meat, Mario keeps eating. To talk: send a Toad.',
                14, CANVAS_H - 12, '#FED7AA', 10);
  }

  /* ── Multithreading: ONE kitchen, N chefs, ONE shared recipe book ─ */
  function renderMultithreading(dt) {
    const ctx = State.ctx;
    const sched = State.schedule;
    if (!sched || !sched.threads) return;

    // ── Sunset patio (one shared space, no walls!) ───────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, '#7C2D12');
    sky.addColorStop(0.35, '#DC2626');
    sky.addColorStop(0.5, '#F97316');
    sky.addColorStop(0.55, '#FCD34D');
    sky.addColorStop(0.56, '#7C3F00');
    sky.addColorStop(1, '#1C1917');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Papel picado bunting
    const bunting = ['#EF4444', '#22C55E', '#FCD34D', '#3B82F6', '#EC4899'];
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = bunting[i % bunting.length];
      ctx.fillRect(30 + i * 55, 2, 36, 18);
    }
    ctx.fillStyle = '#1C1917';
    for (let xx = 0; xx < CANVAS_W; xx += 4) ctx.fillRect(xx, 1, 2, 1);

    // Patio floor
    const floorY = 290;
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, floorY, CANVAS_W, CANVAS_H - floorY);
    ctx.fillStyle = '#7C2D12';
    for (let yy = floorY; yy < CANVAS_H; yy += 16) {
      for (let xx = (yy / 16) % 2 === 0 ? 0 : 32; xx < CANVAS_W; xx += 64) {
        ctx.fillRect(xx, yy, 60, 14);
      }
    }

    const tick = State.currentTick;
    const tIdx = Math.min(Math.floor(tick), sched.timeline.length - 1);
    const tickFrac = tick - Math.floor(tick);
    const threads = sched.threads;
    const N = threads.length;

    // Animation phases (much smoother now):
    //   0.00 - 0.25 : WALK_IN     active chef walks to asador (prev returns home)
    //   0.25 - 0.85 : COOK        active chef stands at asador, holds tongs
    //   0.85 - 1.00 : WALK_OUT    active chef walks back home
    const PHASE_WALK_IN_END = 0.25;
    const PHASE_COOK_END = 0.85;

    // Active + previous indices
    const activeIdx = (tIdx >= 0 && sched.timeline[tIdx]) ? sched.timeline[tIdx].idx : -1;
    const prevIdx = (tIdx >= 1 && sched.timeline[tIdx - 1]) ? sched.timeline[tIdx - 1].idx : -1;

    // Race when active changed AND we're in walk_in window
    const raceActive = (tickFrac < PHASE_WALK_IN_END) &&
                       (prevIdx >= 0) &&
                       (prevIdx !== activeIdx);

    // ── Layout constants ─────────────────────────────────────────────
    const grillY = 170;
    const grillX = CANVAS_W / 2 - 200;
    const grillW = 400;
    const padX = 50;
    const slotW = (CANVAS_W - padX * 2) / Math.max(1, N);
    const chefScale = N <= 4 ? 3 : 2;
    const chefW = 16 * chefScale;
    const chefH = 24 * chefScale;            // updated for new 24-row sprite
    const homeY = floorY - chefH + 4;
    const asadorStandY = grillY + 38;        // chef stands in front of grill (a bit lower)
    const CHEF_ACCENTS = ['#E63946', '#22C55E', '#F472B6', '#3B82F6', '#FBBF24', '#A855F7', '#06B6D4', '#EAB308'];

    // Compute chef position (smooth lateral walk)
    function chefPos(idx) {
      const homeX = padX + slotW * (idx + 0.5);
      // Stand position: in front of asador, alternating left/right of grill if 2 are at it
      const standX = CANVAS_W / 2;
      // For the "previous chef returning home" case, give them a slight side offset
      // so they don't perfectly overlap with the new chef during race
      const isActive = (idx === activeIdx);
      const isReturning = (idx === prevIdx) && (prevIdx !== activeIdx) &&
                         (tickFrac < PHASE_WALK_IN_END);

      if (isActive) {
        let p;   // 0 = home, 1 = at asador
        if (tickFrac < PHASE_WALK_IN_END) {
          p = easeInOutCubic(tickFrac / PHASE_WALK_IN_END);
        } else if (tickFrac < PHASE_COOK_END) {
          p = 1;
        } else {
          p = 1 - easeInOutCubic((tickFrac - PHASE_COOK_END) / (1 - PHASE_COOK_END));
        }
        // Active chef goes to the LEFT side of the grill if there's a race
        // (so previous chef can be on the right going home)
        const offsetX = raceActive ? -22 : 0;
        return {
          x: lerp(homeX, standX + offsetX, p),
          y: lerp(homeY, asadorStandY, p),
          progress: p,
          isActive: true,
          atAsador: p > 0.95,
          walking: p > 0.05 && p < 0.95,
        };
      }
      if (isReturning) {
        // Goes from asador back to home, slight RIGHT offset
        const p = 1 - easeInOutCubic(tickFrac / PHASE_WALK_IN_END);
        return {
          x: lerp(homeX, standX + 22, p),
          y: lerp(homeY, asadorStandY, p),
          progress: p,
          isActive: false,
          isReturning: true,
          atAsador: p > 0.7,
          walking: true,
        };
      }
      return { x: homeX, y: homeY, progress: 0, isActive: false, atAsador: false, walking: false };
    }

    // Subtle screen shake on race (gentler than before)
    let shakeX = 0, shakeY = 0;
    if (raceActive) {
      const intensity = 1 - (tickFrac / PHASE_WALK_IN_END);   // strongest at start
      shakeX = (Math.random() - 0.5) * 3 * intensity;
      shakeY = (Math.random() - 0.5) * 3 * intensity;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── Shared asador in the middle ──────────────────────────────────
    // Legs
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(grillX + 16, grillY + 30, 10, 50);
    ctx.fillRect(grillX + grillW - 26, grillY + 30, 10, 50);
    // Frame
    ctx.fillRect(grillX, grillY - 4, grillW, 8);
    ctx.fillRect(grillX, grillY + 30, grillW, 6);
    // Body
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(grillX + 4, grillY + 4, grillW - 8, 26);
    // Grates
    ctx.fillStyle = '#9CA3AF';
    for (let xx = grillX + 8; xx < grillX + grillW - 8; xx += 6) {
      ctx.fillRect(xx, grillY + 6, 2, 22);
    }
    // Flames
    const flT = performance.now() / 100;
    for (let f = 0; f < 13; f++) {
      const fx = grillX + 16 + f * 30;
      const flameH = 6 + Math.sin(flT + f) * 4;
      ctx.fillStyle = '#F97316';
      ctx.fillRect(fx, grillY + 8, 8, flameH);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(fx + 2, grillY + 8, 4, flameH * 0.6);
    }
    // Meats spread on asador (decorative — one per thread)
    const FOOD_SPRITES = [SPRITE_MEAT_AGUJAS, SPRITE_MEAT_SALCHICHA, SPRITE_MEAT_EMPALME];
    threads.forEach((_t, idx) => {
      const sprite = FOOD_SPRITES[idx % 3];
      const meatScale = 3;
      const meatW = sprite[0].length * meatScale;
      const meatX = grillX + 30 + (idx + 0.5) * ((grillW - 60) / N) - meatW / 2;
      drawPixelSprite(ctx, meatX, grillY - 12, meatScale, sprite, MEAT_PALETTE);
    });

    // ── Side props (Cooler + Molcajete) ──────────────────────────────
    drawPixelSprite(ctx, 24, floorY - 50, 4, SPRITE_HIELERA, HIELERA_PALETTE);
    drawHUDText(ctx, 'Cooler', 30, floorY + 12, '#FECACA', 9);
    drawHUDText(ctx, 'SHARED', 30, floorY + 24, '#FCA5A5', 8);
    drawPixelSprite(ctx, CANVAS_W - 64, floorY - 32, 4, SPRITE_MOLCAJETE, MOLCAJETE_PALETTE);
    drawHUDText(ctx, 'Molcajete', CANVAS_W - 72, floorY + 12, '#A7F3D0', 9);
    drawHUDText(ctx, 'SHARED', CANVAS_W - 70, floorY + 24, '#86EFAC', 8);

    // Coin counter (shared, above asador)
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`🪙 Cooked: ${tIdx}`, CANVAS_W / 2, grillY - 22);
    ctx.textAlign = 'left';
    ctx.restore();

    // ── All chefs (compute positions first so we know who's at asador)
    const positions = threads.map((_, idx) => chefPos(idx));

    // Draw home-row chefs first (back), then walking/active chefs (front)
    threads.forEach((t, idx) => {
      const pos = positions[idx];
      if (pos.walking || pos.atAsador) return;   // draw later (front layer)
      const phase = State.chefBob + idx * 0.7;
      const bobY = Math.sin(phase * 4) * 1;
      drawChef(ctx, Math.round(pos.x - chefW / 2), Math.round(pos.y + bobY),
               chefScale, 0, CHEF_ACCENTS[idx % CHEF_ACCENTS.length]);
      const label = (t.tid > 0) ? `P${t.pid}.T${t.tid}` : `P${t.pid}`;
      drawHUDText(ctx, label, Math.round(pos.x - 22), floorY + 14, pidColor(t.pid), 10);
    });

    // Front layer: walking + active chefs
    threads.forEach((t, idx) => {
      const pos = positions[idx];
      if (!pos.walking && !pos.atAsador) return;
      const phase = State.chefBob + idx * 0.7;
      const bobY = pos.walking ? Math.sin(phase * 12) * 2 : Math.sin(phase * 6) * 1.5;
      const stirFrame = pos.atAsador
        ? (Math.floor(tickFrac * 4) % 2)        // stir while cooking
        : (Math.floor(performance.now() / 90) % 2);  // walk cycle
      const accent = CHEF_ACCENTS[idx % CHEF_ACCENTS.length];

      // Glow under active chef at asador
      if (pos.atAsador) {
        ctx.save();
        ctx.strokeStyle = pidColor(t.pid);
        ctx.lineWidth = 3;
        ctx.shadowColor = pidColor(t.pid);
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + chefH + 2, chefW / 2 + 6, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawChef(ctx, Math.round(pos.x - chefW / 2), Math.round(pos.y + bobY),
               chefScale, stirFrame, accent);

      const label = (t.tid > 0) ? `P${t.pid}.T${t.tid}` : `P${t.pid}`;
      drawHUDText(ctx, label, Math.round(pos.x - 22), floorY + 14, pidColor(t.pid), 10);
    });

    // ── The TONGS (the only pair!) ───────────────────────────────────
    const tongsScale = 4;
    let tongsCx, tongsCy, tongsHeld = false, tongsHolderColor = null;
    const activePos = activeIdx >= 0 ? positions[activeIdx] : null;
    const prevPos = (prevIdx >= 0 && prevIdx !== activeIdx) ? positions[prevIdx] : null;

    if (raceActive && prevPos) {
      // Both reaching → tongs vibrate between them
      const midX = (activePos ? activePos.x : CANVAS_W / 2 - 22)
                   + (prevPos.x - (activePos ? activePos.x : CANVAS_W / 2 - 22)) * 0.5;
      const intensity = 1 - (tickFrac / PHASE_WALK_IN_END);
      tongsCx = midX + (Math.random() - 0.5) * 8 * intensity;
      tongsCy = grillY - 8 + (Math.random() - 0.5) * 6 * intensity;
    } else if (activePos && (activePos.atAsador || activePos.walking)) {
      // Active chef carries the tongs (in their right hand)
      tongsCx = activePos.x + chefW * 0.55;
      tongsCy = activePos.y + chefH * 0.35;
      tongsHeld = true;
      tongsHolderColor = pidColor(threads[activeIdx].pid);
    } else {
      // No one holds — hover at asador center
      tongsCx = CANVAS_W / 2;
      tongsCy = grillY - 50 + Math.sin(performance.now() / 300) * 3;
    }

    // Red glow during race
    if (raceActive) {
      ctx.save();
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(239,68,68,0.5)';
      ctx.fillRect(tongsCx - 22, tongsCy - 22, 44, 56);
      ctx.restore();
    } else if (tongsHeld && tongsHolderColor) {
      // Subtle glow in holder's color
      ctx.save();
      ctx.shadowColor = tongsHolderColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = tongsHolderColor + '33';
      ctx.fillRect(tongsCx - 16, tongsCy - 16, 32, 44);
      ctx.restore();
    }

    drawPixelSprite(ctx, Math.round(tongsCx - 4 * tongsScale), Math.round(tongsCy),
                    tongsScale, SPRITE_TONGS, TONGS_PALETTE);

    // Tongs label (less obtrusive now)
    if (!tongsHeld && !raceActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(CANVAS_W / 2 - 70, tongsCy - 14, 140, 14);
      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 9px "Press Start 2P", "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('THE ONLY TONGS', CANVAS_W / 2, tongsCy - 4);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // ── Race condition banner ───────────────────────────────────────
    if (raceActive) {
      const intensity = 1 - (tickFrac / PHASE_WALK_IN_END);
      ctx.save();
      ctx.fillStyle = `rgba(239,68,68,${0.85 + 0.15 * intensity})`;
      ctx.fillRect(CANVAS_W / 2 - 220, 26, 440, 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px "Press Start 2P", "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ RACE CONDITION', CANVAS_W / 2, 48);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FEE2E2';
      ctx.fillText('Two chefs grabbed the tongs at the same time!', CANVAS_W / 2, 62);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.restore();   // shake

    // HUD
    drawHUDText(ctx, `Tick: ${Math.floor(tick)} / ${sched.totalTime}`, 14, 36, '#34D399', 13);
    drawHUDText(ctx, `${threads.length} chefs · 1 grill · tongs/cooler/molcajete SHARED`, 14, 54, '#A7F3D0', 11);
    drawHUDText(ctx, '🤝 Everybody shares everything. If two grab the tongs at once → race!',
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
