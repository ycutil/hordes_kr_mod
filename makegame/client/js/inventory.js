// Character / inventory panel (toggle with I or C). Equip from bag, unequip
// from slots. Item stat model mirrors hordes (base/bonus stats, quality).
import { state } from "./state.js";
import { SLOTS, STAT_NAME } from "/server/data/items.js";

const el = (id) => document.getElementById(id);
let act = {};

export function initInventory(actions) {
  act = actions;
  el("inv-close").addEventListener("click", () => toggleInventory(false));
}

export function toggleInventory(force) {
  state.invOpen = force === undefined ? !state.invOpen : force;
  el("inventory").classList.toggle("hidden", !state.invOpen);
  if (state.invOpen) renderInventory();
}

export function renderInventory() {
  if (!state.invOpen) return;
  // stats
  const s = state.stats || {};
  el("char-stats").innerHTML = [
    ["Lv", s.level], ["공격력", s.power], ["방어력", s.armor], ["치명%", s.crit],
    ["HP", s.maxhp], ["MP", s.maxmp], ["이속", s.speed],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v ?? "-"}</b></div>`).join("");

  // equipment
  el("equip-slots").innerHTML = SLOTS.map((slot) => {
    const it = state.equipment[slot];
    return `<div class="eq ${it ? rarity(it) : "empty"}" data-slot="${slot}" title="${it ? tip(it) : ""}">
      <span class="sl">${slot}</span>${it ? `<span class="inm">${it.name}</span>` : '<span class="inm dim">비어있음</span>'}</div>`;
  }).join("");
  el("equip-slots").querySelectorAll(".eq").forEach((d) =>
    d.addEventListener("click", () => { if (state.equipment[d.dataset.slot]) act.unequip(d.dataset.slot); }));

  // bag
  el("bag").innerHTML = (state.inventory || []).map((it) =>
    `<div class="cell ${rarity(it)}" data-uid="${it.uid}" title="${tip(it)}"><span class="lv">${it.level}</span><span class="cnm">${short(it)}</span></div>`
  ).join("") || '<div class="bag-empty">가방이 비어있습니다. 몬스터를 처치해 전리품을 얻으세요.</div>';
  el("bag").querySelectorAll(".cell").forEach((d) =>
    d.addEventListener("click", () => act.equip(+d.dataset.uid)));
}

function rarity(it) { const q = it.quality; return q >= 99 ? "epic" : q >= 90 ? "rare" : q >= 79 ? "fine" : "common"; }
function short(it) { return (it.type || it.slot).slice(0, 5); }
function tip(it) {
  const lines = [`${it.name} (Lv${it.level} · ${it.quality}%)`];
  for (const st of it.stats) lines.push(`${st.type === "base" ? "•" : "+"} ${STAT_NAME[st.id]} ${st.value}`);
  return lines.join("\n");
}
