// ==UserScript==
// @name         Hordes Behavior Recorder
// @namespace    https://hordes.io/
// @version      0.1.0
// @description  Records your real Hordes.io play into a statistical behavior profile (idle/move timing, daily rhythm, lingering spots) so the buffer bots can imitate your style. Read-only; no client.js hooking.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-idle
// @grant        unsafeWindow
// @inject-into  page
// @updateURL    https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/behavior_recorder/hordes-behavior-recorder.user.js
// @downloadURL  https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/behavior_recorder/hordes-behavior-recorder.user.js
// ==UserScript==

(function hordesBehaviorRecorder() {
  "use strict";

  const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  if (win.__HORDES_RECORDER__) return;

  const PANEL_BASE_URL = "https://kbr1.cafe24.com/hordes_panel";
  const PANEL_TOKEN = "f091c884e74edd251d897ceb23ce6f5d";
  const TICK_MS = 250;
  const STORAGE_KEY = "hordes_behavior_profile";
  const STORAGE_REC_KEY = "hordes_recorder_on";
  // Duration histogram buckets (ms upper bounds): 0.5s,1,2,4,8,16,32,64,128s,inf
  const BUCKETS = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, Infinity];
  const MOVE_EPS = 0.3;       // per-tick movement (units) above this = "moving"
  const SPOT_RADIUS = 6;      // cluster lingering positions within this distance
  const AFK_MS = 20000;       // idle longer than this counts as AFK

  function blankProfile() {
    return {
      v: 1, totalMs: 0, activeMs: 0, samples: 0,
      pauseHist: new Array(BUCKETS.length).fill(0),
      moveHist: new Array(BUCKETS.length).fill(0),
      hourActive: Array.from({ length: 24 }, () => ({ a: 0, t: 0 })),
      afkCount: 0, afkMs: 0,
      turnEvents: 0,
      spots: [], // {x,z,dwellMs,visits}
    };
  }

  const state = {
    on: readStored(STORAGE_REC_KEY) === "1",
    profile: loadProfile(),
    lastPos: null,
    lastRot: null,
    segMoving: null,
    segMs: 0,
    lastSpotKey: null,
    lastTickAt: 0,
    panel: null,
    shadow: null,
  };

  win.__HORDES_RECORDER__ = true;
  win.HordesRecorder = {
    start: () => setOn(true),
    stop: () => setOn(false),
    isOn: () => state.on,
    profile: () => summarize(state.profile),
    raw: () => state.profile,
    reset: () => { state.profile = blankProfile(); saveProfile(); setStatus("프로필 초기화"); },
    upload: () => uploadProfile(),
    download: () => downloadProfile(),
  };

  function getEngine() {
    const kr = win.__HORDES_KR_RUNTIME__;
    if (kr && kr.engine && kr.engine.player) return kr.engine;
    const bf = win.__HORDER_MOD_BUFFER_RUNTIME__;
    if (bf && bf.engine && bf.engine.player) return bf.engine;
    return null;
  }

  function kstHour() { return (new Date().getUTCHours() + 9) % 24; }
  function bucketOf(ms) { for (let i = 0; i < BUCKETS.length; i++) if (ms <= BUCKETS[i]) return i; return BUCKETS.length - 1; }

  function tick() {
    const now = Date.now();
    const dt = state.lastTickAt ? Math.min(now - state.lastTickAt, 4 * TICK_MS) : TICK_MS;
    state.lastTickAt = now;
    if (!state.on) return;
    const eng = getEngine();
    const p = eng && eng.player;
    if (!p || !p.pos) return;
    const pos = [p.pos[0], p.pos[2]];
    const rot = typeof p.rot === "number" ? p.rot : 0;
    const prof = state.profile;
    prof.totalMs += dt; prof.samples++;

    let moved = 0;
    if (state.lastPos) moved = Math.hypot(pos[0] - state.lastPos[0], pos[1] - state.lastPos[1]);
    const moving = moved > MOVE_EPS;

    // per-hour active fraction
    const h = prof.hourActive[kstHour()];
    h.t += dt; if (moving) h.a += dt;
    if (moving) prof.activeMs += dt;

    // segment tracking (flip => finalize previous duration into a histogram)
    if (state.segMoving === null) { state.segMoving = moving; state.segMs = dt; }
    else if (moving === state.segMoving) { state.segMs += dt; }
    else {
      const b = bucketOf(state.segMs);
      if (state.segMoving) prof.moveHist[b]++; else { prof.pauseHist[b]++; if (state.segMs >= AFK_MS) { prof.afkCount++; prof.afkMs += state.segMs; } }
      state.segMoving = moving; state.segMs = dt;
    }

    // lingering spots (accumulate dwell when idle)
    if (!moving) {
      let spot = null, best = SPOT_RADIUS;
      for (const s of prof.spots) { const d = Math.hypot(s.x - pos[0], s.z - pos[1]); if (d < best) { best = d; spot = s; } }
      if (!spot) { spot = { x: Math.round(pos[0]), z: Math.round(pos[1]), dwellMs: 0, visits: 0 }; prof.spots.push(spot); if (prof.spots.length > 120) prof.spots.shift(); }
      spot.dwellMs += dt;
      const key = Math.round(spot.x) + "," + Math.round(spot.z);
      if (state.lastSpotKey !== key) { spot.visits++; state.lastSpotKey = key; }
    } else {
      state.lastSpotKey = null;
    }

    // camera/turn activity
    if (state.lastRot != null) { let dr = Math.abs(rot - state.lastRot); if (dr > Math.PI) dr = 2 * Math.PI - dr; if (dr > 0.15) prof.turnEvents++; }

    state.lastPos = pos; state.lastRot = rot;
    if (prof.samples % 40 === 0) saveProfile(); // persist ~every 10s
  }

  function summarize(prof) {
    const top = prof.spots.slice().sort((a, b) => b.dwellMs - a.dwellMs).slice(0, 8)
      .map((s) => ({ x: s.x, z: s.z, dwellS: +(s.dwellMs / 1000).toFixed(0), visits: s.visits }));
    const hist = (arr) => arr.map((n) => n);
    return {
      recordedMin: +(prof.totalMs / 60000).toFixed(1),
      activePct: prof.totalMs ? +(100 * prof.activeMs / prof.totalMs).toFixed(0) : 0,
      pauseBuckets: hist(prof.pauseHist), moveBuckets: hist(prof.moveHist),
      afkCount: prof.afkCount, afkMin: +(prof.afkMs / 60000).toFixed(1),
      turnRatePerMin: prof.activeMs ? +(prof.turnEvents / (prof.activeMs / 60000)).toFixed(1) : 0,
      spots: prof.spots.length, topSpots: top,
      hourActive: prof.hourActive.map((h) => (h.t ? +(h.a / h.t).toFixed(2) : null)),
    };
  }

  async function uploadProfile() {
    try {
      const body = "action=profile&token=" + encodeURIComponent(PANEL_TOKEN)
        + "&profile=" + encodeURIComponent(JSON.stringify(state.profile));
      const res = await fetch(PANEL_BASE_URL + "/api.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
      const j = await res.json();
      setStatus(j && j.ok ? "프로필 업로드됨 (" + (state.profile.totalMs / 60000).toFixed(1) + "분)" : "업로드 실패");
      return j;
    } catch (e) { setStatus("업로드 오류: " + ((e && e.message) || e)); }
  }

  function downloadProfile() {
    try {
      const blob = new Blob([JSON.stringify(state.profile, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hordes_behavior_profile.json"; a.click();
    } catch { /* ignore */ }
  }

  function setOn(on) {
    state.on = Boolean(on);
    writeStored(STORAGE_REC_KEY, state.on ? "1" : "0");
    state.segMoving = null; state.segMs = 0; state.lastTickAt = 0;
    setStatus(state.on ? "기록 중…" : "정지");
    updatePanel();
  }

  // ---- persistence ----
  function loadProfile() { try { const r = readStored(STORAGE_KEY); const p = r ? JSON.parse(r) : null; return p && p.v === 1 ? normalize(p) : blankProfile(); } catch { return blankProfile(); } }
  function normalize(p) { const b = blankProfile(); return Object.assign(b, p, { pauseHist: pad(p.pauseHist, b.pauseHist), moveHist: pad(p.moveHist, b.moveHist), hourActive: p.hourActive && p.hourActive.length === 24 ? p.hourActive : b.hourActive, spots: Array.isArray(p.spots) ? p.spots : [] }); }
  function pad(a, def) { return Array.isArray(a) && a.length === def.length ? a : def; }
  function saveProfile() { try { writeStored(STORAGE_KEY, JSON.stringify(state.profile)); } catch { /* ignore */ } }
  function readStored(k) { try { return win.localStorage && win.localStorage.getItem(k); } catch { return null; } }
  function writeStored(k, v) { try { if (win.localStorage) win.localStorage.setItem(k, v); } catch { /* ignore */ } }

  // ---- minimal UI ----
  function initPanel() {
    if (document.getElementById("hordes-recorder-panel")) return;
    if (!document.body) { setTimeout(initPanel, 300); return; }
    const host = document.createElement("div");
    host.id = "hordes-recorder-panel";
    host.style.cssText = "all:initial;position:fixed;right:10px;bottom:240px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    state.shadow = shadow;
    shadow.innerHTML = `
      <style>
        .p{width:210px;border:1px solid rgba(129,148,168,.7);border-radius:8px;background:rgba(12,15,20,.94);color:#e5e7eb;box-shadow:0 12px 30px rgba(0,0,0,.4);overflow:hidden;font-size:12px}
        .h{padding:7px 9px;border-bottom:1px solid rgba(129,148,168,.3);font-weight:800;display:flex;justify-content:space-between;align-items:center}
        .b{padding:8px;display:grid;gap:6px}
        button{border:1px solid rgba(148,163,184,.55);border-radius:6px;background:#172033;color:#f8fafc;height:30px;font:800 12px sans-serif;cursor:pointer}
        button:hover{border-color:#f8fafc}
        .rec{background:#2a1217;border-color:rgba(248,113,113,.6)}
        .rec.on{background:#10251f;border-color:rgba(52,211,153,.6)}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .s{min-height:30px;padding:5px;border-radius:6px;background:rgba(15,23,42,.74);color:#cbd5e1;font-size:11px;line-height:1.35;word-break:keep-all}
        .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;margin-right:5px}
        .dot.on{background:#22c55e}
      </style>
      <div class="p">
        <div class="h"><span><span id="dot" class="dot"></span>Recorder</span></div>
        <div class="b">
          <button id="rec" class="rec" type="button">● 기록 시작</button>
          <div class="row">
            <button id="upload" type="button">패널 업로드</button>
            <button id="download" type="button">JSON</button>
          </div>
          <button id="reset" type="button">초기화</button>
          <div id="status" class="s">대기</div>
        </div>
      </div>`;
    shadow.getElementById("rec").addEventListener("click", () => setOn(!state.on));
    shadow.getElementById("upload").addEventListener("click", uploadProfile);
    shadow.getElementById("download").addEventListener("click", downloadProfile);
    shadow.getElementById("reset").addEventListener("click", () => win.HordesRecorder.reset());
    updatePanel();
    setInterval(updatePanel, 1500);
  }

  function setStatus(t) { state._status = t; updatePanel(); }
  function updatePanel() {
    if (!state.shadow) return;
    const rec = state.shadow.getElementById("rec");
    const dot = state.shadow.getElementById("dot");
    const status = state.shadow.getElementById("status");
    if (rec) { rec.textContent = state.on ? "■ 기록 정지" : "● 기록 시작"; rec.classList.toggle("on", state.on); }
    if (dot) dot.classList.toggle("on", state.on);
    if (status) {
      const m = (state.profile.totalMs / 60000).toFixed(1);
      const act = state.profile.totalMs ? Math.round(100 * state.profile.activeMs / state.profile.totalMs) : 0;
      status.textContent = (state._status || (state.on ? "기록 중…" : "대기")) + "\n" + m + "분 · 활동 " + act + "% · 장소 " + state.profile.spots.length;
      status.style.whiteSpace = "pre-wrap";
    }
  }

  setInterval(tick, TICK_MS);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPanel, { once: true }); else initPanel();
})();
