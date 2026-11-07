// ================================================================
// WALL MODE (Phase 4). What the wall tablet shows when nobody's using it:
// big clock, weather, today and the next few days, both kids' boards with
// any running timer, and the faces to tap in. After a few quiet minutes it
// becomes a photo frame (family Memories photos first). Data refreshes
// every 10 minutes, never while someone is typing.
// ================================================================
let wallTimer=null,wallSec=null,wallIdle=null,wallShow=null,wallPhotos=[],wallPhotoAt=0,wallLastLoad=0;
const WALL_SLIDES_AFTER=3*60*1000;

async function wallLoad(force){
  if(!force&&Date.now()-wallLastLoad<10*60*1000)return;
  wallLastLoad=Date.now();
  await Promise.all([
    typeof kjLoad==='function'?kjLoad(true).catch(()=>{}):null,
    typeof kbLoad==='function'?kbLoad(true).catch(()=>{}):null,
    typeof calLoad==='function'?calLoad(true).catch(()=>{}):null,
    typeof mlLoad==='function'?mlLoad(true).catch(()=>{}):null,
    typeof loadEvents==='function'?loadEvents().catch(()=>{}):null]);
}
// A running timer (started by a grown-up) shows big on the kid's card.
function wallKidTimer(kid){
  const day=tdStr();const x=kjRunning(day).filter(y=>y.j.kid===kid).sort((a,b)=>a.t.ends_at.localeCompare(b.t.ends_at))[0];
  if(!x)return '';
  const by=new Date(x.t.ends_at).getTime(),left=Math.max(0,by-Date.now());
  return `<div class="wall-timer">${hhEsc(x.j.icon||'⏱')} ${hhEsc(x.j.title)} <span class="kj-count" data-by="${by}">${Math.floor(left/60000)}:${String(Math.floor(left%60000/1000)).padStart(2,'0')}</span></div>`;
}
function wallKid(k){
  const s=kjSummary(k.code,tdStr());const pct=s.all?Math.round(s.allDone/s.all*100):0;
  const lock=s.gate==='open'?'🔓':s.gate==='locked'?(s.reprieve?'🙈':'🔒'):'🔒';
  const next=s.jobs.find(j=>kjState(j,tdStr())==='open');
  return `<button class="wall-kid hh-face" data-code="${hhEsc(k.code)}">
    <div class="wall-ring" style="--p:${pct};--c:${k.color}"><span class="wall-ring-av" style="background:${k.bg}">${hhEsc(k.avatar||k.code)}</span></div>
    <div class="wall-kid-b"><div class="wall-kid-n">${hhEsc(k.name)}</div>
      <div class="wall-kid-s">${s.allDone}/${s.all} jobs ${lock} · <b>${kjMoney(s.earned)}</b></div>
      ${next?`<div class="wall-kid-next">Next: ${hhEsc(next.icon||'')} ${hhEsc(next.title)}</div>`:'<div class="wall-kid-next">All done today! 🌟</div>'}
      ${wallKidTimer(k.code)}</div></button>`;
}
function wallHtml(){
  const now=new Date(),t=tdStr();
  const kids=typeof kjKids==='function'?kjKids():[];
  const adults=people.filter(p=>p.kind==='adult'&&p.on_tablet);
  const days=[0,1,2].map(i=>kjAddDays(t,i));
  const team=typeof kjTeam==='function'&&kids.length?kjTeam(t):null;
  const wx=(()=>{try{return JSON.parse(localStorage.getItem('bc_wx')||'null');}catch(e){return null;}})();
  return `<div class="wall">
    <div class="wall-l">
      <div class="wall-clock">${now.getHours()%12||12}:${String(now.getMinutes()).padStart(2,'0')}<span class="wall-ampm">${now.getHours()<12?'am':'pm'}</span></div>
      <div class="wall-date">${now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}${wx&&typeof homeWxText==='function'?`<span class="wall-wx">${homeWxText(wx)}</span>`:''}</div>
      ${typeof mlTonight==='function'&&mlLoaded&&mlTonight()?`<div class="wall-tea">🍽️ Tea tonight: <b>${hhEsc(mlTonight().title)}</b></div>`:''}
      <div class="wall-cal">${typeof calItems==='function'?days.map(d=>{const items=calItems(d,true);
        return `<div class="wall-day"><div class="wall-day-h">${d===t?'Today':d===days[1]?'Tomorrow':KJ_DOW_LONG[kjDowOf(d)]}</div>
          ${items.map(x=>`<div class="wall-item"><span>${hhEsc(x.icon)}</span><b>${hhEsc(x.title)}</b>${x.time?`<i>${calFmtTime(x.time)}</i>`:''}</div>`).join('')||'<div class="wall-item none">Nothing on</div>'}</div>`;}).join(''):''}</div>
    </div>
    <div class="wall-r">
      ${team?`<div class="wall-team"><span>🤝 Team today</span><div class="km-bar"><div style="width:${team.pct}%"></div></div><b>${team.pct}%</b></div>`:''}
      ${kids.map(wallKid).join('')}
      <div class="wall-adults">${adults.map(p=>`<button class="hh-face wall-adult" data-code="${hhEsc(p.code)}"><span class="hh-face-av sm" style="background:${p.bg};color:${p.color}">${hhEsc(p.avatar||p.code)}</span>${hhEsc(p.name)}</button>`).join('')}</div>
      <button class="wall-tbtn" onclick="event.stopPropagation();kjTimerSheet()">⏱ Start a timer</button>
      <div class="wall-hint">Tap your face to start</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- photo frame
async function wallLoadPhotos(){
  if(wallPhotos.length)return;
  try{
    if(typeof memEnsureLoaded==='function')await memEnsureLoaded();
    const fam=(typeof memPhotos!=='undefined'?memPhotos:[]).slice(-40);
    if(fam.length&&typeof memSign==='function')await memSign(fam.map(p=>p.path));
    wallPhotos=fam.filter(p=>memSigned[p.path]).map(p=>({src:memSigned[p.path],cap:(memItems.find(m=>m.id===p.memory_id)||{}).name||''}));
    if(wallPhotos.length<6)(typeof memItems!=='undefined'?memItems:[]).filter(m=>m.stock_photo_path).sort(()=>Math.random()-.5).slice(0,20)
      .forEach(m=>wallPhotos.push({src:m.stock_photo_path,cap:m.name,stock:true}));
  }catch(_e){}
}
async function wallSlides(){
  await wallLoadPhotos();if(!wallPhotos.length)return;
  let el=document.getElementById('wall-show');
  if(!el){el=document.createElement('div');el.id='wall-show';document.body.appendChild(el);}
  el.style.display='block';
  const next=()=>{
    const p=wallPhotos[wallPhotoAt++%wallPhotos.length];
    const now=new Date();
    el.innerHTML=`<img src="${p.src}" alt=""><div class="wall-show-cap"><div class="wall-show-clock">${now.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}</div>
      <div>${hhEsc(p.cap)}${p.stock?' <span style="opacity:.7">· on our list</span>':''}</div></div>`;
  };
  next();clearInterval(wallShow);wallShow=setInterval(next,20000);
  el.onclick=()=>{clearInterval(wallShow);wallShow=null;el.style.display='none';wallArmIdle();};
}
function wallArmIdle(){clearTimeout(wallIdle);wallIdle=setTimeout(wallSlides,WALL_SLIDES_AFTER);}

// Called by the tablet's Who's-here screen. Re-renders itself every 30s.
async function wallStart(el,bind){
  const draw=()=>{if(el.style.display==='none')return;el.innerHTML=wallHtml();bind();};
  el.innerHTML='<div class="wall-loading">Loading…</div>';
  await wallLoad(true);
  if(typeof homeWeather==='function')homeWeather().then(()=>draw()).catch(()=>{});
  draw();
  clearInterval(wallTimer);
  wallTimer=setInterval(async()=>{
    if(el.style.display==='none'){clearInterval(wallTimer);return;}
    await wallLoad(false);draw();
  },30000);
  // Every second: tick countdowns, poll for timers started elsewhere, call misses.
  clearInterval(wallSec);
  wallSec=setInterval(()=>{
    if(el.style.display==='none'){clearInterval(wallSec);return;}
    if(typeof kjPollTimers!=='function')return;
    const had=kjRunning().length;kjPollTimers();kjWarnCheck(kjKids().map(k=>k.code));kjCheckExpired(true);
    if(kjRunning().length!==had||el.querySelectorAll('.kj-count').length!==kjRunning().filter((x,i,a)=>a.findIndex(y=>y.j.kid===x.j.kid)===i).length){draw();return;}
    el.querySelectorAll('.kj-count').forEach(c=>{const left=Math.max(0,+c.dataset.by-Date.now());c.textContent=`${Math.floor(left/60000)}:${String(Math.floor(left%60000/1000)).padStart(2,'0')}`;});
  },1000);
  ['pointerdown','touchstart'].forEach(ev=>el.addEventListener(ev,wallArmIdle,{passive:true}));
  wallArmIdle();
}
function wallStop(){clearInterval(wallTimer);clearInterval(wallSec);clearTimeout(wallIdle);clearInterval(wallShow);
  const s=document.getElementById('wall-show');if(s)s.style.display='none';}
