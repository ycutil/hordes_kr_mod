// 3D renderer (Three.js, vendored locally). Top-down-ish perspective camera
// following the player. Entities are simple lit meshes; nameplate+HP are
// camera-facing sprites. The 2D canvas renderer (render.js) remains as a
// fallback toggled with V. Uses its own <canvas id="view3d"> (a canvas can hold
// only one context type, so 2D and 3D need separate canvases).
import * as THREE from "/client/vendor/three.module.js";
import { state, self } from "./state.js";
import { ENT, FACTION } from "/shared/constants.js";

let renderer, scene, camera, ground, propGroup, fxGroup, ringSelf, ringTarget;
const meshes = new Map();      // entityId -> THREE.Group
let ready = false, worldKey = "", canvasEl = null;
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function init3d(canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d14);
  scene.fog = new THREE.Fog(0x0a0d14, 42, 95);

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xbcd2f0, 0x141a24, 1.0));
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.75); sun.position.set(40, 70, 25); scene.add(sun);

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x24351f })
  );
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  propGroup = new THREE.Group(); scene.add(propGroup);
  fxGroup = new THREE.Group(); scene.add(fxGroup);

  ringSelf = ringMesh(0xffffff); ringTarget = ringMesh(0xffd56b);
  ringSelf.visible = ringTarget.visible = false;
  scene.add(ringSelf); scene.add(ringTarget);

  state.r3dGround = screenToGround;     // let input.js aim via raycast
  ready = true;
}

export function render3d(canvas, now) {
  if (!ready) return;
  resize(canvas);
  buildWorld();
  syncEntities(now);
  syncFx(now);

  const s = self();
  if (s) {
    const x = s.rx ?? s.x, z = s.rz ?? s.z;
    camera.position.set(x, 21, z + 15);
    camera.lookAt(x, 1, z);
  }
  renderer.render(scene, camera);
}

function buildWorld() {
  const key = `${state.world.w}x${state.world.h}:${state.props.length}`;
  if (key === worldKey) return;
  worldKey = key;
  const big = Math.max(state.world.w, state.world.h) + 220;
  ground.geometry.dispose();
  ground.geometry = new THREE.PlaneGeometry(big, big);
  ground.position.set(state.world.w / 2, 0, state.world.h / 2);

  while (propGroup.children.length) { const c = propGroup.children.pop(); c.geometry?.dispose(); }
  for (const p of state.props) propGroup.add(propMesh(p));
}

function propMesh(p) {
  let m;
  if (p.kind === "tree") {
    m = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 6), MAT(0x5a3d22)); trunk.position.y = 0.6;
    const top = new THREE.Mesh(new THREE.ConeGeometry(p.r * 1.4, 2.4, 8), MAT(0x356b3a)); top.position.y = 2.1;
    m.add(trunk, top);
  } else if (p.kind === "rock") {
    m = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r * 1.3, 0), MAT(0x5a606b, true)); m.position.y = p.r * 0.6;
  } else if (p.kind === "water") {
    m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 24), new THREE.MeshStandardMaterial({ color: 0x2f6aa0, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05;
  } else if (p.kind === "portal") {
    m = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.35, 10, 28), new THREE.MeshStandardMaterial({ color: 0xb18bff, emissive: 0x5b3fa0, emissiveIntensity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 1.0;
    const lbl = textSprite(p.label || "Portal", "#dcc9ff"); lbl.position.set(0, 3.2, 0); m.add(lbl);
  } else { // camp
    m = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.15, 8, 24), MAT(0xd2b478)); m.rotation.x = -Math.PI / 2; m.position.y = 0.1;
  }
  m.position.x = p.x; m.position.z = p.z;
  return m;
}

function syncEntities(now) {
  const seen = new Set();
  for (const e of state.entities.values()) {
    if (e.dead && e.ty === ENT.MONSTER) continue;
    seen.add(e.id);
    let g = meshes.get(e.id);
    if (!g) { g = entityMesh(e); meshes.set(e.id, g); scene.add(g); }
    g.position.set(e.rx ?? e.x, 0, e.rz ?? e.z);
    g.rotation.y = e.rrot ?? e.rot ?? 0;
    g.visible = !e.dead;
    if (g.userData.label?.userData.update) g.userData.label.userData.update(e);
  }
  for (const [id, g] of meshes) if (!seen.has(id)) { scene.remove(g); meshes.delete(id); }

  // selection rings
  place(ringSelf, state.entities.get(state.selfId));
  place(ringTarget, state.target ? state.entities.get(state.target) : null);
}

function place(ring, e) {
  if (e && !e.dead) { ring.visible = true; ring.position.set(e.rx ?? e.x, 0.06, e.rz ?? e.z); }
  else ring.visible = false;
}

function syncFx(now) {
  for (const f of state.fx) {
    if (!f._m) { f._m = textSprite(f.text, f.color); fxGroup.add(f._m); }
    const age = (now - f.t) / f.life;
    f._m.position.set(f.x, 2 + age * 2.2, f.z);
    f._m.material.opacity = Math.max(0, 1 - age);
  }
  // remove sprites for fx that game has pruned
  for (let i = fxGroup.children.length - 1; i >= 0; i--) {
    const spr = fxGroup.children[i];
    if (!state.fx.some((f) => f._m === spr)) { fxGroup.remove(spr); spr.material.map?.dispose(); spr.material.dispose(); }
  }
}

function entityMesh(e) {
  const g = new THREE.Group();
  if (e.ty === ENT.MONSTER) {
    const r = (e.sz || 1) * 0.7;
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), MAT(0x8a5a2b, true));
    body.position.y = r; g.add(body);
  } else {
    const col = colorFor(e);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 1.15, 14), MAT(col)); body.position.y = 0.75; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), MAT(0xf1e4c8)); head.position.y = 1.55; g.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), MAT(0xffffff)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.8, 0.5); g.add(nose);
  }
  const label = overheadSprite(); label.position.y = (e.ty === ENT.MONSTER ? (e.sz || 1) * 1.6 + 0.6 : 2.3); g.add(label);
  g.userData.label = label;
  return g;
}

function colorFor(e) {
  if (e.ty === ENT.MONSTER) return 0x8a5a2b;
  if (e.fa === FACTION.RED) return 0xc2453a;
  return [0xc8a23a, 0x5a8fe0, 0x46b06a, 0x9b6fe0][e.cl] ?? 0x5a8fe0;
}

// overhead nameplate + hp bar sprite (redrawn only when values change)
function overheadSprite() {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 80;
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(4.2, 1.3, 1);
  spr.userData.update = (e) => {
    const key = `${e.nm}|${e.lv}|${Math.round((e.hp / e.mhp) * 100)}|${e.ty}|${e.id === state.target}`;
    if (spr.userData.k === key) return; spr.userData.k = key;
    const g = canvas.getContext("2d"); g.clearRect(0, 0, 256, 80);
    g.font = "bold 22px Arial"; g.textAlign = "center";
    g.fillStyle = e.ty === ENT.MONSTER ? "#e8b58a" : (e.id === state.selfId ? "#fff" : "#bcd2f0");
    g.fillText(`${e.nm} ${e.lv ? "Lv" + e.lv : ""}`, 128, 26);
    const ratio = Math.max(0, e.hp / e.mhp);
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(58, 40, 140, 12);
    g.fillStyle = e.ty === ENT.MONSTER ? "#d2553f" : "#5fbf4f"; g.fillRect(58, 40, 140 * ratio, 12);
    tex.needsUpdate = true;
  };
  return spr;
}

function textSprite(text, color) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext("2d"); g.font = "bold 30px Arial"; g.textAlign = "center";
  g.fillStyle = color; g.strokeStyle = "rgba(0,0,0,.8)"; g.lineWidth = 4;
  g.strokeText(text, 128, 42); g.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(3.4, 0.85, 1);
  return spr;
}

function ringMesh(color) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 8, 28), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = -Math.PI / 2; return m;
}

function screenToGround(sx, sy) {
  if (!ready || !canvasEl) return { x: 0, z: 0 };
  const ndc = new THREE.Vector2((sx / canvasEl.clientWidth) * 2 - 1, -(sy / canvasEl.clientHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, hit);
  return { x: hit.x, z: hit.z };
}

function MAT(color, flat = false) { return new THREE.MeshStandardMaterial({ color, flatShading: flat }); }

let lastW = 0, lastH = 0;
function resize(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
