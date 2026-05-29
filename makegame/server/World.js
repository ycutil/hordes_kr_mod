// One zone (world). Entity registry, mob spawns, AI, regen, dots, respawns,
// portals, and per-player snapshots. Multiple instances are held by
// WorldManager; players move between them via portals (serverChangeWorld).

import { Entity } from "./Entity.js";
import { classDef } from "./data/classes.js";
import { MOBS } from "./data/mobs.js";
import { generateItem, SLOTS } from "./data/items.js";
import { finishCast, mobMelee, dist, death } from "./Combat.js";
import { EVENT } from "../shared/protocol.js";
import {
  ENT, CLASS, FACTION, SNAPSHOT_RANGE,
  REGEN_INTERVAL, MOB_RESPAWN_DELAY, PLAYER_RESPAWN_DELAY, expToNext,
} from "../shared/constants.js";

export class World {
  constructor(zone, ids) {
    this.zone = zone;
    this.id = zone.id; this.name = zone.name;
    this.w = zone.w; this.h = zone.h; this.spawn = zone.spawn;
    this.portals = zone.portals || [];
    this._ids = ids;                         // shared id allocators (global across zones)
    this.entities = new Map();
    this.pending = [];                       // client-triggered events for the current tick
    this.mobRespawnMs = MOB_RESPAWN_DELAY * 1000;
    this.playerRespawnMs = PLAYER_RESPAWN_DELAY * 1000;
    this.props = this.buildProps();
    this.spawnMobs();
  }

  get(id) { return this.entities.get(id | 0) || null; }
  alloc() { return this._ids.entity(); }
  allocItemId() { return this._ids.item(); }

  buildProps() {
    const props = [];
    const rnd = mulberry32(this.id.length * 911 + this.w);
    for (const d of this.zone.decor || []) props.push({ ...d });
    for (let i = 0; i < 80; i++) {
      const x = 4 + rnd() * (this.w - 8), z = 4 + rnd() * (this.h - 8);
      const kind = rnd() < 0.7 ? "tree" : "rock";
      props.push({ kind, x: +x.toFixed(1), z: +z.toFixed(1), r: kind === "tree" ? 0.8 : 0.6 });
    }
    props.push({ kind: "camp", x: this.spawn.x, z: this.spawn.z, r: 6 });
    for (const p of this.portals) props.push({ kind: "portal", x: p.x, z: p.z, r: p.r, label: p.label || "" });
    return props;
  }

  spawnMobs() {
    for (const s of this.zone.mobs || []) {
      const tpl = MOBS[s.type];
      if (!tpl) continue;
      const e = new Entity({
        id: this.alloc(), type: ENT.MONSTER, cls: CLASS.MONSTER, faction: FACTION.NEUTRAL,
        name: tpl.name, level: tpl.level, x: s.x, z: s.z, rot: Math.random() * Math.PI * 2,
        radius: tpl.radius, size: tpl.size, speed: tpl.speed,
        hp: tpl.hp, mp: 0, hpRegen: tpl.hp * 0.05, mpRegen: 0, power: tpl.power, armor: tpl.armor,
      });
      e.ai = { tpl, homeX: s.x, homeZ: s.z, state: "idle", attackReadyAt: 0, wanderAt: 0, wx: s.x, wz: s.z };
      this.entities.set(e.id, e);
    }
  }

  addPlayer({ name, cls, faction }, conn) {
    const c = classDef(cls);
    const e = new Entity({
      id: this.alloc(), type: ENT.PLAYER, cls, faction: faction ?? FACTION.BLUE,
      name: (name || "Hero").slice(0, 16), level: 1,
      x: this.spawn.x + (Math.random() * 6 - 3), z: this.spawn.z + (Math.random() * 4 - 2),
      radius: 0.45, size: 0.9, speed: c.speed,
      hp: c.hp, mp: c.mp, hpRegen: c.hpRegen, mpRegen: c.mpRegen, power: c.power, armor: c.armor,
    });
    e.expNext = expToNext(1);
    e.skillbar = c.skillbar.slice();
    e.conn = conn;
    const starter = generateItem(1, "weapon", cls);
    starter.uid = this.allocItemId();
    e.equipment.weapon = starter;
    e.recomputeStats(true);
    this.entities.set(e.id, e);
    return e;
  }

  remove(id) { this.entities.delete(id | 0); }

  // returns the portal a (player) entity is standing on, else null
  portalAt(e) {
    for (const p of this.portals) {
      if (dist(e, { x: p.x, z: p.z }) <= p.r + e.radius) return p;
    }
    return null;
  }

  rollLoot(mob, killer, events) {
    if (Math.random() > 0.4 || killer.inventory.length >= killer.bagSize) return;
    const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
    const item = generateItem(Math.max(1, mob.level || 1), slot, killer.cls);
    item.uid = this.allocItemId();
    killer.inventory.push(item);
    killer.invDirty = true;
    events.push({ type: EVENT.LOOT, to: killer.id, item });
  }

  equip(player, uid) {
    const idx = player.inventory.findIndex((it) => it.uid === uid);
    if (idx < 0) return false;
    const item = player.inventory[idx];
    if (!SLOTS.includes(item.slot)) return false;
    player.inventory.splice(idx, 1);
    const prev = player.equipment[item.slot];
    player.equipment[item.slot] = item;
    if (prev) player.inventory.push(prev);
    player.recomputeStats();
    player.invDirty = true;
    return true;
  }

  unequip(player, slot) {
    const item = player.equipment[slot];
    if (!item || player.inventory.length >= player.bagSize) return false;
    delete player.equipment[slot];
    player.inventory.push(item);
    player.recomputeStats();
    player.invDirty = true;
    return true;
  }

  clampToWorld(e) {
    e.x = Math.max(1, Math.min(this.w - 1, e.x));
    e.z = Math.max(1, Math.min(this.h - 1, e.z));
  }

  // -------- simulation --------
  update(dt, now, events) {
    for (const e of this.entities.values()) {
      if (e.dead) { this.handleRespawn(e, now, events); continue; }
      this.tickTimedEffects(e, now, events);
      if (e.cast && now >= e.cast.endAt) finishCast(this, e, now, events);
      if (e.type === ENT.PLAYER) this.movePlayer(e, dt, now);
      else if (e.type === ENT.MONSTER) this.updateMob(e, dt, now, events);
      if (!e.dead && e.hp <= 0) e.hp = 1;
    }
  }

  movePlayer(e, dt, now) {
    const i = e.input;
    let mx = i.mx, mz = i.mz;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      const sp = e.speed(now);
      e.x += mx * sp * dt; e.z += mz * sp * dt;
      this.clampToWorld(e);
    }
    if (typeof i.rot === "number") e.rot = i.rot;
  }

  updateMob(e, dt, now, events) {
    const ai = e.ai;
    const sp = e.speed(now);
    let tgt = e.target ? this.get(e.target) : null;
    if (tgt && (tgt.dead || tgt.type !== ENT.PLAYER)) { tgt = null; e.target = 0; }
    if (tgt && dist(e, { x: ai.homeX, z: ai.homeZ }) > ai.tpl.leash) { tgt = null; e.target = 0; }
    if (!tgt) {
      let best = null, bestD = ai.tpl.aggro;
      for (const p of this.entities.values()) {
        if (p.type !== ENT.PLAYER || p.dead) continue;
        const d = dist(e, p);
        if (d < bestD && dist(p, { x: ai.homeX, z: ai.homeZ }) <= ai.tpl.leash) { best = p; bestD = d; }
      }
      if (best) { e.target = best.id; tgt = best; }
    }

    if (tgt) {
      const d = dist(e, tgt);
      const reach = ai.tpl.attackRange + tgt.radius + e.radius;
      e.rot = Math.atan2(tgt.x - e.x, tgt.z - e.z);
      if (d > reach) { e.x += Math.sin(e.rot) * sp * dt; e.z += Math.cos(e.rot) * sp * dt; this.clampToWorld(e); }
      else if (now >= ai.attackReadyAt) { ai.attackReadyAt = now + ai.tpl.attackCd * 1000; mobMelee(this, e, tgt, events); }
    } else {
      const dHome = dist(e, { x: ai.homeX, z: ai.homeZ });
      if (dHome > 1.5) {
        const ang = Math.atan2(ai.homeX - e.x, ai.homeZ - e.z);
        e.rot = ang; e.x += Math.sin(ang) * sp * dt; e.z += Math.cos(ang) * sp * dt;
      } else if (now >= ai.wanderAt) {
        ai.wanderAt = now + (2000 + Math.random() * 3000);
        ai.wx = ai.homeX + (Math.random() * 6 - 3); ai.wz = ai.homeZ + (Math.random() * 6 - 3);
      } else if (Math.hypot(ai.wx - e.x, ai.wz - e.z) > 0.3) {
        const ang = Math.atan2(ai.wx - e.x, ai.wz - e.z);
        e.rot = ang; e.x += Math.sin(ang) * sp * 0.4 * dt; e.z += Math.cos(ang) * sp * 0.4 * dt;
      }
    }
  }

  tickTimedEffects(e, now, events) {
    if (e.dots.length) {
      for (const d of e.dots) {
        while (d.times > 0 && now >= d.next) {
          d.times -= 1; d.next += d.every;
          if (d.kind === "dot") {
            const amt = Math.max(1, Math.round(d.power * 0.6));
            if (e.absorb > 0) { const s = Math.min(e.absorb, amt); e.absorb -= s; e.hp -= (amt - s); } else e.hp -= amt;
            e.inCombatUntil = now + 5000;
            events.push({ type: EVENT.DAMAGE, target: e.id, by: d.srcId, amount: amt, crit: false, skill: d.skill });
            if (e.hp <= 0 && !e.dead) death(this, e, d.srcId, events);
          } else {
            const amt = Math.max(1, Math.round(d.power * 0.6));
            e.hp = Math.min(e.maxhp, e.hp + amt);
            events.push({ type: EVENT.HEAL, target: e.id, by: d.srcId, amount: amt, skill: d.skill });
          }
        }
      }
      e.dots = e.dots.filter((d) => d.times > 0);
    }

    if (e.buffs.length) {
      const live = [];
      for (const b of e.buffs) { if (now >= b.until) { if (b.absorb) e.absorb = 0; } else live.push(b); }
      e.buffs = live;
    }

    if (now - e.lastRegenAt >= REGEN_INTERVAL * 1000) {
      e.lastRegenAt = now;
      const regenBuff = e.buffs.reduce((s, b) => s + (b.regen || 0), 0);
      e.mp = Math.min(e.maxmp, e.mp + e.mpRegen + regenBuff);
      if (!e.inCombat(now)) e.hp = Math.min(e.maxhp, e.hp + e.hpRegen + regenBuff);
      else e.hp = Math.min(e.maxhp, e.hp + Math.floor(e.hpRegen * 0.25));
    }
  }

  handleRespawn(e, now, events) {
    if (now < e.respawnAt) return;
    if (e.type === ENT.MONSTER) {
      e.dead = false; e.hp = e.maxhp; e.target = 0; e.x = e.ai.homeX; e.z = e.ai.homeZ;
      events.push({ type: EVENT.RESPAWN, id: e.id });
    } else if (e.type === ENT.PLAYER) {
      e.dead = false; e.hp = e.maxhp; e.mp = e.maxmp; e.target = 0;
      e.x = this.spawn.x + (Math.random() * 6 - 3); e.z = this.spawn.z + (Math.random() * 4 - 2);
      events.push({ type: EVENT.RESPAWN, id: e.id });
    }
  }

  snapshotFor(player) {
    const out = [];
    for (const e of this.entities.values()) {
      if (e.id !== player.id && dist(e, player) > SNAPSHOT_RANGE) continue;
      out.push(e.serialize());
    }
    return out;
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
