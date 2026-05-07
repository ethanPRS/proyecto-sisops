/* ══════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
══════════════════════════════════════════════════════════ */
var COLORS   = ['#185FA5','#E24B4A','#3B6D11','#BA7515','#534AB7','#D4537E'];
var SPD_MAP  = [0.5, 1.0, 2.0, 3.5, 6.0];
var PAD_L=52, PAD_R=14, ROW_H=28, ROW_GAP=8, TOP_PAD=22, AXIS_H=26;
var MARIO_PX=3;

function setupCanvas(id,cssH){
  var cv=document.getElementById(id);
  var dpr=window.devicePixelRatio||1;
  var cssW=cv.offsetWidth||800;
  if(cv.width!==Math.round(cssW*dpr)||cv.height!==Math.round(cssH*dpr)){
    cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
    cv.style.height=cssH+'px';
    cv.getContext('2d').scale(dpr,dpr);
  }
  return {ctx:cv.getContext('2d'),w:cssW,h:cssH};
}

function roundRect(ctx,x,y,w,h,r){
  if(w<2*r)r=w/2; if(h<2*r)r=h/2;
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function tickStep(t){ if(t<=10)return 1; if(t<=20)return 2; if(t<=50)return 5; return 10; }

function getSpd(k){ 
  var el = document.getElementById('spd-'+k);
  if(!el) return 1.0;
  return SPD_MAP[+el.value-1]; 
}

function updateSpdLbl(k){
  var labels=['0.5x','1x','2x','3.5x','6x'];
  var el = document.getElementById('spd-'+k);
  var lbl = document.getElementById('spd-'+k+'-lbl');
  if(el && lbl) lbl.textContent=labels[+el.value-1];
}

function flashMetric(id,val){
  var el=document.getElementById(id);
  if(!el)return;
  if(el.textContent===String(val))return;
  el.textContent=val; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function axisFlashTrigger(store,t,kind){
  if(!store[t]||store[t].age>0.5) store[t]={age:0,kind:kind};
}
function axisFlashAdvance(store,dt){
  Object.keys(store).forEach(function(t){
    store[t].age+=dt*1.5; if(store[t].age>=1)delete store[t];
  });
}
function drawAxis(ctx,cssW,axisY,totalTime,store,accentCol){
  var usableW=cssW-PAD_L-PAD_R;
  var pxU=usableW/Math.max(totalTime,1);
  var step=tickStep(totalTime);
  for(var t=0;t<=totalTime;t+=step){
    var tx=PAD_L+t*pxU;
    var fl=store[t];
    if(fl){
      var b=Math.sin(fl.age*Math.PI);
      var isAT=fl.kind==='at';
      ctx.strokeStyle=isAT?'rgba(186,117,21,'+(b*.7)+')':'rgba(59,109,17,'+(b*.7)+')';
      ctx.lineWidth=1.5+b*2; ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(tx,0);ctx.lineTo(tx,axisY+6);ctx.stroke();
      ctx.lineWidth=1;
      ctx.fillStyle=isAT?'rgba(186,117,21,'+(b*.85)+')':'rgba(59,109,17,'+(b*.85)+')';
      ctx.beginPath();ctx.arc(tx,axisY+4,4+b*5,0,Math.PI*2);ctx.fill();
      var sc=1+b*.45;
      ctx.save();ctx.translate(tx,axisY+19);ctx.scale(sc,sc);
      ctx.font='700 11px Segoe UI,sans-serif';
      ctx.fillStyle=isAT?'#BA7515':'#3B6D11';
      ctx.textAlign='center';ctx.fillText(t,0,0);
      ctx.font='600 8px Segoe UI,sans-serif';
      ctx.fillStyle=isAT?'rgba(186,117,21,'+b+')':'rgba(59,109,17,'+b+')';
      ctx.fillText(isAT?'AT':'CT',0,9);
      ctx.restore();
    } else {
      ctx.strokeStyle='#d0d4e8';ctx.lineWidth=1;ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(tx,axisY);ctx.lineTo(tx,axisY+5);ctx.stroke();
      ctx.font='11px Segoe UI,sans-serif';ctx.fillStyle='#9099b8';ctx.textAlign='center';
      ctx.fillText(t,tx,axisY+17);
    }
  }
  return pxU;
}
function drawCursor(ctx,tick,pxU,axisY,col){
  if(tick<=0)return;
  var cx=PAD_L+tick*pxU;
  ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,axisY+4);ctx.stroke();
  ctx.setLineDash([]);
}

/* ══════════════════════════════════════════════════════════
   MARIO UNIVERSE PIXEL-ART SPRITES
══════════════════════════════════════════════════════════ */
var MARIO_PX = 3;
var SPRITE_W = 9 * MARIO_PX;
var SPRITE_H = 12 * MARIO_PX;

var RUN_F0 = ['_HHHH___','_HHHHHH_','_SSHSS__','_SHSSHS_','_SSSSSS_','__OOOOO_','_OBBBBO_','OOBBBBOOO','_OOOOOO_','__OO_OO_','_FF__FF_','FFF__FFF'];
var RUN_F1 = ['_HHHH___','_HHHHHH_','_SSHSS__','_SHSSHS_','_SSSSSS_','__OOOOO_','_OBBBBO_','OOBBBBOOO','_OOOOOO_','_OO__OO_','_FF_FF__','__FFF___'];
var RUN_F2 = ['_HHHH___','_HHHHHH_','_SSHSS__','_SHSSHS_','_SSSSSS_','__OOOOO_','_OBBBBO_','OOBBBBOOO','__OOOO__','_OO__OO_','FF____FF','F______F'];
var JUMP_F = ['_HHHH___','_HHHHHH_','_SSHSS__','_SHSSHS_','_SSSSSS_','_OOOOOO_','_OBBBBO_','OOBBBBOOO','__OOOO__','__O__O__','_FF__FF_','_F____F_'];
var RUN_FRAMES = [RUN_F0, RUN_F1, RUN_F2];

var PALETTES = {
  mario: { H:'#E52B2B', O:'#5555EE', S:'#F5C08A', F:'#7A3B00', B:'#ffffff', _:null },
  luigi: { H:'#2DB52D', O:'#5555EE', S:'#F5C08A', F:'#7A3B00', B:'#ffffff', _:null },
  toad:  { H:'#F5F5F5', O:'#185FA5', S:'#F5C08A', F:'#E24B4A', B:'#E24B4A', _:null },
  yoshi: { H:'#2DB52D', O:'#2DB52D', S:'#2DB52D', F:'#E52B2B', B:'#ffffff', _:null }
};

var CHAR_MAP = { T1:'mario', T2:'luigi', T3:'toad', A:'mario', B:'luigi',
                 'Core 1':'mario','Core 2':'luigi','Core 3':'toad','Core 4':'yoshi' };

function getCharForPid(pid){ return CHAR_MAP[pid] || 'mario'; }

function drawSprite(ctx, x, y, charName, frame, jumping){
  var pal  = PALETTES[charName] || PALETTES.mario;
  var grid = jumping ? JUMP_F : RUN_FRAMES[frame % 3];
  grid.forEach(function(row, ry){
    for(var cx=0; cx<row.length; cx++){
      var col = pal[row[cx]];
      if(!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + cx*MARIO_PX), Math.round(y + ry*MARIO_PX), MARIO_PX, MARIO_PX);
    }
  });
}

function mkChef(){ return {x:0,y:0,frame:0,ft:0,jumping:false,jumpVel:0,baseY:0,lastPid:null}; }

function updateChef(chef,dt,tick,schedule,processes,pxU,axisY,cssW){
  var rb=null;
  schedule.forEach(function(b){ if(tick>b.start&&tick<b.end) rb=b; });
  var targetX = rb ? PAD_L+Math.min(rb.end,tick)*pxU - SPRITE_W/2
                   : PAD_L+tick*pxU - SPRITE_W/2;
  targetX = Math.max(PAD_L, Math.min(cssW-PAD_R-SPRITE_W, targetX));
  chef.x += (targetX-chef.x) * Math.min(1, dt*14);
  var targetY;
  if(rb){
    var idx = -1;
    for(var i=0;i<processes.length;i++){ if(processes[i].pid===rb.pid){idx=i;break;} }
    if(idx<0) idx=0;
    targetY = TOP_PAD + idx*(ROW_H+ROW_GAP) - SPRITE_H - 2;
  } else {
    targetY = axisY - SPRITE_H - 4;
  }
  chef.baseY = targetY;
  if(rb && rb.pid !== chef.lastPid && !chef.jumping){
    chef.jumping = true; chef.jumpVel = -120;
  }
  if(rb) chef.lastPid = rb.pid;
  if(chef.jumping){
    chef.y += chef.jumpVel*dt; chef.jumpVel += 320*dt;
    if(chef.y >= chef.baseY){ chef.y=chef.baseY; chef.jumping=false; chef.jumpVel=0; }
  } else { chef.y = chef.baseY; }
  if(!chef.jumping){
    chef.ft += dt;
    if(chef.ft >= 1/8){ chef.ft=0; chef.frame++; }
  }
}

function drawChef(ctx, x, y, blockOrColor, frame, jumping){
  var pid = blockOrColor && blockOrColor.pid ? blockOrColor.pid : null;
  var charName = pid ? getCharForPid(pid) : 'mario';
  drawSprite(ctx, x, y, charName, frame, jumping);
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — MULTITHREADING
══════════════════════════════════════════════════════════ */
var MT={playing:false,raf:null,lastTs:null,t:0,sw:0,
  processes:[
    {pid:'T1',at:0,bt:9, color:'#E52B2B',label:'Mario — HTTP',remaining:9,firstStart:-1,ct:-1},
    {pid:'T2',at:0,bt:6, color:'#2DB52D',label:'Luigi — DB query',remaining:6,firstStart:-1,ct:-1},
    {pid:'T3',at:0,bt:12,color:'#185FA5',label:'Toad — File I/O',remaining:12,firstStart:-1,ct:-1}
  ],
  schedule:[],totalTime:0,chef:mkChef(),
  axisFlash:{},animCells:{},prevDone:{}
};

function buildMTSchedule(){
  var ps=MT.processes.map(function(p){
    return {pid:p.pid,at:p.at,bt:p.bt,color:p.color,remaining:p.bt,firstStart:-1,ct:-1};
  });
  var Q=3,time=0,done=0,blocks=[],queue=[],arrived={},sw=0;
  ps.forEach(function(p){if(p.at<=time){queue.push(p);arrived[p.pid]=true;}});
  var safety=0;
  while(done<ps.length&&safety++<10000){
    if(!queue.length){time++;ps.forEach(function(p){if(!arrived[p.pid]&&p.at<=time){queue.push(p);arrived[p.pid]=true;}});continue;}
    var cur=queue.shift();
    if(cur.firstStart===-1)cur.firstStart=time;
    var run=Math.min(Q,cur.remaining);
    blocks.push({pid:cur.pid,start:time,end:time+run,color:cur.color});
    time+=run; cur.remaining-=run;
    ps.forEach(function(p){if(!arrived[p.pid]&&p.at<=time){queue.push(p);arrived[p.pid]=true;}});
    if(cur.remaining>0){queue.push(cur);sw++;}
    else{cur.ct=time;done++;}
  }
  MT.schedule=blocks; MT.totalTime=time; MT.sw=sw;
  ps.forEach(function(p,i){MT.processes[i].ct=p.ct;MT.processes[i].firstStart=p.firstStart;});
}

function resetMT(){
  MT.playing=false;cancelAnimationFrame(MT.raf);MT.lastTs=null;MT.t=0;
  MT.processes.forEach(function(p){p.remaining=p.bt;p.firstStart=-1;p.ct=-1;});
  MT.chef=mkChef();MT.axisFlash={};MT.animCells={};MT.prevDone={};
  buildMTSchedule();
  var btn=document.getElementById('btn-mt'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  var tEl=document.getElementById('mt-t'); if(tEl)tEl.textContent='0.00';
  flashMetric('mt-m2','0');flashMetric('mt-m3','—');flashMetric('mt-m4','—');
  drawMT(0);renderMTTable(0);
  mtBrInit();renderMTBarRace();drawMTSparklines();
}

function toggleMT(){
  if(MT.playing){MT.playing=false;cancelAnimationFrame(MT.raf);document.getElementById('btn-mt').innerHTML='<i class="ph ph-play"></i> Play';}
  else{
    if(MT.t>=MT.totalTime){MT.t=0;MT.chef=mkChef();MT.axisFlash={};MT.animCells={};MT.prevDone={};MT.lastTs=null;}
    MT.playing=true;MT.lastTs=null;document.getElementById('btn-mt').innerHTML='<i class="ph ph-pause"></i> Pause';
    MT.raf=requestAnimationFrame(rafMT);
  }
}

function rafMT(ts){
  if(!MT.playing)return;
  if(!MT.lastTs)MT.lastTs=ts;
  var dt=(ts-MT.lastTs)/1000;MT.lastTs=ts;
  MT.t+=dt*getSpd('mt');
  if(MT.t>=MT.totalTime){MT.t=MT.totalTime;MT.playing=false;document.getElementById('btn-mt').innerHTML='<i class="ph ph-play"></i> Play';}
  MT.processes.forEach(function(p){
    if(MT.t>=p.at&&(MT.t-dt*getSpd('mt'))<p.at) axisFlashTrigger(MT.axisFlash,p.at,'at');
    if(p.ct>0&&MT.t>=p.ct&&(MT.t-dt*getSpd('mt'))<p.ct) axisFlashTrigger(MT.axisFlash,p.ct,'ct');
  });
  axisFlashAdvance(MT.axisFlash,dt);
  var done=MT.processes.filter(function(p){return p.ct>0&&MT.t>=p.ct;});
  if(done.length){
    var avgTAT=(done.reduce(function(s,p){return s+(p.ct-p.at);},0)/done.length).toFixed(2);
    var avgWT =(done.reduce(function(s,p){return s+(p.ct-p.at-p.bt);},0)/done.length).toFixed(2);
    flashMetric('mt-m3',avgTAT);flashMetric('mt-m4',avgWT);
  }
  var visibleSW=MT.schedule.filter(function(b){return b.end<=MT.t;}).length-done.length;
  if(visibleSW<0)visibleSW=0;
  flashMetric('mt-m2',visibleSW);
  var tel=document.getElementById('mt-t'); if(tel)tel.textContent=MT.t.toFixed(2);
  drawMT(dt);renderMTTable(MT.t);
  MT_BR_TIMER+=dt;
  if(MT_BR_TIMER>=0.18){
    MT_BR_TIMER=0;
    MT.processes.forEach(function(p,i){
      var run=MT.schedule.filter(function(b){return b.pid===p.pid&&b.end<=MT.t;}).reduce(function(s,b){return s+(b.end-b.start);},0);
      var act=MT.schedule.find(function(b){return b.pid===p.pid&&MT.t>b.start&&MT.t<b.end;});
      if(act)run+=MT.t-act.start;
      var pct=p.ct>0&&MT.t>=p.ct?100:Math.min(100,Math.round(run/p.bt*100));
      if(!MT_BR_HISTORY[i])MT_BR_HISTORY[i]=[];
      MT_BR_HISTORY[i].push(pct);
      if(MT_BR_HISTORY[i].length>120)MT_BR_HISTORY[i].shift();
    });
  }
  renderMTBarRace();
  drawMTSparklines();
  if(MT.playing)MT.raf=requestAnimationFrame(rafMT);
}

function drawMT(dt){
  var cssH=200;
  var cv=document.getElementById('c-mt');if(!cv||!cv.getContext)return;
  var g=setupCanvas('c-mt',cssH);var ctx=g.ctx;var cssW=g.w;
  ctx.clearRect(0,0,cssW,cssH);
  var usableW=cssW-PAD_L-PAD_R;
  var pxU=usableW/Math.max(MT.totalTime,1);
  var axisY=TOP_PAD+MT.processes.length*(ROW_H+ROW_GAP)+4;

  for(var q=3;q<MT.totalTime;q+=3){
    var qx=PAD_L+q*pxU;
    ctx.strokeStyle='rgba(24,95,165,.1)';ctx.lineWidth=1;ctx.setLineDash([2,4]);
    ctx.beginPath();ctx.moveTo(qx,TOP_PAD);ctx.lineTo(qx,axisY);ctx.stroke();ctx.setLineDash([]);
  }

  MT.processes.forEach(function(p,idx){
    var y=TOP_PAD+idx*(ROW_H+ROW_GAP);
    ctx.font='600 12px Segoe UI,sans-serif';ctx.fillStyle='#5a6080';ctx.textAlign='right';
    ctx.fillText(p.pid,PAD_L-6,y+ROW_H/2+4);
    ctx.fillStyle='#edf0f8';roundRect(ctx,PAD_L,y,usableW,ROW_H,5);ctx.fill();
    MT.schedule.filter(function(b){return b.pid===p.pid;}).forEach(function(b){
      if(b.start>=MT.t)return;
      var endT=Math.min(b.end,MT.t);
      var bx=PAD_L+b.start*pxU;var bw=(endT-b.start)*pxU;if(bw<=0)return;
      ctx.fillStyle=p.color;roundRect(ctx,bx,y,bw,ROW_H,4);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.18)';roundRect(ctx,bx,y,bw,ROW_H/3,4);ctx.fill();
      if(bw>14){ctx.font='700 10px Segoe UI,sans-serif';ctx.fillStyle='rgba(255,255,255,.9)';ctx.textAlign='center';ctx.fillText(p.pid,bx+bw/2,y+ROW_H/2+4,bw-4);}
      if(b.end>MT.t&&MT.t>b.start){
        var grad=ctx.createLinearGradient(bx+bw-12,0,bx+bw,0);
        grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(1,'rgba(255,255,255,.45)');
        ctx.fillStyle=grad;roundRect(ctx,bx+bw-12,y,12,ROW_H,0);ctx.fill();
      }
      if(b.end<=MT.t){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;var rx=PAD_L+b.end*pxU;ctx.beginPath();ctx.moveTo(rx,y+2);ctx.lineTo(rx,y+ROW_H-2);ctx.stroke();}
    });
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle='#9099b8';ctx.textAlign='left';
    ctx.fillText(p.label,4,y+ROW_H/2+4);
  });

  var pxU2=drawAxis(ctx,cssW,axisY,MT.totalTime,MT.axisFlash,MT.processes[0].color);
  drawCursor(ctx,MT.t,pxU2,axisY,'#185FA5');
  if(MT.processes.length>0&&MT.schedule.length>0){
    if(MT.t>0) updateChef(MT.chef,dt,MT.t,MT.schedule,MT.processes,pxU2,axisY,cssW);
    else { MT.chef.x=PAD_L; MT.chef.y=TOP_PAD-SPRITE_H-2; }
    var mtRb=MT.schedule.find(function(b){return MT.t>b.start&&MT.t<b.end;});
    drawChef(ctx,MT.chef.x,MT.chef.y,mtRb||(MT.schedule[0]||{pid:'T1'}),MT.chef.frame,MT.chef.jumping);
  }
}

function renderMTTable(tick){
  var tbody=document.getElementById('mt-tbody');
  if(!tbody)return;
  var newlyDone={},newlyStarted={};
  MT.processes.forEach(function(p){
    var kd=p.pid+'-d',ks=p.pid+'-s';
    if(p.ct>0&&tick>=p.ct&&!MT.prevDone[kd]){newlyDone[p.pid]=true;MT.prevDone[kd]=true;}
    if(p.firstStart>=0&&tick>=p.firstStart&&!MT.prevDone[ks]){newlyStarted[p.pid]=true;MT.prevDone[ks]=true;}
  });
  var dash='<span style="color:#c8ccdc">&mdash;</span>';
  var rows=MT.processes.map(function(p){
    var blocks=MT.schedule.filter(function(b){return b.pid===p.pid;});
    var running=blocks.some(function(b){return tick>b.start&&tick<b.end;});
    var done=p.ct>0&&tick>=p.ct;
    var tat=done?(p.ct-p.at):null;
    var wt=tat!==null?(tat-p.bt):null;
    var resp=(p.firstStart>=0&&tick>=p.firstStart)?(p.firstStart-p.at):null;
    var ctA=(newlyDone[p.pid]&&!MT.animCells[p.pid+'-ct'])?' cell-appear':'';
    var tatA=(newlyDone[p.pid]&&!MT.animCells[p.pid+'-tat'])?' cell-appear':'';
    var wtA=(newlyDone[p.pid]&&!MT.animCells[p.pid+'-wt'])?' cell-appear':'';
    var rA=(newlyStarted[p.pid]&&!MT.animCells[p.pid+'-r'])?' cell-appear':'';
    if(newlyDone[p.pid]){MT.animCells[p.pid+'-ct']=MT.animCells[p.pid+'-tat']=MT.animCells[p.pid+'-wt']=true;}
    if(newlyStarted[p.pid])MT.animCells[p.pid+'-r']=true;
    var cls=running?'row-running':done?'row-done':'';
    var ctStr=done?('<span class="'+ctA+'">'+p.ct+'</span>'):dash;
    var tatStr=tat!==null?('<span class="'+tatA+'" style="color:#185FA5">'+p.ct+'-'+p.at+'=<b>'+tat+'</b></span>'):dash;
    var wtStr=wt!==null?('<span class="'+wtA+'" style="color:#BA7515">'+tat+'-'+p.bt+'=<b>'+wt+'</b></span>'):dash;
    var rStr=resp!==null?('<span class="'+rA+'" style="color:#3B6D11">'+p.firstStart+'-'+p.at+'=<b>'+resp+'</b></span>'):dash;
    return '<tr class="'+cls+'"><td><span class="dot" style="background:'+p.color+'"></span></td>'
      +'<td style="font-weight:600">'+p.pid+'<br><span style="font-size:10px;color:#9099b8;font-weight:400">'+p.label+'</span></td>'
      +'<td>'+p.bt+'</td><td>'+ctStr+'</td><td>'+tatStr+'</td><td>'+wtStr+'</td><td>'+rStr+'</td></tr>';
  }).join('');
  var allDone=MT.processes.every(function(p){return p.ct>0&&tick>=p.ct;});
  if(allDone){
    var nc=MT.processes.length;
    var atat=(MT.processes.reduce(function(s,p){return s+(p.ct-p.at);},0)/nc).toFixed(2);
    var awt=(MT.processes.reduce(function(s,p){return s+(p.ct-p.at-p.bt);},0)/nc).toFixed(2);
    rows+='<tr class="row-avg"><td colspan="4" style="text-align:right;font-size:10px;color:#9099b8">PROM</td><td style="color:#185FA5">'+atat+'</td><td style="color:#BA7515">'+awt+'</td><td>—</td></tr>';
  }
  tbody.innerHTML=rows;
  
  updateMTStateDiagram(tick);
  var st=document.getElementById('mt-step'); if(st)st.textContent=Math.round(tick)+' / '+MT.totalTime;
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — CONCURRENCIA
══════════════════════════════════════════════════════════ */
var CC={playing:false,raf:null,lastTs:null,t:0,blocked:0,
  ta:{pid:'A',color:'#185FA5',label:'Thread A',total:20,ct:-1,firstStart:-1},
  tb:{pid:'B',color:'#E24B4A',label:'Thread B',total:18,ct:-1,firstStart:-1},
  schedule:[],totalTime:0,
  chef:mkChef(),axisFlash:{},animCells:{},prevDone:{}
};
var CC_ZONE=[6,12];

function buildCCSchedule(){
  var blocks=[];
  var pA={prog:0,total:20},pB={prog:0,total:18};
  var mutex=false,owner=null,time=0,MAX=80;
  var fstA=-1,fstB=-1;
  while((pA.prog<pA.total||pB.prog<pB.total)&&time<MAX){
    var aCS=pA.prog>=CC_ZONE[0]&&pA.prog<CC_ZONE[1];
    var bCS=pB.prog>=CC_ZONE[0]&&pB.prog<CC_ZONE[1];
    if(pA.prog<pA.total){
      if(aCS){
        if(!mutex||(mutex&&owner==='A')){
          if(!mutex){mutex=true;owner='A';}
          if(fstA<0)fstA=time;
          blocks.push({pid:'A',start:time,end:time+1,color:'#BA7515',cs:true});
          pA.prog++;time++;
          if(pA.prog>=CC_ZONE[1]){mutex=false;owner=null;}
        } else {
          if(pB.prog<pB.total&&!(bCS&&mutex&&owner!=='B')){
            if(fstB<0)fstB=time;
            blocks.push({pid:'B',start:time,end:time+1,color:bCS?'#BA7515':'#E24B4A',cs:bCS});
            if(bCS&&!mutex){mutex=true;owner='B';}
            pB.prog++;time++;
            if(bCS&&pB.prog>=CC_ZONE[1]&&owner==='B'){mutex=false;owner=null;}
          } else { time++; }
        }
      } else {
        if(fstA<0)fstA=time;
        blocks.push({pid:'A',start:time,end:time+1,color:'#185FA5',cs:false});
        pA.prog++;time++;
      }
    } else if(pB.prog<pB.total){
      if(bCS){
        if(!mutex||(mutex&&owner==='B')){
          if(!mutex){mutex=true;owner='B';}
          if(fstB<0)fstB=time;
          blocks.push({pid:'B',start:time,end:time+1,color:'#BA7515',cs:true});
          pB.prog++;time++;
          if(pB.prog>=CC_ZONE[1]){mutex=false;owner=null;}
        } else { time++; }
      } else {
        if(fstB<0)fstB=time;
        blocks.push({pid:'B',start:time,end:time+1,color:'#E24B4A',cs:false});
        pB.prog++;time++;
      }
    } else break;
  }
  var lA=blocks.filter(function(b){return b.pid==='A';});
  var lB=blocks.filter(function(b){return b.pid==='B';});
  CC.ta.ct=lA.length?lA[lA.length-1].end:-1;
  CC.tb.ct=lB.length?lB[lB.length-1].end:-1;
  CC.ta.firstStart=fstA; CC.tb.firstStart=fstB;
  CC.schedule=blocks; CC.totalTime=time;
}

function resetCC(){
  CC.playing=false;cancelAnimationFrame(CC.raf);CC.lastTs=null;CC.t=0;CC.blocked=0;
  CC.ta={pid:'A',color:'#185FA5',label:'Thread A',total:20,ct:-1,firstStart:-1};
  CC.tb={pid:'B',color:'#E24B4A',label:'Thread B',total:18,ct:-1,firstStart:-1};
  CC.chef=mkChef();CC.axisFlash={};CC.animCells={};CC.prevDone={};
  buildCCSchedule();
  var btn=document.getElementById('btn-cc'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  var tEl=document.getElementById('cc-t'); if(tEl)tEl.textContent='0.00';
  var m2=document.getElementById('cc-m2'); if(m2){m2.textContent='LIBRE';m2.style.color='#3B6D11';}
  flashMetric('cc-m3','0');flashMetric('cc-m4','—');
  drawCC(0);renderCCTable(0);
  ccBrInit();renderCCBarRace();drawCCSparklines();
}

function toggleCC(){
  if(CC.playing){CC.playing=false;cancelAnimationFrame(CC.raf);document.getElementById('btn-cc').innerHTML='<i class="ph ph-play"></i> Play';}
  else{
    if(CC.t>=CC.totalTime){CC.t=0;CC.chef=mkChef();CC.axisFlash={};CC.animCells={};CC.prevDone={};CC.lastTs=null;}
    CC.playing=true;CC.lastTs=null;document.getElementById('btn-cc').innerHTML='<i class="ph ph-pause"></i> Pause';
    CC.raf=requestAnimationFrame(rafCC);
  }
}

function rafCC(ts){
  if(!CC.playing)return;
  if(!CC.lastTs)CC.lastTs=ts;
  var dt=(ts-CC.lastTs)/1000;CC.lastTs=ts;
  CC.t+=dt*getSpd('cc');
  if(CC.t>=CC.totalTime){CC.t=CC.totalTime;CC.playing=false;var btn=document.getElementById('btn-cc');if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';}
  axisFlashAdvance(CC.axisFlash,dt);
  var inCS=CC.schedule.filter(function(b){return b.cs&&CC.t>b.start&&CC.t<b.end;});
  var mutOwner=inCS.length?inCS[0].pid:null;
  var m2=document.getElementById('cc-m2');
  if(m2){
    if(mutOwner){m2.textContent='THREAD '+mutOwner;m2.style.color='#A32D2D';}
    else{m2.textContent='LIBRE';m2.style.color='#3B6D11';}
  }
  var blocked=CC.schedule.filter(function(b){return b.cs&&b.end<=CC.t;}).length;
  flashMetric('cc-m3',blocked);
  var done=[CC.ta,CC.tb].filter(function(t){return t.ct>0&&CC.t>=t.ct;});
  if(done.length){
    var avgWT=(done.reduce(function(s,t){return s+(t.ct-0-t.total);},0)/done.length).toFixed(2);
    flashMetric('cc-m4',avgWT);
  }
  var tEl=document.getElementById('cc-t');if(tEl)tEl.textContent=CC.t.toFixed(2);
  drawCC(dt);renderCCTable(CC.t);
  CC_BR_TIMER+=dt;
  if(CC_BR_TIMER>=0.18){
    CC_BR_TIMER=0;
    [CC.ta,CC.tb].forEach(function(th,i){
      if(!CC_BR_HISTORY[i])CC_BR_HISTORY[i]=[];
      CC_BR_HISTORY[i].push(getCCPct(th));
      if(CC_BR_HISTORY[i].length>120)CC_BR_HISTORY[i].shift();
    });
  }
  renderCCBarRace();
  drawCCSparklines();
  if(CC.playing)CC.raf=requestAnimationFrame(rafCC);
}

function drawCC(dt){
  var cssH=220;
  var cv=document.getElementById('c-cc');if(!cv||!cv.getContext)return;
  var g=setupCanvas('c-cc',cssH);var ctx=g.ctx;var cssW=g.w;
  ctx.clearRect(0,0,cssW,cssH);
  var usableW=cssW-PAD_L-PAD_R;
  var pxU=usableW/Math.max(CC.totalTime,1);
  var threads=[CC.ta,CC.tb];
  var axisY=TOP_PAD+2*(ROW_H+ROW_GAP)+4;
  var csB=CC.schedule.filter(function(b){return b.cs;});
  if(csB.length){
    var csMin=Math.min.apply(null,csB.map(function(b){return b.start;}));
    var csMax=Math.max.apply(null,csB.map(function(b){return b.end;}));
    var zx=PAD_L+csMin*pxU;var zw=(csMax-csMin)*pxU;
    ctx.fillStyle='rgba(186,117,21,.07)';ctx.fillRect(zx,0,zw,axisY+4);
    ctx.strokeStyle='rgba(186,117,21,.3)';ctx.lineWidth=1;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(zx,0);ctx.lineTo(zx,axisY+4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(zx+zw,0);ctx.lineTo(zx+zw,axisY+4);ctx.stroke();
    ctx.setLineDash([]);
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle='#BA7515';ctx.textAlign='center';
    ctx.fillText('SECCION CRITICA (Mutex)',zx+zw/2,11);
    var lockX=zx+zw/2;var lockY=axisY/2;
    var inCS2=CC.schedule.some(function(b){return b.cs&&CC.t>b.start&&CC.t<b.end;});
    ctx.fillStyle=inCS2?'rgba(163,45,45,.15)':'rgba(59,109,17,.15)';
    ctx.beginPath();ctx.arc(lockX,lockY,10,0,Math.PI*2);ctx.fill();
    ctx.font='13px Segoe UI,sans-serif';ctx.textAlign='center';
    ctx.fillText(inCS2?'\uD83D\uDD12':'\uD83D\uDD13',lockX,lockY+5);
  }
  threads.forEach(function(th,idx){
    var y=TOP_PAD+idx*(ROW_H+ROW_GAP);
    ctx.font='600 12px Segoe UI,sans-serif';ctx.fillStyle='#5a6080';ctx.textAlign='right';
    ctx.fillText(th.pid,PAD_L-6,y+ROW_H/2+4);
    ctx.fillStyle='#edf0f8';roundRect(ctx,PAD_L,y,usableW,ROW_H,5);ctx.fill();
    CC.schedule.filter(function(b){return b.pid===th.pid;}).forEach(function(b){
      if(b.start>=CC.t)return;
      var endT=Math.min(b.end,CC.t);
      var bx=PAD_L+b.start*pxU;var bw=(endT-b.start)*pxU;if(bw<=0)return;
      ctx.fillStyle=b.color;roundRect(ctx,bx,y,bw,ROW_H,4);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.18)';roundRect(ctx,bx,y,bw,ROW_H/3,4);ctx.fill();
      if(b.end>CC.t){var gr=ctx.createLinearGradient(bx+bw-10,0,bx+bw,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,.4)');ctx.fillStyle=gr;roundRect(ctx,bx+bw-10,y,10,ROW_H,0);ctx.fill();}
    });
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle='#9099b8';ctx.textAlign='left';
    ctx.fillText(th.label,4,y+ROW_H/2+4);
  });
  var pxU2=drawAxis(ctx,cssW,axisY,CC.totalTime,CC.axisFlash,'#BA7515');
  drawCursor(ctx,CC.t,pxU2,axisY,'#BA7515');
  var ccProcs=[{pid:'A',color:'#185FA5'},{pid:'B',color:'#E24B4A'}];
  if(CC.schedule.length>0){
    if(CC.t>0) updateChef(CC.chef,dt||0,CC.t,CC.schedule,ccProcs,pxU2,axisY,cssW);
    else { CC.chef.x=PAD_L; CC.chef.y=TOP_PAD-SPRITE_H-2; }
    var rb2=CC.schedule.find(function(b){return CC.t>b.start&&CC.t<b.end;});
    drawChef(ctx,CC.chef.x,CC.chef.y,rb2||{pid:'A'},CC.chef.frame,CC.chef.jumping);
  }
}

function renderCCTable(tick){
  var tbody=document.getElementById('cc-tbody');
  if(!tbody)return;
  var threads=[CC.ta,CC.tb];
  var csS=CC.schedule.filter(function(b){return b.cs;});
  var rows=threads.map(function(th){
    var done=th.ct>0&&tick>=th.ct;
    var tat=done?(th.ct-0):null;
    var wt=tat!==null?(tat-th.total):null;
    var csT=csS.filter(function(b){return b.pid===th.pid&&b.end<=tick;}).length;
    var running=CC.schedule.some(function(b){return b.pid===th.pid&&tick>b.start&&tick<b.end;});
    var dash='<span style="color:#c8ccdc">&mdash;</span>';
    var cls=running?'row-running':done?'row-done':'';
    return '<tr class="'+cls+'"><td><span class="dot" style="background:'+th.color+'"></span></td>'
      +'<td style="font-weight:600">'+th.label+'</td>'
      +'<td>'+th.total+'</td>'
      +'<td>'+(done?th.ct:dash)+'</td>'
      +'<td>'+(tat!==null?'<span style="color:#185FA5"><b>'+tat+'</b></span>':dash)+'</td>'
      +'<td>'+(wt!==null?'<span style="color:#BA7515"><b>'+wt+'</b></span>':dash)+'</td>'
      +'<td>'+(csT?'<span style="color:#BA7515;font-weight:600">'+csT+' slots</span>':dash)+'</td>'
      +'</tr>';
  }).join('');
  tbody.innerHTML=rows;
  updateCCStateDiagram(tick);
  var st=document.getElementById('cc-step'); if(st)st.textContent=Math.round(tick)+' / '+CC.totalTime;
}

/* ══════════════════════════════════════════════════════════
   TAB 3 — PARALELISMO
══════════════════════════════════════════════════════════ */
var PL={playing:false,raf:null,lastTs:null,t:0,
  cores:[],chefs:[],nCores:4,totalTime:0,
  axisFlash:{},animCells:{},prevDone:{}
};
var PL_TASKS=[
  {name:'Render frame',bt:14},{name:'Encode video',bt:18},
  {name:'Physics sim', bt:10},{name:'AI pathfind', bt:16}
];
var PL_COLORS=['#185FA5','#E24B4A','#3B6D11','#BA7515'];

function buildPLCores(){
  var sl=document.getElementById('sl-cores');
  var n=sl?+sl.value:4;
  PL.nCores=n;
  PL.cores=PL_TASKS.slice(0,n).map(function(t,i){
    return {pid:'Core '+(i+1),label:t.name,color:PL_COLORS[i%PL_COLORS.length],
            bt:t.bt,done:false,ct:-1};
  });
  PL.totalTime=Math.max.apply(null,PL.cores.map(function(c){return c.bt;}));
  PL.chefs=PL.cores.map(function(){return mkChef();});
}

function onCoresChange(){
  var v=+document.getElementById('sl-cores').value;
  var lbl=document.getElementById('lbl-cores');if(lbl)lbl.textContent=v;
  PL.nCores=v;
  resetPL();
}

function resetPL(){
  PL.playing=false;cancelAnimationFrame(PL.raf);PL.lastTs=null;PL.t=0;
  PL.axisFlash={};PL.animCells={};PL.prevDone={};
  buildPLCores();
  var btn=document.getElementById('btn-pl'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  var tEl=document.getElementById('pl-t'); if(tEl)tEl.textContent='0.00';
  flashMetric('pl-m1',PL.nCores);
  flashMetric('pl-m2','0/'+PL.nCores);
  flashMetric('pl-m3','—');
  flashMetric('pl-m4','—');
  var n=PL.cores.length;
  var cv=document.getElementById('c-pl');
  if(cv)setupCanvas('c-pl',TOP_PAD+n*(ROW_H+ROW_GAP)+AXIS_H+10);
  drawPL(0);renderPLTable(0);
  BR_HISTORY=PL.cores.map(function(){return [];});
  BR_HIST_TIMER=0;
  var area=document.getElementById('br-area');
  if(area)area.innerHTML='';
  renderBarRace();
  drawSparklines();
}

function togglePL(){
  if(PL.playing){PL.playing=false;cancelAnimationFrame(PL.raf);document.getElementById('btn-pl').innerHTML='<i class="ph ph-play"></i> Play';}
  else{
    if(PL.t>=PL.totalTime){PL.t=0;PL.chefs=PL.cores.map(function(){return mkChef();});PL.axisFlash={};PL.animCells={};PL.prevDone={};}
    PL.playing=true;PL.lastTs=null;document.getElementById('btn-pl').innerHTML='<i class="ph ph-pause"></i> Pause';
    PL.raf=requestAnimationFrame(rafPL);
  }
}

function rafPL(ts){
  if(!PL.playing)return;
  if(!PL.lastTs)PL.lastTs=ts;
  var dt=(ts-PL.lastTs)/1000;PL.lastTs=ts;
  PL.t+=dt*getSpd('pl');
  if(PL.t>=PL.totalTime){PL.t=PL.totalTime;PL.playing=false;var btn=document.getElementById('btn-pl');if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';}
  PL.cores.forEach(function(c){
    if(!c.done&&PL.t>=c.bt){c.done=true;c.ct=c.bt;axisFlashTrigger(PL.axisFlash,c.bt,'ct');}
  });
  axisFlashAdvance(PL.axisFlash,dt);
  var done=PL.cores.filter(function(c){return c.done;}).length;
  flashMetric('pl-m2',done+'/'+PL.nCores);
  var seqTime=PL.cores.reduce(function(s,c){return s+c.bt;},0);
  flashMetric('pl-m3',(seqTime/PL.totalTime).toFixed(2)+'x');
  flashMetric('pl-m4',(seqTime/(PL.totalTime*PL.nCores)*100).toFixed(0)+'%');
  var tEl=document.getElementById('pl-t');if(tEl)tEl.textContent=PL.t.toFixed(2);
  drawPL(dt);renderPLTable(PL.t);
  BR_HIST_TIMER += dt;
  if(BR_HIST_TIMER >= 0.18){
    BR_HIST_TIMER = 0;
    PL.cores.forEach(function(c,i){
      if(!BR_HISTORY[i]) BR_HISTORY[i] = [];
      BR_HISTORY[i].push(Math.round(Math.min(PL.t,c.bt)/c.bt*100));
      if(BR_HISTORY[i].length > 120) BR_HISTORY[i].shift();
    });
  }
  renderBarRace();
  drawSparklines();
  if(PL.playing)PL.raf=requestAnimationFrame(rafPL);
}

function drawPL(dt){
  var n=PL.cores.length;
  var cssH=TOP_PAD+n*(ROW_H+ROW_GAP)+AXIS_H+10;
  var cv=document.getElementById('c-pl');if(!cv||!cv.getContext)return;
  var g=setupCanvas('c-pl',cssH);var ctx=g.ctx;var cssW=g.w;
  ctx.clearRect(0,0,cssW,cssH);
  var usableW=cssW-PAD_L-PAD_R;
  var pxU=usableW/Math.max(PL.totalTime,1);
  var axisY=TOP_PAD+n*(ROW_H+ROW_GAP)+4;
  if(PL.t>0&&PL.t<PL.totalTime){
    ctx.fillStyle='rgba(59,109,17,.05)';
    ctx.fillRect(PAD_L,0,PL.t*pxU,axisY);
  }
  PL.cores.forEach(function(c,idx){
    var y=TOP_PAD+idx*(ROW_H+ROW_GAP);
    ctx.font='600 11px Segoe UI,sans-serif';ctx.fillStyle='#5a6080';ctx.textAlign='right';
    ctx.fillText('C'+(idx+1),PAD_L-6,y+ROW_H/2+4);
    ctx.fillStyle='#edf0f8';roundRect(ctx,PAD_L,y,usableW,ROW_H,5);ctx.fill();
    var endT=Math.min(c.bt,PL.t);
    if(endT>0){
      var bw=endT*pxU;
      ctx.fillStyle=c.color;roundRect(ctx,PAD_L,y,bw,ROW_H,4);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.18)';roundRect(ctx,PAD_L,y,bw,ROW_H/3,4);ctx.fill();
      if(bw>30){ctx.font='700 10px Segoe UI,sans-serif';ctx.fillStyle='rgba(255,255,255,.9)';ctx.textAlign='center';ctx.fillText(c.pid,PAD_L+bw/2,y+ROW_H/2+4,bw-6);}
      if(!c.done){var gr=ctx.createLinearGradient(PAD_L+bw-12,0,PAD_L+bw,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,.45)');ctx.fillStyle=gr;roundRect(ctx,PAD_L+bw-12,y,12,ROW_H,0);ctx.fill();}
      if(c.done){ctx.font='700 10px Segoe UI,sans-serif';ctx.fillStyle=c.color;ctx.textAlign='left';ctx.fillText('\u2713 '+c.bt+'s',PAD_L+bw+4,y+ROW_H/2+4);}
    }
    var pct=Math.round(Math.min(PL.t,c.bt)/c.bt*100);
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle='#9099b8';ctx.textAlign='left';
    ctx.fillText(c.label+' ('+pct+'%)',4,y+ROW_H/2+4);
    if(!c.done){
      var chef2=PL.chefs[idx];
      var bx2=PAD_L+endT*pxU;
      var ty2=TOP_PAD+idx*(ROW_H+ROW_GAP)-SPRITE_H-2;
      if(PL.t>0){ chef2.x+=(bx2-SPRITE_W/2-chef2.x)*0.15; chef2.y=ty2; chef2.ft+=(dt||0);if(chef2.ft>=1/8){chef2.ft=0;chef2.frame++;} }
      else { chef2.x=PAD_L; chef2.y=ty2; }
      drawSprite(ctx,chef2.x,chef2.y,getCharForPid(c.pid),chef2.frame,false);
    }
  });
  drawAxis(ctx,cssW,axisY,PL.totalTime,PL.axisFlash,'#3B6D11');
  drawCursor(ctx,PL.t,pxU,axisY,'#3B6D11');
}

function renderPLTable(tick){
  var tbody=document.getElementById('pl-tbody');
  if(!tbody)return;
  var seqTime=PL.cores.reduce(function(s,c){return s+c.bt;},0);
  var rows=PL.cores.map(function(c){
    var done=c.done&&tick>=c.bt;
    var cls=(!done&&tick>0&&tick<c.bt)?'row-running':done?'row-done':'';
    var dash='<span style="color:#c8ccdc">&mdash;</span>';
    return '<tr class="'+cls+'"><td><span class="dot" style="background:'+c.color+'"></span></td>'
      +'<td style="font-weight:600">'+c.pid+'</td>'
      +'<td style="color:#9099b8;font-size:11px">'+c.label+'</td>'
      +'<td>'+c.bt+'</td>'
      +'<td>'+(done?c.bt:dash)+'</td>'
      +'<td>'+(done?'<span style="color:#3B6D11"><b>'+c.bt+'</b></span>':dash)+'</td>'
      +'<td><span style="color:#185FA5">'+(c.bt/seqTime*100).toFixed(0)+'%</span></td>'
      +'</tr>';
  }).join('');
  if(PL.cores.every(function(c){return c.done&&tick>=c.bt;})){
    var sp=(seqTime/PL.totalTime).toFixed(2);
    rows+='<tr class="row-avg"><td colspan="5" style="text-align:right;font-size:10px;color:#9099b8">SPEEDUP</td>'
      +'<td style="color:#3B6D11">'+sp+'x</td><td style="color:#185FA5">'+PL.nCores+' cores</td></tr>';
  }
  tbody.innerHTML=rows;
}

/* ══════════════════════════════════════════════════════════
   TAB SWITCH
══════════════════════════════════════════════════════════ */
function concSwitchTab(t){
  document.querySelectorAll('.conc-sim-tab').forEach(function(el){
    el.classList.remove('active');
  });
  document.querySelectorAll('.conc-panel').forEach(function(el){el.classList.remove('active');});
  var tabBtn = document.getElementById('conc-tab-'+t);
  if(tabBtn) tabBtn.classList.add('active');
  var panel = document.getElementById('conc-panel-'+t);
  if(panel) panel.classList.add('active');
  setTimeout(function(){
    if(t==='mt'){setupCanvas('c-mt',200);drawMT(0);updateMTStateDiagram(MT.t);}
    if(t==='cc'){setupCanvas('c-cc',220);drawCC(0);updateCCStateDiagram(CC.t);}
    if(t==='pl'){var n=PL.cores.length;setupCanvas('c-pl',TOP_PAD+n*(ROW_H+ROW_GAP)+AXIS_H+10);drawPL(0);}
  },30);
}

/* ══════════════════════════════════════════════════════════
   BAR RACE + SPARKLINES
══════════════════════════════════════════════════════════ */
var BR_COLORS = ['#185FA5','#E24B4A','#3B6D11','#BA7515','#534AB7','#D4537E'];
var BR_CHAR   = ['mario','luigi','toad','yoshi','mario','luigi'];
var BR_HISTORY = [];
var BR_HIST_TIMER = 0;

function renderBarRace(){
  var area = document.getElementById('br-area');
  if(!area) return;
  var n = PL.cores.length;
  var ROW_H_BR = 42;
  area.style.height = (n * ROW_H_BR) + 'px';

  var sorted = PL.cores.slice().sort(function(a,b){
    if(a.done && !b.done) return 1;
    if(!a.done && b.done) return -1;
    return Math.min(b.bt, PL.t) / b.bt - Math.min(a.bt, PL.t) / a.bt;
  });
  sorted.forEach(function(c,rank){ c._targetRank = rank; });

  PL.cores.forEach(function(c){
    if(c._dispRank === undefined) c._dispRank = c._targetRank;
    c._dispRank += (c._targetRank - c._dispRank) * 0.18;
  });

  PL.cores.forEach(function(c){
    var rowId = 'br-row-' + c.pid.replace(/\s/g,'_');
    var row = document.getElementById(rowId);
    if(!row){
      row = document.createElement('div');
      row.id = rowId; row.className = 'br-row';
      row.style.left = '0'; row.style.right = '0'; row.style.height = '38px';
      var charIdx = PL.cores.indexOf(c);
      var charName = BR_CHAR[charIdx % BR_CHAR.length];
      row.innerHTML =
        '<div class="br-rank" id="br-rank-'+rowId+'">1</div>' +
        '<div class="br-lbl" style="color:'+c.color+'">'+c.pid+'<br>' +
        '<span style="font-size:9px;color:var(--text3);font-weight:400">'+c.label+'</span></div>' +
        '<div class="br-track">' +
          '<div class="br-fill" id="br-fill-'+rowId+'" style="background:'+c.color+'"></div>' +
          '<span class="br-val"  id="br-vali-'+rowId+'"></span>' +
        '</div>' +
        '<span class="br-val-out" id="br-valo-'+rowId+'"></span>';
      area.appendChild(row);
    }
    row.style.top = (c._dispRank * ROW_H_BR) + 'px';

    var pct = Math.round(Math.min(PL.t, c.bt) / c.bt * 100);
    var fill = document.getElementById('br-fill-' + rowId);
    if(fill) fill.style.width = pct + '%';

    var rank = sorted.indexOf(c) + 1;
    var rnkEl = document.getElementById('br-rank-' + rowId);
    if(rnkEl){ rnkEl.textContent = '#' + rank; rnkEl.style.color = rank===1 ? c.color : 'var(--text3)'; }

    var vali = document.getElementById('br-vali-' + rowId);
    var valo = document.getElementById('br-valo-' + rowId);
    var label = pct + '%' + (c.done ? ' ✓' : '');
    if(pct > 18){
      if(vali){ vali.textContent = label; vali.style.display = 'block'; }
      if(valo){ valo.style.display = 'none'; }
    } else {
      if(vali){ vali.style.display = 'none'; }
      if(valo){ valo.textContent = label; valo.style.display = 'block'; }
    }
    if(c.done){
      var lbl = row.querySelector('.br-lbl');
      if(lbl && !lbl.querySelector('.done-badge-br')){
        var b = document.createElement('span');
        b.className = 'done-badge-br';
        b.textContent = c.bt.toFixed(1) + 's';
        lbl.appendChild(b);
      }
    }
  });

  var tEl=document.getElementById('br-t');if(tEl)tEl.textContent = PL.t.toFixed(2);
}

function drawSparklines(){
  var cv = document.getElementById('c-spark');
  if(!cv || !cv.getContext) return;
  var dpr  = window.devicePixelRatio || 1;
  var cssW = cv.offsetWidth || 640;
  var cssH = 90;
  if(cv.width !== Math.round(cssW*dpr) || cv.height !== Math.round(cssH*dpr)){
    cv.width  = Math.round(cssW*dpr);
    cv.height = Math.round(cssH*dpr);
    cv.style.height = cssH + 'px';
    cv.getContext('2d').scale(dpr, dpr);
  }
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cssW, cssH);
  var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var n = PL.cores.length;
  var laneH = cssH / n;

  [25,50,75,100].forEach(function(p){
    var x = 56 + (cssW - 70) * p / 100;
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    ctx.lineWidth = 1; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cssH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px Segoe UI,sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.18)';
    ctx.textAlign = 'center';
    ctx.fillText(p+'%', x, cssH - 1);
  });

  PL.cores.forEach(function(c, i){
    var hist = BR_HISTORY[i] || [];
    var y0 = i * laneH;
    ctx.fillStyle = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.018)';
    ctx.fillRect(0, y0+1, cssW, laneH-2);
    ctx.font = '500 10px Segoe UI,sans-serif';
    ctx.fillStyle = c.color; ctx.textAlign = 'left';
    ctx.fillText(c.pid, 2, y0 + laneH/2 + 3);
    if(hist.length > 1){
      var pts = hist.length > 200 ? hist.slice(-200) : hist;
      var ptW = (cssW - 70) / pts.length;
      ctx.strokeStyle = c.color; ctx.lineWidth = 1.5;
      ctx.beginPath();
      pts.forEach(function(v, j){
        var px = 56 + j * ptW;
        var py = y0 + laneH - 2 - (v/100) * (laneH - 6);
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      var lastX = 56 + (pts.length-1)*ptW;
      var lastY = y0 + laneH - 2 - (pts[pts.length-1]/100)*(laneH-6);
      ctx.lineTo(lastX, y0+laneH-2); ctx.lineTo(56, y0+laneH-2); ctx.closePath();
      ctx.fillStyle = c.color + '22'; ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI*2); ctx.fill();
      ctx.font = '500 10px Segoe UI,sans-serif'; ctx.fillStyle = c.color;
      ctx.textAlign = 'right';
      ctx.fillText(pts[pts.length-1]+'%', cssW-2, y0+laneH/2+3);
    }
  });
}
window.addEventListener('resize', drawSparklines);

var MT_BR_HISTORY = [];
var MT_BR_TIMER   = 0;
function mtBrInit(){
  MT_BR_HISTORY = MT.processes.map(function(){ return []; });
  MT_BR_TIMER   = 0;
  var area = document.getElementById('mt-br-area');
  if(area) area.innerHTML = '';
}
function renderMTBarRace(){
  var area = document.getElementById('mt-br-area');
  if(!area) return;
  var ROW_H_BR = 42;
  var sorted = MT.processes.slice().sort(function(a,b){
    var ap = a.ct>0&&MT.t>=a.ct ? 100 : (a.firstStart>=0 ? MT.schedule.filter(function(bl){return bl.pid===a.pid&&bl.end<=MT.t;}).reduce(function(s,bl){return s+(bl.end-bl.start);},0)/a.bt*100 : 0);
    var bp = b.ct>0&&MT.t>=b.ct ? 100 : (b.firstStart>=0 ? MT.schedule.filter(function(bl){return bl.pid===b.pid&&bl.end<=MT.t;}).reduce(function(s,bl){return s+(bl.end-bl.start);},0)/b.bt*100 : 0);
    return bp - ap;
  });
  sorted.forEach(function(c,rank){ c._mtRank = rank; });
  MT.processes.forEach(function(c){
    if(c._mtDispRank===undefined) c._mtDispRank = c._mtRank||0;
    c._mtDispRank += ((c._mtRank||0) - c._mtDispRank)*0.18;
  });
  MT.processes.forEach(function(p){
    var rowId = 'mt-br-row-'+p.pid;
    var row = document.getElementById(rowId);
    if(!row){
      row = document.createElement('div'); row.id = rowId; row.className = 'br-row';
      row.innerHTML =
        '<div class="br-rank" id="mt-br-rank-'+p.pid+'"></div>'+
        '<div class="br-lbl" style="color:'+p.color+'">'+p.pid+'<br><span style="font-size:9px;color:var(--text3);font-weight:400">'+p.label+'</span></div>'+
        '<div class="br-track"><div class="br-fill" id="mt-br-fill-'+p.pid+'" style="background:'+p.color+'"></div>'+
        '<span class="br-val" id="mt-br-vi-'+p.pid+'"></span></div>'+
        '<span class="br-val-out" id="mt-br-vo-'+p.pid+'"></span>';
      area.appendChild(row);
    }
    row.style.top = (p._mtDispRank * ROW_H_BR) + 'px';
    var runSoFar = MT.schedule.filter(function(b){return b.pid===p.pid&&b.end<=MT.t;}).reduce(function(s,b){return s+(b.end-b.start);},0);
    var active = MT.schedule.find(function(b){return b.pid===p.pid&&MT.t>b.start&&MT.t<b.end;});
    if(active) runSoFar += MT.t - active.start;
    var pct = p.ct>0&&MT.t>=p.ct ? 100 : Math.min(100,Math.round(runSoFar/p.bt*100));
    var fill = document.getElementById('mt-br-fill-'+p.pid); if(fill) fill.style.width = pct+'%';
    var rank = sorted.indexOf(p)+1;
    var rnk = document.getElementById('mt-br-rank-'+p.pid); if(rnk){rnk.textContent='#'+rank;rnk.style.color=rank===1?p.color:'var(--text3)';}
    var vi = document.getElementById('mt-br-vi-'+p.pid);
    var vo = document.getElementById('mt-br-vo-'+p.pid);
    var lbl = pct+'%'+(p.ct>0&&MT.t>=p.ct?' ✓':'');
    if(pct>18){if(vi){vi.textContent=lbl;vi.style.display='block';}if(vo)vo.style.display='none';}
    else{if(vi)vi.style.display='none';if(vo){vo.textContent=lbl;vo.style.display='block';}}
  });
  var tEl = document.getElementById('mt-br-t'); if(tEl) tEl.textContent = MT.t.toFixed(2);
}
function drawMTSparklines(){
  var cv = document.getElementById('mt-spark'); if(!cv||!cv.getContext)return;
  var dpr=window.devicePixelRatio||1, cssW=cv.offsetWidth||640, cssH=75;
  if(cv.width!==Math.round(cssW*dpr)||cv.height!==Math.round(cssH*dpr)){
    cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssH*dpr);cv.style.height=cssH+'px';cv.getContext('2d').scale(dpr,dpr);
  }
  var ctx=cv.getContext('2d'); ctx.clearRect(0,0,cssW,cssH);
  var n=MT.processes.length, laneH=cssH/n;
  [25,50,75,100].forEach(function(p){
    var x=56+(cssW-70)*p/100; ctx.strokeStyle='rgba(0,0,0,.04)';ctx.lineWidth=1;ctx.setLineDash([2,4]);
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cssH);ctx.stroke();ctx.setLineDash([]);
    ctx.font='9px Segoe UI,sans-serif';ctx.fillStyle='rgba(0,0,0,.15)';ctx.textAlign='center';ctx.fillText(p+'%',x,cssH-1);
  });
  MT.processes.forEach(function(p,i){
    var hist=MT_BR_HISTORY[i]||[]; var y0=i*laneH;
    ctx.fillStyle='rgba(0,0,0,.015)';ctx.fillRect(0,y0+1,cssW,laneH-2);
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle=p.color;ctx.textAlign='left';ctx.fillText(p.pid,2,y0+laneH/2+3);
    if(hist.length>1){
      var pts=hist.length>200?hist.slice(-200):hist; var ptW=(cssW-70)/pts.length;
      ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.beginPath();
      pts.forEach(function(v,j){ var px=56+j*ptW,py=y0+laneH-2-(v/100)*(laneH-6); j===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.stroke();
      var lx=56+(pts.length-1)*ptW,ly=y0+laneH-2-(pts[pts.length-1]/100)*(laneH-6);
      ctx.lineTo(lx,y0+laneH-2);ctx.lineTo(56,y0+laneH-2);ctx.closePath();ctx.fillStyle=p.color+'22';ctx.fill();
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);ctx.fill();
      ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle=p.color;ctx.textAlign='right';ctx.fillText(pts[pts.length-1]+'%',cssW-2,y0+laneH/2+3);
    }
  });
}

var CC_BR_HISTORY = [[],[]];
var CC_BR_TIMER   = 0;
function ccBrInit(){
  CC_BR_HISTORY = [[],[]];
  CC_BR_TIMER   = 0;
  var area = document.getElementById('cc-br-area');
  if(area) area.innerHTML = '';
}
function getCCPct(th){
  var blocks = CC.schedule.filter(function(b){return b.pid===th.pid&&b.end<=CC.t;});
  var run = blocks.reduce(function(s,b){return s+(b.end-b.start);},0);
  var act = CC.schedule.find(function(b){return b.pid===th.pid&&CC.t>b.start&&CC.t<b.end;});
  if(act) run += CC.t - act.start;
  return th.ct>0&&CC.t>=th.ct ? 100 : Math.min(100,Math.round(run/th.total*100));
}
function renderCCBarRace(){
  var area = document.getElementById('cc-br-area'); if(!area)return;
  var threads = [CC.ta, CC.tb];
  var ROW_H_BR = 42;
  threads.forEach(function(th,i){
    var rowId = 'cc-br-row-'+th.pid;
    var row = document.getElementById(rowId);
    if(!row){
      row = document.createElement('div'); row.id=rowId; row.className='br-row';
      row.style.position='absolute';row.style.left='0';row.style.right='0';row.style.height='38px';
      row.style.top = (i*ROW_H_BR)+'px';
      row.innerHTML =
        '<div class="br-rank" style="color:'+th.color+'">#'+(i+1)+'</div>'+
        '<div class="br-lbl" style="color:'+th.color+'">'+th.label+'</div>'+
        '<div class="br-track"><div class="br-fill" id="cc-br-fill-'+th.pid+'" style="background:'+th.color+'"></div>'+
        '<span class="br-val" id="cc-br-vi-'+th.pid+'"></span></div>'+
        '<span class="br-val-out" id="cc-br-vo-'+th.pid+'"></span>';
      area.appendChild(row);
    }
    var pct = getCCPct(th);
    var fill=document.getElementById('cc-br-fill-'+th.pid);if(fill)fill.style.width=pct+'%';
    var vi=document.getElementById('cc-br-vi-'+th.pid);
    var vo=document.getElementById('cc-br-vo-'+th.pid);
    var lbl=pct+'%'+(th.ct>0&&CC.t>=th.ct?' ✓':'');
    if(pct>18){if(vi){vi.textContent=lbl;vi.style.display='block';}if(vo)vo.style.display='none';}
    else{if(vi)vi.style.display='none';if(vo){vo.textContent=lbl;vo.style.display='block';}}
  });
  var tEl=document.getElementById('cc-br-t');if(tEl)tEl.textContent=CC.t.toFixed(2);
}
function drawCCSparklines(){
  var cv=document.getElementById('cc-spark');if(!cv||!cv.getContext)return;
  var dpr=window.devicePixelRatio||1,cssW=cv.offsetWidth||640,cssH=60;
  if(cv.width!==Math.round(cssW*dpr)||cv.height!==Math.round(cssH*dpr)){
    cv.width=Math.round(cssW*dpr);cv.height=Math.round(cssH*dpr);cv.style.height=cssH+'px';cv.getContext('2d').scale(dpr,dpr);
  }
  var ctx=cv.getContext('2d');ctx.clearRect(0,0,cssW,cssH);
  var threads=[CC.ta,CC.tb],n=2,laneH=cssH/n;
  [25,50,75,100].forEach(function(p){
    var x=56+(cssW-70)*p/100;ctx.strokeStyle='rgba(0,0,0,.04)';ctx.lineWidth=1;ctx.setLineDash([2,4]);
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cssH);ctx.stroke();ctx.setLineDash([]);
    ctx.font='9px Segoe UI,sans-serif';ctx.fillStyle='rgba(0,0,0,.15)';ctx.textAlign='center';ctx.fillText(p+'%',x,cssH-1);
  });
  threads.forEach(function(th,i){
    var hist=CC_BR_HISTORY[i]||[];var y0=i*laneH;
    ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle=th.color;ctx.textAlign='left';ctx.fillText(th.label,2,y0+laneH/2+3);
    if(hist.length>1){
      var pts=hist.length>200?hist.slice(-200):hist,ptW=(cssW-70)/pts.length;
      ctx.strokeStyle=th.color;ctx.lineWidth=1.5;ctx.beginPath();
      pts.forEach(function(v,j){var px=56+j*ptW,py=y0+laneH-2-(v/100)*(laneH-6);j===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});
      ctx.stroke();
      var lx=56+(pts.length-1)*ptW,ly=y0+laneH-2-(pts[pts.length-1]/100)*(laneH-6);
      ctx.lineTo(lx,y0+laneH-2);ctx.lineTo(56,y0+laneH-2);ctx.closePath();ctx.fillStyle=th.color+'22';ctx.fill();
      ctx.fillStyle=th.color;ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);ctx.fill();
      ctx.font='500 10px Segoe UI,sans-serif';ctx.fillStyle=th.color;ctx.textAlign='right';ctx.fillText(pts[pts.length-1]+'%',cssW-2,y0+laneH/2+3);
    }
  });
}

function concStepMT() {
  MT.playing=false; cancelAnimationFrame(MT.raf);
  var btn=document.getElementById('btn-mt'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  MT.t = Math.min(Math.floor(MT.t)+1, MT.totalTime);
  var tEl=document.getElementById('mt-t'); if(tEl)tEl.textContent = MT.t.toFixed(2);
  drawMT(0); renderMTTable(MT.t); renderMTBarRace(); drawMTSparklines();
  updateMTStateDiagram(MT.t);
}
function concStepCC() {
  CC.playing=false; cancelAnimationFrame(CC.raf);
  var btn=document.getElementById('btn-cc'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  CC.t = Math.min(Math.floor(CC.t)+1, CC.totalTime);
  var tEl=document.getElementById('cc-t'); if(tEl)tEl.textContent = CC.t.toFixed(2);
  drawCC(0); renderCCTable(CC.t); renderCCBarRace(); drawCCSparklines();
  updateCCStateDiagram(CC.t);
}
function concStepPL() {
  PL.playing=false; cancelAnimationFrame(PL.raf);
  var btn=document.getElementById('btn-pl'); if(btn)btn.innerHTML='<i class="ph ph-play"></i> Play';
  PL.t = Math.min(Math.floor(PL.t)+1, PL.totalTime);
  var tEl=document.getElementById('pl-t'); if(tEl)tEl.textContent = PL.t.toFixed(2);
  drawPL(0); renderPLTable(PL.t); renderBarRace(); drawSparklines();
}

function updateMTStateDiagram(tick) {
  var rb = MT.schedule.find(function(b){ return tick>b.start && tick<b.end; });
  var running = rb ? rb.pid : null;
  var ready=[], done=[], notArr=[];
  MT.processes.forEach(function(p){
    if(p.at > tick) notArr.push(p.pid);
    else if(p.ct>0 && tick>=p.ct) done.push(p.pid);
    else if(p.pid!==running) ready.push(p.pid);
  });
  function chip(pid,col){ return '<span class="queue-chip" style="background:'+col+';font-size:10px;padding:2px 7px;border-radius:4px;color:#0f1117;font-weight:600;margin:2px;">'+pid+'</span>'; }
  var newEl=document.getElementById('mt-state-new');
  var rdEl =document.getElementById('mt-state-ready');
  var ruEl =document.getElementById('mt-state-running');
  var dnEl =document.getElementById('mt-state-done');
  if(newEl) newEl.innerHTML = notArr.length ? notArr.join(', ') : '—';
  if(rdEl)  rdEl.innerHTML  = ready.length  ? ready.map(function(p){return chip(p,'var(--state-ready)');}).join('') : '—';
  if(ruEl)  ruEl.innerHTML  = running ? chip(running,'var(--state-running)') : 'IDLE';
  if(dnEl)  dnEl.innerHTML  = done.length   ? done.join(', ') : '—';
  var cpuEl=document.getElementById('mt-cpu-pid');
  if(cpuEl) cpuEl.textContent = running || 'IDLE';
  var qEl=document.getElementById('mt-queue');
  if(qEl) qEl.innerHTML = ready.length
    ? ready.map(function(p){return chip(p,'var(--state-ready)');}).join('')
    : '<span class="queue-empty">vacía</span>';
}

function updateCCStateDiagram(tick) {
  var rb = CC.schedule.find(function(b){ return tick>b.start && tick<b.end; });
  var runningPid = rb ? rb.pid : null;
  var runningLabel = runningPid==='A'?'Thread A': runningPid==='B'?'Thread B':null;
  var ready=[], done=[];
  [CC.ta, CC.tb].forEach(function(th){
    var lbl = th.pid==='A'?'Thread A':'Thread B';
    if(th.ct>0&&tick>=th.ct) done.push(lbl);
    else if(lbl!==runningLabel) ready.push(lbl);
  });
  function chip(lbl,col){ return '<span class="queue-chip" style="background:'+col+';font-size:10px;padding:2px 7px;border-radius:4px;color:#0f1117;font-weight:600;margin:2px;">'+lbl+'</span>'; }
  var rdEl =document.getElementById('cc-state-ready');
  var ruEl =document.getElementById('cc-state-running');
  var dnEl =document.getElementById('cc-state-done');
  if(rdEl) rdEl.innerHTML  = ready.length  ? ready.map(function(l){return chip(l,'var(--state-ready)');}).join('') : '—';
  if(ruEl) ruEl.innerHTML  = runningLabel  ? chip(runningLabel,'var(--state-running)') : 'IDLE';
  if(dnEl) dnEl.innerHTML  = done.length   ? done.join(', ') : '—';
  var cpuEl=document.getElementById('cc-cpu-pid');
  if(cpuEl) cpuEl.textContent = runningLabel || 'IDLE';
  var qEl=document.getElementById('cc-queue');
  if(qEl) qEl.innerHTML = ready.length
    ? ready.map(function(l){return chip(l,'var(--state-ready)');}).join('')
    : '<span class="queue-empty">vacía</span>';
}

document.addEventListener('DOMContentLoaded', function() {
  var concInited = false;
  var navBtn = document.getElementById('nav-concurrency');
  if(navBtn) {
    navBtn.addEventListener('click', function() {
      if(!concInited) {
        concInited = true;
        setTimeout(function(){
          buildMTSchedule(); buildCCSchedule(); buildPLCores();
          drawMT(0); drawCC(0); drawPL(0);
          mtBrInit(); renderMTBarRace(); drawMTSparklines();
          ccBrInit(); renderCCBarRace(); drawCCSparklines();
          renderBarRace(); drawSparklines();
          updateMTStateDiagram(0); updateCCStateDiagram(0);
        }, 80);
      } else {
        setTimeout(function(){
          drawMT(0); drawCC(0); drawPL(0);
          renderMTBarRace(); drawMTSparklines();
          renderCCBarRace(); drawCCSparklines();
          renderBarRace(); drawSparklines();
        }, 40);
      }
    });
  }
});

(function addBrStyles(){
  var s = document.createElement('style');
  s.textContent = '.br-row{position:absolute;left:0;right:0;height:42px;display:flex;align-items:center;gap:0;transition:top .14s ease}'
    + '.br-rank{width:24px;font-size:10px;font-weight:600;text-align:center;flex-shrink:0}'
    + '.br-lbl{width:72px;font-size:11px;font-weight:600;flex-shrink:0;line-height:1.3;overflow:hidden}'
    + '.br-track{flex:1;height:30px;border-radius:4px;position:relative;overflow:hidden}'
    + '.br-fill{position:absolute;left:0;top:0;height:100%;border-radius:4px; transition: width 0.2s}'
    + '.br-val{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:600;color:rgba(255,255,255,.92);white-space:nowrap}'
    + '.br-val-out{position:absolute;left:calc(100% + 5px);top:50%;transform:translateY(-50%);font-size:11px;font-weight:600;white-space:nowrap}'
    + '.done-badge-br{font-size:10px;font-weight:500;padding:1px 6px;border-radius:8px;margin-left:4px}'
    + '.conc-pill-nav { display: flex; align-items: center; justify-content: center; background: rgba(30,27,75,0.4); border-radius: 40px; padding: 6px; margin: 0 auto 24px auto; width: fit-content; gap: 8px; border: 1px solid rgba(255,255,255,0.05); }'
    + '.conc-pill-tab { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 30px; color: #a1a1aa; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; background: transparent; border: none; outline: none; }'
    + '.conc-pill-tab:hover { color: #f4f4f5; }'
    + '.conc-pill-tab.active { background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #ffffff; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4); }'
    + '.conc-panel { display: none; }'
    + '.conc-panel.active { display: block; animation: fadeIn 0.3s; }'
    + '@keyframes fadeIn { from {opacity: 0; transform: translateY(5px);} to {opacity: 1; transform: translateY(0);} }';
  document.head.appendChild(s);
})();
