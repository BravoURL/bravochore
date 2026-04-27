// BOOT
// ================================================================

// Greeting pool for the master Blackbird welcome message. Picked at random on
// each boot so users don't see the same canned line every time.
// Generic by design — no Wallis-specific content.
function pickBlackbirdGreeting(){
  const name=(typeof CUN==='string'&&CUN)?CUN:'';
  const pool=[
    `Morning${name?', '+name:''}. Tap the bird on any task for advice, or ask me anything.`,
    `Hey${name?' '+name:''} — I'm Blackbird. What's on the list today?`,
    `Back at it${name?', '+name:''}. Tap any task for help, or just ask me what to start with.`,
    `Hi${name?' '+name:''}. I can break a task down, suggest tools, or just keep you company. Open any chore to talk.`,
    `Hello${name?' '+name:''}. Quick wins or the big jobs first? I can help you decide.`,
    `Howdy${name?' '+name:''}. Tap a task for tailored advice, or ask me what's overdue.`
  ];
  return pool[Math.floor(Math.random()*pool.length)];
}

async function boot(){
  try{
  buildUserPicker();
  await loadData();
  document.getElementById('loading-screen').style.display='none';
  if(CU){
    document.getElementById('app').style.display='block';
    document.getElementById('bb-fab').style.display='flex';
    setupPill();renderExtraFilters();renderDashboard();initLottie();assignMissingCodes();loadPrefs();setTimeout(checkForActiveSprint,1500);document.getElementById('bn-dashboard')?.classList.add('active');
    if(typeof updateSprintFAB==='function')updateSprintFAB();
    if(typeof loadSuppliers==='function')loadSuppliers();
    if(typeof loadStores==='function')loadStores().then(()=>{if(typeof renderShopping==='function')renderShopping();});
    // Reminders module is parked (UI hidden in index.html) — skip the check so no
    // dormant banner appears. Re-enable when Alexa integration revives the feature.
    // setTimeout(()=>checkReminders(),700);
    setTimeout(()=>bbMsg(pickBlackbirdGreeting(),'from-bb'),100);
  }else{
    document.getElementById('user-picker').style.display='flex';
  }
  }catch(err){
    console.error('Boot error:',err);
    document.getElementById('loading-screen').style.display='none';
    document.getElementById('loading-msg').textContent='Error: '+err.message;
    // Still try to show app with seed data
    tasks=seedT();milestones=seedM();shopping=seedS();
    await loadEvents();
    if(CU){
      document.getElementById('app').style.display='block';
      document.getElementById('bb-fab').style.display='flex';
      setupPill();renderExtraFilters();renderDashboard();initLottie();assignMissingCodes();loadPrefs();setTimeout(checkForActiveSprint,1500);document.getElementById('bn-dashboard')?.classList.add('active');
    if(typeof updateSprintFAB==='function')updateSprintFAB();
    }else{
      document.getElementById('user-picker').style.display='flex';
    }
  }
}
boot();
