(function(root){
 'use strict';
 const stations=[
  {id:'seaside',name:'うみべの むじんえき',side:'assets/seaside-station.svg',top:'assets/seaside-station-top.svg'},
  {id:'kareigawa',name:'かれいがわえき',side:'assets/station-kareigawa.svg',top:'assets/station-kareigawa-top.svg'},
  {id:'kirishima',name:'きりしまじんぐうえき',side:'assets/station-kirishima.svg',top:'assets/station-kirishima-top.svg'},
  {id:'subway',name:'ちかてつの えき',side:'assets/station-subway.svg',top:'assets/station-subway-top.svg'},
  {id:'night',name:'ほしぞらの まち',side:'assets/station-night.svg',top:'assets/station-night-top.svg'},
  {id:'kaimon',name:'かいもんだけの みえる えき',side:'assets/station-kaimon.svg',top:'assets/station-kaimon-top.svg'},
  {id:'senganen',name:'せんがんえんえき',side:'assets/station-senganen.svg',top:'assets/station-senganen-top.svg'}
 ];
 function forCount(count){return stations[Math.floor(Math.max(0,Number(count)||0)/5)%stations.length];}
 function byId(id){return stations.find(station=>station.id===id)||stations[0];}
 root.MonjiStations={stations,forCount,byId};
 if(typeof module!=='undefined')module.exports=root.MonjiStations;
})(globalThis);
