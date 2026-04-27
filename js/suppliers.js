// ================================================================
// SUPPLIERS — household contact directory (photo-driven CRM)
// ================================================================
// Captured via Blackbird photo intent ("photo of a man with a van, save him
// as a contact") or added manually via Settings → Suppliers. Surfaced inside
// task detail via the "Who can do this?" button. Subtle in the UI; powerful
// when called for. See BRAND.md and project_bravo_suite_strategy.md memory
// for context.
//
// Schema:  bravochore_suppliers (id, household_code, name, business_name,
//                                phone, email, website, trades, notes,
//                                photo_url, source, rating, last_used)
//          bravochore_task_suppliers (task_id, supplier_id, status)
let suppliers=[]; // local cache, loaded once at boot

async function loadSuppliers(){
  try{
    suppliers=await api('bravochore_suppliers','GET',null,'?order=last_used.desc.nullslast,name.asc')||[];
  }catch(e){suppliers=[];}
}

// ── Settings → Suppliers list ────────────────────────────────────
function openSuppliersPanel(){
  const bd=document.createElement('div');
  bd.className='modal-bd open';
  bd.id='suppliers-panel';
  bd.innerHTML=`
    <div class="modal" style="max-width:560px;width:94vw;max-height:90vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <h3 style="margin:0">Suppliers</h3>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${suppliers.length} contact${suppliers.length===1?'':'s'} · tap any to edit</div>
        </div>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div id="suppliers-body" style="flex:1;overflow-y:auto;padding:14px 16px"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);display:flex;gap:8px;background:var(--surf2)">
        <button class="qa-btn" style="flex:1" onclick="openAddSupplierSheet()">+ Add supplier</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
  renderSuppliersList();
}

function renderSuppliersList(){
  const body=document.getElementById('suppliers-body');
  if(!body)return;
  if(!suppliers.length){
    body.innerHTML=`<div style="padding:30px 16px;text-align:center;color:var(--tx2)">
      <div style="font-size:36px;margin-bottom:10px">📇</div>
      <div style="font-size:14px;font-weight:500;color:var(--tx);margin-bottom:6px">No suppliers yet</div>
      <div style="font-size:12px;line-height:1.5">Take a photo of a tradesman's van or business card via Blackbird with the words "save contact", or tap + Add supplier below.</div>
    </div>`;
    return;
  }
  body.innerHTML=suppliers.map(s=>{
    const trades=(s.trades||'').split(',').filter(Boolean);
    const lastUsed=s.last_used?fmtDate(s.last_used):'';
    return `<div onclick="openSupplierDetail(${s.id})" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--bdr);cursor:pointer">
      ${s.photo_url?`<img src="${s.photo_url}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;background:var(--surf2)">`
        :`<div style="width:44px;height:44px;border-radius:8px;background:var(--gl);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">📇</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--tx);line-height:1.2">${s.business_name||s.name||'Unnamed'}</div>
        ${s.business_name&&s.name?`<div style="font-size:11px;color:var(--tx2);margin-top:2px">${s.name}</div>`:''}
        <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap">
          ${trades.slice(0,3).map(t=>`<span style="font-size:10px;font-weight:600;color:var(--gd);background:var(--gl);padding:2px 7px;border-radius:100px">${t.trim()}</span>`).join('')}
          ${s.phone?`<span style="font-size:11px;color:var(--tx3);font-family:'DM Mono',monospace">${s.phone}</span>`:''}
          ${lastUsed?`<span style="font-size:10px;color:var(--tx3)">used ${lastUsed}</span>`:''}
        </div>
      </div>
      <span style="color:var(--tx3);font-size:18px;align-self:center">›</span>
    </div>`;
  }).join('');
}

// ── Add / Edit ──────────────────────────────────────────────────
async function openAddSupplierSheet(prefill){
  const result=await promptSheet({
    title:prefill?'Confirm supplier':'Add supplier',
    subtitle:prefill?'Edit anything Blackbird got wrong, then save.':'A name is enough — fill out what you have, leave the rest.',
    confirmLabel:'Save',
    fields:[
      {name:'business_name',label:'Business name',value:prefill?.business_name||'',placeholder:"e.g. Jim's Mowing"},
      {name:'name',label:'Person',value:prefill?.name||'',placeholder:'e.g. Jim'},
      {name:'phone',label:'Phone',value:prefill?.phone||''},
      {name:'trades',label:'Trades (comma-separated)',value:prefill?.trades||'',placeholder:'e.g. plumber, gas-fitter'},
      {name:'notes',label:'Notes',type:'textarea',value:prefill?.notes||'',placeholder:'Hours, area, anything worth remembering'},
      {name:'email',label:'Email (optional)',value:prefill?.email||''},
      {name:'website',label:'Website (optional)',value:prefill?.website||''}
    ]
  });
  if(!result)return;
  if(!result.business_name&&!result.name&&!result.phone){
    chirp('Need at least a name or a phone number.');return;
  }
  const row={
    business_name:result.business_name||null,
    name:result.name||null,
    phone:result.phone||null,
    trades:result.trades||null,
    notes:result.notes||null,
    email:result.email||null,
    website:result.website||null,
    photo_url:prefill?.photo_url||null,
    source:prefill?.source||'manual'
  };
  badge('sy','↻');
  try{
    const r=await api('bravochore_suppliers','POST',[row]);
    if(r&&r[0])suppliers.unshift(r[0]);
    badge('ok','✓');
    chirp('Supplier saved.');
    renderSuppliersList();
  }catch(e){
    badge('er','⚠');
    chirp('Could not save supplier.');
  }
}

function openSupplierDetail(id){
  const s=suppliers.find(x=>x.id===id);if(!s)return;
  const bd=document.createElement('div');
  bd.className='modal-bd open';
  bd.innerHTML=`
    <div class="modal" style="max-width:480px;width:94vw;max-height:90vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:14px 18px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0;font-size:16px">Supplier</h3>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 18px">
        ${s.photo_url?`<img src="${s.photo_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--rs);margin-bottom:12px;cursor:pointer" onclick="window.open('${s.photo_url}','_blank')">`:''}
        <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:500">${s.business_name||s.name||'Unnamed'}</div>
        ${s.business_name&&s.name?`<div style="font-size:13px;color:var(--tx2);margin-bottom:8px">${s.name}</div>`:'<div style="margin-bottom:8px"></div>'}
        ${s.phone?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">📞</span><a href="tel:${s.phone.replace(/\s+/g,'')}" style="font-family:'DM Mono',monospace;font-size:14px;color:var(--green);text-decoration:none;font-weight:600">${s.phone}</a></div>`:''}
        ${s.email?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">✉️</span><a href="mailto:${s.email}" style="font-size:13px;color:var(--green);text-decoration:none">${s.email}</a></div>`:''}
        ${s.website?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">🌐</span><a href="${s.website}" target="_blank" style="font-size:13px;color:var(--green);text-decoration:none">${s.website}</a></div>`:''}
        ${s.trades?`<div style="margin-top:10px"><div class="dp-label">Trades</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${s.trades.split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span style="font-size:11px;font-weight:600;color:var(--gd);background:var(--gl);padding:3px 9px;border-radius:100px">${t}</span>`).join('')}</div></div>`:''}
        ${s.notes?`<div style="margin-top:12px"><div class="dp-label">Notes</div><div style="font-size:13px;color:var(--tx2);margin-top:4px;white-space:pre-wrap">${s.notes}</div></div>`:''}
        ${s.last_used?`<div style="margin-top:12px;font-size:11px;color:var(--tx3)">Last engaged: ${fmtDate(s.last_used)}</div>`:''}
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);display:flex;gap:8px;background:var(--surf2)">
        <button class="dp-del" style="flex-shrink:0" onclick="deleteSupplier(${s.id});this.closest('.modal-bd').remove()">Delete</button>
        <button class="qa-btn" style="flex:1" onclick="this.closest('.modal-bd').remove();editSupplier(${s.id})">Edit</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
}

async function editSupplier(id){
  const s=suppliers.find(x=>x.id===id);if(!s)return;
  const result=await promptSheet({
    title:'Edit supplier',
    confirmLabel:'Save',
    fields:[
      {name:'business_name',label:'Business name',value:s.business_name||''},
      {name:'name',label:'Person',value:s.name||''},
      {name:'phone',label:'Phone',value:s.phone||''},
      {name:'trades',label:'Trades (comma-separated)',value:s.trades||''},
      {name:'notes',label:'Notes',type:'textarea',value:s.notes||''},
      {name:'email',label:'Email',value:s.email||''},
      {name:'website',label:'Website',value:s.website||''}
    ]
  });
  if(!result)return;
  Object.assign(s,{
    business_name:result.business_name||null,
    name:result.name||null,
    phone:result.phone||null,
    trades:result.trades||null,
    notes:result.notes||null,
    email:result.email||null,
    website:result.website||null
  });
  badge('sy','↻');
  try{
    await api('bravochore_suppliers','PATCH',{
      business_name:s.business_name,name:s.name,phone:s.phone,
      trades:s.trades,notes:s.notes,email:s.email,website:s.website,
      updated_at:new Date().toISOString()
    },`?id=eq.${id}`);
    badge('ok','✓');
    chirp('Updated.');
    renderSuppliersList();
  }catch(e){badge('er','⚠');}
}

async function deleteSupplier(id){
  const s=suppliers.find(x=>x.id===id);if(!s)return;
  const ok=await confirm2('Delete '+(s.business_name||s.name||'this supplier')+'?','Removes them from your supplier directory. Tasks they were linked to are unaffected.','btn-ok');
  if(!ok)return;
  suppliers=suppliers.filter(x=>x.id!==id);
  renderSuppliersList();
  try{await api('bravochore_suppliers','DELETE',null,`?id=eq.${id}`);chirp('Deleted.');}
  catch(e){chirp('Delete failed.');}
}

// ── "Who can do this?" — task panel integration ─────────────────
async function whoCanDoThis(taskId){
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  if(!suppliers.length){
    const ok=await confirm2('No suppliers yet','You have not added any suppliers. Open Suppliers to add some?','btn-ok');
    if(ok)openSuppliersPanel();
    return;
  }
  // Quick local match: any supplier whose trades CSV contains keywords from
  // the task title/notes. This gives an instant baseline; if the user wants
  // an AI-curated list they can ask Blackbird directly with a task context.
  const blob=((task.title||'')+' '+(task.notes||'')).toLowerCase();
  const matches=suppliers.filter(s=>{
    if(!s.trades)return false;
    const trades=s.trades.toLowerCase();
    // Match if any trade tag appears in the task blob
    return trades.split(',').some(t=>{
      const tag=t.trim();
      return tag&&blob.includes(tag);
    });
  });
  // Surface a sheet listing matches first, then "all suppliers" below
  const others=suppliers.filter(s=>!matches.includes(s));
  const sheet=document.createElement('div');
  sheet.setAttribute('data-picker','1');
  sheet.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:910;display:flex;align-items:flex-end;justify-content:center';
  const renderRow=s=>{
    const trades=(s.trades||'').split(',').filter(Boolean).slice(0,2).map(t=>t.trim());
    return `<div onclick="engageSupplier(${s.id},${task.id})" style="display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);cursor:pointer;align-items:center">
      ${s.photo_url?`<img src="${s.photo_url}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">`:`<div style="width:36px;height:36px;border-radius:6px;background:var(--gl);flex-shrink:0;display:flex;align-items:center;justify-content:center">📇</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${s.business_name||s.name||'Unnamed'}</div>
        <div style="display:flex;gap:5px;margin-top:2px;flex-wrap:wrap;align-items:center">
          ${trades.map(t=>`<span style="font-size:10px;font-weight:600;color:var(--gd);background:var(--gl);padding:1px 6px;border-radius:100px">${t}</span>`).join('')}
          ${s.phone?`<a href="tel:${s.phone.replace(/\s+/g,'')}" onclick="event.stopPropagation()" style="font-size:11px;color:var(--green);font-family:'DM Mono',monospace;text-decoration:none;font-weight:600">${s.phone}</a>`:''}
        </div>
      </div>
      <span style="color:var(--tx3);font-size:18px">›</span>
    </div>`;
  };
  sheet.innerHTML=`<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:82vh;display:flex;flex-direction:column;padding-bottom:max(16px,env(safe-area-inset-bottom))">
    <div style="padding:14px 16px 10px;border-bottom:1px solid var(--bdr);background:var(--surf);border-radius:20px 20px 0 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500">Who can do this?</div>
        <div style="font-size:11px;color:var(--tx2)">${matches.length?matches.length+' likely match'+(matches.length===1?'':'es')+' for "'+(task.title||'this task')+'"':'No tag matches — pick from your full list below'}</div>
      </div>
      <button onclick="this.closest('[data-picker]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--tx3)">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px 16px">
      ${matches.length?'<div style="font-size:10px;font-weight:700;color:var(--gd);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px">Matches</div>':''}
      ${matches.map(renderRow).join('')}
      ${others.length?'<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 4px">All suppliers</div>':''}
      ${others.map(renderRow).join('')}
    </div>
    <div style="padding:10px 16px;border-top:1px solid var(--bdr);background:var(--surf2);display:flex;gap:8px">
      <button class="qa-btn" style="flex:1" onclick="this.closest('[data-picker]').remove();askBlackbirdForSupplier(${task.id})">🤖 Ask Blackbird</button>
      <button class="qa-btn" style="flex:1" onclick="this.closest('[data-picker]').remove();openAddSupplierSheet()">+ Add new</button>
    </div>
  </div>`;
  sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.remove();});
  document.body.appendChild(sheet);
}

// Mark a supplier as engaged for this task. Updates last_used, links via
// bravochore_task_suppliers, and offers a tel: shortcut.
async function engageSupplier(supplierId,taskId){
  const s=suppliers.find(x=>x.id===supplierId);if(!s)return;
  document.querySelectorAll('[data-picker]').forEach(p=>p.remove());
  const today=tdStr();
  s.last_used=today;
  try{
    await api('bravochore_suppliers','PATCH',{last_used:today,updated_at:new Date().toISOString()},`?id=eq.${supplierId}`);
    await api('bravochore_task_suppliers','POST',[{task_id:taskId,supplier_id:supplierId,status:'considering'}]);
  }catch(e){}
  if(s.phone){
    const ok=await confirm2('Call '+(s.business_name||s.name)+'?',s.phone+'\n\nMarks this supplier as engaged for the task.','btn-ok');
    if(ok){window.location.href='tel:'+s.phone.replace(/\s+/g,'');}
  }else{
    chirp('Marked '+(s.business_name||s.name)+' as engaged for this task.');
  }
}

// Punt to Blackbird with rich task context — for cases where local tag matches
// don't surface a winner and we want the LLM's pattern-matching instead.
function askBlackbirdForSupplier(taskId){
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  if(typeof openBBFullscreen==='function')openBBFullscreen();
  const list=suppliers.map(s=>`- ${s.business_name||s.name||'Unnamed'}${s.trades?' ('+s.trades+')':''}${s.notes?' — '+s.notes:''}${s.phone?' · '+s.phone:''}`).join('\n');
  const seed=`Looking at this task: "${task.title}"${task.notes?' ('+task.notes+')':''}.\n\nFrom my supplier list, who could I call?\n\n${list||'(I have no suppliers saved yet.)'}`;
  setTimeout(()=>{
    const inp=document.getElementById('bb-input');
    if(inp){inp.value=seed;inp.focus();inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,140)+'px';}
  },200);
}

// ── Blackbird supplier-creation flow ────────────────────────────
// Detect when the user is asking BB to save a supplier (vs creating a task).
// Photo + words like "contact", "supplier", "save this", a trade name, etc.
function detectSupplierIntent(msg,hasPhotos){
  if(!msg)return false;
  // Strong signals — explicit save commands
  if(/\b(save|add|store)\b.*\b(contact|supplier|tradesman|tradesperson|tradie|business|number|phone)\b/i.test(msg))return true;
  if(/\b(this|here)\b.*\b(contact|supplier|tradie|business)\b/i.test(msg))return true;
  // Photo-only weak signals — saw a tradesman in the wild and snapped
  if(hasPhotos&&/\b(contact|supplier|business card|tradie|man with a van|sign|signage)\b/i.test(msg))return true;
  return false;
}

// Given a parsed structured response from Blackbird's vision call, present a
// confirmation card the same way bbConfirmTask does for tasks. User can edit
// then save.
function showBBSupplierPreview(parsed,photos){
  const card=document.createElement('div');
  card.className='bb-preview-card';
  card.dataset.parsed=JSON.stringify(parsed);
  card.dataset.photos=JSON.stringify(photos.map(p=>({dataUrl:p.dataUrl,type:p.file?.type||'image/jpeg',name:p.file?.name||'photo.jpg'})));
  const photoHtml=photos.length?`<div class="bb-preview-photos">${photos.map(p=>`<img class="bb-preview-photo" src="${p.dataUrl}">`).join('')}</div>`:'';
  card.innerHTML=`
    <div class="bb-preview-title">${parsed.business_name||parsed.name||'Supplier'}</div>
    ${parsed.business_name&&parsed.name?`<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">${parsed.name}</div>`:''}
    <div class="bb-preview-row">
      ${parsed.phone?`<span class="task-time-b" style="font-family:'DM Mono',monospace">${parsed.phone}</span>`:''}
      ${parsed.trades?parsed.trades.split(',').map(t=>`<span class="task-tag" style="background:var(--gl);color:var(--gd)">${t.trim()}</span>`).join(''):''}
    </div>
    ${parsed.notes?`<div style="font-size:12px;color:var(--tx2);margin:6px 0">${parsed.notes}</div>`:''}
    ${photoHtml}
    <div class="bb-confirm-row">
      <button class="bb-confirm-yes" onclick="bbConfirmSupplier(this)">✓ Save to Suppliers</button>
      <button class="bb-confirm-no" onclick="bbDeclineSupplier(this)">Edit first</button>
    </div>`;
  if(parsed.blackbird_comment)bbMsg(parsed.blackbird_comment,'from-bb');
  bbMsgEl(card);
}

async function bbConfirmSupplier(btn){
  const card=btn.closest('.bb-preview-card');
  const parsed=JSON.parse(card.dataset.parsed);
  const photoData=JSON.parse(card.dataset.photos||'[]');
  btn.textContent='Adding…';btn.disabled=true;
  // Upload first photo if any (we use task=null and a synthetic supplier id;
  // the upload helper accepts a key — reuse the supplier path)
  let photoUrl=null;
  if(photoData.length){
    try{
      const p=photoData[0];
      const res=await fetch(p.dataUrl);
      const blob=await res.blob();
      const file=new File([blob],p.name||'supplier.jpg',{type:p.type||'image/jpeg'});
      // Use the existing uploadPhoto helper but scope under a synthetic supplier id
      photoUrl=await uploadPhoto(file,'supplier-'+Date.now());
    }catch(e){console.warn('Supplier photo upload failed:',e);}
  }
  const row={
    business_name:parsed.business_name||null,
    name:parsed.name||null,
    phone:parsed.phone||null,
    email:parsed.email||null,
    website:parsed.website||null,
    trades:parsed.trades||null,
    notes:parsed.notes||null,
    photo_url:photoUrl,
    source:'photo'
  };
  try{
    const r=await api('bravochore_suppliers','POST',[row]);
    if(r&&r[0])suppliers.unshift(r[0]);
    card.innerHTML=`<div style="color:var(--gd);font-weight:600;font-size:13px;padding:4px 0">✓ "${row.business_name||row.name||'Supplier'}" saved to your contacts</div>`;
  }catch(e){
    btn.textContent='✓ Save to Suppliers';btn.disabled=false;
    bbMsg('Could not save — try again.','from-bb');
  }
}

function bbDeclineSupplier(btn){
  const card=btn.closest('.bb-preview-card');
  const parsed=JSON.parse(card.dataset.parsed);
  card.remove();
  // Open the manual editor pre-filled
  openAddSupplierSheet(parsed);
}
