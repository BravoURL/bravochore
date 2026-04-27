// BOOT
// ================================================================
async function boot(){
  try{
  buildUserPicker();
  await loadData();
  document.getElementById('loading-screen').style.display='none';
  if(CU){
    document.getElementById('app').style.display='block';
    document.getElementById('bb-fab').style.display='flex';
    setupPill();renderExtraFilters();renderDashboard();initLottie();assignMissingCodes();loadPrefs();setTimeout(checkForActiveSprint,1500);document.getElementById('bn-dashboard')?.classList.add('active');
    setTimeout(()=>checkReminders(),700);
    setTimeout(()=>bbMsg("Hey — I'm Blackbird. Tap the bird icon on any task for advice, or ask me anything.",'from-bb'),100);
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
    }else{
      document.getElementById('user-picker').style.display='flex';
    }
  }
}
boot();
