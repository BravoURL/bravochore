
// ================================================================
// BLACKBIRD
// ================================================================
function bbNewConversation(){
  // Clear the in-memory chat history (the actual variable is bbHistory; the
  // earlier bbConvHistory reference was a phantom that did nothing). Local
  // UI clears; saved per-message rows in Supabase are left alone as audit trail.
  bbHistory=[];
  const msgs=document.getElementById('bb-msgs');
  if(msgs)msgs.innerHTML='';
  setTimeout(()=>bbMsg("Fresh start. What’s on your mind?",'from-bb'),100);
}
function openBBFullscreen(){
  document.getElementById('bb-fullscreen').classList.add('open');
  document.getElementById('bb-fab').style.display='none';
  setTimeout(()=>{
    const ta=document.getElementById('bb-input');
    if(ta){
      ta.focus();
      if(!ta.dataset.wired){
        ta.dataset.wired='1';
        ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,140)+'px';});
        // Enter sends on desktop; Shift+Enter (or Enter on touch) inserts newline
        ta.addEventListener('keydown',(e)=>{
          if(e.key==='Enter'&&!e.shiftKey&&typeof isTouchDevice==='function'&&!isTouchDevice()){
            e.preventDefault();
            sendToBB();
          }
        });
      }
    }
  },100);
}
function closeBBFullscreen(){
  document.getElementById('bb-fullscreen').classList.remove('open');
  document.getElementById('bb-fab').style.display='flex';
}
function toggleBB(){openBBFullscreen();}
function bbMsg(text,cls){
  const msgs=document.getElementById('bb-msgs');if(!msgs)return;
  const d=document.createElement('div');d.className='bb-msg '+cls;d.textContent=text;
  msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
}
function bbMsgEl(el){
  const msgs=document.getElementById('bb-msgs');if(!msgs)return;
  msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight;
}
function askBBTask(tid,e){
  if(e)e.stopPropagation();
  const t=tasks.find(x=>x.id===tid);if(!t)return;
  bbCtx=t;openBBFullscreen();
  bbMsg(`On "${t.title}" — due ${fmtDate(t.due)}, ${getEffectiveTime(t).toFixed(1)}h. What do you need?`,'from-bb');
}
// Pending photos for BB message
let bbPendingPhotos=[]; // [{file, dataUrl}]
let bbHistory=[]; // conversation history for multi-turn

// Wire photo input
document.addEventListener('DOMContentLoaded',()=>['bb-photo-cam','bb-photo-lib'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el)return;
  el.addEventListener('change',async e=>{
    const files=Array.from(e.target.files);
    for(const f of files){
      const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});
      bbPendingPhotos.push({file:f,dataUrl});
    }
    renderBBPhotoStrip();
    e.target.value='';
  });
}));

function renderBBPhotoStrip(){
  const strip=document.getElementById('bb-photo-strip');if(!strip)return;
  if(!bbPendingPhotos.length){strip.classList.remove('visible');strip.innerHTML='';return;}
  strip.classList.add('visible');
  strip.innerHTML=bbPendingPhotos.map((p,i)=>`<div class="bb-photo-thumb">
    <img src="${p.dataUrl}">
    <button class="bb-photo-rm" onclick="bbRemovePhoto(${i})">✕</button>
  </div>`).join('');
}

function bbRemovePhoto(i){bbPendingPhotos.splice(i,1);renderBBPhotoStrip();}

async function sendToBB(){
  const inp=document.getElementById('bb-input');
  const msg=inp.value.trim();
  const hasPhotos=bbPendingPhotos.length>0;
  if(!msg&&!hasPhotos)return;
  inp.value='';
  inp.style.height='auto'; // reset textarea growth

  // Show user message with photo thumbnails
  if(hasPhotos){
    const photoHtml=bbPendingPhotos.map(p=>`<img src="${p.dataUrl}" style="width:48px;height:48px;border-radius:6px;object-fit:cover;display:inline-block;margin-right:4px">`).join('');
    bbMsgHTML(`<div>${photoHtml}</div>${msg?`<div style="margin-top:4px">${msg}</div>`:''}`,'from-user');
  }else{
    bbMsg(msg,'from-user');
  }

  bbSetState('thinking');

  // Detect sprint intent FIRST (text-only — sprints don't take photos)
  if(detectSprintIntent(msg)&&!hasPhotos){
    bbSetState('idle');
    await startSprintFlow(msg);
    return;
  }
  // Photos go through a unified AI classifier — Claude decides whether the
  // photo is a contact to save (business card / van / signage) or a task to
  // add (broken thing / job to do). This replaces the previous regex-based
  // intent detection which misfired when a photo of a tradie's van was sent
  // without explicit "save contact" wording.
  if(hasPhotos){
    const snapshotPhotos=[...bbPendingPhotos];
    bbPendingPhotos=[];renderBBPhotoStrip();
    await runPhotoBackedIntent(msg,snapshotPhotos);
    bbSetState('idle');
    return;
  }
  // Text-only path: explicit supplier-create command (no photo) takes priority
  if(typeof detectSupplierIntent==='function'&&detectSupplierIntent(msg,false)){
    bbMsg("To save a contact I need a photo of their van, business card, or signage. Snap one and try again — or open Settings → Manage suppliers to add manually.",'from-bb');
    bbSetState('idle');
    return;
  }
  // Detect add-task intent (text-only)
  const addIntent=/add|create|new task|remind|schedule|put.*on.*list|add.*list|need to|remember to|fertilise|trim|fix|paint|install|buy|get|order|plant|clean|wash|repair|replace|sort|organise|organize/i.test(msg);

  const today=tdStr();
  const daysLeft=Math.max(0,Math.ceil((TARGET-new Date())/86400000));
  const overdueTasks=tasks.filter(t=>!t.done&&t.due&&t.due<today);
  const myPending=tasks.filter(t=>!t.done&&t.owner&&t.owner.includes(CU)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')).slice(0,10);
  const doneCount=tasks.filter(t=>t.done).length;

  const taskSummary=`${doneCount}/${tasks.length} tasks done.
OVERDUE: ${overdueTasks.length?overdueTasks.map(t=>`"${t.title}" was due ${fmtDate(t.due)}`).join(', '):'none'}.
${CUN}'s upcoming: ${myPending.map(t=>`"${t.title}" due ${fmtDate(t.due)||'no date'} ${getEffectiveTime(t).toFixed(1)}h`).join(' | ')}`;

  const taskCtx=bbCtx?`Currently viewing task: "${bbCtx.title}" (${bbCtx.bucket}, due ${fmtDate(bbCtx.due)}).`:'';

  // Photo cases were already handled above by runPhotoBackedIntent. From here
  // on it's text-only.
  const userContent=msg;
  const snapshotPhotos=[];

  if(addIntent){
    // TASK CREATION MODE — ask Claude to return structured JSON
    const sys=`You are Blackbird, the AI inside BravoChore. Be warm, direct and genuinely helpful — like a smart friend who knows the household inside out. User: ${CUN}, Perth WA. Respond conversationally. Use bullet points only for steps. Don't be corporate.
${taskSummary}
${taskCtx}

The user wants to add a task. Extract the details and respond ONLY with valid JSON (no markdown, no explanation) in this exact shape:
{
  "title": "concise task title",
  "bucket": "Indoor or Outdoor",
  "owner": "BW or BJ or BW+BJ or Pete",
  "due": "YYYY-MM-DD or null",
  "time_hours": number or null,
  "notes": "any extra detail or instructions",
  "shopping": ["item 1 from Bunnings", "item 2"] or [],
  "shopping_store": "Bunnings or Coles or ABI or Other",
  "blackbird_comment": "one short warm sentence confirming what you're adding"
}

Rules:
- owner defaults to current user: ${CU}
- If user says "tomorrow" use ${new Date(Date.now()+86400000).toISOString().slice(0,10)}
- If user says "this weekend" use next Saturday
- bucket: anything garden/outdoor/exterior = Outdoor, everything else = Indoor
- shopping: only items that need to be bought, not tasks
- Keep title short and clear
- blackbird_comment: dry, warm, brief — like a good assistant confirming the plan`;

    try{
      const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,system:sys,messages:[...bbHistory,{role:'user',content:userContent}]})});
      const data=await res.json();
      const raw=data.content?.find(c=>c.type==='text')?.text||'null';
      let parsed=null;
      try{parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){}
      if(parsed&&parsed.title){
        bbHistory.push({role:'user',content:typeof userContent==='string'?userContent:'[photo + message]'});
        bbHistory.push({role:'assistant',content:raw});
        showBBPreview(parsed,snapshotPhotos);
      }else{
        bbMsg(raw,'from-bb');
      }
    }catch(e){bbMsg("Connection issue — try again.",'from-bb');}
  }else{
    // GENERAL CHAT MODE
    const sys=`You are Blackbird, the AI inside BravoChore. Warm, direct, genuinely helpful — like a smart friend who knows the house. Brent (BW) and Bernadette (BJ), Perth WA. User: ${CUN}. Conversational tone, not corporate.
${taskSummary}
${taskCtx}
Be direct, warm, practical. 2-4 sentences max. Suggest specific Bunnings Perth or ABI Interiors products where relevant.`;
    try{
      const res=await fetch(BB_PROXY,{method:'POST',headers:{'Content-Type':'application/json','apikey':SK},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,system:sys,messages:[...bbHistory,{role:'user',content:userContent}]})});
      const data=await res.json();
      const reply=data.content?.find(c=>c.type==='text')?.text||"Try again.";
      bbHistory.push({role:'user',content:typeof userContent==='string'?userContent:'[photo + message]'});
      bbHistory.push({role:'assistant',content:reply});
      if(bbHistory.length>20)bbHistory=bbHistory.slice(-20);
      bbMsg(reply,'from-bb');
    }catch(e){bbMsg("Connection issue.",'from-bb');}
  }
  bbSetState('idle');
}

function showBBPreview(parsed,photos){
  const ownerLabel=getOwner(parsed.owner||CU).name;
  const o=getOwner(parsed.owner||CU);
  // Store mutable shopping list on the parsed object
  if(!parsed.shopping)parsed.shopping=[];
  const photoHtml=photos.length?`<div class="bb-preview-photos">${photos.map(p=>`<img class="bb-preview-photo" src="${p.dataUrl}">`).join('')}</div>`:'';

  const card=document.createElement('div');
  card.className='bb-preview-card';
  card.dataset.photos=JSON.stringify(photos.map(p=>({dataUrl:p.dataUrl,type:p.file?.type||'image/jpeg',name:p.file?.name||'photo.jpg'})));

  function renderCard(){
    const shopHtml=`<div class="bb-preview-shop" id="preview-shop-section" style="${!parsed.shopping.length&&'display:none'}">
      <strong>To buy (${parsed.shopping_store||'Bunnings'}) — tap ✕ to remove</strong>
      ${parsed.shopping.map((item,i)=>`<div class="bb-shop-item">
        <span class="bb-shop-item-name">${item}</span>
        <button class="bb-shop-rm" onclick="bbRemoveShopItem(this,${i})">✕</button>
      </div>`).join('')}
      <div class="bb-shop-add-row">
        <input class="bb-shop-add-input" placeholder="Add another item..." onkeydown="if(event.key==='Enter')bbAddShopItem(this)">
        <button class="bb-shop-add-btn" onclick="bbAddShopItem(this.previousElementSibling)">+</button>
      </div>
    </div>`;
    card.innerHTML=`
      <div class="bb-preview-title">${parsed.title}</div>
      <div class="bb-preview-row">
        <span class="task-tag" style="background:${o.bg};color:${o.color}">${ownerLabel}</span>
        <span class="task-bucket-b">${parsed.bucket||'Outdoor'}</span>
        ${parsed.due?`<span class="task-date">${fmtDate(parsed.due)}</span>`:''}
        ${parsed.time_hours?`<span class="task-time-b">${parsed.time_hours}h</span>`:''}
      </div>
      ${parsed.notes?`<div style="font-size:12px;color:var(--tx2);margin-bottom:8px">${parsed.notes}</div>`:''}
      ${photoHtml}
      ${shopHtml}
      <div class="bb-confirm-row">
        <button class="bb-confirm-yes" onclick="bbConfirmTask(this)">✓ Add to BravoChore</button>
        <button class="bb-confirm-no" onclick="bbDeclineTask(this)">Edit first</button>
      </div>`;
    card.dataset.parsed=JSON.stringify(parsed);
  }

  // Expose mutators on card so item buttons can reach parsed
  card.bbParsed=parsed;
  card.bbRender=renderCard;
  renderCard();

  if(parsed.blackbird_comment)bbMsg(parsed.blackbird_comment,'from-bb');
  bbMsgEl(card);
}

function bbRemoveShopItem(btn,idx){
  const card=btn.closest('.bb-preview-card');
  card.bbParsed.shopping.splice(idx,1);
  card.dataset.parsed=JSON.stringify(card.bbParsed);
  card.bbRender();
  // Re-attach render fn after innerHTML replace
  card.bbRender=card.bbRender; // already bound via closure
}

function bbAddShopItem(input){
  const val=input.value.trim();if(!val)return;
  const card=input.closest('.bb-preview-card');
  card.bbParsed.shopping.push(val);
  card.dataset.parsed=JSON.stringify(card.bbParsed);
  input.value='';
  card.bbRender();
}

async function bbConfirmTask(btn){
  const card=btn.closest('.bb-preview-card');
  const parsed=JSON.parse(card.dataset.parsed);
  const photoData=JSON.parse(card.dataset.photos||'[]');
  btn.textContent='Adding...';btn.disabled=true;

  // Step 1: Create task in DB FIRST (with empty photo_urls)
  const nid=Date.now();
  const nt={id:nid,title:parsed.title,owner:parsed.owner||CU,due:parsed.due||null,
    time_hours:parsed.time_hours||0,bucket:parsed.bucket||'Outdoor',
    notes:parsed.notes||'',done:false,sort_order:tasks.length+1,photo_urls:[],
    task_code:getNextCode(),event_id:getActiveEvent()||null};
  tasks.push(nt);
  try{
    await api('bravochore_tasks','POST',[nt]);
  }catch(e){badge('er','⚠ Save failed');btn.textContent='✓ Add to BravoChore';btn.disabled=false;return;}

  // Step 2: Upload photos now that task exists in DB
  if(photoData.length){
    badge('sy','↻ Uploading photos...');
    for(const p of photoData){
      try{
        const res=await fetch(p.dataUrl);
        const blob=await res.blob();
        const file=new File([blob],p.name||'photo.jpg',{type:p.type||'image/jpeg'});
        const url=await uploadPhoto(file,nid);
        nt.photo_urls.push(url);
      }catch(e){console.error('Photo upload failed',e);}
    }
    // Step 3: Update task record with photo URLs
    if(nt.photo_urls.length){
      try{await api('bravochore_tasks','PATCH',{photo_urls:nt.photo_urls},`?id=eq.${nid}`);}catch(e){}
    }
  }
  badge('ok','✓ Task added');

  // Step 4: Add shopping items (read from live parsed which may have been edited).
  // Per BRAND.md milestones-first principle: each shopping item gets a paired
  // "Buy X" milestone on the parent task, and the shopping item is linked back to
  // that milestone via shopping.milestone_id. Ticking either reflects on the other.
  if(parsed.shopping?.length){
    const store=parsed.shopping_store||'Bunnings';
    for(const name of parsed.shopping){
      // Create the "Buy X" milestone first so we can link the shopping item to it
      const msId='ms_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const ms={id:msId,task_id:nid,title:'Buy '+name,done:false,owner:nt.owner,
        due:nt.due,sort_order:milestones.filter(m=>m.task_id===nid).length+1,time_hours:0};
      milestones.push(ms);
      try{await api('bravochore_milestones','POST',[ms]);}catch(e){}
      // Now create the shopping item, linked back to that milestone (and the task)
      const si={id:'si_'+Date.now()+'_'+Math.random().toString(36).slice(2),
        name,store,note:parsed.title,done:false,sort_order:shopping.length+1,
        task_id:nid,milestone_id:msId};
      shopping.push(si);
      try{await api('bravochore_shopping','POST',[si]);}catch(e){}
    }
    renderShopping();
  }

  rerender();
  const shopNote=parsed.shopping?.length?' + '+parsed.shopping.length+' item'+(parsed.shopping.length>1?'s':'')+' added to shopping':'';
  card.innerHTML=`<div style="color:var(--gd);font-weight:600;font-size:13px;padding:4px 0">✓ "${parsed.title}" added${shopNote}</div>`;
}

function bbDeclineTask(btn){
  const card=btn.closest('.bb-preview-card');
  const parsed=JSON.parse(card.dataset.parsed);
  const photoData=JSON.parse(card.dataset.photos||'[]');
  // Open detail panel pre-filled
  openDetail(null);
  setTimeout(()=>{
    document.getElementById('dp-title').textContent=parsed.title;
    if(document.getElementById('dp-owner'))document.getElementById('dp-owner').value=parsed.owner||CU;
    if(document.getElementById('dp-due')&&parsed.due)document.getElementById('dp-due').value=parsed.due;
    if(document.getElementById('dp-time')&&parsed.time_hours)document.getElementById('dp-time').value=parsed.time_hours;
    if(document.getElementById('dp-bucket'))document.getElementById('dp-bucket').value=parsed.bucket||'Outdoor';
    if(document.getElementById('dp-notes'))document.getElementById('dp-notes').value=parsed.notes||'';
  },100);
  card.remove();
}

function bbMsgHTML(html,cls){
  const msgs=document.getElementById('bb-msgs');if(!msgs)return;
  const d=document.createElement('div');d.className='bb-msg '+cls;d.innerHTML=html;
  msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
}

// Unified photo-driven intent: send the photo + message to Claude and let it
// classify whether this is a supplier (business card / van / signage) or a
// task (work to do). Single API call returns both the kind and the extracted
// fields. Replaces the regex-based intent detection that misfired on photos
// of branded vehicles without explicit "save contact" wording.
async function runPhotoBackedIntent(msg,photos){
  if(!photos||!photos.length){
    bbMsg("Send a photo so I can see what you mean.",'from-bb');
    return;
  }
  const photoBlocks=photos.map(p=>({type:'image',source:{type:'base64',media_type:p.file?.type||'image/jpeg',data:p.dataUrl.split(',')[1]}}));
  const userContent=[...photoBlocks,{type:'text',text:msg||'What is this?'}];
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const sys=`You are Blackbird, the AI inside BravoChore — a household task app. The user has sent a PHOTO and possibly a message. Your job is to figure out whether they want to:

A) SAVE A SUPPLIER — the photo shows business signage, a vehicle with company branding, a business card, a shopfront, or any contact-info source for a tradesperson / service / supplier.

B) ADD A TASK — the photo shows a chore to do (a broken thing, a garden bed, a room, plant, surface) and the user wants to track this work.

C) JUST CHAT — the photo is shown for context but no creation is needed.

Respond ONLY with valid JSON in this exact shape (no markdown):
{
  "kind": "supplier" | "task" | "chat",
  "supplier": { "business_name": "...", "name": "...", "phone": "...", "email": "...", "website": "...", "trades": "comma-separated lowercase tags", "notes": "..." } or null,
  "task": { "title": "...", "bucket": "Indoor or Outdoor", "owner": "${CU}", "due": "YYYY-MM-DD or null", "time_hours": number or null, "notes": "...", "shopping": [], "shopping_store": "Bunnings or Coles or ABI or Other" } or null,
  "blackbird_comment": "one short warm sentence confirming what you saw and what you're saving"
}

Critical decision rules — read carefully:
- Photo of a VEHICLE with company branding + phone number = SUPPLIER (almost always — this is the canonical case Brent uses: snapping a tradie's van at the lights).
- Photo of a BUSINESS CARD = SUPPLIER.
- Photo of SHOPFRONT / SIGNAGE with contact info = SUPPLIER.
- Photo of damage / broken thing / overgrown garden / messy room / plant = TASK.
- When the photo is a clearly-branded service vehicle, return SUPPLIER even if the user's message is vague (e.g. just "this guy", "add this", or empty). Do NOT default to TASK for photos of vehicles with phone numbers visible.
- If the user's message explicitly says "add task" / "remind me" / "I need to" → TASK regardless of photo.
- If the user's message explicitly says "save contact" / "add supplier" → SUPPLIER regardless of photo.

For SUPPLIER:
- "trades" = lowercase comma-separated searchable tags. "Jim's Mowing & Landscaping" → "mowing,landscaping". "ABC Plumbing & Gas" → "plumber,gas-fitter". Common tags: plumber, electrician, painter, carpenter, mowing, landscaping, gardener, builder, tiler, cleaner, roofing, fencing, concreting, tree-service, gas-fitter, glazier.
- Keep phone formatting readable.
- Return null for fields you genuinely can't read. Don't invent.

For TASK:
- owner defaults to ${CU}.
- "tomorrow" → ${tomorrow}. "this weekend" → next Saturday.
- bucket: garden / outdoor / exterior = Outdoor; everything else = Indoor.
- shopping: only items that need to be bought.

Set null for the kind that doesn't apply. The blackbird_comment is shown to the user — keep it warm and brief like a smart friend confirming the plan.`;
  try{
    const res=await fetch(BB_PROXY,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SK},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:700,system:sys,messages:[{role:'user',content:userContent}]})
    });
    const data=await res.json();
    const raw=data.content?.find(c=>c.type==='text')?.text||'null';
    let parsed=null;
    try{parsed=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){console.warn('Photo-intent JSON parse failed:',raw);}
    if(!parsed||!parsed.kind){
      bbMsg("I couldn't read that one. Could you try a clearer shot?",'from-bb');
      return;
    }
    if(parsed.kind==='supplier'&&parsed.supplier&&(parsed.supplier.business_name||parsed.supplier.name||parsed.supplier.phone)){
      const supplier={...parsed.supplier,blackbird_comment:parsed.blackbird_comment};
      if(typeof showBBSupplierPreview==='function')showBBSupplierPreview(supplier,photos);
      else bbMsg("Suppliers module not loaded — open Settings → Manage suppliers to add manually.",'from-bb');
    }else if(parsed.kind==='task'&&parsed.task&&parsed.task.title){
      const taskParsed={...parsed.task,blackbird_comment:parsed.blackbird_comment};
      bbHistory.push({role:'user',content:'[photo + message]'});
      bbHistory.push({role:'assistant',content:raw});
      showBBPreview(taskParsed,photos);
    }else{
      // 'chat' or insufficient data
      bbMsg(parsed.blackbird_comment||"Got it — let me know what you'd like me to do with this.",'from-bb');
    }
  }catch(e){
    console.warn('runPhotoBackedIntent failed:',e);
    bbMsg("Connection issue — try again.",'from-bb');
  }
}

