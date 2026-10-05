// ================================================================
// MEMORIES (v2 brief, Phase 1)
// Family hit list of finishable experiences. Own tables:
//   bravochore_memories (kind='experience' here; goals arrive in Phase 1b)
//   bravochore_memory_done      one row per visit (repeat ticks = more rows)
//   bravochore_memory_ratings   per person per visit, 1-10 or absent
//   bravochore_memory_comments  general notes per item, any time
// Rows render through the shared taskCard() lite variant.
// Label comes from MEM_LABEL (state.js); internal names stay memory_*.
// ================================================================
let memItems=[], memIdeas=[], memGoals=[], memDone=[], memPhotos=[], memView='todo', memArea='', memLoaded=false;
// Display names for trip groups (the list is already ordered home-outwards).
const MEM_AREAS={'perth-hills':'Perth Hills','south-hills':'South Hills','swan-valley-whiteman':'Swan Valley & Whiteman',
  'perth-city':'Perth city','fremantle':'Fremantle','north-coast':'North coast','rockingham-south':'Rockingham',
  'mandurah-peel':'Mandurah & Peel','activities-perth':'Activities around Perth','water':'On the water',
  'make-and-investigate':'Make & investigate','north-day-trips':'Day trips north','avon-wheatbelt':'Avon & Wheatbelt',
  'south-west':'South West','southern-forests':'Southern forests','south-coast':'South coast','goldfields':'Goldfields',
  'mid-west-coral-coast':'Mid West & Coral Coast','pilbara':'Pilbara','broome':'Broome','kimberley':'Kimberley','interstate':'Interstate'};

const memEsc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const memFmtY=s=>s?new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):'';
const memDaysTo=s=>Math.round((new Date(s+'T00:00:00')-new Date(tdStr()+'T00:00:00'))/86400000);
// Default party for a visit: the household minus extended members.
const memDefaultWho=()=>people.filter(p=>p.code!=='Pete').map(p=>p.code);

async function loadMemories(){
  const [items,done]=await Promise.all([
    api('bravochore_memories','GET',null,'?kind=eq.experience&removed_at=is.null&order=sort_order.asc'),
    api('bravochore_memory_done','GET',null,'?select=id,memory_id,visit_number,done_on,date_approx,who,note&order=id.asc')
  ]);
  memItems=items;memDone=done;
  try{memGoals=await api('bravochore_memories','GET',null,'?kind=eq.goal&removed_at=is.null&order=sort_order.asc');}catch(_e){memGoals=[];}
  await memLoadIdeas();
  try{memPhotos=await api('bravochore_memory_photos','GET',null,'?select=id,memory_id,done_id,path,thumb_path,width,height&order=id.asc');}catch(_e){memPhotos=[];}
  await memSign(memPhotos.map(p=>p.thumb_path));
  memLoaded=true;
}
const memVisits=id=>memDone.filter(d=>d.memory_id===id);
const memIsDone=id=>memDone.some(d=>d.memory_id===id);
const memVisitedTxt=v=>'Visited '+(v.done_on?(v.date_approx?'~':'')+memFmtY(v.done_on):'(date unknown)');
// Stock card photos are public Creative Commons images served from the repo
// (img/mem/Mxxx.jpg, thumbs in img/mem/t/). Family photos are separate and
// private (Phase 3, after login).
const memThumbSrc=m=>m.stock_photo_path?m.stock_photo_path.replace('img/mem/','img/mem/t/'):null;
function memThumb(m){
  const fam=memPhotos.filter(p=>p.memory_id===m.id).pop();
  const src=(fam&&memSigned[fam.thumb_path])||memThumbSrc(m);
  return src?`<img class="mem-thumb" src="${src}" alt="" loading="lazy" decoding="async">`
            :'<div class="mem-thumb" aria-hidden="true"></div>';
}
// Search by name + place so Maps lands on the venue's own card (with
// Directions), not on a raw pin: some seed coordinates are suburb centres.
function memMapsUrl(m){
  const q=[m.name,m.where_text||'Western Australia'].join(', ');
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)
    +(m.google_place_id?'&query_place_id='+encodeURIComponent(m.google_place_id):'');
}
function memCredit(c){
  if(!c||!c.license)return '';
  const by=c.artist?memEsc(c.artist.replace(/<[^>]*>/g,'').trim())+', ':'';
  return `<div class="mem-credit">Photo: ${by}${c.url?`<a href="${memEsc(c.url)}" target="_blank" rel="noopener">${memEsc(c.license)}</a>`:memEsc(c.license)}</div>`;
}

// ---------------------------------------------------------------- family photos
// Private bucket memory-photos, files under <household>/<memory_id>/. Shown via
// short-lived signed links. Resized in the browser (long edge 1600px) and
// re-encoded, which also strips EXIF, so GPS location never leaves the phone.
const MEM_BUCKET='memory-photos', MEM_PHOTO_CAP=10;
const memSigned={};
async function memSign(paths){
  const need=[...new Set(paths)].filter(p=>p&&!memSigned[p]);
  if(!need.length)return;
  try{
    const r=await fetch(`${SB}/storage/v1/object/sign/${MEM_BUCKET}`,{method:'POST',
      headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn:60*60*12,paths:need})});
    if(!r.ok)return;
    (await r.json()).forEach(x=>{if(x.signedURL)memSigned[x.path]=SB+'/storage/v1'+x.signedURL;});
  }catch(_e){}
}
async function memDecode(file){
  try{return await createImageBitmap(file,{imageOrientation:'from-image'});}
  catch(_e){
    return await new Promise((res,rej)=>{const u=URL.createObjectURL(file),i=new Image();
      i.onload=()=>{URL.revokeObjectURL(u);res(i);};i.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('decode'));};i.src=u;});
  }
}
function memToJpeg(src,w,h,sx,sy,sw,sh,q){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(src,sx,sy,sw,sh,0,0,w,h);
  return new Promise(r=>c.toBlob(r,'image/jpeg',q));
}
async function memPrepImage(file){
  const img=await memDecode(file);
  const W=img.width,H=img.height,k=Math.min(1,1600/Math.max(W,H));
  const full=await memToJpeg(img,Math.round(W*k),Math.round(H*k),0,0,W,H,0.82);
  const side=Math.min(W,H);
  const thumb=await memToJpeg(img,300,300,(W-side)/2,(H-side)/2,side,side,0.75);
  return {full,thumb,w:Math.round(W*k),h:Math.round(H*k)};
}
async function memStoragePut(path,blob){
  const r=await fetch(`${SB}/storage/v1/object/${MEM_BUCKET}/${path}`,{method:'POST',
    headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'image/jpeg'},body:blob});
  if(!r.ok)throw new Error('upload '+r.status);
}
async function memStorageDel(paths){
  if(!paths.length)return;
  try{await fetch(`${SB}/storage/v1/object/${MEM_BUCKET}`,{method:'DELETE',
    headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})});}catch(_e){}
}
async function memUploadPhoto(memId,doneId,file){
  const hh=(typeof bcHouseholdCode!=='undefined'&&bcHouseholdCode)||'WALLIS';
  const {full,thumb,w,h}=await memPrepImage(file);
  const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2));
  const path=`${hh}/${memId}/${id}.jpg`,thumb_path=`${hh}/${memId}/${id}_t.jpg`;
  await memStoragePut(path,full);
  try{await memStoragePut(thumb_path,thumb);}catch(e){await memStorageDel([path]);throw e;}
  try{
    const [row]=await api('bravochore_memory_photos','POST',{memory_id:memId,done_id:doneId,path,thumb_path,width:w,height:h,created_by:CU||null});
    memPhotos.push(row);await memSign([thumb_path]);return row;
  }catch(e){await memStorageDel([path,thumb_path]);throw e;}
}
async function memDeletePhoto(ph){
  await api('bravochore_memory_photos','DELETE',null,`?id=eq.${ph.id}`);
  await memStorageDel([ph.path,ph.thumb_path]);
  memPhotos=memPhotos.filter(x=>x.id!==ph.id);
}
function memPhotoStrip(list,editable){
  return list.map(p=>`<button type="button" class="mem-ph" data-ph="${p.id}" aria-label="Open photo">
    <img src="${memSigned[p.thumb_path]||''}" alt="" decoding="async"></button>`).join('');
}
// Full-screen viewer. Tap the sides to move, ✕ to close, bin to delete.
async function memOpenViewer(list,startId,onChange){
  let i=Math.max(0,list.findIndex(p=>p.id===startId));
  await memSign(list.map(p=>p.path));
  const v=document.createElement('div');v.className='mem-viewer';
  const draw=()=>{const p=list[i];v.innerHTML=`<img src="${memSigned[p.path]||memSigned[p.thumb_path]||''}" alt="">
    <button class="mem-viewer-x" aria-label="Close">✕</button>
    <div class="mem-viewer-bar"><span>${i+1} / ${list.length}</span><button class="mem-viewer-del">Delete</button></div>
    ${list.length>1?'<button class="mem-viewer-prev" aria-label="Previous"></button><button class="mem-viewer-next" aria-label="Next"></button>':''}`;
    v.querySelector('.mem-viewer-x').onclick=()=>v.remove();
    const pv=v.querySelector('.mem-viewer-prev'),nx=v.querySelector('.mem-viewer-next');
    if(pv)pv.onclick=()=>{i=(i-1+list.length)%list.length;draw();};
    if(nx)nx.onclick=()=>{i=(i+1)%list.length;draw();};
    const del=v.querySelector('.mem-viewer-del');
    del.onclick=async()=>{
      if(!del.dataset.armed){del.dataset.armed='1';del.textContent='Tap again to delete';return;}
      del.textContent='Deleting…';
      try{await memDeletePhoto(list[i]);list.splice(i,1);if(onChange)onChange();
        if(!list.length){v.remove();return;}i=Math.min(i,list.length-1);draw();}
      catch(_e){del.textContent='Not deleted. Retry';delete del.dataset.armed;}
    };
  };
  draw();document.body.appendChild(v);
}

// ---------------------------------------------------------------- list
async function renderMemories(){
  document.getElementById('mem-title').textContent=MEM_LABEL;
  const el=document.getElementById('memories-list');
  if(!memLoaded){
    el.innerHTML='<div class="empty-state">Loading…</div>';
    try{await loadMemories();}
    catch(e){el.innerHTML='<div class="empty-state">Connection wobble. Tap the tab again to retry.</div>';return;}
  }
  memFillAreas();
  renderMemList();
}
function memFillAreas(){
  const sel=document.getElementById('mem-area');if(!sel||sel.dataset.filled)return;
  const groups=[...new Set(memItems.map(m=>m.trip_group).filter(Boolean))];
  sel.innerHTML='<option value="">All areas</option>'+groups.map(g=>`<option value="${g}">${memEsc(memGroupLabel(g))}</option>`).join('');
  sel.dataset.filled='1';
}
function setMemArea(v){memArea=v;renderMemList();}
function setMemView(v){
  memView=v;
  document.querySelectorAll('[data-memv]').forEach(c=>c.classList.toggle('active',c.dataset.memv===v));
  renderMemList();
}
function memUpdateCount(){
  const n=memItems.filter(m=>memIsDone(m.id)).length;
  const el=document.getElementById('mem-count');
  if(el)el.textContent=`${n} / ${memItems.length}`;
}
function renderMemList(){
  memUpdateCount();
  const el=document.getElementById('memories-list');
  const area=document.getElementById('mem-area');if(area)area.style.display=(memView==='goals'||memView==='ideas')?'none':'';
  if(memView==='goals'){el.innerHTML=memGoalsHtml();return;}
  if(memView==='ideas'){el.innerHTML=memIdeasHtml();return;}
  const list=memItems.filter(m=>(memView==='done'?memIsDone(m.id):!memIsDone(m.id))&&(!memArea||m.trip_group===memArea));
  if(!list.length){
    el.innerHTML=memView==='done'
      ?`<div class="empty-state">Nothing ticked${memArea?' in '+memEsc(memGroupLabel(memArea)):''} yet.<br>Tick one off from To do and it lands here.</div>`
      :'<div class="empty-state">All done. Add the next one with + Add.</div>';
    return;
  }
  el.innerHTML=list.map(memRow).join('');
}
function memRow(m){
  const isDone=memIsDone(m.id);
  let meta='';
  if(m.status==='unverified')meta+='<span class="mem-badge">unverified</span>';
  if(m.valid_until&&memDaysTo(m.valid_until)<=180)meta+=`<span class="mem-badge warn">ends ${memFmtY(m.valid_until)}</span>`;
  if(isDone){
    const v=memVisits(m.id),last=v[v.length-1];
    meta+=`<span class="mem-sub">${memVisitedTxt(last)}${v.length>1?' · '+v.length+' times':''}</span>`;
  }
  return taskCard(null,{lite:true,id:'mem-'+m.id,dataId:m.id,cls:'mem-card',checked:isDone,
    onTick:`memTick(${m.id},event)`,onOpen:`openMemory(${m.id})`,
    title:memEsc(m.name),meta,thumb:memThumb(m)});
}
function memCollapse(id){
  const card=document.getElementById('mem-'+id);if(!card)return;
  card.style.transition='opacity .18s ease, max-height .25s ease, margin .25s ease';
  card.style.maxHeight=card.offsetHeight+'px';card.style.overflow='hidden';
  requestAnimationFrame(()=>{card.style.opacity='0';card.style.maxHeight='0';card.style.marginBottom='0';});
  setTimeout(()=>card.remove(),280);
}

// ---------------------------------------------------------------- ideas (Discover)
// memory-discover searches the web every Thursday 7am for upcoming events and
// new places that fit the family's rules and aren't on the list. New ones show
// here, as a dot on the Memories tab, and on Home.
async function memLoadIdeas(){
  try{const r=await api('bravochore_memory_ideas','GET',null,'?status=eq.new&order=start_date.asc.nullslast,found_at.desc')||[];memIdeas=r.filter((x,k)=>r.findIndex(y=>y.id===x.id)===k);}catch(_e){memIdeas=[];}
  memIdeasBadge();
}
function memIdeasBadge(){
  const chip=document.querySelector('[data-memv="ideas"]');
  if(chip)chip.textContent=memIdeas.length?`Ideas · ${memIdeas.length}`:'Ideas';
  const tab=document.querySelector('#bn-memories .bn-icon-wrap');
  if(tab){let d=tab.querySelector('.bn-dot');if(memIdeas.length&&!d){d=document.createElement('span');d.className='bn-dot';tab.appendChild(d);}if(!memIdeas.length&&d)d.remove();}
}
function memIdeasHtml(){
  const head=`<div class="mem-ideas-hd"><span class="mem-sub">New ideas every Thursday morning</span><button class="home-link" id="mi-more" onclick="memFindIdeas(this)">Find more now ›</button></div>`;
  if(!memIdeas.length)return head+'<div class="empty-state">Nothing new right now.</div>';
  const today=tdStr(),wk=(()=>{const [y,m,d]=today.split('-').map(Number);const x=new Date(y,m-1,d+7);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;})();
  const ev=i=>i.kind!=='place'&&i.start_date;
  const groups=[['This week',i=>ev(i)&&i.start_date<=wk],['Coming up',i=>ev(i)&&i.start_date>wk],['Places to try',i=>!ev(i)]];
  const row=i=>`<div class="mem-idea" id="idea-${i.id}">
      <div class="mem-idea-ic" aria-hidden="true">${memEsc(i.icon||(i.kind==='place'?'📍':'📅'))}</div>
      <div class="mem-idea-main" ${i.url?`onclick="window.open('${memEsc(i.url)}','_blank','noopener')"`:''}>
        <div class="mem-idea-t">${memEsc(i.title)}</div>
        <div class="mem-idea-when">${[i.when_text,i.where_text].filter(Boolean).map(memEsc).join(' · ')}</div>
        ${i.why?`<div class="mem-idea-why">${memEsc(i.why)}</div>`:''}
      </div>
      <div class="mem-idea-acts">
        <button class="mem-idea-add" onclick="memIdeaAdd(${i.id},this)" aria-label="Add to list">+</button>
        <button class="mem-idea-no" onclick="memIdeaDismiss(${i.id},this)" aria-label="Not for us">✕</button>
      </div></div>`;
  return head+groups.map(([label,f])=>{const g=memIdeas.filter(f);return g.length?`<div class="cart-sec-lbl">${label}</div>${g.map(row).join('')}`:'';}).join('');
}
async function memIdeaDismiss(id,btn){
  btn.disabled=true;
  try{await api('bravochore_memory_ideas','PATCH',{status:'dismissed'},`?id=eq.${id}`);
    memIdeas=memIdeas.filter(x=>x.id!==id);memIdeasBadge();document.getElementById('idea-'+id)?.remove();
    if(!memIdeas.length)renderMemList();}catch(_e){btn.disabled=false;badge('er','⚠ Not saved');}
}
async function memIdeaAdd(id,btn){
  const i=memIdeas.find(x=>x.id===id);if(!i)return;
  btn.disabled=true;btn.textContent='…';
  const place=await memFindPlace([i.title,i.where_text].filter(Boolean).join(', '));
  const pl=memPlacement(place);
  const row=await memInsert({name:i.title,where:i.where_text||(place&&place.where)||null,group:pl.group,sort:pl.sort,place});
  if(!row){btn.disabled=false;btn.textContent='+';return;}
  const extra={notes:[i.why,i.when_text].filter(Boolean).join(' · ')||null};
  if(i.end_date||i.start_date)extra.valid_until=i.end_date||i.start_date;
  Object.assign(row,extra);api('bravochore_memories','PATCH',extra,`?id=eq.${row.id}`).catch(()=>{});
  try{await api('bravochore_memory_ideas','PATCH',{status:'added',memory_id:row.id},`?id=eq.${id}`);}catch(_e){}
  memIdeas=memIdeas.filter(x=>x.id!==id);memIdeasBadge();
  const card=document.getElementById('idea-'+id);
  if(card)card.innerHTML=`<div class="mem-idea-ic">✅</div><div class="mem-idea-main"><div class="mem-idea-t">${memEsc(i.title)}</div><div class="mem-idea-when">Added to your list${extra.valid_until?`, ends ${memFmtY(extra.valid_until)}`:''}</div></div>`;
}
async function memFindIdeas(btn){
  btn.disabled=true;btn.textContent='Searching the web… about a minute';
  try{
    const r=await fetch(`${SB}/functions/v1/memory-discover`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},body:'{}'});
    const d=await r.json();await memLoadIdeas();renderMemList();
    chirp(d.ok?`Found ${d.out?.[0]?.found??0} new idea${(d.out?.[0]?.found??0)===1?'':'s'}.`:"Couldn't search just now.");
  }catch(_e){btn.disabled=false;btn.textContent='Find more now ›';chirp("Couldn't search just now.");}
}

// ---------------------------------------------------------------- goals
// Long-term goals (kind='goal'): learn piano, French, Bronze Medallion. Not
// finishable in one outing, so no visits or scores: owners, status, dates and
// progress notes (the comments table). Ticking one means achieved.
const MEM_GOAL_STATUS={not_started:'Not started',active:'Under way',paused:'Paused',achieved:'Achieved'};
function memGoalsHtml(){
  if(!memGoals.length)return '<div class="empty-state">No goals yet. Add a long-term one with + Add.</div>';
  const order={active:0,not_started:1,paused:2,achieved:3};
  return [...memGoals].sort((a,b)=>(order[a.goal_status||'not_started']-order[b.goal_status||'not_started'])||(a.sort_order-b.sort_order)).map(g=>{
    const st=g.goal_status||'not_started';
    const own=(g.owners||[]).map(c=>ownerTag(c)).join(' ');
    const when=st==='achieved'&&g.achieved_on?` · ${memFmtY(g.achieved_on)}`:st==='active'&&g.started_on?` · since ${memFmtY(g.started_on)}`:'';
    return taskCard(null,{lite:true,id:'goal-'+g.id,dataId:g.id,cls:'mem-card'+(st==='achieved'?' done':''),checked:st==='achieved',
      onTick:`memGoalTick(${g.id},event)`,onOpen:`openGoal(${g.id})`,title:memEsc(g.name),
      meta:`${own||'<span class="mem-sub">Nobody yet</span>'} <span class="mem-sub">${MEM_GOAL_STATUS[st]}${when}</span>`});
  }).join('');
}
async function memGoalPatch(g,patch){
  Object.assign(g,patch);
  try{await api('bravochore_memories','PATCH',patch,`?id=eq.${g.id}`);badge('ok','✓');}catch(_e){badge('er','⚠ Not saved');}
  renderMemList();
}
async function memGoalTick(id,e){
  if(e)e.stopPropagation();
  const g=memGoals.find(x=>x.id===id);if(!g)return;
  if(g.goal_status==='achieved'){openGoal(id);return;}
  try{playChime('task');}catch(_e){}try{if(e&&e.target)spawnConfetti(e.target);}catch(_e){}
  await memGoalPatch(g,{goal_status:'achieved',achieved_on:tdStr()});
  chirp(`🎉 ${g.name}: achieved!`);
}
async function openGoal(id){
  const g=memGoals.find(x=>x.id===id);if(!g)return;
  document.getElementById('mem-detail')?.remove();
  let comments=[];try{comments=await api('bravochore_memory_comments','GET',null,`?memory_id=eq.${id}&order=created_at.desc`);}catch(_e){}
  const st=g.goal_status||'not_started';
  const wrap=document.createElement('div');wrap.className='mem-overlay';wrap.id='mem-detail';
  wrap.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">${memEsc(g.name)}</div><div class="mem-sheet-sub">Long-term goal</div></div>
      <button class="mem-x" onclick="document.getElementById('mem-detail').remove()" aria-label="Close">✕</button></div>
    ${g.notes?`<div class="mem-muted">${memEsc(g.notes)}</div>`:''}
    <div class="dp-label" style="margin-top:14px">Whose goal</div>
    <div class="pl-who">${people.filter(p=>p.code!=='Pete').map(p=>`<button type="button" class="pl-chip ${(g.owners||[]).includes(p.code)?'on':''}" data-own="${p.code}"><span class="task-tag" style="background:${p.bg};color:${p.color}">${memEsc(p.name)}</span></button>`).join('')}</div>
    <div class="dp-label" style="margin-top:14px">Status</div>
    <div class="pl-who">${Object.entries(MEM_GOAL_STATUS).map(([k,v])=>`<div class="filter-chip ${st===k?'active':''}" data-st="${k}">${v}</div>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <div class="dp-field" style="flex:1"><label class="dp-label" for="g-start">Started</label><input class="dp-input" type="date" id="g-start" value="${g.started_on||''}"></div>
      <div class="dp-field" style="flex:1"><label class="dp-label" for="g-done">Achieved</label><input class="dp-input" type="date" id="g-done" value="${g.achieved_on||''}"></div>
    </div>
    <div class="dp-label" style="margin-top:14px">Progress notes</div>
    <div class="mem-comment-add">
      <textarea class="dp-textarea" id="mc-body" style="min-height:44px" placeholder="e.g. passed grade 1, first full conversation"></textarea>
      <button class="qa-btn" onclick="memPostComment(${id},this)">Post</button>
    </div>
    <div id="mc-list">${comments.map(memCommentHtml).join('')||'<div class="mem-muted">No notes yet.</div>'}</div>
  </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-own]').forEach(b=>b.onclick=()=>{
    b.classList.toggle('on');
    memGoalPatch(g,{owners:[...wrap.querySelectorAll('[data-own].on')].map(x=>x.dataset.own)});});
  wrap.querySelectorAll('[data-st]').forEach(c=>c.onclick=()=>{
    wrap.querySelectorAll('[data-st]').forEach(x=>x.classList.toggle('active',x===c));
    const v=c.dataset.st,patch={goal_status:v};
    if(v==='active'&&!g.started_on){patch.started_on=tdStr();wrap.querySelector('#g-start').value=patch.started_on;}
    if(v==='achieved'&&!g.achieved_on){patch.achieved_on=tdStr();wrap.querySelector('#g-done').value=patch.achieved_on;}
    memGoalPatch(g,patch);});
  wrap.querySelector('#g-start').onchange=e=>memGoalPatch(g,{started_on:e.target.value||null});
  wrap.querySelector('#g-done').onchange=e=>memGoalPatch(g,{achieved_on:e.target.value||null});
}
async function openGoalAdd(){
  const r=await promptSheet({title:'New long-term goal',subtitle:'Something that takes months or years, like an instrument or a qualification.',
    fields:[{name:'name',label:'Goal',required:true,placeholder:'e.g. Learn to swim 1 km'},{name:'notes',label:'Notes',placeholder:'Optional'}],confirmLabel:'Add'});
  if(!r)return;
  const n=Math.max(0,...memGoals.map(g=>parseInt((g.code||'').slice(1),10)).filter(x=>!isNaN(x)))+1;
  try{
    const [row]=await api('bravochore_memories','POST',{code:'G'+String(n).padStart(3,'0'),kind:'goal',name:r.name,notes:r.notes||null,
      sort_order:(memGoals.length+1)*10,goal_status:'not_started',owners:[],origin:'added_on_the_fly',created_by:CU||null});
    memGoals.push(row);renderMemList();badge('ok','✓ Added');
  }catch(_e){badge('er','⚠ Not added');}
}

// ---------------------------------------------------------------- tick / visits
// Tick from the list: optimistic, then the visit sheet for date/who/scores.
// A done item's tick opens its history instead (repeat ticks are quiet).
async function memTick(id,e){
  if(e)e.stopPropagation();
  if(memIsDone(id)){openMemory(id);return;}
  try{playChime('task');}catch(_e){}
  try{if(e&&e.target)spawnConfetti(e.target);}catch(_e){}
  memCollapse(id);
  const row=await memAddVisit(id);
  if(row)setTimeout(()=>openVisitSheet(id,row.id,true),420);
}
async function memAddVisit(id){
  const n=memVisits(id).length+1;
  const temp={id:-Date.now(),memory_id:id,visit_number:n,done_on:tdStr(),date_approx:false,who:memDefaultWho(),note:null};
  memDone.push(temp);memUpdateCount();
  try{
    badge('sy','↻ Saving');
    const [row]=await api('bravochore_memory_done','POST',
      {memory_id:id,visit_number:n,done_on:temp.done_on,who:temp.who,created_by:CU||null});
    Object.assign(temp,row);badge('ok','✓');
    return temp;
  }catch(err){
    memDone=memDone.filter(d=>d!==temp);renderMemList();
    badge('er','⚠ Not saved');chirp('Connection wobble. That tick did not save, try again.');
    return null;
  }
}

// Visit sheet: date, who went, a score per person, optional note.
// Not ticked = absent (excluded from the average). Scores are optional.
async function openVisitSheet(memId,doneId,fresh){
  const m=memItems.find(x=>x.id===memId), v=memDone.find(d=>d.id===doneId);
  if(!m||!v)return;
  let ratings=[];
  try{ratings=await api('bravochore_memory_ratings','GET',null,`?done_id=eq.${doneId}`);}catch(_e){}
  const score=c=>(ratings.find(r=>r.person===c&&!r.absent)||{}).rating||'';
  const who=new Set(v.who&&v.who.length?v.who:memDefaultWho());

  const wrap=document.createElement('div');
  wrap.className='mem-overlay';wrap.style.zIndex='930';
  wrap.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${memEsc(m.name)}</div>
    <div class="mem-sheet-sub">${fresh?'Ticked off. ':''}Scores are optional. Anyone not ticked is absent.</div>
    <div class="dp-field"><label class="dp-label" for="mv-date">Date</label>
      <input class="dp-input" id="mv-date" type="date" value="${memEsc(v.done_on||'')}"></div>
    <label class="mem-check-line"><input type="checkbox" id="mv-approx" ${v.date_approx?'checked':''}> Date is approximate</label>
    <div class="dp-label" style="margin-top:12px">Who went, and their score</div>
    <div class="mem-people">${people.map(p=>`
      <div class="mem-person ${who.has(p.code)?'on':''}" data-code="${p.code}">
        <button type="button" class="mem-who" onclick="memToggleWho(this)" aria-pressed="${who.has(p.code)}">
          <span class="task-tag" style="background:${p.bg};color:${p.color}">${memEsc(p.name)}</span></button>
        <select class="dp-select mem-score" aria-label="${memEsc(p.name)} score" onchange="memScorePicked(this)">
          <option value="">–</option>${[10,9,8,7,6,5,4,3,2,1].map(n=>`<option value="${n}" ${score(p.code)==n?'selected':''}>${n}</option>`).join('')}
        </select>
        <span class="mem-absent">absent</span>
      </div>`).join('')}</div>
    <div class="dp-field" style="margin-top:12px"><label class="dp-label" for="mv-note">Note</label>
      <textarea class="dp-textarea" id="mv-note" style="min-height:56px" placeholder="Optional">${memEsc(v.note||'')}</textarea></div>
    <div class="dp-label" style="margin-top:12px">Photos <span class="mem-sub" style="text-transform:none;letter-spacing:0;font-weight:400">pick your best 1 to 3</span></div>
    <div class="mem-ph-row" id="mv-photos"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <label class="qa-btn mem-ph-btn">📷 Camera<input type="file" accept="image/*" capture="environment" hidden id="mv-cam"></label>
      <label class="qa-btn mem-ph-btn">🖼 Gallery<input type="file" accept="image/*" multiple hidden id="mv-gal"></label>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-cancel" style="flex:1" id="mv-cancel">${ratings.length||v.note?'Cancel':'Skip'}</button>
      <button class="btn-ok" style="flex:1" id="mv-save">Save</button>
    </div>
    <button class="mem-link danger" id="mv-remove">${fresh?'Undo tick':'Remove this visit'}</button>
  </div>`;
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  wrap.querySelector('#mv-cancel').onclick=close;
  // Photos upload straight away; Save/Skip only covers date, people, scores and note.
  const phRow=wrap.querySelector('#mv-photos');
  const visitPhotos=()=>memPhotos.filter(p=>p.done_id===doneId);
  const drawPhotos=()=>{
    phRow.innerHTML=memPhotoStrip(visitPhotos());
    phRow.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>memOpenViewer(visitPhotos(),+b.dataset.ph,()=>{drawPhotos();renderMemListIfOpen();}));
  };
  drawPhotos();
  const addFiles=async files=>{
    const room=MEM_PHOTO_CAP-visitPhotos().length;
    const list=[...files].slice(0,Math.max(0,room));
    if(files.length>list.length)chirp(`Up to ${MEM_PHOTO_CAP} photos per visit.`);
    for(const f of list){
      const ph=document.createElement('div');ph.className='mem-ph uploading';ph.textContent='…';phRow.appendChild(ph);
      try{await memUploadPhoto(memId,doneId,f);}
      catch(_e){badge('er','⚠ Photo not saved');chirp("A photo didn't upload. Try again.");}
      drawPhotos();
    }
    renderMemListIfOpen();
  };
  wrap.querySelector('#mv-cam').onchange=e=>{addFiles(e.target.files);e.target.value='';};
  wrap.querySelector('#mv-gal').onchange=e=>{addFiles(e.target.files);e.target.value='';};
  // Two-tap remove (undo-over-confirm; a modal would sit under this sheet).
  const rm=wrap.querySelector('#mv-remove');
  rm.onclick=async()=>{
    if(!fresh&&!rm.dataset.armed){rm.dataset.armed='1';rm.textContent='Tap again to remove';
      setTimeout(()=>{if(rm.isConnected){delete rm.dataset.armed;rm.textContent='Remove this visit';}},3000);return;}
    try{
      const gone=memPhotos.filter(p=>p.done_id===doneId);
      await api('bravochore_memory_done','DELETE',null,`?id=eq.${doneId}`);
      await memStorageDel(gone.flatMap(p=>[p.path,p.thumb_path]));
      memPhotos=memPhotos.filter(p=>p.done_id!==doneId);
      memDone=memDone.filter(d=>d.id!==doneId);close();renderMemList();
      if(document.getElementById('mem-detail'))openMemory(memId);
      badge('ok',fresh?'↶ Undone':'✓ Removed');
    }catch(_e){rm.textContent='Not removed. Try again';delete rm.dataset.armed;}
  };
  wrap.querySelector('#mv-save').onclick=async e=>{
    const btn=e.currentTarget;btn.disabled=true;btn.textContent='Saving…';
    const whoNow=[...wrap.querySelectorAll('.mem-person.on')].map(r=>r.dataset.code);
    const patch={done_on:wrap.querySelector('#mv-date').value||null,
      date_approx:wrap.querySelector('#mv-approx').checked,who:whoNow,
      note:wrap.querySelector('#mv-note').value.trim()||null};
    const rows=[];
    wrap.querySelectorAll('.mem-person').forEach(r=>{
      const c=r.dataset.code,val=r.querySelector('.mem-score').value;
      // Absent is recorded for the default party only; extended members just aren't listed.
      if(!r.classList.contains('on')){if(memDefaultWho().includes(c))rows.push({done_id:doneId,person:c,rating:null,absent:true});}
      else if(val)rows.push({done_id:doneId,person:c,rating:parseInt(val,10),absent:false});
    });
    try{
      await api('bravochore_memory_done','PATCH',patch,`?id=eq.${doneId}`);
      await api('bravochore_memory_ratings','DELETE',null,`?done_id=eq.${doneId}`);
      if(rows.length)await api('bravochore_memory_ratings','POST',rows);
      Object.assign(v,patch);close();renderMemList();
      // Everyone loved it (average 8+)? Make it a favourite automatically.
      const sc=rows.filter(r=>!r.absent&&r.rating);
      const m0=memItems.find(x=>x.id===memId);
      if(m0&&!m0.repeat_ok&&sc.length&&sc.reduce((a,r)=>a+r.rating,0)/sc.length>=8){
        m0.repeat_ok=true;api('bravochore_memories','PATCH',{repeat_ok:true},`?id=eq.${memId}`).catch(()=>{});
        chirp('♥ Everyone loved it, saved as a favourite.');
      }
      if(document.getElementById('mem-detail'))openMemory(memId);
      badge('ok','✓ Saved');
    }catch(_e){btn.disabled=false;btn.textContent='Not saved. Retry';badge('er','⚠ Not saved');}
  };
}
function memToggleWho(btn){
  const r=btn.closest('.mem-person');r.classList.toggle('on');
  btn.setAttribute('aria-pressed',r.classList.contains('on'));
}
function memScorePicked(sel){if(sel.value)sel.closest('.mem-person').classList.add('on');}

// Age / height limits researched from operators' own sites (memory-research).
function memAgeHtml(m){
  if(!m.age_checked&&m.min_age==null)return '';
  const lim=[m.min_age!=null?`Ages ${m.min_age}+`:'',m.min_height_cm?`${m.min_height_cm}cm min height`:''].filter(Boolean).join(' · ');
  const head=m.age_checked==='unconfirmed'?'Age limit not confirmed':lim||'Any age';
  const src=m.age_source?` <a href="${memEsc(m.age_source)}" target="_blank" rel="noopener" class="mem-src">source</a>`:'';
  return `<div class="mem-age ${m.age_checked==='unconfirmed'?'unc':''}"><b>👶 ${memEsc(head)}</b>${m.age_note?`<div>${memEsc(m.age_note)}${src}</div>`:src}</div>`;
}
// Research a new item's age/height rules in the background (web search).
async function memResearchAge(row){
  try{
    const r=await fetch(`${SB}/functions/v1/memory-research`,{method:'POST',
      headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
      body:JSON.stringify({items:[{code:row.code,name:row.name,where:row.where_text||''}]})});
    const x=((await r.json()).results||[])[0];if(!x)return;
    const age=x.min_age===0?null:x.min_age??null,h=x.min_height_cm??null;
    const patch=x.confident?{min_age:age,min_height_cm:h,age_note:(x.note||'').slice(0,160),age_source:x.source||null,age_checked:(age!=null||h)?'researched':'no_limit'}
      :{age_note:(x.note||'Check with the operator').slice(0,160),age_source:x.source||null,age_checked:'unconfirmed'};
    Object.assign(row,patch);
    await api('bravochore_memories','PATCH',patch,`?id=eq.${row.id}`);
  }catch(_e){}
}

// Favourites: things worth repeating. The planner includes them even when done.
async function memToggleFav(id,btn){
  const m=memItems.find(x=>x.id===id);if(!m)return;
  const v=!m.repeat_ok;m.repeat_ok=v;
  if(btn){btn.classList.toggle('on',v);btn.setAttribute('aria-pressed',v);btn.textContent=v?'♥ Favourite':"♡ We'd do it again";}
  try{await api('bravochore_memories','PATCH',{repeat_ok:v},`?id=eq.${id}`);}catch(e){m.repeat_ok=!v;badge('er','⚠ Not saved');}
}

// ---------------------------------------------------------------- detail
async function openMemory(id){
  const m=memItems.find(x=>x.id===id);if(!m)return;
  document.getElementById('mem-detail')?.remove();
  const visits=memVisits(id);
  const famPhotos=memPhotos.filter(p=>p.memory_id===id);
  const heroFam=famPhotos[famPhotos.length-1]||null;
  if(heroFam)await memSign([heroFam.path]);
  const doneIds=visits.map(v=>v.id).filter(x=>x>0);
  let ratings=[],comments=[];
  try{
    [ratings,comments]=await Promise.all([
      doneIds.length?api('bravochore_memory_ratings','GET',null,`?done_id=in.(${doneIds.join(',')})`):[],
      api('bravochore_memory_comments','GET',null,`?memory_id=eq.${id}&order=created_at.desc`)
    ]);
  }catch(_e){}

  const facts=[];
  if(m.drive_min)facts.push(`${m.drive_min} min drive`);
  if(m.fly_note)facts.push(memEsc(m.fly_note));
  if(m.distance_note)facts.push(memEsc(m.distance_note));
  const warns=[];
  if(m.status==='unverified')warns.push('Unverified. Facts not checked yet.');
  if(m.valid_until)warns.push(`Time-limited: ends ${memFmtY(m.valid_until)}.`);
  if(m.safety_note)warns.push(memEsc(m.safety_note));
  const flagTxt={open_ended_fails_finishable_rule:'Open-ended as written, not one finishable outing.',
    needs_scoping_before_booking:'Needs scoping before booking.'};
  (m.flags||[]).forEach(f=>warns.push(flagTxt[f]||memEsc(f)));

  const visitHtml=visits.length?visits.map((v,i)=>{
    const rs=ratings.filter(r=>r.done_id===v.id);
    const scored=rs.filter(r=>!r.absent&&r.rating!=null);
    const avg=scored.length?(scored.reduce((a,r)=>a+r.rating,0)/scored.length).toFixed(1):null;
    const per=people.map(p=>{
      const r=rs.find(x=>x.person===p.code);
      if(!r)return '';
      return `<span class="mem-per">${memEsc(p.name)} <b class="mem-num">${r.absent?'absent':r.rating}</b></span>`;
    }).join('');
    return `<div class="mem-visit" onclick="openVisitSheet(${id},${v.id})">
      <div class="mem-visit-top"><span>${memVisitedTxt(v)}</span>
        ${avg?`<span class="mem-num mem-avg">${avg}</span>`:''}</div>
      ${per?`<div class="mem-pers">${per}</div>`:''}
      ${v.note?`<div class="mem-visit-note">${memEsc(v.note)}</div>`:''}
      ${memPhotos.some(p=>p.done_id===v.id)?`<div class="mem-ph-row" data-visit="${v.id}">${memPhotoStrip(memPhotos.filter(p=>p.done_id===v.id))}</div>`:''}
      <div class="mem-visit-edit">Photos, scores, edit or remove ›</div>
    </div>`;
  }).join(''):'<div class="mem-muted">Not done yet.</div>';

  const wrap=document.createElement('div');
  wrap.className='mem-overlay';wrap.id='mem-detail';
  wrap.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr">
      <div><div class="mem-sheet-title">${memEsc(m.name)}</div>
        ${m.where_text?`<div class="mem-sheet-sub">${memEsc(m.where_text)}</div>`:''}</div>
      <button class="mem-x" onclick="document.getElementById('mem-detail').remove()" aria-label="Close">✕</button>
    </div>
    ${heroFam?`<img class="mem-hero" src="${memSigned[heroFam.path]||memSigned[heroFam.thumb_path]}" alt="${memEsc(m.name)}" decoding="async"><div class="mem-credit">Your photo</div>`
      :m.stock_photo_path?`<img class="mem-hero" src="${m.stock_photo_path}" alt="${memEsc(m.name)}" decoding="async">${memCredit(m.stock_photo_credit)}`:''}
    <div class="mem-facts">${facts.join(' · ')}<span class="task-code">${m.code}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="qa-btn mem-maps" href="${memMapsUrl(m)}" target="_blank" rel="noopener">📍 Open in Google Maps</a>
      <button class="qa-btn mem-maps mem-fav ${m.repeat_ok?'on':''}" onclick="memToggleFav(${m.id},this)" aria-pressed="${!!m.repeat_ok}">${m.repeat_ok?'♥ Favourite':'♡ We\'d do it again'}</button>
    </div>
    ${warns.length?`<div class="mem-warn">${warns.join('<br>')}</div>`:''}
    ${memAgeHtml(m)}
    ${(m.kid_facts||[]).length?`<div class="dp-label" style="margin-top:14px">For the kids</div><ul class="mem-kidfacts">${m.kid_facts.map(f=>`<li>${memEsc(f)}</li>`).join('')}</ul>`:''}
    ${m.notes||m.status_note?`<div class="mem-muted" style="margin-top:8px">${memEsc([m.notes,m.status_note].filter(Boolean).join(' '))}</div>`:''}

    <div class="dp-label" style="margin-top:16px">Visits</div>
    ${visitHtml}
    <button class="btn-ok" style="width:100%;margin-top:10px" onclick="memDoAgain(${id},this)">${visits.length?'Do it again':'Mark done'}</button>

    <div class="dp-label" style="margin-top:18px">Comments</div>
    <div class="mem-comment-add">
      <textarea class="dp-textarea" id="mc-body" style="min-height:44px" placeholder="e.g. no toilets, go when stormy"></textarea>
      <button class="qa-btn" onclick="memPostComment(${id},this)">Post</button>
    </div>
    <div id="mc-list">${comments.map(memCommentHtml).join('')||'<div class="mem-muted">No comments yet.</div>'}</div>
  </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
  // Photo thumbs inside a visit open the viewer, not the visit editor.
  wrap.querySelectorAll('[data-visit] [data-ph]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    memOpenViewer(memPhotos.filter(p=>p.memory_id===id),+b.dataset.ph,()=>{renderMemListIfOpen();openMemory(id);});
  }));
}
function memCommentHtml(c){
  return `<div class="mem-comment">${ownerTag(c.author)}<span class="mem-sub">${memFmtY((c.created_at||'').slice(0,10))}</span>
    <div class="mem-comment-body">${memEsc(c.body)}</div></div>`;
}
async function memPostComment(id,btn){
  const ta=document.getElementById('mc-body'),body=(ta.value||'').trim();
  if(!body){ta.focus();return;}
  if(!CU){chirp('Pick who you are first (top-right).');return;}
  btn.disabled=true;
  try{
    const [c]=await api('bravochore_memory_comments','POST',{memory_id:id,author:CU,body});
    const list=document.getElementById('mc-list');
    if(list.querySelector('.mem-muted'))list.innerHTML='';
    list.insertAdjacentHTML('afterbegin',memCommentHtml(c));ta.value='';badge('ok','✓');
  }catch(_e){badge('er','⚠ Not posted');btn.textContent='Retry';}
  btn.disabled=false;
}
async function memDoAgain(id,btn){
  btn.disabled=true;
  try{playChime('task');}catch(_e){}
  const row=await memAddVisit(id);
  btn.disabled=false;
  if(row){renderMemList();openMemory(id);openVisitSheet(id,row.id,true);}
}

// ---------------------------------------------------------------- add (Google suggestions)
function memGroupLabel(g){return MEM_AREAS[g]||(g?g.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase()):'');}
// As-you-type suggestions from Google Places (New). The key is browser-side by
// design: Google restricts it to bravourl.github.io and to Places only, with a
// daily cap. One session token per add groups the calls for billing.
const MEM_PLACES_KEY='AIzaSyAl3-W54GXUWATbT4qNDjP96F_oXMsd8m8';
const memNorm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function memKm(a,b,c,d){const p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return 12742*Math.asin(Math.sqrt(x));}
// New item sits right after the nearest existing item, inside its cluster.
function memPlaceNear(lat,lon){
  let best=null,bd=1e9;
  memItems.forEach(m=>{if(m.lat==null)return;const d=memKm(lat,lon,m.lat,m.lon);if(d<bd){bd=d;best=m;}});
  return best&&bd<150?best:null;
}
function memSortAfter(anchor){
  const all=[...memItems].sort((a,b)=>a.sort_order-b.sort_order);
  if(!anchor)return (all.length?Number(all[all.length-1].sort_order):0)+10;
  const next=all.find(m=>Number(m.sort_order)>Number(anchor.sort_order));
  return next?(Number(anchor.sort_order)+Number(next.sort_order))/2:Number(anchor.sort_order)+10;
}
function memSortEndOfGroup(g){
  const inG=[...memItems].filter(m=>m.trip_group===g).sort((a,b)=>a.sort_order-b.sort_order);
  return memSortAfter(inG[inG.length-1]);
}
async function memAutocomplete(input,token){
  const r=await fetch('https://places.googleapis.com/v1/places:autocomplete',{method:'POST',
    headers:{'Content-Type':'application/json','X-Goog-Api-Key':MEM_PLACES_KEY},
    body:JSON.stringify({input,sessionToken:token,includedRegionCodes:['au'],
      locationBias:{circle:{center:{latitude:MEM_HOME.lat,longitude:MEM_HOME.lon},radius:50000}}})});
  if(!r.ok)throw new Error('places '+r.status);
  return ((await r.json()).suggestions||[]).map(x=>x.placePrediction).filter(Boolean);
}
async function memPlaceDetails(id,token){
  const r=await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?sessionToken=${token}`,{
    headers:{'X-Goog-Api-Key':MEM_PLACES_KEY,'X-Goog-FieldMask':'id,displayName,formattedAddress,location,addressComponents'}});
  if(!r.ok)throw new Error('details '+r.status);
  return r.json();
}
function memDupOf(placeId,text){
  if(placeId){const m=memItems.find(x=>x.google_place_id===placeId);if(m)return m;}
  const t=memNorm(text);if(t.length<4)return null;
  return memItems.find(x=>[x.name,x.google_place_name].filter(Boolean).some(nm=>{const n=memNorm(nm);
    return n===t||(n.length>=5&&(n.includes(t)||t.includes(n)));}))||null;
}

// Shared by the Add sheet and Blackbird. place = {id,name,lat,lon,where} or null.
async function memInsert({name,where,group,sort,place}){
  let codes=[];try{codes=await api('bravochore_memories','GET',null,'?select=code&code=like.M*');}catch(_e){}
  const maxN=Math.max(0,...codes.map(c=>parseInt(c.code.slice(1),10)).filter(n=>!isNaN(n)));
  const rec={code:'M'+String(maxN+1).padStart(3,'0'),sort_order:sort,name,where_text:where||null,
    trip_group:group||null,origin:'added_on_the_fly',status:'unverified',kind:'experience',created_by:CU||null,
    lat:place?place.lat:null,lon:place?place.lon:null,
    google_place_id:place?place.id:null,google_place_name:place?place.name:null,google_place_checked:place?'manual':null};
  try{
    const [row]=await api('bravochore_memories','POST',rec);
    memItems.push(row);memItems.sort((a,b)=>a.sort_order-b.sort_order);
    badge('ok','✓ Added');memResearchAge(row);return row;
  }catch(_e){badge('er','⚠ Not added');return null;}
}
function memAfterInsert(row){
  if(!document.getElementById('view-memories')?.classList.contains('active'))return;
  if(memView!=='todo')setMemView('todo');else renderMemList();
  document.getElementById('mem-'+row.id)?.scrollIntoView({behavior:'smooth',block:'center'});
}
// Where a new item goes: next to the nearest item already on the list.
function memPlacement(place){
  const near=place&&place.lat!=null?memPlaceNear(place.lat,place.lon):null;
  return near?{group:near.trip_group,sort:memSortAfter(near),near}:{group:null,sort:memSortAfter(null),near:null};
}

async function openMemAdd(){
  const token=(crypto.randomUUID?crypto.randomUUID():String(Date.now()));
  const groups=[...new Set(memItems.map(m=>m.trip_group).filter(Boolean))];
  let picked=null, timer=null, seq=0;
  const wrap=document.createElement('div');
  wrap.className='mem-overlay';wrap.id='mem-add';
  wrap.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div class="mem-sheet-title">Add to ${memEsc(MEM_LABEL)}</div>
      <button class="mem-x" id="ma-x" aria-label="Close">✕</button></div>
    <div class="dp-field"><label class="dp-label" for="ma-q">Place or idea</label>
      <input class="dp-input" id="ma-q" autocomplete="off" placeholder="e.g. Caversham, zipline, Bennett Brook"></div>
    <div id="ma-sugg" class="mem-sugg"></div>
    <div id="ma-dup"></div>
    <div id="ma-picked" style="display:none">
      <div class="dp-field"><label class="dp-label" for="ma-name">Name</label><input class="dp-input" id="ma-name"></div>
      <div class="mem-sub" id="ma-where"></div>
    </div>
    <div class="dp-field" style="margin-top:10px"><label class="dp-label" for="ma-near">Put it near</label>
      <select class="dp-select" id="ma-near"><option value="">End of list</option>${groups.map(g=>`<option value="${g}">${memEsc(memGroupLabel(g))}</option>`).join('')}</select>
      <div class="mem-sub" id="ma-near-why"></div></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn-cancel" style="flex:1" id="ma-cancel">Cancel</button>
      <button class="btn-ok" style="flex:1" id="ma-save" disabled>Add</button>
    </div>
    <div class="mem-credit" style="margin-top:8px">Suggestions by Google</div>
  </div>`;
  document.body.appendChild(wrap);
  const $=id=>wrap.querySelector('#'+id);
  const close=()=>{clearTimeout(timer);wrap.remove();};
  wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  $('ma-x').onclick=close;$('ma-cancel').onclick=close;
  const q=$('ma-q'),sugg=$('ma-sugg'),save=$('ma-save');
  setTimeout(()=>q.focus(),50);

  function showDup(m){
    $('ma-dup').innerHTML=m?`<div class="mem-warn" style="margin-top:8px">Already on your list: <b>${memEsc(m.name)}</b>${memIsDone(m.id)?' (done)':''}.
      <button class="mem-link" style="display:inline;margin:0;min-height:0;padding:0 4px;text-decoration:underline" id="ma-open">Open it</button></div>`:'';
    if(m)$('ma-open').onclick=()=>{close();openMemory(m.id);};
  }
  function refreshSave(){save.disabled=!(picked?$('ma-name').value.trim():q.value.trim());}

  q.addEventListener('input',()=>{
    picked=null;$('ma-picked').style.display='none';$('ma-near-why').textContent='';
    const text=q.value.trim();showDup(memDupOf(null,text));refreshSave();
    clearTimeout(timer);
    if(text.length<3){sugg.innerHTML='';return;}
    timer=setTimeout(async()=>{
      const my=++seq;
      let list=[];try{list=await memAutocomplete(text,token);}catch(_e){}
      if(my!==seq)return;
      sugg.innerHTML=list.slice(0,5).map((p,i)=>{
        const sf=p.structuredFormat||{};
        return `<button type="button" class="mem-sugg-row" data-i="${i}">
          <span class="mem-sugg-main">${memEsc((sf.mainText||{}).text||(p.text||{}).text)}</span>
          <span class="mem-sugg-sec">${memEsc((sf.secondaryText||{}).text||'')}</span></button>`;
      }).join('')+(text?`<button type="button" class="mem-sugg-row typed" data-typed="1"><span class="mem-sugg-main">Add "${memEsc(text)}" as typed</span><span class="mem-sugg-sec">No place, facts checked later</span></button>`:'');
      sugg.querySelectorAll('.mem-sugg-row').forEach(b=>b.onclick=async()=>{
        if(b.dataset.typed){sugg.innerHTML='';q.blur();refreshSave();save.focus();return;}
        const p=list[+b.dataset.i];sugg.innerHTML='<div class="mem-muted">Loading…</div>';
        try{
          const d=await memPlaceDetails(p.placeId,token);
          const comp=t=>(d.addressComponents||[]).find(c=>(c.types||[]).includes(t));
          const loc=comp('locality'),st=comp('administrative_area_level_1');
          picked={id:d.id,name:(d.displayName||{}).text||q.value.trim(),lat:d.location?.latitude,lon:d.location?.longitude,
            where:[loc&&loc.longText,st&&st.shortText].filter(Boolean).join(', ')||d.formattedAddress||''};
          sugg.innerHTML='';$('ma-picked').style.display='';
          $('ma-name').value=picked.name;$('ma-where').textContent=picked.where;
          showDup(memDupOf(picked.id,picked.name));
          const near=picked.lat!=null?memPlaceNear(picked.lat,picked.lon):null;
          if(near&&near.trip_group){$('ma-near').value=near.trip_group;$('ma-near-why').textContent='Closest on your list: '+near.name;}
          refreshSave();
        }catch(_e){sugg.innerHTML='<div class="mem-muted">Could not load that place. Add it as typed instead.</div>';}
      });
    },250);
  });
  $('ma-name').addEventListener('input',refreshSave);

  save.onclick=async()=>{
    const name=(picked?$('ma-name').value:q.value).trim();if(!name)return;
    save.disabled=true;save.textContent='Adding…';
    const g=$('ma-near').value;
    const near=picked&&picked.lat!=null?memPlaceNear(picked.lat,picked.lon):null;
    const sort=(near&&near.trip_group===g)?memSortAfter(near):(g?memSortEndOfGroup(g):memSortAfter(null));
    const row=await memInsert({name,where:picked?picked.where:null,group:g,sort,place:picked});
    if(row){close();memAfterInsert(row);}
    else{save.disabled=false;save.textContent='Not added. Retry';}
  };
}

// ---------------------------------------------------------------- Blackbird lane
// blackbird.js hands a message here when it's about Memories. One AI call
// returns {action: add|tick|chat}; the app then does the lookup, duplicate
// check and placement itself, and asks before saving anything.
async function memEnsureLoaded(){if(!memLoaded)await loadMemories();}
const MEM_RULES=`List rules: every item is ONE finishable outing you can tick off (not a habit, not open-ended like "go to the beach more"). Repeats are fine and logged as extra visits. Never add: Aboriginal cultural tours (including Murujuga rock art); footy and Scorchers games. Names are 1 to 3 words.`;
function memListForAI(){
  const byArea={};
  memItems.forEach(m=>{(byArea[memGroupLabel(m.trip_group)||'Other']=byArea[memGroupLabel(m.trip_group)||'Other']||[]).push(`${m.code} ${m.name}${memIsDone(m.id)?' [done]':''}`);});
  return Object.entries(byArea).map(([a,l])=>`${a}: ${l.join('; ')}`).join('\n');
}
// Short summary for Blackbird's everyday chat, so it knows the list exists.
function memSummaryForAI(){
  if(!memLoaded)return '';
  const done=memItems.filter(m=>memIsDone(m.id));
  const recent=[...memDone].filter(d=>d.done_on).sort((a,b)=>b.done_on.localeCompare(a.done_on)).slice(0,5)
    .map(d=>{const m=memItems.find(x=>x.id===d.memory_id);return m?`${m.name} (${memFmtY(d.done_on)})`:null;}).filter(Boolean);
  return `\nMEMORIES TAB: the family's hit list of outings, ${done.length}/${memItems.length} done.${recent.length?' Recently: '+recent.join(', ')+'.':''} If they want to add, tick or plan one, tell them to say e.g. "add X to memories" or "we did X today".`;
}
function memIntent(msg){
  if(/\bmemor(y|ies)\b|bucket ?list|hit ?list|family (outing|day out)/i.test(msg))return true;
  if(!memLoaded||!/\b(we|i|kids)\b.*\b(went|did|visited|been)\b|\btick( off)?\b/i.test(msg))return false;
  const t=memNorm(msg);
  return memItems.some(m=>{const n=memNorm(m.name);return n.length>=6&&t.includes(n);});
}
async function memFindPlace(text){
  try{
    const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',
      headers:{'Content-Type':'application/json','X-Goog-Api-Key':MEM_PLACES_KEY,
        'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents'},
      body:JSON.stringify({textQuery:text,pageSize:1,regionCode:'AU',
        locationBias:{circle:{center:{latitude:MEM_HOME.lat,longitude:MEM_HOME.lon},radius:50000}}})});
    if(!r.ok)return null;
    const p=((await r.json()).places||[])[0];if(!p)return null;
    const comp=t=>(p.addressComponents||[]).find(c=>(c.types||[]).includes(t));
    const loc=comp('locality'),st=comp('administrative_area_level_1');
    return {id:p.id,name:(p.displayName||{}).text,lat:p.location?.latitude,lon:p.location?.longitude,
      where:[loc&&loc.longText,st&&st.shortText].filter(Boolean).join(', ')||p.formattedAddress||''};
  }catch(_e){return null;}
}
// The model sometimes chats first and then writes the JSON. Find the JSON
// object by brace-matching; if there isn't a usable one, treat the text as a
// plain reply so code never shows in the chat.
function memParseAI(raw){
  const t=String(raw||'').replace(/```json|```/g,'');
  let i=t.indexOf('{"action"');if(i<0)i=t.indexOf('{');
  if(i>=0){
    let depth=0,inStr=false,esc=false;
    for(let k=i;k<t.length;k++){
      const c=t[k];
      if(inStr){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')inStr=false;continue;}
      if(c==='"')inStr=true;else if(c==='{')depth++;
      else if(c==='}'&&--depth===0){try{const o=JSON.parse(t.slice(i,k+1));if(!o.reply)o.reply=t.slice(0,i).trim();return o;}catch(_e){}break;}
    }
  }
  const before=(i>=0?t.slice(0,i):t).trim();
  return before?{action:'chat',reply:before}:null;
}
async function memHandleBB(msg){
  try{await memEnsureLoaded();}catch(_e){bbMsg("I can't reach Memories right now. Try again in a sec.",'from-bb');return;}
  const sys=`You are Blackbird inside BravoChore, handling the family Memories list (outings to tick off together). User: ${CUN}. Family: Brent (BW), Bernadette (BJ), kids LW, GW, VW. Home: Swan View, Perth WA. Today: ${tdStr()}.
${MEM_RULES}
THE LIST (code name, [done] if ticked):
${memListForAI()}

Decide what they want and reply with ONLY the JSON object below: no text before or after it, no markdown:
{"action":"add"|"tick"|"chat","name":"short name for a NEW item or null","search":"what to look up on Google Maps for a NEW item, e.g. 'Bennett Brook Railway Whiteman Park' or null","code":"existing item code for tick, or the existing match if they try to add something already listed, else null","reply":"one or two warm, brief sentences. For add or tick, nothing is saved yet: they confirm with a button, so phrase it as an offer (e.g. 'Want me to add it?'), never 'Added'. Never show item codes like M012 in the reply; use names."}
- add: a new finishable outing not already on the list. If it's already listed, use action "chat", put its code in "code" and say so.
- tick: they did an existing item; put its code in "code".
- chat: questions, suggestions, ideas that break the rules (say why, kindly), anything else.`;
  let p=null,raw='';
  try{
    const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
      body:JSON.stringify({thinking:{type:'disabled'},model:BB_MODEL,max_tokens:700,system:sys,messages:[...bbHistory.slice(-6),{role:'user',content:msg}]})});
    const data=await res.json();
    raw=data.content?.find(c=>c.type==='text')?.text||'';
    p=memParseAI(raw);
  }catch(_e){}
  bbHistory.push({role:'user',content:msg});
  if(!p){bbMsg(raw||"Connection issue. Try again.",'from-bb');return;}
  bbHistory.push({role:'assistant',content:p.reply||''});
  const item=p.code?memItems.find(m=>m.code===p.code):null;

  if(p.action==='tick'&&item){
    memBBCard(`${memEsc(p.reply||'')}<div class="mem-bb-item">${memThumb(item)}<div><b>${memEsc(item.name)}</b><div class="mem-sub">${memEsc(item.where_text||'')}</div></div></div>`,
      'Tick it off',async()=>{const row=await memAddVisit(item.id);if(row){renderMemListIfOpen();openVisitSheet(item.id,row.id,true);return 'Ticked off. Add scores in the sheet, or skip.';}return 'That didn\'t save. Try again.';},
      ()=>openMemory(item.id));
    return;
  }
  if(p.action==='add'&&p.name){
    const place=await memFindPlace(p.search||p.name);
    const dup=memDupOf(place&&place.id,p.name)||(place?memDupOf(null,place.name):null);
    if(dup){bbMsgHTML(`Already on the list: <b>${memEsc(dup.name)}</b>${memIsDone(dup.id)?' (done)':''}. <button class="mem-link" style="display:inline;margin:0;min-height:0;padding:0 4px;text-decoration:underline" onclick="openMemory(${dup.id})">Open it</button>`,'from-bb');return;}
    const pl=memPlacement(place);
    memBBCard(`${memEsc(p.reply||'')}<div class="mem-bb-item"><div class="mem-thumb"></div><div><b>${memEsc(p.name)}</b><div class="mem-sub">${memEsc(place?place.where:'No place found, saved as typed')}${pl.near?' · next to '+memEsc(pl.near.name):''}</div></div></div>`,
      'Add to '+MEM_LABEL,async()=>{const row=await memInsert({name:p.name,where:place?place.where:null,group:pl.group,sort:pl.sort,place});if(row){renderMemListIfOpen();return 'Added. Marked unverified until the facts are checked.';}return 'That didn\'t save. Try again.';});
    return;
  }
  if(item){bbMsgHTML(`${memEsc(p.reply||'')} <button class="mem-link" style="display:inline;margin:0;min-height:0;padding:0 4px;text-decoration:underline" onclick="openMemory(${item.id})">Open ${memEsc(item.name)}</button>`,'from-bb');return;}
  bbMsg(p.reply||'Try again.','from-bb');
}
function renderMemListIfOpen(){if(document.getElementById('view-memories')?.classList.contains('active'))renderMemList();else memUpdateCount();}
// Confirm card in the Blackbird chat. Nothing saves until they tap the button.
function memBBCard(html,label,onYes,onOpen){
  const id='mbb'+Date.now();
  bbMsgHTML(`<div id="${id}">${html}<div style="display:flex;gap:8px;margin-top:10px">
    <button class="btn-ok" style="flex:1" data-yes>${memEsc(label)}</button>
    <button class="btn-cancel" style="flex:1" data-no>No</button></div></div>`,'from-bb');
  const el=document.getElementById(id);
  el.querySelector('[data-yes]').onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent='Saving…';
    const msg=await onYes();el.querySelector('[data-no]').remove();b.remove();
    el.insertAdjacentHTML('beforeend',`<div class="mem-sub" style="margin-top:8px">${memEsc(msg)}</div>`);
  };
  el.querySelector('[data-no]').onclick=()=>{el.querySelectorAll('button').forEach(x=>x.remove());el.insertAdjacentHTML('beforeend','<div class="mem-sub" style="margin-top:8px">No worries, left it.</div>');};
  if(onOpen){const im=el.querySelector('.mem-bb-item');if(im){im.style.cursor='pointer';im.onclick=onOpen;}}
}

// Bottom-nav label follows the constant.
document.addEventListener('DOMContentLoaded',()=>{
  const l=document.getElementById('bn-memories-label');if(l)l.textContent=MEM_LABEL;
});
