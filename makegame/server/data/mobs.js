// Monster templates + per-zone spawn tables. Monsters are entity type MONSTER,
// class MONSTER, faction NEUTRAL (hostile to all players for this slice).

export const MOBS = {
  rat: {
    name: "Cave Rat", level: 2,
    hp: 60, power: 8, armor: 2,
    speed: 5.5, radius: 0.4, size: 0.7,
    aggro: 9, leash: 16, attackRange: 1.6, attackCd: 1.6,
    exp: 18,
  },
  wolf: {
    name: "Gray Wolf", level: 5,
    hp: 130, power: 14, armor: 4,
    speed: 7.6, radius: 0.5, size: 1.0,
    aggro: 12, leash: 22, attackRange: 1.8, attackCd: 1.4,
    exp: 38,
  },
  bandit: {
    name: "Bandit", level: 8,
    hp: 220, power: 20, armor: 8,
    speed: 6.8, radius: 0.45, size: 1.0,
    aggro: 11, leash: 20, attackRange: 2.0, attackCd: 1.5,
    exp: 70,
  },
  ogre: {
    name: "Ogre Brute", level: 12,
    hp: 520, power: 34, armor: 14,
    speed: 5.2, radius: 0.8, size: 1.6,
    aggro: 13, leash: 24, attackRange: 2.6, attackCd: 2.2,
    exp: 160,
  },
};

// Spawn points for the single starter zone. Each spawns a mob of `type`
// at (x,z) and respawns it after death.
export const SPAWNS = [
  ...grid("rat", 28, 78, 4, 3, 7),
  ...grid("wolf", 92, 70, 3, 3, 8),
  ...grid("bandit", 60, 40, 3, 2, 9),
  { type: "ogre", x: 70, z: 20 },
  { type: "ogre", x: 50, z: 24 },
  { type: "ogre", x: 90, z: 24 },
];

function grid(type, x0, z0, cols, rows, step) {
  const out = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      out.push({ type, x: x0 + c * step, z: z0 + r * step });
  return out;
}
