// Thin WebSocket transport. JSON messages { t: type, ... } matching shared/protocol.
import { state } from "./state.js";

let socket = null;

export function connect(url, { onOpen, onMessage, onClose } = {}) {
  socket = new WebSocket(url);
  state.ws = socket;
  socket.addEventListener("open", () => { state.connected = true; onOpen && onOpen(); });
  socket.addEventListener("message", (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    onMessage && onMessage(msg);
  });
  socket.addEventListener("close", () => { state.connected = false; onClose && onClose(); });
  socket.addEventListener("error", () => { onClose && onClose(); });
}

export function send(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj));
}
