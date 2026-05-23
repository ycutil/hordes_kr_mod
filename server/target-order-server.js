"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { WebSocket, WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
const DATA_FILE = process.env.TARGET_ORDER_DATA || path.join(__dirname, "target-order-data.json");

const state = loadState();
const clientsByRoom = new Map();

const server = http.createServer(handleHttpRequest);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.meta = null;

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw || ""));
    } catch {
      send(ws, { type: "error", reason: "bad_json", message: "Invalid JSON" });
      return;
    }

    handleSocketMessage(ws, message);
  });

  ws.on("close", () => {
    leaveRoom(ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[target-order] listening on http://${HOST}:${PORT}`);
  if (ADMIN_TOKEN === "change-me") {
    console.warn("[target-order] ADMIN_TOKEN is using the default value. Set ADMIN_TOKEN before exposing this server.");
  }
});

function handleSocketMessage(ws, message) {
  if (!message || typeof message !== "object") {
    send(ws, { type: "error", reason: "bad_message" });
    return;
  }

  if (message.type === "join") {
    handleJoin(ws, message);
    return;
  }

  if (!ws.meta) {
    send(ws, { type: "error", reason: "not_joined" });
    return;
  }

  if (message.type === "target-call") {
    handleTargetCall(ws, message);
  } else if (message.type === "ping") {
    send(ws, { type: "pong", now: Date.now() });
  } else {
    send(ws, { type: "error", reason: "unknown_type" });
  }
}

function handleJoin(ws, message) {
  const roomId = normalizeId(message.roomId, 48);
  const userName = normalizeName(message.userName, 32);
  const clientToken = String(message.clientToken || "").trim();
  const room = state.rooms[roomId];

  if (!roomId || !userName || !clientToken) {
    send(ws, { type: "error", reason: "missing_join_fields" });
    ws.close(1008, "missing join fields");
    return;
  }

  if (!room || !room.users || room.users[userName] !== clientToken) {
    send(ws, { type: "error", reason: "auth_failed" });
    ws.close(1008, "auth failed");
    return;
  }

  leaveRoom(ws);
  ws.meta = {
    roomId,
    userName,
    joinedAt: Date.now(),
    version: String(message.version || ""),
  };

  if (!clientsByRoom.has(roomId)) clientsByRoom.set(roomId, new Set());
  clientsByRoom.get(roomId).add(ws);

  send(ws, {
    type: "joined",
    roomId,
    userName,
    allowedOrder: isOrderAllowed(room, userName),
    users: getConnectedUsers(roomId),
  });
  broadcastUserList(roomId);
}

function handleTargetCall(ws, message) {
  const meta = ws.meta;
  const room = state.rooms[meta.roomId];
  if (!room || !isOrderAllowed(room, meta.userName)) {
    send(ws, { type: "target-call-denied", reason: "not_allowed" });
    return;
  }

  const targetName = normalizeName(message.targetName, 48);
  if (!targetName) {
    send(ws, { type: "target-call-denied", reason: "missing_target" });
    return;
  }

  const payload = {
    type: "target-call",
    id: crypto.randomUUID(),
    roomId: meta.roomId,
    senderName: meta.userName,
    targetId: normalizeId(message.targetId, 64),
    targetName,
    targetPosition: normalizePosition(message.targetPosition),
    visualPosition: normalizePosition(message.visualPosition),
    distance: Number.isFinite(Number(message.distance)) ? Number(message.distance) : null,
    sentAt: Number(message.sentAt) || Date.now(),
    relayedAt: Date.now(),
  };

  broadcast(meta.roomId, payload, ws);
  send(ws, {
    type: "target-call-accepted",
    id: payload.id,
    targetName: payload.targetName,
    relayedAt: payload.relayedAt,
  });
}

function leaveRoom(ws) {
  const meta = ws.meta;
  if (!meta) return;

  const clients = clientsByRoom.get(meta.roomId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) clientsByRoom.delete(meta.roomId);
  }
  ws.meta = null;
  broadcastUserList(meta.roomId);
}

function broadcast(roomId, payload, exceptWs = null) {
  const clients = clientsByRoom.get(roomId);
  if (!clients) return;

  for (const client of clients) {
    if (client === exceptWs || client.readyState !== WebSocket.OPEN) continue;
    send(client, payload);
  }
}

function broadcastUserList(roomId) {
  broadcast(roomId, {
    type: "user-list",
    roomId,
    users: getConnectedUsers(roomId),
  });
}

function send(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function isOrderAllowed(room, userName) {
  const allowed = Array.isArray(room.allowedOrderUsers) ? room.allowedOrderUsers : [];
  return allowed.some((name) => name.toLowerCase() === userName.toLowerCase());
}

function getConnectedUsers(roomId) {
  const clients = clientsByRoom.get(roomId);
  if (!clients) return [];

  return [...clients]
    .filter((client) => client.readyState === WebSocket.OPEN && client.meta)
    .map((client) => ({
      userName: client.meta.userName,
      version: client.meta.version,
      allowedOrder: isOrderAllowed(state.rooms[roomId] || {}, client.meta.userName),
      joinedAt: client.meta.joinedAt,
    }));
}

function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true, rooms: Object.keys(state.rooms).length });
    return;
  }

  if (url.pathname === "/admin" && req.method === "GET") {
    if (!isAdmin(url)) return sendText(res, 403, "Forbidden");
    sendHtml(res, renderAdminPage(url.searchParams.get("token") || ""));
    return;
  }

  if (url.pathname === "/admin" && req.method === "POST") {
    if (!isAdmin(url)) return sendText(res, 403, "Forbidden");
    readRequestBody(req, (body) => {
      const form = new URLSearchParams(body);
      handleAdminAction(form);
      redirect(res, `/admin?token=${encodeURIComponent(url.searchParams.get("token") || "")}`);
    });
    return;
  }

  sendText(res, 404, "Not found");
}

function isAdmin(url) {
  return (url.searchParams.get("token") || "") === ADMIN_TOKEN;
}

function handleAdminAction(form) {
  const action = form.get("action") || "";
  const roomId = normalizeId(form.get("roomId"), 48);
  if (!roomId) return;

  if (action === "create-room") {
    ensureRoom(roomId);
  } else if (action === "delete-room") {
    delete state.rooms[roomId];
    const clients = clientsByRoom.get(roomId);
    if (clients) {
      for (const client of clients) client.close(1008, "room deleted");
      clientsByRoom.delete(roomId);
    }
  } else if (action === "upsert-user") {
    const room = ensureRoom(roomId);
    const userName = normalizeName(form.get("userName"), 32);
    const token = String(form.get("clientToken") || "").trim() || generateToken();
    if (userName) room.users[userName] = token;
  } else if (action === "delete-user") {
    const room = ensureRoom(roomId);
    const userName = normalizeName(form.get("userName"), 32);
    if (userName) {
      delete room.users[userName];
      room.allowedOrderUsers = room.allowedOrderUsers.filter((name) => name.toLowerCase() !== userName.toLowerCase());
    }
  } else if (action === "allow-order") {
    const room = ensureRoom(roomId);
    const userName = normalizeName(form.get("userName"), 32);
    if (userName && !isOrderAllowed(room, userName)) room.allowedOrderUsers.push(userName);
  } else if (action === "revoke-order") {
    const room = ensureRoom(roomId);
    const userName = normalizeName(form.get("userName"), 32);
    room.allowedOrderUsers = room.allowedOrderUsers.filter((name) => name.toLowerCase() !== userName.toLowerCase());
  }

  saveState();
  broadcastUserList(roomId);
}

function ensureRoom(roomId) {
  if (!state.rooms[roomId]) {
    state.rooms[roomId] = {
      users: {},
      allowedOrderUsers: [],
      createdAt: new Date().toISOString(),
    };
  }
  if (!state.rooms[roomId].users) state.rooms[roomId].users = {};
  if (!Array.isArray(state.rooms[roomId].allowedOrderUsers)) state.rooms[roomId].allowedOrderUsers = [];
  return state.rooms[roomId];
}

function renderAdminPage(token) {
  const rooms = Object.entries(state.rooms)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([roomId, room]) => renderRoom(roomId, room, token))
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hordes Target Order Admin</title>
  <style>
    body { margin: 24px; background: #10131d; color: #dff8f5; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    h1, h2 { margin: 0 0 12px; }
    form { margin: 0; }
    input, button { border: 1px solid #49656b; border-radius: 5px; background: #050914; color: #dff8f5; padding: 7px 9px; font: inherit; }
    button { cursor: pointer; font-weight: 800; background: #29434a; }
    .toolbar, .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
    .room { border: 1px solid #49656b; border-radius: 8px; padding: 14px; margin-top: 14px; background: rgba(255,255,255,.04); }
    .muted { color: #8ea6aa; }
    code { color: #f5c247; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-top: 1px solid rgba(166,220,213,.18); padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <h1>Hordes Target Order Admin</h1>
  <form class="toolbar" method="post" action="/admin?token=${encodeURIComponent(token)}">
    <input type="hidden" name="action" value="create-room" />
    <input name="roomId" placeholder="room id" />
    <button type="submit">방 생성</button>
  </form>
  ${rooms || '<p class="muted">생성된 방이 없습니다.</p>'}
</body>
</html>`;
}

function renderRoom(roomId, room, token) {
  const users = Object.entries(room.users || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([userName, clientToken]) => {
      const allowed = isOrderAllowed(room, userName);
      return `<tr>
        <td>${escapeHtml(userName)}</td>
        <td><code>${escapeHtml(clientToken)}</code></td>
        <td>${allowed ? "가능" : "불가"}</td>
        <td class="row">
          <form method="post" action="/admin?token=${encodeURIComponent(token)}">
            <input type="hidden" name="action" value="${allowed ? "revoke-order" : "allow-order"}" />
            <input type="hidden" name="roomId" value="${escapeAttr(roomId)}" />
            <input type="hidden" name="userName" value="${escapeAttr(userName)}" />
            <button type="submit">${allowed ? "오더 해제" : "오더 허용"}</button>
          </form>
          <form method="post" action="/admin?token=${encodeURIComponent(token)}">
            <input type="hidden" name="action" value="delete-user" />
            <input type="hidden" name="roomId" value="${escapeAttr(roomId)}" />
            <input type="hidden" name="userName" value="${escapeAttr(userName)}" />
            <button type="submit">삭제</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");
  const connected = getConnectedUsers(roomId)
    .map((user) => `${escapeHtml(user.userName)}${user.allowedOrder ? " *" : ""}`)
    .join(", ");

  return `<section class="room">
    <h2>${escapeHtml(roomId)}</h2>
    <p class="muted">접속자: ${connected || "없음"} / * 오더 가능</p>
    <form class="row" method="post" action="/admin?token=${encodeURIComponent(token)}">
      <input type="hidden" name="action" value="upsert-user" />
      <input type="hidden" name="roomId" value="${escapeAttr(roomId)}" />
      <input name="userName" placeholder="user name" />
      <input name="clientToken" placeholder="token 비우면 자동 생성" />
      <button type="submit">유저 저장</button>
    </form>
    <table>
      <thead><tr><th>유저</th><th>토큰</th><th>오더</th><th>관리</th></tr></thead>
      <tbody>${users || '<tr><td colspan="4" class="muted">등록된 유저가 없습니다.</td></tr>'}</tbody>
    </table>
    <form class="row" method="post" action="/admin?token=${encodeURIComponent(token)}">
      <input type="hidden" name="action" value="delete-room" />
      <input type="hidden" name="roomId" value="${escapeAttr(roomId)}" />
      <button type="submit">방 삭제</button>
    </form>
  </section>`;
}

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.rooms ? parsed : { rooms: {} };
  } catch {
    return { rooms: {} };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function readRequestBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 20000) req.destroy();
  });
  req.on("end", () => callback(body));
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function normalizeId(value, maxLength) {
  return String(value || "").trim().replace(/[^\w:.-]/g, "").slice(0, maxLength);
}

function normalizeName(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizePosition(value) {
  if (!Array.isArray(value)) return null;
  const position = value.slice(0, 3).map(Number);
  return position.length === 3 && position.every(Number.isFinite) ? position : null;
}

function generateToken() {
  return crypto.randomBytes(12).toString("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
