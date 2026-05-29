// Headless zone-transition check: spawn in the starter zone, walk straight up
// the clear central corridor to the portal, and verify serverChangeWorld moves
// us to "forest" (Darkwood) with that zone's entities.
import { WebSocket } from "ws";
import { C2S, S2C } from "./shared/protocol.js";
import { ENT } from "./shared/constants.js";

const ws = new WebSocket(process.env.URL || "ws://localhost:8787");
let selfId = 0, startZone = "", changed = null, forestEnts = 0;
const ents = new Map();

ws.on("open", () => ws.send(JSON.stringify({ t: C2S.HELLO, name: "Zoner", class: 2, faction: 0 })));
ws.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.t === S2C.CONNECT) { selfId = m.selfId; startZone = m.world.id; }
  else if (m.t === S2C.CHANGE_WORLD) { changed = m.world; }
  else if (m.t === S2C.ENTITY_DELTA) {
    for (const e of m.entities) ents.set(e.id, e);
    if (changed) { forestEnts = [...ents.values()].filter((e) => e.ty === ENT.MONSTER).length; }
  }
});

// keep walking up (-z); rot facing up
const iv = setInterval(() => {
  if (!selfId) return;
  ws.send(JSON.stringify({ t: C2S.INPUT, mx: 0, mz: -1, rot: Math.PI, seq: Date.now() }));
}, 100);

setTimeout(() => {
  clearInterval(iv); ws.close();
  const pass = startZone === "starter" && changed && changed.id === "forest";
  console.log(JSON.stringify({ startZone, changedTo: changed && changed.id, changedName: changed && changed.name, forestMonsters: forestEnts }, null, 2));
  console.log(pass ? "ZONE TEST PASS" : "ZONE TEST FAIL");
  process.exit(pass ? 0 : 1);
}, 24000);

ws.on("error", (e) => { console.log("WS ERROR", e.message); process.exit(2); });
