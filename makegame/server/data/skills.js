// Skill definitions. Names are the real hordes.io skill names per class; the
// mechanical numbers (cast/cd/range/mana/power) are tuned approximations.
//
// kind:   'dmg' direct damage to current target | 'aoe' damage around target/ground
//         | 'heal' heal self or friendly target | 'dash' movement | 'buff' self buff
// target: 'enemy' needs hostile target | 'self' | 'ground' | 'friendly'
// cast:   seconds of cast time (0 = instant). cd: cooldown seconds.
// range:  max world-units to target. mana: cost. power: damage/heal scalar (× caster.power).
// projectile: optional units/sec for a visible travelling shot.

export const SKILLS = {
  // ---- Archer ----
  swiftshot:   { name: "Swift Shot",    kind: "dmg",  target: "enemy", cast: 0,    cd: 0.0,  range: 22, mana: 4,  power: 0.9, projectile: 60 },
  preciseshot: { name: "Precise Shot",  kind: "dmg",  target: "enemy", cast: 1.1,  cd: 4.0,  range: 26, mana: 16, power: 2.6, projectile: 90 },
  serpent:     { name: "Serpent Arrow", kind: "dot",  target: "enemy", cast: 0,    cd: 7.0,  range: 22, mana: 14, power: 0.5, dot: { tick: 1.0, times: 5 }, projectile: 55 },
  cripple:     { name: "Cripple",       kind: "debuff", target: "enemy", cast: 0,  cd: 9.0,  range: 20, mana: 12, power: 0.3, slow: { amount: 0.5, dur: 3.0 }, projectile: 70 },
  dash:        { name: "Dash",          kind: "dash", target: "self",  cast: 0,    cd: 6.0,  range: 0,  mana: 8,  power: 0,   dashDist: 8 },

  // ---- Warrior ----
  bash:        { name: "Bash",          kind: "dmg",  target: "enemy", cast: 0,    cd: 0.0,  range: 2.4, mana: 5,  power: 1.0 },
  charge:      { name: "Charge",        kind: "dash", target: "enemy", cast: 0,    cd: 7.0,  range: 18, mana: 10, power: 0.8, charge: true },
  cripblow:    { name: "Crippling Blow",kind: "debuff", target: "enemy", cast: 0,  cd: 8.0,  range: 2.6, mana: 12, power: 1.4, slow: { amount: 0.4, dur: 3.0 } },
  bulwark:     { name: "Bulwark",       kind: "buff", target: "self",  cast: 0,    cd: 16.0, range: 0,  mana: 14, power: 0,  buff: { absorb: 160, dur: 6.0 } },
  taunt:       { name: "Taunt",         kind: "debuff", target: "enemy", cast: 0,  cd: 6.0,  range: 14, mana: 6,  power: 0.1, taunt: true },

  // ---- Mage ----
  icicle:      { name: "Icicle Orb",    kind: "dmg",  target: "enemy", cast: 0.8,  cd: 0.0,  range: 24, mana: 10, power: 1.3, projectile: 40 },
  icelance:    { name: "Ice Lance",     kind: "dmg",  target: "enemy", cast: 0,    cd: 5.0,  range: 24, mana: 16, power: 2.0, projectile: 80 },
  frostnova:   { name: "Frost Nova",    kind: "aoe",  target: "enemy", cast: 0,    cd: 9.0,  range: 22, mana: 22, power: 1.1, radius: 6, slow: { amount: 0.5, dur: 3.0 } },
  iceblock:    { name: "Ice Barrier",   kind: "buff", target: "self",  cast: 0,    cd: 20.0, range: 0,  mana: 20, power: 0,  buff: { absorb: 220, dur: 5.0 } },
  blink:       { name: "Blink",         kind: "dash", target: "self",  cast: 0,    cd: 8.0,  range: 0,  mana: 12, power: 0,  dashDist: 10 },

  // ---- Shaman ----
  lightning:   { name: "Lightning Strike", kind: "dmg", target: "enemy", cast: 0.9, cd: 0.0, range: 24, mana: 10, power: 1.4 },
  heal:        { name: "Healing",       kind: "heal", target: "friendly", cast: 1.4, cd: 0.0, range: 26, mana: 18, power: 2.2 },
  regrowth:    { name: "Regrowth",      kind: "hot",  target: "friendly", cast: 0,  cd: 6.0,  range: 26, mana: 16, power: 0.7, hot: { tick: 1.0, times: 5 } },
  cleanse:     { name: "Cleanse",       kind: "buff", target: "friendly", cast: 0,  cd: 8.0,  range: 26, mana: 10, power: 0,  cleanse: true },
  totem:       { name: "Healing Totem", kind: "buff", target: "self",  cast: 0,    cd: 18.0, range: 0,  mana: 22, power: 0,  buff: { regen: 14, dur: 8.0 } },
};

export function skillDef(id) {
  return SKILLS[id] || null;
}
