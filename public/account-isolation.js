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
  // P0 (staging QA, 2026-08-27, "atomically clear every previous account's...
  // Water value, location..."): the reset above never touched the actual
  // #mWater/#cWater input VALUES or window.atlasFishingLocation -- only the
  // in-memory globals and a few rendered lists. A genuine account switch
  // used to leave whatever the previous account had typed sitting in the
  // Mission/Catch form fields and the selected map position, fully visible
  // to the next account signed in on the same tab.
  window.atlasFishingLocation=null;window.atlasLiveWeather=null;window.atlasActiveSession=null;window.atlasGoToCombo=null;window.atlasPreferredCombo=null;window.atlasAnglerProfile=null;
  ['mWater','cWater','cSpot','cSpecies','cLure','cColor','cLearn'].forEach(id=>{const el=$(id);if(el)el.value=''});
  window.FishWizzGearState?.invalidate?.();
  try{window.__fwGuestDraftClear?.()}catch(e){}
  const arsenal=$('arsenalCards'),tackle=$('tackleCards'),catches=$('recentCatches'),plans=$('planCards'),summary=$('planSummary'),combo=$('cCombo'),feedback=$('feedbackBox');
  if(arsenal)arsenal.innerHTML='<div class="card"><h3>Loading your Arsenal…</h3><p class="muted">Waiting for the signed-in account.</p></div>';
  if(tackle)tackle.innerHTML='<div class="card"><h3>Loading your Tackle Locker…</h3><p class="muted">Waiting for the signed-in account.</p></div>';
  if(catches)catches.innerHTML='Loading your fishing history…';
  if(plans)plans.innerHTML='';
  if(summary)summary.innerHTML='<h2>Build a Mission</h2><p class="muted">Choose your exact fishing position in Map and load current conditions for the strongest Mission.</p>';
  if(combo)combo.innerHTML='<option value="">Select combo</option>';
  if(feedback)feedback.hidden=true;
  document.dispatchEvent(new CustomEvent('atlas:account-state-cleared'));
 }
 // src/runtime/index.js calls window.atlasClearPersonalState?.() on every
 // real Supabase auth-state transition (Google OAuth switches, session-expiry
 // sign-outs, everything), from inside applySession() -- the one authoritative
 // place a session is ever applied (P0, "one authoritative authentication
 // initialization state"). Without this assignment that call is a silent
 // no-op.
 window.atlasClearPersonalState = clearPersonalState;
 // P0 reopened (staging QA, 2026-08-27): this file used to ALSO run its own,
 // completely separate account-change detector -- syncUser(), polled via
 // setTimeout(700/1400/1800ms) off a sessionStorage flag, plus its OWN
 // #signIn/#signUp/#signOut click listeners that fired clearPersonalState()
 // and dispatched a SECOND, independently-timed atlas:account-changed for
 // the exact same real transition src/runtime/index.js's applySession()
 // already handles authoritatively (and atomically, since the P0-1
 // reopening: applySession() is now called directly from the sign-in click
 // handler with the session Supabase's own response already contains, not
 // raced against a delayed poll). Two uncoordinated "is the account
 // different now" detectors running on two different clocks, each capable
 // of independently dispatching atlas:account-changed and calling
 // clearPersonalState(), is close to the textbook definition of what "one
 // authoritative authentication initialization state" (P0 instruction 1)
 // rules out -- and this dispatch never carried the generation/initial
 // fields applySession()'s real dispatch does, so anything relying on those
 // for stale-response cancellation (gear-state.js) could not trust it.
 // Removed entirely; clearPersonalState() (still called from the one real
 // place) is everything this file needs to provide now.
})();
