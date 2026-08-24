(()=>{
  const $=id=>document.getElementById(id);
  const originalShow=window.showPage;
  const defaults={
    mission:['Ready to build your next Mission.',''],
    waters:['Search, use your location, or tap the map to choose a fishing spot.',''],
    arsenal:['Add or manage rods, reels, and complete setups.',''],
    tackle:['Search and manage your tackle box.',''],
    howto:['Choose a guide or search knots and rigs.',''],
    catches:['Record a catch or review your recent fishing history.',''],
    account:['Manage your FishWizz account and fishing profile.','']
  };

  if(typeof originalShow==='function'){
    window.showPage=function(id){
      originalShow(id);
      const next=defaults[id]||['FishWizz is ready.',''];
      const status=$('status');
      if(status){
        status.textContent=next[0];
        status.className='status '+next[1];
      }
      document.dispatchEvent(new CustomEvent('fishwizz:page-changed',{detail:{page:id}}));
    };
  }

  window.fishwizzProductionHardening={version:1};
})();
