// Poll the hordes.io runtime via CDP until EpicHealer14 appears as a loaded
// entity or joins the party, then dump location + visual/equipment + skin.
const WebSocket = require("ws");
const http = require("http");
const TARGET = "EpicHealer14";
const PORT = 9222;

function httpJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "localhost", port: PORT, path }, (res) => {
      let b = ""; res.on("data", c => b += c); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

const EXPR = `(()=>{const rt=window.__HORDES_KR_RUNTIME__;if(!rt)return JSON.stringify({err:'no runtime'});const players=rt.engine.entities.type[0];const hit=players.find(p=>p&&p.name===${JSON.stringify(TARGET)});const summary={t:Date.now(),loaded:players.map(p=>p.name),myParty:rt.player.party};if(hit){const eq={};for(const k of Object.keys(hit)){if(/equip|gear|skin|item|visual|body|wear|armor|weapon/i.test(k)){const v=hit[k];eq[k]=(v&&typeof v==='object')?(Array.isArray(v)?'arr['+v.length+']':v.constructor&&v.constructor.name):v;}}let vis=null;try{const vv=hit.visual;if(vv){vis={skinId:vv.skin&&vv.skin.id,bodyLen:vv.body&&vv.body.length,meshes:vv.meshes&&vv.meshes.length};}}catch(e){vis='ERR'+e.message;}summary.FOUND={name:hit.name,id:hit.id,level:hit.level,class:hit.class,faction:hit.faction,clan:hit.clan,party:hit.party,pos:hit.pos?[hit.pos[0],hit.pos[1],hit.pos[2]]:null,skin:hit.skin,gearFields:eq,visual:vis};}return JSON.stringify(summary);})()`;

async function evalOnce() {
  const list = await httpJson("/json");
  const page = list.find(t => t.type === "page" && (t.url || "").includes("hordes.io")) || list.find(t => t.type === "page");
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
    let id = 0; const pend = {};
    const send = (m, p) => new Promise((r) => { const mid = ++id; pend[mid] = r; ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
    ws.on("open", async () => {
      await send("Runtime.enable", {});
      const r = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true, awaitPromise: true, timeout: 10000 });
      ws.close();
      resolve(r.result && r.result.value);
    });
    ws.on("message", (d) => { const m = JSON.parse(d); if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; } });
    ws.on("error", reject);
  });
}

(async () => {
  const start = Date.now();
  const DURATION = 175000; // ~3 min
  let n = 0;
  while (Date.now() - start < DURATION) {
    n++;
    try {
      const out = await evalOnce();
      const parsed = JSON.parse(out);
      if (parsed.FOUND) {
        console.log("=== FOUND EpicHealer14 ===");
        console.log(JSON.stringify(parsed.FOUND, null, 2));
        process.exit(0);
      }
      console.log(`[poll ${n}] party=${parsed.myParty} loaded=[${parsed.loaded.join(",")}]`);
    } catch (e) {
      console.log(`[poll ${n}] ERR ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 8000));
  }
  console.log("=== TIMEOUT: EpicHealer14 never loaded / never accepted within window ===");
})();
