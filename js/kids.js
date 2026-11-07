// ================================================================
// KIDS' JOBS (Phase 1 of the kids plan, see project doc
// bravochore-kids-and-family-plan.md; rules from the Aug 2026 chore brief).
//  - "Every day" jobs are unpaid and unlock the day's pay (padlock).
//  - Paid jobs carry coins.
//  - Timed jobs (bath, bed, wake up) count down. The app, not the parent,
//    calls a miss. A grown-up holds the tile to tick those ones.
//  - Laurel: a missed every-day job locks the day's pay.
//    Little ones (under 6) get a reprieve: the uh-oh plays, the pay stays,
//    but the day doesn't count towards streaks or the team bonus.
//  - Parents can quietly fix any day from the Kids tab. Kids never see it.
// Tables: bravochore_kid_jobs, bravochore_kid_done (household RLS).
// ================================================================
let kjJobs=[],kjDone=[],kjLoaded=false,kjDay=null,kjKidOpen=null,kjTick=null,kjKidTab='jobs';
const KJ_DOW=['S','M','T','W','T','F','S'];
const KJ_DOW_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function kjYmd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function kjAddDays(day,n){const d=new Date(day+'T00:00:00');d.setDate(d.getDate()+n);return kjYmd(d);}
function kjDowOf(day){return new Date(day+'T00:00:00').getDay();}
// Week runs Monday to Sunday (Sunday is payday).
function kjWeekStart(day){const w=kjDowOf(day);return kjAddDays(day,-((w+6)%7));}
// Whole dollars only (Brent, Nov 2026: no cents for the kids).
function kjMoney(n){n=Math.round((n||0)*100)/100;return '$'+(Number.isInteger(n)?n:n.toFixed(2));}
function kjKids(){return people.filter(p=>p.kind==='child'&&p.on_tablet!==false);}
function kjAge(code){const k=(typeof MEM_KIDS!=='undefined'?MEM_KIDS:[]).find(x=>x.code===code);return k&&typeof memAge==='function'?memAge(code)??k.age_years:null;}
function kjReprieve(code){const a=kjAge(code);return a!=null&&a<6;}
function kjName(code){return (people.find(p=>p.code===code)||{}).name||code;}

let kjLoading=null;
async function kjLoad(force){
  if(kjLoaded&&!force)return;
  if(kjLoading)return kjLoading;
  kjLoading=kjLoad2().finally(()=>{kjLoading=null;});return kjLoading;
}
async function kjLoad2(){
  const from=kjAddDays(kjWeekStart(tdStr()),-21);
  const [jobs,done]=await Promise.all([
    api('bravochore_kid_jobs','GET',null,'?active=eq.true&order=kid,kind,sort,id'),
    api('bravochore_kid_done','GET',null,`?day=gte.${from}&order=day`),kjLoadTimers()]);
  kjJobs=jobs||[];kjDone=done||[];kjLoaded=true;
}

// No clock times (Brent, Nov 2026: our days are too fluid). Instead:
//  - a grown-up starts a timer on the spot ("Bath in 10 min"); if the job isn't
//    ticked when it runs out, the app calls the miss.
//  - once a day a grown-up wraps up: anything unticked is Missed or Didn't apply.
//    Nothing is ever docked automatically without a timer or a wrap-up.
// States: open | countdown | done | missed | skip (didn't apply) | pending (past, not wrapped up)
const KJ_PARTS=[['morning','🌅','Morning'],['any','☀️','Any time'],['bedtime','🌙','Bedtime']];
let kjTimers=[];
function kjJobsFor(kid,day,withSkip){
  const w=kjDowOf(day);
  // A job only counts from the day it was added.
  const live=j=>!j.created_at||kjYmd(new Date(j.created_at))<=day;
  return kjJobs.filter(j=>j.kid===kid&&(j.days||[]).includes(w)&&j.kind!=='bonus'&&live(j)&&(withSkip||(kjRow(j.id,day)||{}).status!=='skip'))
    .sort((a,b)=>(a.kind===b.kind?0:a.kind==='daily'?-1:1)||(kjPartIdx(a)-kjPartIdx(b))||(a.sort-b.sort));
}
function kjPartIdx(j){const i=KJ_PARTS.findIndex(p=>p[0]===(j.part||'any'));return i<0?1:i;}
function kjRow(jobId,day){return kjDone.find(r=>r.job_id===jobId&&r.day===day);}
function kjTimerFor(job,day){return kjTimers.find(t=>t.job_id===job.id&&t.day===day);}
// When a running timer ends (ms), or null.
function kjByMs(job,day){const t=kjTimerFor(job,day);return t?new Date(t.ends_at).getTime():null;}
function kjState(job,day){
  const r=kjRow(job.id,day);if(r)return r.status;
  const today=tdStr();
  if(day>today)return 'open';
  const by=kjByMs(job,day);
  if(by!=null)return Date.now()>=by?'missed':'countdown';
  return day<today?'pending':'open';
}
async function kjLoadTimers(){
  try{kjTimers=(await api('bravochore_kid_timers','GET',null,`?day=gte.${kjAddDays(tdStr(),-8)}`))||[];}catch(_e){}
}
function kjSummary(kid,day){
  const jobs=kjJobsFor(kid,day);
  const daily=jobs.filter(j=>j.kind==='daily'),paid=jobs.filter(j=>j.kind==='paid');
  const st=j=>kjState(j,day);
  const pending=jobs.filter(j=>st(j)==='pending').length;
  const dDone=daily.filter(j=>st(j)==='done').length,dMiss=daily.filter(j=>st(j)==='missed').length;
  const pDone=paid.filter(j=>st(j)==='done');
  const gate=dMiss?'locked':dDone===daily.length?'open':'pending';
  const reprieve=kjReprieve(kid);
  const doneAmt=pDone.reduce((a,j)=>a+Number((kjRow(j.id,day)||{}).amount??j.amount),0);
  const possible=paid.reduce((a,j)=>a+Number(j.amount),0);
  const earned=gate==='locked'&&!reprieve?0:doneAmt;
  const all=jobs.length,allDone=dDone+pDone.length;
  return {jobs,daily,paid,dDone,dMiss,gate,reprieve,earned,doneAmt,possible,all,allDone,pending,
    full:all>0&&allDone===all,counts:gate!=='locked'};
}
function kjWeek(kid,day){
  const start=kjWeekStart(day);let earned=0;const days=[];
  for(let i=0;i<7;i++){const d=kjAddDays(start,i);
    if(d>tdStr()||!kjJobsFor(kid,d).length){days.push({d,future:true});continue;}
    const s=kjSummary(kid,d);earned+=s.earned;days.push({d,s});}
  return {earned,days};
}
function kjTeam(day){
  let all=0,done=0;kjKids().forEach(k=>{const s=kjSummary(k.code,day);all+=s.all;done+=s.allDone;});
  return {all,done,pct:all?Math.round(done/all*100):0};
}

async function kjSet(job,day,status){
  const row={job_id:job.id,kid:job.kid,day,status,amount:job.kind==='paid'?job.amount:0,by_code:CU,at:new Date().toISOString()};
  const prev=kjRow(job.id,day);
  kjDone=kjDone.filter(r=>!(r.job_id===job.id&&r.day===day));
  if(status)kjDone.push(row);
  try{
    if(!status){await api('bravochore_kid_done','DELETE',null,`?job_id=eq.${job.id}&day=eq.${day}`);return true;}
    const r=await fetch(`${SB}/rest/v1/bravochore_kid_done?on_conflict=job_id,day`,{method:'POST',
      headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(row)});
    if(!r.ok)throw new Error(await r.text());
    return true;
  }catch(e){
    kjDone=kjDone.filter(r=>!(r.job_id===job.id&&r.day===day));if(prev)kjDone.push(prev);
    if(typeof chirp==='function')chirp("Didn't save. Check the connection.");
    return false;
  }
}

// ---------------------------------------------------------------- sounds
let kjAudio=null;
function kjCtx(){try{kjAudio=kjAudio||new(window.AudioContext||window.webkitAudioContext)();if(kjAudio.state==='suspended')kjAudio.resume();return kjAudio;}catch(_e){return null;}}
function kjNote(ctx,f,t,d,type='triangle',vol=.18){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(0,ctx.currentTime+t);g.gain.linearRampToValueAtTime(vol,ctx.currentTime+t+.02);
  g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+t+d);o.connect(g);g.connect(ctx.destination);
  o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+d+.05);
}
function kjClaps(ctx,start,count){
  for(let i=0;i<count;i++){
    const t=ctx.currentTime+start+i*.09+Math.random()*.05;
    const len=Math.floor(ctx.sampleRate*.05),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
    for(let k=0;k<len;k++)d[k]=(Math.random()*2-1)*Math.pow(1-k/len,3);
    const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    f.type='bandpass';f.frequency.value=1200+Math.random()*900;g.gain.value=.5;
    s.buffer=buf;s.connect(f);f.connect(g);g.connect(ctx.destination);s.start(t);
  }
}
function kjSoundYay(big){
  const ctx=kjCtx();if(!ctx)return;
  [523,659,784,1047].forEach((f,i)=>kjNote(ctx,f,i*.09,.25));
  if(big){[784,988,1175,1568].forEach((f,i)=>kjNote(ctx,f,.45+i*.09,.3));kjClaps(ctx,.3,18);}
  else kjClaps(ctx,.25,6);
}
function kjSoundUhOh(){
  const ctx=kjCtx();if(!ctx)return;
  // Sad trombone: wah wah wah waaah.
  [392,370,349].forEach((f,i)=>kjNote(ctx,f,i*.42,.38,'sawtooth',.12));
  const o=ctx.createOscillator(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain(),t=ctx.currentTime+1.3;
  o.type='sawtooth';o.frequency.value=330;lfo.frequency.value=6;lg.gain.value=8;lfo.connect(lg);lg.connect(o.frequency);
  g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+1.3);o.connect(g);g.connect(ctx.destination);
  o.start(t);lfo.start(t);o.stop(t+1.35);lfo.stop(t+1.35);
}

// ---------------------------------------------------------------- effects
function kjConfetti(n){
  const cols=['#F2B705','#E24B4A','#378ADD','#5C8A4A','#B05BD0','#FF8A3D'];
  for(let i=0;i<n;i++){
    const d=document.createElement('div');const x=Math.random()*innerWidth;
    d.className='kj-cf';d.style.left=x+'px';d.style.background=cols[i%cols.length];
    d.style.animationDuration=(1.6+Math.random()*1.4)+'s';d.style.animationDelay=(Math.random()*.4)+'s';
    d.style.setProperty('--dx',((Math.random()-.5)*160)+'px');d.style.setProperty('--rot',(Math.random()*720)+'deg');
    document.body.appendChild(d);setTimeout(()=>d.remove(),3500);
  }
}
function kjBanner(emoji,text,cls){
  document.querySelectorAll('.kj-banner').forEach(e=>e.remove());
  const b=document.createElement('div');b.className='kj-banner '+(cls||'');
  b.innerHTML=`<div class="kj-banner-emoji">${emoji}</div><div class="kj-banner-text">${hhEsc(text)}</div>`;
  document.body.appendChild(b);setTimeout(()=>b.remove(),cls==='bad'?3200:2200);
}
function kjYay(big,text){kjSoundYay(big);kjConfetti(big?120:40);if(big)kjBanner('🎉',text||'Woohoo!');}
function kjUhOh(text){
  kjSoundUhOh();
  const s=document.createElement('div');s.className='kj-sweep';document.body.appendChild(s);setTimeout(()=>s.remove(),1800);
  kjBanner('😟',text||'Uh oh!','bad');
}

// ---------------------------------------------------------------- kid screen
async function kjOpenKid(code){
  kjKidOpen=code;kjKidTab='jobs';await kjLoad();if(typeof kbLoad==='function')await kbLoad();if(typeof calLoad==='function')calLoad().catch(()=>{});
  let el=document.getElementById('kid-mode');
  if(!el){el=document.createElement('div');el.id='kid-mode';document.body.appendChild(el);}
  el.style.display='block';document.body.classList.add('kid-on');
  kjRenderKid(true);
  clearInterval(kjTick);kjTick=setInterval(kjTickKid,1000);
}
function kjCloseKid(){
  clearInterval(kjTick);kjTick=null;kjKidOpen=null;
  const el=document.getElementById('kid-mode');if(el)el.style.display='none';
  document.body.classList.remove('kid-on');
  if(typeof hhTablet!=='undefined'&&hhTablet){hhLeave();return;}
  if(document.getElementById('view-kids')?.classList.contains('active'))renderKidsTab();
}
let kjLastStates={};
function kjRenderKid(first){
  const el=document.getElementById('kid-mode');if(!el||!kjKidOpen)return;
  const kid=kjKidOpen,p=people.find(x=>x.code===kid)||{name:kid},day=tdStr();
  const s=kjSummary(kid,day),wk=kjWeek(kid,day),team=kjTeam(day);
  const states={};s.jobs.forEach(j=>states[j.id]=kjState(j,day));
  // Newly missed timed jobs: the app calls it, plays the uh-oh, and records it.
  if(!first)s.jobs.forEach(j=>{
    if(states[j.id]==='missed'&&kjLastStates[j.id]&&kjLastStates[j.id]!=='missed'&&!kjRow(j.id,day)){
      kjSet(j,day,'missed');
      kjUhOh(s.reprieve||j.kind==='paid'?'Uh oh! Too late for '+j.title.toLowerCase():`Uh oh! Today's money is locked`);
    }});
  if(first)s.jobs.forEach(j=>{if(states[j.id]==='missed'&&kjTimerFor(j,day)&&!kjRow(j.id,day))kjSet(j,day,'missed');});
  kjLastStates=states;
  const lock=s.gate==='open'?'🔓':s.gate==='locked'?(s.reprieve?'🙈':'🔒'):'🔒';
  const tile=j=>{
    const st=states[j.id];const by=kjByMs(j,day);
    const left=by?Math.max(0,by-Date.now()):0;const mm=Math.floor(left/60000),ss=Math.floor(left%60000/1000);
    return `<button class="kj-tile ${st}${j.parent_confirm?' grown':''}" data-id="${j.id}" aria-label="${hhEsc(j.title)}">
      <span class="kj-ico">${hhEsc(j.icon||'⭐')}</span>
      <span class="kj-t">${hhEsc(j.title)}</span>
      ${j.kind==='paid'?`<span class="kj-coin">${kjMoney(j.amount)}</span>`:''}
      ${st==='done'?'<span class="kj-badge ok">✓</span>':st==='missed'?'<span class="kj-badge no">✕</span>':''}
      ${st==='countdown'?`<span class="kj-count" data-by="${by}">${mm}:${String(ss).padStart(2,'0')}</span>`:''}
      ${j.parent_confirm&&(st==='open'||st==='countdown')?'<span class="kj-hold">Grown-up: hold</span>':''}
    </button>`;};
  el.innerHTML=`<div class="km">
    <div class="km-top">
      <span class="km-av" style="background:${p.bg};color:${p.color}">${hhEsc(p.avatar||p.code)}</span>
      <div class="km-hi"><div class="km-name">Hi ${hhEsc(p.name)}!</div><div class="km-date">${KJ_DOW_LONG[kjDowOf(day)]}</div></div>
      <div class="km-money"><div class="km-today">${kjMoney(s.earned)}</div><div class="km-week">${kjMoney(typeof kbWeek==='function'?kbWeek(kid,kjWeekStart(day)).total:wk.earned)} this week</div></div>
      <button class="km-exit" onclick="kjCloseKid()" aria-label="Finish">👋</button>
    </div>
    <div class="km-tabs">${[['jobs','⭐','My jobs'],['bank','🏦','Bank'],['cal','📅','Calendar']].map(([k,i,l])=>`<button class="km-tab ${kjKidTab===k?'on':''}" onclick="kjKidTab='${k}';kjRenderKid(true)"><span>${i}</span>${l}</button>`).join('')}</div>
    ${kjKidTab!=='jobs'?`<div id="km-other">${kjKidTab==='bank'&&typeof kbKidBank==='function'?kbKidBank(kid):kjKidTab==='cal'&&typeof calKidView==='function'?calKidView():''}</div>`:`
    <div class="km-team">
      <div class="km-team-row"><span>🤝 Team today</span><b>${team.done} / ${team.all}</b></div>
      <div class="km-bar"><div style="width:${team.pct}%"></div></div>
      <div class="km-team-sub">${team.pct===100?'Everyone did everything! 🌟':'Both finish everything = bonus!'}</div>
    </div>
    <div class="km-sec"><span class="km-lock">${lock}</span> Every day <span class="km-sub">${s.dDone} / ${s.daily.length}${s.gate==='open'?' · money unlocked!':s.gate==='locked'&&!s.reprieve?' · locked today':''}</span></div>
    ${KJ_PARTS.map(([k,i,l])=>{const js=s.daily.filter(j=>(j.part||'any')===k);return js.length?`<div class="km-part">${i} ${l}</div><div class="km-grid">${js.map(tile).join('')}</div>`:'';}).join('')}
    <div class="km-sec"><span class="km-lock">🪙</span> Jobs that pay <span class="km-sub">${kjMoney(s.doneAmt)} of ${kjMoney(s.possible)}</span></div>
    <div class="km-grid">${s.paid.map(tile).join('')||'<div class="km-none">No paid jobs today. Enjoy! ☀️</div>'}</div>
    <div class="km-week-dots">${wk.days.map(x=>`<span class="km-dot ${x.future?'fut':x.s.full?'full':(x.s.pending||(x.d===tdStr()&&x.s.gate==='pending'))?'fut':x.s.counts?'ok':'bad'}${x.d===day?' now':''}">${KJ_DOW[kjDowOf(x.d)]}</span>`).join('')}</div>`}
  </div>`;
  el.querySelectorAll('.kj-tile').forEach(b=>kjBindTile(b,day));
  if(kjKidTab==='bank'&&typeof kbBindKid==='function')kbBindKid(kid);
}
function kjBindTile(b,day){
  const job=kjJobs.find(j=>j.id===+b.dataset.id);if(!job)return;
  const st=kjState(job,day);
  if(st==='missed')return;
  if(job.parent_confirm&&st!=='done'){
    // Grown-up holds the tile for a second to tick it.
    let t=null;
    const go=e=>{e.preventDefault();b.classList.add('holding');t=setTimeout(async()=>{b.classList.remove('holding');await kjTickJob(job,day,'done');},1000);};
    const stop=()=>{clearTimeout(t);b.classList.remove('holding');};
    b.addEventListener('pointerdown',go);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
    b.onclick=e=>e.preventDefault();
    return;
  }
  b.onclick=()=>kjTickJob(job,day,st==='done'?null:'done');
}
async function kjTickJob(job,day,status){
  const before=kjSummary(job.kid,day),teamBefore=kjTeam(day);
  if(!(await kjSet(job,day,status))){kjRenderKid();return;}
  const after=kjSummary(job.kid,day),team=kjTeam(day);
  if(status==='done'){
    if(team.pct===100&&teamBefore.pct<100)kjYay(true,'Team bonus! Everyone did everything!');
    else if(after.full&&!before.full)kjYay(true,'All done today! 🌟');
    else if(after.gate==='open'&&before.gate!=='open')kjYay(true,'Money unlocked! 🔓');
    else kjYay(false);
  }
  kjRenderKid();
}
// Timers can be started from any device, so screens that show them poll.
let kjTimerPoll=0;const kjWarned=new Set();
function kjPollTimers(){if(Date.now()-kjTimerPoll<15000)return;kjTimerPoll=Date.now();kjLoadTimers();}
function kjSoundWarn(){const ctx=kjCtx();if(!ctx)return;[880,880,1175].forEach((f,i)=>kjNote(ctx,f,i*.22,.18,'square',.08));}
// Two-minute warning beep for any running timer (once per timer).
function kjWarnCheck(kids){
  const day=tdStr();
  kjTimers.filter(t=>t.day===day).forEach(t=>{
    const j=kjJobs.find(x=>x.id===t.job_id);if(!j||!kids.includes(j.kid)||kjRow(j.id,day))return;
    const left=new Date(t.ends_at).getTime()-Date.now(),key=t.id+'|'+t.ends_at;
    if(left>0&&left<=120000&&!kjWarned.has(key)){kjWarned.add(key);kjSoundWarn();kjBanner('⏰','2 minutes left: '+j.title,'');}
  });
}
function kjTickKid(){
  const el=document.getElementById('kid-mode');if(!el||el.style.display==='none'||kjKidTab!=='jobs')return;
  kjPollTimers();kjWarnCheck([kjKidOpen]);
  const day=tdStr();let redraw=false;
  kjJobsFor(kjKidOpen,day).forEach(j=>{if(kjState(j,day)!==kjLastStates[j.id])redraw=true;});
  if(redraw){kjRenderKid();return;}
  el.querySelectorAll('.kj-count').forEach(c=>{
    const left=Math.max(0,+c.dataset.by-Date.now());const mm=Math.floor(left/60000),ss=Math.floor(left%60000/1000);
    c.textContent=`${mm}:${String(ss).padStart(2,'0')}`;
  });
}

// ---------------------------------------------------------------- Kids tab (parents)
async function renderKidsTab(){
  const body=document.getElementById('kids-body');if(!body)return;
  if(!kjLoaded)body.innerHTML='<div class="empty-state">Loading…</div>';
  try{await kjLoad();if(typeof kbLoad==='function')await kbLoad();}catch(e){body.innerHTML='<div class="empty-state">Couldn\'t load the kids\' jobs.</div>';return;}
  const day=kjDay||tdStr(),today=tdStr();
  const team=kjTeam(day);
  const label=day===today?'Today':day===kjAddDays(today,-1)?'Yesterday':new Date(day+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
  body.innerHTML=`
    <div class="kt-day">
      <button class="kt-step" onclick="kjStep(-1)" aria-label="Previous day">‹</button>
      <div class="kt-day-label">${label}</div>
      <button class="kt-step" onclick="kjStep(1)" ${day>=today?'disabled':''} aria-label="Next day">›</button>
    </div>
    ${kjWrapBanner()}
    <div class="kt-actions"><button class="btn-ok" onclick="kjTimerSheet()">⏱ Start a timer</button><button class="qa-btn" onclick="kjWrapUp('${day}')">✔ Wrap up ${day===today?'today':'this day'}</button></div>
    ${kjTimerChips()}
    <div class="kt-team"><span>🤝 Team</span><div class="km-bar"><div style="width:${team.pct}%"></div></div><b class="mem-num">${team.pct}%</b></div>
    ${kjKids().map(k=>kjKidCard(k,day)).join('')}
    <div class="mem-sub" style="margin-top:10px">Tap any job to change it: done, missed or didn't apply. Only grown-ups see this screen.</div>`;
  body.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{
    const job=kjJobs.find(j=>j.id===+b.dataset.fix);if(job)kjFixSheet(job,day);
  });
  clearTimeout(window.kjTabTimer);
  window.kjTabTimer=setTimeout(()=>{if(document.getElementById('view-kids')?.classList.contains('active'))renderKidsTab();},30000);
}
function kjStep(n){const d=kjAddDays(kjDay||tdStr(),n);if(d>tdStr())return;kjDay=d;renderKidsTab();}
function kjKidCard(k,day){
  const s=kjSummary(k.code,day),wk=kjWeek(k.code,day);
  const chip=s.gate==='open'?'<span class="kt-chip ok">🔓 Unlocked</span>':s.gate==='locked'?(s.reprieve?'<span class="kt-chip warn">🙈 Reprieve</span>':'<span class="kt-chip no">🔒 Locked</span>'):`<span class="kt-chip">Every day ${s.dDone}/${s.daily.length}</span>`;
  const row=j=>{const st=kjState(j,day);const by=kjByMs(j,day);
    return `<button class="kt-job ${st}" data-fix="${j.id}">
      <span class="kt-ico">${hhEsc(j.icon||'⭐')}</span><span class="kt-title">${hhEsc(j.title)}${st==='countdown'?` <span class="mem-sub">timer ${Math.max(0,Math.ceil((by-Date.now())/60000))} min</span>`:st==='skip'?' <span class="mem-sub">didn\'t apply</span>':''}</span>
      ${j.kind==='paid'?`<span class="kt-amt mem-num">${kjMoney(j.amount)}</span>`:''}
      <span class="kt-st">${st==='done'?'✓':st==='missed'?'✕':st==='countdown'?'⏱':st==='skip'?'–':st==='pending'?'?':''}</span></button>`;};
  return `<div class="kt-card">
    <div class="kt-head">
      <span class="km-av sm" style="background:${k.bg};color:${k.color}">${hhEsc(k.avatar||k.code)}</span>
      <div style="flex:1;min-width:0"><b>${hhEsc(k.name)}</b><div class="mem-sub" style="margin:0">${s.allDone}/${s.all} done · ${kjMoney(s.earned)} today · ${kjMoney(wk.earned)} this week</div></div>
      ${chip}
    </div>
    <div class="km-week-dots sm">${wk.days.map(x=>`<span class="km-dot ${x.future?'fut':x.s.full?'full':(x.s.pending||(x.d===tdStr()&&x.s.gate==='pending'))?'fut':x.s.counts?'ok':'bad'}${x.d===day?' now':''}">${KJ_DOW[kjDowOf(x.d)]}</span>`).join('')}</div>
    ${typeof kbParentCard==='function'?kbParentCard(k):''}
    <div class="kt-jobs">${kjJobsFor(k.code,day,true).map(row).join('')}</div>
    <button class="qa-btn" style="margin-top:8px;font-size:12px" onclick="kjOpenKid('${k.code}')">Open ${hhEsc(k.name)}'s screen</button>
  </div>`;
}

// ---------------------------------------------------------------- editor (parents)
let kjEdKid=null;
async function kjOpenEditor(){
  await kjLoad();kjEdKid=kjEdKid||(kjKids()[0]||{}).code;
  let wrap=document.getElementById('kj-editor');
  if(!wrap){wrap=document.createElement('div');wrap.id='kj-editor';wrap.className='mem-overlay';wrap.style.zIndex='940';document.body.appendChild(wrap);}
  const jobs=kjJobs.filter(j=>j.kid===kjEdKid).sort((a,b)=>(a.kind===b.kind?0:a.kind==='daily'?-1:1)||a.sort-b.sort);
  const days=j=>j.days.length===7?'Every day':j.days.slice().sort().map(d=>KJ_DOW_LONG[d].slice(0,3)).join(' ');
  const wkTotal=jobs.filter(j=>j.kind==='paid').reduce((a,j)=>a+j.amount*j.days.length,0);
  wrap.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">Kids' jobs</div><div class="mem-sheet-sub">Only grown-ups can change these. ${kjMoney(wkTotal)} a week if every paid job is done.</div></div>
      <button class="btn-cancel" onclick="document.getElementById('kj-editor').remove()">Close</button></div>
    <div style="display:flex;gap:6px;margin-bottom:12px">${kjKids().map(k=>`<div class="filter-chip ${k.code===kjEdKid?'active':''}" onclick="kjEdKid='${k.code}';kjOpenEditor()">${hhEsc(k.name)}</div>`).join('')}</div>
    ${['daily','paid'].map(kind=>`<div class="kt-ed-sec">${kind==='daily'?'Every day (unpaid, unlocks pay)':'Paid jobs'}</div>
      ${jobs.filter(j=>j.kind===kind).map(j=>`<button class="kt-job" onclick="kjEditJob(${j.id})"><span class="kt-ico">${hhEsc(j.icon||'⭐')}</span>
        <span class="kt-title">${hhEsc(j.title)}<span class="mem-sub" style="display:block;margin:0">${days(j)}${j.part?' · '+(KJ_PARTS.find(p=>p[0]===j.part)||[,,''])[2]:''}${j.parent_confirm?' · grown-up ticks':''}</span></span>
        ${kind==='paid'?`<span class="kt-amt mem-num">${kjMoney(j.amount)}</span>`:''}</button>`).join('')}`).join('')}
    <button class="btn-ok" style="width:100%;margin-top:12px;padding:12px" onclick="kjEditJob(null)">+ Add a job for ${hhEsc(kjName(kjEdKid))}</button>
  </div>`;
}
function kjEditJob(id){
  const j=id?kjJobs.find(x=>x.id===id):{kid:kjEdKid,title:'',icon:'⭐',kind:'paid',days:[0,1,2,3,4,5,6],amount:1,part:null,parent_confirm:false,sort:99};
  if(!j)return;
  const icons=['🪥','🛁','🛏️','🌅','📖','🍽️','🧽','🐟','🗑️','🪴','👟','🧺','🧸','🐶','🚗','🧹','✏️','⭐'];
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${id?'Edit job':'New job'} · ${hhEsc(kjName(j.kid))}</div>
    <div class="dp-field" style="margin-top:12px"><label class="dp-label" for="kj-title">Job</label><input class="dp-input" id="kj-title" value="${hhEsc(j.title)}"></div>
    <div class="dp-field"><label class="dp-label" for="kj-icon">Picture</label>
      <div style="display:flex;gap:8px;align-items:center"><input class="dp-input" id="kj-icon" value="${hhEsc(j.icon||'')}" style="width:70px;font-size:22px;text-align:center">
      <div class="kj-icons">${icons.map(i=>`<button type="button" data-i="${i}">${i}</button>`).join('')}</div></div></div>
    <div class="dp-field"><label class="dp-label">Type</label><div style="display:flex;gap:6px">
      <div class="filter-chip ${j.kind==='daily'?'active':''}" data-kind="daily">Every day (unpaid)</div>
      <div class="filter-chip ${j.kind==='paid'?'active':''}" data-kind="paid">Paid</div></div></div>
    <div class="dp-field"><label class="dp-label">Days</label><div style="display:flex;gap:4px">${[1,2,3,4,5,6,0].map(d=>`<div class="filter-chip kj-day ${j.days.includes(d)?'active':''}" data-d="${d}">${KJ_DOW_LONG[d].slice(0,3)}</div>`).join('')}</div></div>
    <div style="display:flex;gap:8px">
      <div class="dp-field" style="flex:1" id="kj-amt-f"><label class="dp-label" for="kj-amt">Pay ($)</label><input class="dp-input" id="kj-amt" type="number" step="1" min="0" inputmode="numeric" value="${Math.round(j.amount)}"></div>
      <div class="dp-field" style="flex:1"><label class="dp-label" for="kj-part">When</label><select class="dp-input" id="kj-part">${KJ_PARTS.map(([k,i,l])=>`<option value="${k}" ${(j.part||'any')===k?'selected':''}>${i} ${l}</option>`).join('')}</select></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 14px"><input type="checkbox" id="kj-pc" ${j.parent_confirm?'checked':''}> A grown-up ticks this one (bath, bed)</label>
    <div style="display:flex;gap:8px">${id?'<button class="btn-cancel" id="kj-del" style="color:var(--red)">Remove</button>':''}
      <button class="btn-cancel" id="kj-cancel" style="margin-left:auto">Cancel</button><button class="btn-ok" id="kj-save">Save</button></div>
  </div>`;
  document.body.appendChild(w);
  let kind=j.kind;const days=new Set(j.days);
  const showAmt=()=>{w.querySelector('#kj-amt-f').style.visibility=kind==='paid'?'visible':'hidden';};showAmt();
  w.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{w.querySelector('#kj-icon').value=b.dataset.i;});
  w.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;w.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));showAmt();});
  w.querySelectorAll('.kj-day').forEach(b=>b.onclick=()=>{const d=+b.dataset.d;days.has(d)?days.delete(d):days.add(d);b.classList.toggle('active',days.has(d));});
  w.querySelector('#kj-cancel').onclick=()=>w.remove();
  if(id)w.querySelector('#kj-del').onclick=async()=>{
    try{await api('bravochore_kid_jobs','PATCH',{active:false},`?id=eq.${id}`);kjJobs=kjJobs.filter(x=>x.id!==id);}catch(_e){}
    w.remove();kjOpenEditor();renderKidsTab();};
  w.querySelector('#kj-save').onclick=async()=>{
    const title=w.querySelector('#kj-title').value.trim();if(!title||!days.size)return;
    const part=w.querySelector('#kj-part').value;
    const row={kid:j.kid,title,icon:w.querySelector('#kj-icon').value.trim()||'⭐',kind,days:[...days].sort(),
      amount:kind==='paid'?Math.max(0,Math.round(+w.querySelector('#kj-amt').value||0)):0,
      part:part==='any'?null:part,parent_confirm:w.querySelector('#kj-pc').checked,sort:j.sort};
    try{
      if(id){await api('bravochore_kid_jobs','PATCH',row,`?id=eq.${id}`);Object.assign(j,row);}
      else{const r=await api('bravochore_kid_jobs','POST',row);if(r&&r[0])kjJobs.push(r[0]);}
    }catch(_e){if(typeof chirp==='function')chirp("Didn't save. Try again.");return;}
    w.remove();kjOpenEditor();renderKidsTab();
  };
}

// ---------------------------------------------------------------- timers (grown-up starts them)
function kjTimerKey(t){return String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function kjRunning(day){
  day=day||tdStr();
  return kjTimers.filter(t=>t.day===day).map(t=>({t,j:kjJobs.find(x=>x.id===t.job_id)}))
    .filter(x=>x.j&&!kjRow(x.j.id,day)&&new Date(x.t.ends_at).getTime()>Date.now());
}
function kjTimerChips(){
  const r=kjRunning();if(!r.length)return '';
  const g={};r.forEach(x=>{const k=kjTimerKey(x.j.title)+'|'+x.t.ends_at;(g[k]=g[k]||[]).push(x);});
  return `<div class="kt-timers">${Object.values(g).map(xs=>{const x=xs[0],left=new Date(x.t.ends_at).getTime()-Date.now();
    return `<div class="kt-timer"><span>${hhEsc(x.j.icon||'⏱')} <b>${hhEsc(x.j.title)}</b> · ${xs.map(y=>hhEsc(kjName(y.j.kid))).join(' & ')}</span>
      <span class="mem-num">${Math.ceil(left/60000)} min</span><button class="mem-link" onclick="kjCancelTimer([${xs.map(y=>y.t.id).join(',')}])">Cancel</button></div>`;}).join('')}</div>`;
}
async function kjCancelTimer(ids){
  try{for(const id of ids)await api('bravochore_kid_timers','DELETE',null,`?id=eq.${id}`);}catch(_e){}
  kjTimers=kjTimers.filter(t=>!ids.includes(t.id));kjAfterChange();
  if(document.getElementById('kj-timer-sheet'))kjTimerSheet();
}
function kjAfterChange(){
  try{if(document.getElementById('view-kids')?.classList.contains('active'))renderKidsTab();}catch(_e){}
  try{if(kjKidOpen)kjRenderKid();}catch(_e){}
  try{if(typeof homeFillKids==='function'&&document.getElementById('home-kids'))homeFillKids();}catch(_e){}
}
async function kjTimerSheet(){
  await kjLoad();await kjLoadTimers();
  const day=tdStr();
  // Today's unticked jobs, grouped across kids by name (one tap starts it for both).
  const groups={};
  kjKids().forEach(k=>kjJobsFor(k.code,day).forEach(j=>{if(kjState(j,day)!=='open')return;
    const key=kjTimerKey(j.title);(groups[key]=groups[key]||{key,title:j.title,icon:j.icon,part:kjPartIdx(j),jobs:[]}).jobs.push(j);}));
  const list=Object.values(groups).sort((a,b)=>(b.part===2)-(a.part===2)||a.part-b.part);
  let w=document.getElementById('kj-timer-sheet');
  if(!w){w=document.createElement('div');w.id='kj-timer-sheet';w.className='mem-overlay';w.style.zIndex='9550';document.body.appendChild(w);}
  let pick=w.dataset.pick||'',mins=+(w.dataset.mins||10);
  const draw=()=>{
    const g=groups[pick];
    w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
      <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">⏱ Start a timer</div><div class="mem-sheet-sub">If it's not done when the timer runs out, it's a miss.</div></div>
        <button class="btn-cancel" data-x>Close</button></div>
      ${kjTimerChips()}
      <div class="kt-ed-sec">Which job?</div>
      <div class="kj-tpick">${list.map(x=>`<button class="kj-tp ${pick===x.key?'on':''}" data-k="${hhEsc(x.key)}"><span>${hhEsc(x.icon||'⭐')}</span>${hhEsc(x.title)}<i>${x.jobs.map(j=>hhEsc(kjName(j.kid))).join(' & ')}</i></button>`).join('')||'<div class="mem-sub">Nothing left to do today.</div>'}</div>
      <div class="kt-ed-sec">How long?</div>
      <div style="display:flex;gap:6px">${[5,10,15].map(m=>`<div class="filter-chip ${mins===m?'active':''}" data-m="${m}">${m} min</div>`).join('')}</div>
      ${g&&g.jobs.length>1?`<div class="kt-ed-sec">Who?</div><div style="display:flex;gap:12px">${g.jobs.map(j=>`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-j="${j.id}" checked> ${hhEsc(kjName(j.kid))}</label>`).join('')}</div>`:''}
      <button class="btn-ok" data-go style="width:100%;margin-top:16px;padding:14px;font-size:16px" ${g?'':'disabled'}>Start ${mins}-minute timer</button></div>`;
    w.querySelector('[data-x]').onclick=()=>w.remove();
    w.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{pick=w.dataset.pick=b.dataset.k;draw();});
    w.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mins=+b.dataset.m;w.dataset.mins=mins;draw();});
    w.querySelector('[data-go]').onclick=async()=>{
      const boxes=[...w.querySelectorAll('[data-j]')];
      const jobs=boxes.length?g.jobs.filter(j=>boxes.find(b=>+b.dataset.j===j.id)?.checked):g.jobs;
      if(!jobs.length)return;
      if(await kjStartTimer(jobs,mins)){w.remove();
        kjBanner('⏱',`${mins} minutes: ${g.title}`);}
    };
  };
  draw();
}
async function kjStartTimer(jobs,mins){
  const day=tdStr(),ends=new Date(Date.now()+mins*60000).toISOString();
  const rows=jobs.map(j=>({job_id:j.id,day,ends_at:ends,minutes:Math.max(1,Math.round(mins)),started_by:CU}));
  try{
    const r=await fetch(`${SB}/rest/v1/bravochore_kid_timers?on_conflict=job_id,day`,{method:'POST',
      headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(rows)});
    if(!r.ok)throw new Error(await r.text());
    const got=await r.json();
    kjTimers=kjTimers.filter(t=>!got.some(g=>g.job_id===t.job_id&&g.day===t.day)).concat(got);
  }catch(_e){kjBanner('😕',"Timer didn't start. Check the connection.",'bad');return false;}
  kjAfterChange();return true;
}
// For screens other than the kid screen (the wall): record misses when timers run out.
const kjFired=new Set();
function kjCheckExpired(sound){
  const day=tdStr();
  kjTimers.filter(t=>t.day===day).forEach(t=>{
    const j=kjJobs.find(x=>x.id===t.job_id);if(!j||kjRow(j.id,day))return;
    const end=new Date(t.ends_at).getTime();if(Date.now()<end)return;
    const key=t.id+'|'+t.ends_at;if(kjFired.has(key))return;kjFired.add(key);
    kjSet(j,day,'missed');
    if(sound&&Date.now()-end<90000)kjUhOh(`Uh oh! ${kjName(j.kid)}: too late for ${j.title.toLowerCase()}`);
  });
}

// ---------------------------------------------------------------- wrap-up (grown-up, once a day)
function kjPendingDays(){
  const out=[],today=tdStr();
  for(let i=7;i>=1;i--){const d=kjAddDays(today,-i);
    const n=kjKids().reduce((a,k)=>a+kjSummary(k.code,d).pending,0);if(n)out.push({d,n});}
  return out;
}
function kjDayLabel(d){const t=tdStr();return d===t?'today':d===kjAddDays(t,-1)?'yesterday':new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});}
function kjWrapBanner(){
  const p=kjPendingDays();if(!p.length)return '';
  return `<button class="kt-wrapban" onclick="kjWrapUp('${p[0].d}')">✔ Wrap up ${kjDayLabel(p[0].d)}: ${p[0].n} job${p[0].n>1?'s':''} to sort${p.length>1?` <span class="mem-sub">(+${p.length-1} more day${p.length>2?'s':''})</span>`:''}</button>`;
}
function kjWrapUp(day){
  day=day||tdStr();
  let w=document.getElementById('kj-wrap');
  if(!w){w=document.createElement('div');w.id='kj-wrap';w.className='mem-overlay';w.style.zIndex='9550';document.body.appendChild(w);}
  const open=k=>kjJobsFor(k.code,day).filter(j=>['open','pending','countdown'].includes(kjState(j,day)));
  const left=kjKids().reduce((a,k)=>a+open(k).length,0);
  const next=kjPendingDays().find(x=>x.d!==day);
  const bedLeft=kjKids().some(k=>open(k).some(j=>j.part==='bedtime'));
  w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">Wrap up ${kjDayLabel(day)}</div><div class="mem-sheet-sub">Anything not ticked: did they miss it, or did it not apply (out, sick, away)?</div></div>
      <button class="btn-cancel" data-x>Close</button></div>
    ${bedLeft?`<button class="qa-btn" data-bed style="width:100%;margin-bottom:10px">🌙 We were out: bedtime jobs didn't apply</button>`:''}
    ${kjKids().map(k=>{const js=open(k);if(!js.length)return '';
      return `<div class="kt-ed-sec">${hhEsc(k.name)}</div>${js.map(j=>`<div class="kj-wr"><span class="kt-ico">${hhEsc(j.icon||'⭐')}</span><span class="kj-wr-t">${hhEsc(j.title)}${j.kind==='paid'?` <span class="mem-sub">${kjMoney(j.amount)}</span>`:''}</span>
        <button class="kj-wb ok" data-j="${j.id}" data-s="done" aria-label="Done">✓</button><button class="kj-wb no" data-j="${j.id}" data-s="missed" aria-label="Missed">✕</button><button class="kj-wb na" data-j="${j.id}" data-s="skip" aria-label="Didn't apply">–</button></div>`).join('')}`;}).join('')}
    ${left?`<div class="mem-sub" style="margin:8px 0">✓ done · ✕ missed · – didn't apply</div>
      <button class="qa-btn" data-rest style="width:100%">The rest didn't apply</button>`:`<div class="kj-wr-done">All wrapped up 🎉</div>`}
    ${next?`<button class="btn-ok" data-next style="width:100%;margin-top:10px">Next: ${kjDayLabel(next.d)} (${next.n})</button>`:''}
  </div>`;
  const q=s=>w.querySelector(s);
  q('[data-x]').onclick=()=>{w.remove();kjAfterChange();};
  w.querySelectorAll('[data-j]').forEach(b=>b.onclick=async()=>{const j=kjJobs.find(x=>x.id===+b.dataset.j);if(j){await kjSet(j,day,b.dataset.s);kjWrapUp(day);}});
  const many=async f=>{for(const k of kjKids())for(const j of open(k).filter(f))await kjSet(j,day,'skip');kjWrapUp(day);};
  if(q('[data-bed]'))q('[data-bed]').onclick=()=>many(j=>j.part==='bedtime');
  if(q('[data-rest]'))q('[data-rest]').onclick=()=>many(()=>true);
  if(q('[data-next]'))q('[data-next]').onclick=()=>kjWrapUp(next.d);
}
// Parent fix for one job on one day.
function kjFixSheet(job,day){
  const st=kjState(job,day);
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='9550';
  const opt=(s,l)=>`<button class="${st===s?'btn-ok':'qa-btn'}" data-s="${s}" style="width:100%;margin-top:8px;padding:12px">${l}</button>`;
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${hhEsc(job.icon||'')} ${hhEsc(job.title)}</div><div class="mem-sheet-sub">${hhEsc(kjName(job.kid))} · ${kjDayLabel(day)}</div>
    ${opt('done','✓ Done')}${opt('missed','✕ Missed')}${opt('skip','– Didn\'t apply')}${opt('','↺ Not sorted yet')}
    <button class="btn-cancel" data-x style="width:100%;margin-top:12px">Cancel</button></div>`;
  document.body.appendChild(w);
  w.querySelector('[data-x]').onclick=()=>w.remove();
  w.querySelectorAll('[data-s]').forEach(b=>b.onclick=async()=>{
    const s=b.dataset.s;
    if(!s){const t=kjTimerFor(job,day);if(t){try{await api('bravochore_kid_timers','DELETE',null,`?id=eq.${t.id}`);}catch(_e){}kjTimers=kjTimers.filter(x=>x!==t);}}
    await kjSet(job,day,s||null);w.remove();kjAfterChange();
  });
}
