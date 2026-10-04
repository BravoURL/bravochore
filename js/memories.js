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
let memItems=[], memDone=[], memView='todo', memArea='', memLoaded=false;
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
  memItems=items;memDone=done;memLoaded=true;
}
const memVisits=id=>memDone.filter(d=>d.memory_id===id);
const memIsDone=id=>memDone.some(d=>d.memory_id===id);
const memVisitedTxt=v=>'Visited '+(v.done_on?(v.date_approx?'~':'')+memFmtY(v.done_on):'(date unknown)');
// Stock card photos are public Creative Commons images served from the repo
// (img/mem/Mxxx.jpg, thumbs in img/mem/t/). Family photos are separate and
// private (Phase 3, after login).
const memThumbSrc=m=>m.stock_photo_path?m.stock_photo_path.replace('img/mem/','img/mem/t/'):null;
function memThumb(m){
  const src=memThumbSrc(m);
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
  // Two-tap remove (undo-over-confirm; a modal would sit under this sheet).
  const rm=wrap.querySelector('#mv-remove');
  rm.onclick=async()=>{
    if(!fresh&&!rm.dataset.armed){rm.dataset.armed='1';rm.textContent='Tap again to remove';
      setTimeout(()=>{if(rm.isConnected){delete rm.dataset.armed;rm.textContent='Remove this visit';}},3000);return;}
    try{
      await api('bravochore_memory_done','DELETE',null,`?id=eq.${doneId}`);
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

// ---------------------------------------------------------------- detail
async function openMemory(id){
  const m=memItems.find(x=>x.id===id);if(!m)return;
  document.getElementById('mem-detail')?.remove();
  const visits=memVisits(id);
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
  if(m.min_age!=null)facts.push(`age ${m.min_age}+`);
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
      <div class="mem-visit-edit">Edit or remove ›</div>
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
    ${m.stock_photo_path?`<img class="mem-hero" src="${m.stock_photo_path}" alt="${memEsc(m.name)}" decoding="async">${memCredit(m.stock_photo_credit)}`:''}
    <div class="mem-facts">${facts.join(' · ')}<span class="task-code">${m.code}</span></div>
    <a class="qa-btn mem-maps" href="${memMapsUrl(m)}" target="_blank" rel="noopener">📍 Open in Google Maps</a>
    ${warns.length?`<div class="mem-warn">${warns.join('<br>')}</div>`:''}
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
    let codes=[];try{codes=await api('bravochore_memories','GET',null,'?select=code&code=like.M*');}catch(_e){}
    const maxN=Math.max(0,...codes.map(c=>parseInt(c.code.slice(1),10)).filter(n=>!isNaN(n)));
    const rec={code:'M'+String(maxN+1).padStart(3,'0'),sort_order:sort,name,where_text:picked?picked.where:null,
      trip_group:g||null,origin:'added_on_the_fly',status:'unverified',kind:'experience',created_by:CU||null,
      lat:picked?picked.lat:null,lon:picked?picked.lon:null,
      google_place_id:picked?picked.id:null,google_place_name:picked?picked.name:null,google_place_checked:picked?'manual':null};
    try{
      const [row]=await api('bravochore_memories','POST',rec);
      memItems.push(row);memItems.sort((a,b)=>a.sort_order-b.sort_order);close();
      if(memView!=='todo')setMemView('todo');else renderMemList();
      document.getElementById('mem-'+row.id)?.scrollIntoView({behavior:'smooth',block:'center'});
      badge('ok','✓ Added');
    }catch(_e){save.disabled=false;save.textContent='Not added. Retry';badge('er','⚠ Not added');}
  };
}

// Bottom-nav label follows the constant.
document.addEventListener('DOMContentLoaded',()=>{
  const l=document.getElementById('bn-memories-label');if(l)l.textContent=MEM_LABEL;
});
