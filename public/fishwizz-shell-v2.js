(()=>{
 const $=id=>document.getElementById(id);
 const pageBtn=id=>document.querySelector(`.nav [data-page="${id}"]`);
 function keepGearActive(){document.querySelectorAll('.nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page==='arsenal'))}
 function go(page){const b=pageBtn(page);if(b){b.click();if(page==='tackle')requestAnimationFrame(keepGearActive);return}if(typeof showPage==='function'){showPage(page);if(page==='tackle')requestAnimationFrame(keepGearActive)}}
 function setPageLabel(page,label){const b=pageBtn(page);if(!b)return;const span=b.querySelector('span:last-child');if(span)span.textContent=label;else b.textContent=label;b.setAttribute('aria-label',label)}
 function brand(){document.documentElement.dataset.fishwizzShellV2='1';const b=document.querySelector('.brand');if(b)b.innerHTML='<img src="/atlas-icon.svg" alt=""><span>FishWizz</span>';const a=$('accountBtn');if(a){a.textContent='Profile';a.setAttribute('aria-label','Open Profile');a.onclick=()=>go('account')}}
 function authBanner(){let host=$('fwAuthBanner');if(!host){host=document.createElement('section');host.id='fwAuthBanner';host.className='fw-auth-banner';const hero=document.querySelector('#mission .hero');hero?.insertAdjacentElement('beforebegin',host)}if(!host)return;const signed=!!session?.user;host.hidden=signed;if(!signed){host.innerHTML='<div><h3>WELCOME BACK</h3><p>Sign in to save your gear, Missions, catches, and fishing history across devices.</p></div><div class="fw-auth-actions"><button id="fwLogin" class="btn gold" type="button">Log In</button><button id="fwCreate" class="btn ghost" type="button">Create Account</button></div>';$('fwLogin').onclick=()=>go('account');$('fwCreate').onclick=()=>go('account')}}
 function authWatch(){const targets=[$('signedOut'),$('signedIn')].filter(Boolean);if(!targets.length||window.fishwizzAuthObserver)return;const observer=new MutationObserver(()=>{authBanner();gatedHints()});targets.forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['hidden']}));window.fishwizzAuthObserver=observer}
 function topLabels(){setPageLabel('mission','Mission');setPageLabel('waters','Map');setPageLabel('arsenal','Gear');const tackle=pageBtn('tackle');if(tackle){tackle.hidden=true;tackle.setAttribute('aria-hidden','true');tackle.tabIndex=-1}}
 function gearBridge(){const arsenalHero=document.querySelector('#arsenal .hero'),tackleHero=document.querySelector('#tackle .hero');if(arsenalHero&&!$('fwGearBridge')){const row=document.createElement('div');row.id='fwGearBridge';row.className='row fw-gear-bridge';row.innerHTML='<button id="fwJumpAddGear" class="btn gold" type="button">+ Add Gear</button><button id="fwOpenTackle" class="btn" type="button">Tackle Box</button>';arsenalHero.insertAdjacentElement('afterend',row);$('fwJumpAddGear').onclick=()=>{const jump=()=>{const add=$('inventoryAdd');if(add)add.scrollIntoView({behavior:'smooth',block:'start'});else setTimeout(jump,100)};jump()};$('fwOpenTackle').onclick=()=>go('tackle')}if(tackleHero&&!$('fwBackToGear')){const back=document.createElement('button');back.id='fwBackToGear';back.className='btn ghost fw-back-to-gear';back.type='button';back.textContent='← Back to Gear';tackleHero.insertAdjacentElement('afterend',back);back.onclick=()=>go('arsenal')}}
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