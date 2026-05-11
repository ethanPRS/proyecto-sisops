/**
 * pageReplace.js — Page Replacement + Luigi's Mansion Visual
 *
 * Fully integrated canvas animation that explains HOW each algorithm
 * makes its replacement decision, not just what happened.
 *
 * Each door shows algorithm-specific internal state:
 *   FIFO       → age (steps in memory)
 *   LRU        → steps since last use
 *   Optimal    → steps until next use (∞ = never again)
 *   Clock      → use bit (◉/○) + clock hand on current pointer slot
 *   2nd Chance → reference bit (★/☆) + queue position
 */

/* ═══════════════════════════════════════════════════════════
   CORE STATE
   ═══════════════════════════════════════════════════════════ */
const PRState = {
  result:      null,
  algoData:    [],   // per-step internal algo state for visual
  currentStep: -1,
  playing:     false,
  faultCount:  0,
};
let _autoplayTimer = null;

/* ═══════════════════════════════════════════════════════════
   ALGORITHM DATA COMPUTATION
   Recomputes internal state of each algorithm so we can show
   WHY each eviction decision was made.
   Returns: array of { frameInfo:[{label,highlight,dimmed}], reason, pointer }
   ═══════════════════════════════════════════════════════════ */

function computeAlgoData(algo, refString, numFrames) {
  switch (algo) {
    case 'FIFO':         return computeFIFO(refString, numFrames);
    case 'LRU':          return computeLRU(refString, numFrames);
    case 'Optimal':      return computeOptimal(refString, numFrames);
    case 'Clock':        return computeClock(refString, numFrames);
    case 'Second Chance':return computeSecondChance(refString, numFrames);
    default:             return refString.map(() => ({ frameInfo: [], reason: '', pointer: -1 }));
  }
}

/* ── FIFO ──────────────────────────────────────────────────
   Shows age (steps spent in memory). Oldest → evicted.   */
function computeFIFO(ref, nf) {
  const queue = [];   // ordered oldest→newest
  const entryStep = {};  // page → step when it entered
  const data = [];

  for (let i = 0; i < ref.length; i++) {
    const pg = ref[i];
    if (!queue.includes(pg)) {
      if (queue.length >= nf) queue.shift();
      queue.push(pg);
      entryStep[pg] = i;
    }

    // Build frameInfo for current frames_after (will be filled after)
    const snap = [...queue, ...Array(nf - queue.length).fill(null)];
    const frameInfo = snap.map(p => {
      if (p === null) return { label: 'empty', highlight: false, dimmed: true };
      const age = i - entryStep[p];
      const isOldest = queue.length > 0 && p === queue[0];
      return {
        label: `Age: ${age}`,
        sub:   isOldest && queue.length >= nf ? '← next out' : '',
        highlight: isOldest && queue.length >= nf,
        dimmed: false,
      };
    });

    let reason = '';
    if (!queue.slice(0, -1).includes(pg) && i > 0) {
      // was a fault
      const victim = data[i - 1]?.victimPage;
      if (victim != null)
        reason = `P${victim} entered first (step ${entryStep[victim] !== undefined ? entryStep[victim] : '?'}). FIFO → oldest page evicted.`;
      else
        reason = `P${pg} wasn't in memory. Loaded into empty frame.`;
    } else if (queue.includes(pg)) {
      reason = `P${pg} is already in memory — HIT! No eviction needed.`;
    }

    data.push({ frameInfo, reason, pointer: -1, victimPage: queue[0] ?? null });
  }
  return data;
}

/* ── LRU ──────────────────────────────────────────────────
   Shows steps since last use. Least recent → evicted.    */
function computeLRU(ref, nf) {
  const order = [];   // ordered least→most recently used
  const lastUsed = {};
  const data = [];

  for (let i = 0; i < ref.length; i++) {
    const pg = ref[i];
    const idx = order.indexOf(pg);
    if (idx !== -1) { order.splice(idx, 1); order.push(pg); }
    else {
      if (order.length >= nf) order.shift();
      order.push(pg);
    }
    lastUsed[pg] = i;

    const snap = [...order, ...Array(nf - order.length).fill(null)];
    const isLRU = order.length > 0 ? order[0] : null;

    const frameInfo = snap.map(p => {
      if (p === null) return { label: 'empty', highlight: false, dimmed: true };
      const ago = i - (lastUsed[p] ?? i);
      return {
        label: `${ago === 0 ? 'Just used' : `${ago} ago`}`,
        sub:   p === isLRU && order.length >= nf ? '← LRU' : '',
        highlight: p === isLRU && order.length >= nf,
        dimmed: false,
      };
    });

    const fault = !order.slice(0, -1).includes(pg);
    let reason = '';
    if (fault) {
      if (isLRU && order.length > 1)
        reason = `P${isLRU} used ${i - (lastUsed[isLRU] ?? i)} steps ago — Least Recently Used → evicted.`;
      else
        reason = `P${pg} not in memory. Loaded into empty frame.`;
    } else {
      reason = `P${pg} HIT! Moving to "most recently used" position.`;
    }

    data.push({ frameInfo, reason, pointer: -1 });
  }
  return data;
}

/* ── Optimal ──────────────────────────────────────────────
   Shows steps until next use. Farthest / never → evicted. */
function computeOptimal(ref, nf) {
  const frames = [];
  const data = [];

  for (let i = 0; i < ref.length; i++) {
    const pg = ref[i];
    if (!frames.includes(pg)) {
      if (frames.length >= nf) {
        let worst = -1, worstPg = frames[0];
        for (const fp of frames) {
          const ni = ref.slice(i + 1).indexOf(fp);
          if (ni === -1) { worstPg = fp; break; }
          if (ni > worst) { worst = ni; worstPg = fp; }
        }
        frames.splice(frames.indexOf(worstPg), 1);
      }
      frames.push(pg);
    }

    const snap = [...frames, ...Array(nf - frames.length).fill(null)];
    // compute next-use distances now
    const nextUse = {};
    for (const fp of frames) {
      const ni = ref.slice(i + 1).indexOf(fp);
      nextUse[fp] = ni === -1 ? 9999 : ni + 1;
    }
    const farthestPg = frames.length >= nf
      ? frames.reduce((a, b) => (nextUse[a] >= nextUse[b] ? a : b), frames[0])
      : null;

    const frameInfo = snap.map(p => {
      if (p === null) return { label: 'empty', highlight: false, dimmed: true };
      const dist = nextUse[p] ?? 9999;
      return {
        label: dist >= 9999 ? 'Next: ∞' : `Next: +${dist}`,
        sub:   p === farthestPg && frames.length >= nf ? '← evict' : '',
        highlight: p === farthestPg && frames.length >= nf,
        dimmed: false,
      };
    });

    let reason = '';
    if (!frames.slice(0, -1).includes(pg)) {
      if (farthestPg && frames.length > 1) {
        const d = nextUse[farthestPg] >= 9999 ? '∞' : `+${nextUse[farthestPg]}`;
        reason = `P${farthestPg} next used in ${d} steps → farthest/never → evicted (Optimal).`;
      } else {
        reason = `P${pg} not in memory. Empty frame available.`;
      }
    } else {
      reason = `P${pg} HIT! No eviction needed.`;
    }

    data.push({ frameInfo, reason, pointer: -1 });
  }
  return data;
}

/* ── Clock ────────────────────────────────────────────────
   Shows use bit per slot + clock hand position.           */
function computeClock(ref, nf) {
  const frames    = Array(nf).fill(null);
  const useBits   = Array(nf).fill(0);
  let pointer     = 0;
  const data      = [];

  for (let i = 0; i < ref.length; i++) {
    const pg = ref[i];
    let fault = false, evictedSlot = -1;

    if (frames.includes(pg)) {
      useBits[frames.indexOf(pg)] = 1;
    } else {
      fault = true;
      while (true) {
        if (useBits[pointer] === 0) {
          evictedSlot = pointer;
          frames[pointer] = pg;
          useBits[pointer] = 1;
          pointer = (pointer + 1) % nf;
          break;
        } else {
          useBits[pointer] = 0;
          pointer = (pointer + 1) % nf;
        }
      }
    }

    const snap = [...frames];
    const frameInfo = snap.map((p, si) => ({
      label:     p === null ? 'empty' : `bit: ${useBits[si] ? '◉' : '○'}`,
      sub:       si === (pointer === 0 ? nf - 1 : pointer - 1) && fault ? '← evicted' : '',
      highlight: fault && si === evictedSlot,
      isPointer: si === pointer,
      bit:       useBits[si],
      dimmed:    p === null,
    }));

    let reason = '';
    if (fault) {
      if (evictedSlot >= 0)
        reason = `Clock hand reached frame ${evictedSlot} (bit=0) → P${frames[evictedSlot]} evicted. Hand advances.`;
      else
        reason = `P${pg} loaded into empty frame.`;
    } else {
      reason = `P${pg} HIT! Reference bit set to ◉ (1). No eviction.`;
    }

    data.push({ frameInfo, reason, pointer });
  }
  return data;
}

/* ── Second Chance ────────────────────────────────────────
   Shows reference bit (★/☆) per page in queue order.     */
function computeSecondChance(ref, nf) {
  const queue    = [];   // [{page, bit}]
  const pageSet  = {};
  const data     = [];

  for (let i = 0; i < ref.length; i++) {
    const pg = ref[i];
    let fault = false;

    if (pg in pageSet) {
      pageSet[pg] = true;
      const qi = queue.findIndex(x => x.page === pg);
      if (qi >= 0) queue[qi].bit = true;
    } else {
      fault = true;
      if (Object.keys(pageSet).length >= nf) {
        while (true) {
          const front = queue.shift();
          if (front.bit) {
            front.bit = false; pageSet[front.page] = false;
            queue.push(front);
          } else {
            delete pageSet[front.page]; break;
          }
        }
      }
      queue.push({ page: pg, bit: true });
      pageSet[pg] = true;
    }

    const snap = queue.map(x => x.page).concat(Array(nf - queue.length).fill(null));
    const frameInfo = snap.map((p, si) => {
      if (p === null) return { label: 'empty', highlight: false, dimmed: true };
      const qi = queue.findIndex(x => x.page === p);
      const bit = qi >= 0 ? queue[qi].bit : false;
      const isFirst = qi === 0;
      return {
        label:     bit ? 'bit: ★' : 'bit: ☆',
        sub:       isFirst ? (bit ? '2nd chance' : '← evict next') : `pos: ${qi + 1}`,
        highlight: isFirst && !bit,
        dimmed:    false,
        bit,
      };
    });

    let reason = '';
    if (fault) {
      const evictCandidate = queue[0];
      if (evictCandidate && !evictCandidate.bit && queue.length > 1)
        reason = `P${evictCandidate.page} has bit ☆ (0) → no second chance → evicted.`;
      else if (evictCandidate?.bit)
        reason = `Front page had bit ★ → given second chance (bit cleared). Scanning for ☆...`;
      else
        reason = `P${pg} not in memory. Loaded into empty slot.`;
    } else {
      reason = `P${pg} HIT! Reference bit set to ★ (second chance granted).`;
    }

    data.push({ frameInfo, reason, pointer: -1 });
  }
  return data;
}

/* ═══════════════════════════════════════════════════════════
   MANSION VISUAL STATE
   ═══════════════════════════════════════════════════════════ */
const MV = {
  canvas: null, ctx: null, rafId: null,
  imgs: {}, ready: false,
  doors: [],
  luigiState: 'idle', luigiT: 0,
  kb: { x: 0, alpha: 0, targetX: 0 },
  flash: { slot: -1, intensity: 0 },
  speech: { text: '', alpha: 0, timer: 0 },
  particles: [],
  W: 700, H: 260, tick: 0, lastT: 0,
  currentAlgoData: null,  // algoData for current step
  clockPointer: -1,
};

const MV_COLORS = [
  '#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16',
  '#0EA5E9','#D946EF','#22C55E','#EAB308','#06B6D4','#A855F7',
];
const mvC  = pg => MV_COLORS[pg % MV_COLORS.length];
const mvHx = h  => ({ r:parseInt(h.slice(1,3),16), g:parseInt(h.slice(3,5),16), b:parseInt(h.slice(5,7),16) });

function mvLoadImages(cb) {
  const map = { luigi:'img/Luigi.png', kingboo:'img/KingBoo.png',
    boo:'img/Boo.png', shyguy:'img/ShyGuy.png', koopa:'img/Koopa.png', kamek:'img/Kamek.png' };
  let done=0, total=Object.keys(map).length;
  for (const [k,src] of Object.entries(map)) {
    const img=new Image();
    img.onload=img.onerror=()=>{ if(++done===total) cb(); };
    img.src=src; MV.imgs[k]=img;
  }
}
const mvGhost = pg => { const l=['boo','shyguy','koopa','kamek']; return MV.imgs[l[pg%4]]; };

/* ── Init ──────────────────────────────────────────────── */
function mvInit(numFrames) {
  const card=document.getElementById('pr-mansion-card');
  const canvas=document.getElementById('pr-mansion-canvas');
  if (!card||!canvas) return;
  card.style.display='block';

  const W=Math.max(500, card.clientWidth||700), H=260;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);

  MV.canvas=canvas; MV.ctx=ctx; MV.W=W; MV.H=H;
  MV.doors=Array.from({length:numFrames},()=>({page:null,color:'#444',state:'empty',animT:0,animDur:1}));
  MV.luigiState='idle'; MV.luigiT=0;
  MV.kb={x:W+100,alpha:0,targetX:W+100};
  MV.flash={slot:-1,intensity:0};
  MV.particles=[]; MV.currentAlgoData=null; MV.clockPointer=-1;
  mvSpeech("Welcome to Luigi's Mansion!  Doors = Frames · Ghosts = Pages", 3.5);

  if (!MV.ready) mvLoadImages(()=>{ MV.ready=true; });
  if (MV.rafId) cancelAnimationFrame(MV.rafId);
  MV.lastT=performance.now(); mvLoop();
}

function mvSpeech(text, secs=2.5) { MV.speech={text,alpha:1,timer:secs}; }

/* ── RAF ───────────────────────────────────────────────── */
function mvLoop() {
  const now=performance.now();
  const dt=Math.min((now-MV.lastT)/1000,0.08);
  MV.lastT=now; MV.tick=now/1000;
  mvUpdate(dt); mvDraw();
  MV.rafId=requestAnimationFrame(mvLoop);
}

function mvUpdate(dt) {
  MV.luigiT+=dt;
  MV.doors.forEach(d=>{
    if (d.state!=='empty'&&d.state!=='occupied') {
      d.animT=Math.min(d.animT+dt,d.animDur);
      if (d.animT>=d.animDur){
        if (d.state==='entering') d.state='occupied';
        if (d.state==='evicting'){ d.state='empty'; d.page=null; }
        if (d.state==='hit') d.state='occupied';
      }
    }
  });
  MV.kb.x+=(MV.kb.targetX-MV.kb.x)*Math.min(dt*5,0.9);
  if (MV.kb.alpha>0&&MV.kb.targetX>MV.W){ MV.kb.alpha=Math.max(0,MV.kb.alpha-dt*1.5); }
  MV.flash.intensity=Math.max(0,MV.flash.intensity-dt*1.6);
  if (MV.flash.intensity<0.05) MV.flash.slot=-1;
  if (MV.speech.timer>0){ MV.speech.timer-=dt; MV.speech.alpha=MV.speech.timer<0.5?Math.max(0,MV.speech.timer/0.5):1; }
  MV.particles=MV.particles.map(p=>({...p,x:p.x+p.vx*dt,y:p.y+p.vy*dt,life:p.life-dt,alpha:p.life/p.maxLife})).filter(p=>p.life>0);
}

/* ═══════════════════════════════════════════════════════════
   DRAW
   ═══════════════════════════════════════════════════════════ */
function mvDraw() {
  const {ctx,W,H,tick}=MV; ctx.clearRect(0,0,W,H);
  const floorY=H-52;

  /* bg */
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#040112'); bg.addColorStop(0.55,'#0b0422'); bg.addColorStop(1,'#180830');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  /* bricks */
  ctx.globalAlpha=0.1; ctx.strokeStyle='#5a3888'; ctx.lineWidth=0.8;
  for(let r=0;r*20<floorY;r++){ const ox=(r%2)*28;
    for(let c=-1;c*56<W+56;c++) ctx.strokeRect(c*56+ox+1,r*20+1,54,18); }
  ctx.globalAlpha=1;

  /* moon */
  const mg=ctx.createRadialGradient(W-60,32,2,W-60,32,28);
  mg.addColorStop(0,'rgba(255,253,220,0.85)'); mg.addColorStop(1,'rgba(255,240,120,0)');
  ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(W-60,32,28,0,Math.PI*2); ctx.fill();

  /* stars */
  [[60,16],[130,9],[210,22],[320,11],[440,19],[560,8],[630,26]].forEach(([x,y])=>{
    ctx.globalAlpha=0.3+0.5*Math.sin(tick*1.2+x*0.09);
    ctx.fillStyle='#dde'; ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
  }); ctx.globalAlpha=1;

  /* floor */
  const fl=ctx.createLinearGradient(0,floorY,0,H);
  fl.addColorStop(0,'#3a1a08'); fl.addColorStop(1,'#150a03');
  ctx.fillStyle=fl; ctx.fillRect(0,floorY,W,H-floorY);
  ctx.fillStyle='rgba(255,200,80,0.06)'; ctx.fillRect(0,floorY,W,3);
  ctx.globalAlpha=0.2; ctx.strokeStyle='#5a2e10'; ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ ctx.beginPath(); ctx.moveTo(x,floorY); ctx.lineTo(x,H); ctx.stroke(); }
  ctx.globalAlpha=1;

  /* layout */
  const LUIGI_Z=68, KB_Z=78, GAP=8;
  const corrW=W-LUIGI_Z-KB_Z, N=MV.doors.length;
  const dW=Math.min(92,Math.max(48,Math.floor((corrW-(N-1)*GAP)/N)));
  const dH=130, dY=floorY-dH-2;
  const totW=N*dW+(N-1)*GAP, startX=LUIGI_Z+(corrW-totW)/2;

  /* candles */
  for(let i=0;i<=N;i++){
    const cx=i===0?startX-16:i===N?startX+(N-1)*(dW+GAP)+dW+16:startX+(i-1)*(dW+GAP)+dW+GAP/2;
    mvCandle(ctx,cx,floorY-20,tick);
  }

  /* flashlight */
  if(MV.flash.intensity>0.05&&MV.flash.slot>=0){
    const dx=startX+MV.flash.slot*(dW+GAP)+dW/2, dy=dY+dH*0.4;
    const lx=LUIGI_Z/2, ly=floorY-52;
    const ang=Math.atan2(dy-ly,dx-lx), len=Math.sqrt((dx-lx)**2+(dy-ly)**2)+50;
    const cg=ctx.createRadialGradient(lx,ly,0,lx,ly,len);
    cg.addColorStop(0,`rgba(255,253,200,${(0.22*MV.flash.intensity).toFixed(2)})`);
    cg.addColorStop(1,'rgba(255,253,200,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(lx,ly);
    ctx.arc(lx,ly,len,ang-0.28,ang+0.28); ctx.closePath(); ctx.fill();
  }

  /* doors */
  const algoData=MV.currentAlgoData;
  MV.doors.forEach((door,i)=>{
    const fi=algoData?.frameInfo?.[i]??null;
    const isClockPtr=algoData?.pointer===i;
    mvDoor(ctx,startX+i*(dW+GAP),dY,dW,dH,door,i,tick,fi,isClockPtr);
  });

  /* algo reason banner */
  if(algoData?.reason){
    ctx.fillStyle='rgba(20,10,40,0.82)';
    mvRR(ctx,LUIGI_Z,dY-28,W-LUIGI_Z-KB_Z,24,6); ctx.fill();
    ctx.fillStyle='rgba(200,170,255,0.9)';
    ctx.font='bold 11px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.save(); ctx.rect(LUIGI_Z+8,dY-28,W-LUIGI_Z-KB_Z-16,24); ctx.clip();
    ctx.fillText(algoData.reason,LUIGI_Z+8,dY-16); ctx.restore();
  }

  /* luigi */
  mvLuigi(ctx,LUIGI_Z,floorY,tick);

  /* king boo */
  if(MV.kb.alpha>0.02){
    const kb=MV.imgs.kingboo, kw=72, kh=Math.round(kw*436/640);
    const ky=floorY-kh-8+Math.sin(tick*1.8)*5;
    ctx.save(); ctx.globalAlpha=MV.kb.alpha;
    if(kb?.complete&&kb.naturalWidth) ctx.drawImage(kb,MV.kb.x-kw/2,ky,kw,kh);
    else{ ctx.fillStyle=`rgba(150,60,220,${MV.kb.alpha})`; ctx.beginPath(); ctx.arc(MV.kb.x,ky+kh/2,kw/2,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  /* particles */
  MV.particles.forEach(p=>{
    ctx.save(); ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
  });

  /* speech */
  if(MV.speech.alpha>0.02) mvSpeechDraw(ctx,LUIGI_Z+4,dY-58);

  /* legend */
  ctx.fillStyle='rgba(160,130,200,0.5)'; ctx.font='9.5px sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='bottom';
  ctx.fillText('Doors = Page Frames  ·  Ghosts = Pages  ·  King Boo = Replacement  ·  Door badge = Algorithm decision info',6,H-3);
}

/* ── Door ──────────────────────────────────────────────── */
function mvDoor(ctx,x,y,w,h,door,idx,tick,fi,isClockPtr) {
  const p=door.animT/Math.max(door.animDur,0.001);
  /* stone surround */
  ctx.fillStyle='#2d1a50'; ctx.fillRect(x-5,y-5,w+10,h+10);
  ctx.strokeStyle='#5a3090'; ctx.lineWidth=1.5; ctx.strokeRect(x-5,y-5,w+10,h+10);

  /* interior */
  if(door.page!==null){
    const {r,g,b}=mvHx(door.color);
    const dg=ctx.createLinearGradient(x,y,x,y+h);
    dg.addColorStop(0,`rgba(${r},${g},${b},0.25)`); dg.addColorStop(1,`rgba(${r},${g},${b},0.07)`);
    ctx.fillStyle=dg; ctx.fillRect(x,y,w,h);
  } else { ctx.fillStyle='#0a0418'; ctx.fillRect(x,y,w,h); }

  /* panels */
  const pC=door.page!==null?`rgba(${mvHx(door.color).r},${mvHx(door.color).g},${mvHx(door.color).b},0.4)`:'#2a1840';
  ctx.strokeStyle=pC; ctx.lineWidth=1.2;
  ctx.strokeRect(x+4,y+4,w-8,h*0.38); ctx.strokeRect(x+4,y+h*0.46,w-8,h*0.38);

  /* state borders */
  if(door.state==='evicting'){
    const sh=Math.sin(tick*45)*(1-p)*5;
    ctx.save(); ctx.translate(sh,0);
    ctx.strokeStyle='#EF4444'; ctx.lineWidth=2.5; ctx.strokeRect(x,y,w,h); ctx.restore();
  } else if(door.page!==null){
    if(door.state==='hit'){
      const pulse=0.5+0.5*Math.sin(tick*12);
      ctx.strokeStyle=`rgba(80,255,150,${0.5+0.4*pulse})`; ctx.lineWidth=2.5; ctx.strokeRect(x,y,w,h);
    } else {
      const {r,g,b}=mvHx(door.color);
      ctx.strokeStyle=`rgba(${r},${g},${b},0.65)`; ctx.lineWidth=1.8; ctx.strokeRect(x,y,w,h);
    }
  }

  /* clock hand indicator */
  if(isClockPtr){
    ctx.strokeStyle='rgba(255,230,50,0.85)'; ctx.lineWidth=2;
    ctx.setLineDash([4,3]);
    ctx.strokeRect(x-3,y-3,w+6,h+6);
    ctx.setLineDash([]);
    /* arrow pointing down at top */
    ctx.fillStyle='rgba(255,230,50,0.9)'; ctx.font='bold 12px sans-serif';
    ctx.textAlign='center'; ctx.fillText('▼',x+w/2,y-7);
  }

  /* knob */
  ctx.fillStyle='#c8960a'; ctx.beginPath(); ctx.arc(x+w-10,y+h/2,3.5,0,Math.PI*2); ctx.fill();

  /* ghost */
  if(door.page!==null){
    let alpha=1, offY=0, scale=1;
    if(door.state==='entering'){ const e=1-Math.pow(1-p,3); offY=-h*0.5*(1-e); alpha=e; scale=0.7+0.3*e; }
    else if(door.state==='evicting'){ alpha=1-p; scale=1-p*0.2; }
    else if(door.state==='hit'){ scale=0.9+0.1*Math.sin(tick*12); }
    else { offY=Math.sin(tick*1.9+idx*0.85)*3; }

    const gImg=mvGhost(door.page);
    const gW=Math.round(w*0.6), gH=gImg?.naturalHeight?Math.round(gW*gImg.naturalHeight/gImg.naturalWidth):gW;
    const gX=x+(w-gW*scale)/2, gY=y+(h-gH*scale)/2+offY-8;

    const {r,g:gc,b}=mvHx(door.color);
    const glow=ctx.createRadialGradient(gX+gW/2,gY+gH/2,2,gX+gW/2,gY+gH/2,gW*0.7);
    glow.addColorStop(0,`rgba(${r},${gc},${b},${(0.38*alpha).toFixed(2)})`);
    glow.addColorStop(1,`rgba(${r},${gc},${b},0)`);
    ctx.fillStyle=glow; ctx.beginPath(); ctx.ellipse(gX+gW/2,gY+gH/2,gW*0.65,gH*0.55,0,0,Math.PI*2); ctx.fill();

    ctx.save(); ctx.globalAlpha=alpha;
    if(gImg?.complete&&gImg.naturalWidth){
      ctx.drawImage(gImg,gX,gY,gW*scale,gH*scale);
      ctx.globalCompositeOperation='source-atop';
      const {r:cr,g:cg,b:cb}=mvHx(door.color);
      ctx.fillStyle=`rgba(${cr},${cg},${cb},0.28)`; ctx.fillRect(gX,gY,gW*scale,gH*scale);
      ctx.globalCompositeOperation='source-over';
    } else {
      ctx.fillStyle=door.color; ctx.beginPath(); ctx.arc(gX+gW/2,gY+gH/2,gW*scale/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    /* page badge */
    if(alpha>0.5){
      ctx.fillStyle='rgba(0,0,0,0.72)'; mvRR(ctx,x+w/2-14,y+h-20,28,14,4); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(9,Math.round(w*0.13))}px 'JetBrains Mono',monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`P${door.page}`,x+w/2,y+h-13);
    }
  }

  /* algo info badge (top of door) */
  if(fi&&!fi.dimmed&&fi.label&&fi.label!=='empty'){
    const badgeY=y+3;
    ctx.fillStyle=fi.highlight?'rgba(255,80,80,0.88)':'rgba(0,0,0,0.68)';
    mvRR(ctx,x+2,badgeY,w-4,13,4); ctx.fill();
    ctx.fillStyle=fi.highlight?'#fff':'rgba(220,200,255,0.9)';
    ctx.font=`bold ${Math.max(8,Math.round(w*0.12))}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(fi.label,x+w/2,badgeY+6.5);
    /* sub label */
    if(fi.sub){
      ctx.fillStyle=fi.highlight?'rgba(255,200,200,0.9)':'rgba(180,160,220,0.8)';
      ctx.font=`${Math.max(7,Math.round(w*0.1))}px sans-serif`;
      ctx.fillText(fi.sub,x+w/2,badgeY+18);
    }
  }

  /* frame label */
  ctx.fillStyle=door.page!==null?door.color:'rgba(140,100,180,0.55)';
  ctx.font=`${Math.max(8,Math.round(w*0.1))}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText(`F${idx}`,x+w/2,y+h-1);
}

/* ── Luigi ──────────────────────────────────────────────── */
function mvLuigi(ctx,zone,floorY,tick) {
  const img=MV.imgs.luigi, lh=108, lw=Math.round(lh*800/1112);
  const lx=(zone-lw)/2;
  let offY=0,rot=0;
  if(MV.luigiState==='idle')    offY=Math.sin(tick*1.4)*2;
  if(MV.luigiState==='scared')  { offY=Math.abs(Math.sin(tick*9))*-7; rot=Math.sin(tick*11)*0.07; }
  if(MV.luigiState==='happy')   offY=Math.abs(Math.sin(tick*5))*-9;
  if(MV.luigiState==='point')   { offY=-4; rot=-0.08; }
  const ly=floorY-lh+offY;
  ctx.save(); ctx.translate(lx+lw/2,ly+lh/2); ctx.rotate(rot);
  if(img?.complete&&img.naturalWidth) ctx.drawImage(img,-lw/2,-lh/2,lw,lh);
  else{ ctx.fillStyle='#22c55e'; ctx.fillRect(-lw/2,-lh/2,lw,lh); }
  ctx.restore();
}

/* ── Candle ─────────────────────────────────────────────── */
function mvCandle(ctx,cx,cy,tick) {
  ctx.fillStyle='#b88030'; ctx.fillRect(cx-3,cy,6,16);
  const f=0.75+0.25*Math.sin(tick*4.5+cx*0.05);
  const fg=ctx.createRadialGradient(cx,cy-5,0,cx,cy-5,12*f);
  fg.addColorStop(0,'rgba(255,240,160,0.95)'); fg.addColorStop(0.4,'rgba(250,150,20,0.7)'); fg.addColorStop(1,'rgba(250,80,10,0)');
  ctx.save(); ctx.globalAlpha=0.88*f; ctx.fillStyle=fg;
  ctx.beginPath(); ctx.arc(cx,cy-5,12*f,0,Math.PI*2); ctx.fill(); ctx.restore();
}

/* ── Speech ─────────────────────────────────────────────── */
function mvSpeechDraw(ctx,x,y) {
  const {text,alpha}=MV.speech; if(!text||alpha<0.02) return;
  ctx.font='bold 10.5px sans-serif';
  const tw=Math.min(ctx.measureText(text).width,220), bw=tw+18, bh=24;
  ctx.fillStyle=`rgba(255,255,230,${(alpha*0.94).toFixed(2)})`; mvRR(ctx,x,y,bw,bh,6); ctx.fill();
  ctx.strokeStyle=`rgba(180,140,60,${(alpha*0.5).toFixed(2)})`; ctx.lineWidth=1; mvRR(ctx,x,y,bw,bh,6); ctx.stroke();
  ctx.fillStyle=`rgba(255,255,230,${(alpha*0.94).toFixed(2)})`;
  ctx.beginPath(); ctx.moveTo(x+10,y+bh); ctx.lineTo(x+4,y+bh+8); ctx.lineTo(x+20,y+bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle=`rgba(50,20,10,${(alpha*0.9).toFixed(2)})`;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.save(); ctx.rect(x+5,y,bw-10,bh); ctx.clip();
  ctx.fillText(text,x+8,y+bh/2); ctx.restore();
}

function mvRR(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function mvParticles(x,y,color,n=12){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=40+Math.random()*80;
    MV.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-25,color,r:2.5+Math.random()*3.5,life:0.5+Math.random()*0.4,maxLife:0.9,alpha:1});
  }
}

/* ═══════════════════════════════════════════════════════════
   EVENT TRIGGERS
   ═══════════════════════════════════════════════════════════ */
function mvOnStep(step, prevFrames, animate, algoData) {
  if(!MV.canvas) return;

  /* update algo explanation */
  MV.currentAlgoData = algoData || null;
  MV.clockPointer    = algoData?.pointer ?? -1;

  if(!animate){
    step.frames_after.forEach((pg,i)=>{
      if(!MV.doors[i]) return;
      MV.doors[i]=pg===null?{page:null,color:'#444',state:'empty',animT:0,animDur:1}:{page:pg,color:mvC(pg),state:'occupied',animT:0,animDur:1};
    }); return;
  }

  const algo = getSelectedAlgo();

  if(step.fault && step.page_evicted!==null){
    const evSlot=MV.doors.findIndex(d=>d.page===step.page_evicted);
    const newSlot=step.frames_after.indexOf(step.page_requested);
    const N=MV.doors.length;
    const LUIGI_Z=68, KB_Z=78, GAP=8;
    const corrW=MV.W-LUIGI_Z-KB_Z;
    const dW=Math.min(92,Math.max(48,Math.floor((corrW-(N-1)*GAP)/N)));
    const totW=N*dW+(N-1)*GAP, startX=LUIGI_Z+(corrW-totW)/2;
    const doorX=evSlot>=0?startX+evSlot*(dW+GAP)+dW/2:MV.W*0.5;

    MV.kb={x:MV.W+80,alpha:1,targetX:doorX};
    MV.luigiState='scared';

    setTimeout(()=>{
      if(evSlot>=0){ MV.doors[evSlot].state='evicting'; MV.doors[evSlot].animT=0; MV.doors[evSlot].animDur=0.45; }
      mvParticles(doorX,MV.H*0.52,'#9b59b6',10);
      mvSpeech(`PAGE FAULT: evicting P${step.page_evicted} (${algo})`,2.5);
    },280);

    setTimeout(()=>{
      MV.kb.targetX=MV.W+120;
      if(newSlot>=0) MV.doors[newSlot]={page:step.page_requested,color:mvC(step.page_requested),state:'entering',animT:0,animDur:0.5};
      setTimeout(()=>{ MV.luigiState='happy'; setTimeout(()=>MV.luigiState='idle',700); },300);
    },880);

  } else if(step.fault && step.page_evicted===null){
    const newSlot=step.frames_after.indexOf(step.page_requested);
    if(newSlot>=0) MV.doors[newSlot]={page:step.page_requested,color:mvC(step.page_requested),state:'entering',animT:0,animDur:0.5};
    mvSpeech(`PAGE FAULT: P${step.page_requested} loaded into empty frame`,2.2);
    MV.luigiState='happy'; setTimeout(()=>MV.luigiState='idle',800);

  } else {
    const hitSlot=step.frames_after.indexOf(step.page_requested);
    if(hitSlot>=0&&MV.doors[hitSlot]){ MV.doors[hitSlot].state='hit'; MV.doors[hitSlot].animT=0; MV.doors[hitSlot].animDur=0.55; }
    MV.flash={slot:hitSlot,intensity:1};
    MV.luigiState='point';
    const N=MV.doors.length, LUIGI_Z=68, KB_Z=78, GAP=8;
    const corrW=MV.W-LUIGI_Z-KB_Z, dW=Math.min(92,Math.max(48,Math.floor((corrW-(N-1)*GAP)/N)));
    const totW=N*dW+(N-1)*GAP, startX=LUIGI_Z+(corrW-totW)/2;
    mvParticles(startX+hitSlot*(dW+GAP)+dW/2,MV.H*0.45,mvC(step.page_requested),14);
    mvSpeech(`HIT: P${step.page_requested} already in memory — no disk access!`,2);
    setTimeout(()=>MV.luigiState='idle',700);
  }
}

function mvOnReset() {
  if(!MV.canvas) return;
  MV.doors.forEach(d=>{ d.page=null; d.state='empty'; d.animT=0; });
  MV.luigiState='idle';
  MV.kb={x:MV.W+120,alpha:0,targetX:MV.W+120};
  MV.flash={slot:-1,intensity:0};
  MV.currentAlgoData=null;
  mvSpeech('Mansion cleared — press Next or Play to start!',3);
}

/* ═══════════════════════════════════════════════════════════
   PAGE REPLACE CORE
   ═══════════════════════════════════════════════════════════ */
function getSelectedAlgo() {
  const c=document.querySelector('input[name="pr-algo-radio"]:checked'); return c?c.value:'FIFO';
}
function getNumFrames() {
  return Math.max(1,Math.floor((parseInt(document.getElementById('pr-mem-size').value)||256)/(parseInt(document.getElementById('pr-page-size').value)||64)));
}
function updateFramesCalc() {
  const mem=parseInt(document.getElementById('pr-mem-size').value)||256;
  const page=parseInt(document.getElementById('pr-page-size').value)||64;
  const frames=Math.max(1,Math.floor(mem/page));
  const el=document.getElementById('pr-mem-size-val'); if(el) el.textContent=mem>=1024?(mem/1024)+' KB':mem+' B';
  const d=document.getElementById('pr-frames-display'); if(d) d.textContent=frames+' frame'+(frames!==1?'s':'');
  const f=document.getElementById('pr-calc-formula'); if(f) f.textContent=frames;
}

async function runPageReplacement() {
  const algo=getSelectedAlgo(), numFrames=getNumFrames();
  const refInput=document.getElementById('pr-refstring').value.trim();
  const refString=refInput.split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
  if(!refString.length){ showToast('Enter a valid reference string','warning'); return; }

  const btn=document.getElementById('btn-run-pr');
  btn.disabled=true; btn.innerHTML='<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></div> Running...';

  try {
    const result=await apiCall('/api/page-replacement',{algorithm:algo,num_frames:numFrames,reference_string:refString});
    PRState.result=result; PRState.currentStep=-1; PRState.faultCount=0;
    /* compute per-step algorithm explanation data */
    PRState.algoData=computeAlgoData(algo,refString,numFrames);
    stopAutoPlay();

    const badge=document.getElementById('pr-algo-badge'); if(badge) badge.textContent=algo;
    updateFaultCounter(0,result.reference_string.length,result.total_faults,result.fault_rate);
    const row=document.getElementById('pr-canvas-row'); if(row) row.style.display='flex';
    clearLog();
    addLog('info',`Simulation started — ${algo} | ${numFrames} frames | ${refString.length} references`);
    renderRefString(result); renderStudyTable(numFrames); updateStepCounter();
    mvInit(numFrames);
    showToast(`${algo} ready — ${result.total_faults} total page faults`,'success');
  } catch(err){}
  finally { btn.disabled=false; btn.innerHTML='<i class="ph ph-play"></i> Start Simulation'; }
}

function renderRefString(result) {
  const c=document.getElementById('pr-ref-visual'); if(!c) return;
  c.innerHTML=result.reference_string.map((p,i)=>`<div class="ref-page" id="ref-page-${i}">${p}</div>`).join('');
}
function renderStudyTable(nf) {
  const c=document.getElementById('pr-frames-visual'); if(!c) return;
  let h=''; for(let i=0;i<nf;i++) h+=`<div class="pr-frame-slot" id="pf-${i}"><div class="pr-frame-index">Frame ${i+1}</div><div class="pr-frame-value" id="pf-val-${i}">—</div><div class="pr-frame-sub" id="pf-sub-${i}"></div></div>`;
  c.innerHTML=h;
}
function updateStudyTable(step) {
  if(!step) return;
  step.frames_after.forEach((page,i)=>{
    const slot=document.getElementById(`pf-${i}`),val=document.getElementById(`pf-val-${i}`),sub=document.getElementById(`pf-sub-${i}`);
    if(!slot||!val) return;
    val.textContent=page!==null?`P${page}`:'—';
    slot.classList.remove('pr-frame-fault','pr-frame-hit','pr-frame-empty','pr-frame-evict');
    if(page===null){ slot.classList.add('pr-frame-empty'); val.style.color=''; slot.style.setProperty('--frame-accent','var(--border)'); }
    else{
      const color=pidColor(page); val.style.color=color; slot.style.setProperty('--frame-accent',color);
      if(page===step.page_requested){ slot.classList.add(step.fault?'pr-frame-fault':'pr-frame-hit'); if(sub) sub.textContent=step.fault?'📥 Loaded':'✅ Hit'; }
      else if(sub) sub.textContent='';
    }
  });
}
function updateRefStringVisual(idx) {
  document.querySelectorAll('.ref-page').forEach((el,i)=>{
    el.classList.remove('current','processed','fault-page');
    if(i<idx){ el.classList.add('processed'); if(PRState.result?.steps[i]?.fault) el.classList.add('fault-page'); }
    else if(i===idx) el.classList.add('current');
  });
  document.getElementById(`ref-page-${idx}`)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}
function updateStepCounter() {
  const total=PRState.result?PRState.result.steps.length:0;
  const el=document.getElementById('pr-step-counter');
  if(el) el.textContent=`Step ${PRState.currentStep+1} / ${total}`;
}
function updateFaultCounter(live,total,max,rate) {
  const n=document.getElementById('pr-total-faults'); if(n) n.textContent=live;
  const r=document.getElementById('pr-fault-rate'); if(r) r.textContent=total>0?((live/total)*100).toFixed(1)+'%':'—';
  const t=document.getElementById('pr-total-refs'); if(t) t.textContent=total;
}
function clearLog(){ const l=document.getElementById('pr-event-log'); if(l) l.innerHTML=''; }
function addLog(type,msg) {
  const log=document.getElementById('pr-event-log'); if(!log) return;
  const icons={fault:'❌',hit:'✅',evict:'🗑️',info:'ℹ️',reset:'🔄'};
  const colors={fault:'#F87171',hit:'#34D399',evict:'#FBBF24',info:'#60A5FA',reset:'#A78BFA'};
  const e=document.createElement('div'); e.className='pr-log-entry pr-log-'+type;
  e.innerHTML=`<span class="pr-log-icon" style="color:${colors[type]||'#94A3B8'}">${icons[type]||'•'}</span><span class="pr-log-msg">${msg}</span>`;
  log.insertBefore(e,log.firstChild);
}

function stepNext() {
  if(!PRState.result) return;
  const steps=PRState.result.steps;
  if(PRState.currentStep>=steps.length-1){ stopAutoPlay(); return; }
  PRState.currentStep++;
  const step=steps[PRState.currentStep];
  const prev=PRState.currentStep>0?steps[PRState.currentStep-1].frames_after:Array(PRState.result.num_frames).fill(null);
  updateStudyTable(step); updateRefStringVisual(PRState.currentStep); updateStepCounter();
  PRState.faultCount=step.fault_count;
  updateFaultCounter(step.fault_count,PRState.result.reference_string.length,PRState.result.total_faults,PRState.result.fault_rate);
  mvOnStep(step,prev,true,PRState.algoData[PRState.currentStep]);
  if(step.fault){
    const em=step.page_evicted!==null?` — P${step.page_evicted} removed (${getSelectedAlgo()})`:'';
    addLog('fault',`⚡ PAGE FAULT: P${step.page_requested} → Frame ${step.frames_after.indexOf(step.page_requested)+1}${em}`);
  } else { addLog('hit',`HIT: P${step.page_requested} already in memory ✅`); }
}
function stepPrev() {
  if(!PRState.result||PRState.currentStep<0) return;
  PRState.currentStep--;
  if(PRState.currentStep<0){
    renderStudyTable(PRState.result.num_frames); updateRefStringVisual(-1);
    updateFaultCounter(0,PRState.result.reference_string.length,PRState.result.total_faults,PRState.result.fault_rate);
    updateStepCounter();
    mvOnStep({page_requested:-1,fault:false,page_evicted:null,frames_after:Array(PRState.result.num_frames).fill(null)},[],false,null);
    return;
  }
  const step=PRState.result.steps[PRState.currentStep];
  const prev=PRState.currentStep>0?PRState.result.steps[PRState.currentStep-1].frames_after:Array(PRState.result.num_frames).fill(null);
  updateStudyTable(step); updateRefStringVisual(PRState.currentStep);
  updateFaultCounter(step.fault_count,PRState.result.reference_string.length,PRState.result.total_faults,PRState.result.fault_rate);
  updateStepCounter();
  mvOnStep(step,prev,false,PRState.algoData[PRState.currentStep]);
}
function stepReset() {
  if(!PRState.result) return;
  stopAutoPlay(); PRState.currentStep=-1; PRState.faultCount=0;
  renderStudyTable(PRState.result.num_frames); updateRefStringVisual(-1);
  updateFaultCounter(0,PRState.result.reference_string.length,PRState.result.total_faults,PRState.result.fault_rate);
  updateStepCounter(); clearLog(); addLog('reset','Table cleared — ready to replay');
  mvOnReset();
}
function toggleAutoPlay(){ PRState.playing?stopAutoPlay():startAutoPlay(); }
function startAutoPlay() {
  if(!PRState.result) return; PRState.playing=true;
  const btn=document.getElementById('pr-btn-play');
  if(btn){ btn.innerHTML='<i class="ph ph-pause"></i> Pause'; btn.classList.replace('btn-primary','btn-secondary'); }
  function tick(){
    if(!PRState.playing) return;
    if(PRState.currentStep>=PRState.result.steps.length-1){ stopAutoPlay(); return; }
    stepNext(); const speed=parseFloat(document.getElementById('pr-speed')?.value||1);
    _autoplayTimer=setTimeout(tick,900/speed);
  } tick();
}
function stopAutoPlay() {
  PRState.playing=false; clearTimeout(_autoplayTimer);
  const btn=document.getElementById('pr-btn-play');
  if(btn){ btn.innerHTML='<i class="ph ph-play"></i> Play'; btn.classList.replace('btn-secondary','btn-primary'); }
}
function generateRandomRefString() {
  const len=15+Math.floor(Math.random()*10), range=6+Math.floor(Math.random()*4);
  const seq=Array.from({length:len},()=>Math.floor(Math.random()*range));
  const el=document.getElementById('pr-refstring'); if(el) el.value=seq.join(',');
}
function makeStepper(decId,incId,valId,min=1,max=8) {
  const dec=document.getElementById(decId),inc=document.getElementById(incId),val=document.getElementById(valId);
  if(!dec||!inc||!val) return;
  dec.addEventListener('click',()=>{ const v=parseInt(val.textContent); if(v>min) val.textContent=v-1; });
  inc.addEventListener('click',()=>{ const v=parseInt(val.textContent); if(v<max) val.textContent=v+1; });
}

document.addEventListener('DOMContentLoaded',()=>{
  const ms=document.getElementById('pr-mem-size'),ps=document.getElementById('pr-page-size');
  if(ms) ms.addEventListener('input',updateFramesCalc);
  if(ps) ps.addEventListener('change',updateFramesCalc);
  updateFramesCalc();
  document.querySelectorAll('.pr-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{ document.querySelectorAll('.pr-pill').forEach(p=>p.classList.remove('active')); pill.classList.add('active'); });
  });
  document.getElementById('pr-btn-next')?.addEventListener('click',stepNext);
  document.getElementById('pr-btn-prev')?.addEventListener('click',stepPrev);
  document.getElementById('pr-btn-reset')?.addEventListener('click',stepReset);
  document.getElementById('pr-btn-play')?.addEventListener('click',toggleAutoPlay);
  document.getElementById('pr-speed')?.addEventListener('input',e=>{
    const l=document.getElementById('pr-speed-label'); if(l) l.textContent=parseFloat(e.target.value).toFixed(2).replace('.00','')+'x';
  });
  document.getElementById('pr-btn-random')?.addEventListener('click',generateRandomRefString);
  document.getElementById('pr-log-clear')?.addEventListener('click',clearLog);
  makeStepper('pr-step-a-dec','pr-step-a-inc','pr-step-a-val');
  makeStepper('pr-step-b-dec','pr-step-b-inc','pr-step-b-val');
  makeStepper('pr-step-c-dec','pr-step-c-inc','pr-step-c-val');
});

window.runPageReplacement=runPageReplacement;
