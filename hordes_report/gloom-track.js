#!/usr/bin/env node
// Comprehensive Gloom-wall tracker. Captures EVERYTHING via CDP:
//   1) raw inbound/outbound WebSocket frames (full base64 payload + timestamp)
//   2) a 250ms page-side state snapshot (entity census, type-11 detail, big entities,
//      engine container sizes) — so the wall is caught wherever it lives.
// Auto-flags frames/snapshots where something spikes vs baseline.
//
// Usage:  node hordes_report/gloom-track.js [durationSeconds] [outPrefix]
//   default 900s (15 min).  Output: <prefix>.ws.jsonl, <prefix>.state.jsonl, <prefix>.events.log
// Start it when the boss is up; trigger the wall; Ctrl-C or let it run out. Then we analyze.

const WebSocket = require("/Users/haru/Documents/develope/AI/hordes_mod/node_modules/ws");
const http = require("http");
const fs = require("fs");

const PORT = process.env.CDP_PORT || 9222;
const TARGET = process.env.CDP_TARGET || "hordes.io/play";
const DURATION_MS = (parseInt(process.argv[2] || "900", 10)) * 1000;
const PREFIX = process.argv[3] || "/tmp/gloom_track";
const EVAL_MS = 250;

const wsOut = fs.createWriteStream(`${PREFIX}.ws.jsonl`, { flags: "w" });
const stateOut = fs.createWriteStream(`${PREFIX}.state.jsonl`, { flags: "w" });
const evOut = fs.createWriteStream(`${PREFIX}.events.log`, { flags: "w" });
function logEvent(s) { const line = `[${new Date().toISOString()}] ${s}`; console.log(line); evOut.write(line + "\n"); }

function httpJson(path) {
  return new Promise((res, rej) => {
    http.get({ host: "localhost", port: PORT, path }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej);
  });
}

// Page-side snapshot: comprehensive, bounded. Tracks where the wall might live.
const SNAPSHOT_FN = `(()=>{
  const rt=window.__HORDES_KR_RUNTIME__, eng=rt&&rt.engine, me=eng&&eng.player;
  if(!eng) return {noEngine:true};
  if(!me) return {t:typeof eng.time==='number'?+eng.time.toFixed(2):null, noPlayer:true};
  const arr=(eng.entities&&eng.entities.array)||[];
  const types={}; const t11=[]; const big=[];
  for(const e of arr){ if(!e)continue; types[e.type]=(types[e.type]||0)+1;
    if(e.type===11) t11.push([e.pos?Math.round(e.pos[0]*10)/10:null,e.pos?Math.round(e.pos[2]*10)/10:null,e.meshId,e.scale,e.netDeletion&&typeof e.netDeletion.end==='number'?+(e.netDeletion.end-eng.time).toFixed(1):null,e.rot?+(e.rot[1]||0).toFixed(2):null]);
    if((e.scale&&e.scale>=12)||(e.radius&&e.radius>=4)) big.push([e.type,e.name,e.meshId,e.scale,e.radius,e.pos?Math.round(e.pos[0]):null,e.pos?Math.round(e.pos[2]):null]);
  }
  // sizes of every array/map/{array} container on engine AND runtime (the wall may live here)
  const cont={};
  const scan=(obj,prefix)=>{ if(!obj)return; for(const k of Object.keys(obj)){ try{ const v=obj[k];
    if(!v||typeof v!=='object')continue;
    if(Array.isArray(v)) cont[prefix+k]=v.length;
    else if(v instanceof Map||v instanceof Set) cont[prefix+k]=v.size;
    else if(Array.isArray(v.array)) cont[prefix+k+'.array']=v.array.length;
    else if(typeof v.length==='number'&&v.length<100000&&v.length>=0) cont[prefix+k+'.len']=v.length;
  }catch(_){} } };
  scan(eng,'eng.'); scan(rt,'rt.');
  // boss cast state (the wall may be telegraphed by a boss skill)
  let boss=null;
  for(const e of arr){ if(e&&/gloom/i.test(String(e.name||''))){ const sk=e.skills; const ts=sk&&sk.timedSkill, tc=sk&&sk.timedCast;
    boss={nm:e.name,cid:e.creatureId,ts:ts&&ts.id!=null?ts.id:null,castRem:tc&&typeof tc.end==='number'?+(tc.end-eng.time).toFixed(2):null}; if(boss.ts!=null||boss.castRem>0)break; } }
  return {t:+eng.time.toFixed(2), tick:eng.tickId, my:me.pos?[Math.round(me.pos[0]),Math.round(me.pos[2])]:null, types, t11n:t11.length, t11, big, boss, cont};
})()`;

(async () => {
  const list = await httpJson("/json");
  const pages = list.filter((t) => t.type === "page");
  const target = pages.find((p) => (p.url || "").includes(TARGET)) || pages.find((p) => (p.url || "").includes("hordes.io")) || pages[0];
  if (!target) { console.error("no target"); process.exit(1); }
  logEvent(`tracking ${target.url}  for ${DURATION_MS / 1000}s -> ${PREFIX}.{ws,state,events}`);
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  let id = 0; const pending = {};
  const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });

  let wsFrames = 0, stateSnaps = 0;
  const t0 = Date.now();
  let baseContKeys = null, baseTypes = null;

  ws.on("message", (data) => {
    const m = JSON.parse(data);
    if (m.id && pending[m.id]) { pending[m.id](m.result); delete pending[m.id]; return; }
    if (m.method === "Network.webSocketFrameReceived" || m.method === "Network.webSocketFrameSent") {
      const dir = m.method.includes("Received") ? "in" : "out";
      const r = m.params.response || {};
      const payload = r.payloadData || "";
      wsFrames++;
      wsOut.write(JSON.stringify({ ms: Date.now() - t0, dir, op: r.opcode, len: payload.length, b64: payload }) + "\n");
    } else if (m.method === "Network.webSocketCreated") {
      logEvent(`WS created: ${m.params.url}`);
    }
  });

  await new Promise((r) => ws.on("open", r));
  await send("Network.enable", { maxTotalBufferSize: 100000000, maxResourceBufferSize: 50000000 });
  await send("Runtime.enable");
  logEvent("Network+Runtime enabled; capturing...");

  const evalTimer = setInterval(async () => {
    try {
      const res = await send("Runtime.evaluate", { expression: SNAPSHOT_FN, returnByValue: true });
      const v = res && res.result && res.result.value;
      if (!v || v.noEngine || v.noPlayer) { stateOut.write(JSON.stringify({ ms: Date.now() - t0, skip: v }) + "\n"); return; }
      stateSnaps++;
      stateOut.write(JSON.stringify({ ms: Date.now() - t0, ...v }) + "\n");
      // auto-flag spikes vs baseline
      if (!baseTypes) { baseTypes = v.types; baseContKeys = v.cont; }
      else {
        const flags = [];
        if (v.t11n >= 4) flags.push(`type11=${v.t11n}`);
        for (const k in v.types) { const b = (baseTypes[k] || 0); if (v.types[k] - b >= 4) flags.push(`type${k} ${b}->${v.types[k]}`); }
        // ignore chunk-streaming / combat-log noise — those grow as you move/fight, not the wall
        for (const k in v.cont) { if (/chunk|combatLog|finishedLoading/i.test(k)) continue; const b = baseContKeys[k]; if (b != null && v.cont[k] - b >= 5) flags.push(`${k} ${b}->${v.cont[k]}`); }
        if (v.big && v.big.length) flags.push(`big=${v.big.length}`);
        if (v.boss && (v.boss.ts != null || (v.boss.castRem && v.boss.castRem > 0))) flags.push(`BOSS-CAST ts=${v.boss.ts} rem=${v.boss.castRem}`);
        if (flags.length) logEvent(`SPIKE @${((Date.now() - t0) / 1000).toFixed(1)}s tick=${v.tick}: ${flags.join(", ")}  | t11sample=${JSON.stringify((v.t11 || []).slice(0, 4))}`);
      }
    } catch (e) { /* ignore eval error */ }
  }, EVAL_MS);

  const progressTimer = setInterval(() => logEvent(`progress: ${((Date.now() - t0) / 1000).toFixed(0)}s, wsFrames=${wsFrames}, stateSnaps=${stateSnaps}`), 30000);

  const stop = () => {
    clearInterval(evalTimer); clearInterval(progressTimer);
    logEvent(`DONE: wsFrames=${wsFrames}, stateSnaps=${stateSnaps}. files: ${PREFIX}.ws.jsonl / .state.jsonl / .events.log`);
    try { ws.close(); } catch {}
    wsOut.end(); stateOut.end(); evOut.end();
    setTimeout(() => process.exit(0), 300);
  };
  setTimeout(stop, DURATION_MS);
  process.on("SIGINT", stop);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
