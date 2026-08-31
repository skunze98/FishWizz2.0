// gate-5: real source-independence checking. Per instruction 1: "Two claim IDs
// from the same webpage, organization, parent organization or republished article
// are not independent sources. Enforce independence in the import validator,
// because an array-length database CHECK cannot establish it." This module is
// that import-validator-level logic -- called from generate-pilot.mjs (to compute
// real confidence, not asserted) AND from validate-pilot.mjs (to re-verify the
// generator's own claims mechanically, not just trust them).
function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function titleSimilarity(a, b) {
  const wa = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const wb = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size);
}

/** Real, checkable independence test between two SOURCE records (not claims). */
export function areSourcesIndependent(sourceA, sourceB) {
  if (!sourceA || !sourceB) return false;
  if (sourceA.id === sourceB.id) return false;
  if (sourceA.organization.trim().toLowerCase() === sourceB.organization.trim().toLowerCase()) return false;
  const paA = sourceA.parent_organization?.trim().toLowerCase();
  const paB = sourceB.parent_organization?.trim().toLowerCase();
  if (paA && paB && paA === paB) return false; // same parent org (e.g. two sub-brands of one publisher)
  if (paA && paA === sourceB.organization.trim().toLowerCase()) return false; // A's parent IS B's org
  if (paB && paB === sourceA.organization.trim().toLowerCase()) return false; // B's parent IS A's org
  if (titleSimilarity(sourceA.title, sourceB.title) > 0.8) return false; // likely a republished/syndicated article
  return true;
}

/**
 * Given a list of claims (already resolved with their .source object attached, or
 * null for derived/gap claims), returns the count of GENUINELY independent
 * organizations represented among the externally_sourced ones -- e.g. 3 claims
 * citing 2 DNR pages + 1 university paper = 2 independent orgs, not 3.
 */
export function countIndependentOrganizations(claimsWithSources) {
  const extSources = claimsWithSources
    .filter(c => c.claim.evidence_status === 'externally_sourced' && c.source)
    .map(c => c.source);
  const distinctOrgs = [];
  for (const s of extSources) {
    if (!distinctOrgs.some(existing => !areSourcesIndependent(existing, s))) distinctOrgs.push(s);
  }
  return distinctOrgs.length;
}

/** True if this specific FIELD has >=2 genuinely independent orgs supporting it (direct ext claims, or a derived claim's ancestor ext claims). */
export function fieldHasIndependentCorroboration(fieldClaims, claimsById, sourcesById) {
  const ancestorExtSources = [];
  for (const c of fieldClaims) {
    if (c.evidence_status === 'externally_sourced') ancestorExtSources.push(sourcesById[c.source_id]);
    if (c.evidence_status === 'derived_synthesis') {
      for (const ancId of c.derived_from_claim_ids) {
        const anc = claimsById[ancId];
        if (anc?.evidence_status === 'externally_sourced') ancestorExtSources.push(sourcesById[anc.source_id]);
      }
    }
  }
  const distinct = [];
  for (const s of ancestorExtSources) {
    if (!distinct.some(existing => !areSourcesIndependent(existing, s))) distinct.push(s);
  }
  return distinct.length >= 2;
}
