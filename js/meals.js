// ================================================================
// MEALS: "Tea tonight", a weekly plan, and recipes whose ingredients go
// straight to Shopping (Coles). Lives in Calendar (Calendar | Meals | Events).
// Tables: bravochore_meals (day, slot tea|lunch), bravochore_recipes.
// ================================================================
let mlMeals=[],mlRecipes=[],mlLoaded=false,mlWeek=null;

async function mlLoad(force){
  if(mlLoaded&&!force)return;
  const from=kjAddDays(kjWeekStart(tdStr()),-28);
  const [m,r]=await Promise.all([
    api('bravochore_meals','GET',null,`?day=gte.${from}&order=day`),
    api('bravochore_recipes','GET',null,'?order=title')]);
  mlMeals=m||[];mlRecipes=r||[];mlLoaded=true;
}
function mlFor(day,slot='tea'){return mlMeals.find(x=>x.day===day&&x.slot===slot);}
function mlTonight(){return mlFor(tdStr(),'tea');}
function mlRecipe(id){return mlRecipes.find(r=>r.id===id);}

async function renderMeals(){
  const el=document.getElementById('meals-body');if(!el)return;
  if(!mlLoaded)el.innerHTML='<div class="empty-state">Loading…</div>';
  try{await mlLoad();}catch(_e){el.innerHTML='<div class="empty-state">Couldn\'t load meals.</div>';return;}
  const ws=mlWeek||kjWeekStart(tdStr()),t=tdStr();
  const lbl=ws===kjWeekStart(t)?'This week':ws===kjAddDays(kjWeekStart(t),7)?'Next week':ws===kjAddDays(kjWeekStart(t),-7)?'Last week':'Week of '+new Date(ws+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'});
  const rows=[0,1,2,3,4,5,6].map(i=>{const d=kjAddDays(ws,i),m=mlFor(d),l=mlFor(d,'lunch'),r=m&&m.recipe_id?mlRecipe(m.recipe_id):null;
    return `<div class="ml-row${d===t?' today':''}">
      <div class="ml-day"><b>${KJ_DOW_LONG[kjDowOf(d)].slice(0,3)}</b><span>${+d.slice(8)}</span></div>
      <div class="ml-slots">
        <button class="ml-slot${m?'':' empty'}" onclick="mlEdit('${d}','tea')">${m?`${hhEsc(r?.icon||'🍽️')} ${hhEsc(m.title)}${r?' <span class="ml-rec">recipe</span>':''}`:'+ Tea'}</button>
        ${l?`<button class="ml-slot lunch" onclick="mlEdit('${d}','lunch')">🥪 ${hhEsc(l.title)}</button>`:''}
      </div></div>`;}).join('');
  el.innerHTML=`
    <div class="kt-day"><button class="kt-step" onclick="mlShift(-7)" aria-label="Previous week">‹</button><div class="kt-day-label">${lbl}</div><button class="kt-step" onclick="mlShift(7)" aria-label="Next week">›</button></div>
    <div class="ml-week">${rows}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px">
      <button class="qa-btn" onclick="mlCopyLast()">Copy last week</button>
      <button class="qa-btn" onclick="mlShopWeek()">🛒 Ingredients to Shopping</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between"><h3 class="ml-h">Recipes</h3><button class="qa-btn accent" onclick="mlRecipeEdit(null)">+ Recipe</button></div>
    <div class="ml-recipes">${mlRecipes.map(r=>`<button class="cal-item" onclick="mlRecipeOpen(${r.id})"><span class="cal-ic">${hhEsc(r.icon||'🍲')}</span>
      <span class="cal-t">${hhEsc(r.title)}<span class="mem-sub" style="display:block;margin:0">${(r.ingredients||[]).length} ingredients</span></span></button>`).join('')||'<div class="mem-sub">No recipes yet. Add your favourites, or paste one in and Blackbird pulls out the ingredients.</div>'}</div>`;
}
function mlShift(n){mlWeek=kjAddDays(mlWeek||kjWeekStart(tdStr()),n);renderMeals();}

async function mlSet(day,slot,title,recipe_id){
  const prev=mlFor(day,slot);
  mlMeals=mlMeals.filter(x=>!(x.day===day&&x.slot===slot));
  try{
    if(!title){if(prev)await api('bravochore_meals','DELETE',null,`?day=eq.${day}&slot=eq.${slot}`);}
    else{
      const row={day,slot,title,recipe_id:recipe_id||null,created_by:CU};
      const r=await fetch(`${SB}/rest/v1/bravochore_meals?on_conflict=household_code,day,slot`,{method:'POST',
        headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
      if(!r.ok)throw new Error(await r.text());
      const j=await r.json();mlMeals.push(j[0]||row);
    }
  }catch(_e){if(prev)mlMeals.push(prev);chirp("Didn't save. Try again.");return false;}
  return true;
}
function mlEdit(day,slot){
  const m=mlFor(day,slot);
  const past=[...new Set(mlMeals.filter(x=>x.slot===slot).map(x=>x.title))].slice(-12);
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${slot==='tea'?'Tea':'Lunch'} · ${calDayLabel(day)}</div>
    <div class="dp-field" style="margin-top:12px"><input class="dp-input" id="ml-t" value="${hhEsc(m?.title||'')}" placeholder="e.g. Spag bol" autocomplete="off"></div>
    <div class="ml-sugg">${mlRecipes.map(r=>`<button class="filter-chip" data-r="${r.id}">${hhEsc(r.icon||'🍲')} ${hhEsc(r.title)}</button>`).join('')}
      ${past.filter(p=>!mlRecipes.some(r=>r.title===p)).map(p=>`<button class="filter-chip" data-p="${hhEsc(p)}">${hhEsc(p)}</button>`).join('')}</div>
    ${slot==='tea'&&!mlFor(day,'lunch')?`<button class="mem-link" id="ml-lunch" style="margin:6px 0">+ Add lunch for this day</button>`:''}
    <div style="display:flex;gap:8px;margin-top:12px">${m?'<button class="btn-cancel" id="ml-clear">Clear</button>':''}<button class="btn-cancel" id="ml-c" style="margin-left:auto">Cancel</button><button class="btn-ok" id="ml-s">Save</button></div></div>`;
  document.body.appendChild(w);
  let rid=m?.recipe_id||null;
  const inp=w.querySelector('#ml-t');setTimeout(()=>inp.focus(),50);
  inp.oninput=()=>{rid=null;};
  w.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=mlRecipe(+b.dataset.r);inp.value=r.title;rid=r.id;});
  w.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{inp.value=b.dataset.p;rid=null;});
  w.querySelector('#ml-c').onclick=()=>w.remove();
  const lb=w.querySelector('#ml-lunch');if(lb)lb.onclick=()=>{w.remove();mlEdit(day,'lunch');};
  if(m)w.querySelector('#ml-clear').onclick=async()=>{await mlSet(day,slot,null);w.remove();mlRefreshAll();};
  w.querySelector('#ml-s').onclick=async()=>{const t=inp.value.trim();if(!t)return;
    const r=rid||(mlRecipes.find(x=>x.title.toLowerCase()===t.toLowerCase())||{}).id||null;
    if(await mlSet(day,slot,t,r)){w.remove();mlRefreshAll();}};
}
function mlRefreshAll(){
  if(document.getElementById('view-meals')?.classList.contains('active'))renderMeals();
  if(document.getElementById('view-dashboard')?.classList.contains('active')&&typeof renderDashboard==='function')renderDashboard();
}
async function mlCopyLast(){
  const ws=mlWeek||kjWeekStart(tdStr()),prev=kjAddDays(ws,-7);let n=0;
  for(let i=0;i<7;i++){const from=kjAddDays(prev,i),to=kjAddDays(ws,i);
    for(const slot of ['tea','lunch']){const m=mlFor(from,slot);if(m&&!mlFor(to,slot)){await mlSet(to,slot,m.title,m.recipe_id);n++;}}}
  chirp(n?`Copied ${n} meal${n>1?'s':''}.`:'Nothing to copy (or the days are already planned).');renderMeals();
}

// ---------------------------------------------------------------- ingredients -> Shopping
function mlShopWeek(){
  const ws=mlWeek||kjWeekStart(tdStr());const items=[];
  for(let i=0;i<7;i++){const d=kjAddDays(ws,i);['tea','lunch'].forEach(s=>{const m=mlFor(d,s);const r=m&&m.recipe_id&&mlRecipe(m.recipe_id);
    if(r)(r.ingredients||[]).forEach(x=>items.push({name:x,from:r.title}));});}
  if(!items.length){chirp('No recipes on the plan this week. Link meals to recipes to pull their ingredients.');return;}
  mlShopPick(items,'This week\'s ingredients');
}
function mlShopPick(items,title){
  const have=new Set((typeof shopping!=='undefined'?shopping:[]).filter(s=>!s.done).map(s=>s.name.toLowerCase()));
  const uniq=[];items.forEach(i=>{if(!uniq.some(u=>u.name.toLowerCase()===i.name.toLowerCase()))uniq.push(i);});
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${hhEsc(title)}</div><div class="mem-sheet-sub">Untick anything you've already got. Goes on the Coles list.</div>
    <div class="ml-pick">${uniq.map((x,i)=>`<label><input type="checkbox" data-i="${i}" ${have.has(x.name.toLowerCase())?'':'checked'}> ${hhEsc(x.name)}${have.has(x.name.toLowerCase())?' <span class="mem-sub">(already on list)</span>':''}</label>`).join('')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn-cancel" id="mp-c">Cancel</button><button class="btn-ok" id="mp-s">Add to Shopping</button></div></div>`;
  document.body.appendChild(w);
  w.querySelector('#mp-c').onclick=()=>w.remove();
  w.querySelector('#mp-s').onclick=async()=>{
    const pick=[...w.querySelectorAll('[data-i]:checked')].map(c=>uniq[+c.dataset.i]);
    const rows=pick.map((x,k)=>({id:'si_'+Date.now()+'_'+k,name:x.name,store:'Coles',note:x.from||'',done:false,sort_order:(shopping.length||0)+k+1}));
    if(rows.length){shopping.push(...rows);try{await api('bravochore_shopping','POST',rows);}catch(_e){}
      if(typeof shopSortUnknown==='function')try{shopSortUnknown();}catch(_e){}}
    w.remove();chirp(`${rows.length} added to Shopping.`);
  };
}

// ---------------------------------------------------------------- recipes
function mlRecipeOpen(id){
  const r=mlRecipe(id);if(!r)return;
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='940';
  w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">${hhEsc(r.icon||'🍲')} ${hhEsc(r.title)}</div>
      ${r.link?`<a class="mem-sub" href="${hhEsc(r.link)}" target="_blank" rel="noopener">Open the recipe ↗</a>`:''}</div>
      <button class="btn-cancel" id="ro-x">Close</button></div>
    <div class="kt-ed-sec">Ingredients</div>
    <ul class="ml-ing">${(r.ingredients||[]).map(x=>`<li>${hhEsc(x)}</li>`).join('')||'<li class="mem-sub">None listed</li>'}</ul>
    ${r.notes?`<div class="kt-ed-sec">Notes</div><div style="white-space:pre-wrap;font-size:14px">${hhEsc(r.notes)}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      <button class="btn-ok" id="ro-shop">🛒 Ingredients to Shopping</button>
      <button class="btn-cancel" id="ro-plan">Plan it for…</button>
      <button class="btn-cancel" id="ro-edit">Edit</button></div></div>`;
  document.body.appendChild(w);
  w.querySelector('#ro-x').onclick=()=>w.remove();
  w.querySelector('#ro-shop').onclick=()=>mlShopPick((r.ingredients||[]).map(x=>({name:x,from:r.title})),r.title);
  w.querySelector('#ro-edit').onclick=()=>{w.remove();mlRecipeEdit(r);};
  w.querySelector('#ro-plan').onclick=()=>{
    const t=tdStr();const days=[0,1,2,3,4,5,6].map(i=>kjAddDays(t,i));
    w.querySelector('.mem-sheet').insertAdjacentHTML('beforeend',`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${days.map(d=>`<button class="filter-chip" data-d="${d}">${calDayLabel(d).split(' ')[0].replace(',','')}${mlFor(d)?' ·':''}</button>`).join('')}</div>`);
    w.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{if(await mlSet(b.dataset.d,'tea',r.title,r.id)){chirp(`${r.title}: ${calDayLabel(b.dataset.d)}`);w.remove();mlRefreshAll();}});
  };
}
function mlRecipeEdit(r){
  const id=r?.id||null;
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${id?'Edit recipe':'New recipe'}</div>
    <div class="mem-sheet-sub">Paste a whole recipe into Notes and tap "Pull ingredients", and Blackbird fills in the rest.</div>
    <div style="display:flex;gap:8px"><div class="dp-field" style="width:70px"><label class="dp-label" for="re-ic">Pic</label><input class="dp-input" id="re-ic" value="${hhEsc(r?.icon||'🍲')}" style="text-align:center;font-size:20px"></div>
    <div class="dp-field" style="flex:1"><label class="dp-label" for="re-t">Name</label><input class="dp-input" id="re-t" value="${hhEsc(r?.title||'')}"></div></div>
    <div class="dp-field"><label class="dp-label" for="re-l">Link (optional)</label><input class="dp-input" id="re-l" value="${hhEsc(r?.link||'')}" placeholder="https://"></div>
    <div class="dp-field"><label class="dp-label" for="re-i">Ingredients, one per line</label><textarea class="dp-textarea" id="re-i" rows="6">${hhEsc((r?.ingredients||[]).join('\n'))}</textarea></div>
    <div class="dp-field"><label class="dp-label" for="re-n">Notes / method</label><textarea class="dp-textarea" id="re-n" rows="4">${hhEsc(r?.notes||'')}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-cancel" id="re-ai">✨ Pull ingredients</button>${id?'<button class="btn-cancel" id="re-del" style="color:var(--red)">Delete</button>':''}
      <button class="btn-cancel" id="re-c" style="margin-left:auto">Cancel</button><button class="btn-ok" id="re-s">Save</button></div></div>`;
  document.body.appendChild(w);
  const $=s=>w.querySelector(s);
  $('#re-c').onclick=()=>w.remove();
  $('#re-ai').onclick=async()=>{
    const src=($('#re-n').value+'\n'+$('#re-i').value).trim();if(!src)return;
    $('#re-ai').textContent='Reading…';
    try{
      const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:await bcBearer()},
        body:JSON.stringify({thinking:{type:'disabled'},model:'claude-haiku-4-5-20251001',max_tokens:800,
          system:'Extract a recipe. Reply ONLY JSON: {"title":"short name","icon":"one food emoji","ingredients":["shopping-list style item with amount, e.g. 500g beef mince"]}. Australian names (capsicum, coriander). Skip water, salt and pepper.',
          messages:[{role:'user',content:src.slice(0,8000)}]})});
      const j=await res.json();const raw=j.content?.find(c=>c.type==='text')?.text||'';const d=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
      if(d.ingredients)$('#re-i').value=d.ingredients.join('\n');
      if(d.title&&!$('#re-t').value)$('#re-t').value=d.title;
      if(d.icon&&$('#re-ic').value==='🍲')$('#re-ic').value=d.icon;
    }catch(_e){chirp("Couldn't read that one.");}
    $('#re-ai').textContent='✨ Pull ingredients';
  };
  if(id)$('#re-del').onclick=async()=>{if(!(await confirm2('Delete this recipe?',hhEsc(r.title),'btn-ok')))return;
    try{await api('bravochore_recipes','DELETE',null,`?id=eq.${id}`);mlRecipes=mlRecipes.filter(x=>x.id!==id);}catch(_e){}w.remove();renderMeals();};
  $('#re-s').onclick=async()=>{
    const row={title:$('#re-t').value.trim(),icon:$('#re-ic').value.trim()||'🍲',link:$('#re-l').value.trim()||null,
      ingredients:$('#re-i').value.split('\n').map(x=>x.trim()).filter(Boolean),notes:$('#re-n').value.trim()||null,created_by:CU};
    if(!row.title)return;
    try{
      if(id){await api('bravochore_recipes','PATCH',row,`?id=eq.${id}`);Object.assign(r,row);}
      else{const x=await api('bravochore_recipes','POST',row);if(x&&x[0])mlRecipes.push(x[0]);}
    }catch(_e){chirp("Didn't save. Try again.");return;}
    mlRecipes.sort((a,b)=>a.title.localeCompare(b.title));w.remove();renderMeals();
  };
}
