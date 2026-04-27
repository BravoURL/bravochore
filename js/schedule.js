// ================================================================
// SCHEDULE MODULE
// ================================================================
// Bernadette's full routine, faithfully ported + BravoChore integration
// ================================================================

const SCHED_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SCHED_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ---- DATA: Bernadette's full day tasks (from remixed app) ----
const DAY_TASKS = {
  Monday: [
    {section:'morning',label:'Morning Block',time:'9:00\u201310:45 am',tasks:[
      {id:'mon-m1',text:'Fridge cleanout, meal plan, grocery list',recur:'weekly'},
      {id:'mon-m2',text:'Clothes wash \u2014 load 1',recur:'daily'},
      {id:'mon-m3',text:'Deep clean bathrooms',recur:'daily',week:'a'},
      {id:'mon-m4',text:'Vacuum throughout',recur:'daily',week:'b'},
    ]},
    {section:'afternoon',label:'Afternoon Block',time:'12:30\u20132:52 pm',tasks:[
      {id:'mon-a1',text:'Online grocery order or click & collect',recur:'weekly'},
      {id:'mon-a2',text:'Fold & put away, ironing (small batch)',recur:'daily'},
    ]},
    {section:'afterschool',label:'After School',time:'3:15\u20135:00 pm',tasks:[
      {id:'mon-as1',text:'Snack & reading with Laurel',recur:'daily'},
      {id:'mon-as2',text:'Afternoon jobs (overflow tasks)',recur:'daily'},
    ]},
    {section:'church',label:'The Meeting',time:'6:55\u20137:30 pm',tasks:[
      {id:'mon-c1',text:'Dinner ready before leaving',recur:'daily',note:true},
    ]},
    {section:'night',label:'Night Prep',time:'8:00\u20138:30 pm',tasks:[
      {id:'mon-n1',text:'Pack Laurel\u2019s lunchbox',recur:'daily'},
      {id:'mon-n2',text:'Set washing machine delay timer',recur:'daily'},
      {id:'mon-n3',text:'Check school bag \u2014 notes, library books, forms',recur:'daily'},
      {id:'mon-n4',text:'Lay out kids\u2019 clothes for tomorrow',recur:'daily'},
      {id:'mon-n5',text:'Quick kitchen reset',recur:'daily'},
      {id:'mon-n6',text:'Check tomorrow\u2019s schedule',recur:'daily'},
    ]},
  ],
  Tuesday: [
    {section:'morning',label:'Morning Block',time:'9:00\u201310:45 am',tasks:[
      {id:'tue-m1',text:'Clothes wash \u2014 load 2',recur:'daily'},
      {id:'tue-m2',text:'Kitchen deep clean (benches, appliances, sink, microwave)',recur:'weekly'},
      {id:'tue-m3',text:'Wash our sheets & pillowcases \u2192 remake bed',recur:'daily',week:'a'},
      {id:'tue-m4',text:'Wash kids\u2019 sheets & pillowcases \u2192 remake beds',recur:'daily',week:'b'},
    ]},
    {section:'afternoon',label:'Afternoon Block',time:'12:30\u20132:22 pm',tasks:[
      {id:'tue-a1',text:'Grocery pickup / shop if not done Monday',recur:'weekly'},
      {id:'tue-a2',text:'Fold & put away',recur:'daily'},
      {id:'tue-a3',text:'Dusting throughout',recur:'weekly'},
      {id:'tue-a4',text:'Meal prep & batch cooking',recur:'weekly'},
    ]},
    {section:'afterschool',label:'After School',time:'3:15\u20135:00 pm',tasks:[
      {id:'tue-as1',text:'Snack & reading with Laurel',recur:'daily'},
      {id:'tue-as2',text:'Afternoon jobs (overflow tasks)',recur:'daily'},
    ]},
    {section:'church',label:'The Meeting',time:'7:00\u20137:15 pm',tasks:[
      {id:'tue-c1',text:'Very brief \u2014 evening mostly free',recur:'daily',note:true},
    ]},
    {section:'night',label:'Night Prep',time:'8:00\u20138:30 pm',tasks:[
      {id:'tue-n1',text:'Pack Laurel\u2019s lunchbox',recur:'daily'},
      {id:'tue-n2',text:'Set washing machine delay timer',recur:'daily'},
      {id:'tue-n3',text:'Check school bag; process school notes & paperwork',recur:'daily'},
      {id:'tue-n4',text:'Lay out kids\u2019 clothes for tomorrow',recur:'daily'},
      {id:'tue-n5',text:'Quick kitchen reset',recur:'daily'},
      {id:'tue-n6',text:'Check tomorrow\u2019s schedule (Georgette alt. Wed?)',recur:'daily'},
    ]},
  ],
  Wednesday: [
    {section:'note',label:'Note',time:'',tasks:[
      {id:'wed-note1',text:'Georgette at school on alternating Wednesdays \u2014 use quieter morning for tasks needing focus',note:true},
    ]},
    {section:'morning',label:'Morning Block',time:'9:00\u201310:45 am',tasks:[
      {id:'wed-m1',text:'Clothes wash \u2014 load 3',recur:'daily'},
      {id:'wed-m2',text:'Mop floors (kitchen, bathrooms, entryway)',recur:'weekly'},
      {id:'wed-m3',text:'Long-term cleaning slot (see Long-Term tab)',recur:'weekly'},
    ]},
    {section:'afternoon',label:'Afternoon Block',time:'12:30\u20132:52 pm',tasks:[
      {id:'wed-a1',text:'Budgeting \u2014 weekly review, bill payments, accounts check',recur:'weekly'},
      {id:'wed-a2',text:'Fold & put away',recur:'daily'},
      {id:'wed-a3',text:'Gardening \u2014 dedicated weekly session',recur:'weekly'},
    ]},
    {section:'afterschool',label:'After School',time:'3:15\u20135:00 pm',tasks:[
      {id:'wed-as1',text:'Snack & reading with Laurel',recur:'daily'},
      {id:'wed-as2',text:'Afternoon jobs (overflow tasks)',recur:'daily'},
    ]},
    {section:'church',label:'The Meeting',time:'6:45\u20137:45 pm',tasks:[
      {id:'wed-c1',text:'Dinner ready before leaving',recur:'daily',note:true},
    ]},
    {section:'night',label:'Night Prep',time:'8:00\u20138:30 pm',tasks:[
      {id:'wed-n1',text:'Pack Laurel\u2019s & Georgette\u2019s lunchboxes (Georgette Thu)',recur:'daily'},
      {id:'wed-n2',text:'Set washing machine delay timer',recur:'daily'},
      {id:'wed-n3',text:'Check bags; process school notes & paperwork',recur:'daily'},
      {id:'wed-n4',text:'Lay out kids\u2019 clothes',recur:'daily'},
      {id:'wed-n5',text:'Quick kitchen reset',recur:'daily'},
    ]},
  ],
  Thursday: [
    {section:'morning',label:'Morning Block',time:'9:00\u201310:45 am',tasks:[
      {id:'thu-m1',text:'Clothes wash \u2014 load 4',recur:'daily'},
      {id:'thu-m2',text:'Vacuum throughout',recur:'weekly'},
      {id:'thu-m3',text:'Wash kids\u2019 sheets & pillowcases \u2192 remake beds',recur:'daily',week:'a'},
      {id:'thu-m4',text:'Wash our sheets & pillowcases \u2192 remake bed',recur:'daily',week:'b'},
    ]},
    {section:'afternoon',label:'Afternoon Block',time:'12:30\u20132:52 pm',tasks:[
      {id:'thu-a1',text:'Ironing \u2014 main weekly session',recur:'weekly'},
      {id:'thu-a2',text:'Fold & put away',recur:'daily'},
      {id:'thu-a3',text:'Any overflow from earlier in the week',recur:'daily'},
      {id:'thu-a4',text:'Put bins out for council pickup',recur:'weekly'},
    ]},
    {section:'afterschool',label:'After School',time:'3:15\u20135:00 pm',tasks:[
      {id:'thu-as1',text:'Snack & reading with Laurel',recur:'daily'},
      {id:'thu-as2',text:'Afternoon jobs (overflow tasks)',recur:'daily'},
    ]},
    {section:'evening',label:'Evening',time:'Protected family time',tasks:[]},
    {section:'night',label:'Night Prep',time:'8:00\u20138:30 pm',tasks:[
      {id:'thu-n1',text:'Pack Laurel\u2019s & Georgette\u2019s lunchboxes',recur:'daily'},
      {id:'thu-n2',text:'Set washing machine delay timer (towels Friday)',recur:'daily'},
      {id:'thu-n3',text:'Check bags; process school notes & paperwork',recur:'daily'},
      {id:'thu-n4',text:'Lay out kids\u2019 clothes',recur:'daily'},
      {id:'thu-n5',text:'Quick kitchen reset',recur:'daily'},
    ]},
  ],
  Friday: [
    {section:'morning',label:'Morning Block',time:'9:00\u201310:45 am',tasks:[
      {id:'fri-m1',text:'Clothes wash \u2014 towels (every Friday)',recur:'weekly'},
      {id:'fri-m2',text:'Kitchen tidy & wipe-down (prep for weekend)',recur:'weekly'},
      {id:'fri-m3',text:'Bathroom freshen \u2014 wipe & toilet',recur:'weekly'},
      {id:'fri-m4',text:'General house tidy \u2728 House ready for the weekend',recur:'weekly'},
    ]},
    {section:'afternoon',label:'Afternoon Block',time:'12:30\u20132:52 pm',tasks:[
      {id:'fri-a1',text:'Fold & put away',recur:'daily'},
      {id:'fri-a2',text:'Prep weekend meals',recur:'weekly'},
      {id:'fri-a3',text:'Car tidy & fuel check',recur:'weekly'},
      {id:'fri-a4',text:'Gardening \u2014 light (watering, deadheading)',recur:'weekly'},
    ]},
    {section:'afterschool',label:'After School',time:'3:15\u20135:00 pm',tasks:[
      {id:'fri-as1',text:'Snack & reading with Laurel',recur:'daily'},
      {id:'fri-as2',text:'Afternoon jobs (overflow tasks)',recur:'daily'},
    ]},
    {section:'church',label:'The Meeting',time:'5:45\u20136:45 pm',tasks:[
      {id:'fri-c1',text:'Kids\u2019 dinner ready in advance before leaving',recur:'daily',note:true},
    ]},
    {section:'night',label:'Night Prep',time:'8:00\u20138:30 pm',tasks:[
      {id:'fri-n1',text:'No lunchboxes (weekend)',recur:'daily',note:true},
      {id:'fri-n2',text:'Set washing machine timer if catch-up load needed',recur:'daily'},
      {id:'fri-n3',text:'Quick kitchen reset',recur:'daily'},
      {id:'fri-n4',text:'Check weekend schedule',recur:'daily'},
    ]},
  ],
  Saturday: [
    {section:'morning',label:'Morning',time:'6:30\u201311:00 am',tasks:[
      {id:'sat-m1',text:'Relaxed family morning',recur:'daily',note:true},
      {id:'sat-m2',text:'Clothes wash \u2014 catch-up load if needed',recur:'daily'},
      {id:'sat-m3',text:'Light tidying only \u2014 house is already clean',recur:'daily'},
    ]},
    {section:'church',label:'The Meeting',time:'11:10 am\u201312:30 pm',tasks:[]},
    {section:'afternoon',label:'Afternoon',time:'',tasks:[
      {id:'sat-a1',text:'Gardening \u2014 main or supplementary session',recur:'weekly'},
      {id:'sat-a2',text:'Any ironing overflow',recur:'daily'},
      {id:'sat-a3',text:'Prep for Sunday \u2014 lunches, all clothes, bags, nappy bag',recur:'weekly'},
    ]},
    {section:'night',label:'Saturday Night Prep',time:'Sunday ready',tasks:[
      {id:'sat-n1',text:'Lay out Sunday clothes for everyone including Vaughan',recur:'weekly'},
      {id:'sat-n2',text:'Pack church bag & nappy bag fully stocked',recur:'weekly'},
      {id:'sat-n3',text:'Fill water bottles & place by the door',recur:'weekly'},
      {id:'sat-n4',text:'Small snack/milk for Vaughan in car bag',recur:'weekly'},
      {id:'sat-n5',text:'Set alarm for 5:00 am',recur:'weekly'},
    ]},
  ],
  Sunday: [
    {section:'church',label:'Services',time:'Three services today',tasks:[
      {id:'sun-c1',text:'5:45\u20136:45 am \u2014 Supper (breakfast after this service)',note:true},
      {id:'sun-c2',text:'11:10 am\u201312:45 pm \u2014 Reading',note:true},
      {id:'sun-c3',text:'5:15\u20136:15 pm \u2014 Preaching',note:true},
    ]},
    {section:'note',label:'Rest Day',time:'No household tasks',tasks:[
      {id:'sun-n1',text:'No cleaning, no laundry, no ironing today',note:true},
      {id:'sun-n2',text:'Simple lunch (prepped Saturday)',note:true},
      {id:'sun-n3',text:'Vaughan\u2019s first nap between services \u2014 rest if possible',note:true},
    ]},
  ],
};
const LAUNDRY_DATA = [
  {id:'lau-mon',day:'Monday',text:'Clothes load 1',dayNum:1},
  {id:'lau-tue',day:'Tuesday',text:'Clothes load 2 + sheets (Week A: ours / Week B: kids\u2019)',dayNum:2},
  {id:'lau-wed',day:'Wednesday',text:'Clothes load 3',dayNum:3},
  {id:'lau-thu',day:'Thursday',text:'Clothes load 4 + sheets (Week A: kids\u2019 / Week B: ours)',dayNum:4},
  {id:'lau-fri',day:'Friday',text:'Towels — every week',dayNum:5},
  {id:'lau-sat',day:'Saturday',text:'Catch-up load if needed',dayNum:6},
  {id:'lau-sun',day:'Sunday',text:'Rest — no laundry today',dayNum:0},
];

const FORTNIGHT_DATA = {
  a:[
    {day:'Monday',task:'Deep clean bathrooms'},
    {day:'Tuesday',task:'Wash our sheets & pillowcases → remake bed'},
    {day:'Tuesday',task:'Deep clean kitchen (oven, splashbacks, cupboard fronts, rangehood)'},
    {day:'Thursday',task:'Wash kids’ sheets & pillowcases → remake beds'},
    {day:'Thursday',task:'Deep dust (ceiling fans, blinds, shelves, picture frames)'},
    {day:'Wednesday',task:'Long-term cleaning slot (see Long-Term tab)'},
  ],
  b:[
    {day:'Monday',task:'Vacuum throughout'},
    {day:'Tuesday',task:'Wash kids’ sheets & pillowcases → remake beds'},
    {day:'Tuesday',task:'Deep clean laundry (machine drum, lint traps, tub, surfaces)'},
    {day:'Thursday',task:'Wash our sheets & pillowcases → remake bed'},
    {day:'Thursday',task:'Deep dust (ceiling fans, blinds, shelves, picture frames)'},
    {day:'Wednesday',task:'Long-term cleaning slot (see Long-Term tab)'},
  ],
};

const MONTHLY_ITEMS = [
  {id:'mo-1',text:'Book or review medical & dental appointments for the family'},
  {id:'mo-2',text:'Gift planning — check upcoming birthdays & events, order ahead'},
  {id:'mo-3',text:'Review budget for the month ahead'},
  {id:'mo-4',text:'Restock any low household or baby supplies not caught in weekly shop'},
];

// ---- STATE ----
let schedSub='today';
let schedSelectedDay=new Date().getDay();
let schedView='me';
let schedWeek='a'; // week A or B
let schedState={}; // local state: task-{id} → bool
let longtermItems=[]; // from Supabase
let fortnightView='a';
let schedSlots=[]; // BravoChore tasks slotted into today

function getSchedState(key,def){return schedState[key]!==undefined?schedState[key]:def;}
function setSchedState(key,val){schedState[key]=val;saveSchedState();}
function saveSchedState(){try{localStorage.setItem('bc-sched-state',JSON.stringify(schedState));}catch(e){}}
function loadSchedStateLocal(){try{const s=localStorage.getItem('bc-sched-state');if(s)schedState=JSON.parse(s);}catch(e){}}

async function loadScheduleData(){
  loadSchedStateLocal();
  // Load week state from Supabase
  try{
    const ws=await api('bravochore_week_state','GET',null,`?user_code=eq.${CU}`);
    if(ws&&ws[0]){
      schedWeek=ws[0].current_week||'a';
      // Check new day reset
      const today=tdStr();
      if(ws[0].last_open_date&&ws[0].last_open_date!==today){
        // New day — reset daily tasks
        Object.keys(schedState).forEach(k=>{if(k.startsWith('task-'))delete schedState[k];});
        saveSchedState();
      }
      await api('bravochore_week_state','PATCH',{last_open_date:today,current_week:schedWeek},`?user_code=eq.${CU}`);
    }else{
      await api('bravochore_week_state','POST',[{user_code:CU,current_week:'a',last_open_date:tdStr()}]);
    }
  }catch(e){}
  // Load long-term tasks
  try{longtermItems=await api('bravochore_longterm_tasks','GET',null,`?user_code=eq.BJ&order=sort_order.asc`);}
  catch(e){longtermItems=[];}
  // Load today's schedule slots (BravoChore tasks)
  try{const yesterday2=new Date();yesterday2.setDate(yesterday2.getDate()-1);const yStr2=yesterday2.toISOString().slice(0,10);
    schedSlots=await api('bravochore_schedule_slots','GET',null,`?slot_date=gte.${yStr2}&user_code=eq.${CU}&order=created_at.desc`);}
  catch(e){schedSlots=[];}
}

function setSchedSub(name,el){
  schedSub=name;
  document.querySelectorAll('.sched-subnav').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sched-subpage').forEach(p=>p.classList.remove('active'));
  if(el)el.classList.add('active');
  const sp=document.getElementById('ssp-'+name);
  if(sp)sp.classList.add('active');
  if(name==='today')renderSchedToday();
  else if(name==='week')renderSchedWeek();
  else if(name==='laundry')renderSchedLaundry();
  else if(name==='fortnight')renderSchedFortnight();
  else if(name==='longterm')renderSchedLongterm();
  else if(name==='monthly')renderSchedMonthly();
}

function setSchedView(v){
  schedView=v;
  // Update button states
  const btns=['me','partner','both'];
  btns.forEach(n=>{
    const b=document.getElementById('sv-'+n);if(!b)return;
    b.style.background=v===n?'var(--green)':'none';
    b.style.color=v===n?'#fff':'var(--tx2)';
    b.style.borderRadius='100px';
  });
  // Always render — DAY_TASKS are household routines visible to all
  if(document.getElementById('ssp-today')?.classList.contains('active')){
    renderSchedToday();
  }
}

function toggleSchedWeek(){
  schedWeek=schedWeek==='a'?'b':'a';
  updateWeekPill();
  renderSchedToday();
  api('bravochore_week_state','PATCH',{current_week:schedWeek},`?user_code=eq.${CU}`).catch(()=>{});
}

function updateWeekPill(){
  const p=document.getElementById('week-pill');
  if(p){p.textContent='Week '+schedWeek.toUpperCase();p.style.background=schedWeek==='a'?'var(--al)':'#e0e8f5';p.style.color=schedWeek==='a'?'var(--amber)':'#6a80a0';}
}

function renderSchedDayStrip(){
  const strip=document.getElementById('sched-day-strip');if(!strip)return;
  const todayNum=new Date().getDay();
  strip.innerHTML=SCHED_SHORT.map((d,i)=>{
    let cls='sched-day-btn';
    if(i===todayNum)cls+=' today';
    if(i===schedSelectedDay)cls+=' active';
    return `<button class="${cls}" onclick="schedSetDay(${i})">${d}</button>`;
  }).join('');
}

function schedSetDay(d){schedSelectedDay=d;renderSchedDayStrip();renderSchedToday();}

function renderSchedToday(){
  renderSchedDayStrip();
  updateWeekPill();
  const dayName=SCHED_DAYS[schedSelectedDay];
  const sections=DAY_TASKS[dayName]||[];
  const container=document.getElementById('sched-sections');if(!container)return;

  // DAY_TASKS belong to BJ. Show them based on who is viewing what.
  const bjIsMe=CU==='BJ';
  const showRoutines=(schedView==='both')||
    (schedView==='me'&&bjIsMe)||
    (schedView==='partner'&&!bjIsMe);

  if(!showRoutines){
    container.innerHTML=`<div style="padding:32px 16px;text-align:center;color:var(--tx2)">
      <div style="font-size:36px;margin-bottom:12px">📋</div>
      <div style="font-size:15px;font-weight:500;color:var(--tx);margin-bottom:8px">No routines set up yet for ${CU}</div>
      <div style="font-size:13px;line-height:1.6">Switch to <strong>Both</strong> to see the household routines, or tap your partner's code to see theirs.</div>
    </div>`;
    updateSchedProgress(0,0,dayName);
    return;
  }

  let totalTasks=0,doneTasks=0;
  const html=sections.map(sec=>{
    const visibleTasks=sec.tasks.filter(t=>{
      if(!t.week)return true;
      return t.week===schedWeek;
    });
    const checkable=visibleTasks.filter(t=>!t.note);
    const checked=checkable.filter(t=>getSchedState('task-'+t.id,false));
    totalTasks+=checkable.length;doneTasks+=checked.length;

    const itemsHtml=visibleTasks.map(t=>{
      if(t.note)return `<div class="sched-item-note">${t.text}</div>`;
      const isChecked=getSchedState('task-'+t.id,false);
      const badge=t.week?`<span class="sched-badge wk-${t.week}">Wk ${t.week.toUpperCase()}</span>`:
                  t.recur==='weekly'?'<span class="sched-badge weekly">Weekly</span>':'';
      return `<div class="sched-item ${isChecked?'checked':''}" onclick="toggleSchedItem('${t.id}',this)">
        <div class="sched-item-check">${isChecked?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <span class="sched-item-text">${t.text}</span>
        ${badge}
      </div>`;
    }).join('');

    // BravoChore tasks slotted into THIS section type — render with the
    // canonical taskCard() so they look identical to every other place a task
    // appears. Each section now shows only the tasks slotted into IT
    // (previously the gating only allowed afternoon, hiding everything slotted
    // into morning / night-prep / etc.). Wrapped in .sched-bc-task for the
    // small inset look the schedule uses.
    const slottedTasks=schedSlots
      .filter(s=>s.section_type===sec.section)
      .map(s=>tasks.find(t=>t.id==s.task_id))
      .filter(t=>t&&!t.done);
    const bcTasksHtml=schedView!=='partner'&&slottedTasks.length?
      slottedTasks.map(t=>`<div class="sched-bc-task">${taskCard(t)}</div>`).join(''):'';

    const allDone=checkable.length>0&&checked.length===checkable.length;
    return `<div class="sched-section ${sec.section}" id="ss-${sec.section}-${SCHED_DAYS[schedSelectedDay]}">
      <div class="sched-section-hdr" onclick="this.parentElement.classList.toggle('collapsed')">
        <div class="sched-section-dot"></div>
        <span class="sched-section-label">${sec.label}</span>
        ${sec.time?`<span class="sched-section-time">${sec.time}</span>`:''}
        ${checkable.length?`<span class="sched-section-prog ${allDone?'done':''}">${checked.length}/${checkable.length}</span>`:''}
        <span class="sched-section-chevron">▾</span>
      </div>
      <div class="sched-section-body">
        ${itemsHtml}
        ${bcTasksHtml}
        ${sec.section!=='note'?`<button class="sched-add-slot-btn" onclick="openSlotTaskSheet('${sec.section}','${sec.label}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add BravoChore task here
        </button>`:''}
      </div>
    </div>`;
  }).join('');

  container.innerHTML=html||`<div class="empty-state">Nothing scheduled for ${dayName}.</div>`;
  updateSchedProgress(doneTasks,totalTasks,dayName);
  checkScheduleNudge();
}

function toggleSchedItem(taskId,el){
  const cur=getSchedState('task-'+taskId,false);
  setSchedState('task-'+taskId,!cur);
  el.classList.toggle('checked',!cur);
  const chk=el.querySelector('.sched-item-check');
  if(chk)chk.innerHTML=!cur?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':'';
  // Recount progress without full re-render
  const dayName=SCHED_DAYS[schedSelectedDay];
  const sections=DAY_TASKS[dayName]||[];
  let total=0,done=0;
  sections.forEach(sec=>{
    sec.tasks.filter(t=>!t.note&&(!t.week||t.week===schedWeek)).forEach(t=>{
      total++;if(getSchedState('task-'+t.id,false))done++;
    });
  });
  updateSchedProgress(done,total,dayName);
  // Update section progress badge
  const secEl=el.closest('.sched-section');
  if(secEl){
    const allItems=secEl.querySelectorAll('.sched-item');
    const allChecked=secEl.querySelectorAll('.sched-item.checked');
    const prog=secEl.querySelector('.sched-section-prog');
    if(prog){
      prog.textContent=`${allChecked.length}/${allItems.length}`;
      prog.className='sched-section-prog'+(allChecked.length===allItems.length&&allItems.length?' done':'');
    }
  }
}

function updateSchedProgress(done,total,dayName){
  const circle=document.getElementById('prog-circle');
  const pct=document.getElementById('prog-pct');
  const label=document.getElementById('prog-label');
  const sub=document.getElementById('prog-sub');
  if(!circle)return;
  if(total===0){
    circle.style.strokeDashoffset=113;
    if(pct)pct.textContent='–';
    if(label)label.textContent=dayName;
    if(sub)sub.textContent='Rest day';
    return;
  }
  const p=Math.round((done/total)*100);
  circle.style.strokeDashoffset=113-(113*p/100);
  if(pct)pct.textContent=p+'%';
  if(label)label.textContent=p===100?'All done! 🎉':p>=75?'Almost there':p>=50?'Good momentum':'Ready to start';
  if(sub)sub.textContent=`${done} of ${total} tasks done`;
}

// ---- WEEK OVERVIEW ----
function renderSchedWeek(){
  const container=document.getElementById('sched-week-content');if(!container)return;
  container.innerHTML=SCHED_DAYS.map((dayName,i)=>{
    const sections=DAY_TASKS[dayName]||[];
    const total=sections.reduce((s,sec)=>s+sec.tasks.filter(t=>!t.note&&(!t.week||t.week===schedWeek)).length,0);
    const todayNum=new Date().getDay();
    return `<div class="week-ov-card" onclick="schedSetDay(${i});setSchedSub('today',document.getElementById('ssn-today'))">
      <div class="week-ov-hdr" style="${i===todayNum?'background:var(--gl)':''}">
        <div style="width:8px;height:8px;border-radius:50%;background:${i===todayNum?'var(--green)':'var(--bdrm)'};flex-shrink:0"></div>
        <div class="week-ov-day" style="${i===todayNum?'color:var(--green)':''}">${dayName}${i===todayNum?' — Today':''}</div>
        <span class="week-ov-count">${total} items</span>
        <span style="color:var(--tx3);font-size:14px">›</span>
      </div>
    </div>`;
  }).join('');
}

// ---- LAUNDRY ----
function renderSchedLaundry(){
  const container=document.getElementById('sched-laundry-content');if(!container)return;
  const todayNum=new Date().getDay();
  const weekStart=getWeekStart();
  container.innerHTML=LAUNDRY_DATA.map(row=>{
    const key=`laundry-${weekStart}-${row.dayNum}`;
    const isChecked=getSchedState(key,false);
    const isToday=row.dayNum===todayNum;
    return `<div class="laundry-row ${isChecked?'checked':''}" onclick="toggleLaundryItem('${key}')" style="${row.dayNum===0?'opacity:.5;cursor:default':''}">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <span class="laundry-day-lbl ${isToday?'today-day':''}">${row.day}</span>
      <span class="laundry-txt">${row.text}</span>
    </div>`;
  }).join('')+`<button onclick="resetLaundry()" style="margin-top:10px;padding:8px 16px;border-radius:100px;border:1px solid var(--bdrm);background:none;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--tx2)">Reset weekly laundry</button>`;
}

function toggleLaundryItem(key){setSchedState(key,!getSchedState(key,false));renderSchedLaundry();}
function resetLaundry(){const ws=getWeekStart();LAUNDRY_DATA.forEach(r=>setSchedState(`laundry-${ws}-${r.dayNum}`,false));renderSchedLaundry();}
function getWeekStart(){const d=new Date();d.setDate(d.getDate()-d.getDay()+1);return d.toISOString().slice(0,10);}

// ---- FORTNIGHTLY ----
function setFortnightView(w){
  fortnightView=w;
  const ba=document.getElementById('fn-a-btn'),bb=document.getElementById('fn-b-btn');
  if(ba){ba.style.background=w==='a'?'var(--green)':'none';ba.style.borderColor=w==='a'?'var(--green)':'var(--bdrm)';ba.style.color=w==='a'?'#fff':'var(--tx2)';}
  if(bb){bb.style.background=w==='b'?'#6a80a0':'none';bb.style.borderColor=w==='b'?'#6a80a0':'var(--bdrm)';bb.style.color=w==='b'?'#fff':'var(--tx2)';}
  renderSchedFortnight();
}

function renderSchedFortnight(){
  const container=document.getElementById('sched-fortnight-content');if(!container)return;
  const data=FORTNIGHT_DATA[fortnightView];
  container.innerHTML=data.map((item,i)=>{
    const key=`fn-${fortnightView}-${i}`;
    const isChecked=getSchedState(key,false);
    return `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px;cursor:pointer;${isChecked?'opacity:.55':''}" onclick="toggleFortnight('${key}',${i})">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;${isChecked?'text-decoration:line-through;color:var(--tx3)':''}">${item.task}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:2px">${item.day}</div>
      </div>
    </div>`;
  }).join('')+`<button onclick="resetFortnight()" style="margin-top:6px;padding:7px 14px;border-radius:100px;border:1px solid var(--bdrm);background:none;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;color:var(--tx2)">Reset Week ${fortnightView.toUpperCase()}</button>`;
}

function toggleFortnight(key){setSchedState(key,!getSchedState(key,false));renderSchedFortnight();}
function resetFortnight(){FORTNIGHT_DATA[fortnightView].forEach((_,i)=>setSchedState(`fn-${fortnightView}-${i}`,false));renderSchedFortnight();}

// ---- LONG-TERM ----
function renderSchedLongterm(){
  const container=document.getElementById('sched-longterm-content');if(!container)return;
  if(!longtermItems.length){container.innerHTML='<div class="empty-state">Loading...</div>';return;}
  container.innerHTML=longtermItems.map(item=>{
    const last=item.last_done;
    let statusText='Not recorded',statusCls='';
    if(last){
      const weeksSince=Math.floor((new Date()-new Date(last))/(7*24*60*60*1000));
      if(weeksSince>12){statusText=weeksSince+'w ago — overdue';statusCls='overdue';}
      else if(weeksSince>8){statusText=weeksSince+'w ago — due soon';statusCls='due-soon';}
      else{statusText=weeksSince+'w ago — ok';statusCls='ok';}
    }
    return `<div class="lt-item">
      <div class="lt-check ${last?'checked':''}" onclick="tickLongterm(${item.id},this)">
        ${last?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0">
        <div class="lt-txt">${item.title}</div>
        <div class="lt-status ${statusCls}" style="font-size:11px;margin-top:2px">${statusText}</div>
      </div>
      <input type="date" class="lt-date-input" value="${last||''}" onchange="setLongtermDate(${item.id},this.value)" onclick="event.stopPropagation()">
    </div>`;
  }).join('');
}

async function tickLongterm(id,el){
  const today=tdStr();
  el.classList.add('checked');
  el.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const item=longtermItems.find(x=>x.id===id);if(item)item.last_done=today;
  try{await api('bravochore_longterm_tasks','PATCH',{last_done:today},`?id=eq.${id}`);}catch(e){}
  renderSchedLongterm();
}

async function setLongtermDate(id,val){
  const item=longtermItems.find(x=>x.id===id);if(item)item.last_done=val;
  try{await api('bravochore_longterm_tasks','PATCH',{last_done:val},`?id=eq.${id}`);}catch(e){}
  renderSchedLongterm();
}

// ---- MONTHLY ----
function renderSchedMonthly(){
  const container=document.getElementById('sched-monthly-content');if(!container)return;
  const monthKey=new Date().toISOString().slice(0,7);
  container.innerHTML=MONTHLY_ITEMS.map(item=>{
    const key=`monthly-${monthKey}-${item.id}`;
    const isChecked=getSchedState(key,false);
    return `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:7px;cursor:pointer;${isChecked?'opacity:.55':''}" onclick="toggleMonthlyItem('${key}')">
      <div class="task-check ${isChecked?'checked':''}" style="flex-shrink:0"></div>
      <div style="font-size:13px;flex:1;${isChecked?'text-decoration:line-through;color:var(--tx3)':''}">${item.text}</div>
    </div>`;
  }).join('');
}

function toggleMonthlyItem(key){setSchedState(key,!getSchedState(key,false));renderSchedMonthly();}
function resetMonthlyTasks(){const mk=new Date().toISOString().slice(0,7);MONTHLY_ITEMS.forEach(i=>setSchedState(`monthly-${mk}-${i.id}`,false));renderSchedMonthly();}

// ---- BRAVOCHORE TASK SLOTTING ----
function openSlotTaskSheet(sectionType,sectionLabel){
  const slottedIds=schedSlots.map(s=>s.task_id);
  const available=tasks.filter(t=>!t.done&&!slottedIds.includes(t.id));
  const picker=document.createElement('div');
  picker.setAttribute('data-picker','1');
  picker.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:flex-end;justify-content:center';
  picker.innerHTML=`<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:700px;max-height:82vh;display:flex;flex-direction:column;padding-bottom:max(16px,env(safe-area-inset-bottom))">
    <div style="padding:14px 16px 10px;border-bottom:1px solid var(--bdr);background:var(--surf);border-radius:20px 20px 0 0;flex-shrink:0">
      <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:500;margin-bottom:2px">Add to ${sectionLabel}</div>
      <div style="font-size:11px;color:var(--tx2)">Tap to slot a BravoChore task into today</div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:6px 14px">
      ${available.length?available.map(t=>{
        const o=getOwner(t.owner);
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--bdr);cursor:pointer" onclick="confirmSlotTask(${t.id},'${sectionType}',this)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${t.title}</div>
            <div style="display:flex;gap:5px;margin-top:3px;align-items:center">
              <span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>
              ${t.due?`<span class="task-date ${t.due<tdStr()?'ov':''}">${fmtDate(t.due)}</span>`:''}
              ${t.task_code?`<span class="task-code">${t.task_code}</span>`:''}
            </div>
          </div>
          <span style="color:var(--green);font-size:22px;font-weight:300">+</span>
        </div>`;
      }).join(''):'<p style="padding:20px;text-align:center;color:var(--tx2);font-size:13px">All tasks are already scheduled for today or none are pending.</p>'}
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--bdr);flex-shrink:0">
      <button onclick="this.closest('[data-picker]').remove()" style="width:100%;padding:11px;background:none;border:1px solid var(--bdrm);border-radius:var(--rs);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;color:var(--tx2)">Cancel</button>
    </div>
  </div>`;
  picker.addEventListener('click',e=>{if(e.target===picker)picker.remove();});
  document.body.appendChild(picker);
}

// Wrapper called from the picker onclick — properly awaits slotTaskToday
// before closing the picker and re-rendering. Previously the inline handler
// fired the async slot insert AND renderSchedToday() in the same tick, so
// the re-render ran before schedSlots.push and the user saw "nothing happened".
async function confirmSlotTask(taskId,sectionType,rowEl){
  // Visual feedback immediately so the tap feels responsive
  if(rowEl){rowEl.style.opacity='.5';rowEl.style.pointerEvents='none';}
  try{
    await slotTaskToday(taskId,sectionType);
  }catch(e){
    chirp('Could not slot task — try again.');
    if(rowEl){rowEl.style.opacity='';rowEl.style.pointerEvents='';}
    return;
  }
  // Close the picker (any was open via [data-picker]) and re-render the schedule
  document.querySelectorAll('[data-picker]').forEach(p=>p.remove());
  if(typeof renderSchedToday==='function')renderSchedToday();
  if(typeof chirp==='function')chirp('Slotted into '+sectionType+'.');
}

async function slotTaskToday(taskId,sectionType){
  const ns={task_id:taskId,user_code:CU,slot_date:tdStr(),section_type:sectionType};
  try{
    const res=await api('bravochore_schedule_slots','POST',[ns]);
    if(res&&res[0])schedSlots.push(res[0]);else schedSlots.push({...ns,id:Date.now()});
  }catch(e){schedSlots.push({...ns,id:Date.now()});}
}

// ---- BLACKBIRD NUDGE ----
async function checkScheduleNudge(){
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yStr=yesterday.toISOString().slice(0,10);
  try{
    const ack=await api('bravochore_nudges_ack','GET',null,`?user_code=eq.${CU}&ack_date=eq.${tdStr()}`);
    if(ack&&ack.length)return;
  }catch(e){}
  // Filter by who the user is currently viewing, not by who is logged in.
  // schedView 'partner' on a BW login means show BJ's misses, etc.
  // Use exact token matching on the owner string so that 'BW' does NOT
  // match owner='BJ', and a task owned only by the partner doesn't leak
  // into the user's own routines view (composite owners like 'BW+BJ' still
  // match both codes, which is correct — the task IS partly each person's).
  const showBoth=schedView==='both';
  const displayedOwner=schedView==='partner'?getPartnerCode():CU;
  const ownerHas=(taskOwner,code)=>{
    if(!taskOwner)return false;
    return taskOwner.split(/[,+\/&\s]+/).some(t=>t.trim()===code);
  };
  const ownerMatch=t=>showBoth?true:ownerHas(t.owner,displayedOwner);
  const slotMatch=s=>showBoth?true:s.user_code===displayedOwner;
  const yesterSlots=schedSlots.filter(s=>s.slot_date===yStr&&!s.completed_at&&slotMatch(s));
  const missedTasks=yesterSlots.map(s=>tasks.find(t=>t.id==s.task_id)).filter(Boolean);
  const overdueTasks=tasks.filter(t=>!t.done&&t.due&&t.due<tdStr()&&ownerMatch(t)).slice(0,5);
  const allMissed=[...missedTasks,...overdueTasks.filter(t=>!missedTasks.find(m=>m.id===t.id))];
  if(!allMissed.length)return;
  const nudge=document.getElementById('sched-nudge');
  const list=document.getElementById('sched-nudge-list');
  if(!nudge||!list)return;
  const scheduled=missedTasks.map(t=>`<div style="padding:2px 0">📌 ${t.task_code||''} ${t.title}</div>`).join('');
  const overdue=overdueTasks.filter(t=>!missedTasks.find(m=>m.id===t.id)).map(t=>`<div style="padding:2px 0">⏰ ${t.task_code||''} ${t.title}</div>`).join('');
  list.innerHTML=(scheduled?`<div style="font-size:11px;font-weight:700;color:var(--gd);margin-bottom:3px">From yesterday's schedule:</div>${scheduled}`:'')+(overdue?`<div style="font-size:11px;font-weight:700;color:var(--amber);margin:5px 0 3px">Also overdue:</div>${overdue}`:'');
  nudge.style.display='block';
  if(typeof lottie!=='undefined'){
    const nb=document.getElementById('sched-nudge-bird');
    if(nb&&!nb.dataset.init){nb.dataset.init='1';const a=lottie.loadAnimation({container:nb,renderer:'svg',loop:false,autoplay:false,animationData:BLACKBIRD_ANIM});a.addEventListener('DOMLoaded',()=>a.goToAndStop(8,true));}
  }
}

async function dismissNudge(){
  document.getElementById('sched-nudge').style.display='none';
  try{await api('bravochore_nudges_ack','POST',[{user_code:CU,ack_date:tdStr()}]);}catch(e){}
}

// Entry point called from bnNav
async function initScheduleView(){
  // Render synchronously first so something appears immediately, even before data loads
  try{
    const meBtn=document.getElementById('sv-me');
    const partnerBtn=document.getElementById('sv-partner');
    if(meBtn)meBtn.textContent=CU;
    if(partnerBtn)partnerBtn.textContent=getPartnerCode();
    setSchedSub('today',document.getElementById('ssn-today'));
  }catch(e){console.warn('Schedule pre-render warning:',e);}
  // Then load data and re-render today with the fresh data
  try{await loadScheduleData();}catch(e){console.warn('Schedule data load failed:',e);}
  try{
    setSchedView(schedView);
    if(schedSub==='today')renderSchedToday();
  }catch(e){console.warn('Schedule re-render warning:',e);}
}

// Returns the partner code for the current user — first non-CU active person in the household
function getPartnerCode(){
  const others=people.filter(p=>p.code!==CU);
  if(!others.length)return CU;
  // Prefer BJ↔BW pairing if both exist
  if(CU==='BW'&&others.some(p=>p.code==='BJ'))return 'BJ';
  if(CU==='BJ'&&others.some(p=>p.code==='BW'))return 'BW';
  return others[0].code;
}

