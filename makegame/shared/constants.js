// Shared tuning + enums. Imported by BOTH the server (node) and the client
// (browser ES module served over http), so keep it dependency-free.
//
// Grounded in real hordes.io data where noted:
//   - class indices match en.json `classes` order
//   - faction count (2 player + neutral) matches en.json `factions`
//   - entity fields mirror gear-data.json snapshots (id,type,pos,rot,speed,...)
// Anything not directly observable (tick rate, exact speeds, AI radii) is a
// reasonable approximation tuned for a single-player learning slice.

export const TICK_RATE = 20;            // server simulation ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const CLIENT_INPUT_HZ = 30;      // how often the client sends input
export const SNAPSHOT_RANGE = 60;       // world units; entities within this of a player are sent

// World (top-down x/z ground plane; y/height is ignored in this 2D slice).
export const WORLD = {
  width: 140,
  height: 140,
  spawn: { x: 70, z: 116 },             // blue starting camp (bottom)
};

// en.json `classes` order: Warrior, Mage, Archer, Shaman, NPC, Monster
export const CLASS = {
  WARRIOR: 0,
  MAGE: 1,
  ARCHER: 2,
  SHAMAN: 3,
  NPC: 4,
  MONSTER: 5,
};
export const CLASS_NAME = ["Warrior", "Mage", "Archer", "Shaman", "NPC", "Monster"];

// en.json `factions` (3): two player factions + neutral.
export const FACTION = { BLUE: 0, RED: 1, NEUTRAL: 2 };

// Entity.type — gear-data shows player entities as type 0.
export const ENT = { PLAYER: 0, MONSTER: 1, NPC: 2 };

// Movement / combat tuning (units are world-units & seconds).
export const MOVE_SPEED = 7.0;          // player base move speed
export const REGEN_INTERVAL = 1.0;      // seconds between out-of-combat regen ticks
export const COMBAT_LINGER = 5.0;       // seconds after last combat action you stay "in combat"
export const PLAYER_RESPAWN_DELAY = 4.0;
export const MOB_RESPAWN_DELAY = 8.0;

// Level curve: exp needed to go from level L to L+1.
export function expToNext(level) {
  return Math.floor(40 * Math.pow(level, 1.6)) + 60;
}
