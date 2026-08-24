import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(root,'..','..','outputs');
const source=fs.readFileSync(path.join(root,'public','gear-catalog.js'),'utf8');

function literalAfter(marker){
  const start=source.indexOf(marker)+marker.length;
  const open=source.indexOf('{',start); let depth=0, quote='', esc=false;
  for(let i=open;i<source.length;i++){
    const c=source[i];
    if(quote){ if(esc)esc=false; else if(c==='\\')esc=true; else if(c===quote)quote=''; continue; }
    if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
    if(c==='{')depth++; else if(c==='}'&&--depth===0)return source.slice(open,i+1);
  }
  throw new Error(`Unclosed object after ${marker}`);
}
const catalog=Function(`return (${literalAfter('const CATALOG=')})`)();
const extras=Function(`return (${literalAfter('const EXTRA_CATALOG=')})`)();
const families=Function(`return (${literalAfter('const FAMILY_INDEX=')})`)();

for(const type of ['rod','reel']){
  for(const [brand,rows] of Object.entries(extras[type]||{})) (catalog[type][brand]??=[]).push(...rows);
  for(const [brand,list] of Object.entries(families[type]||{})){
    const rows=catalog[type][brand]??=[]; const seen=new Set(rows.map(r=>r[0].toLowerCase().replace(/[^a-z0-9]/g,'')));
    for(const model of list.split('|')) if(!seen.has(model.toLowerCase().replace(/[^a-z0-9]/g,''))) rows.push([model]);
  }
}

const S={
 rod:{
  'Abel':['Rove Fly Rod'],
  'Accurate':['Valiant Rod','BX Rod'],
  'Bajio':['Fly Rod'],
  'Bates Fishing Co.':['Hundo Casting Rod'],
  'Beulah':['G2 Platinum','Guide Series II','Onyx','Opal','Platinum Spey','G2 Platinum Spey','Tonic'],
  'Calstar':['Grafighter','West Coast','E-Glass','GG Composite','BTG Series'],
  'Century':['Stealth','Slingshot','Excalibur','Tip Tornado','Eliminator T900','Weapon Jr.'],
  'Echo':['Boost Fresh','Boost Blue','Carbon XL','Ion XL','Lift','River Glass','Shadow X','Shadow II','Trip','Traverse','Prime','King','Swing','Full Spey','TR2'],
  'Epic':['Reference Series Graphene Fly Rod','FastGlass II','Packlight','Bandit','DH13 Spey'],
  'FishUSA':['Flagship Bass','Flagship Centerpin','Flagship Salmon Steelhead','Flagship Surf'],
  'Hardy':['Marksman','Ultralite X','Ultralite NSX SR','Aydon','Aydon Travel','Zane Pro','Ultralite LL','Demon Switch','Demon Saltwater','Ultralite SR'],
  'Moonshine Rod Co.':['The Drifter II','The Revival S','The Vesper','The Epiphany II','The Outcast II','The Midnight Special','The Creede'],
  'Orvis':['Helios D','Helios F','Recon Freshwater','Recon Saltwater','Recon Euro','Mission Two-Handed','Mission Short Spey','Superfine Glass','Clearwater','Bamboo','Encounter'],
  'Redington':['EDC','Predator','Vice','Trace','Classic Trout','Wrangler','Path II','Crosswater','Strike II','Claymore','Dually II','Butter Stick','Original'],
  'R.L. Winston':['Air 2','Pure 2','Air Salt','Air TH','Borom III TH','Borom III X','Tom Morgan Favorite'],
  'Sage':['Arrow','Power R8','R8 Core','Classic R8','Salt R8','Payload','Dart','Sonic','Foundation','Trout Spey G5','Igniter','ESN','X'],
  'Scott':['Centric','Session','G Series','F Series','Sector','Wave','Swing','GT'],
  'Thomas & Thomas':['Avantt II','Paradigm','Contact II','Zone','Exocett SS','Exocett Surf','Exocett Predator','DNA Spey','DNA Switch'],
  'Tsunami':['Airwave Elite','Airwave Surf','Carbon Shield II','Platinum Surface','Trophy II','Five Star','Sapphire XT','SaltX'],
  'ODM':['Genesis','DNA','Nexus','Frontier X','Evolution','Jaguar'],
  'Star Rods':['Plasma II Inshore','Plasma II Boat','Seagis Inshore','Stellar Lite','Stellar Surf','Aerial Inshore','Aerial Surf','Handcrafted'],
  'Talon':['ITM','Professional','VI Plus'],
  'Bull Bay Rods':['Stealth Sniper','Banshee','Assault','Bolt','Brute Force','Karbine','Sniper'],
  'Crowder Rods':['E-Series Lite','E-Series','Bluewater','Stand-Up','Live Bait','Trolling'],
  'Blackfin Rods':['Fin Series','Carbon Elite','Rod & Reel'],
  'Falcon':['Cara','Expert','Lowrider','BuCoo SR','Coastal','HD','Slab'],
  'Powell':['Endurance','Naked','Max','Diesel'],
  'RainShadow':['RX10','RX8+','RX7','Revelation','Immortal','Judge'],
  'North Fork Composites':['X-Ray','HM','IM','Delta','Iconoglass'],
  'Wright & McGill':['Skeet Reese','Sabalo','Blair Wiggins'],
  'Profishiency':['Krazy','Tiny But Mighty','Pocket Combo'],
  'Catch The Fever':['Hellcat','Hellcat X','Precision Cast','Big Cat Fever','SlimeCat'],
  'Mad Katz':['Goblin','Orange Crush','Purple Haze','Pink Warrior','Gold Digger'],
  'BnM Poles':['Sam Heaton Super Sensitive','Buck’s Graphite Jig Pole','The Stick','Brushcutter','Black Widow','Pro Staff Trolling Rod'],
  'Meiser':['MKS','Highlander S','S2H','CX'],
  'Douglas':['Sky G','Sky','DXF Gen2','ERA','Upstream Plus','LRS','Matrix'],
  'Ross':['Reel not Rod'],
 },
 reel:{
  'Abel':['SDF','SDS','Rove','TR','Vaya'],
  'Alutecnos':['Albacore Gorilla','Albacore Two Speed','Albacore Single Speed'],
  'Cheeky':['Launch Triple Play','Limitless','PreLoad','Tyro Triple Play'],
  'Einarsson':['Invictus','Plus','Plus Pro','S'],
  'Galvan':['Torque','Rush Light','Brookie','Grip'],
  'Hatch':['Iconic','Iconic Limited Edition'],
  'Hardy':['Fortuna Regent','Ultradisc UDLA','Ultradisc Cassette','Ultralite CA DD','Resonate','Averon','Marquis LWT','Perfect Wide Spool'],
  'Lamson':['Litespeed M8','Litespeed F','Guru S HD','Guru S','Remix HD','Liquid S','Speedster S','Purist II','Centerfire HD'],
  'Nautilus':['NV-G','NV Monster','CCF-X2','X-Series','XM'],
  'Orvis':['Mirage','Mirage LT','Hydros','Battenkill Disc','Battenkill Click','Clearwater','SSR Disc','Recon'],
  'Redington':['Classic Spey','Classic Trout','ACE','Ace Tactical LE','Behemoth','Crosswater IV','Grande','Rise III','Run','Tilt'],
  'Ross Reels':['Animas','Colorado','Evolution LTX','Evolution R','Evolution R Salt','San Miguel'],
  'Sage':['Shift','Shift LT','Enforcer','Thermo','Arbor XL','Spectrum C','Spectrum LT','Spectrum Max','Click'],
  'Tibor':['Signature Series','Everglades','Riptide','Gulfstream','Billy Pate'],
  'Thomas & Thomas':['Individualist'],
  'Loop':['Opti Creek','Opti Dryfly','Opti Speedrunner','Opti Strike','Evotec G5','Q Reel'],
  'Danielsson':['L5W','F3W','Control','DryFly','Original'],
  'Temple Fork Outfitters':['NTR','NTR II','Power','BVK SD'],
  'Marryat':['C-Plus','MR','M-Design'],
  'Mako':['Model 9500','Model 9550','Model 9600','Model 9700'],
  'Avet':['SX','SXJ','MXJ','MXL','JX','LX','HX','HXW','EX','Raptor'],
  'Accurate':['ATD Platinum TwinDrag','Boss Valiant','Boss Fury','Tern 2','Dauntless'],
  'Seigler':['Small Game','Large Game','Medium Game','SF Fly Reel','MF Fly Reel','BF Fly Reel'],
  'Bates Fishing Co.':['Hundo','Goat','Salty Hundo'],
  'Penn':['International VI','International VISW','Torque II','Fathom Lever Drag','Fathom Star Drag','Squall Lever Drag','Squall Star Drag','Senator','General Purpose Level Wind'],
  'Fin-Nor':['Lethal','Offshore','Primal Lever Drag'],
  'Tsunami':['SaltX II','Evict','Shield','Trophy II','Forged'],
  'ProFishiency':['Krazy Baitcast','Krazy Spinning','A13 Krazy'],
  'Kamikaze':['Centerpin Reel'],
  'Raven':['Matrix Centerpin','Helix Centerpin','T-5 Centerpin'],
  'Islander':['Steelheader','MR3 Mooching','LX Fly','IR Fly'],
  'Kingpin':['Imperial 475','R2 500','Zodiac 500'],
 }
};

const official={
 'Shimano':'https://fish.shimano.com/en-US/product/list.html','Daiwa':'https://daiwa.us/collections/','St. Croix':'https://stcroixrods.com/collections/freshwater','Orvis':'https://www.orvis.com/fly-fishing/rods-reels-line','Sage':'https://farbank.com/pages/sage/performance-casting-the-stop','Redington':'https://farbank.com/collections/redington-fly-fishing','Hardy':'https://www.hardyfishing.com','Penn':'https://www.pennfishing.com','Abu Garcia':'https://www.abugarcia.com','Lamson':'https://www.waterworks-lamson.com','G. Loomis':'https://www.gloomis.com','Okuma':'https://okumafishingusa.com','Fenwick':'https://www.fenwickfishing.com','Lew\'s':'https://www.lews.com','Ugly Stik':'https://www.uglystik.com','Dobyns':'https://dobynsrods.com'
};
const rows=[];
for(const type of ['rod','reel']) for(const [brand,models] of Object.entries(catalog[type])) for(const r of models){
 rows.push({type,brand,model:r[0],market_status:'mixed_current_or_legacy',verification:'existing_app_catalog_needs_row_review',source_url:official[brand]||'',notes:'Imported from FishWizz catalog; retained pending manufacturer-by-manufacturer verification.'});
}
for(const type of ['rod','reel']) for(const [brand,models] of Object.entries(S[type])) for(const model of models){
 if(model==='Reel not Rod')continue;
 rows.push({type,brand,model,market_status:'current_or_recent',verification:'manufacturer_family_research',source_url:official[brand]||'',notes:'Model family; sizes, powers, actions, and generations may be separate variants.'});
}
const key=r=>`${r.type}|${r.brand}|${r.model}`.toLowerCase().replace(/[^a-z0-9|]/g,'');
const unique=[...new Map(rows.sort((a,b)=>a.type.localeCompare(b.type)||a.brand.localeCompare(b.brand)||a.model.localeCompare(b.model)).map(r=>[key(r),r])).values()];
const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
const cols=['type','brand','model','market_status','verification','source_url','notes'];
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'FishWizz-Rod-Reel-Master-Catalog.csv'),[cols.join(','),...unique.map(r=>cols.map(c=>q(r[c])).join(','))].join('\r\n'),'utf8');
fs.writeFileSync(path.join(out,'FishWizz-Rod-Reel-Master-Catalog.json'),JSON.stringify({as_of:'2026-08-24',scope:'US-market current and commonly owned recent/legacy rod and reel model families; not every historical SKU worldwide',rows:unique},null,2),'utf8');
const appData={rod:{},reel:{}};
for(const row of unique)(appData[row.type][row.brand]??=[]).push(row.model);
fs.writeFileSync(path.join(root,'public','gear-master-data.js'),`/* Generated by scripts/generate-master-gear-catalog.mjs. */\nwindow.fishwizzMasterGearData=${JSON.stringify(appData)};\n`,'utf8');
const stats={}; for(const type of ['rod','reel']){const rr=unique.filter(r=>r.type===type);stats[type]={brands:new Set(rr.map(r=>r.brand)).size,models:rr.length};}
const report=`# FishWizz rod and reel catalog coverage\n\nAs of **2026-08-24**.\n\n| Gear | Brands | Model families |\n|---|---:|---:|\n| Rods | ${stats.rod.brands} | ${stats.rod.models} |\n| Reels | ${stats.reel.brands} | ${stats.reel.models} |\n| **Total** | **${new Set(unique.map(r=>r.brand)).size}** | **${unique.length}** |\n\n## Scope and honesty note\n\nThis is a broad US-market master working catalog of current and commonly owned recent/legacy **model families**. “Every model ever made worldwide” is not a finite, verifiable claim: manufacturers silently revise sites, private-label products change by retailer, regional Japanese/European/Australian catalogs differ, and many discontinued catalogs are not published. The CSV therefore includes verification and market-status fields instead of pretending uncertain rows are confirmed.\n\n## Recommended application behavior\n\nUse this catalog for suggestions and OCR matching, but always preserve free-text brand and model entry. Never reject a user’s gear because it is absent from the catalog. Model variants (length, power, action, reel size, gear ratio, handedness, and generation suffix) should be stored in separate fields where possible.\n`;
fs.writeFileSync(path.join(out,'FishWizz-Rod-Reel-Coverage-Report.md'),report,'utf8');
console.log(JSON.stringify({out,stats,totalBrands:new Set(unique.map(r=>r.brand)).size,totalModels:unique.length},null,2));


