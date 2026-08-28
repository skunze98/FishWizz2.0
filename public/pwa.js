(()=>{
 let installPrompt=null;const $=id=>document.getElementById(id),loaded=new Set(),groups={
  mission:[['/species-mn-wi.js','atlasSpeciesMnWi'],['/account-isolation.js','atlasAccountIsolation'],['/onboarding.js','atlasOnboarding'],['/map-context.js','atlasContext'],['/mentor-pro.js','atlasMentorPro'],['/ask-atlas.js','atlasAsk'],['/today.js','atlasToday'],['/session-pro.js','atlasSessionPro'],['/mission-loop.js','atlasMissionLoop'],['/mission-why.js','atlasMissionWhy'],['/mission-field-qa.js','atlasMissionFieldQa'],['/mission-condition-qa.js','atlasMissionConditionQa'],['/spatial.js','atlasSpatialMentor'],['/mission-ui-stabilize.js','fishwizzMissionUiStabilized'],['/empty-states.js','fishwizzEmptyStates']],
  waters:[['/waters-precision.js','fishwizzWatersPrecision'],['/waters-pro.js','fishwizzWatersPro'],['/map-professional.js','fishwizzMapProfessional'],['/water-brief.js','atlasWaterBrief'],['/water-mentor-pro.js','atlasWaterMentorPro']],
  arsenal:[['/arsenal-safe.js','atlasArsenalSafe'],['/inventory-add.js','atlasInventoryAdd'],['/gear-master-data.js','fishwizzMasterGearData'],['/gear-catalog.js','fishwizzGearCatalog'],['/manual-gear-pro.js','fishwizzManualGearPro'],['/inventory-camera-v2.js','fishwizzInventoryCameraV2'],['/gear-coach-lite.js','atlasGearCoachLite']],
  tackle:[['/inventory-pro.js','atlasInventoryPro'],['/inventory-add.js','atlasInventoryAdd'],['/gear-master-data.js','fishwizzMasterGearData'],['/gear-catalog.js','fishwizzGearCatalog'],['/manual-gear-pro.js','fishwizzManualGearPro'],['/inventory-camera-v2.js','fishwizzInventoryCameraV2']],
  howto:[['/how-to.js','fishwizzHowTo'],['/how-to-refine.js','fishwizzHowToRefine'],['/howto-regulations.js','fishwizzHowToRegulations'],['/howto-retrieve-qa.js','fishwizzHowToRetrieveQa']],
  catches:[['/catch-pro.js','atlasCatchPro'],['/catch-history-pro.js','atlasCatchHistoryPro'],['/map-professional.js','fishwizzMapProfessional']],
  account:[['/angler-profile.js','atlasAnglerProfile'],['/personal-hub.js','atlasPersonalHub'],['/angler-insights.js','atlasAnglerInsights'],['/learning-paths.js','atlasLearningPaths'],['/account-polish.js','atlasAccountPolish'],['/learning-focus.js','atlasLearningFocus']]
 };
 function addControls(){const top=document.querySelector('header .top');if(!top||$('shareAtlas'))return;const wrap=document.createElement('div');wrap.className='row';wrap.innerHTML='<button id="shareAtlas" class="account-link" type="button">Share</button><button id="installAtlas" class="account-link" type="button" hidden>Install</button><span id="connectionState" class="pill">Checking…</span>';top.appendChild(wrap);$('shareAtlas').addEventListener('click',shareAtlas);$('installAtlas').addEventListener('click',installAtlas);updateConnection()}
 async function shareAtlas(){const data={title:'FishWizz',text:'Try FishWizz — a personal fishing coach, gear locker, fishing journal, and Mission planner that learns from your catches.',url:location.origin};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);stat('FishWizz link copied.','ok')}}catch(e){if(e.name!=='AbortError')stat('Could not share the app.','err')}}
 async function installAtlas(){if(!installPrompt)return stat('Use your browser menu and choose Add to Home Screen.','ok');installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installAtlas').hidden=true}
 function updateConnection(){const el=$('connectionState');if(!el)return;el.textContent=navigator.onLine?'Online':'Offline';el.classList.toggle('bad',!navigator.onLine)}
 function loadOne(src,key){if(loaded.has(key)||document.querySelector(`script[data-${key}]`))return Promise.resolve();return new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.dataset[key]='1';s.async=false;s.onload=()=>{loaded.add(key);delete document.documentElement.dataset.atlasModuleError;document.dispatchEvent(new CustomEvent('fishwizz:module-loaded',{detail:{src,key}}));resolve()};s.onerror=()=>{loaded.delete(key);s.remove();console.error('FishWizz module failed to load:',src);document.documentElement.dataset.atlasModuleError='1';if(typeof stat==='function')stat(`${src.split('/').pop()} did not load. Tap this section again to retry.`,'err');resolve()};document.body.appendChild(s)})}
 async function loadGroup(name){for(const [src,key] of groups[name]||[])await loadOne(src,key)}
 function pageGroup(page){if(page==='waters')return'waters';if(page==='arsenal')return'arsenal';if(page==='tackle')return'tackle';if(page==='howto')return'howto';if(page==='catches')return'catches';if(page==='account')return'account';return'mission'}
 // P1 regression, caught live in a real browser (not the Node test suite)
 // while verifying the fix below: this used to ALSO load a page's group
 // directly off a delegated click on any [data-page] element -- which,
 // once wireShowPageLazyLoad() (below) made showPage() itself do the same
 // thing, meant a single real nav click fired TWO independent, concurrent
 // loadGroup() calls for the same group (one from this listener, one from
 // showPage() -- every [data-page] element's own onclick already calls
 // showPage(), wired in app.js). loadOne()'s de-dup guard checks
 // document.querySelector('script[data-<key>]') to avoid a second
 // <script> tag for something already loading -- but that guard isn't
 // race-proof against two concurrent loadGroup() runs each racing through
 // the SAME group's array with their own interleaved awaits: verified live
 // that this could and did append two separate <script src="/catch-
 // history-pro.js"> tags for one click, each running its own independent
 // IIFE and creating its own #catchHistoryPro section -- a real, visible
 // duplicate on the Catches page, not a theoretical race. Removed the
 // click-based path entirely; showPage() (wired below) is now the ONE
 // place page navigation ever triggers a lazy group load, covering both
 // real clicks and programmatic navigation the same way.
 // P1 regression, caught live in a real browser (not the Node test suite)
 // while verifying the fix below: this used to ALSO load a page's group
 // directly off a delegated click on any [data-page] element AND off a
 // dedicated $('accountBtn') click listener -- both now redundant once
 // wireShowPageLazyLoad() (below) makes showPage() itself do the same
 // thing (every [data-page] element's onclick, and $('accountBtn')'s own
 // onclick, already call showPage() -- both wired in app.js). Two
 // independent, concurrent loadGroup() calls for the same group, each
 // racing through the same array with its own interleaved awaits, is not
 // theoretical: verified live that a single real nav click could append
 // two separate <script src="/catch-history-pro.js"> tags, each running
 // its own IIFE and creating its own #catchHistoryPro section -- a real,
 // visible duplicate on the Catches page. Removed both click-based paths
 // entirely; showPage() is now the ONE place page navigation ever triggers
 // a lazy group load, covering real clicks and programmatic navigation the
 // same way.
 function watchNavigation(){}
 // P1 ("fix incomplete Gear rendering after onboarding" -- staging QA,
 // 2026-08-27): "'Save & Add Gear' initially showed only heading, '+Add
 // Gear', 'Tackle Box' -- no entry controls; clicking '+Add Gear' did
 // nothing; a full refresh fixed it." Root cause -- confirmed by reading
 // this file, not guessed: watchNavigation() above only ever loads a page's
 // lazy module group from a real CLICK on a [data-page] element. onboarding
 // .js's "Save & Add Gear" button calls showPage('arsenal') directly as a
 // function call -- no click ever bubbles through a [data-page] element for
 // watchNavigation()'s delegated listener to see -- so arsenal-safe.js (and
 // every other module in the `arsenal` group) was simply never requested at
 // all. A later manual refresh "fixed" it only because the user then
 // clicked an actual Arsenal/Gear nav tab, which the delegated listener DID
 // see. The same gap exists for every other programmatic showPage() call in
 // this app (repeatMission, prepareCatch, "Build Mission" success
 // redirects, personal-hub.js's profile-action buttons, etc) -- rather than
 // patch each call site individually, showPage() itself (the one shared
 // entry point every one of them already calls) now ensures the target
 // page's lazy group is loaded, exactly like a real nav click already did.
 // Idempotent either way: loadGroup()/loadOne() already no-op once a script
 // has loaded (the `loaded` Set / data-<key> attribute check), so a page
 // reached by both a real click AND a programmatic call never double-loads
 // or double-runs its own boot().
 function wireShowPageLazyLoad(){
  const original=window.showPage;
  if(typeof original!=='function'||original.__fwLazyWrapped)return;
  const wrapped=function(id){loadGroup(pageGroup(id)).catch(e=>console.error('FishWizz: could not load page modules for',id,e));return original(id)};
  wrapped.__fwLazyWrapped=true;
  window.showPage=wrapped;
 }
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installAtlas')?.removeAttribute('hidden')});window.addEventListener('appinstalled',()=>{installPrompt=null;if($('installAtlas'))$('installAtlas').hidden=true;if(typeof stat==='function')stat('FishWizz installed on this device.','ok')});window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
 fwOnReady(async()=>{addControls();watchNavigation();wireShowPageLazyLoad();document.documentElement.dataset.atlasStabilityMode='6';document.documentElement.dataset.fishwizzRelease='v1-ui-locked';await loadGroup('mission');if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').then(r=>r.update()).catch(e=>console.error('FishWizz service worker update failed',e))});
 function fwOnReady(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn()}
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{pwa:{groups,loadGroup,pageGroup,wireShowPageLazyLoad,loaded}});
})();
