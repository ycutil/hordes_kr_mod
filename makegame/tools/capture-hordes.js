// Capture real hordes.io WebSocket frames via CDP and summarize opcodes/sizes.
// The game protocol is binary; first byte of each frame is the message opcode,
// which maps to the registry order in client.js (see PROTOCOL.md).
//
// Usage: node tools/capture-hordes.js [seconds]   (browser on :9222, hordes tab in-world for game frames)
import http from "node:http";
import { WebSocket } from "ws";

const CDP = process.env.CDP_PORT || 9222;
const MATCH = process.env.CDP_TARGET || "hordes.io";
const SECONDS = +(process.argv[2] || 8);

const httpJson = (p) => new Promise((res, rej) => {
  http.get({ host: "localhost", port: CDP, path: p }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej);
});
function rpc(ws) { let id = 0; const p = {}; ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && p[m.id]) { p[m.id](m); delete p[m.id]; } }); return (method, params = {}) => new Promise((res, rej) => { const mid = ++id; p[mid] = (m) => (m.error ? rej(new Error(method + ":" + JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id: mid, method, params })); }); }

(async () => {
  const tabs = (await httpJson("/json")).filter((t) => t.type === "page");
  const tab = tabs.find((t) => (t.url || "").includes(MATCH)) || tabs[0];
  if (!tab) { console.log("no tab"); process.exit(1); }
  console.log("attached:", tab.url);

  const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  await new Promise((r) => ws.on("open", r));
  const call = rpc(ws);

  const recv = {}, sent = {}, sample = {}; let sockets = 0, frames = 0;
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    if (m.method === "Network.webSocketCreated") sockets++;
    const tally = (tbl, dir, payload) => {
      frames++;
      let op = "?", buf = null;
      try { buf = Buffer.from(payload, "base64"); op = buf[0] ?? "?"; } catch { op = "txt"; }
      tbl[op] = (tbl[op] || 0) + 1;
      const k = dir + ":" + op;
      if (buf && !sample[k]) sample[k] = { len: buf.length, hex: buf.subarray(0, 28).toString("hex") };
    };
    if (m.method === "Network.webSocketFrameReceived") tally(recv, "recv", m.params.response.payloadData);
    if (m.method === "Network.webSocketFrameSent") tally(sent, "sent", m.params.response.payloadData);
  });

  await call("Network.enable");
  console.log(`capturing ${SECONDS}s ...`);
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  ws.close();

  console.log(JSON.stringify({ sockets, frames, recvByOpcode: recv, sentByOpcode: sent, samples: sample }, null, 2));
  if (frames === 0) console.log("\n(no WS frames — hordes tab is not in an active game session; enter the world then re-run)");
  process.exit(0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
