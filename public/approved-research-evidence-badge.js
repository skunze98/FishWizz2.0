(()=>{
 // A NEW, separately-labeled evidence badge for approved-research confidence tiers. Deliberately
 // NOT reusing evidence-provenance.js's chip('official', ...) for peer_review_supported/
 // independently_corroborated/official_guidance -- that codebase's own convention (see that file's
 // comments) defines "official" as "the specific fact carries a real timestamp/source name from
 // that call's own response," i.e. a marker for a LIVE API response, not a marker for research
 // corroboration strength. Conflating the two would misrepresent what "official" means everywhere
 // else it already appears in this same UI. See reports/COMPATIBILITY-REPORT.md section 6.
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TIER_LABEL={
  peer_review_supported:'Research-verified',
  independently_corroborated:'Research-verified',
  official_guidance:'Research-verified',
  expert_synthesis:'Research-derived',
  anecdotal:'General guidance',
  estimated:'General guidance',
  unsupported:'General guidance',
 };
 // Reuses the app's own existing 'estimated' chip kind for the bottom of the tier scale, since that
 // is the one case where the existing meaning ("general guidance, not a verified fact") is
 // genuinely correct -- not reused for anything above it.
 function badge(confidence,{detail=true}={}){
  const label=TIER_LABEL[confidence]||'General guidance';
  const cls=label==='General guidance'?'estimated':label==='Research-derived'?'derived':'verified';
  const detailText=detail?` <span class="tiny muted">(${esc(confidence)})</span>`:'';
  return `<span class="source-chip approved-research ${cls}">${esc(label)}</span>${detailText}`;
 }
 function readinessNote(readiness,readinessReason){
  if(readiness==='ready_for_human_review')return'';
  return `<p class="muted tiny">Research incomplete: ${esc(readinessReason||'one or more fields lack real source evidence')}. This tactic is not mission-ready.</p>`;
 }
 window.FishWizzApprovedResearchEvidence={badge,readinessNote,TIER_LABEL};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{approvedResearchEvidence:{badge,readinessNote}});
})();
