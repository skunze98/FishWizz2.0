(()=>{
 const $=id=>document.getElementById(id),escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let loading=false,loadedUser=null,retryTimer=null;
 function currentUser(){try{return session?.user?.id||null}catch(e){console.error('FishWizz: could not read the current session',e);return null}}
 function cards(){return $('tackleCards')}
 function state(title,copy,retry=false){const host=cards();if(!host)return;host.innerHTML=`<div class="card arsenal-empty"><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(copy)}</p>${retry?'<button id="tackleRetry" class="btn ghost" type="button">Try again</button>':''}</div>`;if(retry)$('tackleRetry').onclick=()=>load({force:true})}
 function readiness(rows){let b=$('tackleReadiness');if(!b){b=document.createElement('div');b.id='tackleReadiness';b.className='card';$('tackleSearch')?.parentElement?.insertAdjacentElement('afterend',b)}if(!b)return;const low=rows.filter(x=>(x.quantity||0)<=1),restock=rows.filter(x=>x.restock),productive=rows.filter(x=>x.catches_count>0).sort((a,z)=>z.catches_count-a.catches_count).slice(0,5);b.innerHTML=`<span class="eyebrow">Tackle readiness</span><h2>${rows.length} items tracked</h2><div class="launch-checks"><div><b>${restock.length}</b><br><span class="muted">Restock flagged</span></div><div><b>${low.length}</b><br><span class="muted">Low quantity</span></div><div><b>${productive.reduce((n,x)=>n+(x.catches_count||0),0)}</b><br><span class="muted">Recorded catches</span></div></div><p class="muted tiny">FishWizz uses only tackle saved to this account.</p>`}
 // P1-6: View/Edit/Delete for tackle -- this was the only CRUD gap left in
 // the Arsenal/Tackle surface once arsenal-safe.js got combo/rod/reel delete
 // (see arsenal-safe.js's deleteGear for the same confirm + optimistic +
 // rollback shape, deliberately mirrored rather than reinvented).
 const EDIT_FIELDS=[['category','Category'],['brand','Brand'],['model','Model'],['size_weight','Size / weight'],['color','Color'],['quantity','Quantity'],['storage_location','Storage location']];
 // The .arsenal-edit* modal classes are arsenal-safe.js's, but that file is
 // only ever loaded for the Arsenal page group (pwa.js) -- a user who opens
 // Tackle directly, without visiting Arsenal first this session, would get
 // this modal completely unstyled. Idempotent by id, so if arsenal-safe.js's
 // (much larger) stylesheet does happen to already be present, this is a
 // harmless no-op rather than a duplicate.
 function ensureEditModalStyles(){if($('fwEditModalStyles'))return;const s=document.createElement('style');s.id='fwEditModalStyles';s.textContent=`.arsenal-edit{position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:12px}.arsenal-edit-card{width:min(560px,100%);max-height:92dvh;overflow:auto;background:#10251e;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px}.arsenal-edit-grid{display:grid;gap:10px}@media(max-width:760px){.arsenal-edit{align-items:end;padding:0}.arsenal-edit-card{border-radius:18px 18px 0 0;max-height:88dvh;padding-bottom:calc(18px + env(safe-area-inset-bottom))}}`;document.head.appendChild(s)}
 function openTackleEdit(id){ensureEditModalStyles();const x=(window.lures||[]).find(v=>String(v.id)===String(id));if(!x)return;const modal=document.createElement('div');modal.className='arsenal-edit';modal.id='tackleEdit';modal.innerHTML=`<div class="arsenal-edit-card"><span class="eyebrow">Quick edit tackle</span><h2>${escapeHtml([x.brand,x.model].filter(Boolean).join(' ')||'Tackle item')}</h2><div class="arsenal-edit-grid">${EDIT_FIELDS.map(([k,l])=>`<label>${escapeHtml(l)}<input data-tk-field="${k}" value="${escapeHtml(x[k]??'')}"></label>`).join('')}</div><div class="row"><button id="saveTackleEdit" class="btn gold" type="button">Save changes</button><button id="cancelTackleEdit" class="btn ghost" type="button">Cancel</button></div></div>`;document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});$('cancelTackleEdit').onclick=()=>modal.remove();$('saveTackleEdit').onclick=async()=>{const btn=$('saveTackleEdit');btn.disabled=true;btn.textContent='Saving…';try{const row={};modal.querySelectorAll('[data-tk-field]').forEach(i=>{const v=i.value.trim();row[i.dataset.tkField]=i.dataset.tkField==='quantity'?(Number(v)||1):(v||null)});await api(`/rest/v1/lures?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});modal.remove();await load({force:true});document.dispatchEvent(new Event('atlas:inventory-changed'));stat('Tackle updated.','ok')}catch(e){stat(e.message,'err');btn.disabled=false;btn.textContent='Save changes'}}}
 async function deleteTackle(id){const rows=window.lures||[],idx=rows.findIndex(v=>String(v.id)===String(id));if(idx<0)return;const item=rows[idx];if(!confirm('Delete this tackle item? This cannot be undone.'))return;rows.splice(idx,1);render(rows);try{const deleted=await api(`/rest/v1/lures?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(session.user.id)}`,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!Array.isArray(deleted)||!deleted.length)throw Error('This item was not found in your account, so nothing was deleted.');document.dispatchEvent(new Event('atlas:inventory-changed'));stat('Tackle deleted.','ok')}catch(e){rows.splice(idx,0,item);render(rows);stat(e.message||'Could not delete this tackle item.','err')}}
 function render(rows){window.lures=rows;const q=($('tackleSearch')?.value||'').toLowerCase(),shown=rows.filter(x=>!q||[x.category,x.brand,x.model,x.color,x.storage_location].join(' ').toLowerCase().includes(q));const host=cards();if(host){host.innerHTML=shown.map(x=>`<article class="card"><span class="eyebrow">${escapeHtml(x.category||'Tackle')}</span><h2>${escapeHtml([x.brand,x.model].filter(Boolean).join(' ')||'Unnamed item')}</h2><p>${escapeHtml(x.size_weight||'')} ${x.color?'· '+escapeHtml(x.color):''}</p><p><b>Storage:</b> ${escapeHtml(x.storage_location||'Not mapped')}</p><div class="row"><button class="btn ghost" type="button" data-tk-edit="${escapeHtml(x.id)}">Edit</button><button class="btn bad" type="button" data-tk-delete="${escapeHtml(x.id)}">Delete</button></div></article>`).join('')||(q?'<div class="card">No tackle matches that search.</div>':'<div class="card"><h3>No tackle saved yet</h3><p class="muted">Your locker is ready whenever you want to add something.</p></div>');host.querySelectorAll('[data-tk-edit]').forEach(b=>b.onclick=()=>openTackleEdit(b.dataset.tkEdit));host.querySelectorAll('[data-tk-delete]').forEach(b=>b.onclick=()=>deleteTackle(b.dataset.tkDelete))}readiness(rows)}
 async function waitForSession(ms=5000){await Promise.race([window.fishwizzAuth?.ready,new Promise(r=>setTimeout(r,ms))]);return currentUser()}
 // P1 ("unify gear state across Mission, Gear, Catches, and Atlas" --
 // staging QA, 2026-08-27): "Gear showed 2 setups/2 rods/2 reels; Tackle
 // showed 5 items; Mission said 'No gear loaded' while simultaneously
 // saying '2 combos known'." Root cause, confirmed by reading the actual
 // shipped modules rather than guessing: THREE independent, uncoordinated
 // fetches of /rest/v1/lures existed at once -- this function's own direct
 // fetch, gear-state.js's fetchAll(), and app.js's loadLures() (now
 // removed) -- each capable of overwriting the shared window.lures global
 // and this page's own #tackleCards with whichever response happened to
 // land last, independent of which one was actually current. This function
 // now only ever reads from window.FishWizzGearState -- the one
 // authoritative fetch Mission, Gear, Catches, and Tackle all now share --
 // instead of running its own network request, so Tackle can never again
 // show a different count than Mission/Gear/Atlas for the same account.
 async function load({force=false}={}){
  if(loading)return;
  const uid=await waitForSession();
  if(!uid){loadedUser=null;state('Sign in to see your Tackle Locker','Your saved tackle stays tied to your account.');return}
  // isHydratedFor() (not the old local "loadedUser===uid && window.lures
  // ?.length" check) also fixes a latent related bug: a genuinely EMPTY
  // tackle locker (window.lures.length === 0) used to look identical to
  // "not loaded yet" here, so it silently re-fetched on every single page
  // visit instead of ever treating zero tackle as a real, cached answer.
  if(!force&&window.FishWizzGearState?.isHydratedFor?.(uid)){loadedUser=uid;render(window.FishWizzGearState.get().lures||[]);return}
  loading=true;clearTimeout(retryTimer);
  state('Loading your Tackle Locker…','Restoring the tackle saved to your account.');
  const result=await window.FishWizzGearState?.ensure?.({force})??{lures:[],error:'Gear state is not available.'};
  loading=false;
  if(currentUser()!==uid)return; // the account changed while this was in flight
  if(result.error){
    // A genuine failure must read as an error, never a false "no tackle" --
    // gear-state.js's own ensure() already makes this distinction (loaded
    // stays false, error carries a real message); this just surfaces it in
    // the UI this page already had for it, instead of quietly rendering an
    // empty locker.
    console.error('Tackle load failed',result.error);
    state('Could not load your Tackle Locker','Your saved tackle has not been deleted. Check your connection and try again.',true);
    retryTimer=setTimeout(()=>currentUser()===uid&&load({force:true}),2500);
    return;
  }
  loadedUser=uid;render(result.lures||[]);
  // gear-state.js's fetchAll() already dispatches atlas:tackle-loaded itself
  // on every real fetch -- re-dispatching it here on every render (including
  // cache-hit renders where nothing actually changed) would be exactly the
  // kind of second, uncoordinated event source this whole fix removes.
 }
 // The bare `lures=` writes that used to sit next to each window.lures
 // assignment above never threw (classic non-strict script: writing an
 // undeclared identifier creates a duplicate global instead of a
 // ReferenceError) and window.lures already is the real value every other
 // module reads, so they were dead code rather than something to log.
 function reset(){loadedUser=null;clearTimeout(retryTimer);window.lures=[];state('Loading your Tackle Locker…','Waiting for your account session.')}
 function boot(){reset();load();$('tackleSearch')?.addEventListener('input',()=>loadedUser&&render(window.lures||[]));document.addEventListener('click',e=>{if(e.target.closest('[data-page="tackle"]'))setTimeout(()=>load({force:true}),80)});document.addEventListener('atlas:account-changed',()=>{reset();setTimeout(()=>load({force:true}),120)});document.addEventListener('atlas:inventory-changed',()=>load({force:true}));document.addEventListener('atlas:catch-saved',()=>load({force:true}));window.addEventListener('pageshow',()=>load());document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('tackle')?.classList.contains('active'))load({force:true})})}
 window.loadTackleLocker=load;
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();