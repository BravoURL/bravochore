
// ================================================================
// SHOPPING
// ================================================================
// Bunnings category map — fastest pick route
const BUNNINGS_CATS={
  'Nursery & Garden':['plant','ivy','liriope','pine','mulch','soil','potting','seeds','seedling','garden bed','planter','pot'],
  'Outdoor & Landscaping':['paving','brick','sand','gravel','edging','retaining'],
  'Irrigation':['retic','drip','dripper','irrigation','hose','sprinkler','valve'],
  'Paint':['paint','primer','sealer','stain','varnish','epoxy'],
  'Electrical':['downlight','smart light','switch','cable','conduit','light'],
  'Flooring':['vinyl','lino','floor','tile'],
  'Hardware & Fasteners':['screw','bolt','bracket','hook','anchor','rawl','hinge','handle'],
  'Doors & Windows':['door','window','lock','mortice','latch','rebate','strike'],
  'Tools & Equipment':['chair','storage','rack','tool'],
  'General':[]
};
const COLES_CATS={
  'Bakery':['bread','bun','roll','cake','pastry'],
  'Deli & Cheese':['cheese','deli','ham','salami','prosciutto'],
  'Meat & Seafood':['beef','chicken','pork','lamb','fish','seafood','steak','mince'],
  'Fruit & Veg':['vegetable','fruit','salad','herb','onion','tomato','potato','apple','lemon'],
  'Personal Care':['shaving','shampoo','conditioner','deodorant','toothpaste','toothbrush','soap','body wash','face wash','moisturiser','sunscreen','razor','tampon','nappy','diaper','cotton bud','hand cream','face cream','body lotion'],
  'Dairy & Eggs':['milk','egg','butter','yoghurt','yogurt','cream cheese','sour cream','thickened cream','double cream','pure cream'],
  'Frozen':['frozen','ice cream','pizza'],
  'Pantry':['oil','vinegar','sauce','pasta','rice','flour','sugar','spice','can','tin'],
  'Drinks':['wine','beer','juice','water','soft drink','coffee','tea'],
  'Household':['cleaning','detergent','paper','tissue'],
  'General':[]
};

function categoriseItems(items,store){
  const cats=store==='Bunnings'?BUNNINGS_CATS:store==='Coles'?COLES_CATS:null;
  if(!cats)return[{cat:'Items',items}];
  const result={};
  Object.keys(cats).forEach(c=>result[c]=[]);
  items.forEach(item=>{
    const name=(item.name+' '+(item.note||'')).toLowerCase();
    let assigned=false;
    for(const[cat,keywords]of Object.entries(cats)){
      if(cat==='General')continue;
      if(keywords.some(k=>name.includes(k))){result[cat].push(item);assigned=true;break;}
    }
    if(!assigned)result['General'].push(item);
  });
  return Object.entries(result).filter(([,items])=>items.length).map(([cat,items])=>({cat,items}));
}

// Per-household shopping stores. Loaded from bravochore_stores into this
// state array on boot. Replaces the old hardcoded Bunnings/Coles/ABI/Other.
let stores=[];

async function loadStores(){
  try{
    stores=await api('bravochore_stores','GET',null,'?active=eq.true&order=sort_order.asc')||[];
  }catch(e){stores=[];}
}

function renderShopping(){
  const container=document.getElementById('shopping-stores');
  if(!container)return;
  // If stores haven't loaded yet, fall back to grouping by the unique store
  // values found on shopping items themselves so the user still sees their
  // stuff. Once stores load we'll re-render with the proper styling.
  let displayStores=stores.length?stores:Array.from(new Set(shopping.map(s=>s.store||'Other')))
    .map((sc,i)=>({id:'fallback-'+i,short_code:sc,name:sc,icon:'📦',bg_color:'var(--surf2)',cta_label:null,sort_order:i}));
  // Group items by short_code; items whose store doesn't match a known store
  // bucket into the "Other" store if one exists, else the last store.
  const knownCodes=new Set(displayStores.map(s=>s.short_code));
  const buckets={};displayStores.forEach(s=>{buckets[s.short_code]=[];});
  const fallbackKey=displayStores.find(s=>s.short_code==='Other')?.short_code||displayStores[displayStores.length-1]?.short_code;
  shopping.forEach(i=>{
    const code=knownCodes.has(i.store)?i.store:fallbackKey;
    if(code&&buckets[code])buckets[code].push(i);
  });
  container.innerHTML=displayStores.map(s=>{
    const items=buckets[s.short_code]||[];
    const pendingCount=items.filter(i=>!i.done).length;
    const itemsHtml=items.length?items.map(i=>`<div class="cart-item">
      <div class="cart-chk ${i.done?'checked':''}" onclick="toggleShop('${i.id}')"></div>
      <div style="flex:1"><div style="${i.done?'text-decoration:line-through;color:var(--tx3)':''}">${i.name}</div><div style="font-size:11px;color:var(--tx3)">${i.note||''}</div></div>
      <button class="icon-btn" onclick="removeShop('${i.id}')" style="font-size:13px">✕</button>
    </div>`).join(''):'<p style="color:var(--tx3);font-size:13px;padding:6px 0">Nothing here yet.</p>';
    return `<div class="cart-sec">
      <div class="cart-hdr">
        <div class="cart-ttl"><div class="cart-ico" style="background:${s.bg_color||'var(--surf2)'}">${s.icon||'📦'}</div>${s.name}</div>
        <span class="sec-count">${pendingCount} item${pendingCount===1?'':'s'}</span>
      </div>
      <div>${itemsHtml}</div>
      ${s.cta_label?`<button class="shop-btn" onclick="openShopList('${s.short_code.replace(/'/g,"&#39;")}')">${s.cta_label}</button>`:''}
    </div>`;
  }).join('');
}

// ── Stores manager (Settings → Shopping → Manage stores) ─────────
function openStoresPanel(){
  const bd=document.createElement('div');
  bd.className='modal-bd open';
  bd.innerHTML=`
    <div class="modal" style="max-width:520px;width:94vw;max-height:90vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
        <div>
          <h3 style="margin:0">Shopping stores</h3>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">Edit the stores that appear in your shopping list.</div>
        </div>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div id="stores-body" style="flex:1;overflow-y:auto;padding:14px 16px"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);background:var(--surf2)">
        <button class="qa-btn" style="width:100%" onclick="addStore()">+ Add store</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
  renderStoresList();
}

function renderStoresList(){
  const body=document.getElementById('stores-body');
  if(!body)return;
  if(!stores.length){
    body.innerHTML='<div style="padding:30px 16px;text-align:center;color:var(--tx2);font-size:13px">No stores yet — tap + Add store below.</div>';
    return;
  }
  body.innerHTML=stores.map(s=>`<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--bdr);align-items:center">
    <div style="width:36px;height:36px;border-radius:8px;background:${s.bg_color||'var(--surf2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">${s.icon||'📦'}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:600">${s.name}</div>
      <div style="font-size:11px;color:var(--tx3);font-family:'DM Mono',monospace">${s.short_code}</div>
    </div>
    <button class="qa-btn" style="font-size:10px;padding:4px 8px" onclick="editStore(${s.id})">Edit</button>
    <button class="qa-btn" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red)" onclick="deleteStore(${s.id})">×</button>
  </div>`).join('');
}

async function addStore(){
  const result=await promptSheet({
    title:'Add store',
    subtitle:'A new shopping destination. The short code is what gets stored on each shopping item — keep it brief and stable.',
    confirmLabel:'Add',
    fields:[
      {name:'name',label:'Display name',required:true,placeholder:'e.g. Aldi'},
      {name:'short_code',label:'Short code',required:true,placeholder:'e.g. Aldi'},
      {name:'icon',label:'Icon (emoji)',value:'🛒'},
      {name:'bg_color',label:'Icon background (hex)',value:'#F4F3F0'},
      {name:'cta_label',label:'Button label (optional)',value:'',placeholder:'🛒 Start Shopping at Aldi'}
    ]
  });
  if(!result)return;
  const row={
    short_code:result.short_code.trim(),
    name:result.name.trim(),
    icon:result.icon||'📦',
    bg_color:result.bg_color||null,
    cta_label:result.cta_label||null,
    sort_order:stores.length+1
  };
  badge('sy','↻');
  try{
    const r=await api('bravochore_stores','POST',[row]);
    if(r&&r[0])stores.push(r[0]);
    badge('ok','✓');
    renderStoresList();
    renderShopping();
  }catch(e){badge('er','⚠');chirp('Could not add store.');}
}

async function editStore(id){
  const s=stores.find(x=>x.id===id);if(!s)return;
  const result=await promptSheet({
    title:'Edit store',
    confirmLabel:'Save',
    fields:[
      {name:'name',label:'Display name',value:s.name||'',required:true},
      {name:'short_code',label:'Short code',value:s.short_code||'',required:true},
      {name:'icon',label:'Icon (emoji)',value:s.icon||''},
      {name:'bg_color',label:'Icon background (hex)',value:s.bg_color||''},
      {name:'cta_label',label:'Button label (blank = no button)',value:s.cta_label||''}
    ]
  });
  if(!result)return;
  Object.assign(s,{
    name:result.name,
    short_code:result.short_code,
    icon:result.icon||null,
    bg_color:result.bg_color||null,
    cta_label:result.cta_label||null
  });
  badge('sy','↻');
  try{
    await api('bravochore_stores','PATCH',{
      name:s.name,short_code:s.short_code,icon:s.icon,bg_color:s.bg_color,cta_label:s.cta_label
    },`?id=eq.${id}`);
    badge('ok','✓');
    renderStoresList();
    renderShopping();
  }catch(e){badge('er','⚠');}
}

async function deleteStore(id){
  const s=stores.find(x=>x.id===id);if(!s)return;
  const ok=await confirm2('Delete '+s.name+'?','Items currently assigned to this store will fall back to "Other" or the last store in your list.','btn-ok');
  if(!ok)return;
  stores=stores.filter(x=>x.id!==id);
  try{await api('bravochore_stores','DELETE',null,`?id=eq.${id}`);chirp('Deleted.');}
  catch(e){chirp('Delete failed.');}
  renderStoresList();
  renderShopping();
}

let activeShopStore=null;
const sheetTicked=new Set(); // tracks ids ticked in current session

function openShopList(store){
  const items=shopping.filter(i=>i.store===store&&!i.done);
  if(!items.length){chirp('Nothing pending for '+store+'!');return;}
  activeShopStore=store;
  sheetTicked.clear();
  renderSheetItems(store,items);
  document.getElementById('shop-modal').classList.add('open');
}

function renderSheetItems(store,items){
  const cats=categoriseItems(items,store);
  let num=1;
  const total=items.length;
  const tickedCount=sheetTicked.size;
  let html=cats.map(({cat,items:catItems})=>`
    <div class="shop-cat-hdr">${cat}</div>
    ${catItems.map(item=>`<div class="shop-list-item ${sheetTicked.has(item.id)?'ticked':''}" id="sli-${item.id}">
      <div class="shop-list-chk ${sheetTicked.has(item.id)?'checked':''}" onclick="tickSheetItem('${item.id}')"></div>
      <span class="shop-list-num">${num++}</span>
      <div><div class="shop-list-name">${item.name}</div>${item.note?`<div class="shop-list-note">${item.note}</div>`:''}</div>
    </div>`).join('')}`).join('');
  // Add done-shopping button at bottom
  html+=`<div style="padding:16px 0 4px">
    <button onclick="finishShopping()" style="width:100%;padding:13px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-weight:700;font-size:14px;cursor:pointer">
      ✓ Done shopping${tickedCount?` — mark ${tickedCount} item${tickedCount>1?'s':''} as got`:''}
    </button>
  </div>`;
  document.getElementById('shop-sheet-title').textContent=`${store} — ${total-tickedCount} remaining`;
  document.getElementById('shop-sheet-body').innerHTML=html;
}

function tickSheetItem(id){
  const item=shopping.find(i=>i.id===id);if(!item)return;
  if(sheetTicked.has(id))sheetTicked.delete(id);
  else sheetTicked.add(id);
  // Update just this item visually without full re-render
  const row=document.getElementById('sli-'+id);
  const chk=row?.querySelector('.shop-list-chk');
  if(row)row.classList.toggle('ticked',sheetTicked.has(id));
  if(chk)chk.classList.toggle('checked',sheetTicked.has(id));
  // Update header count and button text
  const total=shopping.filter(i=>i.store===activeShopStore&&!i.done).length;
  const tickedCount=sheetTicked.size;
  document.getElementById('shop-sheet-title').textContent=`${activeShopStore} — ${total-tickedCount} remaining`;
  const doneBtn=document.querySelector('#shop-sheet-body button');
  if(doneBtn)doneBtn.textContent=`✓ Done shopping${tickedCount?` — mark ${tickedCount} item${tickedCount>1?'s':''} as got`:''}`;
}

async function finishShopping(){
  // Mark ticked items as done in shopping list, then propagate each to its
  // linked milestone (if any) so the parent task's "Buy X" step ticks too.
  for(const id of sheetTicked){
    const item=shopping.find(i=>i.id===id);
    if(item){
      item.done=true;
      try{await api('bravochore_shopping','PATCH',{done:true},`?id=eq.${id}`);}catch(e){}
      if(item.milestone_id&&typeof setMilestoneDone==='function'){
        await setMilestoneDone(item.milestone_id,true);
      }
    }
  }
  sheetTicked.clear();
  closeShopList();
  renderShopping();
}

function closeShopList(){document.getElementById('shop-modal').classList.remove('open');}
document.addEventListener('DOMContentLoaded',()=>document.getElementById('shop-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('shop-modal'))closeShopList();}));

async function toggleShop(id){
  const i=shopping.find(x=>x.id===id);if(!i)return;
  i.done=!i.done;
  renderShopping();
  try{await api('bravochore_shopping','PATCH',{done:i.done},`?id=eq.${id}`);}catch(e){}
  // Mirror to the linked milestone so the parent task's progress reflects this purchase.
  // Per BRAND.md milestones-first principle: ticking the buy step is partial progress
  // on the parent task, not full completion.
  if(i.milestone_id&&typeof setMilestoneDone==='function'){
    await setMilestoneDone(i.milestone_id,i.done);
  }
}
async function removeShop(id){shopping=shopping.filter(x=>x.id!==id);renderShopping();try{await api('bravochore_shopping','DELETE',null,`?id=eq.${id}`);}catch(e){}}
function addShopItem(){
  // Build the store dropdown dynamically from the user's configured stores.
  // Falls back to "Other" if the stores list hasn't loaded yet.
  const storeOptions=(stores&&stores.length?stores:[{short_code:'Other',name:'Other'}])
    .map(s=>`<option value="${s.short_code}">${s.name}</option>`).join('');
  const picker=document.createElement('div');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';picker.setAttribute('data-picker','1');
  picker.innerHTML=`<div style="background:var(--surf);border-radius:20px 20px 0 0;width:100%;max-width:700px;padding:20px;padding-bottom:max(20px,env(safe-area-inset-bottom))">
    <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:500;margin-bottom:16px">Add shopping item</div>
    <div class="dp-field"><label class="dp-label">Item</label><input class="dp-input" id="asi-name" placeholder="e.g. Boston ivy" style="margin-bottom:10px"></div>
    <div class="dp-field"><label class="dp-label">Store</label>
      <select class="dp-select" id="asi-store" style="margin-bottom:10px">
        ${storeOptions}
      </select>
    </div>
    <div class="dp-field"><label class="dp-label">Note (optional)</label><input class="dp-input" id="asi-note" placeholder="e.g. For courtyard fountain area" style="margin-bottom:16px"></div>
    <div style="display:flex;gap:8px">
      <button onclick="doAddShopItem()" style="flex:1;padding:13px;background:var(--green);color:#fff;border:none;border-radius:var(--rs);font-weight:700;font-size:14px;cursor:pointer">Add to list</button>
      <button onclick="this.closest('[style*=position]').remove()" style="padding:13px 16px;background:none;border:1px solid var(--bdrm);border-radius:var(--rs);font-size:13px;cursor:pointer;color:var(--tx2)">Cancel</button>
    </div>
  </div>`;
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
  setTimeout(()=>document.getElementById('asi-name')?.focus(),100);
  window._shopPicker=picker;
}
async function doAddShopItem(){
  const name=document.getElementById('asi-name')?.value.trim();
  if(!name)return;
  const store=document.getElementById('asi-store')?.value||'Other';
  const note=document.getElementById('asi-note')?.value||'';
  window._shopPicker?.remove();
  const ni={id:'si_'+Date.now(),name,store,note,done:false,sort_order:shopping.length+1};
  shopping.push(ni);renderShopping();
  try{await api('bravochore_shopping','POST',[ni]);}catch(e){}
}

// ================================================================
// SETTINGS
// ================================================================
function openSettings(){document.getElementById('settings-panel').classList.add('open');renderPeopleList();}
function closeSettings(){document.getElementById('settings-panel').classList.remove('open');}
function renderPeopleList(){
  document.getElementById('people-list').innerHTML=people.map((p,i)=>`
    <div class="person-row" id="person-row-${p.code}">
      <div class="person-av" style="background:${p.bg};color:${p.color}">${p.code}</div>
      <div class="person-info"><div class="person-name">${p.name}</div><div class="person-code">${p.code}</div></div>
      <button class="person-edit" onclick="editPerson('${p.code}')" title="Rename">✎</button>
      ${i>2?`<button class="person-del" onclick="deletePerson('${p.code}')" title="Remove">✕</button>`:'<div style="width:30px"></div>'}
    </div>`).join('');
}
function addPerson(){
  const name=document.getElementById('new-person-name').value.trim();
  const code=document.getElementById('new-person-code').value.trim().toUpperCase();
  if(!name||!code)return;
  if(people.find(p=>p.code===code)){chirp('That code is already in use.');return;}
  const colors=['#7B61FF','#E91E63','#FF6D00','#00796B','#C62828'];
  const bgs=['#EDE7FF','#FCE4EC','#FFF3E0','#E0F2F1','#FFEBEE'];
  const idx=people.length%5;
  people.push({code,name,bg:bgs[idx],color:colors[idx]});
  savePeople();renderPeopleList();renderExtraFilters();
  document.getElementById('new-person-name').value='';
  document.getElementById('new-person-code').value='';
}
async function editPerson(code){
  const p=people.find(x=>x.code===code);if(!p)return;
  const result=await promptSheet({
    title:'Edit person',
    subtitle:'Rename or change the short code (e.g. initials). Their tasks, owner tags and routines come along.',
    confirmLabel:'Save',
    fields:[
      {name:'name',label:'Display name',value:p.name,required:true},
      {name:'code',label:'Short code',value:p.code,required:true,placeholder:'e.g. BJ'}
    ]
  });
  if(!result)return;
  const newName=result.name;
  const newCode=(result.code||'').toUpperCase().trim();
  if(!newName||!newCode)return;
  // If the code is changing, make sure it doesn't clash with another person
  if(newCode!==p.code&&people.some(x=>x.code===newCode)){
    chirp('That code is already in use.');return;
  }
  const oldCode=p.code;
  p.name=newName;p.code=newCode;
  // If code changed, propagate to any task / milestone / shopping owner that
  // references the old code (token-aware so composite owners like "BW+BJ" rewrite correctly)
  if(newCode!==oldCode){
    const rewrite=ownerStr=>{
      if(!ownerStr)return ownerStr;
      return ownerStr.split(/([,+\/&\s]+)/).map(seg=>seg.trim()===oldCode?newCode:seg).join('');
    };
    tasks.forEach(t=>{if(t.owner)t.owner=rewrite(t.owner);});
    milestones.forEach(m=>{if(m.owner)m.owner=rewrite(m.owner);});
    // Persist quietly — best-effort, don't block UI on it
    badge('sy','↻');
    Promise.all([
      ...tasks.filter(t=>t.owner).map(t=>api('bravochore_tasks','PATCH',{owner:t.owner},`?id=eq.${t.id}`).catch(()=>{})),
      ...milestones.filter(m=>m.owner).map(m=>api('bravochore_milestones','PATCH',{owner:m.owner},`?id=eq.${m.id}`).catch(()=>{}))
    ]).then(()=>badge('ok','✓')).catch(()=>badge('er','⚠'));
    // If the user is renaming themselves, update CU too
    if(typeof CU==='string'&&CU===oldCode){
      CU=newCode;localStorage.setItem('bc_user',newCode);
    }
  }
  savePeople();renderPeopleList();renderExtraFilters();rerender();
  chirp('Updated.');
}
function deletePerson(code){
  people=people.filter(p=>p.code!==code);savePeople();renderPeopleList();renderExtraFilters();
}
function exportData(){
  const data={tasks,milestones,shopping,exportDate:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bravochore-export.json';a.click();
}
async function resetData(){
  const ok=await confirm2('Reset all data?','This will delete all tasks and cannot be undone.','btn-danger');
  if(!ok)return;
  try{
    await api('bravochore_tasks','DELETE',null,'?id=gt.0');
    await api('bravochore_milestones','DELETE',null,'?id=neq.never');
    await api('bravochore_shopping','DELETE',null,'?id=neq.never');
    tasks=[];milestones=[];shopping=[];rerender();closeSettings();
  }catch(e){badge('er','⚠ Reset failed');}
}
// ================================================================
// DRAG REORDER
// ================================================================
// ================================================================
// DRAG REORDER - with auto-scroll and no-revert
// ================================================================
// ================================================================
// DRAG REORDER — event delegation, survives rerenders
// ================================================================
let scrollInterval=null;
let dragPressTimer=null;
let dragStarted=false;

function dragSetOver(el,clientY){} // legacy stub — placeholder approach handles this

function dragAutoScroll(clientY){
  clearInterval(scrollInterval);
  const vh=window.innerHeight,th=110,max=20;
  if(clientY<th){
    const sp=Math.ceil(max*(1-clientY/th));
    scrollInterval=setInterval(()=>window.scrollBy(0,-sp),16);
  }else if(clientY>vh-th){
    const sp=Math.ceil(max*(1-(vh-clientY)/th));
    scrollInterval=setInterval(()=>window.scrollBy(0,sp),16);
  }
}

function dragFinish(){
  const list=document.getElementById('all-tasks-list');
  dragFinishInList(list);
}

function dragClean(){
  clearInterval(scrollInterval);
  clearTimeout(dragPressTimer);
  dragStarted=false;
  // Remove ghost
  if(dragGhost){dragGhost.remove();dragGhost=null;}
  // Remove placeholder
  if(dragPlaceholder){dragPlaceholder.remove();dragPlaceholder=null;}
  // Restore dragging card
  if(dragSrc){dragSrc.classList.remove('dragging');dragSrc.style.touchAction='';}
  // Restore list
  if(dragSrcList){
    dragSrcList.style.touchAction='';
    dragSrcList.style.overflowY='';
  }
  document.body.style.overflow='';
  document.body.style.userSelect='';
  dragSrc=null;dragOver=null;dragSrcList=null;
}

// Wire drag on any list container — call with list element
function initDragList(list){
  if(!list||list.dataset.dragInit)return;
  list.dataset.dragInit='1';

  // Mark all non-done cards as draggable (for desktop)
  const markDraggable=()=>list.querySelectorAll('.task-card:not(.done)').forEach(c=>{
    c.setAttribute('draggable','true');
    c.style.touchAction='pan-y'; // allow scroll, JS takes over on hold
  });
  new MutationObserver(markDraggable).observe(list,{childList:true,subtree:true});
  markDraggable();

  // ── TOUCH IMPLEMENTATION ──────────────────────────────────────────
  // Strategy: 500ms hold activates drag. Card becomes a ghost that follows
  // finger. A placeholder shows where card will land. On touchend, card
  // moves to placeholder position.
  // This is the ONLY approach that works reliably on Android Chrome.
  // ─────────────────────────────────────────────────────────────────

  list.addEventListener('touchstart',e=>{
    const card=e.target.closest('.task-card:not(.done)');
    if(!card)return;
    if(e.touches.length>1)return; // ignore multi-touch
    const touch=e.touches[0];
    const startX=touch.clientX;
    const startY=touch.clientY;
    dragStarted=false;

    // Cancel if moved more than 8px before hold completes
    function cancelOnScroll(ev){
      const t=ev.touches[0];
      if(Math.abs(t.clientX-startX)>8||Math.abs(t.clientY-startY)>8){
        clearTimeout(dragPressTimer);
        list.removeEventListener('touchmove',cancelOnScroll);
      }
    }
    list.addEventListener('touchmove',cancelOnScroll,{passive:true});

    dragPressTimer=setTimeout(()=>{
      list.removeEventListener('touchmove',cancelOnScroll);
      dragStarted=true;
      dragSrc=card;
      dragSrcList=list;

      // Vibrate to confirm
      navigator.vibrate&&navigator.vibrate([15,8,15]);

      // Measure card before hiding it
      const rect=card.getBoundingClientRect();
      dragOffsetX=touch.clientX-rect.left;
      dragOffsetY=touch.clientY-rect.top;

      // Create placeholder with same height as card
      dragPlaceholder=document.createElement('div');
      dragPlaceholder.className='drag-placeholder';
      dragPlaceholder.style.height=rect.height+'px';
      card.parentNode.insertBefore(dragPlaceholder,card.nextSibling);

      // Create ghost — clone of card that follows finger
      dragGhost=card.cloneNode(true);
      dragGhost.id='drag-ghost';
      dragGhost.style.width=rect.width+'px';
      dragGhost.style.height=rect.height+'px';
      dragGhost.style.top=(touch.clientY-dragOffsetY)+'px';
      dragGhost.style.left=(touch.clientX-dragOffsetX)+'px';
      document.body.appendChild(dragGhost);

      // Fade original
      card.classList.add('dragging');
      card.style.touchAction='none';

      // Lock body scroll
      document.body.style.overflow='hidden';
      document.body.style.userSelect='none';
    },500);
  },{passive:false});

  list.addEventListener('touchmove',e=>{
    if(!dragStarted)return;
    e.preventDefault(); // must prevent scroll while dragging
    const touch=e.touches[0];

    // Move ghost with finger
    if(dragGhost){
      dragGhost.style.top=(touch.clientY-dragOffsetY)+'px';
      dragGhost.style.left=(touch.clientX-dragOffsetX)+'px';
    }

    // Find which card the finger is over (hide ghost temporarily so elementFromPoint works)
    if(dragGhost)dragGhost.style.display='none';
    const elUnder=document.elementFromPoint(touch.clientX,touch.clientY);
    if(dragGhost)dragGhost.style.display='';

    if(!elUnder)return;
    const targetCard=elUnder.closest('.task-card');
    if(!targetCard||targetCard===dragSrc||targetCard===dragGhost)return;
    if(!list.contains(targetCard))return;

    // Move placeholder above or below target
    const r=targetCard.getBoundingClientRect();
    const isAbove=touch.clientY<r.top+r.height/2;
    if(isAbove){
      targetCard.parentNode.insertBefore(dragPlaceholder,targetCard);
    }else{
      targetCard.parentNode.insertBefore(dragPlaceholder,targetCard.nextSibling);
    }
  },{passive:false});

  list.addEventListener('touchend',()=>{
    clearTimeout(dragPressTimer);
    if(dragStarted){
      dragFinishInList(list);
    }else{
      dragClean();
    }
  });
  list.addEventListener('touchcancel',()=>{clearTimeout(dragPressTimer);dragClean();});

  // ── DESKTOP DRAG IMPLEMENTATION ──────────────────────────────────
  list.addEventListener('dragstart',e=>{
    const card=e.target.closest('.task-card:not(.done)');
    if(!card){e.preventDefault();return;}
    dragSrc=card;dragSrcList=list;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',card.dataset.id||card.dataset.sid||'');
    // Create placeholder for desktop too
    const rect=card.getBoundingClientRect();
    dragPlaceholder=document.createElement('div');
    dragPlaceholder.className='drag-placeholder';
    dragPlaceholder.style.height=rect.height+'px';
    card.parentNode.insertBefore(dragPlaceholder,card.nextSibling);
  });
  list.addEventListener('dragend',()=>{
    clearInterval(scrollInterval);
    dragFinishInList(list);
  });
  list.addEventListener('dragover',e=>{
    e.preventDefault();e.dataTransfer.dropEffect='move';
    const card=e.target.closest('.task-card');
    if(!card||card===dragSrc)return;
    if(!list.contains(card))return;
    const r=card.getBoundingClientRect();
    if(e.clientY<r.top+r.height/2){
      card.parentNode.insertBefore(dragPlaceholder,card);
    }else{
      card.parentNode.insertBefore(dragPlaceholder,card.nextSibling);
    }
  });
  list.addEventListener('drop',e=>{e.preventDefault();});
}

let dragSrcList=null;

function dragFinishInList(list){
  clearInterval(scrollInterval);
  if(!dragSrc||!dragPlaceholder){dragClean();return;}
  const src=dragSrc;
  // Insert card where placeholder is, then remove placeholder
  if(dragPlaceholder.parentNode){
    dragPlaceholder.parentNode.insertBefore(src,dragPlaceholder);
  }
  dragClean();
  // Save sort order
  const isShelved=list&&list.id==='shelved-list';
  const selector=isShelved?'.task-card[data-sid]':'.task-card[data-id]';
  const newOrder=Array.from((list||document.getElementById('all-tasks-list')).querySelectorAll(selector))
    .map(c=>parseInt(isShelved?c.dataset.sid:c.dataset.id)).filter(n=>!isNaN(n));
  if(isShelved){
    newOrder.forEach((id,i)=>{const t=tasks.find(x=>x.id===id);if(t)t.sort_order=i+1;});
    refreshShelvedView();
    newOrder.forEach((id,i)=>api('bravochore_tasks','PATCH',{sort_order:i+1},`?id=eq.${id}`).catch(()=>{}));
  }else{
    newOrder.forEach((id,i)=>{const t=tasks.find(x=>x.id===id);if(t)t.sort_order=i+1;});
    tasks.sort((a,b)=>(a.sort_order||999)-(b.sort_order||999));
    newOrder.forEach((id,i)=>api('bravochore_tasks','PATCH',{sort_order:i+1},`?id=eq.${id}`).catch(()=>{}));
  }
}

// Wire ONCE on document — survives any rerender
function initDrag(){
  const list=document.getElementById('all-tasks-list');
  if(!list||list.dataset.dragInit)return;
  initDragList(list);

}

// ================================================================
// CHIRP
// ================================================================
function chirp(msg){
  const ex=document.querySelector('.chirp');if(ex)ex.remove();
  const d=document.createElement('div');d.className='chirp';d.textContent=msg;d.onclick=()=>d.remove();
  document.getElementById('chirp-container').appendChild(d);
  setTimeout(()=>{if(d.parentNode)d.remove();},5000);
}

// ================================================================
// THINKING BUTTON — universal loading/feedback pattern
// ================================================================
// Wrap an async operation with visible button state changes so the user
// always knows the app received their tap and is doing something.
//
// Usage:
//   await thinkingButton(btnEl, 'Saving…', async () => {
//     await api(...);
//     // optional: return 'Saved' to flash a custom success message
//   }, { errorText: 'Could not save' });
//
// If `btnEl` is null/undefined the work still runs — useful for chaining
// from non-button triggers (touchstart on a card, etc.).
async function thinkingButton(btn, loadingText, fn, opts){
  opts=opts||{};
  const orig=btn?btn.innerHTML:null;
  const origDisabled=btn?btn.disabled:false;
  if(btn){
    btn.disabled=true;
    btn.dataset.thinking='1';
    btn.innerHTML=`<span style="display:inline-flex;align-items:center;gap:6px"><span class="tb-spinner" aria-hidden="true"></span>${loadingText||'Working…'}</span>`;
    btn.style.opacity='0.85';
  }
  try{
    const result=await fn();
    if(btn){
      const successText=typeof result==='string'?result:(opts.successText||'✓ Done');
      btn.innerHTML=successText;
      btn.style.background=btn.style.background||'';
      // Restore after a beat so the user gets visual confirmation
      setTimeout(()=>{
        if(btn&&btn.dataset.thinking==='1'){
          btn.innerHTML=orig;
          btn.disabled=origDisabled;
          btn.style.opacity='';
          delete btn.dataset.thinking;
        }
      },900);
    }
    return result;
  }catch(e){
    console.error('thinkingButton failed:',e);
    const errMsg=opts.errorText||(e&&e.message?'⚠ '+e.message.slice(0,60):'⚠ Failed');
    if(btn){
      btn.innerHTML=errMsg;
      btn.style.opacity='';
      // Restore after a longer beat so error is readable
      setTimeout(()=>{
        if(btn){
          btn.innerHTML=orig;
          btn.disabled=origDisabled;
          delete btn.dataset.thinking;
        }
      },2400);
    }
    if(typeof chirp==='function')chirp(opts.errorText||"Something didn't save — check connection.");
    throw e;
  }
}

// ================================================================
// MODAL
// ================================================================
function confirm2(title,body,btnCls='btn-ok'){
  return new Promise((res,rej)=>{
    cmResolve=res;cmReject=rej;
    document.getElementById('cm-title').textContent=title;
    document.getElementById('cm-body').textContent=body;
    document.getElementById('cm-ok').className=btnCls;
    openModal('confirm-modal');
  });
}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('.modal-bd').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');})));

// promptSheet — styled replacement for native prompt(). Returns a Promise that
// resolves to an object {fieldName: value, ...} on confirm, or null on cancel.
// Use anywhere a single prompt() or chain of prompts() is needed.
//
// Field types: 'text' (default), 'textarea', 'number', 'select', 'date'.
// See BRAND.md "Sheets vs modals" — this is a slide-up sheet.
function promptSheet({title,subtitle,fields,confirmLabel='OK',cancelLabel='Cancel'}){
  return new Promise(resolve=>{
    const picker=document.createElement('div');
    picker.setAttribute('data-picker','1');
    picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:920;display:flex;align-items:flex-end;justify-content:center';
    const inputId=n=>'psheet-'+n;
    const escapeAttr=s=>String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const escapeText=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const fieldHtml=(fields||[]).map(f=>{
      const id=inputId(f.name);
      const label=`<label class="dp-label" for="${id}">${escapeText(f.label||f.name)}${f.required?' <span style="color:var(--red)">*</span>':''}</label>`;
      let input;
      if(f.type==='textarea'){
        input=`<textarea class="dp-textarea" id="${id}" placeholder="${escapeAttr(f.placeholder||'')}" style="min-height:64px">${escapeText(f.value||'')}</textarea>`;
      }else if(f.type==='select'&&Array.isArray(f.options)){
        const opts=f.options.map(o=>`<option value="${escapeAttr(o.value)}" ${String(f.value)===String(o.value)?'selected':''}>${escapeText(o.label)}</option>`).join('');
        input=`<select class="dp-select" id="${id}">${opts}</select>`;
      }else if(f.type==='number'){
        input=`<input class="dp-input" id="${id}" type="number" step="${escapeAttr(f.step||'1')}" ${f.min!=null?`min="${escapeAttr(f.min)}"`:''} ${f.max!=null?`max="${escapeAttr(f.max)}"`:''} value="${escapeAttr(f.value??'')}">`;
      }else if(f.type==='date'){
        input=`<input class="dp-input" id="${id}" type="date" value="${escapeAttr(f.value||'')}">`;
      }else{
        input=`<input class="dp-input" id="${id}" type="text" placeholder="${escapeAttr(f.placeholder||'')}" value="${escapeAttr(f.value||'')}">`;
      }
      return `<div class="dp-field">${label}${input}</div>`;
    }).join('');
    picker.innerHTML=`<div role="dialog" aria-modal="true" style="background:var(--surf);border-radius:20px 20px 0 0;width:100%;max-width:560px;padding:18px;padding-bottom:max(16px,env(safe-area-inset-bottom));max-height:90dvh;overflow-y:auto">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500;margin-bottom:${subtitle?'4px':'14px'}">${escapeText(title||'')}</div>
      ${subtitle?`<div style="font-size:12px;color:var(--tx2);margin-bottom:14px;line-height:1.5">${escapeText(subtitle)}</div>`:''}
      ${fieldHtml}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn-cancel" style="flex:1" id="psheet-cancel">${escapeText(cancelLabel)}</button>
        <button class="btn-ok" style="flex:1" id="psheet-confirm">${escapeText(confirmLabel)}</button>
      </div>
    </div>`;
    const finish=result=>{picker.remove();resolve(result);};
    picker.addEventListener('click',e=>{if(e.target===picker)finish(null);});
    document.body.appendChild(picker);
    picker.querySelector('#psheet-cancel').onclick=()=>finish(null);
    picker.querySelector('#psheet-confirm').onclick=()=>{
      const result={};
      for(const f of (fields||[])){
        const inp=picker.querySelector('#'+inputId(f.name));
        const raw=inp?(inp.value||'').trim():'';
        if(f.required&&!raw){
          if(inp){inp.focus();inp.style.borderColor='var(--red)';}
          return;
        }
        result[f.name]=f.type==='number'?(raw===''?null:(parseFloat(raw)||0)):raw;
      }
      finish(result);
    };
    setTimeout(()=>{
      const first=picker.querySelector('#'+inputId((fields||[])[0]?.name));
      if(first){first.focus();if(first.tagName==='INPUT'&&first.type==='text')first.select();}
    },60);
  });
}

// ================================================================
// PDF / PRINT
// ================================================================
function generatePDF(){
  // Show in-app person picker
  const picker=document.createElement('div');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';picker.setAttribute('data-picker','1');
  const sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surf);border-radius:20px 20px 0 0;width:100%;max-width:700px;padding:20px;padding-bottom:max(20px,env(safe-area-inset-bottom))';
  const allPeople=[...people,{code:'All',name:'Everyone',bg:'#F4F3F0',color:'#5a5a56'}];
  sheet.innerHTML='<div style="font-family:Playfair Display,serif;font-size:18px;font-weight:500;margin-bottom:16px">Generate task sheet for:</div>'+
    allPeople.map(p=>`<button onclick="pdfPickPerson('${p.code}','${p.name}')" style="display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--rs);font-family:DM Sans,sans-serif;font-size:14px;font-weight:600;cursor:pointer;color:var(--tx)">${p.name}</button>`).join('')+
    '<button onclick="this.closest('+ JSON.stringify("[style*=position:fixed]") +').remove()" style="display:block;width:100%;padding:12px;margin-top:4px;background:none;border:1px solid var(--bdrm);border-radius:var(--rs);font-family:DM Sans,sans-serif;font-size:13px;cursor:pointer;color:var(--tx2)">Cancel</button>';
  picker.appendChild(sheet);
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
  window._pdfPicker=picker;
}

function pdfPickPerson(code,name){
  document.body.removeChild(window._pdfPicker||document.querySelector('[style*="position:fixed"][style*="z-index:900"]'));
  let filtered=tasks.filter(t=>!t.done);
  if(code!=='All')filtered=filtered.filter(t=>t.owner.includes(code)||getMs(t.id).some(m=>m.owner===code));
  doPrint(filtered,name,code);
}
function generatePDFForTask(){
  const task=tasks.find(t=>t.id===dpTaskId);if(!task)return;
  doPrint([task],getOwner(task.owner).name);
}
function doPrint(filtered,ownerLabel,code){
  code=code||'All';
  const pv=document.getElementById('print-view');
  if(!pv)return;
  const date=new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  let html=`<div class="pv-hdr"><h1>BravoChore — Task Sheet</h1><p>For: ${ownerLabel} · ${date}</p></div>`;
  filtered.forEach(task=>{
    const allMs=getMs(task.id);
    const photos=task.photo_urls||[];
    const taskOwned=code==='All'||task.owner.includes(code);
    const msToShow=taskOwned?allMs:allMs.filter(m=>m.owner===code);
    if(!taskOwned&&!msToShow.length)return;
    const contextNote=!taskOwned?`<div class="pv-notes" style="background:var(--al);border-left:3px solid var(--amber);padding:6px 10px"><strong>Context:</strong> Part of "${task.title}" (${getOwner(task.owner).name}'s task)</div>`:'';
    html+=`<div class="pv-task">
      <h3>${taskOwned?task.title:msToShow[0]?.title||task.title}</h3>
      <div class="pv-meta">${taskOwned?'Owner: '+getOwner(task.owner).name+' · ':''}Due: ${fmtDate(task.due)} · Est: ${fmtHours(getEffectiveTime(task))} · ${task.bucket}</div>
      ${task.notes&&taskOwned?`<div class="pv-notes">${task.notes}</div>`:''}
      ${contextNote}
      ${photos.length&&taskOwned?`<div class="pv-photos">${photos.map(u=>`<img src="${u}" onerror="this.style.display='none'">`).join('')}</div>`:''}
      ${msToShow.length?`<div class="pv-ms"><div class="pv-ms-ttl">Steps</div>${msToShow.map(m=>`<div class="pv-ms-item"><div class="pv-ms-box ${m.done?'done':''}"></div><span>${m.title}</span>${m.time_hours?`<span style="color:#666;margin-left:auto">${fmtHours(parseFloat(m.time_hours))}</span>`:''}</div>`).join('')}</div>`:''}
    </div>`;
  });
  pv.innerHTML=html;
  window.print();
}

// ================================================================
// RERENDER
// ================================================================
function rerender(){
  const v=document.querySelector('.view.active')?.id;
  if(v==='view-dashboard')renderDashboard();
  else if(v==='view-tasks')renderTasksView();
  else if(v==='view-shopping')renderShopping();
  else if(v==='view-events')renderEvents();
  else if(v==='view-shelved')renderShelved();
  else if(v==='view-schedule')renderSchedToday();
  // Always refresh dashboard event strip if events changed
  if(v!=='view-dashboard'&&document.getElementById('dash-events-strip'))renderDashboard();
}


// ================================================================
// WHISPER VOICE INPUT
// ================================================================
const WHISPER_PROXY='https://xgmnyhpzuwngdngtttux.supabase.co/functions/v1/whisper-proxy';
let mediaRecorder=null, audioChunks=[], micActive=false;
// Default target = master Blackbird. Per-task chat overrides via toggleMic('tc-input','tc-mic').
// recBarId is optional — pass null to skip the recording-bar UI (the per-task chat doesn't have one).
let micCtx={inputId:'bb-input',buttonId:'bb-mic',recBarId:'bb-rec-bar',isMaster:true};
const MIC_SVG_LISTENING='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
const MIC_SVG_IDLE='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

async function toggleMic(inputId,buttonId,recBarId){
  // If the mic is already running, just stop — ignore any new context, finish the current capture
  if(micActive){stopMic();return;}
  if(inputId){
    micCtx={inputId,buttonId:buttonId||'bb-mic',recBarId:recBarId||null,isMaster:false};
  }else{
    micCtx={inputId:'bb-input',buttonId:'bb-mic',recBarId:'bb-rec-bar',isMaster:true};
  }
  await startMic();
}

async function startMic(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mimeType=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
    mediaRecorder=new MediaRecorder(stream, mimeType?{mimeType}:{});
    audioChunks=[];
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);};
    mediaRecorder.onstop=async()=>{
      stream.getTracks().forEach(t=>t.stop());
      await transcribeAudio();
    };
    mediaRecorder.start(250);
    micActive=true;
    const micBtn=document.getElementById(micCtx.buttonId);
    if(micBtn){micBtn.classList.add('listening');micBtn.innerHTML=MIC_SVG_LISTENING;}
    if(micCtx.recBarId){const rb=document.getElementById(micCtx.recBarId);if(rb)rb.classList.add('visible');}
  }catch(e){
    const note=e.name==='NotAllowedError'
      ? 'Microphone access denied. Please allow microphone in your browser settings.'
      : "Couldn't start microphone: "+e.message;
    if(micCtx.isMaster){bbMsg(note,'from-bb');}
    else{
      // Per-task chat: deliver the error inside the chat thread
      if(typeof tcMsg==='function')tcMsg('assistant',note,false);
      else if(typeof chirp==='function')chirp(note);
    }
  }
}

function stopMic(){
  if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
  micActive=false;
  const micBtn=document.getElementById(micCtx.buttonId);
  if(micBtn){micBtn.classList.remove('listening');micBtn.innerHTML=MIC_SVG_IDLE;}
  if(micCtx.recBarId){const rb=document.getElementById(micCtx.recBarId);if(rb)rb.classList.remove('visible');}
}

async function transcribeAudio(){
  if(!audioChunks.length)return;
  const mimeType=mediaRecorder?.mimeType||'audio/webm';
  const ext=mimeType.includes('mp4')?'mp4':mimeType.includes('ogg')?'ogg':'webm';
  const blob=new Blob(audioChunks,{type:mimeType});
  audioChunks=[];

  // Show busy state on whichever mic is active
  const micBtn=document.getElementById(micCtx.buttonId);
  if(micBtn){micBtn.style.opacity='.4';micBtn.disabled=true;}
  if(micCtx.isMaster&&typeof bbSetState==='function')bbSetState('thinking');

  try{
    const form=new FormData();
    form.append('file',blob,'audio.'+ext);
    const res=await fetch(WHISPER_PROXY,{
      method:'POST',
      headers:{'apikey':SK},
      body:form
    });
    const data=await res.json();
    if(data.text){
      const inp=document.getElementById(micCtx.inputId);
      if(inp){
        inp.value=(inp.value?inp.value+' ':'')+data.text.trim();
        inp.focus();
        // Trigger any input listeners (e.g., textarea autosize)
        inp.dispatchEvent(new Event('input',{bubbles:true}));
        inp.style.background='var(--gl)';
        setTimeout(()=>{inp.style.background='';},400);
      }
    }else{
      const note="Couldn't catch that. Try again or type it.";
      if(micCtx.isMaster){bbMsg(note,'from-bb');}
      else if(typeof tcMsg==='function'){tcMsg('assistant',note,false);}
    }
  }catch(e){
    const note='Transcription failed — check your OpenAI API key in Supabase secrets.';
    if(micCtx.isMaster){bbMsg(note,'from-bb');}
    else if(typeof tcMsg==='function'){tcMsg('assistant',note,false);}
  }finally{
    const micBtn2=document.getElementById(micCtx.buttonId);
    if(micBtn2){micBtn2.innerHTML=MIC_SVG_IDLE;micBtn2.style.opacity='';micBtn2.disabled=false;}
    if(micCtx.isMaster&&typeof bbSetState==='function')bbSetState('idle');
  }
}


// ================================================================
// LOTTIE BLACKBIRD
// ================================================================
let bbLottieFab=null,bbLottieHeader=null;

function initLottie(){
  const animData=BLACKBIRD_ANIM;
  const fabEl=document.getElementById('bb-lottie-fab');
  const hdrEl=document.getElementById('bb-lottie-header');
  if(fabEl&&typeof lottie!=='undefined'&&!bbLottieFab){
    bbLottieFab=lottie.loadAnimation({container:fabEl,renderer:'svg',loop:false,autoplay:false,animationData:animData});
    bbLottieFab.addEventListener('DOMLoaded',()=>bbLottieFab.goToAndStop(8,true));
  }
  if(hdrEl&&typeof lottie!=='undefined'&&!bbLottieHeader){
    bbLottieHeader=lottie.loadAnimation({container:hdrEl,renderer:'svg',loop:false,autoplay:false,animationData:animData});
    bbLottieHeader.addEventListener('DOMLoaded',()=>bbLottieHeader.goToAndStop(8,true));
  }
  
}

function initTaskBirds(){
  if(typeof lottie==='undefined')return;
  // Use requestIdleCallback to avoid blocking render
  const init=()=>{
    document.querySelectorAll('.bb-task-lottie:not([data-init])').forEach(el=>{
      el.setAttribute('data-init','1');
      const anim=lottie.loadAnimation({
        container:el,renderer:'canvas',loop:false,autoplay:false,
        animationData:BLACKBIRD_ANIM
      });
      anim.addEventListener('DOMLoaded',()=>anim.goToAndStop(8,true));
    });
  };
  if('requestIdleCallback' in window)requestIdleCallback(init,{timeout:500});
  else setTimeout(init,100);
}

let bbLottieFlyer=null;
let bbFlyerActive=false;

function initFlyer(){
  if(bbLottieFlyer||typeof lottie==='undefined')return;
  const el=document.getElementById('bb-lottie-flyer');
  if(!el)return;
  bbLottieFlyer=lottie.loadAnimation({
    container:el,renderer:'svg',loop:true,autoplay:false,
    animationData:BLACKBIRD_ANIM
  });
}

function bbFlyDown(){return;// disabled

  // Get header bird position
  const hdrEl=document.getElementById('bb-lottie-header');
  const flyer=document.getElementById('bb-flyer');
  const msgs=document.getElementById('bb-msgs');
  if(!flyer||!msgs||!hdrEl)return;
  initFlyer();

  // Source: header bird position
  const hRect=hdrEl.getBoundingClientRect();
  const startTop=hRect.top;
  const startLeft=hRect.left;

  // Destination: bottom of message list
  const mRect=msgs.getBoundingClientRect();
  const endTop=mRect.bottom-44;
  const endLeft=mRect.left+8;

  // Place at start, no transition
  flyer.style.cssText=`position:fixed;z-index:9999;pointer-events:none;width:36px;height:36px;top:${startTop}px;left:${startLeft}px;display:block;opacity:1`;

  // Start playing fast
  if(bbLottieFlyer){bbLottieFlyer.setSpeed(3);bbLottieFlyer.play();}

  // Fly down with transition
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      flyer.style.transition='top .5s cubic-bezier(.4,0,.2,1), left .5s cubic-bezier(.4,0,.2,1)';
      flyer.style.top=endTop+'px';
      flyer.style.left=endLeft+'px';
    });
  });

  bbFlyerActive=true;
  // Fade header bird slightly while thinking
  if(hdrEl)hdrEl.style.opacity='0.3';
}

function bbFlyBack(){return;// disabled

  const hdrEl=document.getElementById('bb-lottie-header');
  const flyer=document.getElementById('bb-flyer');
  if(!flyer||!bbFlyerActive)return;

  const hRect=hdrEl?hdrEl.getBoundingClientRect():null;
  if(hRect){
    flyer.style.transition='top .4s cubic-bezier(.4,0,.2,1), left .4s cubic-bezier(.4,0,.2,1), opacity .3s';
    flyer.style.top=hRect.top+'px';
    flyer.style.left=hRect.left+'px';
    flyer.style.opacity='0';
  }
  setTimeout(()=>{
    flyer.style.display='none';
    if(bbLottieFlyer){bbLottieFlyer.stop();}
    if(hdrEl){hdrEl.style.opacity='1';bbLottieHeader&&bbLottieHeader.goToAndStop(8,true);}
    bbFlyerActive=false;
  },420);
}

function bbSetState(state){
  if(state==='thinking'){
    // Play header bird at normal speed when thinking
    if(bbLottieHeader){bbLottieHeader.setSpeed(1);bbLottieHeader.loop=true;bbLottieHeader.play();}
    if(bbLottieFab)bbLottieFab.play();
  }else{
    // Return to static perch
    if(bbLottieHeader){bbLottieHeader.setSpeed(1);bbLottieHeader.loop=false;
      setTimeout(()=>bbLottieHeader&&bbLottieHeader.goToAndStop(8,true),state==='success'?600:0);}
    if(bbLottieFab){bbLottieHeader&&bbLottieFab.goToAndStop(8,true);}
  }
}



// ================================================================
