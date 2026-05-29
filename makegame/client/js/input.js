// Keyboard + mouse input. World-relative WASD movement, face-the-cursor aiming,
// click / Tab targeting, number keys cast skillbar slots.
import { state, self } from "./state.js";

let canvasEl = null;
let act = {};

export function initInput(canvas, actions) {
  canvasEl = canvas;
  act = actions;

  addEventListener("keydown", (e) => {
    if (isTyping()) return;
    state.keys.add(e.code);
    if (e.code === "Tab") { e.preventDefault(); act.targetNearest && act.targetNearest(); }
    else if (e.code === "KeyI" || e.code === "KeyC") { act.toggleInventory && act.toggleInventory(); }
    else if (e.code === "Escape") { if (state.invOpen) act.toggleInventory && act.toggleInventory(); else act.clearTarget && act.clearTarget(); }
    else if (e.code === "KeyV") { act.toggleView && act.toggleView(); }
    else if (/^Digit[1-9]$/.test(e.code)) {
      const slot = +e.code.slice(5) - 1;
      act.cast && act.cast(slot);
    }
  });
  addEventListener("keyup", (e) => state.keys.delete(e.code));
  addEventListener("blur", () => state.keys.clear());

  // listen on window so input works regardless of which canvas (2D/3D) is shown
  addEventListener("mousemove", (e) => { state.mouse.x = e.clientX; state.mouse.y = e.clientY; });
  addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.tagName !== "CANVAS") return;   // ignore HUD clicks
    const w = screenToWorld(state.mouse.x, state.mouse.y);
    const hit = pickEntity(w.x, w.z);
    if (hit) act.setTarget && act.setTarget(hit.id);
    else act.clearTarget && act.clearTarget();
  });
  addEventListener("contextmenu", (e) => { if (e.target.tagName === "CANVAS") e.preventDefault(); });
}

export function sampleMovement() {
  let mx = 0, mz = 0;
  const k = state.keys;
  if (k.has("KeyW") || k.has("ArrowUp")) mz -= 1;
  if (k.has("KeyS") || k.has("ArrowDown")) mz += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) mx -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) mx += 1;

  // face the cursor (rot convention matches server: x=sin(rot), z=cos(rot))
  let rot = 0;
  const s = self();
  if (s) {
    const w = screenToWorld(state.mouse.x, state.mouse.y);
    rot = Math.atan2(w.x - s.rx, w.z - s.rz);
  }
  return { mx, mz, rot };
}

function screenToWorld(sx, sy) {
  if (state.view3d && state.r3dGround) return state.r3dGround(sx, sy);   // perspective raycast
  const cw = window.innerWidth, ch = window.innerHeight;
  return {
    x: state.cam.x + (sx - cw / 2) / state.scale,
    z: state.cam.z + (sy - ch / 2) / state.scale,
  };
}

function pickEntity(wx, wz) {
  let best = null, bestD = Infinity;
  for (const e of state.entities.values()) {
    if (e.id === state.selfId || e.dead) continue;
    const d = Math.hypot((e.rx ?? e.x) - wx, (e.rz ?? e.z) - wz);
    const reach = (e.sz || 1) * 0.6 + 0.6;
    if (d <= reach && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}
