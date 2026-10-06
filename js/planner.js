// ================================================================
// DAY PLANNER (Oct 2026). "Saturday 12-5, all of us": weather for the day,
// undone items + favourites within reach, real drive times (Google Routes,
// estimate fallback), Claude picks and explains 2-3 plans plus an honest
// wildcard, then the app re-orders each plan for the shortest drive and
// checks it fits the window. Saved plans live in bravochore_memory_plans.
// ================================================================
const PL_MAX_CANDS=22;          // shortlist cap (only home -> each is looked up for these)
// Regions worth an overnight (trip_group slugs).
// Overnight regions within ~4 hours' drive, for 'wherever the weather's best'.
const PL_NEAR_REGIONS=['south-west','southern-forests','mandurah-peel','avon-wheatbelt','north-day-trips','south-coast'];
const PL_TRIP_REGIONS=['south-west','southern-forests','south-coast','mandurah-peel','avon-wheatbelt','north-day-trips','mid-west-coral-coast','goldfields','pilbara','broome','kimberley','interstate'];
let plLast=null;                // last generated result, for Save

const plEsc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
const plHHMM=m=>{const h=Math.floor(m/60),mm=Math.round(m%60);const h12=((h+11)%12)+1;return `${h12}:${String(mm).padStart(2,'0')}${h<12?'am':'pm'}`;};
const plYMD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function plNextSat(){const d=new Date();d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));return plYMD(d);}
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
        <select class="dp-select" id="pl-region"><option value="best" ${pre.region==='best'?'selected':''}>Wherever the weather's best (within 4 hours)</option>${PL_TRIP_REGIONS.map(g=>`<option value="${g}" ${pre.region===g?'selected':''}>${plEsc(memGroupLabel(g))}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px">
        <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-nights">Nights</label><input class="dp-input" type="number" min="1" max="14" id="pl-nights" value="${pre.nights||2}"></div>
        <div class="dp-field" style="flex:1"><label class="dp-label" for="pl-travel">Getting there</label>
          <select class="dp-select" id="pl-travel"><option value="drive" ${pre.travel==='fly'?'':'selected'}>Drive</option><option value="fly" ${pre.travel==='fly'?'selected':''}>Fly</option></select></div>
      </div>
    </div>
    <div class="dp-field"><label class="dp-label" for="pl-date" id="pl-date-lbl">${pre.trip?'Leave on':'Day'}</label><input class="dp-input" type="date" id="pl-date" value="${pre.date||plNextSat()}"></div>
    <div class="dp-field" id="pl-areabits" style="display:${pre.trip?'none':'block'}"><label class="dp-label" for="pl-area">Where</label>
      <select class="dp-select" id="pl-area"><option value="">Near home</option>${Object.keys(MEM_AREAS).filter(g=>!['interstate','activities-perth','water','make-and-investigate'].includes(g)).map(g=>`<option value="${g}" ${pre.area===g?'selected':''}>Around ${plEsc(memGroupLabel(g))}</option>`).join('')}</select></div>
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
    wrap.querySelector('#pl-areabits').style.display=trip?'none':'block';
    wrap.querySelector('#pl-date-lbl').textContent=trip?'Leave on':'Day';
    wrap.querySelector('#pl-sub').textContent=trip?'Day-by-day route, where to stay, and links to book.':"Weather, drive times and what fits. Nothing's booked or saved until you say.";
  });
  wrap.querySelector('#pl-go').onclick=async e=>{
    const opts={date:wrap.querySelector('#pl-date').value,from:wrap.querySelector('#pl-from').value,to:wrap.querySelector('#pl-to').value,
      who:[...wrap.querySelectorAll('.pl-chip.on')].map(c=>c.dataset.code),vibe:wrap.querySelector('#pl-vibe').value.trim(),
      area:wrap.querySelector('#pl-area').value};
    // "a packed day in Mandurah" picks the area even if the dropdown wasn't touched.
    if(!opts.area&&mode!=='trip')opts.area=plDetectArea(opts.vibe);
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
  if(!d)return {text:'No forecast yet (more than 10 days out). Plan for typical weather.',day:null};
  return {text:`${d.desc}, ${d.min}-${d.max}°C, ${d.rain??'?'}% chance of rain${isNaN(d.wind)?'':`, wind ${d.wind} km/h`}${d.uv!=null?`, UV ${d.uv}`:''}`,day:d};
}
// Real drive minutes via Google Routes (estimate fallback per cell). Billed per
// origin x destination pair, so callers ask only for the pairs they need:
// home -> shortlist to rank, then each plan's own few stops.
async function plMatrix(points,dests){
  dests=dests||points;
  const M=points.map(a=>dests.map(b=>a===b?0:plEstDrive(a,b)));
  let real=false;
  try{
    const wp=p=>({waypoint:{location:{latLng:{latitude:p.lat,longitude:p.lon}}}});
    const r=await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{method:'POST',
      headers:{'Content-Type':'application/json','X-Goog-Api-Key':MEM_PLACES_KEY,'X-Goog-FieldMask':'originIndex,destinationIndex,duration,condition'},
      body:JSON.stringify({origins:points.map(wp),destinations:dests.map(wp),travelMode:'DRIVE'})});
    if(r.ok){
      const rows=await r.json();
      rows.forEach(c=>{if(c.condition==='ROUTE_EXISTS'&&c.duration){M[c.originIndex][c.destinationIndex]=Math.round(parseInt(c.duration)/60);real=true;}});
    }
  }catch(e){}
  return {M,real};
}
function plDetectArea(text){
  const t=' '+String(text||'').toLowerCase().replace(/[^a-z ]/g,' ')+' ';
  if(t.trim().length<3)return '';
  for(const g of Object.keys(MEM_AREAS)){
    if(['activities-perth','water','make-and-investigate','interstate'].includes(g))continue;
    const words=new Set(memGroupLabel(g).toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!['city','coast','north','south','west','east','hills','trips'].includes(w)));
    memItems.filter(m=>m.trip_group===g).forEach(m=>String(m.where_text||'').toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).forEach(w=>{if(w.length>=6)words.add(w);}));
    for(const w of words)if(t.includes(' '+w+' '))return g;
  }
  return '';
}
function plCandidates(opts,windowMin){
  if(opts.area){
    // A chosen area: draw from around it, whatever its group, closest first.
    const c=trCentre(opts.area);
    if(c){
      const youngest0=Math.min(99,...opts.who.map(x=>memAge(x)).filter(a=>a!=null));
      const n0=Math.min(PL_MAX_CANDS,8+Math.round(windowMin/60*1.5));
      return memItems.filter(m=>m.lat!=null&&(!memIsDone(m.id)||m.repeat_ok)&&!(m.min_age!=null&&youngest0<m.min_age)&&memKm(c.lat,c.lon,m.lat,m.lon)<=40)
        .sort((a,b)=>memKm(c.lat,c.lon,a.lat,a.lon)-memKm(c.lat,c.lon,b.lat,b.lon)).slice(0,n0);
    }
  }
  const reach=Math.max(25,windowMin*0.35);
  const home={lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  // Leave out anything the youngest coming is too young for.
  const youngest=Math.min(99,...opts.who.map(c=>memAge(c)).filter(a=>a!=null));
  const pool=memItems.filter(m=>m.lat!=null&&(!memIsDone(m.id)||m.repeat_ok)&&!(m.min_age!=null&&youngest<m.min_age))
    .map(m=>({m,d:m.drive_min||plEstDrive(home,m)})).filter(x=>x.d<=reach);
  // Favourites always make the shortlist; the rest by closeness.
  const fav=pool.filter(x=>x.m.repeat_ok),rest=pool.filter(x=>!x.m.repeat_ok).sort((a,b)=>a.d-b.d);
  const n=Math.min(PL_MAX_CANDS,8+Math.round(windowMin/60*1.5));
  return [...fav,...rest].slice(0,n).map(x=>x.m);
}
async function plRun(opts){
  await memEnsureLoaded();
  const windowMin=plMin(opts.to)-plMin(opts.from);
  const cands=plCandidates(opts,windowMin);
  if(!cands.length)throw new Error('no candidates');
  const home={code:'HOME',name:'Home',lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  const [{M:H,real},wx,prefs]=await Promise.all([plMatrix([home],cands),plWeatherFor(opts.date),plPrefs()]);
  const fromHome=cands.map((m,i)=>H[0][i]);
  const ages=opts.who.map(c=>{const a=memAge(c);return a!=null?`${c} (${a})`:c;}).join(', ');
  const day=new Date(opts.date+'T00:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
  const list=cands.map((m,i)=>`${m.code} | ${m.name} | ${memGroupLabel(m.trip_group)} | ${fromHome[i]} min from home${m.repeat_ok?' | FAVOURITE':''}${m.age_note?` | ages: ${m.age_note}`:''}${(m.kid_facts||[])[0]?` | ${m.kid_facts[0]}`:''}`).join('\n');
  const pair=cands.map((a,i)=>cands.map((b,j)=>i===j?'-':plEstDrive(a,b)).join(' ')).join('\n');
  const sys=`You plan family days out for the Wallis family (home Swan View, Perth WA). Be practical, generous with time, and honest.
Day: ${day}. They can leave home at ${plHHMM(plMin(opts.from))} and want to be home by ${plHHMM(plMin(opts.to))}: that's ${Math.round(windowMin/6)/10} hours, and they want to USE it.
Weather: ${wx.text}.
Coming: ${ages}.${opts.vibe?`\nThey said: "${opts.vibe}".`:''}${opts.area?`\nWhere: around ${memGroupLabel(opts.area)}. Every plan must be centred there; the drive there and back is part of the day.`:''}
Family preferences: ${prefs||'none'}

CANDIDATES (code | name | area | drive from home | notes):
${list}

APPROX DRIVE MINUTES BETWEEN CANDIDATES (row = from, same order):
${pair}

Reply ONLY with JSON, no other text:
{"weather_take":"one plain line on what this weather means for the day (e.g. 'Warm and dry: great for outdoors, find shade after 2pm')",
 "items":[{"code":"M012","minutes":150,"ok":true}],
 "extras":[{"ref":"X1","name":"short name","search":"Google Maps search text, e.g. 'Mandurah foreshore playground'","minutes":60}],
 "plans":[{"title":"2 to 6 words, final wording only","why":"one sentence","codes":["M012","X1","M005"]}],
 "wildcard":{"title":"short","why":"one honest sentence","search":"Google Maps search text or null"} or null}
Rules:
- Every plan should fill the day: arrive home within about 45 minutes of the home-by time. The easy plan may finish up to 90 minutes early, no more. A plan that gets them home hours early is wrong.
- Real family time on site, including food: a park, dam or lookout with picnic or BBQ facilities (e.g. Fred Jacoby, North or South Ledge, John Forrest, Lake Leschenaultia) is lunch there, 2-3 hours; animal parks and farms 1.5-2.5 hours; a museum or attraction 1.5-2 hours; a quick look 30-45 minutes. A 1-year-old means a slower pace and a rest.
- Each plan includes a proper lunch stop (picnic or BBQ at a park counts) and suits the weather (indoors if wet, shade or water if hot).
- Give 3 plans: one that packs the most in, one easier, one different in style or area. Favourites are welcome.
- "items" covers EVERY candidate: realistic minutes, and "ok": false if it is wrong for this day (out of season, e.g. Christmas lights in October; likely closed; unsuitable for this weather or these kids). The app may add "ok" items to fill gaps.
- "extras": up to 3 good stops NOT on their list (a beach, playground, lunch spot, lookout) when the list alone can't make a full, sensible day in the right place. Use them in plans by their ref. Leave [] if not needed.
- Wildcard only if something off the list clearly beats the list today (e.g. perfect beach weather); otherwise null.`;
  const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
    body:JSON.stringify({model:BB_MODEL,max_tokens:4000,thinking:{type:'disabled'},system:sys,messages:[{role:'user',content:'Plan it.'}]})});
  const data=await res.json();
  const raw=data.content?.find(c=>c.type==='text')?.text||'';
  const ai=memParseAI(raw);
  if(!ai||!Array.isArray(ai.plans)){console.warn('Planner reply:',data.error||raw.slice(0,600),'stop:',data.stop_reason);throw new Error('bad plan reply');}
  const mins={},okFor=new Set();
  (ai.items||[]).forEach(x=>{if(x&&x.code){mins[x.code]=Math.max(20,Math.min(420,Number(x.minutes)||90));if(x.ok===true)okFor.add(x.code);}});
  // Off-list extras: look them up on Google so they can sit in the route.
  const extras=[];
  for(const x of (Array.isArray(ai.extras)?ai.extras:[]).slice(0,3)){
    if(!x||!x.ref||!x.search)continue;
    const pl=await memFindPlace(x.search+', WA');
    if(pl&&pl.lat!=null){const e={code:x.ref,name:x.name||pl.name,id:null,lat:pl.lat,lon:pl.lon,google_place_id:pl.id,extra:true,search:x.search};
      extras.push(e);mins[x.ref]=Math.max(20,Math.min(240,Number(x.minutes)||60));okFor.add(x.ref);}
  }
  const pool=[...cands,...extras];
  // The model is good at choosing and bad at arithmetic, so the app fills the
  // day itself: top up short plans with the next-best nearby stop, then give
  // each stop more time, until it ends close to the home-by time.
  const plans=[],start=plMin(opts.from),end=plMin(opts.to);
  for(const p of ai.plans){
    let stops=(p.codes||[]).map(c=>pool.find(m=>m.code===c)).filter(Boolean).slice(0,6);
    if(!stops.length)continue;
    const pm={...mins};stops.forEach(m=>{if(!pm[m.code])pm[m.code]=90;});
    const estEnd=st=>{let t=start,prev=home;st.forEach(m=>{t+=plEstDrive(prev,m)+pm[m.code];prev=m;});return t+plEstDrive(prev,home);};
    while(stops.length<6&&end-estEnd(stops)>75){
      let best=null;
      pool.filter(m=>!stops.includes(m)&&okFor.has(m.code)).forEach(m=>{
        const mm=pm[m.code]||mins[m.code]||90;
        // cheapest place to slot it in
        for(let k=0;k<=stops.length;k++){const tr=[...stops.slice(0,k),m,...stops.slice(k)];pm[m.code]=mm;const e=estEnd(tr);
          if(e<=end-20&&(!best||e-mm<best.score))best={tr,score:e-mm,code:m.code,mm};}
        if(!best||best.code!==m.code)delete pm[m.code];
      });
      if(!best)break;pm[best.code]=best.mm;stops=best.tr;
    }
    let {M}=await plMatrix([home,...stops]);
    let b=plBuild({...p,codes:stops.map(m=>m.code)},stops,M,pm,opts);
    if(!b||!b.stops.length)continue;
    if(b.spare>45){
      const extra=b.spare-30,total=b.stops.reduce((a,x)=>a+(pm[x.code]||90),0);
      b.stops.forEach(x=>{const base=pm[x.code]||90;pm[x.code]=Math.round(base+Math.min(base*0.6,extra*base/total));});
      b=plBuild({...p,codes:stops.map(m=>m.code)},stops,M,pm,opts);
    }
    if(b&&b.stops.length){const orig=new Set(p.codes||[]);b.stops.forEach(x=>{x.added=!orig.has(x.code);});plans.push(b);}
  }
  plLast={opts,weather:wx.text,wxDay:wx.day,weatherTake:ai.weather_take||'',real,plans,wildcard:ai.wildcard||null,day};
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
      return {code:cands[i].code,name:cands[i].name,id:cands[i].id,lat:cands[i].lat,lon:cands[i].lon,place:cands[i].google_place_id||null,extra:!!cands[i].extra,search:cands[i].search||null,drive,arrive,leave:t};});
    const back=M[prev+1][0];return {stops,homeAt:t+back,back};};
  let tl=timeline(order);
  while(tl.homeAt>end&&order.length>1){order=order.slice(0,-1);tl=timeline(order);}
  const driveTotal=tl.stops.reduce((a,s)=>a+s.drive,0)+tl.back;
  return {title:p.title||'Plan',why:p.why||'',stops:tl.stops,homeAt:tl.homeAt,back:tl.back,driveTotal,fits:tl.homeAt<=end,spare:end-tl.homeAt};
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
function plWxCard(res){
  const d=res.wxDay;
  if(!d)return `<div class="pl-wx"><div class="pl-wx-main"><span class="pl-wx-ic">🌤</span><div><b>No forecast yet</b><div class="mem-sub">More than 10 days out.</div></div></div></div>`;
  return `<div class="pl-wx"><div class="pl-wx-main">${d.icon?`<img class="pl-wx-img" src="${d.icon}.svg" alt="">`:''}
      <div><b>${plEsc(d.desc)}</b><div class="pl-wx-nums"><span class="pl-wx-hi">${d.max}°</span><span class="mem-sub"> / ${d.min}°</span>
      <span class="mem-sub"> · 💧 ${d.rain??'?'}%${isNaN(d.wind)?'':` · 💨 ${d.wind} km/h`}${d.uv!=null?` · UV ${d.uv}`:''}</span></div></div></div>
    ${res.weatherTake?`<div class="pl-wx-take">${plEsc(res.weatherTake)}</div>`:''}</div>`;
}

function plShow(res,savedId){
  document.getElementById('pl-res')?.remove();
  const wrap=document.createElement('div');wrap.className='mem-overlay';wrap.id='pl-res';
  const plansHtml=res.plans.map((p,i)=>`<div class="pl-card">
      <div class="pl-card-hd"><div><div class="pl-title">${plEsc(p.title)}</div><div class="mem-sub">${p.stops.length} stop${p.stops.length>1?'s':''} · ${p.driveTotal} min driving · home ${plHHMM(p.homeAt)}${p.spare>90?` · <span class="home-today">${Math.round(p.spare/6)/10}h spare</span>`:''}</div></div></div>
      ${p.why?`<div class="pl-why">${plEsc(p.why)}</div>`:''}
      <div class="pl-tl">
        <div class="pl-tl-row pl-home"><span class="pl-t">${plHHMM(plMin(res.opts.from))}</span><span>Leave home</span></div>
        ${p.stops.map(s=>`<div class="pl-tl-drive">${s.drive<2?'same area':s.drive+' min drive'}</div>
          <button class="pl-tl-row" onclick="${s.extra?`window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.search||s.name)}${s.place?'&query_place_id='+s.place:''}','_blank','noopener')`:`openMemory(${s.id})`}"><span class="pl-t">${plHHMM(s.arrive)}</span><span><b>${plEsc(s.name)}</b><span class="mem-sub"> until ${plHHMM(s.leave)}${s.extra?' · not on your list':s.added?' · added to fill your day':''}</span></span></button>`).join('')}
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
      <div class="mem-sheet-sub">${plHHMM(plMin(res.opts.from))} to ${plHHMM(plMin(res.opts.to))}</div></div>
      <button class="mem-x" onclick="document.getElementById('pl-res').remove()" aria-label="Close">✕</button></div>
    ${plWxCard(res)}
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
const trAddDays=(d,n)=>{const [y,m,dd]=d.split('-').map(Number);return plYMD(new Date(y,m-1,dd+n));};
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
function trCentre(g){
  const its=memItems.filter(m=>m.trip_group===g&&m.lat!=null);
  return its.length?{lat:its.reduce((a,m)=>a+m.lat,0)/its.length,lon:its.reduce((a,m)=>a+m.lon,0)/its.length}:null;
}
async function trForecast(c,from,to){
  try{
    const r=await fetch(`https://weather.googleapis.com/v1/forecast/days:lookup?key=${MEM_PLACES_KEY}&location.latitude=${c.lat}&location.longitude=${c.lon}&days=10&pageSize=10`).then(r=>r.json());
    return (r.forecastDays||[]).map(f=>{const d=f.displayDate,day=f.daytimeForecast||{};
      return {date:`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`,desc:day.weatherCondition?.description?.text||'',
        icon:day.weatherCondition?.iconBaseUri||'',max:Math.round(f.maxTemperature?.degrees),min:Math.round(f.minTemperature?.degrees),
        rain:day.precipitation?.probability?.percent??null};}).filter(x=>x.date>=from&&x.date<=to);
  }catch(e){return [];}
}
// Higher is nicer: dry, and close to 24°C.
function trWxScore(days){if(!days.length)return null;return days.reduce((a,d)=>a+(100-(d.rain??20))-Math.abs(d.max-24)*3,0)/days.length;}
async function trRun(o){
  await memEnsureLoaded();
  const youngest=Math.min(99,...o.who.map(c=>memAge(c)).filter(a=>a!=null));
  const tooYoung=m=>m.min_age!=null&&youngest<m.min_age;
  const endDate=trAddDays(o.date,o.nights);
  // "Wherever the weather's best": score each nearby region's forecast for the
  // trip dates (dry, and close to 24°C) and go with the winner.
  let region=o.region,regionWhy='';
  if(region==='best'){
    const scored=(await Promise.all(PL_NEAR_REGIONS.map(async g=>{const c=trCentre(g);if(!c)return null;
      const d=await trForecast(c,o.date,endDate);return {g,d,score:trWxScore(d)};}))).filter(x=>x&&x.score!=null).sort((a,b)=>b.score-a.score);
    if(scored.length){
      region=scored[0].g;
      const sum=x=>`${x.d[0].desc.toLowerCase()}, up to ${Math.max(...x.d.map(d=>d.max))}°, ${Math.max(...x.d.map(d=>d.rain??0))}% rain`;
      regionWhy=`Best weather: ${memGroupLabel(region)} (${sum(scored[0])})${scored[1]?`. Next best ${memGroupLabel(scored[1].g)} (${sum(scored[1])})`:''}.`;
    }else{region='south-west';regionWhy="No forecast yet for those dates, so I went with the South West.";}
  }
  const inRegion=memItems.filter(m=>m.trip_group===region&&m.lat!=null&&(!memIsDone(m.id)||m.repeat_ok)&&!tooYoung(m));
  // Include close neighbours of the region (within 120 km of its centre).
  const c=trCentre(region);
  const near=c?memItems.filter(m=>m.trip_group!==region&&m.lat!=null&&!memIsDone(m.id)&&!tooYoung(m)&&memKm(c.lat,c.lon,m.lat,m.lon)<=120):[];
  const cands=[...inRegion,...near].slice(0,22);
  if(!cands.length)throw new Error('nothing in that region');
  const party=trParty(o.who);
  const wxDays=c?await trForecast(c,o.date,endDate):[];
  const weather=wxDays.length?wxDays.map(d=>`${d.date}: ${d.desc}, ${d.min}-${d.max}°C, rain ${d.rain??'?'}%`).join(' | '):'Forecast not available yet.';
  const prefs=await plPrefs();
  const ages=o.who.map(cd=>{const a=memAge(cd);return a!=null?`${cd} (${a})`:cd;}).join(', ');
  const list=cands.map(m=>`${m.code} | ${m.name} | ${m.where_text||memGroupLabel(m.trip_group)}${m.repeat_ok?' | FAVOURITE':''}${m.est_minutes?` | ~${m.est_minutes} min`:''}${m.age_note?` | ages: ${m.age_note}`:''}`).join('\n');
  const sys=`You plan family road trips for the Wallis family (home Swan View, Perth WA).
Trip: ${memGroupLabel(region)}, leaving ${o.date}, ${o.nights} night${o.nights>1?'s':''}, back ${endDate}. Getting there: ${o.travel==='fly'?'flying from Perth (PER), hire car there':'driving from home'}.
Coming: ${ages}.${o.vibe?`\nThey said: "${o.vibe}".`:''}
Weather: ${weather}
Family preferences: ${prefs||'none'}

THEIR LIST ITEMS IN AND NEAR THE AREA (code | name | where | notes):
${list}

Reply ONLY with JSON:
{"title":"short trip name","why":"one sentence",
 "items":[{"code":"M150","minutes":90,"ok":true}],
 "days":[{"title":"short","base":"town they sleep in that night (last day: Home)","codes":["M150"],"notes":"one practical line (food stop, swim, rest)"}],
 "fly":{"from":"PER","to":"IATA code"} or null,
 "tips":["max 3 short practical tips for this trip with these kids"]}
Rules: exactly ${o.nights+1} days, each roughly 9am to 5:30pm, and fill them: real family time on site (a picnic or BBQ spot is lunch there, 2-3 hours; attractions 1.5-2.5 hours). Day 1 starts ${o.travel==='fly'?'at the destination airport':'from home'}; the last day ends at home${o.travel==='fly'?' (flight back)':''}. Keep daily driving sane for kids (under ~3 hours where possible, break long drives). Use 1-3 list items a day, leave slack. Bases must be real towns. "items" covers EVERY candidate: time on site, and "ok": false if it is wrong for these dates (out of season, e.g. Christmas lights in October; closed; unsuitable for this weather or these kids). The app may add "ok" items to fill gaps.`;
  const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':await bcBearer()},
    body:JSON.stringify({thinking:{type:'disabled'},model:BB_MODEL,max_tokens:5000,system:sys,messages:[{role:'user',content:'Plan the trip.'}]})});
  const data=await res.json();
  const raw=data.content?.find(x=>x.type==='text')?.text||'';
  const ai=memParseAI(raw);
  if(!ai||!Array.isArray(ai.days)){console.warn('Trip reply:',data.error||raw.slice(0,500),data.stop_reason);throw new Error('bad trip reply');}
  const mins={},okFor=new Set();(ai.items||[]).forEach(x=>{if(x&&x.code){mins[x.code]=Math.max(20,Math.min(360,Number(x.minutes)||60));if(x.ok===true)okFor.add(x.code);}});

  // Geocode bases (and the arrival airport when flying).
  const baseNames=[...new Set(ai.days.map(d=>d.base).filter(b=>b&&!/^home$/i.test(b)))];
  const geo={};await Promise.all(baseNames.map(async b=>{geo[b]=await trGeocode(b+', WA');}));
  const home={name:'Home',lat:MEM_HOME.lat,lon:MEM_HOME.lon};
  let start=home;
  if(ai.fly&&ai.fly.to){const ap=await trGeocode(ai.fly.to+' airport');if(ap)start={name:ai.fly.to+' airport',lat:ap.lat,lon:ap.lon};}
  // Drive times per day, for that day's points only (cheap and exact).
  const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));
  let real=false;
  let prev=start,date=o.date;
  const usedCodes=new Set();
  const days=[];
  for(let n=0;n<ai.days.length;n++){
    const d=ai.days[n],last=n===ai.days.length-1;
    const end=last?(ai.fly&&ai.fly.to?start:home):(geo[d.base]?{name:d.base,...geo[d.base]}:prev);
    let stops=(d.codes||[]).map(cd=>cands.find(m=>m.code===cd)&&!usedCodes.has(cd)?cands.find(m=>m.code===cd):null).filter(Boolean).slice(0,4);
    stops.forEach(m=>{usedCodes.add(m.code);if(!mins[m.code])mins[m.code]=90;});
    // Top up a short day with the best nearby unused item (estimates first).
    const dayEnd=17*60+30,estEnd=st=>{let t=9*60,p0=prev;st.forEach(m=>{t+=plEstDrive(p0,m)+mins[m.code];p0=m;});return t+plEstDrive(p0,end);};
    while(stops.length<4&&dayEnd-estEnd(stops)>90){
      let best=null;
      cands.filter(m=>!usedCodes.has(m.code)&&okFor.has(m.code)).forEach(m=>{const mm=mins[m.code]||90,had=mins[m.code];mins[m.code]=mm;
        for(let k=0;k<=stops.length;k++){const tr=[...stops.slice(0,k),m,...stops.slice(k)],e=estEnd(tr);
          if(e<=dayEnd&&(!best||e-mm<best.score))best={tr,score:e-mm,m};}
        if(had===undefined&&(!best||best.m!==m))delete mins[m.code];});
      if(!best)break;stops=best.tr;usedCodes.add(best.m.code);best.m._added=true;
    }
    const pts=[prev,...stops,end];
    const r=await plMatrix(pts);if(r.real)real=true;
    const M=r.M,ix=p=>pts.indexOf(p);
    const cost=ord=>{let c=0,p=prev;ord.forEach(m=>{c+=M[ix(p)][ix(m)];p=m;});return c+M[ix(p)][ix(end)];};
    const order=stops.length?perms(stops).reduce((b,ord)=>!b||cost(ord)<cost(b)?ord:b,null):[];
    const tlOf=()=>{let t=9*60,p=prev;const tl=order.map(m=>{const drive=M[ix(p)][ix(m)];t+=drive;const arrive=t;t+=mins[m.code]||90;p=m;
      return {code:m.code,id:m.id,name:m.name,lat:m.lat,lon:m.lon,drive,arrive,leave:t,added:!!m._added};});return {tl,back:M[ix(p)][ix(end)]};};
    let {tl,back}=tlOf();
    // Then stretch stops so the day ends near 5:30pm.
    const spare=dayEnd-((tl.length?tl[tl.length-1].leave:9*60)+back);
    if(spare>60&&order.length){const tot=order.reduce((a,m)=>a+(mins[m.code]||90),0);
      order.forEach(m=>{const b=mins[m.code]||90;mins[m.code]=Math.round(b+Math.min(b*0.6,(spare-30)*b/tot));});({tl,back}=tlOf());}
    const t=(tl.length?tl[tl.length-1].leave:9*60);
    const wxd=wxDays.find(w=>w.date===date)||null;
    days.push({n:n+1,date,wx:wxd,title:d.title||`Day ${n+1}`,notes:d.notes||'',from:prev.name,to:end.name,stops:tl,back,endAt:t+back,
      fromLL:{lat:prev.lat,lon:prev.lon},toLL:{lat:end.lat,lon:end.lon},driveTotal:tl.reduce((a,x)=>a+x.drive,0)+back});
    prev=end;date=trAddDays(date,1);
  }
  // Stays: consecutive nights in the same base become one booking.
  const stays=[];
  days.slice(0,-1).forEach(d=>{const s=stays[stays.length-1];
    if(s&&s.base===d.to)s.checkout=trAddDays(d.date,1);
    else stays.push({base:d.to,checkin:d.date,checkout:trAddDays(d.date,1)});});
  stays.forEach(s=>{s.nights=Math.round((new Date(s.checkout)-new Date(s.checkin))/86400000);s.url=trBookingUrl(s.base,s.checkin,s.checkout,party);});
  const flights=ai.fly&&ai.fly.to?{to:ai.fly.to,url:trFlightsUrl('Perth',ai.fly.to,o.date,endDate)}:null;
  cands.forEach(m=>{delete m._added;});
  return {trip:true,opts:o,region,regionWhy,title:ai.title||'Trip',why:ai.why||'',tips:ai.tips||[],weather,real,days,stays,flights,endDate,party};
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
    ${res.regionWhy?`<div class="pl-wx-take" style="margin:0 0 6px">☀️ ${plEsc(res.regionWhy)}</div>`:''}
    ${res.why?`<div class="pl-why" style="margin-top:0">${plEsc(res.why)}</div>`:''}
    <div class="dp-label" style="margin-top:14px">Book</div>
    ${res.flights?`<a class="pl-book" href="${res.flights.url}" target="_blank" rel="noopener"><span>✈️ Flights Perth ⇄ ${plEsc(res.flights.to)}</span><span class="mem-sub">Google Flights ›</span></a>`:''}
    ${res.stays.map(s=>`<a class="pl-book" href="${s.url}" target="_blank" rel="noopener"><span>🛏 ${plEsc(s.base)} · ${s.nights} night${s.nights>1?'s':''}</span><span class="mem-sub">${fmtD(s.checkin)} · Booking.com ›</span></a>`).join('')}
    ${res.days.map(d=>`<div class="pl-card">
      <div class="pl-title">Day ${d.n} · ${plEsc(d.title)}</div>
      <div class="mem-sub">${fmtD(d.date)} · ${plEsc(d.from)} → ${plEsc(d.to)} · ${d.driveTotal} min driving</div>
      ${d.wx?`<div class="pl-daywx">${d.wx.icon?`<img src="${d.wx.icon}.svg" alt="">`:''}<span><b>${plEsc(d.wx.desc)}</b> ${d.wx.max}° / ${d.wx.min}° · 💧 ${d.wx.rain??'?'}%</span></div>`:''}
      ${d.notes?`<div class="pl-why">${plEsc(d.notes)}</div>`:''}
      <div class="pl-tl">
        <div class="pl-tl-row pl-home"><span class="pl-t">9:00am</span><span>Leave ${plEsc(d.from)}</span></div>
        ${d.stops.map(s=>`<div class="pl-tl-drive">${s.drive<2?'same area':s.drive+' min drive'}</div>
          <button class="pl-tl-row" onclick="openMemory(${s.id})"><span class="pl-t">${plHHMM(s.arrive)}</span><span><b>${plEsc(s.name)}</b><span class="mem-sub"> until ${plHHMM(s.leave)}${s.added?' · added to fill your day':''}</span></span></button>`).join('')}
        <div class="pl-tl-drive">${d.back} min drive</div>
        <div class="pl-tl-row pl-home"><span class="pl-t">${plHHMM(d.endAt)}</span><span>${plEsc(d.to)}</span></div>
      </div>
      <a class="qa-btn pl-btn" style="margin-top:10px" href="${trDayMaps(d)}" target="_blank" rel="noopener">📍 Day ${d.n} route in Maps</a>
    </div>`).join('')}
    ${res.tips.length?`<div class="dp-label" style="margin-top:14px">Tips</div><ul class="mem-kidfacts">${res.tips.map(t=>`<li>${plEsc(t)}</li>`).join('')}</ul>`:''}
    <div class="mem-credit" style="margin-top:10px">${res.days.some(d=>d.wx)?'':'No forecast yet for these dates (more than 10 days out). '}${res.real?'Drive times from Google.':'Drive times are estimates.'} Booking links open pre-filled; you choose and book there.</div>
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
