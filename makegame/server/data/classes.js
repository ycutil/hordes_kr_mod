// Base per-class stats + default skillbar. Class roles mirror en.json
// descriptions (Warrior=tank, Mage=AoE/slow, Archer=ranged DPS, Shaman=heal/support).
// Stat numbers are tuned for a learning slice, not ripped from the server.

import { CLASS } from "../../shared/constants.js";

export const CLASSES = {
  [CLASS.WARRIOR]: {
    name: "Warrior",
    hp: 320, mp: 80,
    hpRegen: 6, mpRegen: 4,
    speed: 7.0,
    power: 22,            // base attack power scalar used by skills
    armor: 18,
    skillbar: ["bash", "charge", "cripblow", "bulwark", "taunt"],
  },
  [CLASS.MAGE]: {
    name: "Mage",
    hp: 200, mp: 220,
    hpRegen: 3, mpRegen: 12,
    speed: 6.8,
    power: 30,
    armor: 6,
    skillbar: ["icicle", "icelance", "frostnova", "iceblock", "blink"],
  },
  [CLASS.ARCHER]: {
    name: "Archer",
    hp: 230, mp: 140,
    hpRegen: 4, mpRegen: 8,
    speed: 7.2,
    power: 28,
    armor: 9,
    skillbar: ["swiftshot", "preciseshot", "serpent", "cripple", "dash"],
  },
  [CLASS.SHAMAN]: {
    name: "Shaman",
    hp: 250, mp: 200,
    hpRegen: 5, mpRegen: 11,
    speed: 7.0,
    power: 24,
    armor: 10,
    skillbar: ["lightning", "heal", "regrowth", "cleanse", "totem"],
  },
};

export function classDef(classId) {
  return CLASSES[classId] || CLASSES[CLASS.ARCHER];
}
