(()=>{
 const $=id=>document.getElementById(id);let host=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function ensure(){if(host?.isConnected)return host;const page=$('catches');if(!page)return null;host=document.createElement('section');host.id='catchHistoryPro';host.className='card catch-history-pro';page.appendChild(host);if(!$('catchHistoryStyles')){const s=document.createElement('style');s.id='catchHistoryStyles';s.textContent=`.catch-history-pro{margin-top:12px}.chp-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.chp-filter{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.chp-list{display:grid;gap:8px}.chp-item{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.035)}.chp-item h3{margin:.15rem 0}.chp-meta{display:flex;gap:6px;flex-wrap:wrap}.chp-meta .pill{margin:0}.chp-pb{border-color:rgba(225,191,99,.34)}.chp-photo{width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-top:8px}.chp-actions{margin-top:8px}@media(max-width:760px){.chp-head,.chp-filter{display:grid;grid-template-columns:1fr}}`;document.head.appendChild(s)}return host}
 function rows(){return (window.catches||[]).slice().sort((a,b)=>new Date(b.caught_at||b.created_at||0)-new Date(a.caught_at||a.created_at||0))}
 // P0 ("exclude existing invalid records from personal-best/rankings/Atlas
 // learning/recommendations/summaries/analytics" -- staging QA, 2026-08-27):
 // the QA account's own Bluegill(-5 in, 9999 lb) record used to WIN every
 // personal-best comparison outright (9999*1000 dwarfs any real weight),
 // labeling a clearly invalid entry as a personal best forever, exactly as
 // reported. The record itself is never touched here -- still fully present
 // in window.catches, still shown in the timeline below -- it's excluded
 // from this ranking calculation only, via the same shared validator the
 // save/edit forms now enforce (public/measurement-guard.js), so a value
 // saved before that validation existed (or written directly via the API)
 // can't distort it.
 function pbs(c){const by={};c.forEach(x=>{if(!x.species)return;if(!window.FishWizzMeasure?.isValidCatchMeasurements?.(x))return;const score=(Number(x.weight_lb||0)*1000)+Number(x.length_in||0);if(score>(by[x.species]?.score||-1))by[x.species]={id:x.id,score}});return by}
 async function viewPhoto(btn,path){if(!path||!session?.access_token)return;btn.disabled=true;btn.textContent='Loading photo…';try{const r=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/catch-photos/${encodeURI(path)}`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:900})});const d=await r.json();if(!r.ok)throw Error(d?.message||'Could not load photo');const article=btn.closest('.chp-item'),img=document.createElement('img');img.className='chp-photo';img.alt='Private catch photo';img.src=`${SUPABASE_URL}/storage/v1${d.signedURL||d.signedUrl}`;btn.replaceWith(img)}catch(e){btn.disabled=false;btn.textContent='View photo';stat(e.message,'err')}}
 // P1-6: View/Edit/Delete for catches -- same confirm + optimistic +
 // rollback shape as arsenal-safe.js's deleteGear and inventory-pro.js's
 // deleteTackle, applied here to window.catches instead.
 // P0 ("editing uses the same validation as creation" -- staging QA,
 // 2026-08-27): length_in/weight_lb are now editable here too -- previously
 // the only way to fix an invalid measurement (like the QA account's own
 // Bluegill) was a direct API call, since this quick-edit modal never
 // exposed them. Both use type=number with the same bounds
 // measurement-guard.js enforces (cosmetic here -- the real check is
 // FishWizzMeasure.validateMeasurement() in the save handler below, same as
 // catch-pro.js's creation form).
 const EDIT_FIELDS=[['water','Water'],['spot','Spot'],['species','Species'],['lure_bait','Lure / bait'],['color','Color'],['length_in','Length (in)','number','0','100','0.25'],['weight_lb','Weight (lb)','number','0','200','0.01'],['learned','What did you learn?']];
 const MEASURE_FIELDS=new Set(['length_in','weight_lb']);
 // See inventory-pro.js's identical helper: the .arsenal-edit* classes are
 // arsenal-safe.js's, which is only loaded for the Arsenal page group and
 // may never have run this session by the time a Catches-page modal opens.
 function ensureEditModalStyles(){if($('fwEditModalStyles'))return;const s=document.createElement('style');s.id='fwEditModalStyles';s.textContent=`.arsenal-edit{position:fixed;inset:0;z-index:2200;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:12px}.arsenal-edit-card{width:min(560px,100%);max-height:92dvh;overflow:auto;background:#10251e;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px}.arsenal-edit-grid{display:grid;gap:10px}.arsenal-edit-grid input.fw-field-error{outline:2px solid #e16b6b;outline-offset:1px}@media(max-width:760px){.arsenal-edit{align-items:end;padding:0}.arsenal-edit-card{border-radius:18px 18px 0 0;max-height:88dvh;padding-bottom:calc(18px + env(safe-area-inset-bottom))}}`;document.head.appendChild(s)}
 // P0 ("editing uses the same validation as creation" -- staging QA,
 // 2026-08-27): the actual business logic behind "Save changes" -- validate
 // every field, build the PATCH row, or report exactly which field is wrong
 // -- pulled out of the click handler as a pure, DOM-free function so it has
 // a real, direct unit test (scripts/test-p0-catch-fixes.mjs) instead of
 // only ever being exercised through a full modal DOM tree. Takes
 // [[key,rawValue],...] (whatever the click handler reads off the actual
 // <input> elements) and returns {row, error}. length_in/weight_lb go
 // through FishWizzMeasure.validateMeasurement() -- the exact same shared
 // bounds and rejection behavior (never clamped/rewritten) catch-pro.js's
 // creation form uses -- checked before the required-field check, so an
 // invalid measurement is reported without silently accepting the rest of a
 // partially-valid edit.
 function buildEditRow(fieldValues){
  const measure=window.FishWizzMeasure;let error=null;const row={};
  for(const[key,value]of fieldValues){
   if(MEASURE_FIELDS.has(key)){
    const check=measure?measure.validateMeasurement(value,key):{ok:true,value:value?Number(value):null};
    if(!check.ok&&!error)error={key,message:check.message};
    row[key]=check.ok?check.value:null;
   }else{
    row[key]=(value||'').trim()||null;
   }
  }
  if(!error&&(!row.water||!row.species))error={key:null,message:'Water and species are required.'};
  return{row,error};
 }
 function openCatchEdit(id){ensureEditModalStyles();const c=(window.catches||[]).find(v=>String(v.id)===String(id));if(!c)return;const modal=document.createElement('div');modal.className='arsenal-edit';modal.id='catchEdit';modal.innerHTML=`<div class="arsenal-edit-card"><span class="eyebrow">Quick edit catch</span><h2>${esc(c.species||'Catch')} · ${esc(c.water||'')}</h2><div class="arsenal-edit-grid">${EDIT_FIELDS.map(([k,l,type,min,max,step])=>`<label>${esc(l)}<input data-ch-field="${k}"${type?` type="${type}"`:''}${min!==undefined?` min="${min}"`:''}${max!==undefined?` max="${max}"`:''}${step!==undefined?` step="${step}"`:''} value="${esc(c[k]??'')}"></label>`).join('')}</div><div class="row"><button id="saveCatchEdit" class="btn gold" type="button">Save changes</button><button id="cancelCatchEdit" class="btn ghost" type="button">Cancel</button></div></div>`;document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});$('cancelCatchEdit').onclick=()=>modal.remove();$('saveCatchEdit').onclick=async()=>{const btn=$('saveCatchEdit');btn.disabled=true;btn.textContent='Saving…';
  modal.querySelectorAll('[data-ch-field]').forEach(i=>{if(MEASURE_FIELDS.has(i.dataset.chField))i.classList.remove('fw-field-error')});
  const fieldValues=[...modal.querySelectorAll('[data-ch-field]')].map(i=>[i.dataset.chField,i.value]);
  const{row,error}=buildEditRow(fieldValues);
  if(error){if(error.key){const bad=modal.querySelector(`[data-ch-field="${error.key}"]`);bad?.classList.add('fw-field-error')}stat(error.message,'err');btn.disabled=false;btn.textContent='Save changes';return}
  try{await api(`/rest/v1/catches?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});modal.remove();if(typeof window.loadCatches==='function')await window.loadCatches();document.dispatchEvent(new Event('atlas:catch-saved'));render();stat('Catch updated.','ok')}catch(e){stat(e.message,'err');btn.disabled=false;btn.textContent='Save changes'}}}
 async function deleteCatch(id){const arr=window.catches||[],idx=arr.findIndex(v=>String(v.id)===String(id));if(idx<0)return;const item=arr[idx];if(!confirm('Delete this catch? This cannot be undone.'))return;arr.splice(idx,1);render();try{const deleted=await api(`/rest/v1/catches?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(session.user.id)}`,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!Array.isArray(deleted)||!deleted.length)throw Error('This catch was not found in your account, so nothing was deleted.');document.dispatchEvent(new Event('atlas:catch-saved'));stat('Catch deleted.','ok')}catch(e){arr.splice(idx,0,item);render();stat(e.message||'Could not delete this catch.','err')}}
 function render(){const el=ensure();if(!el)return;if(!session?.user){el.innerHTML='<span class="eyebrow">Fishing history</span><h2>Your catches will live here</h2><p class="muted">Sign in to keep your fishing journal private.</p>';return}const c=rows(),pb=pbs(c),species=[...new Set(c.map(x=>x.species).filter(Boolean))].sort(),waters=[...new Set(c.map(x=>x.water).filter(Boolean))].sort();el.innerHTML=`<div class="chp-head"><div><span class="eyebrow">Your fishing history</span><h2>Catch timeline</h2><p class="muted">Filter catches, view private photos, and spot personal bests.</p></div><span class="pill">${c.length} logged</span></div><div class="chp-filter"><select id="chpSpecies"><option value="">All species</option>${species.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="chpWater"><option value="">All waters</option>${waters.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div id="chpList" class="chp-list"></div>`;const draw=()=>{const sp=$('chpSpecies').value,wa=$('chpWater').value,list=c.filter(x=>(!sp||x.species===sp)&&(!wa||x.water===wa));$('chpList').innerHTML=list.length?list.map(x=>{const ispb=pb[x.species]?.id===x.id&&(x.length_in||x.weight_lb);return `<article class="chp-item ${ispb?'chp-pb':''}"><span class="eyebrow">${ispb?'Personal best · ':''}${esc(x.species||'Catch')}</span><h3>${esc(x.water||'Unknown water')}</h3><div class="chp-meta">${x.length_in?`<span class="pill">${esc(x.length_in)} in</span>`:''}${x.weight_lb?`<span class="pill">${esc(x.weight_lb)} lb</span>`:''}${x.lure_bait?`<span class="pill">${esc(x.lure_bait)}</span>`:''}${x.combo_name?`<span class="pill">${esc(x.combo_name)}</span>`:''}${x.released===true?'<span class="pill">Released</span>':x.released===false?'<span class="pill">Kept</span>':''}</div>${x.learned||x.why_worked?`<p class="muted tiny">${esc(x.learned||x.why_worked)}</p>`:''}<div class="chp-actions row">${x.photo_path?`<button class="btn ghost" data-photo="${esc(x.photo_path)}" type="button">View photo</button>`:''}<button class="btn ghost" data-ch-edit="${esc(x.id)}" type="button">Edit</button><button class="btn bad" data-ch-delete="${esc(x.id)}" type="button">Delete</button></div></article>`}).join(''):'<div class="muted">No catches match those filters yet.</div>';$('chpList').querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>viewPhoto(b,b.dataset.photo));$('chpList').querySelectorAll('[data-ch-edit]').forEach(b=>b.onclick=()=>openCatchEdit(b.dataset.chEdit));$('chpList').querySelectorAll('[data-ch-delete]').forEach(b=>b.onclick=()=>deleteCatch(b.dataset.chDelete))};$('chpSpecies').onchange=draw;$('chpWater').onchange=draw;draw()}
 function boot(){ensure();render();['atlas:catch-saved','atlas:account-changed'].forEach(n=>document.addEventListener(n,()=>setTimeout(render,150)))}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1200)):setTimeout(boot,1200);
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{catchHistoryPro:{pbs,buildEditRow}});
})();