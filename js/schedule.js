// ================================================================
// SCHEDULE MODULE
// ================================================================
// Renders household routine blocks + items from Supabase
// (bravochore_blocks + bravochore_routines). Generic per household —
// no hardcoded routine data. Laundry / fortnight / monthly / longterm
// sub-views still use small hardcoded constants (next migration target).
// ================================================================

const SCHED_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SCHED_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// (DAY_TASKS hardcoded constant removed \u2014 routine data now lives in
//  bravochore_blocks + bravochore_routines on Supabase, loaded into
//  routineBlocks/routineItems by loadHouseholdRoutines(). Generic per
//  household. Original constant content preserved in git history if ever
//  needed for reference.)
const LAUNDRY_DATA = [
  {id:'lau-mon',day:'Monday',text:'Clothes load 1',dayNum:1},
  {id:'lau-tue',day:'Tuesday',text:'Clothes load 2 + sheets (Week A: ours / Week B: kids\u2019)',dayNum:2},
  {id:'lau-wed',day:'Wednesday',text:'Clothes load 3',dayNum:3},
  {id:'lau-thu',day:'Thursday',text:'Clothes load 4 + sheets (Week A: kids\u2019 / Week B: ours)',dayNum:4},
  {id:'lau-fri',day:'Friday',text:'Towels — every week',dayNum:5},
  {id:'lau-sat',day:'Saturday',text:'Catch-up load if needed',dayNum:6},
  {id:'lau-sun',day:'Sunday',text:'Rest — no laundry today',dayNum:0},
];

const FORTNIGHT_DATA = {
  a:[
    {day:'Monday',task:'Deep clean bathrooms'},
    {day:'Tuesday',task:'Wash our sheets & pillowcases → remake bed'},
    {day:'Tuesday',task:'Deep clean kitchen (oven, splashbacks, cupboard fronts, rangehood)'},
    {day:'Thursday',task:'Wash kids’ sheets & pillowcases → remake beds'},
    {day:'Thursday',task:'Deep dust (ceiling fans, blinds, shelves, picture frames)'},
    {day:'Wednesday',task:'Long-term cleaning slot (see Long-Term tab)'},
  ],
  b:[
    {day:'Monday',task:'Vacuum throughout'},
    {day:'Tuesday',task:'Wash kids’ sheets & pillowcases → remake beds'},
    {day:'Tuesday',task:'Deep clean laundry (machine drum, lint traps, tub, surfaces)'},
    {day:'Thursday',task:'Wash our sheets & pillowcases → remake bed'},
    {day:'Thursday',task:'Deep dust (ceiling fans, blinds, shelves, picture frames)'},
    {day:'Wednesday',task:'Long-term cleaning slot (see Long-Term tab)'},
  ],
};

const MONTHLY_ITEMS = [
  {id:'mo-1',text:'Book or review medical & dental appointments for the family'},
  {id:'mo-2',text:'Gift planning — check upcoming birthdays & events, order ahead'},
  {id:'mo-3',text:'Review budget for the month ahead'},
  {id:'mo-4',text:'Restock any low household or baby supplies not caught in weekly shop'},
];

// ---- STATE ----
let schedSub='today';
let schedSelectedDay=new Date().getDay();
let schedView='me';
let schedWeek='a'; // week A or B
let schedState={}; // local state: task-{id} → bool
let longtermItems=[]; // from Supabase
let fortnightView='a';
let schedSlots=[]; // BravoChore tasks slotted into today
// Household-specific routines now come from Supabase (bravochore_blocks + bravochore_routines)
// rather than the old hardcoded DAY_TASKS constant. This makes the app generic
// (any household can have its own routine) and unlocks drag-reorder via sort_order.
let routineBlocks=[];  // [{id, household_code, owner, name, color, icon, sort_order, days, start_time, end_time}]
let routineItems=[];   // [{id, household_code, block_id, title, owners, days, time_label, notes, sort_order, active}]

function getSchedState(key,def){return schedState[key]!==undefined?schedState[key]:def;}
function setSchedState(key,val){schedState[key]=val;saveSchedState();}
function saveSchedState(){try{localStorage.setItem('bc-sched-state',JSON.stringify(schedState));}catch(e){}}
function loadSchedStateLocal(){try{const s=localStorage.getItem('bc-sched-state');if(s)schedState=JSON.parse(s);}catch(e){}}

// Cross-device sync: load TODAY's routine logs from Supabase and merge them
// into schedState (overriding the localStorage cache). Then on every tick we
// upsert into bravochore_routine_logs so other devices pick it up on next load.
async function loadTodayRoutineLogs(){
  if(typeof CU!=='string'||!CU)return;
  const today=tdStr();
  try{
    const logs=await api('bravochore_routine_logs','GET',null,`?log_date=eq.${today}&owner=eq.${CU}`);
    (logs||[]).forEach(log=>{schedState['task-'+log.routine_id]=!!log.done;});
    saveSchedState();
  }catch(e){console.warn('Routine log load failed:',e);}
}

// Upsert a single routine's done state for today via Supabase REST.
// Uses on_conflict + Prefer:resolution=merge-duplicates so we don't need to
// check-then-write. Fire-and-forget — UI is already optimistically updated.
function persistRoutineLog(routineId,done){
  if(typeof CU!=='string'||!CU)return;
  const id=parseInt(routineId,10);
  if(!id)return;
  const today=tdStr();
  const url=`${SB}/rest/v1/bravochore_routine_logs?on_conflict=routine_id,log_date,owner`;
  fetch(url,{
    method:'POST',
    headers:{
      'apikey':SK,
      'Authorization':'Bearer '+SK,
      'Content-Type':'application/json',
      'Prefer':'resolution=merge-duplicates,return=minimal'
    },
    body:JSON.stringify({routine_id:id,owner:CU,log_date:today,done:!!done})
  }).catch(e=>{/* silent — localStorage still has the truth for this device */});
}

async function loadScheduleData(){
  loadSchedStateLocal();
  // Load week state from Supabase
  try{
    const ws=await api('bravochore_week_state','GET',null,`?user_code=eq.${CU}`);
    if(ws&&ws[0]){
      schedWeek=ws[0].current_week||'a';
      // Check new day reset
      const today=tdStr();
      if(ws[0].last_open_date&&ws[0].last_open_date!==today){
        // New day — reset daily tasks
        Object.keys(schedState).forEach(k=>{if(k.startsWith('task-'))delete schedState[k];});
        saveSchedState();
      }
      await api('bravochore_week_state','PATCH',{last_open_date:today,current_week:schedWeek},`?user_code=eq.${CU}`);
    }else{
      await api('bravochore_week_state','POST',[{user_code:CU,current_week:'a',last_open_date:tdStr()}]);
    }
  }catch(e){}
  // Load this household's routine blocks + items from the DB
  try{
    routineBlocks=await api('bravochore_blocks','GET',null,'?order=sort_order.asc')||[];
    routineItems=await api('bravochore_routines','GET',null,'?active=eq.true&order=sort_order.asc')||[];
  }catch(e){
    console.warn('Routine load failed:',e);
    routineBlocks=[];routineItems=[];
  }
  // Load TODAY's routine logs from DB into schedState so cross-device ticks sync
  await loadTodayRoutineLogs();
  // Load long-term tasks
  try{longtermItems=await api('bravochore_longterm_tasks','GET',null,`?user_code=eq.BJ&order=sort_order.asc`);}
  catch(e){longtermItems=[];}
  // Load today's schedule slots (BravoChore tasks)
  try{const yesterday2=new Date();yesterday2.setDate(yesterday2.getDate()-1);const yStr2=yesterday2.toISOString().slice(0,10);
    schedSlots=await api('bravochore_schedule_slots','GET',null,`?slot_date=gte.${yStr2}&user_code=eq.${CU}&order=created_at.desc`);}
  catch(e){schedSlots=[];}
}

function setSchedSub(name,el){
  schedSub=name;
  document.querySelectorAll('.sched-subnav').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sched-subpage').forEach(p=>p.classList.remove('active'));
  if(el)el.classList.add('active');
  const sp=document.getElementById('ssp-'+name);
  if(sp)sp.classList.add('active');
  if(name==='today')renderSchedToday();
  else if(name==='week')renderSchedWeek();
  else if(name==='laundry')renderSchedLaundry();
  else if(name==='fortnight')renderSchedFortnight();
  else if(name==='longterm')renderSchedLongterm();
  else if(name==='monthly')renderSchedMonthly();
}

function setSchedView(v){
  schedView=v;
  // Update button states
  const btns=['me','partner','both'];
  btns.forEach(n=>{
    const b=document.getElementById('sv-'+n);if(!b)return;
    b.style.background=v===n?'var(--green)':'none';
    b.style.color=v===n?'#fff':'var(--tx2)';
    b.style.borderRadius='100px';
  });
  // Always re-render the today view; the owner filter inside renderSchedToday
  // decides which routines actually appear for the chosen view (me / partner / both).
  if(document.getElementById('ssp-today')?.classList.contains('active')){
    renderSchedToday();
  }
}

function toggleSchedWeek(){
  schedWeek=schedWeek==='a'?'b':'a';
  updateWeekPill();
  renderSchedToday();
  api('bravochore_week_state','PATCH',{current_week:schedWeek},`?user_code=eq.${CU}`).catch(()=>{});
}

function updateWeekPill(){
  const p=document.getElementById('week-pill');
  if(p){p.textContent='Week '+schedWeek.toUpperCase();p.style.background=schedWeek==='a'?'var(--al)':'#e0e8f5';p.style.color=schedWeek==='a'?'var(--amber)':'#6a80a0';}
}

function renderSchedDayStrip(){
  const strip=document.getElementById('sched-day-strip');if(!strip)return;
  const todayNum=new Date().getDay();
  strip.innerHTML=SCHED_SHORT.map((d,i)=>{
    let cls='sched-day-btn';
    if(i===todayNum)cls+=' today';
    if(i===schedSelectedDay)cls+=' active';
    return `<button class="${cls}" onclick="schedSetDay(${i})">${d}</button>`;
  }).join('');
}

function schedSetDay(d){schedSelectedDay=d;renderSchedDayStrip();renderSchedToday();}

// True if the given CSV days string ("0,1,2,3,4,5,6") includes today's day-of-week (0=Sun..6=Sat)
function _routineActiveOn(daysCsv,dayNum){
  if(!daysCsv)return false;
  return daysCsv.split(',').map(s=>parseInt(s.trim(),10)).includes(dayNum);
}

// Helper: list of routine items that should appear today inside a given block.
function _routinesForBlockOnDay(blockId,dayNum){
  return routineItems
    .filter(r=>r.block_id===blockId&&r.active!==false&&_routineActiveOn(r.days,dayNum))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
}

function renderSchedToday(){
  renderSchedDayStrip();
  updateWeekPill();
  const dayName=SCHED_DAYS[schedSelectedDay];
  const dayNum=schedSelectedDay;
  const container=document.getElementById('sched-sections');if(!container)return;

  // The blocks/routines in the DB are owned by a household_code (e.g. "WALLIS").
  // Each block has an `owner` field — for now we treat the routines as the
  // household's primary routine set. The "me / partner / both" filter still
  // gates whether you see your-vs-partner routines based on per-routine `owners`.
  // This will become per-user-configurable when we add household onboarding.
  const showBoth=schedView==='both';
  const targetOwner=schedView==='partner'?(typeof getPartnerCode==='function'?getPartnerCode():CU):CU;
  const ownerHas=(ownersCsv,code)=>{
    if(!ownersCsv)return false;
    return ownersCsv.split(/[,+\/&\s]+/).some(t=>t.trim()===code);
  };
  const ownerShow=ownersCsv=>showBoth?true:ownerHas(ownersCsv,targetOwner);

  // Active blocks for this day-of-week
  const activeBlocks=routineBlocks
    .filter(b=>_routineActiveOn(b.days,dayNum))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));

  if(!routineBlocks.length){
    container.innerHTML=`<div style="padding:32px 16px;text-align:center;color:var(--tx2)">
      <div style="font-size:36px;margin-bottom:12px">📋</div>
      <div style="font-size:15px;font-weight:500;color:var(--tx);margin-bottom:8px">No routines yet</div>
      <div style="font-size:13px;line-height:1.6">Routines for your household will appear here once they've been set up.</div>
    </div>`;
    updateSchedProgress(0,0,dayName);
    return;
  }

  let totalTasks=0,doneTasks=0;
  const html=activeBlocks.map(block=>{
    const blockRoutines=_routinesForBlockOnDay(block.id,dayNum).filter(r=>ownerShow(r.owners));
    const checked=blockRoutines.filter(r=>getSchedState('task-'+r.id,false));
    totalTasks+=blockRoutines.length;doneTasks+=checked.length;

    // The "section type" used by the slot picker maps to a normalised name —
    // we use the lower-cased block name. This keeps Brent's existing slot data
    // valid (slot.section_type is a free-text string per slot, no FK).
    const sectionType=(block.name||'').toLowerCase().replace(/\s+/g,'-');
    const blockColor=block.color||'var(--tx2)';
    const blockTime=(block.start_time&&block.end_time)?(block.start_time+'–'+block.end_time):'';
    const itemsHtml=blockRoutines.map(r=>{
      const isChecked=getSchedState('task-'+r.id,false);
      return `<div class="sched-item ${isChecked?'checked':''}" data-routine-id="${r.id}" onclick="toggleSchedItem('${r.id}',this)">
        <div class="sched-item-check">${isChecked?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <span class="sched-item-text">${r.title||''}</span>
        ${r.time_label?`<span class="sched-section-time" style="font-size:10px">${r.time_label}</span>`:''}
      </div>`;
    }).join('');

    // BravoChore tasks slotted into THIS block by the user
    const slottedTasks=schedSlots
      .filter(s=>s.section_type===sectionType||s.section_type===block.name)
      .map(s=>tasks.find(t=>t.id==s.task_id))
      .filter(t=>t&&!t.done);
    const bcTasksHtml=schedView!=='partner'&&slottedTasks.length?
      slottedTasks.map(t=>`<div class="sched-bc-task">${taskCard(t)}</div>`).join(''):'';

    const allDone=blockRoutines.length>0&&checked.length===blockRoutines.length;
    return `<div class="sched-section" data-block-id="${block.id}" id="ss-block-${block.id}">
      <div class="sched-section-hdr" onclick="this.parentElement.classList.toggle('collapsed')">
        <div class="sched-section-dot" style="background:${blockColor}"></div>
        <span class="sched-section-label" style="color:${blockColor}">${block.icon?block.icon+' ':''}${block.name||'Block'}</span>
        ${blockTime?`<span class="sched-section-time">${blockTime}</span>`:''}
        ${blockRoutines.length?`<span class="sched-section-prog ${allDone?'done':''}">${checked.length}/${blockRoutines.length}</span>`:''}
        <span class="sched-section-chevron">▾</span>
      </div>
      <div class="sched-section-body">
        <div class="sched-routine-list" id="sched-routine-list-${block.id}" data-routine-list="1">${itemsHtml}</div>
        ${bcTasksHtml}
        <button class="sched-add-slot-btn" onclick="openSlotTaskSheet('${sectionType}','${block.name||'Block'}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add BravoChore task here
        </button>
      </div>
    </div>`;
  }).join('');

  container.innerHTML=html||`<div class="empty-state">Nothing scheduled for ${dayName}.</div>`;
  updateSchedProgress(doneTasks,totalTasks,dayName);
  checkScheduleNudge();
  // Wire drag-reorder on each block's routine list
  setTimeout(()=>{
    document.querySelectorAll('[data-routine-list="1"]').forEach(list=>{
      if(typeof initRoutineDragList==='function')initRoutineDragList(list);
    });
  },80);
}

function toggleSchedItem(taskId,el){
  const cur=getSchedState('task-'+taskId,false);
  const next=!cur;
  setSchedState('task-'+taskId,next);
  el.classList.toggle('checked',next);
  const chk=el.querySelector('.sched-item-check');
  if(chk)chk.innerHTML=next?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':'';
  // Cross-device sync — fire-and-forget upsert on bravochore_routine_logs
  persistRoutineLog(taskId,next);
  // Recount progress without full re-render
  const dayName=SCHED_DAYS[schedSelectedDay];
  const dayNum=schedSelectedDay;
  let total=0,done=0;
  routineBlocks.filter(b=>_routineActiveOn(b.days,dayNum)).forEach(block=>{
    _routinesForBlockOnDay(block.id,dayNum).forEach(r=>{
      total++;if(getSchedState('task-'+r.id,false))done++;
    });
  });
  updateSchedProgress(done,total,dayName);
  // Update section progress badge
  const secEl=el.closest('.sched-section');
  if(secEl){
    const allItems=secEl.querySelectorAll('.sched-item');
    const allChecked=secEl.querySelectorAll('.sched-item.checked');
    const prog=secEl.querySelector('.sched-section-prog');
    if(prog){
      prog.textContent=`${allChecked.length}/${allItems.length}`;
      prog.className='sched-section-prog'+(allChecked.length===allItems.length&&allItems.length?' done':'');
    }
  }
}

function updateSchedProgress(done,total,dayName){
  const circle=document.getElementById('prog-circle');
  const pct=document.getElementById('prog-pct');
  const label=document.getElementById('prog-label');
  const sub=document.getElementById('prog-sub');
  if(!circle)return;
  if(total===0){
    circle.style.strokeDashoffset=113;
    if(pct)pct.textContent='–';
    if(label)label.textContent=dayName;
    if(sub)sub.textContent='Rest day';
    return;
  }
  const p=Math.round((done/total)*100);
  circle.style.strokeDashoffset=113-(113*p/100);
  if(pct)pct.textContent=p+'%';
  if(label)label.textContent=p===100?'All done! 🎉':p>=75?'Almost there':p>=50?'Good momentum':'Ready to start';
  if(sub)sub.textContent=`${done} of ${total} tasks done`;
}

// ---- WEEK OVERVIEW ----
function renderSchedWeek(){
  const container=document.getElementById('sched-week-content');if(!container)return;
  container.innerHTML=SCHED_DAYS.map((dayName,i)=>{
    // Count active routines for day i across all blocks
    const total=routineItems.filter(r=>r.active!==false&&_routineActiveOn(r.days,i)).length;
    const todayNum=new Date().getDay();
    return `<div class="week-ov-card" onclick="schedSetDay(${i});setSchedSub('today',document.getElementById('ssn-today'))">
      <div class="week-ov-hdr" style="${i===todayNum?'background:var(--gl)':''}">
        <div style="width:8px;height:8px;border-radius:50%;background:${i===todayNum?'var(--green)':'var(--bdrm)'};flex-shrink:0"></div>
        <div class="week-ov-day" style="${i===todayNum?'color:var(--green)':''}">${dayName}${i===todayNum?' — Today':''}</div>
        <span class="week-ov-count">${total} items</span>
        <span style="color:var(--tx3);font-size:14px">›</span>
      </div>
    </div>`;
  }).join('');
}

// ---- LAUNDRY ----
function renderSchedLaundry(){
  const container=document.getElementById('sched-laundry-content');if(!container)return;
  const todayNum=new Date().getDay();
  const weekStart=getWeekStart();
  container.innerHTML=LAUNDRY_DATA.map(row=>{
    const key=`laundry-${weekStart}-${row.dayNum}`;
    const isChecked=getSchedState(key,false);
    const isToday=row.dayNum===todayNum;
    return `<div class="laundry-row ${isChecked?'checked':''}" onclick="toggleLaundryItem('${key}')" style="${row.dayNum===0?'opacity:.5;cursor:default':''}">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <span class="laundry-day-lbl ${isToday?'today-day':''}">${row.day}</span>
      <span class="laundry-txt">${row.text}</span>
    </div>`;
  }).join('')+`<button onclick="resetLaundry()" style="margin-top:10px;padding:8px 16px;border-radius:100px;border:1px solid var(--bdrm);background:none;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--tx2)">Reset weekly laundry</button>`;
}

function toggleLaundryItem(key){setSchedState(key,!getSchedState(key,false));renderSchedLaundry();}
function resetLaundry(){const ws=getWeekStart();LAUNDRY_DATA.forEach(r=>setSchedState(`laundry-${ws}-${r.dayNum}`,false));renderSchedLaundry();}
function getWeekStart(){const d=new Date();d.setDate(d.getDate()-d.getDay()+1);return d.toISOString().slice(0,10);}

// ---- FORTNIGHTLY ----
function setFortnightView(w){
  fortnightView=w;
  const ba=document.getElementById('fn-a-btn'),bb=document.getElementById('fn-b-btn');
  if(ba){ba.style.background=w==='a'?'var(--green)':'none';ba.style.borderColor=w==='a'?'var(--green)':'var(--bdrm)';ba.style.color=w==='a'?'#fff':'var(--tx2)';}
  if(bb){bb.style.background=w==='b'?'#6a80a0':'none';bb.style.borderColor=w==='b'?'#6a80a0':'var(--bdrm)';bb.style.color=w==='b'?'#fff':'var(--tx2)';}
  renderSchedFortnight();
}

function renderSchedFortnight(){
  const container=document.getElementById('sched-fortnight-content');if(!container)return;
  const data=FORTNIGHT_DATA[fortnightView];
  container.innerHTML=data.map((item,i)=>{
    const key=`fn-${fortnightView}-${i}`;
    const isChecked=getSchedState(key,false);
    return `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px;cursor:pointer;${isChecked?'opacity:.55':''}" onclick="toggleFortnight('${key}',${i})">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;${isChecked?'text-decoration:line-through;color:var(--tx3)':''}">${item.task}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:2px">${item.day}</div>
      </div>
    </div>`;
  }).join('')+`<button onclick="resetFortnight()" style="margin-top:6px;padding:7px 14px;border-radius:100px;border:1px solid var(--bdrm);background:none;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--tx2)">Reset Week ${fortnightView.toUpperCase()}</button>`;
}

function toggleFortnight(key){setSchedState(key,!getSchedState(key,false));renderSchedFortnight();}
function resetFortnight(){FORTNIGHT_DATA[fortnightView].forEach((_,i)=>setSchedState(`fn-${fortnightView}-${i}`,false));renderSchedFortnight();}

// ---- LONG-TERM ----
function renderSchedLongterm(){
  const container=document.getElementById('sched-longterm-content');if(!container)return;
  if(!longtermItems.length){container.innerHTML='<div class="empty-state">Loading...</div>';return;}
  container.innerHTML=longtermItems.map(item=>{
    const last=item.last_done;
    let statusText='Not recorded',statusCls='';
    if(last){
      const weeksSince=Math.floor((new Date()-new Date(last))/(7*24*60*60*1000));
      if(weeksSince>12){statusText=weeksSince+'w ago — overdue';statusCls='overdue';}
      else if(weeksSince>8){statusText=weeksSince+'w ago — due soon';statusCls='due-soon';}
      else{statusText=weeksSince+'w ago — ok';statusCls='ok';}
    }
    return `<div class="lt-item">
      <div class="lt-check ${last?'checked':''}" onclick="tickLongterm(${item.id},this)">
        ${last?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0">
        <div class="lt-txt">${item.title}</div>
        <div class="lt-status ${statusCls}" style="font-size:11px;margin-top:2px">${statusText}</div>
      </div>
      <input type="date" class="lt-date-input" value="${last||''}" onchange="setLongtermDate(${item.id},this.value)" onclick="event.stopPropagation()">
    </div>`;
  }).join('');
}

async function tickLongterm(id,el){
  const today=tdStr();
  el.classList.add('checked');
  el.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const item=longtermItems.find(x=>x.id===id);if(item)item.last_done=today;
  try{await api('bravochore_longterm_tasks','PATCH',{last_done:today},`?id=eq.${id}`);}catch(e){}
  renderSchedLongterm();
}

async function setLongtermDate(id,val){
  const item=longtermItems.find(x=>x.id===id);if(item)item.last_done=val;
  try{await api('bravochore_longterm_tasks','PATCH',{last_done:val},`?id=eq.${id}`);}catch(e){}
  renderSchedLongterm();
}

// ---- MONTHLY ----
function renderSchedMonthly(){
  const container=document.getElementById('sched-monthly-content');if(!container)return;
  const monthKey=new Date().toISOString().slice(0,7);
  container.innerHTML=MONTHLY_ITEMS.map(item=>{
    const key=`monthly-${monthKey}-${item.id}`;
    const isChecked=getSchedState(key,false);
    return `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px;cursor:pointer;${isChecked?'opacity:.55':''}" onclick="toggleMonthlyItem('${key}')">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <div style="font-size:13px;flex:1;${isChecked?'text-decoration:line-through;color:var(--tx3)':''}">${item.text}</div>
    </div>`;
  }).join('');
}

function toggleMonthlyItem(key){setSchedState(key,!getSchedState(key,false));renderSchedMonthly();}
function resetMonthlyTasks(){const mk=new Date().toISOString().slice(0,7);MONTHLY_ITEMS.forEach(i=>setSchedState(`monthly-${mk}-${i.id}`,false));renderSchedMonthly();}

// ---- BRAVOCHORE TASK SLOTTING ----
function openSlotTaskSheet(sectionType,sectionLabel){
  const slottedIds=schedSlots.map(s=>s.task_id);
  const available=tasks.filter(t=>!t.done&&!slottedIds.includes(t.id));
  const picker=document.createElement('div');
  picker.setAttribute('data-picker','1');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';
  picker.innerHTML=`<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:700px;max-height:82vh;display:flex;flex-direction:column;padding-bottom:max(16px,env(safe-area-inset-bottom))">
    <div style="padding:14px 16px 10px;border-bottom:1px solid var(--bdr);background:var(--surf);border-radius:20px 20px 0 0;flex-shrink:0">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500;margin-bottom:2px">Add to ${sectionLabel}</div>
      <div style="font-size:11px;color:var(--tx2)">Tap to slot a BravoChore task into today</div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:6px 14px">
      ${available.length?available.map(t=>{
        const o=getOwner(t.owner);
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="confirmSlotTask(${t.id},'${sectionType}',this)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${t.title}</div>
            <div style="display:flex;gap:5px;margin-top:3px;align-items:center">
              <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
              ${t.due?`<span class="task-date ${t.due<tdStr()?'ov':''}">${fmtDate(t.due)}</span>`:''}
              ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
            </div>
          </div>
          <span style="color:var(--green);font-size:22px;font-weight:300">+</span>
        </div>`;
      }).join(''):'<p style="padding:20px;text-align:center;color:var(--tx2);font-size:13px">All tasks are already scheduled for today or none are pending.</p>'}
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--bdr);flex-shrink:0">
      <button onclick="this.closest('[data-picker]').remove()" style="width:100%;padding:11px;background:none;border:1px solid var(--bdrm);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;color:var(--tx2)">Cancel</button>
    </div>
  </div>`;
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
}

// Wrapper called from the picker onclick — properly awaits slotTaskToday
// before closing the picker and re-rendering. Previously the inline handler
// fired the async slot insert AND renderSchedToday() in the same tick, so
// the re-render ran before schedSlots.push and the user saw "nothing happened".
async function confirmSlotTask(taskId,sectionType,rowEl){
  // Visual feedback immediately so the tap feels responsive
  if(rowEl){rowEl.style.opacity='.5';rowEl.style.pointerEvents='none';}
  try{
    await slotTaskToday(taskId,sectionType);
  }catch(e){
    chirp('Could not slot task — try again.');
    if(rowEl){rowEl.style.opacity='';rowEl.style.pointerEvents='';}
    return;
  }
  // Close the picker (any was open via [data-picker]) and re-render the schedule
  document.querySelectorAll('[data-picker]').forEach(p=>p.remove());
  if(typeof renderSchedToday==='function')renderSchedToday();
  if(typeof chirp==='function')chirp('Slotted into '+sectionType+'.');
}

async function slotTaskToday(taskId,sectionType){
  const ns={task_id:taskId,user_code:CU,slot_date:tdStr(),section_type:sectionType};
  try{
    const res=await api('bravochore_schedule_slots','POST',[ns]);
    if(res&&res[0])schedSlots.push(res[0]);else schedSlots.push({...ns,id:Date.now()});
  }catch(e){schedSlots.push({...ns,id:Date.now()});}
}

// ---- BLACKBIRD NUDGE ----
async function checkScheduleNudge(){
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yStr=yesterday.toISOString().slice(0,10);
  try{
    const ack=await api('bravochore_nudges_ack','GET',null,`?user_code=eq.${CU}&ack_date=eq.${tdStr()}`);
    if(ack&&ack.length)return;
  }catch(e){}
  // Filter by who the user is currently viewing, not by who is logged in.
  // schedView 'partner' on a BW login means show BJ's misses, etc.
  // Use exact token matching on the owner string so that 'BW' does NOT
  // match owner='BJ', and a task owned only by the partner doesn't leak
  // into the user's own routines view (composite owners like 'BW+BJ' still
  // match both codes, which is correct — the task IS partly each person's).
  const showBoth=schedView==='both';
  const displayedOwner=schedView==='partner'?getPartnerCode():CU;
  const ownerHas=(taskOwner,code)=>{
    if(!taskOwner)return false;
    return taskOwner.split(/[,+\/&\s]+/).some(t=>t.trim()===code);
  };
  const ownerMatch=t=>showBoth?true:ownerHas(t.owner,displayedOwner);
  const slotMatch=s=>showBoth?true:s.user_code===displayedOwner;
  const yesterSlots=schedSlots.filter(s=>s.slot_date===yStr&&!s.completed_at&&slotMatch(s));
  const missedTasks=yesterSlots.map(s=>tasks.find(t=>t.id==s.task_id)).filter(Boolean);
  const overdueTasks=tasks.filter(t=>!t.done&&t.due&&t.due<tdStr()&&ownerMatch(t)).slice(0,5);
  const allMissed=[...missedTasks,...overdueTasks.filter(t=>!missedTasks.find(m=>m.id===t.id))];
  if(!allMissed.length)return;
  const nudge=document.getElementById('sched-nudge');
  const list=document.getElementById('sched-nudge-list');
  if(!nudge||!list)return;
  const scheduled=missedTasks.map(t=>`<div style="padding:2px 0">📌 ${t.task_code||''} ${t.title}</div>`).join('');
  const overdue=overdueTasks.filter(t=>!missedTasks.find(m=>m.id===t.id)).map(t=>`<div style="padding:2px 0">⏰ ${t.task_code||''} ${t.title}</div>`).join('');
  list.innerHTML=(scheduled?`<div style="font-size:11px;font-weight:700;color:var(--gd);margin-bottom:3px">From yesterday's schedule:</div>${scheduled}`:'')+(overdue?`<div style="font-size:11px;font-weight:700;color:var(--amber);margin:5px 0 3px">Also overdue:</div>${overdue}`:'');
  nudge.style.display='block';
  if(typeof lottie!=='undefined'){
    const nb=document.getElementById('sched-nudge-bird');
    if(nb&&!nb.dataset.init){nb.dataset.init='1';const a=lottie.loadAnimation({container:nb,renderer:'svg',loop:false,autoplay:false,animationData:BLACKBIRD_ANIM});a.addEventListener('DOMLoaded',()=>a.goToAndStop(8,true));}
  }
}

async function dismissNudge(){
  document.getElementById('sched-nudge').style.display='none';
  try{await api('bravochore_nudges_ack','POST',[{user_code:CU,ack_date:tdStr()}]);}catch(e){}
}

// Entry point called from bnNav
async function initScheduleView(){
  // Render synchronously first so something appears immediately, even before data loads
  try{
    const meBtn=document.getElementById('sv-me');
    const partnerBtn=document.getElementById('sv-partner');
    if(meBtn)meBtn.textContent=CU;
    if(partnerBtn)partnerBtn.textContent=getPartnerCode();
    setSchedSub('today',document.getElementById('ssn-today'));
  }catch(e){console.warn('Schedule pre-render warning:',e);}
  // Then load data and re-render today with the fresh data
  try{await loadScheduleData();}catch(e){console.warn('Schedule data load failed:',e);}
  try{
    setSchedView(schedView);
    if(schedSub==='today')renderSchedToday();
  }catch(e){console.warn('Schedule re-render warning:',e);}
}

// ================================================================
// ROUTINE DRAG-REORDER
// ================================================================
// Wires HTML5 drag-and-drop on each block's routine list so routines can be
// reordered within their block. Persists via PATCH on bravochore_routines.sort_order.
// Click-to-tick still works (HTML5 drag only fires on actual drag motion).
function initRoutineDragList(list){
  if(!list||list.dataset.dragInit==='1')return;
  list.dataset.dragInit='1';
  let dragSrc=null;
  list.querySelectorAll('.sched-item').forEach(item=>{
    item.draggable=true;
    item.addEventListener('dragstart',e=>{
      dragSrc=item;
      item.style.opacity='0.45';
      try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.dataset.routineId||'');}catch(err){}
    });
    item.addEventListener('dragend',()=>{
      item.style.opacity='';
      if(dragSrc){persistRoutineOrder(list);}
      dragSrc=null;
    });
    item.addEventListener('dragover',e=>{
      e.preventDefault();
      if(!dragSrc||dragSrc===item)return;
      const rect=item.getBoundingClientRect();
      const after=(e.clientY-rect.top)/(rect.bottom-rect.top)>0.5;
      if(after)item.parentNode.insertBefore(dragSrc,item.nextSibling);
      else item.parentNode.insertBefore(dragSrc,item);
    });
  });
}

async function persistRoutineOrder(list){
  const ids=Array.from(list.querySelectorAll('.sched-item'))
    .map(it=>parseInt(it.dataset.routineId,10))
    .filter(n=>!isNaN(n));
  if(!ids.length)return;
  // Update local cache so subsequent renders reflect the new order without a re-fetch
  ids.forEach((id,i)=>{
    const r=routineItems.find(x=>x.id===id);
    if(r)r.sort_order=i+1;
  });
  if(typeof badge==='function')badge('sy','↻');
  try{
    await Promise.all(ids.map((id,i)=>api('bravochore_routines','PATCH',{sort_order:i+1},`?id=eq.${id}`)));
    if(typeof badge==='function')badge('ok','✓');
  }catch(e){
    if(typeof badge==='function')badge('er','⚠');
  }
}

// Returns the partner code for the current user — first non-CU active person in the household
function getPartnerCode(){
  const others=people.filter(p=>p.code!==CU);
  if(!others.length)return CU;
  // Prefer BJ↔BW pairing if both exist
  if(CU==='BW'&&others.some(p=>p.code==='BJ'))return 'BJ';
  if(CU==='BJ'&&others.some(p=>p.code==='BW'))return 'BW';
  return others[0].code;
}

