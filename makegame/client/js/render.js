// Top-down canvas renderer. (The real hordes uses a 3D WebGL engine; this 2D
// projection of the x/z ground plane is the learning-slice simplification.)
import { state, self } from "./state.js";
import { ENT, FACTION, CLASS } from "/shared/constants.js";
import { entitySprite, tile } from "./assets.js";

let dpr = 1;
const TILE_WU = 4;   // world units covered by one terrain tile

export function render(ctx, canvas, now) {
  resize(ctx, canvas);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const S = state.scale, cam = state.cam;
  const toX = (wx) => (wx - cam.x) * S + cw / 2;
  const toY = (wz) => (wz - cam.z) * S + ch / 2;

  // background
  ctx.fillStyle = "#0a0d14";
  ctx.fillRect(0, 0, cw, ch);

  // tiled grass terrain (scrolls with camera)
  const grass = tile("grass");
  const left = cam.x - cw / 2 / S, top = cam.z - ch / 2 / S;
  const right = cam.x + cw / 2 / S, bot = cam.z + ch / 2 / S;
  const px = TILE_WU * S + 1;
  for (let wx = Math.floor(left / TILE_WU) * TILE_WU; wx < right; wx += TILE_WU)
    for (let wz = Math.floor(top / TILE_WU) * TILE_WU; wz < bot; wz += TILE_WU)
      ctx.drawImage(grass, toX(wx), toY(wz), px, px);

  // world border
  ctx.strokeStyle = "rgba(120,150,190,.35)"; ctx.lineWidth = 2;
  ctx.strokeRect(toX(0), toY(0), state.world.w * S, state.world.h * S);

  // props
  for (const p of state.props) drawProp(ctx, toX(p.x), toY(p.z), p, S);

  // entities (sorted by z so lower draws on top)
  const ents = [...state.entities.values()].sort((a, b) => (a.rz ?? a.z) - (b.rz ?? b.z));
  for (const e of ents) drawEntity(ctx, e, toX, toY, S, now);

  // floating combat text
  for (const f of state.fx) {
    const age = (now - f.t) / f.life;
    if (age >= 1) continue;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = f.color;
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(f.text, toX(f.x), toY(f.z) - 22 - age * 26);
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, cw, ch);
}

function drawProp(ctx, x, y, p, S) {
  if (p.kind === "water") { ctx.fillStyle = "rgba(54,110,170,.5)"; circle(ctx, x, y, p.r * S); }
  else if (p.kind === "tree") { ctx.fillStyle = "#2f5d34"; circle(ctx, x, y, p.r * S); ctx.fillStyle = "#3d7a44"; circle(ctx, x, y - 3, p.r * S * 0.7); }
  else if (p.kind === "rock") { ctx.fillStyle = "#5a606b"; circle(ctx, x, y, p.r * S); }
  else if (p.kind === "camp") { ctx.strokeStyle = "rgba(210,180,120,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, p.r * S, 0, 7); ctx.stroke(); }
  else if (p.kind === "portal") {
    ctx.save();
    ctx.fillStyle = "rgba(150,110,224,.28)"; circle(ctx, x, y, p.r * S);
    ctx.strokeStyle = "#b18bff"; ctx.lineWidth = 3; ring(ctx, x, y, p.r * S);
    ctx.fillStyle = "#dcc9ff"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
    if (p.label) ctx.fillText(p.label, x, y - p.r * S - 6);
    ctx.restore();
  }
}

function drawEntity(ctx, e, toX, toY, S, now) {
  const isSelf = e.id === state.selfId;
  if (e.dead && e.ty === ENT.MONSTER) return;          // hide dead mobs
  const x = toX(e.rx ?? e.x), y = toY(e.rz ?? e.z);
  const r = Math.max(7, (e.sz || 0.9) * S * 0.55);

  const rr = e.rrot ?? e.rot ?? 0;

  // selection / target rings (screen space, under sprite)
  if (e.id === state.target) { ctx.strokeStyle = "#ffd56b"; ctx.lineWidth = 3; ring(ctx, x, y, r + 5); }
  if (isSelf) { ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; ring(ctx, x, y, r + 3); }

  // sprite (rotated to face heading; sprite "forward" is +z/down)
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-rr);
  if (e.dead) ctx.globalAlpha = 0.35;
  const sp = r * 2.9;
  ctx.drawImage(entitySprite(e), -sp / 2, -sp / 2, sp, sp);
  ctx.restore();

  // shield ring
  if (e.sh) { ctx.strokeStyle = "rgba(120,180,255,.9)"; ctx.lineWidth = 2; ring(ctx, x, y, r + 7); }

  ctx.globalAlpha = 1;

  // nameplate
  ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
  ctx.fillStyle = e.ty === ENT.MONSTER ? "#e8b58a" : (isSelf ? "#fff" : "#bcd2f0");
  ctx.fillText(`${e.nm} ${e.lv ? "Lv" + e.lv : ""}`, x, y - r - 8);

  // hp bar (mobs: only if damaged or targeted)
  const showHp = e.ty !== ENT.MONSTER || e.hp < e.mhp || e.id === state.target;
  if (showHp && !e.dead) {
    const bw = Math.max(28, r * 2.4), bh = 4, bx = x - bw / 2, by = y - r - 6;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.ty === ENT.MONSTER ? "#d2553f" : "#5fbf4f";
    ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.mhp), bh);
  }

  // other entities' cast bar
  const c = state.casts.get(e.id);
  if (c && !isSelf) {
    const p = Math.min(1, (now - c.start) / Math.max(1, c.end - c.start));
    const bw = r * 2.4, bx = x - bw / 2, by = y + r + 4;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = "#ffd56b"; ctx.fillRect(bx, by, bw * p, 4);
  }
}

function colorFor(e, isSelf) {
  if (e.ty === ENT.MONSTER) return "#8a5a2b";
  if (e.fa === FACTION.RED) return "#c2453a";
  const cls = ["#c8a23a", "#5a8fe0", "#46b06a", "#9b6fe0"][e.cl] || "#5a8fe0";
  return cls;
}

function drawMinimap(ctx, cw, ch) {
  const size = 132, pad = 14, mx = cw - size - pad, my = pad;
  ctx.save();
  ctx.fillStyle = "rgba(8,11,18,.8)"; ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = "rgba(150,180,220,.3)"; ctx.strokeRect(mx, my, size, size);
  const sx = size / state.world.w, sz = size / state.world.h;
  for (const e of state.entities.values()) {
    if (e.dead) continue;
    ctx.fillStyle = e.id === state.selfId ? "#fff" : e.ty === ENT.MONSTER ? "#c0703a" : (e.fa === FACTION.RED ? "#c2453a" : "#5a8fe0");
    const px = mx + e.x * sx, py = my + e.z * sz;
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  ctx.restore();
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
function ring(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }

function resize(ctx, canvas) {
  const want = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * want || canvas.height !== h * want || dpr !== want) {
    dpr = want; canvas.width = w * want; canvas.height = h * want;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
