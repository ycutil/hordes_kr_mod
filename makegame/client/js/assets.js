// Original, procedurally-generated assets (no copyrighted material).
// Characters/monsters/terrain are drawn to offscreen canvases and cached;
// skill icons are drawn per skill kind; SFX are synthesized via WebAudio.
import { ENT, FACTION, CLASS } from "/shared/constants.js";

const CLASS_COLOR = ["#d8b24a", "#5a8fe0", "#46b06a", "#9b6fe0"]; // War, Mage, Archer, Shaman
const cache = new Map();

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

// ---------- characters / monsters ----------
export function entitySprite(e) {
  const key = e.ty === ENT.MONSTER ? `m:${e.nm}:${Math.round((e.sz || 1) * 10)}`
    : `p:${e.cl}:${e.fa}`;
  let spr = cache.get(key);
  if (!spr) { spr = e.ty === ENT.MONSTER ? buildMonster(e) : buildChar(e.cl, e.fa); cache.set(key, spr); }
  return spr;
}

function buildChar(cls, faction) {
  const S = 64, c = canvas(S, S), g = c.getContext("2d");
  const cx = S / 2, cy = S / 2, r = 18;
  const body = CLASS_COLOR[cls] || "#5a8fe0";
  const trim = faction === FACTION.RED ? "#e2554a" : "#4f8fe0";
  // shadow
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(cx, cy + 16, r, r * 0.5, 0, 0, 7); g.fill();
  // forward indicator (faces +z = downward before rotation)
  g.fillStyle = trim; g.beginPath(); g.moveTo(cx, cy + r + 6); g.lineTo(cx - 7, cy + r - 4); g.lineTo(cx + 7, cy + r - 4); g.closePath(); g.fill();
  // body
  g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.lineWidth = 3; g.strokeStyle = trim; g.stroke();
  // shoulders
  g.fillStyle = shade(body, -22); g.beginPath(); g.arc(cx - r * 0.8, cy, 6, 0, 7); g.arc(cx + r * 0.8, cy, 6, 0, 7); g.fill();
  // class weapon hint (drawn toward front)
  g.strokeStyle = "#1c2230"; g.lineWidth = 3; g.lineCap = "round";
  if (cls === CLASS.ARCHER) { g.beginPath(); g.arc(cx + 14, cy + 6, 10, -0.9, 0.9); g.stroke(); }
  else if (cls === CLASS.MAGE) { g.beginPath(); g.moveTo(cx + 12, cy + 16); g.lineTo(cx + 16, cy - 14); g.stroke(); g.fillStyle = "#bfe3ff"; g.beginPath(); g.arc(cx + 16, cy - 15, 4, 0, 7); g.fill(); }
  else if (cls === CLASS.WARRIOR) { g.beginPath(); g.moveTo(cx + 14, cy + 14); g.lineTo(cx + 14, cy - 12); g.stroke(); }
  else { g.fillStyle = "#cbb27a"; g.fillRect(cx + 11, cy - 12, 5, 26); } // shaman totem
  // head dot
  g.fillStyle = "#f1e4c8"; g.beginPath(); g.arc(cx, cy - 4, 7, 0, 7); g.fill();
  return c;
}

function buildMonster(e) {
  const S = 64, c = canvas(S, S), g = c.getContext("2d");
  const cx = S / 2, cy = S / 2, r = 16 + Math.min(10, (e.sz || 1) * 6);
  g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(cx, cy + r * 0.8, r, r * 0.45, 0, 0, 7); g.fill();
  // spiky body
  g.fillStyle = "#8a5a2b"; g.beginPath();
  const spikes = 9;
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 0.78;
    const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath(); g.fill();
  g.lineWidth = 2; g.strokeStyle = "#5c3a17"; g.stroke();
  // eyes
  g.fillStyle = "#ffde59"; g.beginPath(); g.arc(cx - 5, cy - 2, 3, 0, 7); g.arc(cx + 5, cy - 2, 3, 0, 7); g.fill();
  g.fillStyle = "#1a1206"; g.beginPath(); g.arc(cx - 5, cy - 2, 1.3, 0, 7); g.arc(cx + 5, cy - 2, 1.3, 0, 7); g.fill();
  return c;
}

// ---------- terrain ----------
export function tile(kind) {
  const key = "t:" + kind; let t = cache.get(key); if (t) return t;
  const S = 64, c = canvas(S, S), g = c.getContext("2d");
  const rnd = mulberry32(kind.length * 99 + 7);
  if (kind === "grass") { g.fillStyle = "#1d2e22"; g.fillRect(0, 0, S, S); for (let i = 0; i < 90; i++) { g.fillStyle = rnd() < .5 ? "#243a2a" : "#2c4632"; const x = rnd() * S, y = rnd() * S; g.fillRect(x, y, 2, 3); } }
  else if (kind === "water") { g.fillStyle = "#1b3a5c"; g.fillRect(0, 0, S, S); g.strokeStyle = "rgba(120,180,230,.3)"; for (let i = 0; i < 4; i++) { g.beginPath(); const y = 12 + i * 16; g.moveTo(0, y); g.bezierCurveTo(16, y - 5, 48, y + 5, 64, y); g.stroke(); } }
  else { g.fillStyle = "#3a3f48"; g.fillRect(0, 0, S, S); for (let i = 0; i < 30; i++) { g.fillStyle = rnd() < .5 ? "#2f343c" : "#454b55"; g.fillRect(rnd() * S, rnd() * S, 3, 3); } }
  cache.set(key, c); return c;
}

// ---------- skill icons ----------
export function skillIcon(id, def) {
  const key = "i:" + id; let ic = cache.get(key); if (ic) return ic;
  const S = 44, c = canvas(S, S), g = c.getContext("2d");
  const col = elementColor(def);
  g.fillStyle = "#10141d"; g.fillRect(0, 0, S, S);
  const grd = g.createLinearGradient(0, 0, 0, S); grd.addColorStop(0, shade(col, 18)); grd.addColorStop(1, shade(col, -28));
  g.fillStyle = grd; roundRect(g, 3, 3, S - 6, S - 6, 7); g.fill();
  g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1.5; roundRect(g, 3, 3, S - 6, S - 6, 7); g.stroke();
  g.translate(S / 2, S / 2); g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = 3; g.lineCap = "round";
  glyph(g, def);
  cache.set(key, c); return c;
}

function glyph(g, def) {
  const k = def.kind;
  if (k === "heal" || k === "hot") { g.fillStyle = "#eafff0"; g.fillRect(-3, -9, 6, 18); g.fillRect(-9, -3, 18, 6); }
  else if (k === "dash") { g.beginPath(); g.moveTo(-9, 6); g.lineTo(3, -2); g.lineTo(-2, -2); g.lineTo(8, -9); g.stroke(); }
  else if (k === "buff") { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.stroke(); }
  else if (k === "aoe") { for (let i = 0; i < 8; i++) { const a = i / 8 * 7; g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); g.stroke(); } }
  else if (def.projectile) { g.beginPath(); g.moveTo(-9, 7); g.lineTo(9, -9); g.stroke(); g.beginPath(); g.moveTo(9, -9); g.lineTo(3, -8); g.lineTo(8, -3); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(-7, 8); g.lineTo(7, -8); g.lineTo(9, -6); g.lineTo(-5, 9); g.closePath(); g.fill(); } // melee slash
}

function elementColor(def) {
  if (def.kind === "heal" || def.kind === "hot") return "#2e8b57";
  if (/ice|frost|icicle|blink/.test(def.name?.toLowerCase() || "")) return "#3f7fb0";
  if (def.kind === "buff") return "#7a6bd0";
  if (def.kind === "dash") return "#c79a3a";
  return "#9c4a3a";
}

// ---------- audio (synth SFX) ----------
let ac = null;
export function ensureAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ac && ac.state === "suspended") ac.resume(); }
function tone(type, f0, f1, dur, vol = 0.18, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay;
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
export function playSfx(name) {
  if (!ac) return;
  switch (name) {
    case "shoot": tone("square", 700, 240, 0.12, 0.12); break;
    case "cast": tone("sine", 300, 720, 0.28, 0.14); break;
    case "hit": tone("square", 180, 90, 0.10, 0.16); break;
    case "crit": tone("square", 320, 120, 0.16, 0.2); tone("sine", 900, 500, 0.12, 0.1, 0.02); break;
    case "heal": tone("sine", 520, 880, 0.3, 0.12); break;
    case "death": tone("sawtooth", 300, 60, 0.5, 0.18); break;
    case "levelup": [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.18, 0.14, i * 0.09)); break;
  }
}

// ---------- helpers ----------
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, gg = ((n >> 8) & 255) + amt, b = (n & 255) + amt; r = clamp(r); gg = clamp(gg); b = clamp(b); return `rgb(${r},${gg},${b})`; }
function clamp(v) { return Math.max(0, Math.min(255, v | 0)); }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
