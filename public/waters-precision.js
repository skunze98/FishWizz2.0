(()=>{
 const $=id=>document.getElementById(id);
 function tuneRadius(){const r=$('mapRadius');if(!r)return;const current=Number(r.value||0);r.innerHTML='<option value="1">1 mile</option><option value="3">3 miles</option><option value="5">5 miles</option><option value="10">10 miles</option>';r.value=current&&current<=10?String(current):'5';if(!window.atlasFishingLocation&&Number(r.value)>5)r.value='5'}
 function tuneCopy(){const h=[...document.querySelectorAll('#waters h2')].find(x=>/nearby waters|closest waters/i.test(x.textContent));if(h)h.textContent='Closest waters';const note=document.querySelector('#waters .map-toolbar .map-note');if(note)note.textContent='Search, use your location, or tap the map to pin the exact place you will fish.'}
 function boot(){tuneRadius();tuneCopy();window.fishwizzWatersPrecision=true}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();