// Orchestrator: start screen -> connect -> message handling -> main loop
// (client-side prediction for self, interpolation for others) -> render + UI.
import { state, self, pushLog } from "./state.js";
import * as net from "./net.js";
import { initInput, sampleMovement } from "./input.js";
import { render } from "./render.js";
import { initUI, updateUI } from "./ui.js";
import { initInventory, toggleInventory, renderInventory } from "./inventory.js";
import { C2S, S2C, EVENT } from "/shared/protocol.js";
import { CLIENT_INPUT_HZ, ENT, FACTION } from "/shared/constants.js";
import { SKILLS } from "/server/data/skills.js";
import { ensureAudio, playSfx } from "./assets.js";

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const canvas3d = document.getElementById("view3d");
let started = false;
let r3d = null, r3dFailed = false;

async function ensure3d() {
  if (r3d || r3dFailed) return;
  r3dFailed = true;                 // guard against concurrent imports; reset on success
  try { const mod = await import("./render3d.js"); mod.init3d(canvas3d); r3d = mod; r3dFailed = false; }
  catch (e) { state.view3d = false; pushLog("3D 로드 실패 → 2D 폴백: " + e.message, "sys"); }
}

// ---- start screen ----
function bindStart() {
  document.querySelectorAll("#class-picker button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#class-picker button").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); state.cls = +b.dataset.cls;
    }));
  document.querySelectorAll("#faction-picker button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#faction-picker button").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); state.faction = +b.dataset.fac;
    }));
  document.getElementById("play").addEventListener("click", joinGame);
}

function joinGame() {
  const name = (document.getElementById("in-name").value || "Hero").trim().slice(0, 16);
  state.name = name;
  ensureAudio();   // play-button click is a valid user gesture for WebAudio
  document.getElementById("conn-status").textContent = "연결 중...";
  net.connect(`ws://${location.host}`, {
    onOpen: () => net.send({ t: C2S.HELLO, name, class: state.cls, faction: state.faction }),
    onMessage: handleMessage,
    onClose: () => { document.getElementById("conn-status").textContent = "연결 끊김 — 서버(node server/server.js)가 떠 있는지 확인"; },
  });
}

// ---- message handling ----
function handleMessage(msg) {
  switch (msg.t) {
    case S2C.CONNECT: {
      state.selfId = msg.selfId; state.tickRate = msg.tickRate;
      state.world = msg.world; state.cls = msg.cls; state.faction = msg.faction;
      state.skillbar = msg.skillbar || []; state.speed = msg.speed || 7; state.name = msg.name;
      document.getElementById("start").classList.add("hidden");
      state.snapCam = true;
      initUI();
      if (!started) { started = true; requestAnimationFrame(loop); }
      break;
    }
    case S2C.CHANGE_WORLD:
      state.world = msg.world; state.entities.clear(); state.casts.clear();
      state.fx.length = 0; state.target = 0; state.snapCam = true;
      pushLog(`이동: ${msg.world.name}`, "sys");
      break;
    case S2C.MAP_UPDATE: state.props = msg.props || []; break;
    case S2C.INVENTORY:
      state.equipment = msg.equipment || {}; state.inventory = msg.inventory || []; state.stats = msg.stats || {};
      renderInventory();
      break;
    case S2C.ENTITY_DELTA: applySnapshot(msg.entities || []); handleEvents(msg.events || []); break;
    case S2C.SYSTEM: pushLog(msg.text, "sys"); break;
    case S2C.CHAT: pushLog(`${msg.from}: ${msg.text}`); break;
  }
}

function applySnapshot(ents) {
  const seen = new Set();
  for (const se of ents) {
    seen.add(se.id);
    let e = state.entities.get(se.id);
    if (!e) { e = { rx: se.x, rz: se.z, rrot: se.rot }; state.entities.set(se.id, e); }
    Object.assign(e, se);          // authoritative x/z/rot + vitals
    if (e.rx === undefined) { e.rx = e.x; e.rz = e.z; e.rrot = e.rot; }
  }
  for (const id of [...state.entities.keys()]) if (!seen.has(id)) state.entities.delete(id);
}

function handleEvents(events) {
  const now = Date.now();
  for (const ev of events) {
    switch (ev.type) {
      case EVENT.DAMAGE: {
        const e = state.entities.get(ev.target);
        if (e) floatText(e, (ev.crit ? "✸" : "") + "-" + ev.amount, ev.crit ? "#ffd84a" : "#ff7a6a");
        if (ev.by === state.selfId || ev.target === state.selfId) playSfx(ev.crit ? "crit" : "hit");
        break;
      }
      case EVENT.HEAL: {
        const e = state.entities.get(ev.target);
        if (e) floatText(e, "+" + ev.amount, "#8fe07a");
        if (ev.by === state.selfId || ev.target === state.selfId) playSfx("heal");
        break;
      }
      case EVENT.CAST:
        state.casts.set(ev.id, { start: now, end: ev.castEnd, skill: ev.skill });
        if (ev.id === state.selfId) playSfx("cast");
        break;
      case EVENT.CAST_DONE: state.casts.delete(ev.id); break;
      case EVENT.DEATH: {
        state.casts.delete(ev.id);
        if (ev.by === state.selfId && ev.id !== state.selfId) { pushLog("처치!", "dmg"); playSfx("death"); }
        if (ev.id === state.selfId) { pushLog("사망 — 잠시 후 부활", "dmg"); playSfx("death"); }
        break;
      }
      case EVENT.LEVELUP:
        if (ev.id === state.selfId) { pushLog(`레벨 ${ev.level} 달성!`, "lvl"); playSfx("levelup"); const s = self(); if (s) floatText(s, "LEVEL UP", "#9be37a"); }
        break;
      case EVENT.LOOT:
        if (ev.to === state.selfId) pushLog(`전리품 획득: ${ev.item.name}`, "lvl");
        break;
    }
  }
}

function floatText(e, text, color) {
  state.fx.push({ x: e.rx ?? e.x, z: e.rz ?? e.z, text, color, t: Date.now(), life: 1000 });
  if (state.fx.length > 80) state.fx.shift();
}

// ---- actions (from input) ----
const actions = {
  cast(slot) {
    const id = state.skillbar[slot];
    if (!id) return;
    const def = SKILLS[id]; const now = Date.now();
    if ((state.cooldowns[id] || 0) > now) return;
    if (def && def.target === "enemy" && !state.target) { pushLog("대상이 필요합니다.", "sys"); return; }
    const s = self(); if (def && s && s.mp < def.mana) { pushLog("마나가 부족합니다.", "sys"); return; }
    net.send({ t: C2S.SKILL, id });
    if (def && def.cast === 0 && def.projectile) playSfx("shoot");
    if (def && def.cd > 0) state.cooldowns[id] = now + def.cd * 1000;
  },
  targetNearest() {
    const s = self(); if (!s) return;
    let best = null, bestD = 45;
    for (const e of state.entities.values()) {
      if (e.id === state.selfId || e.dead || !hostile(s, e)) continue;
      const d = Math.hypot((e.rx ?? e.x) - s.rx, (e.rz ?? e.z) - s.rz);
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) actions.setTarget(best.id);
  },
  setTarget(id) { state.target = id; net.send({ t: C2S.CHANGE_TARGET, target: id }); },
  clearTarget() { state.target = 0; net.send({ t: C2S.CHANGE_TARGET, target: 0 }); },
  equip(uid) { net.send({ t: C2S.EQUIP, uid }); },
  unequip(slot) { net.send({ t: C2S.UNEQUIP, slot }); },
  toggleInventory() { toggleInventory(); },
  toggleView() { state.view3d = !state.view3d; pushLog(state.view3d ? "3D 뷰" : "2D 뷰", "sys"); },
};

function hostile(a, b) {
  if (b.ty === ENT.MONSTER) return true;
  return b.ty === ENT.PLAYER && b.fa !== a.fa && b.fa !== FACTION.NEUTRAL;
}

// ---- main loop ----
let lastFrame = Date.now();
let lastInput = 0;

function loop() {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  const s = self();
  if (s) {
    // self prediction
    const mv = sampleMovement();
    if (!s.dead) {
      let mx = mv.mx, mz = mv.mz; const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        s.rx += mx * state.speed * dt;
        s.rz += mz * state.speed * dt;
        s.rx = Math.max(1, Math.min(state.world.w - 1, s.rx));
        s.rz = Math.max(1, Math.min(state.world.h - 1, s.rz));
      }
      s.rrot = mv.rot;
    }
    // reconcile toward authoritative
    const drift = Math.hypot(s.x - s.rx, s.z - s.rz);
    if (drift > 2.5 || s.dead || state.snapCam) { s.rx = s.x; s.rz = s.z; }
    else { const k = Math.min(1, dt * 4); s.rx += (s.x - s.rx) * k; s.rz += (s.z - s.rz) * k; }

    // camera follow (snap on connect / zone change)
    if (state.snapCam) { state.cam.x = s.rx; state.cam.z = s.rz; state.snapCam = false; }
    else {
      state.cam.x += (s.rx - state.cam.x) * Math.min(1, dt * 6);
      state.cam.z += (s.rz - state.cam.z) * Math.min(1, dt * 6);
    }

    // send input
    if (now - lastInput >= 1000 / CLIENT_INPUT_HZ) {
      lastInput = now;
      net.send({ t: C2S.INPUT, mx: mv.mx, mz: mv.mz, rot: mv.rot, seq: ++state.seq });
    }
  }

  // interpolate others
  for (const e of state.entities.values()) {
    if (e.id === state.selfId) continue;
    const k = Math.min(1, dt * 12);
    e.rx = (e.rx ?? e.x) + (e.x - (e.rx ?? e.x)) * k;
    e.rz = (e.rz ?? e.z) + (e.z - (e.rz ?? e.z)) * k;
    e.rrot = lerpAngle(e.rrot ?? e.rot, e.rot, k);
  }

  // prune fx
  for (let i = state.fx.length - 1; i >= 0; i--) if (now - state.fx[i].t > state.fx[i].life) state.fx.splice(i, 1);

  // pick renderer (3D default, 2D fallback). Lazy-load three on first need.
  if (state.view3d && !r3d && !r3dFailed) ensure3d();
  const use3d = state.view3d && r3d;
  canvas3d.classList.toggle("hidden", !use3d);
  canvas.classList.toggle("hidden", use3d);
  if (use3d) r3d.render3d(canvas3d, now);
  else render(ctx, canvas, now);
  updateUI(now);
  requestAnimationFrame(loop);
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// boot
initInput(canvas, actions);
initInventory(actions);
bindStart();

// debug hook (inspect from devtools / CDP): window.__mg.state, .actions
if (typeof window !== "undefined") window.__mg = { state, actions, net };
