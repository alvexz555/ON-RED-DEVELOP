/* ON RED · FASE 2
 * Runtime isolado. Não altera o motor nem os sistemas da Fase 1.
 * Os valores em TUNING são parâmetros iniciais de playtest.
 */
(() => {
  "use strict";
  const canvas = document.getElementById("gameCanvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const TUNING = Object.freeze({
    maxHP: 80, lives: 4, energyPerZone: 25, maxEnergy: 100,
    dashCost: 25, dashDuration: 0.22, dashCooldown: 1.15,
    playerSpeed: 245, playerRadius: 12, sawCount: 4,
    sawSpeed: 65, sawDamage: 20, sawRadius: 19,
    laserWarning: 1.15, laserActive: 0.72, laserInterval: 6.5,
    mergeHeal: 25, mergeScore: 1000, mergeInterval: 7,
    bossTriggerSeconds: 105, bossHP: 1200, bossDashDamage: 180
  });
  const keys = new Set();
  const state = {
    active: false, paused: false, over: false, victory: false,
    time: 0, score: 0, hp: TUNING.maxHP, lives: TUNING.lives,
    energy: 0, dashCooldown: 0, dashTime: 0, dashCharged: false, invuln: 0,
    x: 0, y: 0, vx: 0, vy: 0, last: 0,
    saws: [], zones: [], merges: [], laser: null,
    laserTimer: 2.5, zoneTimer: 1, mergeTimer: 3,
    boss: null, pointer: null, pointerId: null,
    message: "", messageTimer: 0, best: 0
  };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rand = (a,b) => a + Math.random()*(b-a);
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const arena = () => ({ w: canvas.width, h: canvas.height });
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(innerWidth*dpr);
    canvas.height = Math.floor(innerHeight*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    state.x = clamp(state.x || innerWidth/2,20,innerWidth-20);
    state.y = clamp(state.y || innerHeight/2,20,innerHeight-20);
  }
  function reset() {
    state.active=true; state.paused=false; state.over=false; state.victory=false;
    state.time=0; state.score=0; state.hp=TUNING.maxHP; state.lives=TUNING.lives;
    state.energy=0; state.dashCooldown=0; state.dashTime=0; state.dashCharged=false; state.invuln=1.2;
    state.x=innerWidth/2; state.y=innerHeight/2; state.vx=0; state.vy=0;
    state.saws=[]; state.zones=[]; state.merges=[]; state.laser=null;
    state.laserTimer=2.5; state.zoneTimer=1; state.mergeTimer=3; state.boss=null;
    state.message="CARREGUE ENERGIA. SOBREVIVA."; state.messageTimer=2.5;
    for(let i=0;i<TUNING.sawCount;i++) spawnSaw();
    state.last=0;
    try { state.best=Number(localStorage.getItem("onRedPhase2Best")||0)||0; } catch(e) { state.best=0; }
  }
  function spawnSaw() {
    const side=Math.floor(Math.random()*4), pad=28;
    const x=side===0?pad:side===1?innerWidth-pad:rand(pad,innerWidth-pad);
    const y=side===2?pad:side===3?innerHeight-pad:rand(pad,innerHeight-pad);
    state.saws.push({x,y,r:TUNING.sawRadius,angle:rand(0,6.28),hp:1,stun:0});
  }
  function spawnZone() {
    state.zones.push({x:rand(45,innerWidth-45),y:rand(80,innerHeight-65),r:22,life:9});
    if(state.zones.length>3) state.zones.shift();
  }
  function spawnMerge() {
    state.merges.push({x:rand(40,innerWidth-40),y:rand(75,innerHeight-50),r:10,life:12});
    if(state.merges.length>3) state.merges.shift();
  }
  function damage(amount) {
    if(state.invuln>0 || state.over || state.victory) return;
    state.hp=Math.max(0,state.hp-amount); state.invuln=0.9;
    if(state.hp===0) {
      state.lives--;
      if(state.lives<=0) { state.over=true; state.message="GAME OVER"; }
      else { state.hp=TUNING.maxHP; state.invuln=1.8; state.x=innerWidth/2; state.y=innerHeight/2; state.message="VIDA PERDIDA"; state.messageTimer=1.5; }
    }
  }
  function startDash() {
    if(!state.active || state.paused || state.over || state.victory || state.dashCooldown>0 || state.energy<TUNING.dashCost) return;
    state.dashCharged=state.energy>=100; state.energy-=TUNING.dashCost; state.dashTime=TUNING.dashDuration; state.dashCooldown=TUNING.dashCooldown;
    const len=Math.hypot(state.vx,state.vy);
    if(len>0){state.vx=state.vx/len*760;state.vy=state.vy/len*760;}
    else {state.vx=0;state.vy=-760;}
    state.invuln=Math.max(state.invuln, TUNING.dashDuration+0.08);
  }
  function beginBoss() {
    if(state.boss) return;
    state.boss={x:innerWidth/2,y:Math.max(100,innerHeight*0.25),r:58,hp:TUNING.bossHP,maxHP:TUNING.bossHP,angle:0};
    state.saws=[]; state.message="SERRA GIGANTE · 100% DE ENERGIA PARA ATACAR"; state.messageTimer=4;
  }
  function update(dt) {
    if(!state.active || state.paused || state.over || state.victory) return;
    state.time+=dt; state.score+=Math.floor(dt*100);
    state.invuln=Math.max(0,state.invuln-dt); state.dashCooldown=Math.max(0,state.dashCooldown-dt);
    state.dashTime=Math.max(0,state.dashTime-dt); state.messageTimer=Math.max(0,state.messageTimer-dt);
    let ix=(keys.has("ArrowRight")||keys.has("KeyD")?1:0)-(keys.has("ArrowLeft")||keys.has("KeyA")?1:0);
    let iy=(keys.has("ArrowDown")||keys.has("KeyS")?1:0)-(keys.has("ArrowUp")||keys.has("KeyW")?1:0);
    if(state.pointer){ix=clamp((state.pointer.x-state.pointer.ox)/42,-1,1);iy=clamp((state.pointer.y-state.pointer.oy)/42,-1,1);}
    const il=Math.hypot(ix,iy)||1;
    if(state.dashTime<=0){state.vx=(ix/il)*TUNING.playerSpeed;state.vy=(iy/il)*TUNING.playerSpeed;}
    state.x=clamp(state.x+state.vx*dt,TUNING.playerRadius,innerWidth-TUNING.playerRadius);
    state.y=clamp(state.y+state.vy*dt,TUNING.playerRadius,innerHeight-TUNING.playerRadius);
    if(state.dashTime<=0){state.vx*=Math.pow(0.001,dt);state.vy*=Math.pow(0.001,dt);}
    state.zoneTimer-=dt; if(state.zoneTimer<=0){spawnZone();state.zoneTimer=7.5;}
    state.mergeTimer-=dt; if(state.mergeTimer<=0){spawnMerge();state.mergeTimer=TUNING.mergeInterval;}
    state.laserTimer-=dt;
    if(!state.laser && state.laserTimer<=0) state.laser={axis:Math.random()<0.5?"h":"v",at:rand(innerWidth*.25,innerWidth*.75),gap:rand(0.25,0.75),phase:"warning",t:TUNING.laserWarning};
    if(state.laser){
      state.laser.t-=dt;
      if(state.laser.t<=0 && state.laser.phase==="warning"){state.laser.phase="active";state.laser.t=TUNING.laserActive;}
      else if(state.laser.t<=0){state.laser=null;state.laserTimer=TUNING.laserInterval;}
      if(state.laser?.phase==="active"){
        const l=state.laser, span=l.axis==="h"?innerWidth:innerHeight;
        const along=l.axis==="h"?state.x:state.y;
        const gapStart=l.gap*span-55;
        const insideGap=along>=gapStart && along<=gapStart+110;
        const onBeam=l.axis==="h"?Math.abs(state.y-l.at)<13:Math.abs(state.x-l.at)<13;
        if(onBeam && !insideGap) damage(20*dt);
      }
    }
    for(const z of state.zones){z.life-=dt;if(dist(z,state)<z.r+TUNING.playerRadius){state.energy=clamp(state.energy+TUNING.energyPerZone,0,100);z.life=0;state.message="ENERGIA +25%";state.messageTimer=0.8;}}
    state.zones=state.zones.filter(z=>z.life>0);
    for(const m of state.merges){m.life-=dt;if(dist(m,state)<m.r+TUNING.playerRadius){state.hp=clamp(state.hp+TUNING.mergeHeal,0,TUNING.maxHP);state.score+=TUNING.mergeScore;m.life=0;state.message="MERGE · +25 HP · +1000";state.messageTimer=1.1;}}
    state.merges=state.merges.filter(m=>m.life>0);
    for(const s of state.saws){
      s.angle+=dt*4; s.stun=Math.max(0,s.stun-dt);
      if(s.stun<=0){const d=dist(s,state)||1;s.x+=(state.x-s.x)/d*TUNING.sawSpeed*dt;s.y+=(state.y-s.y)/d*TUNING.sawSpeed*dt;}
      if(dist(s,state)<s.r+TUNING.playerRadius){if(state.dashTime>0){s.stun=1.2;s.hp=0;state.score+=500;state.energy=clamp(state.energy+10,0,100);}else damage(TUNING.sawDamage*dt);}
    }
    state.saws=state.saws.filter(s=>s.hp>0);
    while(state.saws.length<TUNING.sawCount && !state.boss) spawnSaw();
    if(!state.boss && state.time>=TUNING.bossTriggerSeconds) beginBoss();
    if(state.boss){
      const b=state.boss;b.angle+=dt*0.65;
      const d=dist(b,state)||1;b.x+=(state.x-b.x)/d*22*dt;b.y+=(state.y-b.y)/d*22*dt;
      if(dist(b,state)<b.r+TUNING.playerRadius && state.dashTime<=0) damage(25*dt);
      if(state.dashTime>0 && state.dashCharged && dist(b,state)<b.r+42){
        state.dashCharged=false; state.energy=0;
        b.hp=Math.max(0,b.hp-TUNING.bossDashDamage);
        if(b.hp===0){state.victory=true;state.message="FASE 2 CONCLUÍDA";try{localStorage.setItem("onRedPhase3Unlocked","true");}catch(e){}}
      }
    }
  }
  function drawSaw(s) {
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);ctx.fillStyle="#168BFF";ctx.strokeStyle="#9BD8FF";ctx.lineWidth=2;
    ctx.beginPath();for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?s.r*.72:s.r;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function draw() {
    const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle="#080B12";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="rgba(60,145,210,.08)";ctx.lineWidth=1;for(let x=0;x<w;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(const z of state.zones){ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fillStyle="rgba(22,139,255,.18)";ctx.fill();ctx.strokeStyle="#58BFFF";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#FFF";ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.fillText("+25",z.x,z.y+4);}
    for(const m of state.merges){ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,Math.PI*2);ctx.fillStyle="#FF3948";ctx.shadowColor="#FF3948";ctx.shadowBlur=15;ctx.fill();ctx.shadowBlur=0;}
    if(state.laser){
      const l=state.laser, span=l.axis==="h"?w:h, gapStart=l.gap*span-55, gapEnd=gapStart+110;
      ctx.save();ctx.strokeStyle=l.phase==="warning"?"rgba(255,57,72,.55)":"#FF3948";
      ctx.lineWidth=l.phase==="warning"?2:14;ctx.setLineDash(l.phase==="warning"?[8,8]:[]);
      ctx.beginPath();
      if(l.axis==="h"){ctx.moveTo(0,l.at);ctx.lineTo(gapStart,l.at);ctx.moveTo(gapEnd,l.at);ctx.lineTo(w,l.at);}
      else{ctx.moveTo(l.at,0);ctx.lineTo(l.at,gapStart);ctx.moveTo(l.at,gapEnd);ctx.lineTo(l.at,h);}
      ctx.stroke();ctx.restore();
      ctx.fillStyle="#58BFFF";ctx.font="bold 10px Arial";ctx.textAlign="center";
      if(l.axis==="h")ctx.fillText("BRECHA SEGURA",clamp((gapStart+gapEnd)/2,65,w-65),l.at-12);
      else ctx.fillText("BRECHA SEGURA",l.at+58,clamp((gapStart+gapEnd)/2,50,h-50));
    }
    state.saws.forEach(drawSaw);
    if(state.boss){const b=state.boss;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);ctx.fillStyle="#168BFF";ctx.strokeStyle="#9BD8FF";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-b.r);ctx.lineTo(b.r*.92,b.r*.72);ctx.lineTo(-b.r*.92,b.r*.72);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle="#263648";ctx.fillRect(w*.2,20,w*.6,8);ctx.fillStyle="#168BFF";ctx.fillRect(w*.2,20,w*.6*(b.hp/b.maxHP),8);ctx.fillStyle="#FFF";ctx.font="bold 11px Arial";ctx.textAlign="center";ctx.fillText("SERRA GIGANTE",w/2,15);}
    ctx.beginPath();ctx.arc(state.x,state.y,TUNING.playerRadius,0,Math.PI*2);ctx.fillStyle=state.energy>=100?"#FFFFFF":`rgb(255,${Math.round(57+198*state.energy/100)},${Math.round(72+183*state.energy/100)})`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=state.dashTime>0?24:10;ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#FFF";ctx.font="bold 12px Arial";ctx.textAlign="left";ctx.fillText("HP "+Math.ceil(state.hp)+"/80",18,24);ctx.fillText("VIDAS "+state.lives,18,43);ctx.fillText("ENERGIA "+Math.floor(state.energy)+"%",18,62);ctx.fillText("SCORE "+Math.floor(state.score),18,81);
    ctx.fillStyle="#253448";ctx.fillRect(18,91,120,5);ctx.fillStyle="#168BFF";ctx.fillRect(18,91,120*state.energy/100,5);
    ctx.textAlign="right";ctx.fillStyle="#FFF";ctx.fillText("DASH "+(state.dashCooldown>0?state.dashCooldown.toFixed(1)+"s":state.energy>=25?"PRONTO":"25% ENERGIA"),w-18,24);
    if(state.messageTimer>0){ctx.textAlign="center";ctx.font="bold 13px Arial";ctx.fillStyle="#FFF";ctx.fillText(state.message,w/2,h*.17);}
    if(state.paused||state.over||state.victory){ctx.fillStyle="rgba(0,0,0,.76)";ctx.fillRect(0,0,w,h);ctx.textAlign="center";ctx.fillStyle="#FFF";ctx.font="900 28px Arial";ctx.fillText(state.paused?"PAUSADO":state.victory?"FASE 2 CONCLUÍDA":"GAME OVER",w/2,h/2-28);ctx.font="bold 13px Arial";ctx.fillStyle="#58BFFF";ctx.fillText("Toque para "+(state.paused?"continuar":"reiniciar"),w/2,h/2+8);ctx.fillText("ESC para voltar ao menu",w/2,h/2+32);}
    if("ontouchstart" in window){ctx.textAlign="left";ctx.fillStyle="rgba(255,255,255,.55)";ctx.font="10px Arial";ctx.fillText("JOYSTICK",24,h-22);ctx.textAlign="right";ctx.fillText("DASH",w-24,h-22);ctx.beginPath();ctx.arc(w-52,h-58,30,0,Math.PI*2);ctx.strokeStyle="rgba(88,191,255,.55)";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="rgba(88,191,255,.16)";ctx.fill();}
  }
  function frame(ts){if(!state.active)return;const dt=state.last?Math.min((ts-state.last)/1000,.04):0;state.last=ts;update(dt);draw();requestAnimationFrame(frame);}
  function launch(){reset();document.getElementById("mainMenu")?.classList.add("hidden");requestAnimationFrame(frame);}
  document.getElementById("phaseTwoButton")?.addEventListener("click",launch);
  function exit(){state.active=false;state.paused=false;keys.clear();state.pointer=null;document.getElementById("mainMenu")?.classList.remove("hidden");}
  window.addEventListener("keydown",e=>{if(!state.active)return;keys.add(e.code);if(e.code==="ShiftLeft"||e.code==="ShiftRight")startDash();if(e.code==="Escape"){e.preventDefault();if(state.over||state.victory)exit();else state.paused=!state.paused;}if((state.over||state.victory)&&e.code==="Enter")launch();});
  window.addEventListener("keyup",e=>keys.delete(e.code));
  canvas.addEventListener("pointerdown",e=>{if(!state.active)return;if(state.over||state.victory){launch();return;}if(state.paused){state.paused=false;state.last=0;return;}if(e.clientX>innerWidth*.65&&e.clientY>innerHeight*.55){startDash();return;}if(e.clientX<innerWidth*.55&&e.clientY>innerHeight*.48){state.pointerId=e.pointerId;state.pointer={ox:e.clientX,oy:e.clientY,x:e.clientX,y:e.clientY};}});
  canvas.addEventListener("pointermove",e=>{if(state.active&&state.pointerId===e.pointerId&&state.pointer){state.pointer.x=e.clientX;state.pointer.y=e.clientY;}});
  const release=e=>{if(state.pointerId===e.pointerId){state.pointer=null;state.pointerId=null;}};
  canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
  window.addEventListener("resize",resize);resize();
  window.ONREDPhase2Game={start:launch,exit,getState:()=>({...state,saws:state.saws.length,zones:state.zones.length,merges:state.merges.length})};
})();