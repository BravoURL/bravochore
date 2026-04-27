// REMINDERS
// ================================================================
let reminders=[];

async function loadReminders(){
  try{reminders=await api('bravochore_reminders','GET',null,'?status=neq.dismissed&order=next_remind.asc');}
  catch(e){reminders=[];}
}

function checkReminders(){
  const today=tdStr();
  const due=reminders.filter(r=>{
    if(r.status==='snoozed'&&r.snooze_until&&r.snooze_until>today)return false;
    return r.next_remind&&r.next_remind<=today;
  });
  const banner=document.getElementById('reminder-banner');
  const bannerTxt=document.getElementById('reminder-banner-text');
  const bellBadge=document.getElementById('reminder-badge');
  if(bellBadge)bellBadge.style.display=due.length?'block':'none';
  if(banner&&bannerTxt){
    if(due.length){
      banner.style.display='flex';
      bannerTxt.textContent=due.length===1
        ?`Routine: ${due[0].title}`
        :`${due.length} routines due`;
    }else{
      banner.style.display='none';
    }
  }
}

function openRemindersSheet(){
  closeModal('reminders-modal');
  const list=document.getElementById('reminders-list');
  if(!list)return;
  const today=tdStr();
  const due=reminders.filter(r=>{
    if(r.status==='snoozed'&&r.snooze_until&&r.snooze_until>today)return false;
    return r.next_remind&&r.next_remind<=today;
  });
  const upcoming=reminders.filter(r=>r.next_remind>today||r.status==='snoozed');
  const renderCard=(r,isDue)=>`
    <div class="reminder-card" id="rmc-${r.id}">
      <div class="reminder-card-title">${r.title}</div>
      <div class="reminder-card-meta">${r.recurrence==='weekly'?(r.recurrence_days?r.recurrence_days.split(',').map(n=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]).join(', '):''+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.recurrence_day]):r.recurrence==='daily'?'Daily':r.recurrence==='monthly'?'Monthly':fmtDate(r.next_remind)}${r.owner?' · '+getOwner(r.owner).name:''}</div>
      ${isDue?`<div class="reminder-card-actions">
        <button class="rm-btn done" onclick="reminderDone(${r.id})">✓ Done</button>
        <button class="rm-btn snooze" onclick="reminderSnooze(${r.id})">Snooze</button>
        <button class="rm-btn" onclick="reminderDismiss(${r.id})">Dismiss</button>
      </div>`:''}
    </div>`;
  list.innerHTML=
    (due.length?`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--amber);margin-bottom:8px">Due now</div>${due.map(r=>renderCard(r,true)).join('')}`:'')
    +(upcoming.length?`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin:12px 0 8px">Upcoming</div>${upcoming.map(r=>renderCard(r,false)).join('')}`:'')
    +(due.length===0&&upcoming.length===0?'<p style="color:var(--tx2);font-size:13px;text-align:center;padding:20px 0">No active routines.</p>':'');
  openModal('reminders-modal');
}

async function reminderDone(id){
  const r=reminders.find(x=>x.id===id);if(!r)return;
  // Advance to next occurrence
  const next=getNextReminderDate(r);
  if(next){
    r.next_remind=next;r.status='active';
    try{await api('bravochore_reminders','PATCH',{next_remind:next,status:'active'},`?id=eq.${id}`);}catch(e){}
  }else{
    r.status='dismissed';
    try{await api('bravochore_reminders','PATCH',{status:'dismissed'},`?id=eq.${id}`);}catch(e){}
  }
  document.getElementById('rmc-'+id)?.remove();
  checkReminders();
}

async function reminderSnooze(id){
  const r=reminders.find(x=>x.id===id);if(!r)return;
  // Show snooze picker
  const options=['1 hour','3 hours','Tomorrow','3 days','1 week'];
  const today=new Date();
  const getSnoozeDate=(opt)=>{
    const d=new Date();
    if(opt==='1 hour'){d.setHours(d.getHours()+1);}
    else if(opt==='3 hours'){d.setHours(d.getHours()+3);}
    else if(opt==='Tomorrow'){d.setDate(d.getDate()+1);}
    else if(opt==='3 days'){d.setDate(d.getDate()+3);}
    else if(opt==='1 week'){d.setDate(d.getDate()+7);}
    return d.toISOString().slice(0,10);
  };
  const picker=document.createElement('div');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:flex-end;justify-content:center';
  picker.innerHTML=`<div style="background:var(--surf);border-radius:20px 20px 0 0;width:100%;max-width:500px;padding:20px;padding-bottom:max(20px,env(safe-area-inset-bottom))">
    <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500;margin-bottom:14px">Snooze until...</div>
    ${options.map(o=>`<button onclick="doSnooze(${id},'${getSnoozeDate(o)}');this.closest('[style*=position]').remove()" style="display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:6px;background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;color:var(--tx)">${o}</button>`).join('')}
    <button onclick="this.closest('[style*=position]').remove()" style="display:block;width:100%;padding:11px;margin-top:4px;background:none;border:1px solid var(--bdrm);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;color:var(--tx2)">Cancel</button>
  </div>`;
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
}

async function doSnooze(id,until){
  const r=reminders.find(x=>x.id===id);if(!r)return;
  r.status='snoozed';r.snooze_until=until;
  try{await api('bravochore_reminders','PATCH',{status:'snoozed',snooze_until:until},`?id=eq.${id}`);}catch(e){}
  document.getElementById('rmc-'+id)?.remove();
  checkReminders();
  chirp('Snoozed until '+fmtDate(until));
}

async function reminderDismiss(id){
  reminders=reminders.filter(r=>r.id!==id);
  try{await api('bravochore_reminders','PATCH',{status:'dismissed'},`?id=eq.${id}`);}catch(e){}
  document.getElementById('rmc-'+id)?.remove();
  checkReminders();
}

function getNextReminderDate(r){
  const d=new Date();
  if(r.recurrence==='once')return null;
  if(r.recurrence==='daily'){d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);}
  if(r.recurrence==='weekly'){
    const allDays=r.recurrence_days?r.recurrence_days.split(',').map(Number):[r.recurrence_day||4];
    const today=d.getDay();
    const sorted=[...allDays].sort((a,b)=>a-b);
    const next=sorted.find(day=>day>today)??sorted[0];
    const diff=(next-today+7)%7||7;
    d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10);
  }
  if(r.recurrence==='monthly'){d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10);}
  return null;
}

function openNewReminderSheet(){
  document.getElementById('nr-title').value='';
  document.getElementById('nr-recurrence').value='weekly';
  document.getElementById('nr-days').value='4';
  document.getElementById('nr-date').value='';
  nrRecurrenceChange();
  setTimeout(()=>initRoutineDayBtns('4'),50);
  closeModal('reminders-modal');
  openModal('new-reminder-modal');
  setTimeout(()=>document.getElementById('nr-title')?.focus(),100);
}

function nrRecurrenceChange(){
  const rec=document.getElementById('nr-recurrence')?.value;
  const dayRow=document.getElementById('nr-day-row');
  const dateField=document.querySelector('#new-reminder-modal input[type="date"]')?.closest('.dp-field');
  if(dayRow)dayRow.style.display=rec==='weekly'?'block':'none';
  if(dateField)dateField.style.display=rec==='once'?'block':'none';
}
function toggleRoutineDay(idx){
  const inp=document.getElementById('nr-days');if(!inp)return;
  let days=inp.value?inp.value.split(',').map(Number).filter(n=>!isNaN(n)):[];
  const btn=document.getElementById('nrd-'+idx);
  if(days.includes(idx)){
    days=days.filter(d=>d!==idx);
    if(btn){btn.style.background='var(--surf)';btn.style.borderColor='var(--bdrm)';btn.style.color='var(--tx2)';}
  }else{
    days.push(idx);days.sort();
    if(btn){btn.style.background='var(--green)';btn.style.borderColor='var(--green)';btn.style.color='#fff';}
  }
  inp.value=days.join(',');
}
function initRoutineDayBtns(daysStr){
  const days=daysStr?daysStr.split(',').map(Number):[];
  [0,1,2,3,4,5,6].forEach(i=>{
    const btn=document.getElementById('nrd-'+i);if(!btn)return;
    const on=days.includes(i);
    btn.style.background=on?'var(--green)':'var(--surf)';
    btn.style.borderColor=on?'var(--green)':'var(--bdrm)';
    btn.style.color=on?'#fff':'var(--tx2)';
  });
}

async function saveReminder(){
  const title=document.getElementById('nr-title')?.value.trim();
  if(!title){chirp('Please enter a routine.');return;}
  const rec=document.getElementById('nr-recurrence')?.value||'weekly';
  const daysStr=document.getElementById('nr-days')?.value||'4';const days=daysStr.split(',').map(Number).filter(n=>!isNaN(n));const day=days[0]||4;
  const dateVal=document.getElementById('nr-date')?.value||null;
  const owner=document.getElementById('nr-owner')?.value||CU;
  // Calculate first reminder date
  let nextRemind=dateVal;
  if(!nextRemind){
    const d=new Date();
    if(rec==='daily'){nextRemind=d.toISOString().slice(0,10);}
    else if(rec==='weekly'){
      const diff=(day-d.getDay()+7)%7||7;
      d.setDate(d.getDate()+diff);nextRemind=d.toISOString().slice(0,10);
    }else if(rec==='monthly'){
      d.setDate(d.getDate()+1);nextRemind=d.toISOString().slice(0,10);
    }
  }
  closeModal('new-reminder-modal');
  const nr={title,owner,recurrence:rec,recurrence_day:day,recurrence_days:daysStr,next_remind:nextRemind,status:'active'};
  try{
    const res=await api('bravochore_reminders','POST',[nr]);
    if(res&&res[0])reminders.push(res[0]);else reminders.push({...nr,id:Date.now()});
  }catch(e){reminders.push({...nr,id:Date.now()});}
  chirp('Routine set: '+title);
  checkReminders();
}

// Blackbird can also set reminders via natural language
// (detected in BB response handling — see system prompt)


