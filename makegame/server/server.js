// Authoritative game server: static file host + WebSocket sim.
// Run:  node server/server.js   (from the makegame/ dir)  -> http://localhost:8787
//
// Mirrors the real hordes architecture: clients send intent (move/cast/target),
// the server owns the world and broadcasts serverEntityDelta every tick.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import { WorldManager } from "./WorldManager.js";
import { tryCast, dist } from "./Combat.js";
import { C2S, S2C } from "../shared/protocol.js";
import { TICK_RATE, TICK_MS, ENT } from "../shared/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");        // makegame/
const PORT = process.env.PORT || 8787;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/favicon.ico") { res.writeHead(204); return res.end(); }
  if (urlPath === "/") urlPath = "/client/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server: httpServer });
const mgr = new WorldManager();
let tick = 0;

const worldInfo = (w) => ({ id: w.id, name: w.name, w: w.w, h: w.h });

wss.on("connection", (ws) => {
  ws.player = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const now = Date.now();

    if (msg.t === C2S.HELLO) {
      if (ws.player) return;
      const p = mgr.addPlayer({ name: msg.name, cls: msg.class, faction: msg.faction }, ws);
      ws.player = p;
      const w = mgr.worldOf(p);
      send(ws, {
        t: S2C.CONNECT, selfId: p.id, tickRate: TICK_RATE,
        world: worldInfo(w), name: p.name, cls: p.cls, faction: p.faction,
        skillbar: p.skillbar, speed: p.baseSpeed,
      });
      send(ws, { t: S2C.MAP_UPDATE, props: w.props });
      send(ws, invPayload(p)); p.invDirty = false;
      send(ws, { t: S2C.SYSTEM, text: `${p.name} entered ${w.name}.` });
      return;
    }

    const p = ws.player;
    if (!p) return;
    const world = mgr.worldOf(p);
    if (!world) return;

    switch (msg.t) {
      case C2S.INPUT:
        p.input.mx = clamp(+msg.mx || 0, -1, 1);
        p.input.mz = clamp(+msg.mz || 0, -1, 1);
        if (typeof msg.rot === "number") p.input.rot = msg.rot;
        p.input.seq = msg.seq | 0;
        break;
      case C2S.CHANGE_TARGET: {
        const t = world.get(msg.target | 0);
        p.target = t && !t.dead ? t.id : 0;
        break;
      }
      case C2S.SKILL:
        if (!p.dead) tryCast(world, p, String(msg.id), now, world.pending);
        break;
      case C2S.EQUIP:
        if (world.equip(p, msg.uid | 0)) { send(ws, invPayload(p)); p.invDirty = false; }
        break;
      case C2S.UNEQUIP:
        if (world.unequip(p, String(msg.slot))) { send(ws, invPayload(p)); p.invDirty = false; }
        break;
      case C2S.INTERACT:
        // (no interactables in this slice yet)
        break;
      case C2S.COMMAND:
        handleCommand(ws, p, String(msg.text || ""));
        break;
      case C2S.PING:
        send(ws, { t: S2C.PONG, time: msg.time });
        break;
    }
  });

  ws.on("close", () => { if (ws.player) mgr.remove(ws.player); });
  ws.on("error", () => {});
});

function handleCommand(ws, p, text) {
  if (text === "/where") send(ws, { t: S2C.SYSTEM, text: `pos ${p.x.toFixed(1)}, ${p.z.toFixed(1)} lv${p.level}` });
  else send(ws, { t: S2C.CHAT, from: p.name, channel: "say", text });
}

// ---- main loop ----
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  tick++;

  // advance every zone
  for (const w of mgr.worlds.values()) {
    w._ev = w.pending.splice(0, w.pending.length);
    w.update(dt, now, w._ev);
  }

  // portal transitions (after movement integration)
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN || !ws.player || ws.player.dead) continue;
    const p = ws.player;
    const w = mgr.worldOf(p);
    const portal = w && w.portalAt(p);
    if (portal) {
      const to = mgr.move(p, portal.to, portal.toX, portal.toZ);
      send(ws, { t: S2C.CHANGE_WORLD, world: worldInfo(to) });
      send(ws, { t: S2C.MAP_UPDATE, props: to.props });
      send(ws, invPayload(p)); p.invDirty = false;
      send(ws, { t: S2C.SYSTEM, text: `${to.name}(으)로 이동했습니다.` });
    }
  }

  // broadcast each player's own zone
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN || !ws.player) continue;
    const p = ws.player;
    const w = mgr.worldOf(p);
    if (!w) continue;
    const ents = w.snapshotFor(p);
    const evs = (w._ev || []).filter((e) => relevant(w, e, p));
    send(ws, { t: S2C.ENTITY_DELTA, tick, entities: ents, events: evs });
    if (p.invDirty) { send(ws, invPayload(p)); p.invDirty = false; }
  }
}, TICK_MS);

function invPayload(p) {
  return {
    t: S2C.INVENTORY,
    equipment: p.equipment,
    inventory: p.inventory,
    stats: {
      level: p.level, power: p.power, armor: p.armor,
      crit: Math.round(p.critChance * 1000) / 10, maxhp: p.maxhp, maxmp: p.maxmp,
      speed: Math.round(p.baseSpeed * 10) / 10,
    },
  };
}

function relevant(world, e, p) {
  // keep events about entities the player can see (cheap range gate)
  const id = e.id ?? e.target ?? e.by;
  const ent = world.get(id);
  if (!ent) return true;
  return dist(ent, p) <= 70;
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

httpServer.listen(PORT, () => {
  console.log(`[makegame] http+ws on http://localhost:${PORT}  (tick ${TICK_RATE}Hz)`);
});
