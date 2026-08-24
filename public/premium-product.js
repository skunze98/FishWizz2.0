/* FishWizz premium product experience — progressive enhancement only. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const one=s=>document.querySelector(s);
 const all=s=>[...document.querySelectorAll(s)];

 function cardHeader(selector,title,copy){
  const card=one(selector);if(!card||card.querySelector(':scope > .fw-card-head'))return;
  const head=document.createElement('div');head.className='fw-card-head';
  head.innerHTML=`<div><span class="eyebrow">${title}</span><p>${copy}</p></div>`;
  card.prepend(head);
 }
 function fieldGrid(selector){
  const card=one(selector);if(!card||card.querySelector(':scope > .fw-field-grid'))return;
  const fields=[...card.children].filter(x=>x.tagName==='LABEL');if(fields.length<2)return;
  const grid=document.createElement('div');grid.className='fw-field-grid';
  card.insertBefore(grid,fields[0]);fields.forEach(x=>grid.appendChild(x));
 }
 function heroSignals(){
  const hero=one('#mission .hero');if(!hero||hero.querySelector('.fw-trust-row'))return;
  const row=document.createElement('div');row.className='fw-trust-row';
  row.innerHTML='<span>Local water intelligence</span><span>Inventory-aware</span><span>Built for today</span>';
  hero.appendChild(row);
 }
 function navState(){
  all('.nav [data-page]').forEach(b=>{
   if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
 }
 function loadingFeedback(){
  const labels={coach:'Building Mission',searchWater:'Searching waters',useLocation:'Finding location',saveCatch:'Saving catch',signIn:'Signing in',signUp:'Creating account',initialize:'Finishing setup'};
  document.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b||!labels[b.id]||b.classList.contains('is-loading'))return;
   b.dataset.premiumLabel=b.textContent;b.classList.add('is-loading');b.setAttribute('aria-busy','true');
   b.innerHTML=`<span class="fw-spinner" aria-hidden="true"></span><span>${labels[b.id]}</span>`;
   setTimeout(()=>restoreButton(b),9000);
  },true);
  function restoreButton(b){if(!b?.classList.contains('is-loading'))return;b.classList.remove('is-loading');b.removeAttribute('aria-busy');b.textContent=b.dataset.premiumLabel||b.textContent;delete b.dataset.premiumLabel}
  const status=$('status');if(!status)return;
  let timer;
  new MutationObserver(()=>{
   all('button.is-loading').forEach(restoreButton);
   const text=status.textContent.trim();if(!text)return;
   status.classList.add('fw-status-visible');clearTimeout(timer);
   timer=setTimeout(()=>status.classList.remove('fw-status-visible'),status.classList.contains('err')?6500:3400);
  }).observe(status,{childList:true,subtree:true});
 }
 function pageTransitions(){
  document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;requestAnimationFrame(()=>{navState();scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})})});
 }
 function boot(){
  document.documentElement.dataset.premiumProduct='1';
  cardHeader('#mission .grid > .card:first-child','Plan inputs','Tell FishWizz what you are facing. Every choice sharpens the recommendation.');
  cardHeader('#catches .grid > .card:first-child','Catch details','Save the pattern—not just the fish—so future Missions get smarter.');
  cardHeader('#account > .card','Private by design','Your profile, gear, catches, and fishing history stay tied to your account.');
  fieldGrid('#mission .grid > .card:first-child');fieldGrid('#catches .grid > .card:first-child');
  heroSignals();navState();pageTransitions();loadingFeedback();
  const nav=one('.nav');if(nav)new MutationObserver(navState).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();