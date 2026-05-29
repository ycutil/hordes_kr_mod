// Combat resolution: cast validation, damage/heal, dots, buffs, death, exp.
// Pure functions operating on (world, ...). Events are pushed to `events`
// (sent to clients inside serverEntityDelta) so the UI can show FX.

import { skillDef } from "./data/skills.js";
import { EVENT } from "../shared/protocol.js";
import { ENT, FACTION, COMBAT_LINGER, expToNext } from "../shared/constants.js";

const GCD_MS = 500;
const CRIT_CHANCE = 0.15;
const CRIT_MULT = 1.6;

export function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function hostile(a, b) {
  if (!a || !b) return false;
  if (a.type === ENT.MONSTER || b.type === ENT.MONSTER) return a.faction !== b.faction || a.type !== b.type;
  return a.faction !== b.faction && b.faction !== FACTION.NEUTRAL;
}
function friendly(a, b) {
  if (!a || !b) return false;
  return a === b || (a.type === ENT.PLAYER && b.type === ENT.PLAYER && a.faction === b.faction);
}

// Attempt to start/resolve a skill. Returns { ok, reason }.
export function tryCast(world, caster, skillId, now, events) {
  if (!caster || caster.dead) return fail("dead");
  const def = skillDef(skillId);
  if (!def) return fail("unknown skill");
  if (now < caster.gcdUntil) return fail("gcd");
  if (now < (caster.cooldowns[skillId] || 0)) return fail("cooldown");
  if (caster.mp < def.mana) return fail("mana");
  if (caster.cast) return fail("already casting");

  // Resolve intended target up front for validation.
  const tgt = resolveTarget(world, caster, def);
  if (def.target === "enemy" && !tgt) return fail("no target");
  if ((def.target === "enemy" || def.target === "friendly") && tgt && def.range > 0) {
    if (dist(caster, tgt) > def.range + tgt.radius + caster.radius) return fail("out of range");
  }

  // Pay costs + cooldowns now (real games commit on cast start).
  caster.mp -= def.mana;
  caster.cooldowns[skillId] = now + def.cd * 1000;
  caster.gcdUntil = now + GCD_MS;
  if (def.kind !== "heal" && def.kind !== "hot" && def.target !== "self") {
    caster.inCombatUntil = now + COMBAT_LINGER * 1000;
  }

  if (def.cast > 0) {
    caster.cast = { skill: skillId, endAt: now + def.cast * 1000, target: tgt ? tgt.id : 0 };
    events.push({ type: EVENT.CAST, id: caster.id, skill: skillId, castEnd: caster.cast.endAt });
    return ok();
  }
  resolve(world, caster, skillId, tgt ? tgt.id : 0, now, events);
  return ok();
}

// Called by World when a cast timer completes.
export function finishCast(world, caster, now, events) {
  const c = caster.cast;
  caster.cast = null;
  if (!c || caster.dead) return;
  events.push({ type: EVENT.CAST_DONE, id: caster.id });
  resolve(world, caster, c.skill, c.target, now, events);
}

function resolve(world, caster, skillId, targetId, now, events) {
  const def = skillDef(skillId);
  if (!def) return;
  let tgt = targetId ? world.get(targetId) : null;
  if (def.target === "self") tgt = caster;
  if (def.target === "friendly" && (!tgt || !friendly(caster, tgt) || tgt.dead)) tgt = caster;

  switch (def.kind) {
    case "dmg": {
      if (!validEnemy(caster, tgt)) return;
      hit(world, caster, tgt, scaled(caster, def), skillId, events);
      break;
    }
    case "debuff": {
      if (!validEnemy(caster, tgt)) return;
      hit(world, caster, tgt, scaled(caster, def), skillId, events);
      if (def.slow) { tgt.slowAmount = def.slow.amount; tgt.slowUntil = now + def.slow.dur * 1000; }
      if (def.taunt && tgt.ai) tgt.target = caster.id;
      break;
    }
    case "dot": {
      if (!validEnemy(caster, tgt)) return;
      hit(world, caster, tgt, scaled(caster, def), skillId, events);
      tgt.dots.push({ kind: "dot", power: scaled(caster, def), every: def.dot.tick * 1000, next: now + def.dot.tick * 1000, times: def.dot.times, srcId: caster.id, skill: skillId });
      break;
    }
    case "aoe": {
      if (!validEnemy(caster, tgt)) return;
      for (const e of world.entities.values()) {
        if (e.dead || !hostile(caster, e)) continue;
        if (dist(tgt, e) <= def.radius) {
          hit(world, caster, e, scaled(caster, def), skillId, events);
          if (def.slow) { e.slowAmount = def.slow.amount; e.slowUntil = now + def.slow.dur * 1000; }
        }
      }
      break;
    }
    case "heal": {
      if (!tgt || tgt.dead) return;
      healEnt(caster, tgt, scaled(caster, def), skillId, events);
      break;
    }
    case "hot": {
      if (!tgt || tgt.dead) return;
      tgt.dots.push({ kind: "hot", power: scaled(caster, def), every: def.hot.tick * 1000, next: now + def.hot.tick * 1000, times: def.hot.times, srcId: caster.id, skill: skillId });
      break;
    }
    case "dash": {
      let ang = caster.rot;
      if (def.charge && validEnemy(caster, tgt)) {
        ang = Math.atan2(tgt.x - caster.x, tgt.z - caster.z);
        const d = Math.max(0, dist(caster, tgt) - (tgt.radius + caster.radius + 0.5));
        caster.x += Math.sin(ang) * Math.min(d, def.range);
        caster.z += Math.cos(ang) * Math.min(d, def.range);
        if (def.power) hit(world, caster, tgt, scaled(caster, def), skillId, events);
      } else {
        caster.x += Math.sin(ang) * def.dashDist;
        caster.z += Math.cos(ang) * def.dashDist;
      }
      world.clampToWorld(caster);
      break;
    }
    case "buff": {
      const who = def.target === "friendly" && tgt ? tgt : caster;
      if (def.cleanse) { who.slowUntil = 0; who.slowAmount = 0; }
      if (def.buff) {
        if (def.buff.absorb) { who.absorb = Math.max(who.absorb, def.buff.absorb); }
        who.buffs.push({ ...def.buff, until: now + (def.buff.dur || 5) * 1000 });
      }
      break;
    }
  }
}

// Resolve the entity a skill should act on, based on its target mode.
function resolveTarget(world, caster, def) {
  if (def.target === "self") return caster;
  const cur = caster.target ? world.get(caster.target) : null;
  if (def.target === "enemy") return cur && !cur.dead && hostile(caster, cur) ? cur : null;
  if (def.target === "friendly") return cur && !cur.dead && friendly(caster, cur) ? cur : caster;
  return cur;
}

function validEnemy(caster, tgt) { return tgt && !tgt.dead && hostile(caster, tgt); }
function scaled(caster, def) { return def.power * caster.power; }

function hit(world, src, tgt, raw, skillId, events) {
  const crit = Math.random() < (src.critChance ?? CRIT_CHANCE);
  let amount = raw * (0.9 + Math.random() * 0.2) * (crit ? CRIT_MULT : 1);
  amount *= 100 / (100 + (tgt.armor || 0));   // armor mitigation
  amount = Math.max(1, Math.round(amount));

  if (tgt.absorb > 0) {
    const soak = Math.min(tgt.absorb, amount);
    tgt.absorb -= soak; amount -= soak;
  }
  if (amount > 0) tgt.hp -= amount;

  const now = Date.now();
  tgt.inCombatUntil = now + COMBAT_LINGER * 1000;
  src.inCombatUntil = now + COMBAT_LINGER * 1000;
  if (tgt.ai && !tgt.target) tgt.target = src.id;   // mobs retaliate

  events.push({ type: EVENT.DAMAGE, target: tgt.id, by: src.id, amount, crit, skill: skillId });
  if (tgt.hp <= 0 && !tgt.dead) death(world, tgt, src.id, events);
}

// Basic monster melee (used by World AI). Goes through the same hit() path so
// armor/crit/absorb/death/aggro all behave consistently.
export function mobMelee(world, mob, tgt, events) {
  if (!tgt || tgt.dead) return;
  hit(world, mob, tgt, mob.power, "melee", events);
}

function healEnt(src, tgt, raw, skillId, events) {
  const amount = Math.max(1, Math.round(raw * (0.95 + Math.random() * 0.1)));
  tgt.hp = Math.min(tgt.maxhp, tgt.hp + amount);
  events.push({ type: EVENT.HEAL, target: tgt.id, by: src.id, amount, skill: skillId });
}

export function death(world, ent, byId, events) {
  ent.dead = true; ent.hp = 0; ent.cast = null; ent.target = 0;
  ent.dots = []; ent.buffs = []; ent.absorb = 0; ent.slowUntil = 0;
  events.push({ type: EVENT.DEATH, id: ent.id, by: byId });

  const now = Date.now();
  if (ent.type === ENT.MONSTER) {
    ent.respawnAt = now + world.mobRespawnMs;
    const killer = world.get(byId);
    if (killer && killer.type === ENT.PLAYER) {
      grantExp(world, killer, ent.ai?.tpl?.exp || 10, events);
      world.rollLoot(ent, killer, events);
    }
  } else if (ent.type === ENT.PLAYER) {
    ent.respawnAt = now + world.playerRespawnMs;
  }
}

export function grantExp(world, player, amount, events) {
  player.exp += amount;
  while (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.level += 1;
    player.recomputeStats(true);   // re-derive from class+level+gear, heal full
    player.expNext = expToNext(player.level);
    events.push({ type: EVENT.LEVELUP, id: player.id, level: player.level });
  }
}

const ok = () => ({ ok: true });
const fail = (reason) => ({ ok: false, reason });
