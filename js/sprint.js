// ================================================================
// USER PREFERENCES
// ================================================================
let userPrefs={};

function loadPrefs(){
  try{const s=localStorage.getItem('bc-prefs-'+CU);if(s)userPrefs=JSON.parse(s);}catch(e){}
  applyPrefs();
}

function savePref(key,val){
  userPrefs[key]=val;
  try{localStorage.setItem('bc-prefs-'+CU,JSON.stringify(userPrefs));}catch(e){}
  applyPrefs();
}

function getPref(key,def){return userPrefs[key]!==undefined?userPrefs[key]:def;}

function applyPrefs(){
  // Compact cards
  document.body.classList.toggle('compact-cards',getPref('compactCards',false));
}


function detectSprintIntent(msg){
  return /sprint|build.*tool|get.*done|execute|tackle|power.*through|crunch|focus.*session|what can i get done|help me get/i.test(msg);
}

// ── STEP 1: Trigger from Blackbird chat ──
async function startSprintFlow(userMsg){
  const now=new Date();
  const hour=now.getHours();
  const hoursLeft=Math.max(1,Math.min(10,22-hour)); // rough usable hours left today
  const pending=tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
  const totalH=pending.reduce((s,t)=>s+getEffectiveTime(t),0);
  const overdue=pending.filter(t=>t.due&&t.due<tdStr());

  // Reality check message from Blackbird
  const realism=totalH>hoursLeft*1.5
    ?`You've got ${fmtHours(totalH)} of tasks and it's ${hour}:00 — realistically ${hoursLeft}h to work with today. `
    :'';

  bbMsg(`${realism}Let's pick what you're actually going to nail today. Tap the tasks you want in your sprint — I'll build you a focused tool around them.`,'from-bb');

  // Show task picker in chat
  setTimeout(()=>showSprintPicker(pending, hoursLeft),400);
}

function showSprintPicker(pending, hoursLeft){
  const msgs=document.getElementById('bb-msgs');if(!msgs)return;

  // Pre-select: overdue + due today + fits in available hours
  const today=tdStr();
  const preSelected=new Set();
  let budget=0;
  const sorted=[
    ...pending.filter(t=>t.due&&t.due<=today),
    ...pending.filter(t=>!t.due||t.due>today)
  ];
  sorted.forEach(t=>{
    const h=getEffectiveTime(t)||0.5;
    if(budget+h<=hoursLeft*0.8){preSelected.add(t.id);budget+=h;}
  });

  const card=document.createElement('div');
  card.className='bb-preview-card';
  card.style.cssText='background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);overflow:hidden;margin-top:4px;width:100%';
  card.innerHTML=`
    <div style="padding:10px 14px;background:var(--surf2);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:'Playfair Display',serif;font-size:14px;font-weight:500">Pick your sprint tasks</div>
      <span id="sprint-pick-time" style="font-size:11px;font-family:'DM Mono',monospace;color:var(--green);font-weight:700">${fmtHours(budget)}</span>
    </div>
    <div id="sprint-pick-list" style="max-height:320px;overflow-y:auto">
      ${sorted.slice(0,20).map(t=>{
        const sel=preSelected.has(t.id);
        const o=getOwner(t.owner);
        const h=getEffectiveTime(t);
        const ov=t.due&&t.due<today;
        return `<div id="spl-${t.id}" style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--bdr);cursor:pointer;background:${sel?'var(--gl)':''};" onclick="toggleSprintPick(${t.id},${h})">
          <div id="splc-${t.id}" style="width:20px;height:20px;border-radius:4px;border:2px solid ${sel?'var(--green)':'var(--bdrm)'};background:${sel?'var(--green)':'#fff'};flex-shrink:0;display:flex;align-items:center;justify-content:center">
            ${sel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</div>
            <div style="display:flex;gap:5px;margin-top:2px;align-items:center">
              <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
              ${t.due?`<span style="font-size:10px;color:${ov?'var(--red)':'var(--tx3)'}">${fmtDate(t.due)}</span>`:''}
              ${h?`<span style="font-size:10px;color:var(--tx3)">${fmtHours(h)}</span>`:''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--bdr)">
      <button onclick="launchSprint()" style="width:100%;padding:12px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;cursor:pointer">⚡ Build sprint tool</button>
    </div>`;
  msgs.appendChild(card);
  msgs.scrollTop=msgs.scrollHeight;
  window._sprintSelected=preSelected;
  window._sprintBudget=budget;
  window._sprintHoursLeft=hoursLeft;
}

function toggleSprintPick(taskId, hours){
  const sel=window._sprintSelected;if(!sel)return;
  const chk=document.getElementById('splc-'+taskId);
  const row=document.getElementById('spl-'+taskId);
  if(sel.has(taskId)){
    sel.delete(taskId);
    window._sprintBudget-=hours;
    if(chk){chk.style.borderColor='var(--bdrm)';chk.style.background='#fff';chk.innerHTML='';}
    if(row)row.style.background='';
  }else{
    sel.add(taskId);
    window._sprintBudget+=hours;
    if(chk){chk.style.borderColor='var(--green)';chk.style.background='var(--green)';chk.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';}
    if(row)row.style.background='var(--gl)';
  }
  const timeEl=document.getElementById('sprint-pick-time');
  if(timeEl)timeEl.textContent=fmtHours(Math.max(0,window._sprintBudget));
}

async function launchSprint(){
  const sel=window._sprintSelected;
  if(!sel||!sel.size){chirp('Select at least one task.');return;}
  const sprintTasks=tasks.filter(t=>sel.has(t.id));
  if(!sprintTasks.length)return;
  closeBBFullscreen();
  // Show loading screen
  showSprintLoading();
  // Generate the tool
  await generateSprintTool(sprintTasks);
}

function showSprintLoading(){
  // Sprint now builds instantly from template — just show briefly
  const el=document.getElementById('sprint-loading');
  if(el){el.style.display='flex';}
  const bar=document.getElementById('sprint-loading-bar');
  const status=document.getElementById('sprint-loading-status');
  if(status)status.textContent='Assembling your sprint…';
  // Quick progress fill since it's instant
  let pct=0;
  clearInterval(window._sprintLoadInterval);
  window._sprintLoadInterval=setInterval(()=>{
    pct=Math.min(100,pct+12);
    if(bar)bar.style.width=pct+'%';
    if(pct>=100)clearInterval(window._sprintLoadInterval);
  },60);
  if(typeof lottie!=='undefined'){
    const lb=document.getElementById('sprint-loading-bird');
    if(lb&&!lb.dataset.init){
      lb.dataset.init='1';lb.style.background='transparent';lb.style.border='none';
      const a=lottie.loadAnimation({container:lb,renderer:'svg',loop:true,autoplay:true,animationData:BLACKBIRD_ANIM});
      a.setSpeed(0.9);
    }
  }
}

function hideSprintLoading(){
  clearInterval(window._sprintLoadInterval);
  const bar=document.getElementById('sprint-loading-bar');
  if(bar)bar.style.width='100%';
  setTimeout(()=>{
    const el=document.getElementById('sprint-loading');
    if(el)el.style.display='none';
  },400);
}

async function generateSprintTool(sprintTasks){
  // Build the sprint tool directly — no AI generation needed
  // Fast, consistent, works offline
  const html=buildSprintHTML(sprintTasks,[]);
  activateSprint(sprintTasks,html,[]);
}

function buildSprintHTML(sprintTasks, allItems){
  // Sprint tool is built from real BravoChore task cards — no generated HTML.
  // The sprint-tool-inner div is populated in activateSprint using renderSprintTasks().
  // This function just returns a simple scaffold.
  const taskItems=allItems?allItems.filter(i=>i.type==='task'):sprintTasks.map(t=>({type:'task',id:t.id}));
  const routineItems=allItems?allItems.filter(i=>i.type==='routine'):[];
  return {taskItems, routineItems};
}


function activateSprint(sprintTasks, html, allItems){
  hideSprintLoading(); // dismiss loading screen

  sprintActive=true;
  sprintElapsed=0;
  const title=sprintTasks.length===1?sprintTasks[0].title:
    (allItems&&allItems.length?allItems.length+'-item sprint':sprintTasks.length+'-task sprint');

  // Calculate total hours including routines
  const sprintTotalH=(allItems||[]).reduce((s,i)=>s+(i.hours||0),0) ||
    sprintTasks.reduce((s,t)=>s+getEffectiveTime(t),0);
  const sprintRoutineCount=(allItems||[]).filter(i=>i.type==='routine').length;

  sprintData={
    taskIds:sprintTasks.map(t=>t.id),
    doneTasks:new Set(),
    doneRoutines:new Set(),
    title,
    dbId:null,
    allItems:allItems||null,
    totalH:sprintTotalH,
    routineCount:sprintRoutineCount
  };

  // Save to DB
  api('bravochore_sprints','POST',[{
    user_code:CU,title,
    task_ids:JSON.stringify(sprintTasks.map(t=>t.id)),
    status:'active',
    tasks_total:sprintTasks.length
  }]).then(r=>{if(r&&r[0])sprintData.dbId=r[0].id;}).catch(()=>{});

  // window.sprintTickTask no longer needed — quickTick handles sprint tracking
  // Kept for safety in case any residual HTML calls it
  window.sprintTickTask=async(taskId)=>{
    const t=tasks.find(x=>x.id===parseInt(taskId));
    if(t){const fakeE={stopPropagation:()=>{},target:document.body};await quickTick(parseInt(taskId),fakeE);}
  };
  window.sprintTickRoutine=(idx)=>sprintToggleRoutine(idx);
  window.sprintEditTask=(taskId)=>openDetail(parseInt(taskId));
  window.getSprintElapsed=()=>sprintElapsed;

  // Render tasks into the tool area
  renderSprintTasks();
  renderSprintDrawer();

  // Update header
  document.getElementById('sprint-title').textContent=title;
  updateSprintProgress();

  // Show the overlay
  document.getElementById('sprint-overlay').classList.add('active');

  // Start timer
  clearInterval(sprintTimer);
  // Save immediately so refresh recovery works from second 1
  saveSprintState();

  // Restore elapsed display if resuming
  if(sprintElapsed>0){
    const m=Math.floor(sprintElapsed/60),s=sprintElapsed%60;
    const el=document.getElementById('sprint-elapsed');
    if(el)el.textContent=m+':'+(s<10?'0':'')+s;
  }
  sprintTimer=setInterval(()=>{
    sprintElapsed++;
    const m=Math.floor(sprintElapsed/60),s=sprintElapsed%60;
    const timeStr=m+':'+(s<10?'0':'')+s;
    const el=document.getElementById('sprint-elapsed');
    if(el)el.textContent=timeStr;
    const tmr=document.getElementById('sprint-tmr');
    if(tmr)tmr.textContent=timeStr;
    // Reflect elapsed in the now-playing bar
    const snbTime=document.getElementById('snb-time');
    if(snbTime)snbTime.textContent=timeStr;
    // Update task timer buttons that are active
    document.querySelectorAll('.timer-on').forEach(btn=>{
      const taskId=btn.id?.replace('stimer-','');
      if(taskId)btn.style.color='var(--red)';
    });
    // Update remaining time every 60s
    if(sprintElapsed%60===0)updateSprintProgress();
    if(sprintElapsed%30===0)saveSprintState();
  },1000);

  updateSprintFAB();
}

// ================================================================
// SPRINT NOW-PLAYING BAR
// ================================================================
// One persistent affordance, three states:
//   1. ACTIVE   — sprint running, overlay visible. Bar hidden (overlay covers).
//   2. MINIMISED — sprint running, overlay hidden. Bar shows live progress; tap to reopen.
//   3. RESUMABLE — no sprint active, but a saved sprint state survives in localStorage
//                  (typically because the page was refreshed mid-sprint). Bar shows
//                  "Resume sprint? X tasks" with tap to resume.
//   4. IDLE     — no sprint, no saved state. Bar hidden.
// Sprint entry for new sprints lives on the dashboard "Sprint" pill — no FAB.
function onSprintFabClick(){
  // If a sprint is currently active, reopen its overlay.
  if(typeof sprintActive!=='undefined'&&sprintActive){
    const o=document.getElementById('sprint-overlay');
    if(o)o.classList.add('active');
    return;
  }
  // Otherwise check for a saved (refresh-recoverable) sprint and resume it.
  const saved=typeof loadSprintState==='function'?loadSprintState():null;
  if(saved&&saved.taskIds&&saved.taskIds.length){
    if(typeof resumeSprint==='function')resumeSprint();
    return;
  }
  // Nothing to resume — open the builder so user can start fresh.
  if(typeof openSprintBuilder==='function')openSprintBuilder();
}

// Hide the sprint overlay without ending the sprint. Sprint state stays
// active in memory + localStorage; the now-bar appears so the user can
// reopen later. Required so the now-bar is ever visible mid-sprint.
function minimiseSprint(){
  document.getElementById('sprint-overlay')?.classList.remove('active');
  updateSprintFAB();
}

function updateSprintFAB(){
  const bar=document.getElementById('sprint-now-bar');
  if(!bar)return;
  const titleEl=document.getElementById('snb-title');
  const metaEl=document.getElementById('snb-meta');
  const timeEl=document.getElementById('snb-time');
  const userReady=(typeof CU!=='undefined')&&!!CU;
  const active=(typeof sprintActive!=='undefined')&&sprintActive;
  const overlayOpen=document.getElementById('sprint-overlay')?.classList.contains('active');
  if(!userReady){bar.classList.remove('show');return;}
  // ACTIVE + overlay open → bar hidden (overlay covers everything anyway)
  if(active&&overlayOpen){bar.classList.remove('show');return;}
  // ACTIVE + overlay minimised → live progress mode
  if(active&&typeof sprintData==='object'&&sprintData){
    bar.classList.add('show');
    bar.classList.remove('resumable');
    if(titleEl)titleEl.textContent=sprintData.title||'Sprint';
    if(metaEl){
      const total=(sprintData.taskIds&&sprintData.taskIds.length)||0;
      const done=(sprintData.doneTasks&&sprintData.doneTasks.size)||0;
      const routTotal=sprintData.routineCount||0;
      const routDone=(sprintData.doneRoutines&&sprintData.doneRoutines.size)||0;
      const parts=[];
      if(total)parts.push(done+'/'+total+' task'+(total===1?'':'s'));
      if(routTotal)parts.push(routDone+'/'+routTotal+' routine'+(routTotal===1?'':'s'));
      metaEl.textContent=parts.join(' · ')||'In progress';
    }
    return;
  }
  // RESUMABLE — saved state in localStorage, no active sprint. Resume affordance.
  const saved=typeof loadSprintState==='function'?loadSprintState():null;
  if(saved&&saved.taskIds&&saved.taskIds.length){
    bar.classList.add('show');
    bar.classList.add('resumable');
    if(titleEl)titleEl.textContent='Resume sprint?';
    if(metaEl){
      const total=saved.taskIds.length;
      const done=(saved.doneTasks&&saved.doneTasks.length)||0;
      metaEl.textContent=(saved.title||'Sprint')+' · '+done+'/'+total+' done — tap to resume';
    }
    if(timeEl)timeEl.textContent='▷';
    return;
  }
  // IDLE
  bar.classList.remove('show');
  bar.classList.remove('resumable');
}

function renderSprintTasks(){
  const inner=document.getElementById('sprint-tool-inner');
  if(!inner||!sprintData)return;

  const taskItems=sprintData.allItems?sprintData.allItems.filter(i=>i.type==='task'):
    sprintData.taskIds.map(id=>({type:'task',id}));
  const routineItems=sprintData.allItems?sprintData.allItems.filter(i=>i.type==='routine'):[];

  let html='';

  // ── TASKS — use taskCard() exactly as in the task list ────────
  if(taskItems.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px">Tasks</div>`;
    const taskCards=taskItems.map(item=>{
      const t=tasks.find(x=>x.id===item.id);
      if(!t)return '';
      return taskCard(t); // ← exact same function as the task list
    }).join('');
    html+=taskCards;
  }

  // ── ROUTINES — simple rows with working tick ──────────────────
  if(routineItems.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin:14px 0 8px">Routines</div>`;
    html+=routineItems.map((item,i)=>{
      const isDone=sprintData.doneRoutines&&sprintData.doneRoutines.has(i);
      return `<div style="background:var(--gl);border:1.5px solid var(--gm);border-radius:var(--r);margin-bottom:8px;${isDone?'opacity:.55':''}">
        <div style="display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer" onclick="sprintToggleRoutine(${i})">
          <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isDone?'var(--green)':'var(--gm)'};background:${isDone?'var(--green)':'var(--surf)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s">
            ${isDone?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:500;${isDone?'text-decoration:line-through;color:var(--tx3)':''}">${item.title}</div>
            <div style="font-size:11px;color:var(--gd);margin-top:2px">${item.section||'Routine'} · ~15m</div>
          </div>
          <div style="font-size:18px;color:${isDone?'var(--green)':'var(--tx3)'}">${isDone?'✓':'○'}</div>
        </div>
      </div>`;
    }).join('');
  }

  html+=`<div id="sprint-added-tasks"></div>`;
  html+=`<div id="sprint-all-done" style="display:none;background:var(--green);color:#fff;border-radius:var(--r);padding:20px;text-align:center;margin-top:8px">
    <div style="font-size:28px;margin-bottom:6px">🎉</div>
    <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:500;margin-bottom:4px">Sprint complete!</div>
    <div style="font-size:13px;opacity:.85">Brilliant work, ${CUN}.</div>
  </div>`;

  inner.innerHTML=html;
  // Init drag on the sprint task list too
  setTimeout(()=>initDragList(inner),80);
}

// Simple routine toggle for sprint (no DB needed — routines reset daily)
function sprintToggleRoutine(idx){
  if(!sprintData)return;
  if(!sprintData.doneRoutines)sprintData.doneRoutines=new Set();
  if(sprintData.doneRoutines.has(idx))sprintData.doneRoutines.delete(idx);
  else sprintData.doneRoutines.add(idx);
  renderSprintTasks();
  updateSprintProgress();
  saveSprintState();
}
// (renderSprintTaskRow and updateSprintToolUI removed — they manipulated id
//  prefixes sti-/stc-/stt- that the current renderSprintTasks() (which uses
//  taskCard()) does not emit. quickTick() in ui.js now handles cross-bucket
//  sync directly.)

function updateSprintProgress(){
  if(!sprintData)return;
  const taskTotal=sprintData.taskIds.length;
  const taskDone=sprintData.doneTasks.size;
  const routineTotal=sprintData.routineCount||0;
  const routineDone=sprintData.doneRoutines?sprintData.doneRoutines.size:0;
  const totalItems=taskTotal+routineTotal;
  const doneItems=taskDone+routineDone;
  const pct=totalItems?Math.round((doneItems/totalItems)*100):0;

  // Progress bar
  const fill=document.getElementById('sprint-prog-fill');
  if(fill)fill.style.width=pct+'%';

  // New stats header
  const tdEl=document.getElementById('sph-tasks-done');
  const ttEl=document.getElementById('sph-tasks-total');
  const rdEl=document.getElementById('sph-rout-done');
  const rtEl=document.getElementById('sph-rout-total');
  const remEl=document.getElementById('sph-time-rem');
  if(tdEl)tdEl.textContent=taskDone;
  if(ttEl)ttEl.textContent='/ '+taskTotal+' task'+(taskTotal===1?'':'s');
  if(rdEl)rdEl.textContent=routineDone;
  if(rtEl)rtEl.textContent='/ '+routineTotal+' routine'+(routineTotal===1?'':'s');

  // Time remaining: task time left + routine time left (routines = 0.25h each)
  if(remEl){
    const taskRemH=sprintData.taskIds
      .filter(id=>!sprintData.doneTasks.has(id))
      .reduce((s,id)=>{const t=tasks.find(x=>x.id===id);return s+(t?getEffectiveTime(t):0);},0);
    const routineRemH=(routineTotal-routineDone)*0.25;
    const totalRemH=taskRemH+routineRemH;
    remEl.textContent=totalRemH>0?fmtHours(totalRemH):'0m';
    remEl.style.color=totalRemH<=0?'var(--green)':
      totalRemH<0.5?'var(--amber)':'rgba(255,255,255,.9)';
  }

  // Legacy compatibility
  const text=document.getElementById('sprint-prog-text');
  if(text)text.textContent=doneItems+' / '+totalItems+' done';
}

function renderSprintDrawer(){
  const body=document.getElementById('sprint-drawer-body');if(!body)return;
  const inSprint=new Set(sprintData?.taskIds||[]);
  const pending=tasks.filter(t=>!t.done).sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));
  // Two sections: In Sprint | Add More
  const sprintTasks=pending.filter(t=>inSprint.has(t.id));
  const otherTasks=pending.filter(t=>!inSprint.has(t.id));

  let html='';
  if(sprintTasks.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);padding:10px 14px 4px;background:var(--surf2)">In this sprint</div>`;
    html+=sprintTasks.map(t=>{
      const done=sprintData?.doneTasks.has(t.id);
      const o=getOwner(t.owner);
      return `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bdr);${done?'opacity:.5':''}">
        <div style="width:18px;height:18px;border-radius:4px;border:1.5px solid ${done?'var(--green)':'var(--bdrm)'};background:${done?'var(--green)':'#fff'};flex-shrink:0;display:flex;align-items:center;justify-content:center">
          ${done?'<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;${done?'text-decoration:line-through;color:var(--tx3)':''}">${t.title}</div>
          <span class="task-tag" style="background:${o.bg};color:${o.color};font-size:9px">${o.name}</span>
        </div>
        <button onclick="openDetail(${t.id});toggleSprintDrawer()" style="padding:4px 8px;border:1px solid var(--bdrm);border-radius:100px;font-size:10px;color:var(--tx2);cursor:pointer;background:none;flex-shrink:0">View</button>
      </div>`;
    }).join('');
  }
  if(otherTasks.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);padding:10px 14px 4px;background:var(--surf2)">Add to sprint</div>`;
    html+=otherTasks.map(t=>{
      const o=getOwner(t.owner);
      return `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="addTaskToSprint(${t.id})">
        <div style="width:18px;height:18px;border-radius:4px;border:1.5px solid var(--green);flex-shrink:0;display:flex;align-items:center;justify-content:center">
          <span style="font-size:12px;color:var(--green);font-weight:700;line-height:1">+</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500">${t.title}</div>
          <div style="display:flex;gap:4px;margin-top:2px">
            <span class="task-tag" style="background:${o.bg};color:${o.color};font-size:9px">${o.name}</span>
            ${t.due?`<span style="font-size:9px;color:${t.due<tdStr()?'var(--red)':'var(--tx3)'}">${fmtDate(t.due)}</span>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  }
  if(!pending.length)html='<div style="padding:20px;text-align:center;font-size:12px;color:var(--tx2)">All tasks complete!</div>';
  body.innerHTML=html;
}

function addTaskToSprint(taskId){
  if(!sprintData)return;
  if(sprintData.taskIds.includes(taskId))return;
  sprintData.taskIds.push(taskId);
  // Update allItems too so render knows about this task
  if(!sprintData.allItems)sprintData.allItems=[];
  const t=tasks.find(x=>x.id===taskId);
  if(t)sprintData.allItems.push({type:'task',id:taskId,title:t.title,hours:getEffectiveTime(t)});
  // Re-render the sprint tool and drawer
  renderSprintTasks();
  renderSprintDrawer();
  updateSprintProgress();
  chirp('"'+(t?t.title:'Task')+'" added to sprint.');
}

function toggleSprintDrawer(){
  const drawer=document.getElementById('sprint-drawer');
  const backdrop=document.getElementById('sprint-drawer-backdrop');
  const isOpen=drawer?.classList.contains('open');
  drawer?.classList.toggle('open',!isOpen);
  backdrop?.classList.toggle('open',!isOpen);
  if(!isOpen)renderSprintDrawer();
}

async function confirmEndSprint(){
  clearSprintState();
  clearInterval(sprintTimer);
  const done=sprintData?.doneTasks.size||0;
  const total=sprintData?.taskIds.length||0;
  const pct=total?Math.round((done/total)*100):0;
  const m=Math.floor(sprintElapsed/60);
  const msg=pct===100?`🎉 Sprint complete! All ${total} tasks done in ${m} minutes.`
    :pct>=75?`Strong sprint. ${done}/${total} done in ${m} minutes. ${total-done} rolling back to your list.`
    :`Sprint ended. ${done}/${total} done in ${m} minutes.`;
  // Close overlay
  document.getElementById('sprint-overlay').classList.remove('active');
  sprintActive=false;
  updateSprintFAB();
  // Update DB
  if(sprintData?.dbId){
    api('bravochore_sprints','PATCH',{status:'completed',ended_at:new Date().toISOString(),tasks_done:done},`?id=eq.${sprintData.dbId}`).catch(()=>{});
  }
  // Go home and show summary as a chirp
  rerender();
  bnNav('dashboard');
  setTimeout(()=>chirp(msg),400);
}

// ================================================================
// SPRINT BUILDER
// ================================================================
let sbTab='tasks';
let sbTimeHours=1;
let sbSelected=new Map(); // id -> {type:'task'|'routine', title, hours, id}

function openSprintBuilder(){
  sbSelected=new Map();
  sbTimeHours=1;
  sbTab='tasks';
  // Reset UI
  document.querySelectorAll('.sb-time-btn').forEach((b,i)=>{b.classList.toggle('active',i===0);});
  document.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('sbt-tasks')?.classList.add('active');
  const sheet=document.getElementById('sprint-builder-sheet');
  if(sheet){sheet.style.display='flex';sheet.style.alignItems='flex-end';sheet.style.justifyContent='center';}
  renderSBList();
  updateSBCount();
}

function closeSprintBuilder(){
  const sheet=document.getElementById('sprint-builder-sheet');
  if(sheet)sheet.style.display='none';
}

function setSBTime(h,btn){
  sbTimeHours=h; // null = all day
  document.querySelectorAll('.sb-time-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function setSBTab(tab,btn){
  sbTab=tab;
  document.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSBList();
}

function toggleSBItem(key, item){
  if(sbSelected.has(key))sbSelected.delete(key);
  else sbSelected.set(key,item);
  // Update visual
  const row=document.getElementById('sbr-'+key);
  const chk=document.getElementById('sbc-'+key);
  if(row)row.classList.toggle('selected',sbSelected.has(key));
  if(chk)chk.classList.toggle('on',sbSelected.has(key));
  if(chk){chk.innerHTML=sbSelected.has(key)?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':'';}
  updateSBCount();
}

function updateSBCount(){
  const count=sbSelected.size;
  const totalH=[...sbSelected.values()].reduce((s,i)=>s+(i.hours||0),0);
  const ct=document.getElementById('sb-count-label');
  const timeEl=document.getElementById('sb-selected-time');
  if(ct)ct.textContent=count+' selected';
  if(timeEl)timeEl.textContent=totalH>0?fmtHours(totalH):'0m';
}

function renderSBList(){
  const area=document.getElementById('sb-list-area');if(!area)return;

  if(sbTab==='tasks'){
    const pending=tasks.filter(t=>!t.done).sort((a,b)=>{
      // Sort: overdue first, then by due date, then no date
      const aOv=a.due&&a.due<tdStr()?0:a.due?1:2;
      const bOv=b.due&&b.due<tdStr()?0:b.due?1:2;
      if(aOv!==bOv)return aOv-bOv;
      return (a.due||'9').localeCompare(b.due||'9');
    });
    if(!pending.length){area.innerHTML='<div class="empty-state" style="padding:24px">No pending tasks.</div>';return;}
    area.innerHTML=pending.map(t=>{
      const o=getOwner(t.owner);
      const h=getEffectiveTime(t);
      const ov=t.due&&t.due<tdStr();
      const key='task-'+t.id;
      const sel=sbSelected.has(key);
      return `<div class="sb-item ${sel?'selected':''}" id="sbr-${key}" onclick="toggleSBItem('${key}',{type:'task',title:'${t.title.replace(/'/g,"\'")}',hours:${h},id:${t.id}})">
        <div class="sb-check ${sel?'on':''}" id="sbc-${key}">${sel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div style="flex:1;min-width:0">
          <div class="sb-item-title">${t.title}</div>
          <div class="sb-item-meta" style="display:flex;gap:5px;align-items:center">
            <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
            ${t.due?`<span style="color:${ov?'var(--red)':'var(--tx3)'};">${fmtDate(t.due)}</span>`:''}
            ${h?`<span>${fmtHours(h)}</span>`:''}
            ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  }else{
    // TODAY'S ROUTINES from DAY_TASKS
    const dayName=new Date().toLocaleDateString('en-AU',{weekday:'long'});
    const sections=DAY_TASKS[dayName]||[];
    if(!sections.length){area.innerHTML='<div class="empty-state" style="padding:24px">No routines for today.</div>';return;}
    let html='';
    sections.forEach(sec=>{
      const checkable=sec.tasks.filter(t=>!t.note&&(!t.week||t.week===schedWeek));
      if(!checkable.length)return;
      html+=`<div class="sb-routine-section">${sec.label}${sec.time?' · '+sec.time:''}</div>`;
      checkable.forEach(t=>{
        const key='routine-'+t.id;
        const sel=sbSelected.has(key);
        const h=0.25; // routines default to 15min each
        html+=`<div class="sb-item ${sel?'selected':''}" id="sbr-${key}" onclick="toggleSBItem('${key}',{type:'routine',title:'${t.text.replace(/'/g,"\'").replace(/’/g,"'")}',hours:${h},routineId:'${t.id}',section:'${sec.section}'})">
          <div class="sb-check ${sel?'on':''}" id="sbc-${key}">${sel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          <div style="flex:1;min-width:0">
            <div class="sb-item-title">${t.text}</div>
            <div class="sb-item-meta">${sec.label}${t.recur==='weekly'?' · Weekly':''}</div>
          </div>
        </div>`;
      });
    });
    area.innerHTML=html||'<div class="empty-state" style="padding:24px">No routines today.</div>';
  }
}

async function buildSprintFromBuilder(){
  if(!sbSelected.size){chirp('Select at least one item.');return;}
  closeSprintBuilder();
  showSprintLoading();

  const selectedItems=[...sbSelected.values()];
  const taskItems=selectedItems.filter(i=>i.type==='task');
  const routineItems=selectedItems.filter(i=>i.type==='routine');

  // Build sprint tasks array (tasks only for BravoChore sync)
  const sprintTasks=taskItems.map(i=>tasks.find(t=>t.id===i.id)).filter(Boolean);

  // Combined list for tool generation
  const allItemsForTool=[
    ...taskItems.map((i,idx)=>({...i,num:idx+1})),
    ...routineItems.map((i,idx)=>({...i,num:taskItems.length+idx+1}))
  ];

  const totalH=selectedItems.reduce((s,i)=>s+(i.hours||0),0);
  const timeLabel=sbTimeHours?`${sbTimeHours}h available`:'all day';
  const now=new Date();
  const timeOfDay=`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Build instantly from template — no API call needed
  const html=buildSprintHTML(sprintTasks, allItemsForTool);
  activateSprint(sprintTasks, html, allItemsForTool);
}


// (showSprintToast removed — was a parallel toast styling that no caller
//  actually used. Per BRAND.md: a single chirp() pattern is the universal toast.)

// ================================================================
// SPRINT PERSISTENCE
// ================================================================
function saveSprintState(){
  if(!sprintData)return;
  try{
    localStorage.setItem('bc-sprint',JSON.stringify({
      taskIds:sprintData.taskIds,
      doneTasks:[...sprintData.doneTasks],
      doneRoutines:sprintData.doneRoutines?[...sprintData.doneRoutines]:[],
      title:sprintData.title,
      dbId:sprintData.dbId,
      elapsed:sprintElapsed,
      allItems:sprintData.allItems||null,
      routineCount:sprintData.routineCount||0,
      totalH:sprintData.totalH||0,
      savedAt:Date.now()
    }));
  }catch(e){}
}

function loadSprintState(){
  try{
    const s=localStorage.getItem('bc-sprint');
    if(!s)return null;
    const d=JSON.parse(s);
    // Only restore if saved within last 12 hours
    if(Date.now()-d.savedAt>12*60*60*1000){localStorage.removeItem('bc-sprint');return null;}
    return d;
  }catch(e){return null;}
}

function clearSprintState(){
  try{localStorage.removeItem('bc-sprint');}catch(e){}
}

// Detect a saved (refresh-recoverable) sprint and surface it in the now-bar
// in "Resume" mode. The now-bar serves both live and resumable states so we
// don't have a separate banner competing for the same screen real estate.
async function checkForActiveSprint(){
  const saved=loadSprintState();
  if(!saved||!saved.taskIds||!saved.taskIds.length)return;
  if(typeof updateSprintFAB==='function')updateSprintFAB();
}

async function resumeSprint(){
  const saved=loadSprintState();if(!saved)return;
  const sprintTasks=tasks.filter(t=>saved.taskIds.includes(t.id));
  const allItems=saved.allItems||sprintTasks.map(t=>({type:'task',id:t.id,title:t.title,hours:getEffectiveTime(t)}));
  const html=buildSprintHTML(sprintTasks,allItems);
  activateSprint(sprintTasks,html,allItems);
  // Restore elapsed and done state
  sprintElapsed=saved.elapsed||0;
  sprintData.dbId=saved.dbId;
  sprintData.totalH=saved.totalH||0;
  sprintData.routineCount=saved.routineCount||0;
  saved.doneTasks.forEach(id=>{sprintData.doneTasks.add(parseInt(id));});
  if(saved.doneRoutines)saved.doneRoutines.forEach(idx=>{sprintData.doneRoutines.add(idx);});
  renderSprintTasks(); // re-render with restored done state
  updateSprintProgress();
}

// ================================================================
