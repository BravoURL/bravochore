// ================================================================
// HOUSEHOLD: people from the database, and the shared wall tablet.
// People (names, colours, adult/child) live in bravochore_people behind the
// household login, so every device, the tablet included, sees the same list.
// The tablet signs in as a household device (person code HOME). It never owns
// anything: it opens on "Who's here?" and acts as whoever taps their face.
// Kids go straight in; adults need their 4-digit PIN.
// ================================================================
let hhTablet=false;
const HH_ACTING='bc_acting';           // sessionStorage: who's using the tablet now
const HH_IDLE_MS=5*60*1000;            // back to "Who's here?" after 5 idle minutes

async function hhLoadPeople(){
  try{
    const r=await fetch(`${SB}/rest/v1/bravochore_people?select=*&active=eq.true&order=sort`,
      {headers:{apikey:SK,Authorization:await bcBearer()}});
    if(!r.ok)return;
    const rows=await r.json();if(!rows.length)return;
    people=rows.map(p=>({code:p.code,name:p.name,bg:p.bg||'#F4F3F0',color:p.color||'#5a5a56',
      kind:p.kind,child:p.kind==='child',avatar:p.avatar||'',pin_hash:p.pin_hash||null,on_tablet:p.on_tablet!==false}));
    savePeople();
    try{localStorage.setItem('bc_kids_v1','1');}catch(_e){}
  }catch(_e){}
}
function hhPerson(code){return people.find(p=>p.code===code);}
function hhIsChild(code){const p=hhPerson(code);return !!(p&&p.kind==='child');}
function hhEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function hhHash(code,pin){
  const data=new TextEncoder().encode(`${bcHouseholdCode||''}|${code}|${pin}`);
  const buf=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Resolves with the chosen person code once someone is in.
function hhWhoIsHere(){
  const acting=sessionStorage.getItem(HH_ACTING);
  if(acting&&hhPerson(acting))return Promise.resolve(acting);
  return new Promise(resolve=>{
    const ls=document.getElementById('loading-screen');if(ls)ls.style.display='none';
    let el=document.getElementById('hh-who');
    if(!el){el=document.createElement('div');el.id='hh-who';document.body.appendChild(el);}
    const list=people.filter(p=>p.on_tablet&&p.kind!=='other');
    const now=new Date();
    el.innerHTML=`<div class="hh-who-inner">
      <div class="hh-clock">${now.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}</div>
      <div class="hh-date">${now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}</div>
      <h1 class="hh-title">Who's here?</h1>
      <div class="hh-faces">${list.map(p=>`<button class="hh-face" data-code="${hhEsc(p.code)}">
        <span class="hh-face-av" style="background:${p.bg};color:${p.color}">${p.avatar?hhEsc(p.avatar):hhEsc(p.code)}</span>
        <span class="hh-face-name">${hhEsc(p.name)}</span></button>`).join('')}</div>
    </div>`;
    el.style.display='flex';
    const bind=()=>el.querySelectorAll('.hh-face').forEach(b=>b.onclick=async()=>{
      const p=hhPerson(b.dataset.code);if(!p)return;
      if(p.kind==='adult'&&!(await hhPinCheck(p)))return;
      sessionStorage.setItem(HH_ACTING,p.code);
      if(typeof wallStop==='function')wallStop();
      el.style.display='none';
      resolve(p.code);
    });
    // The wall display is the tablet's home screen; faces are on it.
    if(typeof wallStart==='function'){el.classList.add('is-wall');wallStart(el,bind);}
    else bind();
  });
}

// PIN pad. First time on the tablet, the adult sets one (entered twice).
function hhPinCheck(p){
  return new Promise(resolve=>{
    const setting=!p.pin_hash;let first=null,entry='';
    const bg=document.createElement('div');bg.className='hh-pin-bg';
    const draw=msg=>{
      bg.innerHTML=`<div class="hh-pin">
        <div class="hh-pin-av" style="background:${p.bg};color:${p.color}">${p.avatar?hhEsc(p.avatar):hhEsc(p.code)}</div>
        <div class="hh-pin-title">${setting?(first?'Same PIN again':`Set a PIN for ${hhEsc(p.name)}`):`Hi ${hhEsc(p.name)}`}</div>
        <div class="hh-pin-msg">${msg||(setting?'4 digits. Keeps the grown-up screens grown-up.':'Enter your PIN')}</div>
        <div class="hh-pin-dots">${[0,1,2,3].map(i=>`<span class="${i<entry.length?'on':''}"></span>`).join('')}</div>
        <div class="hh-pin-pad">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-k="${k}">${k}</button>`).join('')}</div>
        <button class="hh-pin-cancel">Cancel</button></div>`;
      bg.querySelector('.hh-pin-cancel').onclick=()=>{bg.remove();resolve(false);};
      bg.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>press(b.dataset.k));
    };
    const press=async k=>{
      if(k==='⌫'){entry=entry.slice(0,-1);draw();return;}
      if(entry.length>=4)return;
      entry+=k;draw();
      if(entry.length<4)return;
      const pin=entry;entry='';
      if(setting){
        if(!first){first=pin;draw();return;}
        if(first!==pin){first=null;draw("Didn't match. Try again.");return;}
        const h=await hhHash(p.code,pin);
        try{await fetch(`${SB}/rest/v1/bravochore_people?code=eq.${encodeURIComponent(p.code)}`,{method:'PATCH',
          headers:{apikey:SK,Authorization:await bcBearer(),'Content-Type':'application/json',Prefer:'return=minimal'},
          body:JSON.stringify({pin_hash:h,updated_at:new Date().toISOString()})});}catch(_e){}
        p.pin_hash=h;savePeople();bg.remove();resolve(true);return;
      }
      if((await hhHash(p.code,pin))===p.pin_hash){bg.remove();resolve(true);}
      else draw('Not quite. Try again.');
    };
    draw();document.body.appendChild(bg);
  });
}

// Tablet: "switch" and going idle both return to "Who's here?".
function hhLeave(){sessionStorage.removeItem(HH_ACTING);location.reload();}
let hhIdleTimer=null;
function hhStartIdle(){
  if(!hhTablet)return;
  const reset=()=>{clearTimeout(hhIdleTimer);hhIdleTimer=setTimeout(()=>{
    // Never yank the screen from under someone typing.
    const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)){reset();return;}
    hhLeave();},HH_IDLE_MS);};
  ['pointerdown','keydown','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,reset,{passive:true,capture:true}));
  reset();
}
