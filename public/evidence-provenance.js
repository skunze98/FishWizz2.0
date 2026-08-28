(()=>{
 // P2 ("provide traceable recommendation evidence" -- staging QA,
 // 2026-08-27): "Mission gave narrative reasoning and LIVE/OFFICIAL/
 // PERSONAL/ESTIMATED labels but no specific source/agency record/
 // observation time/evidence identified." launch.js's chip legend
 // promises four evidence categories next to every Mission card; before
 // this file, the Mission card itself only ever used ONE of them (a LIVE
 // weather chip). Its own core recommendation text -- get_mission_plan_v3,
 // a deterministic rules engine, not a live or official-record lookup (see
 // that function's own body: fixed if/else technique guidance, citing
 // general knowledge like "MN DNR guidance supports..." in a SQL comment
 // that never reached the client) -- carried no label at all, so general
 // technique guidance read with the same unlabeled visual authority as an
 // actual live gauge reading or agency record.
 //
 // This is the one shared chip-building helper for every place that needs
 // to say WHAT KIND of evidence backs a specific claim -- not just append
 // the word "LIVE" to something because it sounds more convincing. Rule
 // enforced by every caller (not just this file): a claim is only ever
 // labeled LIVE or OFFICIAL when the specific fact it's attached to
 // actually carries a real timestamp/source name from that call's own
 // response -- never applied as a blanket label for an entire card.
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 function chip(kind,label){
  const cls={live:'live',official:'official',personal:'personal',estimated:'estimated'}[kind]||'estimated';
  return `<span class="source-chip ${cls}">${esc(label)}</span>`;
 }

 // A record is only ever labeled OFFICIAL if it names an actual source --
 // never inferred from context, never defaulted to "official" just because
 // it came from a Supabase function rather than the rules engine. A record
 // whose source can't be identified is ESTIMATED instead, however it was
 // produced.
 function sourceLabel(sourceName){
  const s=String(sourceName||'').trim();
  return s&&!/^(atlas|unknown|n\/a)$/i.test(s)?s:null;
 }

 window.FishWizzEvidence={chip,sourceLabel};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{evidence:{chip,sourceLabel}});
})();
