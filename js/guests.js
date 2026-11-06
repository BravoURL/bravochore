// ================================================================
// GUESTS: a register of the households you have over (people, locality,
// allergies, notes), attached to Events. An allergy alert shows on any event
// with an allergic guest. "Who's next" = longest since you last hosted them.
// Tables: bravochore_guests, bravochore_event_guests (household RLS).
// ================================================================
let gsGuests=[],gsLinks=[],gsLoaded=false,gsSort='name';

async function gsLoad(force){
  if(gsLoaded&&!force)return;
  const [g,l]=await Promise.all([api('bravochore_guests','GET',null,'?order=name'),api('bravochore_event_guests','GET',null,'')]);
  gsGuests=g||[];gsLinks=l||[];gsLoaded=true;
}
function gsLastHosted(gid){
  const evs=gsLinks.filter(l=>l.guest_id===gid).map(l=>(events||[]).find(e=>e.id===l.event_id)).filter(e=>e&&e.due&&e.due<=tdStr());
  return evs.map(e=>e.due).sort().pop()||null;
}
function gsCount(list){return list.reduce((a,g)=>({adults:a.adults+(g.adults||0),kids:a.kids+(g.kids||0)}),{adults:0,kids:0});}

// ---------------------------------------------------------------- register
async function gsOpenRegister(){
  await gsLoad();if(typeof loadEvents==='function'&&!(events&&events.length))await loadEvents();
  let w=document.getElementById('gs-reg');
  if(!w){w=document.createElement('div');w.id='gs-reg';w.className='mem-overlay';w.style.zIndex='940';document.body.appendChild(w);}
  const list=[...gsGuests].sort((a,b)=>gsSort==='next'?(gsLastHosted(a.id)||'0').localeCompare(gsLastHosted(b.id)||'0'):a.name.localeCompare(b.name));
  w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">Guests</div><div class="mem-sheet-sub">The households you have over. Allergies show on any event they're coming to.</div></div>
      <button class="btn-cancel" onclick="document.getElementById('gs-reg').remove()">Close</button></div>
    <div style="display:flex;gap:6px;margin-bottom:10px"><div class="filter-chip ${gsSort==='name'?'active':''}" onclick="gsSort='name';gsOpenRegister()">A–Z</div><div class="filter-chip ${gsSort==='next'?'active':''}" onclick="gsSort='next';gsOpenRegister()">Who's next</div></div>
    ${list.map(g=>{const lh=gsLastHosted(g.id);return `<button class="cal-item" onclick="gsEdit(${g.id})"><span class="cal-ic">🏠</span>
      <span class="cal-t"><b>${hhEsc(g.name)}</b>${g.allergies?' <span class="gs-alg">⚠ Allergy</span>':''}
      <span class="mem-sub" style="display:block;margin:0">${g.adults||0} adult${g.adults===1?'':'s'}${g.kids?`, ${g.kids} kid${g.kids>1?'s':''}`:''}${g.locality?' · '+hhEsc(g.locality):''} · ${lh?'last here '+fmtDate(lh):'not hosted yet'}</span></span></button>`;}).join('')||'<div class="mem-sub">No guests yet.</div>'}
    <button class="btn-ok" style="width:100%;margin-top:12px" onclick="gsEdit(null)">+ Add a household</button></div>`;
}
function gsEdit(id){
  const g=id?gsGuests.find(x=>x.id===id):{name:'',adults:2,kids:0,locality:'',allergies:'',notes:''};if(!g)return;
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${id?'Edit':'New'} household</div>
    <div class="dp-field" style="margin-top:12px"><label class="dp-label" for="gs-n">Name</label><input class="dp-input" id="gs-n" value="${hhEsc(g.name)}" placeholder="e.g. Gran & Pop, the Smiths"></div>
    <div style="display:flex;gap:8px"><div class="dp-field" style="flex:1"><label class="dp-label" for="gs-a">Adults</label><input class="dp-input" id="gs-a" type="number" min="0" value="${g.adults||0}"></div>
    <div class="dp-field" style="flex:1"><label class="dp-label" for="gs-k">Kids</label><input class="dp-input" id="gs-k" type="number" min="0" value="${g.kids||0}"></div>
    <div class="dp-field" style="flex:2"><label class="dp-label" for="gs-l">Locality</label><input class="dp-input" id="gs-l" value="${hhEsc(g.locality||'')}"></div></div>
    <div class="dp-field"><label class="dp-label" for="gs-al">Allergies (who and what)</label><input class="dp-input" id="gs-al" value="${hhEsc(g.allergies||'')}" placeholder="e.g. Pop: nuts"></div>
    <div class="dp-field"><label class="dp-label" for="gs-no">Notes</label><input class="dp-input" id="gs-no" value="${hhEsc(g.notes||'')}" placeholder="e.g. no red meat, love pavlova"></div>
    <div style="display:flex;gap:8px">${id?'<button class="btn-cancel" id="gs-d" style="color:var(--red)">Delete</button>':''}<button class="btn-cancel" id="gs-c" style="margin-left:auto">Cancel</button><button class="btn-ok" id="gs-s">Save</button></div></div>`;
  document.body.appendChild(w);
  const $=s=>w.querySelector(s);
  $('#gs-c').onclick=()=>w.remove();
  if(id)$('#gs-d').onclick=async()=>{if(!(await confirm2('Delete this household?',hhEsc(g.name),'btn-ok')))return;
    try{await api('bravochore_guests','DELETE',null,`?id=eq.${id}`);gsGuests=gsGuests.filter(x=>x.id!==id);gsLinks=gsLinks.filter(l=>l.guest_id!==id);}catch(_e){}
    w.remove();gsAfter();};
  $('#gs-s').onclick=async()=>{
    const row={name:$('#gs-n').value.trim(),adults:Math.max(0,parseInt($('#gs-a').value)||0),kids:Math.max(0,parseInt($('#gs-k').value)||0),
      locality:$('#gs-l').value.trim()||null,allergies:$('#gs-al').value.trim()||null,notes:$('#gs-no').value.trim()||null};
    if(!row.name)return;
    try{if(id){await api('bravochore_guests','PATCH',row,`?id=eq.${id}`);Object.assign(g,row);}
      else{const r=await api('bravochore_guests','POST',row);if(r&&r[0])gsGuests.push(r[0]);}}
    catch(_e){chirp("Didn't save. Try again.");return;}
    w.remove();gsAfter();
  };
}
function gsAfter(){
  if(document.getElementById('gs-reg'))gsOpenRegister();
  const ev=window.gsCurrentEvent;if(ev&&document.getElementById('ep-guests'))gsFillEvent(ev);
}

// ---------------------------------------------------------------- on an event
async function gsFillEvent(ev){
  window.gsCurrentEvent=ev;
  const body=document.getElementById('ep-body');if(!body)return;
  let box=document.getElementById('ep-guests');
  if(!box){box=document.createElement('div');box.id='ep-guests';const dash=body.querySelector('.ep-dash');(dash||body.firstChild)?.after?.(box);if(!box.parentNode)body.prepend(box);}
  try{await gsLoad();}catch(_e){return;}
  const mine=gsLinks.filter(l=>l.event_id===ev.id).map(l=>gsGuests.find(g=>g.id===l.guest_id)).filter(Boolean);
  const n=gsCount(mine),alg=mine.filter(g=>g.allergies);
  box.innerHTML=`<div class="gs-ev">
    ${alg.length?`<div class="gs-alert">⚠ Allergy alert: ${alg.map(g=>hhEsc(g.allergies)).join('; ')}</div>`:''}
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:500">Guests ${mine.length?`<span class="mem-sub">· ${n.adults+n.kids} people${n.kids?` (${n.kids} kids)`:''}</span>`:''}</span>
      <button class="qa-btn" style="font-size:11px;padding:5px 10px" onclick="gsPick(${ev.id})">+ Guests</button></div>
    <div class="gs-chips">${mine.map(g=>`<span class="gs-chip">${hhEsc(g.name)}${g.allergies?' ⚠':''}</span>`).join('')||'<span class="mem-sub">No guests added.</span>'}</div>
    ${mine.some(g=>g.notes)?`<div class="mem-sub" style="margin:6px 0 0">${mine.filter(g=>g.notes).map(g=>`${hhEsc(g.name)}: ${hhEsc(g.notes)}`).join(' · ')}</div>`:''}
  </div>`;
}
async function gsPick(evId){
  await gsLoad();
  const on=new Set(gsLinks.filter(l=>l.event_id===evId).map(l=>l.guest_id));
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  const draw=()=>{const sel=gsGuests.filter(g=>on.has(g.id)),n=gsCount(sel);
    w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
      <div class="mem-sheet-title">Who's coming?</div><div class="mem-sheet-sub">${n.adults} adults${n.kids?`, ${n.kids} kids`:''} so far</div>
      <div class="ml-pick">${gsGuests.map(g=>`<label><input type="checkbox" data-g="${g.id}" ${on.has(g.id)?'checked':''}> <b>${hhEsc(g.name)}</b> <span class="mem-sub">${g.adults+g.kids} · ${gsLastHosted(g.id)?'last '+fmtDate(gsLastHosted(g.id)):'new'}</span>${g.allergies?' <span class="gs-alg">⚠</span>':''}</label>`).join('')||'<div class="mem-sub">No households yet.</div>'}</div>
      <button class="mem-link" id="gp-new" style="margin:8px 0">+ New household</button>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn-cancel" id="gp-c">Cancel</button><button class="btn-ok" id="gp-s">Save</button></div></div>`;
    w.querySelectorAll('[data-g]').forEach(c=>c.onchange=()=>{const id=+c.dataset.g;c.checked?on.add(id):on.delete(id);draw();});
    w.querySelector('#gp-c').onclick=()=>w.remove();
    w.querySelector('#gp-new').onclick=()=>{w.remove();gsEdit(null);};
    w.querySelector('#gp-s').onclick=async()=>{
      const had=new Set(gsLinks.filter(l=>l.event_id===evId).map(l=>l.guest_id));
      const add=[...on].filter(x=>!had.has(x)),del=[...had].filter(x=>!on.has(x));
      try{
        if(add.length){const r=await api('bravochore_event_guests','POST',add.map(g=>({event_id:evId,guest_id:g})));gsLinks.push(...(r||add.map(g=>({event_id:evId,guest_id:g}))));}
        for(const g of del){await api('bravochore_event_guests','DELETE',null,`?event_id=eq.${evId}&guest_id=eq.${g}`);gsLinks=gsLinks.filter(l=>!(l.event_id===evId&&l.guest_id===g));}
      }catch(_e){chirp("Didn't save. Try again.");return;}
      w.remove();gsAfter();
    };};
  draw();document.body.appendChild(w);
}
// Hook into the existing event panel without touching its internals.
(function(){
  if(typeof renderEventPanel!=='function')return;
  const orig=renderEventPanel;
  renderEventPanel=function(ev){orig(ev);try{gsFillEvent(ev);}catch(_e){}};
})();
