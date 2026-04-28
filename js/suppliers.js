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
let supplierReviews=[]; // [{id, supplier_id, task_id, owner, rating, review, created_at}]

async function loadSuppliers(){
  try{
    suppliers=await api('bravochore_suppliers','GET',null,'?order=last_used.desc.nullslast,name.asc')||[];
  }catch(e){suppliers=[];}
  try{
    supplierReviews=await api('bravochore_supplier_reviews','GET',null,'?order=created_at.desc')||[];
  }catch(e){supplierReviews=[];}
}

// Compute average rating for a supplier; returns {avg: number|null, count: int}
function supplierRatingSummary(supplierId){
  const rs=supplierReviews.filter(r=>r.supplier_id===supplierId);
  if(!rs.length)return{avg:null,count:0};
  const sum=rs.reduce((s,r)=>s+(r.rating||0),0);
  return{avg:sum/rs.length,count:rs.length};
}

// Render a row of stars for a given rating (1-5). showEmpty=true draws empty
// stars for the unfilled positions; otherwise just the filled ones.
function starsHtml(rating,opts){
  opts=opts||{};
  const showEmpty=opts.showEmpty!==false;
  const size=opts.size||12;
  const filled='★',empty='☆';
  const r=Math.round(rating||0);
  let out='';
  for(let i=1;i<=5;i++){
    const isOn=i<=r;
    if(!isOn&&!showEmpty)continue;
    out+=`<span style="color:${isOn?'#d4a017':'var(--bdrm)'};font-size:${size}px;line-height:1">${isOn?filled:empty}</span>`;
  }
  return out;
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
    const r=supplierRatingSummary(s.id);
    const ratingTag=r.count?`<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--tx2)">${starsHtml(r.avg,{size:11,showEmpty:false})}<span style="font-family:'DM Mono',monospace">${r.avg.toFixed(1)}</span><span style="color:var(--tx3)">(${r.count})</span></span>`:'';
    return `<div onclick="openSupplierDetail(${s.id})" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--bdr);cursor:pointer">
      ${s.photo_url?`<img src="${s.photo_url}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;background:var(--surf2)">`
        :`<div style="width:44px;height:44px;border-radius:8px;background:var(--gl);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">📇</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--tx);line-height:1.2">${s.business_name||s.name||'Unnamed'}</div>
        ${s.business_name&&s.name?`<div style="font-size:11px;color:var(--tx2);margin-top:2px">${s.name}</div>`:''}
        <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;align-items:center">
          ${trades.slice(0,3).map(t=>`<span style="font-size:10px;font-weight:600;color:var(--gd);background:var(--gl);padding:2px 7px;border-radius:100px">${t.trim()}</span>`).join('')}
          ${ratingTag}
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
  const r=supplierRatingSummary(s.id);
  const reviews=supplierReviews.filter(rv=>rv.supplier_id===s.id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
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
        ${r.count?`<div style="display:flex;align-items:center;gap:6px;margin:4px 0 12px">${starsHtml(r.avg,{size:16})}<span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600">${r.avg.toFixed(1)}</span><span style="font-size:11px;color:var(--tx3)">(${r.count} review${r.count===1?'':'s'})</span></div>`:''}
        ${s.phone?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">📞</span><a href="tel:${s.phone.replace(/\s+/g,'')}" style="font-family:'DM Mono',monospace;font-size:14px;color:var(--green);text-decoration:none;font-weight:600">${s.phone}</a></div>`:''}
        ${s.email?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">✉️</span><a href="mailto:${s.email}" style="font-size:13px;color:var(--green);text-decoration:none">${s.email}</a></div>`:''}
        ${s.website?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px">🌐</span><a href="${s.website}" target="_blank" style="font-size:13px;color:var(--green);text-decoration:none">${s.website}</a></div>`:''}
        ${s.trades?`<div style="margin-top:10px"><div class="dp-label">Trades</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">${s.trades.split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span style="font-size:11px;font-weight:600;color:var(--gd);background:var(--gl);padding:3px 9px;border-radius:100px">${t}</span>`).join('')}</div></div>`:''}
        ${s.notes?`<div style="margin-top:12px"><div class="dp-label">Notes</div><div style="font-size:13px;color:var(--tx2);margin-top:4px;white-space:pre-wrap">${s.notes}</div></div>`:''}
        ${s.last_used?`<div style="margin-top:12px;font-size:11px;color:var(--tx3)">Last engaged: ${fmtDate(s.last_used)}</div>`:''}
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--bdr)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div class="dp-label" style="margin:0">Reviews</div>
            <button class="qa-btn" style="font-size:11px;padding:5px 10px" onclick="addReview(${s.id},this)">+ Leave a review</button>
          </div>
          ${reviews.length?reviews.map(rv=>{
            const o=getOwner(rv.owner||CU);
            const linkedTask=rv.task_id?tasks.find(t=>t.id===rv.task_id):null;
            return `<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);padding:10px 12px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                ${starsHtml(rv.rating,{size:13})}
                <span class="task-tag" style="background:${o.bg};color:${o.color};font-size:10px">${o.name}</span>
                <span style="font-size:10px;color:var(--tx3);margin-left:auto">${fmtDate((rv.created_at||'').slice(0,10))}</span>
                <button onclick="deleteReview(${rv.id},this)" style="background:none;border:none;color:var(--tx3);font-size:13px;cursor:pointer;padding:0 2px;line-height:1" title="Delete review">×</button>
              </div>
              ${rv.review?`<div style="font-size:13px;color:var(--tx);line-height:1.5;white-space:pre-wrap">${rv.review}</div>`:''}
              ${linkedTask?`<div style="font-size:10px;color:var(--tx3);margin-top:6px">Job: ${linkedTask.title}</div>`:''}
            </div>`;
          }).join(''):'<div style="font-size:12px;color:var(--tx3);padding:8px 0">No reviews yet — leave one after your next job.</div>'}
        </div>
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);display:flex;gap:8px;background:var(--surf2)">
        <button class="dp-del" style="flex-shrink:0" onclick="deleteSupplierFromDetail(${s.id},this)">Delete</button>
        <button class="qa-btn" style="flex:1" onclick="this.closest('.modal-bd').remove();editSupplier(${s.id})">Edit</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
}

// ── Reviews ─────────────────────────────────────────────────────
async function addReview(supplierId,btn){
  const s=suppliers.find(x=>x.id===supplierId);if(!s)return;
  // Build optional task-link options from active+done tasks (most recent first)
  const taskOpts=[{value:'',label:'(no specific task)'}].concat(
    [...tasks].sort((a,b)=>(b.id||0)-(a.id||0)).slice(0,30).map(t=>({value:String(t.id),label:t.title.slice(0,80)}))
  );
  const result=await promptSheet({
    title:'Review '+(s.business_name||s.name||'this supplier'),
    subtitle:'Your honest take. Helps you and your household pick again next time.',
    confirmLabel:'Save review',
    fields:[
      {name:'rating',label:'Rating (1–5)',type:'number',value:5,min:1,max:5,step:1,required:true},
      {name:'review',label:'Review (optional)',type:'textarea',value:'',placeholder:"e.g. 'Did a great job, charged extra though — be clear about price up front.'"},
      {name:'task_id',label:'Linked job (optional)',type:'select',options:taskOpts,value:''}
    ]
  });
  if(!result)return;
  const rating=Math.max(1,Math.min(5,Math.round(parseFloat(result.rating)||0)));
  if(!rating){chirp('Pick a rating between 1 and 5.');return;}
  const row={
    supplier_id:supplierId,
    task_id:result.task_id?parseInt(result.task_id,10):null,
    owner:CU,
    rating,
    review:result.review||null
  };
  try{
    await thinkingButton(btn,'Saving…',async()=>{
      const r=await api('bravochore_supplier_reviews','POST',[row]);
      if(r&&r[0])supplierReviews.unshift(r[0]);
      // Re-open the detail panel so the new review shows immediately
      btn.closest('.modal-bd')?.remove();
      openSupplierDetail(supplierId);
      renderSuppliersList();
      return '✓ Saved';
    },{errorText:"Couldn't save review"});
  }catch(e){/* error already chirped */}
}

async function deleteReview(reviewId,btn){
  const ok=await confirm2('Delete this review?','Removes your rating and any notes.','btn-ok');
  if(!ok)return;
  const idx=supplierReviews.findIndex(r=>r.id===reviewId);
  if(idx<0)return;
  const removed=supplierReviews.splice(idx,1)[0];
  // Refresh the visible review row immediately
  const reviewRow=btn.closest('div')?.parentElement;
  if(reviewRow)reviewRow.style.opacity='0.4';
  try{
    await api('bravochore_supplier_reviews','DELETE',null,`?id=eq.${reviewId}`);
    // Re-render the panel so star average + review list both update
    const supplierId=removed.supplier_id;
    btn.closest('.modal-bd')?.remove();
    openSupplierDetail(supplierId);
    renderSuppliersList();
    chirp('Review deleted.');
  }catch(e){
    supplierReviews.splice(idx,0,removed);
    if(reviewRow)reviewRow.style.opacity='';
    chirp("Couldn't delete review.");
  }
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

// Delete-from-detail wrapper that shows the loading state ON the actual
// delete button (so the user sees feedback) before closing the modal.
async function deleteSupplierFromDetail(id,btn){
  const s=suppliers.find(x=>x.id===id);if(!s)return;
  const ok=await confirm2('Delete '+(s.business_name||s.name||'this supplier')+'?','Removes them from your supplier directory. Tasks they were linked to are unaffected.','btn-ok');
  if(!ok)return;
  try{
    await thinkingButton(btn,'Deleting…',async()=>{
      const idx=suppliers.findIndex(x=>x.id===id);
      const removed=idx>=0?suppliers.splice(idx,1)[0]:null;
      renderSuppliersList();
      try{
        await api('bravochore_suppliers','DELETE',null,`?id=eq.${id}`);
      }catch(e){
        if(idx>=0&&removed)suppliers.splice(idx,0,removed);
        renderSuppliersList();
        throw e;
      }
      return '✓ Deleted';
    },{errorText:"Couldn't delete"});
    btn.closest('.modal-bd')?.remove();
    chirp('Supplier deleted.');
  }catch(e){/* error already surfaced */}
}

async function deleteSupplier(id){
  const s=suppliers.find(x=>x.id===id);if(!s)return;
  const ok=await confirm2('Delete '+(s.business_name||s.name||'this supplier')+'?','Removes them from your supplier directory. Tasks they were linked to are unaffected.','btn-ok');
  if(!ok)return;
  // Optimistic remove — user sees the row vanish IMMEDIATELY
  const idx=suppliers.findIndex(x=>x.id===id);
  const removed=suppliers.splice(idx,1)[0];
  renderSuppliersList();
  badge('sy','↻');
  try{
    await api('bravochore_suppliers','DELETE',null,`?id=eq.${id}`);
    badge('ok','✓');
    chirp('Deleted.');
  }catch(e){
    console.error('Delete supplier failed:',e);
    badge('er','⚠');
    // Revert — put the supplier back so the UI matches reality
    if(idx>=0&&removed)suppliers.splice(idx,0,removed);
    renderSuppliersList();
    chirp("Couldn't delete — "+(e?.message?e.message.slice(0,80):'check connection'));
  }
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
    const r=supplierRatingSummary(s.id);
    const ratingTag=r.count?`<span style="display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--tx2)">${starsHtml(r.avg,{size:10,showEmpty:false})}<span style="font-family:'DM Mono',monospace;font-weight:600">${r.avg.toFixed(1)}</span></span>`:'';
    return `<div onclick="engageSupplier(${s.id},${task.id})" style="display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);cursor:pointer;align-items:center">
      ${s.photo_url?`<img src="${s.photo_url}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0">`:`<div style="width:36px;height:36px;border-radius:6px;background:var(--gl);flex-shrink:0;display:flex;align-items:center;justify-content:center">📇</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${s.business_name||s.name||'Unnamed'}</div>
        <div style="display:flex;gap:5px;margin-top:2px;flex-wrap:wrap;align-items:center">
          ${trades.map(t=>`<span style="font-size:10px;font-weight:600;color:var(--gd);background:var(--gl);padding:1px 6px;border-radius:100px">${t}</span>`).join('')}
          ${ratingTag}
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
    <div style="padding:10px 16px;border-top:1px solid var(--bdr);background:var(--surf2);display:flex;gap:8px;flex-wrap:wrap">
      <button class="qa-btn" style="flex:1;min-width:0" onclick="this.closest('[data-picker]').remove();findSupplierViaBlackbird(${task.id},${matches.length})">🔎 Find someone new</button>
      <button class="qa-btn" style="flex:1;min-width:0" onclick="this.closest('[data-picker]').remove();openAddSupplierSheet()">+ Add manually</button>
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

// Open master Blackbird with a prefilled prompt that asks for supplier
// recommendations. Two flavours:
//   - matchCount > 0: ask BB to pick the best fit from your saved list,
//     using ratings + recency + tag match.
//   - matchCount = 0: ask BB to RECOMMEND tradies you don't have yet —
//     types of business / questions to ask / how to find them locally.
// User then snaps a photo of a candidate's van or business card and the
// existing photo-driven supplier capture flow saves them.
function findSupplierViaBlackbird(taskId,matchCount){
  const task=tasks.find(t=>t.id===taskId);if(!task)return;
  if(typeof openBBFullscreen==='function')openBBFullscreen();
  const trade=inferTradeFromTask(task);
  const yourList=suppliers.length?suppliers.map(s=>{
    const r=supplierRatingSummary(s.id);
    const ratingStr=r.count?` ★${r.avg.toFixed(1)} (${r.count})`:'';
    const lastUsed=s.last_used?` last used ${fmtDate(s.last_used)}`:'';
    return `- ${s.business_name||s.name||'Unnamed'}${s.trades?' ('+s.trades+')':''}${ratingStr}${lastUsed}${s.phone?' · '+s.phone:''}`;
  }).join('\n'):'(no saved suppliers yet)';
  let seed;
  if(matchCount>0){
    seed=`I need to ${task.title.toLowerCase()}${task.notes?' — '+task.notes:''}.\n\nWho should I call from my supplier list? Consider their star ratings, when I last used them, and whether their trade tags actually match. If one stands out as the obvious "regular" pick (recent + good rating), say so.\n\nMy suppliers:\n${yourList}`;
  }else{
    seed=`I need to ${task.title.toLowerCase()}${task.notes?' — '+task.notes:''}.\n\nI don't have a relevant ${trade?trade:'tradesperson'} saved yet. Can you suggest:\n1. The right type of trade for this job (if not obvious)\n2. Two or three things I should look out for / ask about when ringing around\n3. Smart places to find a good local one in Perth WA — e.g. a specific Google Maps search to try, community Facebook groups, "ask the neighbour" approach, etc.\n\nI'll snap a photo of any van or card I see and Blackbird saves it as a supplier.\n\nMy current supplier list (so you don't suggest the same trades I already have someone for):\n${yourList}`;
  }
  setTimeout(()=>{
    const inp=document.getElementById('bb-input');
    if(inp){
      inp.value=seed;
      inp.focus();
      inp.style.height='auto';
      inp.style.height=Math.min(inp.scrollHeight,140)+'px';
    }
  },200);
}

// Best-effort trade extraction from a task title/notes — used to give
// Blackbird a concrete trade word in the recommendation prompt.
function inferTradeFromTask(task){
  const blob=((task.title||'')+' '+(task.notes||'')).toLowerCase();
  const trades=['plumber','electrician','painter','carpenter','mowing','landscaping','gardener','builder','tiler','cleaner','roofing','fencing','concreting','tree-service','gas-fitter','glazier'];
  return trades.find(t=>blob.includes(t.replace('-',' '))||blob.includes(t))||null;
}

// Backward-compat shim — old code paths called askBlackbirdForSupplier
function askBlackbirdForSupplier(taskId){
  return findSupplierViaBlackbird(taskId,suppliers.length>0?1:0);
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
    console.error('Supplier save failed:',e);
    btn.textContent='✓ Save to Suppliers';btn.disabled=false;
    // Surface the actual error so we can diagnose future failures rather than
    // showing the same opaque "could not save" every time.
    const detail=(e&&e.message)?e.message.slice(0,120):'unknown error';
    bbMsg('Could not save — '+detail+'. Try again or save manually via Settings → Suppliers.','from-bb');
  }
}

function bbDeclineSupplier(btn){
  const card=btn.closest('.bb-preview-card');
  const parsed=JSON.parse(card.dataset.parsed);
  card.remove();
  // Open the manual editor pre-filled
  openAddSupplierSheet(parsed);
}
