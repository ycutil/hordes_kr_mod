// Item system modeled on real hordes.io item data (gear-data.json):
//   item.stats = [{ id, type:"base"|"bonus", qual, value }]
//   quality% -> bonus option count (99+ =4, 79+ =3, 56+ =2)
//   stat index table (en.json ui.stats.array):
import { CLASS } from "../../shared/constants.js";
import { CLASSES } from "./classes.js";

export const STAT = {
  STR: 0, STA: 1, DEX: 2, INT: 3, WIS: 4, LUCK: 5, HP: 6, MP: 7, HPREG: 8, MPREG: 9,
  MINDMG: 10, MAXDMG: 11, DEF: 12, BLOCK: 13, CRIT: 14, MOVESPD: 15, HASTE: 16, ATKSPD: 17, ITEMFIND: 18, BAGSLOTS: 19,
};
export const STAT_NAME = ["Str", "Sta", "Dex", "Int", "Wis", "Luck", "HP", "MP", "HP Regen", "MP Regen",
  "Min Dmg", "Max Dmg", "Defense", "Block", "Critical", "Move Spd", "Haste", "Atk Spd", "Item Find", "Bag Slots"];

// equip slots
export const SLOTS = ["weapon", "offhand", "chest", "gloves", "boots", "amulet", "ring"];
export const WEAPON_BY_CLASS = { [CLASS.WARRIOR]: "sword", [CLASS.MAGE]: "staff", [CLASS.ARCHER]: "bow", [CLASS.SHAMAN]: "hammer" };
export const OFFHAND_BY_CLASS = { [CLASS.WARRIOR]: "shield", [CLASS.MAGE]: "orb", [CLASS.ARCHER]: "quiver", [CLASS.SHAMAN]: "totem" };
const PRIMARY_BY_CLASS = { [CLASS.WARRIOR]: STAT.STR, [CLASS.MAGE]: STAT.INT, [CLASS.ARCHER]: STAT.DEX, [CLASS.SHAMAN]: STAT.WIS };

// base stat ids per slot (always rolled), and the bonus pool to draw from
const SLOT_BASE = {
  weapon: [STAT.MINDMG, STAT.MAXDMG, STAT.ATKSPD],
  offhand: [STAT.DEF, STAT.MP],
  chest: [STAT.HP, STAT.DEF],
  gloves: [STAT.DEF, STAT.CRIT],
  boots: [STAT.DEF, STAT.MOVESPD],
  amulet: [STAT.HP, STAT.MP],
  ring: [STAT.CRIT, STAT.HASTE],
};
const BONUS_POOL = [STAT.STA, STAT.LUCK, STAT.CRIT, STAT.HASTE, STAT.BLOCK, STAT.HP, STAT.MP, STAT.DEF, STAT.MOVESPD];

// value range for a stat at a given level (min,max before quality lerp)
function statRange(id, level) {
  const L = level;
  switch (id) {
    case STAT.HP: return [L * 1.4, L * 2.6];
    case STAT.MP: return [L * 1.0, L * 2.0];
    case STAT.DEF: return [L * 0.6, L * 1.3];
    case STAT.MINDMG: return [L * 0.8, L * 1.4];
    case STAT.MAXDMG: return [L * 1.3, L * 2.2];
    case STAT.ATKSPD: return [4, 12];
    case STAT.CRIT: return [3, 14];
    case STAT.HASTE: return [3, 12];
    case STAT.BLOCK: return [3, 12];
    case STAT.MOVESPD: return [2, 8];
    case STAT.LUCK: return [3, 12];
    case STAT.STR: case STAT.STA: case STAT.DEX: case STAT.INT: case STAT.WIS: return [Math.max(2, L * 0.3), L * 0.7];
    default: return [2, 8];
  }
}

function qualityCount(q) { return q >= 99 ? 4 : q >= 79 ? 3 : q >= 56 ? 2 : 1; }
function qualityTier(q) { return q >= 99 ? "Epic" : q >= 90 ? "Rare" : q >= 79 ? "Fine" : "Common"; }
function rollVal(id, level, q, rnd) {
  const [mn, mx] = statRange(id, level);
  const q01 = Math.max(0, Math.min(1, (q - 56) / 54));
  const v = mn + (mx - mn) * (0.5 + 0.5 * q01) * (0.85 + rnd() * 0.3);
  return id === STAT.ATKSPD || id <= STAT.LUCK || id >= STAT.CRIT ? Math.max(1, Math.round(v)) : Math.round(v);
}

// Generate an item for a slot. rnd is a () => [0,1) function.
export function generateItem(level, slot, cls, rnd = Math.random) {
  const q = 56 + rnd() * 54;                 // 56..110 quality
  const tier = Math.max(1, Math.ceil(level / 10));
  const primary = PRIMARY_BY_CLASS[cls] ?? STAT.STR;
  const stats = [];
  for (const id of SLOT_BASE[slot] || [STAT.DEF]) stats.push({ id, type: "base", qual: Math.round(q), value: rollVal(id, level, q, rnd) });

  // bonus options: count by quality; first slot favors the class primary stat
  const n = qualityCount(q);
  const pool = [primary, ...BONUS_POOL.filter((x) => x !== primary)];
  const picked = new Set();
  for (let i = 0; i < n && i < pool.length; i++) {
    let id = i === 0 ? primary : pool[1 + Math.floor(rnd() * (pool.length - 1))];
    let guard = 0; while (picked.has(id) && guard++ < 8) id = pool[Math.floor(rnd() * pool.length)];
    if (picked.has(id)) continue; picked.add(id);
    stats.push({ id, type: "bonus", qual: Math.round(q), value: rollVal(id, level, q, rnd) });
  }

  const typeName = slot === "weapon" ? WEAPON_BY_CLASS[cls] : slot === "offhand" ? OFFHAND_BY_CLASS[cls] : slot;
  return {
    name: `${qualityTier(q)} ${cap(typeName)}`,
    slot, type: typeName, level, tier, quality: Math.round(q), cls, stats,
  };
}

// Sum equipped item stats into a flat modifier object.
export function aggregateStats(equipment) {
  const g = {};
  for (const slot of SLOTS) {
    const it = equipment[slot];
    if (!it) continue;
    for (const s of it.stats) g[s.id] = (g[s.id] || 0) + s.value;
  }
  return g;
}

// Class+level base derived stats (gear added on top by Entity.recomputeStats).
export function classBase(cls, level) {
  const c = CLASSES[cls] || CLASSES[CLASS.ARCHER];
  const f = 1 + 0.08 * (level - 1);
  return {
    hp: c.hp * f, mp: c.mp * f, power: c.power * f, armor: c.armor + (level - 1) * 0.5,
    speed: c.speed, crit: 0.15, hpRegen: c.hpRegen, mpRegen: c.mpRegen,
  };
}

// Map aggregated gear stats -> derived combat stats. Returns deltas.
export function gearDerived(g, cls) {
  const primary = PRIMARY_BY_CLASS[cls] ?? STAT.STR;
  return {
    hp: (g[STAT.HP] || 0) + (g[STAT.STA] || 0) * 8,
    mp: (g[STAT.MP] || 0) + (g[STAT.WIS] || 0) * 5,
    power: ((g[STAT.MINDMG] || 0) + (g[STAT.MAXDMG] || 0)) / 2 + (g[primary] || 0) * 1.2,
    armor: (g[STAT.DEF] || 0),
    crit: (g[STAT.CRIT] || 0) * 0.0008,
    speed: (g[STAT.MOVESPD] || 0) * 0.02,
  };
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
