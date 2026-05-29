// Headless end-to-end check.
//  A) combat: walk to nearest monster, target, Swift Shot, verify damage/kills.
//  B) items: unequip starter weapon -> power drops; re-equip -> power restored
//     (deterministic check that gear affects derived stats).
import { WebSocket } from "ws";
import { C2S, S2C, EVENT } from "./shared/protocol.js";
import { ENT } from "./shared/constants.js";

const URL = process.env.URL || "ws://localhost:8787";
const ws = new WebSocket(URL);

let selfId = 0, skillbar = [];
const ents = new Map();
let dmgByMe = 0, kills = 0, gotConnect = false, sawMonster = false, looted = 0;
let mobId = 0, mobStartHp = null, mobNowHp = null;

// item test state machine
let inv = null, eqPhase = 0, powerWith = 0, powerWithout = 0, powerReeq = 0, weaponUid = 0;

ws.on("open", () => ws.send(JSON.stringify({ t: C2S.HELLO, name: "Smoke", class: 2, faction: 0 })));

ws.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.t === S2C.CONNECT) { gotConnect = true; selfId = m.selfId; skillbar = m.skillbar; }
  else if (m.t === S2C.INVENTORY) {
    inv = m;
    if (eqPhase === 0 && m.equipment.weapon) { powerWith = m.stats.power; ws.send(JSON.stringify({ t: C2S.UNEQUIP, slot: "weapon" })); eqPhase = 1; }
    else if (eqPhase === 1 && !m.equipment.weapon) { powerWithout = m.stats.power; const w = m.inventory.find((i) => i.slot === "weapon"); if (w) { weaponUid = w.uid; ws.send(JSON.stringify({ t: C2S.EQUIP, uid: w.uid })); eqPhase = 2; } }
    else if (eqPhase === 2 && m.equipment.weapon) { powerReeq = m.stats.power; eqPhase = 3; }
  } else if (m.t === S2C.ENTITY_DELTA) {
    for (const e of m.entities) ents.set(e.id, e);
    for (const ev of m.events || []) {
      if (ev.type === EVENT.DAMAGE && ev.by === selfId) dmgByMe += ev.amount;
      if (ev.type === EVENT.DEATH && ev.by === selfId) kills++;
      if (ev.type === EVENT.LOOT && ev.to === selfId) looted++;
    }
    if (mobId) { const mob = ents.get(mobId); if (mob) mobNowHp = mob.hp; }
  }
});

const iv = setInterval(() => {
  const me = ents.get(selfId);
  if (!me) return;
  if (eqPhase < 3) return;                 // finish item test before fighting (weapon must be on)
  if (!mobId) {
    let best = null, bd = 1e9;
    for (const e of ents.values()) { if (e.ty !== ENT.MONSTER || e.dead) continue; const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < bd) { best = e; bd = d; } }
    if (best) { mobId = best.id; mobStartHp = best.hp; sawMonster = true; ws.send(JSON.stringify({ t: C2S.CHANGE_TARGET, target: mobId })); }
  }
  const mob = mobId ? ents.get(mobId) : null;
  if (mob && !mob.dead) {
    const dx = mob.x - me.x, dz = mob.z - me.z, d = Math.hypot(dx, dz);
    const mv = d > 14 ? { mx: dx / d, mz: dz / d } : { mx: 0, mz: 0 };
    ws.send(JSON.stringify({ t: C2S.INPUT, mx: mv.mx, mz: mv.mz, rot: Math.atan2(dx, dz), seq: Date.now() }));
    ws.send(JSON.stringify({ t: C2S.SKILL, id: skillbar[0] }));
  } else if (mob && mob.dead) mobId = 0;
}, 200);

setTimeout(() => {
  clearInterval(iv); ws.close();
  const equipWorks = powerWith > 0 && powerWithout > 0 && powerWithout < powerWith && powerReeq === powerWith;
  const pass = gotConnect && !!inv && sawMonster && dmgByMe > 0 && equipWorks;
  console.log(JSON.stringify({
    gotConnect, gotInventory: !!inv, sawMonster, damageDealtByMe: dmgByMe, kills, looted,
    item: { powerWith, powerWithout, powerReeq, equipWorks },
    mobStartHp, mobNowHp,
  }, null, 2));
  console.log(pass ? "SMOKE TEST PASS" : "SMOKE TEST FAIL");
  process.exit(pass ? 0 : 1);
}, 9000);

ws.on("error", (e) => { console.log("WS ERROR", e.message); process.exit(2); });
