(()=>{
  const BRAND_GROUPS={
    rod:[
      '13 Fishing','Abu Garcia','Accurate','Airrus','All Star','ALX Rods','American Tackle','Ark Rods','Berkley',"B'n'M",'Bass Pro Shops','Cashion','Cashion ICON','CastAway','Cashion Element','Daiwa','Denali','Dobyns','Douglas','Duckett','Edge Rods','Favorite Fishing','Fenwick','G. Loomis','Googan Squad','Grandt','Hammer Rods','Halo Fishing','KastKing','Kistler','Lamiglas','Lew\'s','Megabass','Millerods','Okuma','Old Town','Pflueger','Phenix','Piscifun','Quantum','Rapala','Scheels Outfitters','Seeker','Shakespeare','Shimano','Sixgill','St. Croix','Temple Fork Outfitters','Tica','Ugly Stik','Zebco','Z-Man'
    ],
    reel:[
      '13 Fishing','Abu Garcia','Accurate','Ardent','Avet','Bass Pro Shops','Bates Fishing Co.','Daiwa','Favorite Fishing','KastKing','Lew\'s','Mitchell','Okuma','Penn','Pflueger','Piscifun','Quantum','Scheels Outfitters','Seigler','Shakespeare','Shimano','Sixgill','Tica','Van Staal','Zebco'
    ],
    tackle:[
      '6th Sense','Abu Garcia','Acme','AFTCO','Arbogast','Berkley','Big Bite Baits','Bobby Garland','Booyah','Castaic','Cotton Cordell','Culprit','Daiwa','Deps','Duo Realis','Eagle Claw','Eppinger','Evergreen','FishLab','Gamakatsu','Gary Yamamoto','Googan Baits','Heddon','Jackall','Jenko','Johnson','Keitech','Koppers LiveTarget','KVD','Lunkerhunt','Lunker City','Luhr-Jensen','Mann\'s','Mepps','Megabass','Missile Baits','Molix','Mustad','Northland Tackle','Owner','Ozark Trail','Rapala','Rebel','River2Sea','Roboworm','Salmo','Savage Gear','Scheels Outfitters','Seaguar','Sebile','Shimano','Smithwick','SPRO','Strike King','Storm','Sufix','Sunline','Terminator','The Original Fish Formula','VMC','War Eagle','Westin','Yo-Zuri','YUM','Z-Man','Zoom'
    ]
  };

  const CATALOG={
    rod:{
      'St. Croix':[
        ['Legend Tournament Bass','7\'2\"','Heavy','Fast'],['Legend Tournament Bass','7\'3\"','Medium Heavy','Fast'],['Legend Elite','7\'0\"','Medium','Fast'],['Legend X','7\'1\"','Medium Heavy','Fast'],['Victory','7\'3\"','Medium Heavy','Fast'],['Avid','7\'0\"','Medium','Fast'],['Avid X','6\'8\"','Medium Extra Fast','Extra Fast'],['Mojo Bass','7\'1\"','Medium Heavy','Fast'],['Bass X','7\'1\"','Medium Heavy','Fast'],['Premier','6\'6\"','Medium','Fast'],['Eyecon','7\'0\"','Medium Light','Fast'],['Triumph','6\'6\"','Medium','Fast']
      ],
      'Shimano':[
        ['Curado','6\'10\"','Medium','Fast'],['Curado','7\'2\"','Medium Heavy','Fast'],['Expride B','7\'2\"','Medium Heavy','Fast'],['Zodias','7\'2\"','Medium Heavy','Fast'],['Poison Adrena','7\'2\"','Medium','Fast'],['Intenza','7\'2\"','Medium Heavy','Fast'],['SLX A','7\'2\"','Medium Heavy','Fast'],['Sellus','7\'0\"','Medium','Fast'],['Convergence','6\'6\"','Medium','Fast'],['Compre Walleye','7\'0\"','Medium Light','Fast']
      ],
      'Daiwa':[
        ['AIRD-X','6\'6\"','Medium','Fast'],['AIRD-X','7\'0\"','Medium Heavy','Fast'],['Tatula Elite','7\'3\"','Medium Heavy','Fast'],['Tatula XT','7\'0\"','Medium Heavy','Fast'],['Kage','7\'1\"','Medium Heavy','Fast'],['Rebellion','7\'3\"','Heavy','Fast'],['Steez AGS','7\'2\"','Medium Heavy','Fast'],['Procyon','7\'0\"','Medium','Fast'],['Presso','6\'6\"','Ultra Light','Fast']
      ],
      'G. Loomis':[
        ['NRX+ 873C CRR','7\'3\"','Medium Heavy','Fast'],['NRX+ 852S JWR','7\'1\"','Medium','Extra Fast'],['GLX 853C JWR','7\'1\"','Medium Heavy','Extra Fast'],['IMX-PRO 854C JWR','7\'1\"','Heavy','Fast'],['GCX 843C MBR','7\'0\"','Medium Heavy','Fast'],['E6X 843C MBR','7\'0\"','Medium Heavy','Fast']
      ],
      'Dobyns':[
        ['Champion XP 734C','7\'3\"','Heavy','Fast'],['Champion XP 703SF','7\'0\"','Medium','Fast'],['Sierra 734C','7\'3\"','Heavy','Fast'],['Fury 703C','7\'0\"','Medium Heavy','Fast'],['Fury 734C','7\'3\"','Heavy','Fast'],['Kaden 744C','7\'4\"','Heavy','Fast']
      ],
      'Fenwick':[
        ['HMG','7\'0\"','Medium','Fast'],['HMG Bass','7\'2\"','Medium Heavy','Fast'],['Elite Bass','7\'3\"','Medium Heavy','Fast'],['Eagle','6\'6\"','Medium','Fast'],['HMX','7\'0\"','Medium Heavy','Fast'],['World Class','7\'2\"','Medium Heavy','Fast']
      ],
      'Abu Garcia':[
        ['Veritas','7\'0\"','Medium Heavy','Fast'],['Vendetta','7\'0\"','Medium Heavy','Fast'],['Vengeance','7\'0\"','Medium Heavy','Fast'],['Ike Signature','7\'2\"','Medium Heavy','Fast'],['Jordan Lee','7\'0\"','Medium Heavy','Fast'],['Max Pro','7\'0\"','Medium Heavy','Fast']
      ],
      'Berkley':[
        ['Lightning Rod','7\'0\"','Medium','Fast'],['Lightning Rod Shock','7\'0\"','Medium Heavy','Fast'],['Cherrywood HD','6\'6\"','Medium','Fast'],['Fusion19','7\'0\"','Medium Heavy','Fast']
      ],
      'Ugly Stik':[
        ['GX2','6\'6\"','Medium','Moderate Fast'],['Elite','7\'0\"','Medium','Fast'],['Carbon','7\'0\"','Medium Heavy','Fast'],['Catfish Special','7\'0\"','Medium Heavy','Moderate Fast']
      ],
      'Lew\'s':[
        ['Mach 2','7\'0\"','Medium Heavy','Fast'],['Mach Smash','7\'0\"','Medium Heavy','Fast'],['Custom Lite','7\'2\"','Medium Heavy','Fast'],['KVD Composite Cranking','7\'0\"','Medium','Moderate'],['American Hero','7\'0\"','Medium Heavy','Fast']
      ],
      'Scheels Outfitters':[
        ['Ebisu Pro','7\'0\"','Medium Heavy','Fast'],['Ebisu Z','6\'6\"','Medium','Fast'],['Pro Classic','7\'0\"','Medium','Fast'],['Tourney Trail','6\'6\"','Medium','Moderate'],['Outfitters Pro Angler','7\'0\"','Medium Heavy','Fast']
      ],
      'Bass Pro Shops':[
        ['Johnny Morris CarbonLite','7\'0\"','Medium Heavy','Fast'],['Johnny Morris Platinum Signature','7\'1\"','Medium Heavy','Fast'],['Pro Qualifier','7\'0\"','Medium Heavy','Fast'],['Bionic Blade','7\'0\"','Medium','Fast'],['Tourney Special','6\'6\"','Medium','Fast']
      ],
      '13 Fishing':[['Omen Black','7\'1\"','Medium Heavy','Fast'],['Fate Black','7\'1\"','Medium Heavy','Fast'],['Defy Black','7\'0\"','Medium','Fast'],['Muse Black','7\'2\"','Medium Heavy','Fast']],
      'Okuma':[['Serrano','7\'2\"','Medium Heavy','Fast'],['Guide Select Pro','7\'0\"','Medium','Fast'],['Celilo','6\'6\"','Light','Fast']],
      'Megabass':[['Orochi XX','7\'2\"','Medium Heavy','Fast'],['Levante','7\'0\"','Medium','Fast'],['Destroyer P5','7\'2\"','Medium Heavy','Fast']],
      'Zebco':[['Rhino Tough','6\'6\"','Medium','Moderate Fast'],['Big Cat','7\'0\"','Medium Heavy','Moderate Fast']]
    },
    reel:{
      'Abu Garcia':[
        ['Revo MGX','Baitcasting','7.9:1'],['Revo MGXtreme','Baitcasting','8.0:1'],['Revo SX','Baitcasting','7.3:1'],['Revo STX','Baitcasting','8.1:1'],['Revo Rocket','Baitcasting','10.1:1'],['Revo Winch','Baitcasting','5.4:1'],['Max Pro','Baitcasting','7.1:1'],['Black Max','Baitcasting','6.4:1'],['Zata','Spinning','6.2:1'],['Revo X','Spinning','6.2:1']
      ],
      'Daiwa':[
        ['AIRD 80','Baitcasting','7.3:1'],['Tatula 100','Baitcasting','7.1:1'],['Tatula SV TW','Baitcasting','7.1:1'],['Zillion SV TW','Baitcasting','7.1:1'],['Steez A II TW','Baitcasting','7.1:1'],['Lexa TW','Baitcasting','7.1:1'],['Regal LT','Spinning','5.2:1'],['Fuego LT','Spinning','6.2:1'],['Tatula MQ LT','Spinning','6.2:1'],['Ballistic MQ LT','Spinning','6.2:1'],['Exist G LT','Spinning','6.2:1'],['Revros LT','Spinning','5.2:1']
      ],
      'Shimano':[
        ['Curado 200 K','Baitcasting','7.4:1'],['Curado 150 MGL','Baitcasting','7.4:1'],['Curado DC','Baitcasting','7.4:1'],['SLX 150','Baitcasting','7.2:1'],['SLX DC','Baitcasting','7.2:1'],['Metanium MGL','Baitcasting','7.1:1'],['Chronarch MGL','Baitcasting','7.1:1'],['Aldebaran MGL','Baitcasting','7.4:1'],['Nexave FI 3000','Spinning','5.0:1'],['Stradic FM','Spinning','6.0:1'],['Vanford','Spinning','6.0:1'],['Sahara FJ','Spinning','6.2:1'],['Sedona FJ','Spinning','6.2:1'],['Nasci FC','Spinning','6.2:1'],['Stella FK','Spinning','6.4:1']
      ],
      'Lew\'s':[['Tournament Pro LFS','Baitcasting','7.5:1'],['Speed Spool LFS','Baitcasting','7.5:1'],['Custom Lite SLP','Baitcasting','7.5:1'],['Mach 2','Baitcasting','7.5:1'],['KVD LFS','Baitcasting','7.5:1']],
      'Pflueger':[['President','Spinning','5.2:1'],['President XT','Spinning','6.2:1'],['Supreme XT','Spinning','6.2:1'],['Monarch','Spinning','5.2:1'],['Trion','Spinning','5.2:1']],
      'Penn':[['Battle IV','Spinning','6.2:1'],['Spinfisher VII','Spinning','6.2:1'],['Fierce IV','Spinning','6.2:1'],['Pursuit IV','Spinning','6.2:1'],['Fathom II','Conventional','6.1:1']],
      'Okuma':[['Ceymar HD','Spinning','5.2:1'],['Avenger','Spinning','5.0:1'],['Komodo SS','Baitcasting','7.3:1'],['Citrix','Baitcasting','7.3:1']],
      '13 Fishing':[['Concept A2','Baitcasting','7.5:1'],['Concept C2','Baitcasting','7.5:1'],['Origin F1','Baitcasting','8.1:1'],['Creed GT','Spinning','6.2:1']],
      'KastKing':[['Megatron','Spinning','5.2:1'],['Sharky III','Spinning','5.2:1'],['Speed Demon Elite','Baitcasting','10.5:1'],['Royale Legend II','Baitcasting','7.2:1']],
      'Bass Pro Shops':[['Johnny Morris Platinum Signature','Baitcasting','8.3:1'],['Pro Qualifier 2','Baitcasting','7.5:1'],['Johnny Morris CarbonLite 2.0','Baitcasting','8.3:1']],
      'Scheels Outfitters':[['Outfitters Pro Angler','Spinning','6.2:1'],['One Series','Baitcasting','7.3:1']],
      'Zebco':[['33','Spincast','3.6:1'],['Omega Pro','Spincast','3.4:1'],['Bullet MG','Spincast','5.1:1']]
    },
    tackle:{
      'Z-Man':[
        ['ChatterBait JackHammer','bladed jig','3/8 oz','Green Pumpkin'],['ChatterBait JackHammer','bladed jig','1/2 oz','Black/Blue'],['ChatterBait Elite EVO','bladed jig','3/8 oz','Bluegill'],['ChatterBait MiniMax','bladed jig','3/8 oz','Black/Blue'],['TRD','soft plastic','2.75 in','Green Pumpkin'],['Finesse ShroomZ','jig head','1/10 oz','Black'],['DieZel MinnowZ','swimbait','4 in','Pearl']
      ],
      'Strike King':[
        ['KVD 1.5 Square Bill','crankbait','2.25 in','Chili Craw'],['KVD 1.5 Square Bill','crankbait','2.25 in','Sexy Shad'],['KVD Jerkbait 200','jerkbait','3.5 in','Pro Blue'],['Rage Craw','soft plastic','4 in','Green Pumpkin'],['Rage Swimmer','swimbait','3.75 in','Pearl Flash'],['Tour Grade Spinnerbait','spinnerbait','3/8 oz','Chartreuse/White'],['Bitsy Bug','jig','3/8 oz','Green Pumpkin']
      ],
      'Rapala':[
        ['X-Rap 10','jerkbait','4 in','Glass Ghost'],['X-Rap 08','jerkbait','3.125 in','Silver'],['Husky Jerk 10','jerkbait','4 in','Glass Minnow'],['Original Floater 9','minnow bait','3.5 in','Silver'],['Shad Rap 7','crankbait','2.75 in','Shad'],['DT-6','crankbait','2.25 in','Bluegill'],['Rippin Rap 6','lipless crankbait','2.5 in','Chrome Blue']
      ],
      'Berkley':[
        ['Money Badger 4','crankbait','2 in','Special Red Craw'],['Stunna 112','jerkbait','4.375 in','Stealth Shad'],['Frittside 5','crankbait','2.25 in','HD Brown Craw'],['PowerBait MaxScent Flat Worm','soft plastic','3.6 in','Green Pumpkin'],['PowerBait The General','soft plastic','5.25 in','Green Pumpkin'],['PowerBait Chigger Craw','soft plastic','4 in','Green Pumpkin']
      ],
      'Megabass':[['Vision Oneten','jerkbait','4.33 in','GP Pro Blue'],['Vision Oneten Jr.','jerkbait','3.86 in','Elegy Bone'],['PopMax','topwater','3.125 in','GG Bass'],['Dark Sleeper','swimbait','3/8 oz','Haze']],
      '6th Sense':[['Crush 50X','squarebill crankbait','2.25 in','Shad Scales'],['Provoke 106X','jerkbait','4.2 in','Shad Burst'],['Quake 70','lipless crankbait','2.75 in','Wild Lava Craw'],['Divine Shaky Worm','soft plastic','6.3 in','Green Pumpkin'],['Stroker Craw','soft plastic','3.3 in','Green Pumpkin'],['Urchin','soft plastic','4.5 in','Green Pumpkin']],
      'Gary Yamamoto':[['Senko','soft plastic','5 in','Green Pumpkin'],['Yamatanuki','soft plastic','2.5 in','Green Pumpkin'],['Zako','chatterbait trailer','4 in','Green Pumpkin']],
      'Mepps':[['Aglia','inline spinner','#3','Gold'],['Aglia Dressed','inline spinner','#4','Silver/White'],['Black Fury','inline spinner','#3','Black/Yellow'],['Giant Killer','inline spinner','1.25 oz','Firetiger']],
      'Heddon':[['Super Spook Jr.','topwater','3.5 in','Bone'],['Zara Spook','topwater','4.5 in','Flitter Shad'],['Tiny Torpedo','topwater','1.875 in','Bullfrog']],
      'Booyah':[['Pad Crasher','hollow-body frog','2.5 in','Dart Frog'],['Buzz','buzzbait','3/8 oz','White/Chartreuse'],['Covert Spinnerbait','spinnerbait','1/2 oz','Bluegill']],
      'Zoom':[['Super Fluke','soft plastic','5.25 in','Pearl White'],['Trick Worm','soft plastic','6.5 in','Green Pumpkin'],['Speed Craw','soft plastic','3.5 in','Green Pumpkin']],
      'Keitech':[['Easy Shiner','swimbait','4 in','Electric Shad'],['Swing Impact FAT','swimbait','3.8 in','Bluegill Flash']],
      'Northland Tackle':[['Fire-Ball Jig','jig','1/4 oz','Parakeet'],['Deep-Vee Jig','jig','1/4 oz','UV Pink Tiger'],['Mimic Minnow','swimbait','1/4 oz','Silver Shiner']],
      'Eppinger':[['Dardevle','spoon','3/4 oz','Red/White'],['Dardevle Klicker','spoon','1 oz','Five of Diamonds']],
      'River2Sea':[['Whopper Plopper 90','topwater','3.5 in','Bone'],['Whopper Plopper 110','topwater','4.3 in','Perch']],
      'Rebel':[['Crawfish','crankbait','2 in','Stream Crawfish'],['Pop-R','topwater','2.5 in','Silver/Black']],
      'Yo-Zuri':[['3DB Jerkbait 110','jerkbait','4.375 in','Prism Ghost Shad'],['3DB Pencil','topwater','4 in','Bone'],['Rattl\'n Vibe','lipless crankbait','2.625 in','Bluegill']]
    }
  };

  /* Broad-market additions used by both manual entry and photo reconciliation. */
  const EXTRA_CATALOG={
    rod:{
      'Cashion':[['ICON Multi-Purpose','7\'0"','Medium Heavy','Fast'],['ELEMENT Inshore','7\'0"','Medium','Fast'],['CORE Worm & Jig','7\'3"','Heavy','Fast']],
      'Duckett':[['Jacob Wheeler Select','7\'2"','Medium Heavy','Fast'],['Micro Magic Pro','7\'0"','Medium Heavy','Fast'],['Black Ice','7\'3"','Heavy','Fast']],
      'Kistler':[['Helium','7\'0"','Medium Heavy','Fast'],['KLX','7\'3"','Heavy','Fast'],['Graphite','7\'0"','Medium','Fast']],
      'Lamiglas':[['XP Bass','7\'0"','Medium Heavy','Fast'],['Infinity Bass','7\'2"','Medium Heavy','Fast'],['X-11','7\'0"','Medium','Fast']],
      'Phenix':[['Feather','7\'1"','Medium Heavy','Fast'],['M1','7\'2"','Medium Heavy','Fast'],['Maxim','7\'0"','Medium','Fast']],
      'Ark Rods':[['Tharp Series','7\'3"','Heavy','Fast'],['Catalyzer','7\'1"','Medium Heavy','Fast'],['Reinforcer','7\'2"','Medium Heavy','Fast']],
      'Favorite Fishing':[['Sick Stick','7\'0"','Medium Heavy','Fast'],['White Bird','7\'1"','Medium Heavy','Fast'],['Defender','7\'3"','Heavy','Fast']],
      'Quantum':[['Smoke S3','7\'0"','Medium Heavy','Fast'],['Accurist','7\'0"','Medium','Fast'],['Throttle','6\'6"','Medium','Fast']],
      'Shakespeare':[['Ugly Stik GX2','6\'6"','Medium','Moderate Fast'],['Micro Series','7\'0"','Light','Fast'],['Wild Series','7\'0"','Medium','Fast']],
      'Temple Fork Outfitters':[['Professional','7\'0"','Medium','Fast'],['Resolve Bass','7\'3"','Medium Heavy','Fast']],
      'Piscifun':[['Serpent','7\'0"','Medium Heavy','Fast'],['Torrent','7\'0"','Medium Heavy','Fast']],
      'KastKing':[['Perigee II','7\'0"','Medium Heavy','Fast'],['Speed Demon Pro','7\'3"','Heavy','Fast'],['Resolute','7\'0"','Medium','Fast']]
    },
    reel:{
      'Quantum':[['Smoke S3','Baitcasting','7.3:1'],['Accurist PT','Baitcasting','7.0:1'],['Optix','Spinning','5.2:1']],
      'Piscifun':[['Carbon X II','Spinning','6.2:1'],['Torrent II','Baitcasting','7.1:1'],['Alijoz','Baitcasting','8.1:1']],
      'Ardent':[['Apex Grand','Baitcasting','7.3:1'],['Arrow Flipping','Baitcasting','7.0:1'],['Bolt','Spinning','6.0:1']],
      'Mitchell':[['300','Spinning','5.1:1'],['Avocet RZ','Spinning','5.1:1']],
      'Shakespeare':[['President','Spinning','5.2:1'],['Agility','Spinning','5.2:1']],
      'Favorite Fishing':[['Soleus XCS','Baitcasting','7.3:1'],['Sick Stick','Spinning','6.2:1']],
      'Van Staal':[['VR Series','Spinning','4.8:1'],['VS X2','Spinning','4.25:1']],
      'Tica':[['Cetina','Spinning','5.2:1'],['Caiman','Baitcasting','7.3:1']]
    },
    tackle:{
      'Acme':[['Kastmaster','spoon','1/4 oz','Silver'],['Little Cleo','spoon','2/5 oz','Hammered Nickel'],['Phoebe','spoon','1/6 oz','Gold']],
      'Arbogast':[['Jitterbug','topwater','2.5 in','Black'],['Hula Popper','topwater','2.25 in','Frog/White Belly']],
      'Big Bite Baits':[['Craw Tube','soft plastic','4 in','Green Pumpkin'],['Dean Rojas Cane Thumper','swimbait','5 in','Pearl']],
      'Bobby Garland':[['Baby Shad','crappie plastic','2 in','Blue Thunder'],['Slab Hunt\'R Minnow','crappie plastic','2.25 in','Monkey Milk']],
      'Cotton Cordell':[['Super Spot','lipless crankbait','2.5 in','Chrome/Blue'],['Big O','crankbait','2.25 in','Pearl Red Eye']],
      'Eagle Claw':[['Lazer Sharp Worm Hook','hook / terminal tackle','3/0','Black Platinum'],['Ball Head Jig','jig head','1/8 oz','Unpainted']],
      'Gamakatsu':[['Offset EWG Worm Hook','hook / terminal tackle','3/0','Black'],['Octopus Circle Hook','hook / terminal tackle','2/0','NS Black']],
      'Owner':[['All Purpose Soft Bait Hook','hook / terminal tackle','3/0','Black Chrome'],['Mosquito Hook','hook / terminal tackle','#2','Black Chrome']],
      'Mustad':[['KVD Grip-Pin Hook','hook / terminal tackle','3/0','Black Nickel'],['Classic Treble Hook','hook / terminal tackle','#4','Bronze']],
      'VMC':[['Neko Hook','hook / terminal tackle','1/0','Black Nickel'],['Hybrid Treble','hook / terminal tackle','#4','Black Nickel']],
      'Savage Gear':[['3D Bat','topwater','4 in','Black'],['Pulse Tail Bluegill','swimbait','4 in','Bluegill']],
      'SPRO':[['Bronzeye Frog 65','hollow-body frog','2.5 in','Natural Green'],['Little John 50','crankbait','2 in','Cell Mate']],
      'Storm':[['Arashi Square 3','squarebill crankbait','2.25 in','Bluegill'],['WildEye Swim Shad','swimbait','3 in','Shad']],
      'YUM':[['Dinger','soft plastic','5 in','Green Pumpkin'],['Christie Craw','soft plastic','3.5 in','Green Pumpkin Purple']],
      'Missile Baits':[['D Bomb','soft plastic','4 in','Green Pumpkin'],['NedBall Head','jig head','1/8 oz','Green Pumpkin']],
      'Jackall':[['Rerange 110','jerkbait','4.33 in','RT Holo Minnow'],['Kaera Frog','hollow-body frog','2.25 in','Green Frog']],
      'Evergreen':[['Jack Hammer','bladed jig','1/2 oz','Brett\'s Bluegill'],['Shower Blows','topwater','4.9 in','Bone']],
      'Googan Baits':[['Bandito Bug','soft plastic','4 in','Green Pumpkin'],['Saucy Swimmer','swimbait','3.8 in','Electric Shad']],
      'Johnson':[['Silver Minnow','spoon','1/2 oz','Silver'],['Beetle Spin','spinnerbait','1/4 oz','White/Red Dot']],
      'Luhr-Jensen':[['Hot Lips Express','crankbait','2.5 in','Firetiger'],['Krocodile','spoon','3/8 oz','Chrome']],
      'Salmo':[['Hornet 4F','crankbait','1.6 in','Hot Perch'],['Slider 7','glide bait','2.75 in','Real Roach']],
      'Smithwick':[['Rattlin Rogue','jerkbait','4.5 in','Chrome/Blue'],['Devils Horse','topwater','4.5 in','Yellow/Black']],
      'War Eagle':[['Nickel Frame Spinnerbait','spinnerbait','1/2 oz','Mouse'],['Buzzbait','buzzbait','3/8 oz','White']],
      'Roboworm':[['Straight Tail Worm','soft plastic','4.5 in','Morning Dawn'],['Fat Worm','soft plastic','6 in','Aaron\'s Magic']],
      'Culprit':[['Original Worm','soft plastic','7.5 in','Red Shad'],['Incredi-Craw','soft plastic','3.5 in','Green Pumpkin']],
      'Mann\'s':[['Baby 1-Minus','crankbait','2.25 in','Baby Bass'],['Jelly Worm','soft plastic','8 in','Grape']],
      'Lunkerhunt':[['Lunker Frog','hollow-body frog','2.5 in','Green Tea'],['Yappa Rat','topwater','2.5 in','Brown Rat']]
    }
  };
  Object.entries(EXTRA_CATALOG).forEach(([type,brands])=>Object.entries(brands).forEach(([brand,rows])=>{CATALOG[type][brand]=[...(CATALOG[type][brand]||[]),...rows];if(!BRAND_GROUPS[type].includes(brand))BRAND_GROUPS[type].push(brand)}));
  /* Model-family recognition index. Blank specs are intentional: a verified
     product name is useful for OCR matching, while guessing a configuration is not. */
  const FAMILY_INDEX={
    rod:{
      'St. Croix':'Legend X2|Legend Xtreme|Legend Glass|Legend Elite Panfish|Legend Elite Musky|Legend Elite Salmon & Steelhead|Legend Tournament Walleye|Legend Tournament Pike|Legend Tournament Musky|Victory|Mojo Bass Glass|Mojo Inshore|Mojo Musky|Mojo Yak|Musky X|Panfish Series|Trout Series|Avid Series|Avid Series Walleye|Avid Series Panfish|Avid Series Inshore|Black Bass|Black Bass Glass|Premier Musky|Triumph Travel|GXR Walleye|Rayfin|Physyx|Onchor|Croix Custom Ice|Mojo Ice',
      'Daiwa':'Steez Bass|Zillion|PX Bass|Tatula Elite AGS|Kage Premium Bass|Power Scope|Presso Air|Tatula Bass|North Coast SS|TD Eye|Metallia SSS|Rebellion|Procyon MQ|Saltist Inshore|Harrier Jigging|Proteus WN|Team Daiwa Surf|Aird Coastal Inshore|Laguna|Crossfire|Spinmatic D|Beefstick|Great Lakes Trolling|AIRD 80 Combo',
      'Shimano':'Poison Ultima|Poison Glorious|Poison Adrena|Expride|Zodias|Curado Glass|Curado BFS|SLX Glass|SLX A|Intenza A|Compre Walleye|Compre Salmon Steelhead|Clarus|Convergence D|Sellus|Sensilite|Symetre|Stimula|Talavera|Teramar|Trevala PX|Terez|SpeedMaster',
      'Abu Garcia':'Zenon|Zenon X|Veracity|Veritas PLX|Vendetta|Vengeance|Jordan Lee|Ike Signature|Max STX|Max X|Revo X|Pro Series|Catfish Commando|Diplomat V2|Fantastista X',
      'G. Loomis':'NRX+ JWR|NRX+ MBR|NRX+ NRR|NRX+ SJR|GLX JWR|GLX MBR|IMX-PRO JWR|IMX-PRO MBR|IMX-PRO SJR|IMX-PRO CRR|GCX JWR|GCX MBR|GCX Lite|E6X|Conquest',
      'Fenwick':'World Class Bass|Elite Bass|Elite Walleye|Elite Inshore|HMG Bass|HMG Walleye|HMG Inshore|HMX|Eagle|Eagle Salmon Steelhead|Eagle Travel|NightHawk X|Techna',
      'Dobyns':'Champion XP|Champion Extreme HP|Sierra|Sierra Ultra Finesse|Kaden|Fury|Colt Series|Maverick|Josh Jones Hyperlite|Sam Sobi Series|Champion Glass',
      "Lew's":'Team Lew’s Signature Series|Team Lew’s Pro-Ti|Custom Lite|Custom Speed Stick|KVD IM8|KVD Composite Cranking|Mach 2|Mach Smash|American Hero|Laser SG1|Wally Marshall Signature|Mr. Crappie Slab Shaker',
      '13 Fishing':'Envy Black|Muse Black|Omen Black|Fate Black|Defy Black|Meta|Fate V3|Defy Silver|Ambition|Code Black|Kal’on',
      'Okuma':'X-Series Bass|Serrano|Guide Select Pro|Tournament Concept Bass|Cerros|EVx|Celilo|SST|Rockaway|Tundra Pro|Dead Eye Classic',
      'Bass Pro Shops':'Johnny Morris Platinum Signature|Johnny Morris CarbonLite 2.0|Johnny Morris Signature|Pro Qualifier 2|Bionic Blade|Tourney Special|Crankin Stick|Micro Lite|Graphite Series|Predator Musky|CatMaxx',
      'Scheels Outfitters':'Ebisu Pro|Ebisu Z|One Series|Pro Classic|Tourney Trail|Outfitters Pro Angler|Walleye Series|Musky Series|Outfitters Ice',
      'KastKing':'Assegai|Blackhawk II|Brutus|Crixus|Estuary Inshore|Kong|Perigee II|Resolute|Royal Select|Speed Demon Pro|Spartacus II',
      'Megabass':'Destroyer P5|Destroyer Evoluzion|Orochi XX|Levante|Triza|Valkyrie World Expedition|Cookai|Hyuga|Great Hunting Huntsman',
      'Ugly Stik':'GX2|Elite|Carbon|Carbon Inshore|Bigwater|Catfish Special|Tiger Elite|Lite Pro|Dock Runner|Elite Salmon Steelhead'
    },
    reel:{
      'Shimano':'Antares A|Bantam MGL|Calcutta Conquest|Cardiff|Tranx|Curado BFS|Curado 70 MGL|Curado 200 M|Curado 300 K|SLX 70 A|SLX MGL 70|Scorpion MGL|Metanium DC|Stradic FM|Vanford A|Miravel|Ultegra FC|Twin Power FE|Stella FK|Sedona FJ|Sahara FJ|Nasci FC|Nexave FI|Catana FE|Sienna FG|Symetre',
      'Daiwa':'Steez SV TW|Steez CT SV TW|Zillion SV TW|Tatula Elite|Tatula 80|Tatula 100|Tatula 150|Tatula 200|Tatula 300|Tatula BF70|Tatula SV TW|Coastal SV TW|Lexa TW|Fuego CT|CA80|CR80|AIRD 80|Exist LT|Airity LT|Certate LT|Luvias LT|Ballistic MQ LT|Tatula MQ LT|Kage MQ LT|Fuego LT|Regal LT|Legalis LT|Exceler LT|Revros LT|Crossfire LT|Procyon AL',
      'Abu Garcia':'Zenon MG-X|Zenon X|Revo Premier|Revo SX|Revo STX|Revo Rocket|Revo Beast|Revo Winch|Revo X|Revo ALX|Revo MGX|Revo MGXtreme|Max Pro|Max STX|Max X|Black Max|Silver Max|Zata|Jordan Lee|Ambassadeur C3|Ambassadeur C4|Ambassadeur Beast',
      "Lew's":'Team Lew’s Pro-Ti SLP|Team Lew’s Elite-Ti|Team Lew’s HyperMag|Tournament Pro LFS|Tournament MP LFS|BB1 Pro|SuperDuty 300|Custom Lite SLP|Custom Pro Speed Spin|Speed Spool LFS|Mach 2|Mach Smash|KVD LFS|American Hero|Laser Lite|Wally Marshall Signature',
      'Pflueger':'President|President XT|Supreme|Supreme XT|Patriarch|Trion|Monarch|Lady President|President Inline Ice|Trion Inline Ice',
      'Penn':'Authority|Slammer IV|Spinfisher VII|Battle IV|Fierce IV|Pursuit IV|Wrath II|Clash II|Conflict II|Fathom II|Squall II|Senator|Rival|Spinfisher Live Liner',
      'Okuma':'Ceymar HD|Ceymar ODT|Inspira ISX|Epixon|Avenger|ITX|Serrano|HakAi|Komodo SS|Citrix|Cold Water|Convector|Magda Pro',
      '13 Fishing':'Concept TX3|Concept C2|Concept A2|Concept Z3|Modus RP2|Origin F1|Origin C|Origin TX|Creed GT|Creed K|Kal’on|Source K',
      'KastKing':'MegaJaws Elite|Speed Demon Elite|Bassinator Elite|Royale Legend II|Spartacus II|Crixus Armor X|Sharky III|Megatron|Kapstan Elite|Zephyr BFS|Valiant Eagle Gold',
      'Quantum':'Smoke S3|Smoke HD|Tour S3|Accurist PT|Energy S3|Throttle|Strategy|Optix|Escalade|Drive|Vapor PT',
      'Piscifun':'Carbon X II|Carbon Prism|Viper X|Flame|Honor XT|Torrent II|Phantom|Alijoz|Chaos XS|Saex Elite|Soloking Acura HICC-50',
      'Zebco':'33 Classic|33 Micro|33 Max|33 Platinum|Omega Pro|Bullet MG|Delta|Roam|808|888|Dock Demon'
    },
    tackle:{
      'Rapala':'ClapTail 110|Original Floater|Jointed|Countdown|Shad Rap|Shallow Shad Rap|Glass Shad Rap|X-Rap|X-Rap Magnum|X-Rap Otus|X-Rap Peto|Husky Jerk|Shadow Rap|Shadow Rap Shad|RipStop|RipStop Deep|Jigging Rap|Slab Rap|Rippin Rap|Ultra Light Rippin Rap|DT-4|DT-6|DT-8|DT-10|DT-14|DT-16|BX Brat|BX Minnow|BX Swimmer|Skitter Pop|Skitter Prop|Skitter Walk|X-Rap Pop|X-Rap Prop|CrushCity Freeloader|CrushCity Cleanup Craw|CrushCity Bronco Bug|CrushCity Ned BLT|CrushCity Mayor|CrushCity The Imposter',
      'Berkley':'Stunna|Stunna +1|Money Badger|Frittside|Frittside Biggun|Hit Stick|Flicker Shad|Flicker Minnow|War Pig|SquareBull|Juke|Cutter|WakeBull|Bullet Pop|Choppo|PowerBait MaxScent Flat Worm|PowerBait MaxScent The General|PowerBait Chigger Craw|PowerBait Power Worm|PowerBait Pit Boss|PowerBait The Champ Minnow|PowerBait Gilly|PowerBait Nessie|Gulp Minnow|Gulp Alive Minnow|Gulp Nightcrawler|Gulp Leech',
      'Z-Man':'ChatterBait Elite EVO|ChatterBait JackHammer|ChatterBait MiniMax|ChatterBait Freedom CFL|ChatterBait Big Blade|Project Z ChatterBait|Original ChatterBait|ChatterSpike|ChatterShad|RaZor ShadZ|DieZel MinnowZ|MinnowZ|Slim SwimZ|Scented Jerk ShadZ|Finesse TRD|Big TRD|TRD TicklerZ|TRD CrawZ|Hula StickZ|Finesse ShroomZ|NedlockZ|Pro ShroomZ|HeadlockZ HD|Turbo FattyZ|FattyZ|Bang StickZ|GOAT|GOAT ToadZ|Baby GOAT|HerculeZ|Scented ShrimpZ|TroutTrick|Pop ShadZ|Hard Leg FrogZ',
      'Strike King':'KVD 1.0 Square Bill|KVD 1.5 Square Bill|KVD 2.5 Square Bill|KVD 4.0 Magnum Square Bill|KVD 1.5 Deep Diver|KVD 300 Deep Jerkbait|KVD 200 Jerkbait|KVD Sexy Dawg|KVD Splash|KVD Pipsqueak Popping Perch|Red Eye Shad|Hybrid Hunter|Pro Model 3XD|Pro Model 5XD|Pro Model 6XD|Pro Model 8XD|Pro Model 10XD|Tour Grade Spinnerbait|Tour Grade Buzzbait|Thunder Cricket|Rage Craw|Rage Bug|Rage Menace|Rage Swimmer|Rage Tail Space Monkey|Ocho|Shim-E-Stick|Coffee Tube|Bitsy Bug|Hack Attack Jig|Ned Ocho|Mr. Crappie Slabalicious',
      '6th Sense':'Crush 50X|Crush 100X|Crush 250MD|Cloud 9 C6|Cloud 9 C10|Cloud 9 C15|Cloud 9 C20|Provoke 97DD|Provoke 106X|Provoke 106DD|Quake 70|Quake 80 Suspending|Movement 80X|Curve 55|Axis Metal 2.0|Speed Wake|Dogma 100|CatWalk|SplashBack|Divine Shaky Worm|Divine Swimbait|Stroker Craw|Clout Worm|Bongo|Urchin|Panorama|Hangover|Whale|Jugular Hybrid Jig|Divine Hybrid Jig',
      'Megabass':'Vision Oneten|Vision Oneten Jr.|Vision Oneten +1|Vision Oneten +2|Ito Shiner|Kanata|X-80 Trick Darter|PopMax|Pop-X|Giant Dog-X|Dog-X Diamante|i-Wing 135|Dark Sleeper|Sleeper Craw|Sleeper Gill|Spark Shad|Hazedong Shad|Magdraft|Magdraft Freestyle|Vatalion|I-Slide 135|I-Slide 185|S-Crank 1.2|S-Crank 1.5|Deep-X 100|Deep-X 200|Deep-X 300|Super-Z Z1|Super-Z Z2|Uoze Swimmer',
      'Yo-Zuri':'3DB Jerkbait|3DB Pencil|3DB Popper|3DB Wake Prop|3DB Crank|3DB Vibe|Rattl’n Vibe|Hardcore Minnow Flat|Hardcore Shad|Hardcore Crank|Hardcore Popper|Hardcore Pencil|Crystal Minnow|Pins Minnow|Hydro Popper|Hydro Pencil|High Speed Vibe|Snap Beans',
      'Gary Yamamoto':'Senko|Fat Senko|Slim Senko|Pro Senko|Kut Tail Worm|Kreature|Cowboy|Fat Ika|Hula Grub|Double Tail Grub|Single Tail Grub|Zako|Shad Shape Worm|Yamatanuki|Speed Senko|Slinko Floater|Ichi Worm|PsychoDad',
      'Mepps':'Aglia|Aglia Dressed|Aglia Long|Aglia LongCast|Black Fury|Comet Mino|XD|Syclops|Little Wolf|Giant Killer|Musky Killer|Flying C|Thunder Bug|Trophy Series',
      'Northland Tackle':'Fire-Ball Jig|Deep-Vee Jig|RZ Jig|Current Cutter Jig|Stand-Up Fire-Ball Jig|Mimic Minnow|Rippin Minnow|Eye-Candy Paddle Shad|Forage Minnow Spoon|Buck-Shot Rattle Spoon|Mach Roach|Whistler Jig|Thumper Jig|Butterfly Blade|Baitfish Spinner Harness|Reed-Runner Magnum Spinnerbait',
      'Storm':'Arashi Square 3|Arashi Square 5|Arashi Deep 10|Arashi Vibe|Arashi Top Walker|Wiggle Wart|Original ThinFin|Hot ’N Tot|WildEye Swim Shad|360GT Searchbait|Kickin Minnow|Live Kickin Shad|ThunderStick|Jointed MinnowStick',
      'Booyah':'Pad Crasher|Pad Crasher Jr.|Poppin Pad Crasher|ToadRunner|Buzz|Buzz Buzzbait|Covert Spinnerbait|Blade Spinnerbait|Pond Magic|Moon Talker|One Knocker|Hard Knocker|Boss Pop|Boss Dog|Flex II|XCS Series|Boo Jig|Bank Roll Jig',
      'Zoom':'Super Fluke|Super Fluke Jr.|Fluke Stick|Trick Worm|Finesse Worm|Magnum Finesse Worm|Ol’ Monster|Magnum Ol’ Monster|Speed Worm|Ultra Vibe Speed Craw|Z-Craw|Z-Craw Jr.|Brush Hog|Baby Brush Hog|Lizard|Swimmin Super Fluke|Horny Toad|Fat Albert Grub|Salty Super Tube|Shakey Head Worm',
      'Savage Gear':'3D Bat|3D Rat|3D Snake|3D Suicide Duck|3D Bluegill|Pulse Tail Bluegill|Pulse Tail Trout|Shine Glide|Prop Walker|Ned Dragon Tail|Ned Salamander|Duratech Craw|Duratech Toad|Battletek Swimbait|Sucker Swimbait',
      'SPRO':'Bronzeye Frog 65|Bronzeye Poppin Frog 60|Bronzeye Baby Poppin Frog|Little John 50|Little John MD 50|Little John DD 60|McStick 110|McStick 95|Aruku Shad 60|Aruku Shad 75|Fat Papa 55|Fat Papa 70|Rock Crawler 55|Essential Series Flappin Frog',
      'Heddon':'Zara Spook|Super Spook|Super Spook Jr.|One Knocker Spook|Chug’n Spook|Tiny Torpedo|Baby Torpedo|Teeny Torpedo|Crazy Crawler|Jitterbug|Lucky 13|Pop’n Image|Sonar|Hellbender|Spook Boyo',
      'River2Sea':'Whopper Plopper 60|Whopper Plopper 75|Whopper Plopper 90|Whopper Plopper 110|Whopper Plopper 130|S-Waver 120|S-Waver 168|S-Waver 200|Tactical Wake|Tango Prop|Bubble Popper|Ish Monroe Biggie|Goon|Dahlberg Diver Frog',
      'Eagle Claw':'Lazer Sharp EWG Worm Hook|Lazer Sharp Offset Worm Hook|Lazer Sharp Circle Hook|TroKar EWG Worm Hook|TroKar Flippin Hook|Ball Head Jig|Crappie Jig|Aberdeen Hook|Baitholder Hook|Treble Hook|Barrel Swivel|Snap Swivel|Split Shot Sinker',
      'VMC':'Neko Hook|Wacky Hook|RedLine Series Wacky Neko Hook|RedLine Series EWG Hook|Hybrid Treble|Bladed Hybrid Treble|Swimbait Jig|Hybrid Swimbait Jig|Half Moon Wacky Weight|Swinging Rugby Head|Tokyo Rig|Drop Dead Weighted Hook|Weedless Neko Hook|SpinJig',
      'Gamakatsu':'Offset EWG Worm Hook|Superline EWG Hook|Nano Alpha EWG Hook|Worm 34R Hook|Octopus Hook|Octopus Circle Hook|Drop Shot Split Shot Hook|Finesse Wide Gap Hook|G-Finesse Stinger|G-Finesse Hybrid Worm Hook|Weighted Superline Spring Lock Hook|Round Jig Head',
      'Owner':'All Purpose Soft Bait Hook|Jungle Flipping Hook|Rig’n Hook|TwistLock Light Hook|TwistLock Beast Hook|Mosquito Hook|Mosquito Light Hook|Wacky Hook|Cover Shot Hook|Sniper Finesse Hook|Stinger Treble ST-36|Flashy Swimmer|Ultrahead Finesse Type|Block Head Jig Head'
    }
  };
  const familyKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  Object.entries(FAMILY_INDEX).forEach(([type,brands])=>Object.entries(brands).forEach(([brand,list])=>{
    if(!BRAND_GROUPS[type].includes(brand))BRAND_GROUPS[type].push(brand);
    const rows=CATALOG[type][brand]||(CATALOG[type][brand]=[]),seen=new Set(rows.map(r=>familyKey(r[0])));
    list.split('|').map(x=>x.trim()).filter(Boolean).forEach(name=>{if(seen.has(familyKey(name)))return;rows.push(type==='rod'?[name,'','','']:type==='reel'?[name,'','']:[name,'','','']);seen.add(familyKey(name))});
  }));
  Object.values(BRAND_GROUPS).forEach(rows=>rows.sort((a,b)=>a.localeCompare(b)));

  const aliases={'st':'St. Croix','st.':'St. Croix','saint croix':'St. Croix','g loomis':'G. Loomis','g.':'G. Loomis','bsp':'Bass Pro Shops','b pro':'Bass Pro Shops','sixth sense':'6th Sense','strike':'Strike King','abu':'Abu Garcia','scheels':'Scheels Outfitters','ugly':'Ugly Stik','zman':'Z-Man'};
  const POPULAR={rod:['St. Croix','Shimano','Daiwa','G. Loomis','Fenwick','Abu Garcia'],reel:['Shimano','Daiwa','Abu Garcia','Pflueger','Lew\'s','Penn'],tackle:['Rapala','Strike King','Z-Man','Berkley','6th Sense','Megabass']};
  const RECENT_KEY='fishwizz_recent_gear_v1';
  const norm=s=>String(s||'').trim().toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9'.& -]/g,'');
  const typeFromForm=form=>/Add rod/i.test(form.textContent)?'rod':/Add reel/i.test(form.textContent)?'reel':'tackle';
  const values=form=>[...form.querySelectorAll('[data-mf]')];

  function recent(){try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'{}')}catch{return{}}}
  function remember(type,brand,model){if(!brand&&!model)return;const all=recent(),rows=all[type]||[],next=[{brand,model},...rows.filter(x=>norm(x.brand)!==norm(brand)||norm(x.model)!==norm(model))].slice(0,8);all[type]=next;try{localStorage.setItem(RECENT_KEY,JSON.stringify(all))}catch{}}
  function score(label,q){const a=norm(label),b=norm(q);if(!b)return 10;if(a===b)return 100;if(a.startsWith(b))return 80;if(a.includes(b))return 60;const tokens=b.split(/\s+/).filter(Boolean);return tokens.every(t=>a.includes(t))?40:0}

  function choices(type,q){
    const all=BRAND_GROUPS[type]||[],n=norm(q);
    if(!n)return all.slice(0,10);
    const alias=aliases[n];
    return all.filter(x=>score(x,n)||(alias&&x===alias)).sort((a,b)=>score(b,n)-score(a,n)||a.localeCompare(b)).slice(0,12);
  }
  function exactBrand(type,value){const n=norm(value),all=BRAND_GROUPS[type]||[];return all.find(x=>norm(x)===n)||aliases[n]||null}
  function modelLabel(type,row){return type==='rod'?`${row[0]} — ${[row[1],row[2],row[3]].filter(Boolean).join(' · ')}`:type==='reel'?`${row[0]} — ${[row[1],row[2]].filter(Boolean).join(' · ')}`:`${row[0]} — ${[row[2],row[3]].filter(Boolean).join(' · ')}`}
  function resolveRecognition(raw={},hint='unknown'){
    const visible=Array.isArray(raw.visible_text)?raw.visible_text.join(' '):String(raw.visible_text||'');
    const hay=norm([raw.brand,raw.model,raw.category,raw.equipment_type,visible].filter(Boolean).join(' '));
    const types=hint&&hint!=='unknown'?[hint]:raw.equipment_type&&raw.equipment_type!=='unknown'?[raw.equipment_type,'rod','reel','tackle']:['rod','reel','tackle'];
    const candidates=[];
    [...new Set(types)].filter(t=>CATALOG[t]).forEach(type=>Object.entries(CATALOG[type]).forEach(([brand,rows])=>{
      const bn=norm(brand),brandExplicit=norm(raw.brand),brandHit=brandExplicit===bn?65:hay.includes(bn)?48:(aliases[brandExplicit]===brand?55:0);
      rows.forEach(row=>{
        const mn=norm(row[0]),tokens=mn.split(/\s+/).filter(x=>x.length>1),matched=tokens.filter(x=>hay.includes(x)).length;
        const modelHit=hay.includes(mn)?90:(tokens.length&&matched===tokens.length?68:matched?Math.round(42*matched/tokens.length):0);
        const predicted=norm(raw.model),predictionHit=predicted===mn?72:predicted&&mn.includes(predicted)?52:0;
        const specTokens=norm(row.slice(1).join(' ')).split(/\s+/).filter(x=>x.length>1),specMatched=specTokens.filter(x=>hay.includes(x)).length;
        const specHit=Math.min(28,specMatched*7),total=brandHit+Math.max(modelHit,predictionHit)+specHit+(type===raw.equipment_type?8:0);
        if(total>=48)candidates.push({type,brand,row,score:total});
      });
    }));
    candidates.sort((a,b)=>b.score-a.score||a.brand.localeCompare(b.brand));
    const best=candidates[0];if(!best)return{...raw,catalog_match:null,catalog_candidates:[]};
    const out={...raw,equipment_type:best.type,brand:best.brand,model:best.row[0],catalog_match:{brand:best.brand,model:best.row[0],type:best.type,score:best.score},catalog_candidates:candidates.slice(0,3).map(x=>({brand:x.brand,model:x.row[0],type:x.type,score:x.score}))};
    if(best.type==='rod'){out.length=out.length||best.row[1];out.power=out.power||best.row[2];out.action=out.action||best.row[3]}
    else if(best.type==='reel'){out.reel_type=out.reel_type||best.row[1];out.gear_ratio=out.gear_ratio||best.row[2]}
    else{out.category=out.category||best.row[1];out.size_weight=out.size_weight||best.row[2];out.color=out.color||best.row[3]}
    const catalogConfidence=Math.min(.99,.58+Math.min(best.score,160)/400);out.confidence=Math.max(Number(raw.confidence)||0,catalogConfidence);return out;
  }
  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function addList(input,id,items){let d=document.getElementById(id);if(!d){d=document.createElement('datalist');d.id=id;document.body.appendChild(d)}d.innerHTML=items.map(x=>`<option value="${html(x)}"></option>`).join('');input.setAttribute('list',id);input.setAttribute('autocomplete','off')}
  function announce(form,type,brand,row){
    let box=form.querySelector('.fw-gear-match');if(!box){box=document.createElement('div');box.className='fw-gear-match';form.querySelector('#saveManualGear')?.before(box)}
    const specs=type==='rod'?[['Length',row[1]],['Power',row[2]],['Action',row[3]]]:type==='reel'?[['Type',row[1]],['Gear ratio',row[2]]]:[['Category',row[1]],['Size / weight',row[2]],['Suggested color',row[3]]];
    box.innerHTML=`<span class="fw-match-check" aria-hidden="true">✓</span><div><b>${html(brand)} ${html(row[0])}</b><div class="fw-match-specs">${specs.filter(x=>x[1]).map(x=>`<span><small>${html(x[0])}</small>${html(x[1])}</span>`).join('')}</div><p>Known catalog match. Specifications were filled in and can still be changed.</p></div>`;
  }
  function fill(type,form,brand,row){const v=values(form);if(type==='rod'){v[2].value=row[1]||'';v[3].value=row[2]||'';v[4].value=row[3]||''}else if(type==='reel'){v[2].value=row[1]||'';if(row[2])v[2].dataset.gearRatio=row[2]}else{v[0].value=row[1]||v[0].value;v[3].value=row[2]||'';v[4].value=row[3]||''}announce(form,type,brand,row)}
  function picker(input,getItems,onPick){
    const label=input.closest('label');label.classList.add('fw-picker');input.setAttribute('autocomplete','off');input.removeAttribute('list');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
    const panel=document.createElement('div');panel.className='fw-suggestions';panel.setAttribute('role','listbox');panel.hidden=true;label.appendChild(panel);let active=-1,items=[];
    const close=()=>{panel.hidden=true;input.setAttribute('aria-expanded','false');active=-1};
    const paint=()=>{items=getItems(input.value).slice(0,10);active=-1;if(!items.length){close();return}panel.innerHTML=items.map((x,i)=>`<button type="button" role="option" data-pick="${i}" class="${x.custom?'fw-suggestion-custom':''}"><b>${html(x.label)}</b>${x.sub?`<small>${html(x.sub)}</small>`:''}</button>`).join('');panel.hidden=false;input.setAttribute('aria-expanded','true')};
    const choose=i=>{const x=items[i];if(!x)return;input.value=x.value;close();onPick(x);input.dispatchEvent(new Event('change',{bubbles:true}))};
    input.addEventListener('focus',paint);input.addEventListener('input',paint);input.addEventListener('keydown',e=>{if(panel.hidden&&e.key==='ArrowDown'){paint();return}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1)));panel.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===active));panel.querySelector(`[data-pick="${active}"]`)?.scrollIntoView({block:'nearest'})}else if(e.key==='Enter'&&!panel.hidden&&active>=0){e.preventDefault();choose(active)}else if(e.key==='Escape')close()});
    panel.addEventListener('mousedown',e=>e.preventDefault());panel.addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b)choose(Number(b.dataset.pick))});input.addEventListener('blur',()=>setTimeout(close,120));return{paint,close};
  }
  function addStyles(){if(document.getElementById('fwGearCatalogStyles'))return;const s=document.createElement('style');s.id='fwGearCatalogStyles';s.textContent=`.fw-catalog-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0}.fw-catalog-count{white-space:nowrap}.fw-quick-brands{display:flex;gap:7px;overflow-x:auto;padding:0 0 9px;scrollbar-width:none}.fw-quick-brands::-webkit-scrollbar{display:none}.fw-quick-brands button{flex:0 0 auto;min-height:37px;padding:7px 11px;border-radius:999px;border:1px solid rgba(216,187,114,.28);background:rgba(216,187,114,.08);color:#f7e7ba;font-size:12px}.fw-quick-brands button.active{background:#d8bb72;color:#102018}.fw-picker{position:relative}.fw-picker input{padding-right:38px}.fw-picker:after{content:'⌄';position:absolute;right:14px;bottom:13px;color:#d8bb72;pointer-events:none}.fw-suggestions{position:absolute;z-index:2400;top:calc(100% - 3px);left:0;right:0;max-height:min(330px,45dvh);overflow:auto;padding:6px;background:#10251e;border:1px solid rgba(216,187,114,.45);border-radius:12px;box-shadow:0 18px 45px rgba(0,0,0,.45)}.fw-suggestions button{display:flex;width:100%;min-height:50px;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;padding:9px 11px;border:0;border-radius:9px;background:transparent;color:#fff}.fw-suggestions button+button{border-top:1px solid rgba(255,255,255,.07)}.fw-suggestions button:hover,.fw-suggestions button.active{background:rgba(216,187,114,.16)}.fw-suggestions small{color:rgba(255,255,255,.65);font-size:11px;margin-top:3px}.fw-suggestion-custom{color:#f7d98c!important}.fw-gear-match{display:grid;grid-template-columns:auto 1fr;gap:10px;margin:14px 0;padding:13px;border:1px solid rgba(143,191,163,.32);border-radius:12px;background:rgba(143,191,163,.09)}.fw-match-check{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#d7b86a;color:#182016;font-weight:900}.fw-match-specs{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.fw-match-specs span{display:flex;flex-direction:column;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.22);font-size:12px}.fw-match-specs small{color:rgba(255,255,255,.6);font-size:9px;text-transform:uppercase}.fw-gear-match p{margin:8px 0 0;color:rgba(255,255,255,.68);font-size:11px}.fw-required-note{margin:-2px 0 10px}.fw-field-error{outline:2px solid #e16b6b!important;outline-offset:1px}@media(max-width:600px){.fw-suggestions{position:fixed;left:10px;right:10px;top:auto;bottom:calc(10px + env(safe-area-inset-bottom));max-height:48dvh}.fw-suggestions button{min-height:56px}.fw-catalog-head{align-items:flex-start;flex-direction:column}}`;document.head.appendChild(s)}
  function enhance(form){
    if(form.dataset.catalogReady)return;form.dataset.catalogReady='1';const type=typeFromForm(form),v=values(form),brand=type==='tackle'?v[1]:v[0],model=type==='tackle'?v[2]:v[1];if(!brand||!model)return;
    brand.required=true;model.required=true;brand.setAttribute('aria-required','true');model.setAttribute('aria-required','true');
    brand.placeholder='Start typing — example: St.';model.placeholder='Select the exact model / configuration';
    const head=document.createElement('div');head.className='fw-catalog-head';head.innerHTML=`<span class="tiny muted">Search the catalog or enter anything manually.</span><span class="pill fw-catalog-count">${BRAND_GROUPS[type].length} brands</span>`;brand.closest('label').before(head);
    const quick=document.createElement('div');quick.className='fw-quick-brands';quick.setAttribute('aria-label','Popular brands');quick.innerHTML=POPULAR[type].map(x=>`<button type="button" data-quick-brand="${html(x)}">${html(x)}</button>`).join('');brand.closest('label').before(quick);
    let currentBrand=null;
    const updateBrand=()=>{const exact=exactBrand(type,brand.value);if(exact){brand.value=exact;currentBrand=exact}else currentBrand=null;quick.querySelectorAll('button').forEach(b=>b.classList.toggle('active',norm(b.dataset.quickBrand)===norm(currentBrand)));const rows=currentBrand?(CATALOG[type][currentBrand]||[]):[];model.placeholder=rows.length?`Search ${rows.length} known ${currentBrand} configurations`:'Type the model / product name';if(!rows.length)form.querySelector('.fw-gear-match')?.remove()};
    const brandItems=q=>{const found=choices(type,q).map(x=>({label:x,sub:CATALOG[type][x]?.length?`${CATALOG[type][x].length} known configurations`:'Manual model entry supported',value:x}));const typed=String(q||'').trim();if(typed&&!exactBrand(type,typed))found.push({label:`Use “${typed}”`,sub:'Save this brand exactly as typed',value:typed,custom:true});return found};
    const modelItems=q=>{const rows=CATALOG[type][currentBrand]||[],n=norm(q),found=rows.filter(x=>!n||score(modelLabel(type,x),n)).sort((a,b)=>score(modelLabel(type,b),n)-score(modelLabel(type,a),n)).map(x=>({label:x[0],sub:modelLabel(type,x).split(' — ')[1],value:modelLabel(type,x),row:x}));const typed=String(q||'').trim();if(typed&&!rows.some(x=>norm(x[0])===norm(typed)))found.push({label:`Use “${typed}”`,sub:'Keep this model exactly as typed',value:typed,custom:true});return found};
    picker(brand,brandItems,x=>{currentBrand=x.value;model.value='';form.querySelector('.fw-gear-match')?.remove();updateBrand();model.focus()});
    picker(model,modelItems,x=>{if(x.row){model.value=x.row[0];fill(type,form,currentBrand,x.row)}else form.querySelector('.fw-gear-match')?.remove()});
    quick.addEventListener('click',e=>{const b=e.target.closest('[data-quick-brand]');if(!b)return;brand.value=b.dataset.quickBrand;currentBrand=b.dataset.quickBrand;model.value='';form.querySelector('.fw-gear-match')?.remove();updateBrand();model.focus()});
    brand.addEventListener('input',()=>{const alias=exactBrand(type,brand.value);if(alias&&aliases[norm(brand.value)]){brand.value=alias;currentBrand=alias;updateBrand()}});brand.addEventListener('change',updateBrand);brand.addEventListener('blur',updateBrand);updateBrand();
    if(type==='rod'){addList(v[2],'fw-rod-lengths',["5'6\"","6'0\"","6'6\"","6'8\"","6'10\"","7'0\"","7'1\"","7'2\"","7'3\"","7'4\"","7'6\"","8'0\""]);addList(v[3],'fw-rod-powers',['Ultra Light','Light','Medium Light','Medium','Medium Heavy','Heavy','Extra Heavy']);addList(v[4],'fw-rod-actions',['Slow','Moderate','Moderate Fast','Fast','Extra Fast'])}
    if(type==='reel'){addList(v[2],'fw-reel-types',['Spinning','Baitcasting','Spincast','Conventional','Fly']);addList(v[3],'fw-line-types',['Braid','Fluorocarbon','Monofilament','Copolymer']);addList(v[4],'fw-line-tests',['4 lb','6 lb','8 lb','10 lb','12 lb','14 lb','15 lb','17 lb','20 lb','30 lb','40 lb','50 lb','65 lb'])}
    if(type==='tackle'){addList(v[3],'fw-lure-sizes',['1/16 oz','1/10 oz','1/8 oz','3/16 oz','1/4 oz','3/8 oz','1/2 oz','3/4 oz','1 oz','2 in','2.75 in','3 in','3.5 in','3.75 in','4 in','5 in','6 in']);addList(v[4],'fw-lure-colors',['Green Pumpkin','Black/Blue','Chartreuse/White','White','Pearl','Bluegill','Sexy Shad','Firetiger','Perch','Crawfish','Bone','Silver','Gold'])}
    const save=form.querySelector('#saveManualGear'),original=save?.onclick;if(save&&original){save.onclick=async e=>{brand.classList.remove('fw-field-error');model.classList.remove('fw-field-error');if(!brand.value.trim()||!model.value.trim()){e?.preventDefault?.();if(!brand.value.trim())brand.classList.add('fw-field-error');if(!model.value.trim())model.classList.add('fw-field-error');(brand.value.trim()?model:brand).focus();window.stat?.('Brand and model are required.','err');return}remember(type,brand.value.trim(),model.value.trim());return original.call(save,e)}}
    const used=(recent()[type]||[]).filter(x=>x.brand&&x.model).slice(0,3);if(used.length){const rec=document.createElement('div');rec.className='fw-quick-brands';rec.setAttribute('aria-label','Recently entered gear');rec.innerHTML=used.map(x=>`<button type="button" data-recent-brand="${html(x.brand)}" data-recent-model="${html(x.model)}">Recent: ${html(x.brand)} ${html(x.model)}</button>`).join('');head.after(rec);rec.addEventListener('click',e=>{const b=e.target.closest('[data-recent-brand]');if(!b)return;brand.value=b.dataset.recentBrand;model.value=b.dataset.recentModel;updateBrand()})}
  }
  function scan(){const f=document.getElementById('manualGearForm');if(f)enhance(f)}
  const mo=new MutationObserver(scan);function boot(){addStyles();mo.observe(document.body,{childList:true,subtree:true});document.addEventListener('click',e=>{if(e.target.closest('#manualRod,#manualReel,#manualTackle'))setTimeout(scan,0)});scan();window.fishwizzGearCatalog={brands:BRAND_GROUPS,catalog:CATALOG,enhance,resolveRecognition,version:4}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();