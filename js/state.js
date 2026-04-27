// ================================================================
// CONFIG
// ================================================================
const SB='https://xgmnyhpzuwngdngtttux.supabase.co';
const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbW55aHB6dXduZ2RuZ3R0dHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDYxOTgsImV4cCI6MjA4OTk4MjE5OH0.aQvdjbOSRqQJmBKF-9z7KOXhC2M_gKPZ1m4rQhPZ9eo';
const STORAGE_URL=`${SB}/storage/v1/object/public/bravochore-photos`;
const BB_PROXY=`${SB}/functions/v1/blackbird-proxy`;
const TARGET=new Date('2026-05-02');

// ================================================================
// STATE
// ================================================================
let CU=localStorage.getItem('bc_user'),CUN=localStorage.getItem('bc_username');
let tasks=[],milestones=[],shopping=[];
let people=JSON.parse(localStorage.getItem('bc_people')||'null')||[
  {code:'BW',name:'Brent',bg:'#E6F1FB',color:'#185FA5'},
  {code:'BJ',name:'Bernadette',bg:'#FAEEDA',color:'#854F0B'},
  {code:'Pete',name:'Pete',bg:'#EAF3DE',color:'#3B6D11'},
];
let activeTimer=null,timerInterval=null;
let timerSessions=[]; // [{start,end,secs}] for current task
let filterWho='all',filterBucket='all',filterMode=null;
let bbOpen=false,bbCtx=null;
let dpTaskId=null;
let paceView='pace';
let cmResolve=null,cmReject=null;
let dragSrc=null,dragOver=null,dragGhost=null,dragPlaceholder=null,dragOffsetX=0,dragOffsetY=0;

function savePeople(){localStorage.setItem('bc_people',JSON.stringify(people));}
function getOwner(code){return people.find(p=>p.code===code)||{code,name:code,bg:'#F4F3F0',color:'#5a5a56'};}
function ownerTag(code){const o=getOwner(code);return `<span class="task-tag" style="background:${o.bg};color:${o.color}">${o.name}</span>`;}
function ownerTagShort(code){const o=getOwner(code);return `<span class="task-tag" style="background:${o.bg};color:${o.color}">${o.code}</span>`;}

// ================================================================
// API
// ================================================================
async function api(table,method='GET',body=null,params=''){
  const h={'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json'};
  if(method==='POST')h['Prefer']='return=representation';
  if(method==='PATCH')h['Prefer']='return=minimal';
  const r=await fetch(`${SB}/rest/v1/${table}${params}`,{method,headers:h,body:body?JSON.stringify(body):null});
  if(!r.ok)throw new Error(await r.text());
  if(method==='DELETE'||method==='PATCH')return true;
  const t=await r.text();return t?JSON.parse(t):[];
}

async function uploadPhoto(file,taskId){
  const ext=file.name.split('.').pop()||'jpg';
  const name=`task_${taskId}_${Date.now()}.${ext}`;
  const r=await fetch(`${SB}/storage/v1/object/bravochore-photos/${name}`,{
    method:'POST',headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':file.type,'x-upsert':'true'},body:file
  });
  if(!r.ok)throw new Error(await r.text());
  return `${STORAGE_URL}/${name}`;
}

function badge(s,m){const e=document.getElementById('sync-badge');e.className=s;e.textContent=m;if(s==='ok')setTimeout(()=>e.className='',2000);}

// ================================================================
// SEED DATA — corrected buckets (Indoor/Outdoor only)
// ================================================================
function seedT(){return[
{id:1,title:'Restore dining table',owner:'BJ',due:'2026-05-02',time_hours:2,bucket:'Indoor',done:false,sort_order:1,notes:'',photo_urls:[]},
{id:2,title:'Hallway plant',owner:'BJ',due:'2026-04-18',time_hours:0.5,bucket:'Indoor',done:false,sort_order:2,notes:'',photo_urls:[]},
{id:3,title:'Get carpet mats made',owner:'BJ',due:'2026-04-24',time_hours:2,bucket:'Indoor',done:false,sort_order:3,notes:'',photo_urls:[]},
{id:4,title:'Update door hardware to satin brass throughout',owner:'BW',due:'2026-04-25',time_hours:0,bucket:'Indoor',done:false,sort_order:4,notes:'',photo_urls:[]},
{id:5,title:'Arrange replacement for broken window in girls room',owner:'BW',due:'2026-04-11',time_hours:1,bucket:'Indoor',done:false,sort_order:5,notes:'',photo_urls:[]},
{id:6,title:'Edge melamine board in girls room',owner:'BW',due:'2026-04-18',time_hours:2,bucket:'Indoor',done:false,sort_order:6,notes:'',photo_urls:[]},
{id:7,title:'Install wardrobe fittings in girls room',owner:'BW',due:'2026-04-18',time_hours:4,bucket:'Indoor',done:false,sort_order:7,notes:'',photo_urls:[]},
{id:8,title:'Clean out guest room cupboard',owner:'BJ',due:'2026-04-18',time_hours:1,bucket:'Indoor',done:false,sort_order:8,notes:'',photo_urls:[]},
{id:9,title:'Fit out guest rooms with amenities',owner:'BJ',due:'2026-04-18',time_hours:1,bucket:'Indoor',done:false,sort_order:9,notes:'',photo_urls:[]},
{id:10,title:'Wash guest sheets',owner:'BJ',due:'2026-04-25',time_hours:1,bucket:'Indoor',done:false,sort_order:10,notes:'',photo_urls:[]},
{id:11,title:"Set up bed in Vaughan's room",owner:'BW+BJ',due:'2026-05-02',time_hours:2,bucket:'Indoor',done:false,sort_order:11,notes:'',photo_urls:[]},
{id:12,title:'Replace shower handheld holder',owner:'BW',due:'2026-04-25',time_hours:0,bucket:'Indoor',done:false,sort_order:12,notes:'',photo_urls:[]},
{id:13,title:"Tidy up Vaughan's cupboard",owner:'BJ',due:'2026-04-25',time_hours:1,bucket:'Indoor',done:false,sort_order:13,notes:'',photo_urls:[]},
{id:14,title:'Purchase & install powder room/ensuite hooks',owner:'BJ',due:'2026-04-25',time_hours:0,bucket:'Indoor',done:false,sort_order:14,notes:'',photo_urls:[]},
{id:15,title:'Repair laundry floor',owner:'BW',due:'2026-04-12',time_hours:0,bucket:'Indoor',done:false,sort_order:15,notes:'',photo_urls:[]},
{id:16,title:'Change living room downlights to smart downlights',owner:'BW',due:'2026-04-12',time_hours:1,bucket:'Indoor',done:false,sort_order:16,notes:'',photo_urls:[]},
{id:17,title:'Install toilet roll holders',owner:'BW',due:'2026-04-15',time_hours:0,bucket:'Indoor',done:false,sort_order:17,notes:'',photo_urls:[]},
{id:18,title:'Repair timber flooring throughout',owner:'BJ',due:'2026-04-25',time_hours:2,bucket:'Indoor',done:false,sort_order:18,notes:'',photo_urls:[]},
{id:19,title:'Install study pendant',owner:'BW',due:'2026-04-11',time_hours:1,bucket:'Indoor',done:false,sort_order:19,notes:'',photo_urls:[]},
{id:20,title:'Wipe down windows from courtyard splatter',owner:'BW',due:'2026-04-11',time_hours:0.25,bucket:'Outdoor',done:false,sort_order:20,notes:'',photo_urls:[]},
{id:21,title:'Get courtyard fountain up and running',owner:'BW',due:'2026-04-11',time_hours:2,bucket:'Outdoor',done:false,sort_order:21,notes:'',photo_urls:[]},
{id:22,title:'Buy and plant plants around courtyard fountain',owner:'BW',due:'2026-04-13',time_hours:1.5,bucket:'Outdoor',done:false,sort_order:22,notes:'',photo_urls:[]},
{id:23,title:'Sell ride-on mower on Gumtree',owner:'BW',due:'2026-04-13',time_hours:1,bucket:'Indoor',done:false,sort_order:23,notes:'',photo_urls:[]},
{id:24,title:'Purchase and plant Boston ivy in courtyard',owner:'BW',due:'2026-04-25',time_hours:0,bucket:'Outdoor',done:false,sort_order:24,notes:'',photo_urls:[]},
{id:25,title:'Waterblast brickwork',owner:'BW',due:'2026-04-25',time_hours:0,bucket:'Outdoor',done:false,sort_order:25,notes:'',photo_urls:[]},
{id:26,title:'Get front brick paving fixed',owner:'BW',due:'2026-04-25',time_hours:2,bucket:'Outdoor',done:false,sort_order:26,notes:'',photo_urls:[]},
{id:27,title:'Paint letterbox sign green',owner:'BJ',due:'2026-04-25',time_hours:1.5,bucket:'Outdoor',done:false,sort_order:27,notes:'',photo_urls:[]},
{id:28,title:'Paint pots by loungeroom white',owner:'BJ',due:'2026-04-25',time_hours:2,bucket:'Outdoor',done:false,sort_order:28,notes:'',photo_urls:[]},
{id:29,title:'Mulch',owner:'BW',due:'2026-05-02',time_hours:0,bucket:'Outdoor',done:false,sort_order:29,notes:'',photo_urls:[]},
{id:30,title:'Kyle Pl Driveway Garden Bed',owner:'BW',due:'2026-05-02',time_hours:0,bucket:'Outdoor',done:false,sort_order:30,notes:'',photo_urls:[]},
{id:31,title:'Girls room garden',owner:'BW',due:'2026-04-25',time_hours:0,bucket:'Outdoor',done:false,sort_order:31,notes:'',photo_urls:[]},
{id:32,title:'New garden bed creation',owner:'BW',due:'2026-04-27',time_hours:0,bucket:'Outdoor',done:false,sort_order:32,notes:'',photo_urls:[]},
{id:33,title:'Change wilderness retic zone from 2 to 3',owner:'Pete',due:'2026-04-27',time_hours:2,bucket:'Outdoor',done:false,sort_order:33,notes:'',photo_urls:[]},
{id:34,title:'Change Murraya hedge retic from zone 10 to 2',owner:'Pete',due:'2026-04-27',time_hours:1,bucket:'Outdoor',done:false,sort_order:34,notes:'',photo_urls:[]},
{id:35,title:'Trim wilderness where view is disappearing',owner:'Pete',due:'2026-04-17',time_hours:2,bucket:'Outdoor',done:false,sort_order:35,notes:'',photo_urls:[]},
{id:36,title:'Tidy up and organise garage',owner:'BW',due:'2026-04-27',time_hours:0,bucket:'Indoor',done:false,sort_order:36,notes:'',photo_urls:[]},
{id:37,title:'Tidy up and organise toolshed',owner:'BW',due:'2026-04-19',time_hours:0,bucket:'Outdoor',done:false,sort_order:37,notes:'',photo_urls:[]},
{id:38,title:'Set up Clipped Assist for Discovery',owner:'BJ',due:'2026-04-13',time_hours:0.5,bucket:'Indoor',done:false,sort_order:38,notes:'',photo_urls:[]},
{id:39,title:'Get Rockingham guy to quote & repair Discovery',owner:'BW',due:'2026-04-13',time_hours:0.5,bucket:'Indoor',done:false,sort_order:39,notes:'',photo_urls:[]},
{id:40,title:'Get Ranger detailed',owner:'BW',due:'2026-05-02',time_hours:1,bucket:'Indoor',done:false,sort_order:40,notes:'',photo_urls:[]},
{id:41,title:'Get Discovery detailed',owner:'BJ',due:'2026-05-02',time_hours:1,bucket:'Indoor',done:false,sort_order:41,notes:'',photo_urls:[]},
{id:42,title:'Clean kitchen',owner:'BJ',due:'2026-04-29',time_hours:1.5,bucket:'Indoor',done:false,sort_order:42,notes:'',photo_urls:[]},
{id:43,title:'Clean bathrooms',owner:'BJ',due:'2026-05-01',time_hours:0,bucket:'Indoor',done:false,sort_order:43,notes:'',photo_urls:[]},
{id:44,title:'Clean laundry',owner:'BJ',due:'2026-04-29',time_hours:0.33,bucket:'Indoor',done:false,sort_order:44,notes:'',photo_urls:[]},
{id:45,title:'Vacuum and mop',owner:'BJ',due:'2026-05-02',time_hours:1,bucket:'Indoor',done:false,sort_order:45,notes:'',photo_urls:[]},
{id:46,title:'Dust house',owner:'BJ',due:'2026-05-01',time_hours:2,bucket:'Indoor',done:false,sort_order:46,notes:'',photo_urls:[]},
{id:47,title:'Dust skirtings and window sills',owner:'BJ',due:'2026-04-29',time_hours:0.67,bucket:'Indoor',done:false,sort_order:47,notes:'',photo_urls:[]},
{id:48,title:'Plant for outside table pot',owner:'BJ',due:'2026-04-15',time_hours:0.25,bucket:'Outdoor',done:false,sort_order:48,notes:'',photo_urls:[]},
{id:49,title:'Food planning',owner:'BJ',due:'2026-04-18',time_hours:1,bucket:'Indoor',done:false,sort_order:49,notes:'',photo_urls:[]},
{id:50,title:'Make any cooking required',owner:'BJ',due:'2026-04-25',time_hours:2,bucket:'Indoor',done:false,sort_order:50,notes:'',photo_urls:[]},
{id:51,title:'Make beds',owner:'BJ',due:'2026-04-28',time_hours:0.75,bucket:'Indoor',done:false,sort_order:51,notes:'',photo_urls:[]},
{id:52,title:"Finish girls' dresses",owner:'BJ',due:'2026-04-17',time_hours:2,bucket:'Indoor',done:false,sort_order:52,notes:'',photo_urls:[]},
{id:53,title:"Alter Vaughan's romper",owner:'BJ',due:'2026-04-17',time_hours:1,bucket:'Indoor',done:false,sort_order:53,notes:'',photo_urls:[]},
{id:54,title:'Buy shoes/socks for girls',owner:'BJ',due:'2026-04-17',time_hours:1,bucket:'Indoor',done:false,sort_order:54,notes:'',photo_urls:[]},
{id:55,title:'Buy clothes/shoes for Brent',owner:'BJ',due:'2026-04-17',time_hours:1,bucket:'Indoor',done:false,sort_order:55,notes:'',photo_urls:[]},
{id:56,title:'Add shoulder pads to dress',owner:'BJ',due:'2026-04-17',time_hours:1,bucket:'Indoor',done:false,sort_order:56,notes:'',photo_urls:[]},
{id:57,title:'Scarf and belt to wear with dress',owner:'BJ',due:'2026-04-17',time_hours:1,bucket:'Indoor',done:false,sort_order:57,notes:'',photo_urls:[]},
];}

function seedM(){return[
{id:'m2a',task_id:2,title:'Purchase pot',done:false,owner:'BJ',due:'2026-04-18',sort_order:1,time_hours:0.25},
{id:'m2b',task_id:2,title:'Purchase plant',done:false,owner:'BJ',due:'2026-04-18',sort_order:2,time_hours:0.25},
{id:'m4a',task_id:4,title:'Install front door hardware and make good',done:false,owner:'BW',due:'2026-04-25',sort_order:1,time_hours:2},
{id:'m4b',task_id:4,title:'Replace linen cupboard hinges to satin brass',done:false,owner:'BW',due:'2026-04-25',sort_order:2,time_hours:2},
{id:'m4c',task_id:4,title:'Replace all visible screws to satin brass',done:false,owner:'BW',due:'2026-04-25',sort_order:3,time_hours:2},
{id:'m4d',task_id:4,title:'Replace all SS mortice locks with satin brass',done:false,owner:'BW',due:'2026-04-25',sort_order:4,time_hours:2},
{id:'m4e',task_id:4,title:'Replace all face plates and strikes with satin brass',done:false,owner:'BW',due:'2026-04-25',sort_order:5,time_hours:2},
{id:'m4f',task_id:4,title:'Change rebate kit in loungeroom to satin brass',done:false,owner:'BW',due:'2026-04-25',sort_order:6,time_hours:0.5},
{id:'m12a',task_id:12,title:'Purchase handheld holder (ABI)',done:false,owner:'BJ',due:'2026-04-11',sort_order:1,time_hours:0.25},
{id:'m12b',task_id:12,title:'Install handheld holder',done:false,owner:'BW',due:'2026-04-25',sort_order:2,time_hours:0.33},
{id:'m14a',task_id:14,title:'Purchase hooks (ABI)',done:false,owner:'BJ',due:'2026-04-11',sort_order:1,time_hours:0.17},
{id:'m14b',task_id:14,title:'Install hooks',done:false,owner:'BW',due:'2026-04-25',sort_order:2,time_hours:0.33},
{id:'m15a',task_id:15,title:'Purchase replacement lino vinyl from Bunnings',done:false,owner:'BW',due:'2026-04-11',sort_order:1,time_hours:0.33},
{id:'m15b',task_id:15,title:'Install flooring',done:false,owner:'BW',due:'2026-04-12',sort_order:2,time_hours:1},
{id:'m17a',task_id:17,title:'Guest ensuite',done:false,owner:'BW',due:'2026-04-15',sort_order:1,time_hours:1},
{id:'m17b',task_id:17,title:'Master ensuite',done:false,owner:'BW',due:'2026-04-15',sort_order:2,time_hours:1.5},
{id:'m24a',task_id:24,title:'Procure Boston ivy',done:false,owner:'BW',due:'2026-04-18',sort_order:1,time_hours:1},
{id:'m24b',task_id:24,title:'Plant Boston ivy',done:false,owner:'BW',due:'2026-04-25',sort_order:2,time_hours:1},
{id:'m25a',task_id:25,title:'Front driveway',done:false,owner:'BW',due:'2026-04-25',sort_order:1,time_hours:1.5},
{id:'m25b',task_id:25,title:'Front paving',done:false,owner:'BW',due:'2026-04-25',sort_order:2,time_hours:1.5},
{id:'m25c',task_id:25,title:'Front porch',done:false,owner:'BW',due:'2026-04-25',sort_order:3,time_hours:0.5},
{id:'m25d',task_id:25,title:'Side concrete trampoline to chook pen',done:false,owner:'BW',due:'2026-04-25',sort_order:4,time_hours:0.5},
{id:'m25e',task_id:25,title:'Back paving',done:false,owner:'BW',due:'2026-04-25',sort_order:5,time_hours:1.5},
{id:'m25f',task_id:25,title:'Back porch',done:false,owner:'BW',due:'2026-04-25',sort_order:6,time_hours:0.5},
{id:'m25g',task_id:25,title:'Kyle Pl driveway',done:false,owner:'BW',due:'2026-04-25',sort_order:7,time_hours:1.5},
{id:'m25h',task_id:25,title:'Loungeroom porch',done:false,owner:'BW',due:'2026-04-25',sort_order:8,time_hours:0.5},
{id:'m29a',task_id:29,title:'Around playground area garden beds',done:false,owner:'BW',due:'2026-05-02',sort_order:1,time_hours:1},
{id:'m29b',task_id:29,title:'Rose bush garden',done:false,owner:'BW',due:'2026-05-02',sort_order:2,time_hours:1},
{id:'m29c',task_id:29,title:'Wilderness',done:false,owner:'BW',due:'2026-05-02',sort_order:3,time_hours:3},
{id:'m29d',task_id:29,title:'KP driveway both sides',done:false,owner:'BW',due:'2026-05-02',sort_order:4,time_hours:3},
{id:'m29e',task_id:29,title:'Wandu driveway',done:false,owner:'BW',due:'2026-05-02',sort_order:5,time_hours:1},
{id:'m29f',task_id:29,title:'Back corner',done:false,owner:'BW',due:'2026-05-02',sort_order:6,time_hours:1},
{id:'m29g',task_id:29,title:'Lemon tree garden bed',done:false,owner:'BW',due:'2026-05-02',sort_order:7,time_hours:0.5},
{id:'m30a',task_id:30,title:'Retic working near back aircon',done:false,owner:'BW',due:'2026-05-02',sort_order:1,time_hours:2},
{id:'m30b',task_id:30,title:'Retic to all Honey Punchs',done:false,owner:'BW',due:'2026-05-02',sort_order:2,time_hours:1},
{id:'m30c',task_id:30,title:'Level out sand near back aircon',done:false,owner:'BW',due:'2026-05-02',sort_order:3,time_hours:2},
{id:'m30d',task_id:30,title:'Buy and plant new plants',done:false,owner:'BW',due:'2026-05-02',sort_order:4,time_hours:2},
{id:'m31a',task_id:31,title:'Plantings either side of path (liriope)',done:false,owner:'BW',due:'2026-04-15',sort_order:1,time_hours:1},
{id:'m31b',task_id:31,title:'Trim back existing vegetation',done:false,owner:'BW',due:'2026-04-19',sort_order:2,time_hours:1},
{id:'m31c',task_id:31,title:'Procure pines x2',done:false,owner:'BW',due:'2026-04-19',sort_order:3,time_hours:1.5},
{id:'m31d',task_id:31,title:'Plant pines x2',done:false,owner:'BW',due:'2026-04-25',sort_order:4,time_hours:0.5},
{id:'m31e',task_id:31,title:'Pave simple path (do last if time)',done:false,owner:'Pete',due:'2026-04-25',sort_order:5,time_hours:1},
{id:'m32a',task_id:32,title:'Pull up brickwork and stack neatly',done:false,owner:'Pete',due:'2026-04-27',sort_order:1,time_hours:2},
{id:'m32b',task_id:32,title:'Subsurface retic across front of house',done:false,owner:'BW',due:'2026-04-27',sort_order:2,time_hours:0.5},
{id:'m32c',task_id:32,title:'Subsurface retic to new garden',done:false,owner:'BW',due:'2026-04-27',sort_order:3,time_hours:3},
{id:'m32d',task_id:32,title:'Drippers to 3 plants in front of garage',done:false,owner:'BW',due:'2026-04-27',sort_order:4,time_hours:2},
{id:'m32e',task_id:32,title:'Drippers to front porch pots',done:false,owner:'BW',due:'2026-04-27',sort_order:5,time_hours:1.5},
{id:'m32f',task_id:32,title:'Procure and plant new plants',done:false,owner:'BW',due:'2026-04-27',sort_order:6,time_hours:4},
{id:'m36a',task_id:36,title:'Organise racking',done:false,owner:'BW',due:'2026-04-27',sort_order:1,time_hours:2},
{id:'m36b',task_id:36,title:'Move tools to tool shed',done:false,owner:'BW',due:'2026-04-27',sort_order:2,time_hours:1},
{id:'m36c',task_id:36,title:'Move to attic what can go up',done:false,owner:'BW',due:'2026-04-27',sort_order:3,time_hours:1},
{id:'m36d',task_id:36,title:'Paint the floor',done:false,owner:'BW',due:'2026-04-27',sort_order:4,time_hours:4},
{id:'m37a',task_id:37,title:'Cleanout',done:false,owner:'BW',due:'2026-04-19',sort_order:1,time_hours:2},
{id:'m37b',task_id:37,title:'Place for everything, everything in its place',done:false,owner:'BW',due:'2026-04-19',sort_order:2,time_hours:1},
{id:'m37c',task_id:37,title:'Set up small home office section',done:false,owner:'BW',due:'2026-04-19',sort_order:3,time_hours:3},
{id:'m37d',task_id:37,title:'Buy chair',done:false,owner:'BW',due:'2026-04-19',sort_order:4,time_hours:0.75},
{id:'m37e',task_id:37,title:'Spotlessly cleaned and dusted',done:false,owner:'BW',due:'2026-04-19',sort_order:5,time_hours:2},
{id:'m43a',task_id:43,title:'Blue bathroom',done:false,owner:'BJ',due:'2026-05-01',sort_order:1,time_hours:0.5},
{id:'m43b',task_id:43,title:'Green bathroom',done:false,owner:'BJ',due:'2026-05-01',sort_order:2,time_hours:0.25},
{id:'m43c',task_id:43,title:'Ensuite',done:false,owner:'BJ',due:'2026-05-01',sort_order:3,time_hours:0.5},
{id:'m43d',task_id:43,title:'Guest bathroom',done:false,owner:'BJ',due:'2026-05-01',sort_order:4,time_hours:0.25},
];}

function seedS(){return[
{id:'s1',name:'Replacement lino vinyl flooring',store:'Bunnings',note:'Laundry floor',done:false,sort_order:1},
{id:'s2',name:'Plants for courtyard fountain area',store:'Bunnings',note:'Buy & plant around fountain',done:false,sort_order:2},
{id:'s3',name:'Boston ivy',store:'Bunnings',note:'Courtyard — procure first',done:false,sort_order:3},
{id:'s4',name:'Liriope cascade emerald',store:'Bunnings',note:'Girls room garden path edges',done:false,sort_order:4},
{id:'s5',name:'Pines x2',store:'Bunnings',note:'Girls room garden',done:false,sort_order:5},
{id:'s6',name:'Plants for new garden bed',store:'Bunnings',note:'New garden bed creation',done:false,sort_order:6},
{id:'s7',name:'Mulch (bulk)',store:'Bunnings',note:'Multiple garden beds',done:false,sort_order:7},
{id:'s8',name:'Paint — green (letterbox)',store:'Bunnings',note:'Letterbox sign',done:false,sort_order:8},
{id:'s9',name:'Paint — white (pots)',store:'Bunnings',note:'Loungeroom pots',done:false,sort_order:9},
{id:'s10',name:'Smart downlights',store:'Bunnings',note:'Living room',done:false,sort_order:10},
{id:'s11',name:'Shower handheld holder',store:'ABI',note:'Buy before 11 Apr',done:false,sort_order:11},
{id:'s12',name:'Hooks for powder room + guest ensuite',store:'ABI',note:'Back of door & hand towel',done:false,sort_order:12},
{id:'s13',name:'Satin brass door hardware (bulk)',store:'Other',note:'Full hardware update',done:false,sort_order:13},
{id:'s14',name:'Chair for toolshed office',store:'Other',note:'Toolshed setup',done:false,sort_order:14},
];}

// ================================================================
// LOAD
// ================================================================
async function loadData(){
  try{
    badge('sy','↻ Loading...');
    await loadEvents();
    await loadReminders();
    const[t,m,s,tim]=await Promise.all([
      api('bravochore_tasks','GET',null,'?order=sort_order.asc'),
      api('bravochore_milestones','GET',null,'?order=sort_order.asc'),
      api('bravochore_shopping','GET',null,'?order=sort_order.asc'),
      api('bravochore_timers','GET',null,'?status=neq.completed&order=started_at.desc'),
    ]);
    if(t.length===0){
      document.getElementById('loading-msg').textContent='First run — setting up...';
      await api('bravochore_tasks','POST',seedT());
      await api('bravochore_milestones','POST',seedM());
      await api('bravochore_shopping','POST',seedS());
      tasks=seedT();milestones=seedM();shopping=seedS();
    }else{
      // Migrate any old buckets
      tasks=t.map(x=>{
        let b=x.bucket||'Indoor';
        if(b==='Garden'||b==='Vehicles'||b==='Admin')b=b==='Garden'?'Outdoor':b==='Vehicles'?'Indoor':'Indoor';
        return{...x,bucket:b,photo_urls:x.photo_urls||[]};
      });
      milestones=m;shopping=s;
      const myTimer=tim.find(x=>x.user_code===CU&&x.status!=='completed');
      if(myTimer){
        const task=tasks.find(x=>x.id===myTimer.task_id);
        const ms=myTimer.milestone_id?milestones.find(x=>x.id===myTimer.milestone_id):null;
        const estH=ms?parseFloat(ms.time_hours||0):getEffectiveTime(task||{});
        activeTimer={id:myTimer.id,taskId:myTimer.task_id,msId:myTimer.milestone_id,userCode:myTimer.user_code,startedAt:new Date(myTimer.started_at),pausedAt:myTimer.paused_at?new Date(myTimer.paused_at):null,totalPausedSecs:myTimer.total_paused_seconds||0,estimateSecs:estH*3600,label:(ms?ms.title:task?.title)||'Task',status:myTimer.status};
        startTimerInterval();
      }
    }
    refreshShelvedView();
    badge('ok','✓ Synced');
  }catch(e){
    console.error(e);badge('er','⚠ Offline');
    tasks=seedT();milestones=seedM();shopping=seedS();
  }
}

// ================================================================
// UTILS
// ================================================================
function tdStr(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtDate(s){return s?new Date(s+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}):''}
function fmtSecs(s){const m=Math.floor(Math.abs(s)/60),se=Math.floor(Math.abs(s)%60);return `${s<0?'-':''}${String(m).padStart(2,'0')}:${String(se).padStart(2,'0')}`}
function fmtHours(h){
  if(!h||h===0)return '0m';
  const totalMins=Math.round(h*60);
  const days=Math.floor(totalMins/1440);
  const hrs=Math.floor((totalMins%1440)/60);
  const mins=totalMins%60;
  if(days>0&&hrs===0&&mins===0)return days+'d';
  if(days>0&&mins===0)return days+'d '+hrs+'h';
  if(days>0)return days+'d '+hrs+'h '+mins+'m';
  if(hrs===0)return mins+'m';
  if(mins===0)return hrs+'h';
  return hrs+'h '+mins+'m';
}
function hToSecs(h){return Math.round((parseFloat(h)||0)*3600)}
function getMs(tid){return milestones.filter(m=>m.task_id===tid).sort((a,b)=>a.sort_order-b.sort_order)}
function calcTaskTime(tid){const ms=getMs(tid);return ms.length?ms.reduce((s,m)=>s+(parseFloat(m.time_hours)||0),0):0}
function getEffectiveTime(task){const ms=getMs(task.id);return ms.length?calcTaskTime(task.id):parseFloat(task.time_hours)||0}
function allItems(){
  const items=[];
  tasks.forEach(t=>items.push({id:'t'+t.id,owner:t.owner,done:t.done,timeH:getEffectiveTime(t)}));
  milestones.forEach(m=>items.push({id:'m'+m.id,owner:m.owner||tasks.find(t=>t.id===m.task_id)?.owner||'',done:m.done,timeH:parseFloat(m.time_hours)||0}));
  return items;
}
function ownerItems(code){return allItems().filter(i=>i.owner&&i.owner.includes(code))}

