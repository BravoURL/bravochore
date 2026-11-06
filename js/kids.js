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
let kjJobs=[],kjDone=[],kjLoaded=false,kjDay=null,kjKidOpen=null,kjTick=null;
const KJ_DOW=['S','M','T','W','T','F','S'];
const KJ_DOW_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function kjYmd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function kjAddDays(day,n){const d=new Date(day+'T00:00:00');d.setDate(d.getDate()+n);return kjYmd(d);}
function kjDowOf(day){return new Date(day+'T00:00:00').getDay();}
// Week runs Monday to Sunday (Sunday is payday).
function kjWeekStart(day){const w=kjDowOf(day);return kjAddDays(day,-((w+6)%7));}
function kjMoney(n){n=Math.round((n||0)*100)/100;return '$'+n.toFixed(2);}
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
  const from=kjAddDays(kjWeekStart(tdStr()),-7);
  const [jobs,done]=await Promise.all([
    api('bravochore_kid_jobs','GET',null,'?active=eq.true&order=kid,kind,sort,id'),
    api('bravochore_kid_done','GET',null,`?day=gte.${from}&order=day`)]);
  kjJobs=jobs||[];kjDone=done||[];kjLoaded=true;
}

function kjJobsFor(kid,day){
  const w=kjDowOf(day);
  // A job only counts from when it was added (no retro misses on day one).
  const live=j=>{if(!j.created_at)return true;const c=new Date(j.created_at),cd=kjYmd(c);
    if(cd<day)return true;if(cd>day)return false;const by=kjByMs(j,day);return by==null||c.getTime()<by;};
  return kjJobs.filter(j=>j.kid===kid&&(j.days||[]).includes(w)&&j.kind!=='bonus'&&live(j))
    .sort((a,b)=>(a.kind===b.kind?0:a.kind==='daily'?-1:1)||(a.sort-b.sort));
}
function kjRow(jobId,day){return kjDone.find(r=>r.job_id===jobId&&r.day===day);}
function kjByMs(job,day){
  if(!job.by_time)return null;
  const [h,m]=job.by_time.split(':').map(Number);const d=new Date(day+'T00:00:00');d.setHours(h,m,0,0);return d.getTime();
}
// open | countdown | done | missed
function kjState(job,day){
  const r=kjRow(job.id,day);if(r)return r.status;
  const today=tdStr();
  if(day<today)return 'missed';
  if(day>today)return 'open';
  const by=kjByMs(job,day);
  if(by!=null){
    const now=Date.now();
    if(now>=by)return 'missed';
    if(now>=by-(job.countdown_min||20)*60000)return 'countdown';
  }
  return 'open';
}
function kjSummary(kid,day){
  const jobs=kjJobsFor(kid,day);
  const daily=jobs.filter(j=>j.kind==='daily'),paid=jobs.filter(j=>j.kind==='paid');
  const st=j=>kjState(j,day);
  const dDone=daily.filter(j=>st(j)==='done').length,dMiss=daily.filter(j=>st(j)==='missed').length;
  const pDone=paid.filter(j=>st(j)==='done');
  const gate=dMiss?'locked':dDone===daily.length?'open':'pending';
  const reprieve=kjReprieve(kid);
  const doneAmt=pDone.reduce((a,j)=>a+Number((kjRow(j.id,day)||{}).amount??j.amount),0);
  const possible=paid.reduce((a,j)=>a+Number(j.amount),0);
  const earned=gate==='locked'&&!reprieve?0:doneAmt;
  const all=jobs.length,allDone=dDone+pDone.length;
  return {jobs,daily,paid,dDone,dMiss,gate,reprieve,earned,doneAmt,possible,all,allDone,
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
  kjKidOpen=code;await kjLoad();
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
      kjUhOh(s.reprieve?'Uh oh! Too late for '+j.title.toLowerCase():`Uh oh! Today's money is locked`);
    }});
  if(first)s.jobs.forEach(j=>{if(states[j.id]==='missed'&&j.by_time&&!kjRow(j.id,day))kjSet(j,day,'missed');});
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
      ${st==='countdown'?`<span class="kj-count" data-by="${by}">${mm}:${String(ss).padStart(2,'0')}</span>`:
        (st==='open'&&by?`<span class="kj-by">by ${new Date(by).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}</span>`:'')}
      ${j.parent_confirm&&(st==='open'||st==='countdown')?'<span class="kj-hold">Grown-up: hold</span>':''}
    </button>`;};
  el.innerHTML=`<div class="km">
    <div class="km-top">
      <span class="km-av" style="background:${p.bg};color:${p.color}">${hhEsc(p.avatar||p.code)}</span>
      <div class="km-hi"><div class="km-name">Hi ${hhEsc(p.name)}!</div><div class="km-date">${KJ_DOW_LONG[kjDowOf(day)]}</div></div>
      <div class="km-money"><div class="km-today">${kjMoney(s.earned)}</div><div class="km-week">${kjMoney(wk.earned)} this week</div></div>
      <button class="km-exit" onclick="kjCloseKid()" aria-label="Finish">👋</button>
    </div>
    <div class="km-team">
      <div class="km-team-row"><span>🤝 Team today</span><b>${team.done} / ${team.all}</b></div>
      <div class="km-bar"><div style="width:${team.pct}%"></div></div>
      <div class="km-team-sub">${team.pct===100?'Everyone did everything! 🌟':'Both finish everything = bonus!'}</div>
    </div>
    <div class="km-sec"><span class="km-lock">${lock}</span> Every day <span class="km-sub">${s.dDone} / ${s.daily.length}${s.gate==='open'?' · money unlocked!':s.gate==='locked'&&!s.reprieve?' · locked today':''}</span></div>
    <div class="km-grid">${s.daily.map(tile).join('')}</div>
    <div class="km-sec"><span class="km-lock">🪙</span> Jobs that pay <span class="km-sub">${kjMoney(s.doneAmt)} of ${kjMoney(s.possible)}</span></div>
    <div class="km-grid">${s.paid.map(tile).join('')||'<div class="km-none">No paid jobs today. Enjoy! ☀️</div>'}</div>
    <div class="km-week-dots">${wk.days.map(x=>`<span class="km-dot ${x.future?'fut':x.s.full?'full':(x.d===tdStr()&&x.s.gate==='pending')?'fut':x.s.counts?'ok':'bad'}${x.d===day?' now':''}">${KJ_DOW[kjDowOf(x.d)]}</span>`).join('')}</div>
  </div>`;
  el.querySelectorAll('.kj-tile').forEach(b=>kjBindTile(b,day));
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
function kjTickKid(){
  const el=document.getElementById('kid-mode');if(!el||el.style.display==='none')return;
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
  try{await kjLoad();}catch(e){body.innerHTML='<div class="empty-state">Couldn\'t load the kids\' jobs.</div>';return;}
  const day=kjDay||tdStr(),today=tdStr();
  const team=kjTeam(day);
  const label=day===today?'Today':day===kjAddDays(today,-1)?'Yesterday':new Date(day+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
  body.innerHTML=`
    <div class="kt-day">
      <button class="kt-step" onclick="kjStep(-1)" aria-label="Previous day">‹</button>
      <div class="kt-day-label">${label}</div>
      <button class="kt-step" onclick="kjStep(1)" ${day>=today?'disabled':''} aria-label="Next day">›</button>
    </div>
    <div class="kt-team"><span>🤝 Team</span><div class="km-bar"><div style="width:${team.pct}%"></div></div><b class="mem-num">${team.pct}%</b></div>
    ${kjKids().map(k=>kjKidCard(k,day)).join('')}
    <div class="mem-sub" style="margin-top:10px">Tap any job to tick or untick it, including timed ones (bath, bed) and past days. Only grown-ups see this screen.</div>`;
  body.querySelectorAll('[data-fix]').forEach(b=>b.onclick=async()=>{
    const job=kjJobs.find(j=>j.id===+b.dataset.fix);if(!job)return;
    const st=kjState(job,day);await kjSet(job,day,st==='done'?null:'done');renderKidsTab();
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
      <span class="kt-ico">${hhEsc(j.icon||'⭐')}</span><span class="kt-title">${hhEsc(j.title)}${by?` <span class="mem-sub">by ${new Date(by).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}</span>`:''}</span>
      ${j.kind==='paid'?`<span class="kt-amt mem-num">${kjMoney(j.amount)}</span>`:''}
      <span class="kt-st">${st==='done'?'✓':st==='missed'?'✕':st==='countdown'?'⏱':''}</span></button>`;};
  return `<div class="kt-card">
    <div class="kt-head">
      <span class="km-av sm" style="background:${k.bg};color:${k.color}">${hhEsc(k.avatar||k.code)}</span>
      <div style="flex:1;min-width:0"><b>${hhEsc(k.name)}</b><div class="mem-sub" style="margin:0">${s.allDone}/${s.all} done · ${kjMoney(s.earned)} today · ${kjMoney(wk.earned)} this week</div></div>
      ${chip}
    </div>
    <div class="km-week-dots sm">${wk.days.map(x=>`<span class="km-dot ${x.future?'fut':x.s.full?'full':(x.d===tdStr()&&x.s.gate==='pending')?'fut':x.s.counts?'ok':'bad'}${x.d===day?' now':''}">${KJ_DOW[kjDowOf(x.d)]}</span>`).join('')}</div>
    <div class="kt-jobs">${s.jobs.map(row).join('')}</div>
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
        <span class="kt-title">${hhEsc(j.title)}<span class="mem-sub" style="display:block;margin:0">${days(j)}${j.by_time?' · by '+j.by_time.slice(0,5):''}${j.parent_confirm?' · grown-up ticks':''}</span></span>
        ${kind==='paid'?`<span class="kt-amt mem-num">${kjMoney(j.amount)}</span>`:''}</button>`).join('')}`).join('')}
    <button class="btn-ok" style="width:100%;margin-top:12px;padding:12px" onclick="kjEditJob(null)">+ Add a job for ${hhEsc(kjName(kjEdKid))}</button>
  </div>`;
}
function kjEditJob(id){
  const j=id?kjJobs.find(x=>x.id===id):{kid:kjEdKid,title:'',icon:'⭐',kind:'paid',days:[0,1,2,3,4,5,6],amount:0.5,by_time:null,parent_confirm:false,sort:99};
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
      <div class="dp-field" style="flex:1" id="kj-amt-f"><label class="dp-label" for="kj-amt">Pay ($)</label><input class="dp-input" id="kj-amt" type="number" step="0.1" min="0" value="${j.amount}"></div>
      <div class="dp-field" style="flex:1"><label class="dp-label" for="kj-by">Countdown to (optional)</label><input class="dp-input" id="kj-by" type="time" value="${j.by_time?j.by_time.slice(0,5):''}"></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 14px"><input type="checkbox" id="kj-pc" ${j.parent_confirm?'checked':''}> A grown-up ticks this one (bath, bed, wake up)</label>
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
    const by=w.querySelector('#kj-by').value;
    const row={kid:j.kid,title,icon:w.querySelector('#kj-icon').value.trim()||'⭐',kind,days:[...days].sort(),
      amount:kind==='paid'?Math.max(0,Math.round((+w.querySelector('#kj-amt').value||0)*100)/100):0,
      by_time:by||null,parent_confirm:w.querySelector('#kj-pc').checked,sort:j.sort};
    try{
      if(id){await api('bravochore_kid_jobs','PATCH',row,`?id=eq.${id}`);Object.assign(j,row);}
      else{const r=await api('bravochore_kid_jobs','POST',row);if(r&&r[0])kjJobs.push(r[0]);}
    }catch(_e){if(typeof chirp==='function')chirp("Didn't save. Try again.");return;}
    w.remove();kjOpenEditor();renderKidsTab();
  };
}
