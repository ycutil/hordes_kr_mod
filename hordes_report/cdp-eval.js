#!/usr/bin/env node
// CDP helper: evaluate JS in the hordes.io /play tab and print the JSON result.
// Usage:
//   node cdp-eval.js "expression"            -> evaluate inline expression
//   node cdp-eval.js --file path.js          -> evaluate file contents
//   node cdp-eval.js --list                  -> list targets
// Reads from a running Chrome/Brave with --remote-debugging-port=9222.

const WebSocket = require("ws");
const fs = require("fs");
const http = require("http");

const PORT = process.env.CDP_PORT || 9222;
const TARGET_URL_MATCH = process.env.CDP_TARGET || "hordes.io";

function httpJson(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "localhost", port: PORT, path }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function pickTarget() {
  const list = await httpJson("/json");
  const pages = list.filter((t) => t.type === "page");
  const match =
    pages.find((t) => (t.url || "").includes(TARGET_URL_MATCH)) || pages[0];
  if (!match) throw new Error("No page target found");
  return match;
}

function evalInPage(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    let id = 0;
    const pending = {};
    function send(method, params) {
      return new Promise((res, rej) => {
        const mid = ++id;
        pending[mid] = (msg) => {
          if (msg.error) rej(new Error(method + " failed: " + JSON.stringify(msg.error)));
          else res(msg.result);
        };
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    }
    ws.on("open", async () => {
      await send("Runtime.enable", {});
      const r = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
        allowUnsafeEvalBlockedByCSP: true,
        userGesture: true,
        timeout: 30000,
      });
      ws.close();
      if (r.exceptionDetails) {
        reject(new Error(JSON.stringify(r.exceptionDetails, null, 2)));
      } else {
        resolve(r.result && "value" in r.result ? r.result.value : r.result);
      }
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending[msg.id]) {
        pending[msg.id](msg);
        delete pending[msg.id];
      }
    });
    ws.on("error", reject);
  });
}

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === "--list") {
    const list = await httpJson("/json");
    console.log(JSON.stringify(list.map((t) => ({ type: t.type, title: t.title, url: t.url })), null, 2));
    return;
  }
  let expression;
  if (args[0] === "--file") {
    expression = fs.readFileSync(args[1], "utf8");
  } else {
    expression = args[0];
  }
  if (!expression) {
    console.error("No expression provided");
    process.exit(1);
  }
  const target = await pickTarget();
  const result = await evalInPage(target.webSocketDebuggerUrl, expression);
  if (typeof result === "string") console.log(result);
  else console.log(JSON.stringify(result, null, 2));
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
