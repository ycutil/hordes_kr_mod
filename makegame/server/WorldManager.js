// Holds all zone Worlds and routes players between them. Entity/item ids are
// allocated globally so they stay unique as players move across zones.
import { World } from "./World.js";
import { ZONES, START_ZONE } from "./data/zones.js";

export class WorldManager {
  constructor() {
    this.nextId = 1; this.nextItemId = 1;
    const ids = { entity: () => this.nextId++, item: () => this.nextItemId++ };
    this.worlds = new Map();
    for (const id of Object.keys(ZONES)) this.worlds.set(id, new World(ZONES[id], ids));
  }

  get(id) { return this.worlds.get(id); }
  worldOf(p) { return this.worlds.get(p.worldId); }

  addPlayer(hello, conn) {
    const w = this.worlds.get(START_ZONE);
    const p = w.addPlayer(hello, conn);
    p.worldId = w.id;
    return p;
  }

  remove(p) { const w = this.worldOf(p); if (w) w.remove(p.id); }

  // Move a player entity to another zone at (x,z). Returns the destination World.
  move(p, toId, x, z) {
    const from = this.worldOf(p);
    if (from) from.entities.delete(p.id);
    const to = this.worlds.get(toId) || from;
    p.x = x; p.z = z; p.worldId = to.id;
    p.target = 0; p.cast = null; p.input.mx = 0; p.input.mz = 0;
    to.entities.set(p.id, p);
    return to;
  }
}
