(()=>{
 const $=id=>document.getElementById(id);
 function clearPersonalState(){
  // The four bare-identifier resets that used to live here (`combos=[]`,
  // `lures=[]`, `selectedWater=null`, `lastMission=null`, each wrapped in its
  // own try/catch) never actually did anything: this file is a classic,
  // non-strict script, so writing an undeclared identifier just creates a
  // duplicate global rather than throwing -- and the window.* resets below
  // already own the real reset. Removed rather than "fixed" with logging,
  // since a catch that can never fire is nothing to monitor.
  window.combos=[];window.lures=[];window.inventory=[];window.catches=[];window.selectedWater=null;window.lastMission=null;
  const arsenal=$('arsenalCards'),tackle=$('tackleCards'),catches=$('recentCatches'),plans=$('planCards'),summary=$('planSummary'),combo=$('cCombo');
  if(arsenal)arsenal.innerHTML='<div class="card"><h3>Loading your Arsenal…</h3><p class="muted">Waiting for the signed-in account.</p></div>';
  if(tackle)tackle.innerHTML='<div class="card"><h3>Loading your Tackle Locker…</h3><p class="muted">Waiting for the signed-in account.</p></div>';
  if(catches)catches.innerHTML='Loading your fishing history…';
  if(plans)plans.innerHTML='';
  if(summary)summary.innerHTML='';
  if(combo)combo.innerHTML='<option value="">Select combo</option>';
  document.dispatchEvent(new CustomEvent('atlas:account-state-cleared'));
 }
 // src/runtime/index.js calls window.atlasClearPersonalState?.() on every
 // real Supabase auth-state transition (Google OAuth switches, session-expiry
 // sign-outs, everything -- not just clicks on #signIn/#signOut/#signUp).
 // Without this assignment that call is a silent no-op and this file's own
 // clearing logic only ever runs for the narrow email-form click paths below.
 window.atlasClearPersonalState = clearPersonalState;
 function currentUser(){try{return session?.user?.id||null}catch(e){console.error('FishWizz: could not read the current session',e);return null}}
 function syncUser(){const id=currentUser(),prev=sessionStorage.getItem('atlas:active_user');const changed=id!==prev;if(id&&prev&&prev!==id)clearPersonalState();if(id)sessionStorage.setItem('atlas:active_user',id);else sessionStorage.removeItem('atlas:active_user');if(changed)document.dispatchEvent(new CustomEvent('atlas:account-changed',{detail:{user_id:id,previous_user_id:prev||null}}))}
 function bind(){
  $('signOut')?.addEventListener('click',()=>{clearPersonalState();sessionStorage.removeItem('atlas:active_user');setTimeout(syncUser,100)});
  $('signIn')?.addEventListener('click',()=>{clearPersonalState();setTimeout(syncUser,700);setTimeout(syncUser,1400)});
  $('signUp')?.addEventListener('click',()=>{clearPersonalState();setTimeout(syncUser,700);setTimeout(syncUser,1400)});
  syncUser();setTimeout(syncUser,700);setTimeout(syncUser,1800);
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
})();