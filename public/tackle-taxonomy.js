(()=>{
 // P2 ("enforce recommendation taxonomy compatibility" -- staging QA,
 // 2026-08-27): "recommendation 'Best owned lure substitute: QA test
 // Northstar QA test Circle Rig' where the referenced record was
 // categorized 'hook / terminal tackle,' not a lure." Neither
 // mission-inventory-fit.js (the primary Mission card's gear match) nor
 // mentor-pro.js (the Mentor card's gear match) previously filtered by
 // category at all -- both matched purely on text similarity against
 // whatever the recommendation asked for, so a hook, sinker, swivel, or
 // bare jig head could win the "lure" slot on nothing but a name/species
 // word overlap and then be labeled "Owned lure" outright.
 //
 // The one authoritative classification of every category string
 // manual-gear-pro.js's own category <select> actually offers (see that
 // file), shared by both consumers so they can never independently
 // disagree about what counts as a lure.
 const LURE=new Set(['hard bait / lure','crankbait','jerkbait','topwater','spinnerbait','bladed jig','swimbait','spoon','inline spinner','jig']);
 const JIG_HEAD=new Set(['jig head']);
 const TRAILER=new Set(['soft plastic','trailer']);
 const TERMINAL=new Set(['hook / terminal tackle']);
 const WEIGHT=new Set(['weight / sinker']);
 const ACCESSORY=new Set(['bobber / float','swivel / snap / connector','line / leader material','other tackle']);

 function classify(category){
  const c=String(category||'').trim().toLowerCase();
  if(LURE.has(c))return'lure';
  if(JIG_HEAD.has(c))return'jig_head';
  if(TRAILER.has(c))return'trailer';
  if(TERMINAL.has(c))return'terminal';
  if(WEIGHT.has(c))return'weight';
  if(ACCESSORY.has(c))return'accessory';
  return'unknown';
 }

 // Whether an item can stand in as a complete, fishable presentation on its
 // own -- a genuine lure, or a jig head already paired with a soft plastic
 // (trailer_pairing set) -- as opposed to a bare component (jig head alone,
 // trailer alone, hook, weight, accessory) that is never itself "the lure".
 // A category this file doesn't recognize (a hand-typed value predating
 // manual-gear-pro.js's fixed list, or a future category not added here
 // yet) fails OPEN, matching this codebase's existing convention of never
 // treating "we don't know" as "definitely wrong" -- it is left eligible
 // rather than silently excluded from every recommendation.
 function isPresentable(item){
  const kind=classify(item?.category);
  if(kind==='lure'||kind==='unknown')return true;
  if(kind==='jig_head')return!!item?.trailer_pairing;
  return false;
 }

 // Human, accurate label for "what kind of thing is this" -- used so an
 // owned item is described as what it actually is (P2: "never label
 // terminal tackle as a lure"; "'Owned terminal component'/'Owned jig'/
 // 'Owned lure'/'Owned complete rig' accurately").
 function label(item){
  switch(classify(item?.category)){
   case'lure':return'lure';
   case'jig_head':return item?.trailer_pairing?'complete rig':'jig head';
   case'trailer':return'trailer';
   case'terminal':return'terminal component';
   case'weight':return'weight';
   case'accessory':return'accessory';
   default:return'tackle item';
  }
 }

 window.FishWizzTackleTaxonomy={classify,isPresentable,label,LURE,JIG_HEAD,TRAILER,TERMINAL,WEIGHT,ACCESSORY};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{tackleTaxonomy:{classify,isPresentable,label}});
})();
