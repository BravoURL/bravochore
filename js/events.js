// ================================================================
// SHELVE FROM TASKS (from Shelved tab)
// ================================================================
function openShelveFromTasksSheet(){
  const picker=document.createElement('div');
  picker.setAttribute('data-picker','1');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';
  const pending=tasks.filter(t=>!t.done);
  const selected=new Set();
  picker.innerHTML=`<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:700px;max-height:82vh;display:flex;flex-direction:column;padding-bottom:max(16px,env(safe-area-inset-bottom))">
    <div style="padding:14px 16px 10px;border-bottom:1px solid var(--bdr);background:var(--surf);border-radius:20px 20px 0 0;flex-shrink:0;display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500">Move to Shelved</div>
      <div style="font-size:11px;color:var(--tx2)">Tap to select, then shelve</div></div>
      <button onclick="this.closest('[data-picker]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--tx3)">✕</button>
    </div>
    <div id="sfts-list" style="flex:1;overflow-y:auto;padding:6px 14px">
      ${pending.map(t=>{
        const o=getOwner(t.owner);
        return `<div id="sfts-${t.id}" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="toggleSFTS(${t.id})">
          <div id="sfts-chk-${t.id}" style="width:22px;height:22px;border:2px solid var(--bdrm);border-radius:4px;background:#fff;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s"></div>
          <div style="flex:1"><div style="font-size:13px;font-weight:500">${t.title}</div>
          <div style="display:flex;gap:5px;margin-top:3px;align-items:center">
            <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
            ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
          </div></div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--bdr);display:flex;gap:8px;flex-shrink:0">
      <span id="sfts-count" style="align-self:center;font-size:12px;font-weight:600;color:var(--tx2);flex:1">0 selected</span>
      <button onclick="doShelveFromTasks()" style="padding:11px 20px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer">Shelve selected</button>
    </div>
  </div>`;
  picker._selected=selected;
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
  window._sftsPicker=picker;
}
function toggleSFTS(taskId){
  const picker=window._sftsPicker;if(!picker)return;
  const sel=picker._selected;
  const chk=document.getElementById('sfts-chk-'+taskId);
  const row=document.getElementById('sfts-'+taskId);
  if(sel.has(taskId)){
    sel.delete(taskId);
    if(chk){chk.style.background='#fff';chk.style.borderColor='var(--bdrm)';chk.innerHTML='';}
    if(row)row.style.background='';
  }else{
    sel.add(taskId);
    if(chk){chk.style.background='var(--green)';chk.style.borderColor='var(--green)';chk.innerHTML='<span style="color:#fff;font-size:12px;font-weight:700">✓</span>';}
    if(row)row.style.background='var(--gl)';
  }
  const ct=document.getElementById('sfts-count');
  if(ct)ct.textContent=sel.size+' selected';
}
async function doShelveFromTasks(){
  const picker=window._sftsPicker;if(!picker)return;
  const sel=picker._selected;
  if(!sel.size){chirp('No tasks selected.');return;}
  picker.remove();
  let count=0;
  for(const id of sel){
    const task=tasks.find(t=>t.id===id);if(!task)continue;
    task.status='shelved';
    try{await api('bravochore_tasks','PATCH',{status:'shelved'},`?id=eq.${id}`);count++;}
    catch(e){task.status='active';}
  }
  refreshShelvedView();
  renderShelved();rerender();
  chirp(count+' task'+(count!==1?'s':'')+' shelved.');
}

// SELECT MODE (multi-shelve)
// ================================================================
let selectMode=false;
let selectedTaskIds=new Set();

function toggleSelectMode(){
  selectMode=!selectMode;
  selectedTaskIds.clear();
  const btn=document.getElementById('select-mode-btn');
  const bar=document.getElementById('select-action-bar');
  if(btn)btn.textContent=selectMode?'Done':'Select';
  if(btn)btn.style.background=selectMode?'var(--al)':'';
  if(btn)btn.style.color=selectMode?'var(--amber)':'';
  if(btn)btn.style.borderColor=selectMode?'var(--amber)':'';
  if(bar)bar.style.display=selectMode?'flex':'none';
  // Clear any lingering visual selections
  document.querySelectorAll('.task-card').forEach(c=>{
    c.style.background='';c.style.outline='';
    const chk=c.querySelector('.task-check:not(.checked)');
    if(chk){chk.style.background='';chk.style.borderColor='';}
  });
  renderTasksView();
}

function toggleSelectTask(taskId,el){
  if(!selectMode)return;
  const card=document.getElementById('tc-'+taskId);
  if(selectedTaskIds.has(taskId)){
    selectedTaskIds.delete(taskId);
    if(card){card.style.background='';card.style.outline='';}
    // Reset checkbox visual
    const chk=card?.querySelector('.task-check');
    if(chk)chk.style.background='';
  }else{
    selectedTaskIds.add(taskId);
    if(card){card.style.background='var(--gl)';card.style.outline='2px solid var(--green)';}
    // Show selected state on checkbox
    const chk=card?.querySelector('.task-check');
    if(chk){chk.style.background='var(--green)';chk.style.borderColor='var(--green)';}
  }
  const ct=document.getElementById('select-count');
  if(ct)ct.textContent=selectedTaskIds.size+' selected';
}

async function shelveSelected(){
  if(!selectedTaskIds.size)return;
  const ids=[...selectedTaskIds];
  for(const id of ids){
    const task=tasks.find(t=>t.id===id);
    if(!task)continue;
    task.status='shelved';
    try{await api('bravochore_tasks','PATCH',{status:'shelved'},`?id=eq.${id}`);}
    catch(e){task.status='active';}
  }
  refreshShelvedView();
  toggleSelectMode();
  rerender();
  chirp(ids.length+' task'+(ids.length>1?'s':'')+' shelved.');
}

// ================================================================
// EVENTS
// ================================================================
let events=[],shelved=[];
let activeEventId=null;
let nextEventId=null; // for task assignment on creation
let evOwnerFilter='all'; // 'all' | 'me' | 'partner' — filter event task list by owner

// Splits tasks/shelved client-side by status. DB has both in bravochore_tasks
// (one source of truth, transfer in place); client splits for clean rendering.
// Idempotent — can be called from any handler after a status change.
function refreshShelvedView(){
  // Move any shelved-status rows out of tasks → shelved
  const toShelve=tasks.filter(t=>t.status==='shelved');
  if(toShelve.length){
    shelved.push(...toShelve);
    tasks=tasks.filter(t=>t.status!=='shelved');
  }
  // Move any active-status rows out of shelved → tasks
  const toActivate=shelved.filter(t=>t.status!=='shelved');
  if(toActivate.length){
    tasks.push(...toActivate);
    shelved=shelved.filter(t=>t.status==='shelved');
  }
  // Sort shelved by sort_order
  shelved.sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));
}

async function loadEvents(){
  try{
    const ev=await api('bravochore_events','GET',null,'?order=due.asc');
    events=ev||[];
  }catch(e){events=[];}
}

function renderEvents(){
  const list=document.getElementById('events-list');
  const empty=document.getElementById('events-empty');
  if(!list)return;
  const active=events.filter(e=>e.status!=='completed');
  const completed=events.filter(e=>e.status==='completed');
  if(!active.length&&!completed.length){
    list.innerHTML='';if(empty)empty.style.display='block';return;
  }
  if(empty)empty.style.display='none';
  list.innerHTML=active.map(ev=>eventCard(ev)).join('')+
    (completed.length?`<div class="sec-header" style="margin-top:20px"><span class="sec-title">Completed</span><span class="sec-count">${completed.length}</span></div>`+
    completed.map(ev=>eventCard(ev,true)).join(''):'');
}

function eventCard(ev,done=false){
  const taskCount=tasks.filter(t=>t.event_id===ev.id).length;
  const doneCount=tasks.filter(t=>t.event_id===ev.id&&t.done).length;
  const pct=taskCount?Math.round((doneCount/taskCount)*100):0;
  const today=tdStr();
  const daysLeft=ev.due?Math.ceil((new Date(ev.due+'T00:00:00')-new Date())/86400000):null;
  const overdue=daysLeft!==null&&daysLeft<0;
  const color=ev.color||'#5C8A4A';
  return `<div class="event-card" onclick="openEventPanel(${ev.id})" style="border-left:4px solid ${color};opacity:${done?.6:1}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
      <div class="event-title">${ev.title}</div>
      ${daysLeft!==null?`<span class="event-badge" style="background:${overdue?'var(--rl)':'var(--gl)'};color:${overdue?'var(--red)':'var(--gd)'}">${overdue?Math.abs(daysLeft)+'d overdue':daysLeft===0?'Today':daysLeft+'d left'}</span>`:''}
    </div>
    ${ev.due?`<div class="event-meta"><span>${fmtDate(ev.due)}</span>${ev.description?`<span>·</span><span>${ev.description}</span>`:''}</div>`:''}
    <div class="event-pbar"><div class="event-pfill" style="width:${pct}%;background:${color}"></div></div>
    <div class="event-stats">
      <div class="event-stat"><div class="event-stat-val">${doneCount}</div><div class="event-stat-lbl">Done</div></div>
      <div class="event-stat"><div class="event-stat-val">${taskCount-doneCount}</div><div class="event-stat-lbl">To go</div></div>
      <div class="event-stat"><div class="event-stat-val">${pct}%</div><div class="event-stat-lbl">Complete</div></div>
    </div>
  </div>`;
}

function openEventPanel(eventId){
  activeEventId=eventId;
  evOwnerFilter='all'; // reset to All every time you open an event
  const ev=events.find(e=>e.id===eventId);if(!ev)return;
  document.getElementById('ep-title').textContent=ev.title;
  renderEventPanel(ev);
  document.getElementById('event-panel').classList.add('open');
}

function setEvOwnerFilter(v){
  evOwnerFilter=v;
  if(activeEventId){
    const ev=events.find(e=>e.id===activeEventId);
    if(ev)renderEventPanel(ev);
  }
}

// Open the detail panel for a brand-new task already attached to this event.
// dpSave() picks up the active event via getActiveEvent(), so the new row
// will land with event_id set automatically.
function openNewTaskInEvent(eventId){
  if(typeof openDetail!=='function')return;
  // openDetail(null) opens a blank detail panel; getActiveEvent() will read activeEventId
  // from the still-open event panel and assign the task to it.
  openDetail(null);
  // Pre-set the due date to the event's due date if one isn't set, so the wizard
  // doesn't drop the task with no schedule.
  const ev=events.find(e=>e.id===eventId);
  if(ev&&ev.due){
    setTimeout(()=>{
      const due=document.getElementById('dp-due');
      if(due&&!due.value)due.value=ev.due;
      const eventSel=document.getElementById('dp-event');
      if(eventSel)eventSel.value=String(eventId);
    },120);
  }
}

function closeEventPanel(){
  document.getElementById('event-panel').classList.remove('open');
  activeEventId=null;
}

function renderEventPanel(ev){
  const body=document.getElementById('ep-body');if(!body)return;
  const allEvTasks=tasks.filter(t=>t.event_id==ev.id);
  // Apply owner filter — 'all' shows everyone, 'me' = logged-in user, 'partner' = the other person
  const ownerFilterFn=t=>{
    if(evOwnerFilter==='all')return true;
    const target=evOwnerFilter==='partner'?(typeof getPartnerCode==='function'?getPartnerCode():CU):CU;
    return t.owner&&t.owner.includes(target);
  };
  const evTasks=allEvTasks.filter(ownerFilterFn);
  const done=evTasks.filter(t=>t.done);
  const pending=evTasks.filter(t=>!t.done);
  // Dashboard metrics use the unfiltered totals so the event-level numbers don't shift when toggling
  const allDone=allEvTasks.filter(t=>t.done);
  const daysLeft=ev.due?Math.ceil((new Date(ev.due+'T00:00:00')-new Date())/86400000):null;
  const pct=allEvTasks.length?Math.round((allDone.length/allEvTasks.length)*100):0;
  const color=ev.color||'#5C8A4A';
  const partnerCode=typeof getPartnerCode==='function'?getPartnerCode():null;
  const meName=getOwner(CU).name;
  const partnerName=partnerCode?getOwner(partnerCode).name:'';
  const filterPill=(value,label)=>{
    const active=evOwnerFilter===value;
    return `<button onclick="setEvOwnerFilter('${value}')" style="padding:5px 11px;border-radius:100px;border:1.5px solid ${active?'var(--green)':'var(--bdrm)'};background:${active?'var(--green)':'var(--surf)'};color:${active?'#fff':'var(--tx2)'};font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0">${label}</button>`;
  };

  body.innerHTML=`
    <div style="background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:500">Progress</span>
        <span style="font-size:12px;color:var(--tx2)">${pct}%</span>
      </div>
      <div class="event-pbar" style="height:8px"><div class="event-pfill" style="width:${pct}%;background:${color}"></div></div>
    </div>
    <div class="ep-dash">
      <div class="ep-metric"><div class="ep-metric-val">${allDone.length}</div><div class="ep-metric-lbl">Done</div></div>
      <div class="ep-metric"><div class="ep-metric-val">${allEvTasks.length-allDone.length}</div><div class="ep-metric-lbl">To go</div></div>
      <div class="ep-metric"><div class="ep-metric-val" style="color:${daysLeft<0?'var(--red)':'var(--tx)'}">${daysLeft!==null?(daysLeft<0?Math.abs(daysLeft)+'d over':(daysLeft===0?'Today':daysLeft+'d')):'—'}</div><div class="ep-metric-lbl">Days left</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
      <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:500">Tasks</span>
      <div style="display:flex;gap:6px">
        <button class="qa-btn" style="font-size:11px;padding:5px 10px" onclick="openNewTaskInEvent(${ev.id})">+ New task</button>
        <button class="qa-btn" style="font-size:11px;padding:5px 10px" onclick="openAssignTasksSheet(${ev.id})">+ Assign existing</button>
      </div>
    </div>
    ${partnerCode?`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${filterPill('all','All')}
      ${filterPill('me',meName)}
      ${filterPill('partner',partnerName)}
    </div>`:''}
    ${pending.length===0&&done.length===0?`<div style="padding:14px;background:var(--surf);border:1px dashed var(--bdr);border-radius:var(--rs);font-size:12px;color:var(--tx3);text-align:center">${evOwnerFilter==='all'?'No tasks yet — add one above.':'Nothing for '+(evOwnerFilter==='me'?meName:partnerName)+' on this event.'}</div>`:''}
    ${pending.map(t=>{
      const o=getOwner(t.owner);
      return `<div class="task-card" data-id="${t.id}" style="margin-bottom:6px">
        <div class="task-row">
          <div class="task-check ${t.done?'checked':''}" onclick="event.stopPropagation();quickTick(${t.id},event)"></div>
          <div class="task-main" onclick="event.stopPropagation();openDetail(${t.id})">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">
              <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
              ${t.due?`<span class="task-date">${fmtDate(t.due)}</span>`:''}
              ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
              ${t.time_hours?`<span class="task-time-b">${fmtHours(parseFloat(t.time_hours))}</span>`:''}
            </div>
          </div>
          <button class="icon-btn" onclick="startTaskTimer(${t.id},event)" title="Timer" style="color:var(--tx3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12M6 22h12M6 2c0 4 2 6 6 10C8 16 6 18 6 22M18 2c0 4-2 6-6 10c4 4 6 6 6 10"/></svg>
          </button>
        </div>
      </div>`;
    }).join('')}
    ${done.length?`<div class="completed-toggle" onclick="toggleDone(this)"><span class="ct-arr">›</span><span>${done.length} completed</span></div>
    <div class="completed-list">${done.map(t=>`<div class="task-card done" onclick="openDetail(${t.id})"><div class="task-row"><div class="task-check checked"></div><div class="task-main"><div class="task-title done-txt">${t.title}</div></div></div></div>`).join('')}</div>`:''}
    ${ev.status!=='completed'?`<button class="ep-complete-btn" onclick="showEventScorecard(${ev.id})">Complete this event</button>`:''}
  `;
}

function openAssignTasksSheet(eventId){
  const ev=events.find(e=>e.id===eventId);if(!ev)return;
  const unassigned=tasks.filter(t=>!t.done&&(!t.event_id||t.event_id===eventId));
  const picker=document.createElement('div');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';picker.setAttribute('data-picker','1');
  picker.innerHTML=`<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:700px;max-height:80vh;display:flex;flex-direction:column;padding-bottom:max(16px,env(safe-area-inset-bottom))">
    <div style="padding:14px 16px 10px;border-bottom:1px solid var(--bdr);background:var(--surf);border-radius:20px 20px 0 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <span style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500">Assign tasks to ${ev.title}</span>
      <button onclick="this.closest('[style*=position]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--tx3)">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:10px 14px">
      ${unassigned.map(t=>{
        const assigned=t.event_id==eventId;
        const o=getOwner(t.owner);
        // Store eventId on picker for reference
        return `<div style="display:flex;align-items:center;gap:0;padding:0;border-bottom:1px solid var(--bdr)" id="atr-${t.id}">
          <div style="flex:1;display:flex;align-items:center;gap:10px;padding:12px 10px;cursor:pointer" onclick="toggleTaskEventRow(${t.id},${eventId})">
            <div id="atc-${t.id}" style="width:22px;height:22px;border:2px solid ${assigned?'var(--green)':'var(--bdrm)'};border-radius:4px;background:${assigned?'var(--green)':'#fff'};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s">
              ${assigned?'<span style="color:#fff;font-size:12px;font-weight:700">✓</span>':''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:var(--tx)">${t.title}</div>
              <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap;align-items:center">
                <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
                ${t.due?`<span class="task-date ${t.due<tdStr()?'ov':t.due===tdStr()?'ds':''}">${fmtDate(t.due)}</span>`:''}
                ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
              </div>
            </div>
          </div>
          <div style="padding:12px 10px;cursor:pointer;color:var(--tx3);font-size:20px;border-left:1px solid var(--bdr)" onclick="event.stopPropagation();[...document.querySelectorAll('[data-picker]')].forEach(e=>e.remove());openDetail(${t.id})">›</div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:12px 14px;border-top:1px solid var(--bdr)">
      <button onclick="this.closest('[style*=position]').remove();renderEventPanel(events.find(e=>e.id===${eventId}))" style="width:100%;padding:13px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;cursor:pointer">Done</button>
    </div>
  </div>`;
  picker.addEventListener('click',e=>{if(e.target===picker){picker.remove();renderEventPanel(events.find(e=>e.id===eventId));}});
  document.body.appendChild(picker);
}

async function closeAllPickers(){document.querySelectorAll('[style*="position:fixed"][style*="z-index:900"]').forEach(e=>e.remove());}
async function toggleTaskEventRow(taskId,eventId){
  // Find the checkbox element and toggle
  const chk=document.getElementById('atc-'+taskId);
  if(chk)await toggleTaskEvent(taskId,eventId,chk);
}
async function toggleTaskEvent(taskId,eventId,el){
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  if(t.event_id===eventId){
    t.event_id=null;
    el.style.borderColor='var(--bdrm)';el.style.background='#fff';el.innerHTML='';
    try{await api('bravochore_tasks','PATCH',{event_id:null},`?id=eq.${taskId}`);}catch(e){}
  }else{
    t.event_id=eventId;
    // Auto-set due date to event deadline if task has no due date
    const ev=events.find(e=>e.id===eventId);
    if(ev&&ev.due&&!t.due){
      t.due=ev.due;
      try{await api('bravochore_tasks','PATCH',{event_id:eventId,due:ev.due},`?id=eq.${taskId}`);}catch(e){}
    }else{
      try{await api('bravochore_tasks','PATCH',{event_id:eventId},`?id=eq.${taskId}`);}catch(e){}
    }
    el.style.borderColor='var(--green)';el.style.background='var(--green)';
    el.innerHTML='<span style="color:#fff;font-size:12px;font-weight:700">✓</span>';
  }
  // Also update row background
  const row=document.getElementById('atr-'+taskId);
  if(row)row.style.background=t.event_id?'rgba(92,138,74,.04)':'';
}

function showEventScorecard(eventId){
  const ev=events.find(e=>e.id===eventId);if(!ev)return;
  const evTasks=tasks.filter(t=>t.event_id===eventId);
  const done=evTasks.filter(t=>t.done);
  const notDone=evTasks.filter(t=>!t.done);
  const totalH=evTasks.reduce((s,t)=>s+getEffectiveTime(t),0);
  const doneH=done.reduce((s,t)=>s+getEffectiveTime(t),0);
  document.getElementById('sc-title').textContent=ev.title+' — Complete';
  document.getElementById('sc-sub').textContent=`${done.length} of ${evTasks.length} tasks completed · ${fmtHours(doneH)} of ${fmtHours(totalH)}`;
  const pct=evTasks.length?Math.round((done.length/evTasks.length)*100):0;
  let perf='';
  if(pct===100)perf='<div style="background:var(--gl);color:var(--gd);padding:12px;border-radius:var(--rs);font-weight:600;text-align:center;margin-bottom:16px">🎉 Everything done. Outstanding.</div>';
  else if(pct>=75)perf='<div style="background:var(--al);color:var(--amber);padding:12px;border-radius:var(--rs);font-weight:600;text-align:center;margin-bottom:16px">Strong effort. The rest rolls forward.</div>';
  else perf='<div style="background:var(--rl);color:var(--red);padding:12px;border-radius:var(--rs);font-weight:600;text-align:center;margin-bottom:16px">Plenty still to do — it all rolls back to your task list.</div>';
  const doneHtml=done.map(t=>`<div class="sc-item"><span class="sc-item-code">${t.task_code||''}</span><span style="flex:1">${t.title}</span><span style="color:var(--green);font-size:12px">✓</span></div>`).join('');
  const notDoneHtml=notDone.map(t=>`<div class="sc-item"><span class="sc-item-code">${t.task_code||''}</span><span style="flex:1">${t.title}</span><span style="color:var(--tx3);font-size:11px">→ rolls over</span></div>`).join('');
  document.getElementById('sc-body').innerHTML=perf+
    `<div class="sc-section"><div class="sc-section-title">Completed (${done.length})</div>${doneHtml||'<div style="color:var(--tx3);font-size:13px">None completed.</div>'}</div>`+
    (notDone.length?`<div class="sc-section"><div class="sc-section-title">Rolling over (${notDone.length})</div>${notDoneHtml}</div>`:'');
  document.getElementById('scorecard-backdrop').classList.add('open');
  window._scorecardEventId=eventId;
}

async function confirmCompleteEvent(){
  const eventId=window._scorecardEventId;
  document.getElementById('scorecard-backdrop').classList.remove('open');
  if(!eventId)return;
  // Mark event complete
  const ev=events.find(e=>e.id===eventId);
  if(ev)ev.status='completed';
  // Roll unfinished tasks back to standard (clear event_id and due date)
  const toRoll=tasks.filter(t=>t.event_id===eventId&&!t.done);
  for(const t of toRoll){
    t.event_id=null;t.due=null;
    try{await api('bravochore_tasks','PATCH',{event_id:null,due:null},`?id=eq.${t.id}`);}catch(e){}
  }
  try{await api('bravochore_events','PATCH',{status:'completed'},`?id=eq.${eventId}`);}catch(e){}
  closeEventPanel();
  renderEvents();rerender();
  chirp('Event closed. Unfinished tasks rolled back to your list.');
}

// ================================================================
// EVENT TEMPLATES + NEW-EVENT WIZARD
// ================================================================
let eventTemplates=[];     // [{id,name,description,...}]
let nemState={             // wizard transient state
  step:'choose',
  templateId:null,         // null = blank
  templateName:'',
  templateTasks:[],        // working copy: [{title,owner,time_hours,day_offset,prefer_weekend,bucket,notes,enabled,custom_due}]
  isEdit:false             // editing existing event vs creating
};

async function loadEventTemplates(){
  try{
    const t=await api('bravochore_event_templates','GET',null,'?order=name.asc');
    eventTemplates=t||[];
  }catch(e){eventTemplates=[];}
}

async function loadTemplateTasks(templateId){
  try{
    const r=await api('bravochore_event_template_tasks','GET',null,
      `?template_id=eq.${templateId}&order=sort_order.asc`);
    return r||[];
  }catch(e){return[];}
}

function openNewEventSheet(){
  // Reset state
  nemState={step:'choose',templateId:null,templateName:'',templateTasks:[],isEdit:false};
  activeEventId=null;
  document.getElementById('nem-title').textContent='Event details';
  document.getElementById('nem-name').value='';
  document.getElementById('nem-date').value='';
  document.getElementById('nem-desc').value='';
  document.getElementById('nem-next-btn').textContent='Continue →';
  nemShowStep('choose');
  // Populate template list
  loadEventTemplates().then(()=>nemRenderTemplateList());
  openModal('new-event-modal');
}

function nemShowStep(step){
  nemState.step=step;
  ['choose','details','customise'].forEach(s=>{
    const el=document.getElementById('nem-step-'+s);
    if(el)el.style.display=(s===step)?'flex':'none';
  });
}

function nemRenderTemplateList(){
  const list=document.getElementById('nem-tpl-list');
  if(!list)return;
  if(!eventTemplates.length){
    list.innerHTML='<div style="font-size:12px;color:var(--tx3);padding:8px">No templates yet. Save an event as a template later to build your library.</div>';
    return;
  }
  list.innerHTML=eventTemplates.map(t=>`
    <button class="qa-btn" style="text-align:left;white-space:normal;padding:14px;background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--rs);cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%" onclick="nemPickTemplate(${t.id})">
      <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:500;color:var(--tx);white-space:normal">${t.name}</div>
      ${t.description?`<div style="font-size:11px;color:var(--tx2);line-height:1.4;text-align:left;white-space:normal">${t.description}</div>`:''}
    </button>
  `).join('');
}

async function nemPickTemplate(id){
  const tpl=eventTemplates.find(t=>t.id===id);
  if(!tpl)return;
  nemState.templateId=id;
  nemState.templateName=tpl.name;
  const taskRows=await loadTemplateTasks(id);
  // Working copy with enabled flag and slot for user-overridden due
  nemState.templateTasks=taskRows.map(r=>({...r,enabled:true,custom_due:null}));
  // Pre-fill name from template
  document.getElementById('nem-name').value=tpl.name;
  document.getElementById('nem-desc').value=tpl.description||'';
  document.getElementById('nem-date').value='';
  // Default the date to next Saturday so users see the engine working immediately
  const d=new Date();
  const daysUntilSat=(6-d.getDay()+7)%7||7;
  d.setDate(d.getDate()+daysUntilSat);
  document.getElementById('nem-date').value=d.toISOString().slice(0,10);
  nemUpdateDateHint();
  nemShowStep('details');
}

function nemPickBlank(){
  nemState.templateId=null;nemState.templateName='';nemState.templateTasks=[];
  document.getElementById('nem-name').value='';
  document.getElementById('nem-desc').value='';
  document.getElementById('nem-date').value='';
  nemShowStep('details');
  document.getElementById('nem-next-btn').textContent='Create →';
}

function nemBack(){
  if(nemState.step==='customise')nemShowStep('details');
  else if(nemState.step==='details'){
    if(nemState.isEdit){closeModal('new-event-modal');return;}
    nemShowStep('choose');
  }
}

function nemUpdateDateHint(){
  const dateStr=document.getElementById('nem-date')?.value;
  const hint=document.getElementById('nem-date-hint');
  if(!hint)return;
  if(!dateStr){hint.textContent='Pick the day of the event.';return;}
  if(nemState.templateId){
    const today=tdStr();
    const eventD=new Date(dateStr+'T00:00:00');
    const todayD=new Date(today+'T00:00:00');
    const daysAvail=Math.round((eventD-todayD)/86400000);
    const dayName=eventD.toLocaleDateString('en-AU',{weekday:'long'});
    if(daysAvail<0)hint.innerHTML=`<span style="color:var(--red)">Date is in the past. Pick a future date.</span>`;
    else if(daysAvail===0)hint.innerHTML=`Hosting <b>today</b> (${dayName}). All prep tasks will land today.`;
    else hint.innerHTML=`Hosting <b>${dayName}</b>, ${daysAvail} day${daysAvail===1?'':'s'} away. Prep tasks will back-calculate from this date.`;
  }else{
    hint.textContent='';
  }
}

// Wire date input live update
document.addEventListener('DOMContentLoaded',()=>{
  const d=document.getElementById('nem-date');
  if(d)d.addEventListener('change',nemUpdateDateHint);
});

// ── DATE ENGINE ──
// For each template task, compute its actual due date given the event date.
// Rules:
//  1. baseDate = eventDate + day_offset (offsets are negative; -7 = 7 days before)
//  2. If prefer_weekend AND baseDate falls Mon-Fri, snap backward to the prior Saturday.
//  3. If the longest offset would put a task in the past, COMPRESS the whole schedule
//     proportionally so the most-distant task lands today (never past).
//  4. Tasks at offset 0 always land on event day regardless of compression.
function computeTemplateDueDates(templateTasks,eventDateStr){
  if(!eventDateStr)return templateTasks.map(t=>({...t,_due:null}));
  const today=new Date(tdStr()+'T00:00:00');
  const event=new Date(eventDateStr+'T00:00:00');
  const daysAvail=Math.round((event-today)/86400000);
  const minOffset=Math.min(0,...templateTasks.filter(t=>t.enabled).map(t=>t.day_offset||0));  // most negative
  const neededLead=Math.abs(minOffset);
  // Compression: if not enough lead time, scale offsets proportionally
  // factor < 1 compresses; factor === 1 means no change
  let factor=1;
  if(neededLead>0&&daysAvail<neededLead)factor=Math.max(0,daysAvail)/neededLead;
  return templateTasks.map(t=>{
    if(t.day_offset===0||t.day_offset==null){
      // Day-of tasks always land on event day
      return{...t,_due:eventDateStr};
    }
    const scaledOffset=Math.round(t.day_offset*factor);   // negative or zero
    const d=new Date(event);
    d.setDate(d.getDate()+scaledOffset);
    // Weekend prefer
    if(t.prefer_weekend){
      const dow=d.getDay(); // 0=Sun, 6=Sat
      if(dow>=1&&dow<=5){
        // Snap backward to prior Saturday
        const back=dow===1?2:dow===2?3:dow===3?4:dow===4?5:6;
        d.setDate(d.getDate()-back);
        // But never into the past
        if(d<today){d.setTime(today.getTime());}
      }
    }
    // Final guard: never set past
    if(d<today)d.setTime(today.getTime());
    return{...t,_due:d.toISOString().slice(0,10)};
  });
}

function nemNext(){
  const name=document.getElementById('nem-name')?.value.trim();
  const date=document.getElementById('nem-date')?.value;
  const desc=document.getElementById('nem-desc')?.value||'';
  if(!name){chirp('Please enter an event name.');return;}
  if(!date){chirp('Please pick an event date.');return;}
  // For blank events with no template, just create directly
  if(!nemState.templateId&&!nemState.isEdit){
    nemCommitBlank(name,date,desc);return;
  }
  // For edit-mode, just save
  if(nemState.isEdit){nemCommitEdit(name,date,desc);return;}
  // Template path: go to customise
  nemRenderCustomise();
  nemShowStep('customise');
}

function nemRenderCustomise(){
  const date=document.getElementById('nem-date')?.value;
  const computed=computeTemplateDueDates(nemState.templateTasks,date);
  // Save back to state so commit uses the same dates the user sees
  nemState.templateTasks=computed.map((t,i)=>({...nemState.templateTasks[i],_due:t._due}));
  // Group by computed due date
  const byDate={};
  computed.filter(t=>t.enabled).forEach(t=>{
    const k=t._due||'unscheduled';
    (byDate[k]=byDate[k]||[]).push(t);
  });
  const sortedDates=Object.keys(byDate).sort();
  // Compression check
  const today=tdStr();
  const eventD=new Date(date+'T00:00:00');
  const todayD=new Date(today+'T00:00:00');
  const daysAvail=Math.round((eventD-todayD)/86400000);
  const minOff=Math.min(0,...nemState.templateTasks.filter(t=>t.enabled).map(t=>t.day_offset||0));
  const compressed=daysAvail<Math.abs(minOff);
  const warn=document.getElementById('nem-cust-warning');
  if(compressed){
    warn.style.display='block';
    warn.innerHTML=`<b>Tight lead time:</b> only ${daysAvail} day${daysAvail===1?'':'s'} until the event but the template wants ${Math.abs(minOff)} days of lead. Tasks have been compressed proportionally — none scheduled in the past. Drop tasks you don't need below.`;
  }else{
    warn.style.display='none';
  }
  // Summary
  const enabledCount=nemState.templateTasks.filter(t=>t.enabled).length;
  const totalHours=nemState.templateTasks.filter(t=>t.enabled).reduce((s,t)=>s+(parseFloat(t.time_hours)||0),0);
  document.getElementById('nem-cust-summary').textContent=
    `${enabledCount} of ${nemState.templateTasks.length} tasks · ~${fmtHours(totalHours)} total · for "${document.getElementById('nem-name').value}"`;
  // Render grouped task list
  const list=document.getElementById('nem-cust-list');
  list.innerHTML=sortedDates.map(d=>{
    const tasks=byDate[d];
    const dateLabel=d==='unscheduled'?'Unscheduled':(d===date?`${fmtDate(d)} · Event day`:fmtDate(d));
    return `<div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;padding:0 4px">${dateLabel}</div>
      ${tasks.map(t=>nemRowHtml(t)).join('')}
    </div>`;
  }).join('')+
  `<div style="margin-top:8px;padding:10px 4px;border-top:1px dashed var(--bdr)">
    <div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Disabled</div>
    ${nemState.templateTasks.filter(t=>!t.enabled).map(t=>nemRowHtml(t)).join('')||'<div style="font-size:11px;color:var(--tx3);padding:0 4px">All tasks enabled.</div>'}
  </div>`;
}

function nemRowHtml(t){
  const idx=nemState.templateTasks.findIndex(x=>x===t||(x.title===t.title&&x.day_offset===t.day_offset&&x.sort_order===t.sort_order));
  const ownerName=getOwner(t.default_owner||'BJ').name;
  const initials=getOwner(t.default_owner||'BJ').initials||(t.default_owner||'?');
  const bg=getOwner(t.default_owner||'BJ').bg||'#eee';
  const color=getOwner(t.default_owner||'BJ').color||'#333';
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surf);border:1px solid var(--bdr);border-radius:10px;margin-bottom:6px;${t.enabled?'':'opacity:.45'}">
    <input type="checkbox" ${t.enabled?'checked':''} onchange="nemToggleTask(${idx},this.checked)" style="width:18px;height:18px;flex-shrink:0;cursor:pointer">
    <div style="flex:1;min-width:0">
      <input type="text" value="${(t.title||'').replace(/"/g,'&quot;')}" onchange="nemEditField(${idx},'title',this.value)" style="width:100%;font-size:13px;font-weight:500;color:var(--tx);background:none;border:none;padding:0;outline:none">
      <div style="display:flex;gap:8px;font-size:11px;color:var(--tx3);margin-top:2px;align-items:center">
        <span style="display:inline-flex;align-items:center;gap:4px">
          <span style="width:18px;height:18px;border-radius:50%;background:${bg};color:${color};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${initials}</span>
          <select onchange="nemEditField(${idx},'default_owner',this.value)" style="background:none;border:none;font-size:11px;color:var(--tx2);padding:0;cursor:pointer">
            ${people.map(p=>`<option value="${p.code}" ${p.code===t.default_owner?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </span>
        <span>·</span>
        <input type="number" value="${t.time_hours||0}" min="0" step="0.25" onchange="nemEditField(${idx},'time_hours',parseFloat(this.value)||0)" style="width:48px;font-size:11px;background:none;border:1px solid var(--bdr);border-radius:4px;padding:1px 4px;color:var(--tx2)"> hrs
        <span>·</span>
        <input type="date" value="${t._due||''}" onchange="nemEditField(${idx},'custom_due',this.value)" style="background:none;border:1px solid var(--bdr);border-radius:4px;padding:1px 4px;font-size:11px;color:var(--tx2)">
      </div>
    </div>
  </div>`;
}

function nemToggleTask(idx,enabled){
  if(nemState.templateTasks[idx]){
    nemState.templateTasks[idx].enabled=enabled;
    nemRenderCustomise();
  }
}

function nemEditField(idx,field,val){
  if(nemState.templateTasks[idx]){
    nemState.templateTasks[idx][field]=val;
    if(field==='custom_due'){
      nemState.templateTasks[idx]._due=val;
    }
    // Don't re-render to avoid losing focus on inputs
    // Just update summary
    if(field==='time_hours'){
      const totalHours=nemState.templateTasks.filter(t=>t.enabled).reduce((s,t)=>s+(parseFloat(t.time_hours)||0),0);
      const enabledCount=nemState.templateTasks.filter(t=>t.enabled).length;
      const summaryEl=document.getElementById('nem-cust-summary');
      if(summaryEl)summaryEl.textContent=`${enabledCount} of ${nemState.templateTasks.length} tasks · ~${fmtHours(totalHours)} total · for "${document.getElementById('nem-name').value}"`;
    }
  }
}

async function nemCommitBlank(name,date,desc){
  closeModal('new-event-modal');
  const nev={title:name,due:date||null,description:desc||null,color:'#5C8A4A',status:'active'};
  try{
    const res=await api('bravochore_events','POST',[nev]);
    if(res&&res[0])events.push(res[0]);
    chirp('Event created.');
  }catch(e){console.error('Event save failed:',e);badge('er','⚠ Event not saved');}
  renderEvents();
}

async function nemCommitEdit(name,date,desc){
  closeModal('new-event-modal');
  const ev=events.find(e=>e.id===activeEventId);
  if(!ev)return;
  ev.title=name;ev.due=date||null;ev.description=desc;
  try{await api('bravochore_events','PATCH',{title:name,due:ev.due,description:desc},`?id=eq.${activeEventId}`);}catch(e){}
  document.getElementById('ep-title')&&(document.getElementById('ep-title').textContent=name);
  renderEvents();
  if(typeof renderEventPanel==='function')renderEventPanel(ev);
}

async function nemCommit(){
  const name=document.getElementById('nem-name')?.value.trim();
  const date=document.getElementById('nem-date')?.value;
  const desc=document.getElementById('nem-desc')?.value||'';
  if(!name||!date){chirp('Need a name and date.');return;}
  closeModal('new-event-modal');
  badge('sy','↻ Creating event…');
  // 1. Create event
  const nev={title:name,due:date,description:desc||null,color:'#5C8A4A',status:'active'};
  let evId=null;
  try{
    const res=await api('bravochore_events','POST',[nev]);
    if(res&&res[0]){events.push(res[0]);evId=res[0].id;}
  }catch(e){console.error('Event save failed:',e);chirp('Could not create event.');return;}
  if(!evId){chirp('Event creation failed.');return;}
  // 2. Create tasks for each enabled template task
  const enabled=nemState.templateTasks.filter(t=>t.enabled);
  let nextSort=tasks.length+1;
  const newTasks=enabled.map(t=>({
    id:Date.now()+Math.floor(Math.random()*10000),
    title:t.title,
    owner:t.default_owner||'BJ',
    due:t._due||t.custom_due||date,
    time_hours:parseFloat(t.time_hours)||0,
    bucket:t.bucket||'Indoor',
    notes:t.notes||'',
    done:false,
    sort_order:nextSort++,
    photo_urls:[],
    task_code:null, // assigned by getNextCode after tasks loaded
    event_id:evId,
    status:'active'
  }));
  // Assign task codes locally
  newTasks.forEach(nt=>{
    tasks.push(nt);
    nt.task_code=getNextCode();
  });
  try{
    const inserted=await api('bravochore_tasks','POST',newTasks);
    if(inserted&&inserted.length){
      // Replace local copies with server-returned rows (which have stable IDs/timestamps)
      newTasks.forEach((nt,i)=>{
        const idx=tasks.findIndex(x=>x.id===nt.id);
        if(idx>=0&&inserted[i])tasks[idx]=inserted[i];
      });
    }
    badge('ok','✓');
    chirp(`"${name}" created with ${enabled.length} tasks.`);
  }catch(e){
    console.error('Task batch insert failed:',e);
    chirp('Event created but tasks failed to save. Please check connection.');
  }
  renderEvents();rerender();
}

// Edit-existing event (called from the event panel)
function editCurrentEvent(){
  if(!activeEventId)return;
  const ev=events.find(e=>e.id===activeEventId);if(!ev)return;
  nemState={step:'details',templateId:null,templateName:'',templateTasks:[],isEdit:true};
  document.getElementById('nem-title').textContent='Edit Event';
  document.getElementById('nem-name').value=ev.title;
  document.getElementById('nem-date').value=ev.due||'';
  document.getElementById('nem-desc').value=ev.description||'';
  document.getElementById('nem-next-btn').textContent='Save →';
  nemShowStep('details');
  openModal('new-event-modal');
}

async function saveNewEvent(){nemNext();} // back-compat shim

// ================================================================
// SAVE EVENT AS TEMPLATE
// ================================================================
async function saveEventAsTemplate(){
  if(!activeEventId)return;
  const ev=events.find(e=>e.id===activeEventId);if(!ev)return;
  const evTasks=tasks.filter(t=>t.event_id===ev.id);
  if(!evTasks.length){chirp('No tasks to save — add some first.');return;}
  const result=await promptSheet({
    title:'Save as template',
    subtitle:'Templates let you spin up similar events later with the same prep tasks pre-populated.',
    confirmLabel:'Save template',
    fields:[
      {name:'name',label:'Template name',value:ev.title,required:true},
      {name:'desc',label:'Description (optional)',type:'textarea',value:ev.description||'',placeholder:'A line or two about when to use this template.'}
    ]
  });
  if(!result)return;
  const name=result.name;
  const desc=result.desc||'';
  badge('sy','↻ Saving template…');
  // Insert template row
  let templateId=null;
  try{
    const r=await api('bravochore_event_templates','POST',[{name,description:desc}]);
    if(r&&r[0])templateId=r[0].id;
  }catch(e){console.error(e);chirp('Could not save template.');return;}
  if(!templateId){chirp('Template save failed.');return;}
  // Compute day_offset for each task
  const eventDate=new Date(ev.due+'T00:00:00');
  const rows=evTasks.map((t,i)=>{
    let offset=0;
    if(t.due){
      const td=new Date(t.due+'T00:00:00');
      offset=Math.round((td-eventDate)/86400000);
    }
    return{
      template_id:templateId,
      title:t.title,
      default_owner:t.owner||'BJ',
      time_hours:parseFloat(t.time_hours)||0,
      day_offset:offset,
      prefer_weekend:false,
      bucket:t.bucket||'Indoor',
      notes:t.notes||'',
      sort_order:(i+1)*10
    };
  });
  try{await api('bravochore_event_template_tasks','POST',rows);}
  catch(e){console.error(e);}
  badge('ok','✓');
  chirp(`Saved as template "${name}".`);
  await loadEventTemplates();
}

// ================================================================
// TEMPLATE MANAGER
// ================================================================
function openTemplateManager(){
  const bd=document.createElement('div');bd.className='modal-bd open';
  bd.innerHTML=`
    <div class="modal" style="max-width:640px;width:94vw;max-height:88vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0">Event templates</h3>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div id="tm-body" style="flex:1;overflow-y:auto;padding:14px 18px">Loading…</div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
  loadEventTemplates().then(renderTemplateManager);
}

async function renderTemplateManager(){
  const body=document.getElementById('tm-body');
  if(!body)return;
  if(!eventTemplates.length){
    body.innerHTML='<div style="font-size:13px;color:var(--tx2);padding:10px">No templates yet. Save an event as a template to start a library.</div>';
    return;
  }
  // Load task counts in parallel
  const counts=await Promise.all(eventTemplates.map(t=>loadTemplateTasks(t.id).then(r=>r.length)));
  body.innerHTML=eventTemplates.map((t,i)=>`
    <div style="border:1px solid var(--bdr);background:var(--surf);border-radius:var(--rs);padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:500;color:var(--tx)">${t.name}</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${counts[i]} task${counts[i]===1?'':'s'}</div>
          ${t.description?`<div style="font-size:12px;color:var(--tx2);margin-top:6px;line-height:1.4">${t.description}</div>`:''}
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="qa-btn" style="font-size:11px;padding:6px 12px" onclick="openTemplateEditor(${t.id})">Edit tasks</button>
        <button class="qa-btn" style="font-size:11px;padding:6px 12px" onclick="renameTemplate(${t.id})">Rename</button>
        <button class="qa-btn" style="font-size:11px;padding:6px 12px;color:var(--red);border-color:var(--red)" onclick="deleteTemplate(${t.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function renameTemplate(id){
  const tpl=eventTemplates.find(t=>t.id===id);if(!tpl)return;
  const result=await promptSheet({
    title:'Rename template',
    confirmLabel:'Save',
    fields:[
      {name:'name',label:'Template name',value:tpl.name,required:true},
      {name:'desc',label:'Description',type:'textarea',value:tpl.description||''}
    ]
  });
  if(!result)return;
  const name=result.name;
  const desc=result.desc||'';
  if(name===tpl.name&&desc===(tpl.description||''))return;
  try{
    await api('bravochore_event_templates','PATCH',{name,description:desc},`?id=eq.${id}`);
    tpl.name=name;tpl.description=desc;
    renderTemplateManager();
    chirp('Renamed.');
  }catch(e){chirp('Rename failed.');}
}

async function deleteTemplate(id){
  const tpl=eventTemplates.find(t=>t.id===id);if(!tpl)return;
  const ok=await confirm2(`Delete template "${tpl.name}"?`,'This removes the template and all its task definitions. Events already created from it are unaffected.','btn-ok');
  if(!ok)return;
  try{
    await api('bravochore_event_template_tasks','DELETE',null,`?template_id=eq.${id}`);
    await api('bravochore_event_templates','DELETE',null,`?id=eq.${id}`);
    eventTemplates=eventTemplates.filter(t=>t.id!==id);
    renderTemplateManager();
    chirp('Template deleted.');
  }catch(e){chirp('Delete failed.');}
}

async function openTemplateEditor(id){
  const tpl=eventTemplates.find(t=>t.id===id);if(!tpl)return;
  const tasks=await loadTemplateTasks(id);
  const bd=document.createElement('div');bd.className='modal-bd open';
  bd.innerHTML=`
    <div class="modal" style="max-width:680px;width:94vw;max-height:90vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
        <div>
          <h3 style="margin:0">${tpl.name}</h3>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${tasks.length} task${tasks.length===1?'':'s'} · offsets are days from event day</div>
        </div>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div id="te-body" style="flex:1;overflow-y:auto;padding:12px 16px"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);display:flex;gap:8px;justify-content:space-between;background:var(--surf2)">
        <button class="qa-btn" onclick="addTemplateTask(${id})">+ Add task</button>
        <button class="btn-ok" onclick="this.closest('.modal-bd').remove()">Done</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
  window._teTasks=tasks;window._teTemplateId=id;
  renderTemplateEditor();
}

function renderTemplateEditor(){
  const body=document.getElementById('te-body');
  if(!body)return;
  const ts=window._teTasks||[];
  // Group by offset
  const byOff={};
  ts.forEach(t=>{(byOff[t.day_offset]=byOff[t.day_offset]||[]).push(t);});
  const offsets=Object.keys(byOff).map(Number).sort((a,b)=>a-b);
  body.innerHTML=offsets.map(off=>{
    const label=off===0?'Day of event':off===-1?'Day before':`${Math.abs(off)} days before`;
    return `<div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
      ${byOff[off].map(t=>teRowHtml(t)).join('')}
    </div>`;
  }).join('');
}

function teRowHtml(t){
  return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--surf);border:1px solid var(--bdr);border-radius:10px;margin-bottom:6px;flex-wrap:wrap">
    <input type="text" value="${(t.title||'').replace(/"/g,'&quot;')}" onchange="updateTemplateTask(${t.id},'title',this.value)" style="flex:1;min-width:120px;font-size:13px;font-weight:500;background:none;border:none;outline:none;color:var(--tx)">
    <select onchange="updateTemplateTask(${t.id},'default_owner',this.value)" style="font-size:11px;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:3px 6px;color:var(--tx2)">
      ${people.map(p=>`<option value="${p.code}" ${p.code===t.default_owner?'selected':''}>${p.name}</option>`).join('')}
    </select>
    <input type="number" value="${t.time_hours||0}" min="0" step="0.25" onchange="updateTemplateTask(${t.id},'time_hours',parseFloat(this.value)||0)" style="width:54px;font-size:11px;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:3px 6px;color:var(--tx2)" title="Hours">
    <input type="number" value="${t.day_offset||0}" max="0" step="1" onchange="updateTemplateTask(${t.id},'day_offset',parseInt(this.value)||0)" style="width:46px;font-size:11px;background:var(--surf2);border:1px solid var(--bdr);border-radius:6px;padding:3px 6px;color:var(--tx2)" title="Day offset">
    <label style="font-size:10px;color:var(--tx3);display:inline-flex;align-items:center;gap:3px;cursor:pointer">
      <input type="checkbox" ${t.prefer_weekend?'checked':''} onchange="updateTemplateTask(${t.id},'prefer_weekend',this.checked)"> wknd
    </label>
    <button onclick="deleteTemplateTask(${t.id})" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:2px 6px" title="Delete">×</button>
  </div>`;
}

async function updateTemplateTask(id,field,val){
  const t=(window._teTasks||[]).find(x=>x.id===id);if(!t)return;
  t[field]=val;
  try{await api('bravochore_event_template_tasks','PATCH',{[field]:val},`?id=eq.${id}`);badge('ok','✓');}
  catch(e){badge('er','⚠');}
  // Re-render only on offset change so groupings update
  if(field==='day_offset')renderTemplateEditor();
}

async function deleteTemplateTask(id){
  const ok=await confirm2('Delete this task from the template?','Existing events that used this template are unaffected.','btn-ok');
  if(!ok)return;
  try{await api('bravochore_event_template_tasks','DELETE',null,`?id=eq.${id}`);}catch(e){}
  window._teTasks=(window._teTasks||[]).filter(x=>x.id!==id);
  renderTemplateEditor();
}

async function addTemplateTask(templateId){
  const ownerOptions=people.map(p=>({value:p.code,label:p.name+' ('+p.code+')'}));
  const result=await promptSheet({
    title:'Add task to template',
    subtitle:'Day offset is days before the event (e.g. -7 = a week before, 0 = day of).',
    confirmLabel:'Add task',
    fields:[
      {name:'title',label:'Task title',value:'',required:true,placeholder:'e.g. Confirm bookings'},
      {name:'day_offset',label:'Days before event',type:'number',value:-1,step:1},
      {name:'default_owner',label:'Default owner',type:'select',options:ownerOptions,value:ownerOptions[0]?.value||''},
      {name:'time_hours',label:'Time estimate (hours)',type:'number',value:0.5,step:0.25,min:0}
    ]
  });
  if(!result)return;
  const title=result.title;
  const offset=Math.round(result.day_offset||0);
  const owner=result.default_owner||(people[0]?.code||'BJ');
  const hours=result.time_hours||0;
  const newRow={template_id:templateId,title,default_owner:owner,time_hours:hours,day_offset:offset,prefer_weekend:false,bucket:'Indoor',notes:'',sort_order:((window._teTasks||[]).length+1)*10};
  try{
    const r=await api('bravochore_event_template_tasks','POST',[newRow]);
    if(r&&r[0]){
      window._teTasks=(window._teTasks||[]).concat([r[0]]);
      renderTemplateEditor();
    }
  }catch(e){chirp('Could not add task.');}
}

// ── Event auto-assign on task creation ──
function getActiveEvent(){
  const v=document.querySelector('.view.active');
  // If we're in an event panel, auto-assign
  if(document.getElementById('event-panel')?.classList.contains('open')&&activeEventId)return activeEventId;
  return null;
}

// ================================================================
// SHELVED
// ================================================================
function renderShelved(){
  const list=document.getElementById('shelved-list');
  if(!list)return;
  const se=document.getElementById('shelved-empty');
  if(!shelved.length){list.innerHTML='';if(se)se.style.display='block';return;}
  if(se)se.style.display='none';
  setTimeout(()=>initDragList(document.getElementById('shelved-list')),80);
  list.innerHTML=shelved.map(s=>{
    const owner=getOwner(s.owner||CU);
    const hasPhoto=(s.photo_urls&&s.photo_urls.length);
    const hasNotes=s.notes;
    return `<div class="task-card" data-sid="${s.id}" style="border-left:3px solid var(--bdrm)" onclick="openShelvedDetail(${s.id})">
      <div class="task-row">
        <div class="task-main">
          <div class="task-title">${s.title}</div>
          <div class="task-meta">
            <span class="task-tag" style="background:${owner.bg};color:${owner.color}">${owner.name}</span>
            ${s.due?`<span class="task-date ${s.due<tdStr()?'ov':''}">${fmtDate(s.due)}</span>`:''}
            ${s.task_code?`<span class="task-code">${s.task_code}</span>`:''}
            ${s.time_hours?`<span class="task-time-b">${fmtHours(parseFloat(s.time_hours))}</span>`:''}
            ${hasPhoto?`<span class="task-time-b">📷${s.photo_urls.length}</span>`:''}
          </div>
          ${hasNotes?`<div style="font-size:11px;color:var(--tx2);margin-top:4px;font-style:italic">${s.notes.slice(0,80)}${s.notes.length>80?'…':''}</div>`:''}
        </div>
        <button class="shelved-promote-btn" onclick="event.stopPropagation();promoteShelved(${s.id})" style="flex-shrink:0">↑ Activate</button>
      </div>
    </div>`;
  }).join('');
}

function openAddShelvedSheet(){
  document.getElementById('asm-title').value='';
  document.getElementById('asm-notes').value='';
  openModal('add-shelved-modal');
  setTimeout(()=>document.getElementById('asm-title')?.focus(),100);
}

async function saveShelvedItem(){
  const title=document.getElementById('asm-title')?.value.trim();
  if(!title){chirp('Please enter a title.');return;}
  const notes=document.getElementById('asm-notes')?.value||'';
  closeModal('add-shelved-modal');
  const nid=Date.now();
  const nt={id:nid,title,notes,owner:CU,due:null,time_hours:0,bucket:'Indoor',done:false,
    sort_order:shelved.length+1,photo_urls:[],task_code:getNextCode(),
    event_id:null,status:'shelved'};
  tasks.push(nt);
  try{
    const res=await api('bravochore_tasks','POST',[nt]);
    if(res&&res[0]){const idx=tasks.findIndex(t=>t.id===nid);if(idx>=0)tasks[idx]=res[0];}
  }catch(e){}
  refreshShelvedView();
  renderShelved();
}

async function promoteShelved(id){
  const t=tasks.find(x=>x.id===id&&x.status==='shelved');if(!t)return;
  // In-place activate: same task ID, all chats/photos/milestones come with it automatically
  t.status='active';
  if(!t.event_id)t.event_id=getActiveEvent()||null;
  try{await api('bravochore_tasks','PATCH',{status:'active',event_id:t.event_id},`?id=eq.${id}`);}
  catch(e){t.status='shelved';chirp('Could not activate — please try again.');return;}
  refreshShelvedView();
  renderShelved();rerender();
  chirp(`"${t.title}" moved to active tasks.`);
}

async function deleteShelved(id){
  tasks=tasks.filter(x=>x.id!==id);
  refreshShelvedView();
  renderShelved();
  try{await api('bravochore_tasks','DELETE',null,`?id=eq.${id}`);}catch(e){}
  try{await api('bravochore_milestones','DELETE',null,`?task_id=eq.${id}`);}catch(e){}
  try{await api('bravochore_task_chats','DELETE',null,`?task_id=eq.${id}`);}catch(e){}
}

function openShelvedDetail(id){
  const s=tasks.find(x=>x.id===id&&x.status==='shelved');if(!s)return;
  // Build a task-like object and open the detail panel
  dpTaskId=null; // signal shelved mode
  dpShelvedId=id;
  // Populate the panel manually
  const bd=document.getElementById('detail-backdrop');
  const dp=document.getElementById('detail-panel');
  if(!bd||!dp)return;
  document.getElementById('dp-title').textContent=s.title;
  const check=document.getElementById('dp-check');
  if(check){check.className='dp-check';check.onclick=()=>{};}
  // Build body
  renderDpBodyForShelved(s);
  bd.classList.add('open');dp.classList.add('open');
  // Swap footer buttons for shelved mode
  const footer=document.querySelector('.dp-footer');
  if(footer){
    footer.innerHTML=`
      <button class="dp-del" onclick="deleteShelvedFromDetail()">Delete</button>
      <button class="dp-del" onclick="saveShelvedFromDetail()" style="background:none;border-color:var(--bdrm);color:var(--tx2)">Save</button>
      <button class="dp-save" onclick="promoteShelvedFromDetail()">↑ Activate</button>`;
  }
}

let dpShelvedId=null;

function renderDpBodyForShelved(s){
  const dp=document.getElementById('dp-body');if(!dp)return;
  const today=tdStr();
  dp.innerHTML=`
    <div class="dp-meta-row" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <span class="task-tag" style="background:${getOwner(s.owner||CU).bg};color:${getOwner(s.owner||CU).color}">${getOwner(s.owner||CU).name}</span>
      ${s.task_code?`<span class="task-code">${s.task_code}</span>`:''}
      <span style="font-size:11px;color:var(--amber);background:var(--al);padding:2px 7px;border-radius:100px;font-weight:600">Shelved</span>
    </div>
    <div class="dp-row2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="dp-field"><label class="dp-label">Owner</label>
        <select class="dp-select" id="sdp-owner">
          ${people.map(p=>`<option value="${p.code}" ${(s.owner||CU)===p.code?'selected':''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="dp-field"><label class="dp-label">Bucket</label>
        <select class="dp-select" id="sdp-bucket">
          <option ${s.bucket==='Indoor'||!s.bucket?'selected':''}>Indoor</option>
          <option ${s.bucket==='Outdoor'?'selected':''}>Outdoor</option>
        </select>
      </div>
    </div>
    <div class="dp-row2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="dp-field"><label class="dp-label">Target date</label>
        <input type="date" class="dp-input" id="sdp-due" value="${s.due||''}">
      </div>
      <div class="dp-field"><label class="dp-label">Est. time</label>
        <div style="display:flex;gap:5px;flex-wrap:wrap" id="sdp-time-btns">
          ${[0.25,0.5,1,1.5,2,3,4].map(v=>{
            const cur=parseFloat(s.time_hours||0);const active=Math.abs(cur-v)<0.01;
            const lbl=v<1?(v*60)+'m':v===1?'1h':v+'h';
            return `<button type="button" onclick="sdpSetTime(${v},this)" style="padding:5px 9px;border-radius:100px;border:1.5px solid ${active?'var(--green)':'var(--bdrm)'};background:${active?'var(--green)':'var(--surf)'};color:${active?'#fff':'var(--tx2)'};font-size:11px;font-weight:600;cursor:pointer">${lbl}</button>`;
          }).join('')}
        </div>
        <input type="hidden" id="sdp-time" value="${s.time_hours||0}">
      </div>
    </div>
    <div class="dp-field"><label class="dp-label">Notes & research</label>
      <textarea class="dp-textarea" id="sdp-notes" rows="4" placeholder="Ideas, links, measurements, research notes...">${s.notes||''}</textarea>
    </div>
    ${(s.photo_urls&&s.photo_urls.length)?`<div class="dp-field"><label class="dp-label">Photos</label><div style="display:flex;gap:6px;flex-wrap:wrap">${s.photo_urls.map(u=>`<img src="${u}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="window.open('${u}','_blank')">`).join('')}</div></div>`:''}
    <div style="display:flex;gap:8px;margin-top:8px">
      <label class="photo-action-btn" for="photo-input-cam" style="flex:1;justify-content:center" onclick="window._photoTargetShelvedId=${s.id}">📷 Add photo</label>
    </div>`;
}

function sdpSetTime(val,btn){
  document.getElementById('sdp-time').value=val;
  document.querySelectorAll('#sdp-time-btns button').forEach(b=>{
    const on=b===btn;b.style.background=on?'var(--green)':'var(--surf)';
    b.style.borderColor=on?'var(--green)':'var(--bdrm)';b.style.color=on?'#fff':'var(--tx2)';
  });
}

async function saveShelvedFromDetail(){
  const t=tasks.find(x=>x.id===dpShelvedId);if(!t)return;
  t.title=document.getElementById('dp-title').textContent.trim()||t.title;
  t.owner=document.getElementById('sdp-owner')?.value||t.owner;
  t.due=document.getElementById('sdp-due')?.value||null;
  t.time_hours=parseFloat(document.getElementById('sdp-time')?.value)||0;
  t.bucket=document.getElementById('sdp-bucket')?.value||t.bucket;
  t.notes=document.getElementById('sdp-notes')?.value||'';
  try{await api('bravochore_tasks','PATCH',{title:t.title,owner:t.owner,due:t.due,time_hours:t.time_hours,bucket:t.bucket,notes:t.notes},`?id=eq.${t.id}`);}catch(e){}
  refreshShelvedView();
  closeDetail();renderShelved();chirp('Saved.');
}

async function deleteShelvedFromDetail(){
  const id=dpShelvedId;
  const confirmed=await confirm2('Delete this shelved task?','This permanently removes the task and any chat or photos attached to it. Cannot be undone.','btn-ok');
  if(!confirmed)return;
  tasks=tasks.filter(x=>x.id!==id);
  refreshShelvedView();
  try{await api('bravochore_tasks','DELETE',null,`?id=eq.${id}`);}catch(e){}
  try{await api('bravochore_milestones','DELETE',null,`?task_id=eq.${id}`);}catch(e){}
  try{await api('bravochore_task_chats','DELETE',null,`?task_id=eq.${id}`);}catch(e){}
  closeDetail();renderShelved();chirp('Deleted.');
}

async function promoteShelvedFromDetail(){
  const id=dpShelvedId;
  const t=tasks.find(x=>x.id===id);if(!t)return;
  // Capture any field edits made in the detail panel before activating
  const title=document.getElementById('dp-title').textContent.trim()||t.title;
  const owner=document.getElementById('sdp-owner')?.value||t.owner||CU;
  const due=document.getElementById('sdp-due')?.value||null;
  const time_hours=parseFloat(document.getElementById('sdp-time')?.value)||0;
  const bucket=document.getElementById('sdp-bucket')?.value||t.bucket||'Indoor';
  const notes=document.getElementById('sdp-notes')?.value||t.notes||'';
  // In-place activate: same task ID, all related data (chats, photos, milestones) follows
  Object.assign(t,{title,owner,due,time_hours,bucket,notes,status:'active'});
  try{await api('bravochore_tasks','PATCH',{title,owner,due,time_hours,bucket,notes,status:'active'},`?id=eq.${id}`);}
  catch(e){t.status='shelved';chirp('Could not activate.');return;}
  refreshShelvedView();
  closeDetail();bnNav('tasks');chirp('"'+title+'" is now active.');
}


function getNextCode(){
  const codes=tasks.map(t=>t.task_code).filter(Boolean);
  const nums=codes.map(c=>parseInt(c.replace('BC',''))||0);
  const max=nums.length?Math.max(...nums):0;
  return 'BC'+String(max+1).padStart(3,'0');
}

// Assign codes to any tasks missing them (runs on load)
function assignMissingCodes(){
  let changed=false;
  tasks.forEach(t=>{
    if(!t.task_code){
      t.task_code=getNextCode();
      changed=true;
      api('bravochore_tasks','PATCH',{task_code:t.task_code},`?id=eq.${t.id}`).catch(()=>{});
    }
  });
  return changed;
}


