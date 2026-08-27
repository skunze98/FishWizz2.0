(()=>{
 const $=id=>document.getElementById(id);
 function css(){if($('emptyStateStyles'))return;const s=document.createElement('style');s.id='emptyStateStyles';s.textContent=`.fw-empty{padding:18px 12px;text-align:center;border:1px dashed rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.025)}.fw-empty h3{margin:.2rem 0}.fw-empty .row{justify-content:center;margin-top:10px}@media(max-width:760px){.fw-empty .row{display:grid}.fw-empty .row>*{width:100%}}`;document.head.appendChild(s)}
 function set(host,html){if(host&&!host.children.length)host.innerHTML=html}
 // P1-5 reopened (staging QA, 2026-08-27): this used to also target
 // #arsenalCards, a legacy container arsenal-safe.js's own tabbed renderer
 // superseded (P1-8) and hid. #arsenalCards's `hidden` attribute turned out
 // to be defeated by its own `class="cards"` -- `.cards{display:grid}` in
 // styles.css is normal-importance AUTHOR css, which beats the UA
 // stylesheet's `[hidden]{display:none}` (also normal-importance) in the
 // cascade regardless of selector specificity, so it was rendering after
 // all. Combined with this function's `!host.children.length` check --
 // always true for #arsenalCards, since nothing has written real content
 // into it since P1-8 -- every single page load injected a real, visible
 // "No gear saved yet" card directly beneath arsenal-safe.js's own real,
 // correctly-gated list, regardless of how much gear the account actually
 // had (confirmed live: 10 real setups, with this stray card rendered right
 // below them). Fixed at the source in index.html (#arsenalCards is no
 // longer stylable into visibility by any class), and removed here too --
 // arsenal-safe.js's render() already has its own real empty state, gated
 // on the actual fetched collection, not on an unrelated element's
 // child count.
 function render(){css();if(!session?.user)return;const tackle=$('tackleCards'),recent=$('recentCatches'),map=$('mapResults');set(tackle,'<div class="fw-empty"><span class="eyebrow">Tackle Vault</span><h3>No tackle added yet</h3><p class="muted">You can still build Missions. Add only the lures and terminal tackle you want FishWizz to remember.</p></div>');if(recent&&/No catches/i.test(recent.textContent||''))recent.innerHTML='<div class="fw-empty"><span class="eyebrow">First catch</span><h3>Your fishing story starts here</h3><p class="muted">Log your first fish and FishWizz will begin learning species, waters, lures, and patterns that are yours.</p></div>';if(map&&/Choose a location/i.test(map.textContent||''))map.innerHTML='<div class="fw-empty"><span class="eyebrow">Pick a place</span><h3>Choose where you want to fish</h3><p class="muted">Use GPS, search a water, or tap the map. Exact location makes Missions much more useful.</p></div>'}
 function boot(){render();['atlas:account-changed','atlas:inventory-changed','atlas:catch-saved'].forEach(n=>document.addEventListener(n,()=>setTimeout(render,160)))}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,2200)):setTimeout(boot,2200);
})();