// Open makegame in the debugged browser, auto-join, wait, screenshot to a PNG.
// Usage: node cdp-screenshot.js [outPath]   (browser :9222 + server :8787 required)
import http from "node:http";
import fs from "node:fs";
import { WebSocket } from "ws";

const CDP = 9222, APP = "http://localhost:8787/";
const OUT = process.argv[2] || "/tmp/makegame-shot.png";

const httpJson = (method, path) => new Promise((res, rej) => {
  const req = http.request({ host: "localhost", port: CDP, path, method }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(b ? JSON.parse(b) : {}); } catch { res({}); } }); });
  req.on("error", rej); req.end();
});
function rpc(ws) { let id = 0; const p = {}; ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && p[m.id]) { p[m.id](m); delete p[m.id]; } }); return (method, params = {}) => new Promise((res, rej) => { const mid = ++id; p[mid] = (m) => (m.error ? rej(new Error(method + ":" + JSON.stringify(m.error))) : res(m.result)); ws.send(JSON.stringify({ id: mid, method, params })); }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let tab = await httpJson("PUT", "/json/new?" + encodeURIComponent(APP));
  if (!tab?.webSocketDebuggerUrl) tab = await httpJson("GET", "/json/new?" + encodeURIComponent(APP));
  const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
  await new Promise((r) => ws.on("open", r));
  const call = rpc(ws);
  await call("Page.enable"); await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 960, height: 600, deviceScaleFactor: 1, mobile: false }).catch(() => {});
  await sleep(1600);
  await call("Runtime.evaluate", { expression: "document.getElementById('play').click()" });
  await sleep(3000);                                  // let world render + mobs move
  if (process.env.OPEN_INV) { await call("Runtime.evaluate", { expression: "window.__mg && window.__mg.actions.toggleInventory()" }); await sleep(600); }
  const shot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
  await httpJson("GET", "/json/close/" + tab.id);
  ws.close();
  console.log("wrote " + OUT);
  process.exit(0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
