// ==UserScript==
// @name         Horder Mod Buffer
// @namespace    https://hordes.io/
// @version      0.6.3
// @description  Buffer route helper + panel-driven autonomous (newbie-like) controller for Hordes.io.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-start
// @grant        unsafeWindow
// @inject-into  page
// @updateURL    https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/horder_mod_buffer/horder-mod-buffer.user.js
// @downloadURL  https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/horder_mod_buffer/horder-mod-buffer.user.js
// ==/UserScript==

(function horderModBufferBootstrap() {
  "use strict";

  const MOD_VERSION = "0.6.3";
  const BOOT_KEY = "__HORDER_MOD_BUFFER_BOOTSTRAPPED__";
  const SANDBOX_BOOT_KEY = "__HORDER_MOD_BUFFER_SANDBOX_BOOTSTRAPPED__";
  const RUNTIME_KEY = "__HORDER_MOD_BUFFER_RUNTIME__";
  const KR_RUNTIME_KEY = "__HORDES_KR_RUNTIME__";
  const PANEL_ID = "horder-mod-buffer-panel";
  const CLIENT_SOURCE_TAG = "horder-mod-buffer-runtime";
  const DEFAULT_CHOICE_TIMEOUT_MS = 12000;
  const DEFAULT_WORLD_TIMEOUT_MS = 18000;
  const AFTER_TELEPORT_FALLBACK_MS = 3500;
  const AFTER_INTERACT_DELAY_MS = 180;
  const AFTER_CHOICE_DELAY_MS = 650;
  const AFTER_FAIVEL_TELEPORT_BUFF_DELAY_MS = 300;
  const BETWEEN_BUFFS_MS = 1000;
  const AFTER_BUFFS_MS = 600;
  const GUARDSTONE_HOTKEY_CODE = "Digit1";
  const HEADLESS_HOTKEY_CODE = "Digit2";
  const STORAGE_MINIMIZED_KEY = "horder_mod_buffer_minimized";
  const STORAGE_USE_SLOT4_KEY = "horder_mod_buffer_use_slot4";
  const STORAGE_AI_ENABLED_KEY = "horder_mod_buffer_ai_enabled";
  const STORAGE_RECALL_SLOT_KEY = "horder_mod_buffer_recall_slot";
  const STORAGE_FINAL_DEST_KEY = "horder_mod_buffer_final_dest";
  const STORAGE_WAYPOINTS_KEY = "horder_mod_buffer_waypoints";

  // --- Panel-driven AI controller config ---
  const PANEL_BASE_URL = "https://kbr1.cafe24.com/hordes_panel";
  const PANEL_TOKEN = "f091c884e74edd251d897ceb23ce6f5d";
  const PANEL_POLL_MS = 6000;            // heartbeat + command poll interval
  const AI_TICK_MS = 1100;              // behavior loop tick
  // Human-like sightseeing wander (single-map, position-aware)
  const ROAM_RADIUS = 34;              // how far from home (town) the bot strolls
  const ROAM_HARD_LIMIT = 58;          // never let it drift past this from home
  const ARRIVE_DIST = 3.2;             // "reached" a stroll target
  const TURN_MS_PER_RAD = 320;         // ArrowLeft/Right hold time per radian of turn (~700ms=120°)
  const TELEPORT_DIST = 80;            // pos jump beyond this => treat as teleport, re-anchor home
  // Occupancy map / A* pathfinding (learned live from the engine collision mesh)
  const OCC_R = 92;                    // half-extent of the learned occupancy grid (covers a town)
  const OCC_CELL = 1.0;                // grid cell size
  const OCC_INFLATE = 0.3;             // wall clearance
  const OCC_NY_MAX = 0.35;             // |normal.y| below this = steep wall (else walkable slope)
  const OCC_STEP = 1.0;                // surfaces up to this above local floor are steppable (walkable)
  const OCC_BODY = 1.8;                // walls reaching into this band above floor block the body
  // Combat farming (verified: HP=getResource(6)/getStat(6), cast via useSkillbarSlot, gcdEnd<time)
  const FARM_RADIUS = 45;              // engage mobs within this distance
  const FARM_RANGE = 4;                // attack range (approach to here; melee, works for all classes)
  const FARM_RETREAT_HP = 0.3;         // retreat & heal below this HP fraction
  const FARM_RESUME_HP = 0.75;         // re-engage once healed back to here
  const FARM_LOOT_RADIUS = 14;         // pick up drops within this after a kill
  const FARM_LOOT = false;             // walk onto drops after a kill (off: an auto-loot pet handles it)
  // Rotate these skillbar slots in combat. Excludes slot 3 (recall — would teleport
  // the bot to town mid-fight) and 10 (mount). Empty/on-cd slots are skipped, so one
  // list works for every class: Warrior dmg on 1/2/4/5/6, Mage q/e/r/f/cc on 4/6/7/8/9.
  const FARM_SKILL_SLOTS = [1, 2, 4, 5, 6, 7, 8, 9];
  const HP_RES_IDX = 6;                // resource/stat index for HP
  const FARM_BURST_MS = 8000;          // length of one tight combat burst before yielding to the outer AI loop
  const LEVEL_FOLLOW_RADIUS = 16;      // when rejoining, stop this close to the party cluster
  const LEVEL_REJOIN_DIST = 24;        // drift past this from the party centroid -> go back to it
  const PARTY_CHECK_MS = 60000;        // re-verify level-band party membership at most this often
  // Obelisk (faction war) — scaffold; in-window PvP/capture details pending live verification.
  const OBELISK_HOURS = [3, 6, 9, 12, 15, 18, 21, 0]; // KST hours the war window opens (~every 3h)
  const OBELISK_WINDOW_MIN = 35;       // try to enter within this many minutes past the hour
  const OBELISK_FOLLOW_DIST = 22;      // regroup with the friendly zerg if farther than this
  const OBELISK_RETRY_MS = 60000;      // re-attempt entry at most this often
  const WAR_CONJURER_POS = { x: 4244, z: 4176 }; // Faivel War Conjurer (obelisk port)
  const OBELISK_MIN_LEVEL = 35;        // Faivel (the War Conjurer's town) gates teleport at Lv.35+ (verified live)
  const WAYPOINT_DEDUP_DIST = 7;       // min spacing between learned landmarks
  const MAX_WAYPOINTS = 40;            // cap on learned landmark memory
  const NEAR_CONJURER_DIST = 2.5;       // close enough to interact with the Conjurer
  const RECALL_FAR_DIST = 40;           // farther than this from a Conjurer => use town recall
  const RECALL_WAIT_MS = 9000;          // wait for recall cast + zone load
  const RECALL_SKILL_ID = 40;           // universal "recall to town" skill (Rk, engineOnly, 5s cast)
  const MOVE_PULSE_MS = 360;            // single navigation key-hold pulse
  const MOVE_KEYS = {
    forward: { code: "KeyW", key: "w" },
    back: { code: "KeyS", key: "s" },
    left: { code: "KeyA", key: "a" },
    right: { code: "KeyD", key: "d" },
  };

  // Learned town maps (single map, absolute x,z). center + sightseeing spots (NPCs/landmarks).
  // Surveyed via CDP; the bot anchors to the nearest known town and strolls these spots.
  const KNOWN_TOWN_RADIUS = 95;
  const KNOWN_TOWNS = [
    { name: "Guardstone", cx: 3210, cz: 1234, spots: [
      [3208,1235],[3218,1261],[3199,1226],[3209,1258],[3212,1250],[3180,1235],
      [3242,1235],[3237,1245],[3235,1247],[3239,1243],[3240,1240],[3258,1245],[3267,1234],[3266,1229],
    ] },
    { name: "Faivel Grove", cx: 4257, cz: 4197, spots: [
      [4259,4199],[4244,4176],[4236,4190],[4234,4188],[4263,4191],[4269,4207],
    ] },
    { name: "Headless Landing", cx: 1996, cz: 3629, spots: [
      [1998,3630],[1985,3635],[2009,3625],[2010,3602],
    ] },
  ];

  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  if (pageWindow !== window) {
    if (window[SANDBOX_BOOT_KEY]) return;
    window[SANDBOX_BOOT_KEY] = true;
    const inject = () => {
      const parent = document.documentElement || document.head || document.body;
      if (!parent) {
        setTimeout(inject, 0);
        return;
      }
      const script = document.createElement("script");
      script.textContent = `(${horderModBufferBootstrap.toString()})();`;
      parent.appendChild(script);
      script.remove();
    };
    inject();
    return;
  }

  if (pageWindow[BOOT_KEY]) return;
  pageWindow[BOOT_KEY] = true;

  const originalFetch = pageWindow.fetch ? pageWindow.fetch.bind(pageWindow) : null;
  const state = {
    running: false,
    cancelToken: null,
    status: "대기",
    lastError: "",
    log: [],
    debugVisible: false,
    lastDebugText: "",
    minimized: readStoredBoolean(STORAGE_MINIMIZED_KEY, false),
    useSlot4: readStoredBoolean(STORAGE_USE_SLOT4_KEY, true),
    panel: null,
    shadow: null,
  };

  const ai = {
    started: false,
    enabled: readStoredBoolean(STORAGE_AI_ENABLED_KEY, true),
    recallSlot: readStoredNumber(STORAGE_RECALL_SLOT_KEY, 3),
    finalDest: readStoredString(STORAGE_FINAL_DEST_KEY, "Guardstone"),
    stopped: false,
    mode: "꺼짐",
    activity: "",          // current one-line "thought" (granular action narration)
    brain: [],             // rolling decision log [{t, m}]
    persona: null,         // stable per-bot personality (activity/radius/rest/social/afk...)
    profile: null,         // learned human behavior profile (imitation), fetched from panel
    profileAt: 0,
    farm: false,           // combat farming mode (opt-in via panel command)
    _rot: 0,               // skill rotation cursor
    kills: 0,
    _skipMobs: {},         // mob id -> expiry: targets that took no damage (critters/unreachable)
    _tgtId: 0,             // current locked target id (for stuck/no-damage detection)
    _tgtHp: 1,             // last seen HP fraction of the locked target
    _tgtStuck: 0,          // consecutive casts with no HP progress on the locked target
    leveling: false,       // leveling-party mode: follow the band party cluster + farm
    _band: null,           // { party, zone, min, max } of my current level band
    _partyAt: 0,           // last band-membership check time
    _zoneLog: {},          // band party id -> { zone, x, z } learned farming-spot coords
    _zoneLoaded: false,    // whether _zoneLog has been hydrated from localStorage yet
    obelisk: false,        // obelisk-war mode (opt-in; only acts inside KST windows)
    _obAt: 0,              // last obelisk entry attempt time
    _warTarget: false,     // combat should include enemy-faction players (war only)
    account: "",
    klass: "",
    home: null,            // town/stroll anchor (Conjurer pos when found, else spawn pos)
    homeWorld: "",
    townName: "",          // nearest known town (Guardstone/Faivel/Headless) when in one
    knownSpots: null,      // baked sightseeing spots for the current known town
    occ: null,             // cached occupancy grid (learned walkable map) for A* routing
    waypoints: loadWaypoints(),  // learned static landmark positions (persisted)
    leg: null,             // current stroll target {x,z}
    lastPos: null,         // for teleport detection
    turnSign: 1,           // +1 => ArrowRight increases heading (self-calibrated)
    _lastErr: null,
    _lastTurned: false,
    lastBuffAt: 0,
    pendingBuff: null,
    pendingRecall: null,
    lastPollAt: 0,
    lastPollOk: false,
  };

  if (isPlayPage()) {
    installAntiIdle();
    installGameClientRuntimeHook();
    installHotkey();
    whenDomReady(initPanel);
    startAiController();
  }

  // Keep the game "visible" so a backgrounded bot tab never goes "Browser is idle"
  // (which disconnects the world). Spoofs the Page Visibility API to always-visible.
  function installAntiIdle() {
    if (pageWindow.__horderAntiIdleInstalled) return;
    pageWindow.__horderAntiIdleInstalled = true;
    try {
      const force = (obj, prop, value) => {
        try { Object.defineProperty(obj, prop, { configurable: true, get: () => value }); } catch { /* ignore */ }
      };
      force(document, "hidden", false);
      force(document, "visibilityState", "visible");
      force(document, "webkitHidden", false);
      force(document, "webkitVisibilityState", "visible");
      // Any visibilitychange the browser fires will now read "visible", so the
      // game's idle handler never disconnects. (Getter override alone suffices.)
    } catch {
      // Anti-idle is best-effort.
    }
  }

  pageWindow.HorderModBuffer = {
    version: MOD_VERSION,
    runToGuardstone: () => runBufferFlow("Guardstone"),
    runToHeadlessLanding: () => runBufferFlow("Headless Landing"),
    stop: cancelRunningFlow,
    status: () => ({
      version: MOD_VERSION,
      running: state.running,
      status: state.status,
      lastError: state.lastError,
      settings: {
        minimized: state.minimized,
        useSlot4: state.useSlot4,
      },
      runtime: summarizeRuntime(),
      log: state.log.slice(-12),
    }),
    diagnose: () => buildDiagnosticStatus(),
    debugReport: () => buildDebugReport(),
    debugText: () => buildDebugText(),
    showDebug: () => showDebugReport(),
    copyDebug: () => copyDebugReport(),
    setAi: (value) => setAiEnabled(value),
    setFarm: (value) => { ai.farm = Boolean(value); if (ai.farm) { setAiEnabled(true); ai.stopped = false; ai.leveling = false; } else releaseAllMoveKeys(); setStatus(ai.farm ? "전투 파밍 ON" : "전투 파밍 OFF"); },
    setLeveling: (value) => { ai.leveling = Boolean(value); if (ai.leveling) { setAiEnabled(true); ai.stopped = false; ai.farm = false; ai.obelisk = false; ai._partyAt = 0; } else releaseAllMoveKeys(); setStatus(ai.leveling ? "렙업 파티 모드 ON" : "렙업 모드 OFF"); },
    setObelisk: (value) => { ai.obelisk = Boolean(value); if (ai.obelisk) { setAiEnabled(true); ai.stopped = false; ai.farm = false; ai.leveling = false; ai._obAt = 0; } else releaseAllMoveKeys(); setStatus(ai.obelisk ? "오벨리스크 모드 ON(윈도우 대기)" : "오벨리스크 모드 OFF"); },
    zoneLog: () => ai._zoneLog,
    setRecallSlot: (slot) => setRecallSlot(slot),
    setFinalDest: (dest) => setFinalDest(dest),
    setPanelToken: (value) => {
      writeStoredString("horder_mod_buffer_panel_token", String(value || ""));
      setStatus("패널 토큰 갱신됨");
    },
    waypoints: () => (ai.waypoints || []).slice(),
    clearWaypoints: () => {
      ai.waypoints = [];
      saveWaypoints();
      setStatus("학습 웨이포인트 초기화");
    },
    aiStatus: () => ({
      enabled: ai.enabled,
      stopped: ai.stopped,
      mode: ai.mode,
      activity: ai.activity,
      farm: ai.farm,
      leveling: ai.leveling,
      obelisk: ai.obelisk,
      band: ai._band,
      kills: ai.kills,
      persona: ai.persona,
      brain: ai.brain.slice(-15).map((e) => formatBrainTime(e.t) + " " + e.m),
      account: ai.account,
      klass: ai.klass,
      recallSlot: ai.recallSlot,
      finalDest: ai.finalDest,
      home: ai.home,
      waypoints: ai.waypoints ? ai.waypoints.length : 0,
      leg: ai.leg,
      lastPollOk: ai.lastPollOk,
      lastPollAt: ai.lastPollAt,
      pendingBuff: Boolean(ai.pendingBuff),
      pendingRecall: Boolean(ai.pendingRecall),
    }),
  };

  function isPlayPage() {
    return /^\/play(?:\/|$)/.test(location.pathname);
  }

  function whenDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function installGameClientRuntimeHook() {
    installScriptInsertInterceptor();
    installScriptObserver();
    scanScriptTags();
  }

  function installScriptInsertInterceptor() {
    const NodeProto = pageWindow.Node && pageWindow.Node.prototype;
    if (!NodeProto || NodeProto.__horderBufferScriptInsertPatched) return;

    const originalAppendChild = NodeProto.appendChild;
    const originalInsertBefore = NodeProto.insertBefore;
    const originalReplaceChild = NodeProto.replaceChild;

    if (typeof originalAppendChild === "function") {
      NodeProto.appendChild = function horderBufferAppendChild(node) {
        if (interceptScriptBeforeInsert(this, node, null)) return node;
        return originalAppendChild.apply(this, arguments);
      };
    }

    if (typeof originalInsertBefore === "function") {
      NodeProto.insertBefore = function horderBufferInsertBefore(node, child) {
        if (interceptScriptBeforeInsert(this, node, child)) return node;
        return originalInsertBefore.apply(this, arguments);
      };
    }

    if (typeof originalReplaceChild === "function") {
      NodeProto.replaceChild = function horderBufferReplaceChild(node, child) {
        if (interceptScriptBeforeInsert(this, node, child)) {
          if (child && child.parentNode === this) child.remove();
          return child;
        }
        return originalReplaceChild.apply(this, arguments);
      };
    }

    Object.defineProperty(NodeProto, "__horderBufferScriptInsertPatched", {
      configurable: true,
      value: true,
    });
  }

  function installScriptObserver() {
    const root = document.documentElement || document;
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.tagName === "SCRIPT") {
              interceptScriptTag(node);
            } else if (typeof node.querySelectorAll === "function") {
              node.querySelectorAll("script[src]").forEach(interceptScriptTag);
            }
          }
        }
      });
      observer.observe(root, { childList: true, subtree: true });
    } catch (error) {
      markRuntimeError("observer", error);
    }

    document.addEventListener(
      "beforescriptexecute",
      (event) => {
        const script = event.target;
        if (!script || !script.getAttribute || script.dataset.horderBufferRuntimeHooked) return;
        const url = toUrl(script.getAttribute("src"));
        if (!url || !shouldPatchClientScript(url)) return;
        event.preventDefault();
        event.stopPropagation();
        interceptScriptTag(script);
      },
      true
    );
  }

  function scanScriptTags() {
    try {
      document.querySelectorAll("script[src]").forEach(interceptScriptTag);
    } catch (error) {
      markRuntimeError("scan", error);
    }
  }

  function interceptScriptBeforeInsert(parent, node, nextSibling) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SCRIPT") return false;
    if (!node.getAttribute || node.dataset.horderBufferRuntimeHooked) return false;

    const url = toUrl(node.getAttribute("src"));
    if (!url) {
      return interceptInlineClientScriptBeforeInsert(parent, node, nextSibling);
    }

    if (!shouldPatchClientScript(url)) return false;

    node.dataset.horderBufferRuntimeHooked = "sync-blocked";
    loadAndPatchClientScript(parent, nextSibling, url, node.getAttribute("type") || "");
    return true;
  }

  function interceptScriptTag(script) {
    if (!script || !script.getAttribute || script.dataset.horderBufferRuntimeHooked) return;

    const url = toUrl(script.getAttribute("src"));
    if (!url) {
      interceptInlineClientScriptTag(script);
      return;
    }

    if (!shouldPatchClientScript(url)) return;

    const parent = script.parentNode;
    const nextSibling = script.nextSibling;
    const originalType = script.getAttribute("type") || "";
    script.dataset.horderBufferRuntimeHooked = "checking";

    try {
      script.type = "javascript/horder-buffer-blocked";
      if (parent) parent.removeChild(script);
    } catch (error) {
      markRuntimeError("remove-client-script", error);
      return;
    }

    loadAndPatchClientScript(parent, nextSibling, url, originalType);
  }

  function interceptInlineClientScriptBeforeInsert(parent, node, nextSibling) {
    const source = getInlineScriptSource(node);
    if (!shouldPatchInlineClientScript(source)) return false;

    node.dataset.horderBufferRuntimeHooked = "inline-blocked";
    insertPatchedInlineScript(parent, nextSibling, source, node.getAttribute("type") || "");
    return true;
  }

  function interceptInlineClientScriptTag(script) {
    const source = getInlineScriptSource(script);
    if (!shouldPatchInlineClientScript(source)) return;

    const parent = script.parentNode;
    const nextSibling = script.nextSibling;
    const originalType = script.getAttribute("type") || "";
    script.dataset.horderBufferRuntimeHooked = "inline-checking";

    try {
      script.type = "javascript/horder-buffer-inline-blocked";
      if (parent) parent.removeChild(script);
    } catch (error) {
      markRuntimeError("remove-inline-client-script", error);
      return;
    }

    insertPatchedInlineScript(parent, nextSibling, source, originalType);
  }

  function shouldPatchClientScript(url) {
    if (!url || url.origin !== location.origin) return false;
    const path = url.pathname.toLowerCase();
    return path.endsWith("/client.js") || path.endsWith("client.js");
  }

  function shouldPatchInlineClientScript(source) {
    if (!source || source.includes(RUNTIME_KEY)) return false;
    if (!source.includes("clientPlayerInteract")) return false;
    if (!source.includes("clientPlayerSkill")) return false;
    if (!source.includes("window.onload=async()=>")) return false;
    return source.includes("var Mt={") || source.includes("Mt={clientPlayerInput");
  }

  function getInlineScriptSource(script) {
    try {
      return String(script.textContent || "");
    } catch {
      return "";
    }
  }

  function loadAndPatchClientScript(parent, nextSibling, url, originalType) {
    try {
      const source = loadScriptSourceSync(url);
      insertPatchedScript(parent, nextSibling, patchClientSource(source, url), url, originalType);
      return;
    } catch (error) {
      markRuntimeError("sync-load", error);
    }

    loadAndPatchClientScriptAsync(parent, nextSibling, url, originalType);
  }

  function loadScriptSourceSync(url) {
    const xhr = new pageWindow.XMLHttpRequest();
    xhr.open("GET", url.toString(), false);
    xhr.send(null);
    if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
      return xhr.responseText;
    }
    throw new Error(`client.js request failed: ${xhr.status}`);
  }

  async function loadAndPatchClientScriptAsync(parent, nextSibling, url, originalType) {
    try {
      if (!originalFetch) throw new Error("fetch unavailable");
      const response = await originalFetch(url.toString(), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`client.js request failed: ${response.status}`);
      const source = await response.text();
      insertPatchedScript(parent, nextSibling, patchClientSource(source, url), url, originalType);
    } catch (error) {
      markRuntimeError("async-load", error);
      insertFallbackScript(parent, nextSibling, url, originalType);
    }
  }

  function insertPatchedScript(parent, nextSibling, source, url, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const replacement = document.createElement("script");
    replacement.dataset.horderBufferRuntimeHooked = "inlined";
    replacement.dataset.horderBufferRuntimeSource = shortScriptUrl(url);
    if (originalType && !/^(text|application)\/javascript$/i.test(originalType)) replacement.type = originalType;
    replacement.textContent = `${source}\n//# sourceURL=${url.toString()}#${CLIENT_SOURCE_TAG}`;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(replacement, nextSibling);
    } else {
      targetParent.appendChild(replacement);
    }
  }

  function insertPatchedInlineScript(parent, nextSibling, source, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const replacement = document.createElement("script");
    replacement.dataset.horderBufferRuntimeHooked = "inline-inlined";
    replacement.dataset.horderBufferRuntimeSource = "inline-client";
    if (originalType && !/^(text|application)\/javascript$/i.test(originalType)) replacement.type = originalType;
    replacement.textContent = `${patchClientSource(source, "inline-client")}\n//# sourceURL=${location.origin}/client.js#${CLIENT_SOURCE_TAG}`;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(replacement, nextSibling);
    } else {
      targetParent.appendChild(replacement);
    }
  }

  function insertFallbackScript(parent, nextSibling, url, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const fallback = document.createElement("script");
    fallback.dataset.horderBufferRuntimeHooked = "fallback";
    fallback.src = url.toString();
    if (originalType) fallback.type = originalType;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(fallback, nextSibling);
    } else {
      targetParent.appendChild(fallback);
    }
  }

  function patchClientSource(source, url) {
    let patched = String(source || "");
    const runtimeProbe = buildRuntimeProbeSource(typeof url === "string" ? url : shortScriptUrl(url)) + buildPrototypeRuntimeSource();
    const prototypeRuntime = buildPrototypeRuntimeSource();

    if (patched.includes("(()=>{")) {
      patched = patched.replace("(()=>{", `(()=>{${runtimeProbe}`);
    } else {
      markRuntimeError("patch", new Error("client wrapper marker not found"));
    }

    patched = patchEngineSetter(patched);
    patched = patchEngineConstructorCall(patched);

    if (patched.includes("window.onload=async()=>{")) {
      patched = patched.replace(
        "window.onload=async()=>{",
        `window.onload=async()=>{if(window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__)return;window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__=true;${prototypeRuntime}`
      );
    } else {
      markRuntimeError("patch", new Error("window.onload marker not found"));
    }

    return patched;
  }

  function patchEngineSetter(source) {
    const replacement = (match, argName) => {
      const safeArg = /^[A-Za-z_$][\w$]*$/.test(argName) ? argName : "t";
      return `N3=${safeArg}=>{I=${safeArg};try{var r=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};if(typeof r.exposeEngine==='function')r.exposeEngine(${safeArg},'engineSetter');else{r.engine=${safeArg};r.player=${safeArg}&&${safeArg}.player;r.ready=!!(r.engine&&r.player);r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.engineSetter=(r.hookHits.engineSetter||0)+1}}catch(e){try{var rr=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};rr.errors=rr.errors||[];rr.errors.push('engineSetter:'+((e&&e.message)||e))}catch(_){}}}`;
    };

    const patched = source.replace(/N3=([A-Za-z_$][\w$]*)=>\{I=\1\}/, replacement);
    if (patched === source) {
      markRuntimeError("patch", new Error("engine setter marker not found"));
    }
    return patched;
  }

  function patchEngineConstructorCall(source) {
    const patched = source.replace(
      /N3\(new ([A-Za-z_$][\w$]*)\(\{\}\)\)/,
      `N3(window.__HORDER_MOD_BUFFER_CAPTURE_ENGINE__(new $1({}),'engineConstructor'))`
    );
    if (patched === source) {
      markRuntimeError("patch", new Error("engine constructor marker not found"));
    }
    return patched;
  }

  function buildRuntimeProbeSource(sourceLabel) {
    return [
      "try{",
      `var __hmbRt=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};`,
      `__hmbRt.version=${JSON.stringify(MOD_VERSION)};`,
      `__hmbRt.source=${JSON.stringify(sourceLabel)};`,
      "__hmbRt.hookHits=__hmbRt.hookHits||{};",
      "__hmbRt.errors=__hmbRt.errors||[];",
      "__hmbRt.readStore=function(store){var value;try{var unsub=store&&store.subscribe&&store.subscribe(function(v){value=v});if(typeof unsub==='function')unsub()}catch(e){}return value};",
      "__hmbRt.exposeEngine=function(engine,hit){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.engine=engine||r.engine||null;r.player=r.engine&&r.engine.player||r.player||null;r.ready=!!(r.engine&&r.player&&typeof Mt!=='undefined'&&typeof Io==='function');r.activeWorld=typeof Gr!=='undefined'?r.readStore(Gr):r.activeWorld||'';r.updatedAt=Date.now();r.hookHits=r.hookHits||{};hit=hit||'exposeEngine';r.hookHits[hit]=(r.hookHits[hit]||0)+1;try{r.engineKeys=r.engine?Object.getOwnPropertyNames(r.engine).slice(0,60):[]}catch(_){}}catch(e){try{__hmbRt.errors.push('exposeEngine:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.captureEngine=function(engine,hit){try{__hmbRt.exposeEngine(engine,hit||'captureEngine')}catch(e){try{__hmbRt.errors.push('captureEngine:'+((e&&e.message)||e))}catch(_){}}return engine};",
      "window.__HORDER_MOD_BUFFER_CAPTURE_ENGINE__=function(engine,hit){try{return __hmbRt.captureEngine(engine,hit)}catch(e){return engine}};",
      "__hmbRt.installOnloadAutoStart=function(){try{if(__hmbRt.onloadAutoStartInstalled)return;__hmbRt.onloadAutoStartInstalled=true;__hmbRt.onloadAutoStartInstalledAt=Date.now();__hmbRt.hookHits.onloadAutoStartInstall=(__hmbRt.hookHits.onloadAutoStartInstall||0)+1;var attempts=0,currentOnload=window.onload,assignmentCount=0,timer=null;var isClientOnload=function(fn){try{if(typeof fn!=='function')return false;var text=Function.prototype.toString.call(fn);return text.indexOf('__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__')>=0||text.indexOf('game.bin')>=0||text.indexOf('new Fh')>=0}catch(e){return false}};var tryRun=function(reason){try{attempts+=1;__hmbRt.onloadAutoStartAttempts=attempts;__hmbRt.onloadAutoStartReason=reason;__hmbRt.onloadAutoStartReadyState=document.readyState;__hmbRt.onloadAutoStartOnloadType=typeof currentOnload;__hmbRt.onloadAutoStartAssignmentCount=assignmentCount;__hmbRt.onloadAutoStartIsClientOnload=isClientOnload(currentOnload);if(window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__){if(timer)clearInterval(timer);__hmbRt.onloadAutoStartStopped='already-started';return}if(document.readyState==='loading')return;if(typeof currentOnload!=='function')return;if(!isClientOnload(currentOnload)){__hmbRt.onloadAutoStartStopped='waiting-client-onload';return}__hmbRt.hookHits.onloadAutoStartRun=(__hmbRt.hookHits.onloadAutoStartRun||0)+1;currentOnload.call(window);if(timer)clearInterval(timer);__hmbRt.onloadAutoStartStopped='ran'}catch(e){try{__hmbRt.errors.push('onloadAutoStart:'+((e&&e.message)||e));__hmbRt.onloadAutoStartStopped='error';if(timer)clearInterval(timer)}catch(_){}}};try{var desc=Object.getOwnPropertyDescriptor(window,'onload');if(!desc||desc.configurable){Object.defineProperty(window,'onload',{configurable:true,enumerable:true,get:function(){return currentOnload},set:function(fn){currentOnload=fn;assignmentCount+=1;__hmbRt.onloadAutoStartAssignedAt=Date.now();__hmbRt.hookHits.onloadAutoStartAssign=(__hmbRt.hookHits.onloadAutoStartAssign||0)+1;setTimeout(function(){tryRun('assignment')},0)}});__hmbRt.onloadAutoStartDescriptor='installed'}else{__hmbRt.onloadAutoStartDescriptor='not-configurable'}}catch(e){__hmbRt.onloadAutoStartDescriptor='error:'+((e&&e.message)||e)}timer=setInterval(function(){tryRun('timer')},50);setTimeout(function(){try{if(!window.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__){__hmbRt.onloadAutoStartStopped='timeout';if(timer)clearInterval(timer)}}catch(_){}},30000)}catch(e){try{__hmbRt.errors.push('installOnloadAutoStart:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.installOnloadAutoStart();",
      "__hmbRt.update=function(){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:r.engine||null;r.engine=engine;r.player=engine&&engine.player||r.player||null;r.ready=!!(r.engine&&r.player&&typeof Mt!=='undefined'&&typeof Io==='function');r.activeWorld=typeof Gr!=='undefined'?r.readStore(Gr):r.activeWorld||'';r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.update=(r.hookHits.update||0)+1}catch(e){try{__hmbRt.errors.push('update:'+((e&&e.message)||e))}catch(_){}}};",
      "__hmbRt.listEntities=function(){var out=[];try{var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var arr=engine&&engine.entities&&engine.entities.array||[];for(var i=0;i<arr.length;i++){var e=arr[i];if(!e)continue;var pos=e.pos||e.visualPosition||[];out.push({id:e.id,name:e.name||'',type:e.type,faction:e.faction,party:e.party,static:!!e.static,level:e.level,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0]})}}catch(err){try{__hmbRt.errors.push('listEntities:'+((err&&err.message)||err))}catch(_){}}return out};",
      "__hmbRt.getPlayerInfo=function(){try{var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var p=engine&&engine.player||runtime.player||null;var pos=p&&(p.pos||p.visualPosition)||[];return p?{id:p.id,name:p.name||'',type:p.type,pos:[Number(pos[0])||0,Number(pos[1])||0,Number(pos[2])||0],target:p.target}:null}catch(e){return null}};",
      "__hmbRt.changeTarget=function(id){id=Number(id);try{if(typeof vr==='function')return vr(id)}catch(e){}try{return Io(Mt.clientPlayerChangeTarget.packData({target:id}))}catch(e){throw new Error('changeTarget failed: '+((e&&e.message)||e))}};",
      "__hmbRt.sendInteract=function(id){id=Number(id);try{return Io(Mt.clientPlayerInteract.packData({id:id}))}catch(e){throw new Error('sendInteract failed: '+((e&&e.message)||e))}};",
      "__hmbRt.getActiveWorld=function(){try{return typeof Gr!=='undefined'?__hmbRt.readStore(Gr):''}catch(e){return ''}};",
      "__hmbRt.useSkillbarSlot=function(slot){slot=Number(slot);try{if(!Number.isInteger(slot)||slot<1)throw new Error('invalid slot');var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var player=engine&&engine.player||runtime.player||null;if(!player)throw new Error('player not ready');var settings=typeof fe!=='undefined'&&fe&&fe.skillbarsettings;var bar=settings&&settings[player.name];var skill=bar&&bar[slot-1];if(!skill||Number(skill.id)<0)throw new Error('empty skillbar slot '+slot);var info=Array.isArray(skill.info)?skill.info.slice():[];if(skill.item&&player.inventory&&typeof player.inventory.findFirstSlotOfType==='function'){var invSlot=player.inventory.findFirstSlotOfType(skill.item.type,skill.item.tier);if(invSlot===void 0)throw new Error('item for slot '+slot+' not found');info[0]=invSlot}var def=typeof zt!=='undefined'&&zt&&zt.get?zt.get(skill.id):null;if(def&&def.envCast>0&&typeof gu==='function'){gu(skill.id,def.range,def.envCast);return {ok:true,slot:slot,id:skill.id,env:true}}Io(Mt.clientPlayerSkill.packData({id:skill.id,info:info}));return {ok:true,slot:slot,id:skill.id,env:false}}catch(e){return {ok:false,slot:slot,reason:(e&&e.message)||String(e)}}};",
      "__hmbRt.useSkill=function(id){id=Number(id);try{if(!Number.isFinite(id))throw new Error('invalid id');var runtime=window.__HORDER_MOD_BUFFER_RUNTIME__||{};var engine=typeof I!=='undefined'&&I?I:runtime.engine||null;var player=engine&&engine.player||runtime.player||null;if(!player)throw new Error('player not ready');var def=typeof zt!=='undefined'&&zt&&zt.get?zt.get(id):null;if(def&&def.envCast>0&&typeof gu==='function'){gu(id,def.range,def.envCast);return {ok:true,id:id,env:true}}Io(Mt.clientPlayerSkill.packData({id:id,info:[]}));return {ok:true,id:id,env:false}}catch(e){return {ok:false,id:id,reason:(e&&e.message)||String(e)}}};",
      "__hmbRt.rotateCamera=function(dy){try{dy=Number(dy)||0;if(typeof so==='undefined'||!so)return {ok:false,reason:'no camera'};so[0]=(typeof Qa==='function')?Qa(so[0]+dy):(so[0]+dy);return {ok:true,yaw:so[0]}}catch(e){return {ok:false,reason:(e&&e.message)||String(e)}}};",
      "__hmbRt.update();",
      "setInterval(function(){try{__hmbRt.update()}catch(e){}},250);",
      "}catch(e){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.errors=r.errors||[];r.errors.push('install:'+((e&&e.message)||e))}catch(_){}}",
    ].join("");
  }

  function buildPrototypeRuntimeSource() {
    return [
      "try{",
      `var __hmbRt=window.${RUNTIME_KEY}=window.${RUNTIME_KEY}||{};`,
      "__hmbRt.hookHits=__hmbRt.hookHits||{};",
      "__hmbRt.errors=__hmbRt.errors||[];",
      "__hmbRt.prototypeInstallScheduledAt=__hmbRt.prototypeInstallScheduledAt||Date.now();",
      "var __hmbInstallPrototype=function(){try{__hmbRt.prototypeInstallAttempts=(__hmbRt.prototypeInstallAttempts||0)+1;if(typeof Fh==='undefined'||!Fh||!Fh.prototype)return false;__hmbRt.prototypePatchAt=Date.now();__hmbRt.prototypePatchFhType=typeof Fh;__hmbRt.prototypePatchFhKeys=Object.getOwnPropertyNames(Fh.prototype).slice(0,80);var __hmbExpose=function(engine,hit){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};if(typeof r.exposeEngine==='function')r.exposeEngine(engine,hit);else{r.engine=engine;r.player=engine&&engine.player||null;r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits[hit]=(r.hookHits[hit]||0)+1}}catch(e){try{__hmbRt.errors.push('prototypeExpose:'+hit+':'+((e&&e.message)||e))}catch(_){}}};var __hmbWrap=function(name,hit){try{var proto=Fh&&Fh.prototype;var original=proto&&proto[name];if(typeof original!=='function')return;if(original.__horderBufferWrapped){__hmbRt.hookHits['wrap_'+hit+'_already']=(__hmbRt.hookHits['wrap_'+hit+'_already']||0)+1;return}var wrapped=function(){__hmbExpose(this,hit);var result=original.apply(this,arguments);__hmbExpose(this,hit+'After');return result};try{Object.defineProperty(wrapped,'__horderBufferWrapped',{value:true})}catch(_){}proto[name]=wrapped;__hmbRt.hookHits['wrap_'+hit]=(__hmbRt.hookHits['wrap_'+hit]||0)+1}catch(e){try{__hmbRt.errors.push('prototypeWrap:'+name+':'+((e&&e.message)||e))}catch(_){}}};__hmbWrap('setState','prototypeSetState');__hmbWrap('setPlayer','prototypeSetPlayer');__hmbWrap('tick','prototypeTick');__hmbWrap('manageChunks','prototypeManageChunks');return true}catch(e){try{__hmbRt.errors.push('prototypeRuntime:'+((e&&e.message)||e))}catch(_){}return true}};",
      "if(!__hmbRt.prototypeInstallTimerStarted){__hmbRt.prototypeInstallTimerStarted=true;var __hmbPrototypeTimer=setInterval(function(){try{if(__hmbInstallPrototype())clearInterval(__hmbPrototypeTimer)}catch(e){}},50)}",
      "__hmbInstallPrototype();",
      "}catch(e){try{var r=window.__HORDER_MOD_BUFFER_RUNTIME__=window.__HORDER_MOD_BUFFER_RUNTIME__||{};r.errors=r.errors||[];r.errors.push('prototypeRuntime:'+((e&&e.message)||e))}catch(_){}}",
    ].join("");
  }

  function initPanel() {
    if (document.getElementById(PANEL_ID)) return;
    if (!document.body) {
      setTimeout(initPanel, 100);
      return;
    }

    const host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.cssText = [
      "all: initial",
      "position: fixed",
      "right: 10px",
      "bottom: 92px",
      "z-index: 2147483647",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "pointer-events: auto",
    ].join(";");
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    state.panel = host;
    state.shadow = shadow;

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .panel {
          width: 218px;
          border: 1px solid rgba(129, 148, 168, 0.72);
          border-radius: 8px;
          background: rgba(12, 15, 20, 0.94);
          color: #e5e7eb;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.38);
          overflow: hidden;
        }
        .head {
          padding: 8px 10px;
          border-bottom: 1px solid rgba(129, 148, 168, 0.32);
          font-size: 12px;
          font-weight: 800;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .head-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .minimize {
          width: 24px;
          height: 24px;
          padding: 0;
          border-radius: 5px;
          line-height: 1;
          background: #111827;
        }
        .body { padding: 8px; }
        .body.collapsed { display: none; }
        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }
        button {
          border: 1px solid rgba(148, 163, 184, 0.55);
          border-radius: 6px;
          background: #172033;
          color: #f8fafc;
          height: 34px;
          padding: 0 8px;
          font: 800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }
        button:hover { border-color: #f8fafc; }
        button:disabled {
          cursor: default;
          opacity: 0.58;
        }
        .option {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 30px;
          margin-top: 6px;
          padding: 5px 7px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.58);
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          user-select: none;
        }
        .option input {
          width: 14px;
          height: 14px;
          margin: 0;
        }
        .stop {
          margin-top: 6px;
          width: 100%;
          background: #2a1217;
          border-color: rgba(248, 113, 113, 0.55);
        }
        .debug-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-top: 6px;
        }
        .debug-buttons button {
          height: 30px;
          background: #10251f;
          border-color: rgba(52, 211, 153, 0.48);
        }
        .status {
          margin-top: 7px;
          min-height: 32px;
          padding: 6px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.74);
          color: #cbd5e1;
          font-size: 11px;
          line-height: 1.35;
          word-break: keep-all;
        }
        .debug-output {
          display: none;
          width: 100%;
          height: 164px;
          margin-top: 7px;
          padding: 6px;
          border: 1px solid rgba(148, 163, 184, 0.48);
          border-radius: 6px;
          background: rgba(2, 6, 23, 0.88);
          color: #dbeafe;
          font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          line-height: 1.35;
          resize: vertical;
          white-space: pre;
        }
        .debug-output.open { display: block; }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #64748b;
          flex: 0 0 auto;
        }
        .dot.ready { background: #22c55e; }
        .dot.busy { background: #f59e0b; }
        .dot.error { background: #ef4444; }
      </style>
      <div class="panel">
        <div class="head">
          <span>Buffer</span>
          <span class="head-actions">
            <span id="dot" class="dot"></span>
            <button id="minimize" class="minimize" type="button">-</button>
          </span>
        </div>
        <div id="body" class="body">
          <div class="buttons">
            <button id="guardstone" type="button">Guardstone</button>
            <button id="headless" type="button">Headless</button>
          </div>
          <label class="option">
            <input id="use-slot4" type="checkbox">
            <span>4번도 사용</span>
          </label>
          <label class="option">
            <input id="ai-enabled" type="checkbox">
            <span>AI 자동(배회/오벨)</span>
          </label>
          <label class="option">
            <span>리콜 슬롯</span>
            <input id="recall-slot" type="number" min="0" max="12" style="width:46px;height:22px;text-align:center">
            <span style="opacity:.6">0=끔</span>
          </label>
          <div id="ai-status" class="status">AI: 꺼짐</div>
          <button id="stop" class="stop" type="button">중지</button>
          <div class="debug-buttons">
            <button id="debug" type="button">진단</button>
            <button id="copy-debug" type="button">복사</button>
          </div>
          <div id="status" class="status">대기</div>
          <textarea id="debug-output" class="debug-output" spellcheck="false" readonly></textarea>
        </div>
      </div>
    `;

    shadow.getElementById("guardstone").addEventListener("click", () => runBufferFlow("Guardstone"));
    shadow.getElementById("headless").addEventListener("click", () => runBufferFlow("Headless Landing"));
    shadow.getElementById("stop").addEventListener("click", cancelRunningFlow);
    shadow.getElementById("debug").addEventListener("click", showDebugReport);
    shadow.getElementById("copy-debug").addEventListener("click", copyDebugReport);
    shadow.getElementById("minimize").addEventListener("click", togglePanelMinimized);
    shadow.getElementById("use-slot4").addEventListener("change", (event) => setUseSlot4(Boolean(event.target.checked)));
    shadow.getElementById("ai-enabled").addEventListener("change", (event) => setAiEnabled(Boolean(event.target.checked)));
    shadow.getElementById("recall-slot").addEventListener("change", (event) => setRecallSlot(Number(event.target.value)));
    updatePanel();
    setInterval(updatePanel, 600);
  }

  function installHotkey() {
    if (pageWindow.__horderBufferHotkeyInstalled) return;
    pageWindow.__horderBufferHotkeyInstalled = true;

    const handler = (event) => handleBufferHotkeyEvent(event);
    for (const type of ["keydown", "keypress", "keyup"]) {
      pageWindow.addEventListener(type, handler, true);
      document.addEventListener(type, handler, true);
    }
  }

  function handleBufferHotkeyEvent(event) {
    if (!event || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const destination = getHotkeyDestination(event);
    if (!destination) return;
    if (isEditableTarget(event.target)) return;

    suppressHotkeyEvent(event);
    if (event.type !== "keydown" || event.repeat) return;
    runBufferFlow(destination);
  }

  function suppressHotkeyEvent(event) {
    try {
      if (event.cancelable !== false) event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    } catch {
      // Keep routing the buffer hotkey even if the browser rejects cancellation.
    }
  }

  function getHotkeyDestination(event) {
    if (event.code === GUARDSTONE_HOTKEY_CODE || event.key === "1") return "Guardstone";
    if (event.code === HEADLESS_HOTKEY_CODE || event.key === "2") return "Headless Landing";
    return "";
  }

  function isEditableTarget(target) {
    if (!target || target === document || target === pageWindow) return false;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tagName = String(element.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
    return Boolean(element.closest && element.closest("input,textarea,select,[contenteditable='true']"));
  }

  async function runBufferFlow(finalDestination) {
    if (state.running) return;

    const token = { cancelled: false };
    state.running = true;
    state.cancelToken = token;
    state.lastError = "";
    setStatus(`시작: ${finalDestination}`);

    try {
      await waitForRuntime(token);

      await openConjurer(token);
      await chooseDestination("Faivel", token, 0);
      setStatus("Faivel 이동 후 0.3초 대기");
      await sleep(AFTER_FAIVEL_TELEPORT_BUFF_DELAY_MS, token);

      if (state.useSlot4) {
        await useSkillbarSlot(4, token);
        await sleep(BETWEEN_BUFFS_MS, token);
      }
      await useSkillbarSlot(5, token);
      await sleep(AFTER_BUFFS_MS, token);

      await openConjurer(token);
      await chooseDestination(finalDestination, token);
      setStatus(`완료: ${finalDestination}`);
    } catch (error) {
      if (token.cancelled) {
        setStatus("중지됨");
      } else {
        const message = (error && error.message) || String(error);
        state.lastError = message;
        setStatus(`오류: ${message}`);
      }
    } finally {
      state.running = false;
      state.cancelToken = null;
      updatePanel();
    }
  }

  function cancelRunningFlow() {
    if (state.cancelToken) state.cancelToken.cancelled = true;
    state.running = false;
    setStatus("중지 요청");
  }

  function togglePanelMinimized() {
    state.minimized = !state.minimized;
    writeStoredBoolean(STORAGE_MINIMIZED_KEY, state.minimized);
    updatePanel();
  }

  function setUseSlot4(value) {
    state.useSlot4 = Boolean(value);
    writeStoredBoolean(STORAGE_USE_SLOT4_KEY, state.useSlot4);
    setStatus(state.useSlot4 ? "버프: 4번 + 5번" : "버프: 5번만");
  }

  async function waitForRuntime(token) {
    const runtime = await waitFor(
      () => {
        const rt = getRuntime();
        return rt && rt.ready && typeof rt.sendInteract === "function" && typeof rt.listEntities === "function" ? rt : null;
      },
      15000,
      buildRuntimeFailureMessage(),
      token
    );
    return runtime;
  }

  async function openConjurer(token) {
    const runtime = await waitForRuntime(token);
    const conjurer = await waitFor(
      () => findNearestConjurer(runtime),
      8000,
      "주변에서 Conjurer를 찾지 못했습니다.",
      token
    );

    setStatus(`Conjurer 선택: ${conjurer.name || conjurer.id}`);
    runtime.changeTarget(conjurer.id);
    await sleep(AFTER_INTERACT_DELAY_MS, token);
    runtime.sendInteract(conjurer.id);
    await waitFor(
      () => findChoiceElement("Teleport") || findChoiceElement("Faivel") || findChoiceElement("Guardstone") || findChoiceElement("Headless"),
      DEFAULT_CHOICE_TIMEOUT_MS,
      "Conjurer 대화창을 열지 못했습니다.",
      token
    );
  }

  async function chooseDestination(destination, token, afterDelayMs = AFTER_CHOICE_DELAY_MS) {
    const element = await waitFor(
      () => findChoiceElement(destination),
      DEFAULT_CHOICE_TIMEOUT_MS,
      `${destination} 선택지를 찾지 못했습니다.`,
      token
    );

    setStatus(`이동 선택: ${destination}`);
    clickLikeUser(element);
    if (afterDelayMs > 0) await sleep(afterDelayMs, token);
  }

  async function waitForWorldOrFallback(worldName, token) {
    const runtime = getRuntime();
    if (!runtime || typeof runtime.getActiveWorld !== "function") {
      await sleep(AFTER_TELEPORT_FALLBACK_MS, token);
      return;
    }

    const normalizedTarget = normalizeText(worldName);
    const startedAt = Date.now();
    while (Date.now() - startedAt < DEFAULT_WORLD_TIMEOUT_MS) {
      throwIfCancelled(token);
      const active = normalizeText(runtime.getActiveWorld && runtime.getActiveWorld());
      if (active && active.includes(normalizedTarget)) {
        setStatus(`월드 확인: ${worldName}`);
        await sleep(1000, token);
        return;
      }
      await sleep(250, token);
    }

    setStatus(`${worldName} 확인 실패, 고정 대기`);
    await sleep(AFTER_TELEPORT_FALLBACK_MS, token);
  }

  async function useSkillbarSlot(slot, token) {
    throwIfCancelled(token);
    const runtime = await waitForRuntime(token);
    setStatus(`${slot}번 사용`);

    let result = null;
    if (typeof runtime.useSkillbarSlot === "function") {
      result = runtime.useSkillbarSlot(slot);
    }

    if (!result || !result.ok) {
      pressKey(String(slot));
      await sleep(120, token);
      setStatus(`${slot}번 키 입력`);
      return;
    }

    await sleep(120, token);
  }

  function findNearestConjurer(runtime) {
    const entities = runtime && runtime.listEntities ? runtime.listEntities() : [];
    const player = runtime && runtime.getPlayerInfo ? runtime.getPlayerInfo() : null;
    const playerPos = player && Array.isArray(player.pos) ? player.pos : null;

    const matches = entities.filter((entity) => {
      const text = normalizeText(entity && entity.name);
      return text === "conjurer" || text === "conjuer" || text.includes("conjurer") || text.includes("conjuer");
    });

    if (!matches.length) return null;
    if (!playerPos) return matches[0];

    return matches
      .map((entity) => ({ entity, distance: distance3(playerPos, entity.pos || []) }))
      .sort((a, b) => a.distance - b.distance)[0].entity;
  }

  function findChoiceElement(needle) {
    const target = normalizeText(needle);
    if (!target) return null;

    const selector = [
      "button",
      ".btn",
      ".choice",
      "[value]",
      "[role='button']",
    ].join(",");

    const nodes = Array.from(document.querySelectorAll(selector));
    const candidates = [];

    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const text = normalizeText(node.innerText || node.textContent || "");
      if (!text || !text.includes(target)) continue;
      const clickable = node.closest("button,.btn,.choice,[role='button'],[value]") || node;
      if (!isVisible(clickable)) continue;
      candidates.push(clickable);
    }

    if (!candidates.length) return null;
    return candidates.sort((a, b) => elementScore(b, target) - elementScore(a, target))[0];
  }

  function elementScore(element, target) {
    const text = normalizeText(element.innerText || element.textContent || "");
    let score = 0;
    if (text === target) score += 100;
    if (text.includes(`teleport to ${target}`)) score += 60;
    if (element.classList && element.classList.contains("btn")) score += 20;
    if (element.classList && element.classList.contains("choice")) score += 10;
    if (element.hasAttribute && element.hasAttribute("value")) score += 10;
    return score;
  }

  function pressKey(key) {
    const codeMap = {
      "1": "Digit1",
      "2": "Digit2",
      "3": "Digit3",
      "4": "Digit4",
      "5": "Digit5",
      "6": "Digit6",
      "7": "Digit7",
      "8": "Digit8",
      "9": "Digit9",
      "0": "Digit0",
    };
    const code = codeMap[key] || `Key${key.toUpperCase()}`;
    const targets = [
      document.activeElement,
      document.querySelector("canvas"),
      document.body,
      document,
      pageWindow,
    ].filter(Boolean);

    for (const type of ["keydown", "keyup"]) {
      for (const target of targets) {
        try {
          const event = new KeyboardEvent(type, {
            key,
            code,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          target.dispatchEvent(event);
        } catch {
          // Continue dispatching to other targets.
        }
      }
    }
  }

  function clickLikeUser(element) {
    const target = element.closest("button,.btn,.choice,[role='button'],[value]") || element;
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: pageWindow,
        clientX: x,
        clientY: y,
      });
      target.dispatchEvent(event);
    }
  }

  function getRuntime() {
    const runtime = pageWindow[RUNTIME_KEY] || null;
    if (runtime && runtime.ready) return runtime;

    const krRuntime = pageWindow[KR_RUNTIME_KEY];
    if (krRuntime && krRuntime.engine && krRuntime.player) {
      const target = pageWindow[RUNTIME_KEY] = runtime || {};
      target.engine = krRuntime.engine;
      target.player = krRuntime.player;
      target.activeWorld = krRuntime.activeWorld || "";
      target.updatedAt = Date.now();
      target.ready = false;
      target.krRuntimeSeen = true;
      if (!target.errors) target.errors = [];
      if (!target.errors.some((item) => String(item).includes("KR runtime"))) {
        target.errors.push("KR runtime found, but packet bridge is not available. Reload after updating buffer script.");
      }
      return target;
    }

    return runtime;
  }

  function summarizeRuntime() {
    const runtime = getRuntime();
    if (!runtime) return { ready: false };
    return {
      ready: Boolean(runtime.ready),
      activeWorld: runtime.activeWorld || "",
      updatedAt: runtime.updatedAt || null,
      errors: Array.isArray(runtime.errors) ? runtime.errors.slice(-4) : [],
      krRuntimeSeen: Boolean(runtime.krRuntimeSeen || pageWindow[KR_RUNTIME_KEY]),
    };
  }

  function buildDiagnosticStatus() {
    const runtime = getRuntime();
    return {
      version: MOD_VERSION,
      ready: Boolean(runtime && runtime.ready),
      bufferRuntime: summarizeRuntime(),
      krRuntimePresent: Boolean(pageWindow[KR_RUNTIME_KEY]),
      debugTextCommand: "HorderModBuffer.debugText()",
      copyCommand: "HorderModBuffer.copyDebug()",
      clientScripts: Array.from(document.querySelectorAll("script"))
        .map((script) => ({
          src: script.src || "",
          hook: script.dataset && script.dataset.horderBufferRuntimeHooked || "",
          source: script.dataset && script.dataset.horderBufferRuntimeSource || "",
          krHook: script.dataset && script.dataset.hordesKrRuntimeHooked || "",
          krSource: script.dataset && script.dataset.hordesKrRuntimeSource || "",
        }))
        .filter((item) => item.src.includes("client") || item.hook || item.krHook)
        .slice(-20),
    };
  }

  function buildDebugReport() {
    const runtime = getRuntime();
    const krRuntime = pageWindow[KR_RUNTIME_KEY] || null;
    const scripts = collectClientScriptDiagnostics();
    const player = runtime && typeof runtime.getPlayerInfo === "function"
      ? safeCall(() => runtime.getPlayerInfo(), null)
      : null;
    const entities = runtime && typeof runtime.listEntities === "function"
      ? safeCall(() => runtime.listEntities(), [])
      : [];
    const normalizedEntities = Array.isArray(entities) ? entities : [];
    const report = {
      generatedAt: new Date().toISOString(),
      version: MOD_VERSION,
      page: {
        href: location.href,
        pathname: location.pathname,
        readyState: document.readyState,
        visibilityState: document.visibilityState || "",
        userAgent: pageWindow.navigator && pageWindow.navigator.userAgent || "",
        clientOnloadStarted: Boolean(pageWindow.__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__),
      },
      panel: readPanelDiagnostics(),
      state: {
        running: state.running,
        status: state.status,
        lastError: state.lastError,
        minimized: state.minimized,
        useSlot4: state.useSlot4,
        log: state.log.slice(-12),
      },
      runtime: {
        present: Boolean(runtime),
        ready: Boolean(runtime && runtime.ready),
        source: runtime && runtime.source || "",
        activeWorld: runtime && runtime.activeWorld || "",
        updatedAt: runtime && runtime.updatedAt || null,
        updatedAgoMs: runtime && runtime.updatedAt ? Date.now() - runtime.updatedAt : null,
        hasEngine: Boolean(runtime && runtime.engine),
        hasPlayer: Boolean(runtime && runtime.player),
        functions: {
          changeTarget: Boolean(runtime && typeof runtime.changeTarget === "function"),
          sendInteract: Boolean(runtime && typeof runtime.sendInteract === "function"),
          useSkillbarSlot: Boolean(runtime && typeof runtime.useSkillbarSlot === "function"),
          listEntities: Boolean(runtime && typeof runtime.listEntities === "function"),
          getPlayerInfo: Boolean(runtime && typeof runtime.getPlayerInfo === "function"),
          getActiveWorld: Boolean(runtime && typeof runtime.getActiveWorld === "function"),
        },
        hookHits: runtime && runtime.hookHits || null,
        engineKeys: runtime && Array.isArray(runtime.engineKeys) ? runtime.engineKeys : [],
        prototypeInstallScheduledAt: runtime && runtime.prototypeInstallScheduledAt || null,
        prototypeInstallAttempts: runtime && runtime.prototypeInstallAttempts || 0,
        prototypeInstallTimerStarted: Boolean(runtime && runtime.prototypeInstallTimerStarted),
        prototypePatchAt: runtime && runtime.prototypePatchAt || null,
        prototypePatchFhType: runtime && runtime.prototypePatchFhType || "",
        prototypePatchFhKeys: runtime && Array.isArray(runtime.prototypePatchFhKeys) ? runtime.prototypePatchFhKeys : [],
        onloadAutoStartInstalled: Boolean(runtime && runtime.onloadAutoStartInstalled),
        onloadAutoStartInstalledAt: runtime && runtime.onloadAutoStartInstalledAt || null,
        onloadAutoStartAttempts: runtime && runtime.onloadAutoStartAttempts || 0,
        onloadAutoStartReason: runtime && runtime.onloadAutoStartReason || "",
        onloadAutoStartReadyState: runtime && runtime.onloadAutoStartReadyState || "",
        onloadAutoStartOnloadType: runtime && runtime.onloadAutoStartOnloadType || "",
        onloadAutoStartAssignmentCount: runtime && runtime.onloadAutoStartAssignmentCount || 0,
        onloadAutoStartAssignedAt: runtime && runtime.onloadAutoStartAssignedAt || null,
        onloadAutoStartIsClientOnload: Boolean(runtime && runtime.onloadAutoStartIsClientOnload),
        onloadAutoStartDescriptor: runtime && runtime.onloadAutoStartDescriptor || "",
        onloadAutoStartStopped: runtime && runtime.onloadAutoStartStopped || "",
        errors: runtime && Array.isArray(runtime.errors) ? runtime.errors.slice(-12) : [],
        krRuntimeSeen: Boolean(runtime && runtime.krRuntimeSeen),
      },
      krRuntime: {
        present: Boolean(krRuntime),
        hasEngine: Boolean(krRuntime && krRuntime.engine),
        hasPlayer: Boolean(krRuntime && krRuntime.player),
        keys: krRuntime ? Object.keys(krRuntime).sort().slice(0, 80) : [],
        patchedVersion: krRuntime && krRuntime.patchedVersion || "",
        hookHits: krRuntime && krRuntime.hookHits || null,
      },
      player,
      entities: {
        count: normalizedEntities.length,
        conjurers: normalizedEntities
          .filter((entity) => normalizeText(entity && entity.name).includes("conjuer") || normalizeText(entity && entity.name).includes("conjurer"))
          .slice(0, 8)
          .map(summarizeEntity),
        sample: normalizedEntities.slice(0, 8).map(summarizeEntity),
      },
      scripts,
    };
    report.possibleCauses = buildPossibleCauses(report);
    return report;
  }

  function buildDebugText() {
    return JSON.stringify(buildDebugReport(), null, 2);
  }

  function showDebugReport() {
    state.debugVisible = true;
    state.lastDebugText = buildDebugText();
    writeDebugOutput();
    setStatus("진단 리포트 생성");
    return state.lastDebugText;
  }

  async function copyDebugReport() {
    state.debugVisible = true;
    state.lastDebugText = buildDebugText();
    writeDebugOutput();

    let copied = false;
    try {
      if (pageWindow.navigator && pageWindow.navigator.clipboard && typeof pageWindow.navigator.clipboard.writeText === "function") {
        await pageWindow.navigator.clipboard.writeText(state.lastDebugText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) copied = fallbackCopyDebugText();
    setStatus(copied ? "진단 복사됨" : "진단 표시됨: 텍스트를 직접 복사");
    return { copied, text: state.lastDebugText };
  }

  function writeDebugOutput() {
    if (!state.shadow) return;
    const output = state.shadow.getElementById("debug-output");
    if (!output) return;
    output.value = state.lastDebugText || "";
    output.classList.toggle("open", state.debugVisible);
    if (state.debugVisible) {
      try {
        output.focus();
        output.select();
      } catch {
        // Selection is only a convenience for manual copy.
      }
    }
  }

  function fallbackCopyDebugText() {
    if (!state.shadow) return false;
    const output = state.shadow.getElementById("debug-output");
    if (!output) return false;
    try {
      output.focus();
      output.select();
      return Boolean(document.execCommand && document.execCommand("copy"));
    } catch {
      return false;
    }
  }

  function readPanelDiagnostics() {
    const output = state.shadow && state.shadow.getElementById("debug-output");
    const dot = state.shadow && state.shadow.getElementById("dot");
    return {
      present: Boolean(state.panel),
      minimized: state.minimized,
      debugVisible: state.debugVisible,
      dotClass: dot && dot.className || "",
      debugOutputOpen: Boolean(output && output.classList.contains("open")),
    };
  }

  function collectClientScriptDiagnostics() {
    return Array.from(document.querySelectorAll("script"))
      .map((script, index) => {
        const text = script.src ? "" : script.textContent || "";
        return {
          index,
          src: script.src || "",
          type: script.type || "",
          hook: script.dataset && script.dataset.horderBufferRuntimeHooked || "",
          source: script.dataset && script.dataset.horderBufferRuntimeSource || "",
          krHook: script.dataset && script.dataset.hordesKrRuntimeHooked || "",
          krSource: script.dataset && script.dataset.hordesKrRuntimeSource || "",
          textLength: text.length,
          markers: {
            runtime: text.includes(RUNTIME_KEY),
            engineSetter: text.includes("engineSetter"),
            engineConstructor: text.includes("__HORDER_MOD_BUFFER_CAPTURE_ENGINE__"),
            prototypePatch: text.includes("prototypePatchFhType"),
            delayedPrototype: text.includes("prototypeInstallTimerStarted"),
            onloadGuard: text.includes("__HORDER_MOD_BUFFER_CLIENT_ONLOAD_STARTED__"),
            onloadAutoStart: text.includes("onloadAutoStartRun"),
          },
        };
      })
      .filter((item) => item.src.includes("client") || item.hook || item.krHook)
      .slice(-30);
  }

  function buildPossibleCauses(report) {
    const causes = [];
    const hasBufferHook = report.scripts.some((script) => script.hook);
    const hasFallback = report.scripts.some((script) => script.hook === "fallback");
    const hasKrHook = report.scripts.some((script) => script.krHook);

    if (!report.runtime.present) {
      causes.push("Buffer runtime object 없음: Buffer가 client.js 패치에 성공하지 못했거나 너무 늦게 실행되었습니다.");
    }
    if (!hasBufferHook) {
      causes.push("client.js에 Buffer hook 표시가 없음: 유저스크립트가 document-start로 먼저 실행되지 않았을 가능성이 큽니다.");
    }
    if (hasFallback) {
      causes.push("fallback client.js가 삽입됨: client.js 다운로드/패치 중 오류가 있어 원본 스크립트로 되돌아갔습니다.");
    }
    if (hasKrHook || report.krRuntime.present) {
      causes.push("KR runtime/hook 감지됨: 버퍼 계정에서는 KR 모드를 끄고 Buffer만 켜야 합니다.");
    }
    if (report.runtime.present && !report.runtime.hasEngine) {
      causes.push("engine 미감지: client.js 내부 engine setter 패턴이 바뀌었거나 아직 캐릭터 접속이 완료되지 않았습니다.");
    }
    if (report.runtime.present && !report.runtime.hasPlayer) {
      causes.push("player 미감지: 캐릭터가 아직 월드에 들어오지 않았거나 런타임 update가 실패했습니다.");
    }
    if (report.runtime.present && !report.runtime.functions.sendInteract) {
      causes.push("sendInteract 함수 없음: packet bridge 설치가 실패했습니다.");
    }
    if (!causes.length && !report.runtime.ready) {
      causes.push("명확한 원인 없음: 리포트 전체를 전달해 주세요.");
    }
    return causes;
  }

  function summarizeEntity(entity) {
    const pos = entity && Array.isArray(entity.pos) ? entity.pos : [];
    return {
      id: entity && entity.id,
      name: entity && entity.name || "",
      type: entity && entity.type,
      pos: [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0],
    };
  }

  function safeCall(fn, fallback) {
    try {
      const value = fn();
      return value === undefined ? fallback : value;
    } catch (error) {
      return {
        error: (error && error.message) || String(error),
      };
    }
  }

  function buildRuntimeFailureMessage() {
    const diagnostics = buildDiagnosticStatus();
    if (diagnostics.krRuntimePresent && !diagnostics.ready) {
      return "런타임 연결 실패. KR 모드가 client.js를 먼저 잡은 상태라 Buffer 패치가 필요합니다. 스크립트 업데이트 후 페이지를 완전 새로고침해 주세요.";
    }
    return "런타임 연결 실패. 스크립트 업데이트 후 페이지를 완전 새로고침해 주세요.";
  }

  function updatePanel() {
    if (!state.shadow) return;
    const status = state.shadow.getElementById("status");
    const dot = state.shadow.getElementById("dot");
    const guardstone = state.shadow.getElementById("guardstone");
    const headless = state.shadow.getElementById("headless");
    const stop = state.shadow.getElementById("stop");
    const debugOutput = state.shadow.getElementById("debug-output");
    const body = state.shadow.getElementById("body");
    const minimize = state.shadow.getElementById("minimize");
    const useSlot4 = state.shadow.getElementById("use-slot4");
    const runtime = getRuntime();

    if (status) status.textContent = state.status || "대기";
    if (guardstone) guardstone.disabled = state.running;
    if (headless) headless.disabled = state.running;
    if (stop) stop.disabled = !state.running;
    if (body) body.classList.toggle("collapsed", state.minimized);
    if (minimize) minimize.textContent = state.minimized ? "+" : "-";
    if (useSlot4) useSlot4.checked = state.useSlot4;

    const aiEnabled = state.shadow.getElementById("ai-enabled");
    const recallSlot = state.shadow.getElementById("recall-slot");
    const aiStatus = state.shadow.getElementById("ai-status");
    if (aiEnabled) aiEnabled.checked = ai.enabled;
    if (recallSlot && state.shadow.activeElement !== recallSlot) recallSlot.value = String(ai.recallSlot || 0);
    if (aiStatus) {
      const poll = ai.lastPollAt ? (ai.lastPollOk ? "패널OK" : "패널?") : "패널대기";
      const head = ai.enabled ? (ai.account || "AI") : (ai.stopped ? "정지" : "수동");
      aiStatus.textContent = "🧠 " + (ai.activity || ai.mode || "대기") + "\n" + head + " · " + poll;
      aiStatus.style.whiteSpace = "pre-wrap";
    }

    if (debugOutput) {
      debugOutput.classList.toggle("open", state.debugVisible);
      if (state.debugVisible && state.lastDebugText && debugOutput.value !== state.lastDebugText) {
        debugOutput.value = state.lastDebugText;
      }
    }

    if (dot) {
      dot.className = "dot";
      if (state.lastError) dot.classList.add("error");
      else if (state.running) dot.classList.add("busy");
      else if (runtime && runtime.ready) dot.classList.add("ready");
    }
  }

  function setStatus(text) {
    state.status = String(text || "");
    state.log.push({ at: new Date().toISOString(), text: state.status });
    while (state.log.length > 30) state.log.shift();
    updatePanel();
  }

  function readStoredBoolean(key, fallback) {
    try {
      const value = pageWindow.localStorage && pageWindow.localStorage.getItem(key);
      if (value === "1") return true;
      if (value === "0") return false;
    } catch {
      // Ignore storage access errors.
    }
    return fallback;
  }

  function writeStoredBoolean(key, value) {
    try {
      if (pageWindow.localStorage) pageWindow.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage access errors.
    }
  }

  function markRuntimeError(stage, error) {
    const runtime = (pageWindow[RUNTIME_KEY] = pageWindow[RUNTIME_KEY] || {});
    runtime.errors = runtime.errors || [];
    runtime.errors.push(`${stage}: ${(error && error.message) || String(error)}`);
    while (runtime.errors.length > 12) runtime.errors.shift();
  }

  function toUrl(input) {
    if (!input) return null;
    try {
      return new URL(String(input), location.href);
    } catch {
      return null;
    }
  }

  function shortScriptUrl(url) {
    try {
      return `${url.pathname}${url.search || ""}`;
    } catch {
      return String(url || "");
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[.]+$/g, "")
      .trim()
      .toLowerCase();
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = pageWindow.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function distance3(a, b) {
    const dx = Number(a[0] || 0) - Number(b[0] || 0);
    const dy = Number(a[1] || 0) - Number(b[1] || 0);
    const dz = Number(a[2] || 0) - Number(b[2] || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  async function waitFor(producer, timeoutMs, errorMessage, token) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      throwIfCancelled(token);
      const value = producer();
      if (value) return value;
      await sleep(150, token);
    }
    throw new Error(errorMessage);
  }

  function sleep(ms, token) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        done = true;
        resolve();
      }, ms);
      if (!token) return;
      const check = () => {
        if (done) return;
        if (token.cancelled) {
          done = true;
          clearTimeout(timer);
          reject(new Error("cancelled"));
        } else {
          setTimeout(check, 50);
        }
      };
      setTimeout(check, 50);
    });
  }

  function throwIfCancelled(token) {
    if (token && token.cancelled) throw new Error("cancelled");
  }

  // =====================================================================
  // Panel-driven autonomous controller
  //   - heartbeat + command polling against the PHP panel (always on)
  //   - executes remote commands: buff / recall / stop / resume
  //   - when "AI 자동" is enabled: wander near town, auto-buff on obelisk windows
  // =====================================================================

  function readStoredNumber(key, fallback) {
    try {
      const value = pageWindow.localStorage && pageWindow.localStorage.getItem(key);
      if (value !== null && value !== "" && !isNaN(Number(value))) return Number(value);
    } catch {
      // Ignore storage access errors.
    }
    return fallback;
  }

  function writeStoredNumber(key, value) {
    try {
      if (pageWindow.localStorage) pageWindow.localStorage.setItem(key, String(value));
    } catch {
      // Ignore storage access errors.
    }
  }

  function readStoredString(key, fallback) {
    try {
      const value = pageWindow.localStorage && pageWindow.localStorage.getItem(key);
      if (value) return value;
    } catch {
      // Ignore storage access errors.
    }
    return fallback;
  }

  function writeStoredString(key, value) {
    try {
      if (pageWindow.localStorage) pageWindow.localStorage.setItem(key, String(value));
    } catch {
      // Ignore storage access errors.
    }
  }

  function setAiEnabled(value) {
    ai.enabled = Boolean(value);
    writeStoredBoolean(STORAGE_AI_ENABLED_KEY, ai.enabled);
    if (!ai.enabled) {
      ai.leg = null;
      ai.lastDir = null;
      releaseAllMoveKeys();
    } else {
      ai.stopped = false;
    }
    setStatus(ai.enabled ? "AI 자동 켜짐" : "AI 자동 꺼짐");
  }

  function setRecallSlot(slot) {
    let value = Number(slot);
    if (!Number.isFinite(value) || value < 0) value = 0;
    ai.recallSlot = Math.floor(value);
    writeStoredNumber(STORAGE_RECALL_SLOT_KEY, ai.recallSlot);
    setStatus("리콜 슬롯: " + (ai.recallSlot ? ai.recallSlot : "끔"));
  }

  function setFinalDest(dest) {
    ai.finalDest = String(dest || "Guardstone");
    writeStoredString(STORAGE_FINAL_DEST_KEY, ai.finalDest);
    setStatus("버프 후 이동: " + ai.finalDest);
  }

  function classLabel(value) {
    const map = { 0: "Warrior", 1: "Warrior", 2: "Archer", 3: "Mage", 4: "Shaman", 5: "Necromancer" };
    if (value === undefined || value === null || value === "") return "";
    return map[value] || ("class" + value);
  }

  function aiAccountInfo() {
    const runtime = getRuntime();
    const player = runtime && runtime.player ? runtime.player : null;
    const info = runtime && typeof runtime.getPlayerInfo === "function"
      ? safeCall(() => runtime.getPlayerInfo(), null)
      : null;
    const name = (player && player.name) || (info && info.name) || "";
    const klass = classLabel(player ? player.class : (info ? info.type : undefined));
    const pos = (info && Array.isArray(info.pos) && info.pos)
      || (player && (player.pos || player.visualPosition))
      || [0, 0, 0];
    const world = runtime && typeof runtime.getActiveWorld === "function"
      ? safeCall(() => runtime.getActiveWorld(), "")
      : "";
    return { name, klass, pos, world: world || "" };
  }

  function playerPos() {
    const runtime = getRuntime();
    const info = runtime && typeof runtime.getPlayerInfo === "function"
      ? safeCall(() => runtime.getPlayerInfo(), null)
      : null;
    if (info && Array.isArray(info.pos)) return info.pos;
    const player = runtime && runtime.player;
    if (player && Array.isArray(player.pos)) return player.pos;
    return null;
  }

  // Narrate the bot's current decision/action (real-time "thought" feed).
  function think(message) {
    if (!message) return;
    ai.activity = message;
    const last = ai.brain[ai.brain.length - 1];
    if (!last || last.m !== message) {
      ai.brain.push({ t: Date.now(), m: message });
      if (ai.brain.length > 30) ai.brain.shift();
    }
  }

  function formatBrainTime(t) {
    try {
      const d = new Date(t);
      const p = (n) => ("0" + n).slice(-2);
      return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    } catch {
      return "";
    }
  }

  // ===== Human-likeness: per-bot persona, realistic timing, daily rhythm =====
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A stable, distinct "personality" per bot derived from the account name.
  function ensurePersona() {
    if (ai.persona || !ai.account) return ai.persona;
    let h = 2166136261;
    for (let i = 0; i < ai.account.length; i++) { h ^= ai.account.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rng = mulberry32(h >>> 0);
    ai.persona = {
      activity: 0.45 + rng() * 0.45,   // higher => roams more, idles less
      radiusMul: 0.7 + rng() * 0.8,    // personal wander radius
      restMul: 0.7 + rng() * 1.2,      // how long it lingers
      browse: 0.18 + rng() * 0.5,      // chance to actually interact with / browse an NPC
      social: rng(),                   // how much it reacts to nearby players
      afk: 0.05 + rng() * 0.12,        // chance to go AFK for a while
      hesitate: rng() * 0.5,           // extra little pauses
    };
    return ai.persona;
  }

  // Daily activity multiplier by KST hour (evening busy, late night idle).
  function rhythmFactor() {
    const kh = (new Date().getUTCHours() + 9) % 24;
    if (kh >= 2 && kh < 7) return 0.4;     // deep night: mostly idle/afk
    if (kh >= 9 && kh < 17) return 0.7;    // daytime
    if (kh >= 19 && kh < 24) return 1.0;   // evening: most active
    return 0.85;
  }

  // Skewed human pause (ms): mostly short, occasionally long. base = typical value.
  function humanPause(baseMs) {
    const skew = Math.pow(Math.random(), 2.2); // bias toward short
    return Math.round(baseMs * (0.4 + skew * 2.8));
  }

  // ---- Imitation: sample timing/rhythm from the learned human profile ----
  const PROFILE_BUCKETS = [500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, Infinity];

  async function fetchProfile() {
    try {
      const res = await fetchJson(PANEL_BASE_URL + "/api.php?action=getprofile&token=" + panelToken());
      if (res && res.ok && res.profile && res.profile.v === 1) { ai.profile = res.profile; ai.profileAt = Date.now(); }
    } catch {
      // best-effort; falls back to persona heuristics
    }
  }

  function sampleHist(hist) {
    if (!Array.isArray(hist)) return null;
    const total = hist.reduce((a, b) => a + (b || 0), 0);
    if (total <= 0) return null;
    let r = Math.random() * total, i = 0;
    for (; i < hist.length; i++) { r -= hist[i] || 0; if (r <= 0) break; }
    const lo = i === 0 ? 100 : PROFILE_BUCKETS[i - 1];
    const hi = isFinite(PROFILE_BUCKETS[i]) ? PROFILE_BUCKETS[i] : lo * 2;
    return Math.round(lo + Math.random() * (hi - lo));
  }

  // Idle/rest duration: sampled from the human's pause distribution, but floored to a
  // town-natural minimum (so farming's very short loot-pauses don't make town frantic).
  function idleDuration(fallbackMs) {
    if (ai.profile && ai.profile.pauseHist) {
      const v = sampleHist(ai.profile.pauseHist);
      if (v) return Math.max(v, Math.round(humanPause(fallbackMs) * 0.6)); // keeps real long breaks, floors tiny ones
    }
    return humanPause(fallbackMs);
  }

  // Activity level (0..1): take the daily SHAPE of the human's rhythm (when active vs not)
  // but remap intensity to a town-appropriate band — farming intensity != town pacing.
  function activityLevel() {
    const p = ai.profile;
    if (p && p.hourActive) {
      const h = p.hourActive[(new Date().getUTCHours() + 9) % 24];
      if (h && h.t > 30000) return 0.22 + Math.min(1, h.a / h.t) * 0.5; // 0.22..0.72, preserves the shape
    }
    const persona = ensurePersona();
    return (persona ? persona.activity : 0.6) * rhythmFactor();
  }

  // AFK probability per idle. Solo-farming has few AFKs, so blend toward a town baseline.
  function afkChance() {
    const persona = ensurePersona();
    const base = (persona ? persona.afk : 0.08) * (2 - rhythmFactor());
    const p = ai.profile;
    if (p && p.totalMs > 120000) {
      const learned = Math.max(0.02, Math.min(0.4, (p.afkMs / p.totalMs) * 1.5));
      return base * 0.5 + learned * 0.5; // average human-learned AFK with town baseline
    }
    return base;
  }

  function stateForPanel() {
    const mode = ai.mode || "";
    if (ai.stopped) return "stopped";
    if (mode.indexOf("버프") >= 0) return "buffing";
    if (mode.indexOf("귀환") >= 0 || mode.indexOf("리콜") >= 0) return "recall";
    if (ai.obelisk || mode.indexOf("오벨") >= 0) return "obelisk";
    if (ai.leveling || mode.indexOf("파티") >= 0 || mode.indexOf("솔로파밍") >= 0) return "level";
    if (ai.farm || mode.indexOf("전투") >= 0 || mode.indexOf("접근") >= 0 || mode.indexOf("후퇴") >= 0 || mode.indexOf("몹") >= 0 || mode.indexOf("루팅") >= 0 || mode.indexOf("회복") >= 0) return "farm";
    if (mode.indexOf("AFK") >= 0) return "afk";
    if (mode.indexOf("배회") >= 0 || mode.indexOf("구경") >= 0) return "wander";
    if (mode.indexOf("수동") >= 0) return "idle";
    return "idle";
  }

  // The embedded token is a default. If this script is published publicly, set a
  // private token per install with HorderModBuffer.setPanelToken("...") (stored in
  // localStorage) and use the same value in the panel's config.php.
  function panelToken() {
    return readStoredString("horder_mod_buffer_panel_token", PANEL_TOKEN);
  }

  async function fetchJson(url, options) {
    const fetchImpl = originalFetch || pageWindow.fetch;
    if (!fetchImpl) throw new Error("fetch unavailable");
    const response = await fetchImpl(url, options || { credentials: "omit", cache: "no-store" });
    if (!response.ok) throw new Error("http " + response.status);
    return await response.json();
  }

  function startAiController() {
    if (ai.started) return;
    ai.started = true;
    fetchProfile();   // imitation profile (timing/rhythm learned from real play)
    pollPanelLoop();
    aiBehaviorLoop();
  }

  async function pollPanelLoop() {
    for (;;) {
      try {
        await pollPanelOnce();
        if (Date.now() - ai.profileAt > 600000) await fetchProfile(); // refresh ~10min
      } catch {
        ai.lastPollOk = false;
      }
      await sleep(PANEL_POLL_MS);
    }
  }

  async function pollPanelOnce() {
    const runtime = getRuntime();
    if (!runtime || !runtime.ready) return;
    const account = aiAccountInfo();
    if (!account.name) return;
    ai.account = account.name;
    ai.klass = account.klass;

    const params = new URLSearchParams({
      action: "poll",
      token: panelToken(),
      account: account.name,
      class: account.klass || "",
      state: stateForPanel(),
      world: account.world || "",
      x: String(Math.round(account.pos[0] || 0)),
      y: String(Math.round(account.pos[1] || 0)),
      z: String(Math.round(account.pos[2] || 0)),
      activity: (ai.activity || "").slice(0, 120),
      brain: ai.brain.slice(-10).map((e) => formatBrainTime(e.t) + " " + e.m).join("\n").slice(0, 700),
    });
    const result = await fetchJson(PANEL_BASE_URL + "/api.php?" + params.toString());
    ai.lastPollAt = Date.now();
    ai.lastPollOk = Boolean(result && result.ok);
    if (!result || !result.ok || !Array.isArray(result.commands)) return;

    const ackNow = [];
    for (const entry of result.commands) {
      const command = String(entry.command || "").toLowerCase();
      if (command === "buff") {
        ai.pendingBuff = { id: entry.id, dest: entry.payload || "" };
      } else if (command === "recall") {
        ai.pendingRecall = { id: entry.id };
      } else if (command === "stop") {
        ai.stopped = true;
        ackNow.push(entry.id);
      } else if (command === "start" || command === "enable" || command === "resume" || command === "wander") {
        setAiEnabled(true); // remote one-click activation of autonomous mode
        ai.stopped = false;
        ai.farm = false; ai.leveling = false; ai.obelisk = false;
        ackNow.push(entry.id);
      } else if (command === "disable") {
        setAiEnabled(false);
        ai.farm = false; ai.leveling = false; ai.obelisk = false;
        ackNow.push(entry.id);
      } else if (command === "farm") {
        setAiEnabled(true); ai.stopped = false; ai.farm = true; ai.leveling = false; ai.obelisk = false;
        ackNow.push(entry.id);
      } else if (command === "farmoff" || command === "farmstop") {
        ai.farm = false; releaseAllMoveKeys();
        ackNow.push(entry.id);
      } else if (command === "level" || command === "leveling") {
        setAiEnabled(true); ai.stopped = false; ai.leveling = true; ai.farm = false; ai.obelisk = false; ai._partyAt = 0;
        ackNow.push(entry.id);
      } else if (command === "leveloff") {
        ai.leveling = false; releaseAllMoveKeys();
        ackNow.push(entry.id);
      } else if (command === "obelisk") {
        setAiEnabled(true); ai.stopped = false; ai.obelisk = true; ai.farm = false; ai.leveling = false; ai._obAt = 0;
        ackNow.push(entry.id);
      } else if (command === "obeliskoff") {
        ai.obelisk = false; releaseAllMoveKeys();
        ackNow.push(entry.id);
      } else {
        ackNow.push(entry.id);
      }
    }
    if (ackNow.length) await ackCommands(ackNow);
  }

  async function ackCommands(ids) {
    const list = ids.filter((id) => id !== undefined && id !== null);
    if (!list.length) return;
    try {
      await fetchJson(PANEL_BASE_URL + "/api.php?action=ack&token=" + panelToken() + "&ids=" + list.join(","));
    } catch {
      // Ack failures are non-fatal; the command is already marked sent server-side.
    }
  }

  async function aiBehaviorLoop() {
    for (;;) {
      try {
        await aiStep();
      } catch {
        // Never let a controller error escape into the game.
      }
      await sleep(AI_TICK_MS);
    }
  }

  async function aiStep() {
    const runtime = getRuntime();
    if (!runtime || !runtime.ready) {
      ai.mode = "연결대기";
      return;
    }
    if (state.running) {
      ai.mode = "버프중";
      return;
    }

    // Explicit remote commands run regardless of the auto toggle.
    if (ai.pendingRecall) {
      ai.mode = "귀환";
      think("📥 귀환 명령 수신 → 마을로 리콜");
      releaseAllMoveKeys();
      await doRecall(runtime);
      const id = ai.pendingRecall.id;
      ai.pendingRecall = null;
      await ackCommands([id]);
      return;
    }
    if (ai.pendingBuff) {
      const wasWandering = ai.enabled;     // item 5: a buff command turns wander OFF
      const dest = ai.pendingBuff.dest || "";
      setAiEnabled(false);
      ai.stopped = false;
      ai.mode = "버프";
      think("📥 버프 명령 수신 → " + (dest || "Guardstone") + " 코스 시작");
      releaseAllMoveKeys();
      // item 6: if it was wandering, force recall -> move to NPC -> run buff route
      await goBuff(runtime, dest, wasWandering);
      const id = ai.pendingBuff.id;
      ai.pendingBuff = null;
      await ackCommands([id]);
      return;
    }

    if (ai.stopped) {
      ai.mode = "정지";
      think("⏸ 정지됨 (패널 명령 대기)");
      releaseAllMoveKeys();
      return;
    }
    if (!ai.enabled) {
      ai.mode = "수동(폴링만)";
      think("🅿️ 자율행동 OFF (명령만 대기)");
      return;
    }

    if (ai.obelisk) { await obeliskStep(runtime); return; } // faction war (window-gated)
    if (ai.leveling) { await levelingStep(runtime); return; } // follow band party + farm
    if (ai.farm) { await farmStep(runtime); return; } // combat farming (leveling)

    // Obelisk auto-buff removed by request (handled manually via the panel button).
    await wanderStep(runtime);
  }

  async function goBuff(runtime, dest, forceRecall) {
    releaseAllMoveKeys();
    if (forceRecall) {
      ai.mode = "리콜";
      think("🏠 배회 중단 → 마을 리콜(5초 캐스트)");
      castRecall(runtime);
      await sleep(RECALL_WAIT_MS);
    } else {
      await maybeRecallToTown(runtime);
    }
    think("🚶 Conjurer 앞으로 이동");
    await ensureNearConjurer(runtime, false);
    if (!state.running) {
      think("✨ Faivel 버프 코스 실행 → " + (dest || ai.finalDest || "Guardstone"));
      await runBufferFlow(dest || ai.finalDest || "Guardstone");
    }
    ai.lastBuffAt = Date.now();
  }

  // Returns the recall cast result. Prefers a user-bound skillbar slot; otherwise
  // casts the universal town-recall skill (id 40) directly — works for every class
  // with no manual binding required.
  function castRecall(runtime) {
    try {
      if (ai.recallSlot && ai.recallSlot >= 1) {
        if (typeof runtime.useSkillbarSlot === "function") return runtime.useSkillbarSlot(ai.recallSlot);
        pressKey(String(ai.recallSlot));
        return { ok: true, slot: ai.recallSlot };
      }
      if (typeof runtime.useSkill === "function") return runtime.useSkill(RECALL_SKILL_ID);
    } catch {
      // Fall through; navigation will still be attempted by the caller.
    }
    return { ok: false };
  }

  async function doRecall(runtime) {
    ai.mode = "리콜";
    castRecall(runtime);
    await sleep(RECALL_WAIT_MS);
    await ensureNearConjurer(runtime, true);
  }

  async function maybeRecallToTown(runtime) {
    const conjurer = findNearestConjurer(runtime);
    const pos = playerPos();
    const far = !conjurer || !pos || distance3(pos, conjurer.pos || []) > RECALL_FAR_DIST;
    if (!far) return; // already near a Conjurer / in town
    ai.mode = "리콜";
    castRecall(runtime);
    await sleep(RECALL_WAIT_MS);
  }

  async function ensureNearConjurer(runtime, idleAfter) {
    const conjurer = findNearestConjurer(runtime);
    if (!conjurer) {
      ai.mode = "Conjurer 탐색";
      if (idleAfter) await sleep(800);
      return;
    }
    await navTo(runtime, { x: conjurer.pos[0], z: conjurer.pos[2] }, NEAR_CONJURER_DIST, 14000);
    if (idleAfter) await sleep(800 + Math.floor(Math.random() * 1200));
  }

  async function navTowardPos(runtime, target, withinDist, maxMs) {
    if (!Array.isArray(target)) return false;
    const startedAt = Date.now();
    const order = ["forward", "right", "back", "left"];
    let index = 0;
    let prevDist = curDistTo(target);
    while (Date.now() - startedAt < maxMs) {
      if (ai.stopped) break;
      const dist = curDistTo(target);
      if (dist === null) break;
      if (dist <= withinDist) {
        releaseAllMoveKeys();
        return true;
      }
      await holdMove(order[index % order.length], MOVE_PULSE_MS);
      await sleep(70);
      const nextDist = curDistTo(target);
      if (nextDist === null) break;
      if (nextDist >= prevDist - 0.25) index += 1; // no progress: rotate to next direction
      prevDist = nextDist;
    }
    releaseAllMoveKeys();
    return false;
  }

  function curDistTo(target) {
    const pos = playerPos();
    if (!pos || !Array.isArray(target)) return null;
    return distance3(pos, target);
  }

  // Human-like sightseeing: stroll to a point, look around, rest, move on. Learns
  // static landmarks (NPCs/shops) on the single map and revisits them.
  async function wanderStep(runtime) {
    const world = typeof runtime.getActiveWorld === "function"
      ? safeCall(() => runtime.getActiveWorld(), "")
      : "";
    const pos = playerPos();
    // Detect a teleport (recall / move-NPC jump on the single map) and re-anchor home.
    if (ai.lastPos && pos && Math.hypot(pos[0] - ai.lastPos[0], pos[2] - ai.lastPos[2]) > TELEPORT_DIST) {
      ai.home = null; ai.leg = null; ai.occ = null;
    }
    ai.lastPos = pos;
    if (ai.home && ai.homeWorld && world && world !== ai.homeWorld) {
      ai.home = null; ai.leg = null; ai.occ = null;
    }
    if (!ai.home) {
      // Prefer a known surveyed town (anchor to its center, use its baked spots).
      const town = pos ? nearestKnownTown(pos) : null;
      if (town) {
        ai.home = [town.cx, (pos ? pos[1] : 0), town.cz];
        ai.knownSpots = town.spots;
        ai.townName = town.name;
      } else {
        const conjurer = findNearestConjurer(runtime);
        ai.home = (conjurer && conjurer.pos) || pos || null;
        ai.knownSpots = null;
        ai.townName = "";
      }
      ai.homeWorld = world || "";
    }
    if (!ai.home || !pos) { await sleep(800); return; }

    learnWaypoints(runtime); // remember nearby static landmarks (town NPCs) for sightseeing
    const persona = ensurePersona();
    const act = activityLevel(); // learned human rhythm if available, else persona*time-of-day

    // Often just hang around instead of always striking off somewhere (idle / AFK / people-watch).
    if (!ai.leg && Math.random() > act) {
      await idleBehavior(runtime, persona);
      return;
    }

    // Leash: if we somehow drifted off, head back toward town.
    if (dist2(pos, { x: ai.home[0], z: ai.home[2] }) > ROAM_HARD_LIMIT) {
      ai.leg = { x: ai.home[0], z: ai.home[2] };
    }
    if (!ai.leg) ai.leg = pickRoamTarget();

    think("🎯 " + (ai.townName || "이 동네") + " (" + Math.round(ai.leg.x) + "," + Math.round(ai.leg.z) + ") 쪽으로 가는 중");
    const reached = await navTo(runtime, ai.leg, ARRIVE_DIST, 16000);
    if (reached) {
      if (persona && Math.random() < persona.browse) await browseNpc(runtime); // browse the NPC sometimes
      think("👀 도착 — 둘러보는 중");
      await lookAround(runtime);
    } else {
      think("…길이 막혀서 다른 데로");
    }
    ai.leg = null;
  }

  // Hang-around behaviors when not heading somewhere: AFK, people-watching, or fidgeting.
  async function idleBehavior(runtime, persona) {
    if (Math.random() < afkChance()) {
      const ms = 20000 + Math.floor(Math.random() * 95000);
      ai.mode = "AFK";
      think("💤 잠수 (" + Math.round(ms / 1000) + "초)");
      releaseAllMoveKeys();
      await sleep(ms);
      return;
    }
    if (persona && Math.random() < persona.social * 0.5 && (await reactToNearbyPlayer(runtime))) return;
    ai.mode = "구경";
    think("🧍 가만히 서서 구경");
    const turns = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < turns; i++) {
      if (ai.stopped || !ai.enabled || ai.pendingBuff) return;
      await turnBy((Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 1.4));
      await sleep(humanPause(1400));
    }
    if (Math.random() < 0.15) { dispatchKeyEvent("keydown", "Space", " "); await sleep(140); dispatchKeyEvent("keyup", "Space", " "); }
    await sleep(idleDuration(1800 * (persona ? persona.restMul : 1)));
  }

  // Notice a nearby player and turn to look at them (like a curious passer-by).
  async function reactToNearbyPlayer(runtime) {
    try {
      const ents = typeof runtime.listEntities === "function" ? runtime.listEntities() : [];
      const p = playerPos();
      if (!p) return false;
      let best = null, bd = 16;
      for (const e of ents) {
        if (!e || e.type !== 0 || !e.name || e.name === ai.account || !Array.isArray(e.pos)) continue;
        const d = Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      ai.mode = "구경";
      think("👀 근처 " + String(best.name).slice(0, 16) + " 쳐다봄");
      await faceWorldDir(runtime, Math.atan2(best.pos[2] - p[2], best.pos[0] - p[0]));
      await sleep(humanPause(2400));
      return true;
    } catch {
      return false;
    }
  }

  // Rotate the character to face a world-space direction (sample heading, correct).
  async function faceWorldDir(runtime, desired) {
    const before = playerPos();
    if (!before) return;
    dispatchKeyEvent("keydown", "KeyW", "w");
    await sleep(220);
    dispatchKeyEvent("keyup", "KeyW", "w");
    await sleep(120);
    const after = playerPos();
    if (!after) return;
    if (Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.4) return;
    const heading = Math.atan2(after[2] - before[2], after[0] - before[0]);
    const err = normAngle(desired - heading);
    if (Math.abs(err) > 0.25) await turnBy(err);
  }

  // Walk up to an NPC and briefly open its dialog, like browsing a shop, then leave.
  async function browseNpc(runtime) {
    try {
      const p = playerPos();
      if (!p) return;
      const ents = typeof runtime.listEntities === "function" ? runtime.listEntities() : [];
      let npc = null, bd = 6;
      for (const e of ents) {
        if (!e || !e.static || !e.name || !Array.isArray(e.pos)) continue;
        const d = Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]);
        if (d < bd) { bd = d; npc = e; }
      }
      if (!npc) return;
      ai.mode = "구경";
      think("🛍️ " + String(npc.name).slice(0, 16) + " 구경 중");
      try { runtime.changeTarget(npc.id); await sleep(180); runtime.sendInteract(npc.id); } catch { /* ignore */ }
      await sleep(humanPause(2600));
      dispatchKeyEvent("keydown", "Escape", "Escape");
      await sleep(80);
      dispatchKeyEvent("keyup", "Escape", "Escape");
      await sleep(humanPause(600));
    } catch {
      // ignore
    }
  }

  function nearestKnownTown(pos) {
    let best = null, bestD = KNOWN_TOWN_RADIUS;
    for (const t of KNOWN_TOWNS) {
      const d = Math.hypot(pos[0] - t.cx, pos[2] - t.cz);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  function pickRoamTarget() {
    const r = Math.random();
    // Prefer baked town spots (real NPCs/landmarks) when in a known town.
    if (ai.knownSpots && ai.knownSpots.length && r < 0.7) {
      const s = ai.knownSpots[Math.floor(Math.random() * ai.knownSpots.length)];
      return { x: s[0] + (Math.random() - 0.5) * 5, z: s[1] + (Math.random() - 0.5) * 5 };
    }
    if (!ai.knownSpots && ai.waypoints.length && r < 0.5) {
      const w = ai.waypoints[Math.floor(Math.random() * ai.waypoints.length)];
      return { x: w.x + (Math.random() - 0.5) * 6, z: w.z + (Math.random() - 0.5) * 6 };
    }
    if (r < 0.9 || !ai.home) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 8 + Math.random() * ROAM_RADIUS * (ai.persona ? ai.persona.radiusMul : 1);
      return { x: ai.home[0] + Math.cos(ang) * rad, z: ai.home[2] + Math.sin(ang) * rad };
    }
    return { x: ai.home[0], z: ai.home[2] }; // amble back toward town center
  }

  // Walk to a target the human way: probe a stride, turn (arrow keys) to face the
  // target, then run forward. Self-corrects heading; the camera follows the turn.
  // Smooth human movement: hold W continuously and steer with brief ArrowLeft/Right
  // pulses (turn WHILE moving = no stutter). Wall-follow when progress stalls.
  async function walkTo(runtime, target, withinDist, maxMs) {
    ai.mode = "배회";
    const startedAt = Date.now();
    let prev = playerPos();
    if (!prev) return false;
    let best = dist2(prev, target);
    let lastImprove = Date.now();
    let mode = "direct";
    let followFlip = 1;
    holdForward(true);
    try {
      while (Date.now() - startedAt < maxMs) {
        if (ai.stopped || !ai.enabled || ai.pendingBuff || ai.pendingRecall) return false;
        await sleep(210);
        const p = playerPos();
        if (!p) return false;
        const d = dist2(p, target);
        if (d <= withinDist) return true;
        const moved = Math.hypot(p[0] - prev[0], p[2] - prev[2]);
        const heading = moved > 0.5 ? Math.atan2(p[2] - prev[2], p[0] - prev[0]) : null;
        if (d < best - 0.6) { best = d; lastImprove = Date.now(); if (mode === "wallfollow") mode = "direct"; }
        if (Date.now() - lastImprove > 1400) mode = "wallfollow";
        const desired = Math.atan2(target.z - p[2], target.x - p[0]);
        if (mode === "direct") {
          if (heading != null) {
            const err = normAngle(desired - heading);
            if (Math.abs(err) > 0.22) {
              await steerPulse(err > 0 ? "ArrowRight" : "ArrowLeft", Math.min(Math.max(Math.abs(err) * 230, 55), 320));
            }
          }
        } else {
          // Slide along the obstacle; flip side if it stays stuck too long.
          if (Date.now() - lastImprove > 4000) { followFlip = -followFlip; lastImprove = Date.now() - 1400; }
          await steerPulse(followFlip > 0 ? "ArrowRight" : "ArrowLeft", 170);
        }
        prev = p;
      }
      return false;
    } finally {
      holdForward(false);
    }
  }

  function holdForward(on) {
    dispatchKeyEvent(on ? "keydown" : "keyup", "KeyW", "w");
  }

  // Pulse a camera turn key briefly while W stays held (smooth steering).
  async function steerPulse(arrowKey, ms) {
    dispatchKeyEvent("keydown", arrowKey, arrowKey);
    try {
      await sleep(ms);
    } finally {
      dispatchKeyEvent("keyup", arrowKey, arrowKey);
    }
  }

  // ===== Learned walkable map + A* routing (so the bot never walks into walls) =====

  // Build an occupancy grid around (cx,cz) directly from the engine collision mesh:
  // steep wall triangles that rise above step height into the body band => blocked cells.
  function buildOccupancy(runtime, cx, cz) {
    try {
      const eng = runtime && runtime.engine;
      if (!eng || !eng.triangleGrid || typeof eng.getHeight !== "function") return null;
      const tg = eng.triangleGrid;
      if (typeof tg.queryAABB !== "function") return null;
      const R = OCC_R, CELL = OCC_CELL, N = Math.ceil((2 * R) / CELL), X0 = cx - R, Z0 = cz - R;
      const grid = new Uint8Array(N * N);
      const tris = tg.queryAABB([X0, 400, Z0, X0 + 2 * R, 700, Z0 + 2 * R]);
      const markR = Math.ceil(OCC_INFLATE / CELL);
      for (let ti = 0; ti < tris.length; ti++) {
        const t = tris[ti];
        const ny = t[3] ? t[3][1] : 0;
        if (Math.abs(ny) >= OCC_NY_MAX) continue;
        const ccx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const ccz = (t[0][2] + t[1][2] + t[2][2]) / 3;
        const lf = eng.getHeight(ccx, ccz);
        const mn = Math.min(t[0][1], t[1][1], t[2][1]);
        const mx = Math.max(t[0][1], t[1][1], t[2][1]);
        if (mx <= lf + OCC_STEP || mn > lf + OCC_BODY) continue;
        const edges = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
        for (let ei = 0; ei < 3; ei++) {
          const a = edges[ei][0], b = edges[ei][1];
          const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
          const steps = Math.max(1, Math.ceil(len / (CELL * 0.6)));
          for (let s = 0; s <= steps; s++) {
            const f = s / steps;
            const ix = Math.round((a[0] + (b[0] - a[0]) * f - X0) / CELL);
            const iz = Math.round((a[2] + (b[2] - a[2]) * f - Z0) / CELL);
            for (let aa = -markR; aa <= markR; aa++) {
              for (let bb = -markR; bb <= markR; bb++) {
                const x = ix + aa, z = iz + bb;
                if (x >= 0 && x < N && z >= 0 && z < N) grid[x * N + z] = 1;
              }
            }
          }
        }
      }
      return { grid, N, X0, Z0, CELL, cx, cz, R };
    } catch {
      return null;
    }
  }

  function ensureOccupancy(runtime) {
    const me = playerPos();
    if (!me) return null;
    if (ai.occ && Math.hypot(me[0] - ai.occ.cx, me[2] - ai.occ.cz) < ai.occ.R * 0.55) return ai.occ;
    ai.occ = buildOccupancy(runtime, me[0], me[2]);
    return ai.occ;
  }

  // A* over the occupancy grid; returns world-coord waypoints [[x,z],...] or null.
  function findPath(occ, sx, sz, gx, gz) {
    const { grid, N, X0, Z0, CELL } = occ;
    const idx = (i, j) => i * N + j;
    const free = (i, j) => i >= 0 && i < N && j >= 0 && j < N && !grid[idx(i, j)];
    const snap = (x, z) => {
      let i = Math.round((x - X0) / CELL), j = Math.round((z - Z0) / CELL);
      if (free(i, j)) return [i, j];
      for (let r = 1; r < 24; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (free(i + a, j + b)) return [i + a, j + b];
      return null;
    };
    const S = snap(sx, sz), G = snap(gx, gz);
    if (!S || !G) return null;
    const total = N * N;
    const gscore = new Float32Array(total).fill(1e9);
    const came = new Int32Array(total).fill(-1);
    const heap = [];
    const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = 2 * c + 2; let s = c; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === c) break; const tmp = heap[s]; heap[s] = heap[c]; heap[c] = tmp; c = s; } } return top; };
    const h = (k) => Math.hypot(Math.floor(k / N) - G[0], (k % N) - G[1]);
    const goalK = idx(G[0], G[1]);
    const startK = idx(S[0], S[1]);
    gscore[startK] = 0; push(h(startK), startK);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
    let it = 0;
    while (heap.length && it++ < 300000) {
      const cur = pop(); const k = cur[1];
      if (k === goalK) {
        const path = []; let c = k;
        while (c !== -1) { path.push([X0 + Math.floor(c / N) * CELL, Z0 + (c % N) * CELL]); c = came[c]; }
        return path.reverse();
      }
      const ci = Math.floor(k / N), cj = k % N;
      for (let di = 0; di < 8; di++) {
        const dd = dirs[di], ni = ci + dd[0], nj = cj + dd[1];
        if (!free(ni, nj)) continue;
        if (dd[0] && dd[1] && (!free(ci + dd[0], cj) || !free(ci, cj + dd[1]))) continue;
        const nk = idx(ni, nj), ng = gscore[k] + dd[2];
        if (ng < gscore[nk]) { gscore[nk] = ng; came[nk] = k; push(ng + h(nk), nk); }
      }
    }
    return null;
  }

  // Route to target via A* on the learned map, following waypoints with smooth steering.
  // Falls back to direct smooth movement if no map/path is available.
  async function navTo(runtime, target, withinDist, maxMs) {
    const me = playerPos();
    const occ = ensureOccupancy(runtime);
    const path = (occ && me) ? findPath(occ, me[0], me[2], target.x, target.z) : null;
    if (!path || path.length < 2) {
      think(occ ? "🧭 직선 접근(가까움)" : "🧭 맵 학습 전 — 직선 이동");
      return walkTo(runtime, target, withinDist, maxMs);
    }
    const wp = path.filter((_, i) => i % 3 === 0 || i === path.length - 1);
    think("🗺️ 경로 계획: 벽 피해 " + wp.length + "개 지점 따라 이동");
    ai.mode = "배회";
    holdForward(true);
    try {
      let wi = 0, prev = me, best = 1e9, lastImprove = Date.now();
      const startedAt = Date.now();
      while (Date.now() - startedAt < maxMs && wi < wp.length) {
        if (ai.stopped || !ai.enabled || ai.pendingBuff || ai.pendingRecall) return false;
        await sleep(200);
        const p = playerPos();
        if (!p) return false;
        if (dist2(p, target) <= withinDist) return true;
        const tw = wp[wi];
        const dwp = Math.hypot(p[0] - tw[0], p[2] - tw[1]);
        if (dwp < 2.5) { wi++; best = 1e9; lastImprove = Date.now(); continue; }
        if (dwp < best - 0.5) { best = dwp; lastImprove = Date.now(); }
        else if (Date.now() - lastImprove > 2600) { wi++; best = 1e9; lastImprove = Date.now(); continue; } // skip a snagged waypoint
        const moved = Math.hypot(p[0] - prev[0], p[2] - prev[2]);
        const heading = moved > 0.4 ? Math.atan2(p[2] - prev[2], p[0] - prev[0]) : null;
        if (heading != null) {
          const err = normAngle(Math.atan2(tw[1] - p[2], tw[0] - p[0]) - heading);
          if (Math.abs(err) > 0.2) await steerPulse(err > 0 ? "ArrowRight" : "ArrowLeft", Math.min(Math.max(Math.abs(err) * 230, 55), 300));
        }
        prev = p;
      }
      return dist2(playerPos(), target) <= withinDist + 2;
    } finally {
      holdForward(false);
    }
  }

  // Turn the character by ~rad radians using the camera turn keys (ArrowLeft/Right).
  async function turnBy(rad) {
    const key = rad >= 0 ? "ArrowRight" : "ArrowLeft";
    const ms = Math.min(Math.abs(rad) * TURN_MS_PER_RAD, 650);
    if (ms < 45) return;
    dispatchKeyEvent("keydown", key, key);
    try {
      await sleep(ms);
    } finally {
      dispatchKeyEvent("keyup", key, key);
    }
    await sleep(60);
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  async function lookAround(runtime) {
    ai.mode = "구경";
    const restMul = ai.persona ? ai.persona.restMul : 1;
    const turns = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < turns; i++) {
      if (ai.stopped || !ai.enabled || ai.pendingBuff) return;
      await turnBy((Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.3)); // look around
      await sleep(humanPause(1100)); // observe (skewed: usually short, sometimes a long stare)
    }
    if (Math.random() < 0.2) {
      dispatchKeyEvent("keydown", "Space", " ");
      await sleep(150);
      dispatchKeyEvent("keyup", "Space", " ");
    }
    const restMs = idleDuration(1600 * restMul);
    think("😌 잠깐 쉬는 중 (" + (restMs / 1000).toFixed(1) + "초)");
    await sleep(restMs); // rest a while, like a person
  }

  // ===== Combat farming (leveling) — verified live: approach+face, cast rotation, loot, retreat =====
  function hpFracOf(e) {
    try { const c = e.stats.getResource(HP_RES_IDX), m = e.stats.getStat(HP_RES_IDX); return m > 0 ? c / m : 0; } catch { return 1; }
  }

  // Prefer real combat mobs (type 1: e.g. River Crocodile). Type-10 "Greedy"
  // critters are level-1 ambient pinatas whose HP never drops to skill attacks,
  // so only fall back to them when no real mob is around. Skip blacklisted ids
  // (targets that took no damage — un-killable critters or unreachable mobs).
  function nearestMobEntity(eng, me, R) {
    const arr = eng.entities && eng.entities.array;
    if (!arr) return null;
    const now = Date.now();
    let best = null, bd = R, alt = null, ad = R;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (!e || !e.pos || !e.stats || e.id === me.id) continue;
      const enemyPlayer = ai._warTarget && e.type === 0 && e.faction !== me.faction; // war: enemy faction
      if (!enemyPlayer && e.type !== 1 && e.type !== 10) continue;
      if (!enemyPlayer && e.level && me.level && e.level > me.level + 5) continue; // too dangerous to solo
      if (hpFracOf(e) <= 0) continue;
      const skip = ai._skipMobs[e.id];
      if (skip) { if (skip > now) continue; delete ai._skipMobs[e.id]; }
      const d = Math.hypot(e.pos[0] - me.pos[0], e.pos[2] - me.pos[2]);
      if (e.type === 1 || enemyPlayer) { if (d < bd) { bd = d; best = e; } } // real mobs + enemies preferred
      else if (d < ad) { ad = d; alt = e; }
    }
    return best || alt;
  }

  function isDead(me) { try { return !!(me && me.stats && me.stats.alive === false); } catch { return false; } }

  // Death recovery: the death panel's "Respawn" button is a DOM element (resurrects
  // at the nearest conjurer). Without this the combat loop would wait forever at HP 0.
  async function respawnIfDead(runtime) {
    let me = runtime.engine && runtime.engine.player;
    if (!isDead(me)) return false;
    ai.mode = "사망";
    releaseAllMoveKeys();
    think("💀 사망 — 부활 시도");
    for (let i = 0; i < 16; i++) {
      me = runtime.engine && runtime.engine.player;
      if (!isDead(me)) { think("✨ 부활 완료 — 복귀"); ai._tgtId = 0; ai._tgtStuck = 0; ai._warTarget = false; return true; }
      const btn = findChoiceElement("Respawn");
      if (btn) clickLikeUser(btn);
      await sleep(1500);
    }
    return true; // give up this cycle; outer loop will retry
  }

  // One farmStep runs a self-contained combat burst (~8s) at ~200ms cadence so
  // attacks land fast — the outer AI loop's per-tick sleep is far too slow for
  // melee. Interrupts (stop/buff/recall) are checked every iteration.
  async function farmStep(runtime) {
    const eng = runtime.engine, me = eng && eng.player;
    if (!me || !me.stats || typeof me.stats.getResource !== "function") { ai.mode = "전투대기"; await sleep(700); return; }
    if (await respawnIfDead(runtime)) return;

    const burstEnd = Date.now() + FARM_BURST_MS;
    let holding = false;
    let prev = playerPos();
    try {
      while (Date.now() < burstEnd) {
        if (ai.stopped || !ai.enabled || (!ai.farm && !ai.leveling && !ai.obelisk) || ai.pendingBuff || ai.pendingRecall) return;

        const myHp = hpFracOf(me);
        if (myHp >= 0 && myHp < FARM_RETREAT_HP) {
          if (holding) { holdForward(false); holding = false; }
          ai.mode = "후퇴";
          think("🩸 HP " + Math.round(myHp * 100) + "% — 후퇴/회복");
          await farmRetreat(runtime);
          return;
        }

        let target = eng.entities.array.find((e) => e && e.id === me.target && (e.type === 1 || (ai._warTarget && e.type === 0 && e.faction !== me.faction)) && hpFracOf(e) > 0 && !(ai._skipMobs[e.id] > Date.now()));
        if (!target) target = nearestMobEntity(eng, me, FARM_RADIUS);
        if (!target) {
          if (holding) { holdForward(false); holding = false; }
          ai.mode = "몹탐색";
          think("🔎 주변에 몹 없음 — 이동");
          if (FARM_LOOT) await lootNearby(runtime);
          await navTo(runtime, pickRoamTarget(), 4, 7000);
          return;
        }

        try { if (me.target !== target.id) runtime.changeTarget(target.id); } catch { /* ignore */ }
        const d = Math.hypot(target.pos[0] - me.pos[0], target.pos[2] - me.pos[2]);

        if (d > FARM_RANGE) {
          // Approach: hold W and steer toward the mob using measured heading.
          if (!holding) { holdForward(true); holding = true; }
          ai.mode = "접근";
          think("🏃 " + String(target.name).slice(0, 14) + " 접근 (" + Math.round(d) + ")");
          const before = prev || playerPos();
          await sleep(200);
          const after = playerPos();
          if (before && after) {
            const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
            if (moved > 0.4) {
              const err = normAngle(Math.atan2(target.pos[2] - after[2], target.pos[0] - after[0]) - Math.atan2(after[2] - before[2], after[0] - before[0]));
              if (Math.abs(err) > 0.25) await steerPulse(err > 0 ? "ArrowRight" : "ArrowLeft", Math.min(Math.max(Math.abs(err) * 220, 55), 280));
            } else {
              await steerPulse(Math.random() < 0.5 ? "ArrowRight" : "ArrowLeft", 150); // unstick
            }
            prev = after;
          }
          continue;
        }

        // In range: stop and attack on the GCD.
        if (holding) { holdForward(false); holding = false; }
        ai.mode = "전투";
        const sk = eng.player.skills;
        if (!sk || typeof sk.gcdEnd !== "number" || eng.time >= sk.gcdEnd) {
          think("⚔️ " + String(target.name).slice(0, 14) + " 공격 (HP " + Math.round(hpFracOf(target) * 100) + "%)");
          // Advance through the rotation until a real (non-empty) skill is sent, so
          // an empty slot doesn't waste the GCD. useSkillbarSlot returns ok:false for
          // empty slots and ok:true once a skill packet is actually sent.
          for (let tries = 0; tries < FARM_SKILL_SLOTS.length; tries++) {
            const slot = FARM_SKILL_SLOTS[ai._rot % FARM_SKILL_SLOTS.length];
            ai._rot = (ai._rot + 1) % 1000;
            let res = null;
            try { res = typeof runtime.useSkillbarSlot === "function" ? runtime.useSkillbarSlot(slot) : null; } catch { res = null; }
            if (res && res.ok) break;              // a skill was actually sent
            if (res && res.reason && /empty/i.test(res.reason)) continue; // empty slot — try next
            break;                                 // unknown/no bridge — stop
          }
        }
        await sleep(180);
        const th = hpFracOf(target);
        if (th <= 0) { ai.kills++; ai._tgtId = 0; ai._tgtStuck = 0; if (FARM_LOOT) await lootNearby(runtime); prev = playerPos(); continue; }
        // No-damage guard: if HP won't budge after several casts, it's a critter or
        // an unreachable mob — blacklist it briefly and move on to a real target.
        if (target.id === ai._tgtId) { if (th >= ai._tgtHp - 0.002) ai._tgtStuck++; else ai._tgtStuck = 0; }
        else { ai._tgtId = target.id; ai._tgtStuck = 0; }
        ai._tgtHp = th;
        if (ai._tgtStuck >= 6) {
          ai._skipMobs[target.id] = Date.now() + 30000;
          ai._tgtId = 0; ai._tgtStuck = 0;
          try { if (typeof runtime.changeTarget === "function") runtime.changeTarget(0); } catch { /* ignore */ }
          think("🚫 데미지 안 박힘 — 다른 몹으로");
        }
        prev = playerPos();
      }
    } finally {
      if (holding) holdForward(false);
    }
  }

  async function farmRetreat(runtime) {
    releaseAllMoveKeys();
    if (ai.home) await navTo(runtime, { x: ai.home[0], z: ai.home[2] }, 5, 9000);
    const me = runtime.engine && runtime.engine.player;
    for (let i = 0; i < 30; i++) {
      if (ai.stopped || (!ai.farm && !ai.leveling && !ai.obelisk) || ai.pendingBuff) return;
      if (!me || hpFracOf(me) >= FARM_RESUME_HP) return;
      think("🧘 회복 대기 (HP " + Math.round(hpFracOf(me) * 100) + "%)");
      await sleep(1000);
    }
  }

  async function lootNearby(runtime) {
    const eng = runtime.engine, me = eng.player;
    const arr = eng.entities.array || [];
    const loot = [];
    for (const e of arr) {
      if (!e || e.type !== 3 || !e.pos) continue;
      const d = Math.hypot(e.pos[0] - me.pos[0], e.pos[2] - me.pos[2]);
      if (d < FARM_LOOT_RADIUS) loot.push({ e, d });
    }
    loot.sort((a, b) => a.d - b.d);
    for (const it of loot.slice(0, 3)) {
      if (ai.stopped || (!ai.farm && !ai.leveling && !ai.obelisk) || ai.pendingBuff || ai.pendingRecall) return;
      ai.mode = "루팅";
      think("💰 줍기: " + String(it.e.name || "").slice(0, 14));
      await navTo(runtime, { x: it.e.pos[0], z: it.e.pos[2] }, 1.5, 4000); // walk over it
    }
  }

  // ===== Leveling-party mode — behave like the server's AI leveling bots =====
  // The game runs 9 listed "leveling" parties (one per level band) whose bot
  // members physically cluster at a level-appropriate farming zone. We ensure
  // membership in the band for our level, follow the cluster, and farm with it.
  function partyMembers(eng, me) {
    const out = [];
    const arr = eng.entities && eng.entities.array;
    if (!arr || !me.party) return out;
    for (const e of arr) {
      if (!e || e.type !== 0 || !e.pos || e.id === me.id) continue;
      if (e.party === me.party) out.push(e);
    }
    return out;
  }

  function partyCentroid(eng, me) {
    const m = partyMembers(eng, me);
    if (!m.length) return null;
    let sx = 0, sz = 0;
    for (const e of m) { sx += e.pos[0]; sz += e.pos[2]; }
    return { x: sx / m.length, z: sz / m.length, n: m.length };
  }

  // Fetch the listed leveling parties and make sure we're in the one whose level
  // band contains us; apply to join if not. Same-origin fetch carries the session
  // cookie, so this works straight from the page context.
  async function ensureBandParty(runtime) {
    const me = runtime.engine && runtime.engine.player;
    if (!me) return;
    try {
      const r = await fetch("/api/party/getlistedparties", { method: "POST", body: "{}" });
      const list = await r.json();
      if (!Array.isArray(list)) return;
      const band = list.find((p) => me.level >= p.minlevel && me.level <= p.maxlevel && p.faction === me.faction);
      if (!band) { think("🧭 내 레벨대(" + me.level + ") 파티 없음"); return; }
      ai._band = { party: band.party, zone: band.message, min: band.minlevel, max: band.maxlevel };
      if (me.party === band.party) return; // already in the right band
      think("🤝 " + band.message + " 파티(Lv" + band.minlevel + "-" + band.maxlevel + ") 가입 신청");
      await fetch("/api/party/makeapplication", { method: "POST", body: JSON.stringify({ party: band.party, message: "" }) });
    } catch { /* network hiccup — try again next cycle */ }
  }

  // Zone coords are server-side (party messages), not in the client — so we learn
  // each band's farming spot from the cluster and remember it across reloads. One
  // seed (Crocodile Beach) bootstraps the band the test char already farms.
  const ZONE_KEY = "horderModZoneLog";
  const ZONE_SEED = { 10008: { zone: "Crocodile Beach", x: 1632, z: 4096 } };
  function loadZoneLog() {
    try { return Object.assign({}, ZONE_SEED, JSON.parse(localStorage.getItem(ZONE_KEY) || "{}")); }
    catch { return Object.assign({}, ZONE_SEED); }
  }
  function saveZoneLog() { try { localStorage.setItem(ZONE_KEY, JSON.stringify(ai._zoneLog)); } catch { /* ignore */ } }

  async function levelingStep(runtime) {
    const eng = runtime.engine, me = eng && eng.player;
    if (!me || !me.stats) { await sleep(700); return; }
    if (await respawnIfDead(runtime)) return;
    if (!ai._zoneLoaded) { ai._zoneLog = loadZoneLog(); ai._zoneLoaded = true; }

    // Periodically confirm we're in the right level-band party (applies on level-up).
    if (Date.now() - ai._partyAt > PARTY_CHECK_MS) { ai._partyAt = Date.now(); await ensureBandParty(runtime); }

    const cen = partyCentroid(eng, me);

    // Band transition: we leveled out of our band, so our band's party is no longer
    // the cluster around us. Being physically at the right zone matters more than the
    // formal membership, so travel to where that band farms (known) or scout for it.
    if (ai._band && me.party !== ai._band.party) {
      const z = ai._zoneLog[ai._band.party];
      if (z) {
        const dz = Math.hypot(z.x - me.pos[0], z.z - me.pos[2]);
        if (dz > LEVEL_REJOIN_DIST) {
          ai.mode = "존이동";
          think("🧭 " + ai._band.zone + "(으)로 이동 (" + Math.round(dz) + ")");
          await navTo(runtime, { x: z.x, z: z.z }, LEVEL_FOLLOW_RADIUS, 12000);
          return;
        }
        // Arrived at the band's zone; fall through to farm until its members stream in.
      } else if (!cen) {
        ai.mode = "존탐색";
        think("🧭 " + ai._band.zone + " 위치 미학습 — 탐색");
        await navTo(runtime, pickRoamTarget(), 4, 7000);
        return;
      }
    }

    // Learn / refresh this band's spot from the cluster we're actually grouped with.
    if (cen && ai._band && me.party === ai._band.party) {
      ai._zoneLog[ai._band.party] = { zone: ai._band.zone, x: Math.round(cen.x), z: Math.round(cen.z) };
      saveZoneLog();
    }

    // Drifted away from the group (or a no-mob lull pulled us off)? Rejoin them.
    if (cen) {
      const d = Math.hypot(cen.x - me.pos[0], cen.z - me.pos[2]);
      if (d > LEVEL_REJOIN_DIST) {
        ai.mode = "파티합류";
        think("🏃 파티(" + cen.n + "명) 따라가기 (" + Math.round(d) + ")");
        await navTo(runtime, { x: cen.x, z: cen.z }, LEVEL_FOLLOW_RADIUS, 8000);
        return;
      }
    }

    // Near the party (or solo if none visible): fight the local mobs.
    if (!cen) ai.mode = "솔로파밍";
    await farmStep(runtime);
  }

  // ===== Obelisk (faction war) mode — SCAFFOLD; in-window behavior pending live verification.
  // Outside a KST war window it is a safe no-op (won't disrupt leveling). Reuses the verified
  // combat/follow/recall primitives. Entry dialog text and war-world name are best-effort guesses.
  function kstHM() { const d = new Date(); return { h: (d.getUTCHours() + 9) % 24, m: d.getUTCMinutes() }; }
  function inObeliskWindow() { const t = kstHM(); return OBELISK_HOURS.indexOf(t.h) >= 0 && t.m < OBELISK_WINDOW_MIN; }

  // In the war instance? Prefer the active-world name; fall back to PvP presence
  // (enemy-faction players only ever share our space inside the war).
  function inWarInstance(runtime) {
    try {
      const w = typeof runtime.getActiveWorld === "function" ? normalizeText(runtime.getActiveWorld()) : "";
      if (w && (w.includes("obelisk") || w.includes("war"))) return true;
    } catch { /* ignore */ }
    const eng = runtime.engine, me = eng && eng.player;
    if (!me || !eng.entities) return false;
    for (const e of eng.entities.array) { if (e && e.type === 0 && e.faction !== me.faction && e.pos) return true; }
    return false;
  }

  function friendlyCentroid(eng, me) {
    let sx = 0, sz = 0, n = 0;
    for (const e of eng.entities.array) {
      if (e && e.type === 0 && e.faction === me.faction && e.id !== me.id && e.pos) { sx += e.pos[0]; sz += e.pos[2]; n++; }
    }
    return n ? { x: sx / n, z: sz / n, n } : null;
  }

  async function obeliskStep(runtime) {
    const eng = runtime.engine, me = eng && eng.player;
    if (!me || !me.stats) { await sleep(700); return; }
    if (await respawnIfDead(runtime)) return;

    if (inWarInstance(runtime)) {
      ai.mode = "오벨전투";
      // Push the objective with the friendly zerg (the AI bots), then fight hostiles.
      const cen = friendlyCentroid(eng, me);
      if (cen) {
        const d = Math.hypot(cen.x - me.pos[0], cen.z - me.pos[2]);
        if (d > OBELISK_FOLLOW_DIST) {
          think("🏁 아군 " + cen.n + "명 쪽으로 진격 (" + Math.round(d) + ")");
          await navTo(runtime, { x: cen.x, z: cen.z }, OBELISK_FOLLOW_DIST - 6, 8000);
          return;
        }
      }
      ai._warTarget = true;        // combat targets enemy players + mobs
      try { await farmStep(runtime); } finally { ai._warTarget = false; }
      return;
    }

    // The War Conjurer lives in Faivel, whose teleport requires Lv.35+ — below that
    // we can't even reach the obelisk entrance, so don't try (keep leveling instead).
    if (me.level < OBELISK_MIN_LEVEL) {
      ai.mode = "오벨대기";
      think("🔒 오벨리스크는 Lv" + OBELISK_MIN_LEVEL + "+ 필요 (현재 " + me.level + ") — 렙업 먼저");
      await sleep(6000);
      return;
    }

    // Not in the war: only act during a window so leveling/idle is never disrupted.
    if (!inObeliskWindow()) {
      ai.mode = "오벨대기";
      const t = kstHM();
      think("⏳ 오벨리스크 윈도우 대기 (지금 KST " + t.h + ":" + (t.m < 10 ? "0" : "") + t.m + ")");
      await sleep(5000);
      return;
    }
    if (Date.now() - ai._obAt < OBELISK_RETRY_MS) { await sleep(3000); return; }
    ai._obAt = Date.now();
    ai.mode = "오벨입장";
    think("⚔️ 오벨리스크 윈도우 — War Conjurer 입장 시도");
    await enterObelisk(runtime);
  }

  // Best-effort entry (pending live verification): recall, reach Faivel's War
  // Conjurer, open its dialog and pick the obelisk-port option.
  async function enterObelisk(runtime) {
    try {
      releaseAllMoveKeys();
      castRecall(runtime);
      await sleep(RECALL_WAIT_MS);
      await navTo(runtime, WAR_CONJURER_POS, NEAR_CONJURER_DIST, 16000);
      const wc = findNearestConjurer(runtime); // nearest at the war conjurer spot = the War Conjurer
      if (!wc) { think("❓ War Conjurer를 못 찾음 — 재시도 예정"); return; }
      runtime.changeTarget(wc.id);
      await sleep(AFTER_INTERACT_DELAY_MS);
      runtime.sendInteract(wc.id);
      await sleep(700);
      const opt = findChoiceElement("Obelisk") || findChoiceElement("War") || findChoiceElement("Battle") || findChoiceElement("Enter");
      if (opt) { think("🌀 오벨리스크 포트 선택"); clickLikeUser(opt); await sleep(RECALL_WAIT_MS); }
      else think("❓ 오벨 포트 선택지 없음(윈도우 아님?) — 대기");
    } catch { think("⚠️ 오벨 입장 실패 — 재시도 예정"); }
  }

  function learnWaypoints(runtime) {
    try {
      const ents = typeof runtime.listEntities === "function" ? runtime.listEntities() : [];
      let added = false;
      for (const e of ents) {
        if (!e || !e.name || !e.static || !Array.isArray(e.pos)) continue;
        const x = Number(e.pos[0]) || 0;
        const z = Number(e.pos[2]) || 0;
        if (ai.waypoints.some((w) => Math.hypot(w.x - x, w.z - z) < WAYPOINT_DEDUP_DIST)) continue;
        ai.waypoints.push({ x, z, name: String(e.name).slice(0, 32) });
        if (ai.waypoints.length > MAX_WAYPOINTS) ai.waypoints.shift();
        think("📝 랜드마크 기억: " + String(e.name).slice(0, 24));
        added = true;
      }
      if (added) saveWaypoints();
    } catch {
      // Learning is best-effort.
    }
  }

  function dist2(pos, t) {
    const x = Array.isArray(pos) ? pos[0] : pos.x;
    const z = Array.isArray(pos) ? pos[2] : pos.z;
    return Math.hypot((Number(x) || 0) - t.x, (Number(z) || 0) - t.z);
  }

  function loadWaypoints() {
    try {
      const raw = pageWindow.localStorage && pageWindow.localStorage.getItem(STORAGE_WAYPOINTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((w) => w && isFinite(w.x) && isFinite(w.z)) : [];
    } catch {
      return [];
    }
  }

  function saveWaypoints() {
    try {
      if (pageWindow.localStorage) {
        pageWindow.localStorage.setItem(STORAGE_WAYPOINTS_KEY, JSON.stringify(ai.waypoints.slice(-MAX_WAYPOINTS)));
      }
    } catch {
      // Ignore storage errors.
    }
  }

  async function panCamera(runtime, totalRad) {
    const steps = 6 + Math.floor(Math.random() * 9);
    const per = totalRad / steps;
    for (let i = 0; i < steps; i++) {
      try { runtime.rotateCamera(per); } catch { /* ignore */ }
      await sleep(18 + Math.floor(Math.random() * 26));
    }
  }

  async function holdMoveMulti(dirs, ms) {
    const maps = dirs.map((d) => MOVE_KEYS[d]).filter(Boolean);
    for (const mapping of maps) dispatchKeyEvent("keydown", mapping.code, mapping.key);
    try {
      await sleep(ms);
    } finally {
      for (const mapping of maps) dispatchKeyEvent("keyup", mapping.code, mapping.key);
    }
  }

  async function holdMove(dir, ms) {
    const mapping = MOVE_KEYS[dir];
    if (!mapping) return;
    dispatchKeyEvent("keydown", mapping.code, mapping.key);
    try {
      await sleep(ms);
    } finally {
      dispatchKeyEvent("keyup", mapping.code, mapping.key);
    }
  }

  function dispatchKeyEvent(type, code, key) {
    const targets = [document.querySelector("canvas"), document.body, document, pageWindow].filter(Boolean);
    for (const target of targets) {
      try {
        target.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, composed: true }));
      } catch {
        // Continue dispatching to other targets.
      }
    }
  }

  function releaseAllMoveKeys() {
    for (const dir of Object.keys(MOVE_KEYS)) {
      const mapping = MOVE_KEYS[dir];
      dispatchKeyEvent("keyup", mapping.code, mapping.key);
    }
    dispatchKeyEvent("keyup", "Space", " ");
    dispatchKeyEvent("keyup", "ArrowLeft", "ArrowLeft");
    dispatchKeyEvent("keyup", "ArrowRight", "ArrowRight");
  }
})();
