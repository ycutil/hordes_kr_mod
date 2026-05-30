(function(){
  var rt = window.__HORDES_KR_RUNTIME__; var p = rt&&rt.player; var inv = p&&p.inventory; var slots = inv&&inv.slots;
  function entries(s){ if(!s) return []; if(s instanceof Map) return Array.from(s.entries()); if(Array.isArray(s)) return s.map((v,i)=>[i,v]); return Object.entries(s).map(([k,v])=>[Number(k),v]); }
  function mapToObj(m){ if(!(m instanceof Map)) return m; var o={}; m.forEach(function(v,k){ o[k]=v; }); return o; }
  function statMap(m){ var arr=[]; if(m instanceof Map){ m.forEach(function(v,k){ arr.push({id:k, type:v.type, qual:v.qual, value:v.value}); }); } return arr; }
  function logicStats(l){ if(!l) return null; var s=l.stats; var arr=[]; if(s instanceof Map){ s.forEach(function(v,k){ arr.push({id:k, min:v.min, max:v.max}); }); } return arr; }
  var out = [];
  entries(slots).filter(function(e){return e[1];}).forEach(function(e){
    var slot=e[0], it=e[1];
    out.push({
      slotIndex: slot,
      equipped: slot>=101 && slot<=111,
      dbid: String(it.dbid),
      type: it.type,
      tier: it.tier,
      upgrade: it.upgrade,
      quality: it.quality,
      gs: it.gs,
      bound: it.bound,
      stacks: it.stacks,
      currentRoll: it.currentRoll,
      rolls: it.rolls,
      stats: statMap(it.stats),
      logic: it.logic ? { level: it.logic.level, type: it.logic.type, tier: it.logic.tier, class: it.logic.class, id: it.logic.id, quality: it.logic.quality, baseStats: logicStats(it.logic) } : null
    });
  });
  out.sort(function(a,b){return a.slotIndex-b.slotIndex;});
  function safeStat(v){ if(v&&typeof v==='object'){ var o={}; for(var k in v){ var x=v[k]; if(x==null||typeof x!=='object') o[k]=x; } return o; } return v; }
  var ps = [];
  if(p.stats instanceof Map){ p.stats.forEach(function(v,k){ ps.push({id:k, v:safeStat(v)}); }); }
  else if(p.stats&&typeof p.stats==='object'){ for(var k in p.stats){ ps.push({id:k, v:safeStat(p.stats[k])}); } }
  return JSON.stringify({
    player: { name: p.name, id: p.id, level: p.level, class: p.class, faction: p.faction, prestige: p.prestige, prestigeRank: p.prestigeRank, elo: p.elo, eloRank: p.eloRank, clan: (p.clan&&typeof p.clan==='object'? (p.clan.name||p.clan.tag||'') : p.clan), exp: p.exp },
    playerStats: ps,
    inventorySize: inv && inv.size,
    items: out
  });
})()
