(()=>{
 // P0 (staging QA, 2026-08-27): "FishWizz accepted and saved a Bluegill
 // measuring -5 in and 9999 lb, labeled it a personal best." The one
 // authoritative length/weight validation, shared by every place a catch
 // measurement is entered (catch-pro.js's creation form) or edited
 // (catch-history-pro.js's quick-edit modal) or ranked
 // (catch-history-pro.js's/personal-hub.js's personal-best calcs) -- a
 // single source of truth rather than each of those re-implementing (and
 // inevitably disagreeing on) the same bounds, the recurring bug pattern
 // already found and removed once this session in account-isolation.js.
 //
 // Bounds are mirrored verbatim in supabase/migrations/
 // 20260827000000_valid_catch_measurements.sql as a DB CHECK constraint --
 // this file is the client-side half, not the only enforcement (the DB
 // constraint is what actually stops a devtools/direct-API bypass).
 const LIMITS={
  length_in:{min:0,max:100,label:'Length',unit:'in'},
  weight_lb:{min:0,max:200,label:'Weight',unit:'lb'},
 };

 // Both fields are optional -- '' / null / undefined is always valid and
 // means "not recorded", never coerced to 0. Anything actually entered must
 // be a finite number, strictly greater than the lower bound (0 in / 0 lb is
 // not a fish), and no greater than the upper bound. Never clamps or
 // rewrites a value -- an out-of-range entry is rejected outright so the
 // angler corrects it themselves, per the instruction ("never silently
 // clamp or rewrite").
 function validateMeasurement(raw,key){
  const L=LIMITS[key];
  if(!L)return{ok:false,message:'Unknown measurement field.'};
  if(raw===undefined||raw===null||String(raw).trim()==='')return{ok:true,value:null};
  const n=Number(raw);
  if(!Number.isFinite(n))return{ok:false,message:`${L.label} must be a number.`};
  if(n<=L.min)return{ok:false,message:`${L.label} must be greater than 0.`};
  if(n>L.max)return{ok:false,message:`${L.label} over ${L.max} ${L.unit} isn't a value FishWizz can record -- check the entry.`};
  return{ok:true,value:n};
 }

 // "Exclude existing invalid records from personal-best/rankings/Atlas
 // learning/recommendations/summaries/analytics": a record already sitting
 // in the database (like the QA account's existing Bluegill) can carry a
 // value that was saved before this validation existed, or written directly
 // via the API. Never assumed valid just because it's already stored.
 function isValidCatchMeasurements(row){
  if(row==null)return true;
  if(row.length_in!=null&&!validateMeasurement(row.length_in,'length_in').ok)return false;
  if(row.weight_lb!=null&&!validateMeasurement(row.weight_lb,'weight_lb').ok)return false;
  return true;
 }

 window.FishWizzMeasure={LIMITS,validateMeasurement,isValidCatchMeasurements};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{measure:{LIMITS,validateMeasurement,isValidCatchMeasurements}});
})();
