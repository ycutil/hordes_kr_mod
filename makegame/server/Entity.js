// Entity model. Field set mirrors real hordes gear-data.json snapshots
// (id, type, name, level, faction, pos, rot, radius, size, speed, target, hp...)
// plus server-only runtime state (cooldowns, cast, buffs, dots, AI).

import { ENT, CLASS, FACTION } from "../shared/constants.js";
import { classBase, aggregateStats, gearDerived } from "./data/items.js";

export class Entity {
  constructor(opts = {}) {
    this.id = opts.id | 0;
    this.type = opts.type ?? ENT.PLAYER;
    this.cls = opts.cls ?? CLASS.ARCHER;
    this.faction = opts.faction ?? FACTION.BLUE;
    this.name = opts.name || "Unknown";
    this.level = opts.level || 1;

    // transform (top-down x/z plane)
    this.x = opts.x || 0;
    this.z = opts.z || 0;
    this.rot = opts.rot || 0;
    this.radius = opts.radius ?? 0.45;
    this.size = opts.size ?? 0.9;
    this.baseSpeed = opts.speed ?? 7;

    // vitals
    this.maxhp = opts.hp || 100;
    this.hp = this.maxhp;
    this.maxmp = opts.mp || 100;
    this.mp = this.maxmp;
    this.hpRegen = opts.hpRegen || 4;
    this.mpRegen = opts.mpRegen || 6;
    this.power = opts.power || 20;
    this.armor = opts.armor || 5;
    this.critChance = 0.15;

    // items (players)
    this.inventory = [];          // [{ uid, name, slot, ... stats }]
    this.equipment = {};          // slot -> item
    this.bagSize = 24;
    this.invDirty = false;

    // combat state
    this.target = 0;
    this.dead = false;
    this.respawnAt = 0;
    this.cooldowns = {};        // skillId -> ready timestamp (ms)
    this.gcdUntil = 0;          // global cooldown
    this.cast = null;           // { skill, endAt, target }
    this.buffs = [];            // { absorb?, regen?, until }
    this.absorb = 0;
    this.dots = [];             // { kind:'dot'|'hot', power, every, next, times, srcId, skill }
    this.slowAmount = 0;
    this.slowUntil = 0;
    this.inCombatUntil = 0;
    this.lastRegenAt = 0;

    // progression (players)
    this.exp = 0;
    this.expNext = opts.expNext || 0;

    // AI (mobs)
    this.ai = null;             // { tpl, homeX, homeZ, state, attackReadyAt, wanderAt }

    // connection (players)
    this.conn = null;
    this.input = { mx: 0, mz: 0, rot: 0, seq: 0 };
  }

  get alive() { return !this.dead; }

  // Recompute derived stats from class+level base plus equipped gear.
  // full=true heals to max (creation / level-up); otherwise preserves ratios.
  recomputeStats(full = false) {
    if (this.type !== ENT.PLAYER) return;
    const base = classBase(this.cls, this.level);
    const g = gearDerived(aggregateStats(this.equipment), this.cls);
    const hpRatio = full || !this.maxhp ? 1 : this.hp / this.maxhp;
    const mpRatio = full || !this.maxmp ? 1 : this.mp / this.maxmp;
    this.maxhp = Math.round(base.hp + g.hp);
    this.maxmp = Math.round(base.mp + g.mp);
    this.power = Math.round(base.power + g.power);
    this.armor = Math.round(base.armor + g.armor);
    this.critChance = base.crit + g.crit;
    this.baseSpeed = base.speed + g.speed;
    this.hpRegen = base.hpRegen; this.mpRegen = base.mpRegen;
    this.hp = Math.min(this.maxhp, Math.round(this.maxhp * hpRatio));
    this.mp = Math.min(this.maxmp, Math.round(this.maxmp * mpRatio));
  }

  speed(now) {
    const slowed = this.slowUntil > now ? (1 - this.slowAmount) : 1;
    return this.baseSpeed * slowed;
  }

  inCombat(now) { return this.inCombatUntil > now; }

  // Compact state sent to clients each tick.
  serialize() {
    const e = {
      id: this.id, ty: this.type, cl: this.cls, fa: this.faction,
      nm: this.name, lv: this.level,
      x: round2(this.x), z: round2(this.z), rot: round3(this.rot),
      sz: this.size,
      hp: Math.max(0, Math.round(this.hp)), mhp: this.maxhp,
      mp: Math.max(0, Math.round(this.mp)), mmp: this.maxmp,
      tg: this.target, dead: this.dead,
    };
    if (this.cast) e.cast = { s: this.cast.skill, end: this.cast.endAt };
    if (this.absorb > 0) e.sh = Math.round(this.absorb);
    if (this.slowUntil > Date.now()) e.slow = 1;
    if (this.type === ENT.PLAYER) { e.exp = this.exp; e.expn = this.expNext; }
    return e;
  }
}

function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
