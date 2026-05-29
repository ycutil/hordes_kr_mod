// Message-type registry. The NAMES mirror the real hordes.io client.js wire
// protocol (extracted from the minified `Mt` registry):
//
//   client->server: clientPlayerInput, clientPlayerChangeTarget, clientPlayerSkill,
//                   clientPlayerEnvSkill, clientPlayerInteract, clientCommand
//   server->client: serverOnClientConnect, serverEntityDelta, serverPartyUpdate,
//                   serverWarUpdate, serverPartyPositions, serverChangeWorld,
//                   serverMapUpdate, serverChat, serverSystemMessage, serverQueue
//   both:           ping
//
// The real game packs these as compact BINARY (packData). For a readable
// learning clone we send JSON `{ t: <type>, ...fields }`. Same semantics,
// inspectable in devtools — which is the point of "implement by measuring".

export const C2S = {
  INPUT: "clientPlayerInput",            // { seq, mx, mz, rot } movement intent + facing
  CHANGE_TARGET: "clientPlayerChangeTarget", // { target }
  SKILL: "clientPlayerSkill",            // { id } skillbar slot id
  ENV_SKILL: "clientPlayerEnvSkill",     // { id, x, z } ground-targeted
  INTERACT: "clientPlayerInteract",      // { id }
  COMMAND: "clientCommand",              // { text }
  HELLO: "clientHello",                  // { name, class, faction } (join handshake)
  EQUIP: "clientEquip",                  // { uid }   equip a bag item
  UNEQUIP: "clientUnequip",              // { slot }  unequip to bag
  PING: "ping",
};

export const S2C = {
  CONNECT: "serverOnClientConnect",      // { selfId, tickRate, world }
  ENTITY_DELTA: "serverEntityDelta",     // { tick, entities:[...], events:[...] }
  PARTY_UPDATE: "serverPartyUpdate",
  WAR_UPDATE: "serverWarUpdate",
  MAP_UPDATE: "serverMapUpdate",         // { props:[...] } static decoration
  CHAT: "serverChat",                    // { from, channel, text }
  SYSTEM: "serverSystemMessage",         // { text }
  QUEUE: "serverQueue",
  CHANGE_WORLD: "serverChangeWorld",
  INVENTORY: "serverInventory",          // { equipment, inventory, stats }
  PONG: "ping",
};

// Combat / world event kinds carried inside ENTITY_DELTA.events.
export const EVENT = {
  DAMAGE: "damage",     // { target, amount, crit, skill }
  HEAL: "heal",         // { target, amount, skill }
  DEATH: "death",       // { id, by }
  CAST: "cast",         // { id, skill, castEnd }   (cast started)
  CAST_DONE: "castdone",// { id }
  LEVELUP: "levelup",   // { id, level }
  RESPAWN: "respawn",   // { id }
  LOOT: "loot",         // { to, item }  item dropped to a player's bag
};
