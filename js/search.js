// ================================================================
// SEARCH: one box for the whole app (tasks, events, calendar, meals,
// recipes, memories, kids' jobs, shopping, guests). Top-bar magnifier.
// ================================================================
function srOpen(){
  let w=document.getElementById('sr-wrap');
  if(!w){w=document.createElement('div');w.id='sr-wrap';w.className='mem-overlay';w.style.zIndex='960';w.style.alignItems='flex-start';document.body.appendChild(w);}
  w.innerHTML=`<div class="sr-box"><div class="sr-top"><input id="sr-q" class="dp-input" placeholder="Search everything" autocomplete="off"><button class="btn-cancel" id="sr-x">Close</button></div><div id="sr-res"></div></div>`;
  w.style.display='flex';
  w.querySelector('#sr-x').onclick=()=>w.remove();
  w.onclick=e=>{if(e.target===w)w.remove();};
  const q=w.querySelector('#sr-q');setTimeout(()=>q.focus(),50);
  // Load the lazy modules once so their data is searchable.
  Promise.all([typeof calLoad==='function'?calLoad().catch(()=>{}):0,typeof mlLoad==='function'?mlLoad().catch(()=>{}):0,
    typeof kjLoad==='function'?kjLoad().catch(()=>{}):0,typeof gsLoad==='function'?gsLoad().catch(()=>{}):0,
    typeof memEnsureLoaded==='function'?memEnsureLoaded().catch(()=>{}):0]).then(()=>{if(q.value)srRun(q.value);});
  q.oninput=()=>srRun(q.value);
}
function srRun(text){
  const box=document.getElementById('sr-res');if(!box)return;
  const t=text.trim().toLowerCase();if(t.length<2){box.innerHTML='';return;}
  const hit=s=>String(s||'').toLowerCase().includes(t);
  const out=[];
  const add=(icon,title,sub,fn)=>out.push({icon,title,sub,fn});
  (tasks||[]).filter(x=>hit(x.title)||hit(x.notes)).slice(0,8).forEach(x=>add(x.done?'☑️':'✅',x.title,`Task${x.due?' · '+fmtDate(x.due):''}${x.done?' · done':''}`,()=>openDetail(x.id)));
  (typeof events!=='undefined'?events:[]).filter(x=>hit(x.title)||hit(x.description)).slice(0,5).forEach(x=>add('🎉',x.title,'Event'+(x.due?' · '+fmtDate(x.due):''),()=>openEventPanel(x.id)));
  (typeof calRows!=='undefined'?calRows:[]).filter(x=>hit(x.title)).slice(0,6).forEach(x=>add(x.icon||'📅',x.title,'Calendar · '+fmtDate(x.day),()=>{bnNav('calendar');setTimeout(()=>calEdit(x),300);}));
  (typeof mlRecipes!=='undefined'?mlRecipes:[]).filter(x=>hit(x.title)||(x.ingredients||[]).some(hit)).slice(0,5).forEach(x=>add(x.icon||'🍲',x.title,'Recipe',()=>{bnNav('meals');setTimeout(()=>mlRecipeOpen(x.id),300);}));
  (typeof mlMeals!=='undefined'?mlMeals:[]).filter(x=>hit(x.title)).slice(-4).forEach(x=>add('🍽️',x.title,`Meal · ${fmtDate(x.day)}`,()=>bnNav('meals')));
  (typeof memItems!=='undefined'?memItems:[]).filter(x=>hit(x.name)||hit(x.where_text)).slice(0,6).forEach(x=>add('🖼️',x.name,'Memory'+(x.where_text?' · '+x.where_text:''),()=>{bnNav('memories');setTimeout(()=>openMemory(x.id),300);}));
  (typeof kjJobs!=='undefined'?kjJobs:[]).filter(x=>hit(x.title)).slice(0,5).forEach(x=>add(x.icon||'⭐',x.title,`Kids' job · ${kjName(x.kid)}`,()=>{bnNav('kids');}));
  (typeof shopping!=='undefined'?shopping:[]).filter(x=>!x.done&&hit(x.name)).slice(0,5).forEach(x=>add('🛒',x.name,'Shopping · '+x.store,()=>bnNav('shopping')));
  (typeof gsGuests!=='undefined'?gsGuests:[]).filter(x=>hit(x.name)||hit(x.allergies)).slice(0,4).forEach(x=>add('🏠',x.name,'Guests'+(x.allergies?' · ⚠ '+x.allergies:''),()=>{gsOpenRegister();setTimeout(()=>gsEdit(x.id),200);}));
  box.innerHTML=out.length?out.map((r,i)=>`<button class="cal-item" data-i="${i}"><span class="cal-ic">${hhEsc(r.icon)}</span><span class="cal-t">${hhEsc(r.title)}<span class="mem-sub" style="display:block;margin:0">${hhEsc(r.sub)}</span></span></button>`).join(''):'<div class="mem-sub" style="padding:10px">Nothing found.</div>';
  box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{document.getElementById('sr-wrap')?.remove();try{out[+b.dataset.i].fn();}catch(_e){}});
}
