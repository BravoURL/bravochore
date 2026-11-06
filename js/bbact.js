// ================================================================
// BLACKBIRD ACTIONS: brain dump + change the app's data by just saying it.
// "Georgette's bedtime is 8pm now", "Nan for tea Saturday, need mince and
// bread, and remind Bernadette about the dentist Tuesday", or a pasted list.
// Blackbird returns a list of concrete changes; nothing happens until a
// grown-up taps Apply. Covers kids' jobs and pay, calendar, tasks, shopping
// and meals. Code changes to the app itself are logged as "App change" ideas.
// ================================================================
const BBA_KEYWORDS=/brain ?dump|bed ?time|wake|bath|shower|pocket money|\bpay\b|\bjobs?\b|chore|calendar|\btea\b|dinner|lunch|\bmeals?\b|recipe|shopping|home by|tonight|tomorrow|(next|this|on) (mon|tue|wed|thu|fri|sat|sun)|change the app|app change/i;
function bbaIntent(msg){
  if(typeof hhIsChild==='function'&&hhIsChild(CU))return false;
  const lines=msg.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length>=2)return true;
  if(BBA_KEYWORDS.test(msg))return true;
  const names=people.filter(p=>p.kind==='child').map(p=>p.name.toLowerCase());
  return names.some(n=>msg.toLowerCase().includes(n));
}
function bbaContext(){
  const t=tdStr(),now=new Date();
  const jobs=(typeof kjJobs!=='undefined'?kjJobs:[]).map(j=>`#${j.id} ${j.kid} ${j.kind} "${j.title}" days=${(j.days||[]).join('')} $${j.amount}${j.by_time?' by '+j.by_time.slice(0,5):''}${j.parent_confirm?' grown-up-ticks':''}`).join('\n');
  const meals=typeof mlFor==='function'?[0,1,2,3,4,5,6].map(i=>{const d=kjAddDays(t,i),m=mlFor(d);return m?`${d} tea: ${m.title}`:null;}).filter(Boolean).join('\n'):'';
  return `Today: ${KJ_DOW_LONG[now.getDay()]} ${t}, ${now.toTimeString().slice(0,5)} Perth. User: ${CUN} (${CU}).
People: ${people.filter(p=>p.kind!=='other').map(p=>`${p.code}=${p.name}${p.kind==='child'?' (child)':''}`).join(', ')}.
Day numbers: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat.
KIDS' JOBS (id kid kind title days pay by-time):
${jobs||'none loaded'}
MEALS THIS WEEK:
${meals||'none planned'}
RECIPES: ${(typeof mlRecipes!=='undefined'?mlRecipes:[]).map(r=>r.title).join(', ')||'none'}
SHOP STORES: Coles (food, household), Bunnings (hardware, garden), ABI (fittings), Other.`;
}
const BBA_SYS=`You are Blackbird inside BravoChore, the Wallis family's household app. Turn what the grown-up says (often a messy brain dump) into concrete changes.
Reply with ONLY JSON: {"reply":"one short line","actions":[...]}
Action types (use exact fields; "label" = short plain description shown to the user):
- {"type":"kid_job_update","id":123,"changes":{"by_time":"HH:MM"|null,"amount":whole dollars,"days":[0-6],"title":"...","icon":"emoji","parent_confirm":bool,"active":false to remove},"label":"..."}  (only include changed fields; use ids from the list)
- {"type":"kid_job_add","kid":"LW","title":"...","icon":"emoji","kind":"daily"|"paid","days":[0-6],"amount":whole dollars (0 for daily),"by_time":"HH:MM"|null,"parent_confirm":bool,"label":"..."}
- {"type":"calendar_add","title":"...","icon":"emoji","day":"YYYY-MM-DD","end_day":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"who":["codes"],"label":"..."}
- {"type":"task_add","title":"...","owner":"BW"|"BJ"|"BW+BJ","due":"YYYY-MM-DD"|null,"bucket":"Indoor"|"Outdoor","label":"..."}
- {"type":"shopping_add","items":[{"name":"...","store":"Coles"}],"label":"..."}
- {"type":"meal_set","day":"YYYY-MM-DD","slot":"tea"|"lunch","title":"...","label":"..."}
- {"type":"app_change","summary":"what to change in the app's design or features","label":"..."}  (for requests to change how the app looks or works, not data)
Rules: "reply" says what you WILL do (nothing is applied until they tap Apply), never "done" or "sorted". Where-people-are notes ("I'll be home by 7pm tonight", "in Sydney next Wed", "Nan coming Saturday") are calendar_add entries with who set. Pay is whole dollars only. "Bedtime" = the job titled like "Bed when asked". Times 24h. "I"/"me" = the user. Don't invent things that weren't said. If nothing actionable, actions = [] and answer briefly in reply.`;

async function bbaHandle(msg){
  try{if(typeof kjLoad==='function')await kjLoad();if(typeof mlLoad==='function')await mlLoad();}catch(_e){}
  let d=null,raw='';
  try{
    const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json',apikey:SK,Authorization:await bcBearer()},
      body:JSON.stringify({thinking:{type:'disabled'},model:BB_MODEL,max_tokens:2000,system:BBA_SYS+'\n\n'+bbaContext(),
        messages:[...bbHistory.slice(-4),{role:'user',content:msg}]})});
    const j=await res.json();raw=j.content?.find(c=>c.type==='text')?.text||'';
    d=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
  }catch(_e){}
  bbHistory.push({role:'user',content:msg});
  if(!d){bbMsg(raw||"Couldn't work that out. Try again?",'from-bb');return;}
  bbHistory.push({role:'assistant',content:d.reply||''});
  const acts=(d.actions||[]).filter(a=>a&&a.type);
  if(!acts.length){bbMsg(d.reply||'Nothing to change there.','from-bb');return;}
  const id='bba'+Date.now();
  const ic={kid_job_update:'⭐',kid_job_add:'⭐',calendar_add:'📅',task_add:'✅',shopping_add:'🛒',meal_set:'🍽️',app_change:'🛠️'};
  bbMsgHTML(`<div id="${id}"><div>${hhEsc(d.reply||'Here\'s what I\'ll do:')}</div>
    <div class="bba-list">${acts.map((a,i)=>`<label class="bba-row"><input type="checkbox" data-i="${i}" checked><span>${ic[a.type]||'•'}</span><span>${hhEsc(a.label||a.title||a.type)}</span></label>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn-ok" style="flex:1" data-go>Apply</button><button class="btn-cancel" data-no>No</button></div></div>`,'from-bb');
  const el=document.getElementById(id);
  el.querySelector('[data-no]').onclick=()=>{el.querySelectorAll('button,input').forEach(x=>x.disabled=true);};
  el.querySelector('[data-go]').onclick=async e=>{
    const btn=e.currentTarget;btn.disabled=true;btn.textContent='Applying…';
    const pick=[...el.querySelectorAll('[data-i]:checked')].map(c=>acts[+c.dataset.i]);
    const res=[];
    for(const a of pick){let ok=false;try{ok=await bbaApply(a);}catch(_e){}res.push((ok?'✓ ':'✕ ')+(a.label||a.type));}
    el.querySelectorAll('button,input').forEach(x=>x.disabled=true);btn.textContent='Applied';
    bbMsg(res.join('\n'),'from-bb');
    bbaRefresh();
  };
}
function bbaRefresh(){
  try{
    const v=[...document.querySelectorAll('.view.active')].map(x=>x.id.replace('view-',''))[0];
    if(v==='kids')renderKidsTab();else if(v==='calendar')renderCalendar();else if(v==='meals')renderMeals();
    else if(v==='tasks')renderTasksView();else if(v==='shopping')renderShopping();else if(v==='dashboard')renderDashboard();
  }catch(_e){}
}
async function bbaApply(a){
  const whole=n=>Math.max(0,Math.round(+n||0));
  switch(a.type){
    case 'kid_job_update':{
      const j=kjJobs.find(x=>x.id===+a.id);if(!j)return false;
      const ch={};const c=a.changes||{};
      ['title','icon','parent_confirm','active'].forEach(k=>{if(c[k]!==undefined)ch[k]=c[k];});
      if(c.by_time!==undefined)ch.by_time=c.by_time||null;
      if(c.amount!==undefined)ch.amount=whole(c.amount);
      if(Array.isArray(c.days)&&c.days.length)ch.days=c.days.map(Number).filter(n=>n>=0&&n<=6);
      await api('bravochore_kid_jobs','PATCH',ch,`?id=eq.${j.id}`);
      if(ch.active===false)kjJobs=kjJobs.filter(x=>x!==j);else Object.assign(j,ch);
      return true;}
    case 'kid_job_add':{
      if(!people.some(p=>p.code===a.kid&&p.kind==='child')||!a.title)return false;
      const row={kid:a.kid,title:a.title,icon:a.icon||'⭐',kind:a.kind==='daily'?'daily':'paid',days:(a.days&&a.days.length?a.days:[0,1,2,3,4,5,6]).map(Number),
        amount:a.kind==='daily'?0:whole(a.amount||1),by_time:a.by_time||null,parent_confirm:!!a.parent_confirm,sort:50};
      const r=await api('bravochore_kid_jobs','POST',row);if(r&&r[0])kjJobs.push(r[0]);return true;}
    case 'calendar_add':{
      if(typeof calSave!=='function'||!a.title||!/^\d{4}-\d{2}-\d{2}$/.test(a.day||''))return false;
      if(typeof calLoad==='function')await calLoad();
      return await calSave({title:a.title,icon:a.icon||'📌',day:a.day,end_day:a.end_day||null,time:a.time||null,who:(a.who||[]).filter(c=>people.some(p=>p.code===c))});}
    case 'task_add':{
      if(!a.title)return false;
      const nid=Date.now()+Math.floor(Math.random()*1000);
      const nt={id:nid,title:a.title,owner:a.owner||CU,due:a.due||null,time_hours:0,bucket:a.bucket==='Indoor'?'Indoor':'Outdoor',
        notes:'',done:false,sort_order:tasks.length+1,photo_urls:[],task_code:typeof getNextCode==='function'?getNextCode():null,event_id:null};
      await api('bravochore_tasks','POST',[nt]);tasks.push(nt);return true;}
    case 'shopping_add':{
      const items=(a.items||[]).filter(x=>x&&x.name);if(!items.length)return false;
      const valid=['Coles','Bunnings','ABI','Other'];
      const rows=items.map((x,k)=>({id:'si_'+Date.now()+'_'+k,name:x.name,store:valid.includes(x.store)?x.store:'Coles',note:'',done:false,sort_order:(shopping.length||0)+k+1}));
      await api('bravochore_shopping','POST',rows);shopping.push(...rows);
      if(typeof shopSortUnknown==='function')try{shopSortUnknown();}catch(_e){}
      return true;}
    case 'meal_set':{
      if(typeof mlSet!=='function'||!a.title||!/^\d{4}-\d{2}-\d{2}$/.test(a.day||''))return false;
      const r=(mlRecipes||[]).find(x=>x.title.toLowerCase()===a.title.toLowerCase());
      return await mlSet(a.day,a.slot==='lunch'?'lunch':'tea',a.title,r?r.id:null);}
    case 'app_change':{
      // Logged as a task for now; the in-app code-change pipeline picks these up once it's set up.
      const nid=Date.now()+Math.floor(Math.random()*1000);
      const nt={id:nid,title:'App change: '+(a.summary||a.label||'').slice(0,200),owner:'BW',due:null,time_hours:0,bucket:'Indoor',
        notes:a.summary||'',done:false,sort_order:tasks.length+1,photo_urls:[],task_code:typeof getNextCode==='function'?getNextCode():null,event_id:null};
      await api('bravochore_tasks','POST',[nt]);tasks.push(nt);return true;}
  }
  return false;
}
