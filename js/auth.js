// ================================================================
// AUTH: Google sign-in via Supabase Auth (implicit flow, no SDK).
// Dark until AUTH_ENABLED (state.js) is true. Preview on one device with
// localStorage.bc_auth_preview='1'.
// Who-is-who lives in bravochore_members (unreadable with the anon key);
// bc_me() maps the signed-in Google email to BW / BJ and the household.
// Signed in, the app sends the user's token instead of the anon key, so the
// strict household policies apply.
// ================================================================
const BC_SESSION_KEY='bc_session';
let bcSession=null;
let bcHouseholdCode=null;

function bcLoadSession(){try{bcSession=JSON.parse(localStorage.getItem(BC_SESSION_KEY)||'null');}catch(e){bcSession=null;}}
function bcSaveSession(s){
  bcSession=s;
  try{s?localStorage.setItem(BC_SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(BC_SESSION_KEY);}catch(e){}
}

// Coming back from Google, Supabase puts the tokens in the URL hash.
(function bcCatchRedirect(){
  bcLoadSession();
  if(!location.hash||location.hash.length<2)return;
  const h=new URLSearchParams(location.hash.slice(1));
  if(h.get('access_token')){
    bcSaveSession({access_token:h.get('access_token'),refresh_token:h.get('refresh_token'),
      expires_at:Math.floor(Date.now()/1000)+parseInt(h.get('expires_in')||'3600',10)});
    history.replaceState(null,'',location.pathname+location.search);
  }else if(h.get('error')){
    window.bcAuthError=h.get('error_description')||h.get('error');
    history.replaceState(null,'',location.pathname+location.search);
  }
})();

// Valid access token, refreshed when within five minutes of expiry.
// One refresh at a time (refresh tokens are single-use, so parallel refreshes
// can knock each other out). If a refresh truly fails, the user is asked to
// sign in again rather than the app silently falling back to the public key.
let bcRefreshing=null;
async function bcRefresh(){
  if(bcRefreshing)return bcRefreshing;
  bcRefreshing=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`,{method:'POST',
          headers:{apikey:SK,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:bcSession.refresh_token})});
        if(r.ok){const d=await r.json();
          bcSaveSession({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+(d.expires_in||3600)});
          return d.access_token;}
        if(r.status>=400&&r.status<500)break;   // token genuinely dead
      }catch(e){}                               // network blip: try once more
      await new Promise(res=>setTimeout(res,1500));
    }
    return null;
  })();
  try{return await bcRefreshing;}finally{bcRefreshing=null;}
}
async function bcToken(){
  if(!AUTH_ENABLED||!bcSession)return null;
  if(bcSession.expires_at-300>Date.now()/1000)return bcSession.access_token;
  const t=await bcRefresh();
  if(!t){bcSaveSession(null);bcShowSignIn(false,'Your sign-in expired. Please sign in again.');}
  return t;
}
async function bcForceRefresh(){
  if(!AUTH_ENABLED||!bcSession)return false;
  const t=await bcRefresh();
  if(!t){bcSaveSession(null);bcShowSignIn(false,'Your sign-in expired. Please sign in again.');}
  return !!t;
}
// Refresh quietly whenever the app comes back to the foreground.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&bcSession)bcToken();});
// Bearer for API calls: the user's token when signed in, else the anon key.
async function bcBearer(){return 'Bearer '+((await bcToken())||SK);}

function bcSignIn(){
  const back=location.origin+location.pathname;
  location.href=`${SB}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
}
async function bcSignOut(){
  const t=bcSession&&bcSession.access_token;
  bcSaveSession(null);
  try{if(t)await fetch(`${SB}/auth/v1/logout`,{method:'POST',headers:{apikey:SK,Authorization:'Bearer '+t}});}catch(e){}
  location.reload();
}
async function bcWhoAmI(){
  const t=await bcToken();if(!t)return null;
  try{
    const r=await fetch(`${SB}/rest/v1/rpc/bc_me`,{method:'POST',
      headers:{apikey:SK,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}'});
    if(r.status===401){bcSaveSession(null);return null;}
    if(!r.ok)return null;
    const rows=await r.json();return rows[0]||{notMember:true};
  }catch(e){return null;}
}

// Called first thing in boot(). True = carry on booting.
async function bcGate(){
  if(!AUTH_ENABLED)return true;
  const me=bcSession?await bcWhoAmI():null;
  if(me&&me.person_code){
    const p=people.find(x=>x.code===me.person_code)||{name:me.person_code};
    CU=me.person_code;CUN=p.name;bcHouseholdCode=me.household_code;
    localStorage.setItem('bc_user',CU);localStorage.setItem('bc_username',CUN);
    return true;
  }
  bcShowSignIn(me&&me.notMember);
  return false;
}

function bcShowSignIn(notMember,msg){
  const ls=document.getElementById('loading-screen');if(ls)ls.style.display='none';
  let el=document.getElementById('bc-signin');
  if(!el){el=document.createElement('div');el.id='bc-signin';document.body.appendChild(el);}
  const err=window.bcAuthError;
  el.innerHTML=`<div class="bc-signin-card">
    <div class="bc-signin-logo"><span style="color:var(--green)">Bravo</span>Chore</div>
    ${notMember
      ?`<p class="bc-signin-msg">That Google account isn't part of this household.</p>
        <button class="btn-cancel bc-signin-btn" onclick="bcSignOut()">Use a different account</button>`
      :`<p class="bc-signin-msg">Sign in to continue.</p>
        <button class="bc-google-btn" onclick="bcSignIn()">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Sign in with Google</button>`}
    ${err?`<p class="bc-signin-err">${String(err).replace(/[<>&]/g,'')}</p>`:''}
  </div>`;
  el.style.display='flex';
}
