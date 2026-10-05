// ================================================================
// DAY PLANNER (Oct 2026). "Saturday 12-5, all of us": weather for the day,
// undone items + favourites within reach, real drive times (Google Routes,
// estimate fallback), Claude picks and explains 2-3 plans plus an honest
// wildcard, then the app re-orders each plan for the shortest drive and
// checks it fits the window. Saved plans live in bravochore_memory_plans.
// ================================================================
const PL_MAX_CANDS=14;
// Regions worth an overnight (trip_group slugs).
const PL_TRIP_REGIONS=['south-west','southern-forests','south-coast','mandurah-peel','avon-wheatbelt','north-day-trips','mid-west-coral-coast','goldfields','pilbara','broome','kimberley','interstate'];          // keeps the route matrix small (15x15 = 225 elements)
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
    <div class="mem-sheet-hdr"><div class="mem-sheet-title">Plan</div><button class="mem-x" id="pl-x" aria-label="Close">✕</button></div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <div class="filter-chip ${pre.trip?'':'active'}" data-plmode="day">A day</div>
      <div class="filter-chip ${pre.trip?'active':''}" data-plmode="trip">A trip</div>
    </div>
    <div class="mem-sheet-sub" id="pl-sub">${pre.trip?'Day-by-day route, where to stay, and links to book.':'Weather, drive times and what fits. Nothing\'s booked or saved until you say.'}</div>
    <div id="pl-tripbits" style="display:${pre.trip?'block':'none'}">
      <div class="dp-field"><label class="dp-label" for="pl-region">Where</label>
        <select class="dp-select" id="pl-region">${PL_TRIP_REGIONS.map(g=>`<option value="${g}" ${pre.region===g?'selected':''}>${plEsc(memGroupLabel(g))}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px">
        <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-nights">Nights</label><input class="dp-input" type="number" min="1" max="14" id="pl-nights" value="${pre.nights||2}"></div>
        <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-travel">Getting there</label>
          <select class="dp-select" id="pl-travel"><option value="drive" ${pre.travel==='fly'?'':'selected'}>Drive</option><option value="fly" ${pre.travel==='fly'?'selected':''}>Fly</option></select></div>
      </div>
    </div>
    <div class="dp-field"><label class="dp-label" for="pl-date" id="pl-date-lbl">${pre.trip?'Leave on':'Day'}</label><input class="dp-input" type="date" id="pl-date" value="${pre.date||plNextSat()}"></div>
    <div style="display:${pre.trip?'none':'flex'};gap:8px" id="pl-times">
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
  let mode=pre.trip?'trip':'day';
  wrap.querySelectorAll('[data-plmode]').forEach(c=>c.onclick=()=>{
    mode=c.dataset.plmode;
    wrap.querySelectorAll('[data-plmode]').forEach(x=>x.classList.toggle('active',x===c));
    const trip=mode==='trip';
    wrap.querySelector('#pl-tripbits').style.display=trip?'block':'none';
    wrap.querySelector('#pl-times').style.display=trip?'none':'flex';
    wrap.querySelector('#pl-date-lbl').textContent=trip?'Leave on':'Day';
    wrap.querySelector('#pl-sub').textContent=trip?'Day-by-day route, where to stay, and links to book.':"Weather, drive times and what fits. Nothing's booked or saved until you say.";
  });
  wrap.querySelector('#pl-go').onclick=async e=>{
    const opts={date:wrap.querySelector('#pl-date').value,from:wrap.querySelector('#pl-from').value,to:wrap.querySelector('#pl-to').value,
      who:[...wrap.querySelectorAll('.pl-chip.on')].map(c=>c.dataset.code),vibe:wrap.querySelector('#pl-vibe').value.trim()};
    if(mode==='trip'){
      opts.trip=true;opts.region=wrap.querySelector('#pl-region').value;
      opts.nights=Math.max(1,Math.min(14,parseInt(wrap.querySelector('#pl-nights').value,10)||2));
      opts.travel=wrap.querySelector('#pl-travel').value;
    }else if(!opts.date||!opts.from||!opts.to||plMin(opts.to)-plMin(opts.from)<60){chirp('Give it at least an hour.');return;}
    const b=e.currentTarget;b.disabled=true;b.textContent=mode==='trip'?'Planning the trip… (about 30 seconds)':'Checking weather and drive times…';
    try{const res=mode==='trip'?await trRun(opts):await plRun(opts);close();mode==='trip'?trShow(res):plShow(res);}
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
    const one={...res,plans:[p]};plLast=res;
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
  try{const r=await api('bravochore_memory_plans','GET',null,`?id=eq.${id}`);if(r&&r[0])(r[0].plan&&r[0].plan.trip?trShow:plShow)(r[0].plan,id);}catch(e){chirp("Couldn't open that plan.");}
}
async function plUpcoming(){
  try{return await api('bravochore_memory_plans','GET',null,`?select=id,title,plan_date&plan_date=gte.${tdStr()}&order=plan_date.asc&limit=5`)||[];}catch(e){return [];}
}

// ================================================================
// TRIPS: same engine across several days. Claude drafts the days and the
// overnight bases; the app geocodes bases, gets real drive times, orders each
// day's stops for the shortest drive, and builds Booking.com / Google Flights
// links already filled in (no booking API: Booking.com's is contract-only).
// ================================================================
const trAddDays=(d,n)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
async function trGeocode(text){const p=await memFindPlace(text);return p?{lat:p.lat,lon:p.lon,name:p.name}:null;}
function trParty(who){
  const kids=who.map(c=>({c,a:memAge(c)})).filter(x=>x.a!=null&&people.find(p=>p.code===x.c&&p.child));
  const adults=Math.max(1,who.length-kids.length);
  return {adults,ages:kids.map(k=>k.a)};
}
function trBookingUrl(base,checkin,checkout,party){
  const q=new URLSearchParams({ss:base+', Western Australia',checkin,checkout,group_adults:String(party.adults),
    group_children:String(party.ages.length),no_rooms:'1'});
  party.ages.forEach(a=>q.append('age',String(a)));
  return 'https://www.booking.com/searchresults.html?'+q.toString();
}
function trFlightsUrl(from,to,depart,ret){
  return 'https://www.google.com/travel/flights?q='+encodeURIComponent(`Flights from ${from} to ${to} on ${depart} returning ${ret}`);
}
async function trRun(o){
  await memEnsureLoaded();
  const inRegion=memItems.filter(m=>m.trip_group===o.region&&m.lat!=null&&(!memIsDone(m.id)||m.repeat_ok));
  // Include close neighbours of the region (within 120 km of its centre).
  const c=inRegion.length?{lat:inRegion.reduce((a,m)=>a+m.lat,0)/inRegion.length,lon:inRegion.reduce((a,m)=>a+m.lon,0)/inRegion.length}:null;
  const near=c?memItems.filter(m=>m.trip_group!==o.region&&m.lat!=null&&!memIsDone(m.id)&&memKm(c.lat,c.lon,m.lat,m.lon)<=120):[];
  const cands=[...inRegion,...near].slice(0,18);
  if(!cands.length)throw new Error('nothing in that region');
  const endDate=trAddDays(o.date,o.nights);
  const party=trParty(o.who);
  let weather='Forecast not available yet.';
  try{
    if(c){const k=MEM_PLACES_KEY;const r=await fetch(`https://weather.googleapis.com/v1/forecast/days:lookup?key=${k}&location.latitude=${c.lat}&location.longitude=${c.lon}&days=10&pageSize=10`).then(r=>r.json());
      const days=(r.forecastDays||[]).map(f=>{const d=f.displayDate;const ds=`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
        return {ds,t:`${ds}: ${f.daytimeForecast?.weatherCondition?.description?.text||''}, ${Math.round(f.minTemperature?.degrees)}-${Math.round(f.maxTemperature?.degrees)}°C, rain ${f.daytimeForecast?.precipitation?.probability?.percent??'?'}%`};})
        .filter(x=>x.ds>=o.date&&x.ds<=endDate);
      if(days.length)weather=days.map(x=>x.t).join(' | ');}
  }catch(e){}
  const prefs=await plPrefs();
  const ages=o.who.map(cd=>{const a=memAge(cd);return a!=null?`${cd} (${a})`:cd;}).join(', ');
  const list=cands.map(m=>`${m.code} | ${m.name} | ${m.where_text||memGroupLabel(m.trip_group)}${m.repeat_ok?' | FAVOURITE':''}${m.est_minutes?` | ~${m.est_minutes} min`:''}${m.min_age!=null?` | min age ${m.min_age}`:''}`).join('\n');
  const sys=`You plan family road trips for the Wallis family (home Swan View, Perth WA).
Trip: ${memGroupLabel(o.region)}, leaving ${o.date}, ${o.nights} night${o.nights>1?'s':''}, back ${endDate}. Getting there: ${o.travel==='fly'?'flying from Perth (PER), hire car there':'driving from home'}.
Coming: ${ages}.${o.vibe?`\nThey said: "${o.vibe}".`:''}
Weather: ${weather}
Family preferences: ${prefs||'none'}

THEIR LIST ITEMS IN AND NEAR THE AREA (code | name | where | notes):
${list}

Reply ONLY with JSON:
{"title":"short trip name","why":"one sentence",
 "items":[{"code":"M150","minutes":90}],
 "days":[{"title":"short","base":"town they sleep in that night (last day: Home)","codes":["M150"],"notes":"one practical line (food stop, swim, rest)"}],
 "fly":{"from":"PER","to":"IATA code"} or null,
 "tips":["max 3 short practical tips for this trip with these kids"]}
Rules: exactly ${o.nights+1} days. Day 1 starts ${o.travel==='fly'?'at the destination airport':'from home'}; the last day ends at home${o.travel==='fly'?' (flight back)':''}. Keep daily driving sane for kids (under ~3 hours where possible, break long drives). Use 1-3 list items a day, leave slack. Bases must be real towns. "items" gives time-on-site for every code you use.`;
  const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
    body:JSON.stringify({thinking:{type:'disabled'},model:BB_MODEL,max_tokens:3500,system:sys,messages:[{role:'user',content:'Plan the trip.'}]})});
  const data=await res.json();
  const raw=data.content?.find(x=>x.type==='text')?.text||'';
  const ai=memParseAI(raw);
  if(!ai||!Array.isArray(ai.days)){console.warn('Trip reply:',data.error||raw.slice(0,500),data.stop_reason);throw new Error('bad trip reply');}
  const mins={};(ai.items||[]).forEach(x=>{if(x&&x.code)mins[x.code]=Math.max(20,Math.min(360,Number(x.minutes)||60));});
  plCacheFacts(cands,mins,{});

  // Geocode bases (and the arrival airport when flying).
  const baseNames=[...new Set(ai.days.map(d=>d.base).filter(b=>b&&!/^home$/i.test(b)))];
  const geo={};await Promise.all(baseNames.map(async b=>{geo[b]=await trGeocode(b+', WA');}));
  const home={name:'Home',lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  let start=home;
  if(ai.fly&&ai.fly.to){const ap=await trGeocode(ai.fly.to+' airport');if(ap)start={name:ai.fly.to+' airport',lat:ap.lat,lon:ap.lon};}
  // One matrix for every point on the trip.
  const used=ai.days.flatMap(d=>d.codes||[]);
  const pts=[start,home,...baseNames.map(b=>geo[b]?{name:b,...geo[b]}:null).filter(Boolean),...cands.filter(m=>used.includes(m.code))];
  const key=p=>p.code||p.name;
  const {M,real}=await plMatrix(pts);
  const ix=p=>pts.findIndex(q=>key(q)===key(p));
  const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));

  let prev=start,date=o.date;
  const days=ai.days.map((d,n)=>{
    const last=n===ai.days.length-1;
    const end=last?(ai.fly&&ai.fly.to?start:home):(geo[d.base]?{name:d.base,...geo[d.base]}:prev);
    const stops=(d.codes||[]).map(cd=>cands.find(m=>m.code===cd)).filter(Boolean).slice(0,4);
    const cost=ord=>{let c=0,p=prev;ord.forEach(m=>{c+=M[ix(p)][ix(m)];p=m;});return c+M[ix(p)][ix(end)];};
    const order=stops.length?perms(stops).reduce((b,ord)=>!b||cost(ord)<cost(b)?ord:b,null):[];
    let t=9*60,p=prev;const tl=order.map(m=>{const drive=M[ix(p)][ix(m)];t+=drive;const arrive=t;t+=mins[m.code]||m.est_minutes||60;p=m;
      return {code:m.code,id:m.id,name:m.name,lat:m.lat,lon:m.lon,drive,arrive,leave:t};});
    const back=M[ix(p)][ix(end)];
    const out={n:n+1,date,title:d.title||`Day ${n+1}`,notes:d.notes||'',from:prev.name,to:end.name,stops:tl,back,endAt:t+back,
      fromLL:{lat:prev.lat,lon:prev.lon},toLL:{lat:end.lat,lon:end.lon},driveTotal:tl.reduce((a,x)=>a+x.drive,0)+back};
    prev=end;date=trAddDays(date,1);return out;
  });
  // Stays: consecutive nights in the same base become one booking.
  const stays=[];
  days.slice(0,-1).forEach(d=>{const s=stays[stays.length-1];
    if(s&&s.base===d.to)s.checkout=trAddDays(d.date,1);
    else stays.push({base:d.to,checkin:d.date,checkout:trAddDays(d.date,1)});});
  stays.forEach(s=>{s.nights=Math.round((new Date(s.checkout)-new Date(s.checkin))/86400000);s.url=trBookingUrl(s.base,s.checkin,s.checkout,party);});
  const flights=ai.fly&&ai.fly.to?{to:ai.fly.to,url:trFlightsUrl('Perth',ai.fly.to,o.date,endDate)}:null;
  return {trip:true,opts:o,title:ai.title||'Trip',why:ai.why||'',tips:ai.tips||[],weather,real,days,stays,flights,endDate,party};
}
function trDayMaps(d){
  const q=new URLSearchParams({api:'1',origin:`${d.fromLL.lat},${d.fromLL.lon}`,destination:`${d.toLL.lat},${d.toLL.lon}`,travelmode:'driving'});
  if(d.stops.length)q.set('waypoints',d.stops.map(s=>`${s.lat},${s.lon}`).join('|'));
  return 'https://www.google.com/maps/dir/?'+q.toString();
}
function trShow(res,savedId){
  document.getElementById('pl-res')?.remove();
  const wrap=document.createElement('div');wrap.className='mem-overlay';wrap.id='pl-res';
  const fmtD=d=>new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
  const ages=res.party.ages.length?` + ${res.party.ages.length} kids`:'';
  wrap.innerHTML=`<div class="mem-sheet tall" role="dialog" aria-modal="true">
    <div class="mem-sheet-hdr"><div><div class="mem-sheet-title">${plEsc(res.title)}</div>
      <div class="mem-sheet-sub">${fmtD(res.opts.date)} to ${fmtD(res.endDate)} · ${res.opts.nights} night${res.opts.nights>1?'s':''} · ${res.party.adults} adults${ages}</div></div>
      <button class="mem-x" onclick="document.getElementById('pl-res').remove()" aria-label="Close">✕</button></div>
    ${res.why?`<div class="pl-why" style="margin-top:0">${plEsc(res.why)}</div>`:''}
    <div class="dp-label" style="margin-top:14px">Book</div>
    ${res.flights?`<a class="pl-book" href="${res.flights.url}" target="_blank" rel="noopener"><span>✈️ Flights Perth ⇄ ${plEsc(res.flights.to)}</span><span class="mem-sub">Google Flights ›</span></a>`:''}
    ${res.stays.map(s=>`<a class="pl-book" href="${s.url}" target="_blank" rel="noopener"><span>🛏 ${plEsc(s.base)} · ${s.nights} night${s.nights>1?'s':''}</span><span class="mem-sub">${fmtD(s.checkin)} · Booking.com ›</span></a>`).join('')}
    ${res.days.map(d=>`<div class="pl-card">
      <div class="pl-title">Day ${d.n} · ${plEsc(d.title)}</div>
      <div class="mem-sub">${fmtD(d.date)} · ${plEsc(d.from)} → ${plEsc(d.to)} · ${d.driveTotal} min driving</div>
      ${d.notes?`<div class="pl-why">${plEsc(d.notes)}</div>`:''}
      <div class="pl-tl">
        <div class="pl-tl-row pl-home"><span class="pl-t">9:00am</span><span>Leave ${plEsc(d.from)}</span></div>
        ${d.stops.map(s=>`<div class="pl-tl-drive">${s.drive} min drive</div>
          <button class="pl-tl-row" onclick="openMemory(${s.id})"><span class="pl-t">${plHHMM(s.arrive)}</span><span><b>${plEsc(s.name)}</b><span class="mem-sub"> until ${plHHMM(s.leave)}</span></span></button>`).join('')}
        <div class="pl-tl-drive">${d.back} min drive</div>
        <div class="pl-tl-row pl-home"><span class="pl-t">${plHHMM(d.endAt)}</span><span>${plEsc(d.to)}</span></div>
      </div>
      <a class="qa-btn pl-btn" style="margin-top:10px" href="${trDayMaps(d)}" target="_blank" rel="noopener">📍 Day ${d.n} route in Maps</a>
    </div>`).join('')}
    ${res.tips.length?`<div class="dp-label" style="margin-top:14px">Tips</div><ul class="mem-kidfacts">${res.tips.map(t=>`<li>${plEsc(t)}</li>`).join('')}</ul>`:''}
    <div class="mem-credit" style="margin-top:10px">${plEsc(res.weather)}<br>${res.real?'Drive times from Google.':'Drive times are estimates.'} Booking links open pre-filled; you choose and book there.</div>
    ${savedId?`<button class="mem-link danger" id="pl-del">Delete this trip</button>`
      :`<div style="display:flex;gap:8px;margin-top:12px"><button class="qa-btn pl-btn" onclick="document.getElementById('pl-res').remove();plOpen(plLast&&plLast.opts)">Change it</button><button class="qa-btn accent pl-btn" id="tr-save">Save trip</button></div>`}
  </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
  plLast=res;
  const sv=wrap.querySelector('#tr-save');
  if(sv)sv.onclick=async()=>{sv.disabled=true;sv.textContent='Saving…';
    try{await api('bravochore_memory_plans','POST',{plan_date:res.opts.date,end_date:res.endDate,title:res.title,plan:res,created_by:CU||null});
      sv.textContent='Saved ✓';badge('ok','✓ Trip saved');if(typeof renderHome==='function')renderHome();}
    catch(e){sv.disabled=false;sv.textContent='Not saved. Retry';}};
  const del=wrap.querySelector('#pl-del');
  if(del)del.onclick=async()=>{
    if(!del.dataset.armed){del.dataset.armed='1';del.textContent='Tap again to delete';return;}
    try{await api('bravochore_memory_plans','DELETE',null,`?id=eq.${savedId}`);wrap.remove();badge('ok','✓ Deleted');if(typeof renderHome==='function')renderHome();}
    catch(e){del.textContent='Not deleted. Retry';}};
}
