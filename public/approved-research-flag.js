(()=>{
 // Feature flag for the approved-research integration. Default: DISABLED. This is the single
 // source of truth every other approved-research file checks before doing anything -- calling the
 // new RPC, rendering the new UI section, or surfacing the new regulation panel. Off by default per
 // the standing instruction: "keep all tactics and regulations non-mission-ready during integration
 // development" and "feature flag that keeps the approved knowledge disabled by default."
 //
 // No env var, no build-time flag -- a runtime localStorage flag (same storage the app already
 // uses for auth, see src/runtime/supabase.js's storageKey), so it can be toggled in a real browser
 // session for the application team's own testing without a redeploy, and defaults to false for
 // every user who has never explicitly turned it on.
 const KEY='fishwizz.approvedResearch.enabled';
 function isEnabled(){try{return localStorage.getItem(KEY)==='true'}catch(e){return false}}
 function enable(){try{localStorage.setItem(KEY,'true');document.dispatchEvent(new CustomEvent('atlas:approved-research-flag-changed',{detail:{enabled:true}}))}catch(e){}}
 function disable(){try{localStorage.removeItem(KEY);document.dispatchEvent(new CustomEvent('atlas:approved-research-flag-changed',{detail:{enabled:false}}))}catch(e){}}
 window.FishWizzApprovedResearchFlag={isEnabled,enable,disable};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{approvedResearchFlag:{isEnabled,enable,disable}});
})();
