(()=>{
 // P0-2 (QA tracker): make location and Mission state atomic. This app has
 // no build-time type system (plain classic scripts, not TypeScript), so
 // "one canonical LocationSelection type" here means one real invariant
 // enforced at runtime rather than a compile-time shape: a rendered Mission
 // and its Atlas context must always correspond to the location/inputs they
 // were actually built from, and the moment either changes, the stale
 // output is cleared immediately -- not left rendered until the next build.
 //
 // Deliberately event-driven rather than a new setter every call site must
 // be rewritten to use: map.js and map-context.js already dispatch
 // atlas:fishing-position / atlas:water-selected on every real location
 // change, and mission-v3.js already dispatches atlas:mission-built after
 // every successful build. This listens to those existing signals instead
 // of introducing a second, parallel way to select a location -- the
 // smallest coherent change that satisfies the acceptance criteria, not a
 // rewrite of how Map/Mission/Atlas already talk to each other.
 const $=id=>document.getElementById(id);

 function locationKey(){
  const p=window.atlasFishingLocation;
  if(p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)))return`${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`;
  const w=window.selectedWater;
  return w?.id?`water:${w.id}`:(w?.name?`name:${w.name}`:null);
 }
 // Every field buildPlan() (mission-v3.js) actually reads into a Mission's
 // context -- kept in exact sync with that function's own field list so this
 // never drifts into false invalidation or, worse, a missed one.
 const CONTEXT_FIELDS=['mWater','mTarget','mAccess','mClarity','mCover','mDepth','mWind','mLight','mCurrent','mSeason','mSky','mPrecip','mPressure','mWaterTemp','mLevel','mActivity','mWaterType'];
 function contextKey(){return CONTEXT_FIELDS.map(id=>$(id)?.value??'').join('|')}

 function clearStaleMission(reason){
  if(!window.lastMission)return;
  window.lastMission=null;
  window.atlasLiveWeather=null;
  const summary=$('planSummary'),cards=$('planCards'),fb=$('feedbackBox'),ask=$('askAtlasAnswer');
  if(summary)summary.innerHTML='<h2>Build a Mission</h2><p class="muted">Your location or plan inputs changed, so the previous Mission was cleared to avoid showing stale guidance. Build a fresh one when ready.</p>';
  if(cards)cards.innerHTML='';
  if(fb)fb.hidden=true;
  if(ask)ask.innerHTML='';
  document.dispatchEvent(new CustomEvent('atlas:mission-invalidated',{detail:{reason}}));
 }

 let lastLocationKey=locationKey(),lastContextKey=contextKey();

 function checkLocation(){
  const k=locationKey();
  if(k===lastLocationKey)return;
  lastLocationKey=k;
  // Only a Mission that was actually built from a *different* location is
  // stale -- a redundant re-fire of the same spot, or the very first
  // selection when there's nothing built yet, must not clear anything.
  if(window.lastMission?.location_key&&window.lastMission.location_key!==k)clearStaleMission('location changed');
 }
 function checkContext(){
  const k=contextKey();
  if(k===lastContextKey)return;
  lastContextKey=k;
  if(window.lastMission?.context_key&&window.lastMission.context_key!==k)clearStaleMission('plan inputs changed');
 }

 function tagMission(){
  lastLocationKey=locationKey();
  lastContextKey=contextKey();
  if(window.lastMission){window.lastMission.location_key=lastLocationKey;window.lastMission.context_key=lastContextKey}
 }

 function wireContextFields(){CONTEXT_FIELDS.forEach(id=>{const el=$(id);if(el&&!el.dataset.locationGuard){el.dataset.locationGuard='1';el.addEventListener('change',checkContext)}})}

 document.addEventListener('atlas:fishing-position',checkLocation);
 document.addEventListener('atlas:water-selected',checkLocation);
 document.addEventListener('atlas:mission-built',tagMission);
 // Back/forward navigation and bfcache restore (P0-2's "back navigation
 // cannot restore a mixed snapshot") -- re-validate against whatever the DOM
 // actually shows the moment the page becomes visible again, rather than
 // trusting in-memory state that may predate the navigation.
 window.addEventListener('pageshow',()=>{tagMission();checkLocation();checkContext()});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',wireContextFields):wireContextFields();
 // mission-v3.js injects mSeason/mSky/mPrecip/... asynchronously after its
 // own DOMContentLoaded handler runs; a single delayed re-wire catches
 // whichever of the two ran first without a recurring timer.
 setTimeout(wireContextFields,800);

 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{locationState:{locationKey,contextKey,CONTEXT_FIELDS,wireContextFields}});
})();
