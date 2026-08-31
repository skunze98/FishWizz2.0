(()=>{
 // Hand-curated, EXACT-match species taxonomy map between the app's existing free-text species
 // names (window.ATLAS_MN_WI_FRESHWATER_SPECIES, species-mn-wi.js) and the approved research's
 // structured angling_species records (species_slug / scientific_name / common_name_primary).
 //
 // Deliberately NOT a runtime fuzzy matcher. reports/COMPATIBILITY-REPORT.md documents a real,
 // confirmed false positive from an automated fuzzy pre-screen ("Northern Hog Sucker" and "Northern
 // Redbelly Dace" both matched "Northern Pike" purely because they share the word "Northern") --
 // this table exists specifically so that mistake can never happen at runtime. Every entry below
 // was checked one at a time against the real approved species.json (28 records); the app's other
 // 84+ species names are deliberately absent, not an oversight -- see the "unmapped" section.
 //
 // 28 approved species exist; 3 are intentionally mapped to a DIFFERENT app name (Steelhead is a
 // real alias for Rainbow Trout, matched by get_approved_research_plan's own alias lookup too, so
 // it is included here for client-side awareness even though the RPC would resolve it either way).
 const MAP={
  'Largemouth Bass':'species:micropterus-salmoides',
  'Smallmouth Bass':'species:micropterus-dolomieu',
  'Walleye':'species:sander-vitreus',
  'Sauger':'species:sander-canadensis',
  'Northern Pike':'species:esox-lucius',
  'Muskellunge':'species:esox-masquinongy',
  'Black Crappie':'species:pomoxis-nigromaculatus',
  'White Crappie':'species:pomoxis-annularis',
  'Bluegill':'species:lepomis-macrochirus',
  'Pumpkinseed':'species:lepomis-gibbosus',
  'Green Sunfish':'species:lepomis-cyanellus',
  'Rock Bass':'species:ambloplites-rupestris',
  'Yellow Perch':'species:perca-flavescens',
  'White Bass':'species:morone-chrysops',
  'Channel Catfish':'species:ictalurus-punctatus',
  'Flathead Catfish':'species:pylodictis-olivaris',
  'Common Carp':'species:cyprinus-carpio',
  'Freshwater Drum':'species:aplodinotus-grunniens',
  'Bowfin':'species:amia-calva',
  'Burbot':'species:lota-lota',
  'Lake Sturgeon':'species:acipenser-fulvescens',
  'Brook Trout':'species:salvelinus-fontinalis',
  // Real, disclosed judgment call, not a silent equivalence: "Coaster Brook Trout" is a genuine
  // Lake-Superior-specific strain with no separately researched tactics -- mapped to the same
  // species record because that IS the correct species, while any strain-specific technique
  // nuance remains unresearched (see the Deferred-Gap Register).
  'Coaster Brook Trout':'species:salvelinus-fontinalis',
  'Brown Trout':'species:salmo-trutta',
  'Rainbow Trout (Steelhead)':'species:oncorhynchus-mykiss',
  'Steelhead':'species:oncorhynchus-mykiss',
  'Lake Trout':'species:salvelinus-namaycush',
  'Chinook Salmon':'species:oncorhynchus-tshawytscha',
  'Coho Salmon':'species:oncorhynchus-kisutch',
  'Cisco (Tullibee)':'species:coregonus-artedi',
 };
 // Explicitly NOT mapped, checked and rejected on purpose (do not approximate to a similar species):
 //   'Tiger Muskellunge' -- a real, distinct hybrid never researched as its own target.
 //   'Yellow Bass'        -- a real, disclosed gap (see DEFERRED-GAP-BACKLOG.md).
 //   'Splake'              -- a real trout/char hybrid, never researched.
 // All other ~84 app species names have no approved research at all and are correctly absent.
 function toSlug(appSpeciesName){return MAP[String(appSpeciesName||'').trim()]||null}
 function isMapped(appSpeciesName){return toSlug(appSpeciesName)!==null}
 window.FishWizzApprovedResearchTaxonomy={toSlug,isMapped,MAP};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{approvedResearchTaxonomy:{toSlug,isMapped}});
})();
