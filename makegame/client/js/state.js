// Shared client state singleton. Imported by net/input/render/ui/game.
export const state = {
  ws: null, connected: false,
  selfId: 0, name: "", cls: 2, faction: 0, speed: 7, skillbar: [],
  world: { w: 140, h: 140 }, props: [],
  entities: new Map(),     // id -> ent (authoritative tx/tz/trot + rendered rx/rz/rrot)
  target: 0,
  cam: { x: 70, z: 70 }, snapCam: true,
  view3d: true, r3dGround: null,   // 3D default; r3dGround set by render3d for aim raycast
  fx: [],                  // floating combat text { x, z, text, color, t, life }
  casts: new Map(),        // id -> { start, end, skill }
  cooldowns: {},           // skillId -> ready timestamp (client-optimistic)
  equipment: {}, inventory: [], stats: {}, invOpen: false,
  keys: new Set(),
  mouse: { x: 0, y: 0 },
  seq: 0,
  lastInputAt: 0,
  log: [],
  tickRate: 20,
  scale: 22,               // pixels per world unit
};

export function self() { return state.entities.get(state.selfId) || null; }

export function pushLog(text, cls = "") {
  state.log.unshift({ text, cls });
  if (state.log.length > 40) state.log.length = 40;
}
