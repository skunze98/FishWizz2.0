(()=>{
 const species=[
 'Largemouth Bass','Smallmouth Bass','Rock Bass','White Bass','Yellow Bass','Green Sunfish','Bluegill','Pumpkinseed','Longear Sunfish','Orange-spotted Sunfish','Warmouth','Black Crappie','White Crappie','Yellow Perch','White Perch',
 'Walleye','Sauger','Saugeye','Northern Pike','Muskellunge','Tiger Muskellunge','Chain Pickerel','Grass Pickerel',
 'Channel Catfish','Flathead Catfish','Black Bullhead','Brown Bullhead','Yellow Bullhead','Stonecat','Tadpole Madtom',
 'Lake Sturgeon','Shovelnose Sturgeon','Paddlefish','Bowfin','Burbot','Freshwater Drum',
 'Common Carp','Bigmouth Buffalo','Smallmouth Buffalo','Black Buffalo','Quillback','River Carpsucker','Highfin Carpsucker','White Sucker','Longnose Sucker','Blue Sucker','Spotted Sucker','Northern Hog Sucker','Silver Redhorse','Golden Redhorse','Shorthead Redhorse','Greater Redhorse','Black Redhorse','River Redhorse',
 'Longnose Gar','Shortnose Gar','Spotted Gar','Goldeye','Mooneye',
 'Cisco (Tullibee)','Lake Whitefish','Round Whitefish','Bloater','Kiyi','Deepwater Sculpin',
 'Brook Trout','Brown Trout','Rainbow Trout (Steelhead)','Lake Trout','Splake','Coaster Brook Trout','Chinook Salmon','Coho Salmon','Pink Salmon','Atlantic Salmon',
 'American Eel','Rainbow Smelt','Alewife','Gizzard Shad','Threadfin Shad',
 'Common Shiner','Golden Shiner','Emerald Shiner','Spotfin Shiner','Spottail Shiner','Blackchin Shiner','Blacknose Shiner','Mimic Shiner','Sand Shiner','River Shiner','Red Shiner','Striped Shiner','Bigmouth Shiner','Brassy Minnow','Fathead Minnow','Bluntnose Minnow','Creek Chub','Hornyhead Chub','Lake Chub','Pearl Dace','Northern Redbelly Dace','Finescale Dace','Blacknose Dace','Longnose Dace','Central Stoneroller','Common Carp',
 'Brook Silverside','Central Mudminnow','Iowa Darter','Johnny Darter','Fantail Darter','Rainbow Darter','Least Darter','Logperch','Yellow Perch','Ruffe','Round Goby','Tubenose Goby','White Perch'
 ];
 window.ATLAS_MN_WI_FRESHWATER_SPECIES=[...new Set(species)].sort((a,b)=>a.localeCompare(b));
 const common=['Largemouth Bass','Smallmouth Bass','Walleye','Northern Pike','Muskellunge','Black Crappie','White Crappie','Bluegill','Pumpkinseed','Yellow Perch','Channel Catfish','Flathead Catfish','Rock Bass','White Bass','Freshwater Drum','Common Carp','Lake Sturgeon','Sauger','Burbot','Bowfin','Brook Trout','Brown Trout','Rainbow Trout (Steelhead)','Lake Trout'];
 function optionize(sel){if(!sel||sel.dataset.speciesCatalog)return;const current=sel.value,existing=[...sel.options].map(o=>o.textContent.trim());sel.innerHTML='';const groups=[['Popular targets',common],['More MN + WI freshwater species',window.ATLAS_MN_WI_FRESHWATER_SPECIES.filter(x=>!common.includes(x))]];for(const [label,items] of groups){const g=document.createElement('optgroup');g.label=label;items.forEach(x=>{const o=document.createElement('option');o.value=x;o.textContent=x;g.appendChild(o)});sel.appendChild(g)};if(current&&[...sel.options].some(o=>o.value===current))sel.value=current;sel.dataset.speciesCatalog='1'}
 function catchList(){const input=document.getElementById('cSpecies');if(!input||document.getElementById('atlasSpeciesList'))return;const dl=document.createElement('datalist');dl.id='atlasSpeciesList';window.ATLAS_MN_WI_FRESHWATER_SPECIES.forEach(x=>{const o=document.createElement('option');o.value=x;dl.appendChild(o)});document.body.appendChild(dl);input.setAttribute('list','atlasSpeciesList');input.placeholder='Start typing a species'}
 function boot(){optionize(document.getElementById('mTarget'));catchList();document.dispatchEvent(new CustomEvent('atlas:species-ready',{detail:{count:window.ATLAS_MN_WI_FRESHWATER_SPECIES.length}}))}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();