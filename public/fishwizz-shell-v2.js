(()=>{
 const $=id=>document.getElementById(id);
 const pageBtn=id=>document.querySelector(`.nav [data-page="${id}"]`);
 // P2: keepGearActive() used to force the Gear nav button to show as
 // selected while the user was actually on Tackle, since Tackle's own
 // primary-nav button was hidden and nothing else would show as selected
 // otherwise. Now that Tackle is a normal, visible, reachable nav item
 // again (see topLabels() above), that override is stale and actively
 // wrong -- app.js's own showPage() already correctly marks whichever
 // button matches the real current page, Tackle included, satisfying
 // "selected state is programmatically exposed" honestly instead of
 // pointing at the wrong control.
 function go(page){const b=pageBtn(page);if(b){b.click();return}if(typeof showPage==='function')showPage(page)}
 function setPageLabel(page,label){const b=pageBtn(page);if(!b)return;const span=b.querySelector('span:last-child');if(span)span.textContent=label;else b.textContent=label;b.setAttribute('aria-label',label)}
 function brand(){document.documentElement.dataset.fishwizzShellV2='1';const b=document.querySelector('.brand');if(b)b.innerHTML='<img src="/atlas-icon.svg" alt=""><span>FishWizz</span>';const a=$('accountBtn');if(a){a.textContent='Profile';a.setAttribute('aria-label','Open Profile');a.onclick=()=>go('account')}}
 function authBanner(){let host=$('fwAuthBanner');if(!host){host=document.createElement('section');host.id='fwAuthBanner';host.className='fw-auth-banner';const hero=document.querySelector('#mission .hero');hero?.insertAdjacentElement('beforebegin',host)}if(!host)return;const signed=!!session?.user;host.hidden=signed;if(!signed){host.innerHTML='<div><h3>WELCOME BACK</h3><p>Sign in to save your gear, Missions, catches, and fishing history across devices.</p></div><div class="fw-auth-actions"><button id="fwLogin" class="btn gold" type="button">Log In</button><button id="fwCreate" class="btn ghost" type="button">Create Account</button></div>';$('fwLogin').onclick=()=>go('account');$('fwCreate').onclick=()=>go('account')}}
 function authWatch(){const targets=[$('signedOut'),$('signedIn')].filter(Boolean);if(!targets.length||window.fishwizzAuthObserver)return;const observer=new MutationObserver(()=>{authBanner();gatedHints()});targets.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['hidden']}));window.fishwizzAuthObserver=observer}
 // P2 (release-blocking stabilization, 2026-08-28): "The visible Tackle
 // button was exposed to accessibility tools as an unnamed button." Root
 // cause: this used to also hide the primary-nav Tackle button
 // (hidden=true + aria-hidden="true" + tabIndex=-1) once gearBridge()
 // below provided an alternate "Tackle Box" shortcut from inside Gear --
 // but .nav button{display:flex!important} in landing-app-theme.css/
 // fishwizz-v1.css applies unconditionally at most viewport widths, with no
 // matching .nav button[hidden]{display:none} override outside the one
 // narrow mobile media query that happens to have it. The button stayed
 // visually present and mouse-clickable while simultaneously marked
 // aria-hidden and unfocusable -- a real, inconsistent, CSS-vs-JS state,
 // not a simple "forgot the aria-label" bug (index.html's own
 // aria-label="Tackle" was never touched or removed). Rather than patch
 // the CSS to make the hide fully work (which would leave Tackle
 // unreachable from primary nav at all, contradicting the P2 acceptance
 // criteria's own "Tackle is discoverable as a button named 'Tackle'" and
 // "all primary navigation buttons are reachable in a logical keyboard
 // order"), this stops hiding it: Tackle stays a normal, always-visible,
 // always-keyboard-reachable primary nav item, exactly as index.html
 // already correctly labels it. gearBridge()'s in-page "Tackle Box"
 // shortcut is unaffected and still works as a supplementary path.
 function topLabels(){setPageLabel('mission','Mission');setPageLabel('waters','Map');setPageLabel('arsenal','Gear')}
 function gearBridge(){const arsenalHero=document.querySelector('#arsenal .hero'),tackleHero=document.querySelector('#tackle .hero');if(arsenalHero&&!$('fwGearBridge')){const row=document.createElement('div');row.id='fwGearBridge';row.className='row fw-gear-bridge';row.innerHTML='<button id="fwJumpAddGear" class="btn gold" type="button">+ Add Gear</button><button id="fwOpenTackle" class="btn" type="button">Tackle Box</button>';arsenalHero.insertAdjacentElement('afterend',row);$('fwJumpAddGear').onclick=()=>{const jump=()=>{const add=$('inventoryAdd');if(add)add.scrollIntoView({behavior:'smooth',block:'start'});else setTimeout(jump,100)};jump()};$('fwOpenTackle').onclick=()=>go('tackle')}if(tackleHero&&!$('fwBackToGear')){const back=document.createElement('button');back.id='fwBackToGear';back.className='btn ghost fw-back-to-gear';back.type='button';
   // P3-14 ("hide decorative chevrons/symbols from assistive technology"):
   // the arrow used to be part of the same text node as "Back to Gear", so
   // it was read aloud as part of the accessible name by AT that does speak
   // it. Split into its own aria-hidden span; the accessible name is now
   // exactly "Back to Gear".
   back.innerHTML='<span aria-hidden="true">←</span> Back to Gear';tackleHero.insertAdjacentElement('afterend',back);back.onclick=()=>go('arsenal')}}
 function mapCopy(){const hero=document.querySelector('#waters .hero h1');if(hero)hero.textContent='Choose Exact Spot';const p=document.querySelector('#waters .hero p');if(p)p.textContent='Tap the exact bank, dock, launch, river bend, or boat position you plan to fish. FishWizz identifies one best water match, then you can build your Mission.';const radius=$('mapRadius')?.closest('label');if(radius)radius.hidden=true;const mapCard=$('mapResults')?.closest('.card');const mapTitle=mapCard?.querySelector('h2');if(mapTitle)mapTitle.textContent='Matched water';const profile=$('waterProfile');const profileTitle=profile?.querySelector('h2');if(profileTitle)profileTitle.textContent='Water details';const note=document.querySelector('#waters .map-toolbar .map-note');if(note)note.textContent='Tap your exact fishing position. FishWizz will match one water and will not guess when confidence is low.'}
 function arsenalCopy(){const hero=document.querySelector('#arsenal .hero h1');if(hero)hero.textContent='Add & Manage Gear';const p=document.querySelector('#arsenal .hero p');if(p)p.textContent='Add rods, reels, lures, plastics, trailers, jigs, and tackle. FishWizz uses your saved gear first when it builds a Mission.'}
 function polishAddGear(){const add=$('inventoryAdd');if(!add)return;const h=add.querySelector('h2');if(h)h.textContent='Add Gear';const eyebrow=add.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='Your gear powers your Missions';const copy=add.querySelector('h2+p');if(copy)copy.textContent='Take a clear photo for the fastest add, or enter gear manually. Confirm the details before saving.'}
 // P2-13 ("run local required-field validation before authentication/
 // network checks"): the water-required check already ran first here; added
 // the auth check *after* it, in that same order, rather than as a separate
 // check elsewhere that could fire first. Typed values are untouched either
 // way -- this only ever blocks the click, never clears a field.
 function missionGuard(){document.addEventListener('click',e=>{const b=e.target.closest('#coach');if(!b)return;const water=$('mWater')?.value.trim();if(!water){e.preventDefault();e.stopImmediatePropagation();stat('Choose your fishing spot in Map or enter the water name first.','err');go('waters');return}if(!session?.user){e.preventDefault();e.stopImmediatePropagation();stat('Sign in to build and save a Mission -- your entries here are not lost.','err');go('account')}},true)}
 // P2-10 ("primary buttons clearly state when sign-in is required"): a
 // persistent, always-visible note next to the two primary gated actions --
 // not just an error shown after a failed click -- so a guest knows before
 // they try.
 function gatedHints(){
  const signed=!!session?.user;
  [['coach','Sign in to build and save a Mission.'],['saveCatch','Sign in to save this catch to your fishing journal.']].forEach(([id,msg])=>{
   const btn=$(id);if(!btn)return;
   let hint=document.getElementById(`fwGatedHint_${id}`);
   if(signed){hint?.remove();return}
   if(!hint){hint=document.createElement('p');hint.id=`fwGatedHint_${id}`;hint.className='muted tiny fw-gated-hint';btn.insertAdjacentElement('afterend',hint)}
   hint.textContent=msg;
  });
 }
 function routeWatch(){document.addEventListener('fishwizz:module-loaded',e=>{if(e.detail?.src==='/inventory-add.js')setTimeout(polishAddGear,40)});document.addEventListener('atlas:account-changed',()=>{authBanner();gatedHints()});window.addEventListener('pageshow',()=>{authBanner();gatedHints()})}
 function boot(){brand();topLabels();document.getElementById('fwBottomNav')?.remove();authBanner();authWatch();gatedHints();mapCopy();arsenalCopy();gearBridge();routeWatch();missionGuard();polishAddGear();window.fishwizzShellV2=true}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();