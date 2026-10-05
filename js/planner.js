// ================================================================
// DAY PLANNER (Oct 2026). "Saturday 12-5, all of us": weather for the day,
// undone items + favourites within reach, real drive times (Google Routes,
// estimate fallback), Claude picks and explains 2-3 plans plus an honest
// wildcard, then the app re-orders each plan for the shortest drive and
// checks it fits the window. Saved plans live in bravochore_memory_plans.
// ================================================================
const PL_MAX_CANDS=14;          // keeps the route matrix small (15x15 = 225 elements)
let plLast=null;                // last generated result, for Save

const plEsc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const plHHMM=m=>{const h=Math.floor(m/60),mm=Math.round(m%60);const h12=((h+11)%12)+1;return `${h12}:${String(mm).padStart(2,'0')}${h<12?'am':'pm'}`;};
function plNextSat(){const d=new Date();d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));return d.toISOString().slice(0,10);}
// Rough drive estimate when Routes isn't available: road ~1.3x straight line at ~65 km/h.
const plEstDrive=(a,b)=>Math.round(memKm(a.lat,a.lon,b.lat,b.lon)*1.3/65*60)+5;

// ---------------------------------------------------------------- inputs
function plOpen(pre){
  pre=pre||{};
  const wrap=document.createElement('div');wrap.className='mem-overlay';wrap.id='pl-sheet';
  const whoDefault=pre.who||memDefaultWho();
  wrap.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div class="mem-sheet-title">Plan a day</div><button class="mem-x" id="pl-x" aria-label="Close">✕</button></div>
    <div class="mem-sheet-sub">Weather, drive times and what fits. Nothing's booked or saved until you say.</div>
    <div class="dp-field"><label class="dp-label" for="pl-date">Day</label><input class="dp-input" type="date" id="pl-date" value="${pre.date||plNextSat()}"></div>
    <div style="display:flex;gap:8px">
      <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-from">From</label><input class="dp-input" type="time" id="pl-from" value="${pre.from||'12:00'}"></div>
      <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-to">Home by</label><input class="dp-input" type="time" id="pl-to" value="${pre.to||'17:00'}"></div>
    </div>
    <div class="dp-label" style="margin-top:6px">Who's coming</div>
    <div class="pl-who">${people.map(p=>`<button type="button" class="pl-chip ${whoDefault.includes(p.code)?'on':''}" data-code="${p.code}" aria-pressed="${whoDefault.includes(p.code)}"><span class="task-tag" style="background:${p.bg};color:${p.color}">${plEsc(p.name)}</span></button>`).join('')}</div>
    <div class="dp-field" style="margin-top:10px"><label class="dp-label" for="pl-vibe">Anything else?</label>
      <input class="dp-input" id="pl-vibe" placeholder="Optional, e.g. easy day, lunch out, near the coast" value="${plEsc(pre.vibe||'')}"></div>
    <button class="btn-ok" style="width:100%;margin-top:14px" id="pl-go">Plan it</button>
  </div>`;
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  wrap.querySelector('#pl-x').onclick=close;
  wrap.querySelectorAll('.pl-chip').forEach(c=>c.onclick=()=>{c.classList.toggle('on');c.setAttribute('aria-pressed',c.classList.contains('on'));});
  wrap.querySelector('#pl-go').onclick=async e=>{
    const opts={date:wrap.querySelector('#pl-date').value,from:wrap.querySelector('#pl-from').value,to:wrap.querySelector('#pl-to').value,
      who:[...wrap.querySelectorAll('.pl-chip.on')].map(c=>c.dataset.code),vibe:wrap.querySelector('#pl-vibe').value.trim()};
    if(!opts.date||!opts.from||!opts.to||plMin(opts.to)-plMin(opts.from)<60){chirp('Give it at least an hour.');return;}
    const b=e.currentTarget;b.disabled=true;b.textContent='Checking weather and drive times…';
    try{const res=await plRun(opts);close();plShow(res);}
    catch(err){b.disabled=false;b.textContent='Plan it';chirp("Couldn't build a plan just now. Try again.");console.warn(err);}
  };
}

// ---------------------------------------------------------------- engine
async function plWeatherFor(date){
  const wx=await homeWeather();
  const d=wx&&wx.days.find(x=>x.date===date);
  return d?`${d.desc}, ${d.min}-${d.max}°C, ${d.rain??'?'}% chance of rain`:'No forecast yet (more than 10 days out). Plan for typical weather.';
}
async function plMatrix(points){
  // Real drive minutes via Google Routes; falls back to estimates per cell.
  const n=points.length, M=points.map(a=>points.map(b=>a===b?0:plEstDrive(a,b)));
  let real=false;
  try{
    const wp=p=>({waypoint:{location:{latLng:{latitude:p.lat,longitude:p.lon}}}});
    const r=await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{method:'POST',
      headers:{'Content-Type':'application/json','X-Goog-Api-Key':MEM_PLACES_KEY,'X-Goog-FieldMask':'originIndex,destinationIndex,duration,condition'},
      body:JSON.stringify({origins:points.map(wp),destinations:points.map(wp),travelMode:'DRIVE'})});
    if(r.ok){
      const rows=await r.json();
      rows.forEach(c=>{if(c.condition==='ROUTE_EXISTS'&&c.duration){M[c.originIndex][c.destinationIndex]=Math.round(parseInt(c.duration)/60);real=true;}});
    }
  }catch(e){}
  return {M,real};
}
function plCandidates(opts,windowMin){
  const reach=Math.max(25,windowMin*0.35);
  const home={lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  const pool=memItems.filter(m=>m.lat!=null&&(!memIsDone(m.id)||m.repeat_ok))
    .map(m=>({m,d:m.drive_min||plEstDrive(home,m)})).filter(x=>x.d<=reach);
  // Favourites always make the shortlist; the rest by closeness.
  const fav=pool.filter(x=>x.m.repeat_ok),rest=pool.filter(x=>!x.m.repeat_ok).sort((a,b)=>a.d-b.d);
  return [...fav,...rest].slice(0,PL_MAX_CANDS).map(x=>x.m);
}
async function plRun(opts){
  await memEnsureLoaded();
  const windowMin=plMin(opts.to)-plMin(opts.from);
  const cands=plCandidates(opts,windowMin);
  if(!cands.length)throw new Error('no candidates');
  const home={code:'HOME',name:'Home',lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  const pts=[home,...cands];
  const [{M,real},weather,prefs]=await Promise.all([plMatrix(pts),plWeatherFor(opts.date),plPrefs()]);
  const ages=opts.who.map(c=>{const a=memAge(c);return a!=null?`${c} (${a})`:c;}).join(', ');
  const day=new Date(opts.date+'T00:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
  const list=cands.map((m,i)=>`${m.code} | ${m.name} | ${memGroupLabel(m.trip_group)} | ${M[0][i+1]} min from home${m.repeat_ok?' | FAVOURITE (done before, loved it)':''}${m.est_minutes?` | usually ${m.est_minutes} min there`:''}${(m.kid_facts||[])[0]?` | ${m.kid_facts[0]}`:''}`).join('\n');
  const pair=cands.map((a,i)=>cands.map((b,j)=>i===j?'-':M[i+1][j+1]).join(' ')).join('\n');
  const sys=`You plan family outings for the Wallis family (home Swan View, Perth WA). Be practical and honest.
Day: ${day}. Window: leave home ${plHHMM(plMin(opts.from))}, home by ${plHHMM(plMin(opts.to))} (${windowMin} min total, including all driving).
Weather: ${weather}.
Coming: ${ages}.${opts.vibe?`\nThey said: "${opts.vibe}".`:''}
Family preferences: ${prefs||'none'}

CANDIDATES (code | name | area | drive from home | notes):
${list}

DRIVE MINUTES BETWEEN CANDIDATES (same order as above, row = from):
${pair}

Reply ONLY with JSON, no other text:
{"items":[{"code":"M012","minutes":90,"indoor":false}],
 "plans":[{"title":"short name","why":"one sentence on why this suits the day","codes":["M012","M005"]}],
 "wildcard":{"title":"short","why":"one honest sentence","search":"Google Maps search text or null"} or null}
Rules: "items" gives a realistic time-on-site for EVERY candidate and whether it's mostly indoors. Give 2 or 3 plans that genuinely fit the window including driving there, between stops and home: one that packs the most in, one easier. Suit the weather (indoors if wet, shade or water if hot). Favourites are welcome. Use the wildcard only if something off the list clearly beats the list today (e.g. perfect beach weather); otherwise null.`;
  const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
    body:JSON.stringify({model:BB_MODEL,max_tokens:3000,thinking:{type:'disabled'},system:sys,messages:[{role:'user',content:'Plan it.'}]})});
  const data=await res.json();
  const raw=data.content?.find(c=>c.type==='text')?.text||'';
  const ai=memParseAI(raw);
  if(!ai||!Array.isArray(ai.plans)){console.warn('Planner reply:',data.error||raw.slice(0,600),'stop:',data.stop_reason,'types:',(data.content||[]).map(c=>c.type).join(','),'out:',data.usage&&data.usage.output_tokens);throw new Error('bad plan reply');}
  const mins={},indoor={};
  (ai.items||[]).forEach(x=>{if(x&&x.code){mins[x.code]=Math.max(20,Math.min(360,Number(x.minutes)||60));indoor[x.code]=!!x.indoor;}});
  plCacheFacts(cands,mins,indoor);
  const plans=ai.plans.map(p=>plBuild(p,cands,M,mins,opts)).filter(p=>p&&p.stops.length);
  plLast={opts,weather,real,plans,wildcard:ai.wildcard||null,day};
  return plLast;
}
// Best visiting order (shortest total drive, home -> stops -> home), then
// trim from the end until the timeline fits the window.
function plBuild(p,cands,M,mins,opts){
  const idx=(p.codes||[]).map(c=>cands.findIndex(m=>m.code===c)).filter(i=>i>=0).slice(0,6);
  if(!idx.length)return null;
  const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));
  const cost=o=>{let c=M[0][o[0]+1];for(let k=1;k<o.length;k++)c+=M[o[k-1]+1][o[k]+1];return c+M[o[o.length-1]+1][0];};
  let order=perms(idx).reduce((best,o)=>!best||cost(o)<cost(best)?o:best,null);
  const start=plMin(opts.from),end=plMin(opts.to);
  const timeline=o=>{let t=start,prev=-1;const stops=o.map(i=>{const drive=M[prev+1][i+1];t+=drive;const arrive=t;const stay=mins[cands[i].code]||60;t+=stay;prev=i;
      return {code:cands[i].code,name:cands[i].name,id:cands[i].id,lat:cands[i].lat,lon:cands[i].lon,place:cands[i].google_place_id||null,drive,arrive,leave:t};});
    const back=M[prev+1][0];return {stops,homeAt:t+back,back};};
  let tl=timeline(order);
  while(tl.homeAt>end&&order.length>1){order=order.slice(0,-1);tl=timeline(order);}
  const driveTotal=tl.stops.reduce((a,s)=>a+s.drive,0)+tl.back;
  return {title:p.title||'Plan',why:p.why||'',stops:tl.stops,homeAt:tl.homeAt,back:tl.back,driveTotal,fits:tl.homeAt<=end};
}
async function plPrefs(){
  try{const r=await api('bravochore_memory_prefs','GET',null,'?select=suggestion_rules');return (r&&r[0]&&r[0].suggestion_rules)||'';}catch(e){return '';}
}
// Save AI time-on-site / indoor guesses on items that don't have them yet.
function plCacheFacts(cands,mins,indoor){
  cands.forEach(m=>{
    if(m.est_minutes||!mins[m.code])return;
    m.est_minutes=mins[m.code];m.indoor=indoor[m.code];
    api('bravochore_memories','PATCH',{est_minutes:m.est_minutes,indoor:m.indoor},`?id=eq.${m.id}`).catch(()=>{});
  });
}
function plMapsUrl(stops){
  const home=`${MEM_HOME.lat},${MEM_HOME.lon}`;
  const q=new URLSearchParams({api:'1',origin:home,destination:home,travelmode:'driving'});
  q.set('waypoints',stops.map(s=>`${s.lat},${s.lon}`).join('|'));
  return 'https://www.google.com/maps/dir/?'+q.toString();
}

// ---------------------------------------------------------------- results
function plShow(res,savedId){
  document.getElementById('pl-res')?.remove();
  const wrap=document.createElement('div');wrap.className='mem-overlay';wrap.id='pl-res';
  const plansHtml=res.plans.map((p,i)=>`<div class="pl-card">
      <div class="pl-card-hd"><div><div class="pl-title">${plEsc(p.title)}</div><div class="mem-sub">${p.stops.length} stop${p.stops.length>1?'s':''} · ${p.driveTotal} min driving · home ${plHHMM(p.homeAt)}</div></div></div>
      ${p.why?`<div class="pl-why">${plEsc(p.why)}</div>`:''}
      <div class="pl-tl">
        <div class="pl-tl-row pl-home"><span class="pl-t">${plHHMM(plMin(res.opts.from))}</span><span>Leave home</span></div>
        ${p.stops.map(s=>`<div class="pl-tl-drive">${s.drive} min drive</div>
          <button class="pl-tl-row" onclick="openMemory(${s.id})"><span class="pl-t">${plHHMM(s.arrive)}</span><span><b>${plEsc(s.name)}</b><span class="mem-sub"> until ${plHHMM(s.leave)}</span></span></button>`).join('')}
        <div class="pl-tl-drive">${p.back} min drive</div>
        <div class="pl-tl-row pl-home"><span class="pl-t">${plHHMM(p.homeAt)}</span><span>Home</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <a class="qa-btn pl-btn" href="${plMapsUrl(p.stops)}" target="_blank" rel="noopener">📍 Route in Maps</a>
        ${savedId?'':`<button class="qa-btn accent pl-btn" data-save="${i}">Save plan</button>`}
      </div>
    </div>`).join('');
  const wc=res.wildcard;
  wrap.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">${plEsc(res.day)}</div>
      <div class="mem-sheet-sub">${plHHMM(plMin(res.opts.from))} to ${plHHMM(plMin(res.opts.to))} · ${plEsc(res.weather)}</div></div>
      <button class="mem-x" onclick="document.getElementById('pl-res').remove()" aria-label="Close">✕</button></div>
    ${wc&&wc.title?`<div class="pl-wild"><b>${plEsc(wc.title)}</b><div>${plEsc(wc.why||'')}</div>${wc.search?`<a class="mem-link" style="display:inline;margin:0;min-height:0;padding:0;text-decoration:underline" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wc.search)}" target="_blank" rel="noopener">Open in Maps</a>`:''}</div>`:''}
    ${plansHtml||'<div class="mem-muted">Nothing fits that window. Try a longer day.</div>'}
    <div class="mem-credit" style="margin-top:10px">${res.real?'Drive times from Google, normal traffic.':'Drive times are estimates (switch on Google Routes for exact times).'} Opening hours not checked yet — tap a stop to open it in Maps.</div>
    ${savedId?`<button class="mem-link danger" id="pl-del">Delete this plan</button>`:`<button class="mem-link" onclick="document.getElementById('pl-res').remove();plOpen(plLast&&plLast.opts)">Change the day or times</button>`}
  </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{
    const p=res.plans[+b.dataset.save];b.disabled=true;b.textContent='Saving…';
    const one={...res,plans:[p]};
    try{
      await api('bravochore_memory_plans','POST',{plan_date:res.opts.date,title:p.title,plan:one,created_by:CU||null});
      b.textContent='Saved ✓';badge('ok','✓ Plan saved');
      if(typeof renderHome==='function'&&document.getElementById('view-dashboard')?.classList.contains('active'))renderHome();
    }catch(e){b.disabled=false;b.textContent='Not saved. Retry';}
  });
  const del=wrap.querySelector('#pl-del');
  if(del)del.onclick=async()=>{
    if(!del.dataset.armed){del.dataset.armed='1';del.textContent='Tap again to delete';return;}
    try{await api('bravochore_memory_plans','DELETE',null,`?id=eq.${savedId}`);wrap.remove();badge('ok','✓ Deleted');
      if(typeof renderHome==='function')renderHome();}catch(e){del.textContent='Not deleted. Retry';}
  };
}
async function plOpenSaved(id){
  try{const r=await api('bravochore_memory_plans','GET',null,`?id=eq.${id}`);if(r&&r[0])plShow(r[0].plan,id);}catch(e){chirp("Couldn't open that plan.");}
}
async function plUpcoming(){
  try{return await api('bravochore_memory_plans','GET',null,`?select=id,title,plan_date&plan_date=gte.${tdStr()}&order=plan_date.asc&limit=5`)||[];}catch(e){return [];}
}
