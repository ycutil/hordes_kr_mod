// Zone (world) definitions. Each zone is an independent World instance with its
// own mob spawns, decoration, and portals. Portals move a player to another
// zone via serverChangeWorld (real hordes uses this message between maps).

export const ZONES = {
  starter: {
    id: "starter", name: "Greenfields", w: 140, h: 140, spawn: { x: 70, z: 120 },
    mobs: [
      ...grid("rat", 28, 78, 4, 3, 7),
      ...grid("wolf", 92, 70, 3, 3, 8),
    ],
    decor: [{ kind: "water", x: 70, z: 92, r: 10 }],
    portals: [{ x: 70, z: 10, r: 3, to: "forest", toX: 70, toZ: 120, label: "→ Darkwood" }],
  },
  forest: {
    id: "forest", name: "Darkwood", w: 140, h: 140, spawn: { x: 70, z: 120 },
    mobs: [
      ...grid("bandit", 44, 60, 4, 2, 9),
      { type: "ogre", x: 70, z: 30 }, { type: "ogre", x: 48, z: 36 }, { type: "ogre", x: 92, z: 36 },
    ],
    decor: [{ kind: "water", x: 40, z: 50, r: 8 }, { kind: "water", x: 100, z: 80, r: 9 }],
    portals: [{ x: 70, z: 10, r: 3, to: "starter", toX: 70, toZ: 110, label: "→ Greenfields" }],
  },
};

export const START_ZONE = "starter";

function grid(type, x0, z0, cols, rows, step) {
  const out = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out.push({ type, x: x0 + c * step, z: z0 + r * step });
  return out;
}
