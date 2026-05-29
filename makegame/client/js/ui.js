// DOM HUD: self frame, target frame, cast bar, skillbar, log.
import { state, self } from "./state.js";
import { SKILLS } from "/server/data/skills.js";
import { skillIcon } from "./assets.js";

const el = (id) => document.getElementById(id);
let built = false;

export function initUI() {
  el("hud").classList.remove("hidden");
  el("self-name").textContent = state.name;
  buildSkillbar();
  built = true;
}

function buildSkillbar() {
  const bar = el("skillbar");
  bar.innerHTML = "";
  state.skillbar.forEach((id, i) => {
    const def = SKILLS[id] || { name: id };
    const slot = document.createElement("div");
    slot.className = "slot ready";
    slot.dataset.skill = id;
    const icon = skillIcon(id, def); icon.className = "ic";
    slot.appendChild(icon);
    slot.insertAdjacentHTML("beforeend", `<span class="key">${i + 1}</span><span class="nm">${def.name}</span><span class="cd hidden"></span>`);
    bar.appendChild(slot);
  });
}

export function updateUI(now) {
  if (!built) return;
  const s = self();
  if (!s) return;

  setBar("self-hp", s.hp, s.mhp, `${s.hp} / ${s.mhp}`);
  setBar("self-mp", s.mp, s.mmp, `${s.mp} / ${s.mmp}`);
  el("self-xp-fill").style.width = `${s.expn ? (s.exp / s.expn) * 100 : 0}%`;
  el("self-lv").textContent = "Lv" + s.lv;
  el("self-name").textContent = s.nm;

  // target frame
  const t = state.target ? state.entities.get(state.target) : null;
  const tf = el("target-frame");
  if (t && !t.dead) {
    tf.classList.remove("hidden");
    el("tgt-name").textContent = t.nm;
    el("tgt-lv").textContent = t.lv ? "Lv" + t.lv : "";
    setBar("tgt-hp", t.hp, t.mhp, `${t.hp} / ${t.mhp}`);
    const d = Math.hypot((t.rx ?? t.x) - (s.rx ?? s.x), (t.rz ?? t.z) - (s.rz ?? s.z));
    el("tgt-dist").textContent = d.toFixed(1) + "m";
  } else tf.classList.add("hidden");

  // self cast bar
  const c = state.casts.get(state.selfId);
  const cb = el("castbar");
  if (c) {
    cb.classList.remove("hidden");
    const p = Math.min(1, (now - c.start) / Math.max(1, c.end - c.start));
    el("cast-fill").style.width = `${p * 100}%`;
    el("cast-text").textContent = (SKILLS[c.skill]?.name || c.skill);
  } else cb.classList.add("hidden");

  // skillbar cooldowns / mana
  const slots = el("skillbar").children;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const id = slot.dataset.skill;
    const def = SKILLS[id];
    const ready = state.cooldowns[id] || 0;
    const rem = (ready - now) / 1000;
    const cdEl = slot.querySelector(".cd");
    if (rem > 0) { cdEl.classList.remove("hidden"); cdEl.textContent = rem >= 1 ? Math.ceil(rem) : rem.toFixed(1); }
    else cdEl.classList.add("hidden");
    slot.classList.toggle("nomana", !!def && s.mp < def.mana);
  }

  // log
  el("log").innerHTML = state.log.map((l) => `<div class="${l.cls}">${escapeHtml(l.text)}</div>`).join("");
}

function setBar(prefix, v, max, text) {
  el(prefix + "-fill").style.width = `${max ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`;
  const t = el(prefix + "-text"); if (t) t.textContent = text;
}

function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
