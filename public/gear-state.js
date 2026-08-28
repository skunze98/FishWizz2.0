(()=>{
 // P1-5 reopened (staging QA, 2026-08-27): "Gear shows 10 setups, Mission
 // reports 0" was three independent, uncoordinated gear-fetch/cache
 // implementations disagreeing with each other -- arsenal-safe.js's own
 // `state`, mission-inventory-fit.js's own `cache` (separate TTL, separate
 // in-flight fetch), and today.js's own synchronous peek at window.combos
 // with its OWN 15s cache that could freeze a pre-hydration `[]` (the
 // initial value set at boot, before ANY fetch has resolved) as "0 setups"
 // for the rest of that cache window -- and nothing ever told today.js to
 // refresh once the real data arrived, since it never listened for
 // arsenal-safe.js's own atlas:arsenal-loaded event. This module is the one
 // authoritative fetch + cache all three now delegate to. See
 // arsenal-safe.js, mission-inventory-fit.js, and today.js for the rewire.
 const TTL=30000;
 // P1 (release-blocking, 2026-08-28, NO-GO QA -- "Profile showed 5 Tackle,
 // Gear showed 2/2/2, Tackle showed 0 items/No tackle saved yet"):
 // `loaded` used to be one flag covering all four collections, but Gear's
 // own report() (see below) only ever supplies combos/rods/reels -- it has
 // never fetched lures at all, by design (arsenal-safe.js's own comment:
 // "Back to its own direct fetch...with the result then reported to
 // gear-state.js via report() as a side effect"). If Gear is the first
 // inventory-related page visited this session, report() used to mark the
 // WHOLE cache loaded:true while cache.lures was still its untouched
 // initial []. isHydratedFor() (Tackle's only gate) and ensure()'s own
 // freshness check both trusted that flag, so Tackle -- or anything else
 // calling ensure() for real, current gear -- could short-circuit on a
 // cache that had never actually fetched lures, permanently (for the rest
 // of that cache's TTL) showing a false "No tackle saved yet" no matter how
 // much tackle the account actually has. luresLoaded tracks the lures
 // collection specifically, set only by a real fetch that included them.
 let cache={uid:null,at:0,combos:[],rods:[],reels:[],lures:[],loaded:false,luresLoaded:false};
 let inflight=null;

 function emptyState(uid,loaded){return{uid,at:0,combos:[],rods:[],reels:[],lures:[],loaded,luresLoaded:false}}

 // P0 ("cancel or ignore stale asynchronous responses using account id plus
 // generation/request tokens"): every request started here is tagged with
 // the account-change generation active at the moment it was fired
 // (window.fishwizzAuth.generation(), incremented once per REAL account
 // switch by src/runtime/index.js's applySession()). If that generation has
 // moved on by the time the response arrives -- Account B is now active,
 // not the Account A this request was actually for -- the result is
 // discarded outright rather than applied, even if the uid happened to
 // still match by coincidence (a real defense the earlier uid-only check
 // didn't fully provide: two rapid switches A->B->A share the same uid on
 // both ends but are still two different, non-interchangeable sessions).
 async function fetchAll(uid){
  const requestGeneration=window.fishwizzAuth?.generation?.()??null;
  const q=encodeURIComponent(uid);
  const [combos,rods,reels,lures]=await Promise.all([
   api(`/rest/v1/combos?select=id,atlas_id,name,role,primary_lure,rod_id,reel_id&owner_id=eq.${q}&order=atlas_id.asc`),
   api(`/rest/v1/rods?select=id,brand,model,rod_type,length,power,action,lure_rating,line_rating,role&owner_id=eq.${q}&order=brand.asc,model.asc`),
   api(`/rest/v1/reels?select=id,brand,model,reel_type,line_type,line_test,line_color,role&owner_id=eq.${q}&order=brand.asc,model.asc`),
   api(`/rest/v1/lures?select=id,category,brand,model,color,size_weight,quantity,species,clarity,conditions,cover,assigned_combo_id,trailer_pairing,confidence,storage_location,last_used_at,catches_count,bites_count&owner_id=eq.${q}&order=category.asc,model.asc`),
  ]);
  const currentGeneration=window.fishwizzAuth?.generation?.()??null;
  if(requestGeneration!==null&&currentGeneration!==null&&requestGeneration!==currentGeneration){
   const stale=new Error(`stale gear fetch for ${uid} (generation ${requestGeneration}, now ${currentGeneration})`);
   stale.stale=true;
   throw stale;
  }
  cache={uid,at:Date.now(),combos:combos||[],rods:rods||[],reels:reels||[],lures:lures||[],loaded:true,luresLoaded:true};
  // Kept for every reader that peeks at these globals directly (mentor-pro.js's
  // bestOwned(), gear-coach-lite.js, etc) instead of calling ensure() itself --
  // this is the ONE place that ever writes them now, not a second copy of them.
  window.combos=cache.combos.map(c=>({...c,rods:cache.rods.find(r=>r.id===c.rod_id)||null,reels:cache.reels.find(r=>r.id===c.reel_id)||null}));
  window.lures=cache.lures;
  // Go-to-combo restoration used to be duplicated in both arsenal-safe.js
  // and mission-inventory-fit.js (same localStorage key, same computation,
  // harmless but redundant); done once here instead, so it's set correctly
  // even if Gear is never visited before Mission needs it for scoring.
  try{const uid2=session?.user?.id,saved=uid2?localStorage.getItem(`atlas:goToCombo:${uid2}`):null;window.atlasGoToCombo=saved?window.combos.find(c=>String(c.id)===String(saved))||null:null}catch(e){console.error('FishWizz: could not restore go-to combo',e)}
  const detail={combos:cache.combos,rods:cache.rods,reels:cache.reels,lures:cache.lures,uid};
  document.dispatchEvent(new CustomEvent('atlas:gear-hydrated',{detail}));
  // Backward-compatible: gear-coach-lite.js, personal-hub.js, and (until its
  // own rewire below) mission-inventory-fit.js already listen for these two
  // events with this exact count shape -- keeping them dispatched from here,
  // the one real fetch, means those files don't also need editing today.
  document.dispatchEvent(new CustomEvent('atlas:arsenal-loaded',{detail:{combos:cache.combos.length,rods:cache.rods.length,reels:cache.reels.length,user_id:uid}}));
  document.dispatchEvent(new CustomEvent('atlas:tackle-loaded',{detail:{count:cache.lures.length,user_id:uid}}));
  return cache;
 }

 // P1-5 reopened AGAIN, as a release blocker (staging QA, 2026-08-27): after
 // the fix above shipped, Gear went from "shows 10 but a stray empty-state
 // card renders under it" to showing NOTHING -- 0 setups, 0 rods, 0 reels,
 // and Refresh not recovering them -- for an account confirmed to still
 // have all 10/12/10 records (Tackle, on its own separate, untouched fetch,
 // still correctly showed all 47). Two real, independent bugs found:
 //
 // 1. A genuine race with the boot-time auth event: supabase.auth.
 //    onAuthStateChange's very first firing (INITIAL_SESSION) dispatches
 //    atlas:account-changed for an ALREADY-signed-in user refreshing the
 //    page -- not just on an actual account switch (src/runtime/index.js's
 //    own `if (previous) window.atlasClearPersonalState?.()` guard only
 //    skips clearing *personal state*, not this dispatch). If that fires
 //    while this module's very first fetch is still in flight (a real,
 //    plausible timing -- that event only fires once the entire LEGACY
 //    chain has finished loading, which can easily land inside the same
 //    network-latency window as the first combos/rods/reels fetch), the old
 //    unconditional invalidate() here raced consumers into believing the
 //    account had no gear.
 // 2. A failed fetch here was being silently reported as a confirmed-empty
 //    result instead of a genuine error, which arsenal-safe.js's render()
 //    then couldn't tell apart from "this account really has 0 setups" --
 //    exactly what the current instruction requires fixed.
 //
 // Fixed by no longer trusting this module's own fetch as the SOLE source
 // for Gear's own page: arsenal-safe.js (see that file) now does its own
 // direct fetch again, exactly like the prior, working deployment, and
 // reports the result here via report() as a side effect -- so Gear's own
 // correctness no longer depends on this module's invalidate timing at all,
 // while other readers (today.js, mission-inventory-fit.js) still benefit
 // from a single shared fetch when Gear got there first. account-changed
 // now only invalidates when the account genuinely changed.
 function report(uid,{combos,rods,reels,lures}){
  if(!uid)return;
  // luresLoaded is only ever set true here if THIS call actually supplied
  // lures; otherwise it carries forward the prior value for the SAME
  // account (a genuine earlier full fetch this session still counts), or
  // false for a different/fresh account (never inherit another account's
  // "lures are loaded" state).
  const priorLuresLoaded=cache.uid===uid?cache.luresLoaded:false;
  cache={uid,at:Date.now(),combos:combos||[],rods:rods||[],reels:reels||[],lures:lures??cache.lures,loaded:true,luresLoaded:lures!==undefined?true:priorLuresLoaded};
  window.combos=cache.combos.map(c=>({...c,rods:cache.rods.find(r=>r.id===c.rod_id)||null,reels:cache.reels.find(r=>r.id===c.reel_id)||null}));
  if(lures!==undefined)window.lures=cache.lures;
  try{const saved=localStorage.getItem(`atlas:goToCombo:${uid}`);window.atlasGoToCombo=saved?window.combos.find(c=>String(c.id)===String(saved))||null:null}catch(e){console.error('FishWizz: could not restore go-to combo',e)}
  document.dispatchEvent(new CustomEvent('atlas:gear-hydrated',{detail:{...cache}}));
 }

 async function ensure({force=false}={}){
  const uid=session?.user?.id;
  if(!uid){cache=emptyState(null,false);window.combos=[];window.lures=[];return cache}
  // Require luresLoaded too, not just loaded -- a cache Gear's own
  // report() marked loaded:true without ever fetching lures must not be
  // treated as fresh enough for a caller that needs real lures data (see
  // this module's own top-of-file note).
  if(!force&&cache.uid===uid&&cache.loaded&&cache.luresLoaded&&Date.now()-cache.at<TTL)return cache;
  if(inflight?.uid===uid&&!force)return inflight.promise;
  const promise=fetchAll(uid).catch(e=>{
   if(e?.stale){
    // Discarded by design, not a failure -- the account moved on while this
    // request was in flight. Whatever the current cache now holds (for
    // whichever account is actually active) is the right thing to hand
    // back, silently.
    console.warn('FishWizz:',e.message);
    return cache;
   }
   console.error('FishWizz: shared gear state load failed',e);
   // A failed fetch must never look identical to "confirmed zero" -- error
   // is a real, checkable field, not just an inferred loaded:false. Callers
   // that only render an empty state once loaded===true AND error is falsy
   // correctly show a retryable error instead of a false "no gear" message.
   //
   // P0 (release-blocking, 2026-08-28, NO-GO QA): this used to only be the
   // RESOLVED VALUE of the ensure() promise -- module-scope `cache` itself
   // was never reassigned here, so get() (what every peek-only reader like
   // mentor-pro.js's bestOwned() actually calls, never ensure() itself)
   // kept returning the stale pre-fetch loaded:false/error:undefined state
   // forever after a real failure. A reader with no way to distinguish
   // "still loading" from "permanently failed" that also re-renders on
   // every MutationObserver tick would then loop forever, remove+recreate
   // the same node, main thread never goes idle -- see mentor-pro.js's own
   // fix for the other half of this. cache must be reassigned here too so a
   // failure is actually observable via get(), not just via await ensure().
   const failed={...(cache.uid===uid&&cache.loaded?cache:emptyState(uid,false)),error:e?.message||String(e)};
   cache=failed;
   // Readers that only re-check gear state when told to (mentor-pro.js's
   // pending-placeholder refresh, gated on atlas:gear-hydrated so it does
   // not re-render on every unrelated DOM change) previously had no signal
   // at all that a failure had happened -- fetchAll() only ever dispatched
   // its event on success, so a placeholder rendered while this request was
   // in flight stayed on "still checking" forever once it failed, with
   // nothing left to prompt the one legitimate refresh to an honest error
   // state. Mirrors atlas:gear-hydrated's shape closely enough for a
   // listener that only cares "something changed, re-check get()" to reuse.
   document.dispatchEvent(new CustomEvent('atlas:gear-hydrate-failed',{detail:{uid,error:failed.error}}));
   return failed;
  }).finally(()=>{if(inflight?.promise===promise)inflight=null});
  inflight={uid,promise};
  return promise;
 }

 function invalidate(reason){
  // Only actually drop the cache for a REAL account change -- not every
  // firing of atlas:account-changed, which (see the note above) also fires
  // once, harmlessly-in-intent, on a plain refresh for an already-signed-in
  // user. Checking cache.uid alone isn't enough: on the very FIRST load,
  // cache.uid is still null while that first fetch is in flight -- the
  // exact race that caused this reopening -- so also skip when a fetch is
  // already running for exactly this account; let it finish and populate
  // the cache normally instead of discarding its result out from under it.
  const incomingUid=reason?.user_id;
  if(incomingUid&&(incomingUid===cache.uid||incomingUid===inflight?.uid))return;
  cache=emptyState(null,false);
  // P1 (release-blocking, 2026-08-28, NO-GO QA): a genuine account switch
  // used to reset the internal cache object here but never touched the
  // bare window.combos/window.lures globals every reader (angler-profile.js's
  // stats(), mentor-pro.js's bestOwned(), etc) actually peeks directly --
  // leaving the PREVIOUS account's numbers visible until the new account's
  // fetch happens to complete. Clearing them here means a real account
  // switch shows "still checking" (via the loaded:false these readers
  // already handle), never another angler's gear.
  window.combos=[];window.lures=[];
 }
 function forceReset(){cache=emptyState(null,false);inflight=null}
 function get(){return cache}
 function isHydratedFor(uid){return !!uid&&cache.uid===uid&&cache.luresLoaded}

 document.addEventListener('atlas:account-changed',e=>invalidate(e.detail));
 document.addEventListener('atlas:inventory-changed',()=>{forceReset();ensure({force:true}).catch(()=>{})});

 window.FishWizzGearState={ensure,get,invalidate:forceReset,report,isHydratedFor};

 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{gearState:{ensure,get,invalidate,forceReset,report,isHydratedFor}});
})();
