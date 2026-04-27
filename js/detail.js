// ================================================================
// DETAIL PANEL
// ================================================================
function openDetail(taskId){
  dpTaskId=taskId;
  const task=taskId?tasks.find(t=>t.id===taskId):null;
  const ms=taskId?getMs(taskId):[];
  const dpc=document.getElementById('dp-check');
  const dpt=document.getElementById('dp-title');
  if(task){
    dpc.className='dp-check'+(task.done?' checked':'');
    dpt.textContent=task.title;
    dpt.className='dp-title'+(task.done?' done-txt':'');
  }else{
    dpc.className='dp-check';dpt.textContent='New task';dpt.className='dp-title';
  }
  const o=task?getOwner(task.owner):null;
  document.getElementById('dp-meta').innerHTML=task?`
    <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
    <span class="task-bucket-b">${task.bucket}</span>
    ${task.due?`<span class="task-date">${fmtDate(task.due)}</span>`:''}
    ${getEffectiveTime(task)?`<span class="task-time-b">${fmtHours(getEffectiveTime(task))}</span>`:''}
  `:'';
  renderDpBody(task,ms);
  // Always open on Details tab
  dpActiveTab='details';
  tcMessages=[];
  document.querySelectorAll('.dp-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.dp-tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('dpt-details')?.classList.add('active');
  document.getElementById('dp-panel-details')?.classList.add('active');
  document.getElementById('detail-backdrop').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function renderDpBody(task,ms){
  const body=document.getElementById('dp-body');
  const timeH=task?getEffectiveTime(task):0;
  const isOn=task&&activeTimer&&activeTimer.taskId===task.id&&!activeTimer.msId;
  const actH=task?parseFloat(task.actual_time_hours||0):0;
  const ownerOptions=people.map(p=>`<option value="${p.code}" ${task?.owner===p.code?'selected':''}>${p.name}</option>`).join('');
  body.innerHTML=`
  <div class="dp-sec">
    <div class="dp-row2">
      <div class="dp-field"><label class="dp-label">Owner</label>
        <select class="dp-select" id="dp-owner">${ownerOptions}</select>
      </div>
      <div class="dp-field"><label class="dp-label">Due date</label>
        <input type="date" class="dp-input" id="dp-due" value="${task?.due||''}">
      </div>
    </div>
    <div class="dp-row2">
      <div class="dp-field"><label class="dp-label">Time estimate</label>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px" id="dp-time-btns">
          ${[0.25,0.5,0.75,1,1.5,2,3,4].map(v=>{
            const cur=task?parseFloat(task.time_hours||0):0;
            const active=Math.abs(cur-v)<0.01;
            const lbl=v<1?(v*60)+'m':v===1?'1h':v+'h';
            return `<button type="button" onclick="dpSetTime(${v},this)" style="padding:6px 10px;border-radius:100px;border:1.5px solid ${active?'var(--green)':'var(--bdrm)'};background:${active?'var(--green)':'var(--surf)'};color:${active?'#fff':'var(--tx2)'};font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;transition:all .15s">${lbl}</button>`;
          }).join('')}
          <button type="button" onclick="dpShowCustomTime(this)" id="dp-time-custom-btn" style="padding:6px 10px;border-radius:100px;border:1.5px solid var(--bdrm);background:var(--surf);color:var(--tx2);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0">Custom</button>
        </div>
        <div id="dp-custom-time-row" style="display:none;align-items:center;gap:10px;background:var(--surf2);border-radius:var(--rs);padding:10px 12px">
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <label style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:4px">Hours</label>
            <div style="display:flex;align-items:center;gap:8px">
              <button onclick="dpCustomAdjust('h',-1)" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--bdrm);background:var(--surf);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2)">−</button>
              <span id="dp-custom-h" style="font-family:'DM Mono',monospace;font-size:20px;font-weight:700;min-width:30px;text-align:center">0</span>
              <button onclick="dpCustomAdjust('h',1)" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--bdrm);background:var(--surf);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2)">+</button>
            </div>
          </div>
          <div style="font-size:20px;color:var(--tx3);margin-top:12px">:</div>
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <label style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:var(--tx3);margin-bottom:4px">Minutes</label>
            <div style="display:flex;align-items:center;gap:8px">
              <button onclick="dpCustomAdjust('m',-15)" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--bdrm);background:var(--surf);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2)">−</button>
              <span id="dp-custom-m" style="font-family:'DM Mono',monospace;font-size:20px;font-weight:700;min-width:30px;text-align:center">0</span>
              <button onclick="dpCustomAdjust('m',15)" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--bdrm);background:var(--surf);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2)">+</button>
            </div>
          </div>
          <button onclick="dpConfirmCustomTime()" style="padding:8px 14px;background:var(--green);border:none;border-radius:var(--rs);color:#fff;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;margin-top:12px">Set</button>
        </div>
        <input type="hidden" id="dp-time" value="${task?parseFloat(task.time_hours||0)||0:0}">
      </div>
      <div class="dp-field"><label class="dp-label">Bucket</label>
        <select class="dp-select" id="dp-bucket">
          <option ${task?.bucket==='Indoor'?'selected':''}>Indoor</option>
          <option ${task?.bucket==='Outdoor'?'selected':''}>Outdoor</option>
        </select>
      </div>
    </div>
    <div class="dp-field"><label class="dp-label">Event</label>
      <select class="dp-select" id="dp-event">
        <option value="">No event</option>
        ${events.filter(e=>e.status!=='completed').map(e=>`<option value="${e.id}" ${task?.event_id==e.id?'selected':''}>${e.title}</option>`).join('')}
      </select>
    </div>
    <div class="dp-field"><label class="dp-label">Notes</label>
      <textarea class="dp-textarea" id="dp-notes" placeholder="Instructions, context, tips...">${task?.notes||''}</textarea>
    </div>
  </div>
  ${task?`<div class="dp-sec">
    <div class="dp-sec-title">Timer</div>
    <div class="timer-box">
      <div>
        <div id="dp-timer-disp" class="timer-disp ${isOn&&activeTimer.status==='running'&&elapsedSecs()>activeTimer.estimateSecs?'over':''}">${isOn?fmtSecs(elapsedSecs()):'00:00'}</div>
        <div class="timer-est">Est: ${timeH?fmtHours(timeH):'not set'}${actH?' · Last: '+fmtHours(actH):''}</div>
      </div>
      <div class="timer-ctrls">
        ${isOn&&activeTimer.status==='running'?`<button class="tcbtn" onclick="timerPause()">⏸</button><button class="tcbtn stop" onclick="timerStop(true)">✓ Done</button>`
        :isOn&&activeTimer.status==='paused'?`<button class="tcbtn start" onclick="timerResume()">▷ Resume</button><button class="tcbtn stop" onclick="timerStop(true)">✓ Done</button>`
        :`<button class="tcbtn start" onclick="startTaskTimer(${task.id},null,true)">▷ Start</button>`}
      </div>
    </div>
  </div>`:''}
  <div class="dp-sec">
    <div class="dp-sec-title" style="font-size:12px;font-weight:800;color:var(--tx);letter-spacing:.3px;border-bottom:2px solid var(--green);padding-bottom:6px;margin-bottom:10px">Milestones <span style="font-weight:500;color:var(--tx2)">${ms.length?ms.filter(m=>m.done).length+'/'+ms.length+' · '+fmtHours(calcTaskTime(task?.id||0)):''}</span></div>
    <div class="ms-list" id="dp-ms-list">
      ${ms.map(m=>{
        const mOn=activeTimer&&activeTimer.msId===m.id;
        return `<div class="ms-item" id="msi-${m.id}">
          <div class="ms-chk ${m.done?'checked':''}" onclick="dpTickMs('${m.id}')"></div>
          <div class="ms-content">
            <div class="ms-name ${m.done?'done-txt':''}">${m.title}</div>
            <div class="ms-info">
              ${m.time_hours?`<span class="ms-time-badge">${parseFloat(m.time_hours).toFixed(1)}h</span>`:''}
              ${m.due?`<span class="ms-date-badge">${fmtDate(m.due)}</span>`:''}
              <button class="ms-tbtn ${mOn?'running':''}" onclick="startMsTimer('${m.id}',${task?.id})">${mOn?'⏱ On':'▷'}</button>
            </div>
          </div>
          <button class="ms-del" onclick="deleteMs('${m.id}')">✕</button>
        </div>`;
      }).join('')}
    </div>
    <div class="add-ms-row">
      <input class="add-ms-input" id="dp-ms-inp" placeholder="Add milestone..." onkeydown="if(event.key==='Enter')dpAddMs()">
      <button class="add-ms-btn" onclick="dpAddMs()">+</button>
    </div>
  </div>
  ${task?`<div class="dp-sec">
    <div class="dp-sec-title">Photos</div>
    <div class="photo-actions">
      <label class="photo-action-btn" for="photo-input-cam">📷 Take photo</label>
      <label class="photo-action-btn" for="photo-input-lib" style="gap:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      Choose from album</label>
    </div>
    <div class="photo-grid" id="dp-photo-grid">
      ${(task.photo_urls||[]).map((url,i)=>`<div class="photo-thumb">
        <img src="${url}" onclick="window.open('${url}','_blank')">
        <button class="photo-del" onclick="deletePhoto(${i})">✕</button>
      </div>`).join('')}
    </div>
  </div>`:''}`;

  if(task){
    const wirePhoto=(inputId)=>{
      const inp=document.getElementById(inputId);
      if(inp)inp.onchange=async(e)=>{
        const files=Array.from(e.target.files);if(!files.length)return;
        badge('sy','↻ Uploading...');
        try{
          for(const f of files){const url=await uploadPhoto(f,task.id);task.photo_urls.push(url);}
          await api('bravochore_tasks','PATCH',{photo_urls:task.photo_urls},`?id=eq.${task.id}`);
          badge('ok','✓');renderDpBody(task,getMs(task.id));
        }catch(err){badge('er','⚠ Upload failed');}
        e.target.value='';
      };
    };
    wirePhoto('photo-input-cam');wirePhoto('photo-input-lib');
  }
}

function closeDetail(){
  document.getElementById('detail-backdrop').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
  // Restore footer to normal task mode
  const footer=document.querySelector('.dp-footer');
  if(footer&&dpShelvedId){
    footer.innerHTML=`
      <button class="dp-pdf" onclick="generatePDFForTask()">🖨</button>
      <button class="dp-del" onclick="dpDelete()">Delete</button>
      <button class="dp-del" onclick="dpShelveTask()">Shelve</button>
      <button class="dp-save" onclick="dpSave()">Save</button>`;
  }
  dpTaskId=null;dpShelvedId=null;
}

function dpTitleBlur(){
  const task=tasks.find(t=>t.id===dpTaskId);
  const v=document.getElementById('dp-title').textContent.trim();
  if(task&&v)task.title=v;
}

async function dpToggleTask(){
  const task=tasks.find(t=>t.id===dpTaskId);if(!task)return;
  task.done=!task.done;
  document.getElementById('dp-check').classList.toggle('checked',task.done);
  document.getElementById('dp-title').classList.toggle('done-txt',task.done);
  if(task.done){playChime('task');spawnConfettiCenter();}
  rerender();
  try{await api('bravochore_tasks','PATCH',{done:task.done},`?id=eq.${dpTaskId}`);}catch(e){}
}

function dpSetTime(val,btn){
  document.getElementById('dp-time').value=val;
  const customRow=document.getElementById('dp-custom-time-row');
  if(customRow)customRow.style.display='none';
  document.querySelectorAll('#dp-time-btns button').forEach(b=>{
    const active=b===btn;
    b.style.borderColor=active?'var(--green)':'var(--bdrm)';
    b.style.background=active?'var(--green)':'var(--surf)';
    b.style.color=active?'#fff':'var(--tx2)';
  });
}
function dpShowCustomTime(btn){
  const row=document.getElementById('dp-custom-time-row');
  if(!row)return;
  const cur=parseFloat(document.getElementById('dp-time').value)||0;
  const h=Math.floor(cur);
  const m=Math.round((cur-h)*60);
  document.getElementById('dp-custom-h').textContent=h;
  document.getElementById('dp-custom-m').textContent=String(m).padStart(2,'0');
  row.style.display=row.style.display==='none'?'flex':'none';
  // deselect presets
  document.querySelectorAll('#dp-time-btns button:not(#dp-time-custom-btn)').forEach(b=>{
    b.style.borderColor='var(--bdrm)';b.style.background='var(--surf)';b.style.color='var(--tx2)';
  });
  if(btn){btn.style.borderColor='var(--green)';btn.style.background='var(--green)';btn.style.color='#fff';}
}
function dpCustomAdjust(unit,delta){
  const hEl=document.getElementById('dp-custom-h');
  const mEl=document.getElementById('dp-custom-m');
  if(!hEl||!mEl)return;
  let h=parseInt(hEl.textContent)||0;
  let m=parseInt(mEl.textContent)||0;
  if(unit==='h'){h=Math.max(0,Math.min(12,h+delta));}
  else{m=Math.max(0,Math.min(45,m+delta));m=Math.round(m/15)*15;}
  hEl.textContent=h;
  mEl.textContent=String(m).padStart(2,'0');
}
function dpConfirmCustomTime(){
  const h=parseInt(document.getElementById('dp-custom-h').textContent)||0;
  const m=parseInt(document.getElementById('dp-custom-m').textContent)||0;
  const val=h+(m/60);
  if(val===0)return;
  document.getElementById('dp-time').value=val;
  const lbl=h>0&&m>0?h+'h '+m+'m':h>0?h+'h':m+'m';
  const btn=document.getElementById('dp-time-custom-btn');
  if(btn){btn.textContent=lbl;btn.style.borderColor='var(--green)';btn.style.background='var(--green)';btn.style.color='#fff';}
  document.getElementById('dp-custom-time-row').style.display='none';
  // Deselect other buttons
  document.querySelectorAll('#dp-time-btns button:not(#dp-time-custom-btn)').forEach(b=>{
    b.style.borderColor='var(--bdrm)';b.style.background='var(--surf)';b.style.color='var(--tx2)';
  });
}
async function dpShelveTask(){
  // Snapshot — dpTaskId may be nulled by closeDetail mid-await
  const taskId=dpTaskId;
  const task=tasks.find(t=>t.id===taskId);
  if(!task||!taskId)return;
  const taskTitle=task.title;
  // Close detail panel FIRST so backdrop doesn't clash with confirm modal
  closeDetail();
  const confirmed=await confirm2('Shelve "'+taskTitle+'"?','It moves to your Shelved list with all chat, photos and history intact. Activate any time.','btn-ok');
  if(!confirmed)return;
  // Single source of truth — flip status, ID + chat + photos + everything stays
  task.status='shelved';
  badge('sy','↻');
  try{
    await api('bravochore_tasks','PATCH',{status:'shelved'},`?id=eq.${taskId}`);
    badge('sy','✓');
  }catch(e){console.error('Shelve PATCH failed:',e);chirp('Could not shelve — please try again.');task.status='active';return;}
  refreshShelvedView();
  bnNav('shelved');
  chirp('"'+taskTitle+'" shelved.');
}
async function dpSave(){
  const title=document.getElementById('dp-title').textContent.trim();
  const owner=document.getElementById('dp-owner').value;
  const due=document.getElementById('dp-due').value||null;
  const time_hours=parseFloat(document.getElementById('dp-time').value)||0;
  const bucket=document.getElementById('dp-bucket').value;
  const notes=document.getElementById('dp-notes').value;
  if(!title)return;
  badge('sy','↻');
  try{
    if(dpTaskId){
      const task=tasks.find(t=>t.id===dpTaskId);
      if(task)Object.assign(task,{title,owner,due,time_hours,bucket,notes});
      const ev_id=document.getElementById('dp-event')?.value||null;if(task)task.event_id=ev_id?parseInt(ev_id):null;await api('bravochore_tasks','PATCH',{title,owner,due,time_hours,bucket,notes,event_id:ev_id?parseInt(ev_id):null},`?id=eq.${dpTaskId}`);
    }else{
      const nid=Date.now();
      const nt={id:nid,title,owner,due,time_hours,bucket,notes,done:false,sort_order:tasks.length+1,photo_urls:[],task_code:getNextCode(),event_id:getActiveEvent()||null,status:'active'};
      tasks.push(nt);dpTaskId=nid;
      await api('bravochore_tasks','POST',[nt]);
    }
    badge('ok','✓ Saved');closeDetail();rerender();
  }catch(e){badge('er','⚠ Failed');}
}

function dpDelete(){
  if(!dpTaskId)return;
  // Show inline confirm inside the detail footer rather than a modal
  const footer=document.querySelector('.dp-footer');
  if(footer.dataset.confirming==='1'){
    // Second tap — actually delete
    const idToDelete=dpTaskId;
    tasks=tasks.filter(t=>t.id!==idToDelete);
    milestones=milestones.filter(m=>m.task_id!==idToDelete);
    closeDetail();
    rerender();
    badge('sy','↻ Deleting...');
    api('bravochore_milestones','DELETE',null,`?task_id=eq.${idToDelete}`)
      .then(()=>api('bravochore_tasks','DELETE',null,`?id=eq.${idToDelete}`))
      .then(()=>badge('ok','✓ Deleted'))
      .catch(()=>badge('er','⚠ Delete failed'));
  }else{
    // First tap — ask for confirmation inline
    footer.dataset.confirming='1';
    const delBtn=document.querySelector('.dp-del');
    delBtn.textContent='Tap again to confirm';
    delBtn.style.background='var(--red)';
    delBtn.style.color='#fff';
    delBtn.style.borderColor='var(--red)';
    // Auto-reset after 3 seconds if no second tap
    setTimeout(()=>{
      if(footer.dataset.confirming==='1'){
        footer.dataset.confirming='';
        delBtn.textContent='Delete';
        delBtn.style.background='';
        delBtn.style.color='';
        delBtn.style.borderColor='';
      }
    },3000);
  }
}

async function dpTickMs(msId){
  const ms=milestones.find(m=>m.id===msId);if(!ms)return;
  ms.done=!ms.done;
  if(ms.done)playChime('ms');
  const el=document.getElementById(`msi-${msId}`);
  if(el){el.querySelector('.ms-chk').classList.toggle('checked',ms.done);el.querySelector('.ms-name').classList.toggle('done-txt',ms.done);}
  const taskMs=getMs(ms.task_id);
  if(taskMs.every(m=>m.done)){const t=tasks.find(x=>x.id===ms.task_id);if(t&&!t.done){t.done=true;playChime('task');spawnConfettiCenter();}}
  rerender();
  try{await api('bravochore_milestones','PATCH',{done:ms.done},`?id=eq.${msId}`);}catch(e){}
}

async function dpAddMs(){
  const inp=document.getElementById('dp-ms-inp');
  if(!inp||!inp.value.trim())return;
  const task=tasks.find(t=>t.id===dpTaskId);if(!task)return;
  const due=document.getElementById('dp-due').value||task.due||null;
  const nm={id:'ms_'+Date.now(),task_id:dpTaskId,title:inp.value.trim(),done:false,owner:task.owner,due,sort_order:getMs(dpTaskId).length+1,time_hours:0};
  milestones.push(nm);inp.value='';
  renderDpBody(task,getMs(dpTaskId));rerender();
  try{await api('bravochore_milestones','POST',[nm]);}catch(e){}
}

async function deleteMs(msId){
  milestones=milestones.filter(m=>m.id!==msId);
  const task=tasks.find(t=>t.id===dpTaskId);
  renderDpBody(task,getMs(dpTaskId));rerender();
  try{await api('bravochore_milestones','DELETE',null,`?id=eq.${msId}`);}catch(e){}
}

async function deletePhoto(idx){
  const task=tasks.find(t=>t.id===dpTaskId);if(!task)return;
  task.photo_urls.splice(idx,1);
  renderDpBody(task,getMs(dpTaskId));
  try{await api('bravochore_tasks','PATCH',{photo_urls:task.photo_urls},`?id=eq.${dpTaskId}`);}catch(e){}
}

// ================================================================
// DETAIL PANEL TABS
// ================================================================
let dpActiveTab='details';

function switchDpTab(tab){
  dpActiveTab=tab;
  document.querySelectorAll('.dp-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.dp-tab-panel').forEach(p=>p.classList.remove('active'));
  const tabBtn=document.getElementById('dpt-'+tab);
  const tabPanel=document.getElementById('dp-panel-'+tab);
  if(tabBtn)tabBtn.classList.add('active');
  if(tabPanel)tabPanel.classList.add('active');
  if(tab==='chat'){
    tcPendingPhotos=[];tcRenderPendingStrip();
    loadTaskChat(dpTaskId);
    setTimeout(()=>{
      const ta=document.getElementById('tc-input');
      if(ta){
        ta.focus();
        // Autoresize on input
        if(!ta.dataset.wired){
          ta.dataset.wired='1';
          ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';});
        }
      }
    },150);
  }
}

// ================================================================
// PER-TASK BLACKBIRD CHAT
// ================================================================
let tcMessages=[]; // local cache for current task chat
let tcLoading=false;
let tcPendingPhotos=[]; // {url,thumb,name} — uploaded photo URLs waiting to be sent with next message

async function loadTaskChat(taskId){
  if(!taskId)return;
  const msgs=document.getElementById('tc-msgs');if(!msgs)return;
  msgs.innerHTML='<div class="tc-msg thinking">Loading conversation…</div>';
  try{
    const history=await api('bravochore_task_chats','GET',null,
      `?task_id=eq.${taskId}&user_code=eq.${CU}&order=created_at.asc&limit=50`);
    tcMessages=history||[];
    renderTaskChat();
    // If no history, give a contextual opening
    if(!tcMessages.length){
      const task=tasks.find(t=>t.id===taskId);
      if(task){
        const opening=`Hey — I’m here for **${task.title}**. Ask me anything about how to tackle it, break it down into steps, what to buy, who to call… anything.`;
        tcMsg('assistant',opening,false);
      }
    }
  }catch(e){
    msgs.innerHTML='<div class="tc-msg thinking">Couldn’t load chat history.</div>';
  }
}

function renderTaskChat(){
  const msgs=document.getElementById('tc-msgs');if(!msgs)return;
  if(!tcMessages.length){msgs.innerHTML='';return;}
  msgs.innerHTML=tcMessages.map(m=>{
    const photos=Array.isArray(m.photo_urls)&&m.photo_urls.length
      ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">'+m.photo_urls.map(u=>`<img src="${u}" style="max-width:140px;max-height:140px;border-radius:10px;cursor:pointer" onclick="window.open('${u}','_blank')">`).join('')+'</div>'
      : '';
    return `<div class="tc-msg ${m.role}">${mdToHtml(m.content||'')}${photos}</div>`;
  }).join('');
  msgs.scrollTop=msgs.scrollHeight;
}

function tcMsg(role,content,save=true,photoUrls=null){
  const msgs=document.getElementById('tc-msgs');if(!msgs)return;
  msgs.querySelector('.thinking')?.remove();
  const d=document.createElement('div');
  d.className='tc-msg '+role;
  let html=mdToHtml(content||'');
  if(photoUrls&&photoUrls.length){
    html+='<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">'+photoUrls.map(u=>`<img src="${u}" style="max-width:140px;max-height:140px;border-radius:10px;cursor:pointer" onclick="window.open('${u}','_blank')">`).join('')+'</div>';
  }
  d.innerHTML=html;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
  if(save&&dpTaskId){
    const m={task_id:dpTaskId,user_code:CU,role,content:content||'',photo_urls:photoUrls||[]};
    tcMessages.push(m);
    api('bravochore_task_chats','POST',[m]).catch(()=>{});
  }
}

// Photo attachment for task chat — mirrors the master Blackbird flow
async function tcAttachPhotos(input){
  if(!dpTaskId){chirp('Open a task first.');return;}
  const files=Array.from(input.files||[]);
  if(!files.length)return;
  const strip=document.getElementById('tc-pending-photos');
  if(strip)strip.style.display='block';
  for(const f of files){
    // Local preview while uploading
    const reader=new FileReader();
    const localUrl=await new Promise(res=>{reader.onload=()=>res(reader.result);reader.readAsDataURL(f);});
    const placeholder={url:null,thumb:localUrl,name:f.name,uploading:true};
    tcPendingPhotos.push(placeholder);
    tcRenderPendingStrip();
    try{
      const url=await uploadPhoto(f,dpTaskId);
      placeholder.url=url;placeholder.uploading=false;
      tcRenderPendingStrip();
    }catch(e){
      const i=tcPendingPhotos.indexOf(placeholder);
      if(i>=0)tcPendingPhotos.splice(i,1);
      tcRenderPendingStrip();
      chirp('Photo upload failed.');
    }
  }
  input.value='';
}

function tcRenderPendingStrip(){
  const strip=document.getElementById('tc-pending-photos');
  if(!strip)return;
  if(!tcPendingPhotos.length){strip.innerHTML='';strip.style.display='none';return;}
  strip.style.display='block';
  strip.innerHTML=tcPendingPhotos.map((p,i)=>`
    <span class="tc-pending-thumb">
      <img src="${p.thumb}" style="${p.uploading?'opacity:.45':''}">
      ${p.uploading?'<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;background:rgba(0,0,0,.4);border-radius:8px">…</span>':''}
      <button class="x" onclick="tcRemovePendingPhoto(${i})">×</button>
    </span>`).join('');
}

function tcRemovePendingPhoto(i){
  tcPendingPhotos.splice(i,1);
  tcRenderPendingStrip();
}

// Pick a companion persona based on task content
function tcInferCompanion(task){
  if(!task)return{label:'general assistant',mode:'general'};
  const t=(task.title+' '+(task.notes||'')).toLowerCase();
  // Cooking
  if(/\b(cook|bake|roast|grill|bbq|meat|salad|recipe|meal|dinner|lunch|breakfast|deep ?fry|webber|weber|sauce|marinade|potato|veggie|vegetable|tray|platter|food|fridge)\b/.test(t))
    return{label:'cooking companion',mode:'cooking',hint:'Help plan, time and execute the cooking. Ask about quantities, weights, oven temps, doneness. Reference photos of packaging or ingredients when given.'};
  // Garden / horticulture
  if(/\b(garden|lawn|mow|whippersnip|whipper ?snipper|prune|weed|plant|tree|bush|shrub|mulch|soil|water|hose|fertilis|fertiliz|veggie patch|flower|rose|hedge|cobweb|verandah|porch|leaf|leaves)\b/.test(t))
    return{label:'horticulture companion',mode:'horticulture',hint:'Diagnose plant issues, recommend treatments and seasonally-appropriate care. When given a photo of a plant, identify it if possible and assess its health.'};
  // DIY / repair / install
  if(/\b(fix|repair|replace|install|paint|sand|drill|screw|nail|mount|hang|holder|tile|caulk|grout|seal|leak|patch|wood|timber|frame|edge|skirting|chandelier|window|door|hinge|wardrobe|fitting|carpet|floor|ceiling|wall)\b/.test(t))
    return{label:'DIY companion',mode:'diy',hint:'Walk through the steps, suggest tools and materials, troubleshoot what is shown in photos. Be safety-aware.'};
  // Cleaning
  if(/\b(clean|wipe|scrub|mop|vacuum|dust|wash|launder|laundry|towel|bath|shower|toilet|kitchen|sink|fridge|oven|stove|range hood|chair|couch|window|skirting)\b/.test(t))
    return{label:'cleaning companion',mode:'cleaning',hint:'Suggest cleaning products, the right order of operations, and how long things should take.'};
  // Shopping / errands
  if(/\b(shop|buy|order|pickup|store|grocery|fresh|stock|restock|drink|bar)\b/.test(t))
    return{label:'errands companion',mode:'errands',hint:'Help build lists, identify alternatives, and sequence stops efficiently.'};
  return{label:'task companion',mode:'general',hint:'Help break down the work into steps, anticipate what might go wrong, and stay focused on getting it done.'};
}

async function sendTaskChat(){
  if(tcLoading)return;
  const input=document.getElementById('tc-input');
  const text=(input?.value||'').trim();
  // Wait for any in-flight uploads
  if(tcPendingPhotos.some(p=>p.uploading)){chirp('Photo still uploading…');return;}
  const photoUrls=tcPendingPhotos.filter(p=>p.url).map(p=>p.url);
  if(!text&&!photoUrls.length)return;
  if(input)input.value='';
  // Reset textarea height
  if(input){input.style.height='auto';}
  // Clear pending photos before send so the strip reflows immediately
  tcPendingPhotos=[];tcRenderPendingStrip();
  tcMsg('user',text,true,photoUrls);
  tcLoading=true;
  const msgs=document.getElementById('tc-msgs');
  const thinking=document.createElement('div');
  thinking.className='tc-msg thinking';thinking.textContent='Blackbird is thinking…';
  msgs?.appendChild(thinking);msgs&&(msgs.scrollTop=msgs.scrollHeight);
  // Build context from task
  const task=tasks.find(t=>t.id===dpTaskId);
  const ms=getMs(dpTaskId);
  const companion=tcInferCompanion(task);
  const context=task?`Task: "${task.title}"
Owner: ${getOwner(task.owner).name}
Due: ${task.due?fmtDate(task.due):'not set'}
Time estimate: ${task.time_hours?fmtHours(task.time_hours):'not set'}
Notes: ${task.notes||'none'}
Milestones: ${ms.length?ms.map(m=>(m.done?'✓ ':'○ ')+m.title).join(', '):'none'}
Code: ${task.task_code||''}
Status: ${task.done?'Done':'Pending'}`:'No task context.';
  const sysPrompt=`You are Blackbird, the AI assistant inside BravoChore — a household task management app. You are embedded inside a specific task as the user's ${companion.label}. ${companion.hint||''}

You have full context about this specific task and remember the entire conversation in this thread. The user can stop and resume any time. Be warm, direct and practical. Keep responses concise and actionable. When the user shares a photo, look at it carefully and respond to what you actually see.

${context}`;
  // Build message history for API — include photo URLs so the model sees them
  const apiMsgs=tcMessages.slice(-20).map(m=>{
    if(Array.isArray(m.photo_urls)&&m.photo_urls.length){
      // Multimodal content array — vision-capable
      const blocks=m.photo_urls.map(u=>({type:'image',source:{type:'url',url:u}}));
      if(m.content)blocks.push({type:'text',text:m.content});
      return{role:m.role,content:blocks};
    }
    return{role:m.role,content:m.content||''};
  });
  try{
    const resp=await fetch('https://xgmnyhpzuwngdngtttux.supabase.co/functions/v1/blackbird-proxy',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbW55aHB6dXduZ2RuZ3R0dHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDYxOTgsImV4cCI6MjA4OTk4MjE5OH0.aQvdjbOSRqQJmBKF-9z7KOXhC2M_gKPZ1m4rQhPZ9eo'},
      body:JSON.stringify({system:sysPrompt,messages:apiMsgs})
    });
    const data=await resp.json();
    const reply=data?.content?.[0]?.text||'Sorry, I couldn’t respond just now.';
    thinking.remove();
    tcMsg('assistant',reply);
  }catch(e){
    thinking.remove();
    tcMsg('assistant','Something went wrong. Try again in a moment.',false);
  }
  tcLoading=false;
}

function mdToHtml(text){
  return (text||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/[*][*](.*?)[*][*]/g,'<strong>$1</strong>')
    .replace(/[*](.*?)[*]/g,'<em>$1</em>')
    .split('\n').join('<br>');
}


