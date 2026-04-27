// ================================================================
// TIMER
// ================================================================
function elapsedSecs(){
  if(!activeTimer)return 0;
  const now=new Date();
  if(activeTimer.status==='paused')return Math.floor((activeTimer.pausedAt-activeTimer.startedAt)/1000)-activeTimer.totalPausedSecs;
  return Math.floor((now-activeTimer.startedAt)/1000)-activeTimer.totalPausedSecs;
}

async function startTaskTimer(taskId,e,fromDetail=false){
  if(e)e.stopPropagation();
  if(activeTimer&&activeTimer.userCode===CU){chirp("Finish your current timer first.");return;}
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  const timerId='tmr_'+Date.now();
  activeTimer={id:timerId,taskId,msId:null,userCode:CU,startedAt:new Date(),pausedAt:null,totalPausedSecs:0,estimateSecs:hToSecs(getEffectiveTime(task)),label:task.title,status:'running'};
  startTimerInterval();
  try{await api('bravochore_timers','POST',[{id:timerId,task_id:taskId,milestone_id:null,user_code:CU,started_at:activeTimer.startedAt.toISOString(),total_paused_seconds:0,status:'running'}]);}catch(e){}
  rerender();
}

async function startMsTimer(msId,taskId){
  if(activeTimer&&activeTimer.userCode===CU){chirp("Finish your current timer first.");return;}
  const ms=milestones.find(m=>m.id===msId);if(!ms)return;
  const timerId='tmr_'+Date.now();
  activeTimer={id:timerId,taskId,msId,userCode:CU,startedAt:new Date(),pausedAt:null,totalPausedSecs:0,estimateSecs:hToSecs(ms.time_hours),label:ms.title,status:'running'};
  startTimerInterval();
  try{await api('bravochore_timers','POST',[{id:timerId,task_id:taskId,milestone_id:msId,user_code:CU,started_at:activeTimer.startedAt.toISOString(),total_paused_seconds:0,status:'running'}]);}catch(e){}
  const task=tasks.find(t=>t.id===taskId);
  if(task&&dpTaskId===taskId)renderDpBody(task,getMs(taskId));
}


function toggleTimerExpand(){
  const strip=document.getElementById('timer-strip');
  const hint=document.getElementById('ts-hint');
  if(!strip)return;
  strip.classList.toggle('expanded');
  if(hint)hint.textContent=strip.classList.contains('expanded')?'▴':'▾';
}
let alarmInterval=null;
function stopAlarm(){clearInterval(alarmInterval);alarmInterval=null;}
function startAlarm(){
  stopAlarm();
  let beat=0;
  alarmInterval=setInterval(()=>{
    playChime(beat%3===0?'task':'ms');
    beat++;
    if(beat>12)stopAlarm(); // stop after ~8 seconds
  },650);
}
function startTimerInterval(){
  clearInterval(timerInterval);
  timerSessions=[];
  document.getElementById('timer-strip').classList.add('visible');
  timerInterval=setInterval(()=>{
    if(!activeTimer||activeTimer.status==='paused')return;
    const el=elapsedSecs();const rem=activeTimer.estimateSecs-el;
    document.getElementById('ts-label').textContent=activeTimer.label;
    const fl=document.getElementById('ts-full-label');
    if(fl)fl.textContent=activeTimer.label;
    const tt=document.getElementById('ts-time');tt.textContent=fmtSecs(el);
    const wasOver=tt.classList.contains('over');
    tt.className='ts-time'+(rem<0?' over':'');
    if(rem<0&&!wasOver&&activeTimer?.estimateSecs>0){startAlarm();}
    const totalSoFar=timerSessions.reduce((s,x)=>s+x.secs,0)+el;
    const sessNum=timerSessions.length+1;
    const totEl=document.getElementById('ts-total');
    if(totEl)totEl.textContent=sessNum>1?'Sess '+sessNum+' · '+fmtSecs(totalSoFar):'';
    document.getElementById('ts-est').textContent=activeTimer.estimateSecs?'Est: '+fmtHours(activeTimer.estimateSecs/3600):'';
    const dd=document.getElementById('dp-timer-disp');
    if(dd){dd.textContent=fmtSecs(el);dd.className='timer-disp'+(rem<0?' over':'');}
  },1000);
}

async function timerPause(){
  if(!activeTimer||activeTimer.status!=='running')return;
  const sessionSecs=elapsedSecs();
  timerSessions.push({start:activeTimer.startedAt,end:new Date(),secs:sessionSecs});
  activeTimer.status='paused';activeTimer.pausedAt=new Date();
  const totalSecs=timerSessions.reduce((s,x)=>s+x.secs,0);
  const pb=document.getElementById('ts-pause-btn');
  if(pb){pb.textContent='▷';pb.onclick=timerResume;}
  // Update strip to show session paused
  document.getElementById('ts-total').textContent=totalSecs>0?'Total: '+fmtSecs(totalSecs):'';
  try{await api('bravochore_timers','PATCH',{status:'paused',paused_at:activeTimer.pausedAt.toISOString()},`?id=eq.${activeTimer.id}`);}catch(e){}
  const task=tasks.find(t=>t.id===activeTimer.taskId);
  if(task&&dpTaskId===activeTimer.taskId)renderDpBody(task,getMs(activeTimer.taskId));
}

async function timerResume(){
  if(!activeTimer||activeTimer.status!=='paused')return;
  // Start fresh session tracking
  activeTimer.startedAt=new Date(); // reset start for this session
  activeTimer.totalPausedSecs=0;
  activeTimer.pausedAt=null;activeTimer.status='running';
  const sessionNum=timerSessions.length+1;
  const pb=document.getElementById('ts-pause-btn');
  if(pb){pb.textContent='⏸';pb.onclick=timerPause;}
  const totalSoFar=timerSessions.reduce((s,x)=>s+x.secs,0);
  document.getElementById('ts-total').textContent=sessionNum>1?'Sess '+sessionNum+' · Total: '+fmtSecs(totalSoFar):'';
  try{await api('bravochore_timers','PATCH',{status:'running',total_paused_seconds:0},`?id=eq.${activeTimer.id}`);}catch(e){}
}

let jcPendingData=null; // data for job complete card

async function timerStop(completed=false){
  if(!activeTimer)return;
  clearInterval(timerInterval);
  const sessionSecs=elapsedSecs();
  // Close current session
  if(timerSessions.length===0||timerSessions[timerSessions.length-1].end){
    timerSessions.push({start:activeTimer.startedAt,end:new Date(),secs:sessionSecs});
  }else{
    timerSessions[timerSessions.length-1].end=new Date();
    timerSessions[timerSessions.length-1].secs=sessionSecs;
  }
  const totalSecs=timerSessions.reduce((s,x)=>s+x.secs,0);
  const actualH=parseFloat((totalSecs/3600).toFixed(2));
  const{taskId,msId,id,estimateSecs,label}=activeTimer;
  const estH=estimateSecs/3600;
  // Save actual time to DB
  if(msId){
    const ms=milestones.find(m=>m.id===msId);
    if(ms){ms.actual_time_hours=actualH;try{await api('bravochore_milestones','PATCH',{actual_time_hours:actualH},`?id=eq.${msId}`);}catch(e){}}
  }else{
    const task=tasks.find(t=>t.id===taskId);
    if(task){task.actual_time_hours=actualH;try{await api('bravochore_tasks','PATCH',{actual_time_hours:actualH},`?id=eq.${taskId}`);}catch(e){}}
  }
  try{await api('bravochore_timers','PATCH',{status:'completed',stopped_at:new Date().toISOString(),actual_seconds:totalSecs},`?id=eq.${id}`);}catch(e){}
  // Store data for job complete card
  jcPendingData={taskId,msId,label,estH,actualH,totalSecs,sessions:[...timerSessions]};
  activeTimer=null;timerSessions=[];
  document.getElementById('timer-strip').classList.remove('visible');
  // Show job complete card
  showJobComplete(jcPendingData);
}

function showJobComplete(d){
  const fmtH=h=>{
    const m=Math.round(h*60);
    if(m<60)return m+'m';
    return Math.floor(m/60)+'h '+(m%60>0?m%60+'m':'');
  };
  const fmtS=s=>{const m=Math.floor(s/60),se=s%60;return String(m).padStart(2,'0')+':'+String(se).padStart(2,'0');};
  const diffMins=Math.round((d.actualH-d.estH)*60);
  const absDiff=Math.abs(diffMins);
  let perfClass='exact',perfIcon='',perfText='';
  if(d.estH===0){perfClass='exact';perfIcon='⏱';perfText='No estimate was set — good to know for next time.';}
  else if(diffMins<-5){perfClass='fast';perfIcon='🐦';perfText=`${absDiff} minutes under estimate. Clean work.`;}
  else if(diffMins>10){perfClass='over';perfIcon='⏰';perfText=`${absDiff} minutes over estimate. Worth noting for next time.`;}
  else{perfClass='exact';perfIcon='✓';perfText='Right on time. Solid estimate.';}
  document.getElementById('jc-title').textContent=d.label;
  document.getElementById('jc-comment').textContent='';
  const perf=document.getElementById('jc-perf');
  perf.style.display='flex';perf.className='jc-performance '+perfClass;
  perf.innerHTML=`<span style="font-size:18px">${perfIcon}</span>${perfText}`;
  document.getElementById('jc-stats').innerHTML=`
    <div class="jc-stat"><div class="jc-stat-val">${fmtH(d.actualH)}</div><div class="jc-stat-lbl">Actual time</div></div>
    <div class="jc-stat"><div class="jc-stat-val">${d.estH?fmtH(d.estH):'—'}</div><div class="jc-stat-lbl">Estimated</div></div>`;
  const sessEl=document.getElementById('jc-sessions');
  if(d.sessions.length>1){
    sessEl.innerHTML='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:6px">Sessions</div>'+
      d.sessions.map((s,i)=>`<div class="jc-session-row"><span>Session ${i+1}</span><span>${fmtS(s.secs)}</span></div>`).join('')+
      `<div class="jc-session-row" style="font-weight:700"><span>Total</span><span>${fmtS(d.totalSecs)}</span></div>`;
  }else{sessEl.innerHTML='';}
  document.getElementById('jc-backdrop').classList.add('open');
}

async function jcConfirm(){
  document.getElementById('jc-backdrop').classList.remove('open');
  if(!jcPendingData)return;
  const{taskId,msId}=jcPendingData;
  playChime('task');
  if(msId){
    const ms=milestones.find(m=>m.id===msId);
    if(ms&&!ms.done){
      ms.done=true;
      const taskMs=getMs(taskId);
      if(taskMs.every(m=>m.done)){
        const t=tasks.find(x=>x.id===taskId);
        if(t&&!t.done){t.done=true;spawnConfettiCenter();try{await api('bravochore_tasks','PATCH',{done:true},`?id=eq.${taskId}`);}catch(e){}}
      }
      try{await api('bravochore_milestones','PATCH',{done:true},`?id=eq.${msId}`);}catch(e){}
    }
  }else{
    const task=tasks.find(t=>t.id===taskId);
    if(task&&!task.done){task.done=true;spawnConfettiCenter();try{await api('bravochore_tasks','PATCH',{done:true},`?id=eq.${taskId}`);}catch(e){}}
  }
  jcPendingData=null;rerender();
}

async function timerCancel(){
  if(!activeTimer)return;
  clearInterval(timerInterval);
  const{id,taskId}=activeTimer;activeTimer=null;
  document.getElementById('timer-strip').classList.remove('visible');rerender();
  const task=tasks.find(t=>t.id===taskId);
  if(task&&dpTaskId===taskId)renderDpBody(task,getMs(taskId));
  try{await api('bravochore_timers','PATCH',{status:'completed',stopped_at:new Date().toISOString()},`?id=eq.${id}`);}catch(e){}
}

// ================================================================
// AUDIO + CONFETTI
// ================================================================
function playChime(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    if(type==='ms'){
      // Single soft chirp
      chirpNote(ctx,1200,0,0.08);chirpNote(ctx,1500,0.09,0.07);
    }else{
      // Blackbird call — three ascending bright chirps
      chirpNote(ctx,1100,0,0.1);
      chirpNote(ctx,1400,0.12,0.1);
      chirpNote(ctx,1750,0.26,0.14);
      chirpNote(ctx,1400,0.42,0.08);
    }
  }catch(e){}
}
function chirpNote(ctx,freq,delay,dur){
  const o=ctx.createOscillator(),g=ctx.createGain(),bend=ctx.createOscillator(),bGain=ctx.createGain();
  // Frequency bend for natural chirp feel
  o.type='sine';o.frequency.setValueAtTime(freq*0.85,ctx.currentTime+delay);
  o.frequency.linearRampToValueAtTime(freq,ctx.currentTime+delay+dur*0.3);
  o.frequency.linearRampToValueAtTime(freq*1.05,ctx.currentTime+delay+dur*0.7);
  o.frequency.linearRampToValueAtTime(freq*0.9,ctx.currentTime+delay+dur);
  g.gain.setValueAtTime(0,ctx.currentTime+delay);
  g.gain.linearRampToValueAtTime(0.18,ctx.currentTime+delay+0.01);
  g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
  o.connect(g);g.connect(ctx.destination);
  o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+dur+0.05);
}

function spawnConfetti(btn){
  const r=btn.getBoundingClientRect();spawnCf(r.left+r.width/2,r.top+r.height/2);
}
function spawnConfettiCenter(){spawnCf(window.innerWidth/2,window.innerHeight*.4);}
function spawnCf(cx,cy){
  const cols=['#5C8A4A','#C0DD97','#3B6D11','#EAF3DE','#27500A'];
  for(let i=0;i<20;i++){
    const d=document.createElement('div');
    const vx=(Math.random()-.5)*100,vy=-(30+Math.random()*70);
    d.style.cssText=`position:fixed;width:7px;height:7px;border-radius:2px;pointer-events:none;z-index:9999;left:${cx}px;top:${cy}px;background:${cols[Math.floor(Math.random()*cols.length)]};--cx:${vx}px;--cy:${vy}px;animation:cfSpr ${.8+Math.random()*.5}s ease-out ${Math.random()*.2}s forwards`;
    document.body.appendChild(d);setTimeout(()=>d.remove(),1600);
  }
}
