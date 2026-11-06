// ================================================================
// KIDS' BANK (Phase 2). Rules: Aug 2026 chore brief + Nov 2026 changes.
//  - Whole dollars only.
//  - Streak: every job, every day of the week (Laurel $5, Georgette $2).
//  - Captain (Laurel): Georgette's whole week done = $3.
//  - Team: both kids do everything in a day = +10% of that day each
//    (at least $1). Both do everything all week = +20% of the week each.
//  - Caps: jobs + streak + captain + bonus jobs, Laurel $25, Georgette $10.
//    Team bonuses, tips and containers sit outside the caps.
//  - Payday (Sunday): Laurel adds it up herself and the app checks her.
//    A grown-up holds to pay; the money splits 50/40/10 into the jars.
// Tables: bravochore_kid_ledger (every cent), bravochore_kid_goals.
// ================================================================
const KB_CFG={LW:{cap:25,streak:5,captain:3,addsUp:true},GW:{cap:10,streak:2}};
const KB_JARS=[
  {k:'spend',icon:'💵',name:'Spend',pct:50,quote:"I'm going to spend this money, now what's it going to accomplish?",ref:'Sydney, 14 April 2012 (122:37)'},
  {k:'save',icon:'🏦',name:'Save',pct:40,quote:"when you get some money, save it, don't spend it",ref:'Nelson, 7 June 2011 (112:109)'},
  {k:'give',icon:'❤️',name:'Give',pct:10,quote:"if you give, you don't have to worry about it",ref:'Barbados, 19 September 2008 (79:364)'},
];
let kbLedger=[],kbGoals=[],kbLoaded=false,kbPayTries={};

async function kbLoad(force){
  if(kbLoaded&&!force)return;
  const [l,g]=await Promise.all([
    api('bravochore_kid_ledger','GET',null,'?order=day,id'),
    api('bravochore_kid_goals','GET',null,'?done_at=is.null&order=id')]);
  kbLedger=l||[];kbGoals=g||[];kbLoaded=true;
}
function kbCfg(kid){return KB_CFG[kid]||{cap:10,streak:2};}
function kbR(n){return Math.round(n||0);}

// Everything about one kid's week (Mon..Sun starting weekStart).
function kbWeek(kid,ws){
  const today=tdStr(),cfg=kbCfg(kid);
  const days=[];let base=0,possible=0,teamDay=0,allFull=true,any=false,complete=true;
  const others=kjKids().filter(k=>k.code!==kid).map(k=>k.code);
  for(let i=0;i<7;i++){
    const d=kjAddDays(ws,i);
    if(d>today){complete=false;continue;}
    if(!kjJobsFor(kid,d).length)continue;
    const s=kjSummary(kid,d);any=true;
    base+=s.earned;possible+=s.possible;
    const pending=d===today&&!s.full;
    if(!s.full&&!pending)allFull=false;
    if(d===today&&!s.full)complete=false;
    const teamFull=s.full&&others.every(o=>kjSummary(o,d).full);
    if(teamFull)teamDay+=Math.max(1,kbR(s.earned*.1));
    days.push({d,s,teamFull});
  }
  const weekDone=kjAddDays(ws,6)<today||(kjAddDays(ws,6)===today&&complete);
  const streakOn=any&&allFull;
  const streak=streakOn&&weekDone?cfg.streak:0;
  const sisterFull=others.length&&others.every(o=>{const w=kbWeekFlags(o,ws);return w.any&&w.allFull;});
  const captain=cfg.captain&&sisterFull&&weekDone?cfg.captain:0;
  const teamWeek=weekDone&&streakOn&&sisterFull?Math.max(1,kbR(base*.2)):0;
  const inWeek=r=>r.kid===kid&&(r.week_start===ws||(!r.week_start&&r.day>=ws&&r.day<=kjAddDays(ws,6)));
  const led=kbLedger.filter(inWeek);
  const sum=k=>led.filter(r=>r.kind===k).reduce((a,r)=>a+Number(r.amount),0);
  const bonusJobs=sum('bonus_job'),tips=sum('tip'),containers=sum('container');
  const capped=Math.min(cfg.cap,base+streak+captain+bonusJobs);
  const total=kbR(capped+teamDay+teamWeek+tips+containers);
  const paid=led.some(r=>r.kind==='payday');
  return {kid,ws,days,base,possible,streak,streakOn,captain,sisterFull,teamDay,teamWeek,bonusJobs,tips,containers,
    capped,total,paid,weekDone,cap:cfg.cap,capHit:base+streak+captain+bonusJobs>cfg.cap};
}
// Light version (no recursion) for the sister check.
function kbWeekFlags(kid,ws){
  const today=tdStr();let any=false,allFull=true;
  for(let i=0;i<7;i++){const d=kjAddDays(ws,i);if(d>today||!kjJobsFor(kid,d).length)continue;
    const s=kjSummary(kid,d);any=true;if(!s.full&&!(d===today))allFull=false;if(d===today&&!s.full&&kjAddDays(ws,6)===today)allFull=false;}
  return {any,allFull};
}
function kbJar(kid,jar){return kbR(kbLedger.filter(r=>r.kid===kid&&r.jar===jar).reduce((a,r)=>a+Number(r.amount),0));}
// Weeks ready to pay: finished (or it's Sunday) and not yet paid.
function kbPayable(kid){
  const out=[],cur=kjWeekStart(tdStr());
  for(let i=3;i>=0;i--){const ws=kjAddDays(cur,-7*i);const w=kbWeek(kid,ws);
    const ready=kjAddDays(ws,6)<=tdStr();
    if(ready&&!w.paid&&w.days.length&&w.total>0)out.push(w);}
  return out;
}
function kbEarned(kid,from){
  // Paid weeks (payday rows) since `from`, plus this week so far.
  const paid=kbLedger.filter(r=>r.kid===kid&&r.kind==='payday'&&r.week_start>=from).reduce((a,r)=>a+Number(r.amount),0);
  const cur=kbWeek(kid,kjWeekStart(tdStr()));
  return kbR(paid+(cur.paid?0:(cur.ws>=from||kjAddDays(cur.ws,6)>=from?cur.total:0)));
}
function kbLines(w){
  const L=[[`🪙 Jobs`,w.base]];
  if(w.streak)L.push(['🔥 Streak bonus',w.streak]);
  if(w.captain)L.push(['👑 Captain bonus',w.captain]);
  if(w.bonusJobs)L.push(['⭐ Bonus jobs',w.bonusJobs]);
  if(w.capHit)L.push([`🧢 Cap (${kjMoney(w.cap)} max)`,w.capped-(w.base+w.streak+w.captain+w.bonusJobs)]);
  if(w.teamDay)L.push(['🤝 Team days',w.teamDay]);
  if(w.teamWeek)L.push(['🤝 Team week',w.teamWeek]);
  if(w.tips)L.push(['🎁 Tips',w.tips]);
  if(w.containers)L.push(['♻️ Containers',w.containers]);
  return L;
}

// ---------------------------------------------------------------- kid view
function kbKidBank(kid){
  const ws=kjWeekStart(tdStr()),w=kbWeek(kid,ws),pay=kbPayable(kid)[0];
  const goal=kbGoals.find(g=>g.kid===kid);
  const save=kbJar(kid,'save');
  const year=tdStr().slice(0,4),month=tdStr().slice(0,7);
  // Stars = share of their own jobs done this week (fair across ages and caps).
  const lb=kjKids().map(k=>{let a=0,d=0;for(let i=0;i<7;i++){const dd=kjAddDays(ws,i);if(dd>tdStr())break;const s=kjSummary(k.code,dd);a+=s.all;d+=s.allDone;}
    return {k,pct:a?Math.round(d/a*100):0};}).sort((a,b)=>b.pct-a.pct);
  const lines=pay?kbLines(pay):[];
  return `
  ${pay?`<div class="kb-pay">
    <div class="kb-pay-h">💰 Payday!</div>
    <div class="kb-pay-sub">Week of ${new Date(pay.ws+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
    <div class="kb-lines">${lines.map(([t,a])=>`<div><span>${t}</span><b>${a<0?'−':''}${kjMoney(Math.abs(a))}</b></div>`).join('')}</div>
    ${kbCfg(kid).addsUp&&!kbPayTries[pay.ws+kid]?.ok&&(kbPayTries[pay.ws+kid]?.n||0)<2?`
      <div class="kb-addup">Add it up! What's your total?
        <div class="kb-addup-row"><span>$</span><input id="kb-guess" type="number" inputmode="numeric" min="0"><button class="kb-btn" id="kb-check">Check</button></div></div>`:
      `<div class="kb-total">Total <b>${kjMoney(pay.total)}</b>${kbPayTries[pay.ws+kid]?.ok?' ✓ You got it!':''}</div>
       <button class="kb-btn big" id="kb-payhold" data-ws="${pay.ws}">Grown-up: hold to pay</button>`}
  </div>`:''}
  <div class="kb-week">
    <div class="kb-week-h">This week</div>
    <div class="kb-big">${kjMoney(w.total)}</div>
    <div class="kb-chips">
      <span class="kb-chip ${w.streakOn?'on':''}">🔥 Streak ${w.streakOn?'on track':'broken'} · ${kjMoney(kbCfg(kid).streak)}</span>
      ${kbCfg(kid).captain?`<span class="kb-chip ${w.sisterFull?'on':''}">👑 Captain ${w.sisterFull?'on track':'not yet'} · ${kjMoney(kbCfg(kid).captain)}</span>`:''}
      <span class="kb-chip ${w.teamDay?'on':''}">🤝 Team days ${kjMoney(w.teamDay)}</span>
    </div>
  </div>
  <div class="kb-jars">${KB_JARS.map(j=>`<div class="kb-jar"><div class="kb-jar-ic">${j.icon}</div><div class="kb-jar-name">${j.name}</div>
    <div class="kb-jar-amt">${kjMoney(kbJar(kid,j.k))}</div><div class="kb-jar-q">"${j.quote}"</div></div>`).join('')}</div>
  ${goal?`<div class="kb-goal"><div>${hhEsc(goal.icon||'🎯')} Saving for <b>${hhEsc(goal.title)}</b></div>
    <div class="km-bar"><div style="width:${Math.min(100,Math.round(save/goal.amount*100))}%"></div></div>
    <div class="km-team-sub">${kjMoney(save)} of ${kjMoney(goal.amount)}${save>=goal.amount?' · You did it! 🎉':` · ${kjMoney(goal.amount-save)} to go`}</div></div>`:''}
  <div class="kb-stats">
    <div><span>Today</span><b>${kjMoney(kjSummary(kid,tdStr()).earned)}</b></div>
    <div><span>Month</span><b>${kjMoney(kbEarned(kid,month+'-01'))}</b></div>
    <div><span>Year</span><b>${kjMoney(kbEarned(kid,year+'-01-01'))}</b></div>
  </div>
  <div class="kb-lb"><div class="kb-week-h">🏆 This week's stars</div>
    ${lb.map((x,i)=>`<div class="kb-lb-row"><span>${['🥇','🥈','🥉'][i]||''}</span><span class="km-av sm" style="background:${x.k.bg};color:${x.k.color}">${hhEsc(x.k.avatar||x.k.code)}</span>
      <b>${hhEsc(x.k.name)}</b><div class="km-bar"><div style="width:${x.pct}%"></div></div><b class="mem-num">${x.pct}%</b></div>`).join('')}
  </div>`;
}
function kbBindKid(kid){
  const pay=kbPayable(kid)[0];if(!pay)return;
  const key=pay.ws+kid;
  const chk=document.getElementById('kb-check');
  if(chk)chk.onclick=()=>{
    const g=Math.round(+document.getElementById('kb-guess').value);
    const t=kbPayTries[key]=kbPayTries[key]||{n:0};
    if(g===pay.total){t.ok=true;kjYay(true,'Spot on! '+kjMoney(pay.total));}
    else{t.n++;kjUhOh(t.n>=2?`It's ${kjMoney(pay.total)}. Check it with Dad!`:'Not quite! Add it up again');}
    kjRenderKid(true);
  };
  const hold=document.getElementById('kb-payhold');
  if(hold){let tm=null;
    hold.addEventListener('pointerdown',e=>{e.preventDefault();hold.classList.add('holding');tm=setTimeout(()=>{hold.classList.remove('holding');kbPay(kid,pay.ws);},1200);});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>hold.addEventListener(ev,()=>{clearTimeout(tm);hold.classList.remove('holding');}));}
}

// Payday: record the week and split it into the jars (whole dollars).
async function kbPay(kid,ws){
  const w=kbWeek(kid,ws);if(w.paid)return;
  const save=kbR(w.total*.4),give=kbR(w.total*.1),spend=w.total-save-give;
  const rows=[['spend',spend],['save',save],['give',give]].map(([jar,amount])=>({kid,day:tdStr(),week_start:ws,kind:'payday',jar,amount,note:'Payday',by_code:CU}));
  try{const r=await api('bravochore_kid_ledger','POST',rows);kbLedger.push(...(r||rows));}
  catch(_e){if(typeof chirp==='function')chirp("Payday didn't save. Try again.");return;}
  kjYay(true,`Paid ${kjMoney(w.total)}! 💵${spend} 🏦${save} ❤️${give}`);
  if(document.getElementById('kid-mode')?.style.display==='block')kjRenderKid(true);
  if(document.getElementById('view-kids')?.classList.contains('active'))renderKidsTab();
}

// ---------------------------------------------------------------- parents
function kbParentCard(k){
  const ws=kjWeekStart(tdStr()),w=kbWeek(k.code,ws),pay=kbPayable(k.code)[0];
  const goal=kbGoals.find(g=>g.kid===k.code);
  return `<div class="kb-pc">
    <div class="kb-pc-row">${KB_JARS.map(j=>`<span>${j.icon} ${kjMoney(kbJar(k.code,j.k))}</span>`).join('')}<span class="mem-sub" style="margin:0 0 0 auto">week ${kjMoney(w.total)}</span></div>
    ${pay?`<button class="btn-ok" style="width:100%;margin-top:8px" onclick="kbConfirmPay('${k.code}','${pay.ws}')">Pay ${hhEsc(k.name)} ${kjMoney(pay.total)} (week of ${new Date(pay.ws+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'})})</button>`:''}
    <div class="kb-pc-acts">
      <button class="qa-btn" onclick="kbAdd('${k.code}','tip')">🎁 Tip</button>
      <button class="qa-btn" onclick="kbAdd('${k.code}','bonus_job')">⭐ Bonus job</button>
      <button class="qa-btn" onclick="kbAdd('${k.code}','container')">♻️ Containers</button>
      <button class="qa-btn" onclick="kbAdd('${k.code}','spend')">🛍️ Spent</button>
      <button class="qa-btn" onclick="kbGoal('${k.code}')">🎯 ${goal?'Goal: '+hhEsc(goal.title):'Set a goal'}</button>
    </div></div>`;
}
async function kbConfirmPay(kid,ws){
  const w=kbWeek(kid,ws);
  const body=kbLines(w).map(([t,a])=>`${t}: ${kjMoney(a)}`).join('\n')+`\n\nTotal ${kjMoney(w.total)}. Splits 50/40/10 into Spend, Save and Give.`;
  if(await confirm2(`Pay ${kjName(kid)} ${kjMoney(w.total)}?`,body,'btn-ok'))kbPay(kid,ws);
}
function kbAdd(kid,kind){
  const label={tip:'Tip',bonus_job:'Bonus job',container:'Container money',spend:'Spent from a jar'}[kind];
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">${label} · ${hhEsc(kjName(kid))}</div>
    <div class="mem-sheet-sub">${kind==='spend'?'Takes money out of a jar.':kind==='bonus_job'?'Counts towards the weekly cap.':'Added to this week, outside the cap.'}</div>
    <div style="display:flex;gap:8px"><div class="dp-field" style="flex:1"><label class="dp-label" for="kb-amt">Dollars</label><input class="dp-input" id="kb-amt" type="number" min="1" step="1" inputmode="numeric" value="${kind==='container'?'':1}"></div>
    ${kind==='spend'?`<div class="dp-field" style="flex:1"><label class="dp-label" for="kb-jar">From</label><select class="dp-input" id="kb-jar">${KB_JARS.map(j=>`<option value="${j.k}">${j.icon} ${j.name}</option>`).join('')}</select></div>`:''}</div>
    <div class="dp-field"><label class="dp-label" for="kb-note">What for</label><input class="dp-input" id="kb-note" placeholder="${kind==='tip'?'Jobs done beautifully':kind==='spend'?'e.g. slime':kind==='container'?'e.g. 40 cans':'e.g. washed the car'}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn-cancel" id="kb-c">Cancel</button><button class="btn-ok" id="kb-s">Save</button></div></div>`;
  document.body.appendChild(w);
  w.querySelector('#kb-c').onclick=()=>w.remove();
  w.querySelector('#kb-s').onclick=async()=>{
    const amt=Math.round(+w.querySelector('#kb-amt').value);if(!amt||amt<1)return;
    const row={kid,day:tdStr(),week_start:kjWeekStart(tdStr()),kind,amount:kind==='spend'?-amt:amt,
      jar:kind==='spend'?w.querySelector('#kb-jar').value:null,note:w.querySelector('#kb-note').value.trim()||null,by_code:CU};
    try{const r=await api('bravochore_kid_ledger','POST',row);kbLedger.push((r&&r[0])||row);}catch(_e){chirp("Didn't save. Try again.");return;}
    w.remove();renderKidsTab();
  };
}
function kbGoal(kid){
  const g=kbGoals.find(x=>x.kid===kid);
  const w=document.createElement('div');w.className='mem-overlay';w.style.zIndex='950';
  w.innerHTML=`<div class="mem-sheet" role="dialog" aria-modal="true">
    <div class="mem-sheet-title">Savings goal · ${hhEsc(kjName(kid))}</div>
    <div class="mem-sheet-sub">Tracks the Save jar.</div>
    <div style="display:flex;gap:8px"><div class="dp-field" style="width:70px"><label class="dp-label" for="kg-ic">Pic</label><input class="dp-input" id="kg-ic" value="${hhEsc(g?.icon||'🎯')}" style="text-align:center;font-size:20px"></div>
    <div class="dp-field" style="flex:1"><label class="dp-label" for="kg-t">Saving for</label><input class="dp-input" id="kg-t" value="${hhEsc(g?.title||'')}" placeholder="e.g. Lego set"></div>
    <div class="dp-field" style="width:100px"><label class="dp-label" for="kg-a">Dollars</label><input class="dp-input" id="kg-a" type="number" min="1" step="1" value="${g?kbR(g.amount):''}"></div></div>
    <div style="display:flex;gap:8px">${g?'<button class="btn-cancel" id="kg-d">Done / remove</button>':''}<button class="btn-cancel" id="kg-c" style="margin-left:auto">Cancel</button><button class="btn-ok" id="kg-s">Save</button></div></div>`;
  document.body.appendChild(w);
  w.querySelector('#kg-c').onclick=()=>w.remove();
  if(g)w.querySelector('#kg-d').onclick=async()=>{try{await api('bravochore_kid_goals','PATCH',{done_at:new Date().toISOString()},`?id=eq.${g.id}`);}catch(_e){}
    kbGoals=kbGoals.filter(x=>x!==g);w.remove();renderKidsTab();};
  w.querySelector('#kg-s').onclick=async()=>{
    const title=w.querySelector('#kg-t').value.trim(),amount=Math.round(+w.querySelector('#kg-a').value),icon=w.querySelector('#kg-ic').value.trim()||'🎯';
    if(!title||!amount)return;
    try{
      if(g){await api('bravochore_kid_goals','PATCH',{title,amount,icon},`?id=eq.${g.id}`);Object.assign(g,{title,amount,icon});}
      else{const r=await api('bravochore_kid_goals','POST',{kid,title,amount,icon});if(r&&r[0])kbGoals.push(r[0]);}
    }catch(_e){chirp("Didn't save. Try again.");return;}
    w.remove();renderKidsTab();
  };
}
