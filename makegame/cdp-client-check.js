// Live client check via CDP: open makegame in a NEW tab of the debugged
// browser, capture JS exceptions/console errors during load, auto-join, and
// verify the client connected (selfId set, entities populated). Closes the tab.
//
// Requires: browser on :9222 AND makegame server on :8787.
import http from "node:http";
import { WebSocket } from "ws";

const CDP = 9222;
const APP = process.env.APP || "http://localhost:8787/";

const httpJson = (method, path) => new Promise((res, rej) => {
  const req = http.request({ host: "localhost", port: CDP, path, method }, (r) => {
    let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(b ? JSON.parse(b) : {}); } catch { res({}); } });
  });
  req.on("error", rej); req.end();
});

function rpc(ws) {
  let id = 0; const pending = {};
  ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
  return (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending[mid] = (m) => (m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // open a new tab
  let tab = await httpJson("PUT", "/json/new?" + encodeURIComponent(APP));
  if (!tab || !tab.webSocketDebuggerUrl) tab = await httpJson("GET", "/json/new?" + encodeURIComponent(APP));
  if (!tab || !tab.webSocketDebuggerUrl) { console.log("FAIL: could not open tab", JSON.stringify(tab)); process.exit(2); }
  const targetId = tab.id;

  const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on("open", r));
  const call = rpc(ws);

  const errors = [];
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "exception");
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errors.push("log: " + m.params.entry.text);
  });

  await call("Runtime.enable");
  await call("Log.enable");
  await sleep(1800);                       // let module graph load

  // auto-join
  await call("Runtime.evaluate", { expression: "document.getElementById('play').click()" });
  await sleep(2600);                       // connect + a few server ticks

  const probe = await call("Runtime.evaluate", {
    expression: `JSON.stringify((()=>{const m=window.__mg;if(!m)return{loaded:false};const s=m.state;return{loaded:true,selfId:s.selfId,entities:s.entities.size,props:s.props.length,skillbar:s.skillbar.length,started:document.getElementById('start').classList.contains('hidden')};})())`,
    returnByValue: true,
  });
  const info = JSON.parse(probe.result.value || "{}");

  await httpJson("GET", "/json/close/" + targetId);
  ws.close();

  const pass = info.loaded && info.selfId > 0 && info.entities > 0 && errors.length === 0;
  console.log(JSON.stringify({ ...info, errors }, null, 2));
  console.log(pass ? "CLIENT CHECK PASS" : "CLIENT CHECK FAIL");
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.log("ERROR", e.message); process.exit(2); });
