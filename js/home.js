// ================================================================
// HOME v2 (Oct 2026): calm home for a household app, not a chore scoreboard.
// Today (your tasks + routines), Memories (latest photo, progress, weather
// nudge), Coming up (events). The scoreboard and quick chips move to Tasks.
// Default since 5 Oct 2026. ?home=old brings back the old dashboard on a device, ?home=new undoes that.
// ================================================================
const HOME_V2=(()=>{try{
  const q=new URLSearchParams(location.search);
  if(q.get('home')==='new')localStorage.removeItem('bc_home_old');
  if(q.get('home')==='old')localStorage.setItem('bc_home_old','1');
  return localStorage.getItem('bc_home_old')!=='1';}catch(e){return true;}})();

const homeEsc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------------------------------------------------------------- weather
// Google Weather API, same browser key as Places (site-restricted, capped).
// Cached 30 minutes per device.
async function homeWeather(){
  try{
    const c=JSON.parse(localStorage.getItem('bc_wx')||'null');
    if(c&&c.v===2&&Date.now()-c.ts<30*60*1000)return c;
  }catch(e){}
  const k=typeof MEM_PLACES_KEY!=='undefined'?MEM_PLACES_KEY:'';
  const loc=`location.latitude=${MEM_HOME.lat}&location.longitude=${MEM_HOME.lon}`;
  try{
    const [now,days]=await Promise.all([
      fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?key=${k}&${loc}`).then(r=>r.json()),
      fetch(`https://weather.googleapis.com/v1/forecast/days:lookup?key=${k}&${loc}&days=10&pageSize=10`).then(r=>r.json())
    ]);
    const wx={v:2,ts:Date.now(),
      now:{t:Math.round(now.temperature?.degrees),desc:now.weatherCondition?.description?.text||'',icon:now.weatherCondition?.iconBaseUri||''},
      days:(days.forecastDays||[]).map(f=>{const d=f.displayDate,day=f.daytimeForecast||{};
        return {date:`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`,
          max:Math.round(f.maxTemperature?.degrees),min:Math.round(f.minTemperature?.degrees),
          desc:day.weatherCondition?.description?.text||'',rain:day.precipitation?.probability?.percent??null,
          icon:day.weatherCondition?.iconBaseUri||'',wind:Math.round(day.wind?.speed?.value??NaN),uv:day.uvIndex??null};})};
    if(!isNaN(wx.now.t))localStorage.setItem('bc_wx',JSON.stringify(wx));
    return wx;
  }catch(e){return null;}
}

// ---------------------------------------------------------------- weekend nudge
// One small AI call a day: given the weekend forecast and nearby list items,
// pick one and write one line. Cached per device per day.
async function homeNudge(wx){
  const today=tdStr();
  try{const c=JSON.parse(localStorage.getItem('bc_home_nudge')||'null');if(c&&c.date===today)return c.n;}catch(e){}
  if(!wx||!wx.days.length||typeof memItems==='undefined'||!memItems.length)return null;
  const wkend=wx.days.filter(d=>{const g=new Date(d.date+'T00:00:00').getDay();return g===6||g===0;}).slice(0,2);
  if(!wkend.length)return null;
  const near=memItems.filter(m=>!memIsDone(m.id)&&((m.drive_min!=null&&m.drive_min<=60)||(m.lat!=null&&memKm(MEM_HOME.lat,MEM_HOME.lon,m.lat,m.lon)<=60)))
    .slice(0,90).map(m=>`${m.code} ${m.name}${m.drive_min?` (${m.drive_min} min)`:''}`).join('; ');
  const fc=wkend.map(d=>`${new Date(d.date+'T00:00:00').toLocaleDateString('en-AU',{weekday:'long'})}: ${d.desc}, ${d.min}-${d.max}°C, rain ${d.rain??'?'}%`).join(' | ');
  const sys=`You suggest one family outing for the coming weekend from the Wallis family list (Perth, home Swan View, kids 7, 4 and 1). Forecast: ${fc}.
Nearby items not done yet: ${near}
Pick the single best fit for the weather (indoor if wet, outdoor if fine). If a day is perfect beach weather you may suggest just enjoying the beach instead.
Reply ONLY with JSON: {"code":"item code or null","line":"under 12 words, e.g. 'Sunny Saturday, good for Lake Leschenaultia, 29 min'"}`;
  try{
    const r=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
      body:JSON.stringify({thinking:{type:'disabled'},model:'claude-haiku-4-5-20251001',max_tokens:120,system:sys,messages:[{role:'user',content:'Suggest one.'}]})});
    const d=await r.json();const raw=d.content?.find(c=>c.type==='text')?.text||'';
    const a=raw.indexOf('{'),z=raw.lastIndexOf('}');
    const n=JSON.parse(raw.slice(a,z+1));
    if(!n||!n.line)return null;
    localStorage.setItem('bc_home_nudge',JSON.stringify({date:today,n}));
    return n;
  }catch(e){return null;}
}

// ---------------------------------------------------------------- render
function homeTaskMeta(t,today){
  if(t.due&&t.due<today){const d=Math.round((new Date(today)-new Date(t.due))/86400000);return `<span class="home-late">${d}d overdue</span>`;}
  if(t.due===today)return '<span class="home-today">Today</span>';
  return t.due?`<span class="mem-sub">${fmtDate(t.due)}</span>`:'';
}
async function renderHome(){
  if(typeof autoCompleteEvents==='function')autoCompleteEvents();
  const el=document.getElementById('home-new');if(!el)return;
  const today=tdStr(),hr=new Date().getHours();
  const mine=tasks.filter(t=>!t.done&&t.owner&&t.owner.includes(CU));
  const overdue=mine.filter(t=>t.due&&t.due<today),dueToday=mine.filter(t=>t.due===today);
  const top=[...overdue.sort((a,b)=>a.due.localeCompare(b.due)),...dueToday,
    ...mine.filter(t=>!t.due||t.due>today).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))].slice(0,3);
  const todayLine=[overdue.length?`<span class="home-late">${overdue.length} overdue</span>`:'',
    dueToday.length?`${dueToday.length} due today`:'nothing due today'].filter(Boolean).join(' · ');

  // Routines today, for you (loads routine data once if the Routines tab hasn't yet)
  if(typeof routineItems!=='undefined'&&!routineItems.length&&!window._homeRtTried&&typeof loadScheduleData==='function'){
    window._homeRtTried=true;
    loadScheduleData().then(()=>typeof loadTodayRoutineLogs==='function'&&loadTodayRoutineLogs()).then(()=>{if(document.getElementById('view-dashboard')?.classList.contains('active'))renderHome();}).catch(()=>{});
  }
  let rt='';
  try{
    if(typeof routineItems!=='undefined'&&routineItems.length){
      const dn=new Date().getDay();
      const own=r=>(r.owners||'').split(/[,+\/&\s]+/).some(x=>x.trim()===CU);
      const blocks=routineBlocks.filter(b=>_routineActiveOn(b.days,dn)).map(b=>b.id);
      const todays=routineItems.filter(r=>blocks.includes(r.block_id)&&r.active!==false&&_routineActiveOn(r.days,dn)&&own(r));
      if(todays.length){const dn2=todays.filter(r=>getSchedState('task-'+r.id,false)).length;
        rt=`<button class="home-foot" onclick="bnNav('schedule')">Routines today: ${dn2} of ${todays.length} done <span>›</span></button>`;}
    }
  }catch(e){}

  // Coming up: active events, soonest first
  const evs=events.filter(e=>e.status!=='completed').sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')).slice(0,3);
  const evHtml=evs.length?evs.map(ev=>{
    const et=tasks.filter(t=>t.event_id==ev.id),pct=et.length?Math.round(et.filter(t=>t.done).length/et.length*100):0;
    const dl=ev.due?Math.round((new Date(ev.due+'T00:00:00')-new Date(today+'T00:00:00'))/86400000):null;
    const when=dl==null?'':dl<0?`<span class="home-late">${-dl}d overdue</span>`:dl===0?'Today':dl===1?'Tomorrow':`in ${dl} days`;
    return `<button class="home-row" onclick="openEventPanel(${ev.id})"><span class="home-row-main">${homeEsc(ev.title)}</span>
      <span class="mem-sub">${when}${et.length?` · ${pct}%`:''}</span></button>`;}).join('')
    :'<div class="mem-muted">Nothing planned this week.</div>';

  const wxCached=(()=>{try{return JSON.parse(localStorage.getItem('bc_wx')||'null');}catch(e){return null;}})();
  el.innerHTML=`
    <div class="home-hello">
      <div class="home-greet">${hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'}, ${homeEsc(CUN)}</div>
      <div class="home-date">${new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}<span id="home-wx">${wxCached?homeWxText(wxCached):''}</span></div>
    </div>
    <div class="home-card">
      <div class="home-card-hd"><span class="home-label">Today</span><button class="home-link" onclick="bnNav('tasks')">All tasks ›</button></div>
      <div class="home-sumline">${todayLine}</div>
      <div class="home-tasks">${top.map(t=>taskCard(null,{lite:true,id:'home-t-'+t.id,dataId:t.id,cls:'home-task',
        onTick:`quickTick(${t.id},event)`,onOpen:`openDetail(${t.id})`,title:homeEsc(t.title),meta:homeTaskMeta(t,today)})).join('')||'<div class="mem-muted">You\'re all clear.</div>'}</div>
      ${rt}
    </div>
    <div class="home-card home-mem" id="home-mem"><div class="home-card-hd"><span class="home-label">${homeEsc(MEM_LABEL)}</span></div><div class="mem-muted">Loading…</div></div>
    <div class="home-card">
      <div class="home-card-hd"><span class="home-label">Coming up</span><button class="home-link" onclick="bnNav('events')">Events ›</button></div>
      <div id="home-plans"></div>
      ${evHtml}
    </div>`;
  if(typeof plUpcoming==='function')plUpcoming().then(ps=>{const box=document.getElementById('home-plans');if(!box||!ps.length)return;
    box.innerHTML=ps.map(p=>`<button class="home-row" onclick="plOpenSaved(${p.id})"><span class="home-row-main">${homeEsc(p.title)}</span><span class="mem-sub">${new Date(p.plan_date+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}</span></button>`).join('');
    const empty=box.parentElement.querySelector(':scope > .mem-muted');if(empty)empty.remove();});

  // Slower bits fill in after first paint.
  homeWeather().then(wx=>{const w=document.getElementById('home-wx');if(w&&wx)w.innerHTML=homeWxText(wx);homeFillMemories(wx);});
}
function homeWxText(wx){
  if(!wx||!wx.now||isNaN(wx.now.t))return '';
  return `<span class="home-dot">·</span>${wx.now.icon?`<img class="home-wx-ic" src="${wx.now.icon}.svg" alt="">`:''}${homeEsc(wx.now.desc.toLowerCase())}, ${wx.now.t}°`;
}
async function homeFillMemories(wx){
  const box=document.getElementById('home-mem');if(!box)return;
  try{await memEnsureLoaded();}catch(e){box.querySelector('.mem-muted').textContent="Couldn't load memories.";return;}
  const done=memItems.filter(m=>memIsDone(m.id));
  const lastV=[...memDone].filter(d=>d.done_on).sort((a,b)=>b.done_on.localeCompare(a.done_on))[0];
  const lastM=lastV&&memItems.find(m=>m.id===lastV.memory_id);
  const fam=memPhotos[memPhotos.length-1];
  if(fam)await memSign([fam.path]);
  const famM=fam&&memItems.find(m=>m.id===fam.memory_id);
  const heroSrc=fam?(memSigned[fam.path]||memSigned[fam.thumb_path]):(lastM&&lastM.stock_photo_path)||null;
  const heroFor=fam?famM:lastM;
  const pct=memItems.length?Math.max(1,Math.round(done.length/memItems.length*100)):0;
  box.innerHTML=`
    ${heroSrc?`<button class="home-mem-hero" onclick="${heroFor?`openMemory(${heroFor.id})`:`bnNav('memories')`}"><img src="${heroSrc}" alt=""></button>`:''}
    <div class="home-mem-body">
      <div class="home-card-hd"><span class="home-label">${homeEsc(MEM_LABEL)}</span><button class="home-link" onclick="bnNav('memories')">${done.length} of ${memItems.length} ›</button></div>
      <div class="home-sumline">${lastM?`Last: ${homeEsc(lastM.name)} · ${memFmtY(lastV.done_on)}`:'Nothing ticked yet. Pick a first one.'}</div>
      <div class="home-bar"><div style="width:${done.length?pct:0}%"></div></div>
      <div id="home-nudge"></div>
      <button class="home-foot" onclick="plOpen()">Got a free day? Plan it <span>›</span></button>
    </div>`;
  const n=await homeNudge(wx);
  const nb=document.getElementById('home-nudge');
  if(n&&nb){
    const m=n.code?memItems.find(x=>x.code===n.code):null;
    nb.innerHTML=`<button class="home-nudge" ${m?`onclick="openMemory(${m.id})"`:''}>${homeEsc(n.line)}${m?' ›':''}</button>`;
  }
}

// ---------------------------------------------------------------- wiring
// With v2 on: Home shows the new layout; the scoreboard and quick chips live
// at the top of Tasks. The old dashboard still renders (hidden) so nothing
// that reads its elements breaks.
document.addEventListener('DOMContentLoaded',()=>{
  if(!HOME_V2)return;
  const dash=document.getElementById('view-dashboard');
  const tv=document.getElementById('view-tasks');
  if(!dash||!tv)return;
  dash.classList.add('home-v2');
  const anchor=tv.firstElementChild;
  const h2h=document.getElementById('h2h-card'),qa=dash.querySelector('.quick-actions');
  if(qa){
    // Tasks already has Sprint and + Add in its header; drop the duplicates.
    qa.querySelectorAll('button').forEach(b=>{const oc=b.getAttribute('onclick')||'';if(/openSprintBuilder|openDetail\(null\)/.test(oc))b.remove();});
    anchor.after(qa);
  }
  if(h2h)anchor.after(h2h);
  const origDash=renderDashboard;
  renderDashboard=function(){try{origDash();}catch(e){} renderHome();};
  const origTasks=renderTasksView;
  renderTasksView=function(){origTasks();try{renderHeadToHead();}catch(e){}};
});
