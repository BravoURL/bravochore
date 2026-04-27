// ================================================================
// ROUTINE MANAGER — CRUD UI for blocks + routines
// ================================================================
// Settings → Manage routines → opens a stacked editor:
//   - Block list at the top (drag to reorder)
//   - Routines for the selected block below (drag to reorder)
//   - Inline edit for each item
// Writes to bravochore_blocks and bravochore_routines. After any change,
// also calls renderSchedToday() so the live Today view reflects edits.

const ROUTINE_DAY_LABELS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function openRoutineManager(){
  const bd=document.createElement('div');
  bd.className='modal-bd open';
  bd.innerHTML=`
    <div class="modal" style="max-width:680px;width:96vw;max-height:92vh;display:flex;flex-direction:column;padding:0">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <h3 style="margin:0">Manage routines</h3>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">Edit blocks and the routines inside them. Changes persist immediately.</div>
        </div>
        <button onclick="this.closest('.modal-bd').remove()" style="background:none;border:none;font-size:22px;color:var(--tx3);cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      <div id="rm-body" style="flex:1;overflow-y:auto;padding:14px 16px"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--bdr);background:var(--surf2);display:flex;gap:8px">
        <button class="qa-btn" style="flex:1" onclick="addBlock()">+ Add block</button>
      </div>
    </div>`;
  bd.addEventListener('click',e=>{if(e.target===bd)bd.remove();});
  document.body.appendChild(bd);
  renderRoutineManager();
}

function renderRoutineManager(){
  const body=document.getElementById('rm-body');
  if(!body)return;
  if(!routineBlocks.length){
    body.innerHTML='<div style="padding:30px 16px;text-align:center;color:var(--tx2);font-size:13px">No blocks yet. Tap + Add block below to start.</div>';
    return;
  }
  body.innerHTML=routineBlocks
    .slice()
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
    .map(block=>{
      const blockRoutines=routineItems
        .filter(r=>r.block_id===block.id)
        .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
      const dayChips=ROUTINE_DAY_LABELS.map((lbl,i)=>{
        const active=(block.days||'').split(',').map(s=>parseInt(s.trim(),10)).includes(i);
        return `<span style="font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;background:${active?'var(--gl)':'var(--surf2)'};color:${active?'var(--gd)':'var(--tx3)'}">${lbl}</span>`;
      }).join('');
      const blockColor=block.color||'var(--bdrm)';
      return `<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:12px;overflow:hidden">
        <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;background:var(--surf2);border-bottom:1px solid var(--bdr)">
          <div style="width:10px;height:10px;border-radius:50%;background:${blockColor};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:500">${block.icon?block.icon+' ':''}${block.name||'Block'}</div>
            <div style="display:flex;gap:3px;margin-top:3px">${dayChips}</div>
          </div>
          <button class="qa-btn" style="font-size:10px;padding:4px 8px" onclick="editBlock(${block.id})">Edit</button>
          <button class="qa-btn" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red)" onclick="deleteBlock(${block.id})">×</button>
        </div>
        <div style="padding:8px 14px">
          ${blockRoutines.length?blockRoutines.map(r=>{
            const rDayChips=ROUTINE_DAY_LABELS.map((lbl,i)=>{
              const active=(r.days||'').split(',').map(s=>parseInt(s.trim(),10)).includes(i);
              return `<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${active?'var(--gl)':'transparent'};color:${active?'var(--gd)':'var(--tx3)'}">${lbl}</span>`;
            }).join('');
            return `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--bdr);align-items:center">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;color:var(--tx)">${r.title||'Untitled'}</div>
                <div style="display:flex;gap:6px;margin-top:3px;align-items:center;flex-wrap:wrap">
                  ${rDayChips}
                  <span style="font-size:10px;color:var(--tx3)">${r.owners||''}</span>
                  ${r.time_label?`<span style="font-size:10px;color:var(--tx3)">${r.time_label}</span>`:''}
                </div>
              </div>
              <button class="qa-btn" style="font-size:10px;padding:4px 8px" onclick="editRoutine(${r.id})">Edit</button>
              <button class="qa-btn" style="font-size:10px;padding:4px 8px;color:var(--red);border-color:var(--red)" onclick="deleteRoutine(${r.id})">×</button>
            </div>`;
          }).join(''):'<div style="font-size:11px;color:var(--tx3);padding:6px 0">No routines in this block yet.</div>'}
          <button class="qa-btn" style="width:100%;margin-top:8px;font-size:11px;padding:6px" onclick="addRoutine(${block.id})">+ Add routine</button>
        </div>
      </div>`;
    }).join('');
}

// ── Block CRUD ──────────────────────────────────────────────────
async function addBlock(){
  const result=await promptSheet({
    title:'Add block',
    subtitle:'Blocks are time periods in your day (Morning, Afternoon, etc.). Routines live inside them.',
    confirmLabel:'Add block',
    fields:[
      {name:'name',label:'Block name',required:true,placeholder:'e.g. Morning Block'},
      {name:'icon',label:'Icon (single emoji, optional)',value:'☀️'},
      {name:'color',label:'Colour (hex)',value:'#6a9070',placeholder:'#6a9070'},
      {name:'days',label:'Days active (comma-separated, 0=Sun, 6=Sat)',value:'1,2,3,4,5'},
      {name:'start_time',label:'Start time (optional, HH:MM)',value:''},
      {name:'end_time',label:'End time (optional, HH:MM)',value:''}
    ]
  });
  if(!result)return;
  const row={
    household_code:'WALLIS',
    owner:'BJ',
    name:result.name,
    icon:result.icon||'☀️',
    color:result.color||'#6a9070',
    days:result.days||'1,2,3,4,5',
    start_time:result.start_time||null,
    end_time:result.end_time||null,
    sort_order:routineBlocks.length+1
  };
  badge('sy','↻');
  try{
    const r=await api('bravochore_blocks','POST',[row]);
    if(r&&r[0])routineBlocks.push(r[0]);
    badge('ok','✓');
    chirp('Block added.');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){badge('er','⚠');}
}

async function editBlock(id){
  const b=routineBlocks.find(x=>x.id===id);if(!b)return;
  const result=await promptSheet({
    title:'Edit block',
    confirmLabel:'Save',
    fields:[
      {name:'name',label:'Block name',value:b.name||'',required:true},
      {name:'icon',label:'Icon',value:b.icon||''},
      {name:'color',label:'Colour (hex)',value:b.color||'#6a9070'},
      {name:'days',label:'Days active (0=Sun..6=Sat)',value:b.days||''},
      {name:'start_time',label:'Start time (HH:MM)',value:b.start_time||''},
      {name:'end_time',label:'End time (HH:MM)',value:b.end_time||''}
    ]
  });
  if(!result)return;
  Object.assign(b,{
    name:result.name,
    icon:result.icon||null,
    color:result.color||null,
    days:result.days||'1,2,3,4,5',
    start_time:result.start_time||null,
    end_time:result.end_time||null
  });
  badge('sy','↻');
  try{
    await api('bravochore_blocks','PATCH',{
      name:b.name,icon:b.icon,color:b.color,days:b.days,
      start_time:b.start_time,end_time:b.end_time
    },`?id=eq.${id}`);
    badge('ok','✓');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){badge('er','⚠');}
}

async function deleteBlock(id){
  const b=routineBlocks.find(x=>x.id===id);if(!b)return;
  const inBlock=routineItems.filter(r=>r.block_id===id).length;
  const ok=await confirm2('Delete '+(b.name||'this block')+'?',
    inBlock?`This block contains ${inBlock} routine${inBlock===1?'':'s'} which will also be removed.`:'This block has no routines, safe to delete.','btn-ok');
  if(!ok)return;
  routineBlocks=routineBlocks.filter(x=>x.id!==id);
  routineItems=routineItems.filter(r=>r.block_id!==id);
  try{
    // Delete routines first (child rows), then the block
    await api('bravochore_routines','DELETE',null,`?block_id=eq.${id}`);
    await api('bravochore_blocks','DELETE',null,`?id=eq.${id}`);
    chirp('Deleted.');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){chirp('Delete failed.');}
}

// ── Routine CRUD ────────────────────────────────────────────────
async function addRoutine(blockId){
  const block=routineBlocks.find(b=>b.id===blockId);
  const blockRoutines=routineItems.filter(r=>r.block_id===blockId);
  const ownerOptions=people.map(p=>({value:p.code,label:p.name+' ('+p.code+')'}));
  const result=await promptSheet({
    title:'Add routine to '+(block?.name||'block'),
    subtitle:'A routine is a recurring task within this block.',
    confirmLabel:'Add',
    fields:[
      {name:'title',label:'Routine title',required:true,placeholder:'e.g. Clothes wash — load 1'},
      {name:'days',label:'Days active (0=Sun..6=Sat)',value:block?.days||'1,2,3,4,5'},
      {name:'owners',label:'Owners (comma-separated codes)',value:'BJ',type:'select',options:ownerOptions},
      {name:'time_label',label:'Time label (optional)',value:'',placeholder:'e.g. 9:00'},
      {name:'notes',label:'Notes (optional)',type:'textarea',value:''}
    ]
  });
  if(!result)return;
  const row={
    household_code:'WALLIS',
    block_id:blockId,
    title:result.title,
    owners:result.owners||'BJ',
    days:result.days||'1,2,3,4,5',
    time_label:result.time_label||null,
    notes:result.notes||null,
    sort_order:blockRoutines.length+1,
    active:true
  };
  badge('sy','↻');
  try{
    const r=await api('bravochore_routines','POST',[row]);
    if(r&&r[0])routineItems.push(r[0]);
    badge('ok','✓');
    chirp('Routine added.');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){badge('er','⚠');}
}

async function editRoutine(id){
  const r=routineItems.find(x=>x.id===id);if(!r)return;
  const ownerOptions=people.map(p=>({value:p.code,label:p.name+' ('+p.code+')'}));
  const result=await promptSheet({
    title:'Edit routine',
    confirmLabel:'Save',
    fields:[
      {name:'title',label:'Routine title',value:r.title||'',required:true},
      {name:'days',label:'Days active (0=Sun..6=Sat)',value:r.days||'1,2,3,4,5'},
      {name:'owners',label:'Owners (one of...)',value:r.owners||'BJ',type:'select',options:ownerOptions},
      {name:'time_label',label:'Time label',value:r.time_label||''},
      {name:'notes',label:'Notes',type:'textarea',value:r.notes||''}
    ]
  });
  if(!result)return;
  Object.assign(r,{
    title:result.title,
    days:result.days||'1,2,3,4,5',
    owners:result.owners||r.owners,
    time_label:result.time_label||null,
    notes:result.notes||null
  });
  badge('sy','↻');
  try{
    await api('bravochore_routines','PATCH',{
      title:r.title,days:r.days,owners:r.owners,
      time_label:r.time_label,notes:r.notes
    },`?id=eq.${id}`);
    badge('ok','✓');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){badge('er','⚠');}
}

async function deleteRoutine(id){
  const r=routineItems.find(x=>x.id===id);if(!r)return;
  const ok=await confirm2('Delete '+(r.title||'this routine')+'?','Removes it from your weekly cycle.','btn-ok');
  if(!ok)return;
  routineItems=routineItems.filter(x=>x.id!==id);
  try{
    await api('bravochore_routines','DELETE',null,`?id=eq.${id}`);
    chirp('Deleted.');
    renderRoutineManager();
    if(typeof renderSchedToday==='function')renderSchedToday();
  }catch(e){chirp('Delete failed.');}
}
