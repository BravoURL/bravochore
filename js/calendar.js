// ================================================================
// FAMILY CALENDAR (Phase 3). One place for "what's on": quick entries
// ("home by 7 tonight", "Sydney next Wed", "Nan for tea Saturday"),
// plus Events, saved day plans, dated tasks, paydays and bin night.
// Quick add: Blackbird (haiku) turns plain words into an entry; one tap saves.
// Table: bravochore_calendar (household RLS). Weekly repeats: repeat='weekly'.
// ================================================================
let calRows=[],calPlans=[],calLoaded=false,calMode='agenda',calMonth=null,calPick=null;

async function calLoad(force){
  if(calLoaded&&!force)return;
  const from=kjAddDays(tdStr(),-62);
  const [rows,plans]=await Promise.all([
    api('bravochore_calendar','GET',null,`?or=(day.gte.${from},repeat.eq.weekly)&order=day,time`),
    api('bravochore_memory_plans','GET',null,`?select=id,title,plan_date&plan_date=gte.${from}&order=plan_date`).catch(()=>[])]);
  calRows=rows||[];calPlans=plans||[];calLoaded=true;
}
function calWhoTag(code){const p=people.find(x=>x.code===code);if(!p)return '';
  return `<span class="cal-who" style="background:${p.bg};color:${p.color}">${hhEsc(p.avatar||p.code)}</span>`;}
function calFmtTime(t){if(!t)return '';const [h,m]=t.split(':').map(Number);const d=new Date();d.setHours(h,m);return d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}).replace(':00','');}
// Everything on a day. kids=true leaves out grown-up clutter (tasks).
function calItems(day,kids){
  const w=kjDowOf(day),out=[];
  calRows.forEach(r=>{
    const on=r.repeat==='weekly'?(kjDowOf(r.day)===w&&day>=r.day):(day>=r.day&&day<=(r.end_day||r.day));
    if(on)out.push({kind:'cal',id:r.id,icon:r.icon||'📌',title:r.title,time:r.time,who:r.who||[],repeat:r.repeat,multi:r.end_day&&r.end_day!==r.day});
  });
  (typeof events!=='undefined'?events:[]).forEach(ev=>{if(ev.due===day&&ev.status!=='completed')out.push({kind:'event',id:ev.id,icon:'🎉',title:ev.title});});
  calPlans.forEach(p=>{if(p.plan_date===day)out.push({kind:'plan',id:p.id,icon:'🗺️',title:p.title});});
  if(!kids&&typeof tasks!=='undefined'){const n=tasks.filter(t=>t.due===day&&!t.done).length;if(n)out.push({kind:'tasks',icon:'✅',title:`${n} task${n>1?'s':''} due`});}
  return out.sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
}
function calItemHtml(it,big){
  return `<button class="cal-item${big?' big':''}" data-k="${it.kind}" data-id="${it.id||''}">
    <span class="cal-ic">${hhEsc(it.icon)}</span>
    <span class="cal-t">${hhEsc(it.title)}${it.repeat?' <span class="mem-sub">· weekly</span>':''}</span>
    ${it.time?`<span class="cal-time mem-num">${calFmtTime(it.time)}</span>`:''}
    ${(it.who||[]).map(calWhoTag).join('')}</button>`;
}
function calDayLabel(d){
  const t=tdStr();if(d===t)return 'Today';if(d===kjAddDays(t,1))return 'Tomorrow';
  return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'});
}

// ---------------------------------------------------------------- adult view
async function renderCalendar(){
  const el=document.getElementById('cal-body');if(!el)return;
  try{await Promise.all([calLoad(),typeof loadEvents==='function'&&!(window.events&&events.length)?loadEvents():null]);}catch(_e){}
  const today=tdStr();
  let body='';
  if(calMode==='agenda'){
    for(let i=0;i<21;i++){const d=kjAddDays(today,i),items=calItems(d);
      if(!items.length&&i>0)continue;
      body+=`<div class="cal-day"><div class="cal-day-h">${calDayLabel(d)}</div>${items.map(x=>calItemHtml(x)).join('')||'<div class="mem-sub" style="margin:4px 0">Nothing on.</div>'}</div>`;}
  }else{
    const m=calMonth||today.slice(0,7),first=m+'-01',start=kjWeekStart(first);
    const label=new Date(first+'T00:00:00').toLocaleDateString('en-AU',{month:'long',year:'numeric'});
    let cells='';for(let i=0;i<42;i++){const d=kjAddDays(start,i);const items=calItems(d);
      cells+=`<button class="cal-cell${d.slice(0,7)!==m?' out':''}${d===today?' today':''}${d===calPick?' pick':''}" data-d="${d}"><span class="cal-n">${+d.slice(8)}</span><span class="cal-dots">${items.slice(0,3).map(x=>hhEsc(x.icon)).join('')}</span></button>`;}
    const pick=calPick||today;
    body=`<div class="cal-mhead"><button class="kt-step" onclick="calShiftMonth(-1)" aria-label="Previous month">‹</button><b>${label}</b><button class="kt-step" onclick="calShiftMonth(1)" aria-label="Next month">›</button></div>
      <div class="cal-grid">${['M','T','W','T','F','S','S'].map(x=>`<span class="cal-wd">${x}</span>`).join('')}${cells}</div>
      <div class="cal-day"><div class="cal-day-h">${calDayLabel(pick)}</div>${calItems(pick).map(x=>calItemHtml(x)).join('')||'<div class="mem-sub" style="margin:4px 0">Nothing on.</div>'}</div>`;
  }
  el.innerHTML=`
    <div class="cal-quick">
      <input id="cal-q" class="dp-input" placeholder="Home by 7 tonight · Nan for tea Saturday" autocomplete="off">
      <button class="cal-mic" id="cal-mic" onclick="toggleMic('cal-q','cal-mic')" aria-label="Say it">${typeof MIC_SVG_IDLE!=='undefined'?MIC_SVG_IDLE:'🎤'}</button>
      <button class="btn-ok" id="cal-add">Add</button>
    </div>
    <div id="cal-draft"></div>
    <div style="display:flex;gap:6px;margin:10px 0">
      <div class="filter-chip ${calMode==='agenda'?'active':''}" onclick="calMode='agenda';renderCalendar()">Agenda</div>
      <div class="filter-chip ${calMode==='month'?'active':''}" onclick="calMode='month';renderCalendar()">Month</div>
    </div>
    ${body}`;
  const q=el.querySelector('#cal-q');
  el.querySelector('#cal-add').onclick=()=>calQuickAdd(q.value);
  q.addEventListener('keydown',e=>{if(e.key==='Enter')calQuickAdd(q.value);});
  el.querySelectorAll('.cal-cell').forEach(b=>b.onclick=()=>{calPick=b.dataset.d;renderCalendar();});
  calBindItems(el);
}
function calShiftMonth(n){const m=calMonth||tdStr().slice(0,7);const d=new Date(m+'-01T00:00:00');d.setMonth(d.getMonth()+n);
  calMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;calPick=null;renderCalendar();}
function calBindItems(root){
  root.querySelectorAll('.cal-item').forEach(b=>b.onclick=()=>{
    const k=b.dataset.k,id=+b.dataset.id;
    if(k==='event'&&typeof openEventPanel==='function')openEventPanel(id);
    else if(k==='plan'&&typeof plOpenSaved==='function')plOpenSaved(id);
    else if(k==='tasks')bnNav('tasks');
    else if(k==='cal')calEdit(calRows.find(r=>r.id===id));
  });
}

// Plain words -> entry, via Blackbird. Falls back to "today, as typed".
async function calQuickAdd(text){
  text=(text||'').trim();if(!text)return;
  const box=document.getElementById('cal-draft');if(box)box.innerHTML='<div class="mem-sub">Working it out…</div>';
  const now=new Date(),fam=people.filter(p=>p.kind!=='other').map(p=>`${p.code}=${p.name}`).join(', ');
  const sys=`Turn a family calendar note into JSON. Today is ${KJ_DOW_LONG[now.getDay()]} ${tdStr()} (Perth). The person writing is ${CU} (${CUN}). Family: ${fam}.
Reply with ONLY: {"title":"short, plain, e.g. 'Brent home by 7' or 'Nan for tea'","icon":"one emoji","day":"YYYY-MM-DD","end_day":"YYYY-MM-DD or null","time":"HH:MM 24h or null","who":["codes the entry is about"]}
"I"/"me" = ${CU}. "Tonight" = today. "Next Wed" = the coming Wednesday. A trip ("in Sydney Wed to Fri") gets end_day. Tea = dinner, about 17:30 if no time given.`;
  let d=null;
  try{
    const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
      body:JSON.stringify({thinking:{type:'disabled'},model:'claude-haiku-4-5-20251001',max_tokens:300,system:sys,messages:[{role:'user',content:text}]})});
    const j=await res.json();const raw=j.content?.find(c=>c.type==='text')?.text||'';
    d=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
  }catch(_e){}
  if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d.day||''))d={title:text,icon:'📌',day:tdStr(),time:null,who:[CU]};
  calDraft({title:d.title||text,icon:d.icon||'📌',day:d.day,end_day:d.end_day&&d.end_day!==d.day?d.end_day:null,time:d.time||null,who:Array.isArray(d.who)?d.who.filter(c=>people.some(p=>p.code===c)):[]});
}
function calDraft(r){
  const box=document.getElementById('cal-draft');if(!box)return;
  box.innerHTML=`<div class="cal-draft">
    <div class="cal-draft-row"><span class="cal-ic">${hhEsc(r.icon)}</span><b>${hhEsc(r.title)}</b></div>
    <div class="mem-sub" style="margin:2px 0 8px">${calDayLabel(r.day)}${r.end_day?' to '+calDayLabel(r.end_day):''}${r.time?' · '+calFmtTime(r.time):''} ${(r.who||[]).map(calWhoTag).join('')}</div>
    <div style="display:flex;gap:8px"><button class="btn-ok" id="cd-save">Add to calendar</button><button class="btn-cancel" id="cd-edit">Change</button><button class="btn-cancel" id="cd-no">No</button></div></div>`;
  box.querySelector('#cd-no').onclick=()=>{box.innerHTML='';};
  box.querySelector('#cd-edit').onclick=()=>calEdit(r);
  box.querySelector('#cd-save').onclick=()=>calSave(r);
}
async function calSave(r,id){
  const row={title:r.title,icon:r.icon||'📌',day:r.day,end_day:r.end_day||null,time:r.time||null,who:r.who||[],repeat:r.repeat||null,note:r.note||null,created_by:CU};
  try{
    if(id){await api('bravochore_calendar','PATCH',row,`?id=eq.${id}`);Object.assign(calRows.find(x=>x.id===id)||{},row);}
    else{const x=await api('bravochore_calendar','POST',row);if(x&&x[0])calRows.push(x[0]);}
  }catch(_e){chirp("Didn't save. Try again.");return false;}
  chirp(id?'Updated.':'Added to the calendar.');
  if(document.getElementById('view-calendar')?.classList.contains('active'))renderCalendar();
  if(typeof wallRender==='function'&&document.getElementById('wall')?.style.display==='flex')wallRender();
  if(typeof kjKidTab!=='undefined'&&kjKidTab==='cal')kjRenderKid(true);
  return true;
}
function calEdit(r){
  if(!r)return;const id=r.id||null;
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  const who=new Set(r.who||[]);
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${id?'Edit':'New'} calendar entry</div>
    <div style="display:flex;gap:8px;margin-top:10px"><div class="dp-field" style="width:70px"><label class="dp-label" for="ce-ic">Pic</label><input class="dp-input" id="ce-ic" value="${hhEsc(r.icon||'📌')}" style="text-align:center;font-size:20px"></div>
    <div class="dp-field" style="flex:1"><label class="dp-label" for="ce-t">What</label><input class="dp-input" id="ce-t" value="${hhEsc(r.title||'')}"></div></div>
    <div style="display:flex;gap:8px"><div class="dp-field" style="flex:1"><label class="dp-label" for="ce-d">Day</label><input class="dp-input" id="ce-d" type="date" value="${r.day||tdStr()}"></div>
    <div class="dp-field" style="flex:1"><label class="dp-label" for="ce-e">Until (optional)</label><input class="dp-input" id="ce-e" type="date" value="${r.end_day||''}"></div>
    <div class="dp-field" style="width:110px"><label class="dp-label" for="ce-tm">Time</label><input class="dp-input" id="ce-tm" type="time" value="${r.time?r.time.slice(0,5):''}"></div></div>
    <div class="dp-field"><label class="dp-label">Who</label><div style="display:flex;gap:6px;flex-wrap:wrap">${people.filter(p=>p.kind!=='other').map(p=>`<div class="filter-chip ${who.has(p.code)?'active':''}" data-w="${p.code}">${hhEsc(p.name)}</div>`).join('')}</div></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 12px"><input type="checkbox" id="ce-rep" ${r.repeat==='weekly'?'checked':''}> Every week</label>
    <div style="display:flex;gap:8px">${id?'<button class="btn-cancel" id="ce-del" style="color:var(--red)">Delete</button>':''}<button class="btn-cancel" id="ce-c" style="margin-left:auto">Cancel</button><button class="btn-ok" id="ce-s">Save</button></div></div>`;
  document.body.appendChild(w);
  w.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const c=b.dataset.w;who.has(c)?who.delete(c):who.add(c);b.classList.toggle('active',who.has(c));});
  w.querySelector('#ce-c').onclick=()=>w.remove();
  if(id)w.querySelector('#ce-del').onclick=async()=>{
    if(!(await confirm2('Delete this entry?',hhEsc(r.title),'btn-ok')))return;
    try{await api('bravochore_calendar','DELETE',null,`?id=eq.${id}`);calRows=calRows.filter(x=>x.id!==id);}catch(_e){}
    w.remove();renderCalendar();};
  w.querySelector('#ce-s').onclick=async()=>{
    const t=w.querySelector('#ce-t').value.trim();if(!t)return;
    const ok=await calSave({title:t,icon:w.querySelector('#ce-ic').value.trim()||'📌',day:w.querySelector('#ce-d').value||tdStr(),
      end_day:w.querySelector('#ce-e').value||null,time:w.querySelector('#ce-tm').value||null,who:[...who],repeat:w.querySelector('#ce-rep').checked?'weekly':null},id);
    if(ok){w.remove();const b=document.getElementById('cal-draft');if(b)b.innerHTML='';}
  };
}

// ---------------------------------------------------------------- kids
function calKidView(){
  if(!calLoaded){calLoad().then(()=>{if(kjKidTab==='cal')kjRenderKid(true);});return '<div class="km-none">Loading…</div>';}
  let html='';const t=tdStr();
  for(let i=0;i<7;i++){const d=kjAddDays(t,i),items=calItems(d,true);
    html+=`<div class="cal-kday"><div class="cal-kday-h">${i===0?'Today':i===1?'Tomorrow':KJ_DOW_LONG[kjDowOf(d)]}</div>
      ${items.map(x=>`<div class="cal-kitem"><span>${hhEsc(x.icon)}</span><b>${hhEsc(x.title)}</b>${x.time?`<i>${calFmtTime(x.time)}</i>`:''}</div>`).join('')||'<div class="cal-kitem none">Nothing special</div>'}</div>`;}
  return html;
}
