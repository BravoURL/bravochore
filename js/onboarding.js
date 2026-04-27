// ================================================================
// FIRST-RUN ONBOARDING
// ================================================================
// Shown the very first time someone opens BravoChore (no bc_user in
// localStorage). Replaces the user-picker as the entry point for
// brand-new users — gathers their name + short code, optionally adds
// household members, then drops them straight into the app as the
// active user. Existing users (bc_user already set) skip this entirely.
//
// For now the household_code is left at the WALLIS default so all
// existing seed data (routines, blocks, stores) is visible to new
// users. A full multi-tenant household_code rework is a future migration.

// Working state — accumulates as the user steps through onboarding.
const _woColors=[
  {bg:'#E6F1FB',color:'#185FA5'},  // blue
  {bg:'#FAEEDA',color:'#854F0B'},  // amber
  {bg:'#EAF3DE',color:'#3B6D11'},  // green
  {bg:'#FCE4EC',color:'#C2185B'},  // pink
  {bg:'#EDE7FF',color:'#5E35B1'},  // purple
  {bg:'#FFF3E0',color:'#E65100'},  // orange
];
let _woPeople=[];

function shouldShowWelcomeOnboarding(){
  // Only first-time users — never interrupt anyone who's already used the app
  if(localStorage.getItem('bc_user'))return false;
  if(localStorage.getItem('bc_onboarded')==='1')return false;
  return true;
}

function showWelcomeOnboarding(){
  document.getElementById('user-picker').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('loading-screen').style.display='none';
  const wo=document.getElementById('welcome-onboarding');
  if(wo)wo.style.display='block';
  // Reset to step 1
  document.getElementById('welcome-step-1').style.display='block';
  document.getElementById('welcome-step-2').style.display='none';
  _woPeople=[];
  setTimeout(()=>document.getElementById('wo-name')?.focus(),100);
}

// Step 1 handler — capture the first person and move to step 2
function welcomeFirstPerson(){
  const name=(document.getElementById('wo-name')?.value||'').trim();
  let code=(document.getElementById('wo-code')?.value||'').trim().toUpperCase();
  if(!name){chirp('What should we call you?');document.getElementById('wo-name')?.focus();return;}
  if(!code)code=(name.match(/[A-Za-z]/g)||[]).slice(0,2).join('').toUpperCase()||name[0].toUpperCase();
  // Pick a colour from the palette, in order (1st person = blue)
  const colour=_woColors[0];
  _woPeople=[{code,name,bg:colour.bg,color:colour.color,_self:true}];
  document.getElementById('welcome-step-1').style.display='none';
  document.getElementById('welcome-step-2').style.display='block';
  renderWelcomeExtraPeople();
}

function renderWelcomeExtraPeople(){
  const c=document.getElementById('welcome-extra-people');
  if(!c)return;
  if(_woPeople.length<=1){
    c.innerHTML='<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px 0">No others yet — that\'s fine, you can use BravoChore solo.</div>';
    return;
  }
  c.innerHTML=_woPeople.slice(1).map((p,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:8px">
      <div style="width:36px;height:36px;border-radius:50%;background:${p.bg};color:${p.color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${p.code}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600">${p.name}</div><div style="font-size:11px;color:var(--tx3);font-family:'DM Mono',monospace">${p.code}</div></div>
      <button class="qa-btn" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red)" onclick="welcomeRemovePerson(${i+1})">×</button>
    </div>`).join('');
}

async function welcomeAddAnotherPerson(){
  const result=await promptSheet({
    title:'Add household member',
    confirmLabel:'Add',
    fields:[
      {name:'name',label:'Name',required:true,placeholder:'e.g. Tom'},
      {name:'code',label:'Short code',required:true,placeholder:'e.g. T or TG (uppercase)'}
    ]
  });
  if(!result)return;
  const code=(result.code||'').toUpperCase().trim();
  const name=result.name.trim();
  if(!name||!code)return;
  if(_woPeople.find(p=>p.code===code)){chirp('That code is already taken.');return;}
  const colour=_woColors[_woPeople.length%_woColors.length];
  _woPeople.push({code,name,bg:colour.bg,color:colour.color});
  renderWelcomeExtraPeople();
}

function welcomeRemovePerson(idx){
  if(idx<=0)return; // can't remove the primary user
  _woPeople.splice(idx,1);
  renderWelcomeExtraPeople();
}

// Final step — commit everything and continue boot as the primary user
async function welcomeFinish(){
  if(!_woPeople.length){chirp('Add at least yourself first.');return;}
  // Strip the internal _self flag before saving
  const clean=_woPeople.map(p=>{const {_self,...rest}=p;return rest;});
  people=clean;
  savePeople();
  const me=clean[0];
  CU=me.code;
  CUN=me.name;
  localStorage.setItem('bc_user',CU);
  localStorage.setItem('bc_username',CUN);
  localStorage.setItem('bc_onboarded','1');
  // Hide the onboarding overlay and bring the main app online
  document.getElementById('welcome-onboarding').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('bb-fab').style.display='flex';
  if(typeof setupPill==='function')setupPill();
  if(typeof renderExtraFilters==='function')renderExtraFilters();
  if(typeof renderDashboard==='function')renderDashboard();
  if(typeof initLottie==='function')initLottie();
  if(typeof loadPrefs==='function')loadPrefs();
  if(typeof loadSuppliers==='function')loadSuppliers();
  if(typeof loadStores==='function')loadStores().then(()=>{if(typeof renderShopping==='function')renderShopping();});
  if(typeof updateSprintFAB==='function')updateSprintFAB();
  document.getElementById('bn-dashboard')?.classList.add('active');
  setTimeout(()=>{
    if(typeof bbMsg==='function')bbMsg(`Welcome aboard, ${CUN}. Tap any task for advice, or just ask me anything.`,'from-bb');
  },300);
}
