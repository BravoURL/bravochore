// ================================================================
// USER
// ================================================================
function buildUserPicker(){
  const c=document.getElementById('user-cards-container');
  const visible=people.filter(p=>p.code!=='Pete');
  const cards=visible.map(p=>`
    <div class="user-card" onclick="selectUser('${p.code}','${p.name}')">
      <div class="ua" style="background:${p.bg};color:${p.color}">${p.code}</div>
      <h3>${p.name}</h3><p>Your tasks, your dashboard</p>
    </div>`).join('');
  // Always offer to add another household member from the picker. This is
  // critical for solo users coming out of onboarding — Brent reported losing
  // Bernadette / Pete after a cache-clear and not knowing how to get them
  // back. Settings has the manager too, but the picker is where you notice
  // the absence first.
  const addCard=`
    <div class="user-card" onclick="addPersonFromPicker()" style="border:1.5px dashed var(--bdrm);background:var(--surf2);box-shadow:none">
      <div class="ua" style="background:var(--gl);color:var(--gd)">+</div>
      <h3>Add household member</h3>
      <p>${visible.length===1?'Add Bernadette, Pete, anyone — share tasks across the household':'Add another person'}</p>
    </div>`;
  c.innerHTML=cards+addCard;
}

// Quick "add household member" flow surfaced from the picker (also reachable
// from Settings → People). Adds the new person, refreshes the picker so they
// can be selected straight away.
async function addPersonFromPicker(){
  if(typeof promptSheet!=='function'){chirp('Module loading — try again in a moment.');return;}
  const result=await promptSheet({
    title:'Add household member',
    subtitle:"They'll appear on the user picker and can be assigned tasks.",
    confirmLabel:'Add',
    fields:[
      {name:'name',label:'Name',required:true,placeholder:'e.g. Bernadette'},
      {name:'code',label:'Short code',required:true,placeholder:'e.g. B or BJ (uppercase)'}
    ]
  });
  if(!result)return;
  const name=result.name.trim();
  const code=(result.code||'').toUpperCase().trim();
  if(!name||!code)return;
  if(people.find(p=>p.code===code)){chirp('That code is already in use.');return;}
  const palette=[
    {bg:'#FAEEDA',color:'#854F0B'},
    {bg:'#EAF3DE',color:'#3B6D11'},
    {bg:'#FCE4EC',color:'#C2185B'},
    {bg:'#EDE7FF',color:'#5E35B1'},
    {bg:'#FFF3E0',color:'#E65100'},
    {bg:'#E6F1FB',color:'#185FA5'}
  ];
  const colour=palette[people.length%palette.length];
  people.push({code,name,bg:colour.bg,color:colour.color});
  if(typeof savePeople==='function')savePeople();
  buildUserPicker();
  if(typeof renderExtraFilters==='function')renderExtraFilters();
  chirp(name+' added.');
}
function selectUser(code,name){
  CU=code;CUN=name;
  localStorage.setItem('bc_user',code);localStorage.setItem('bc_username',name);
  document.getElementById('user-picker').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('bb-fab').style.display='flex';
  setupPill();renderExtraFilters();renderDashboard();initLottie();assignMissingCodes();loadPrefs();setTimeout(checkForActiveSprint,1500);document.getElementById('bn-dashboard')?.classList.add('active');
  setTimeout(()=>chirp("Let's get this done."),800);
  bbMsg("Hey — I'm Blackbird. Tap the bird icon on any task for advice, or just ask me anything.",'from-bb');
}
function switchUser(){document.getElementById('user-picker').style.display='flex';document.getElementById('app').style.display='none';buildUserPicker();}
function setupPill(){
  const o=getOwner(CU);
  const pa=document.getElementById('pill-av');
  pa.style.background=o.bg;pa.style.color=o.color;pa.textContent=CU;
  document.getElementById('pill-name').textContent=CUN;
}
function renderExtraFilters(){
  const el=document.getElementById('extra-person-filters');
  if(!el)return;
  const extras=people.filter(p=>p.code!=='BW'&&p.code!=='BJ'&&p.code!=='Pete');
  el.innerHTML=extras.map(p=>`<div class="filter-chip" data-fw="${p.code}" onclick="setFW(this,'${p.code}')" style="display:inline-block">${p.name}</div>`).join('');
}

// ================================================================
// NAV
// ================================================================
function bnNav(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.bn-tab').forEach(t=>t.classList.remove('active'));
  const vEl=document.getElementById('view-'+name);
  if(vEl)vEl.classList.add('active');
  const bEl=document.getElementById('bn-'+name);
  if(bEl)bEl.classList.add('active');
  if(name==='tasks'){renderTasksView();setTimeout(()=>{initDrag();initTaskBirds();},80);}
  else if(name==='shopping')renderShopping();
  else if(name==='schedule'){initScheduleView();}
  else if(name==='events'){loadEvents().then(renderEvents);}
  else if(name==='shelved'){loadEvents().then(renderShelved);}
  else renderDashboard();
}
function showView(name,tab){bnNav(name);}
let focusMode=null,focusWho='all',focusBucket='all';

function applyFilterForOwner(mode,ownerCode){
  focusMode=mode;focusWho=ownerCode;focusBucket='all';
  renderFocusSheet();
  document.getElementById('focus-modal').classList.add('open');
}
function applyFilter(mode){
  focusMode=mode;focusWho='all';focusBucket='all';
  renderFocusSheet();
  document.getElementById('focus-modal').classList.add('open');
}

function closeFocus(){document.getElementById('focus-modal').classList.remove('open');}

function focusSeeAll(){
  closeFocus();
  filterMode=focusMode;filterWho=focusWho;filterBucket=focusBucket;
  document.querySelectorAll('[data-fw]').forEach(e=>e.classList.toggle('active',e.dataset.fw===focusWho||(focusWho==='all'&&e.dataset.fw==='all')));
  document.querySelectorAll('[data-fb]').forEach(e=>e.classList.toggle('active',e.dataset.fb===focusBucket||(focusBucket==='all'&&e.dataset.fb==='all')));
  bnNav('tasks');
}

function setFocusWho(code,el){
  focusWho=code;
  document.querySelectorAll('#focus-filters [data-ffw]').forEach(e=>e.classList.toggle('active',e.dataset.ffw===code));
  renderFocusSheet();
}

function setFocusBucket(b,el){
  focusBucket=b;
  document.querySelectorAll('#focus-filters [data-ffb]').forEach(e=>e.classList.toggle('active',e.dataset.ffb===b));
  renderFocusSheet();
}

function renderFocusSheet(){
  const today=tdStr();
  const titles={overdue:'🐢 Overdue',quickwin:'🔥 Quick Wins'};
  const subtitles={overdue:'These need attention — tackle them first',quickwin:'Fast wins — build momentum'};
  document.getElementById('focus-title').textContent=titles[focusMode]||'Focus';
  document.getElementById('focus-subtitle').textContent=subtitles[focusMode]||''
  // Filters
  const fEl=document.getElementById('focus-filters');
  const peopleChips=people.filter(p=>p.code!=='Pete').map(p=>`<div class="filter-chip ${focusWho===p.code?'active':''}" data-ffw="${p.code}" onclick="setFocusWho('${p.code}',this)">${p.name}</div>`).join('');
  fEl.innerHTML=`<div class="filter-chip ${focusWho==='all'?'active':''}" data-ffw="all" onclick="setFocusWho('all',this)">All</div>${peopleChips}
    <div class="filter-chip ${focusBucket==='all'?'active':''}" data-ffb="all" onclick="setFocusBucket('all',this)" style="margin-left:8px">All</div>
    <div class="filter-chip ${focusBucket==='Indoor'?'active':''}" data-ffb="Indoor" onclick="setFocusBucket('Indoor',this)">Indoor</div>
    <div class="filter-chip ${focusBucket==='Outdoor'?'active':''}" data-ffb="Outdoor" onclick="setFocusBucket('Outdoor',this)">Outdoor</div>`;
  // Filter tasks
  let filtered=tasks.filter(t=>!t.done);
  if(focusWho!=='all')filtered=filtered.filter(t=>t.owner&&t.owner.includes(focusWho));
  if(focusBucket!=='all')filtered=filtered.filter(t=>t.bucket===focusBucket);
  if(focusMode==='overdue')filtered=filtered.filter(t=>t.due&&t.due<today).sort((a,b)=>(a.due||'').localeCompare(b.due||'')).slice(0,5);
  else if(focusMode==='quickwin')filtered=filtered.filter(t=>getEffectiveTime(t)<=0.5).sort((a,b)=>getEffectiveTime(a)-getEffectiveTime(b)).slice(0,5);
  // Render cards
  const body=document.getElementById('focus-body');
  if(!filtered.length){
    body.innerHTML=`<div class="focus-empty"><div class="focus-empty-icon">${focusMode==='overdue'?'🎉':'⚡'}</div><p>${focusMode==='overdue'?"Nothing overdue. You're on top of it.":"No quick wins available with these filters."}</p></div>`;
    return;
  }
  body.innerHTML=filtered.map(task=>{
    const today2=tdStr();
    const ov=task.due&&task.due<today2;
    const ds=task.due&&task.due===today2;
    const ms=getMs(task.id);
    const msDone=ms.filter(m=>m.done).length;
    const o=getOwner(task.owner);
    const timeH=getEffectiveTime(task);
    const msBar=ms.length?`<div class="focus-ms-bar">
      <div class="focus-ms-label">${msDone}/${ms.length} milestones</div>
      <div class="focus-ms-dots">${ms.map(m=>`<div class="focus-dot ${m.done?'d':'p'}" title="${m.title}"></div>`).join('')}</div>
    </div>`:'';
    return `<div class="focus-card ${ov?'overdue':ds?'due-soon':''}" id="fc-${task.id}">
      <div class="focus-card-inner">
        <div class="focus-card-title">${task.title}</div>
        <div class="focus-card-meta">
          <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
          <span class="task-bucket-b">${task.bucket}</span>
          ${task.due?`<span class="task-date ${ov?'ov':ds?'ds':''}">${fmtDate(task.due)}</span>`:''}
          ${timeH?`<span class="task-time-b">${fmtHours(timeH)}</span>`:''}
        </div>
        ${msBar}
        <div class="focus-actions">
          <button class="focus-tick" onclick="focusTick(${task.id})">✓ Done</button>
          ${focusMode==='overdue'?`<button class="focus-open" style="background:var(--al);color:var(--amber);border-color:var(--amber)" onclick="focusReschedule(${task.id},event)">📅 Reschedule</button>`:''}
          <button class="focus-open" onclick="closeFocus();openDetail(${task.id})">Open</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function focusReschedule(taskId, evt){
  evt.stopPropagation();
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  // Show a quick date picker inline
  const card=document.getElementById('fc-'+taskId);if(!card)return;
  // Remove any existing picker
  card.querySelector('.fc-date-picker')?.remove();
  const today=tdStr();
  const options=[
    {label:'Tomorrow',date:()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);}},
    {label:'In 3 days',date:()=>{const d=new Date();d.setDate(d.getDate()+3);return d.toISOString().slice(0,10);}},
    {label:'Next week',date:()=>{const d=new Date();d.setDate(d.getDate()+7);return d.toISOString().slice(0,10);}},
    {label:'Next month',date:()=>{const d=new Date();d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10);}},
  ];
  const picker=document.createElement('div');
  picker.className='fc-date-picker';
  picker.style.cssText='margin-top:10px;padding:10px;background:var(--surf2);border-radius:var(--rs);border:1px solid var(--bdrm)';
  picker.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--tx2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Reschedule to when?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      ${options.map(o=>`<button onclick="doReschedule(${taskId},'${o.date()}')" style="padding:6px 12px;border-radius:100px;border:1.5px solid var(--bdrm);background:var(--surf);font-size:12px;font-weight:600;cursor:pointer;color:var(--tx2)">${o.label}</button>`).join('')}
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <input type="date" id="fc-custom-date-${taskId}" min="${today}" style="flex:1;padding:7px 10px;border:1.5px solid var(--bdrm);border-radius:var(--rs);font-size:12px;background:var(--surf)">
      <button onclick="doReschedule(${taskId},document.getElementById('fc-custom-date-${taskId}').value)" style="padding:7px 14px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer">Set</button>
    </div>`;
  card.appendChild(picker);
}
async function doReschedule(taskId, newDate){
  if(!newDate){chirp('Please pick a date.');return;}
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  task.due=newDate;
  document.getElementById('fc-'+taskId)?.remove();
  try{await api('bravochore_tasks','PATCH',{due:newDate},`?id=eq.${taskId}`);}catch(e){}
  rerender();renderFocusSheet();
  chirp('Rescheduled to '+fmtDate(newDate));
}
async function focusTick(id){
  const task=tasks.find(t=>t.id===id);if(!task)return;
  task.done=true;playChime('task');spawnConfettiCenter();
  document.getElementById('fc-'+id)?.remove();
  rerender();
  try{await api('bravochore_tasks','PATCH',{done:true},`?id=eq.${id}`);}catch(e){}
  // Re-render focus sheet to pull in next task
  renderFocusSheet();
}

// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard(){
  const today=tdStr();
  const allI=allItems();
  const done=allI.filter(i=>i.done);
  const overdue=tasks.filter(t=>t.due&&t.due<today&&!t.done);
  const todayDue=tasks.filter(t=>t.due===today&&!t.done);
  const doneThisWeek=tasks.filter(t=>{
    if(!t.done||!t.actual_time_hours)return t.done;
    return t.done;
  }).slice(0,10); // approximate — no updated_at on tasks yet
  const doneCount=tasks.filter(t=>t.done).length;
  const totalCount=tasks.length;
  const myPending=tasks.filter(t=>t.owner&&t.owner.includes(CU)&&!t.done)
    .sort((a,b)=>(a.sort_order||999)-(b.sort_order||999)).slice(0,6);

  // Greeting
  const hr=new Date().getHours();
  document.getElementById('dash-greeting').textContent=`${hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'}, ${CUN}`;
  document.getElementById('dash-date').textContent=new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // 4 household snapshot tiles
  document.getElementById('metric-grid').innerHTML=`
    <div class="metric-card ${doneCount?'mc-green':''}" style="cursor:pointer" onclick="showDoneList()">
      <div class="metric-label">Done</div>
      <div class="metric-value">${doneCount}</div>
      <div class="metric-sub">of ${totalCount} tasks</div>
    </div>
    <div class="metric-card ${overdue.length?'mc-red':''}" style="cursor:pointer" onclick="applyFilter('overdue')">
      <div class="metric-label">Overdue</div>
      <div class="metric-value">${overdue.length}</div>
      <div class="metric-sub">${overdue.length?'tap to view':'all clear'}</div>
    </div>
    <div class="metric-card ${todayDue.length?'mc-amber':''}" style="cursor:pointer" onclick="applyFilter('today')">
      <div class="metric-label">Due today</div>
      <div class="metric-value">${todayDue.length}</div>
      <div class="metric-sub">${todayDue.length?'tap to view':'nothing due'}</div>
    </div>
    <div class="metric-card" style="cursor:pointer" onclick="bnNav('tasks')">
      <div class="metric-label">Active</div>
      <div class="metric-value">${tasks.filter(t=>!t.done&&t.status!=='shelved').length}</div>
      <div class="metric-sub">tasks in progress</div>
    </div>`;

  // Head-to-head — Brent vs Bernadette friendly comparison
  renderHeadToHead();

  // Active events strip
  const activeEvents=events.filter(e=>e.status!=='completed');
  const evStrip=document.getElementById('dash-events-strip');
  if(evStrip){
    if(activeEvents.length){
      evStrip.innerHTML=activeEvents.map(ev=>{
        const evTasks=tasks.filter(t=>t.event_id==ev.id);
        const evDone=evTasks.filter(t=>t.done).length;
        const pct=evTasks.length?Math.round((evDone/evTasks.length)*100):0;
        const daysLeft=ev.due?Math.ceil((new Date(ev.due+'T00:00:00')-new Date())/86400000):null;
        const color=ev.color||'var(--green)';
        return `<div class="dash-event-strip" onclick="bnNav('events')" style="--ec:${color}">
          <div class="dash-event-info">
            <div class="dash-event-name">${ev.title}</div>
            <div class="dash-event-meta">${daysLeft!==null?(daysLeft<0?Math.abs(daysLeft)+'d overdue':daysLeft===0?'Today':daysLeft+'d away'):'No date'} · ${evDone}/${evTasks.length} tasks done</div>
          </div>
          <div class="dash-event-pct" style="color:${color}">${pct}%</div>
        </div>`;
      }).join('');
    }else{
      evStrip.innerHTML=`<div class="dash-no-events" onclick="bnNav('events')">
        <p>No active events — <span>create one →</span></p>
      </div>`;
    }
  }

  // Your tasks
  document.getElementById('my-done-ct').textContent=`${tasks.filter(t=>t.owner&&t.owner.includes(CU)&&t.done).length} done`;
  document.getElementById('my-tasks-list').innerHTML=myPending.length
    ?myPending.map(taskCard).join('')
    :'<div class="empty-state">All your tasks are done. 🎉</div>';

  // Overdue
  document.getElementById('overdue-count').textContent=overdue.length?overdue.length+' tasks':'';
  if(overdue.length){
    const byOwner={};
    overdue.forEach(t=>{const o=t.owner||'?';if(!byOwner[o])byOwner[o]=[];byOwner[o].push(t);});
    const owners=Object.keys(byOwner);
    if(owners.length>1){
      document.getElementById('overdue-list').innerHTML=owners.map(code=>{
        const o=getOwner(code);const ts=byOwner[code];
        return `<div style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;cursor:pointer" onclick="applyFilterForOwner('overdue','${code}')">
            <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
            <span style="font-size:11px;color:var(--tx3)">${ts.length} overdue</span>
            <span style="font-size:11px;color:var(--green);margin-left:auto">See all →</span>
          </div>
          ${ts.slice(0,2).map(taskCard).join('')}
          ${ts.length>2?`<div style="font-size:11px;color:var(--tx2);padding:6px 4px;cursor:pointer" onclick="applyFilter('overdue')">+${ts.length-2} more →</div>`:''}
        </div>`;
      }).join('');
    }else{
      document.getElementById('overdue-list').innerHTML=overdue.map(taskCard).join('');
    }
  }else{
    document.getElementById('overdue-list').innerHTML='<div class="empty-state">Nothing overdue.</div>';
  setTimeout(initTaskBirds,150);
  
  }

  // Done this week
  const doneAll=tasks.filter(t=>t.done);
  document.getElementById('done-week-count').textContent=doneAll.length?doneAll.length+' tasks':'';
  document.getElementById('done-week-list').innerHTML=doneAll.length
    ?`<div class="completed-list">${doneAll.slice(0,5).map(taskCard).join('')}${doneAll.length>5?`<div style="font-size:11px;color:var(--tx2);padding:6px 4px;cursor:pointer" onclick="showDoneList()">+${doneAll.length-5} more completed tasks →</div>`:''}</div>`
    :'';
}

function showDoneList(){
  // Navigate to all tasks with completed section expanded
  bnNav('tasks');
  setTimeout(()=>{
    const ct=document.querySelector('.completed-toggle');
    if(ct&&!ct.nextElementSibling?.classList.contains('open'))ct.click();
    ct?.scrollIntoView({behavior:'smooth',block:'start'});
  },200);
}

// ── HEAD-TO-HEAD: friendly Brent-vs-Bernadette comparison on the dashboard ──
// Three rows: Done (lifetime), Pending, and Due this week. Leader's number is
// emphasised — green and slightly larger. No leaderboard, no copy. Just numbers.
function renderHeadToHead(){
  const host=document.getElementById('h2h-card');
  if(!host)return;
  // Identify the two primary household members. Default to BW + BJ if present;
  // otherwise fall back to the first two non-system people in the people list.
  const primaryCodes=['BW','BJ'];
  const a=people.find(p=>p.code===primaryCodes[0])||people[0];
  const b=people.find(p=>p.code===primaryCodes[1])||people[1];
  if(!a||!b||a.code===b.code){host.innerHTML='';return;}
  // Counts (ignore shelved tasks throughout)
  const active=tasks.filter(t=>t.status!=='shelved');
  const tally=(code,pred)=>active.filter(t=>t.owner&&t.owner.includes(code)&&pred(t)).length;
  const aDone=tally(a.code,t=>t.done);
  const bDone=tally(b.code,t=>t.done);
  const aPend=tally(a.code,t=>!t.done);
  const bPend=tally(b.code,t=>!t.done);
  // "This week" = due in next 7 days OR today (open tasks)
  const today=tdStr();
  const wkAhead=new Date();wkAhead.setDate(wkAhead.getDate()+7);
  const wk=wkAhead.toISOString().slice(0,10);
  const aWeek=tally(a.code,t=>!t.done&&t.due&&t.due>=today&&t.due<=wk);
  const bWeek=tally(b.code,t=>!t.done&&t.due&&t.due>=today&&t.due<=wk);
  // Higher-is-better for Done; lower-is-better for Pending and This week.
  // Leader logic per row:
  const row=(label,aVal,bVal,higherIsBetter)=>{
    let aCls='h2h-num',bCls='h2h-num';
    if(aVal===bVal&&aVal>0){aCls+=' tied';bCls+=' tied';}
    else if(aVal!==bVal){
      const aIsLeading=higherIsBetter?aVal>bVal:aVal<bVal;
      if(aIsLeading)aCls+=' lead'; else bCls+=' lead';
    }
    return `<div class="h2h-row">
      <span class="h2h-label">${label}</span>
      <span class="h2h-side"><span class="${aCls}">${aVal}</span><span class="h2h-name">${a.name}</span></span>
      <span class="h2h-vs">vs</span>
      <span class="h2h-side right"><span class="h2h-name">${b.name}</span><span class="${bCls}">${bVal}</span></span>
    </div>`;
  };
  host.innerHTML=`<div class="h2h">
    ${row('Done',aDone,bDone,true)}
    ${row('This wk',aWeek,bWeek,false)}
    ${row('Pending',aPend,bPend,false)}
  </div>`;
}


// (renderPace and setPaceView removed — superseded by H2H head-to-head dashboard.
//  Re-add only if a per-person pace/efficiency tile returns.)

// ================================================================
// TASK CARD
// ================================================================
// Canonical task-card renderer — used by Tasks, Events panel, Sprint, Schedule
// slotted, and any other view that shows a task. Per BRAND.md: "Cards — A 'task
// card' is the same shape across every bucket… do not build a new task-card
// variant inside another file."
function taskCard(task){
  const today=tdStr();
  const ov=!task.done&&task.due&&task.due<today;
  const ds=!task.done&&task.due&&task.due===today;
  const ms=getMs(task.id);
  const msDone=ms.filter(m=>m.done).length;
  const msPct=ms.length?msDone/ms.length:0;
  const timeH=getEffectiveTime(task);
  const dots=ms.length?`<div class="ms-dots">${ms.map(m=>`<div class="ms-dot ${m.done?'d':'p'}" title="${m.title}"></div>`).join('')}</div>`:'';
  const o=getOwner(task.owner);
  return `<div class="task-card ${ov?'overdue':ds?'due-soon':''} ${task.done?'done':''}" id="tc-${task.id}" data-id="${task.id}" draggable="true">
    ${ms.length&&!task.done?`<div class="task-wash" style="width:${Math.round(msPct*100)}%"></div>`:''}
    <div class="task-row">
      <div class="task-check ${task.done?'checked':''}" onclick="selectMode?toggleSelectTask(${task.id},document.getElementById('tc-'+${task.id})):quickTick(${task.id},event)"></div>
      <div class="task-main" onclick="selectMode?toggleSelectTask(${task.id},document.getElementById('tc-'+${task.id})):openDetail(${task.id})">
        <div class="task-title ${task.done?'done-txt':''}">${task.title}</div>
        <div class="task-meta">
          <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
          <span class="task-bucket-b">${task.bucket}</span>
          ${task.due?`<span class="task-date ${ov?'ov':ds?'ds':''}">${fmtDate(task.due)}</span>`:''}
          ${timeH?`<span class="task-time-b">${fmtHours(timeH)}</span>`:''}
          ${ms.length?`<span class="task-time-b" style="color:${msDone===ms.length?'var(--green)':msDone>0?'var(--amber)':'var(--tx3)'}">${msDone}/${ms.length} steps</span>`:''}
          ${dots}
          ${(task.photo_urls||[]).length?`<span class="task-time-b">📷${task.photo_urls.length}</span>`:''}
          ${task.task_code?`<span class="task-code">${task.task_code}</span>`:''}
        </div>
      </div>
    </div>
  </div>`;
}

// ================================================================
// TASKS VIEW
// ================================================================
function setFW(el,v){document.querySelectorAll('[data-fw]').forEach(e=>e.classList.remove('active'));if(el)el.classList.add('active');filterWho=v;renderTasksView();}
function setFB(el,v){document.querySelectorAll('[data-fb]').forEach(e=>e.classList.remove('active'));el.classList.add('active');filterBucket=v;renderTasksView();}

function renderTasksView(){
  const today=tdStr();
  const srch=(document.getElementById('search-input')?.value||'').toLowerCase();
  const sort=document.getElementById('sort-sel')?.value||'manual';
  const applyF=arr=>{
    let f=[...arr];
    if(filterWho!=='all')f=f.filter(t=>t.owner&&t.owner.includes(filterWho));
    if(filterBucket!=='all')f=f.filter(t=>t.bucket===filterBucket);
    if(srch)f=f.filter(t=>t.title.toLowerCase().includes(srch));
    if(filterMode==='today')f=f.filter(t=>t.due===today);
    else if(filterMode==='quickwin')f=f.filter(t=>(getEffectiveTime(t))<=0.5);
    else if(filterMode==='overdue')f=f.filter(t=>t.due&&t.due<today);
    return f;
  };
  filterMode=null;
  const sortF=arr=>{
    if(sort==='manual'||sort==='date')arr.sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));
    else if(sort==='due')arr.sort((a,b)=>(a.due||'').localeCompare(b.due||''));
    else if(sort==='tasc')arr.sort((a,b)=>getEffectiveTime(a)-getEffectiveTime(b));
    else if(sort==='tdesc')arr.sort((a,b)=>getEffectiveTime(b)-getEffectiveTime(a));
    else if(sort==='owner')arr.sort((a,b)=>(a.owner||'').localeCompare(b.owner||''));
    return arr;
  };
  const active=sortF(applyF(tasks.filter(t=>!t.done&&t.status!=='shelved')));
  const done=applyF(tasks.filter(t=>t.done&&t.status!=='shelved'));
  document.getElementById('all-tasks-list').innerHTML=active.length?active.map(taskCard).join(''):'<div class="empty-state">No tasks match.</div>';
  const cs=document.getElementById('completed-section');
  if(done.length){
    const wasOpen=cs.querySelector('.completed-list')?.classList.contains('open');
    cs.innerHTML=`<div class="completed-toggle" onclick="toggleDone(this)">
      <span class="ct-arr ${wasOpen?'open':''}">›</span>
      <span>${done.length} completed</span>
    </div>
    <div class="completed-list ${wasOpen?'open':''}">
      ${done.map(taskCard).join('')}
    </div>`;
  }else cs.innerHTML='';
  setTimeout(()=>{initDrag();initTaskBirds();},80);
}

function toggleDone(el){
  el.querySelector('.ct-arr').classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
}

// ================================================================
// QUICK TICK
// ================================================================
async function quickTick(id,e){
  if(e)e.stopPropagation();
  const task=tasks.find(t=>t.id===id);if(!task)return;
  task.done=!task.done;
  if(task.done){
    playChime('task');
    if(e&&e.target)spawnConfetti(e.target);
    // If sprint is active and this task is in the sprint, track it
    if(sprintActive&&sprintData&&sprintData.taskIds.includes(id)){
      sprintData.doneTasks.add(id);
      updateSprintProgress();
      saveSprintState();
    }
  }else{
    // Unticking — remove from sprint done set
    if(sprintActive&&sprintData){
      sprintData.doneTasks.delete(id);
      updateSprintProgress();
      saveSprintState();
    }
  }
  // OPTIMISTIC UI — immediately collapse the card visually so the tap feels
  // instant. Without this, on slower devices the user sees the card linger
  // until rerender() finishes its full re-paint. We hide every instance of
  // this task's card across the page (the same task can appear in the Tasks
  // list, the dashboard's "Your tasks", and the event panel simultaneously).
  if(task.done){
    document.querySelectorAll(`.task-card[data-id="${id}"]`).forEach(card=>{
      card.style.transition='opacity .18s ease, max-height .25s ease, margin .25s ease, padding .25s ease';
      card.style.maxHeight=card.offsetHeight+'px';
      // next frame, collapse
      requestAnimationFrame(()=>{
        card.style.opacity='0';
        card.style.maxHeight='0';
        card.style.marginTop='0';
        card.style.marginBottom='0';
        card.style.paddingTop='0';
        card.style.paddingBottom='0';
        card.style.overflow='hidden';
      });
    });
  }
  // Full re-render after a beat so the card collapse animation has time to
  // play. The re-render is what truly removes the DOM element from each list.
  setTimeout(()=>{
    rerender();
    if(sprintActive&&sprintData&&sprintData.taskIds.includes(id)){renderSprintTasks();}
    if(typeof activeEventId!=='undefined'&&activeEventId&&document.getElementById('event-panel')?.classList.contains('open')){
      const ev=events.find(e=>e.id===activeEventId);
      if(ev&&typeof renderEventPanel==='function')renderEventPanel(ev);
    }
  },task.done?280:0);
  // Persist to DB and surface any failure loudly so it can't go unnoticed
  // (silent PATCH failures = local UI updates, but the tick is lost on next
  // refresh because the server never got it. That made events look like they
  // were resetting on app reopen).
  try{
    badge('sy','↻');
    await api('bravochore_tasks','PATCH',{done:task.done},`?id=eq.${id}`);
    badge('ok','✓');
  }catch(err){
    console.error('Tick PATCH failed for task',id,err);
    badge('er','⚠');
    chirp("Couldn't save tick — check connection. Tap to retry.");
    // Revert local state so the UI matches the server. Otherwise the user
    // thinks it ticked, refreshes, and sees it un-ticked, which is the worst
    // of both worlds.
    task.done=!task.done;
    rerender();
    if(typeof activeEventId!=='undefined'&&activeEventId&&document.getElementById('event-panel')?.classList.contains('open')){
      const ev=events.find(e=>e.id===activeEventId);
      if(ev&&typeof renderEventPanel==='function')renderEventPanel(ev);
    }
  }
}

