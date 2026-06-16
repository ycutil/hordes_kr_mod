// ==UserScript==
// @name         Hordes KR Custom Mod
// @namespace    https://hordes.io/
// @version      0.9.180-local
// @description  Korean localization and utility overlay for Hordes.io.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      api.openai.com
// @inject-into  page
// @updateURL    https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/hordes-kr-mod.user.js
// @downloadURL  https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/hordes-kr-mod.user.js
// ==/UserScript==

// 구조/리팩토링 맥락은 AI_CONTEXT.md를 먼저 참고한다.
(function hordesKrModBootstrap() {
  "use strict";

  const BOOT_VERSION = "0.9.180-local";
  markUserscriptStarted("entry");
  installUserscriptOpenAiBridge();
  installEarlyClientScriptGate();

  if (typeof unsafeWindow !== "undefined" && unsafeWindow !== window) {
    markUserscriptStarted("sandbox");
    if (unsafeWindow.__HORDES_KR_MOD_BOOTSTRAPPED__) return;
    unsafeWindow.__HORDES_KR_MOD_BOOTSTRAPPED__ = true;

    const injectIntoPage = () => {
      const parent = document.documentElement || document.head || document.body;
      if (!parent) {
        setTimeout(injectIntoPage, 0);
        return;
      }

      const script = document.createElement("script");
      script.textContent = `(${hordesKrModBootstrap.toString()})();`;
      parent.appendChild(script);
      script.remove();
    };

    injectIntoPage();
    installBootstrapFallbackStatus();
    return;
  }

  markUserscriptStarted("page");

  function markUserscriptStarted(stage) {
    const marker = `${BOOT_VERSION}:${stage}:${Date.now()}`;
    try {
      window.__HORDES_KR_USERSCRIPT_STARTED__ = marker;
    } catch {
      // Marker is diagnostic only.
    }

    try {
      if (typeof unsafeWindow !== "undefined") {
        unsafeWindow.__HORDES_KR_USERSCRIPT_STARTED__ = marker;
      }
    } catch {
      // Cross-context marker is best-effort.
    }

    const markDom = () => {
      const root = document.documentElement;
      if (!root) return false;
      root.setAttribute("data-hordes-kr-userscript-started", marker);
      root.setAttribute("data-hordes-kr-userscript-version", BOOT_VERSION);
      return true;
    };

    try {
      if (!markDom()) {
        setTimeout(markDom, 0);
        document.addEventListener("DOMContentLoaded", markDom, { once: true });
      }
    } catch {
      // DOM marker is best-effort.
    }
  }

  function installBootstrapFallbackStatus() {
    setTimeout(() => {
      try {
        const targetWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        if (targetWindow.HordesKrMod) return;
        if (document.getElementById("hordes-kr-mod-status-root")) return;
        showBootstrapFailureBadge("KR Mod 로딩 실패", [
          "Tampermonkey sandbox에서는 실행됐지만 page-context 주입에 실패했습니다.",
          "",
          "확인할 것:",
          "1. Tampermonkey 사이트 접근 권한이 hordes.io에서 켜져 있는지",
          "2. 설치된 스크립트가 최신인지",
          "3. 다른 확장/브라우저 정책이 inline script 주입을 막는지",
          "",
          "콘솔에서 HordesKrMod가 undefined면 이 문제입니다.",
        ]);
      } catch {
        // Fallback UI is diagnostic only; never block the page.
      }
    }, 1800);
  }

  function showBootstrapFailureBadge(label, detailLines) {
    const fallbackId = "hordes-kr-mod-bootstrap-fallback-root";

    const mountFallback = () => {
      try {
        if (document.getElementById("hordes-kr-mod-status-root")) return;
        if (document.getElementById(fallbackId)) return;
        if (!document.body) {
          setTimeout(mountFallback, 250);
          return;
        }

        const host = document.createElement("div");
        host.id = fallbackId;
        host.style.cssText = [
          "all: initial",
          "position: fixed",
          "right: 2px",
          "bottom: 2px",
          "z-index: 2147483647",
          "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          "pointer-events: auto",
        ].join(";");
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `
          <style>
            * { box-sizing: border-box; }
            button {
              border: 1px solid rgba(245, 194, 71, 0.75);
              background: rgba(16, 19, 29, 0.94);
              color: #f5c247;
              border-radius: 6px;
              padding: 7px 10px;
              font: 800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              cursor: pointer;
              box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
            }
            button:hover { border-color: #ffffff; color: #ffffff; }
          </style>
          <button id="fallback" type="button"></button>
        `;

        const button = shadow.getElementById("fallback");
        button.textContent = label || "KR Mod 로딩 실패";
        button.title = "Hordes KR Mod 진단 메시지";
        button.addEventListener("click", () => {
          alert((detailLines || ["Hordes KR Mod 초기화에 실패했습니다."]).join("\n"));
        });
      } catch {
        // Fallback UI is diagnostic only.
      }
    };

    mountFallback();
  }

  function installEarlyClientScriptGate() {
    if (!/^\/play(?:\/|$)/.test(location.pathname)) return;

    try {
      if (localStorage.getItem("hordesKrMod.scriptGate.disabled") === "true") return;
      if (localStorage.getItem("hordesKrMod.scriptGate.enabled") !== "force") return;
      if (document.getElementById("hordes-kr-script-gate")) return;

      const root = document.documentElement;
      if (!root) return;

      let head = document.head;
      if (!head) {
        head = document.createElement("head");
        root.insertBefore(head, root.firstChild);
      }

      const meta = document.createElement("meta");
      meta.id = "hordes-kr-script-gate";
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = [
        "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
        "worker-src 'self' blob:",
        "child-src 'self' blob:",
      ].join("; ");
      head.insertBefore(meta, head.firstChild);
    } catch {
      // Early CSP setup is best-effort; the page-context hook reports detailed status.
    }
  }

  function installUserscriptOpenAiBridge() {
    if (typeof GM_xmlhttpRequest !== "function") return;
    const targetWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (targetWindow.__HORDES_KR_OPENAI_BRIDGE_INSTALLED__) return;
    targetWindow.__HORDES_KR_OPENAI_BRIDGE_INSTALLED__ = true;
    window.__HORDES_KR_OPENAI_BRIDGE_INSTALLED__ = true;
    try {
      targetWindow.__HORDES_KR_OPENAI_BRIDGE_READY__ = true;
    } catch {
      // The page falls back to direct fetch when the bridge marker is unavailable.
    }

    targetWindow.addEventListener("message", (event) => {
      if (event.origin && event.origin !== location.origin) return;

      const message = event.data;
      if (!message || message.type !== "HORDES_KR_MOD_OPENAI_REQUEST") return;
      if (message.source !== "HordesKrMod") return;

      const requestId = String(message.id || "");
      const apiKey = String(message.apiKey || "").trim();
      if (!requestId || !apiKey || !message.body) return;

      const pageSentAt = Number(message.sentAt) || null;
      const bridgeReceivedAt = Date.now();
      const gmStartAt = Date.now();

      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.openai.com/v1/responses",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        data: JSON.stringify(message.body),
        timeout: 12000,
        onload(response) {
          const gmEndAt = Date.now();
          targetWindow.postMessage({
            source: "HordesKrMod",
            type: "HORDES_KR_MOD_OPENAI_RESPONSE",
            id: requestId,
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            responseText: response.responseText || "",
            timing: {
              pageSentAt,
              bridgeReceivedAt,
              gmStartAt,
              gmEndAt,
            },
          }, location.origin);
        },
        ontimeout() {
          const gmEndAt = Date.now();
          targetWindow.postMessage({
            source: "HordesKrMod",
            type: "HORDES_KR_MOD_OPENAI_RESPONSE",
            id: requestId,
            ok: false,
            status: 0,
            responseText: "OpenAI request timed out",
            timing: {
              pageSentAt,
              bridgeReceivedAt,
              gmStartAt,
              gmEndAt,
            },
          }, location.origin);
        },
        onerror(error) {
          const gmEndAt = Date.now();
          targetWindow.postMessage({
            source: "HordesKrMod",
            type: "HORDES_KR_MOD_OPENAI_RESPONSE",
            id: requestId,
            ok: false,
            status: 0,
            responseText: error && error.error ? String(error.error) : "OpenAI request failed",
            timing: {
              pageSentAt,
              bridgeReceivedAt,
              gmStartAt,
              gmEndAt,
            },
          }, location.origin);
        },
      });
    });
  }

  const MOD_VERSION = BOOT_VERSION;
  const ENABLED_KEY = "hordesKrMod.translation.enabled";
  const UI_CONFIG_KEY = "hordesKrMod.ui.config";
  const HIGHLIGHT_CONFIG_KEY = "hordesKrMod.highlight.config";
  const FEATURE_CONFIG_KEY = "hordesKrMod.features.config";
  const INCOMING_TARGET_WATCH_DEFAULT_VERSION_KEY = "hordesKrMod.incomingTargetWatch.defaultVersion";
  const INCOMING_TARGET_WATCH_DEFAULT_VERSION = "2026-05-27-enable-watch";
  const SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION_KEY = "hordesKrMod.swiftshotTurbo.keysVersion";
  const SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION = "2026-05-29-add-digit1";
  const PARTY_UI_CONFIG_KEY = "hordesKrMod.partyUi.config";
  const PARTY_COMMAND_CONFIG_KEY = "hordesKrMod.partyCommand.config";
  const GEAR_PRESET_CONFIG_KEY = "hordesKrMod.gearPreset.config";
  const SKILL_PRESET_CONFIG_KEY = "hordesKrMod.skillPreset.config";
  const CHAT_TRANSLATION_API_KEY_KEY = "hordesKrMod.chatTranslation.apiKey";
  const CHAT_TRANSLATION_MODEL_KEY = "hordesKrMod.chatTranslation.model";
  const CHAT_TRANSLATION_MODEL_MIGRATION_KEY = "hordesKrMod.chatTranslation.modelMigration";
  const SCRIPT_GATE_DISABLED_KEY = "hordesKrMod.scriptGate.disabled";
  const SCRIPT_GATE_ENABLED_KEY = "hordesKrMod.scriptGate.enabled";
  const HIGHLIGHT_DEFAULTS_VERSION_KEY = "hordesKrMod.highlight.defaultsVersion";
  const HIGHLIGHT_DEFAULTS_VERSION = "2026-05-12-ho2-hmage";
  const MINIMAP_LIST_SCALE_DEFAULT_VERSION_KEY = "hordesKrMod.highlight.minimapListScaleDefaultVersion";
  const MINIMAP_LIST_SCALE_DEFAULT_VERSION = "2026-05-19-scale-1.5";
  const DEFAULT_HIGHLIGHT_NAMES = ["HO2", "HMage"];
  const HIGHLIGHT_MATCH_CACHE_MAX = 256;
  const SWIFTSHOT_TURBO_DEFAULT_KEY_CODES = ["KeyR", "Digit1", "Digit5", "KeyQ", "KeyE", "KeyF"];
  const SWIFTSHOT_TURBO_DEFAULT_KEY_CODE = SWIFTSHOT_TURBO_DEFAULT_KEY_CODES[0];
  const SWIFTSHOT_TURBO_DEFAULT_INTERVAL_MS = 120;
  const SWIFTSHOT_TURBO_MIN_INTERVAL_MS = 60;
  const SWIFTSHOT_TURBO_MAX_INTERVAL_MS = 500;
  // Companion keys fire right after the primary key's skill resolves. Holding E
  // pulses E, and fires 5 the moment E lands. See SWIFTSHOT_TURBO_COMPANION_WATCH_MS.
  const SWIFTSHOT_TURBO_COMPANION_KEY_CODES = { KeyE: ["Digit5"] };
  // Detection cadence for the companion. Runs only while a companion key is held,
  // independently of the (slower) primary pulse, so 5 follows E within ~this many
  // ms of E actually landing instead of waiting for the next primary pulse.
  const SWIFTSHOT_TURBO_COMPANION_WATCH_MS = 10;
  const RUNTIME_OVERLAY_INTERVAL_MS = 100;
  const RUNTIME_NAME_OVERLAY_REFRESH_MS = 100;
  // Buff-spike warning: when a watched/highlighted enemy suddenly turns on several
  // buffs at once (popping cooldowns before engaging), flag it on the overlay.
  const BUFF_SPIKE_THRESHOLD = 2;        // +N distinct active buffs within the window = a "pop"
  const BUFF_SPIKE_WINDOW_MS = 1500;     // count the increase within this rolling window
  const BUFF_SPIKE_DISPLAY_MS = 4000;    // keep the warning up this long after a spike
  const BUFF_SPIKE_TRACKER_TTL_MS = 20000; // drop trackers for entities not seen for this long
  // Class "tell" buffs to surface as icons on watched enemies. Matched by the buff's
  // logic.icon (a buff's icon == its source skill's icon — verified live in a Gloom
  // raid). Charms match by icon prefix items/charm/charm{N}_q{quality}.
  const KEY_BUFF_ICON_MAP = {
    "ui/skills/17": { label: "Enrage", cls: "전사", ally: false },
    "ui/skills/16": { label: "Hypothermic Frenzy (히포)", cls: "마법사", ally: false },
    "ui/skills/27": { label: "Pathfinding (패스파인더)", cls: "궁수", ally: true },
    "ui/skills/11": { label: "Invigorate (invi)", cls: "궁수", ally: false },
    "ui/skills/28": { label: "Canine Howl (캐니언)", cls: "주술사", ally: true },
  };
  const KEY_BUFF_CHARM_MAP = {
    "items/charm/charm1_": { label: "Hardened Egg (egg)" },
    "items/charm/charm11_": { label: "Ghost Candles (candle)" },
    "items/charm/charm2_": { label: "Tattooed Skull (skull)" },
    "items/charm/charm13_": { label: "Orc Skull (skull)" },
  };
  // Defensive/immunity skills worth flagging on a highlighted enemy. When active,
  // the skill leaves a self-buff whose logic.icon == the skill icon (== skill id);
  // we read the buff's remaining duration (enemy recast cooldown is not server-synced).
  const KEY_DEFENSE_ICON_MAP = {
    "ui/skills/2": { label: "Bulwark (불웍)", cls: "전사" },
    "ui/skills/53": { label: "Ice Block (아이스블락)", cls: "마법사" },
    "ui/skills/23": { label: "Ice Shield (아이스실드)", cls: "마법사" },
  };
  const KEY_BUFF_MAX_ICONS = 6; // cap icons shown next to one target
  // Skills to flag while an enemy is mid-cast/channel, by skill id (== icon number;
  // verified live: Summon id 35, Bone Shot id 54). entity.skills.timedSkill holds the
  // skill being cast (null when idle); timedCast.end is when it resolves.
  const KEY_CAST_SKILL_MAP = {
    46: "Whirlwind (휠윈드)",
    45: "Volley (볼리)",
    52: "Frostcall (프로스트콜)",
    35: "소환 (Summon)",
    33: "Charge (돌진)",
    51: "Shatter (쉐터)",
    54: "Bone Shot (본샷)",
  };
  // Charge (33) is an instant gap-closer, so different interrupt response: Blind only.
  const AUTO_INTERRUPT_CHARGE_ID = 33;
  // Status dashboard: small draggable HUD showing runtime/feature health at a glance.
  const DASHBOARD_REFRESH_MS = 700;
  const DASHBOARD_ACTIVE_WINDOW_MS = 2500; // "recent activity" window for a feature to count as live
  const DASHBOARD_POS_KEY = "hordesKrMod.dashboard.pos";
  const MINIMAP_OVERLAY_REFRESH_MS = 100;
  const PRESET_QUICKBAR_REFRESH_MS = 500;
  const TARGET_DISTANCE_OVERLAY_REFRESH_MS = 100;
  const TARGET_DISTANCE_CACHE_MS = 100;
  const TARGET_DISTANCE_DEEP_SEARCH_CACHE_MS = 1000;
  const TARGET_DISTANCE_DEEP_SEARCH_CACHE_MAX = 64;
  const TARGET_DISTANCE_MAX_OBJECTS = 1800;
  const TARGET_DISTANCE_MAX_DEPTH = 5;
  const TARGET_DISTANCE_OVERLAY_OFFSET_Y = -2;
  const INCOMING_WARNING_SCAN_LIMIT = 700;
  // Combat assist: threat HUD + auto-interrupt. The incoming-watch
  // fast path reads entity.target (the engine's authoritative field — verified live:
  // 89/98 loaded entities expose it; one full scan costs ~0.002ms) instead of the
  // legacy per-entity reflection BFS (180 objects x 64 keys x 700 entities).
  const WATCH_BEEP_MIN_GAP_MS = 1500;       // min gap between new-watcher beeps
  const THREAT_FLASH_MS = 1200;             // threat HUD flash duration on a new watcher
  // Auto-interrupt: when a highlighted enemy in range starts casting a trigger skill,
  // target them and fire the first interrupt slot that is OFF COOLDOWN (local cd read,
  // no waiting) — e.g. slot 5 instantly, slot 9 in the same tick when 5 is on cd.
  // Runs on its own fast pulse; the flat entity scan costs ~0.002ms so the rate is free.
  // Tuned to ~one engine tick (game runs 60Hz, timestep 16.67ms): enemy cast state only
  // refreshes per tick, so 16ms catches a new cast on the first tick it appears — the
  // fastest the client can react. Polling faster gains nothing (data doesn't change
  // between ticks); the real floor is network RTT (~200ms), not this pulse.
  const AUTO_INTERRUPT_TICK_MS = 16;        // detection pulse ≈ engine tick (was 50ms)
  const AUTO_INTERRUPT_GAP_MS = 250;        // min gap between interrupt cast attempts
  const AUTO_INTERRUPT_MAX_TRIES = 4;       // attempts per single enemy cast instance
  const AUTO_INTERRUPT_MIN_REMAIN_S = 0.25; // ignore casts about to resolve anyway
  const AUTO_INTERRUPT_CD_READY_S = 0.05;   // local cd remaining at/below this = ready
  // Team sync (팀파이트 멤버 상태 공유): each client publishes its own class + key-skill
  // cooldowns + candle charm to a shared room (yerp PHP + MySQL, HTTP polling — no
  // websocket). One POST = publish my state + receive the whole room.
  const TEAM_SYNC_SERVER_DEFAULT = "https://yerp.cafe24.com/teamsync/api.php";
  const TEAM_SYNC_TOKEN_DEFAULT = "b7f3a91c4e2d6580a1c9f0e3d4b5a6c7";
  const TEAM_SYNC_ROOM_DEFAULT = "guild";
  const TEAM_SYNC_POLL_COMBAT_MS = 1500;    // sync cadence while in combat
  const TEAM_SYNC_POLL_IDLE_MS = 4000;      // sync cadence while idle
  const TEAM_SYNC_CANDLE_TIER = 11; // charm item.tier for Ghost Candles (candle); verified live
  // Per-class key skills to share, keyed by class index. id == icon number (verified
  // live this session). k: aoe = 주요 광역, buff = 자버프.
  const TEAM_SYNC_CLASS_SKILLS = {
    0: [{ id: 46, k: "aoe", name: "휠윈드" }, { id: 17, k: "buff", name: "Enrage" }],
    1: [{ id: 52, k: "aoe", name: "Frostcall" }, { id: 16, k: "buff", name: "히포" }],
    2: [{ id: 45, k: "aoe", name: "Volley" }, { id: 11, k: "buff", name: "Invi" }],
    3: [{ id: 35, k: "aoe", name: "소환" }, { id: 28, k: "buff", name: "캐니언" }],
  };
  const TEAM_SYNC_CLASS_LABEL = { 0: "전사", 1: "법사", 2: "궁수", 3: "주술", 4: "NPC", 5: "몹" };
  const TEAM_SYNC_CLASS_COLOR = { 0: "#e8a23d", 1: "#4aa3ff", 2: "#46d07a", 3: "#c77dff" };
  const INCOMING_TARGET_WATCH_NESTED_SCAN_DEPTH = 3;
  const INCOMING_TARGET_WATCH_NESTED_SCAN_OBJECTS = 180;
  const INCOMING_TARGET_WATCH_NESTED_CHILD_LIMIT = 64;
  const INCOMING_SKILL_LIST_MAX_ROWS = 6;
  const MINIMAP_DEFAULT_SCALE = 0.6;
  const MINIMAP_LIST_DEFAULT_SCALE = 1.5;
  const MINIMAP_LIST_MIN_SCALE = 0.75;
  const CHAT_TRANSLATION_DEFAULT_MODEL = "gpt-4.1-nano";
  const CHAT_TRANSLATION_MODEL_MIGRATION_VERSION = "2026-05-21-gpt-4.1-nano";
  const CHAT_TRANSLATION_PREVIOUS_DEFAULT_MODELS = new Set(["gpt-5-nano"]);
  const CHAT_TRANSLATION_SCAN_DELAY_MS = 80;
  const CHAT_TRANSLATION_TIMEOUT_MS = 12000;
  const CHAT_TRANSLATION_SCAN_LIMIT = 10;
  const CHAT_TRANSLATION_MAX_QUEUE = 12;
  const CHAT_TRANSLATION_MAX_CACHE = 300;
  const CHAT_TRANSLATION_CACHE_TTL_MS = 30 * 60 * 1000;
  const CHAT_TRANSLATION_MAX_CONCURRENT = 2;
  const CHAT_TRANSLATION_BATCH_SIZE = 1;
  const CHAT_TRANSLATION_MAX_TEXT_LENGTH = 220;
  const CHAT_TRANSLATION_QUOTA_COOLDOWN_MS = 120000; // after a 429/quota error, stop hammering for 2 min
  const CHAT_TRANSLATION_TOGGLE_REFRESH_MS = 1000;
  // Damage log overlay (above the chat panel).
  const DAMAGE_LOG_REFRESH_MS = 140;
  const DAMAGE_LOG_MAX_LINES = 8;
  const DAMAGE_LOG_LINE_TTL_MS = 9000;
  // Full-session history kept for file export (independent of the on-screen lines).
  const DAMAGE_LOG_HISTORY_MAX = 50000;
  // Reserve a strip above the chat for the chat-translation toggle so the two
  // chat-anchored overlays do not overlap.
  const DAMAGE_LOG_CHAT_TOP_GAP = 32;
  const CHAT_TRANSLATION_ALLOWED_CHANNELS = new Set(["faction", "party", "yell", "whisper"]);
  const CHAT_TRANSLATION_BRIDGE_REQUEST = "HORDES_KR_MOD_OPENAI_REQUEST";
  const CHAT_TRANSLATION_BRIDGE_RESPONSE = "HORDES_KR_MOD_OPENAI_RESPONSE";
  const CHAT_TRANSLATION_LOCAL_EXACT = new Map([
    ["afk", "잠수요"],
    ["back", "빠져요"],
    ["boss", "보스"],
    ["boss?", "보스?"],
    ["brb", "잠시만요"],
    ["can someone summon me", "소환해줄 수 있나요?"],
    ["come", "와주세요"],
    ["come here", "여기로 와주세요"],
    ["enemy pushing east", "적이 동쪽으로 밀고 있어요"],
    ["enemy pushing mid", "적이 중앙으로 밀고 있어요"],
    ["enemy pushing middle", "적이 중앙으로 밀고 있어요"],
    ["enemy pushing north", "적이 북쪽으로 밀고 있어요"],
    ["enemy pushing south", "적이 남쪽으로 밀고 있어요"],
    ["enemy pushing west", "적이 서쪽으로 밀고 있어요"],
    ["fall back", "빠져요"],
    ["focus", "타겟 집중"],
    ["focus healer", "힐러부터 집중"],
    ["focus healer first", "힐러 먼저 집중"],
    ["focus healer first please", "힐러 먼저 집중"],
    ["focus heal", "힐러부터 집중"],
    ["focus heals", "힐러부터 집중"],
    ["focus heals first", "힐러 먼저 집중"],
    ["focus heals first please", "힐러 먼저 집중"],
    ["follow", "따라오세요"],
    ["follow me", "따라오세요"],
    ["g", "지금!"],
    ["gg", "수고했어요"],
    ["ggs", "수고했어요"],
    ["gj", "잘했어요"],
    ["gl", "행운을 빌어요"],
    ["go", "갑시다"],
    ["go go", "갑시다"],
    ["gogo", "갑시다"],
    ["heal me", "힐 주세요"],
    ["heal pls", "힐 주세요"],
    ["heals pls", "힐 주세요"],
    ["healer oom", "힐러 마나 없어요"],
    ["healer oom wait", "힐러 마나 없으니 기다려요"],
    ["hello", "안녕하세요"],
    ["help", "도와주세요"],
    ["help me", "도와주세요"],
    ["hi", "안녕하세요"],
    ["hey", "안녕하세요"],
    ["inv", "초대해주세요"],
    ["inv me", "초대해주세요"],
    ["invite", "초대해주세요"],
    ["invite me", "초대해주세요"],
    ["kill healer", "힐러 먼저 잡아주세요"],
    ["kill healer first", "힐러 먼저 잡아주세요"],
    ["kill heals", "힐러 먼저 잡아주세요"],
    ["kill heals first", "힐러 먼저 잡아주세요"],
    ["lf boss", "보스 파티 구해요"],
    ["lfg", "파티 구해요"],
    ["lfp", "파티원 구해요"],
    ["lol", "ㅋㅋ"],
    ["lmao", "ㅋㅋ"],
    ["mana", "마나 없어요"],
    ["need heal", "힐 필요해요"],
    ["need heals", "힐 필요해요"],
    ["need help", "도움 필요해요"],
    ["need help at boss", "보스 도움 필요해요"],
    ["no", "아니요"],
    ["nope", "아니요"],
    ["np", "괜찮아요"],
    ["obelisk", "오벨리스크"],
    ["obelisk?", "오벨리스크?"],
    ["omw", "가는 중"],
    ["oom", "마나 없어요"],
    ["party", "파티"],
    ["party?", "파티 가능?"],
    ["pt", "파티"],
    ["pt?", "파티 가능?"],
    ["push", "밀어요"],
    ["push east now", "지금 동쪽 밀어요"],
    ["push in", "밀고 들어가요"],
    ["push mid now", "지금 중앙 밀어요"],
    ["push middle now", "지금 중앙 밀어요"],
    ["push north now", "지금 북쪽 밀어요"],
    ["push south now", "지금 남쪽 밀어요"],
    ["push west now", "지금 서쪽 밀어요"],
    ["r", "지금!"],
    ["r?", "준비됐나요?"],
    ["raw", "봇들 정리하자"],
    ["raw left", "왼쪽 봇들 정리하자"],
    ["raw mid", "중앙 봇들 정리하자"],
    ["raw middle", "중앙 봇들 정리하자"],
    ["raw right", "오른쪽 봇들 정리하자"],
    ["ready", "준비됐어요"],
    ["ready?", "준비됐나요?"],
    ["run", "도망쳐요"],
    ["run away", "도망쳐요"],
    ["sec", "잠깐만요"],
    ["stack", "모여요"],
    ["stop", "멈춰요"],
    ["sure", "네"],
    ["thx", "고마워요"],
    ["thanks", "고마워요"],
    ["thank you", "고마워요"],
    ["ty", "고마워요"],
    ["wait", "잠시만요"],
    ["wait for healer before push", "힐러 기다렸다가 밀어요"],
    ["wait please", "잠시만요"],
    ["wait pls", "잠시만요"],
    ["deep", "중앙으로 광역스킬"],
    ["deep mid", "중앙으로 광역스킬"],
    ["deep, mid", "중앙으로 광역스킬"],
    ["deep,mid", "중앙으로 광역스킬"],
    ["mid", "중앙으로 광역스킬"],
    ["middle", "중앙으로 광역스킬"],
    ["on me", "내 위로 광역스킬"],
    ["onme", "내 위로 광역스킬"],
    ["where", "어디?"],
    ["where?", "어디?"],
    ["where are you", "어디세요?"],
    ["y", "네"],
    ["yeah", "네"],
    ["yes", "네"],
    ["yo", "안녕하세요"],
  ]);
  const PARTY_UI_REFRESH_MS = 500;
  const PARTY_UI_FRAME_WIDTH = 200;
  const PARTY_UI_FRAME_HEIGHT = 27;
  const PARTY_UI_GRID_GAP = 4;
  const PARTY_COMMAND_PANEL_REFRESH_MS = 500;
  const PARTY_COMMAND_PANEL_DEFAULT_WIDTH = 198;
  const PARTY_COMMAND_PANEL_DEFAULT_HEIGHT = 154;
  const PARTY_COMMAND_QUICK_MESSAGES = [
    ["RAW L", "RAW LEFT IN 3"],
    ["RAW", "RAW IN 3"],
    ["RAW R", "RAW RIGHT IN 3"],
    ["DEEP L", "DEEP LEFT IN 3"],
    ["DEEP M", "DEEP MID IN 3"],
    ["DEEP R", "DEEP RIGHT IN 3"],
    ["TARGET", null],
    ["ON ME", "ON ME IN 3"],
    ["CANCLE", "CANCLE"],
    ["GGGGG", "GGGGG"],
  ];
  const PARTY_COMMAND_TARGET_HOTKEY_CODE = "KeyZ";
  const PARTY_COMMAND_GATHER_HOTKEY_CODE = "KeyX";
  const PARTY_COMMAND_CHANNEL_OPTIONS = [
    ["faction", "Faction"],
    ["party", "Party"],
    ["clan", "Clan"],
  ];
  const GEAR_PRESET_DEFAULT_NAME = "default";
  const GEAR_PRESET_QUICK_NAMES = ["1", "2", "3", "4", "5"];
  const SKILL_PRESET_DEFAULT_NAME = "default";
  const SKILL_PRESET_QUICK_NAMES = ["1", "2", "3", "4", "5"];
  const GEAR_PRESET_EQUIP_DELAY_MS = 110;
  const GEAR_PRESET_VERIFY_RETRY_DELAYS_MS = [200, 400, 800, 1400, 2200];
  const HORDES_CLIENT_COMMAND_HEADER = 5;
  const HORDES_WEB_SOCKET_OPEN = 1;
  const HORDES_CHAT_CHANNELS = new Set(["party", "clan", "faction", "yell", "global"]);
  const HORDES_CHAT_CHANNEL_ALIASES = {
    c: "clan",
    clan: "clan",
    p: "party",
    party: "party",
    f: "faction",
    faction: "faction",
    y: "yell",
    yell: "yell",
    global: "global",
  };
  const GEAR_EQUIP_SLOT_SET = new Set([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
  const GEAR_PRESET_EXACT_UNEQUIP_SLOTS = [101, 102, 103, 105, 106, 107, 108, 109, 110, 111];
  const GEAR_EQUIP_SLOT_BY_TYPE = {
    hammer: 101,
    bow: 101,
    staff: 101,
    sword: 101,
    armlet: 102,
    armor: 103,
    bag: 104,
    boot: 105,
    glove: 106,
    ring: 107,
    amulet: 108,
    quiver: 109,
    shield: 109,
    totem: 109,
    orb: 109,
    charm: 110,
  };
  const GEAR_PRESET_NON_EQUIP_TYPES = new Set([
    "book",
    "currency",
    "material",
    "misc",
    "mount",
    "pet",
    "potion",
    "quest",
    "rune",
    "scroll",
    "skillbook",
    "token",
  ]);
  const STATUS_UI_KEYBOARD_EVENTS = [
    "keydown",
    "keypress",
    "keyup",
    "beforeinput",
    "input",
    "compositionstart",
    "compositionupdate",
    "compositionend",
    "paste",
    "copy",
    "cut",
  ];
  const HIGHLIGHT_INPUT_POINTER_EVENTS = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "touchstart",
    "touchend",
  ];
  const UI_CONTROL_POINTER_EVENTS = [
    ...HIGHLIGHT_INPUT_POINTER_EVENTS,
    "pointerup",
    "pointermove",
    "contextmenu",
    "wheel",
  ];
  const STATUS_UI_TEXT_INPUT_IDS = [
    "highlightInput",
    "chatApiKeyInput",
  ];
  const UI_CONFIG = loadJsonConfig(UI_CONFIG_KEY, {
    x: null,
    y: null,
    width: 400,
    height: null,
    fontScale: 1,
  });
  // One-time: adopt the wider default panel. Only bumps users still on the old 320px
  // default (or narrower); a custom-resized wider panel is left alone.
  try {
    if (localStorage.getItem("hordesKrMod.ui.widthV2") !== "1") {
      if (!Number.isFinite(UI_CONFIG.width) || UI_CONFIG.width <= 320) UI_CONFIG.width = 400;
      localStorage.setItem("hordesKrMod.ui.widthV2", "1");
      saveJsonConfig(UI_CONFIG_KEY, UI_CONFIG);
    }
  } catch { /* storage may be unavailable */ }
  const FEATURE_CONFIG = loadJsonConfig(FEATURE_CONFIG_KEY, {
    domTranslationEnabled: true,
    targetDistanceEnabled: true,
    incomingSkillOverlayEnabled: true,
    incomingTargetWatchEnabled: false,
    buffSpikeWarnEnabled: true,
    dashboardEnabled: true,
    threatHudEnabled: true,
    watchBeepEnabled: true,
    dangerOverlayEnabled: true,
    autoInterruptEnabled: false,
    autoInterruptSlots: [5, 9],
    autoInterruptRangeM: 30,
    autoInterruptSkillIds: [45, 52, 35, 33, 51, 54], // Volley, Frostcall, Summon, Charge, Shatter(쉐터), Bone Shot(본샷)
    autoInterruptHighlightOnly: false, // false = interrupt ANY hostile in range (강조 무관)
    autoInterruptWsHook: true, // experimental: also run detection on WS message arrival (saves ~poll latency)
    teamSyncEnabled: true, // 설치 기본값: 팀공유 ON
    teamSyncRoom: TEAM_SYNC_ROOM_DEFAULT,
    teamSyncServer: TEAM_SYNC_SERVER_DEFAULT,
    teamSyncToken: TEAM_SYNC_TOKEN_DEFAULT,
    chatTranslationEnabled: false,
    swiftshotTurboEnabled: true,
    swiftshotTurboKeyCodes: SWIFTSHOT_TURBO_DEFAULT_KEY_CODES,
    swiftshotTurboKeyCode: SWIFTSHOT_TURBO_DEFAULT_KEY_CODE,
    swiftshotTurboIntervalMs: SWIFTSHOT_TURBO_DEFAULT_INTERVAL_MS,
    damageLogEnabled: true,
  });
  FEATURE_CONFIG.domTranslationEnabled = localStorage.getItem(ENABLED_KEY) !== "false";
  FEATURE_CONFIG.targetDistanceEnabled = FEATURE_CONFIG.targetDistanceEnabled !== false;
  FEATURE_CONFIG.incomingSkillOverlayEnabled = FEATURE_CONFIG.incomingSkillOverlayEnabled !== false;
  FEATURE_CONFIG.incomingTargetWatchEnabled = FEATURE_CONFIG.incomingTargetWatchEnabled !== false;
  FEATURE_CONFIG.buffSpikeWarnEnabled = FEATURE_CONFIG.buffSpikeWarnEnabled !== false;
  FEATURE_CONFIG.dashboardEnabled = FEATURE_CONFIG.dashboardEnabled !== false;
  FEATURE_CONFIG.threatHudEnabled = FEATURE_CONFIG.threatHudEnabled !== false;
  FEATURE_CONFIG.watchBeepEnabled = FEATURE_CONFIG.watchBeepEnabled !== false;
  FEATURE_CONFIG.dangerOverlayEnabled = FEATURE_CONFIG.dangerOverlayEnabled !== false;
  FEATURE_CONFIG.autoInterruptEnabled = FEATURE_CONFIG.autoInterruptEnabled === true;
  FEATURE_CONFIG.autoInterruptSlots = Array.isArray(FEATURE_CONFIG.autoInterruptSlots)
    ? FEATURE_CONFIG.autoInterruptSlots.map((slot) => Math.round(Number(slot))).filter((slot) => slot >= 1 && slot <= 12).slice(0, 4)
    : [5, 9];
  if (!FEATURE_CONFIG.autoInterruptSlots.length) FEATURE_CONFIG.autoInterruptSlots = [5, 9];
  FEATURE_CONFIG.autoInterruptRangeM = clamp(Math.round(Number(FEATURE_CONFIG.autoInterruptRangeM) || 30), 5, 80);
  FEATURE_CONFIG.autoInterruptSkillIds = Array.isArray(FEATURE_CONFIG.autoInterruptSkillIds)
    ? FEATURE_CONFIG.autoInterruptSkillIds.map((id) => Math.round(Number(id))).filter((id) => id >= 0).slice(0, 12)
    : [45, 52, 35, 33, 51, 54];
  if (!FEATURE_CONFIG.autoInterruptSkillIds.length) FEATURE_CONFIG.autoInterruptSkillIds = [45, 52, 35, 33, 51, 54];
  // One-time: fold newly-added trigger skills into existing saved lists and PERSIST
  // (else the in-memory push is lost on reload). 33=Charge, 51=Shatter, 54=Bone Shot.
  try {
    if (localStorage.getItem("hordesKrMod.autoInterrupt.triggersV3") !== "1") {
      for (const id of [33, 51, 54]) {
        if (!FEATURE_CONFIG.autoInterruptSkillIds.includes(id)) FEATURE_CONFIG.autoInterruptSkillIds.push(id);
      }
      localStorage.setItem("hordesKrMod.autoInterrupt.triggersV3", "1");
      saveFeatureConfig();
    }
  } catch { /* storage may be unavailable */ }
  FEATURE_CONFIG.autoInterruptHighlightOnly = FEATURE_CONFIG.autoInterruptHighlightOnly === true;
  FEATURE_CONFIG.autoInterruptWsHook = FEATURE_CONFIG.autoInterruptWsHook !== false;
  FEATURE_CONFIG.teamSyncEnabled = FEATURE_CONFIG.teamSyncEnabled === true;
  FEATURE_CONFIG.teamSyncRoom = String(FEATURE_CONFIG.teamSyncRoom || TEAM_SYNC_ROOM_DEFAULT).replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 48) || TEAM_SYNC_ROOM_DEFAULT;
  FEATURE_CONFIG.teamSyncServer = String(FEATURE_CONFIG.teamSyncServer || TEAM_SYNC_SERVER_DEFAULT).trim() || TEAM_SYNC_SERVER_DEFAULT;
  FEATURE_CONFIG.teamSyncToken = String(FEATURE_CONFIG.teamSyncToken || TEAM_SYNC_TOKEN_DEFAULT).trim() || TEAM_SYNC_TOKEN_DEFAULT;
  if (localStorage.getItem(INCOMING_TARGET_WATCH_DEFAULT_VERSION_KEY) !== INCOMING_TARGET_WATCH_DEFAULT_VERSION) {
    FEATURE_CONFIG.incomingTargetWatchEnabled = true;
    try {
      localStorage.setItem(INCOMING_TARGET_WATCH_DEFAULT_VERSION_KEY, INCOMING_TARGET_WATCH_DEFAULT_VERSION);
    } catch {
      // Storage can be unavailable in strict browser modes.
    }
    saveFeatureConfig();
  }
  FEATURE_CONFIG.chatTranslationEnabled = FEATURE_CONFIG.chatTranslationEnabled === true;
  FEATURE_CONFIG.damageLogEnabled = FEATURE_CONFIG.damageLogEnabled !== false;
  FEATURE_CONFIG.swiftshotTurboEnabled = FEATURE_CONFIG.swiftshotTurboEnabled !== false;
  FEATURE_CONFIG.swiftshotTurboKeyCodes = normalizeSwiftshotTurboKeyCodes(
    Array.isArray(FEATURE_CONFIG.swiftshotTurboKeyCodes)
      ? FEATURE_CONFIG.swiftshotTurboKeyCodes
      : SWIFTSHOT_TURBO_DEFAULT_KEY_CODES
  );
  FEATURE_CONFIG.swiftshotTurboKeyCode = FEATURE_CONFIG.swiftshotTurboKeyCodes[0] || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
  if (localStorage.getItem(SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION_KEY) !== SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION) {
    if (!FEATURE_CONFIG.swiftshotTurboKeyCodes.includes("Digit1")) {
      FEATURE_CONFIG.swiftshotTurboKeyCodes = normalizeSwiftshotTurboKeyCodes([
        ...FEATURE_CONFIG.swiftshotTurboKeyCodes,
        "Digit1",
      ]);
      FEATURE_CONFIG.swiftshotTurboKeyCode = FEATURE_CONFIG.swiftshotTurboKeyCodes[0] || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
    }
    try {
      localStorage.setItem(SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION_KEY, SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION);
    } catch {
      // Storage can be unavailable in strict browser modes.
    }
    saveFeatureConfig();
  }
  FEATURE_CONFIG.swiftshotTurboIntervalMs = clampInteger(
    FEATURE_CONFIG.swiftshotTurboIntervalMs,
    SWIFTSHOT_TURBO_MIN_INTERVAL_MS,
    SWIFTSHOT_TURBO_MAX_INTERVAL_MS,
    SWIFTSHOT_TURBO_DEFAULT_INTERVAL_MS
  );
  const PARTY_UI_CONFIG = loadJsonConfig(PARTY_UI_CONFIG_KEY, {
    enabled: false, // 설치 기본값: 파티창이동 OFF
    preset: "default",
    x: null,
    y: null,
    columns: 1,
    frameWidth: PARTY_UI_FRAME_WIDTH,
    gap: PARTY_UI_GRID_GAP,
  });
  PARTY_UI_CONFIG.enabled = PARTY_UI_CONFIG.enabled !== false;
  PARTY_UI_CONFIG.preset = typeof PARTY_UI_CONFIG.preset === "string" ? PARTY_UI_CONFIG.preset : "default";
  PARTY_UI_CONFIG.columns = clamp(Number(PARTY_UI_CONFIG.columns) || 1, 1, 5);
  PARTY_UI_CONFIG.frameWidth = clamp(Number(PARTY_UI_CONFIG.frameWidth) || PARTY_UI_FRAME_WIDTH, 150, 240);
  PARTY_UI_CONFIG.gap = clamp(Number(PARTY_UI_CONFIG.gap) || PARTY_UI_GRID_GAP, 0, 10);
  const PARTY_COMMAND_CONFIG = loadJsonConfig(PARTY_COMMAND_CONFIG_KEY, {
    enabled: false, // 설치 기본값: 파티패널 OFF
    channel: "clan",
    x: null,
    y: null,
    lastMessage: "",
  });
  PARTY_COMMAND_CONFIG.enabled = PARTY_COMMAND_CONFIG.enabled !== false;
  PARTY_COMMAND_CONFIG.channel = normalizeHordesChatChannel(PARTY_COMMAND_CONFIG.channel || "clan");
  PARTY_COMMAND_CONFIG.x = normalizeOptionalScreenCoordinate(PARTY_COMMAND_CONFIG.x);
  PARTY_COMMAND_CONFIG.y = normalizeOptionalScreenCoordinate(PARTY_COMMAND_CONFIG.y);
  PARTY_COMMAND_CONFIG.lastMessage = String(PARTY_COMMAND_CONFIG.lastMessage || "").slice(0, 96);
  const GEAR_PRESET_CONFIG = loadJsonConfig(GEAR_PRESET_CONFIG_KEY, {
    presets: {},
    lastPreset: GEAR_PRESET_DEFAULT_NAME,
  });
  if (!isObject(GEAR_PRESET_CONFIG.presets)) GEAR_PRESET_CONFIG.presets = {};
  GEAR_PRESET_CONFIG.lastPreset = String(GEAR_PRESET_CONFIG.lastPreset || GEAR_PRESET_DEFAULT_NAME);
  const SKILL_PRESET_CONFIG = loadJsonConfig(SKILL_PRESET_CONFIG_KEY, {
    presets: {},
    lastPreset: SKILL_PRESET_DEFAULT_NAME,
  });
  if (!isObject(SKILL_PRESET_CONFIG.presets)) SKILL_PRESET_CONFIG.presets = {};
  SKILL_PRESET_CONFIG.lastPreset = String(SKILL_PRESET_CONFIG.lastPreset || SKILL_PRESET_DEFAULT_NAME);
  const HIGHLIGHT_CONFIG = loadJsonConfig(HIGHLIGHT_CONFIG_KEY, {
    names: DEFAULT_HIGHLIGHT_NAMES,
    enabled: true,
    domEnabled: true,
    canvasEnabled: true,
    runtimeOverlayEnabled: true,
    minimapLabelsEnabled: false, // 설치 기본값: 미니맵 라벨 OFF
    minimapListEnabled: true,
    minimapListAllHostiles: false,
    minimapListScale: MINIMAP_LIST_DEFAULT_SCALE,
    minimapListX: null,
    minimapListY: null,
    presetBarX: null,
    presetBarY: null,
    hideClanNames: true,
    nameplateStyle: null,
    selfHighlight: true, // 설치 기본값: 내이름 강조 ON
  });
  HIGHLIGHT_CONFIG.names = Array.isArray(HIGHLIGHT_CONFIG.names)
    ? uniqueHighlightNames(HIGHLIGHT_CONFIG.names)
    : [];
  HIGHLIGHT_CONFIG.selfHighlight = HIGHLIGHT_CONFIG.selfHighlight === true;
  HIGHLIGHT_CONFIG.enabled = HIGHLIGHT_CONFIG.enabled !== false;
  HIGHLIGHT_CONFIG.domEnabled = HIGHLIGHT_CONFIG.domEnabled !== false;
  HIGHLIGHT_CONFIG.canvasEnabled = HIGHLIGHT_CONFIG.canvasEnabled !== false;
  HIGHLIGHT_CONFIG.runtimeOverlayEnabled = HIGHLIGHT_CONFIG.runtimeOverlayEnabled !== false;
  HIGHLIGHT_CONFIG.minimapLabelsEnabled = HIGHLIGHT_CONFIG.minimapLabelsEnabled !== false;
  HIGHLIGHT_CONFIG.minimapListEnabled = HIGHLIGHT_CONFIG.minimapListEnabled !== false;
  HIGHLIGHT_CONFIG.minimapListAllHostiles = HIGHLIGHT_CONFIG.minimapListAllHostiles === true;
  HIGHLIGHT_CONFIG.minimapListScale = normalizeMinimapHighlightListScale(HIGHLIGHT_CONFIG.minimapListScale);
  HIGHLIGHT_CONFIG.minimapListX = normalizeOptionalScreenCoordinate(HIGHLIGHT_CONFIG.minimapListX);
  HIGHLIGHT_CONFIG.minimapListY = normalizeOptionalScreenCoordinate(HIGHLIGHT_CONFIG.minimapListY);
  HIGHLIGHT_CONFIG.presetBarX = normalizeOptionalScreenCoordinate(HIGHLIGHT_CONFIG.presetBarX);
  HIGHLIGHT_CONFIG.presetBarY = normalizeOptionalScreenCoordinate(HIGHLIGHT_CONFIG.presetBarY);
  clearInvalidDefaultScreenCoordinatePair(HIGHLIGHT_CONFIG, "minimapListX", "minimapListY");
  clearInvalidDefaultScreenCoordinatePair(HIGHLIGHT_CONFIG, "presetBarX", "presetBarY");
  HIGHLIGHT_CONFIG.hideClanNames = HIGHLIGHT_CONFIG.hideClanNames !== false;
  syncGroupedHighlightConfig(HIGHLIGHT_CONFIG.enabled);
  const CACHE = new Map();
  const MOD_STATUS = {
    loadedAt: new Date(),
    interceptedCount: 0,
    lastRequest: "",
    lastState: "대기 중",
    lastError: "",
    lastAppliedAt: null,
    lastTransport: "",
    source: "",
    domReplacedCount: 0,
  };
  const STATUS_UI = {
    host: null,
    shadow: null,
    panelOpen: false,
    resizeObserver: null,
    dragging: null,
  };
  const DOM_TRANSLATION_STATE = {
    observer: null,
    dictionary: null,
    loading: false,
    pending: false,
    queuedRoots: new Set(),
  };
  const CHAT_TRANSLATION_STATE = {
    observer: null,
    quickToggleHost: null,
    quickToggleTimer: null,
    quickToggleRenderKey: "",
    outgoingBusy: false,
    outgoingLastInput: "",
    outgoingLastTranslation: "",
    outgoingLastError: "",
    outgoingLastAt: null,
    pendingScan: false,
    activeRequests: 0,
    observedRootKey: "",
    queue: [],
    queuedKeys: new Set(),
    cache: new Map(),
    inFlight: new Map(),
    translatedCount: 0,
    requestCount: 0,
    batchRequestCount: 0,
    localHitCount: 0,
    cacheHits: 0,
    skippedCount: 0,
    droppedCount: 0,
    lastRequestDurationMs: null,
    averageRequestDurationMs: null,
    lastText: "",
    lastTranslation: "",
    lastChannel: "",
    lastTransport: "",
    lastBridgeTiming: null,
    lastError: "",
    lastAt: null,
    quotaBlockedUntil: 0, // circuit-breaker: pause requests after an OpenAI 429/quota error
  };
  migrateChatTranslationDefaultModel();
  const PARTY_UI_STATE = {
    frame: null,
    handle: null,
    observer: null,
    timer: null,
    pendingUpdate: false,
    dragging: null,
    lastAppliedKey: "",
    lastFrameCount: 0,
    lastError: "",
    gameFrameWidth: 0,
    gameWidthCount: 0,
  };
  const PARTY_COMMAND_STATE = {
    host: null,
    timer: null,
    renderKey: "",
    dragging: null,
    hotkeysInstalled: false,
    channelMenuOpen: false,
    lastState: "대기",
    lastError: "",
    lastSentAt: null,
    lastText: "",
    sentCount: 0,
  };
  const SWIFTSHOT_TURBO_STATE = {
    keyboardInstalled: false,
    held: false,
    timer: null,
    companionTimer: null,
    activeCode: "",
    synthetic: false,
    repeatCount: 0,
    lastAt: null,
    lastError: "",
    // Companion keys (e.g. 5 paired with E) are only fired on the pulse where the
    // primary key's skill actually casts. We detect that by watching the primary
    // skill's cooldown-end timestamp jump forward. null = not yet initialized.
    companionPrevCdEnd: null,
  };
  const DAMAGE_LOG_STATE = {
    host: null,
    listEl: null,
    headerEl: null,
    countEl: null,
    timer: null,
    styleInstalled: false,
    lastSeq: 0,
    lines: [],
    history: [],
  };
  const GEAR_PRESET_STATE = {
    gameSocket: null,
    socketWrapped: false,
    running: false,
    lastState: "대기",
    lastError: "",
    lastSavedAt: null,
    lastRunAt: null,
    lastResult: null,
    pendingPresetName: "",
    lastRequestedPresetName: "",
    lastVerifiedPresetName: "",
    progressOverlayHost: null,
    progressOverlayTimer: null,
  };
  const SKILL_PRESET_STATE = {
    running: false,
    lastState: "대기",
    lastError: "",
    lastSavedAt: null,
    lastRunAt: null,
    lastResult: null,
    pendingPresetName: "",
    lastRequestedPresetName: "",
    lastVerifiedPresetName: "",
  };
  const TARGET_DISTANCE_STATE = {
    lastAt: 0,
    lastResult: null,
    overlayHost: null,
    overlayLabel: null,
    overlayHits: 0,
    lastOverlayTickAt: 0,
    lastOverlayAt: 0,
    lastOverlayError: "",
    canvasHits: 0,
    lastCanvasAt: 0,
    lastCanvasText: "",
    lastCanvasDrawKey: "",
    lastCanvasTargetMatch: null,
    lastSelectedTarget: null,
    lockedTarget: null,
    deepSearchCache: new Map(),
  };
  const DASHBOARD_STATE = {
    host: null,
    body: null,
    timer: null,
    rows: new Map(),
    dragging: null,
    styleInstalled: false,
  };

  const COMBAT_ASSIST_STATE = {
    interruptTimer: null,
    lastError: "",
    // threat tracking (fed by the fast incoming-watch scan)
    watcherIds: new Set(),
    watcherNames: [],
    mobAggroCount: 0,
    threatFlashUntil: 0,
    lastBeepAt: 0,
    threatHost: null,
    audioCtx: null,
    fastPathHits: 0,
    fastPathLastAt: 0,
    // auto-interrupt bookkeeping
    interruptTries: new Map(),   // castKey -> attempt count
    lastInterruptAt: 0,
    lastInterruptInfo: "",
    interruptHits: 0,
    // diagnostics: what the interrupt last SAW / why it did/didn't fire
    lastInterruptDetect: null,   // {name, skill, distM, remainS, at}
    lastInterruptSkip: null,     // {reason, name, skill, at}
    lastInterruptResult: null,   // useSkillbarSlot return {ok, slot, id, reason} + at
    // experimental WS-hook: event-driven detection on socket message arrival
    wsHookAttached: false,       // listener attached to the live game socket
    wsHookPending: false,        // a microtask check is already queued (debounce)
    wsHookMsgCount: 0,           // messages observed
    wsHookFires: 0,              // interrupts fired from the WS-hook path
    lastWsHookAt: 0,
  };

  // Declared before installCombatAssist() runs at init — startDangerOverlayLoop() reads it
  // synchronously, so it must not be in the temporal dead zone.
  const DANGER_OVERLAY_STATE = { host: null, rafId: null, styleInstalled: false, markers: new Map() };

  // Declared before installCombatAssist() runs at init — scheduleTeamSync() reads it
  // synchronously, so it must not be in the temporal dead zone.
  const TEAM_SYNC_STATE = {
    timer: null,
    members: [],
    lastSyncAt: 0,
    lastError: "",
    inFlight: false,
    host: null,
    rows: new Map(),
    styleInstalled: false,
    dragging: null,
    hasSavedPos: false,
    posApplied: false,
    scale: 1.3,
  };

  const HIGHLIGHT_STATE = {
    observer: null,
    pending: false,
    buffSpikeTracker: new Map(),
    canvasInstalled: false,
    canvasHits: 0,
    canvasImageHits: 0,
    canvasClanHiddenHits: 0,
    lastCanvasText: "",
    lastCanvasImageText: "",
    lastCanvasClanText: "",
    lastCanvasDrawKey: "",
    lastCanvasDrawAt: 0,
    lastCanvasImageDrawKey: "",
    lastCanvasImageDrawAt: 0,
    canvasInternalDraw: false,
    styleCapture: null,
    scriptHookInstalled: false,
    scriptObserver: null,
    scriptGateInstalled: false,
    scriptGateError: "",
    scriptHookAttemptedScripts: [],
    scriptHookPatchedScripts: [],
    scriptHookErrors: [],
    queuedHighlightRoots: new Set(),
    runtimeOverlayHost: null,
    runtimeOverlayItems: new Map(),
    runtimeOverlayTimer: null,
    runtimeOverlayRafId: 0,
    runtimeOverlayActiveEntries: [],
    lastRuntimeOverlayTickAt: 0,
    runtimeDeepScanCacheKey: "",
    runtimeDeepScanAt: 0,
    runtimeDeepScanCandidates: [],
    runtimeOverlayHits: 0,
    lastRuntimeOverlayAt: 0,
    lastRuntimeOverlayError: "",
    lastRuntimeOverlayMatches: [],
    incomingSkillOverlayHits: 0,
    lastIncomingSkillOverlayAt: 0,
    lastIncomingSkillOverlayError: "",
    lastIncomingSkillOverlayMatches: [],
    incomingTargetWatchHits: 0,
    lastIncomingTargetWatchAt: 0,
    lastIncomingTargetWatchError: "",
    lastIncomingTargetWatchMatches: [],
    minimapOverlayHost: null,
    minimapOverlayItems: new Map(),
    minimapOverlayHits: 0,
    lastMinimapOverlayTickAt: 0,
    lastMinimapOverlayAt: 0,
    lastMinimapOverlayError: "",
    lastMinimapOverlayMatches: [],
    minimapListHost: null,
    minimapListHits: 0,
    lastMinimapListAt: 0,
    lastMinimapListError: "",
    lastMinimapListMatches: [],
    lastMinimapTargetResult: null,
    minimapListRenderKey: "",
    minimapListDragging: null,
    contextMenuObserver: null,
    contextMenuActionHost: null,
    contextMenuLastInjectedAt: 0,
    contextMenuLastTargetName: "",
    contextMenuLastError: "",
    contextMenuLastAt: 0,
    contextMenuLastX: 0,
    contextMenuLastY: 0,
    contextMenuLastElement: null,
    contextMenuLastSource: "",
    presetBarHost: null,
    lastPresetBarTickAt: 0,
    presetBarRenderKey: "",
    presetBarDragging: null,
  };
  const HIGHLIGHT_NAME_CACHE = {
    key: "",
    source: null,
    names: [],
    lowerNames: [],
    matcherSource: "",
    matchCache: new Map(),
  };
  applyMinimapListScaleDefaultMigration();
  applyDefaultHighlightNames();
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const originalFetch = pageWindow.fetch ? pageWindow.fetch.bind(pageWindow) : null;
  if (!originalFetch) {
    showBootstrapFailureBadge("KR Mod 초기화 실패", [
      "window.fetch를 찾지 못해 초기화를 중단했습니다.",
      "브라우저/확장 환경에서 페이지 전역 fetch가 막혀 있는 상태입니다.",
      "",
      "콘솔 진단:",
      "document.documentElement.getAttribute('data-hordes-kr-userscript-started')",
    ]);
    return;
  }

  initGameScriptRuntimeHook();
  installStatusDashboard();
  installCombatAssist();

  // === 시야각(FOV) 슬라이더 상한 해제 ===
  // 게임은 시야각 슬라이더를 max=100으로 제한하지만, 슬라이더 값 파서(Gt)에는
  // 클램프가 없고 카메라는 슬라이더가 내보내는 값을 그대로 적용한다(Yr.subscribe →
  // gt.fov). 따라서 슬라이더의 max만 올리면 100 이상도 선택 가능. 미니파이 변수명에
  // 의존하지 않도록 소스 패치 대신 DOM에서 "시야각" 라벨의 range 입력을 찾아 조정한다.
  const FOV_CAP_KEY = "hordes_kr_fov_cap";
  const FOV_CAP_DEFAULT = 150;
  const FOV_CAP_MIN = 100;   // 게임 기본 상한(100) 밑으로는 절대 낮추지 않음
  const FOV_CAP_LIMIT = 200; // 과도한 어안 왜곡 방지용 안전 상한

  function readFovCap() {
    try {
      const value = Number(localStorage.getItem(FOV_CAP_KEY));
      if (Number.isFinite(value) && value >= FOV_CAP_MIN && value <= FOV_CAP_LIMIT) return value;
    } catch {
      // localStorage 접근 불가 시 기본값 사용
    }
    return FOV_CAP_DEFAULT;
  }

  // "시야각"/"Field of view" 라벨이 붙은 range 입력인지 판정. 게임 설정창은
  // [라벨 div][input] 의 평평한 형제 구조라(라벨 div 안에 값 span 포함), 라벨은
  // 입력의 "바로 앞 형제"다. 평평한 부모엔 슬라이더가 여럿이므로 조상이 아니라
  // 앞 형제 라벨로 찾는다. 혹시 행으로 감싼 구조면 단일-슬라이더 조상을 폴백으로 본다.
  function isFovSlider(input) {
    if (!input) return false;
    let sibling = input.previousElementSibling;
    for (let i = 0; i < 3 && sibling; i++, sibling = sibling.previousElementSibling) {
      if (sibling.tagName === "INPUT") break; // 앞 필드의 입력에 도달 → 라벨 못 찾음
      const text = (sibling.textContent || "").trim();
      if (/시야각|field\s*of\s*view/i.test(text)) return true;
      if (text) break; // 매칭 안 되는 라벨이 이 입력의 라벨 → fov 아님
    }
    let el = input.parentElement;
    for (let depth = 0; depth < 4 && el; depth++, el = el.parentElement) {
      const text = (el.textContent || "").trim();
      if (/시야각|field\s*of\s*view/i.test(text)) {
        const ranges = el.querySelectorAll('input[type="range"]');
        return ranges.length === 1 && ranges[0] === input;
      }
      if (text.length > 60) break;
    }
    return false;
  }

  function findFovSliderInput() {
    const inputs = document.querySelectorAll('input[type="range"]');
    for (const input of inputs) {
      if (input.type === "range" && isFovSlider(input)) return input;
    }
    return null;
  }

  // 콘솔에서 시야각 값을 직접 적용(설정창이 열려 슬라이더가 DOM에 있어야 함).
  // 슬라이더 max를 먼저 올린 뒤 값을 넣고 input/change 이벤트를 쏴 게임 핸들러가
  // 카메라 fov 스토어(Yr)에 반영하게 한다.
  function setFovValue(value) {
    const next = Math.round(Number(value));
    if (!Number.isFinite(next) || next < 1 || next > FOV_CAP_LIMIT) {
      return `시야각 값은 1~${FOV_CAP_LIMIT} 사이여야 합니다.`;
    }
    const input = findFovSliderInput();
    if (!input) {
      return "시야각 슬라이더를 찾지 못했습니다. 게임 설정창(시야각 항목이 보이는 화면)을 연 상태에서 다시 실행하세요.";
    }
    const cap = Math.max(next, fovCap);
    if (Number(input.max) < cap) input.max = String(cap);
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return `시야각 = ${next} 적용됨`;
  }

  function raiseFovSlider(input) {
    if (!input || input.type !== "range" || !isFovSlider(input)) return;
    if (Number(input.max) >= fovCap) return;
    input.max = String(fovCap);
    input.dataset.krFovUncapped = String(fovCap);
  }

  function scanForFovSliders(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches('input[type="range"]')) raiseFovSlider(node);
    if (node.querySelectorAll) node.querySelectorAll('input[type="range"]').forEach(raiseFovSlider);
  }

  function installFovUncap() {
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) scanForFovSliders(node);
        }
      });
      const start = () => {
        if (!document.body) return false;
        scanForFovSliders(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
        return true;
      };
      if (!start()) document.addEventListener("DOMContentLoaded", start, { once: true });
    } catch (error) {
      console.warn("[Hordes KR Mod] 시야각 상한 해제 설치 실패:", error && error.message);
    }
  }

  function setFovCapValue(value) {
    const next = Math.round(Number(value));
    if (!Number.isFinite(next) || next < FOV_CAP_MIN || next > FOV_CAP_LIMIT) {
      return `시야각 상한은 ${FOV_CAP_MIN}~${FOV_CAP_LIMIT} 사이여야 합니다.`;
    }
    fovCap = next;
    try { localStorage.setItem(FOV_CAP_KEY, String(next)); } catch {
      // 저장 실패해도 이번 세션엔 적용됨
    }
    document.querySelectorAll('input[type="range"]').forEach((input) => {
      if (isFovSlider(input)) input.max = String(next);
    });
    return `시야각 슬라이더 상한 = ${next} (설정창에서 그만큼까지 올릴 수 있습니다)`;
  }

  let fovCap = readFovCap();
  installFovUncap();

  const KO_PATCH = {
    factions: {
      0: {
        description:
          "Vanguard 진영은 전통과 체계, 질서를 중시합니다. 이들의 성은 Guardstone 주변의 푸른 녹지대에 자리하고 있습니다.",
      },
      1: {
        description:
          "Bloodlust 진영은 자유와 충성을 중시하며, 개인주의와 혼돈까지도 받아들이는 곳입니다. 이들의 방어 거점은 Headless Landing이라 불리는 사막 지역에 있습니다.",
      },
      2: {
        name: "중립",
      },
    },
    classes: {
      0: {
        description:
          "전사는 방패 장비와 강력한 방어 강화 효과를 바탕으로, 다른 어떤 직업보다 많은 몬스터의 공격을 버텨낼 수 있습니다.",
      },
      1: {
        description:
          "마법사는 강력한 대규모 광역 피해를 입히며, 얼음 계열 마법으로 적의 이동을 늦추는 보조 능력도 제공합니다.",
      },
      2: {
        description:
          "궁수는 단일 대상에게 높은 피해를 주고 순간적인 광역 피해도 낼 수 있습니다. 숙련된 궁수는 항상 거리를 유지하며 멀리서 적을 저격합니다.",
      },
      3: {
        description:
          "주술사는 방어 담당을 치유하고 공격 강화 효과나 강력한 약화 효과를 제공해 파티를 지원합니다.",
      },
      4: {
        name: "NPC",
      },
    },
    items: {
      amulet: {
        0: {
          description:
            "타버린 재료를 비틀어 묶어 만든, 약한 보호 효과를 지닌 부적입니다. 이런 단순한 부적을 만드는 일은 고대부터 흔한 생존 방식이었습니다.",
        },
        1: {
          description:
            "늑대를 길들이기 위한 목걸이는 두꺼운 가죽으로 만들어집니다. 일부에는 아직 사슬 고리가 남아 있으며, 모든 늑대 목걸이는 매우 튼튼합니다. 몇몇 목걸이에는 영적인 보호가 깃들어 있습니다.",
        },
        2: {
          description:
            "이 목걸이는 여러 강력한 생물의 뼛조각으로 이루어져 있습니다. 뼈의 출처에 따라 각 뼈 목걸이의 보호 효과가 달라집니다.",
        },
        3: {
          description:
            "희생자의 몸에 남겨진 무시무시한 늑대인간의 발톱에 신비한 기름을 바르고, 명상을 통해 영적인 강인함을 불어넣었습니다. 이 부적을 만든 이들은 언젠가 이 보호의 힘이 복수에 쓰이길 바랐습니다.",
        },
        4: {
          description:
            "발톱이 발견되면 산의 신성한 새들이 내린 선물로 여겨졌습니다. 산속 수도승들은 전투 중 침입자로부터 자신을 보호하기 위해 그 발톱으로 영적인 부적을 만들었습니다.",
        },
        5: {
          description:
            "고대 사막 사람들은 특별한 돌을 모아, 기묘하고 어두운 마법으로 풍뎅이 모양을 만들었습니다. 당시 문명의 유력자들은 위엄과 보호를 위해 이런 부적을 착용했습니다.",
        },
        6: {
          description:
            "산에서 캐낸 낯선 파편을 신비술사들이 강화해 부적으로 만들었습니다. 이 부적은 착용자를 보호하고 적에게 공포를 일으키기 위해 사용됩니다.",
        },
        7: {
          description:
            "서로 전쟁하던 신정 국가들은 보호 수단으로 신성한 오메가 상징을 만들었습니다. 이 상징은 공격을 억제하고, 보호의 선물로 주어지며, 잠재적인 신도에게 바쳐졌습니다.",
        },
        8: {
          description:
            "이 부적은 겹쳐진 원반들이 자연 에너지를 끌어내 착용자의 자연적인 보호력을 증폭하는 특이한 구조를 지녔습니다. 많은 마법 사용자들이 이를 재현하기 위해 부적의 비밀을 배우려 합니다.",
        },
        9: {
          description:
            "금속 가닥이 서로 얽히며 전기 아크를 일으켜 살아 있는 부적처럼 보입니다. 학자들은 이 부적이 사라진 영역에서 왔다고 추측하지만, 확실히 아는 이는 없습니다.",
        },
        10: {
          description:
            "고대 왕들은 사후 세계에서 자신을 보호하기 위해 강력한 앙크 상징을 만들었습니다. 무덤 도굴꾼들이 이 부적을 훔쳐 사람과 몬스터 모두에게 팔았습니다. 각각의 앙크는 진정한 힘을 감추는 섬뜩한 빛을 냅니다.",
        },
        11: {
          description:
            "거대한 세계수 Yggdrasil의 뒤틀린 조각으로 만든, 가장 신성한 종류의 부적입니다. 부적에서 흘러나오는 수액은 몸에 흡수되어 추가적인 보호를 제공합니다.",
        },
        12: {
          description:
            "이 부적에는 어린 드래곤에게 내려진 고룡의 마법이 담겨 있습니다. 이 부적은 어린 드래곤이 성장기까지 살아남을 가능성을 높여 주었습니다. 드래곤이 스스로 생존할 만큼 자라면 사슬이 끊어지고 부적은 사라졌습니다.",
        },
        13: {
          description:
            "이 부적에는 유명한 왕이 썼던 왕관의 보석이 들어 있습니다. 부적의 가장자리는 잔혹할 만큼 날카롭고, 정체를 알 수 없는 물질이 일부 묻어 있습니다.",
        },
        14: {
          description:
            "불사조 깃털로 만든 이 부적의 중심에는, 과거 이 부적을 소유했던 모든 쓰러진 모험가들의 재가 조금씩 담겨 있습니다. 예외 없이 이 부적을 사용한 모험가는 모두 전설이 되었습니다.",
        },
      },
      armlet: {
        0: {
          description:
            "단순하게 감아 만든 가죽 끈 형태의 손목 보호구입니다.",
        },
        1: {
          description:
            "급하게 만들어진 팔보호구입니다. 가죽 옆면에 남은 거친 전투 흔적을 보면 이전 주인이 살아남았을지 확신하기 어렵습니다.",
        },
        2: {
          description:
            "질긴 가죽을 공들여 가공해 만든 훌륭한 팔보호구입니다. 가죽 한쪽에는 장인의 서명인 \"Markay'ak\"이 남아 있습니다.",
        },
        3: {
          description:
            "두꺼운 몬스터 뼈로 정교하게 만든 팔보호구입니다. 이런 팔보호구를 착용하면 죽은 몬스터의 힘이 몸에 스며든다는 미신도 있지만, 뼈를 재사용하면 몬스터의 부활을 막을 수 있다고 믿는 이들도 있습니다.",
        },
        4: {
          description:
            "전쟁에서 많이 쓰여 여전히 더러움이 남아 있는 철제 방어구입니다. 금속에 난 발톱 자국은 대부분 겉면에만 남은 것처럼 보입니다.",
        },
        5: {
          description:
            "작은 룬이 새겨져 추가적인 보호력을 부여하는 강철 팔보호구입니다. 룬 제작법이 비밀로 유지되기 때문에 이런 팔보호구는 다소 희귀합니다.",
        },
        6: {
          description:
            "마법으로만 만들 수 있는 특별한 불꽃으로 제련한 팔보호구입니다. 과거에는 화염 정령들이 극소수의 특별한 대장장이에게만 Ember Cuffs 제작 비법을 전수했습니다.",
        },
        7: {
          description:
            "반사 방어구를 만들 수 있는 뛰어난 대장장이들이 제작한 팔보호구입니다. 피해를 줄이는 이 보호 특성은 많은 엘프 마법사들에게 영감을 주었고, 그들은 Mirror Armlets를 자주 실험 대상으로 삼았습니다.",
        },
        8: {
          description:
            "골렘 파편은 마법을 다루는 소수의 대장장이들이 오랜 시간을 들여 조립합니다. 한 쌍의 골렘 파편은 바위 골렘의 껍질을 이용해 수백 일에 걸쳐 제작됩니다.",
        },
        9: {
          description:
            "이런 팔보호구는 산에서 발견되는 희귀 금속으로 만들어집니다. 대장장이들은 금속의 마력 증폭 특성을 유지하기 위해 열 대신 마법이 깃든 망치로 팔보호구를 제련합니다.",
        },
        10: {
          description:
            "검은 운석에서 얻은 금속을 두드려 만든 팔보호구입니다. 지금까지 가장 많은 검은 운석은 제2차 대전쟁 이후 이어진 대재앙 뒤에 발견되었습니다.",
        },
        11: {
          description:
            "광기에 가까워진 야심 찬 마법사들이 차원 마법의 비밀을 발견하고, 일반적인 마법 방어를 초월하는 팔보호구를 만들었습니다. 이 비정상적인 팔보호구는 특성을 유지하기 위해 특별한 형태가 필요했습니다.",
        },
        12: {
          description:
            "어떤 전설은 이 팔보호구가 영역에 수호자가 필요할 때만 나타난다고 말합니다. 기록에 따르면 이 팔보호구가 발견될 때마다 얼마 지나지 않아 끔찍한 비극이 일어났고, 그래서 그 출현은 대개 불길한 징조로 여겨집니다.",
        },
      },
      bag: {
        0: {
          description:
            "섬세한 천으로 만든 주머니입니다. 이런 주머니는 평범한 사람들이 소지품을 들고 다니기 위해 자주 사용합니다.",
        },
        1: {
          description:
            "튼튼한 천으로 만든 거친 배낭입니다. Linen Pouch보다 더 많은 장비를 담을 수 있습니다.",
        },
        2: {
          description:
            "몬스터 가죽으로 만든 튼튼한 더플백입니다. 꽤 넉넉한 인벤토리 공간을 제공합니다.",
        },
        3: {
          description:
            "값비싼 엘프 직물로 만든 고급 가방입니다. 대부분의 가방보다 주머니가 훨씬 많습니다.",
        },
        4: {
          description:
            "이런 가방은 비밀스러운 드루이드 결사에 자연이 내려 준 선물입니다. 안타깝게도 오랜 세월 동안 많은 드루이드가 몬스터에게 쓰러졌고, 이 신성한 가방들도 빼앗겼습니다.",
        },
      },
      boot: {
        0: { description: "달리기보다는 편안함을 위해 만들어진 신발입니다." },
        1: {
          description:
            "임시 재료를 감싸 달릴 때 안정성을 높인 발싸개입니다.",
        },
        2: {
          description:
            "적당한 전투 내구성을 갖추도록 훌륭한 장인 기술로 만든 가죽 신발입니다.",
        },
        3: {
          description:
            "이런 신발에 쓰인 몬스터 뼈는 이동 속도를 높이는 듯합니다. 다만 그 효과가 마법 때문인지, 재료의 가벼움 때문인지는 알려져 있지 않습니다.",
        },
        4: {
          description:
            "전투에 적합하도록 가볍고 튼튼한 몬스터 비늘로 정성껏 제작한 신발입니다.",
        },
        5: {
          description:
            "이런 마법 신발은 그림자 마법으로 착용자의 발을 밀어내 속도를 높입니다.",
        },
        6: {
          description:
            "튼튼한 철로 제작된 신발입니다. 수많은 전쟁에서 사용되었습니다.",
        },
        7: {
          description:
            "착용자의 속도를 높이는 룬이 새겨진 신발입니다. 다만 룬의 진짜 목적과 본질이 불분명해 학자들은 사용을 조심스러워합니다.",
        },
        8: {
          description:
            "Skyswift Boots를 만들 때 엘프 마법은 바람 정령의 도움을 받습니다. 엘프는 자연과 매우 가까운 종족이지만, 은둔적인 바람 정령에 대해서는 그들조차 아는 것이 많지 않습니다.",
        },
        9: {
          description:
            "이 신발은 특수 금속의 고유한 성질을 유지하기 위해 열을 쓰지 않고 마법이 깃든 망치로 제련합니다. 이 희귀 금속은 주로 산에서 발견됩니다.",
        },
        10: {
          description:
            "하늘 정령의 도움을 받은 몬스터 장인들이 만든 신발입니다. 일부 몬스터 세력은 하늘 정령과 자연에 깊은 연관이 있지만, 그 관계를 자주 입에 올리지는 않습니다.",
        },
        11: {
          description:
            "유명한 유물 전설에서 이름을 딴 신발입니다. 그 유물은 어느 유명한 신의 빠른 신발이었다고 전해지지만, 이야기가 어디서 시작되었는지는 아무도 모르는 듯합니다.",
        },
        12: {
          description:
            "운석 조각으로 이루어진 신발입니다. 검은 운석은 하늘에서 불이 쏟아져 지형 대부분을 파괴한 끔찍한 재앙 중에 발견되었습니다.",
        },
      },
      bow: {
        0: {
          description:
            "임시로 만든 활입니다. 어떤 지역에서는 목재가 풍부하지 않아, 주민들이 손에 잡히는 재료로 이런 무기를 만들기도 합니다.",
        },
        1: {
          description:
            "초보 궁수들이 실력을 갈고닦을 수 있도록 제작된 활입니다.",
        },
        2: {
          description:
            "곡선형 단궁은 주로 지역 야생동물 사냥을 위해 제작됩니다.",
        },
        3: {
          description:
            "모험가들이 표준적으로 선택하는 무기 유형의 활입니다.",
        },
        4: { description: "장궁은 전쟁 무기로 쓰이도록 설계되었습니다." },
        5: {
          description:
            "몬스터 뼈로 만들어 더 높은 탄성과 위력을 내는 활입니다.",
        },
        6: {
          description:
            "엘프 장인들은 활을 만드는 과정에 세심한 정성을 들입니다. 전쟁 때 엘프 궁수들이 자부심 높은 명성을 얻은 데에는 그만한 이유가 있습니다.",
        },
        7: {
          description:
            "고대 활은 잊힌 장인들이 설계한 뛰어난 무기입니다. 이런 활은 한 세대에서 다음 세대로 전해지는 경우가 많습니다.",
        },
        8: {
          description:
            "갑옷을 입은 몬스터에 대응하기 위해 개발된 활입니다.",
        },
        9: {
          description:
            "이 활의 설계는 장궁보다 구조적으로 더 효율적입니다. 독특한 은 장식 무늬는 이런 훌륭한 활을 만드는 데 필요한 장인 정신을 보여 줍니다.",
        },
        10: {
          description:
            "이런 활은 효율을 크게 높이기 위해 개조를 거친 암살자들의 소유물이었습니다. 암살자들은 최적의 성능을 얻기 위해 무기를 꾸준히 손봅니다.",
        },
        11: {
          description:
            "악마적인 존재들이 제공한 지옥불로 만든 활입니다. 이런 활이 드문 이유는 사악한 거래와 획득 과정에 요구되는 궁극의 대가 때문입니다.",
        },
        12: {
          description:
            "불사조의 불꽃에 담갔다가 밤하늘 아래에서 식힌 활입니다. 이렇게 만들어진 활에는 때때로 불사조 불꽃의 추가적인 마법 특성이 깃듭니다.",
        },
        13: {
          description:
            "Widowmaker는 사용자와 결속하는 살아 있는 활입니다. 강력한 몬스터들은 신비한 과정을 통해 Widowmaker를 만들며, 완성된 무기는 매우 질투심이 강해질 수 있습니다. 오랜 전투 경험을 바탕으로 적을 쓰러뜨리며 사용자가 다른 무기를 쓰지 못하게 유혹합니다.",
        },
        14: {
          description:
            "이 활은 제작 과정이 길고 까다로워 희귀합니다. 모든 번개를 받아 점차 Stormsong으로 벼려낼 수 있도록 활을 높은 곳에 올려 두어야 하며, 완성까지는 오랜 세월이 걸릴 수 있습니다.",
        },
        15: {
          description:
            "이 사악한 활은 사용자의 꿈과 악몽을 먹어 치웁니다. 이 살아 있는 활은 충성을 바치지 않으며, 전투 희생자를 제물로 요구합니다.",
        },
        16: {
          description:
            "문명 전체에 거대한 비극이 닥치면, 분노한 희생자들의 영혼이 무기에 원한을 쏟아 넣어 세상에 복수하려 합니다. 이 무기는 오직 \"Fury\"라는 이름으로만 알려져 있습니다.",
        },
      },
      armor: {
        0: {
          description:
            "놀라울 만큼 튼튼해 보호복으로 사용할 수 있는 재료입니다. 임시방편으로 만든 티가 뚜렷하기 때문에 많은 모험가들은 가능한 빨리 감자 자루를 다른 장비로 바꾸려 합니다.",
        },
        1: {
          description:
            "모험가 가문에서 한 세대에서 다음 세대로 물려 내려온 가보 같은 의복입니다.",
        },
        2: {
          description:
            "야생에서의 생존을 견디도록 튼튼한 천으로 만든 튜닉입니다. 어떤 전통에서는 단체가 자격을 인정한 모험가에게 튜닉을 선물하기도 합니다.",
        },
        3: {
          description:
            "여행하는 모험가들이 흔히 선택하는 가죽 갑옷입니다. 가죽 조끼를 입는 유행은 Yggdrasil 주변 정글에 위험한 생물들이 숨어들기 시작했을 때 시작되었습니다.",
        },
        4: {
          description:
            "땅에서 발견한 몬스터 비늘로 만든 갑옷입니다. 금속이 부족할 때 몬스터 비늘은 꽤 훌륭한 갑옷 재료로 자주 쓰입니다.",
        },
        5: {
          description:
            "가벼운 엘프 금속으로 만든 신성한 사슬갑옷입니다. 오래된 전설에 따르면 최초의 하늘 사슬갑옷은 신성한 존재들이 입다 버린 갑옷 조각으로 만들어졌다고 합니다.",
        },
        6: {
          description:
            "이 망토는 전투 중 착용자를 감싸는 작은 그림자를 불러내 보호력을 높입니다. 이런 망토는 기묘한 그림자 마법으로 만들고, 비밀스러운 방식으로 연금술적 강화를 거칩니다.",
        },
        7: {
          description:
            "추가 보호력을 부여하기 위해 마법 룬을 새긴 갑옷입니다. 일부 학자들은 모든 Runic Halfplate 갑옷의 룬이 더 크고 아직 발견되지 않은 의식 속에서 서로 반응하도록 설계되었다고 믿습니다.",
        },
        8: {
          description:
            "초자연적인 지옥불을 사용해 만든 갑옷입니다. 몇몇 대장장이가 이 낯선 불꽃으로 제련할 수 있도록, 악마적인 존재들의 요구를 달래기 위한 큰 희생이 치러졌습니다.",
        },
        9: {
          description:
            "고대 전설에 따르면 각 Soulkeeper 갑옷에는 보호력을 강화하기 위해 스스로 희생한 영혼이 깃들어 있습니다. 어려운 시대에는 클랜과 가족의 생존을 위해 큰 희생을 감수한 이들이 있었습니다.",
        },
        10: {
          description:
            "Deathless 갑옷은 제1차 대전쟁 중 치명상을 막기 위해 최초의 왕과 지도자들이 만들었습니다. 전설처럼 그들은 전투에서 죽지 않았지만, 결국 잠든 사이 암살당했고 갑옷은 도난당했습니다. 제련 기술은 세월 속에 사라졌지만, 제작에는 막대한 재산이 필요했음이 분명합니다.",
        },
      },
      glove: {
        0: {
          description:
            "손을 가볍게 보호하고 진동을 줄이는 데 흔히 쓰이는 천입니다.",
        },
        1: {
          description:
            "최고급 엘프 천으로 만든 천 장갑입니다.",
        },
        2: {
          description:
            "질기고 단단하게 가공한 가죽으로 만든 장갑입니다.",
        },
        3: {
          description:
            "몬스터 뼈로 만든 장갑입니다. 몬스터 뼈는 추가 내구성을 제공하며, 때로는 남은 마력을 품고 있기도 합니다.",
        },
        4: {
          description:
            "수십 년 동안 금속을 다뤄 온 장인들이 만든 철제 건틀릿입니다.",
        },
        5: {
          description:
            "마법사 길드는 몬스터 세력에 맞서는 마력을 높이기 위해 이런 실험용 장갑을 자주 만듭니다. 일부 실험용 장갑에는 고대 자료에서 베껴 온 룬이 장식되어 있습니다.",
        },
        6: {
          description:
            "제3차 대전쟁에서 실전 검증을 거친 방어구입니다. 이 장갑은 오래되었지만, 한때는 이런 품질의 방어구가 생존에 필수였습니다.",
        },
        7: {
          description:
            "불의 정령들이 가르친 기술과 방법을 사용해 화염 마법사들이 만든 실험용 장갑입니다.",
        },
        8: {
          description:
            "몬스터 왕들이 이 장갑에 값비싼 강화를 의뢰했습니다. 이 강화는 영토를 두고 벌어진 전투에서 특정 몬스터 세력을 상대로 우위를 얻기 위한 것이었습니다.",
        },
        9: {
          description:
            "산에서 발견되는 특수 금속의 마법적 성질을 유지하기 위해 불이나 열을 쓰지 않고 제련한 방어구입니다. 이런 장갑을 만들려면 마법이 깃든 망치가 필요합니다.",
        },
        10: {
          description:
            "불멸의 고대 종족이 착용하고 거대한 제국을 세웠던 방어구입니다. 그 종족은 갑작스럽고도 신비롭게 사라졌지만, 일부 방어구는 남겨졌습니다.",
        },
        11: {
          description:
            "Phrygian은 전쟁으로 파괴되어 오래전에 사라진 문명이 개발했습니다. 잃어버린 도시의 폐허 대부분에는 환상적인 보물이 있었지만, 이미 오래전에 약탈당했습니다.",
        },
        12: {
          description:
            "Great Barrier가 처음 형성된 뒤 영역을 장악하려 했던 거대한 몬스터 군주들을 쓰러뜨리려면 이런 강력한 방어구가 필요했습니다. Great Barrier는 신에 맞먹는 힘을 지닌 어둡고 잊힌 적들로부터 영역을 지키기 위해 만들어졌습니다.",
        },
      },
      hammer: {
        0: {
          description:
            "농부들이 자주 만들어 쓰는 임시 무기입니다.",
        },
        1: {
          description:
            "원래는 목공용으로 쓰이는 망치입니다. 하지만 자원과 재료가 부족할 때는 필요에 따라 나무 망치도 전투에 쓰입니다.",
        },
        2: {
          description:
            "원시 철퇴는 실전으로 검증되었고 수많은 전설이 덧씌워졌지만, 시간이 흐르며 효율은 떨어졌습니다.",
        },
        3: {
          description:
            "오크가 심문과 전투에 선호하는 도구입니다.",
        },
        4: {
          description:
            "중철퇴는 전쟁, 침투, 위압을 위해 만들어졌습니다.",
        },
        5: {
          description:
            "Iron Basher는 보통 몬스터 Markay'ak 같은 숙련 장인이 만듭니다. 장인들은 자부심의 표시로 거의 항상 철에 자신의 표식을 남깁니다.",
        },
        6: {
          description:
            "이 대형 망치들은 독특한 색과 성질을 지닌 특수 금속으로 만들어집니다. 이 Darkmetal의 비밀은 몬스터 장인들에게서 훔쳐져 널리 퍼졌습니다.",
        },
        7: {
          description:
            "이 의식용 망치들은 교회의 축복을 받았습니다. 신성한 의식용 망치는 이전 소유자의 헌신, 업적, 희생을 통해 힘을 얻기도 합니다.",
        },
        8: {
          description:
            "이런 망치는 Markay'ak 같은 유명 대장장이가 종교적인 몬스터 사제의 도움을 받아 만드는 경우가 많습니다. Hallowed Hammer에는 때때로 신성한 힘이 부여됩니다.",
        },
        9: {
          description:
            "드워프 대형 망치는 광산과 지하에서의 드워프 생활을 견딜 만큼 튼튼하고 강력합니다. 드워프 대장장이들은 망치 제작에 풍부한 경험을 지니고 있습니다.",
        },
        10: {
          description:
            "이 의식용 망치들은 특수 금속으로 만들고 열을 쓰지 않고 제련합니다. 열 없이 제련하는 과정 덕분에 특수 금속의 고유한 성질이 남습니다.",
        },
        11: {
          description:
            "Skullshatterer 망치는 원래 언데드와 싸우기 위해 만들어졌습니다. 남아 있는 망치들은 많은 성직자와 신성한 존재들에게 귀중한 소유물로 여겨집니다.",
        },
        12: {
          description:
            "이 망치들은 제련 과정에서 모루의 머리 부분을 깨뜨리는 것으로 알려져 있습니다. 드물게 만들어지며 보통 상당한 가격에 거래됩니다.",
        },
        13: {
          description:
            "영적인 스승들은 다양한 방식으로 자신의 영성을 전파합니다. 이 망치는 어떤 식으로든 적에게 평화의 선물을 줄 힘을 지녔습니다.",
        },
        14: {
          description:
            "이 망치들은 Great Barrier가 처음 형성된 뒤 거대한 몬스터 군주들이 소유하고 사용했습니다. 이 거인들은 땅을 파괴하고 한동안 영역을 지배했습니다.",
        },
        15: {
          description:
            "역사가들에 따르면 이 망치는 한때 도시를 무너뜨릴 만큼 거대한 지진을 일으켰다고 전해집니다.",
        },
        16: {
          description:
            "고대 전설은 낯선 망치가 Great Barrier의 균열을 지나 영역 안으로 떨어졌다고 말합니다. 이런 망치들은 이 세계의 물건이 아닙니다.",
        },
      },
      book: {
        0: { description: "무기로 자동 근접 공격을 합니다." },
        1: {
          description:
            "적을 베어 강하게 공격하고, 준 피해의 5%만큼 생명력을 회복합니다.",
        },
        2: {
          description:
            "일정 시간 막기 확률이 증가하고, 공격을 막을 때마다 생명력을 회복합니다.",
        },
        3: {
          description:
            "검을 빠르게 휘둘러 주변 범위 안의 적에게 피해를 줍니다.",
        },
        4: {
          description:
            "적에게 냉기 투사체를 발사합니다. Icicle Orb의 재사용 대기시간이 0.5초 감소합니다. 대상에게 최대 5중첩까지 빙결을 부여하며, 5중첩이 되면 대상은 기절하고 받는 피해가 50% 증가합니다. 7초마다 1회 즉시 시전할 수 있습니다.",
        },
        5: { description: "자동으로 원거리의 적을 공격합니다." },
        6: {
          description:
            "아군 대상을 치유합니다. Revitalize 중첩마다 치유량이 증가합니다.",
        },
        7: {
          description:
            "아군 대상을 짧은 시간 동안 지속 치유합니다. 최대 3회 중첩되며 Mend 효과도 강화합니다.",
        },
        8: {
          description:
            "혈통과 가문의 전통으로 특별한 능력을 물려받아, 특정 능력치에서 추가 효과를 얻습니다.",
        },
        9: {
          description:
            "신중히 조준한 고피해 사격입니다. 다음 Swift Shot들의 피해가 증가하고 즉시 시전할 수 있습니다.",
        },
        10: {
          description:
            "활성화 중 Precise Shot이 추가 대상에게 튕겨 나갑니다.",
        },
        11: {
          description:
            "즉시 MP를 회복하고 일시적으로 피해량이 증가합니다.",
        },
        12: {
          description:
            "적에게 부패의 저주를 걸어 즉시 피해와 지속 피해를 줍니다.",
        },
        13: {
          description:
            "자신과 파티원이 짧은 시간 동안 MP를 빠르게 회복합니다.",
        },
        14: {
          description:
            "주변에 차가운 얼음 충격파를 내보내 적에게 피해를 주고 얼립니다. 일부 주문의 치명타 확률이 증가합니다.",
        },
        15: {
          description:
            "큰 구체를 소환해 이동 경로의 모든 적에게 고드름을 발사합니다.",
        },
        16: {
          description:
            "가속을 얻고 모든 피해량이 증가합니다. Icicle Orb의 재사용 대기시간이 초기화됩니다.",
        },
        17: { description: "일시적으로 피해량이 증가합니다." },
        18: {
          description:
            "Crescent Swipe가 적에게 깊은 상처를 남겨 추가 출혈 피해를 줍니다. 최대 3회 중첩됩니다.",
        },
        19: { description: "자신과 파티원의 피해량이 증가합니다." },
        20: {
          description:
            "자신과 파티원이 추가 방어력과 마나 재생을 얻습니다.",
        },
        21: { description: "방어력이 지속적으로 증가합니다." },
        22: {
          description: "자신과 파티원이 추가 치명타 확률을 얻습니다.",
        },
        23: { description: "다가오는 공격들을 막아 줍니다." },
        24: { description: "대상의 피해량을 증가시킵니다." },
        25: { description: "자신과 파티원이 추가 가속을 얻습니다." },
        26: { description: "치명타 확률이 지속적으로 증가합니다." },
        27: { description: "자신과 파티원이 추가 이동 속도를 얻습니다." },
        28: {
          description:
            "자신과 파티원이 가속으로 격앙되어 더 빠르게 공격합니다.",
        },
        29: {
          description:
            "Precise Shot 적중 시 적에게 독 약화 효과를 부여해 지속 피해를 주고 둔화시킵니다.",
        },
        30: { description: "지면에 토템을 설치해 파티 전체를 치유합니다." },
        31: {
          description:
            "Swift Shot을 발사합니다. 이전에 Precise Shot을 사용했다면 강화됩니다.",
        },
        32: { description: "바라보는 방향으로 즉시 순간이동합니다." },
        33: {
          description:
            "대상에게 돌진하고, 적대적 대상이면 기절시킵니다. 돌진 거리가 길수록 기절 시간이 증가합니다.",
        },
        34: {
          description:
            "주변 적을 도발해 짧은 시간 이동 속도를 늦추고, 몬스터가 자신을 공격하게 합니다.",
        },
        35: {
          description:
            "파티원을 소환해 즉시 자신에게 순간이동할 수 있게 합니다.",
        },
        36: {
          description:
            "영혼 동물로 변신해 이동 속도가 증가합니다. 변신 시 걸려 있던 모든 이동 방해 효과가 제거됩니다. 주문을 시전하면 효과가 취소됩니다.",
        },
        37: {
          description:
            "대상을 좀비로 만들어 모든 행동을 방해하고, 이동 속도와 받는 치유량을 감소시킵니다.",
        },
        38: {
          description:
            "현재 바라보는 방향으로 돌진합니다. Precise Shot의 재사용 대기시간이 즉시 초기화되고, 다음 Precise Shot은 즉시 시전됩니다.",
        },
        39: {
          description:
            "지상 탈것을 탈 수 있게 됩니다. 탈것은 계정에 귀속됩니다.",
        },
        40: { description: "가장 가까운 Conjurer에게 순간이동합니다." },
        41: {
          description:
            "시전 2초 후 자신에게 걸린 모든 기절 및 이동 불가 효과가 제거됩니다. 효과가 하나라도 제거되면 Charge의 재사용 대기시간이 초기화되고 3초 동안 이동 속도 20을 얻습니다.",
        },
        42: {
          description:
            "Decay에 걸린 주변 적들의 영혼을 거둬 피해를 주고, 거둔 영혼 하나마다 마나를 얻습니다.",
        },
        43: {
          description:
            "Decay가 피해를 주며, 현재 대상이 이미 Decay에 걸려 있다면 가까운 적에게 옮겨갑니다. 또한 Decay를 시전하면 짧은 시간 가속을 얻습니다.",
        },
        44: { description: "적 아래의 지면에 불을 붙입니다." },
        45: {
          description:
            "전방의 모든 대상에게 짧은 시간 동안 빠르게 화살을 발사해 피해를 줍니다.",
        },
        46: {
          description:
            "짧은 시간 검을 회전시켜 주변 모든 대상에게 피해를 주지만, 자신의 이동 속도가 감소합니다. 사용 시 모든 이동 불가 효과를 제거합니다. 활성화 중에는 공격을 막을 수 없습니다.",
        },
        47: {
          description:
            "아군 대상에게 걸린 부정적인 효과를 제거합니다. 이동 방해 효과를 우선 제거하며, 제거한 효과 하나마다 대상을 치유합니다.",
        },
        48: {
          description:
            "저주받은 화살로 적을 물어뜯고, 돌아오면서 자신을 치유합니다. 대상이 시전 중이었다면 시전을 방해하고 치유량이 증가합니다.",
        },
        49: {
          description:
            "대상을 실명시켜 짧은 시간 이동과 시전을 방해합니다.",
        },
        50: {
          description:
            "적을 위협해 짧은 시간 혼란시키고, 잃은 생명력의 일정 비율을 회복합니다.",
        },
        51: {
          description:
            "대상에게 거대한 서리 파편을 던져 큰 피해를 줍니다. Ice Bolt로 깊게 얼어붙은 대상에게 추가 피해를 줍니다.",
        },
        52: {
          description:
            "지정한 지역에 얼어붙는 폭풍을 집중시켜 범위 안 모든 대상에게 피해를 줍니다.",
        },
        53: {
          description:
            "자신을 보호하는 얼음 방벽을 소환해 모든 피해를 막고, 짧은 시간 생명력을 일정 비율 회복합니다. 이 동안 이동하거나 주문을 시전할 수 없습니다.",
        },
        54: {
          description:
            "대상에게 무거운 대퇴골을 발사해 큰 피해를 줍니다. 생명력이 50% 미만인 대상에게 50% 추가 피해를 줍니다.",
        },
      },
      misc: {
        0: {
          description:
            "붉은 액체가 담긴 물약 병입니다. 마시면 생명력을 회복합니다.",
        },
        1: {
          description:
            "푸른 액체가 담긴 물약 병입니다. 마시면 마나를 회복합니다.",
        },
        2: {
          description:
            "붉은 액체가 담긴 물약 병입니다. 마시면 생명력을 회복합니다.",
        },
        3: {
          description:
            "푸른 액체가 담긴 물약 병입니다. 마시면 마나를 회복합니다.",
        },
        4: {
          description:
            "붉은 액체가 담긴 물약 병입니다. 마시면 생명력을 회복합니다.",
        },
        5: {
          description:
            "푸른 액체가 담긴 물약 병입니다. 마시면 마나를 회복합니다.",
        },
      },
      material: {
        0: {
          description:
            "Gloomy Undead의 섬뜩한 손길로 표시된 두개골입니다.",
        },
        1: {
          description:
            "Gloomy Undead에게서 얻은 부서지기 쉬운 잔해입니다.",
        },
        2: {
          description:
            "Gloomy Undead의 갑옷 잔재인 검게 물든 가시입니다.",
        },
        3: {
          description:
            "Moonlake Fanatic의 유물이라고 속삭여지는 수수께끼의 두개골입니다.",
        },
        4: {
          description:
            "Moonlake Fanatic의 신비한 의식으로 잿빛이 된 손입니다.",
        },
        5: {
          description:
            "Moonlake의 정수가 깃든, 광신도들이 착용하던 가면입니다.",
        },
        6: {
          description:
            "이끼를 사랑하기로 악명 높은 오크에게서 얻은 커다란 엄지입니다.",
        },
        7: {
          description:
            "오크의 튼튼한 체격을 이루는 단단한 뼈입니다.",
        },
        8: {
          description:
            "평범한 도적들 사이에서도 두려움의 대상인 사나운 Raider에게서 얻은 단단한 두개골입니다.",
        },
        9: {
          description:
            "나이 든 Raider 야영지에서 자주 발견되는 거친 회색 털입니다.",
        },
        10: {
          description:
            "Raider 우두머리들이 흔히 전리품으로 삼는 튼튼한 어금니입니다.",
        },
        11: {
          description:
            "강력한 Moose가 떨어뜨린 웅장한 뿔입니다.",
        },
        12: {
          description:
            "떠도는 Moose의 발걸음을 떠올리게 하는 질긴 발굽입니다.",
        },
        13: {
          description:
            "혹독한 기후에서 식량이 되는 Moose의 풍부한 고기입니다.",
        },
        14: {
          description:
            "잔잔한 해변에서 발견되는 Sandsnap Turtle의 튼튼한 두개골입니다.",
        },
        15: {
          description:
            "포착하기 어려운 Sandsnap Turtle에게서 얻은, 가시로 뒤덮인 꼬리입니다.",
        },
        16: {
          description:
            "포식자로부터 몸을 지켜 주는 Sandsnap Turtle의 튼튼한 등껍질입니다.",
        },
        17: {
          description:
            "치명적인 턱을 보여 주는 Sandsnap Crocodile의 두개골입니다.",
        },
        18: {
          description:
            "강인함으로 빛나는 Sandsnap Crocodile의 질긴 비늘입니다.",
        },
        19: {
          description:
            "해변을 따라 Sandsnap Crocodile이 조심스럽게 지키는 희귀한 알입니다.",
        },
        20: {
          description:
            "맛으로 귀하게 여겨지는 Sandsnap Crocodile의 풍미 있는 고기입니다.",
        },
        21: {
          description:
            "해변 탐험가들이 별미로 여기는 Sandsnap Turtle의 맛있는 고기입니다.",
        },
        22: {
          description:
            "숲에 숨어 있는 Overgrown Tarantula에게서 얻은 단단해진 키틴질입니다.",
        },
        23: {
          description:
            "독이 뚝뚝 떨어지는 Tarantula의 치명적인 송곳니입니다.",
        },
        24: {
          description:
            "고대 소나무 안에서 수세기에 걸쳐 형성되고 Moose가 지키는 신비한 호박입니다.",
        },
        25: {
          description:
            "어둠의 마법으로 맥동하는 Tarantula의 심장입니다.",
        },
        26: {
          description:
            "어둠에 깊이 물든 Raven의 그림자 날개입니다.",
        },
        27: {
          description:
            "Raven의 둥지 안에 자리한 정체 모를 알입니다.",
        },
        28: {
          description:
            "밤처럼 어두운 Raven의 매끄러운 깃털입니다.",
        },
        29: {
          description:
            "섬뜩한 의식에 쓰이는 Raven의 날카로운 발톱입니다.",
        },
        30: {
          description:
            "야생의 울음소리가 메아리치는 Whispermane Wolf의 두개골입니다.",
        },
        31: {
          description:
            "어둠의 마법사들이 탐내는 Raven의 희귀한 두개골입니다.",
        },
        32: {
          description:
            "따뜻함과 보호를 제공하는 Wolf의 두꺼운 가죽입니다.",
        },
        33: {
          description:
            "비할 데 없는 내구성을 제공하는 Bear의 두꺼운 가죽입니다.",
        },
        34: {
          description:
            "용감한 사냥꾼들이 잡은 Wolf의 든든한 고기입니다.",
        },
        35: {
          description:
            "압도적인 힘을 상징하는 Bear의 위협적인 두개골입니다.",
        },
        36: {
          description:
            "사냥꾼의 전리품인 Bear의 풍부하고 부드러운 고기입니다.",
        },
        37: {
          description:
            "뼈를 부술 수 있는 Bear의 강력한 앞발입니다.",
        },
        38: {
          description:
            "사냥의 전율이 서린 Wolf의 날카로운 송곳니입니다.",
        },
        39: {
          description:
            "인내와 힘을 상징하는 고대 Oak의 생기 있는 잎입니다.",
        },
      },
      orb: {
        0: {
          description:
            "이 쥐 두개골은 초보 마법사에게 유용한 도구입니다. 마법사들은 집중용 매개체를 만들기 위해 오래전에 죽은 생물의 뼈로 실험하기도 합니다.",
        },
        1: {
          description:
            "이 구체들은 다양한 마법 작업에 사용됩니다. 마법 사용자들에게는 고전적인 도구입니다.",
        },
        2: {
          description:
            "이 돌 안에 깃든 마법은 현자들이 점술이나 예지 활동 중 자신을 보호할 수 있게 해 줍니다.",
        },
        3: {
          description:
            "불멸과 변환에 관한 소문은 마법 사용자들이 이런 돌을 실험하고 만들도록 자극했습니다. 실험 결과가 원래 의도에는 미치지 못했지만, 이 구체들은 마력을 강화하는 데 유용해졌습니다.",
        },
        4: {
          description:
            "쉽게 마법을 부여할 수 있는 훌륭한 마법 재료입니다. 이런 유용한 물건은 타고난 힘을 지닌 경우가 많으며, 상인들의 교역 화물에서 자주 발견됩니다.",
        },
        5: {
          description:
            "원소를 제어하고 적의 마음에 공포를 심는 데 자주 쓰이는 강력한 마법 물체입니다. 몬스터 세력 출신의 전설적인 마법 사용자 Nüwa가 이런 물건을 많이 만들었습니다.",
        },
        6: {
          description:
            "이런 물체는 운석으로 만들어졌고 한때 성스러운 상징으로 잘못 사용되었습니다. 이제는 성스러운 상징으로 쓰이지 않지만, Baetylus's Eye는 상당한 마력을 발산합니다.",
        },
        7: {
          description:
            "Benben Stone은 멸망한 고대 종족이 세운 피라미드 꼭대기에 놓였습니다. 이 돌은 수천 년 동안 태양 에너지를 흡수했으며, 그 힘은 태양신의 선물이라고 전해졌습니다.",
        },
        8: {
          description:
            "이런 고대 뱀 돌은 오래된 폐허 속 잊힌 제단에서 발견되었습니다. 학자들은 이 돌이 뱀 신을 숭배하는 데 쓰였을 것으로 보지만, 폐허에서 발견된 문서는 아직 해독되지 않았습니다.",
        },
        9: {
          description:
            "리치의 성물함에는 강력한 언데드 생물의 영혼이 담겨 있습니다. 오래된 성물함에는 착용자와 그 안의 영혼을 보호하는 강력한 마법이 함께 깃들어 있습니다.",
        },
      },
      quiver: {
        0: {
          description:
            "착용감을 높이기 위해 엘프산 리넨으로 만든 대량 생산 화살통입니다.",
        },
        1: {
          description:
            "투박한 화살통은 믿을 만하며 전투에서 검증된 장비입니다. 견습 궁수들이 성장하는 과정에서 물려받는 경우가 많습니다.",
        },
        2: {
          description:
            "특별한 몬스터의 뱀 비늘로 만든 화살통입니다. 보통 거대한 뱀이 허물을 벗은 뒤 남은 껍질에서 얻으며, 다른 방식으로 채집하려면 큰 위험을 감수해야 합니다.",
        },
        3: {
          description:
            "Markay'ak의 뛰어난 장인 정신이 Reinforced Exemplar를 탄생시켰습니다. 이런 화살통은 전문 궁수의 자부심을 보여 주는 증표로 여겨집니다.",
        },
        4: {
          description:
            "고대 종족의 불멸자가 세상에 복수를 실현하기 위해 인간을 초월한 힘을 담아 만든 화살통입니다.",
        },
        5: {
          description:
            "땅에서 발견된 드래곤 비늘로 만든 화살통입니다. 드래곤 비늘은 다루기 매우 어려운 제작 재료라 최고의 장인만 사용할 수 있습니다.",
        },
        6: {
          description:
            "Lotharien은 전쟁으로 사라진 민족의 이름을 딴 화살통입니다. Lotharien 사람들은 이 화살통을 사용하며 세력 확장을 위해 주변 영토와 싸웠습니다.",
        },
        7: {
          description:
            "자연의 정령들이 빼앗긴 힘과 영토, 존중을 되찾기 위해 숲이 내린 선물 같은 화살통입니다.",
        },
        8: {
          description:
            "Vodhrai는 복수, 분노, 격노, 결의의 화신입니다. 이 살아 있는 화살통에서 흘러나오는 유난히 강한 감정은 사용자를 타락시킬 수도 있습니다.",
        },
        9: {
          description:
            "이 화살통은 한때 문명 전체의 폐허 근처에서 발견되었습니다. 그 시대 이 지역의 화살통에 관한 기록은 남아 있지 않습니다.",
        },
      },
      ring: {
        0: {
          description:
            "이 기묘한 고리는 착용자의 생명 정수 일부를 저장할 수 있게 해 줍니다.",
        },
        1: {
          description:
            "철처럼 단단한 특수 목재로 만든 반지입니다. Ironbark는 금속의 대체재로 자주 사용됩니다.",
        },
        2: {
          description:
            "왕실 결혼으로 결합된 두 왕국은 새 동맹국의 상징으로 군대에 이 반지를 착용하게 했습니다.",
        },
        3: {
          description:
            "몬스터 껍질의 뼈로 만든 반지입니다. 다른 자원이 없을 때 몬스터 뼈는 튼튼한 재료로 사용할 수 있습니다.",
        },
        4: {
          description:
            "엘프 전통에서는 반지를 한 세대에서 다음 세대로 물려주는 일이 흔합니다.",
        },
        5: {
          description:
            "이 반지의 안쪽 띠에는 작은 룬이 새겨져 있습니다. 일부 역사가들은 이 반지가 사라진 왕국이 백성을 질병으로부터 지키기 위해 마지막으로 기울인 노력의 결과라고 믿습니다.",
        },
        6: {
          description:
            "Arcane Ring은 중급 마법사들의 마법 실험 결과물입니다. 일부 반지는 주문 시전 능력을 크게 높이도록 제작되고 마법이 부여됩니다.",
        },
        7: {
          description:
            "이 반지들은 한때 거미를 타고 다닌 최초의 무리 중 하나였던 도적단, \"Cult of the Emerald Spiders\"의 소유물이었습니다.",
        },
        8: {
          description:
            "Infernal Ring은 악마적인 존재들이 건네는 선물입니다. 착용자가 더 큰 힘을 갈망하도록 유혹하며, 그 갈망은 더 많은 악마들의 위험한 제안으로 이어지는 경우가 많습니다.",
        },
        9: {
          description:
            "자연 정령들은 원시 몬스터에게 감사의 선물로 이 반지를 주었습니다. 수천 년 동안 많은 반지가 도난당하거나 사라졌습니다.",
        },
        10: {
          description:
            "많은 종교 세력은 이 반지를 낀 사람이 신의 총애를 받는다고 주장하지만, 어느 신인지는 알려져 있지 않습니다. 여러 종교 지도자들은 이 신성한 익명성이 의도된 것이라고 믿습니다.",
        },
        11: {
          description:
            "고대 두루마리는 이 전설적인 반지가 착용자를 거의 무적에 가깝게 만든다고 기록합니다. 또한 착용자가 타락하고 깊은 불행에 빠졌다는 이야기들도 함께 언급합니다.",
        },
        12: {
          description:
            "한 시대에 한 번 Peacekeeper가 발견되어 착용자를 영역의 특별한 수호자로 표시합니다. 과거의 한 시대에는 Peacekeeper의 소유자가 실패했고, 그 결과 제3차 대전쟁이 시작되었습니다.",
        },
      },
      rune: {
        0: {
          description:
            "광산에서 흔히 발견되는 납작한 재료입니다. 몬스터들은 경제를 유지하기 위해 Lucid를 채굴하곤 합니다.",
        },
        1: {
          description:
            "Melant의 곡선은 글자나 상징처럼 보입니다. 대장장이들은 이런 자연적인 형태가 강력한 내부 구조를 드러낸다고 믿습니다.",
        },
        2: {
          description:
            "이 유용한 재료는 거대한 화산과 그 주변 지역에서 유래했습니다. Turim은 한때 대상들 사이에서 자주 거래되었습니다.",
        },
        3: {
          description:
            "이 튼튼한 재료는 대장장이들이 \"쓸모없는 Fundo\"를 실험하던 중 최근 업그레이드에 유용하다는 사실이 밝혀졌습니다. 그 이후 Fundo는 귀중한 자원으로 여겨지고 있습니다.",
        },
        4: {
          description:
            "Amari는 해외 왕국에서 선물로 주어지는 경우가 많습니다. 학자들은 바다 생물 종족이 여러 지상 왕국과 처음 접촉하며 해저에서 Amari를 가져왔을 때 처음 발견되었다고 말합니다.",
        },
        5: {
          description:
            "금으로 오해받는 일이 많은 이 재료는 한때 드래곤 비늘과 같은 물질로 여겨졌습니다. 많은 고대 장식품과 무기가 Purum으로 장식되어 있습니다.",
        },
        6: {
          description:
            "Royal은 왕과 여왕이 정략 결혼 때 의식용 선물로 사용하기 위해 소유하고 수집하는 경우가 많습니다.",
        },
        7: {
          description:
            "이 형성물은 세계수 Yggdrasil 근처에서 가장 자주 자연적으로 생겨납니다. Tara의 아름다움과 희귀한 힘은 보석 가보와 아이템 업그레이드 재료 양쪽에 모두 잘 어울립니다.",
        },
        8: {
          description:
            "Gloom의 힘으로 장비를 강화하는 비밀 방법이 발견되자, 그 방법은 곧 적대 왕국에 팔려 넘어갔습니다. 이는 영역 역사상 가장 큰 배신 중 하나로 기록됩니다.",
        },
        9: {
          description:
            "Plurae의 특이한 결정 성질은 이를 뛰어난 재료로 만듭니다. Plurae는 잊힌 세계의 깊은 곳에서 최근에야 재발견되었지만, 이미 전쟁의 흐름을 바꾸는 데 큰 역할을 하고 있습니다.",
        },
        10: {
          description:
            "Aeter는 과거의 왕과 여왕에게 신들이 내린 선물로 여겨졌지만, 기록된 역사에 따르면 Aeter는 검은 운석 안에서 발견되었습니다.",
        },
      },
      shield: {
        0: {
          description:
            "필요에 의해 만들어진 것으로 보이는 임시 방패입니다.",
        },
        1: {
          description:
            "버클러는 작고 가벼운 무기를 막는 데 유용합니다. 해적들은 기동성을 위해 버클러를 자주 사용합니다.",
        },
        2: {
          description:
            "전시 중에 자주 만들어지는 형태의 방패입니다. 값은 싸지만 튼튼한 Ironbark로 만들어졌습니다.",
        },
        3: {
          description:
            "왕국의 보초병들은 받는 피해를 줄이고 시민을 보호하기 위해 이런 방패를 자주 사용합니다.",
        },
        4: {
          description:
            "Darkmetal로 만들고 검은 기름을 바른 방패입니다. 이런 방패를 가진 모험가는 다른 이들 사이에서 단연 눈에 띕니다.",
        },
        5: {
          description:
            "Spiked Warshield는 전투에서 튼튼하며 오크 문화에 잘 어울립니다. 노련한 오크 전사들은 방패 옆면에 승리의 표시를 새깁니다.",
        },
        6: {
          description:
            "성기사는 일정 수준의 영적 헌신에 도달했을 때 이 방패를 얻습니다. 하지만 이런 성기사 방패가 주인 없이 발견되는 일도 있습니다...",
        },
        7: {
          description:
            "이 방패는 필멸자가 Underworld에서만 발견되는 얼음으로 만든 것입니다. 강력한 방패이긴 하지만, Underworld Ice의 특이한 성질과 희귀성 때문에 필멸자가 이를 재현하려는 시도는 잘해도 불완전합니다.",
        },
        8: {
          description:
            "이 신성한 방패는 전설과 소문에 둘러싸여 있습니다. 한 고대 두루마리는 이 방패가 사용자의 가짜 분신을 만들어 상대를 혼란시켰다고 말합니다. 또 다른 두루마리는 이 방패가 신이 들었던 바로 그 방패를 본떠 만들어졌다고 설명합니다.",
        },
        9: {
          description:
            "이 방패의 신성한 그림은 살아 움직이며, 자격 있는 사용자에게 놀라운 힘을 부여할 수 있습니다. 일부 관찰자들은 깜빡이는 눈을 통해 신비롭고 신성한 화가가 세상을 바라본다고 믿습니다.",
        },
      },
      staff: {
        0: {
          description:
            "막대기와 부러진 나뭇가지는 견습 마법사의 교육용으로 사용됩니다.",
        },
        1: {
          description:
            "손상되었지만 초보 마법 사용자에게는 아직 쓸모가 있는 전투 지팡이입니다.",
        },
        2: {
          description:
            "가장 오래된 나무 일부가 Gnarled Broomstick을 만드는 데 쓰입니다. 이 무기들은 적을 전장에서 쓸어내는 주문을 만들어 냅니다.",
        },
        3: {
          description:
            "중급 마법을 시전하기 위한 튼튼한 참나무 무기입니다.",
        },
        4: {
          description:
            "마력을 강화하는 낯선 파편이 박힌, 신비술사들이 선물한 지팡이입니다.",
        },
        5: {
          description:
            "몬스터 마법사의 뼈로 만들어 마력을 강화합니다.",
        },
        6: {
          description:
            "마력을 저장하는 보석들이 박힌 마법 막대입니다.",
        },
        7: {
          description:
            "이 지팡이에 새겨진 룬은 주문을 시전할 때 희미하게 빛납니다. 여러 마법사 길드가 룬이 주문 시전을 강화한다고 믿지만, 룬의 진정한 본질은 알려져 있지 않습니다.",
        },
        8: {
          description:
            "이 지팡이는 마법이 부여된 돌을 사용해 마법 에너지를 전달하고 집중합니다. 특별한 에메랄드를 찾는 과정과 값비싼 마법 부여 과정 때문에 제작이 다소 어렵습니다.",
        },
        9: {
          description:
            "Dragonwood로 만든 지팡이이며, 원래 드래곤이 선물한 돌을 사용합니다. 돌에 남은 드래곤의 힘이 마법의 위력을 한층 강화합니다.",
        },
        10: {
          description:
            "Frozen Greatstaff는 Underworld에서만 발견되는 얼음으로 필멸자가 만든 것입니다. 제작 방식은 완전하지 않지만, 결과물은 여전히 상당히 강력할 수 있습니다.",
        },
        11: {
          description:
            "이 지팡이는 Underworld Flames를 사용한 마법 담금질을 거친 Underwood로 만들어졌습니다. 지팡이가 필멸자의 손으로 만들어진 것은 분명하지만, Underworld Flames를 얻는 방법은 세월 속에 사라진 비밀인 듯합니다.",
        },
        12: {
          description:
            "Hellfire Greatstaff는 장난기 많은 악마들이 제공한 지옥불로 제작됩니다. 이런 지팡이를 만드는 과정은 신비에 싸여 있지만, 관련된 악마들이 요구하는 대가는 결코 모호하지 않습니다.",
        },
        13: {
          description:
            "이런 지팡이는 고대 문헌을 바탕으로 만들어졌습니다. 제작 과정의 일부로 수백 명의 독실한 존재가 특정 신들에게 지팡이의 축복을 청해야 합니다.",
        },
        14: {
          description:
            "이 기묘한 지팡이는 자연 속 거친 마법을 강화하기 위해 Realm of Madness의 수정을 사용합니다. 수정은 이 지팡이의 핵심 구성 요소입니다.",
        },
        15: {
          description:
            "늙은 마녀의 심장이 이 지팡이의 마법을 움직입니다. 금지된 힘이 뛰는 심장을 되살렸고, 그 때문에 이 지팡이는 언데드를 상징하는 존재가 되었습니다.",
        },
        16: {
          description:
            "Deathweaver는 Great Barrier의 창조를 견뎌 낸 유물입니다. 이 낯선 지팡이들은 이 세계의 물건이 아닙니다.",
        },
      },
      sword: {
        0: {
          description:
            "이 검들은 보통 Ironbark로 만들어져 일반 목재보다 오래 버팁니다.",
        },
        1: {
          description:
            "이런 검은 많은 전투를 거친 뒤 전사에게서 견습생에게 물려지는 경우가 많습니다.",
        },
        2: {
          description:
            "트롤과 그 부족이 휘두르는 훌륭한 무기입니다. 트롤은 자신의 영토를 넓히거나 침입자를 밀어내기 위해 주변 영토를 자주 공격합니다.",
        },
        3: {
          description:
            "브로드소드는 전장의 병사와 전사들이 사용하는 표준 무기입니다.",
        },
        4: {
          description:
            "롱소드는 긴 칼날보다 긴 손잡이로 주로 구분됩니다. 도검 장인들은 다양한 재료와 숙련도를 사용해 매우 다양한 결과물을 만들어 왔습니다.",
        },
        5: {
          description:
            "전투용으로 설계된 이 무기는 Colosseum 안에서 기대한 만큼의 성능을 냅니다.",
        },
        6: {
          description:
            "이 거대한 검은 전쟁에서 피해 잠재력을 높이기 위해 특별히 설계되었습니다. 이런 무기를 착용하거나 사용하는 모험가는 자신의 목표와 직업을 분명히 드러냅니다.",
        },
        7: {
          description:
            "몰락한 왕국의 기사들이 한때 사용했던 무기입니다. 거대한 전쟁으로 지형에서 사라지기 전까지 강력한 왕국들이 존재했으며, 이 대검을 휘두른 기사들은 왕국이 먼지가 된 뒤에도 기사도의 의무를 지켰습니다.",
        },
        8: {
          description:
            "언데드 몬스터들이 제작한 검입니다. 이런 무기를 만들어 내는 부자연스러운 제작 기술은 아직 알려져 있지 않습니다.",
        },
        9: {
          description:
            "Nullfire Sword는 Underworld에서만 발견되는 얼음으로 필멸자가 만든 검입니다. 원래 이런 검은 제1차 대전쟁 중 악마와 마족에 맞서기 위해 만들어졌지만, 불완전한 공정으로 제작되어 그들을 완전히 몰아내지는 못했습니다.",
        },
        10: {
          description:
            "전쟁이 끊이지 않는 영역에서 왕족들은 개인용으로 돈으로 살 수 있는 최고의 검 중 하나를 만들기 위해 막대한 금을 쓰곤 합니다. 안타깝게도 이런 순백의 검만으로는 침략군이 왕국을 집어삼키는 것을 막을 수 없습니다.",
        },
        11: {
          description:
            "비밀스러운 망령 몬스터 집단이 필멸자에게 준 무기입니다. 이 \"선물\"은 훗날 마법적 타락을 통해 필멸자의 행보를 조종하려는 수단이었다는 사실이 밝혀졌습니다. 그 거대한 계획은 실패한 듯하지만, 강력한 검은 여전히 발견됩니다.",
        },
        12: {
          description:
            "많은 학자들은 이 무기가 고대의 강력한 종족을 파괴하기 위해 만들어졌다고 말하지만, 제작자도 그 적들도 남아 있지 않습니다.",
        },
        13: {
          description:
            "이 무기는 말 그대로 몬스터입니다. 이 생물들은 사용자와 결속해 전투 노출을 늘리고, 그만큼 먹이를 취하고 자신을 유지할 기회를 더 많이 얻습니다.",
        },
        14: {
          description:
            "Demonedge는 제1차 대전쟁을 일으킨 악마와 마족들이 영역 안으로 들여온 무기입니다. 이 무기들은 지옥불로 제련되었으며 필멸자의 손으로 만들어진 것이 아닙니다.",
        },
        15: {
          description:
            "역사상 가장 신성한 전사와 헌신적인 성기사들 중 일부가 이런 무기를 사용했습니다. 그 소유자들의 이름에 덧씌워진 전설은 세대를 넘어 전사와 왕들에게 영감과 동기를 주었습니다.",
        },
        16: {
          description:
            "이 무기는 발견될 때마다 거의 항상 불길한 징조이자 파멸의 전조로 여겨집니다. 일부 학자들은 이 무기가 장벽의 균열을 통해 떨어졌으며 영역 밖에서만 만들어질 수 있다고 믿습니다.",
        },
      },
      totem: {
        0: {
          description:
            "이 깃털은 근처에서 잠든 이들의 꿈과 악몽을 흡수합니다. 흡수한 꿈과 악몽은 마법의 형태로 저장되어 다시 사용됩니다.",
        },
        1: {
          description:
            "이 인형에 묶인 초자연적 존재가 사용자가 활용할 수 있는 마력을 공급합니다.",
        },
        2: { description: "자연에서 비롯된 마법을 발산하는 그릇입니다." },
        3: {
          description:
            "이 구슬들은 성스러운 사제들이 신성한 힘을 저장하고 축복을 세기 위한 수단으로 지니고 다녔습니다. 각 구슬 안에는 아직도 신성한 힘이 일부 남아 있습니다.",
        },
        4: {
          description:
            "패배한 성전사들이 신성한 임무에 실패하면 선한 편을 돕기 위해 이런 개인 토템에 영적인 헌신을 쏟아붓습니다.",
        },
        5: {
          description:
            "한때 Tiger's Teeth의 황제와 여제들이 소유했던 많은 마법 귀뚜라미 중 하나입니다. 암살을 막기 위해, 마법 귀뚜라미는 그것을 지닌 왕족의 초자연적인 힘을 강화했습니다.",
        },
        6: {
          description:
            "초자연적 존재들이 원치 않게 함께 묶여 있는 감옥입니다. 그들은 부자연스러운 웃음으로 상당한 마력을 만들어 냅니다.",
        },
        7: {
          description:
            "초자연적인 정신들의 집합체가 마력을 집중해 토템 사용자에게 부여합니다. Hive Mind는 모든 생물이 자신의 힘에 복종해야 한다고 믿으며, 사용자가 자신들에게 합류하도록 설득하려 합니다.",
        },
        8: {
          description:
            "초자연적 생물의 화신입니다. 일부 학자들은 Nganga's Serpent가 위대한 일을 위해 선택받고 자격을 인정받은 이들에게 주어진다고 말하지만, 다른 학자들은 이것 역시 신들이 필멸자를 통제하고 조종하려는 또 다른 수단이라고 봅니다.",
        },
        9: {
          description:
            "이 고대의 뼈들은 잊힌 몬스터 신의 작은 조각이라고 전해집니다. 뼈에서는 상상을 초월하는 힘이 흘러나옵니다.",
        },
      },
      box: {
        0: {
          description:
            "Faivel의 미탐험 지역에서 운송된 상자입니다. 열기 전까지 이 상자 안의 내용물은 확인할 수 없습니다.",
        },
        1: {
          description:
            "계정에 유용한 추가 기능을 부여하는 마법의 푸른 엘릭서 물약입니다.",
        },
        2: {
          description:
            "대장장이가 희귀 펫에게 배낭을 장착할 수 있게 해 줍니다. 펫이 아이템을 대신 주울 수 있게 됩니다.",
        },
      },
      charm: {
        0: {
          name: "작은 종",
          description:
            "종은 선택한 신에게 바치는 헌신의 상징으로 자주 쓰입니다. 이 종 안쪽에는 은으로 새긴 글귀가 있지만, 그 해석은 세월 속에 사라졌습니다.",
        },
        1: {
          name: "굳어진 알",
          description:
            "화석화된 몬스터 알은 장수의 상징으로 해석되는 경우가 많습니다. 하지만 이 생물들에 대한 기록은 최근 시대 이전에는 남아 있지 않습니다.",
        },
        2: {
          name: "문신 새겨진 두개골",
          description:
            "오크 부족은 존경의 표시로 강한 적의 두개골을 보관하곤 합니다. 이 두개골에는 생전 그 적이 지녔던 힘을 상징하는 문신이 새겨져 있습니다.",
        },
        3: {
          name: "함선 깃발",
          description:
            "전함 꼭대기에 게양된 깃발은 pennant라 불렸습니다. 이 선박 깃발은 Headless Landing에 처음 도착한 난파 전함들 중 하나에서 나온 것입니다.",
        },
        4: {
          name: "푸른 구슬",
          description:
            "마나가 부족하던 시기에 마법사들은 마나를 얻는 대체 수단을 만들었습니다. 이 구슬은 마나 네트워크가 극심한 압박을 받던 Arcane Crisis 시기에 만들어졌습니다.",
        },
        5: {
          name: "진홍 칼날",
          description:
            "Crimson Volcano의 녹아내린 심장에서 벼려진 이 도끼날은 적들이 앞에 쓰러져야만 만족하던 전사의 이야기를 속삭입니다.",
        },
        6: {
          name: "갈퀴손아귀",
          description:
            "한밤중, Emdells의 발톱은 그림자조차 따라잡기 힘들 만큼 빠르게 내리쳤다고 전해집니다.",
        },
        7: {
          name: "피의 의식",
          description:
            "Red Lion이 홀로 무리에 맞섰던 것처럼, 정수가 줄어들수록 결의는 굳어지고 공격은 더 깊어질 것입니다.",
        },
        8: {
          name: "개구리 허파",
          description:
            "전설은 파도 아래에서도 숨 쉬기를 감행한 개구리 Dehnu를 속삭입니다. 그는 물에 잠기는 어둠에 맞서는 같은 저항의 힘을 여행자들에게 나누어 주었습니다.",
        },
        9: {
          name: "숲의 장막",
          description:
            "숨겨진 숲 빈터의 수호 정령 Jylia는 속삭이는 숲에서 안식처를 찾는 이들을 감싸지만, 움직임은 그들의 존재를 드러냅니다.",
        },
        10: {
          name: "요정 버섯",
          description:
            "Dhiwy의 마법에 닿은 이 버섯들은 용감한 이들을, 고대 별빛 아래 밤에 속삭이는 이야기만큼 작은 크기로 줄입니다.",
        },
        11: {
          name: "유령 촛불",
          description:
            "한 유명한 연금술사는 촛불을 복제하던 중 자신의 의지대로 시간을 휘게 하는 방법을 발견했고, 눈 깜짝할 사이에 주문을 시전할 수 있게 되었습니다.",
        },
        12: {
          name: "가시 방패",
          description:
            "Aurum Wraiths가 벼려낸 이 방패는 감히 공격하는 자에게 되받아치며, 꺾이지 않는 용기의 증거가 됩니다.",
        },
        13: {
          name: "오크 두개골",
          description:
            "이야기도 신화도 아닙니다. 그저 오크의 정신을 몸에 담고, 사나운 자들만 이끼 냄새를 맡는 곳을 자유롭게 누비려는 순수한 의지입니다.",
        },
        14: {
          name: "위험추구자의 도박",
          description:
            "전설적인 행운의 추구자가 한때 운명 그 자체와 도박을 벌였듯, 보유한 재물도 행운과 풍요로 바뀌어 대담한 이들에게 숨겨진 보물을 드러낼 수 있습니다.",
        },
      },
      pet: {
        0: { description: "아이템을 대신 주워 주는 작은 애벌레입니다." },
        1: { description: "아이템을 대신 주워 주는 작은 고블린입니다." },
      },
    },
    npcs: {
      trader: {
        interactions: {
          0: {
            text: "이 근방 최고의 물건을 보러 오셨군요! 제가 드리는 거래보다 나은 조건은 찾기 어려울 겁니다. 다만, 제가 본 적 없는 환상적인 아이템을 파는 특별한 상점이 있다는 소문도 들었습니다. 그건 그렇고, 지금은 여분의 코인과 물건이 좀 있습니다. 팔고 싶은 물건이 있습니까?",
            choices: {
              0: "물건을 보여 주세요.",
            },
          },
        },
        info: "아이템을 판매하려면 Shift+우클릭하거나 상인 창으로 드래그하세요.",
        buy: "관심 있는 물건이 있습니까? 구입하려면 아이템을 클릭하세요.",
      },
      merchant: {
        interactions: {
          0: {
            text: "자, 여기 누가 왔나 보군! 음, 그 장비로는 부족하지 않겠어? 공개 시장을 한번 둘러봐! 소문으로는 친구를 네 위치로 순간이동시킬 수 있는 Warcry Scrolls가 있다고 하더군. 이 이야기는 우리끼리만 알고 있자고, 알겠지?",
          },
        },
      },
      blacksmith: {
        interactions: {
          0: {
            text: "Blacksmith's Blessed Hammer 같은 특별한 아이템이 없으면 업그레이드는 위험합니다. 이 망치는 업그레이드 중 아이템이 파괴되는 것을 막아 줄 수 있죠. 망치가 없다면 위험을 감수해야 합니다. 자, 오늘 제가 업그레이드해 드릴 물건이 있습니까?",
          },
        },
      },
      conjurer: {
        interactions: {
          0: {
            text: "최근 발견된 Crystal Shards에 대해 들어 보셨습니까? 모험가들은 그것을 사용해 먼 영역으로 바로 이동할 수 있습니다. 제게 Crystal Shards는 없지만, 이 연결점에는 신비한 힘이 모여 있어 몇몇 장소로는 보내 드릴 수 있습니다. 어느 영역으로 가시겠습니까?",
            choices: {
              0: "$1로 순간이동합니다.",
            },
          },
        },
        notAvailable: "아직 사용할 수 없습니다.",
      },
      stash: {
        interactions: {
          0: {
            text: "네, 저는 말하는 상자입니다. 이미 질문이 입가에 맴도는 게 보이는군요. 오랜 세월 왕족을 섬기며 값을 매길 수 없는 보석과 장신구를 보관했건만, 이제는 이런 지저분한 야영지에 놓여 손님의 소소한 필요를 챙기게 됐습니다. 어쨌든, 제 서비스를 이용하시겠습니까?",
            choices: {
              0: "네, 제 보관함을 열어 주세요.",
            },
          },
        },
      },
      sage: {
        interactions: {
          0: {
            text: "생각이 가득한 마음은 수많은 견해로 무겁지요. 비어 있는 잔이야말로 쓸모를 찾는 법입니다. 깨달음의 길에서 무엇을 도와드릴까요?",
            choices: {
              0: "스탯 포인트 초기화 ( $g$1 ).",
            },
          },
        },
      },
    },
    ui: {
      charmenu: {
        create: {
          selectFaction: "진영 선택",
          nameReq:
            "이름은 공백 없이 a-Z와 0-9만 사용할 수 있으며, 3~16자여야 합니다.",
          pressIcon: "간단한 설명을 보려면 아이콘을 누르세요.",
        },
        select: {
          create: "캐릭터 만들기",
          enterWorld: "세계 입장",
        },
        delete: {
          info: "삭제하려면 캐릭터 이름을 입력하세요. 삭제된 캐릭터는 복구할 수 없습니다.",
          placeholder: "정말 삭제하시겠습니까?",
        },
      },
      charpanel: {
        faction: "진영",
        perday: "하루당",
      },
      clan: {
        application: "가입 요청",
        createtag: "클랜 태그",
        invited: {
          0: "",
          1: " 초대됨",
        },
        memberdesc:
          "현재 클랜에 소속된 멤버 목록입니다. 멤버를 우클릭하면 추가 옵션을 볼 수 있습니다.",
        roles: {
          0: "멤버",
          1: "부관리자",
          2: "간부",
          3: "클랜장",
        },
      },
      inventory: {
        bindlevel: {
          0: "거래 가능",
          1: "계정 귀속",
          2: "캐릭터 귀속",
        },
        copyitemid: "아이템 ID 복사",
        death: "사망하여 $1을 잃었습니다.",
        equip: "아이템 장착",
        full: "인벤토리가 가득 찼습니다.",
        pick: "$1을(를) 주웠습니다.",
        receive: "$1을(를) 획득했습니다.",
        sell: "아이템 판매",
        sold: "$1을(를) 판매했습니다.",
        spend: "$1을 사용했습니다.",
        splitone: "하나만 나누기",
        throw: "$1을(를) 버렸습니다.",
      },
      merchant: {
        auctionbuy: "아이템을 $1에 구매했으며 보관함으로 보냈습니다.",
        auctioncancel: "아이템 등록을 취소하고 보관함으로 보냈습니다.",
        auctionpost: "$1을(를) 판매 등록했습니다.",
        buyItem: {
          1: "가격",
          2: "?",
        },
        delist: "등록 취소",
        dragitem: "Shift+우클릭하거나 슬롯으로 드래그하세요.",
        fee: "수수료",
        sell: "$1을(를) $2에 판매했습니다.",
        total: "합계",
      },
      settings: {
        ambiencevolume: "환경음 볼륨",
        bindingreset: "초기화하려면 입력칸을 비워 두세요.",
        damagehealing: "피해량 & 치유량",
        buffcdtext: "재사용 대기시간 텍스트 (효과)",
        buffmax: "효과 최대 표시 수",
        buffmaxparty: "효과 최대 표시 수 (파티)",
        chatbubbles: "채팅 말풍선 표시",
        creatureshadows: "생물 그림자",
        disableoffscreen: "화면 밖 생물 비활성화",
        excludedrops: "표시하지 않을 드롭 종류",
        flashduration: "효과 만료 점멸 시간",
        flashinterval: "효과 만료 점멸 간격",
        fov: "시야각",
        fxaa: "FXAA",
        fpsping: "FPS / 핑",
        icons: "아이콘 & 효과",
        incomingdamage: "받는 피해",
        incominghealing: "받는 치유",
        incomingmana: "받는 마나",
        invwidth: "인벤토리 너비",
        monsternames: "몬스터 이름표",
        monsterbars: "몬스터 체력바",
        multiplierdesc:
          "내가 시전하지 않은 주문의 효과음 볼륨을 줄일 수 있습니다. 100% = 감소 없음, 50% = 절반 볼륨.",
        offscreendesc: "성능을 높이는 대신 화면 밖 동작을 비활성화합니다.",
        preventoverlap: "숫자 겹침 방지",
        protectedquality: "보호할 아이템 품질",
        qualitymin: "드롭 품질% 최솟값",
        showfps: "FPS / 핑 표시",
        showquality: "드롭 품질% 표시",
        showselfparty: "파티에 내 캐릭터 표시",
        skillcdtext: "재사용 대기시간 텍스트 (스킬)",
        selfbuffsonly: "내 효과만 표시",
        sfxmultiplier: "외부 효과음 배율",
        stashwidth: "보관함 너비",
        stashheight: "보관함 높이",
        updateratelimit: "파티 효과 업데이트 속도 제한",
      },
      party: {
        invite: "파티 초대",
        kick: "파티 강퇴",
        leave: "파티 나가기",
        create: "파티 만들기",
        onInvite: "$1님이 파티에 초대했습니다.",
        link: "초대 링크",
        onLink: "이 링크를 다른 플레이어에게 보내면 파티에 참여할 수 있습니다.",
        copyLink: "클립보드에 복사",
        summon: "소환",
        onSummon: "$1님이 자신의 위치로 소환하려 합니다.",
        giveAssistant: "부관리자로 승급",
        giveLeader: "파티장으로 승급",
        removeAssistant: "부관리자 권한 해제",
        startQueue: "대기열 등록",
        stopQueue: "대기열 나가기",
        noParty: "파티 없음",
        name: "파티",
        members: "멤버",
        activities: {
          0: "레벨링 (PvE)",
          1: "파밍 (PvE)",
          2: "보스전 (PvE)",
          3: "오벨리스크 (PvP)",
          4: "아레나 (PvP)",
          5: "전쟁 (PvP)",
          6: "기타",
        },
      },
      stats: {
        misc: {
          damage: "피해",
          healing: "치유량",
          fame: "명성",
          kills: "처치",
        },
        array: {
          0: "힘",
          1: "지구력",
          2: "민첩",
          3: "지능",
          4: "지혜",
          5: "행운",
          6: "생명력",
          7: "마나",
          8: "생명력 재생/5초",
          9: "마나 재생/5초",
          10: "최소 피해",
          11: "최대 피해",
          12: "방어력",
          13: "막기",
          14: "치명타",
          15: "이동 속도",
          16: "가속",
          17: "공격 속도",
          18: "아이템 발견",
          19: "가방 칸",
          20: "프레스티지",
          21: "평점",
          22: "스탯 포인트",
          23: "스킬 포인트",
          24: "최대 스킬 포인트",
          25: "장비 점수",
          26: "PvP 레벨",
          27: "크기",
          28: "투명화",
          29: "시야",
          30: "% 피해 증가",
          31: "% 어그로 생성 증가",
          32: "% 이동 속도 감소",
          33: "치유량 감소",
        },
      },
      stash: {
        name: "보관함",
        waitunstash: "이 아이템을 꺼내려면 아직 기다려야 합니다.",
        withdraw: "꺼내기",
        deposit: "맡기기",
        stash: "아이템 보관",
        stashed: "$1이(가) 보관함으로 이동되었습니다.",
      },
      death: {
        death: "사망했습니다.",
        deathmsg: "가장 가까운 Conjurer에서 부활하려면 버튼을 누르세요.",
        respawn: "부활",
      },
      tutorial: {
        msg: {
          0: "환영합니다! <kbd>W A S D</kbd> 또는 <kbd>방향키</kbd>로 이동하세요.",
          1: "좋습니다. 이제 <kbd>좌클릭/우클릭</kbd>한 상태로 마우스를 드래그해 카메라를 돌려 보세요.",
          2: "앞으로 이동해 몬스터를 찾은 뒤, 마우스로 클릭하거나 <kbd>TAB</kbd>을 눌러 대상으로 지정하세요.",
          3: "스킬바에 등록된 키를 눌러 공격할 수 있습니다. 키보드의 <kbd>1</kbd>을 눌러 몬스터를 공격하세요!",
          4: "완벽합니다. 계속 공격해서 몬스터를 처치하세요.",
          5: "잘했습니다. 경험치를 획득했습니다.",
          6: "경험치를 충분히 모으면 레벨이 오릅니다.",
          7: "<kbd>Shift</kbd>를 누르면 바닥의 아이템과 코인을 볼 수 있습니다. 아이템을 주워 보세요.",
          8: "아이템을 주웠습니다. 인벤토리(<kbd>B</kbd>)를 열어 확인하세요.",
          9: "여기에서 보유 중인 아이템을 볼 수 있습니다. 인벤토리 크기는 착용한 가방에 따라 달라집니다.",
          10: '아이템은 우클릭한 뒤 "아이템 장착"을 선택해 장착할 수 있습니다.',
          11: "캐릭터 패널(<kbd>C</kbd>)을 여세요.",
          12: "캐릭터 패널에서 현재 장착한 모든 아이템을 확인할 수 있습니다.",
          13: "다음은 몬스터를 처치해 레벨을 올려 보세요.",
          14: "레벨이 올라 스탯 포인트를 얻었습니다. 캐릭터 패널(<kbd>C</kbd>)을 다시 여세요.",
          15: "스탯 포인트로 주요 능력치를 올릴 수 있습니다. 버튼에 마우스를 올려 효과를 미리 본 뒤 포인트를 사용하세요.",
          16: "이제 새 스킬을 배우는 방법을 알려드리겠습니다. 먼저 레벨 3까지 올려 새 스킬을 잠금 해제하세요.",
          17: "새 스킬을 사용할 수 있습니다. 새 스킬을 배우려면 스킬북이 필요합니다.",
          18: "아이템과 코인을 모으세요. 첫 스킬북을 사려면 32코인이 필요합니다. 아이템은 상인에게 판매할 수 있습니다.",
          19: "코인이 충분합니다. 기지로 돌아가 직업 상인에게 말을 걸어 새 스킬북을 구입하세요.",
          20: "상인은 스킬북, 물약, 탈것을 판매합니다. 스킬북을 우클릭해 구입하세요.",
          21: "스킬북을 얻었다면 인벤토리를 열고 책을 우클릭한 뒤 <kbd>아이템 사용</kbd>을 눌러 배우세요.",
          22: "상인 창을 닫고 스킬 패널(<kbd>K</kbd>)을 열어 스킬 목록을 확인하세요.",
          23: "여기에서 스킬을 볼 수 있습니다. 마우스를 올리면 추가 정보를 확인할 수 있습니다. 스킬은 보통 스킬 포인트 1개가 필요하며, 스킬 포인트는 2레벨마다 1개씩 얻습니다.",
          24: "스킬 세트는 언제든 바꿀 수 있습니다. 스킬 포인트를 투자해 스킬을 활성화하세요.",
          25: '이제 "적용"을 눌러 새 스킬 세트를 활성화하세요.',
          26: "스킬을 클릭해 스킬바로 드래그할 수 있습니다.",
          27: "많이 배웠습니다. 이제 모험을 시작할 준비가 거의 됐습니다.",
          28: "Hordes에서는 다른 플레이어와 파티를 맺고 함께 플레이하는 것이 중요합니다. <kbd>파티 없음</kbd>을 클릭하거나 <kbd>P</kbd>를 눌러 파티 찾기를 여세요.",
          29: "내 레벨에 맞는 레벨업 그룹을 선택한 뒤 <kbd>적용</kbd>을 누르세요.",
          30: "곧 주술사가 소환해 줄 것입니다. 또는 <kbd>M</kbd>을 눌러 지도를 열고 어디로 가야 하는지 확인할 수 있습니다.",
          31: "레벨 9 달성을 축하합니다! 이제 곧 파티 찾기를 통해 다음 파티에 참여할 수 있습니다. <kbd>P</kbd>",
          32: "레벨이 오르면 스킬 포인트와 스탯 포인트를 추가로 얻습니다. 스킬(<kbd>K</kbd>)을 강화하고 스탯 포인트(<kbd>C</kbd>)를 배분하는 것을 잊지 마세요.",
          33: "팁: 모든 레벨 1 스킬북은 직업 상인에게서 구입할 수 있습니다. 상위 레벨 스킬북은 몬스터에게서 얻을 수 있습니다.",
          34: "팁: 다른 플레이어와 아이템을 거래할 수 있습니다. 큰 초록색 모자를 쓴 상인(Merchant)을 찾아가 보세요.",
          35: "팁: 상인에게서 산 아이템은 보관함으로 보내집니다. 보관함은 아이템과 골드를 보관하는 갈색 상자이며 상인 옆에 있습니다.",
          36: "팁: 몬스터를 처치하면 룬을 얻을 수 있습니다. 룬은 아이템 업그레이드에 사용됩니다. 대장장이(Blacksmith)를 찾아가세요.",
          37: "팁: <kbd>Enter</kbd>를 눌러 채팅할 수 있습니다. <kbd>/party</kbd>, <kbd>/faction</kbd>, <kbd>/clan</kbd> 채널을 사용할 수 있습니다.",
          38: "팁: 적 진영의 플레이어를 처치하면 명성과 왕관 같은 아이템을 얻을 수 있습니다.",
          39: "팁: 파티를 맺으면 PvP 전투에서 명성 포인트를 공유할 수 있습니다.",
          40: "팁: 오른쪽 위의 톱니바퀴를 눌러 설정을 열 수 있습니다. 조작, 채팅 메시지, 인터페이스, 그래픽 설정을 바꿀 수 있습니다.",
          41: "팁: Hordes에서 몬스터가 빠르게 처치되면 체력이 늘고 전리품을 더 많이 떨어뜨리는 Hellspawn 상태로 강화될 수 있습니다. 파티로 자원을 함께 파밍하기 좋습니다.",
          42: "팁: 엔드게임의 고레벨 Hellspawn 몬스터는 희귀 펫을 드롭할 수 있으며, 이 펫은 다른 플레이어에게 판매할 수 있습니다.",
          43: "팁: Obelisk는 3시간마다 반복되는 1시간짜리 엔드게임 PvP 이벤트입니다. War Conjurer를 통해 PvP 전장으로 이동할 수 있습니다.",
          44: "팁: Obelisk 전투에서 승리하면 <kbd>Bone Blessing</kbd>을 보상으로 받습니다. 이 효과는 보스 전리품을 추가로 얻을 수 있게 해 줍니다.",
          45: "팁: Obelisk 이벤트가 끝나면 Gloomfury가 Faivel 중앙에 등장합니다. 강력한 보스이며 개인 기여도에 따라 전리품을 줍니다.",
          46: "팁: Hordes 엔드게임 이벤트는 3시간 주기로 반복됩니다. Obelisk PvP 1시간, Gloomfury 1시간, 휴식 1시간입니다.",
          47: "팁: Hordes에는 희귀 탈것이 있습니다. 세계 곳곳에 드물게 등장할 때 발견할 수 있습니다.",
          48: "레벨 45 달성을 축하합니다! 이제 다른 플레이어와 함께 Gloomfury 전투, PvP Obelisk, Hellspawn 파밍, 희귀 펫과 탈것 사냥에 참여할 수 있습니다.",
        },
      },
      title: {
        name: {
          0: {
            0: "신병",
            1: "초보자",
            2: "종자",
            3: "견습생",
            4: "숙련자",
            5: "맹렬한 달인",
            6: "용맹한 기사",
            7: "용감한 병사",
            8: "명망 높은 베테랑",
            9: "두려움 없는 감시관",
            10: "최고 사령관",
            11: "군주",
          },
          1: {
            0: "부정한 자",
            1: "싸움꾼",
            2: "학살자",
            3: "유린자",
            4: "파괴자",
            5: "무자비한 분쇄자",
            6: "야만적인 습격자",
            7: "야생의 사신",
            8: "불굴의 해방자",
            9: "대담한 챔피언",
            10: "멈추지 않는 영웅",
            11: "선택받은 자",
          },
        },
      },
      hiddenskills: {
        100: { name: "물약 마시기" },
        101: { name: "스킬북 익히기" },
        102: { name: "탈것 타기" },
        103: { name: "열기" },
        104: { name: "영혼 귀환" },
        105: { name: "장신구 사용" },
      },
      report: {
        reasons: {
          0: "부적절한 채팅",
          1: "다중 계정 동시 조작",
          2: "사기",
          3: "치트 / 버그 악용",
          4: "부적절한 이름",
          5: "봇 사용",
        },
        info: {
          0: "스팸, 노골적이거나 혐오적인 표현, 성인물, 사칭, 신상 공개, 이용약관을 위반하는 광고 등이 해당됩니다. 가벼운 농담은 허용될 수 있습니다. 여러 메시지를 반복 신고하지 말고 대표 메시지 하나만 신고하세요.",
          1: "아이템 발견 확률 중첩, 사전 강화 효과, 자동 치유, 기타 PvE/PvP 활동 악용 등으로 부당한 이득을 얻기 위해 여러 캐릭터를 동시에 조작하는 행위입니다.",
          2: "게임 내 서비스나 거래를 허위로 광고하거나 아이템을 떨어뜨리도록 속여 다른 플레이어의 재화나 아이템을 빼앗는 행위입니다.",
          3: "치트 도구를 사용하거나 심각한 버그를 악용해 정상적인 플레이를 우회하고 부당한 이득을 얻는 행위입니다.",
          4: "모욕적 표현이 포함된 이름, 신원을 숨기기 위한 문자 조작, 운영진 사칭 등이 해당됩니다.",
          5: "자리를 비운 상태에서 자동화 도구로 게임을 플레이하거나, 부당한 이득을 얻기 위해 행동을 자동화하는 행위입니다.",
        },
      },
      messages: {
        auctionSold: "상인 경매가 판매되어 $g$1이 보관함으로 보내졌습니다.",
        clanApplication: "$1님이 클랜 가입을 신청했습니다.",
        clanInvitation: "$1님에게 클랜 초대장을 보냈습니다.",
        clanKick: "$1님이 클랜에서 추방되었습니다.",
        clanKickOther: "$1님이 클랜에서 추방되었습니다.",
        clanMemberApply: "$1님이 클랜 가입을 신청했습니다.",
        clanMemberDemote: "$1님이 클랜 역할에서 강등되었습니다.",
        clanMemberInvite: "$1님에게 클랜 초대장을 보냈습니다.",
        clanMemberJoin: "$1님이 클랜에 들어왔습니다.",
        clanMemberLeave: "$1님이 클랜을 떠났습니다.",
        clanMemberPromote: "$1님이 클랜 역할에서 승급했습니다.",
        clanMemberRoleDemote: "$1님이 클랜 역할에서 강등되었습니다.",
        clanMemberRolePromote: "$1님이 클랜 역할에서 승급했습니다.",
        offline: "$1님이 오프라인 상태가 되었습니다.",
        online: "$1님이 온라인 상태가 되었습니다.",
        partyInvitationDecline: "$1님이 파티 참여를 거절했습니다.",
        partyInviteLink: "$1님이 파티 초대 링크를 생성했습니다: $2",
        partyKickOther: "$1님이 $2님에 의해 파티에서 추방되었습니다.",
        partyKickYou: "$1님에 의해 파티에서 추방되었습니다.",
        partyLootQueueResolve: "$1이 $2 $3 $4을(를) 획득했습니다.",
        partyMemberDemote: "$1님이 파티 역할에서 강등되었습니다.",
        partyMemberFound: "새 파티원 $1명을 찾았습니다.",
        partyMemberInvite: "$2님이 $1님을 파티에 초대했습니다.",
        partyMemberJoin: "$1님이 파티에 들어왔습니다.",
        partyMemberLeave: "$1님이 파티를 떠났습니다.",
        partyMemberPromote: "$1님이 파티 역할에서 승급했습니다.",
        partyQueueStart: "파티가 $1 대기열을 시작했습니다.",
        partyQueueStop: "파티가 $1 대기열을 중단했습니다.",
      },
      elixir: {
        bagslots: "기본 가방 칸",
        chatsupport: "채팅 후원자 아이콘",
        currency: "Hordes 포인트",
        enable: "Elixir 활성화 만료일",
        merchantduration: "상인 등록 기간",
        merchantlimit: "상인 등록 한도",
        notactive: "비활성",
        pointserror: "이 작업을 수행하기에 Hordes 포인트가 부족합니다.",
        subscription: "엘릭서",
        support:
          "저렴한 비용으로 Hordes 개발을 지원하세요. 추가 가방 칸, 더 넓은 보관함, 향상된 상인 기능 등 여러 혜택을 사용할 수 있습니다(추가 예정).",
        tba: "+ 추가 예정",
        thankyou:
          "Elixir 시간이 추가되었습니다. 지원해 주셔서 감사합니다. 접속 중인 캐릭터는 다시 로그인해 주세요.",
        willadd: "자신에게 부여하시겠습니까: ",
        willcost: "비용: ",
        willgift: "선물하시겠습니까: ",
      },
      itemdescription: {
        compare: "Shift를 눌러 아이템을 비교하세요.",
        equipeffect: "이 아이템을 장착하면 다음 효과가 적용됩니다.",
        onpurchase: "구매 시",
        onsale: "상인 판매 시",
        onuse: "사용 시",
      },
      skilldescription: {
        targetNone: "대상 필요 없음",
        targetSelf: "자신에게 시전",
        targetFriendly: "아군 대상",
        targetEnemy: "적 대상",
        spellMelee: "근접 공격",
        spellMagic: "마법 공격",
        spellHeal: "치유",
        spellBuff: "강화 효과",
        spellBuffStack: "중첩 가능한 강화 효과",
        spellMissile: "원거리 투사체",
        spellMissileBuff: "원거리 강화 효과",
        spellCustom: "효과",
        statincrement: {
          0: "1당",
          1: "획득",
          2: " ",
        },
      },
      headers: {
        pvp: "PvP",
      },
      war: {
        duration: "기간",
        statustypes: {
          1: "곧 종료",
          2: "진행 중",
        },
      },
    },
  };

  try {
    initCanvasTextHighlighter();
    initGameWebSocketCapture();
    initStatusUi();
    installXhrInterceptor();
    initDomTranslator();
    initChatTranslator();
    initNameHighlighter();
    initRuntimeNameOverlay();
    initTargetContextMenuHighlight();
    initPartyUiManager();
    initPartyCommandPanel();
    initSwiftshotTurbo();
    initDamageLog();
  } catch (error) {
    showBootstrapFailureBadge("KR Mod 초기화 실패", [
      "Hordes KR Mod 초기화 중 오류가 발생했습니다.",
      error && error.message ? error.message : String(error),
      "",
      "콘솔 진단:",
      "document.documentElement.getAttribute('data-hordes-kr-userscript-started')",
    ]);
    throw error;
  }

  pageWindow.fetch = async function hordesKrFetch(input, init) {
    const url = toUrl(input);
    if (url && isEnabled() && isLocalizationRequest(url)) {
      return buildKoreanLocalizationResponse(url, "fetch");
    }

    return originalFetch(input, init);
  };

  pageWindow.HordesKrMod = {
    version: MOD_VERSION,
    setFovCap(value) {
      return setFovCapValue(value);
    },
    setFov(value) {
      return setFovValue(value);
    },
    findFovSlider() {
      const input = findFovSliderInput();
      return input ? { found: true, max: input.max, value: input.value } : { found: false };
    },
    enable() {
      return setTranslationEnabled(true);
    },
    disable() {
      return setTranslationEnabled(false);
    },
    clearCache() {
      CACHE.clear();
      setStatus({
        lastState: "캐시 비움",
        lastError: "",
      });
      console.info("[Hordes KR Mod] Localization cache cleared.");
    },
    enableScriptGate() {
      localStorage.setItem(SCRIPT_GATE_ENABLED_KEY, "force");
      localStorage.removeItem(SCRIPT_GATE_DISABLED_KEY);
      return "스크립트 게이트 켜짐 - 새로고침 필요";
    },
    disableScriptGate() {
      localStorage.setItem(SCRIPT_GATE_ENABLED_KEY, "false");
      localStorage.setItem(SCRIPT_GATE_DISABLED_KEY, "true");
      return "스크립트 게이트 꺼짐 - 새로고침 필요";
    },
    async testRequest() {
      setStatus({
        lastState: "모드 테스트 중",
        lastError: "",
        lastTransport: "fetch",
      });

      const response = await pageWindow.fetch(`/data/loc/en.json?krmod-test=${Date.now()}`);
      if (!response.ok) throw new Error(`test locale request failed: ${response.status}`);

      const loc = await response.json();
      const sample = loc && loc.ui && loc.ui.party && loc.ui.party.name;
      setStatus({
        lastState: sample === "파티" ? "모드 테스트 성공" : "모드 테스트 실패",
        lastAppliedAt: sample === "파티" ? new Date() : MOD_STATUS.lastAppliedAt,
        lastError: sample === "파티" ? "" : `sample=${String(sample)}`,
      });
      return sample;
    },
    status() {
      return { ...MOD_STATUS, enabled: isEnabled() };
    },
    targetDistance() {
      return getTargetDistance(true);
    },
    distanceToTarget() {
      return getTargetDistance(true);
    },
    targetDistanceOverlayStatus() {
      return getTargetDistanceOverlayStatus();
    },
    lockCurrentTargetDistance() {
      return lockCurrentTargetDistance();
    },
    lockTargetDistanceByName(name) {
      return lockTargetDistanceByName(name);
    },
    lockTargetDistanceById(id, name) {
      return lockTargetDistanceById(id, name, "manualId");
    },
    unlockTargetDistance() {
      return unlockTargetDistance();
    },
    selectedTargetId() {
      return getSelectedTargetIdStatus();
    },
    targetDistanceLockStatus() {
      return getTargetDistanceLockStatus();
    },
    toggleTranslation() {
      return setTranslationEnabled(!isEnabled());
    },
    toggleDomTranslation() {
      return setTranslationEnabled(!isEnabled());
    },
    toggleTargetDistanceOverlay() {
      FEATURE_CONFIG.targetDistanceEnabled = !FEATURE_CONFIG.targetDistanceEnabled;
      saveFeatureConfig();
      if (!FEATURE_CONFIG.targetDistanceEnabled) clearTargetDistanceOverlay();
      renderStatusUi();
      return FEATURE_CONFIG.targetDistanceEnabled;
    },
    toggleIncomingSkillOverlay() {
      const enabled = !(FEATURE_CONFIG.incomingSkillOverlayEnabled !== false || FEATURE_CONFIG.incomingTargetWatchEnabled !== false);
      FEATURE_CONFIG.incomingSkillOverlayEnabled = enabled;
      FEATURE_CONFIG.incomingTargetWatchEnabled = enabled;
      saveFeatureConfig();
      updateRuntimeNameOverlay();
      renderStatusUi();
      return {
        incomingSkillOverlayEnabled: FEATURE_CONFIG.incomingSkillOverlayEnabled,
        incomingTargetWatchEnabled: FEATURE_CONFIG.incomingTargetWatchEnabled,
      };
    },
    toggleIncomingSkillList() {
      return false;
    },
    toggleIncomingTargetWatch() {
      FEATURE_CONFIG.incomingTargetWatchEnabled = !isIncomingTargetWatchEnabled();
      saveFeatureConfig();
      if (!FEATURE_CONFIG.incomingTargetWatchEnabled) {
        HIGHLIGHT_STATE.lastIncomingTargetWatchMatches = [];
        HIGHLIGHT_STATE.lastIncomingTargetWatchError = "";
      }
      updateRuntimeNameOverlay();
      renderStatusUi();
      return FEATURE_CONFIG.incomingTargetWatchEnabled;
    },
    toggleBuffSpikeWarn() {
      FEATURE_CONFIG.buffSpikeWarnEnabled = !isBuffSpikeWarnEnabled();
      saveFeatureConfig();
      if (!FEATURE_CONFIG.buffSpikeWarnEnabled) HIGHLIGHT_STATE.buffSpikeTracker.clear();
      updateRuntimeNameOverlay();
      return FEATURE_CONFIG.buffSpikeWarnEnabled
        ? "버프 활성화 경고 켜짐 (강조/주시 대상이 버프를 한꺼번에 켜면 ⚡버프 표시)"
        : "버프 활성화 경고 꺼짐";
    },
    toggleDashboard() {
      const enabled = setDashboardEnabled(!isDashboardEnabled());
      return enabled ? "상태 대시보드 켜짐" : "상태 대시보드 꺼짐";
    },
    toggleThreatHud() {
      FEATURE_CONFIG.threatHudEnabled = FEATURE_CONFIG.threatHudEnabled === false;
      saveFeatureConfig();
      updateThreatHud();
      return FEATURE_CONFIG.threatHudEnabled ? "위협 HUD 켜짐 (주시/어그로 카운터)" : "위협 HUD 꺼짐";
    },
    toggleWatchBeep() {
      FEATURE_CONFIG.watchBeepEnabled = FEATURE_CONFIG.watchBeepEnabled === false;
      saveFeatureConfig();
      return FEATURE_CONFIG.watchBeepEnabled ? "주시 경고음 켜짐" : "주시 경고음 꺼짐";
    },
    toggleDangerOverlay() {
      FEATURE_CONFIG.dangerOverlayEnabled = !isDangerOverlayEnabled();
      saveFeatureConfig();
      renderStatusUi();
      if (FEATURE_CONFIG.dangerOverlayEnabled) startDangerOverlayLoop(); else clearDangerOverlay();
      return FEATURE_CONFIG.dangerOverlayEnabled
        ? "장판경고 켜짐 — 적 지면 AoE(텔레그래프)를 화면에 빨간 원으로 표시 (빈 곳=세이프존)"
        : "장판경고 꺼짐";
    },
    toggleAutoInterrupt() {
      FEATURE_CONFIG.autoInterruptEnabled = !FEATURE_CONFIG.autoInterruptEnabled;
      saveFeatureConfig();
      renderStatusUi();
      const scope = FEATURE_CONFIG.autoInterruptHighlightOnly ? "강조 대상" : "모든 적";
      return FEATURE_CONFIG.autoInterruptEnabled
        ? `자동끊기 켜짐: ${scope}이 ${FEATURE_CONFIG.autoInterruptRangeM}m 내에서 [${FEATURE_CONFIG.autoInterruptSkillIds.join(",")}] 시전 시 ${FEATURE_CONFIG.autoInterruptSlots.join("→")}번으로 끊기`
        : "자동끊기 꺼짐";
    },
    setAutoInterruptHighlightOnly(on) {
      FEATURE_CONFIG.autoInterruptHighlightOnly = on === true;
      saveFeatureConfig();
      return FEATURE_CONFIG.autoInterruptHighlightOnly
        ? "자동끊기: 강조 대상만 끊기"
        : "자동끊기: 모든 적 끊기 (강조 무관)";
    },
    toggleInterruptWsHook(on) {
      FEATURE_CONFIG.autoInterruptWsHook = on === undefined ? !FEATURE_CONFIG.autoInterruptWsHook : on === true;
      saveFeatureConfig();
      return FEATURE_CONFIG.autoInterruptWsHook
        ? `WS 후킹 켜짐 — 메시지 도착 즉시 감지(폴링 지연 제거). attached=${COMBAT_ASSIST_STATE.wsHookAttached}, msgs=${COMBAT_ASSIST_STATE.wsHookMsgCount}, wsFires=${COMBAT_ASSIST_STATE.wsHookFires}`
        : "WS 후킹 꺼짐 — 16ms 폴링만 사용";
    },
    setAutoInterruptSlots(slots) {
      const list = (Array.isArray(slots) ? slots : [slots])
        .map((slot) => Math.round(Number(slot))).filter((slot) => slot >= 1 && slot <= 12).slice(0, 4);
      if (list.length) FEATURE_CONFIG.autoInterruptSlots = list;
      saveFeatureConfig();
      return `자동끊기 슬롯: ${FEATURE_CONFIG.autoInterruptSlots.join(" → ")}`;
    },
    setAutoInterruptRange(meters) {
      FEATURE_CONFIG.autoInterruptRangeM = clamp(Math.round(Number(meters) || 30), 5, 80);
      saveFeatureConfig();
      return `자동끊기 거리: ${FEATURE_CONFIG.autoInterruptRangeM}m`;
    },
    setAutoInterruptSkills(skillIds) {
      const list = (Array.isArray(skillIds) ? skillIds : [skillIds])
        .map((id) => Math.round(Number(id))).filter((id) => id >= 0).slice(0, 12);
      if (list.length) FEATURE_CONFIG.autoInterruptSkillIds = list;
      saveFeatureConfig();
      return `자동끊기 트리거 스킬: [${FEATURE_CONFIG.autoInterruptSkillIds.join(", ")}] (45=Volley, 52=Frostcall, 35=소환, 33=Charge돌진, 51=Shatter쉐터, 54=BoneShot본샷, 46=휠윈드)`;
    },
    toggleTeamSync() {
      const on = setTeamSyncEnabled(!isTeamSyncEnabled());
      return on
        ? `팀공유 켜짐 (방 '${FEATURE_CONFIG.teamSyncRoom}') — 같은 방+토큰 멤버끼리 직업/AoE/자버프/candle 공유`
        : "팀공유 꺼짐";
    },
    setTeamSyncRoom(room) {
      FEATURE_CONFIG.teamSyncRoom = String(room || "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 48) || TEAM_SYNC_ROOM_DEFAULT;
      saveFeatureConfig();
      TEAM_SYNC_STATE.members = [];
      if (isTeamSyncEnabled()) scheduleTeamSync();
      return `팀공유 방: '${FEATURE_CONFIG.teamSyncRoom}' (길드원과 같은 방·토큰을 쓰세요)`;
    },
    setTeamSyncToken(token) {
      FEATURE_CONFIG.teamSyncToken = String(token || TEAM_SYNC_TOKEN_DEFAULT).trim() || TEAM_SYNC_TOKEN_DEFAULT;
      saveFeatureConfig();
      return "팀공유 토큰 설정됨";
    },
    setTeamSyncScale(value) {
      return `팀공유 패널 크기: ${setTeamSyncScale(value)}배 (헤더의 −/+ 버튼으로도 조절)`;
    },
    teamSyncStatus() {
      return {
        enabled: isTeamSyncEnabled(),
        room: FEATURE_CONFIG.teamSyncRoom,
        server: FEATURE_CONFIG.teamSyncServer,
        memberCount: TEAM_SYNC_STATE.members.length,
        members: TEAM_SYNC_STATE.members,
        lastSyncAgoMs: TEAM_SYNC_STATE.lastSyncAt ? Date.now() - TEAM_SYNC_STATE.lastSyncAt : null,
        lastError: TEAM_SYNC_STATE.lastError,
      };
    },
    combatAssistStatus() {
      return {
        threatHud: FEATURE_CONFIG.threatHudEnabled !== false,
        watchBeep: FEATURE_CONFIG.watchBeepEnabled !== false,
        watchers: [...COMBAT_ASSIST_STATE.watcherIds],
        watcherNames: COMBAT_ASSIST_STATE.watcherNames,
        mobAggro: COMBAT_ASSIST_STATE.mobAggroCount,
        fastPathHits: COMBAT_ASSIST_STATE.fastPathHits,
        fastPathLastAgoMs: COMBAT_ASSIST_STATE.fastPathLastAt ? Date.now() - COMBAT_ASSIST_STATE.fastPathLastAt : null,
        autoInterrupt: {
          enabled: FEATURE_CONFIG.autoInterruptEnabled,
          highlightOnly: FEATURE_CONFIG.autoInterruptHighlightOnly,
          slots: FEATURE_CONFIG.autoInterruptSlots,
          rangeM: FEATURE_CONFIG.autoInterruptRangeM,
          triggerSkillIds: FEATURE_CONFIG.autoInterruptSkillIds,
          wsHook: {
            enabled: FEATURE_CONFIG.autoInterruptWsHook,
            attached: COMBAT_ASSIST_STATE.wsHookAttached,
            msgCount: COMBAT_ASSIST_STATE.wsHookMsgCount,
            fires: COMBAT_ASSIST_STATE.wsHookFires,
            lastAgoMs: COMBAT_ASSIST_STATE.lastWsHookAt ? Date.now() - COMBAT_ASSIST_STATE.lastWsHookAt : null,
          },
          hits: COMBAT_ASSIST_STATE.interruptHits,
          last: COMBAT_ASSIST_STATE.lastInterruptInfo,
          lastAgoMs: COMBAT_ASSIST_STATE.lastInterruptAt ? Date.now() - COMBAT_ASSIST_STATE.lastInterruptAt : null,
          detect: COMBAT_ASSIST_STATE.lastInterruptDetect
            ? { ...COMBAT_ASSIST_STATE.lastInterruptDetect, agoMs: Date.now() - COMBAT_ASSIST_STATE.lastInterruptDetect.at }
            : null,
          skip: COMBAT_ASSIST_STATE.lastInterruptSkip
            ? { ...COMBAT_ASSIST_STATE.lastInterruptSkip, agoMs: Date.now() - COMBAT_ASSIST_STATE.lastInterruptSkip.at }
            : null,
          castResult: COMBAT_ASSIST_STATE.lastInterruptResult
            ? { ...COMBAT_ASSIST_STATE.lastInterruptResult, agoMs: Date.now() - COMBAT_ASSIST_STATE.lastInterruptResult.at }
            : null,
        },
        lastError: COMBAT_ASSIST_STATE.lastError,
      };
    },
    showDashboard() {
      return setDashboardEnabled(true) ? "상태 대시보드 켜짐" : "상태 대시보드 꺼짐";
    },
    toggleChatTranslation() {
      return setChatTranslationEnabled(!isChatTranslationEnabled());
    },
    toggleSwiftshotTurbo() {
      return setSwiftshotTurboEnabled(!FEATURE_CONFIG.swiftshotTurboEnabled);
    },
    setSwiftshotTurboEnabled(enabled) {
      return setSwiftshotTurboEnabled(enabled);
    },
    swiftshotTurboStatus() {
      return getSwiftshotTurboStatus();
    },
    toggleDamageLog() {
      return setDamageLogEnabled(!isDamageLogEnabled());
    },
    setDamageLogEnabled(enabled) {
      return setDamageLogEnabled(enabled);
    },
    damageLogStatus() {
      return getDamageLogStatus();
    },
    exportDamageLog(format) {
      return exportDamageLog(format);
    },
    clearDamageLog() {
      return clearDamageLogHistory();
    },
    setChatTranslationApiKey(apiKey) {
      return setChatTranslationApiKey(apiKey);
    },
    clearChatTranslationApiKey() {
      return clearChatTranslationApiKey();
    },
    setChatTranslationModel(model) {
      return setChatTranslationModel(model);
    },
    async testChatTranslation(text) {
      const startedAt = Date.now();
      const sourceText = String(text || "hello party, focus sage first").trim();
      const translation = await translateChatMessage(sourceText);
      return {
        sourceText,
        translation,
        durationMs: Date.now() - startedAt,
        status: getChatTranslationStatus(),
      };
    },
    chatTranslationStatus() {
      return getChatTranslationStatus();
    },
    togglePartyUi() {
      PARTY_UI_CONFIG.enabled = !PARTY_UI_CONFIG.enabled;
      savePartyUiConfig();
      updatePartyUi();
      renderStatusUi();
      return getPartyUiStatus();
    },
    partyUiPreset5x2() {
      return applyPartyUiPreset5x2();
    },
    partyUiReset() {
      return resetPartyUi();
    },
    partyUiStatus() {
      return getPartyUiStatus();
    },
    togglePartyCommandPanel() {
      return setPartyCommandPanelEnabled(!PARTY_COMMAND_CONFIG.enabled);
    },
    setPartyCommandPanelEnabled(enabled) {
      return setPartyCommandPanelEnabled(enabled);
    },
    resetPartyCommandPanelPosition() {
      return resetPartyCommandPanelPosition();
    },
    setPartyCommandChannel(channel) {
      return setPartyCommandChannel(channel);
    },
    partyCommandPanelStatus() {
      return getPartyCommandPanelStatus();
    },
    sendPartyCommand(message) {
      return sendPartyChatCommand(message);
    },
    sendChatCommand(channel, message) {
      return sendHordesChatMessage(channel, message);
    },
    sendClanCommand(message) {
      return sendHordesChatMessage("clan", message);
    },
    scanBagGearItems() {
      return scanVisibleBagGearItems().map(stripGearPresetElement);
    },
    scanRuntimeGearItems() {
      return scanRuntimeGearItems().map(stripGearPresetElement);
    },
    scanRuntimeInventoryItems() {
      return scanRuntimeInventoryItems().map(stripGearPresetElement);
    },
    scanEquippedGearItems() {
      return scanRuntimeEquippedGearItems().map(stripGearPresetElement);
    },
    saveGearPreset(name) {
      return saveGearPresetFromCurrentEquipment(name);
    },
    saveBagGearPreset(name) {
      return saveGearPresetFromVisibleBag(name);
    },
    saveEquippedGearPreset(name) {
      return saveGearPresetFromCurrentEquipment(name);
    },
    equipGearPreset(name) {
      return runGearPresetByName(name);
    },
    equipVisibleBagGear() {
      return equipVisibleBagGear();
    },
    gearPresetStatus() {
      return getGearPresetStatus();
    },
    gearSocketStatus() {
      return getGearSocketStatus();
    },
    sendItemMove(fromSlot, toSlot) {
      return sendHordesItemMove(Number(fromSlot), Number(toSlot));
    },
    sendItemSplitOne(slotIndex) {
      return sendHordesItemSplitOne(Number(slotIndex));
    },
    scanActiveSkills() {
      return scanRuntimeActiveSkillIds();
    },
    scanSkillConfig() {
      return getCurrentSkillConfigSummary();
    },
    saveSkillPreset(name) {
      return saveSkillPresetFromCurrentConfig(name);
    },
    applySkillPreset(name) {
      return runSkillPresetByName(name);
    },
    equipSkillPreset(name) {
      return runSkillPresetByName(name);
    },
    skillPresetStatus() {
      return getSkillPresetStatus();
    },
    sendSkillConfig(skillIds) {
      return sendHordesSkillConfig(Array.isArray(skillIds) ? skillIds : String(skillIds || "").split(","));
    },
    featureStatus() {
      return getFeatureStatus();
    },
    resetUi() {
      resetUiConfig();
      renderStatusUi();
    },
    highlightNames() {
      return [...HIGHLIGHT_CONFIG.names];
    },
    addHighlightName(name) {
      addHighlightNameDirect(name);
      return [...HIGHLIGHT_CONFIG.names];
    },
    removeHighlightName(name) {
      const normalized = normalizeHighlightName(name);
      HIGHLIGHT_CONFIG.names = HIGHLIGHT_CONFIG.names.filter(
        (current) => current.toLowerCase() !== normalized.toLowerCase()
      );
      saveHighlightConfig();
      refreshNameHighlights();
      return [...HIGHLIGHT_CONFIG.names];
    },
    clearHighlightNames() {
      HIGHLIGHT_CONFIG.names = [];
      saveHighlightConfig();
      refreshNameHighlights();
      return [];
    },
    toggleNameHighlight() {
      return setNameHighlightEnabled(!HIGHLIGHT_CONFIG.enabled);
    },
    toggleSelfHighlight() {
      return setSelfHighlightEnabled(!HIGHLIGHT_CONFIG.selfHighlight);
    },
    toggleDomNameHighlight() {
      HIGHLIGHT_CONFIG.domEnabled = !HIGHLIGHT_CONFIG.domEnabled;
      saveHighlightConfig();
      refreshNameHighlights();
      return HIGHLIGHT_CONFIG.domEnabled;
    },
    toggleCanvasNameHighlight() {
      HIGHLIGHT_CONFIG.canvasEnabled = !HIGHLIGHT_CONFIG.canvasEnabled;
      saveHighlightConfig();
      return HIGHLIGHT_CONFIG.canvasEnabled;
    },
    toggleRuntimeNameOverlay() {
      HIGHLIGHT_CONFIG.runtimeOverlayEnabled = !HIGHLIGHT_CONFIG.runtimeOverlayEnabled;
      saveHighlightConfig();
      updateRuntimeNameOverlay();
      return HIGHLIGHT_CONFIG.runtimeOverlayEnabled;
    },
    toggleMinimapNameLabels() {
      HIGHLIGHT_CONFIG.minimapLabelsEnabled = !HIGHLIGHT_CONFIG.minimapLabelsEnabled;
      saveHighlightConfig();
      if (!HIGHLIGHT_CONFIG.minimapLabelsEnabled) clearMinimapNameOverlay();
      updateRuntimeNameOverlay();
      return HIGHLIGHT_CONFIG.minimapLabelsEnabled;
    },
    toggleMinimapHighlightList() {
      HIGHLIGHT_CONFIG.minimapListEnabled = !HIGHLIGHT_CONFIG.minimapListEnabled;
      saveHighlightConfig();
      if (!HIGHLIGHT_CONFIG.minimapListEnabled) clearMinimapHighlightList();
      updateRuntimeNameOverlay();
      renderStatusUi();
      return HIGHLIGHT_CONFIG.minimapListEnabled;
    },
    toggleMinimapHighlightListAllHostiles() {
      return toggleMinimapHighlightListAllHostiles();
    },
    toggleClanNameHide() {
      HIGHLIGHT_CONFIG.hideClanNames = !HIGHLIGHT_CONFIG.hideClanNames;
      saveHighlightConfig();
      return HIGHLIGHT_CONFIG.hideClanNames;
    },
    highlightStatus() {
      return getHighlightStatus();
    },
    scriptHookStatus() {
      return getScriptHookStatus();
    },
    runtimeOverlayStatus() {
      return getRuntimeOverlayStatus();
    },
    minimapOverlayStatus() {
      return getMinimapOverlayStatus();
    },
    minimapEntities(options) {
      return getMinimapEntityReport(options);
    },
    minimapHighlightListStatus() {
      return getMinimapHighlightListStatus();
    },
    contextMenuHighlightStatus() {
      return getTargetContextMenuHighlightStatus();
    },
    addSelectedTargetToHighlight() {
      return addSelectedTargetToHighlightNames();
    },
    setMinimapHighlightListScale(scale) {
      return setMinimapHighlightListScale(scale);
    },
    resetMinimapHighlightListPosition() {
      return resetMinimapHighlightListPosition();
    },
    translateOutgoingChat(text) {
      return translateOutgoingChatToGameInput(text);
    },
    targetMinimapHighlight(id, name) {
      return targetRuntimeEntityById(id, name, "minimapHighlightList");
    },
    targetHighlightedEntity(id, name) {
      return targetRuntimeEntityById(id, name, "highlightList");
    },
    clearHighlightedTarget() {
      return clearRuntimeTargetSelection();
    },
    loadedEntities(options) {
      return getLoadedEntityReport(options);
    },
    targetingMe(options) {
      return getIncomingTargetReport(options);
    },
    whoTargetsMe(options) {
      return getIncomingTargetReport(options);
    },
    targetFieldReport(options) {
      return getTargetFieldReport(options);
    },
    runtimeDebug() {
      return getRuntimeDebugReport();
    },
    runtimeDebugText() {
      return stringifyRuntimeDebugReport();
    },
    runtimeProbeNow() {
      runRuntimeProbeNow();
      return getRuntimeDebugReport();
    },
    inspectRuntime(name) {
      return inspectRuntimeForNameplates(name);
    },
    findNameplateCandidates(name) {
      return findRuntimeNameCandidates(name);
    },
    captureSelectedNameStyle(name, durationMs = 4000) {
      return captureSelectedNameStyle(name, durationMs);
    },
    nameplateStyleStatus() {
      return getNameplateStyleStatus();
    },
    clearCapturedNameplateStyle() {
      HIGHLIGHT_CONFIG.nameplateStyle = null;
      saveHighlightConfig();
      return getNameplateStyleStatus();
    },
	  };

  Object.assign(pageWindow.HordesKrMod, {
    runtimeDebug: () => getRuntimeDebugReport(),
    runtimeDebugText: () => stringifyRuntimeDebugReport(),
    runtimeProbeNow: () => {
      runRuntimeProbeNow();
      return getRuntimeDebugReport();
    },
    debugRuntime: () => getRuntimeDebugReport(),
    diagnostics: () => getRuntimeDebugReport(),
  });

  function loadJsonConfig(key, defaults) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...defaults };

      const parsed = JSON.parse(raw);
      return isObject(parsed) ? { ...defaults, ...parsed } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  function saveJsonConfig(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in strict browser modes.
    }
  }

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  }

  function setTranslationEnabled(nextEnabled) {
    const enabled = Boolean(nextEnabled);
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
    FEATURE_CONFIG.domTranslationEnabled = enabled;
    saveFeatureConfig();
    CACHE.clear();

    if (enabled) {
      initDomTranslator();
    } else {
      stopDomTranslator();
    }

    setStatus({
      lastState: enabled ? "켜짐 - 새로고침 필요" : "꺼짐 - 새로고침 필요",
      lastError: "",
    });

    console.info(
      enabled
        ? "[Hordes KR Mod] Korean localization enabled. Refresh the page to apply from startup."
        : "[Hordes KR Mod] Korean localization disabled. Refresh the page to restore the game locale."
    );
    return enabled;
  }

  function saveFeatureConfig() {
    saveJsonConfig(FEATURE_CONFIG_KEY, FEATURE_CONFIG);
  }

  function savePartyUiConfig() {
    saveJsonConfig(PARTY_UI_CONFIG_KEY, PARTY_UI_CONFIG);
  }

  function savePartyCommandConfig() {
    saveJsonConfig(PARTY_COMMAND_CONFIG_KEY, PARTY_COMMAND_CONFIG);
  }

  function isDomTranslationEnabled() {
    return isEnabled() && FEATURE_CONFIG.domTranslationEnabled !== false;
  }

  function isTargetDistanceEnabled() {
    return FEATURE_CONFIG.targetDistanceEnabled !== false;
  }

  function isIncomingSkillOverlayEnabled() {
    return FEATURE_CONFIG.incomingSkillOverlayEnabled !== false;
  }

  function isIncomingSkillListEnabled() {
    return false;
  }

  function isIncomingTargetWatchEnabled() {
    return FEATURE_CONFIG.incomingTargetWatchEnabled !== false;
  }

  function isChatTranslationEnabled() {
    return FEATURE_CONFIG.chatTranslationEnabled === true;
  }

  function getChatTranslationApiKey() {
    try {
      return String(localStorage.getItem(CHAT_TRANSLATION_API_KEY_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function hasChatTranslationApiKey() {
    return Boolean(getChatTranslationApiKey());
  }

  function setChatTranslationEnabled(nextEnabled) {
    const enabled = Boolean(nextEnabled);

    if (enabled && !hasChatTranslationApiKey()) {
      FEATURE_CONFIG.chatTranslationEnabled = false;
      saveFeatureConfig();
      stopChatTranslator();
      CHAT_TRANSLATION_STATE.lastError = "API 키 없음";
      setStatus({
        lastState: "채팅번역 키 없음",
        lastError: "메인 패널의 채팅 번역 키에서 API 키를 저장하세요.",
      });
      updateChatTranslationQuickToggle(true);
      return false;
    }

    FEATURE_CONFIG.chatTranslationEnabled = enabled;
    saveFeatureConfig();

    if (enabled) {
      CHAT_TRANSLATION_STATE.lastError = "";
      startChatTranslator();
      setStatus({
        lastState: "채팅번역 켜짐",
        lastError: "",
      });
    } else {
      stopChatTranslator();
      restoreChatTranslations();
      setStatus({
        lastState: "채팅번역 꺼짐",
        lastError: "",
      });
    }

    updateChatTranslationQuickToggle(true);
    return FEATURE_CONFIG.chatTranslationEnabled;
  }

  function setChatTranslationApiKey(apiKey) {
    const normalized = String(apiKey || "").trim();
    try {
      if (normalized) {
        localStorage.setItem(CHAT_TRANSLATION_API_KEY_KEY, normalized);
      } else {
        localStorage.removeItem(CHAT_TRANSLATION_API_KEY_KEY);
      }
    } catch {
      CHAT_TRANSLATION_STATE.lastError = "API 키 저장 실패";
      return false;
    }

    CHAT_TRANSLATION_STATE.lastError = "";
    CHAT_TRANSLATION_STATE.quotaBlockedUntil = 0; // new key → clear the quota breaker
    if (!normalized && isChatTranslationEnabled()) {
      FEATURE_CONFIG.chatTranslationEnabled = false;
      saveFeatureConfig();
      stopChatTranslator();
      restoreChatTranslations();
    }

    if (normalized && isChatTranslationEnabled()) startChatTranslator();
    setStatus({
      lastState: normalized ? "채팅번역 API 키 저장됨" : "채팅번역 API 키 삭제됨",
      lastError: "",
    });
    updateChatTranslationQuickToggle(true);
    return Boolean(normalized);
  }

  function clearChatTranslationApiKey() {
    return !setChatTranslationApiKey("");
  }

  function getChatTranslationModel() {
    try {
      return String(localStorage.getItem(CHAT_TRANSLATION_MODEL_KEY) || CHAT_TRANSLATION_DEFAULT_MODEL).trim() || CHAT_TRANSLATION_DEFAULT_MODEL;
    } catch {
      return CHAT_TRANSLATION_DEFAULT_MODEL;
    }
  }

  function migrateChatTranslationDefaultModel() {
    try {
      const migratedVersion = localStorage.getItem(CHAT_TRANSLATION_MODEL_MIGRATION_KEY);
      if (migratedVersion === CHAT_TRANSLATION_MODEL_MIGRATION_VERSION) return;

      const currentModel = String(localStorage.getItem(CHAT_TRANSLATION_MODEL_KEY) || "").trim();
      if (!currentModel || CHAT_TRANSLATION_PREVIOUS_DEFAULT_MODELS.has(currentModel)) {
        localStorage.setItem(CHAT_TRANSLATION_MODEL_KEY, CHAT_TRANSLATION_DEFAULT_MODEL);
      }
      localStorage.setItem(CHAT_TRANSLATION_MODEL_MIGRATION_KEY, CHAT_TRANSLATION_MODEL_MIGRATION_VERSION);
    } catch {
      // Model migration is best-effort; getChatTranslationModel still has a safe default.
    }
  }

  function setChatTranslationModel(model) {
    const normalized = String(model || "").trim() || CHAT_TRANSLATION_DEFAULT_MODEL;
    try {
      localStorage.setItem(CHAT_TRANSLATION_MODEL_KEY, normalized);
    } catch {
      CHAT_TRANSLATION_STATE.lastError = "모델 저장 실패";
      return getChatTranslationModel();
    }
    return normalized;
  }

  function syncGroupedHighlightConfig(enabled) {
    HIGHLIGHT_CONFIG.enabled = Boolean(enabled);
    HIGHLIGHT_CONFIG.domEnabled = HIGHLIGHT_CONFIG.enabled;
    HIGHLIGHT_CONFIG.canvasEnabled = HIGHLIGHT_CONFIG.enabled;
    HIGHLIGHT_CONFIG.hideClanNames = HIGHLIGHT_CONFIG.enabled;
    HIGHLIGHT_CONFIG.runtimeOverlayEnabled = true;
  }

  function setNameHighlightEnabled(nextEnabled) {
    syncGroupedHighlightConfig(nextEnabled);
    saveHighlightConfig();
    refreshNameHighlights();
    updateRuntimeNameOverlay();
    renderStatusUi();
    return HIGHLIGHT_CONFIG.enabled;
  }

  function setSelfHighlightEnabled(nextEnabled) {
    HIGHLIGHT_CONFIG.selfHighlight = Boolean(nextEnabled);
    saveHighlightConfig();
    HIGHLIGHT_NAME_CACHE.key = ""; // force the match cache to rebuild with/without self
    refreshNameHighlights();
    updateRuntimeNameOverlay();
    renderStatusUi();
    return HIGHLIGHT_CONFIG.selfHighlight;
  }

  function shouldRunDomNameHighlight() {
    return (
      HIGHLIGHT_CONFIG.enabled &&
      HIGHLIGHT_CONFIG.domEnabled !== false &&
      HIGHLIGHT_CONFIG.names.length > 0
    );
  }

  // Names to draw in the DOM overlay: configured names when the main highlight is on,
  // plus the player's own name when "내 이름만 강조" is on.
  function getOverlayHighlightNames() {
    const out = HIGHLIGHT_CONFIG.enabled ? HIGHLIGHT_CONFIG.names.slice() : [];
    if (HIGHLIGHT_CONFIG.selfHighlight) {
      const self = getSelfPlayerName();
      if (self && out.indexOf(self) < 0) out.push(self);
    }
    return out;
  }

  function shouldRunRuntimeNameOverlay() {
    return (
      HIGHLIGHT_CONFIG.runtimeOverlayEnabled !== false &&
      (
        getOverlayHighlightNames().length > 0 ||
        isIncomingSkillOverlayEnabled() ||
        isIncomingTargetWatchEnabled()
      )
    );
  }

  function toUrl(input) {
    const rawUrl = typeof input === "string" ? input : input && input.url;
    if (!rawUrl) return null;

    try {
      return new URL(rawUrl, location.href);
    } catch {
      return null;
    }
  }

  function isLocalizationRequest(url) {
    return (
      url.origin === location.origin &&
      /^\/data\/loc\/[a-z0-9_-]+\.json$/i.test(url.pathname)
    );
  }

  async function buildKoreanLocalizationResponse(requestedUrl, transport) {
    const cacheKey = requestedUrl.search || "no-version";
    setStatus({
      interceptedCount: MOD_STATUS.interceptedCount + 1,
      lastRequest: `${requestedUrl.pathname}${requestedUrl.search}`,
      lastState: "언어팩 적용 중",
      lastError: "",
      lastTransport: transport || "unknown",
    });

    if (!CACHE.has(cacheKey)) {
      CACHE.set(cacheKey, loadPatchedKoreanLocalization(requestedUrl));
    }

    try {
      const loc = await CACHE.get(cacheKey);
      setStatus({
        lastState: "적용됨",
        lastAppliedAt: new Date(),
        lastError: "",
      });

      return new pageWindow.Response(JSON.stringify(loc), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Hordes-KR-Mod": MOD_VERSION,
        },
      });
    } catch (error) {
      setStatus({
        lastState: "오류",
        lastError: error && error.message ? error.message : String(error),
      });
      throw error;
    }
  }

  async function loadPatchedKoreanLocalization(requestedUrl) {
    const koUrl = new URL("/data/loc/ko.json", location.origin);
    koUrl.search = requestedUrl.search;

    try {
      const response = await originalFetch(koUrl.toString(), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`ko locale request failed: ${response.status}`);

      const koLoc = await response.json();
      setStatus({ source: "hordes.io ko.json + KR 패치" });
      return applyPatch(koLoc, KO_PATCH);
    } catch (error) {
      console.warn("[Hordes KR Mod] Failed to load ko locale. Falling back to requested locale with patches.", error);

      const response = await originalFetch(requestedUrl.toString(), { credentials: "same-origin" });
      const fallbackLoc = await response.json();
      setStatus({ source: "요청 언어팩 + KR 패치" });
      return applyPatch(fallbackLoc, KO_PATCH);
    }
  }

  function applyPatch(target, patch) {
    if (!isObject(patch)) return patch;
    if (!isObject(target)) target = Array.isArray(patch) ? [] : {};

    for (const [key, value] of Object.entries(patch)) {
      const normalizedKey = Array.isArray(target) && /^\d+$/.test(key) ? Number(key) : key;

      if (isObject(value)) {
        target[normalizedKey] = applyPatch(target[normalizedKey], value);
      } else {
        target[normalizedKey] = value;
      }
    }

    return target;
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function installXhrInterceptor() {
    if (!pageWindow.XMLHttpRequest) return;

    const proto = pageWindow.XMLHttpRequest.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const originalSetRequestHeader = proto.setRequestHeader;

    proto.open = function patchedOpen(method, rawUrl, async, user, password) {
      const url = toUrl(rawUrl);
      this.__hordesKrLocUrl = url && isEnabled() && isLocalizationRequest(url) ? url : null;
      this.__hordesKrAsync = async !== false;
      this.__hordesKrHeaders = {};

      if (this.__hordesKrLocUrl) {
        defineXhrValue(this, "readyState", 1);
        fireXhrEvent(this, "readystatechange");
        return undefined;
      }

      return originalOpen.call(this, method, rawUrl, async, user, password);
    };

    proto.setRequestHeader = function patchedSetRequestHeader(name, value) {
      if (this.__hordesKrLocUrl) {
        this.__hordesKrHeaders[String(name).toLowerCase()] = value;
        return undefined;
      }

      return originalSetRequestHeader.call(this, name, value);
    };

    proto.send = function patchedSend(body) {
      if (!this.__hordesKrLocUrl) {
        return originalSend.call(this, body);
      }

      if (!this.__hordesKrAsync) {
        setStatus({
          lastState: "오류",
          lastError: "동기 XHR 언어팩 요청은 패치하지 않음",
          lastTransport: "xhr",
        });
        return undefined;
      }

      fulfillPatchedXhr(this, this.__hordesKrLocUrl);
      return undefined;
    };
  }

  async function fulfillPatchedXhr(xhr, url) {
    try {
      fireXhrEvent(xhr, "loadstart");
      defineXhrValue(xhr, "readyState", 2);
      fireXhrEvent(xhr, "readystatechange");

      const response = await buildKoreanLocalizationResponse(url, "xhr");
      const body = await response.text();
      const parsedResponse = xhr.responseType === "json" ? JSON.parse(body) : body;

      xhr.getResponseHeader = (name) =>
        String(name).toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null;
      xhr.getAllResponseHeaders = () => "content-type: application/json; charset=utf-8\r\n";

      defineXhrValue(xhr, "status", 200);
      defineXhrValue(xhr, "statusText", "OK");
      defineXhrValue(xhr, "responseURL", url.toString());
      defineXhrValue(xhr, "responseText", body);
      defineXhrValue(xhr, "response", parsedResponse);
      defineXhrValue(xhr, "readyState", 4);

      fireXhrEvent(xhr, "readystatechange");
      fireXhrEvent(xhr, "load");
      fireXhrEvent(xhr, "loadend");
    } catch (error) {
      defineXhrValue(xhr, "status", 500);
      defineXhrValue(xhr, "statusText", "Hordes KR Mod Error");
      defineXhrValue(xhr, "readyState", 4);
      setStatus({
        lastState: "오류",
        lastError: error && error.message ? error.message : String(error),
        lastTransport: "xhr",
      });
      fireXhrEvent(xhr, "readystatechange");
      fireXhrEvent(xhr, "error");
      fireXhrEvent(xhr, "loadend");
    }
  }

  function defineXhrValue(xhr, name, value) {
    Object.defineProperty(xhr, name, {
      configurable: true,
      get() {
        return value;
      },
    });
  }

  function fireXhrEvent(xhr, type) {
    const event = typeof pageWindow.ProgressEvent === "function" ? new pageWindow.ProgressEvent(type) : new pageWindow.Event(type);
    try {
      xhr.dispatchEvent(event);
    } catch {
      // Some browsers are strict about synthetic XHR events.
    }

    const handler = xhr[`on${type}`];
    if (typeof handler === "function") {
      handler.call(xhr, event);
    }
  }

  async function initDomTranslator() {
    if (!isDomTranslationEnabled()) return;
    if (DOM_TRANSLATION_STATE.loading) return;
    if (DOM_TRANSLATION_STATE.dictionary) {
      startDomTranslator();
      return;
    }

    DOM_TRANSLATION_STATE.loading = true;
    try {
      const enUrl = new URL("/data/loc/en.json", location.origin);
      const [enResponse, koLoc] = await Promise.all([
        originalFetch(enUrl.toString(), { credentials: "same-origin" }),
        loadPatchedKoreanLocalization(enUrl),
      ]);

      if (!enResponse.ok) throw new Error(`en locale request failed: ${enResponse.status}`);

      const enLoc = await enResponse.json();
      const dictionary = buildTextDictionary(enLoc, koLoc);
      DOM_TRANSLATION_STATE.dictionary = dictionary;

      setStatus({
        lastState: "DOM 번역 준비됨",
        source: "DOM 텍스트 치환 + ko.json + KR 패치",
        lastError: "",
      });

      const start = () => {
        startDomTranslator();
      };

      if (document.body) {
        start();
      } else {
        document.addEventListener("DOMContentLoaded", start, { once: true });
      }
    } catch (error) {
      setStatus({
        lastState: "DOM 번역 오류",
        lastError: error && error.message ? error.message : String(error),
      });
    } finally {
      DOM_TRANSLATION_STATE.loading = false;
    }
  }

  function startDomTranslator() {
    const dictionary = DOM_TRANSLATION_STATE.dictionary;
    if (!isDomTranslationEnabled() || !dictionary || !document.body) return;

    applyDomTranslation(document.body);
    if (DOM_TRANSLATION_STATE.observer) return;

    DOM_TRANSLATION_STATE.observer = new MutationObserver((mutations) => {
      if (!isDomTranslationEnabled()) return;

      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (!shouldSkipNode(mutation.target)) DOM_TRANSLATION_STATE.queuedRoots.add(mutation.target);
        } else {
          mutation.addedNodes.forEach((node) => {
            if (!shouldSkipNode(node)) DOM_TRANSLATION_STATE.queuedRoots.add(node);
          });
        }
      }

      scheduleDomTranslationFlush();
    });

    DOM_TRANSLATION_STATE.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function stopDomTranslator() {
    if (DOM_TRANSLATION_STATE.observer) {
      DOM_TRANSLATION_STATE.observer.disconnect();
      DOM_TRANSLATION_STATE.observer = null;
    }

    DOM_TRANSLATION_STATE.pending = false;
    DOM_TRANSLATION_STATE.queuedRoots.clear();
  }

  function initChatTranslator() {
    const start = () => {
      installChatTranslationStyle();
      ensureChatTranslationQuickToggleHost();
      updateChatTranslationQuickToggle();
      startChatTranslationQuickTogglePositioner();
      if (isChatTranslationEnabled()) startChatTranslator();
    };

    if (document.body) {
      start();
    } else {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    }
  }

  function startChatTranslator() {
    if (!isChatTranslationEnabled() || !document.body) return;
    if (!hasChatTranslationApiKey()) {
      FEATURE_CONFIG.chatTranslationEnabled = false;
      saveFeatureConfig();
      stopChatTranslator();
      CHAT_TRANSLATION_STATE.lastError = "API 키 없음";
      setStatus({
        lastState: "채팅번역 키 없음",
        lastError: "메인 패널의 채팅 번역 키에서 API 키를 저장하세요.",
      });
      updateChatTranslationQuickToggle(true);
      return;
    }
    installChatTranslationStyle();

    if (!CHAT_TRANSLATION_STATE.observer) {
      CHAT_TRANSLATION_STATE.observer = new MutationObserver((mutations) => {
        if (!isChatTranslationEnabled()) return;

        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (isChatTranslationNode(node)) return;
              if (isLikelyChatRootNode(node)) observeChatTranslationRoots();
              if (isNodeInsideChat(node)) scheduleChatTranslationScan();
            });
          } else if (mutation.type === "characterData" && isNodeInsideChat(mutation.target)) {
            if (isChatTranslationNode(mutation.target)) continue;
            scheduleChatTranslationScan();
          }
        }
      });

      observeChatTranslationRoots();
    }

    scheduleChatTranslationScan();
  }

  function stopChatTranslator() {
    if (CHAT_TRANSLATION_STATE.observer) {
      CHAT_TRANSLATION_STATE.observer.disconnect();
      CHAT_TRANSLATION_STATE.observer = null;
    }

    CHAT_TRANSLATION_STATE.pendingScan = false;
    CHAT_TRANSLATION_STATE.observedRootKey = "";
    CHAT_TRANSLATION_STATE.queue.length = 0;
    CHAT_TRANSLATION_STATE.queuedKeys.clear();
  }

  function scheduleChatTranslationScan() {
    if (!isChatTranslationEnabled() || CHAT_TRANSLATION_STATE.pendingScan) return;
    if (!hasChatTranslationApiKey()) {
      CHAT_TRANSLATION_STATE.lastError = "API 키 없음";
      renderStatusUi();
      return;
    }
    CHAT_TRANSLATION_STATE.pendingScan = true;

    setTimeout(() => {
      CHAT_TRANSLATION_STATE.pendingScan = false;
      if (!isChatTranslationEnabled()) return;
      observeChatTranslationRoots();
      scanChatForTranslations();
      processChatTranslationQueue();
    }, CHAT_TRANSLATION_SCAN_DELAY_MS);
  }

  function observeChatTranslationRoots() {
    const observer = CHAT_TRANSLATION_STATE.observer;
    if (!observer || !document.body) return;

    const roots = getChatRoots();
    const observedRoots = roots.length > 0 ? roots.slice(0, 4) : [document.body];
    const key = observedRoots.map(getChatRootKey).join("|");
    if (CHAT_TRANSLATION_STATE.observedRootKey === key) return;

    observer.disconnect();
    CHAT_TRANSLATION_STATE.observedRootKey = key;
    observedRoots.forEach((root) => {
      observer.observe(root, {
        childList: true,
        characterData: root !== document.body,
        subtree: true,
      });
    });
  }

  function getChatRootKey(root) {
    if (!root) return "";
    if (root === document.body) return "body";
    return [
      root.id || "",
      String(root.className || ""),
      getElementSelector(root),
    ].join(":");
  }

  function isLikelyChatRootNode(node) {
    const element = node && node.nodeType === Node.ELEMENT_NODE ? node : null;
    if (!element) return false;
    if (element.id === "chat" || element.matches(".chat, [class*='chat'], [id*='chat'], [class*='Chat'], [id*='Chat']")) return true;
    return Boolean(element.querySelector && element.querySelector("#chat, .chat, [class*='chat'], [id*='chat'], [class*='Chat'], [id*='Chat']"));
  }

  function scanChatForTranslations() {
    const roots = getChatRoots();
    for (const root of roots) {
      const elements = getChatMessageElements(root);
      const recentBottomFirst = elements.slice(-CHAT_TRANSLATION_SCAN_LIMIT).reverse();
      for (const element of recentBottomFirst) {
        enqueueChatTranslation(element);
      }
    }
    prioritizeChatTranslationQueue();
    trimChatTranslationQueue();
  }

  function getChatRoots() {
    if (!document.body) return [];

    const primary = document.getElementById("chat");
    if (primary && !shouldSkipChatRoot(primary)) {
      return [primary];
    }

    const selectors = [
      ".chat",
      "[class*='chat']",
      "[id*='chat']",
      "[class*='Chat']",
      "[id*='Chat']",
    ];
    const roots = [];
    const seen = new WeakSet();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element || seen.has(element) || shouldSkipChatRoot(element)) return;
        seen.add(element);
        roots.push(element);
      });
    }

    return roots.slice(0, 8);
  }

  function shouldSkipChatRoot(element) {
    if (!element || element.closest("#hordes-kr-mod-status-root")) return true;
    if (element.closest("#hordes-kr-chat-translation-toggle")) return true;
    if (element.id === "chatinput" || element.closest("#chatinput")) return true;
    if (element.matches(".chatsection, .commandlist, [class*='commandlist'], [class*='CommandList']")) return true;
    if (element.matches("input, textarea, button, select, option, canvas, script, style")) return true;
    if (element.closest("input, textarea, canvas")) return true;
    const text = normalizeText(element.textContent || "");
    return text.length < 2;
  }

  function getChatMessageElements(root) {
    const linewrapNodes = [
      ...(root.matches && root.matches(".linewrap") ? [root] : []),
      ...getRecentChatElements(root, ".linewrap"),
    ];
    const linewraps = linewrapNodes
      .slice(-(CHAT_TRANSLATION_SCAN_LIMIT * 3))
      .filter(isLikelyChatMessageElement);
    if (linewraps.length > 0) return linewraps;

    const preferredSelectors = [
      "[class*='message']",
      "[class*='Message']",
      "[class*='msg']",
      "[class*='Msg']",
      "[class*='line']",
      "[class*='Line']",
      "[class*='entry']",
      "[class*='Entry']",
    ];
    const preferred = [];
    const seen = new WeakSet();

    for (const selector of preferredSelectors) {
      getRecentChatElements(root, selector).forEach((element) => {
        if (!seen.has(element) && isLikelyChatMessageElement(element)) {
          seen.add(element);
          preferred.push(element);
        }
      });
    }

    if (preferred.length > 0) return preferred;

    const children = Array.from(root.children || []);
    const direct = children.filter(isLikelyChatMessageElement);
    if (direct.length > 0) return direct;

    return getRecentChatElements(root, "div, li, p")
      .filter(isLikelyChatMessageElement);
  }

  function getRecentChatElements(root, selector) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    return Array.from(root.querySelectorAll(selector)).slice(-(CHAT_TRANSLATION_SCAN_LIMIT * 3));
  }

  function isLikelyChatMessageElement(element) {
    if (!element || element.closest("#hordes-kr-mod-status-root")) return false;
    if (element.closest("#hordes-kr-chat-translation-toggle")) return false;
    if (element.matches("input, textarea, button, select, option, canvas, script, style")) return false;
    if (element.querySelector(".hordes-kr-chat-translation")) return false;

    const payload = extractChatMessagePayload(element);
    return shouldTranslateChatPayload(payload);
  }

  function enqueueChatTranslation(element) {
    if (!element || element.dataset.hordesKrChatTranslation === "done") return;
    if (element.dataset.hordesKrChatTranslation === "pending") return;
    if (element.dataset.hordesKrChatTranslation === "skip") return;

    const payload = extractChatMessagePayload(element);
    if (!shouldTranslateChatPayload(payload)) {
      element.dataset.hordesKrChatTranslation = "skip";
      CHAT_TRANSLATION_STATE.skippedCount++;
      return;
    }

    const key = normalizeChatTranslationKey(`${payload.channel}:${payload.text}`);
    const cached = getCachedChatTranslation(key);
    if (cached) {
      CHAT_TRANSLATION_STATE.cacheHits++;
      appendChatTranslation(element, cached, payload.text);
      return;
    }

    if (CHAT_TRANSLATION_STATE.queuedKeys.has(key)) return;

    element.dataset.hordesKrChatTranslation = "pending";
    CHAT_TRANSLATION_STATE.queuedKeys.add(key);
    CHAT_TRANSLATION_STATE.queue.push({
      element,
      text: payload.text,
      channel: payload.channel,
      key,
      rawText: payload.rawText,
      mode: payload.mode,
      enqueuedAt: Date.now(),
    });
    trimChatTranslationQueue();
  }

  // Record a chat-translation failure. If it's an OpenAI 429 / quota / billing error,
  // trip a circuit breaker: drop the backlog and stop sending requests for a cooldown,
  // so a dead key can't drag performance (each failing request hangs ~12s) or back up
  // the queue. The user gets one clear toast instead of silent, slow failures.
  function noteChatTranslationFailure(message) {
    const msg = String(message == null ? "" : message);
    CHAT_TRANSLATION_STATE.lastError = msg.slice(0, 260);
    const isQuota = /\b429\b/.test(msg) || /quota|insufficient_quota|billing|exceeded your current quota/i.test(msg);
    if (isQuota) {
      const wasBlocked = Date.now() < CHAT_TRANSLATION_STATE.quotaBlockedUntil;
      CHAT_TRANSLATION_STATE.quotaBlockedUntil = Date.now() + CHAT_TRANSLATION_QUOTA_COOLDOWN_MS;
      CHAT_TRANSLATION_STATE.queue.length = 0;
      CHAT_TRANSLATION_STATE.queuedKeys.clear();
      if (!wasBlocked) {
        try { showGearPresetProgressOverlay("채팅 번역 일시중단: OpenAI 크레딧/할당량 소진(429). platform.openai.com 결제 확인 필요", "error", 6000); } catch { /* toast optional */ }
      }
    }
  }

  function processChatTranslationQueue() {
    if (!isChatTranslationEnabled()) return;
    // Quota circuit-breaker: skip sending while cooling down, then probe once.
    if (Date.now() < CHAT_TRANSLATION_STATE.quotaBlockedUntil) return;

    prioritizeChatTranslationQueue();
    trimChatTranslationQueue();

    while (
      CHAT_TRANSLATION_STATE.activeRequests < CHAT_TRANSLATION_MAX_CONCURRENT &&
      CHAT_TRANSLATION_STATE.queue.length > 0
    ) {
      const batch = takeChatTranslationBatch();
      if (batch.length === 0) continue;

      CHAT_TRANSLATION_STATE.activeRequests++;
      processChatTranslationBatch(batch).finally(() => {
        CHAT_TRANSLATION_STATE.activeRequests = Math.max(0, CHAT_TRANSLATION_STATE.activeRequests - 1);
        renderStatusUi();
        processChatTranslationQueue();
      });
    }
  }

  function takeChatTranslationBatch() {
    const batch = [];
    while (CHAT_TRANSLATION_STATE.queue.length > 0 && batch.length < CHAT_TRANSLATION_BATCH_SIZE) {
      const item = CHAT_TRANSLATION_STATE.queue.shift();
      if (!item) continue;

      CHAT_TRANSLATION_STATE.queuedKeys.delete(item.key);
      if (!isQueuedChatTranslationItemUsable(item)) continue;
      batch.push(item);
    }
    return batch;
  }

  function isQueuedChatTranslationItemUsable(item) {
    if (!item || !item.element || !document.contains(item.element)) return false;
    if (item.element.dataset.hordesKrChatTranslation === "done") return false;
    if (item.element.dataset.hordesKrChatTranslation === "skip") return false;
    return true;
  }

  function prioritizeChatTranslationQueue() {
    CHAT_TRANSLATION_STATE.queue.sort(compareChatTranslationQueueItems);
  }

  function compareChatTranslationQueueItems(left, right) {
    if (left.element && right.element && left.element !== right.element && typeof left.element.compareDocumentPosition === "function") {
      const relation = left.element.compareDocumentPosition(right.element);
      const NodeCtor = pageWindow.Node || Node;
      if (relation & NodeCtor.DOCUMENT_POSITION_FOLLOWING) return 1;
      if (relation & NodeCtor.DOCUMENT_POSITION_PRECEDING) return -1;
    }

    return (right.enqueuedAt || 0) - (left.enqueuedAt || 0);
  }

  function trimChatTranslationQueue() {
    while (CHAT_TRANSLATION_STATE.queue.length > CHAT_TRANSLATION_MAX_QUEUE) {
      const dropped = CHAT_TRANSLATION_STATE.queue.pop();
      if (!dropped) return;

      CHAT_TRANSLATION_STATE.queuedKeys.delete(dropped.key);
      if (
        dropped.element &&
        dropped.element.dataset &&
        dropped.element.dataset.hordesKrChatTranslation === "pending"
      ) {
        dropped.element.dataset.hordesKrChatTranslation = "skip";
      }
      CHAT_TRANSLATION_STATE.droppedCount++;
    }
  }

  async function processChatTranslationItem(item) {
    try {
      CHAT_TRANSLATION_STATE.lastChannel = item.channel || "";
      const translation = await translateChatMessage(item.text);
      if (!isChatTranslationEnabled() || !document.contains(item.element)) return;
      rememberChatTranslation(item.key, translation);
      appendChatTranslation(item.element, translation, item.text);
    } catch (error) {
      item.element.dataset.hordesKrChatTranslation = "error";
      noteChatTranslationFailure(error && error.message ? error.message : String(error));
    }
  }

  async function processChatTranslationBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) return;
    if (batch.length === 1) {
      await processChatTranslationItem(batch[0]);
      return;
    }

    try {
      CHAT_TRANSLATION_STATE.lastChannel = batch[0].channel || "";
      const translations = await translateChatMessages(batch.map((item) => item.text));

      batch.forEach((item, index) => {
        const translation = translations[index] || "";
        if (!translation || !isChatTranslationEnabled() || !document.contains(item.element)) return;
        rememberChatTranslation(item.key, translation);
        appendChatTranslation(item.element, translation, item.text);
      });
    } catch (error) {
      for (const item of batch) {
        if (item.element && item.element.dataset) {
          item.element.dataset.hordesKrChatTranslation = "error";
        }
      }
      noteChatTranslationFailure(error && error.message ? error.message : String(error));
    }
  }

  async function translateChatMessage(text) {
    const normalizedText = String(text || "").trim();
    if (!normalizedText) throw new Error("번역할 채팅이 비어 있습니다.");

    CHAT_TRANSLATION_STATE.lastText = normalizedText.slice(0, 220);

    const localTranslation = translateChatMessageLocally(normalizedText);
    if (localTranslation) {
      recordChatTranslationResult(localTranslation, true);
      return localTranslation;
    }

    const apiKey = getChatTranslationApiKey();
    if (!apiKey) throw new Error("채팅번역 API 키가 없습니다. 메인 패널의 채팅 번역 키에서 저장하세요.");

    const inFlightKey = normalizeChatTranslationKey(normalizedText);
    const existingRequest = CHAT_TRANSLATION_STATE.inFlight.get(inFlightKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const response = await requestOpenAiChatTranslation(apiKey, normalizedText);
      const translation = sanitizeChatTranslation(extractOpenAiText(response));
      if (!translation) throw new Error("번역 결과가 비어 있습니다.");
      recordChatTranslationResult(translation, false);
      return translation;
    })();

    CHAT_TRANSLATION_STATE.inFlight.set(inFlightKey, request);
    try {
      return await request;
    } finally {
      CHAT_TRANSLATION_STATE.inFlight.delete(inFlightKey);
    }
  }

  function recordChatTranslationResult(translation, localHit) {
    CHAT_TRANSLATION_STATE.translatedCount++;
    if (localHit) {
      CHAT_TRANSLATION_STATE.localHitCount++;
      CHAT_TRANSLATION_STATE.lastTransport = "local";
      CHAT_TRANSLATION_STATE.lastRequestDurationMs = 0;
    }
    CHAT_TRANSLATION_STATE.lastTranslation = String(translation || "").slice(0, 220);
    CHAT_TRANSLATION_STATE.lastAt = new Date();
    CHAT_TRANSLATION_STATE.lastError = "";
  }

  function translateChatMessageLocally(text) {
    const normalized = normalizeLocalChatPhrase(text);
    if (!normalized) return "";

    const warOrder = translateWarOrderLocally(normalized);
    if (warOrder) return warOrder;

    const exact = CHAT_TRANSLATION_LOCAL_EXACT.get(normalized);
    if (exact) return exact;

    const focusFirstMatch = normalized.match(/^focus\s+(.{2,36})\s+first$/);
    if (focusFirstMatch) return `${restoreLocalChatTermCase(text, focusFirstMatch[1])} 먼저 집중`;

    const killFirstMatch = normalized.match(/^kill\s+(.{2,36})\s+first$/);
    if (killFirstMatch) return `${restoreLocalChatTermCase(text, killFirstMatch[1])} 먼저 처치`;

    const focusMatch = normalized.match(/^focus\s+(.{2,40})$/);
    if (focusMatch) return `${restoreLocalChatTermCase(text, focusMatch[1])} 집중`;

    const killMatch = normalized.match(/^kill\s+(.{2,40})$/);
    if (killMatch) return `${restoreLocalChatTermCase(text, killMatch[1])} 처치`;

    const needMatch = normalized.match(/^need\s+(.{2,40})$/);
    if (needMatch) return `${restoreLocalChatTermCase(text, needMatch[1])} 필요해요`;

    const whereMatch = normalized.match(/^where\s+(?:is|are)\s+(.{2,40})\??$/);
    if (whereMatch) return `${restoreLocalChatTermCase(text, whereMatch[1])} 어디인가요?`;

    return "";
  }

  function translateWarOrderLocally(normalized) {
    const text = String(normalized || "")
      .replace(/[!]+$/g, "")
      .replace(/\s*,\s*/g, " ")
      .trim();
    if (!text) return "";

    if (/^(?:g|r)$/.test(text)) return "지금!";
    if (/^on\s*me$/.test(text)) return "내 위로 광역스킬";

    const rawOrder = parseWarOrderParts(text, "raw", new Set(["left", "right", "mid", "middle"]));
    if (rawOrder) {
      const direction = formatWarOrderDirection(rawOrder.direction);
      const prefix = rawOrder.seconds ? `${rawOrder.seconds}초 뒤 ` : "";
      return `${prefix}${direction ? `${direction} ` : ""}봇들 정리하자`;
    }

    const aoeOrder = parseWarOrderParts(text, null, new Set(["deep", "mid", "middle"]));
    if (aoeOrder && aoeOrder.hasAnyDirection) {
      const prefix = aoeOrder.seconds ? `${aoeOrder.seconds}초 뒤 ` : "";
      return `${prefix}중앙으로 광역스킬`;
    }

    return "";
  }

  function parseWarOrderParts(text, requiredCommand, allowedWords) {
    const parts = String(text || "").split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;

    if (requiredCommand) {
      if (parts[0] !== requiredCommand) return null;
      parts.shift();
    }

    let seconds = "";
    let direction = "";
    let hasAnyDirection = false;

    for (const part of parts) {
      if (/^\d{1,2}$/.test(part) && !seconds) {
        seconds = part;
      } else if (allowedWords.has(part) && !direction) {
        direction = part;
        hasAnyDirection = true;
      } else if (allowedWords.has(part)) {
        hasAnyDirection = true;
      } else {
        return null;
      }
    }

    return { seconds, direction, hasAnyDirection };
  }

  function formatWarOrderDirection(direction) {
    if (direction === "left") return "왼쪽";
    if (direction === "right") return "오른쪽";
    if (direction === "mid" || direction === "middle") return "중앙";
    return "";
  }

  function normalizeLocalChatPhrase(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/\s+([?!.,])$/g, "$1")
      .replace(/[.]+$/g, "")
      .trim();
  }

  function restoreLocalChatTermCase(sourceText, normalizedTerm) {
    const term = String(normalizedTerm || "").trim();
    if (!term) return "";

    const source = String(sourceText || "");
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(escaped, "i"));
    return (match ? match[0] : term).trim();
  }

  async function translateChatMessages(texts) {
    const normalizedTexts = texts
      .map((text) => String(text || "").trim())
      .filter(Boolean);
    if (normalizedTexts.length === 0) return [];
    if (normalizedTexts.length === 1) return [await translateChatMessage(normalizedTexts[0])];

    const results = new Array(normalizedTexts.length);
    const remoteItems = [];
    normalizedTexts.forEach((text, index) => {
      const localTranslation = translateChatMessageLocally(text);
      if (localTranslation) {
        results[index] = localTranslation;
        recordChatTranslationResult(localTranslation, true);
      } else {
        remoteItems.push({ index, text });
      }
    });

    if (remoteItems.length === 0) return results;

    const apiKey = getChatTranslationApiKey();
    if (!apiKey) throw new Error("채팅번역 API 키가 없습니다. 메인 패널의 채팅 번역 키에서 저장하세요.");

    CHAT_TRANSLATION_STATE.lastText = remoteItems[0].text.slice(0, 220);
    const response = await requestOpenAiChatTranslations(apiKey, remoteItems.map((item) => item.text));
    const translations = extractOpenAiTranslationArray(response, remoteItems.length)
      .map(sanitizeChatTranslation);

    if (translations.length !== remoteItems.length || translations.some((translation) => !translation)) {
      throw new Error("번역 결과 배열이 올바르지 않습니다.");
    }

    translations.forEach((translation, index) => {
      const item = remoteItems[index];
      results[item.index] = translation;
      recordChatTranslationResult(translation, false);
    });

    return results;
  }

  async function translateOutgoingChatFromQuickInput(input) {
    const source = String(input && input.value || "").trim();
    if (!source || CHAT_TRANSLATION_STATE.outgoingBusy) return null;

    try {
      CHAT_TRANSLATION_STATE.outgoingBusy = true;
      CHAT_TRANSLATION_STATE.outgoingLastError = "";
      updateChatTranslationQuickToggle(true);

      const translation = await translateOutgoingChatToEnglish(source);
      const inserted = insertTextIntoGameChatInput(translation);
      if (!inserted.ok) throw new Error(inserted.reason || "게임 채팅 입력칸을 찾지 못했습니다.");

      CHAT_TRANSLATION_STATE.outgoingLastInput = source.slice(0, 220);
      CHAT_TRANSLATION_STATE.outgoingLastTranslation = translation.slice(0, 220);
      CHAT_TRANSLATION_STATE.outgoingLastAt = new Date();
      CHAT_TRANSLATION_STATE.outgoingLastError = "";
      if (input) input.value = "";
      return { ok: true, input: source, translation };
    } catch (error) {
      CHAT_TRANSLATION_STATE.outgoingLastError = error && error.message ? error.message : String(error);
      return { ok: false, error: CHAT_TRANSLATION_STATE.outgoingLastError };
    } finally {
      CHAT_TRANSLATION_STATE.outgoingBusy = false;
      updateChatTranslationQuickToggle(true);
    }
  }

  async function translateOutgoingChatToGameInput(text) {
    const translation = await translateOutgoingChatToEnglish(text);
    const inserted = insertTextIntoGameChatInput(translation);
    if (!inserted.ok) throw new Error(inserted.reason || "게임 채팅 입력칸을 찾지 못했습니다.");
    return { ok: true, input: String(text || "").trim(), translation };
  }

  async function translateOutgoingChatToEnglish(text) {
    const normalizedText = String(text || "").trim();
    if (!normalizedText) throw new Error("영어로 번역할 문장이 비어 있습니다.");

    const apiKey = getChatTranslationApiKey();
    if (!apiKey) throw new Error("채팅번역 API 키가 없습니다. 메인 패널의 채팅 번역 키에서 저장하세요.");

    const inFlightKey = `out:${normalizeChatTranslationKey(normalizedText)}`;
    const existingRequest = CHAT_TRANSLATION_STATE.inFlight.get(inFlightKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const response = await requestOpenAiOutgoingChatTranslation(apiKey, normalizedText);
      const translation = sanitizeOutgoingChatTranslation(extractOpenAiText(response));
      if (!translation) throw new Error("영어 번역 결과가 비어 있습니다.");
      CHAT_TRANSLATION_STATE.lastText = normalizedText.slice(0, 220);
      CHAT_TRANSLATION_STATE.lastTranslation = translation.slice(0, 220);
      CHAT_TRANSLATION_STATE.lastAt = new Date();
      CHAT_TRANSLATION_STATE.lastError = "";
      return translation;
    })();

    CHAT_TRANSLATION_STATE.inFlight.set(inFlightKey, request);
    try {
      return await request;
    } finally {
      CHAT_TRANSLATION_STATE.inFlight.delete(inFlightKey);
    }
  }

  async function requestOpenAiOutgoingChatTranslation(apiKey, text) {
    const model = getChatTranslationModel();
    const body = {
      model,
      instructions:
        "Translate the Korean MMORPG chat message into concise natural English for in-game chat. Preserve player names, item names, skill names, place names, numbers, slash commands, abbreviations, URLs, and emojis. Return only the English chat message.",
      input: text,
      max_output_tokens: 80,
      store: false,
    };
    configureFastChatTranslationRequestBody(body, model);

    const raw = await requestTimedOpenAiResponses(apiKey, body);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI 응답 JSON 파싱 실패");
    }

    if (parsed.error) {
      throw new Error(parsed.error.message || "OpenAI API 오류");
    }

    return parsed;
  }

  function sanitizeOutgoingChatTranslation(text) {
    return String(text || "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CHAT_TRANSLATION_MAX_TEXT_LENGTH);
  }

  function insertTextIntoGameChatInput(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return { ok: false, reason: "입력할 영어 문장이 비어 있습니다." };

    const input = findGameChatInputElement();
    if (!input) return { ok: false, reason: "게임 채팅 입력칸을 찾지 못했습니다. 채팅창을 한 번 열고 다시 시도하세요." };

    setEditableElementValue(input, normalized);
    try {
      input.focus({ preventScroll: true });
    } catch {
      try {
        input.focus();
      } catch {}
    }
    return { ok: true, element: describeChatInputElement(input), text: normalized };
  }

  function findGameChatInputElement() {
    const root = document.getElementById("chatinput")
      || document.querySelector("#chat input, #chat textarea, #chat [contenteditable='true']")
      || document.querySelector(".chat input, .chat textarea, .chat [contenteditable='true']");
    if (!root) return null;
    if (isEditableChatInputElement(root)) return root;
    return root.querySelector && root.querySelector("input, textarea, [contenteditable='true'], [contenteditable='']");
  }

  function isEditableChatInputElement(element) {
    if (!element) return false;
    const tagName = String(element.tagName || "").toLowerCase();
    return tagName === "input" || tagName === "textarea" || element.isContentEditable;
  }

  function setEditableElementValue(element, value) {
    const tagName = String(element && element.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea") {
      const proto = tagName === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && typeof descriptor.set === "function") {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
    } else if (element && element.isContentEditable) {
      element.textContent = value;
    }

    const inputEvent = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: value })
      : new Event("input", { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function describeChatInputElement(element) {
    if (!element) return "";
    return [
      String(element.tagName || "").toLowerCase(),
      element.id ? `#${element.id}` : "",
      element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : "",
    ].join("");
  }

  async function requestOpenAiChatTranslation(apiKey, text) {
    const model = getChatTranslationModel();
    const body = {
      model,
      instructions:
        "Translate the MMORPG chat message into natural Korean. Keep player names, item names, skill names, place names, numbers, abbreviations, URLs, slash commands, and emojis unchanged. Return only the translation. Be brief.",
      input: text,
      max_output_tokens: 60,
      store: false,
    };
    configureFastChatTranslationRequestBody(body, model);

    const raw = await requestTimedOpenAiResponses(apiKey, body);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI 응답 JSON 파싱 실패");
    }

    if (parsed.error) {
      throw new Error(parsed.error.message || "OpenAI API 오류");
    }

    return parsed;
  }

  async function requestOpenAiChatTranslations(apiKey, texts) {
    const model = getChatTranslationModel();
    const body = {
      model,
      instructions:
        "Translate MMORPG chat messages into natural Korean. Keep player names, item names, skill names, place names, numbers, abbreviations, URLs, slash commands, and emojis unchanged. Return only a valid JSON array of brief Korean translations. The array length must match the input length.",
      input: JSON.stringify(texts.map((text, index) => ({ id: index + 1, text }))),
      max_output_tokens: Math.min(260, Math.max(80, texts.length * 55)),
      store: false,
    };
    configureFastChatTranslationRequestBody(body, model);

    CHAT_TRANSLATION_STATE.batchRequestCount++;
    const raw = await requestTimedOpenAiResponses(apiKey, body);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI 응답 JSON 파싱 실패");
    }

    if (parsed.error) {
      throw new Error(parsed.error.message || "OpenAI API 오류");
    }

    return parsed;
  }

  function configureFastChatTranslationRequestBody(body, model) {
    if (!body || !model) return;

    if (/^gpt-5\.(?:4|5)/i.test(model)) {
      body.reasoning = { effort: "none" };
      body.text = { verbosity: "low" };
      return;
    }

    if (/^gpt-5/i.test(model)) {
      body.reasoning = { effort: "minimal" };
    }
  }

  async function requestTimedOpenAiResponses(apiKey, body) {
    CHAT_TRANSLATION_STATE.requestCount++;
    const startedAt = Date.now();
    try {
      return await requestOpenAiResponses(apiKey, body);
    } finally {
      const duration = Date.now() - startedAt;
      CHAT_TRANSLATION_STATE.lastRequestDurationMs = duration;
      CHAT_TRANSLATION_STATE.averageRequestDurationMs = CHAT_TRANSLATION_STATE.averageRequestDurationMs === null
        ? duration
        : Math.round((CHAT_TRANSLATION_STATE.averageRequestDurationMs * 0.75) + (duration * 0.25));
    }
  }

  function requestOpenAiResponses(apiKey, body) {
    if (typeof GM_xmlhttpRequest === "function") {
      CHAT_TRANSLATION_STATE.lastTransport = "gm";
      return requestOpenAiViaGm(apiKey, body);
    }

    if (isOpenAiBridgeAvailable()) {
      CHAT_TRANSLATION_STATE.lastTransport = "bridge";
      return requestOpenAiViaBridge(apiKey, body).catch(() => {
        CHAT_TRANSLATION_STATE.lastTransport = "fetch-fallback";
        return requestOpenAiViaFetch(apiKey, body);
      });
    }

    CHAT_TRANSLATION_STATE.lastTransport = "fetch";
    return requestOpenAiViaFetch(apiKey, body);
  }

  function isOpenAiBridgeAvailable() {
    return Boolean(
      pageWindow.__HORDES_KR_OPENAI_BRIDGE_READY__ &&
      pageWindow.__HORDES_KR_OPENAI_BRIDGE_INSTALLED__
    );
  }

  function requestOpenAiViaGm(apiKey, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://api.openai.com/v1/responses",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        data: JSON.stringify(body),
        timeout: CHAT_TRANSLATION_TIMEOUT_MS,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText || "");
          } else {
            reject(new Error(`OpenAI API 오류: ${response.status} ${response.responseText || ""}`.slice(0, 260)));
          }
        },
        ontimeout() {
          reject(new Error("OpenAI 요청 시간 초과"));
        },
        onerror(error) {
          reject(new Error(error && error.error ? String(error.error) : "OpenAI 요청 실패"));
        },
      });
    });
  }

  function requestOpenAiViaBridge(apiKey, body) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const pageSentAt = Date.now();
      const timer = setTimeout(() => {
        pageWindow.removeEventListener("message", onMessage);
        reject(new Error("OpenAI 브리지 시간 초과"));
      }, CHAT_TRANSLATION_TIMEOUT_MS + 700);

      function onMessage(event) {
        const pageReceivedAt = Date.now();
        if (event.source !== pageWindow) return;
        const message = event.data;
        if (!message || message.source !== "HordesKrMod") return;
        if (message.type !== CHAT_TRANSLATION_BRIDGE_RESPONSE || message.id !== id) return;

        clearTimeout(timer);
        pageWindow.removeEventListener("message", onMessage);
        CHAT_TRANSLATION_STATE.lastBridgeTiming = buildOpenAiBridgeTiming(message.timing, pageSentAt, pageReceivedAt);
        if (message.ok) {
          resolve(message.responseText || "");
        } else {
          reject(new Error(`OpenAI 브리지 오류: ${message.status || 0} ${message.responseText || ""}`.slice(0, 260)));
        }
      }

      pageWindow.addEventListener("message", onMessage);
      pageWindow.postMessage({
        source: "HordesKrMod",
        type: CHAT_TRANSLATION_BRIDGE_REQUEST,
        id,
        apiKey,
        body,
        sentAt: pageSentAt,
      }, location.origin);
    });
  }

  function buildOpenAiBridgeTiming(timing, fallbackSentAt, pageReceivedAt) {
    const pageSentAt = Number(timing && timing.pageSentAt) || fallbackSentAt || null;
    const bridgeReceivedAt = Number(timing && timing.bridgeReceivedAt) || null;
    const gmStartAt = Number(timing && timing.gmStartAt) || null;
    const gmEndAt = Number(timing && timing.gmEndAt) || null;

    return {
      pageToBridgeMs: pageSentAt && bridgeReceivedAt ? bridgeReceivedAt - pageSentAt : null,
      bridgeQueueMs: bridgeReceivedAt && gmStartAt ? gmStartAt - bridgeReceivedAt : null,
      gmRequestMs: gmStartAt && gmEndAt ? gmEndAt - gmStartAt : null,
      bridgeToPageMs: gmEndAt && pageReceivedAt ? pageReceivedAt - gmEndAt : null,
      pageBridgeTotalMs: pageSentAt && pageReceivedAt ? pageReceivedAt - pageSentAt : null,
    };
  }

  async function requestOpenAiViaFetch(apiKey, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHAT_TRANSLATION_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`OpenAI fetch 오류: ${response.status} ${text}`.slice(0, 260));
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  function extractOpenAiText(response) {
    if (!response) return "";
    if (typeof response.output_text === "string") return response.output_text;

    const chunks = [];
    for (const output of response.output || []) {
      for (const content of output.content || []) {
        if (typeof content.text === "string") chunks.push(content.text);
      }
    }
    return chunks.join("\n").trim();
  }

  function extractOpenAiTranslationArray(response, expectedLength) {
    const text = extractOpenAiText(response);
    const parsed = parseOpenAiJsonPayload(text);
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.translations)
        ? parsed.translations
        : [];

    return values
      .slice(0, expectedLength)
      .map((value) => typeof value === "string" ? value : String(value && value.text ? value.text : ""));
  }

  function parseOpenAiJsonPayload(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) return null;
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
  }

  function sanitizeChatTranslation(text) {
    return String(text || "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/^\s*(?:번역|Translation|KR)\s*[:：]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260);
  }

  function rememberChatTranslation(key, translation) {
    CHAT_TRANSLATION_STATE.cache.set(key, {
      translation,
      expiresAt: Date.now() + CHAT_TRANSLATION_CACHE_TTL_MS,
    });
    if (CHAT_TRANSLATION_STATE.cache.size <= CHAT_TRANSLATION_MAX_CACHE) return;

    const firstKey = CHAT_TRANSLATION_STATE.cache.keys().next().value;
    CHAT_TRANSLATION_STATE.cache.delete(firstKey);
  }

  function getCachedChatTranslation(key) {
    const entry = CHAT_TRANSLATION_STATE.cache.get(key);
    if (!entry) return "";

    if (typeof entry === "string") return entry;
    if (!entry || typeof entry !== "object") {
      CHAT_TRANSLATION_STATE.cache.delete(key);
      return "";
    }

    if (Number(entry.expiresAt) <= Date.now()) {
      CHAT_TRANSLATION_STATE.cache.delete(key);
      return "";
    }

    return String(entry.translation || "");
  }

  function appendChatTranslation(element, translation, sourceText) {
    if (!element || !translation) return;
    if (element.dataset.hordesKrChatTranslation === "done") return;

    const scroller = getChatScrollContainer(element);
    const shouldKeepBottom = shouldKeepChatScrolledToBottom(scroller);
    const messageBody = getChatMessageBodyElement(element);

    if (messageBody) {
      element.querySelectorAll(".hordes-kr-chat-translation").forEach((node) => node.remove());
      if (!messageBody.dataset.hordesKrOriginalText) {
        messageBody.dataset.hordesKrOriginalText = String(sourceText || messageBody.textContent || "").trim();
      }
      messageBody.dataset.hordesKrTranslatedText = translation;
      messageBody.textContent = translation;
      messageBody.title = `원문: ${messageBody.dataset.hordesKrOriginalText}`;
      messageBody.classList.add("hordes-kr-chat-inline-translation");
      element.classList.add("hordes-kr-chat-line-translated");
      element.title = messageBody.title;
    } else {
      const line = document.createElement("span");
      line.className = "hordes-kr-chat-translation";
      line.dataset.source = normalizeChatTranslationKey(sourceText).slice(0, 80);
      line.textContent = `↳ ${translation}`;
      line.title = `원문: ${String(sourceText || "").trim()}`;
      element.appendChild(line);
    }

    element.dataset.hordesKrChatTranslation = "done";

    if (shouldKeepBottom) {
      scheduleChatScrollToBottom(scroller);
    }
  }

  function restoreChatTranslations(root = document) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    scope.querySelectorAll(".hordes-kr-chat-line-translated, [data-hordes-kr-chat-translation='done']").forEach((element) => {
      restoreChatTranslationLine(element);
    });
    scope.querySelectorAll(".hordes-kr-chat-translation").forEach((node) => node.remove());
  }

  function restoreChatTranslationLine(element) {
    if (!element || !element.dataset) return;

    const body = element.querySelector(".hordes-kr-chat-inline-translation") || getChatMessageBodyElement(element);
    if (body && body.dataset && body.dataset.hordesKrOriginalText) {
      body.textContent = body.dataset.hordesKrOriginalText;
      body.classList.remove("hordes-kr-chat-inline-translation");
      body.title = "";
      delete body.dataset.hordesKrTranslatedText;
    }

    element.querySelectorAll(".hordes-kr-chat-translation").forEach((node) => node.remove());
    element.classList.remove("hordes-kr-chat-line-translated");
    element.title = "";
    delete element.dataset.hordesKrChatTranslation;
  }

  function getChatMessageBodyElement(element) {
    const line = getChatLineElement(element);
    if (!line) return null;

    const directChildren = Array.from(line.children || []);
    for (let index = directChildren.length - 1; index >= 0; index--) {
      const child = directChildren[index];
      if (!child || child.matches(".hordes-kr-chat-translation")) continue;
      if (isChatMetadataElement(child)) continue;
      if (child.matches("input, textarea, button, select, option, canvas, script, style")) continue;

      const text = normalizeText(child.textContent || "");
      if (text) return child;
    }

    return null;
  }

  function getChatScrollContainer(element) {
    const root = element && typeof element.closest === "function"
      ? element.closest("#chat")
      : document.getElementById("chat");
    let current = element;
    let best = null;

    while (current && current !== document.body && current !== document.documentElement) {
      if (isScrollableChatElement(current)) best = current;
      if (current === root) break;
      current = current.parentElement;
    }

    if (best) return best;
    if (isScrollableChatElement(root)) return root;
    return root || null;
  }

  function isScrollableChatElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const scrollGap = Number(element.scrollHeight) - Number(element.clientHeight);
    if (scrollGap <= 4) return false;

    const style = pageWindow.getComputedStyle ? pageWindow.getComputedStyle(element) : null;
    const overflowY = style ? style.overflowY : "";
    return /auto|scroll|overlay|hidden/i.test(overflowY) || element.scrollTop > 0;
  }

  function shouldKeepChatScrolledToBottom(scroller) {
    if (!scroller) return false;
    const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    return distanceFromBottom <= Math.max(48, scroller.clientHeight * 0.18);
  }

  function scheduleChatScrollToBottom(scroller) {
    if (!scroller) return;
    const scroll = () => {
      try {
        scroller.scrollTop = scroller.scrollHeight;
      } catch {
        // Some game-controlled containers can reject writes during layout.
      }
    };

    scroll();
    pageWindow.requestAnimationFrame(scroll);
    setTimeout(scroll, 40);
  }

  function isChatTranslationNode(node) {
    const element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    return !!(element && element.closest && element.closest(".hordes-kr-chat-translation, .hordes-kr-chat-inline-translation"));
  }

  function extractChatMessagePayload(element) {
    if (!element) {
      return {
        text: "",
        rawText: "",
        channel: "",
        mode: "empty",
      };
    }

    const line = getChatLineElement(element);
    const source = line || element;
    const rawText = normalizeText(source.textContent || "");
    const channel = extractChatMessageChannel(source, rawText);
    const structured = line ? extractStructuredChatBody(line) : "";
    if (structured) {
      return {
        text: structured,
        rawText,
        channel,
        mode: "structured",
      };
    }

    const clone = source.cloneNode(true);
    clone.querySelectorAll(".hordes-kr-chat-translation, input, textarea, button, select, option, script, style").forEach((node) => node.remove());
    const fallbackRawText = normalizeText(clone.textContent || "");
    const text = stripChatMetadata(fallbackRawText, channel);

    return {
      text,
      rawText: fallbackRawText || rawText,
      channel,
      mode: "fallback",
    };
  }

  function getChatLineElement(element) {
    if (!element || !element.matches) return null;
    if (element.matches(".linewrap")) return element;
    return element.querySelector ? element.querySelector(".linewrap") : null;
  }

  function extractChatMessageChannel(element, rawText) {
    const line = element.matches && element.matches(".linewrap")
      ? element
      : element.querySelector && element.querySelector(".linewrap");
    const channelElement = line && line.querySelector(".channel, [class*='channel'], [class*='Channel']");
    const fromElement = normalizeChatChannelName(channelElement && channelElement.textContent);
    if (fromElement) return fromElement;

    const fromClass = extractChatChannelFromClasses(line || element);
    if (fromClass) return fromClass;

    const text = normalizeText(rawText || "");
    const patterns = [
      /^\d{1,2}[.:]\d{2}\s+([A-Za-z]+)\b/,
      /^[\[(]?([A-Za-z]+)[\])]?[:\s]/,
      /^\/([A-Za-z]+)\b/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const channel = normalizeChatChannelName(match && match[1]);
      if (channel) return channel;
    }

    return "";
  }

  function extractChatChannelFromClasses(element) {
    if (!element) return "";

    const elements = [element, ...Array.from(element.querySelectorAll("[class*='text']") || [])];
    for (const item of elements) {
      const className = String(item.className || "");
      const match = className.match(/(?:^|\s)text(party|faction|yell|whisper|to|from|pm|tell|clan|system|lvlup)(?:\s|$)/i);
      const channel = normalizeChatChannelName(match && match[1]);
      if (channel) return channel;
    }

    return "";
  }

  function normalizeChatChannelName(value) {
    const raw = String(value || "").toLowerCase().trim();
    const compact = raw.replace(/\s+/g, "");
    if (/귓|속삭|개인|쪽지/.test(compact)) return "whisper";

    const text = raw.replace(/[^a-z]/g, "").trim();

    if (!text) return "";
    if (
      text === "w" ||
      text === "pm" ||
      text === "dm" ||
      text === "tell" ||
      text === "to" ||
      text === "from" ||
      text === "private" ||
      text === "direct" ||
      text === "whisperto" ||
      text === "whisperfrom"
    ) {
      return "whisper";
    }
    return text;
  }

  function extractStructuredChatBody(element) {
    const line = element.matches && element.matches(".linewrap")
      ? element
      : element.querySelector && element.querySelector(".linewrap");
    if (!line) return "";

    const directChildren = Array.from(line.children || []);
    for (let index = directChildren.length - 1; index >= 0; index--) {
      const child = directChildren[index];
      if (isChatMetadataElement(child)) continue;

      const text = normalizeText(child.textContent || "");
      if (text) return text;
    }

    const clone = line.cloneNode(true);
    clone.querySelectorAll(".time, .content, .sender, .channel, .capitalize, .hordes-kr-chat-translation").forEach((node) => node.remove());
    return normalizeText(clone.textContent || "");
  }

  function isChatMetadataElement(element) {
    if (!element || !element.classList) return false;

    return (
      element.classList.contains("time") ||
      element.classList.contains("content") ||
      element.classList.contains("sender") ||
      element.classList.contains("channel") ||
      element.classList.contains("capitalize")
    );
  }

  function stripChatMetadata(text, channel) {
    let value = normalizeText(text);
    if (!value) return "";

    value = value.replace(/^\d{1,2}[.:]\d{2}\s*/, "");
    value = value.replace(/^(?:to|from|tell|pm|dm|w)\s+/i, "");
    if (channel) {
      value = value.replace(new RegExp(`^${escapeRegExp(channel)}\\s+`, "i"), "");
    } else {
      value = value.replace(/^(?:party|clan|faction|pvp|yell|inv|whisper|local|system|to|from|tell|pm|dm|w)\s+/i, "");
    }
    value = value.replace(/^\d{1,3}\s+/, "");

    return value.trim();
  }

  function shouldTranslateChatPayload(payload) {
    if (!payload || !isAllowedChatTranslationChannel(payload.channel)) return false;
    if (translateChatMessageLocally(payload.text)) return true;
    return shouldTranslateChatText(payload.text);
  }

  function isAllowedChatTranslationChannel(channel) {
    return CHAT_TRANSLATION_ALLOWED_CHANNELS.has(normalizeChatChannelName(channel));
  }

  function shouldTranslateChatText(text) {
    const normalized = normalizeText(text);
    if (normalized.length < 2 || normalized.length > CHAT_TRANSLATION_MAX_TEXT_LENGTH) return false;
    if (/^\s*[/>!]/.test(normalized)) return false;
    if (/^https?:\/\//i.test(normalized)) return false;
    if (/^(?:\[[^\]]+\]\s*)+$/.test(normalized)) return false;
    if (/\b(?:joined|left|online|offline)\b/i.test(normalized) && normalized.length < 28) return false;
    if (!/[A-Za-z]/.test(normalized)) return false;

    const hangul = (normalized.match(/[가-힣]/g) || []).length;
    const latin = (normalized.match(/[A-Za-z]/g) || []).length;
    return hangul < Math.max(3, latin * 0.35);
  }

  function normalizeChatTranslationKey(text) {
    return normalizeText(text).toLowerCase();
  }

  function isNodeInsideChat(node) {
    const element = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    if (!element || element.closest("#hordes-kr-mod-status-root")) return false;
    if (element.closest("#chatinput, .commandlist, [class*='commandlist'], [class*='CommandList']")) return false;
    return Boolean(element.closest("#chat"));
  }

  // ===== Damage log overlay (sits above the chat panel) =====
  function isDamageLogEnabled() {
    return FEATURE_CONFIG.damageLogEnabled !== false;
  }

  function initDamageLog() {
    const start = () => {
      installDamageLogStyle();
      syncDamageLogRuntimeFlag();
      ensureDamageLogHost();
      startDamageLogLoop();
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }

  function syncDamageLogRuntimeFlag() {
    const runtime = getExposedRuntime();
    if (!runtime) return;
    try {
      runtime.combatLogEnabled = isDamageLogEnabled();
    } catch {
      // Best-effort; the capture hook also defaults to on.
    }
  }

  function installDamageLogStyle() {
    if (DAMAGE_LOG_STATE.styleInstalled || document.getElementById("hordes-kr-damage-log-style")) {
      DAMAGE_LOG_STATE.styleInstalled = true;
      return;
    }
    const style = document.createElement("style");
    style.id = "hordes-kr-damage-log-style";
    style.textContent = `
      #hordes-kr-damage-log {
        position: fixed !important;
        z-index: 2147483646 !important;
        left: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 1px;
        max-width: 440px;
        pointer-events: none;
        font: 700 12px/1.36 "Segoe UI", system-ui, sans-serif;
        text-align: left;
      }
      #hordes-kr-damage-log[hidden] { display: none !important; }
      #hordes-kr-damage-log .dmg-header {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 2px;
        pointer-events: none;
      }
      #hordes-kr-damage-log .dmg-count {
        color: #cdd6e0;
        opacity: 0.85;
        font-size: 11px;
        margin-right: auto;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
      }
      #hordes-kr-damage-log .dmg-save {
        pointer-events: auto;
        cursor: pointer;
        font: 700 11px/1 "Segoe UI", system-ui, sans-serif;
        color: #e7eef6;
        background: rgba(28, 36, 48, 0.86);
        border: 1px solid rgba(120, 140, 165, 0.55);
        border-radius: 4px;
        padding: 3px 7px;
      }
      #hordes-kr-damage-log .dmg-save:hover { background: rgba(46, 60, 80, 0.94); }
      #hordes-kr-damage-log .dmg-clear { color: #ff9f93; }
      #hordes-kr-damage-log .dmg-line {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0 6px;
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.42);
        text-shadow:
          1px 0 0 rgba(0, 0, 0, 0.95), -1px 0 0 rgba(0, 0, 0, 0.95),
          0 1px 0 rgba(0, 0, 0, 0.95), 0 -1px 0 rgba(0, 0, 0, 0.95);
        transition: opacity 0.4s ease;
      }
      #hordes-kr-damage-log .dmg-line.dir-out { color: #ffe27a; }
      #hordes-kr-damage-log .dmg-line.dir-in { color: #ff8f80; }
      #hordes-kr-damage-log .dmg-line.dir-out.crit { color: #fff3a6; font-weight: 800; }
      #hordes-kr-damage-log .dmg-line.dir-in.crit { color: #ff6552; font-weight: 800; }
      #hordes-kr-damage-log .dmg-line.miss { color: #b9c2cc; font-weight: 600; }
      #hordes-kr-damage-log .dmg-line.dmg-note { color: #8fe3ff; font-weight: 700; }
      #hordes-kr-damage-log .dmg-line.dmg-interrupt { color: #66e0ff; font-weight: 800; }
      #hordes-kr-damage-log .dmg-line .dmg-num { font-weight: 800; }
      #hordes-kr-damage-log .dmg-line .dmg-tag { opacity: 0.85; }
    `;
    (document.head || document.documentElement).appendChild(style);
    DAMAGE_LOG_STATE.styleInstalled = true;
  }

  function ensureDamageLogHost() {
    if (DAMAGE_LOG_STATE.host && document.contains(DAMAGE_LOG_STATE.host)) return DAMAGE_LOG_STATE.host;
    if (!document.body) return null;
    const host = document.createElement("div");
    host.id = "hordes-kr-damage-log";
    host.hidden = true;

    const header = document.createElement("div");
    header.className = "dmg-header";
    const count = document.createElement("span");
    count.className = "dmg-count";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dmg-save";
    saveBtn.textContent = "💾 저장";
    saveBtn.title = "데미지 기록을 CSV·JSON 파일로 다운로드";
    saveBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      exportDamageLog("both");
    });
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "dmg-save dmg-clear";
    clearBtn.textContent = "비움";
    clearBtn.title = "모아둔 기록 초기화";
    clearBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDamageLogHistory();
    });
    installBasicUiEventGuards([saveBtn, clearBtn]);
    header.append(count, saveBtn, clearBtn);

    const list = document.createElement("div");
    list.className = "dmg-list";

    host.append(header, list);
    document.body.appendChild(host);
    DAMAGE_LOG_STATE.host = host;
    DAMAGE_LOG_STATE.listEl = list;
    DAMAGE_LOG_STATE.headerEl = header;
    DAMAGE_LOG_STATE.countEl = count;
    return host;
  }

  function startDamageLogLoop() {
    if (DAMAGE_LOG_STATE.timer) return;
    DAMAGE_LOG_STATE.timer = setInterval(updateDamageLog, DAMAGE_LOG_REFRESH_MS);
  }

  function stopDamageLogLoop() {
    if (DAMAGE_LOG_STATE.timer) {
      clearInterval(DAMAGE_LOG_STATE.timer);
      DAMAGE_LOG_STATE.timer = null;
    }
  }

  function updateDamageLog() {
    const host = ensureDamageLogHost();
    if (!host) return;

    if (!isDamageLogEnabled()) {
      if (!host.hidden) host.hidden = true;
      return;
    }

    pullNewDamageEvents();

    const now = Date.now();
    if (DAMAGE_LOG_STATE.lines.length) {
      DAMAGE_LOG_STATE.lines = DAMAGE_LOG_STATE.lines.filter((line) => now - line.at < DAMAGE_LOG_LINE_TTL_MS);
    }

    const chat = getChatPanelRect();
    // Keep the panel (and its save button) up while there is anything to save,
    // even after the live lines have faded out.
    const hasContent = DAMAGE_LOG_STATE.lines.length > 0 || DAMAGE_LOG_STATE.history.length > 0;
    if (!chat || !hasContent) {
      if (!host.hidden) host.hidden = true;
      return;
    }

    renderDamageLogLines(now);
    positionDamageLog(host, chat);
    if (host.hidden) host.hidden = false;
  }

  function pullNewDamageEvents() {
    const runtime = getExposedRuntime();
    const log = runtime && Array.isArray(runtime.combatLog) ? runtime.combatLog : null;
    if (!log || !log.length) return;

    const lastSeq = DAMAGE_LOG_STATE.lastSeq;
    let maxSeq = lastSeq;
    const fresh = [];
    for (const event of log) {
      if (!event || typeof event.seq !== "number" || event.seq <= lastSeq) continue;
      fresh.push(event);
      if (event.seq > maxSeq) maxSeq = event.seq;
    }
    if (!fresh.length) return;
    DAMAGE_LOG_STATE.lastSeq = maxSeq;

    const at = Date.now();
    const history = DAMAGE_LOG_STATE.history;
    for (const event of fresh) {
      DAMAGE_LOG_STATE.lines.push({ event, at });
      history.push({ ...event, ts: at });
    }
    if (DAMAGE_LOG_STATE.lines.length > DAMAGE_LOG_MAX_LINES) {
      DAMAGE_LOG_STATE.lines.splice(0, DAMAGE_LOG_STATE.lines.length - DAMAGE_LOG_MAX_LINES);
    }
    if (history.length > DAMAGE_LOG_HISTORY_MAX) {
      history.splice(0, history.length - DAMAGE_LOG_HISTORY_MAX);
    }
  }

  // Inject a non-damage note (e.g. auto-interrupt) into the live combat log. Lines-only
  // (not history), so it shows alongside damage but never pollutes the saved CSV/stats.
  function pushDamageLogNote(text, kind) {
    if (!isDamageLogEnabled() || !text) return;
    DAMAGE_LOG_STATE.lines.push({ event: { note: String(text), kind: kind || "" }, at: Date.now() });
    if (DAMAGE_LOG_STATE.lines.length > DAMAGE_LOG_MAX_LINES) {
      DAMAGE_LOG_STATE.lines.splice(0, DAMAGE_LOG_STATE.lines.length - DAMAGE_LOG_MAX_LINES);
    }
  }

  function renderDamageLogLines(now) {
    const list = DAMAGE_LOG_STATE.listEl;
    if (!list) return;
    const fragment = document.createDocumentFragment();
    for (const line of DAMAGE_LOG_STATE.lines) {
      fragment.appendChild(buildDamageLogLineEl(line, now));
    }
    list.replaceChildren(fragment);
    if (DAMAGE_LOG_STATE.countEl) {
      DAMAGE_LOG_STATE.countEl.textContent = `${DAMAGE_LOG_STATE.history.length.toLocaleString("en-US")}건`;
    }
  }

  function buildDamageLogLineEl(line, now) {
    const event = line.event;
    if (event.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "dmg-line dmg-note" + (event.kind ? ` ${event.kind}` : "");
      noteEl.textContent = event.note;
      const noteAge = now - line.at;
      const noteFade = DAMAGE_LOG_LINE_TTL_MS - 1500;
      noteEl.style.opacity = noteAge > noteFade ? String(Math.max(0.15, (DAMAGE_LOG_LINE_TTL_MS - noteAge) / 1500)) : "1";
      return noteEl;
    }
    const el = document.createElement("div");
    const classes = ["dmg-line", event.dir === "in" ? "dir-in" : "dir-out"];
    if (event.crit) classes.push("crit");
    if (event.miss) classes.push("miss");
    el.className = classes.join(" ");

    const skill = event.skill || "?";
    const source = event.source || "?";
    const target = event.target || "?";
    const subject = event.dir === "in" ? `${source} → 나` : `${skill} → ${target}`;

    if (event.miss) {
      el.textContent = `${subject}  빗나감`;
    } else {
      const skillLabel = event.dir === "in" ? `(${skill}) ` : "";
      el.append(document.createTextNode(`${subject}  ${skillLabel}`));
      const num = document.createElement("span");
      num.className = "dmg-num";
      num.textContent = formatDamageAmount(event.dmg);
      el.appendChild(num);
      const tag = event.crit ? " 치명" : event.block ? " 막힘" : "";
      if (tag) {
        const tagEl = document.createElement("span");
        tagEl.className = "dmg-tag";
        tagEl.textContent = tag;
        el.appendChild(tagEl);
      }
    }

    const age = now - line.at;
    const fadeStart = DAMAGE_LOG_LINE_TTL_MS - 1500;
    el.style.opacity = age > fadeStart ? String(Math.max(0.15, (DAMAGE_LOG_LINE_TTL_MS - age) / 1500)) : "1";
    return el;
  }

  function positionDamageLog(host, chat) {
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    const left = Math.round(Math.max(2, chat.left + 4));
    const bottom = Math.round(Math.max(2, viewportHeight - (chat.top - DAMAGE_LOG_CHAT_TOP_GAP)));
    host.style.left = `${left}px`;
    host.style.bottom = `${bottom}px`;
    host.style.maxWidth = `${Math.max(220, Math.min(440, Math.round(chat.width || 440)))}px`;
  }

  function formatDamageAmount(value) {
    return (Math.round(Number(value) || 0)).toLocaleString("en-US");
  }

  function setDamageLogEnabled(enabled) {
    FEATURE_CONFIG.damageLogEnabled = Boolean(enabled);
    saveFeatureConfig();
    syncDamageLogRuntimeFlag();
    if (FEATURE_CONFIG.damageLogEnabled) {
      installDamageLogStyle();
      ensureDamageLogHost();
      startDamageLogLoop();
    } else {
      DAMAGE_LOG_STATE.lines = [];
      if (DAMAGE_LOG_STATE.host) DAMAGE_LOG_STATE.host.hidden = true;
    }
    renderStatusUi();
    return getDamageLogStatus();
  }

  function getDamageLogStatus() {
    const runtime = getExposedRuntime();
    return {
      enabled: isDamageLogEnabled(),
      shownLines: DAMAGE_LOG_STATE.lines.length,
      captured: runtime && typeof runtime.combatLogSeq === "number" ? runtime.combatLogSeq : 0,
      buffered: runtime && Array.isArray(runtime.combatLog) ? runtime.combatLog.length : 0,
      hookInstalled: Boolean(runtime && runtime.damageHookInstalled),
    };
  }

  function clearDamageLogHistory() {
    DAMAGE_LOG_STATE.history = [];
    DAMAGE_LOG_STATE.lines = [];
    if (DAMAGE_LOG_STATE.listEl) DAMAGE_LOG_STATE.listEl.replaceChildren();
    if (DAMAGE_LOG_STATE.countEl) DAMAGE_LOG_STATE.countEl.textContent = "0건";
    return getDamageLogStatus();
  }

  function exportDamageLog(format = "both") {
    const rows = DAMAGE_LOG_STATE.history.slice();
    if (!rows.length) {
      setStatus({ lastState: "데미지 기록 없음", lastError: "저장할 기록이 없습니다." });
      return { ok: false, reason: "empty", count: 0 };
    }
    const base = `hordes-damage-log-${getDamageLogFileStamp()}`;
    const want = String(format || "both").toLowerCase();
    let files = 0;
    if (want === "csv" || want === "both") {
      // UTF-8 BOM so Excel reads Korean correctly.
      downloadDamageLogFile(`${base}.csv`, "text/csv;charset=utf-8", "﻿" + buildDamageLogCsv(rows));
      files += 1;
    }
    if (want === "json" || want === "both") {
      const emit = () => downloadDamageLogFile(`${base}.json`, "application/json;charset=utf-8", buildDamageLogJson(rows));
      // Stagger the second download so the browser does not drop it as a duplicate.
      if (want === "both") setTimeout(emit, 350);
      else emit();
      files += 1;
    }
    setStatus({ lastState: `데미지 기록 ${rows.length}건 저장`, lastError: "" });
    return { ok: true, count: rows.length, files };
  }

  function buildDamageLogCsv(rows) {
    const lines = [["time", "dir", "source", "target", "skill", "damage", "result", "school", "seq"].join(",")];
    for (const row of rows) {
      lines.push([
        csvCell(formatDamageLogTimestamp(row.ts)),
        csvCell(damageLogDirLabel(row.dir)),
        csvCell(row.source || ""),
        csvCell(row.target || ""),
        csvCell(row.skill || ""),
        csvCell(Math.round(Number(row.dmg) || 0)),
        csvCell(damageLogResultLabel(row)),
        csvCell(Number(row.school) === 1 ? "마법" : "물리"),
        csvCell(row.seq),
      ].join(","));
    }
    return lines.join("\r\n");
  }

  function buildDamageLogJson(rows) {
    return JSON.stringify(
      rows.map((row) => ({
        time: formatDamageLogTimestamp(row.ts),
        ts: row.ts,
        engineTime: row.time,
        dir: row.dir,
        source: row.source,
        target: row.target,
        skill: row.skill,
        skillId: row.skillId,
        damage: Math.round(Number(row.dmg) || 0),
        crit: Boolean(row.crit),
        miss: Boolean(row.miss),
        block: Boolean(row.block),
        school: Number(row.school) === 1 ? "spell" : "physical",
        seq: row.seq,
      })),
      null,
      2
    );
  }

  function damageLogDirLabel(dir) {
    return dir === "in" ? "받은" : "가한";
  }

  function damageLogResultLabel(row) {
    if (row.miss) return "빗나감";
    if (row.crit) return "치명";
    if (row.block) return "막힘";
    return "일반";
  }

  function csvCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function formatDamageLogTimestamp(ms) {
    const date = new Date(Number(ms) || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function getDamageLogFileStamp() {
    const date = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function downloadDamageLogFile(filename, mime, content) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        try { anchor.remove(); } catch { /* ignore */ }
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }, 1000);
      return true;
    } catch (error) {
      setStatus({ lastState: "저장 실패", lastError: (error && error.message) || String(error) });
      return false;
    }
  }

  function installChatTranslationStyle() {
    if (document.getElementById("hordes-kr-chat-translation-style")) return;

    const style = document.createElement("style");
    style.id = "hordes-kr-chat-translation-style";
    style.textContent = `
      .hordes-kr-chat-translation {
        display: block !important;
        width: fit-content !important;
        max-width: calc(100% - 12px) !important;
        margin: 3px 0 2px 12px !important;
        padding: 2px 6px 3px 7px !important;
        border-left: 3px solid #f5c247 !important;
        border-radius: 3px !important;
        background: rgba(6, 11, 18, 0.78) !important;
        color: #fff2a6 !important;
        font-size: 1.04em !important;
        font-weight: 900 !important;
        line-height: 1.28 !important;
        opacity: 1 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.36) !important;
        text-shadow:
          1px 0 0 rgba(0, 0, 0, 0.95),
          -1px 0 0 rgba(0, 0, 0, 0.95),
          0 1px 0 rgba(0, 0, 0, 0.95),
          0 -1px 0 rgba(0, 0, 0, 0.95),
          0 1px 3px rgba(0, 0, 0, 0.9) !important;
      }
      .hordes-kr-chat-inline-translation {
        color: #fff3a8 !important;
        font-weight: 900 !important;
        opacity: 1 !important;
        text-shadow:
          1px 0 0 rgba(0, 0, 0, 0.96),
          -1px 0 0 rgba(0, 0, 0, 0.96),
          0 1px 0 rgba(0, 0, 0, 0.96),
          0 -1px 0 rgba(0, 0, 0, 0.96),
          0 1px 3px rgba(0, 0, 0, 0.92) !important;
      }
      .hordes-kr-chat-line-translated {
        min-height: 18px !important;
      }
      #hordes-kr-chat-translation-toggle {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        font-family: Arial, Helvetica, sans-serif !important;
        line-height: 1 !important;
        touch-action: manipulation !important;
      }
      #hordes-kr-chat-translation-toggle[hidden] {
        display: none !important;
      }
      #hordes-kr-chat-translation-toggle button {
        min-width: 92px !important;
        height: 24px !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(166, 220, 213, 0.42) !important;
        border-radius: 5px !important;
        background: rgba(16, 19, 29, 0.9) !important;
        color: #a6dcd5 !important;
        padding: 0 8px !important;
        font: 900 11px/22px Arial, Helvetica, sans-serif !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.36) !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95) !important;
      }
      #hordes-kr-chat-translation-toggle button.enabled {
        border-color: rgba(52, 203, 73, 0.78) !important;
        color: #d8ffdf !important;
        background: rgba(15, 64, 35, 0.9) !important;
      }
      #hordes-kr-chat-translation-toggle button.busy {
        border-color: rgba(245, 194, 71, 0.84) !important;
        color: #fff3b0 !important;
      }
      #hordes-kr-chat-translation-toggle button.missing {
        border-color: rgba(244, 41, 41, 0.62) !important;
        color: #ffd2d2 !important;
        background: rgba(72, 20, 24, 0.88) !important;
      }
      #hordes-kr-chat-translation-toggle button:hover {
        border-color: rgba(245, 194, 71, 0.9) !important;
        color: #ffffff !important;
      }
      #hordes-kr-chat-translation-toggle .outgoing-input {
        width: 178px !important;
        height: 24px !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(166, 220, 213, 0.36) !important;
        border-radius: 5px !important;
        background: rgba(4, 8, 16, 0.9) !important;
        color: #ffffff !important;
        padding: 0 7px !important;
        font: 900 11px/22px Arial, Helvetica, sans-serif !important;
        letter-spacing: 0 !important;
        outline: none !important;
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28) !important;
      }
      #hordes-kr-chat-translation-toggle .outgoing-input:focus {
        border-color: rgba(245, 194, 71, 0.9) !important;
      }
      #hordes-kr-chat-translation-toggle .outgoing-input::placeholder {
        color: rgba(166, 220, 213, 0.72) !important;
      }
      #hordes-kr-chat-translation-toggle .outgoing-input:disabled {
        color: #8ea6aa !important;
        border-color: rgba(142, 166, 170, 0.22) !important;
        background: rgba(35, 41, 55, 0.78) !important;
      }
      #hordes-kr-chat-translation-toggle button.outgoing-send {
        min-width: 28px !important;
        width: 28px !important;
        padding: 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureChatTranslationQuickToggleHost() {
    if (CHAT_TRANSLATION_STATE.quickToggleHost && document.contains(CHAT_TRANSLATION_STATE.quickToggleHost)) {
      return CHAT_TRANSLATION_STATE.quickToggleHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-chat-translation-toggle";
    host.hidden = true;

    const button = createUiButton("toggle-button", "채팅번역", "", () => {
      setChatTranslationEnabled(!isChatTranslationEnabled());
      updateChatTranslationQuickToggle(true);
      renderStatusUi();
    });

    const input = document.createElement("input");
    input.type = "text";
    input.className = "outgoing-input";
    input.placeholder = "한국어→영어 Enter";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = CHAT_TRANSLATION_MAX_TEXT_LENGTH;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        translateOutgoingChatFromQuickInput(input).catch(() => {});
        return;
      }
      if (event.key === "Escape") {
        input.value = "";
        event.preventDefault();
      }
      event.stopPropagation();
    });

    const send = createUiButton("outgoing-send", "→", "한국어를 영어로 번역해서 게임 채팅 입력칸에 넣기", () => {
      translateOutgoingChatFromQuickInput(input).catch(() => {});
    });

    installBasicUiEventGuards([button, input, send]);

    input.addEventListener("focus", () => {
      input.select();
    });

    input.addEventListener("paste", (event) => {
      event.stopPropagation();
    });

    [input, send].forEach((element) => {
      element.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });

    host.append(button, input, send);
    document.body.appendChild(host);
    CHAT_TRANSLATION_STATE.quickToggleHost = host;
    CHAT_TRANSLATION_STATE.quickToggleRenderKey = "";
    return host;
  }

  function startChatTranslationQuickTogglePositioner() {
    if (CHAT_TRANSLATION_STATE.quickToggleTimer) return;

    CHAT_TRANSLATION_STATE.quickToggleTimer = setInterval(
      updateChatTranslationQuickToggle,
      CHAT_TRANSLATION_TOGGLE_REFRESH_MS
    );
    pageWindow.addEventListener("resize", updateChatTranslationQuickToggle);
  }

  function updateChatTranslationQuickToggle(force = false) {
    const host = ensureChatTranslationQuickToggleHost();
    if (!host) return;

    const chat = getChatPanelRect();
    if (!chat) {
      host.hidden = true;
      CHAT_TRANSLATION_STATE.quickToggleRenderKey = "";
      return;
    }

    const button = host.querySelector(".toggle-button");
    const input = host.querySelector(".outgoing-input");
    const send = host.querySelector(".outgoing-send");
    if (!button) return;

    const hostRect = host.getBoundingClientRect();
    const width = Math.max(306, Math.round(hostRect.width || 306));
    const height = Math.max(24, Math.round(hostRect.height || 24));
    const viewportWidth = Math.max(320, Number(pageWindow.innerWidth) || 0);
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    const left = Math.round(clamp(chat.left + 4, 2, viewportWidth - width - 2));
    const preferredTop = chat.top - height - 4;
    const top = Math.round(clamp(preferredTop >= 2 ? preferredTop : chat.top + 4, 2, viewportHeight - height - 2));

    const hasKey = hasChatTranslationApiKey();
    const enabled = isChatTranslationEnabled();
    const busy = enabled && (CHAT_TRANSLATION_STATE.activeRequests > 0 || CHAT_TRANSLATION_STATE.queue.length > 0);
    const outgoingBusy = CHAT_TRANSLATION_STATE.outgoingBusy;
    const text = hasKey
      ? busy
        ? "채팅번역 중"
        : `채팅번역 ${enabled ? "ON" : "OFF"}`
      : "채팅번역 키없음";
    const title = hasKey
      ? `채팅 번역 ${enabled ? "켜짐" : "꺼짐"}`
      : "메인 패널의 채팅 번역 키에서 API 키를 저장하세요.";

    const renderKey = [
      left,
      top,
      text,
      title,
      enabled ? "1" : "0",
      busy ? "1" : "0",
      outgoingBusy ? "1" : "0",
      hasKey ? "1" : "0",
      CHAT_TRANSLATION_STATE.outgoingLastError || "",
    ].join("|");
    if (!force && CHAT_TRANSLATION_STATE.quickToggleRenderKey === renderKey && !host.hidden) return;
    CHAT_TRANSLATION_STATE.quickToggleRenderKey = renderKey;

    host.hidden = false;
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    button.textContent = text;
    button.title = title;
    button.className = [
      "toggle-button",
      enabled ? "enabled" : "",
      busy ? "busy" : "",
      hasKey ? "" : "missing",
    ].filter(Boolean).join(" ");
    if (input) {
      input.disabled = outgoingBusy || !hasKey;
      input.placeholder = hasKey
        ? outgoingBusy
          ? "영어로 번역 중..."
          : "한국어→영어 Enter"
        : "API 키 필요";
      input.title = CHAT_TRANSLATION_STATE.outgoingLastError || "한국어를 입력하고 Enter를 누르면 영어로 바꿔 게임 채팅 입력칸에 넣습니다.";
    }
    if (send) {
      send.disabled = outgoingBusy || !hasKey;
      send.classList.toggle("busy", outgoingBusy);
      send.classList.toggle("missing", !hasKey);
      send.title = CHAT_TRANSLATION_STATE.outgoingLastError || "한국어를 영어로 번역해서 게임 채팅 입력칸에 넣기";
    }
  }

  function getChatTranslationStatus() {
    return {
      enabled: isChatTranslationEnabled(),
      hasApiKey: Boolean(getChatTranslationApiKey()),
      model: getChatTranslationModel(),
      transport: {
        last: CHAT_TRANSLATION_STATE.lastTransport,
        gm: typeof GM_xmlhttpRequest === "function",
        bridgeReady: Boolean(pageWindow.__HORDES_KR_OPENAI_BRIDGE_READY__),
        bridgeInstalled: Boolean(pageWindow.__HORDES_KR_OPENAI_BRIDGE_INSTALLED__),
        bridgeUsable: isOpenAiBridgeAvailable(),
      },
      bridgeTiming: CHAT_TRANSLATION_STATE.lastBridgeTiming,
      queue: CHAT_TRANSLATION_STATE.queue.length,
      activeRequests: CHAT_TRANSLATION_STATE.activeRequests,
      inFlightRequests: CHAT_TRANSLATION_STATE.inFlight.size,
      limits: {
        scanRecentMessages: CHAT_TRANSLATION_SCAN_LIMIT,
        queue: CHAT_TRANSLATION_MAX_QUEUE,
        cache: CHAT_TRANSLATION_MAX_CACHE,
        cacheTtlMs: CHAT_TRANSLATION_CACHE_TTL_MS,
        concurrent: CHAT_TRANSLATION_MAX_CONCURRENT,
        batch: CHAT_TRANSLATION_BATCH_SIZE,
        textLength: CHAT_TRANSLATION_MAX_TEXT_LENGTH,
      },
      allowedChannels: [...CHAT_TRANSLATION_ALLOWED_CHANNELS],
      translatedCount: CHAT_TRANSLATION_STATE.translatedCount,
      requestCount: CHAT_TRANSLATION_STATE.requestCount,
      batchRequestCount: CHAT_TRANSLATION_STATE.batchRequestCount,
      localHitCount: CHAT_TRANSLATION_STATE.localHitCount,
      cacheSize: CHAT_TRANSLATION_STATE.cache.size,
      cacheHits: CHAT_TRANSLATION_STATE.cacheHits,
      skippedCount: CHAT_TRANSLATION_STATE.skippedCount,
      droppedCount: CHAT_TRANSLATION_STATE.droppedCount,
      lastRequestDurationMs: CHAT_TRANSLATION_STATE.lastRequestDurationMs,
      averageRequestDurationMs: CHAT_TRANSLATION_STATE.averageRequestDurationMs,
      lastChannel: CHAT_TRANSLATION_STATE.lastChannel,
      lastText: CHAT_TRANSLATION_STATE.lastText,
      lastTranslation: CHAT_TRANSLATION_STATE.lastTranslation,
      lastError: CHAT_TRANSLATION_STATE.lastError,
      lastAt: CHAT_TRANSLATION_STATE.lastAt,
      quotaBlockedMs: Math.max(0, CHAT_TRANSLATION_STATE.quotaBlockedUntil - Date.now()),
      quickToggle: {
        host: Boolean(CHAT_TRANSLATION_STATE.quickToggleHost && document.contains(CHAT_TRANSLATION_STATE.quickToggleHost)),
        hidden: CHAT_TRANSLATION_STATE.quickToggleHost ? CHAT_TRANSLATION_STATE.quickToggleHost.hidden : true,
      },
      outgoing: {
        busy: CHAT_TRANSLATION_STATE.outgoingBusy,
        lastInput: CHAT_TRANSLATION_STATE.outgoingLastInput,
        lastTranslation: CHAT_TRANSLATION_STATE.outgoingLastTranslation,
        lastError: CHAT_TRANSLATION_STATE.outgoingLastError,
        lastAt: CHAT_TRANSLATION_STATE.outgoingLastAt,
      },
    };
  }

  function initPartyUiManager() {
    const start = () => {
      installPartyUiStyle();
      updatePartyUi();

      if (!PARTY_UI_STATE.observer) {
        PARTY_UI_STATE.observer = new MutationObserver(() => {
          schedulePartyUiUpdate();
        });
        PARTY_UI_STATE.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }

      if (!PARTY_UI_STATE.timer) {
        PARTY_UI_STATE.timer = setInterval(schedulePartyUiUpdate, PARTY_UI_REFRESH_MS);
      }
    };

    const delayedStart = () => {
      setTimeout(start, 1200);
    };

    if (document.readyState === "complete") {
      delayedStart();
    } else {
      pageWindow.addEventListener("load", delayedStart, { once: true });
    }
  }

  function schedulePartyUiUpdate() {
    if (PARTY_UI_STATE.pendingUpdate) return;
    PARTY_UI_STATE.pendingUpdate = true;

    requestAnimationFrame(() => {
      PARTY_UI_STATE.pendingUpdate = false;
      updatePartyUi();
    });
  }

  function updatePartyUi() {
    try {
      const frame = findPartyFrameElement();
      if (!frame) {
        removePartyUiHandle();
        PARTY_UI_STATE.frame = null;
        PARTY_UI_STATE.lastFrameCount = 0;
        return;
      }

      PARTY_UI_STATE.frame = frame;
      PARTY_UI_STATE.lastFrameCount = frame.children ? frame.children.length : 0;

      if (!PARTY_UI_CONFIG.enabled) {
        restorePartyFrame(frame);
        removePartyUiHandle();
        return;
      }

      refreshGamePartyFrameWidth(frame);
      const layout = getPartyUiLayout(frame);
      applyPartyFrameLayout(frame, layout);
      updatePartyUiHandle(frame, layout);
      PARTY_UI_STATE.lastError = "";
    } catch (error) {
      PARTY_UI_STATE.lastError = error && error.message ? error.message : String(error);
    }
  }

  function findPartyFrameElement() {
    return document.querySelector(".partyframes");
  }

  function getPartyUiLayout(frame) {
    if (PARTY_UI_CONFIG.preset === "self5x2") {
      return getPartyUiSelf5x2Layout();
    }

    const rect = frame.getBoundingClientRect();
    const columns = clamp(Math.round(Number(PARTY_UI_CONFIG.columns) || 1), 1, 5);
    const width = getPartyUiGridWidth(columns);
    const height = getPartyUiGridHeight(frame.children ? frame.children.length : 1, columns);
    const x = Number.isFinite(PARTY_UI_CONFIG.x)
      ? PARTY_UI_CONFIG.x
      : rect.left;
    const y = Number.isFinite(PARTY_UI_CONFIG.y)
      ? PARTY_UI_CONFIG.y
      : rect.top;

    return {
      x: clamp(Math.round(x), 0, Math.max(0, window.innerWidth - width)),
      y: clamp(Math.round(y), 0, Math.max(0, window.innerHeight - height)),
      columns,
      width,
      height,
    };
  }

  function getPartyUiSelf5x2Layout() {
    const columns = 5;
    const width = getPartyUiGridWidth(columns);
    const height = getPartyUiGridHeight(10, columns);
    const selfFrame = document.querySelector("#ufplayer");
    const rect = selfFrame ? selfFrame.getBoundingClientRect() : null;
    const fallbackX = Math.round((window.innerWidth - width) / 2);
    const fallbackY = Math.round(window.innerHeight - 250);
    const x = rect
      ? Math.round(rect.left + rect.width / 2 - width / 2)
      : fallbackX;
    const y = rect
      ? Math.round(rect.top - height - 28)
      : fallbackY;

    return {
      x: clamp(x, 0, Math.max(0, window.innerWidth - width)),
      y: clamp(y, 0, Math.max(0, window.innerHeight - height)),
      columns,
      width,
      height,
    };
  }

  // The party frame width should follow the game's own setting, not a fixed value.
  // The game sets each frame's width inline (style.width); our stylesheet override
  // only changes the rendered width, so the game's intended value is still readable
  // from the inline property. Fall back to a one-off natural measurement, then to
  // the configured default. Cached; refreshed when the member count changes.
  function readGamePartyFrameWidth(frame) {
    try {
      const kid = frame && frame.children && frame.children[0];
      if (!kid) return 0;
      const inlineW = parseFloat(kid.style && kid.style.width);
      if (Number.isFinite(inlineW) && inlineW >= 80 && inlineW <= 400) return Math.round(inlineW);
      // fallback: measure natural width with our grid/width override neutralized
      const savedDisplay = frame.style.display;
      const savedCols = frame.style.gridTemplateColumns;
      const savedKidWidth = kid.style.width;
      frame.style.removeProperty("display");
      frame.style.removeProperty("grid-template-columns");
      kid.style.removeProperty("width");
      const w = Math.round(kid.getBoundingClientRect().width);
      frame.style.display = savedDisplay;
      frame.style.gridTemplateColumns = savedCols;
      kid.style.width = savedKidWidth;
      if (Number.isFinite(w) && w >= 80 && w <= 400) return w;
    } catch {
      // unreadable mid-transition
    }
    return 0;
  }

  function refreshGamePartyFrameWidth(frame) {
    const count = frame && frame.children ? frame.children.length : 0;
    if (count > 0 && count !== PARTY_UI_STATE.gameWidthCount) {
      const measured = readGamePartyFrameWidth(frame);
      if (measured > 0) {
        PARTY_UI_STATE.gameFrameWidth = measured;
        PARTY_UI_STATE.gameWidthCount = count;
      }
    }
  }

  function effectivePartyFrameWidth() {
    const w = PARTY_UI_STATE.gameFrameWidth;
    return Number.isFinite(w) && w >= 80 ? w : PARTY_UI_CONFIG.frameWidth;
  }

  function getPartyUiGridWidth(columns) {
    const count = clamp(Math.round(columns), 1, 5);
    return Math.round(count * effectivePartyFrameWidth() + Math.max(0, count - 1) * PARTY_UI_CONFIG.gap);
  }

  function getPartyUiGridHeight(count, columns) {
    const rows = Math.max(1, Math.ceil(Math.max(1, count) / Math.max(1, columns)));
    return Math.round(rows * PARTY_UI_FRAME_HEIGHT + Math.max(0, rows - 1) * PARTY_UI_CONFIG.gap);
  }

  function applyPartyFrameLayout(frame, layout) {
    if (!frame.dataset.hordesKrPartyOriginalStyle) {
      frame.dataset.hordesKrPartyOriginalStyle = frame.getAttribute("style") || "";
    }

    const key = [
      layout.x,
      layout.y,
      layout.columns,
      layout.width,
      effectivePartyFrameWidth(),
      PARTY_UI_CONFIG.gap,
      frame.children ? frame.children.length : 0,
    ].join("|");
    if (PARTY_UI_STATE.lastAppliedKey === key && frame.dataset.hordesKrPartyUi === "1") return;
    PARTY_UI_STATE.lastAppliedKey = key;

    frame.dataset.hordesKrPartyUi = "1";
    frame.style.setProperty("position", "fixed", "important");
    frame.style.setProperty("left", `${layout.x}px`, "important");
    frame.style.setProperty("top", `${layout.y}px`, "important");
    frame.style.setProperty("width", `${layout.width}px`, "important");
    frame.style.setProperty("max-width", `${layout.width}px`, "important");
    frame.style.setProperty("display", "grid", "important");
    frame.style.setProperty("grid-template-columns", `repeat(${layout.columns}, ${effectivePartyFrameWidth()}px)`, "important");
    frame.style.setProperty("grid-auto-rows", `${PARTY_UI_FRAME_HEIGHT}px`, "important");
    frame.style.setProperty("gap", `${PARTY_UI_CONFIG.gap}px`, "important");
    frame.style.setProperty("z-index", "2147483200", "important");
    frame.style.setProperty("pointer-events", "none", "important");
  }

  function restorePartyFrame(frame) {
    if (!frame) return;

    if (frame.dataset.hordesKrPartyOriginalStyle !== undefined) {
      frame.setAttribute("style", frame.dataset.hordesKrPartyOriginalStyle);
    } else {
      frame.removeAttribute("style");
    }

    delete frame.dataset.hordesKrPartyUi;
    delete frame.dataset.hordesKrPartyOriginalStyle;
    PARTY_UI_STATE.lastAppliedKey = "";
  }

  function updatePartyUiHandle(frame, layout) {
    const handle = ensurePartyUiHandle();
    handle.style.left = `${layout.x}px`;
    handle.style.top = `${Math.max(0, layout.y - 20)}px`;
    handle.textContent = PARTY_UI_CONFIG.preset === "self5x2" ? "파티 5x2 이동" : "파티 이동";
    handle.title = "드래그해서 파티창을 이동합니다.";
  }

  function ensurePartyUiHandle() {
    if (PARTY_UI_STATE.handle && document.contains(PARTY_UI_STATE.handle)) {
      return PARTY_UI_STATE.handle;
    }

    const handle = document.createElement("button");
    handle.id = "hordes-kr-party-ui-handle";
    handle.type = "button";
    handle.addEventListener("pointerdown", startPartyUiDrag);
    document.body.appendChild(handle);
    PARTY_UI_STATE.handle = handle;
    return handle;
  }

  function removePartyUiHandle() {
    if (PARTY_UI_STATE.handle) {
      PARTY_UI_STATE.handle.remove();
      PARTY_UI_STATE.handle = null;
    }
    PARTY_UI_STATE.dragging = null;
  }

  function startPartyUiDrag(event) {
    if (event.button !== 0) return;

    const frame = findPartyFrameElement();
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    PARTY_UI_STATE.dragging = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };

    PARTY_UI_CONFIG.enabled = true;
    PARTY_UI_CONFIG.preset = "custom";
    PARTY_UI_CONFIG.columns = PARTY_UI_CONFIG.columns || 1;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePartyUiDrag(event) {
    const dragging = PARTY_UI_STATE.dragging;
    if (!dragging || dragging.pointerId !== event.pointerId) return;

    const columns = clamp(Math.round(Number(PARTY_UI_CONFIG.columns) || 1), 1, 5);
    const width = getPartyUiGridWidth(columns);
    const count = PARTY_UI_STATE.frame && PARTY_UI_STATE.frame.children ? PARTY_UI_STATE.frame.children.length : 1;
    const height = getPartyUiGridHeight(count, columns);
    PARTY_UI_CONFIG.x = clamp(Math.round(dragging.originX + event.clientX - dragging.startX), 0, Math.max(0, window.innerWidth - width));
    PARTY_UI_CONFIG.y = clamp(Math.round(dragging.originY + event.clientY - dragging.startY), 0, Math.max(0, window.innerHeight - height));
    updatePartyUi();
    event.preventDefault();
  }

  function finishPartyUiDrag(event) {
    const dragging = PARTY_UI_STATE.dragging;
    if (!dragging || dragging.pointerId !== event.pointerId) return;

    PARTY_UI_STATE.dragging = null;
    savePartyUiConfig();
    renderStatusUi();
    event.preventDefault();
  }

  function applyPartyUiPreset5x2() {
    PARTY_UI_CONFIG.enabled = true;
    PARTY_UI_CONFIG.preset = "self5x2";
    PARTY_UI_CONFIG.columns = 5;
    PARTY_UI_CONFIG.frameWidth = PARTY_UI_FRAME_WIDTH;
    PARTY_UI_CONFIG.gap = PARTY_UI_GRID_GAP;
    PARTY_UI_CONFIG.x = null;
    PARTY_UI_CONFIG.y = null;
    savePartyUiConfig();
    updatePartyUi();
    renderStatusUi();
    return getPartyUiStatus();
  }

  function resetPartyUi() {
    const frame = findPartyFrameElement();
    if (frame) restorePartyFrame(frame);
    removePartyUiHandle();
    PARTY_UI_CONFIG.enabled = true;
    PARTY_UI_CONFIG.preset = "default";
    PARTY_UI_CONFIG.x = null;
    PARTY_UI_CONFIG.y = null;
    PARTY_UI_CONFIG.columns = 1;
    PARTY_UI_CONFIG.frameWidth = PARTY_UI_FRAME_WIDTH;
    PARTY_UI_CONFIG.gap = PARTY_UI_GRID_GAP;
    savePartyUiConfig();
    updatePartyUi();
    renderStatusUi();
    return getPartyUiStatus();
  }

  function getPartyUiStatus() {
    const frame = findPartyFrameElement();
    const rect = frame ? frame.getBoundingClientRect() : null;
    return {
      enabled: PARTY_UI_CONFIG.enabled,
      preset: PARTY_UI_CONFIG.preset,
      columns: PARTY_UI_CONFIG.columns,
      x: Number.isFinite(PARTY_UI_CONFIG.x) ? PARTY_UI_CONFIG.x : null,
      y: Number.isFinite(PARTY_UI_CONFIG.y) ? PARTY_UI_CONFIG.y : null,
      frameFound: Boolean(frame),
      frameCount: frame && frame.children ? frame.children.length : 0,
      rect: rect
        ? {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
      lastError: PARTY_UI_STATE.lastError,
    };
  }

  function initPartyCommandPanel() {
    const start = () => {
      installPartyCommandPanelStyle();
      installPartyCommandHotkeys();
      ensurePartyCommandPanelHost();
      updatePartyCommandPanel();

      if (!PARTY_COMMAND_STATE.timer) {
        PARTY_COMMAND_STATE.timer = setInterval(updatePartyCommandPanel, PARTY_COMMAND_PANEL_REFRESH_MS);
      }

      pageWindow.addEventListener("resize", updatePartyCommandPanel);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  function ensurePartyCommandPanelHost() {
    if (PARTY_COMMAND_STATE.host && document.contains(PARTY_COMMAND_STATE.host)) {
      return PARTY_COMMAND_STATE.host;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-party-command-panel";
    document.body.appendChild(host);
    PARTY_COMMAND_STATE.host = host;
    PARTY_COMMAND_STATE.renderKey = "";
    return host;
  }

  function updatePartyCommandPanel() {
    const host = ensurePartyCommandPanelHost();
    if (!host) return;

    if (!PARTY_COMMAND_CONFIG.enabled) {
      host.hidden = true;
      PARTY_COMMAND_STATE.renderKey = "";
      return;
    }

    host.hidden = false;
    const rect = host.getBoundingClientRect();
    const widthNumber = Math.max(PARTY_COMMAND_PANEL_DEFAULT_WIDTH, Math.round(rect.width || PARTY_COMMAND_PANEL_DEFAULT_WIDTH));
    const heightNumber = Math.max(PARTY_COMMAND_PANEL_DEFAULT_HEIGHT, Math.round(rect.height || PARTY_COMMAND_PANEL_DEFAULT_HEIGHT));
    const position = getPartyCommandPanelPosition(widthNumber, heightNumber);
    applyPartyCommandPanelHostPosition(position.x, position.y);

    const target = getPartyCommandTargetSummary();
    const renderKey = [
      position.x,
      position.y,
      PARTY_COMMAND_CONFIG.enabled ? 1 : 0,
      PARTY_COMMAND_CONFIG.channel,
      PARTY_COMMAND_STATE.channelMenuOpen ? 1 : 0,
      PARTY_COMMAND_CONFIG.lastMessage,
      PARTY_COMMAND_STATE.lastState,
      PARTY_COMMAND_STATE.lastError,
      PARTY_COMMAND_STATE.sentCount,
      target.id,
      target.name,
    ].join("\u0002");

    const active = document.activeElement;
    if (PARTY_COMMAND_STATE.renderKey === renderKey || (active && host.contains(active) && isEditableChatInputElement(active))) return;
    PARTY_COMMAND_STATE.renderKey = renderKey;

    host.replaceChildren(createPartyCommandPanel(target));
  }

  function createPartyCommandPanel(target) {
    const panel = document.createElement("div");
    const header = document.createElement("div");
    const title = document.createElement("span");
    const controls = document.createElement("span");
    const channel = createPartyCommandChannelControl();
    const reset = createUiButton("hordes-kr-party-command-icon", "↺", "파티 채팅 패널 위치 리셋", () => {
      resetPartyCommandPanelPosition();
    });
    const close = createUiButton("hordes-kr-party-command-icon", "×", "파티 채팅 패널 끄기", () => {
      setPartyCommandPanelEnabled(false);
    });
    const quick = document.createElement("div");

    panel.className = "hordes-kr-party-command-panel";
    header.className = "hordes-kr-party-command-header";
    title.className = "hordes-kr-party-command-title";
    title.textContent = `${getHordesChatChannelLabel(PARTY_COMMAND_CONFIG.channel)} 오더`;

    controls.className = "hordes-kr-party-command-controls";
    controls.append(channel, reset, close);
    header.append(title, controls);
    installPartyCommandPanelDragHandle(header);

    quick.className = "hordes-kr-party-command-quick";
    for (const [label, message] of PARTY_COMMAND_QUICK_MESSAGES) {
      quick.appendChild(createPartyCommandQuickButton(label, message, target));
    }

    panel.append(header, quick);
    if (PARTY_COMMAND_STATE.lastError) {
      const note = document.createElement("div");
      note.className = "hordes-kr-party-command-note";
      note.textContent = `오류: ${PARTY_COMMAND_STATE.lastError}`;
      panel.appendChild(note);
    }
    installPartyCommandPanelEventGuards(panel);
    return panel;
  }

  function createPartyCommandChannelControl() {
    const wrap = document.createElement("span");
    const menu = document.createElement("span");

    wrap.className = "hordes-kr-party-command-channel";
    const button = createUiButton(
      "hordes-kr-party-command-icon hordes-kr-party-command-channel-btn",
      "C",
      `채팅 채널 선택: ${getHordesChatChannelLabel(PARTY_COMMAND_CONFIG.channel)}`,
      () => {
        PARTY_COMMAND_STATE.channelMenuOpen = !PARTY_COMMAND_STATE.channelMenuOpen;
        PARTY_COMMAND_STATE.renderKey = "";
        updatePartyCommandPanel();
      }
    );

    menu.className = "hordes-kr-party-command-channel-menu";
    menu.hidden = !PARTY_COMMAND_STATE.channelMenuOpen;
    for (const [value, label] of PARTY_COMMAND_CHANNEL_OPTIONS) {
      const option = createUiButton("hordes-kr-party-command-channel-option", label, "", () => {
        setPartyCommandChannel(value);
      });
      option.classList.toggle("active", PARTY_COMMAND_CONFIG.channel === value);
      menu.appendChild(option);
    }

    wrap.append(button, menu);
    return wrap;
  }

  function createUiButton(className, text, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    if (className) button.className = className;
    if (text !== undefined && text !== null) button.textContent = text;
    if (title) button.title = title;
    if (typeof onClick === "function") {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      });
    }
    return button;
  }

  function createUiElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function installWindowPointerDrag(handle, options) {
    if (!handle || !options || typeof options.onMove !== "function") return;

    handle.addEventListener("pointerdown", (event) => {
      if (options.getDrag && options.getDrag()) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (typeof options.canStart === "function" && !options.canStart(event)) return;

      const subject = typeof options.getSubject === "function" ? options.getSubject(event) : handle;
      if (!subject || typeof subject.getBoundingClientRect !== "function") return;

      const rect = subject.getBoundingClientRect();
      const drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        width: typeof options.getWidth === "function" ? options.getWidth(rect, subject) : rect.width,
        height: typeof options.getHeight === "function" ? options.getHeight(rect, subject) : rect.height,
      };

      const moveHandler = (moveEvent) => {
        const activeDrag = options.getDrag ? options.getDrag() : drag;
        if (!activeDrag || moveEvent.pointerId !== activeDrag.pointerId) return;
        options.onMove(moveEvent, activeDrag);
      };
      const endHandler = (endEvent) => {
        const activeDrag = options.getDrag ? options.getDrag() : drag;
        if (!activeDrag || endEvent.pointerId !== activeDrag.pointerId) return;

        pageWindow.removeEventListener("pointermove", moveHandler, true);
        pageWindow.removeEventListener("pointerup", endHandler, true);
        pageWindow.removeEventListener("pointercancel", endHandler, true);
        if (typeof options.setDrag === "function") options.setDrag(null);
        if (typeof options.onEnd === "function") options.onEnd(endEvent, activeDrag);
      };

      if (typeof options.setDrag === "function") options.setDrag(drag);
      if (typeof options.onStart === "function") options.onStart(event, drag);

      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Window-level listeners keep dragging alive when pointer capture is unavailable.
      }

      pageWindow.addEventListener("pointermove", moveHandler, true);
      pageWindow.addEventListener("pointerup", endHandler, true);
      pageWindow.addEventListener("pointercancel", endHandler, true);
      event.preventDefault();
      event.stopPropagation();
    });
  }

  function createPartyCommandQuickButton(label, message, target) {
    const button = createUiButton("hordes-kr-party-command-btn", label, "", () => {
      sendPartyCommandQuickMessage(message, target);
    });
    const hotkeyLabel = getPartyCommandQuickButtonHotkeyLabel(label, message);
    const hotkeyTitle = hotkeyLabel ? ` / 단축키 ${hotkeyLabel}` : "";
    if (label === "GGGGG") button.className += " wide";
    if (message === null) {
      button.className += " target";
      button.disabled = !(target && target.name);
      button.title = target && target.name
        ? `${getHordesChatChannelLabel(PARTY_COMMAND_CONFIG.channel)}: ${target.name} IN 3 / id ${target.id || "unknown"}${hotkeyTitle}`
        : `현재 선택된 타겟이 없습니다.${hotkeyTitle}`;
    } else {
      button.title = `${getHordesChatChannelLabel(PARTY_COMMAND_CONFIG.channel)}: ${message}${hotkeyTitle}`;
    }
    return button;
  }

  function getPartyCommandQuickButtonHotkeyLabel(label, message) {
    if (message === null) return "Z";
    return label === "GGGGG" ? "X" : "";
  }

  function sendPartyCommandQuickMessage(message, target) {
    if (message === null) {
      const selectedTarget = target || getPartyCommandTargetSummary();
      if (!selectedTarget || !selectedTarget.name) return false;
      sendPartyCommandFromPanel(`${selectedTarget.name} IN 3`);
      return true;
    }

    sendPartyCommandFromPanel(message);
    return true;
  }

  function sendPartyCommandFromPanel(message) {
    pageWindow.HordesKrMod.sendPartyCommand(message).then(() => {
      updatePartyCommandPanel();
      renderStatusUi();
    }).catch((error) => {
      PARTY_COMMAND_STATE.lastState = "오류";
      PARTY_COMMAND_STATE.lastError = error && error.message ? error.message : String(error);
      updatePartyCommandPanel();
      renderStatusUi();
    });
  }

  function installPartyCommandHotkeys() {
    if (PARTY_COMMAND_STATE.hotkeysInstalled) return;
    PARTY_COMMAND_STATE.hotkeysInstalled = true;

    const handler = (event) => {
      if (shouldIgnorePartyCommandHotkey(event)) return;

      let sent = false;
      if (event.code === PARTY_COMMAND_TARGET_HOTKEY_CODE) {
        sent = sendPartyCommandQuickMessage(null, getPartyCommandTargetSummary());
      } else if (event.code === PARTY_COMMAND_GATHER_HOTKEY_CODE) {
        sent = sendPartyCommandQuickMessage("GGGGG");
      }

      if (!sent) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    pageWindow.addEventListener("keydown", handler, true);
    document.addEventListener("keydown", handler, true);
  }

  function shouldIgnorePartyCommandHotkey(event) {
    if (!PARTY_COMMAND_CONFIG.enabled) return true;
    if (!event || event.defaultPrevented || event.repeat) return true;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true;
    if (event.code !== PARTY_COMMAND_TARGET_HOTKEY_CODE && event.code !== PARTY_COMMAND_GATHER_HOTKEY_CODE) return true;
    return isPartyCommandEditableEvent(event) || isStatusUiKeyboardEvent(event);
  }

  function isEditableUiElement(element) {
    if (!element || element.nodeType !== 1) return false;
    const tag = element.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(element.isContentEditable);
  }

  // Shared keyboard-code normalizer (was defined inside the removed target-order
  // feature; the swiftshot-turbo hotkeys still depend on it).
  function normalizeKeyboardCode(code) {
    const value = String(code || "").trim();
    if (!value) return "";
    if (/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Numpad[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Tab|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash)$/i.test(value)) {
      if (/^key[a-z]$/i.test(value)) return `Key${value.slice(-1).toUpperCase()}`;
      if (/^digit[0-9]$/i.test(value)) return `Digit${value.slice(-1)}`;
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    if (/^[a-z]$/i.test(value)) return `Key${value.toUpperCase()}`;
    if (/^[0-9]$/.test(value)) return `Digit${value}`;
    return "";
  }

  // ===== restored core panel helpers (had been interleaved with target-order) =====
  function formatKeyboardCode(code) {
    const normalized = normalizeKeyboardCode(code) || "";
    if (/^Key[A-Z]$/.test(normalized)) return normalized.slice(3);
    if (/^Digit[0-9]$/.test(normalized)) return normalized.slice(5);
    return normalized;
  }

  function installGearPresetHandlers(shadow) {
    installPresetPanelHandlers(shadow, GEAR_PRESET_QUICK_NAMES, {
      saveId: (presetName) => `saveGearPreset${presetName}`,
      applyId: (presetName) => `equipGearPreset${presetName}`,
      save: (presetName) => pageWindow.HordesKrMod.saveEquippedGearPreset(presetName),
      apply: (presetName) => pageWindow.HordesKrMod.equipGearPreset(presetName),
    });
  }

  function installSkillPresetHandlers(shadow) {
    installPresetPanelHandlers(shadow, SKILL_PRESET_QUICK_NAMES, {
      saveId: (presetName) => `saveSkillPreset${presetName}`,
      applyId: (presetName) => `applySkillPreset${presetName}`,
      save: (presetName) => pageWindow.HordesKrMod.saveSkillPreset(presetName),
      apply: (presetName) => pageWindow.HordesKrMod.applySkillPreset(presetName),
    });
  }

  function renderFeatureToggles(shadow) {
    setFeatureToggleButton(shadow, "toggleMinimapLabels", "미니맵", HIGHLIGHT_CONFIG.minimapLabelsEnabled);
    setFeatureToggleButton(
      shadow,
      "toggleIncomingSkill",
      "시전/주시",
      FEATURE_CONFIG.incomingSkillOverlayEnabled !== false || FEATURE_CONFIG.incomingTargetWatchEnabled !== false
    );
    setFeatureToggleButton(shadow, "toggleTargetDistance", "타겟거리", FEATURE_CONFIG.targetDistanceEnabled);
    renderChatTranslationToggle(shadow);
    setFeatureToggleButton(shadow, "toggleHighlightList", "강조목록", HIGHLIGHT_CONFIG.minimapListEnabled);
    setFeatureToggleButton(shadow, "togglePartyUi", "파티창이동", PARTY_UI_CONFIG.enabled);
    setFeatureToggleButton(shadow, "togglePartyCommandPanel", "파티패널", PARTY_COMMAND_CONFIG.enabled);
    setFeatureToggleButton(shadow, "toggleSwiftshotTurbo", "스킬터보", FEATURE_CONFIG.swiftshotTurboEnabled);
    const preset = shadow.getElementById("partyPreset5x2");
    if (preset) {
      preset.classList.toggle("off", PARTY_UI_CONFIG.preset !== "self5x2");
      preset.title = "내 체력바 위에 5열 2행으로 배치";
    }
  }

  function setFeatureToggleButton(shadow, id, label, enabled) {
    const button = shadow.getElementById(id);
    if (!button) return;

    const text = `${label} ${enabled ? "켜짐" : "꺼짐"}`;
    setPanelButtonState(button, {
      disabled: false,
      off: !enabled,
      text,
      title: text,
    });
  }

  function renderGearPresetUi(shadow) {
    const status = shadow.getElementById("gearPresetStatus");
    const note = shadow.getElementById("gearPresetNote");
    if (!status) return;

    const presets = GEAR_PRESET_QUICK_NAMES.map((presetName) => ({
      name: presetName,
      preset: getGearPreset(presetName),
      save: shadow.getElementById(`saveGearPreset${presetName}`),
      equip: shadow.getElementById(`equipGearPreset${presetName}`),
    }));
    const presetSummaryParts = presets.map(({ name, preset }) => {
      const count = preset && Array.isArray(preset.items) ? preset.items.length : 0;
      return `${name}:${count}`;
    });
    const equippedItems = STATUS_UI.panelOpen ? scanRuntimeEquippedGearItems().map(stripGearPresetElement) : [];
    const runtimeItems = STATUS_UI.panelOpen ? scanRuntimeGearItems().map(stripGearPresetElement) : [];
    const socket = getGearSocketStatus();
    const socketText = getPresetSocketStatusText(socket);

    const staleScanError =
      GEAR_PRESET_STATE.lastState === "저장 실패" &&
      GEAR_PRESET_STATE.lastError &&
      equippedItems.length > 0;

    if (GEAR_PRESET_STATE.running) {
      status.textContent = "장착 중";
    } else if (GEAR_PRESET_STATE.lastError && !staleScanError) {
      status.textContent = GEAR_PRESET_STATE.lastState || "오류";
    } else {
      status.textContent = `장착 ${equippedItems.length}개 / ${presetSummaryParts.join(" ")} / ${socketText}`;
    }
    status.title = staleScanError ? "" : GEAR_PRESET_STATE.lastError || "";

    presets.forEach(({ name, preset, save, equip }) => {
      const presetCount = preset && Array.isArray(preset.items) ? preset.items.length : 0;
      setPanelButtonState(save, {
        disabled: GEAR_PRESET_STATE.running,
        title: `현재 장착 중인 아이템의 고유 ID(dbid)를 프리셋 ${name}에 저장합니다.`,
      });
      setPanelButtonState(equip, {
        disabled: GEAR_PRESET_STATE.running || presetCount === 0,
        title: `프리셋 ${name}의 아이템 dbid를 현재 슬롯에서 찾아 서버 장착 명령을 보냅니다. 가방을 닫아도 실행 가능합니다.`,
      });
    });

    if (note) {
      const equippedSummary = summarizeGearPresetItems(equippedItems);
      note.textContent = joinStatusParts([
        equippedSummary ? `현재장착: ${equippedSummary}` : "현재 장착 정보 없음",
        runtimeItems.length ? `인벤토리감지: ${runtimeItems.length}개` : "인벤토리 감지 없음",
        socket.available ? "전송: dbid 검색 후 itemmove" : "전송: 새로고침 후 연결 감지",
        GEAR_PRESET_STATE.lastResult
          ? `최근: 장착 ${GEAR_PRESET_STATE.lastResult.equipped}/${GEAR_PRESET_STATE.lastResult.requested}, 해제 ${GEAR_PRESET_STATE.lastResult.unequipped || 0}${
              GEAR_PRESET_STATE.lastResult.savedSlotFallback
                ? `, 저장슬롯 ${GEAR_PRESET_STATE.lastResult.savedSlotFallback}개`
                : ""
            }`
          : "",
      ]);
    }
  }

  function renderSkillPresetUi(shadow) {
    const status = shadow.getElementById("skillPresetStatus");
    const note = shadow.getElementById("skillPresetNote");
    if (!status) return;

    const presets = SKILL_PRESET_QUICK_NAMES.map((presetName) => ({
      name: presetName,
      preset: getSkillPreset(presetName),
      save: shadow.getElementById(`saveSkillPreset${presetName}`),
      apply: shadow.getElementById(`applySkillPreset${presetName}`),
    }));
    const presetSummaryParts = presets.map(({ name, preset }) => {
      const count = filterConfigurableSkillPresetIds(preset && preset.skillIds || []).length;
      return `${name}:${count}`;
    });
    const activeSkillIds = STATUS_UI.panelOpen ? scanRuntimeActiveSkillIds() : [];
    const socket = getGearSocketStatus();
    const socketText = getPresetSocketStatusText(socket);

    const staleScanError =
      SKILL_PRESET_STATE.lastState === "저장 실패" &&
      SKILL_PRESET_STATE.lastError &&
      activeSkillIds.length > 0;

    if (SKILL_PRESET_STATE.running) {
      status.textContent = "적용 중";
    } else if (SKILL_PRESET_STATE.lastError && !staleScanError) {
      status.textContent = SKILL_PRESET_STATE.lastState || "오류";
    } else {
      status.textContent = `활성 ${activeSkillIds.length}포인트 / ${presetSummaryParts.join(" ")} / ${socketText}`;
    }
    status.title = staleScanError ? "" : SKILL_PRESET_STATE.lastError || "";

    presets.forEach(({ name, preset, save, apply }) => {
      const presetCount = filterConfigurableSkillPresetIds(preset && preset.skillIds || []).length;
      setPanelButtonState(save, {
        disabled: SKILL_PRESET_STATE.running,
        title: `현재 활성 스킬 구성을 프리셋 ${name}에 저장합니다.`,
      });
      setPanelButtonState(apply, {
        disabled: SKILL_PRESET_STATE.running || presetCount === 0,
        title: `프리셋 ${name}의 스킬 ID 목록을 skillconfig 명령으로 적용합니다.`,
      });
    });

    if (note) {
      note.textContent = joinStatusParts([
        activeSkillIds.length ? `현재활성: ${summarizeSkillPresetIds(activeSkillIds)}` : "현재 활성 스킬 정보 없음",
        socket.available ? "전송: skillconfig" : "전송: 새로고침 후 연결 감지",
        SKILL_PRESET_STATE.lastResult
          ? `최근: ${SKILL_PRESET_STATE.lastResult.sent ? "전송됨" : "전송없음"}${
              SKILL_PRESET_STATE.lastResult.verify
                ? `, 확인 ${SKILL_PRESET_STATE.lastResult.verify.matched}/${SKILL_PRESET_STATE.lastResult.verify.total}`
                : ""
            }`
          : "",
      ]);
    }
  }

  function renderChatApiKeyUi(shadow) {
    const status = shadow.getElementById("chatApiKeyStatus");
    const input = shadow.getElementById("chatApiKeyInput");
    if (!status) return;

    const hasKey = hasChatTranslationApiKey();
    const error = CHAT_TRANSLATION_STATE.lastError || "";
    const active = isChatTranslationEnabled();
    status.textContent = hasKey
      ? active
        ? "저장됨 / 번역 켜짐"
        : "저장됨"
      : error === "API 키 없음"
        ? "키 없음"
        : "미저장";

    if (input) {
      input.placeholder = hasKey ? "새 키 입력 시 교체" : "OpenAI API 키";
    }
  }

  function joinStatusParts(parts) {
    return parts.filter(Boolean).join(" / ");
  }


  // ===== restored core panel helpers (batch 2) =====
  function getPresetSocketStatusText(socket) {
    if (socket && socket.available) return "서버연결";
    if (socket && socket.wrapped) return "서버대기";
    return "서버미감지";
  }

  function installPresetPanelHandlers(shadow, presetNames, actions) {
    for (const presetName of presetNames) {
      const save = shadow.getElementById(actions.saveId(presetName));
      const apply = shadow.getElementById(actions.applyId(presetName));

      if (save) {
        save.addEventListener("click", () => {
          actions.save(presetName);
          refreshPresetQuickBarAndStatus();
        });
      }

      if (apply) {
        apply.addEventListener("click", () => {
          runPresetPanelAction(() => actions.apply(presetName));
        });
      }
    }
  }

  function renderChatTranslationToggle(shadow) {
    const button = shadow.getElementById("toggleChatTranslation");
    if (!button) return;

    if (!hasChatTranslationApiKey()) {
      button.textContent = "채팅번역 키없음";
      button.classList.add("off");
      button.title = "패널의 채팅 번역 키에서 API 키를 저장한 뒤 켜세요.";
      return;
    }

    setFeatureToggleButton(shadow, "toggleChatTranslation", "채팅번역", isChatTranslationEnabled());
  }

  function setPanelButtonState(button, options = {}) {
    if (!button) return;
    const disabled = Boolean(options.disabled);
    button.disabled = disabled;
    button.classList.toggle("off", "off" in options ? Boolean(options.off) : disabled);
    if ("text" in options) button.textContent = options.text;
    if ("title" in options) button.title = options.title;
  }

  function summarizeGearPresetItems(items) {
    const counts = new Map();
    for (const item of items || []) {
      const key = item.itemType || "item";
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([type, count]) => count > 1 ? `${type}x${count}` : type)
      .join(", ");
  }

  function isPartyCommandEditableEvent(event) {
    const active = document.activeElement;
    if (isEditableUiElement(active)) return true;

    if (typeof event.composedPath === "function") {
      return event.composedPath().some((element) => isEditableUiElement(element));
    }

    return isEditableUiElement(event.target);
  }

  function setPartyCommandPanelEnabled(enabled) {
    PARTY_COMMAND_CONFIG.enabled = Boolean(enabled);
    savePartyCommandConfig();
    PARTY_COMMAND_STATE.renderKey = "";
    updatePartyCommandPanel();
    renderStatusUi();
    return getPartyCommandPanelStatus();
  }

  function resetPartyCommandPanelPosition() {
    PARTY_COMMAND_CONFIG.x = null;
    PARTY_COMMAND_CONFIG.y = null;
    PARTY_COMMAND_STATE.channelMenuOpen = false;
    savePartyCommandConfig();
    PARTY_COMMAND_STATE.renderKey = "";
    updatePartyCommandPanel();
    return getPartyCommandPanelStatus();
  }

  function setPartyCommandChannel(channel) {
    PARTY_COMMAND_CONFIG.channel = normalizeHordesChatChannel(channel || "clan");
    PARTY_COMMAND_STATE.channelMenuOpen = false;
    PARTY_COMMAND_STATE.renderKey = "";
    savePartyCommandConfig();
    updatePartyCommandPanel();
    renderStatusUi();
    return getPartyCommandPanelStatus();
  }

  async function sendPartyChatCommand(message) {
    const normalized = normalizePartyChatCommand(message, PARTY_COMMAND_CONFIG.channel);
    if (!normalized.ok) {
      PARTY_COMMAND_STATE.lastState = "전송 실패";
      PARTY_COMMAND_STATE.lastError = normalized.reason;
      return normalized;
    }

    PARTY_COMMAND_CONFIG.lastMessage = normalized.body;
    PARTY_COMMAND_CONFIG.channel = normalized.channel;
    savePartyCommandConfig();
    let result;
    try {
      sendHordesChatMessage(normalized.channel, normalized.body);
      result = {
        ok: true,
        method: "websocket",
        reason: "",
      };
    } catch (error) {
      result = await sendGameChatText(normalized.commandText, { submit: true });
      result.method = result.method || "chat-input";
      if (!result.ok && error) {
        result.reason = result.reason || (error && error.message ? error.message : String(error));
      }
    }
    PARTY_COMMAND_STATE.lastText = normalized.body;
    PARTY_COMMAND_STATE.lastSentAt = result.ok ? new Date() : PARTY_COMMAND_STATE.lastSentAt;
    PARTY_COMMAND_STATE.sentCount += result.ok ? 1 : 0;
    PARTY_COMMAND_STATE.lastState = result.ok ? "전송됨" : "전송 실패";
    PARTY_COMMAND_STATE.lastError = result.ok ? "" : result.reason || "게임 채팅 전송 실패";
    return {
      ...result,
      body: normalized.body,
      channel: normalized.channel,
      commandText: normalized.commandText,
      state: PARTY_COMMAND_STATE.lastState,
    };
  }

  function normalizePartyChatCommand(message, channel) {
    const normalizedChannel = normalizeHordesChatChannel(channel || "clan");
    let body = String(message || "").replace(/\s+/g, " ").trim();
    body = body.replace(/^\/(?:party|p|clan|c|faction|f|yell|y|global)\s+/i, "").trim();
    if (!body) return { ok: false, reason: `${getHordesChatChannelLabel(normalizedChannel)} 메시지가 비어 있습니다.` };
    if (body.length > 120) body = body.slice(0, 120).trim();
    return {
      ok: true,
      channel: normalizedChannel,
      body,
      commandText: `/${normalizedChannel} ${body}`,
    };
  }

  function normalizeHordesChatChannel(channel) {
    const normalized = String(channel || "").replace(/^\//, "").trim().toLowerCase();
    const mapped = HORDES_CHAT_CHANNEL_ALIASES[normalized] || normalized;
    return HORDES_CHAT_CHANNELS.has(mapped) ? mapped : "clan";
  }

  function getHordesChatChannelLabel(channel) {
    const normalized = normalizeHordesChatChannel(channel);
    if (normalized === "clan") return "클랜";
    if (normalized === "party") return "파티";
    if (normalized === "faction") return "진영";
    if (normalized === "yell") return "외침";
    if (normalized === "global") return "전체";
    return normalized;
  }

  async function sendGameChatText(text, options = {}) {
    const normalized = String(text || "").trim();
    if (!normalized) return { ok: false, reason: "전송할 채팅이 비어 있습니다." };

    const input = await findOrOpenGameChatInputElement();
    if (!input) {
      return {
        ok: false,
        reason: "게임 채팅 입력칸을 찾지 못했습니다. 채팅창을 한 번 열고 다시 시도하세요.",
      };
    }

    setEditableElementValue(input, normalized);
    try {
      input.focus({ preventScroll: true });
    } catch {
      try {
        input.focus();
      } catch {}
    }

    const submitted = options.submit !== false ? dispatchGameChatSubmit(input) : false;
    return {
      ok: true,
      submitted,
      element: describeChatInputElement(input),
      text: normalized,
    };
  }

  async function findOrOpenGameChatInputElement() {
    let input = findGameChatInputElement();
    if (input) return input;

    for (let attempt = 0; attempt < 4; attempt++) {
      dispatchGameChatOpenKey();
      await delay(60);
      input = findGameChatInputElement();
      if (input) return input;
    }

    return null;
  }

  function dispatchGameChatOpenKey() {
    const target = getSwiftshotTurboInputTarget();
    dispatchKeyboardSequence(target, "Enter");
  }

  function dispatchGameChatSubmit(input) {
    let dispatched = 0;
    const targets = [input, document, pageWindow].filter(Boolean);
    for (const target of targets) {
      dispatched += dispatchKeyboardSequence(target, "Enter");
    }

    const form = input && (input.form || input.closest && input.closest("form"));
    if (form) {
      try {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        dispatched += 1;
      } catch {
        // Form submit is best-effort; Hordes normally handles Enter.
      }
    }

    return dispatched > 0;
  }

  function dispatchKeyboardSequence(target, key) {
    if (!target || typeof target.dispatchEvent !== "function") return 0;

    let count = 0;
    for (const type of ["keydown", "keypress", "keyup"]) {
      const event = createKeyboardEvent(type, key);
      target.dispatchEvent(event);
      count++;
    }
    return count;
  }

  function createKeyboardEvent(type, key) {
    const code = key === "Enter" ? "Enter" : key;
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key,
      code,
      which: key === "Enter" ? 13 : 0,
      keyCode: key === "Enter" ? 13 : 0,
      charCode: type === "keypress" && key === "Enter" ? 13 : 0,
    });

    for (const [property, value] of Object.entries({
      keyCode: key === "Enter" ? 13 : 0,
      which: key === "Enter" ? 13 : 0,
      charCode: type === "keypress" && key === "Enter" ? 13 : 0,
    })) {
      try {
        Object.defineProperty(event, property, {
          configurable: true,
          get() {
            return value;
          },
        });
      } catch {
        // Browser-native KeyboardEvent fields may be non-configurable.
      }
    }

    return event;
  }

  function getPartyCommandTargetSummary() {
    const selected = getSelectedTargetIdStatus();
    if (selected && selected.id) {
      return {
        id: selected.id,
        name: selected.name || selected.id,
        source: selected.source || "",
      };
    }

    const distance = getTargetDistance(false);
    if (distance && distance.available && distance.target) {
      return {
        id: distance.target.id || "",
        name: distance.target.name || "",
        source: distance.target.referenceSource || "",
      };
    }

    return { id: "", name: "", source: "" };
  }

  function getPartyCommandPanelStatus() {
    const host = PARTY_COMMAND_STATE.host;
    const rect = host && document.contains(host) ? host.getBoundingClientRect() : null;
    return {
      enabled: PARTY_COMMAND_CONFIG.enabled,
      channel: PARTY_COMMAND_CONFIG.channel,
      position: Number.isFinite(PARTY_COMMAND_CONFIG.x) && Number.isFinite(PARTY_COMMAND_CONFIG.y)
        ? { mode: "custom", x: PARTY_COMMAND_CONFIG.x, y: PARTY_COMMAND_CONFIG.y }
        : { mode: "default" },
      host: Boolean(host && document.contains(host)),
      rect: rect
        ? {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
      lastState: PARTY_COMMAND_STATE.lastState,
      lastError: PARTY_COMMAND_STATE.lastError,
      lastText: PARTY_COMMAND_STATE.lastText,
      hotkeys: {
        target: "Z",
        gather: "X",
        installed: PARTY_COMMAND_STATE.hotkeysInstalled,
      },
      sentCount: PARTY_COMMAND_STATE.sentCount,
      lastSentAt: PARTY_COMMAND_STATE.lastSentAt,
    };
  }

  function initSwiftshotTurbo() {
    installSwiftshotTurboKeyboardHandler();
  }

  function installSwiftshotTurboKeyboardHandler() {
    if (SWIFTSHOT_TURBO_STATE.keyboardInstalled) return;
    SWIFTSHOT_TURBO_STATE.keyboardInstalled = true;

    const onKeyDown = (event) => {
      if (SWIFTSHOT_TURBO_STATE.synthetic) return;
      if (!isSwiftshotTurboKeyEvent(event)) return;
      const normalizedCode = normalizeKeyboardCode(event.code) || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;

      if (SWIFTSHOT_TURBO_STATE.held && event.repeat && SWIFTSHOT_TURBO_STATE.activeCode === normalizedCode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.repeat || shouldIgnoreSwiftshotTurboEvent(event)) return;
      startSwiftshotTurbo(normalizedCode);
    };

    const onKeyUp = (event) => {
      if (SWIFTSHOT_TURBO_STATE.synthetic) return;
      if (!isSwiftshotTurboKeyEvent(event)) return;
      if (SWIFTSHOT_TURBO_STATE.activeCode && SWIFTSHOT_TURBO_STATE.activeCode !== normalizeKeyboardCode(event.code)) return;
      stopSwiftshotTurbo();
    };

    pageWindow.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    pageWindow.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("keyup", onKeyUp, true);
    pageWindow.addEventListener("blur", stopSwiftshotTurbo);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") stopSwiftshotTurbo();
    });
  }

  function isSwiftshotTurboKeyEvent(event) {
    return Boolean(event && FEATURE_CONFIG.swiftshotTurboKeyCodes.includes(normalizeKeyboardCode(event.code)));
  }

  function shouldIgnoreSwiftshotTurboEvent(event) {
    if (!FEATURE_CONFIG.swiftshotTurboEnabled) return true;
    if (!event || event.defaultPrevented || event.isComposing) return true;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return true;
    if (document.visibilityState && document.visibilityState !== "visible") return true;
    return isPartyCommandEditableEvent(event) || isStatusUiKeyboardEvent(event);
  }

  function startSwiftshotTurbo(code) {
    const normalized = normalizeKeyboardCode(code) || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
    if (SWIFTSHOT_TURBO_STATE.held && SWIFTSHOT_TURBO_STATE.activeCode === normalized) return;

    stopSwiftshotTurbo();
    SWIFTSHOT_TURBO_STATE.held = true;
    SWIFTSHOT_TURBO_STATE.activeCode = normalized;
    SWIFTSHOT_TURBO_STATE.lastError = "";
    SWIFTSHOT_TURBO_STATE.companionPrevCdEnd = null;
    SWIFTSHOT_TURBO_STATE.timer = setInterval(() => {
      dispatchSwiftshotTurboPulse(normalized);
    }, getSwiftshotTurboIntervalMs());
    // Only the E-style combo keys get the tight companion watcher; plain turbo
    // keys never enter this branch and keep their single-timer behavior.
    if (turboKeyHasCompanions(normalized)) {
      SWIFTSHOT_TURBO_STATE.companionTimer = setInterval(() => {
        dispatchSwiftshotTurboCompanion(normalized);
      }, SWIFTSHOT_TURBO_COMPANION_WATCH_MS);
    }
  }

  function stopSwiftshotTurbo() {
    if (SWIFTSHOT_TURBO_STATE.timer) {
      clearInterval(SWIFTSHOT_TURBO_STATE.timer);
      SWIFTSHOT_TURBO_STATE.timer = null;
    }
    if (SWIFTSHOT_TURBO_STATE.companionTimer) {
      clearInterval(SWIFTSHOT_TURBO_STATE.companionTimer);
      SWIFTSHOT_TURBO_STATE.companionTimer = null;
    }
    SWIFTSHOT_TURBO_STATE.held = false;
    SWIFTSHOT_TURBO_STATE.activeCode = "";
    SWIFTSHOT_TURBO_STATE.companionPrevCdEnd = null;
  }

  function dispatchSwiftshotTurboPulse(code) {
    if (!FEATURE_CONFIG.swiftshotTurboEnabled || isSwiftshotTurboSuspended()) {
      stopSwiftshotTurbo();
      return false;
    }

    const target = getRuntimeInputCanvas(getExposedRuntime()) || document.body || document.documentElement || document;
    if (!target || typeof target.dispatchEvent !== "function") {
      SWIFTSHOT_TURBO_STATE.lastError = "입력 대상 없음";
      return false;
    }

    // Only grab focus when no game canvas is focused yet. Re-focusing on every
    // pulse can steal focus from the canvas that actually receives movement
    // keys (Hordes runs multiple canvases), which drops the keyup for a held
    // movement key and leaves the forward key locked on. Synthetic events are
    // delivered via dispatchEvent + bubbling regardless of focus.
    const activeElement = document.activeElement;
    const canvasAlreadyFocused = Boolean(activeElement && activeElement.tagName === "CANVAS");
    if (!canvasAlreadyFocused) {
      try {
        if (typeof target.focus === "function") target.focus({ preventScroll: true });
      } catch {
        // Focus is best-effort.
      }
    }

    SWIFTSHOT_TURBO_STATE.synthetic = true;
    try {
      dispatchKeyboardPulseForCode(target, code);
      SWIFTSHOT_TURBO_STATE.repeatCount++;
      SWIFTSHOT_TURBO_STATE.lastAt = Date.now();
      SWIFTSHOT_TURBO_STATE.lastError = "";
      return true;
    } catch (error) {
      SWIFTSHOT_TURBO_STATE.lastError = error && error.message ? error.message : String(error);
      return false;
    } finally {
      SWIFTSHOT_TURBO_STATE.synthetic = false;
    }
  }

  function isSwiftshotTurboSuspended() {
    if (document.visibilityState && document.visibilityState !== "visible") return true;
    return isEditableUiElement(document.activeElement);
  }

  // Companion keys fire only on the pulse where the primary key's skill actually
  // RESOLVES (finishes casting / fires). Firing the companion at the same instant
  // as the primary makes the instant, GCD-ignoring companion (5) supersede the
  // primary's cast so the primary never lands — verified against the live client.
  // If we can't resolve the skill we fire nothing (the user's rule: "if E didn't
  // fire, 5 must not fire").
  function turboKeyHasCompanions(code) {
    const normalized = normalizeKeyboardCode(code) || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
    const companions = SWIFTSHOT_TURBO_COMPANION_KEY_CODES[normalized];
    return Boolean(companions && companions.length);
  }

  // Runs on the fast companion-watch timer (independent of the primary pulse).
  // Fires the companion keys the moment the primary key's skill resolves.
  function dispatchSwiftshotTurboCompanion(code) {
    if (!FEATURE_CONFIG.swiftshotTurboEnabled || isSwiftshotTurboSuspended()) return;
    const companionCodes = getReadyTurboCompanionCodes(code);
    if (!companionCodes.length) return;

    const target = getRuntimeInputCanvas(getExposedRuntime()) || document.body || document.documentElement || document;
    if (!target || typeof target.dispatchEvent !== "function") return;

    SWIFTSHOT_TURBO_STATE.synthetic = true;
    try {
      for (const companionCode of companionCodes) {
        dispatchKeyboardPulseForCode(target, companionCode);
      }
    } finally {
      SWIFTSHOT_TURBO_STATE.synthetic = false;
    }
  }

  function getReadyTurboCompanionCodes(code) {
    const normalized = normalizeKeyboardCode(code) || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
    const companions = SWIFTSHOT_TURBO_COMPANION_KEY_CODES[normalized];
    if (!companions || !companions.length) return [];
    if (!didPrimaryTurboSkillResolve(normalized)) return [];

    const codes = [];
    for (const companion of companions) {
      const normalizedCompanion = normalizeKeyboardCode(companion);
      if (normalizedCompanion && normalizedCompanion !== normalized && !codes.includes(normalizedCompanion)) {
        codes.push(normalizedCompanion);
      }
    }
    return codes;
  }

  function didPrimaryTurboSkillResolve(code) {
    const runtime = getExposedRuntime();
    const skillId = getTurboSkillIdForKeyCode(runtime, code);
    const state = skillId === null ? null : getTurboPrimarySkillState(runtime, skillId);
    if (!state) {
      // Runtime not ready or skill unresolved: drop the baseline so we re-arm
      // cleanly, and fire no companion (per "if E didn't fire, 5 must not fire").
      SWIFTSHOT_TURBO_STATE.companionPrevCdEnd = null;
      return false;
    }

    const { cdEnd, gcdEnd } = state;
    const prev = SWIFTSHOT_TURBO_STATE.companionPrevCdEnd;
    // The cast-start GCD bump pushes the skill's cd.end up to exactly gcdEnd;
    // only when cd.end extends PAST the GCD window has the skill actually fired
    // (its own per-skill cooldown). That edge — and only that edge — fires 5.
    // We always advance the baseline on any change so the bump itself is consumed
    // without firing, leaving the real resolve as the next detectable jump.
    const resolved = prev !== null && cdEnd > prev && cdEnd > gcdEnd;
    if (prev === null || cdEnd !== prev) SWIFTSHOT_TURBO_STATE.companionPrevCdEnd = cdEnd;
    return resolved;
  }

  function getTurboSkillIdForKeyCode(runtime, code) {
    const settings = runtime && runtime.settings;
    const player = runtime && runtime.player;
    if (!settings || !player || !player.name) return null;

    const keyChar = getKeyboardDescriptorFromCode(code).key;
    if (!keyChar) return null;

    for (let slot = 1; slot <= 24; slot++) {
      if (settings["kbSkillbar" + slot] !== keyChar) continue;
      const bar = settings.skillbarsettings && settings.skillbarsettings[player.name];
      const entry = bar && bar[slot - 1];
      if (entry && Number(entry.id) >= 0) return Number(entry.id);
      return null;
    }
    return null;
  }

  function getTurboPrimarySkillState(runtime, skillId) {
    const skills = runtime && runtime.player && runtime.player.skills;
    const skillMap = skills && skills.skills;
    if (!skillMap || typeof skillMap.get !== "function") return null;
    const skill = skillMap.get(skillId);
    if (!skill || !skill.cd) return null;
    const cdEnd = Number(skill.cd.end);
    const gcdEnd = Number(skills.gcdEnd);
    if (!Number.isFinite(cdEnd)) return null;
    return { cdEnd, gcdEnd: Number.isFinite(gcdEnd) ? gcdEnd : 0 };
  }

  function dispatchKeyboardPulseForCode(target, code) {
    for (const type of ["keyup", "keydown", "keypress", "keyup"]) {
      target.dispatchEvent(createKeyboardEventFromCode(type, code));
    }
  }

  function createKeyboardEventFromCode(type, code) {
    const descriptor = getKeyboardDescriptorFromCode(code);
    const charCode = type === "keypress" ? descriptor.charCode : 0;
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: descriptor.key,
      code: descriptor.code,
      keyCode: descriptor.keyCode,
      which: type === "keypress" && charCode ? charCode : descriptor.keyCode,
      charCode,
      repeat: false,
    });

    for (const [property, value] of Object.entries({
      keyCode: descriptor.keyCode,
      which: type === "keypress" && charCode ? charCode : descriptor.keyCode,
      charCode,
    })) {
      try {
        Object.defineProperty(event, property, {
          configurable: true,
          get() {
            return value;
          },
        });
      } catch {
        // Browser-native KeyboardEvent fields may be non-configurable.
      }
    }

    return event;
  }

  function getKeyboardDescriptorFromCode(code) {
    const normalized = normalizeKeyboardCode(code) || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE;
    if (/^Key[A-Z]$/.test(normalized)) {
      const letter = normalized.slice(3);
      return {
        code: normalized,
        key: letter.toLowerCase(),
        keyCode: letter.charCodeAt(0),
        charCode: letter.toLowerCase().charCodeAt(0),
      };
    }

    if (/^Digit[0-9]$/.test(normalized)) {
      const digit = normalized.slice(5);
      return {
        code: normalized,
        key: digit,
        keyCode: digit.charCodeAt(0),
        charCode: digit.charCodeAt(0),
      };
    }

    if (normalized === "Space") {
      return { code: "Space", key: " ", keyCode: 32, charCode: 32 };
    }

    return { code: normalized, key: formatKeyboardCode(normalized), keyCode: 0, charCode: 0 };
  }

  function normalizeSwiftshotTurboKeyCodes(value) {
    const rawValues = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
    const normalized = [];

    for (const rawValue of rawValues) {
      const code = normalizeKeyboardCode(rawValue);
      if (code && !normalized.includes(code)) normalized.push(code);
    }

    if (normalized.length === 0) return [...SWIFTSHOT_TURBO_DEFAULT_KEY_CODES];
    return normalized;
  }

  function getSwiftshotTurboIntervalMs() {
    return clampInteger(
      FEATURE_CONFIG.swiftshotTurboIntervalMs,
      SWIFTSHOT_TURBO_MIN_INTERVAL_MS,
      SWIFTSHOT_TURBO_MAX_INTERVAL_MS,
      SWIFTSHOT_TURBO_DEFAULT_INTERVAL_MS
    );
  }

  function setSwiftshotTurboEnabled(enabled) {
    FEATURE_CONFIG.swiftshotTurboEnabled = Boolean(enabled);
    if (!FEATURE_CONFIG.swiftshotTurboEnabled) stopSwiftshotTurbo();
    saveFeatureConfig();
    renderStatusUi();
    return getSwiftshotTurboStatus();
  }

  function getSwiftshotTurboStatus() {
    const keyCodes = normalizeSwiftshotTurboKeyCodes(FEATURE_CONFIG.swiftshotTurboKeyCodes);
    const keys = keyCodes.map(formatKeyboardCode);
    return {
      enabled: FEATURE_CONFIG.swiftshotTurboEnabled,
      key: keys.join(", "),
      keys,
      keyCode: keyCodes[0] || SWIFTSHOT_TURBO_DEFAULT_KEY_CODE,
      keyCodes,
      intervalMs: getSwiftshotTurboIntervalMs(),
      held: SWIFTSHOT_TURBO_STATE.held,
      activeCode: SWIFTSHOT_TURBO_STATE.activeCode,
      repeatCount: SWIFTSHOT_TURBO_STATE.repeatCount,
      lastAt: SWIFTSHOT_TURBO_STATE.lastAt,
      lastError: SWIFTSHOT_TURBO_STATE.lastError,
      installed: SWIFTSHOT_TURBO_STATE.keyboardInstalled,
    };
  }

  function getPartyCommandPanelPosition(widthNumber, heightNumber) {
    if (Number.isFinite(PARTY_COMMAND_CONFIG.x) && Number.isFinite(PARTY_COMMAND_CONFIG.y)) {
      return clampPartyCommandPanelPosition(PARTY_COMMAND_CONFIG.x, PARTY_COMMAND_CONFIG.y, widthNumber, heightNumber);
    }

    return getDefaultPartyCommandPanelPosition(widthNumber, heightNumber);
  }

  function getDefaultPartyCommandPanelPosition(widthNumber, heightNumber) {
    const targetFrame = getPartyCommandTargetFrameRect();
    if (targetFrame) {
      return clampPartyCommandPanelPosition(targetFrame.right + 8, targetFrame.top, widthNumber, heightNumber);
    }

    const viewportWidth = Math.max(320, Number(pageWindow.innerWidth) || 0);
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    return clampPartyCommandPanelPosition(
      Math.round(viewportWidth * 0.5 + 300),
      Math.max(70, viewportHeight - heightNumber - 126),
      widthNumber,
      heightNumber
    );
  }

  function getPartyCommandTargetFrameRect() {
    return getVisibleElementRect(document.getElementById("uftarget"))
      || getVisibleElementRect(document.querySelector(".targetframes #uftarget"))
      || getVisibleElementRect(document.querySelector(".targetframes .grid.right"))
      || getVisibleElementRect(document.querySelector(".targetframes"));
  }

  function clampPartyCommandPanelPosition(x, y, widthNumber, heightNumber) {
    const viewportWidth = Math.max(320, Number(pageWindow.innerWidth) || 0);
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    const maxX = Math.max(4, viewportWidth - Math.max(120, Number(widthNumber) || PARTY_COMMAND_PANEL_DEFAULT_WIDTH) - 4);
    const maxY = Math.max(4, viewportHeight - Math.max(80, Number(heightNumber) || PARTY_COMMAND_PANEL_DEFAULT_HEIGHT) - 4);
    return {
      x: Math.round(clamp(Number(x) || 4, 4, maxX)),
      y: Math.round(clamp(Number(y) || 4, 4, maxY)),
    };
  }

  function applyPartyCommandPanelHostPosition(x, y) {
    const host = PARTY_COMMAND_STATE.host;
    if (!host) return;

    const left = `${Math.round(x)}px`;
    const top = `${Math.round(y)}px`;
    if (host.style.left !== left) host.style.left = left;
    if (host.style.top !== top) host.style.top = top;
  }

  function installPartyCommandPanelDragHandle(handle) {
    installWindowPointerDrag(handle, {
      getDrag: () => PARTY_COMMAND_STATE.dragging,
      setDrag: (drag) => {
        PARTY_COMMAND_STATE.dragging = drag;
      },
      getSubject: () => PARTY_COMMAND_STATE.host,
      canStart: (event) => !(event.target && event.target.closest && event.target.closest("button, input, textarea, select, a")),
      getWidth: (rect) => Math.max(PARTY_COMMAND_PANEL_DEFAULT_WIDTH, Math.round(rect.width || PARTY_COMMAND_PANEL_DEFAULT_WIDTH)),
      getHeight: (rect) => Math.max(PARTY_COMMAND_PANEL_DEFAULT_HEIGHT, Math.round(rect.height || PARTY_COMMAND_PANEL_DEFAULT_HEIGHT)),
      onStart: () => {
        const host = PARTY_COMMAND_STATE.host;
        if (host) host.dataset.hordesKrDragging = "true";
      },
      onMove: handlePartyCommandPanelDragMove,
      onEnd: handlePartyCommandPanelDragEnd,
    });
  }

  function handlePartyCommandPanelDragMove(event) {
    const drag = PARTY_COMMAND_STATE.dragging;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const position = clampPartyCommandPanelPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
      drag.width,
      drag.height
    );
    PARTY_COMMAND_CONFIG.x = position.x;
    PARTY_COMMAND_CONFIG.y = position.y;
    PARTY_COMMAND_STATE.renderKey = "";
    applyPartyCommandPanelHostPosition(position.x, position.y);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePartyCommandPanelDragEnd(event, endedDrag) {
    const drag = endedDrag || PARTY_COMMAND_STATE.dragging;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!endedDrag) PARTY_COMMAND_STATE.dragging = null;

    const host = PARTY_COMMAND_STATE.host;
    if (host) delete host.dataset.hordesKrDragging;
    savePartyCommandConfig();
    PARTY_COMMAND_STATE.renderKey = "";
    updatePartyCommandPanel();
    event.preventDefault();
    event.stopPropagation();
  }

  function installPartyCommandPanelEventGuards(panel) {
    installBasicUiEventGuards(panel.querySelectorAll("button"));
  }

  function installBasicUiEventGuards(elements) {
    elements.forEach((element) => {
      UI_CONTROL_POINTER_EVENTS.forEach((type) => {
        element.addEventListener(type, stopUiEventPropagation);
      });
      STATUS_UI_KEYBOARD_EVENTS.forEach((type) => {
        element.addEventListener(type, stopUiEventPropagation);
      });
    });
  }

  function stopUiEventPropagation(event) {
    event.stopPropagation();
  }

  function installPartyCommandPanelStyle() {
    if (document.getElementById("hordes-kr-party-command-panel-style")) return;

    const style = document.createElement("style");
    style.id = "hordes-kr-party-command-panel-style";
    style.textContent = `
      #hordes-kr-party-command-panel {
        position: fixed !important;
        z-index: 2147483647 !important;
        width: ${PARTY_COMMAND_PANEL_DEFAULT_WIDTH}px !important;
        pointer-events: auto !important;
        font-family: Arial, Helvetica, sans-serif !important;
        color: #dff8f5 !important;
        touch-action: none !important;
      }
      #hordes-kr-party-command-panel[hidden] {
        display: none !important;
      }
      .hordes-kr-party-command-panel {
        display: grid !important;
        gap: 5px !important;
        border: 1px solid rgba(166, 220, 213, 0.34) !important;
        border-radius: 6px !important;
        background: rgba(16, 19, 29, 0.9) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38) !important;
        padding: 6px !important;
        box-sizing: border-box !important;
        font: 900 11px/1.15 Arial, Helvetica, sans-serif !important;
      }
      #hordes-kr-party-command-panel[data-hordes-kr-dragging="true"] .hordes-kr-party-command-panel {
        border-color: rgba(245, 194, 71, 0.82) !important;
      }
      .hordes-kr-party-command-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
        color: #a6dcd5 !important;
        font-weight: 1000 !important;
        cursor: move !important;
        user-select: none !important;
        touch-action: none !important;
        padding-bottom: 4px !important;
        border-bottom: 1px solid rgba(166, 220, 213, 0.16) !important;
      }
      .hordes-kr-party-command-controls {
        display: inline-flex !important;
        gap: 3px !important;
        cursor: default !important;
      }
      .hordes-kr-party-command-icon,
      .hordes-kr-party-command-btn,
      .hordes-kr-party-command-channel-option {
        border: 1px solid rgba(166, 220, 213, 0.28) !important;
        border-radius: 4px !important;
        background: rgba(35, 41, 55, 0.88) !important;
        color: #dff8f5 !important;
        font: inherit !important;
        font-weight: 1000 !important;
        line-height: 1 !important;
        cursor: pointer !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      .hordes-kr-party-command-icon {
        width: 18px !important;
        height: 18px !important;
      }
      .hordes-kr-party-command-channel {
        position: relative !important;
        display: inline-flex !important;
      }
      .hordes-kr-party-command-channel-btn {
        color: #9ee8ff !important;
        border-color: rgba(116, 184, 255, 0.45) !important;
      }
      .hordes-kr-party-command-channel-menu {
        position: absolute !important;
        top: 21px !important;
        right: 0 !important;
        z-index: 2147483647 !important;
        display: grid !important;
        gap: 3px !important;
        min-width: 72px !important;
        padding: 4px !important;
        border: 1px solid rgba(166, 220, 213, 0.34) !important;
        border-radius: 5px !important;
        background: rgba(16, 19, 29, 0.96) !important;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.38) !important;
      }
      .hordes-kr-party-command-channel-menu[hidden] {
        display: none !important;
      }
      .hordes-kr-party-command-channel-option {
        height: 20px !important;
        padding: 0 6px !important;
        text-align: left !important;
        white-space: nowrap !important;
        color: #dff8f5 !important;
      }
      .hordes-kr-party-command-channel-option.active {
        color: #10131d !important;
        border-color: rgba(245, 194, 71, 0.85) !important;
        background: rgba(245, 194, 71, 0.9) !important;
      }
      .hordes-kr-party-command-quick {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 4px !important;
      }
      .hordes-kr-party-command-btn {
        min-width: 0 !important;
        height: 24px !important;
        color: #f5c247 !important;
      }
      .hordes-kr-party-command-btn.wide {
        grid-column: 1 / -1 !important;
        height: 30px !important;
      }
      .hordes-kr-party-command-btn.target {
        color: #bfe3ff !important;
        border-color: rgba(116, 184, 255, 0.42) !important;
        background: rgba(28, 58, 96, 0.78) !important;
      }
      .hordes-kr-party-command-btn:disabled {
        color: rgba(166, 220, 213, 0.46) !important;
        border-color: rgba(166, 220, 213, 0.16) !important;
        background: rgba(35, 41, 55, 0.62) !important;
        cursor: default !important;
      }
      .hordes-kr-party-command-icon:hover,
      .hordes-kr-party-command-btn:hover,
      .hordes-kr-party-command-channel-option:hover {
        border-color: rgba(245, 194, 71, 0.9) !important;
        color: #fff3b0 !important;
      }
      .hordes-kr-party-command-note {
        min-height: 13px !important;
        color: #8ea6aa !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function installPartyUiStyle() {
    if (document.getElementById("hordes-kr-party-ui-style")) return;

    const style = document.createElement("style");
    style.id = "hordes-kr-party-ui-style";
    style.textContent = `
      #hordes-kr-party-ui-handle {
        position: fixed !important;
        z-index: 2147483201 !important;
        min-width: 64px !important;
        height: 18px !important;
        padding: 1px 6px !important;
        border: 1px solid rgba(245, 194, 71, 0.78) !important;
        border-radius: 4px !important;
        background: rgba(16, 19, 29, 0.86) !important;
        color: #f5d46b !important;
        font: 700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        line-height: 14px !important;
        cursor: move !important;
        pointer-events: auto !important;
        user-select: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
      }
      .partyframes[data-hordes-kr-party-ui="1"] > * {
        width: 100% !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    pageWindow.addEventListener("pointermove", handlePartyUiDrag, true);
    pageWindow.addEventListener("pointerup", finishPartyUiDrag, true);
    pageWindow.addEventListener("pointercancel", finishPartyUiDrag, true);
  }

  function scheduleDomTranslationFlush() {
    if (DOM_TRANSLATION_STATE.pending) return;
    DOM_TRANSLATION_STATE.pending = true;

    setTimeout(() => {
      DOM_TRANSLATION_STATE.pending = false;
      if (!isDomTranslationEnabled() || !DOM_TRANSLATION_STATE.dictionary) {
        DOM_TRANSLATION_STATE.queuedRoots.clear();
        return;
      }

      let replaced = 0;
      const roots = Array.from(DOM_TRANSLATION_STATE.queuedRoots).slice(0, 150);
      DOM_TRANSLATION_STATE.queuedRoots.clear();
      roots.forEach((root) => {
        replaced += translateDomTree(root, DOM_TRANSLATION_STATE.dictionary);
      });
      updateDomTranslationStatus(replaced);
    }, 80);
  }

  function applyDomTranslation(root) {
    if (!isDomTranslationEnabled() || !DOM_TRANSLATION_STATE.dictionary) return 0;

    const replaced = translateDomTree(root, DOM_TRANSLATION_STATE.dictionary);
    updateDomTranslationStatus(replaced);
    return replaced;
  }

  function updateDomTranslationStatus(replaced) {
    if (replaced <= 0) return;

    setStatus({
      lastState: "DOM 번역 적용됨",
      domReplacedCount: MOD_STATUS.domReplacedCount + replaced,
      lastAppliedAt: new Date(),
      lastError: "",
    });
  }

  function buildTextDictionary(enLoc, koLoc) {
    const enEntries = flattenStrings(enLoc);
    const koEntries = flattenStrings(koLoc);
    const dictionary = new Map();

    for (const [path, enText] of enEntries) {
      const koText = koEntries.get(path);
      if (!shouldAddDictionaryEntry(enText, koText)) continue;
      dictionary.set(normalizeText(enText), koText);
    }

    return dictionary;
  }

  function flattenStrings(value, path = "", output = new Map()) {
    if (typeof value === "string") {
      output.set(path, value);
      return output;
    }

    if (!value || typeof value !== "object") return output;

    Object.entries(value).forEach(([key, child]) => {
      flattenStrings(child, path ? `${path}.${key}` : key, output);
    });

    return output;
  }

  function shouldAddDictionaryEntry(enText, koText) {
    if (!enText || !koText || enText === koText) return false;
    if (enText.length > 700 || koText.length > 900) return false;
    if (/^\s*$/.test(enText) || /^\s*$/.test(koText)) return false;
    if (/^\W+$/.test(enText)) return false;
    return true;
  }

  function translateDomTree(root, dictionary) {
    if (!root || shouldSkipNode(root)) return 0;

    if (root.nodeType === Node.TEXT_NODE) {
      return translateTextNode(root, dictionary);
    }

    let replaced = translateElementAttributes(root, dictionary);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        return shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        replaced += translateTextNode(node, dictionary);
      } else {
        replaced += translateElementAttributes(node, dictionary);
      }
      node = walker.nextNode();
    }

    return replaced;
  }

  function translateTextNode(node, dictionary) {
    if (!node || !node.nodeValue || shouldSkipNode(node)) return 0;
    const translated = translateText(node.nodeValue, dictionary);
    if (!translated || translated === node.nodeValue) return 0;
    node.nodeValue = translated;
    return 1;
  }

  function translateElementAttributes(node, dictionary) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return 0;

    let replaced = 0;
    ["title", "placeholder", "aria-label", "alt"].forEach((attribute) => {
      const value = node.getAttribute(attribute);
      const translated = translateText(value, dictionary);
      if (translated && translated !== value) {
        node.setAttribute(attribute, translated);
        replaced++;
      }
    });

    return replaced;
  }

  function translateText(text, dictionary) {
    if (!text) return text;
    const leading = text.match(/^\s*/)[0];
    const trailing = text.match(/\s*$/)[0];
    const normalized = normalizeText(text);
    const translated = dictionary.get(normalized);
    return translated ? `${leading}${translated}${trailing}` : text;
  }

  function normalizeText(text) {
    return String(text).replace(/\s+/g, " ").trim();
  }

  function shouldSkipNode(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return false;
    // Skip ALL mod-owned UI (hkr-* / hordes-kr-* hosts). These re-render constantly
    // (threat HUD, damage log, teamsync panel, 강조목록 list, toasts) and would otherwise
    // flood the 60-root translation queue, dropping real game text → intermittent + slow.
    if (element.closest('[id^="hkr-"], [id^="hordes-kr-"]')) return true;
    if (element.closest("#hordes-kr-mod-status-root")) return true;
    if (element.closest("#hordes-kr-chat-translation-toggle")) return true;
    if (element.closest(".hordes-kr-chat-inline-translation")) return true;
    if (element.closest("#hordes-kr-runtime-name-overlay")) return true;
    if (element.closest("#hordes-kr-target-distance-overlay")) return true;
    if (element.closest("#hordes-kr-minimap-name-overlay")) return true;
    if (element.closest(".hordes-kr-context-highlight-add")) return true;
    if (element.closest(".hordes-kr-name-highlight")) return true;
    if (element.closest("#chat, #chatinput, .chat, [class*='chat']")) return true;
    return !!element.closest("script, style, textarea, input, canvas, code, pre");
  }

  function initNameHighlighter() {
    const start = () => {
      if (!document.body) return;

      HIGHLIGHT_STATE.observer = new MutationObserver((mutations) => {
        if (!shouldRunDomNameHighlight()) return;
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            const parent = mutation.target && mutation.target.parentElement;
            if (parent && !shouldSkipHighlightNode(parent)) HIGHLIGHT_STATE.queuedHighlightRoots.add(parent);
          } else {
            mutation.addedNodes.forEach((node) => {
              if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
              if (shouldSkipHighlightNode(node)) return;
              HIGHLIGHT_STATE.queuedHighlightRoots.add(node);
            });
          }
        }
        scheduleNameHighlightRefresh();
      });
      installNameHighlightStyle();
      observeNameHighlights();
      refreshNameHighlights();
    };

    if (document.body) {
      start();
    } else {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    }
  }

  function initTargetContextMenuHighlight() {
    const start = () => {
      if (!document.body || HIGHLIGHT_STATE.contextMenuObserver) return;

      HIGHLIGHT_STATE.contextMenuObserver = new MutationObserver(() => {
        scheduleTargetContextMenuHighlightInjection();
      });
      HIGHLIGHT_STATE.contextMenuObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      document.addEventListener("contextmenu", (event) => {
        HIGHLIGHT_STATE.contextMenuLastAt = Date.now();
        HIGHLIGHT_STATE.contextMenuLastX = Math.round(event.clientX || 0);
        HIGHLIGHT_STATE.contextMenuLastY = Math.round(event.clientY || 0);
        HIGHLIGHT_STATE.contextMenuLastElement = getContextMenuEventElement(event.target);
        clearTargetContextMenuHighlightActions();
        setTimeout(injectTargetContextMenuHighlightAction, 40);
        setTimeout(injectTargetContextMenuHighlightAction, 140);
        setTimeout(injectTargetContextMenuHighlightAction, 320);
      }, true);
      document.addEventListener("mousedown", (event) => {
        const host = HIGHLIGHT_STATE.contextMenuActionHost;
        if (!host || !event.target || host.contains(event.target)) return;
        clearTargetContextMenuHighlightActions();
      }, true);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") clearTargetContextMenuHighlightActions();
      }, true);
    };

    if (document.body) {
      start();
    } else {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    }
  }

  function scheduleTargetContextMenuHighlightInjection() {
    if (scheduleTargetContextMenuHighlightInjection.pending) return;
    scheduleTargetContextMenuHighlightInjection.pending = true;
    setTimeout(() => {
      scheduleTargetContextMenuHighlightInjection.pending = false;
      injectTargetContextMenuHighlightAction();
    }, 60);
  }

  function injectTargetContextMenuHighlightAction() {
    try {
      const target = getContextMenuHighlightTarget();
      if (!target || !target.name) {
        clearTargetContextMenuHighlightActions();
        HIGHLIGHT_STATE.contextMenuLastError = "타겟/채팅 유저 메뉴가 아니어서 강조 ID 메뉴를 표시하지 않았습니다.";
        return;
      }

      const menus = findPlayerContextMenuElements();
      let inserted = false;
      for (const menu of menus) {
        if (!menu) continue;
        if (menu.querySelector(".hordes-kr-context-highlight-add")) {
          inserted = true;
          continue;
        }

        const action = createTargetContextMenuHighlightAction(target.name);
        menu.appendChild(action);
        HIGHLIGHT_STATE.contextMenuLastInjectedAt = Date.now();
        HIGHLIGHT_STATE.contextMenuLastTargetName = target.name;
        HIGHLIGHT_STATE.contextMenuLastSource = target.source || "";
        HIGHLIGHT_STATE.contextMenuLastError = "";
        inserted = true;
      }
      if (!inserted) {
        clearFloatingTargetContextMenuHighlightAction();
        HIGHLIGHT_STATE.contextMenuLastError = "기본 타겟 메뉴를 찾지 못했습니다.";
      }
    } catch (error) {
      HIGHLIGHT_STATE.contextMenuLastError = error && error.message ? error.message : String(error);
    }
  }

  function getContextMenuHighlightTarget() {
    const target = getSelectedTargetForHighlightMenu();
    if (target && target.name && isRecentContextMenuOnSelectedTarget(target)) {
      return { ...target, source: "target" };
    }

    return getChatContextMenuHighlightTarget();
  }

  function getContextMenuEventElement(target) {
    if (!target) return null;
    const elementNode = pageWindow.Node ? pageWindow.Node.ELEMENT_NODE : 1;
    if (target.nodeType === elementNode) return target;
    return target.parentElement || null;
  }

  function isRecentContextMenuOnSelectedTarget(target) {
    if (!target || !target.name) return false;

    const age = Date.now() - Number(HIGHLIGHT_STATE.contextMenuLastAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > 1800) return false;

    return isContextMenuElementForSelectedTarget(target);
  }

  function isContextMenuElementForSelectedTarget(target) {
    const name = normalizeHighlightName(target && target.name).toLowerCase();
    const element = HIGHLIGHT_STATE.contextMenuLastElement;
    if (!name || !element || !document.contains(element)) return false;

    if (element.closest([
      "#hordes-kr-mod-status-root",
      "#hordes-kr-chat-translation-toggle",
      ".hordes-kr-context-highlight-floating",
      "#chat",
      "#chatinput",
      ".chat",
      "[class*='chat']",
      "input",
      "textarea",
    ].join(","))) {
      return false;
    }

    // The selected-target name comes from the runtime, so right-clicking the
    // target frame itself should always qualify even when the displayed name is
    // truncated/styled and the text match below would miss it.
    if (element.closest("#uftarget, .targetframes")) return true;

    let current = element;
    for (let depth = 0; current && current !== document.body && depth < 8; depth++) {
      const rect = current.getBoundingClientRect ? current.getBoundingClientRect() : null;
      const isUiSized = !rect || (rect.width <= 720 && rect.height <= 280);
      if (isUiSized && doesElementTextContainName(current, name)) return true;
      current = current.parentElement;
    }

    return false;
  }

  function getChatContextMenuHighlightTarget() {
    const age = Date.now() - Number(HIGHLIGHT_STATE.contextMenuLastAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > 1800) return null;

    const element = HIGHLIGHT_STATE.contextMenuLastElement;
    if (!isChatContextMenuElement(element)) return null;

    const line = getChatContextLineElement(element);
    const name = normalizeHighlightName(extractChatContextSenderName(line || element, element));
    if (!name || name === "unknown") return null;

    return {
      id: "",
      name,
      path: "chatContext",
      source: "chat",
    };
  }

  function isChatContextMenuElement(element) {
    if (!element || !document.contains(element)) return false;
    if (element.closest("#hordes-kr-mod-status-root, #hordes-kr-chat-translation-toggle")) return false;
    if (element.closest("#chatinput, input, textarea, select, [contenteditable='true']")) return false;
    return Boolean(element.closest("#chat, .chat, [class*='chat'], [id*='chat'], [class*='Chat'], [id*='Chat']"));
  }

  function getChatContextLineElement(element) {
    if (!element || !document.contains(element)) return null;
    if (element.closest) {
      const line = element.closest(".linewrap, [class*='message'], [class*='Message'], [class*='line'], [class*='Line'], [class*='entry'], [class*='Entry']");
      if (line && isChatContextMenuElement(line)) return line;
    }

    let current = element;
    for (let depth = 0; current && current !== document.body && depth < 8; depth++) {
      if (isChatContextMenuElement(current) && normalizeText(current.textContent || "").length >= 2) return current;
      current = current.parentElement;
    }

    return null;
  }

  function extractChatContextSenderName(line, eventElement) {
    const fromEventTarget = extractChatContextNameFromElement(eventElement, { allowGenericText: true });
    if (fromEventTarget) return fromEventTarget;

    const fromStructuredElement = extractChatContextNameFromElement(line, { allowGenericText: false });
    if (fromStructuredElement) return fromStructuredElement;

    return extractChatContextNameFromText(line && line.textContent || "");
  }

  function extractChatContextNameFromElement(element, options = {}) {
    if (!element || !document.contains(element)) return "";

    const structuredSelectors = [
      ".sender",
      "[class*='sender']",
      "[class*='Sender']",
      ".author",
      "[class*='author']",
      "[class*='Author']",
      ".username",
      "[class*='username']",
      "[class*='Username']",
      ".name",
      "[class*='name']",
      "[class*='Name']",
    ];

    for (const selector of structuredSelectors) {
      const nodes = element.matches && element.matches(selector)
        ? [element]
        : Array.from(element.querySelectorAll && element.querySelectorAll(selector) || []);
      for (const node of nodes) {
        const candidate = sanitizeChatContextName(node.textContent || "");
        if (candidate) return candidate;
      }
    }

    for (const attr of ["data-name", "data-username", "data-player", "data-player-name", "title", "aria-label"]) {
      const candidate = sanitizeChatContextName(element.getAttribute && element.getAttribute(attr) || "");
      if (candidate) return candidate;
    }

    if (!options.allowGenericText) return "";

    const candidate = sanitizeChatContextName(element.textContent || "");
    return candidate || "";
  }

  function extractChatContextNameFromText(text) {
    let value = normalizeText(text);
    if (!value) return "";

    value = value.replace(/^\d{1,2}[.:]\d{2}\s*/, "");
    value = value.replace(/^(?:party|clan|faction|pvp|yell|inv|whisper|local|to|from|tell|pm|dm|w)\s+/i, "");
    value = value.replace(/^[^\p{L}\p{N}_-]+/u, "");
    value = value.replace(/^(?:to|from)\s+/i, "");
    value = value.replace(/^\d{1,3}\s+/, "");

    const token = value.match(/^([\p{L}\p{N}_\-]{2,32})/u);
    return sanitizeChatContextName(token && token[1] || "");
  }

  function sanitizeChatContextName(value) {
    const text = normalizeText(value).replace(/^[@#]+/, "").replace(/[,:：]$/, "");
    if (!text || text.length < 2 || text.length > 32) return "";
    // Allow Unicode letters/digits so non-ASCII player names (e.g. Korean) are
    // not silently rejected. Keep the channel-word blocklist below as the guard.
    if (!/^[\p{L}\p{N}_\-]+$/u.test(text)) return "";
    if (/^\d+$/.test(text)) return "";
    if (/^(?:party|clan|faction|pvp|yell|inv|invite|whisper|local|system|to|from|tell|pm|dm|w|hi|gg|raw|mid|deep|left|right|cancel)$/i.test(text)) return "";
    return text;
  }

  function doesElementTextContainName(element, lowerName) {
    if (!element || !lowerName) return false;

    const text = normalizeText(element.innerText || element.textContent || "").toLowerCase();
    if (text && text.includes(lowerName)) return true;

    for (const attr of ["title", "aria-label", "data-tip", "data-tooltip"]) {
      const value = normalizeText(element.getAttribute && element.getAttribute(attr) || "").toLowerCase();
      if (value && value.includes(lowerName)) return true;
    }

    return false;
  }

  function findPlayerContextMenuElements() {
    const candidates = Array.from(document.querySelectorAll([
      "[role='menu']",
      "[class*='context']",
      "[class*='Context']",
      "[class*='menu']",
      "[class*='Menu']",
      "[class*='dropdown']",
      "[class*='Dropdown']",
      "[class*='popover']",
      "[class*='Popover']",
    ].join(",")));

    return candidates.filter(isLikelyPlayerContextMenuElement).slice(-4);
  }

  function isLikelyPlayerContextMenuElement(element) {
    if (!element || !document.contains(element)) return false;
    if (element.closest("#hordes-kr-mod-status-root, #hordes-kr-chat-translation-toggle")) return false;

    const rect = element.getBoundingClientRect();
    if (!rect || rect.width < 40 || rect.height < 20 || rect.width > 360 || rect.height > 520) return false;

    const style = pageWindow.getComputedStyle ? pageWindow.getComputedStyle(element) : null;
    if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return false;

    const text = normalizeText(element.innerText || element.textContent || "").toLowerCase();
    if (!text) return false;
    const hasPlayerAction = /whisper|message|invite|inspect|block|report|귓속말|귓말|초대|차단|신고|살펴보기|정보/.test(text);
    const hasTooMuchUi = /hordes kr mod|채팅번역|프리셋/.test(text);
    return hasPlayerAction && !hasTooMuchUi;
  }

  function createTargetContextMenuHighlightAction(name) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "hordes-kr-context-highlight-add";
    action.textContent = `강조 ID 추가: ${name}`;
    action.title = `${name}을 강조 ID 목록에 추가`;
    action.style.cssText = [
      "width: 100%",
      "box-sizing: border-box",
      "display: block",
      "border: 1px solid rgba(245, 194, 71, 0.45)",
      "border-radius: 4px",
      "background: rgba(84, 72, 30, 0.92)",
      "color: #fff3b0",
      "font: 900 12px/1.2 Arial, Helvetica, sans-serif",
      "letter-spacing: 0",
      "text-align: left",
      "padding: 6px 8px",
      "margin: 3px 0 0",
      "cursor: pointer",
    ].join(";");

    action.addEventListener("pointerdown", stopContextMenuActionEvent, true);
    action.addEventListener("mousedown", stopContextMenuActionEvent, true);
    action.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const result = addHighlightNameDirect(name);
      HIGHLIGHT_STATE.contextMenuLastTargetName = result.name || name;
      HIGHLIGHT_STATE.contextMenuLastError = result.added || result.exists ? "" : result.reason || "";
      renderStatusUi();
    }, true);

    return action;
  }

  function clearFloatingTargetContextMenuHighlightAction() {
    const host = HIGHLIGHT_STATE.contextMenuActionHost;
    if (host) host.remove();
    HIGHLIGHT_STATE.contextMenuActionHost = null;
  }

  function clearTargetContextMenuHighlightActions() {
    clearFloatingTargetContextMenuHighlightAction();
    document.querySelectorAll(".hordes-kr-context-highlight-add").forEach((node) => {
      node.remove();
    });
  }

  function stopContextMenuActionEvent(event) {
    event.stopPropagation();
  }

  function getSelectedTargetForHighlightMenu() {
    const runtime = getExposedRuntime();
    if (!runtime) return null;

    const self = findLocalPlayerEntity(runtime);
    if (!self) return null;

    const selected = findSelectedTargetEntity(runtime, self.entity);
    if (!selected || !selected.entity) {
      return getSelectedTargetForHighlightMenuFromDistance();
    }

    const name = normalizeHighlightName(getRuntimeEntityLabel(selected.entity));
    if (!name || name === "unknown") return null;

    return {
      id: String(getRuntimeEntityId(selected.entity) ?? ""),
      name,
      path: selected.path || selected.source || "",
    };
  }

  function getSelectedTargetForHighlightMenuFromDistance() {
    const result = getTargetDistance(true);
    const target = result && result.target;
    const name = normalizeHighlightName(target && target.name);
    if (!name || name === "unknown") return null;

    return {
      id: String(target.id || ""),
      name,
      path: target.path || target.referenceSource || "targetDistance",
    };
  }

  function addSelectedTargetToHighlightNames() {
    const target = getSelectedTargetForHighlightMenu();
    if (!target || !target.name) {
      return { ok: false, added: false, reason: "현재 선택된 타겟 이름을 찾지 못했습니다." };
    }
    return addHighlightNameDirect(target.name);
  }

  function addHighlightNameDirect(name) {
    const normalized = normalizeHighlightName(name);
    if (!normalized) return { ok: false, added: false, reason: "이름이 비어 있습니다." };

    const exists = HIGHLIGHT_CONFIG.names.some(
      (current) => current.toLowerCase() === normalized.toLowerCase()
    );
    if (!exists) {
      HIGHLIGHT_CONFIG.names.push(normalized);
      saveHighlightConfig();
    }

    refreshNameHighlights();
    updateRuntimeNameOverlay();
    return {
      ok: true,
      added: !exists,
      exists,
      name: normalized,
      names: [...HIGHLIGHT_CONFIG.names],
    };
  }

  function getTargetContextMenuHighlightStatus() {
    return {
      installed: Boolean(HIGHLIGHT_STATE.contextMenuObserver),
      lastInjectedAt: HIGHLIGHT_STATE.contextMenuLastInjectedAt
        ? new Date(HIGHLIGHT_STATE.contextMenuLastInjectedAt).toISOString()
        : null,
      lastTargetName: HIGHLIGHT_STATE.contextMenuLastTargetName,
      lastSource: HIGHLIGHT_STATE.contextMenuLastSource,
      lastError: HIGHLIGHT_STATE.contextMenuLastError,
      floating: Boolean(HIGHLIGHT_STATE.contextMenuActionHost && document.contains(HIGHLIGHT_STATE.contextMenuActionHost)),
      lastPoint: {
        x: HIGHLIGHT_STATE.contextMenuLastX,
        y: HIGHLIGHT_STATE.contextMenuLastY,
      },
      selected: getSelectedTargetForHighlightMenu(),
      chat: getChatContextMenuHighlightTarget(),
    };
  }

  function scheduleNameHighlightRefresh() {
    if (!shouldRunDomNameHighlight()) return;
    if (HIGHLIGHT_STATE.pending) return;
    HIGHLIGHT_STATE.pending = true;

    setTimeout(() => {
      HIGHLIGHT_STATE.pending = false;
      refreshQueuedNameHighlights();
    }, 200);
  }

  function refreshNameHighlights() {
    if (!document.body) return;

    HIGHLIGHT_STATE.queuedHighlightRoots.clear();
    disconnectNameHighlights();
    unwrapNameHighlights(document.body);
    if (shouldRunDomNameHighlight()) {
      highlightNamesInTree(document.body);
      observeNameHighlights();
    }
  }

  function refreshQueuedNameHighlights() {
    if (!document.body) return;

    const roots = Array.from(HIGHLIGHT_STATE.queuedHighlightRoots).slice(0, 50);
    HIGHLIGHT_STATE.queuedHighlightRoots.clear();
    if (!shouldRunDomNameHighlight()) return;
    if (roots.length === 0) return;

    disconnectNameHighlights();
    roots.forEach((root) => {
      if (!root || !document.contains(root) || shouldSkipHighlightNode(root)) return;
      unwrapNameHighlights(root);
      highlightNamesInTree(root);
    });
    observeNameHighlights();
  }

  function observeNameHighlights() {
    if (!HIGHLIGHT_STATE.observer || !document.body) return;
    HIGHLIGHT_STATE.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function disconnectNameHighlights() {
    if (HIGHLIGHT_STATE.observer) HIGHLIGHT_STATE.observer.disconnect();
  }

  function installNameHighlightStyle() {
    if (document.getElementById("hordes-kr-name-highlight-style")) return;

    const style = document.createElement("style");
    style.id = "hordes-kr-name-highlight-style";
    style.textContent = `
      .hordes-kr-name-highlight {
        background: transparent !important;
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        opacity: 1 !important;
        font-weight: 900 !important;
        position: relative !important;
        z-index: 2147483647 !important;
        display: inline !important;
        text-shadow:
          1px 0 0 #10131d,
          -1px 0 0 #10131d,
          0 1px 0 #10131d,
          0 -1px 0 #10131d !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function highlightNamesInTree(root) {
    const matcher = buildHighlightMatcher();
    if (!matcher) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !matcher.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        matcher.lastIndex = 0;
        return shouldSkipHighlightNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }

    nodes.forEach((textNode) => highlightTextNode(textNode, matcher));
  }

  function highlightTextNode(textNode, matcher) {
    const text = textNode.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    matcher.lastIndex = 0;
    while ((match = matcher.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const mark = document.createElement("span");
      mark.className = "hordes-kr-name-highlight";
      mark.dataset.hordesKrHighlight = "true";
      mark.textContent = match[0];
      fragment.append(mark);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function unwrapNameHighlights(root) {
    root.querySelectorAll(".hordes-kr-name-highlight").forEach((element) => {
      const parent = element.parentNode;
      if (!parent) return;

      parent.replaceChild(document.createTextNode(element.textContent), element);
    });
  }

  function shouldSkipHighlightNode(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return true;
    // Skip all mod-owned UI so our own panels don't flood the highlight refresh queue.
    if (element.closest('[id^="hkr-"], [id^="hordes-kr-"]')) return true;
    if (element.closest("#hordes-kr-mod-status-root")) return true;
    if (element.closest("#hordes-kr-runtime-name-overlay")) return true;
    if (element.closest("#hordes-kr-target-distance-overlay")) return true;
    if (element.closest("#hordes-kr-minimap-name-overlay")) return true;
    if (element.closest(".hordes-kr-context-highlight-add")) return true;
    if (element.closest(".hordes-kr-name-highlight")) return true;
    if (element.closest("#chat, #chatinput, .chat, [class*='chat']")) return true;
    return !!element.closest("script, style, textarea, input, canvas, code, pre");
  }

  function buildHighlightMatcher() {
    const { matcherSource } = getHighlightNameCache();
    return matcherSource ? new RegExp(matcherSource, "gi") : null;
  }

  function normalizeHighlightName(name) {
    return String(name || "").trim();
  }

  function getHighlightNameCache() {
    if (HIGHLIGHT_NAME_CACHE.source === HIGHLIGHT_CONFIG.names && HIGHLIGHT_NAME_CACHE.key) {
      return HIGHLIGHT_NAME_CACHE;
    }

    const key = HIGHLIGHT_CONFIG.names.join("\u0001");
    if (HIGHLIGHT_NAME_CACHE.key === key) return HIGHLIGHT_NAME_CACHE;

    const names = HIGHLIGHT_CONFIG.names.slice().sort((a, b) => b.length - a.length);
    HIGHLIGHT_NAME_CACHE.key = key;
    HIGHLIGHT_NAME_CACHE.source = HIGHLIGHT_CONFIG.names;
    HIGHLIGHT_NAME_CACHE.names = names;
    HIGHLIGHT_NAME_CACHE.lowerNames = names.map((name) => name.toLowerCase());
    HIGHLIGHT_NAME_CACHE.matcherSource = names.map(escapeRegExp).join("|");
    HIGHLIGHT_NAME_CACHE.matchCache.clear();
    return HIGHLIGHT_NAME_CACHE;
  }

  function invalidateHighlightNameCache() {
    HIGHLIGHT_NAME_CACHE.key = "";
    HIGHLIGHT_NAME_CACHE.source = null;
    HIGHLIGHT_NAME_CACHE.names = [];
    HIGHLIGHT_NAME_CACHE.lowerNames = [];
    HIGHLIGHT_NAME_CACHE.matcherSource = "";
    HIGHLIGHT_NAME_CACHE.matchCache.clear();
  }

  function saveHighlightConfig() {
    HIGHLIGHT_CONFIG.names = uniqueHighlightNames(HIGHLIGHT_CONFIG.names);
    invalidateHighlightNameCache();
    HIGHLIGHT_STATE.runtimeDeepScanCacheKey = "";
    HIGHLIGHT_STATE.runtimeDeepScanCandidates = [];
    saveJsonConfig(HIGHLIGHT_CONFIG_KEY, HIGHLIGHT_CONFIG);
  }

  function applyDefaultHighlightNames() {
    let alreadyApplied = false;
    try {
      alreadyApplied = localStorage.getItem(HIGHLIGHT_DEFAULTS_VERSION_KEY) === HIGHLIGHT_DEFAULTS_VERSION;
    } catch {
      alreadyApplied = true;
    }

    if (alreadyApplied) {
      HIGHLIGHT_CONFIG.names = uniqueHighlightNames(HIGHLIGHT_CONFIG.names);
      return;
    }

    HIGHLIGHT_CONFIG.names = uniqueHighlightNames([
      ...HIGHLIGHT_CONFIG.names,
      ...DEFAULT_HIGHLIGHT_NAMES,
    ]);
    saveHighlightConfig();

    try {
      localStorage.setItem(HIGHLIGHT_DEFAULTS_VERSION_KEY, HIGHLIGHT_DEFAULTS_VERSION);
    } catch {
      // Storage can be unavailable in strict browser modes.
    }
  }

  function uniqueHighlightNames(names) {
    const seen = new Set();
    const result = [];

    names.map(normalizeHighlightName).filter(Boolean).forEach((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;

      seen.add(key);
      result.push(name);
    });

    return result;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function initCanvasTextHighlighter() {
    const CanvasContext = pageWindow.CanvasRenderingContext2D;
    if (!CanvasContext || !CanvasContext.prototype) return;

    const proto = CanvasContext.prototype;
    if (proto.__hordesKrNameHighlightPatched) {
      HIGHLIGHT_STATE.canvasInstalled = true;
      return;
    }

    const originalFillText = proto.fillText;
    const originalStrokeText = proto.strokeText;
    const originalDrawImage = proto.drawImage;

    if (typeof originalFillText === "function") {
      proto.fillText = function hordesKrFillText(text, x, y, maxWidth) {
        if (HIGHLIGHT_STATE.canvasInternalDraw) {
          return originalFillText.apply(this, arguments);
        }

        rememberCanvasTextSource(this, text);
        recordCanvasNameStyle("fillText", this, text, x, y, maxWidth);
        drawCanvasNameHighlight(this, text, x, y, maxWidth);
        if (shouldHideStandaloneCanvasClanTag(text)) {
          rememberHiddenCanvasClanTag(text);
          return undefined;
        }
        if (shouldReplaceCanvasNameText(text)) {
          HIGHLIGHT_STATE.lastCanvasText = String(text ?? "").slice(0, 80);
          return undefined;
        }
        return originalFillText.apply(this, arguments);
      };
    }

    if (typeof originalStrokeText === "function") {
      proto.strokeText = function hordesKrStrokeText(text, x, y, maxWidth) {
        if (HIGHLIGHT_STATE.canvasInternalDraw) {
          return originalStrokeText.apply(this, arguments);
        }

        rememberCanvasTextSource(this, text);
        recordCanvasNameStyle("strokeText", this, text, x, y, maxWidth);
        drawCanvasNameHighlight(this, text, x, y, maxWidth);
        if (shouldHideStandaloneCanvasClanTag(text)) {
          rememberHiddenCanvasClanTag(text);
          return undefined;
        }
        if (shouldReplaceCanvasNameText(text)) {
          HIGHLIGHT_STATE.lastCanvasText = String(text ?? "").slice(0, 80);
          return undefined;
        }
        return originalStrokeText.apply(this, arguments);
      };
    }

    if (typeof originalDrawImage === "function") {
      proto.drawImage = function hordesKrDrawImage() {
        if (HIGHLIGHT_STATE.canvasInternalDraw) {
          return originalDrawImage.apply(this, arguments);
        }

        const imageText = getCanvasImageText(arguments[0]);
        if (!imageText) {
          return originalDrawImage.apply(this, arguments);
        }

        const dest = getDrawImageDestination(arguments);
        if (shouldHideStandaloneCanvasClanTag(imageText)) {
          rememberHiddenCanvasClanTag(imageText);
          return undefined;
        }

        const highlightedName = getCanvasHighlightedName(imageText);
        if (highlightedName) {
          HIGHLIGHT_STATE.lastCanvasImageText = String(imageText || "").slice(0, 80);
          drawCanvasTargetDistanceOverlay(this, highlightedName, dest, originalFillText, originalStrokeText);
          return undefined;
        }

        const result = originalDrawImage.apply(this, arguments);
        if (isTargetDistanceEnabled()) {
          drawCanvasTargetDistanceOverlay(this, imageText, dest, originalFillText, originalStrokeText);
        }
        return result;
      };
    }

    Object.defineProperty(proto, "__hordesKrNameHighlightPatched", {
      configurable: true,
      value: true,
    });
    HIGHLIGHT_STATE.canvasInstalled = true;
  }

  function rememberCanvasTextSource(ctx, text) {
    const canvas = ctx && ctx.canvas;
    if (!canvas) return;

    const rawText = String(text ?? "").trim();
    if (!rawText || rawText.length > 80) return;

    try {
      canvas.__hordesKrText = rawText;
      canvas.__hordesKrFont = String(ctx.font || "");
      canvas.__hordesKrFillStyle = normalizeCanvasStyle(ctx.fillStyle);
      canvas.__hordesKrTaggedAt = Date.now();
    } catch {
      // Some canvas-like sources can be non-extensible.
    }
  }

  function getCanvasImageText(image) {
    if (!image) return "";

    try {
      return typeof image.__hordesKrText === "string" ? image.__hordesKrText : "";
    } catch {
      return "";
    }
  }

  function getSelfPlayerName() {
    try {
      const runtime = getExposedRuntime();
      const player = runtime && runtime.player;
      const name = player && player.name;
      return typeof name === "string" && name.trim() ? name.trim() : "";
    } catch {
      return "";
    }
  }

  // The name-highlight machinery runs when the main highlight feature is on, OR when
  // the "내 이름만 강조"(self-only) toggle is on and the player's name is known.
  function isNameHighlightActive() {
    if (HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.canvasEnabled !== false) return true;
    return HIGHLIGHT_CONFIG.selfHighlight && Boolean(getSelfPlayerName());
  }

  // Which highlight name a piece of canvas text matches, honoring the toggles:
  // configured names only when the main highlight is on, the player's own name when
  // self-highlight is on.
  function matchedHighlightName(text) {
    const raw = String(text == null ? "" : text);
    if (!raw) return "";
    if (HIGHLIGHT_CONFIG.enabled) {
      const base = getMatchingHighlightName(raw);
      if (base) return base;
    }
    if (HIGHLIGHT_CONFIG.selfHighlight) {
      const self = getSelfPlayerName();
      if (self && raw.toLowerCase().includes(self.toLowerCase())) return self;
    }
    return "";
  }

  function drawCanvasNameHighlight(ctx, text, x, y, maxWidth) {
    if (!isNameHighlightActive()) return;

    const rawText = String(text ?? "");
    if (!matchedHighlightName(rawText)) return;

    const numberX = Number(x);
    const numberY = Number(y);
    if (!Number.isFinite(numberX) || !Number.isFinite(numberY)) return;

    const now = pageWindow.performance && pageWindow.performance.now
      ? pageWindow.performance.now()
      : Date.now();
    const drawKey = [
      rawText,
      Math.round(numberX),
      Math.round(numberY),
      ctx.font,
      ctx.canvas ? `${ctx.canvas.width}x${ctx.canvas.height}` : "",
    ].join("|");
    if (HIGHLIGHT_STATE.lastCanvasDrawKey === drawKey && now - HIGHLIGHT_STATE.lastCanvasDrawAt < 40) {
      return;
    }

    HIGHLIGHT_STATE.lastCanvasDrawKey = drawKey;
    HIGHLIGHT_STATE.lastCanvasDrawAt = now;
    HIGHLIGHT_STATE.canvasHits++;
    HIGHLIGHT_STATE.lastCanvasText = rawText.slice(0, 80);
  }

  function shouldReplaceCanvasNameText(text) {
    if (!isNameHighlightActive()) return false;

    const rawText = String(text ?? "").trim();
    return Boolean(rawText && matchedHighlightName(rawText));
  }

  function shouldHideStandaloneCanvasClanTag(text) {
    if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.canvasEnabled || !HIGHLIGHT_CONFIG.hideClanNames) return false;

    const rawText = String(text ?? "").trim();
    if (!rawText || getMatchingHighlightName(rawText)) return false;
    return /^#[A-Za-z0-9가-힣_-]{1,12}$/.test(rawText);
  }

  function rememberHiddenCanvasClanTag(text) {
    HIGHLIGHT_STATE.canvasClanHiddenHits++;
    HIGHLIGHT_STATE.lastCanvasClanText = String(text || "").slice(0, 80);
  }

  function getCanvasFontSize(font) {
    const match = String(font || "").match(/(\d+(?:\.\d+)?)px/);
    return match ? Math.max(8, Number(match[1])) : 14;
  }

  function getCanvasFontFamily(font) {
    const family = String(font || "")
      .replace(/^.*?(\d+(?:\.\d+)?px(?:\/[^\s]+)?\s*)/, "")
      .trim() || "sans-serif";
    return family;
  }

  function getCanvasHighlightDisplayText(text) {
    const rawText = String(text ?? "").trim();
    const matchedName = getMatchingHighlightName(rawText);
    return normalizeHighlightName(matchedName);
  }

  function getCanvasHighlightedName(imageText) {
    if (!isNameHighlightActive()) return "";
    const matched = matchedHighlightName(String(imageText || "").trim());
    return matched ? normalizeHighlightName(matched) : "";
  }

  function drawCanvasTargetDistanceOverlay(ctx, imageText, dest, originalFillText, originalStrokeText) {
    if (!dest || HIGHLIGHT_STATE.canvasInternalDraw || typeof originalFillText !== "function") return false;
    if (!isTargetDistanceEnabled()) return false;

    const result = getTargetDistance(false);
    if (!isCanvasDrawForSelectedTarget(ctx, imageText, dest, result)) {
      return false;
    }

    const text = `${result.stale ? "~" : ""}${formatTargetDistance(result.distance)}`;
    const drawKey = [
      result.target.name,
      text,
      Math.round(dest.x),
      Math.round(dest.y),
      Math.round(dest.width),
      Math.round(dest.height),
    ].join("|");
    const now = Date.now();
    const shouldCount = TARGET_DISTANCE_STATE.lastCanvasDrawKey !== drawKey || now - TARGET_DISTANCE_STATE.lastCanvasAt >= 80;
    TARGET_DISTANCE_STATE.lastCanvasDrawKey = drawKey;
    TARGET_DISTANCE_STATE.lastCanvasAt = now;
    TARGET_DISTANCE_STATE.lastCanvasText = text;
    if (shouldCount) TARGET_DISTANCE_STATE.canvasHits++;

    try {
      HIGHLIGHT_STATE.canvasInternalDraw = true;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const fontSize = clamp(Math.round(dest.height * 1.06), 15, 24);
      const fontFamily = getCanvasFontFamily(String(ctx.font || "")) || "hordes, Arial, sans-serif";
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
      ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.14));
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const x = Math.round(dest.x + dest.width + 8);
      const y = Math.round(dest.y + dest.height + 1);

      if (typeof originalStrokeText === "function") {
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.2));
        ctx.strokeStyle = "rgba(5, 10, 22, 0.98)";
        originalStrokeText.call(ctx, text, x, y);
      }

      ctx.fillStyle = "#f5c247";
      originalFillText.call(ctx, text, x, y);
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      originalFillText.call(ctx, text, x + 0.35, y - 0.35);
      ctx.restore();
      return true;
    } catch {
      try {
        ctx.restore();
      } catch {
        // Ignore canvas state recovery failures.
      }
      return false;
    } finally {
      HIGHLIGHT_STATE.canvasInternalDraw = false;
    }
  }

  function isCanvasTextForTarget(imageText, targetName) {
    const text = String(imageText || "").trim().toLowerCase();
    const name = String(targetName || "").trim().toLowerCase();
    return Boolean(text && name && (text === name || text.includes(name) || name.includes(text)));
  }

  function isCanvasDrawForSelectedTarget(ctx, imageText, dest, result) {
    if (!result || !result.available || !result.target) return false;
    if (!isCanvasTextForTarget(imageText, result.target.name)) return false;

    const canvasPoint = result.target.canvas || getCanvasPointFromScreen(ctx && ctx.canvas, result.target.screen);
    if (!canvasPoint) return false;

    const centerX = Number(dest.x) + Number(dest.width) / 2;
    const centerY = Number(dest.y) + Number(dest.height) / 2;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return false;

    const toleranceX = Math.max(36, Number(dest.width) * 0.85);
    const toleranceY = Math.max(28, Number(dest.height) * 2.2);
    const dx = Math.abs(centerX - canvasPoint.x);
    const dy = Math.abs(centerY - canvasPoint.y);
    const matched = dx <= toleranceX && dy <= toleranceY;

    TARGET_DISTANCE_STATE.lastCanvasTargetMatch = {
      matched,
      dx: roundCoord(dx),
      dy: roundCoord(dy),
      toleranceX: roundCoord(toleranceX),
      toleranceY: roundCoord(toleranceY),
      dest: {
        x: roundCoord(dest.x),
        y: roundCoord(dest.y),
        width: roundCoord(dest.width),
        height: roundCoord(dest.height),
      },
      target: {
        x: roundCoord(canvasPoint.x),
        y: roundCoord(canvasPoint.y),
        source: canvasPoint.source || "projectedScreen",
      },
    };

    return matched;
  }

  function getCanvasPointFromScreen(canvas, screen) {
    const x = Number(screen && screen.x);
    const y = Number(screen && screen.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!canvas || typeof canvas.getBoundingClientRect !== "function") return { x, y };

    const rect = canvas.getBoundingClientRect();
    const width = Number(canvas.width);
    const height = Number(canvas.height);
    if (!rect || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return { x, y };

    return {
      x: (x - rect.left) * (width / rect.width),
      y: (y - rect.top) * (height / rect.height),
    };
  }

  function getDrawImageDestination(args) {
    if (!args || args.length < 3) return null;

    const image = args[0];
    let x;
    let y;
    let width;
    let height;

    if (args.length >= 9) {
      x = Number(args[5]);
      y = Number(args[6]);
      width = Number(args[7]);
      height = Number(args[8]);
    } else if (args.length >= 5) {
      x = Number(args[1]);
      y = Number(args[2]);
      width = Number(args[3]);
      height = Number(args[4]);
    } else {
      x = Number(args[1]);
      y = Number(args[2]);
      width = Number(image && (image.width || image.videoWidth || image.naturalWidth));
      height = Number(image && (image.height || image.videoHeight || image.naturalHeight));
    }

    if (![x, y, width, height].every(Number.isFinite)) return null;
    if (width <= 0 || height <= 0) return null;

    return { x, y, width, height };
  }

  function captureSelectedNameStyle(name, durationMs) {
    const normalized = normalizeHighlightName(name);
    if (!normalized) throw new Error("captureSelectedNameStyle requires a visible name.");

    const duration = clamp(Number(durationMs) || 4000, 500, 15000);
    const capture = {
      name: normalized,
      startedAt: Date.now(),
      durationMs: duration,
      samples: [],
      token: Math.random().toString(36).slice(2),
    };
    HIGHLIGHT_STATE.styleCapture = capture;
    console.info(`[Hordes KR Mod] Capturing selected name style for "${normalized}" for ${duration}ms.`);

    return new Promise((resolve) => {
      setTimeout(() => {
        if (HIGHLIGHT_STATE.styleCapture !== capture) {
          resolve(getNameplateStyleStatus());
          return;
        }

        resolve(finishSelectedNameStyleCapture(capture));
      }, duration);
    });
  }

  function recordCanvasNameStyle(method, ctx, text, x, y, maxWidth) {
    const capture = HIGHLIGHT_STATE.styleCapture;
    if (!capture) return;

    const rawText = String(text ?? "");
    if (!rawText.toLowerCase().includes(capture.name.toLowerCase())) return;
    if (capture.samples.length >= 300) return;

    const fontSize = getCanvasFontSize(ctx.font);
    let measuredWidth = 0;
    try {
      measuredWidth = ctx.measureText(rawText).width || 0;
    } catch {
      measuredWidth = 0;
    }

    const sample = {
      method,
      text: rawText.slice(0, 80),
      font: String(ctx.font || ""),
      fontSize,
      fillStyle: normalizeCanvasStyle(ctx.fillStyle),
      strokeStyle: normalizeCanvasStyle(ctx.strokeStyle),
      lineWidth: Number(ctx.lineWidth) || 0,
      textAlign: String(ctx.textAlign || ""),
      textBaseline: String(ctx.textBaseline || ""),
      shadowColor: normalizeCanvasStyle(ctx.shadowColor),
      shadowBlur: Number(ctx.shadowBlur) || 0,
      globalAlpha: Number(ctx.globalAlpha) || 1,
      x: roundCoord(Number(x)),
      y: roundCoord(Number(y)),
      maxWidth: Number(maxWidth) || 0,
      measuredWidth: roundCoord(measuredWidth),
      canvas: ctx.canvas ? `${ctx.canvas.width}x${ctx.canvas.height}` : "",
      score: 0,
      capturedAt: Date.now(),
    };
    sample.score = scoreCanvasNameStyle(sample);
    capture.samples.push(sample);
  }

  function finishSelectedNameStyleCapture(capture) {
    const samples = capture.samples.slice().sort((a, b) => b.score - a.score);
    const best = samples[0] || null;
    HIGHLIGHT_STATE.styleCapture = null;

    if (best) {
      HIGHLIGHT_CONFIG.nameplateStyle = {
        font: best.font,
        fontSize: best.fontSize,
        fillStyle: best.fillStyle || "#ffffff",
        strokeStyle: best.strokeStyle || "rgba(6, 12, 24, 1)",
        lineWidth: best.lineWidth,
        shadowColor: best.shadowColor,
        shadowBlur: best.shadowBlur,
        maxWidth: best.maxWidth,
        measuredWidth: best.measuredWidth,
        textAlign: best.textAlign,
        textBaseline: best.textBaseline,
        globalAlpha: best.globalAlpha,
        sourceName: capture.name,
        capturedAt: new Date().toISOString(),
      };
      saveHighlightConfig();
    }

    const report = {
      name: capture.name,
      sampleCount: capture.samples.length,
      saved: HIGHLIGHT_CONFIG.nameplateStyle,
      best,
      topSamples: samples.slice(0, 8),
    };
    console.info("[Hordes KR Mod] Selected name style capture result", report);
    if (report.topSamples.length > 0) console.table(report.topSamples);
    return report;
  }

  function getNameplateStyleStatus() {
    const capture = HIGHLIGHT_STATE.styleCapture;
    return {
      saved: HIGHLIGHT_CONFIG.nameplateStyle || null,
      capture: capture
        ? {
            name: capture.name,
            durationMs: capture.durationMs,
            elapsedMs: Date.now() - capture.startedAt,
            sampleCount: capture.samples.length,
          }
        : null,
    };
  }

  function scoreCanvasNameStyle(sample) {
    const fontWeightScore = /(bold|[7-9]00)/i.test(sample.font) ? 12 : 0;
    const methodScore = sample.method === "strokeText" ? 8 : 0;
    const lineScore = Math.min(40, sample.lineWidth * 9);
    const shadowScore = Math.min(20, sample.shadowBlur * 2);
    return sample.fontSize * 3 + fontWeightScore + methodScore + lineScore + shadowScore;
  }

  function normalizeCanvasStyle(style) {
    if (typeof style === "string") return style;
    return "";
  }

  function getMatchingHighlightName(text) {
    // Exact (equality) match, not substring — a 강조ID highlights only its exact name,
    // so "bga" no longer lights up "bgaXYZ". Trim so canvas/DOM whitespace doesn't break it.
    const haystack = String(text || "").trim().toLowerCase();
    if (!haystack) return "";

    const { names, lowerNames, matchCache } = getHighlightNameCache();
    if (matchCache.has(haystack)) {
      return matchCache.get(haystack);
    }

    let matchedName = "";
    for (let index = 0; index < lowerNames.length; index++) {
      if (haystack === lowerNames[index]) {
        matchedName = names[index];
        break;
      }
    }

    matchCache.set(haystack, matchedName);
    if (matchCache.size > HIGHLIGHT_MATCH_CACHE_MAX) {
      matchCache.delete(matchCache.keys().next().value);
    }
    return matchedName;
  }

  function getFeatureStatus() {
    return {
      translation: isEnabled(),
      highlight: {
        enabled: HIGHLIGHT_CONFIG.enabled,
        names: [...HIGHLIGHT_CONFIG.names],
      },
      minimap: HIGHLIGHT_CONFIG.minimapLabelsEnabled,
      highlightList: HIGHLIGHT_CONFIG.minimapListEnabled,
      incomingSkill: isIncomingSkillOverlayEnabled(),
      incomingTargetWatch: isIncomingTargetWatchEnabled(),
      incomingWarningList: isIncomingSkillListEnabled(),
      targetDistance: isTargetDistanceEnabled(),
      chatTranslation: getChatTranslationStatus(),
      swiftshotTurbo: getSwiftshotTurboStatus(),
      partyUi: getPartyUiStatus(),
      advanced: {
        domTranslation: isDomTranslationEnabled(),
        domHighlight: HIGHLIGHT_CONFIG.domEnabled,
        canvasHighlight: HIGHLIGHT_CONFIG.canvasEnabled,
        runtimeOverlay: HIGHLIGHT_CONFIG.runtimeOverlayEnabled,
        hideClanNames: HIGHLIGHT_CONFIG.hideClanNames,
      },
      runtimeHook: getScriptHookStatus(),
    };
  }

  function getHighlightStatus() {
    return {
      enabled: HIGHLIGHT_CONFIG.enabled,
      domEnabled: HIGHLIGHT_CONFIG.domEnabled,
      canvasEnabled: HIGHLIGHT_CONFIG.canvasEnabled,
      runtimeOverlayEnabled: HIGHLIGHT_CONFIG.runtimeOverlayEnabled,
      minimapLabelsEnabled: HIGHLIGHT_CONFIG.minimapLabelsEnabled,
      minimapListEnabled: HIGHLIGHT_CONFIG.minimapListEnabled,
      targetDistanceEnabled: FEATURE_CONFIG.targetDistanceEnabled,
      incomingSkillOverlayEnabled: FEATURE_CONFIG.incomingSkillOverlayEnabled,
      incomingTargetWatchEnabled: FEATURE_CONFIG.incomingTargetWatchEnabled,
      incomingSkillListEnabled: false,
      domTranslationEnabled: FEATURE_CONFIG.domTranslationEnabled,
      hideClanNames: HIGHLIGHT_CONFIG.hideClanNames,
      names: [...HIGHLIGHT_CONFIG.names],
      domHighlights: countDomHighlightElements(),
      canvasInstalled: HIGHLIGHT_STATE.canvasInstalled,
      canvasHits: HIGHLIGHT_STATE.canvasHits,
      canvasImageHits: HIGHLIGHT_STATE.canvasImageHits,
      canvasClanHiddenHits: HIGHLIGHT_STATE.canvasClanHiddenHits,
      lastCanvasText: HIGHLIGHT_STATE.lastCanvasText,
      lastCanvasImageText: HIGHLIGHT_STATE.lastCanvasImageText,
      lastCanvasClanText: HIGHLIGHT_STATE.lastCanvasClanText,
      nameplateStyle: getNameplateStyleStatus(),
      scriptHook: getScriptHookStatus(),
      runtimeOverlay: getRuntimeOverlayStatus(),
      minimapOverlay: getMinimapOverlayStatus(),
      minimapHighlightList: getMinimapHighlightListStatus(),
    };
  }

  function initGameScriptRuntimeHook() {
    if (HIGHLIGHT_STATE.scriptHookInstalled) return;
    HIGHLIGHT_STATE.scriptHookInstalled = true;

    installClientOnloadGuard();
    installClientScriptGate();
    installSynchronousClientScriptInterceptor();
    patchCanvasContextCapture();

    const scan = () => scanGameClientScripts();
    const root = document.documentElement || document;

    try {
      HIGHLIGHT_STATE.scriptObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;

            if (node.tagName === "SCRIPT") {
              interceptGameClientScript(node);
            } else if (typeof node.querySelectorAll === "function") {
              node.querySelectorAll("script[src]").forEach(interceptGameClientScript);
            }
          }
        }
      });
      HIGHLIGHT_STATE.scriptObserver.observe(root, { childList: true, subtree: true });
    } catch (error) {
      recordScriptHookError(error, "observer");
    }

    document.addEventListener(
      "beforescriptexecute",
      (event) => {
        const script = event.target;
        if (!script || !script.getAttribute || script.dataset.hordesKrRuntimeHooked) return;

        const url = toUrl(script.getAttribute("src"));
        if (!url || !shouldPatchGameClientScript(url)) return;

        event.preventDefault();
        event.stopPropagation();
        interceptGameClientScript(script);
      },
      true
    );

    scan();
  }

  function installClientOnloadGuard() {
    if (!shouldPatchCurrentPageClientScript()) return;
    if (pageWindow.__hordesKrClientOnloadGuardInstalled) return;

    try {
      let descriptorOwner = pageWindow;
      let descriptor = null;
      while (descriptorOwner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(descriptorOwner, "onload");
        descriptorOwner = Object.getPrototypeOf(descriptorOwner);
      }
      if (!descriptor || typeof descriptor.get !== "function" || typeof descriptor.set !== "function") return;

      const state = {
        patchedOnload: null,
        lastOriginalOnload: null,
        assignments: [],
      };

      Object.defineProperty(pageWindow, "__hordesKrClientOnloadGuardState", {
        configurable: true,
        value: state,
      });

      Object.defineProperty(pageWindow, "onload", {
        configurable: true,
        enumerable: true,
        get() {
          return descriptor.get.call(pageWindow);
        },
        set(value) {
          const text = typeof value === "function" ? String(value) : "";
          const isGameOnload = text.includes("N3(new Fh({}))") || text.includes("N3(new Fh({}));");
          const isPatchedOnload = text.includes("clientOnload") || text.includes("__HORDES_KR_RUNTIME__");
          let nextValue = value;

          if (isGameOnload) {
            if (isPatchedOnload) {
              state.patchedOnload = value;
            } else {
              state.lastOriginalOnload = value;
              if (state.patchedOnload) nextValue = state.patchedOnload;
            }

            rememberOnloadGuardAssignment(state, {
              at: Date.now(),
              patched: isPatchedOnload,
              replaced: nextValue !== value,
            });
          }

          descriptor.set.call(pageWindow, nextValue);
        },
      });

      Object.defineProperty(pageWindow, "__hordesKrClientOnloadGuardInstalled", {
        configurable: true,
        value: true,
      });
    } catch (error) {
      recordScriptHookError(error, "onload-guard");
    }
  }

  function rememberOnloadGuardAssignment(state, assignment) {
    state.assignments.push(assignment);
    while (state.assignments.length > 12) state.assignments.shift();
  }

  function installClientScriptGate() {
    if (!shouldInstallClientScriptGate()) return;

    const install = () => {
      try {
        if (document.getElementById("hordes-kr-script-gate")) {
          HIGHLIGHT_STATE.scriptGateInstalled = true;
          HIGHLIGHT_STATE.scriptGateError = "";
          return;
        }

        const root = document.documentElement;
        if (!root) {
          setTimeout(install, 0);
          return;
        }

        let head = document.head;
        if (!head) {
          head = document.createElement("head");
          root.insertBefore(head, root.firstChild);
        }

        const meta = document.createElement("meta");
        meta.id = "hordes-kr-script-gate";
        meta.httpEquiv = "Content-Security-Policy";
        meta.content = [
          "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
          "worker-src 'self' blob:",
          "child-src 'self' blob:",
        ].join("; ");
        head.insertBefore(meta, head.firstChild);
        HIGHLIGHT_STATE.scriptGateInstalled = true;
        HIGHLIGHT_STATE.scriptGateError = "";
      } catch (error) {
        HIGHLIGHT_STATE.scriptGateError = error && error.message ? error.message : String(error);
      }
    };

    install();
  }

  function shouldInstallClientScriptGate() {
    if (!shouldPatchCurrentPageClientScript()) return false;

    try {
      return (
        localStorage.getItem(SCRIPT_GATE_DISABLED_KEY) !== "true" &&
        localStorage.getItem(SCRIPT_GATE_ENABLED_KEY) === "force"
      );
    } catch {
      return false;
    }
  }

  function shouldPatchCurrentPageClientScript() {
    return /^\/play(?:\/|$)/.test(location.pathname);
  }

  function installSynchronousClientScriptInterceptor() {
    const NodeProto = pageWindow.Node && pageWindow.Node.prototype;
    if (!NodeProto || NodeProto.__hordesKrScriptInsertPatched) return;

    const originalAppendChild = NodeProto.appendChild;
    const originalInsertBefore = NodeProto.insertBefore;
    const originalReplaceChild = NodeProto.replaceChild;

    if (typeof originalAppendChild === "function") {
      NodeProto.appendChild = function hordesKrAppendChild(node) {
        if (interceptGameClientScriptBeforeInsert(this, node, null)) return node;
        return originalAppendChild.apply(this, arguments);
      };
    }

    if (typeof originalInsertBefore === "function") {
      NodeProto.insertBefore = function hordesKrInsertBefore(node, child) {
        if (interceptGameClientScriptBeforeInsert(this, node, child)) return node;
        return originalInsertBefore.apply(this, arguments);
      };
    }

    if (typeof originalReplaceChild === "function") {
      NodeProto.replaceChild = function hordesKrReplaceChild(node, child) {
        if (interceptGameClientScriptBeforeInsert(this, node, child)) {
          if (child && child.parentNode === this) child.remove();
          return child;
        }
        return originalReplaceChild.apply(this, arguments);
      };
    }

    Object.defineProperty(NodeProto, "__hordesKrScriptInsertPatched", {
      configurable: true,
      value: true,
    });
  }

  function interceptGameClientScriptBeforeInsert(parent, node, nextSibling) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SCRIPT") return false;
    if (!node.getAttribute || node.dataset.hordesKrRuntimeHooked) return false;

    const url = toUrl(node.getAttribute("src"));
    if (!url || !shouldPatchGameClientScript(url)) return false;

    node.dataset.hordesKrRuntimeHooked = "sync-blocked";
    rememberScriptHookValue("scriptHookAttemptedScripts", shortScriptUrl(url));
    loadAndPatchGameClientScript(parent, nextSibling, url, node.getAttribute("type") || "");
    return true;
  }

  function patchCanvasContextCapture() {
    const CanvasElement = pageWindow.HTMLCanvasElement;
    if (!CanvasElement || !CanvasElement.prototype || CanvasElement.prototype.__hordesKrContextCapturePatched) return;

    const originalGetContext = CanvasElement.prototype.getContext;
    if (typeof originalGetContext !== "function") return;

    CanvasElement.prototype.getContext = function hordesKrGetContext(type) {
      const context = originalGetContext.apply(this, arguments);
      const contextType = String(type || "").toLowerCase();

      if (context && (contextType === "webgl2" || contextType === "webgl" || contextType === "experimental-webgl")) {
        exposeRuntimePart({
          webglCanvas: this,
          updatedAt: Date.now(),
        });
      } else if (context && contextType === "2d") {
        exposeRuntimePart({
          overlayCanvas: this,
          updatedAt: Date.now(),
        });
      }

      return context;
    };

    Object.defineProperty(CanvasElement.prototype, "__hordesKrContextCapturePatched", {
      configurable: true,
      value: true,
    });
  }

  function scanGameClientScripts() {
    try {
      document.querySelectorAll("script[src]").forEach(interceptGameClientScript);
    } catch (error) {
      recordScriptHookError(error, "scan");
    }
  }

  function interceptGameClientScript(script) {
    if (!script || !script.getAttribute || script.dataset.hordesKrRuntimeHooked) return;

    const rawSrc = script.getAttribute("src");
    const url = toUrl(rawSrc);
    if (!url || !shouldPatchGameClientScript(url)) return;

    script.dataset.hordesKrRuntimeHooked = "checking";
    rememberScriptHookValue("scriptHookAttemptedScripts", shortScriptUrl(url));

    const parent = script.parentNode;
    const nextSibling = script.nextSibling;
    const originalType = script.getAttribute("type") || "";

    try {
      script.type = "javascript/hordes-kr-blocked";
      if (parent) parent.removeChild(script);
    } catch (error) {
      recordScriptHookError(error, shortScriptUrl(url));
      return;
    }

    loadAndPatchGameClientScript(parent, nextSibling, url, originalType);
  }

  function shouldPatchGameClientScript(url) {
    if (url.origin !== location.origin) return false;
    if (!/\.js$/i.test(url.pathname)) return false;

    const path = url.pathname.toLowerCase();
    if (path.includes("/data/") || path.includes("/loc/")) return false;
    if (path.includes("/menu/")) return false;

    return (
      path.endsWith("/client.js") ||
      path.includes("/play/") ||
      path.includes("/game/") ||
      path.includes("/client/") ||
      path.includes("/assets/")
    );
  }

  function loadAndPatchGameClientScript(parent, nextSibling, url, originalType) {
    try {
      const source = loadScriptSourceSync(url);
      const patched = patchGameClientSource(source, url);
      insertScriptSource(parent, nextSibling, patched.source, url, patched.patches, originalType);
      recordPatchedScript(url, patched.patches, "sync-xhr");
      return;
    } catch (error) {
      recordScriptHookError(error, `${shortScriptUrl(url)} sync`);
    }

    loadAndPatchGameClientScriptAsync(parent, nextSibling, url, originalType);
  }

  function loadScriptSourceSync(url) {
    const xhr = new pageWindow.XMLHttpRequest();
    xhr.open("GET", url.toString(), false);
    xhr.send(null);

    if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
      return xhr.responseText;
    }

    throw new Error(`sync script request failed: ${xhr.status}`);
  }

  async function loadAndPatchGameClientScriptAsync(parent, nextSibling, url, originalType) {
    try {
      const response = await originalFetch(url.toString(), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`script request failed: ${response.status}`);

      const source = await response.text();
      const patched = patchGameClientSource(source, url);
      insertScriptSource(parent, nextSibling, patched.source, url, patched.patches, originalType);
      recordPatchedScript(url, patched.patches, "async-fetch");
    } catch (error) {
      recordScriptHookError(error, shortScriptUrl(url));
      insertFallbackScript(parent, nextSibling, url, originalType);
    }
  }

  function recordPatchedScript(url, patches, loader) {
    if (patches.length === 0) return;

    rememberScriptHookValue("scriptHookPatchedScripts", {
      src: shortScriptUrl(url),
      patches,
      loader,
    });
  }

  function insertScriptSource(parent, nextSibling, source, url, patches, originalType) {
    const targetParent = parent || document.head || document.documentElement;
    if (!targetParent) return;

    const replacement = document.createElement("script");
    replacement.dataset.hordesKrRuntimeHooked = "inlined";
    replacement.dataset.hordesKrRuntimeSource = shortScriptUrl(url);
    if (patches.length > 0) replacement.dataset.hordesKrRuntimePatches = patches.join(",");
    if (originalType && !/^(text|application)\/javascript$/i.test(originalType)) replacement.type = originalType;
    replacement.textContent = `${source}\n//# sourceURL=${url.toString()}#hordes-kr-runtime`;

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
    fallback.dataset.hordesKrRuntimeHooked = "fallback";
    fallback.src = url.toString();
    if (originalType) fallback.type = originalType;

    if (nextSibling && nextSibling.parentNode === targetParent) {
      targetParent.insertBefore(fallback, nextSibling);
    } else {
      targetParent.appendChild(fallback);
    }
  }

  function patchGameClientSource(source, url) {
    let patched = String(source || "");
    const patches = [];
    const exposeLegacyRuntime = [
      "try{",
      "var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "var g=null,p=null;",
      "try{g=ne}catch(i){r.debug=r.debug||{};r.debug.legacyEngineReadError=(i&&i.message)||String(i)}",
      "try{p=g&&g.player}catch(i){r.debug=r.debug||{};r.debug.legacyPlayerReadError=(i&&i.message)||String(i)}",
      "r.engine=g;r.player=p;",
      "try{r.target=p&&p.target}catch(i){r.debug=r.debug||{};r.debug.legacyTargetReadError=(i&&i.message)||String(i)}",
      "r.camera=he;r.webglCanvas=ko;r.overlayCanvas=yn;r.renderState=N;r.settings=Te;r.frameTime=e;r.updatedAt=Date.now();",
      "r.hookHits=r.hookHits||{};r.hookHits.frameLoop=(r.hookHits.frameLoop||0)+1;",
      "r.debug=r.debug||{};r.debug.legacyFrameLoopAt=r.updatedAt;",
      "try{r.debug.legacyEngineKeys=g?Object.getOwnPropertyNames(g).slice(0,40):[]}catch(i){r.debug.legacyEngineKeysError=(i&&i.message)||String(i)}",
      "}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"frameLoop:\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    const exposeLegacyRuntimeCall = `(function(){${exposeLegacyRuntime}})()`;
    const exposeClientRuntime = [
      "try{",
      "var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "var g=null,p=null;",
      "r.updatedAt=Date.now();r.frameLoopSeenAt=r.updatedAt;",
      "r.hookHits=r.hookHits||{};r.hookHits.clientFrameLoop=(r.hookHits.clientFrameLoop||0)+1;",
      "r.debug=r.debug||{};r.debug.frameLoopAt=r.updatedAt;",
      "try{g=I}catch(i){r.debug.engineReadError=(i&&i.message)||String(i)}",
      "r.engine=g;",
      "try{r.debug.frameLoopIType=typeof I}catch(i){}",
      "try{r.debug.frameLoopIConstructor=g&&g.constructor&&g.constructor.name||\"\"}catch(i){}",
      "try{r.debug.frameLoopIKeys=g?Object.getOwnPropertyNames(g).slice(0,40):[]}catch(i){r.debug.frameLoopIKeysError=(i&&i.message)||String(i)}",
      "try{p=g&&g.player}catch(i){r.debug.playerReadError=(i&&i.message)||String(i)}",
      "r.player=p;",
      "try{r.target=p&&p.target}catch(i){r.debug.targetReadError=(i&&i.message)||String(i)}",
      "try{r.camera=gt}catch(i){r.debug.cameraReadError=(i&&i.message)||String(i)}",
      "try{r.cameraTransform=Qt}catch(i){r.debug.cameraTransformReadError=(i&&i.message)||String(i)}",
      "try{r.webglCanvas=To}catch(i){r.debug.webglCanvasReadError=(i&&i.message)||String(i)}",
      "try{r.overlayCanvas=Ln}catch(i){r.debug.overlayCanvasReadError=(i&&i.message)||String(i)}",
      "try{r.renderState=tt}catch(i){r.debug.renderStateReadError=(i&&i.message)||String(i)}",
      "try{r.settings=fe}catch(i){r.debug.settingsReadError=(i&&i.message)||String(i)}",
      "try{r.minimap={canvas:xo,scale:xr,enlarged:Yd,width:Tl,height:El,offsetX:Xd,offsetY:Qd}}catch(i){r.debug.minimapReadError=(i&&i.message)||String(i)}",
      "r.delta=t;r.frameTime=e;",
      "}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientFrameLoop:\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    const exposeClientRuntimeCall = `(function(){${exposeClientRuntime}})()`;
    const installClientRuntimeProbe = [
      "try{",
      "var __hkrRuntimeProbe=function(){",
      "try{",
      "var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "var g=null,p=null;",
      "r.updatedAt=Date.now();",
      "r.hookHits=r.hookHits||{};",
      "r.hookHits.runtimeProbe=(r.hookHits.runtimeProbe||0)+1;",
      "r.debug=r.debug||{};",
      "r.debug.runtimeProbeAt=r.updatedAt;",
      "try{g=I}catch(i){r.debug.runtimeProbeEngineReadError=(i&&i.message)||String(i)}",
      "r.engine=g;",
      "try{r.debug.runtimeProbeIType=typeof I}catch(i){}",
      "try{r.debug.runtimeProbeIConstructor=g&&g.constructor&&g.constructor.name||\"\"}catch(i){}",
      "try{r.debug.runtimeProbeIKeys=g?Object.getOwnPropertyNames(g).slice(0,80):[]}catch(i){r.debug.runtimeProbeIKeysError=(i&&i.message)||String(i)}",
      "try{p=g&&g.player}catch(i){r.debug.runtimeProbePlayerReadError=(i&&i.message)||String(i)}",
      "r.player=p;",
      "try{r.target=p&&p.target}catch(i){r.debug.runtimeProbeTargetReadError=(i&&i.message)||String(i)}",
      "try{r.camera=gt}catch(i){r.debug.runtimeProbeCameraReadError=(i&&i.message)||String(i)}",
      "try{r.cameraTransform=Qt}catch(i){r.debug.runtimeProbeCameraTransformReadError=(i&&i.message)||String(i)}",
      "try{r.webglCanvas=To}catch(i){r.debug.runtimeProbeWebglCanvasReadError=(i&&i.message)||String(i)}",
      "try{r.overlayCanvas=Ln}catch(i){r.debug.runtimeProbeOverlayCanvasReadError=(i&&i.message)||String(i)}",
      "try{r.renderState=tt}catch(i){r.debug.runtimeProbeRenderStateReadError=(i&&i.message)||String(i)}",
      "try{r.settings=fe}catch(i){r.debug.runtimeProbeSettingsReadError=(i&&i.message)||String(i)}",
      "try{r.minimap={canvas:xo,scale:xr,enlarged:Yd,width:Tl,height:El,offsetX:Xd,offsetY:Qd}}catch(i){r.debug.runtimeProbeMinimapReadError=(i&&i.message)||String(i)}",
      "}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"runtimeProbe:\"+((o&&o.message)||o))}catch(i){}}",
      "};",
      "window.__HORDES_KR_RUNTIME_PROBE_NOW__=__hkrRuntimeProbe;",
      "setInterval(__hkrRuntimeProbe,250);",
      "}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"runtimeProbeInstall:\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    const exposeClientEngineThis = (hitName) => [
      "try{",
      "let r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "let p=null;",
      "r.engine=this;",
      "try{p=this&&this.player}catch(i){r.debug=r.debug||{};r.debug.engineMethodPlayerReadError=(i&&i.message)||String(i)}",
      "r.player=p;",
      "try{r.target=p&&p.target}catch(i){r.debug=r.debug||{};r.debug.engineMethodTargetReadError=(i&&i.message)||String(i)}",
      "try{r.camera=gt}catch(i){}",
      "try{r.cameraTransform=Qt}catch(i){}",
      "try{r.webglCanvas=To}catch(i){}",
      "try{r.overlayCanvas=Ln}catch(i){}",
      "try{r.renderState=tt}catch(i){}",
      "try{r.settings=fe}catch(i){}",
      "try{r.minimap={canvas:xo,scale:xr,enlarged:Yd,width:Tl,height:El,offsetX:Xd,offsetY:Qd}}catch(i){}",
      "r.updatedAt=Date.now();",
      "r.hookHits=r.hookHits||{};",
      `r.hookHits.${hitName}=(r.hookHits.${hitName}||0)+1;`,
      "r.debug=r.debug||{};",
      `r.debug.${hitName}At=r.updatedAt;`,
      "try{r.debug.engineThisKeys=this?Object.getOwnPropertyNames(this).slice(0,60):[]}catch(i){}",
      "}catch(o){try{let r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"",
      hitName,
      ":\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    const installClientPrototypeRuntime = [
      "try{",
      "let __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "__hkrRuntime.debug=__hkrRuntime.debug||{};",
      "__hkrRuntime.debug.prototypePatchAt=Date.now();",
      "__hkrRuntime.debug.prototypePatchFhType=typeof Fh;",
      "__hkrRuntime.debug.prototypePatchFhKeys=Fh&&Fh.prototype?Object.getOwnPropertyNames(Fh.prototype).slice(0,80):[];",
      "let __hkrExpose=function(__hkrEngine,__hkrHit){",
      "try{",
      "let __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "let __hkrPlayer=null;",
      "__hkrRuntime.engine=__hkrEngine;",
      "try{__hkrPlayer=__hkrEngine&&__hkrEngine.player}catch(i){__hkrRuntime.debug=__hkrRuntime.debug||{};__hkrRuntime.debug.prototypePlayerReadError=(i&&i.message)||String(i)}",
      "__hkrRuntime.player=__hkrPlayer;",
      "try{__hkrRuntime.target=__hkrPlayer&&__hkrPlayer.target}catch(i){__hkrRuntime.debug=__hkrRuntime.debug||{};__hkrRuntime.debug.prototypeTargetReadError=(i&&i.message)||String(i)}",
      "try{__hkrRuntime.camera=gt}catch(i){}",
      "try{__hkrRuntime.cameraTransform=Qt}catch(i){}",
      "try{__hkrRuntime.webglCanvas=To}catch(i){}",
      "try{__hkrRuntime.overlayCanvas=Ln}catch(i){}",
      "try{__hkrRuntime.renderState=tt}catch(i){}",
      "try{__hkrRuntime.settings=fe}catch(i){}",
      "try{__hkrRuntime.minimap={canvas:xo,scale:xr,enlarged:Yd,width:Tl,height:El,offsetX:Xd,offsetY:Qd}}catch(i){}",
      "__hkrRuntime.updatedAt=Date.now();",
      "__hkrRuntime.hookHits=__hkrRuntime.hookHits||{};",
      "__hkrRuntime.hookHits[__hkrHit]=(__hkrRuntime.hookHits[__hkrHit]||0)+1;",
      "__hkrRuntime.debug=__hkrRuntime.debug||{};",
      "__hkrRuntime.debug[__hkrHit+\"At\"]=__hkrRuntime.updatedAt;",
      "try{__hkrRuntime.debug.prototypeEngineKeys=__hkrEngine?Object.getOwnPropertyNames(__hkrEngine).slice(0,80):[]}catch(i){}",
      "}catch(o){try{let __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};__hkrRuntime.hookErrors=__hkrRuntime.hookErrors||[];__hkrRuntime.hookErrors.push(\"prototypeExpose:\"+__hkrHit+\":\"+((o&&o.message)||o))}catch(i){}}",
      "};",
      "let __hkrWrap=function(__hkrName,__hkrHit){",
      "try{",
      "let __hkrProto=Fh&&Fh.prototype;",
      "let __hkrOriginal=__hkrProto&&__hkrProto[__hkrName];",
      "if(typeof __hkrOriginal!==\"function\")return;",
      "if(__hkrOriginal.__hordesKrRuntimeWrapped)return;",
      "let __hkrWrapped=function(){",
      "__hkrExpose(this,__hkrHit);",
      "let __hkrResult=__hkrOriginal.apply(this,arguments);",
      "__hkrExpose(this,__hkrHit+\"After\");",
      "return __hkrResult;",
      "};",
      "try{Object.defineProperty(__hkrWrapped,\"__hordesKrRuntimeWrapped\",{value:true})}catch(i){}",
      "__hkrProto[__hkrName]=__hkrWrapped;",
      "__hkrRuntime.debug[__hkrHit+\"Wrapped\"]=true;",
      "}catch(o){try{let __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};__hkrRuntime.hookErrors=__hkrRuntime.hookErrors||[];__hkrRuntime.hookErrors.push(\"prototypeWrap:\"+__hkrName+\":\"+((o&&o.message)||o))}catch(i){}}",
      "};",
      "__hkrWrap(\"setState\",\"prototypeSetState\");",
      "__hkrWrap(\"setPlayer\",\"prototypeSetPlayer\");",
      "__hkrWrap(\"tick\",\"prototypeTick\");",
      "__hkrWrap(\"manageChunks\",\"prototypeManageChunks\");",
      "}catch(o){try{let __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};__hkrRuntime.hookErrors=__hkrRuntime.hookErrors||[];__hkrRuntime.hookErrors.push(\"prototypeRuntime:\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    const exposeClientTargetController = [
      "hu=(t,e=!0)=>{_n=t,Td=e&&_n>0,Mm.set(Td?\"pointer\":\"auto\"),Pm.set(_n)},",
      "__hkrExposeTargetController=(()=>{try{",
      "let r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "r.setHoverTarget=hu;",
      "r.changeTarget=vr;",
      "r.getClientTargetState=()=>({hover:_n,target:zn,lastCandidate:lc,hoverActive:Td});",
      "r.debug=r.debug||{};",
      "r.debug.targetControllerAt=Date.now();",
      "r.hookHits=r.hookHits||{};",
      "r.hookHits.targetControllerExpose=(r.hookHits.targetControllerExpose||0)+1;",
      "}catch(i){}return 0})(),sD=",
    ].join("");
    const exposeClientSkillRuntime = [
      "try{",
      "var __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};",
      "__hkrRuntime.skillStores={active:typeof Hs!==\"undefined\"?Hs:null,learned:typeof Jc!==\"undefined\"?Jc:null,configs:typeof Ea!==\"undefined\"?Ea:null};",
      "__hkrRuntime.skillDefinitions=typeof zt!==\"undefined\"?zt:null;",
      "__hkrRuntime.sendClientCommand=yt;",
      "__hkrRuntime.getActiveWorld=function(){var __hkrValue=\"\";try{var __hkrUnsub=Gr&&Gr.subscribe&&Gr.subscribe(function(__hkrWorld){__hkrValue=__hkrWorld});if(typeof __hkrUnsub===\"function\")__hkrUnsub()}catch(__hkrError){}return __hkrValue||\"\"};",
      "__hkrRuntime.listEntities=function(){var __hkrOut=[];try{var __hkrEngine=typeof I!==\"undefined\"?I:null;var __hkrArr=__hkrEngine&&__hkrEngine.entities&&__hkrEngine.entities.array||[];for(var __hkrIndex=0;__hkrIndex<__hkrArr.length;__hkrIndex+=1){var __hkrEntity=__hkrArr[__hkrIndex];if(!__hkrEntity)continue;var __hkrPos=__hkrEntity.pos||__hkrEntity.visualPosition||[];__hkrOut.push({id:__hkrEntity.id,name:__hkrEntity.name||\"\",type:__hkrEntity.type,faction:__hkrEntity.faction,party:__hkrEntity.party,pos:[Number(__hkrPos[0])||0,Number(__hkrPos[1])||0,Number(__hkrPos[2])||0]})}}catch(__hkrError){try{__hkrRuntime.hookErrors=__hkrRuntime.hookErrors||[];__hkrRuntime.hookErrors.push(\"listEntities:\"+((__hkrError&&__hkrError.message)||__hkrError))}catch(__hkrNestedError){}}return __hkrOut};",
      "__hkrRuntime.getPlayerInfo=function(){try{var __hkrPlayer=typeof I!==\"undefined\"&&I&&I.player;var __hkrPos=__hkrPlayer&&(__hkrPlayer.pos||__hkrPlayer.visualPosition)||[];return __hkrPlayer?{id:__hkrPlayer.id,name:__hkrPlayer.name||\"\",type:__hkrPlayer.type,pos:[Number(__hkrPos[0])||0,Number(__hkrPos[1])||0,Number(__hkrPos[2])||0],target:__hkrPlayer.target}:null}catch(__hkrError){return null}};",
      "__hkrRuntime.changeTarget=function(__hkrId){__hkrId=Number(__hkrId);try{if(typeof vr===\"function\")return vr(__hkrId)}catch(__hkrError){}try{return Io(Mt.clientPlayerChangeTarget.packData({target:__hkrId}))}catch(__hkrError){throw new Error(\"changeTarget failed: \"+((__hkrError&&__hkrError.message)||__hkrError))}};",
      "__hkrRuntime.sendInteract=function(__hkrId){__hkrId=Number(__hkrId);try{return Io(Mt.clientPlayerInteract.packData({id:__hkrId}))}catch(__hkrError){throw new Error(\"sendInteract failed: \"+((__hkrError&&__hkrError.message)||__hkrError))}};",
      "__hkrRuntime.useSkillbarSlot=function(__hkrSlot){__hkrSlot=Number(__hkrSlot);try{if(!Number.isInteger(__hkrSlot)||__hkrSlot<1)throw new Error(\"invalid slot\");var __hkrPlayer=typeof I!==\"undefined\"&&I&&I.player;if(!__hkrPlayer)throw new Error(\"player not ready\");var __hkrSettings=typeof fe!==\"undefined\"&&fe&&fe.skillbarsettings;var __hkrBar=__hkrSettings&&__hkrSettings[__hkrPlayer.name];var __hkrSkill=__hkrBar&&__hkrBar[__hkrSlot-1];if(!__hkrSkill||Number(__hkrSkill.id)<0)throw new Error(\"empty skillbar slot \"+__hkrSlot);var __hkrInfo=Array.isArray(__hkrSkill.info)?__hkrSkill.info.slice():[];if(__hkrSkill.item&&__hkrPlayer.inventory&&typeof __hkrPlayer.inventory.findFirstSlotOfType===\"function\"){var __hkrInvSlot=__hkrPlayer.inventory.findFirstSlotOfType(__hkrSkill.item.type,__hkrSkill.item.tier);if(__hkrInvSlot===void 0)throw new Error(\"item for slot \"+__hkrSlot+\" not found\");__hkrInfo[0]=__hkrInvSlot}var __hkrDef=typeof zt!==\"undefined\"&&zt&&zt.get?zt.get(__hkrSkill.id):null;if(__hkrDef&&__hkrDef.envCast>0&&typeof gu===\"function\"){gu(__hkrSkill.id,__hkrDef.range,__hkrDef.envCast);return {ok:true,slot:__hkrSlot,id:__hkrSkill.id,env:true}}Io(Mt.clientPlayerSkill.packData({id:__hkrSkill.id,info:__hkrInfo}));return {ok:true,slot:__hkrSlot,id:__hkrSkill.id,env:false}}catch(__hkrError){return {ok:false,slot:__hkrSlot,reason:(__hkrError&&__hkrError.message)||String(__hkrError)}}};",
      "__hkrRuntime.isSkillConfigurable=function(__hkrId){",
      "try{",
      "__hkrId=Number(__hkrId);",
      "if(!Number.isInteger(__hkrId)||__hkrId<=0)return false;",
      "var __hkrSkill=zt&&zt.get?zt.get(__hkrId):null;",
      "return !!__hkrSkill&&!__hkrSkill.engineOnly;",
      "}catch(__hkrError){return true}",
      "};",
      "__hkrRuntime.getActiveSkillConfig=function(){",
      "var __hkrOut=[];",
      "try{",
      "var __hkrUnsub=Hs.subscribe(function(__hkrValue){",
      "try{",
      "if(__hkrValue&&typeof __hkrValue.forEach===\"function\"){",
      "__hkrValue.forEach(function(__hkrLevel,__hkrId){",
      "__hkrLevel=Math.max(0,Math.floor(Number(__hkrLevel)||0));",
      "__hkrId=Number(__hkrId);",
      "if(__hkrRuntime.isSkillConfigurable(__hkrId)){for(var __hkrIndex=0;__hkrIndex<__hkrLevel;__hkrIndex+=1)__hkrOut.push(__hkrId)}",
      "});",
      "}else if(__hkrValue&&typeof __hkrValue===\"object\"){",
      "Object.keys(__hkrValue).forEach(function(__hkrId){",
      "var __hkrLevel=Math.max(0,Math.floor(Number(__hkrValue[__hkrId])||0));",
      "__hkrId=Number(__hkrId);",
      "if(__hkrRuntime.isSkillConfigurable(__hkrId)){for(var __hkrIndex=0;__hkrIndex<__hkrLevel;__hkrIndex+=1)__hkrOut.push(__hkrId)}",
      "});",
      "}",
      "}catch(__hkrError){}",
      "});",
      "if(typeof __hkrUnsub===\"function\")__hkrUnsub();",
      "}catch(__hkrError){}",
      "return __hkrOut;",
      "};",
      "__hkrRuntime.combatLog=__hkrRuntime.combatLog||[];",
      "__hkrRuntime.combatLogSeq=__hkrRuntime.combatLogSeq||0;",
      // Called from inside the patched damage packet handler (.set(7)). t=victim
      // entity, e=[_,dmg,skillId,attackerId,_,hitType,school,...]. Resolves names
      // via the in-scope engine (I) and localization (P) and rings a buffer.
      "__hkrRuntime.captureDamageEvent=function(t,e){try{if(__hkrRuntime.combatLogEnabled===false)return;var __p=(typeof I!=='undefined'&&I)?I.player:null;if(!__p||!e)return;var __atk=(typeof I!=='undefined'&&I&&I.getEntityById)?I.getEntityById(e[3]):null;var __out=__atk===__p,__in=t===__p;if(!__out&&!__in)return;var __sid=Number(e[2]),__hit=e[5],__nm='';try{var __bk=(typeof P!=='undefined'&&P&&P.items&&P.items.book)?P.items.book[__sid]:null;__nm=(__bk&&__bk.name)?__bk.name:('#'+__sid)}catch(__x){__nm='#'+__sid}var __src=__atk?(__atk===__p?'\\uB098':(__atk.name||'')):'';var __tgt=t?(t===__p?'\\uB098':(t.name||'')):'';__hkrRuntime.damageHookInstalled=true;var __log=__hkrRuntime.combatLog;__log.push({seq:(++__hkrRuntime.combatLogSeq),time:(typeof I!=='undefined'&&I)?I.time:0,dir:__out?'out':'in',dmg:Number(e[1])||0,skillId:__sid,skill:__nm,hit:__hit,crit:__hit===3,miss:__hit===0,block:__hit===1,source:__src,target:__tgt});if(__log.length>250)__log.splice(0,__log.length-250)}catch(__x){}};",
      "__hkrRuntime.updatedAt=Date.now();",
      "__hkrRuntime.hookHits=__hkrRuntime.hookHits||{};",
      "__hkrRuntime.hookHits.skillRuntimeExpose=(__hkrRuntime.hookHits.skillRuntimeExpose||0)+1;",
      "__hkrRuntime.debug=__hkrRuntime.debug||{};",
      "__hkrRuntime.debug.skillRuntimeAt=__hkrRuntime.updatedAt;",
      "try{__hkrRuntime.debug.skillRuntimeStores={active:typeof Hs,learned:typeof Jc,configs:typeof Ea}}catch(__hkrError){}",
      "}catch(o){try{var __hkrRuntime=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};__hkrRuntime.hookErrors=__hkrRuntime.hookErrors||[];__hkrRuntime.hookErrors.push(\"skillRuntime:\"+((o&&o.message)||o))}catch(i){}}",
    ].join("");
    patched = replaceClientSourceOnce(
      patched,
      "(()=>{",
      `(()=>{${installClientRuntimeProbe}`,
      patches,
      "client-runtime-probe"
    );

    patched = replaceClientSourceOnce(
      patched,
      "Ku=t=>{ne=t}",
      "Ku=t=>{ne=t;try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=t;r.updatedAt=Date.now();r.debug=r.debug||{};r.debug.engineSetterAt=r.updatedAt;try{r.debug.engineSetterKeys=t?Object.getOwnPropertyNames(t).slice(0,40):[]}catch(i){r.debug.engineSetterKeysError=(i&&i.message)||String(i)}}catch(o){}}",
      patches,
      "engine-setter"
    );

    patched = replaceClientSourceOnce(
      patched,
      "Mu=(t,e)=>{N.width=t,N.height=e,ko.width=t,ko.height=e,yn.width=t,yn.height=e}",
      "Mu=(t,e)=>{try{window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};Object.assign(window.__HORDES_KR_RUNTIME__,{camera:he,webglCanvas:ko,overlayCanvas:yn,renderState:N,settings:Te,updatedAt:Date.now()})}catch(o){}N.width=t,N.height=e,ko.width=t,ko.height=e,yn.width=t,yn.height=e}",
      patches,
      "render-state"
    );

    patched = replaceClientSourceOnce(
      patched,
      "Vy=(t,e)=>{Iu(t),tt(ot,!0),Ii(he,!0),em(e),ne.tick(t),",
      `Vy=(t,e)=>{Iu(t),tt(ot,!0),Ii(he,!0),em(e);${exposeLegacyRuntime};ne.tick(t),${exposeLegacyRuntimeCall},`,
      patches,
      "frame-loop"
    );

    patched = replaceClientSourceOnce(
      patched,
      "N3=t=>{I=t}",
      "N3=t=>{I=t;try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=t;try{r.player=t&&t.player;r.target=t&&t.player&&t.player.target}catch(i){}r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientEngineSetter=(r.hookHits.clientEngineSetter||0)+1;r.debug=r.debug||{};r.debug.clientEngineSetterAt=r.updatedAt;try{r.debug.clientEngineSetterKeys=t?Object.getOwnPropertyNames(t).slice(0,40):[]}catch(i){r.debug.clientEngineSetterKeysError=(i&&i.message)||String(i)}}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientEngineSetter:\"+((o&&o.message)||o))}catch(i){}}}",
      patches,
      "client-engine-setter"
    );

    patched = replaceClientSourceOnce(
      patched,
      "ib=(t,e)=>{tt.width=t,tt.height=e,To.width=t,To.height=e,Ln.width=t,Ln.height=e}",
      "ib=(t,e)=>{try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};try{r.camera=gt}catch(i){}try{r.cameraTransform=Qt}catch(i){}r.webglCanvas=To;r.overlayCanvas=Ln;r.renderState=tt;try{r.settings=fe}catch(i){}r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientRenderState=(r.hookHits.clientRenderState||0)+1}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientRenderState:\"+((o&&o.message)||o))}catch(i){}}tt.width=t,tt.height=e,To.width=t,To.height=e,Ln.width=t,Ln.height=e}",
      patches,
      "client-render-state"
    );

    patched = replaceClientSourceOnce(
      patched,
      "QA=(t,e)=>{W3(e),HA(e),I&&I.player?(wx(t),RA(t),I.tick(t),zA(t),wA(t,I),BA(t,I)):I&&I.tick(t)}",
      `QA=(t,e)=>{W3(e),HA(e);${exposeClientRuntime};I&&I.player?(wx(t),RA(t),I.tick(t),${exposeClientRuntimeCall},zA(t),wA(t,I),BA(t,I)):I&&(I.tick(t),${exposeClientRuntimeCall})}`,
      patches,
      "client-frame-loop"
    );

    patched = replaceClientSourceOnce(
      patched,
      "N3(new Fh({})),Z_(!0),z9()",
      "N3(new Fh({}));try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=I;try{r.player=I&&I.player;r.target=I&&I.player&&I.player.target}catch(i){}try{r.camera=gt}catch(i){}try{r.cameraTransform=Qt}catch(i){}try{r.webglCanvas=To}catch(i){}try{r.overlayCanvas=Ln}catch(i){}try{r.renderState=tt}catch(i){}try{r.settings=fe}catch(i){}try{r.minimap={canvas:xo,scale:xr,enlarged:Yd,width:Tl,height:El,offsetX:Xd,offsetY:Qd}}catch(i){}r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientOnload=(r.hookHits.clientOnload||0)+1;r.debug=r.debug||{};r.debug.clientOnloadAt=r.updatedAt;try{r.debug.clientOnloadEngineKeys=I?Object.getOwnPropertyNames(I).slice(0,40):[]}catch(i){r.debug.clientOnloadEngineKeysError=(i&&i.message)||String(i)}}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientOnload:\"+((o&&o.message)||o))}catch(i){}};Z_(!0),z9()",
      patches,
      "client-onload-runtime"
    );

    patched = replaceClientSourceOnce(
      patched,
      'setState(e,n=""){this.state===2&&e===4&&UA(this),',
      `setState(e,n=""){${exposeClientEngineThis("clientSetState")}this.state===2&&e===4&&UA(this),`,
      patches,
      "client-set-state"
    );

    patched = replaceClientSourceOnce(
      patched,
      "setPlayer(e){this.player=e,Zc.set(!0),q9()}",
      `setPlayer(e){this.player=e;${exposeClientEngineThis("clientSetPlayer")}Zc.set(!0),q9()}`,
      patches,
      "client-set-player"
    );

    patched = replaceClientSourceOnce(
      patched,
      "tick(e){for(this.netData.length>5&&",
      `tick(e){${exposeClientEngineThis("clientEngineTick")}for(this.netData.length>5&&`,
      patches,
      "client-engine-tick"
    );

    patched = replaceClientSourceOnce(
      patched,
      "manageChunks(e){g8(e,this.chunkAmount);",
      `manageChunks(e){${exposeClientEngineThis("clientManageChunks")}g8(e,this.chunkAmount);`,
      patches,
      "client-manage-chunks"
    );

    patched = replaceClientSourceOnce(
      patched,
      "};window.onload=async()=>{",
      `};${installClientPrototypeRuntime}window.onload=async()=>{`,
      patches,
      "client-prototype-runtime"
    );

    patched = replaceClientSourceOnce(
      patched,
      "hu=(t,e=!0)=>{_n=t,Td=e&&_n>0,Mm.set(Td?\"pointer\":\"auto\"),Pm.set(_n)},sD=",
      exposeClientTargetController,
      patches,
      "client-target-controller"
    );

    patched = replaceClientSourceOnce(
      patched,
      'var yt=(t,e="")=>{Io(Mt.clientCommand.packData({command:t,string:e+""}))};',
      `var yt=(t,e="")=>{Io(Mt.clientCommand.packData({command:t,string:e+""}))};${exposeClientSkillRuntime}`,
      patches,
      "client-skill-runtime"
    );

    // Tap the damage packet handler (.set(7)) at its body — the minified packet
    // map variable name is not stable across builds, but this handler signature is.
    patched = replaceClientSourceOnce(
      patched,
      ".set(7,(t,e,n)=>{let o=e[1],i=e[2],s=I.getEntityById(e[3])",
      ".set(7,(t,e,n)=>{try{var __hkrRt=window.__HORDES_KR_RUNTIME__;if(__hkrRt&&__hkrRt.captureDamageEvent)__hkrRt.captureDamageEvent(t,e)}catch(__hkrX){}let o=e[1],i=e[2],s=I.getEntityById(e[3])",
      patches,
      "client-damage-log"
    );

    if (patches.length > 0) {
      patched += `\n;try{window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};window.__HORDES_KR_RUNTIME__.patchedBy="Hordes KR Mod";window.__HORDES_KR_RUNTIME__.patchedVersion=${JSON.stringify(MOD_VERSION)};window.__HORDES_KR_RUNTIME__.patchedSource=${JSON.stringify(shortScriptUrl(url))};}catch(o){}\n`;
    }

    return { source: patched, patches };
  }

  function replaceClientSourceOnce(source, search, replacement, patches, patchName) {
    if (!source.includes(search)) return source;

    patches.push(patchName);
    return source.replace(search, replacement);
  }

  function exposeRuntimePart(part) {
    try {
      pageWindow.__HORDES_KR_RUNTIME__ = pageWindow.__HORDES_KR_RUNTIME__ || {};
      Object.assign(pageWindow.__HORDES_KR_RUNTIME__, part);
    } catch {
      // The runtime hook is best-effort and must never block the game.
    }
  }

  function rememberScriptHookValue(field, value, limit = 12) {
    const list = HIGHLIGHT_STATE[field];
    if (!Array.isArray(list)) return;

    list.push(value);
    while (list.length > limit) list.shift();
  }

  function recordScriptHookError(error, source) {
    rememberScriptHookValue("scriptHookErrors", {
      source,
      message: error && error.message ? error.message : String(error),
      at: new Date().toISOString(),
    });
  }

  function shortScriptUrl(url) {
    const parsed = typeof url === "string" ? toUrl(url) : url;
    if (!parsed) return String(url || "");
    return `${parsed.pathname}${parsed.search}`;
  }

  function getScriptHookStatus() {
    return {
      installed: HIGHLIGHT_STATE.scriptHookInstalled,
      scriptGate: {
        enabled: shouldInstallClientScriptGate(),
        installed: HIGHLIGHT_STATE.scriptGateInstalled,
        error: HIGHLIGHT_STATE.scriptGateError,
      },
      attemptedScripts: [...HIGHLIGHT_STATE.scriptHookAttemptedScripts],
      patchedScripts: [...HIGHLIGHT_STATE.scriptHookPatchedScripts],
      errors: [...HIGHLIGHT_STATE.scriptHookErrors],
      runtime: getExposedRuntimeSummary(),
    };
  }

  function initRuntimeNameOverlay() {
    installRuntimeNameOverlayStyle();
    ensureRuntimeNameOverlayHost();
    ensureTargetDistanceOverlayHost();
    ensureMinimapNameOverlayHost();
    ensurePresetQuickBarHost();

    if (HIGHLIGHT_STATE.runtimeOverlayTimer) return;
    HIGHLIGHT_STATE.runtimeOverlayTimer = setInterval(updateRuntimeNameOverlay, RUNTIME_OVERLAY_INTERVAL_MS);
    startRuntimeOverlayPositionLoop();
    pageWindow.addEventListener("resize", updateRuntimeNameOverlay);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", updateRuntimeNameOverlay, { once: true });
    }
  }

  function installRuntimeNameOverlayStyle() {
    if (document.getElementById("hordes-kr-runtime-name-style")) return;

    const style = document.createElement("style");
    style.id = "hordes-kr-runtime-name-style";
    style.textContent = `
      /* Overlay roots */
      #hordes-kr-runtime-name-overlay {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 0 !important;
        height: 0 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        overflow: visible !important;
      }
      #hordes-kr-target-distance-overlay {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 0 !important;
        height: 0 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        overflow: visible !important;
      }
      /* Center progress toast */
      #hordes-kr-gear-preset-progress-overlay {
        position: fixed !important;
        left: 50% !important;
        top: 44% !important;
        transform: translate(-50%, -50%) !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        font-family: Arial, Helvetica, sans-serif !important;
        text-align: center !important;
      }
      .hordes-kr-gear-preset-progress-label {
        display: inline-block !important;
        min-width: 220px !important;
        max-width: min(520px, calc(100vw - 48px)) !important;
        box-sizing: border-box !important;
        padding: 10px 16px !important;
        border: 1px solid rgba(245, 194, 71, 0.76) !important;
        border-radius: 8px !important;
        background: rgba(16, 19, 29, 0.94) !important;
        color: #fff3b0 !important;
        font-size: 18px !important;
        line-height: 1.25 !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        white-space: pre-line !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.48), 0 0 14px rgba(245, 194, 71, 0.28) !important;
        -webkit-text-stroke: 0.35px rgba(5, 10, 22, 0.92) !important;
        text-shadow:
          1px 0 0 rgba(5, 10, 22, 0.92),
          -1px 0 0 rgba(5, 10, 22, 0.92),
          0 1px 0 rgba(5, 10, 22, 0.92),
          0 -1px 0 rgba(5, 10, 22, 0.92),
          0 2px 4px rgba(0, 0, 0, 0.9) !important;
      }
      .hordes-kr-gear-preset-progress-label.success {
        border-color: rgba(52, 203, 73, 0.94) !important;
        color: #d8ffdf !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.48), 0 0 14px rgba(52, 203, 73, 0.34) !important;
      }
      .hordes-kr-gear-preset-progress-label.warn {
        border-color: rgba(245, 194, 71, 0.94) !important;
        color: #fff3b0 !important;
      }
      .hordes-kr-gear-preset-progress-label.error {
        border-color: rgba(244, 41, 41, 0.94) !important;
        color: #ffd2d2 !important;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.48), 0 0 14px rgba(244, 41, 41, 0.34) !important;
      }
      /* Minimap and preset overlay hosts */
      #hordes-kr-minimap-name-overlay {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 0 !important;
        height: 0 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        overflow: visible !important;
      }
      #hordes-kr-minimap-highlight-list {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        font-family: Arial, Helvetica, sans-serif !important;
        color: #dff8f5 !important;
        touch-action: none !important;
      }
      #hordes-kr-preset-quickbar {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        font-family: Arial, Helvetica, sans-serif !important;
        color: #dff8f5 !important;
        touch-action: auto !important;
      }
      .hordes-kr-target-distance-label {
        position: fixed !important;
        transform: translate(0, -100%) !important;
        color: #f5c247 !important;
        opacity: 1 !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 17px !important;
        line-height: 1.05 !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        -webkit-text-stroke: 0.7px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(5, 10, 22, 0.98),
          -2px 0 0 rgba(5, 10, 22, 0.98),
          0 2px 0 rgba(5, 10, 22, 0.98),
          0 -2px 0 rgba(5, 10, 22, 0.98),
          0 2px 3px rgba(0, 0, 0, 0.92),
          0 0 5px rgba(245, 194, 71, 0.78) !important;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85)) !important;
        will-change: left, top !important;
      }
      /* Runtime name labels */
      .hordes-kr-runtime-name-label {
        position: fixed !important;
        transform: translate(-50%, -100%) !important;
        color: #ffffff !important;
        opacity: 1 !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 19px !important;
        line-height: 1.05 !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        -webkit-text-stroke: 0.75px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(5, 10, 22, 0.98),
          -2px 0 0 rgba(5, 10, 22, 0.98),
          0 2px 0 rgba(5, 10, 22, 0.98),
          0 -2px 0 rgba(5, 10, 22, 0.98),
          0 3px 3px rgba(0, 0, 0, 0.92),
          0 0 5px rgba(64, 121, 255, 0.72) !important;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85)) !important;
        will-change: left, top, transform !important;
      }
      .hordes-kr-runtime-name-label.normal-highlight {
        transform: translate(-50%, -145%) !important;
        color: #fff4b0 !important;
        font-size: 20px !important;
        -webkit-text-stroke: 0.85px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(5, 10, 22, 0.98),
          -2px 0 0 rgba(5, 10, 22, 0.98),
          0 2px 0 rgba(5, 10, 22, 0.98),
          0 -2px 0 rgba(5, 10, 22, 0.98),
          0 3px 3px rgba(0, 0, 0, 0.94),
          0 0 7px rgba(245, 194, 71, 0.88) !important;
      }
      .hordes-kr-runtime-name-label.incoming-skill {
        color: #ff3838 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        font-size: 20px !important;
        -webkit-text-stroke: 0.85px rgba(8, 0, 0, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(8, 0, 0, 0.98),
          -2px 0 0 rgba(8, 0, 0, 0.98),
          0 2px 0 rgba(8, 0, 0, 0.98),
          0 -2px 0 rgba(8, 0, 0, 0.98),
          0 3px 3px rgba(0, 0, 0, 0.94),
          0 0 7px rgba(255, 35, 35, 0.9) !important;
      }
      .hordes-kr-runtime-name-label.incoming-watch {
        color: #f5c247 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        font-size: 19px !important;
        -webkit-text-stroke: 0.8px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(5, 10, 22, 0.98),
          -2px 0 0 rgba(5, 10, 22, 0.98),
          0 2px 0 rgba(5, 10, 22, 0.98),
          0 -2px 0 rgba(5, 10, 22, 0.98),
          0 3px 3px rgba(0, 0, 0, 0.94),
          0 0 7px rgba(245, 194, 71, 0.9) !important;
      }
      .hordes-kr-runtime-name-label .watch-prefix {
        color: #f5c247 !important;
        font-size: 0.82em !important;
        font-weight: 1000 !important;
      }
      .hordes-kr-runtime-name-label .skill-icon {
        width: 18px !important;
        height: 18px !important;
        flex: 0 0 18px !important;
        object-fit: contain !important;
        image-rendering: auto !important;
        filter:
          drop-shadow(1px 0 0 rgba(8, 0, 0, 0.98))
          drop-shadow(-1px 0 0 rgba(8, 0, 0, 0.98))
          drop-shadow(0 1px 0 rgba(8, 0, 0, 0.98))
          drop-shadow(0 -1px 0 rgba(8, 0, 0, 0.98)) !important;
      }
      .hordes-kr-runtime-name-label .distance {
        color: #ffb0a8 !important;
        font-size: 0.82em !important;
        font-weight: 900 !important;
      }
      .hordes-kr-runtime-name-label.incoming-watch .distance {
        color: #fff3b0 !important;
      }
      .hordes-kr-runtime-name-label.normal-highlight.buff-spike {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .hordes-kr-runtime-name-label .key-buff-icon {
        width: 17px !important;
        height: 17px !important;
        flex: 0 0 17px !important;
        object-fit: contain !important;
        border-radius: 3px !important;
        box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.95), 0 1px 3px rgba(0, 0, 0, 0.85) !important;
      }
      .hordes-kr-runtime-name-label .key-buff-icon.def {
        box-shadow: 0 0 0 2px rgba(183, 110, 255, 0.97), 0 0 6px rgba(160, 90, 255, 0.6), 0 1px 3px rgba(0, 0, 0, 0.85) !important;
      }
      .hordes-kr-runtime-name-label .key-buff-wrap {
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        flex: 0 0 auto !important;
      }
      .hordes-kr-runtime-name-label .key-buff-wrap .key-buff-cd {
        position: absolute !important;
        left: 50% !important;
        bottom: -3px !important;
        transform: translateX(-50%) !important;
        font: 800 10px/1 -apple-system, 'Segoe UI', sans-serif !important;
        color: #ffffff !important;
        text-shadow: 0 0 2px #000, 0 0 3px #000, 0 1px 2px #000 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
      }
      .hordes-kr-runtime-name-label .cast-skill-icon {
        width: 18px !important;
        height: 18px !important;
        flex: 0 0 18px !important;
        object-fit: contain !important;
        border-radius: 3px !important;
        box-shadow: 0 0 0 2px rgba(255, 160, 40, 1), 0 0 7px rgba(255, 160, 40, 0.85), 0 1px 3px rgba(0, 0, 0, 0.85) !important;
        animation: hordesKrCastPulse 0.55s ease-in-out infinite !important;
      }
      @keyframes hordesKrCastPulse {
        0%, 100% { box-shadow: 0 0 0 2px rgba(255, 160, 40, 1), 0 0 6px rgba(255, 160, 40, 0.7), 0 1px 3px rgba(0, 0, 0, 0.85); }
        50% { box-shadow: 0 0 0 2px rgba(255, 210, 90, 1), 0 0 11px rgba(255, 190, 70, 1), 0 1px 3px rgba(0, 0, 0, 0.85); }
      }
      .hordes-kr-runtime-name-label.normal-highlight.has-key-buff {
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .hordes-kr-runtime-name-label .buff-spike-badge {
        color: #5ad1ff !important;
        font-size: 0.86em !important;
        font-weight: 1000 !important;
        -webkit-text-stroke: 0.6px rgba(2, 12, 26, 0.98) !important;
        text-shadow:
          0 0 6px rgba(90, 209, 255, 0.95),
          0 2px 2px rgba(0, 0, 0, 0.9) !important;
        animation: hordesKrBuffSpikePulse 0.7s ease-in-out infinite !important;
      }
      @keyframes hordesKrBuffSpikePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      /* Minimap labels and highlight list */
      .hordes-kr-minimap-name-label {
        position: fixed !important;
        transform: translate(-50%, -125%) !important;
        color: #f5c247 !important;
        opacity: 1 !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 10px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        -webkit-text-stroke: 0.35px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          1px 0 0 rgba(5, 10, 22, 0.98),
          -1px 0 0 rgba(5, 10, 22, 0.98),
          0 1px 0 rgba(5, 10, 22, 0.98),
          0 -1px 0 rgba(5, 10, 22, 0.98),
          0 1px 2px rgba(0, 0, 0, 0.9) !important;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.85)) !important;
        will-change: left, top !important;
      }
      .hordes-kr-minimap-list-panel {
        width: 100% !important;
        max-height: min(calc(300px * var(--hordes-kr-minimap-list-scale, 1)), 70vh) !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        scrollbar-width: thin !important;
        display: grid !important;
        gap: calc(3px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        border: 1px solid rgba(166, 220, 213, 0.34) !important;
        border-radius: 6px !important;
        background: rgba(16, 19, 29, 0.9) !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.38) !important;
        padding: calc(5px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        box-sizing: border-box !important;
      }
      .hordes-kr-minimap-list-title {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: calc(6px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        color: #a6dcd5 !important;
        font-size: calc(10px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        cursor: move !important;
        user-select: none !important;
        touch-action: none !important;
        padding: calc(1px * var(--hordes-kr-minimap-list-scale, 1)) calc(2px * var(--hordes-kr-minimap-list-scale, 1)) calc(3px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        border-bottom: 1px solid rgba(166, 220, 213, 0.16) !important;
      }
      .hordes-kr-minimap-list-title-main,
      .hordes-kr-minimap-list-title-controls {
        display: flex !important;
        align-items: center !important;
        gap: calc(5px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        min-width: 0 !important;
      }
      .hordes-kr-minimap-list-title-main {
        flex: 1 1 auto !important;
      }
      .hordes-kr-minimap-list-title-controls {
        cursor: default !important;
      }
      .hordes-kr-minimap-list-presets {
        display: inline-flex !important;
        align-items: center !important;
        gap: calc(3px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        min-width: 0 !important;
      }
      .hordes-kr-minimap-list-count {
        color: #a6dcd5 !important;
        font-weight: 900 !important;
        min-width: calc(12px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        text-align: center !important;
      }
      /* Preset quickbar */
      .hordes-kr-preset-quickbar-panel {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        border: 1px solid rgba(166, 220, 213, 0.24) !important;
        border-radius: 5px !important;
        background: rgba(16, 19, 29, 0.78) !important;
        box-shadow: 0 5px 16px rgba(0, 0, 0, 0.32) !important;
        padding: 4px 5px !important;
        box-sizing: border-box !important;
      }
      .hordes-kr-preset-quickbar-stack {
        display: inline-grid !important;
        grid-template-columns: minmax(0, max-content) !important;
        gap: 4px !important;
        align-items: start !important;
        justify-items: start !important;
      }
      .hordes-kr-preset-quickbar-panel[data-dragging="true"] {
        border-color: rgba(245, 194, 71, 0.78) !important;
      }
      .hordes-kr-preset-quickbar-group {
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
        min-width: 0 !important;
      }
      .hordes-kr-preset-quickbar-group + .hordes-kr-preset-quickbar-group {
        border-left: 1px solid rgba(166, 220, 213, 0.16) !important;
        padding-left: 5px !important;
      }
      .hordes-kr-preset-quickbar-btn {
        width: 24px !important;
        height: 27px !important;
        min-width: 24px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 1px solid rgba(245, 194, 71, 0.62) !important;
        border-radius: 4px !important;
        background: rgba(84, 72, 30, 0.92) !important;
        color: #f5c247 !important;
        font: 1000 12px/1 Arial, Helvetica, sans-serif !important;
        line-height: 1 !important;
        padding: 0 !important;
        cursor: pointer !important;
      }
      .hordes-kr-preset-quickbar-btn:hover {
        border-color: rgba(255, 226, 122, 0.95) !important;
        color: #fff3b0 !important;
      }
      .hordes-kr-preset-quickbar-btn.skill {
        width: 30px !important;
        min-width: 30px !important;
        border-color: rgba(116, 184, 255, 0.66) !important;
        background: rgba(28, 58, 96, 0.92) !important;
        color: #bfe3ff !important;
      }
      .hordes-kr-preset-quickbar-btn.skill:hover {
        border-color: rgba(180, 221, 255, 0.96) !important;
        color: #ffffff !important;
      }
      .hordes-kr-preset-quickbar-btn.running {
        border-color: rgba(245, 194, 71, 0.98) !important;
        background: rgba(112, 84, 20, 0.96) !important;
        color: #fff3b0 !important;
        box-shadow: 0 0 7px rgba(245, 194, 71, 0.58) !important;
      }
      .hordes-kr-preset-quickbar-btn.active {
        border-color: rgba(52, 203, 73, 0.98) !important;
        background: rgba(24, 84, 44, 0.94) !important;
        color: #d8ffdf !important;
        box-shadow: 0 0 6px rgba(52, 203, 73, 0.42) !important;
      }
      .hordes-kr-preset-quickbar-btn.partial {
        border-color: rgba(245, 194, 71, 0.74) !important;
      }
      .hordes-kr-preset-quickbar-btn.error {
        border-color: rgba(244, 41, 41, 0.96) !important;
        background: rgba(91, 28, 28, 0.94) !important;
        color: #ffd2d2 !important;
      }
      .hordes-kr-preset-quickbar-btn.empty,
      .hordes-kr-preset-quickbar-btn:disabled {
        border-color: rgba(166, 220, 213, 0.18) !important;
        background: rgba(35, 41, 55, 0.7) !important;
        color: rgba(166, 220, 213, 0.42) !important;
        cursor: default !important;
      }
      .hordes-kr-preset-quickbar-status {
        min-width: 52px !important;
        height: 27px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 1px solid rgba(52, 203, 73, 0.62) !important;
        border-radius: 4px !important;
        background: rgba(18, 55, 35, 0.88) !important;
        color: #d8ffdf !important;
        font: 1000 11px/1 Arial, Helvetica, sans-serif !important;
        white-space: nowrap !important;
        padding: 0 5px !important;
        box-sizing: border-box !important;
      }
      .hordes-kr-preset-quickbar-status.combat {
        min-width: 62px !important;
        border-color: rgba(244, 41, 41, 0.82) !important;
        background: rgba(91, 28, 28, 0.92) !important;
        color: #ffd2d2 !important;
      }
      .hordes-kr-preset-quickbar-status.unknown {
        border-color: rgba(166, 220, 213, 0.26) !important;
        background: rgba(35, 41, 55, 0.72) !important;
        color: #a6dcd5 !important;
      }
      .hordes-kr-preset-quickbar-reset,
      .hordes-kr-preset-quickbar-drag {
        width: 20px !important;
        height: 27px !important;
        min-width: 20px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 1px solid rgba(166, 220, 213, 0.26) !important;
        border-radius: 4px !important;
        background: rgba(35, 41, 55, 0.82) !important;
        color: #dff8f5 !important;
        font: 1000 12px/1 Arial, Helvetica, sans-serif !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      .hordes-kr-preset-quickbar-reset {
        cursor: pointer !important;
      }
      .hordes-kr-preset-quickbar-reset:hover,
      .hordes-kr-preset-quickbar-drag:hover {
        border-color: rgba(245, 194, 71, 0.88) !important;
        color: #f5c247 !important;
      }
      .hordes-kr-preset-quickbar-drag {
        cursor: move !important;
        user-select: none !important;
        touch-action: none !important;
      }
      .hordes-kr-minimap-list-scale-btn {
        width: calc(16px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        height: calc(16px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        min-width: calc(16px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 1px solid rgba(166, 220, 213, 0.28) !important;
        border-radius: 4px !important;
        background: rgba(35, 41, 55, 0.88) !important;
        color: #dff8f5 !important;
        font: inherit !important;
        font-size: calc(10px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        padding: 0 !important;
        cursor: pointer !important;
      }
      .hordes-kr-minimap-list-scale-btn:hover {
        border-color: rgba(245, 194, 71, 0.88) !important;
        color: #f5c247 !important;
      }
      .hordes-kr-minimap-list-scale-btn.active {
        border-color: rgba(52, 203, 73, 0.9) !important;
        background: rgba(18, 65, 35, 0.92) !important;
        color: #d8ffdf !important;
      }
      .hordes-kr-minimap-list-row {
        width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto auto auto !important;
        align-items: center !important;
        gap: calc(6px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        border: 1px solid rgba(166, 220, 213, 0.18) !important;
        border-radius: 4px !important;
        background: rgba(35, 41, 55, 0.86) !important;
        color: #ffffff !important;
        font: inherit !important;
        font-size: calc(11px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1.15 !important;
        font-weight: 900 !important;
        padding: calc(4px * var(--hordes-kr-minimap-list-scale, 1)) calc(5px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        cursor: pointer !important;
        text-align: left !important;
      }
      .hordes-kr-minimap-list-row:hover,
      .hordes-kr-minimap-list-row.locked {
        border-color: rgba(245, 194, 71, 0.88) !important;
        background: rgba(84, 72, 30, 0.92) !important;
      }
      .hordes-kr-minimap-list-row.targeted {
        border-color: rgba(52, 203, 73, 0.95) !important;
        background: rgba(24, 84, 44, 0.94) !important;
      }
      .hordes-kr-minimap-list-row.nearby .name,
      .hordes-kr-minimap-list-row.nearby .distance,
      .hordes-kr-minimap-list-row.nearby .hp-text,
      .hordes-kr-minimap-list-row.nearby .state {
        font-weight: 1000 !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9) !important;
      }
      .hordes-kr-minimap-list-row .del-btn {
        flex: 0 0 auto !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: calc(16px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        height: calc(16px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        font-size: calc(11px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1 !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        opacity: 0.5 !important;
        filter: grayscale(1) !important;
        transition: opacity 0.1s, background 0.1s !important;
      }
      .hordes-kr-minimap-list-row .del-btn:hover {
        opacity: 1 !important;
        filter: none !important;
        background: rgba(220, 60, 60, 0.85) !important;
      }
      .hordes-kr-minimap-list-row .identity {
        min-width: 0 !important;
        display: grid !important;
        gap: calc(2px * var(--hordes-kr-minimap-list-scale, 1)) !important;
      }
      .hordes-kr-minimap-list-row .name-line {
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: calc(4px * var(--hordes-kr-minimap-list-scale, 1)) !important;
      }
      .hordes-kr-minimap-list-row .class-icon {
        width: calc(14px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        height: calc(14px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        min-width: calc(14px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        object-fit: contain !important;
        image-rendering: auto !important;
      }
      .hordes-kr-minimap-list-row .class-icon[hidden] {
        display: none !important;
      }
      .hordes-kr-minimap-list-row .name {
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .hordes-kr-minimap-list-row .hp {
        min-width: 0 !important;
        display: grid !important;
        grid-template-columns: minmax(calc(44px * var(--hordes-kr-minimap-list-scale, 1)), 1fr) auto !important;
        align-items: center !important;
        gap: calc(4px * var(--hordes-kr-minimap-list-scale, 1)) !important;
      }
      .hordes-kr-minimap-list-row .hp[hidden] {
        display: none !important;
      }
      .hordes-kr-minimap-list-row .hp-bar {
        position: relative !important;
        display: block !important;
        height: calc(7px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        min-width: calc(44px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        width: 100% !important;
        overflow: hidden !important;
        border: 1px solid rgba(190, 255, 205, 0.72) !important;
        border-radius: 999px !important;
        background: linear-gradient(180deg, rgba(14, 20, 24, 0.96), rgba(4, 8, 11, 0.96)) !important;
        box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.85), 0 0 4px rgba(52, 203, 73, 0.22) !important;
      }
      .hordes-kr-minimap-list-row .hp-fill {
        position: absolute !important;
        display: block !important;
        left: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        width: 0;
        background: linear-gradient(90deg, #16a34a, #34cb49 52%, #8dff9a) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 0 7px rgba(52, 203, 73, 0.72) !important;
        transition: width 120ms linear !important;
        will-change: width !important;
      }
      .hordes-kr-minimap-list-row .hp-text {
        color: #bcebc9 !important;
        font-size: calc(8.5px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        white-space: nowrap !important;
      }
      .hordes-kr-minimap-list-row .distance {
        color: #f5c247 !important;
        font-size: calc(10px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        white-space: nowrap !important;
      }
      .hordes-kr-minimap-list-row .state {
        min-width: calc(38px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        color: #8ea6aa !important;
        font-size: calc(9px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        text-align: center !important;
        white-space: nowrap !important;
      }
      .hordes-kr-minimap-list-row.targeted .state {
        color: #74ff87 !important;
      }
      .hordes-kr-minimap-list-row.locked .state {
        color: #f5c247 !important;
      }
      .hordes-kr-minimap-list-empty {
        color: #8ea6aa !important;
        font-size: calc(10px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        line-height: 1.2 !important;
        font-weight: 800 !important;
        padding: calc(4px * var(--hordes-kr-minimap-list-scale, 1)) calc(2px * var(--hordes-kr-minimap-list-scale, 1)) !important;
        text-align: center !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureRuntimeNameOverlayHost() {
    if (HIGHLIGHT_STATE.runtimeOverlayHost && document.contains(HIGHLIGHT_STATE.runtimeOverlayHost)) {
      return HIGHLIGHT_STATE.runtimeOverlayHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-runtime-name-overlay";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    HIGHLIGHT_STATE.runtimeOverlayHost = host;
    return host;
  }

  function ensureTargetDistanceOverlayHost() {
    if (TARGET_DISTANCE_STATE.overlayHost && document.contains(TARGET_DISTANCE_STATE.overlayHost)) {
      return TARGET_DISTANCE_STATE.overlayHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-target-distance-overlay";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    TARGET_DISTANCE_STATE.overlayHost = host;
    TARGET_DISTANCE_STATE.overlayLabel = null;
    return host;
  }

  function ensureGearPresetProgressOverlayHost() {
    if (GEAR_PRESET_STATE.progressOverlayHost && document.contains(GEAR_PRESET_STATE.progressOverlayHost)) {
      return GEAR_PRESET_STATE.progressOverlayHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-gear-preset-progress-overlay";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
    GEAR_PRESET_STATE.progressOverlayHost = host;
    return host;
  }

  function showGearPresetProgressOverlay(message, variant = "running", durationMs = 0) {
    const host = ensureGearPresetProgressOverlayHost();
    if (!host) return;

    if (GEAR_PRESET_STATE.progressOverlayTimer) {
      pageWindow.clearTimeout(GEAR_PRESET_STATE.progressOverlayTimer);
      GEAR_PRESET_STATE.progressOverlayTimer = null;
    }

    let label = host.querySelector(".hordes-kr-gear-preset-progress-label");
    if (!label) {
      label = document.createElement("div");
      host.replaceChildren(label);
    }

    label.className = `hordes-kr-gear-preset-progress-label ${variant || "running"}`;
    label.textContent = message;

    if (durationMs > 0) {
      GEAR_PRESET_STATE.progressOverlayTimer = pageWindow.setTimeout(() => {
        host.replaceChildren();
        GEAR_PRESET_STATE.progressOverlayTimer = null;
      }, durationMs);
    }
  }

  function formatGearPresetProgressMessage(presetName, done, total) {
    const title = presetName ? `프리셋 ${presetName}` : "장비";
    return `${title}로 전환중\n${Math.max(0, done)}/${Math.max(0, total)}`;
  }

  function formatGearPresetIncompleteMessage(presetName, verify) {
    const title = presetName ? `프리셋 ${presetName}` : "프리셋";
    const missing = Array.isArray(verify && verify.missing) ? verify.missing : [];
    const extra = Array.isArray(verify && verify.extraEquipped) ? verify.extraEquipped : [];
    const lines = [
      `${title} 전환 불완전`,
      `${verify && verify.matched || 0}/${verify && verify.total || 0} 확인`,
    ];

    if (missing.length > 0) {
      lines.push(`미장착: ${formatGearPresetProblemItems(missing)}`);
    }
    if (extra.length > 0) {
      lines.push(`남은장착: ${formatGearPresetProblemItems(extra)}`);
    }

    return lines.join("\n");
  }

  function formatGearPresetProblemItems(items) {
    return (items || [])
      .slice(0, 3)
      .map(formatGearPresetProblemItem)
      .join(", ") + ((items || []).length > 3 ? ` 외 ${(items || []).length - 3}` : "");
  }

  function formatGearPresetProblemItem(item) {
    const type = item && item.itemType ? item.itemType : "item";
    const slot = Number(item && (item.equipSlot || item.slotIndex));
    const slotText = Number.isInteger(slot) ? `@${formatGearPresetSlotName(slot)}` : "";
    return `${type}${slotText}`;
  }

  function formatGearPresetSlotName(slot) {
    const slotName = {
      101: "무기",
      102: "팔찌",
      103: "갑옷",
      104: "가방",
      105: "신발",
      106: "장갑",
      107: "반지",
      108: "목걸이",
      109: "보조",
      110: "참1",
      111: "참2",
    }[Number(slot)];
    return slotName || String(slot);
  }

  function ensureMinimapNameOverlayHost() {
    if (HIGHLIGHT_STATE.minimapOverlayHost && document.contains(HIGHLIGHT_STATE.minimapOverlayHost)) {
      return HIGHLIGHT_STATE.minimapOverlayHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-minimap-name-overlay";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    HIGHLIGHT_STATE.minimapOverlayHost = host;
    return host;
  }

  function ensureMinimapHighlightListHost() {
    if (HIGHLIGHT_STATE.minimapListHost && document.contains(HIGHLIGHT_STATE.minimapListHost)) {
      return HIGHLIGHT_STATE.minimapListHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-minimap-highlight-list";
    document.body.appendChild(host);
    HIGHLIGHT_STATE.minimapListHost = host;
    return host;
  }

  function ensurePresetQuickBarHost() {
    if (HIGHLIGHT_STATE.presetBarHost && document.contains(HIGHLIGHT_STATE.presetBarHost)) {
      return HIGHLIGHT_STATE.presetBarHost;
    }

    if (!document.body) return null;

    const host = document.createElement("div");
    host.id = "hordes-kr-preset-quickbar";
    document.body.appendChild(host);
    HIGHLIGHT_STATE.presetBarHost = host;
    return host;
  }

  function isBuffSpikeWarnEnabled() {
    return FEATURE_CONFIG.buffSpikeWarnEnabled !== false;
  }

  function isHostileEntity(entity, runtime) {
    try {
      const me = runtime && (runtime.player || (runtime.engine && runtime.engine.player));
      const myFaction = me && me.faction;
      const theirFaction = entity && entity.faction;
      if (myFaction === undefined || myFaction === null || theirFaction === undefined || theirFaction === null) {
        return true; // faction unknown -> don't suppress the warning
      }
      return theirFaction !== myFaction;
    } catch {
      return true;
    }
  }

  // Distinct active buffs on an entity. The engine keeps each entity's buffs in a
  // Map (buffId -> Map(casterId -> instance)); its size is the live distinct-buff
  // count, kept in sync for nearby-loaded entities. -1 = unreadable.
  function readEntityBuffCount(entity) {
    try {
      const controller = entity && entity.buffs;
      const map = controller && controller.buffs;
      if (map && typeof map.size === "number") return map.size;
    } catch {
      // entity may not expose buffs (not loaded yet)
    }
    return -1;
  }

  // Track each entity's buff count and report whether a "buff pop" (a fast rise of
  // >= BUFF_SPIKE_THRESHOLD distinct buffs within BUFF_SPIKE_WINDOW_MS) is active.
  // The first sighting only seeds the baseline so initial load doesn't false-alarm.
  function updateBuffSpikeForEntity(entity, now) {
    const id = getRuntimeEntityId(entity);
    if (id === undefined || id === null) return false;
    const size = readEntityBuffCount(entity);
    if (size < 0) return false;

    const tracker = HIGHLIGHT_STATE.buffSpikeTracker;
    let rec = tracker.get(id);
    if (!rec) {
      tracker.set(id, { baseline: size, baselineAt: now, spikeUntil: 0, seenAt: now, tick: now });
      return false;
    }
    rec.seenAt = now;
    if (rec.tick === now) return now < rec.spikeUntil; // already processed this tick
    rec.tick = now;

    if (size < rec.baseline || now - rec.baselineAt > BUFF_SPIKE_WINDOW_MS) {
      rec.baseline = size;
      rec.baselineAt = now;
    } else if (size - rec.baseline >= BUFF_SPIKE_THRESHOLD) {
      rec.spikeUntil = now + BUFF_SPIKE_DISPLAY_MS;
      rec.baseline = size;     // re-anchor so the same pop doesn't keep retriggering
      rec.baselineAt = now;
    }
    return now < rec.spikeUntil;
  }

  function pruneBuffSpikeTracker(now) {
    const tracker = HIGHLIGHT_STATE.buffSpikeTracker;
    for (const [id, rec] of tracker) {
      if (now - (rec && rec.seenAt || 0) > BUFF_SPIKE_TRACKER_TTL_MS) tracker.delete(id);
    }
  }

  function buildDataAssetUrl(path) {
    const version = getGameAssetVersion();
    return `/data/${path}.avif${version ? `?v=${encodeURIComponent(version)}` : ""}`;
  }

  function matchKeyBuffIcon(icon) {
    if (!icon) return null;
    const def = KEY_DEFENSE_ICON_MAP[icon];
    if (def) return { ...def, kind: "def" };
    const direct = KEY_BUFF_ICON_MAP[icon];
    if (direct) return { ...direct, kind: "buff" };
    for (const prefix in KEY_BUFF_CHARM_MAP) {
      if (icon.indexOf(prefix) === 0) return { ...KEY_BUFF_CHARM_MAP[prefix], kind: "buff" };
    }
    return null;
  }

  // Read a watched enemy's currently-active "tell" buffs as displayable icons.
  // Each buff lives at entity.buffs.buffs.get(id) (a Map caster->instance); the
  // instance's logic.icon is the icon path. Matched against the key-buff maps.
  function getEntityKeyBuffIcons(entity, runtime) {
    const out = [];
    try {
      const map = entity && entity.buffs && entity.buffs.buffs;
      if (!map || typeof map.forEach !== "function") return out;
      const engine = runtime && runtime.engine;
      const now = engine && typeof engine.time === "number" ? engine.time : null;
      const seen = new Set();
      map.forEach((inner) => {
        let inst = null;
        let icon = "";
        try {
          inst = inner && typeof inner.values === "function" ? inner.values().next().value : inner;
          icon = inst && inst.logic && inst.logic.icon || "";
        } catch {
          icon = "";
        }
        if (!icon || seen.has(icon)) return;
        const match = matchKeyBuffIcon(icon);
        if (!match) return;
        seen.add(icon);
        const isDef = match.kind === "def";
        let remain = null;
        if (isDef && now !== null) {
          // Defensive buff still active → show its remaining duration as the "still
          // protected" window (the recast cooldown itself isn't synced from enemies).
          try {
            const end = Number(inst && inst.timer && inst.timer.end);
            if (Number.isFinite(end) && end > now) remain = end - now;
          } catch { /* timer unreadable */ }
        }
        out.push({
          iconUrl: buildDataAssetUrl(icon),
          label: match.label,
          kind: isDef ? "def" : "buff",
          ally: !!match.ally,
          remain,
        });
      });
    } catch {
      // entity buffs may be unreadable mid-transition
    }
    // Defensive icons first so a target's protection state is the eye's first stop.
    out.sort((a, b) => (a.kind === "def" ? 0 : 1) - (b.kind === "def" ? 0 : 1));
    return out.slice(0, KEY_BUFF_MAX_ICONS);
  }

  // If an enemy is mid-cast on one of the flagged skills, return its icon. The skill
  // being cast is entity.skills.timedSkill (null when idle); timedCast.end (engine
  // clock) marks when it resolves, so a stale reference past the end is ignored.
  function getEntityCastIcon(entity, runtime) {
    try {
      const skills = entity && entity.skills;
      const timedSkill = skills && skills.timedSkill;
      const id = timedSkill && timedSkill.id;
      if (id == null) return null;
      const label = KEY_CAST_SKILL_MAP[id];
      if (!label) return null;
      const engine = runtime && runtime.engine;
      const now = engine && typeof engine.time === "number" ? engine.time : null;
      const end = Number(skills.timedCast && skills.timedCast.end);
      if (now !== null && Number.isFinite(end) && now > end + 0.2) return null; // cast already done
      return { iconUrl: buildDataAssetUrl("ui/skills/" + id), label };
    } catch {
      return null;
    }
  }

  // ===== Status dashboard (small draggable HUD) =====
  // Shows the runtime bridge + feature health at a glance. The runtime row goes red
  // when the engine bridge is missing (the transient drop the user kept hitting), and
  // every runtime-dependent feature then shows "런타임 대기" so it's obvious why the
  // overlays paused.
  function isDashboardEnabled() {
    return FEATURE_CONFIG.dashboardEnabled !== false;
  }

  function getDashboardRuntimeState() {
    let summary;
    try { summary = getExposedRuntimeSummary(); } catch { summary = null; }
    if (!summary || !summary.exposed) return { dot: "err", text: "끊김", healthy: false };
    if (!summary.hasEngine || !summary.hasPlayer) return { dot: "warn", text: "로딩/전환", healthy: false };
    if (!summary.hasProjectionMatrix) return { dot: "warn", text: "카메라 대기", healthy: false };
    if (Number.isFinite(summary.frameLoopSeenAgoMs) && summary.frameLoopSeenAgoMs > 2000) {
      return { dot: "warn", text: "프레임 멈춤", healthy: false };
    }
    return { dot: "ok", text: "연결됨", healthy: true };
  }

  function dashboardFeatureRow(enabled, needsRuntime, runtimeHealthy, active, liveText, idleText) {
    if (!enabled) return { dot: "off", text: "꺼짐" };
    if (needsRuntime && !runtimeHealthy) return { dot: "warn", text: "런타임 대기" };
    return { dot: "ok", text: active ? liveText : idleText };
  }

  function computeDashboardRows() {
    const rt = getDashboardRuntimeState();
    const healthy = rt.healthy;
    const now = Date.now();
    const recent = (ts) => Boolean(ts) && now - ts < DASHBOARD_ACTIVE_WINDOW_MS;

    return [
      { key: "runtime", label: "런타임", dot: rt.dot, text: rt.text },
      {
        key: "highlight",
        label: "강조표시",
        ...dashboardFeatureRow(
          HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.names.length > 0,
          true, healthy, recent(HIGHLIGHT_STATE.lastRuntimeOverlayAt), "표시중", "대기"
        ),
      },
      {
        key: "list",
        label: "강조목록",
        ...dashboardFeatureRow(HIGHLIGHT_CONFIG.minimapListEnabled, true, healthy, recent(HIGHLIGHT_STATE.lastMinimapOverlayAt), "켜짐", "대기"),
      },
      {
        key: "dist",
        label: "타겟거리",
        ...dashboardFeatureRow(isTargetDistanceEnabled(), true, healthy, healthy, "켜짐", "대기"),
      },
      {
        key: "cast",
        label: "시전/주시",
        ...dashboardFeatureRow(
          isIncomingSkillOverlayEnabled() || isIncomingTargetWatchEnabled(),
          true, healthy, recent(HIGHLIGHT_STATE.lastIncomingSkillOverlayAt), "감지중", "대기"
        ),
      },
      {
        key: "buff",
        label: "버프경고",
        ...dashboardFeatureRow(isBuffSpikeWarnEnabled(), true, healthy, healthy, "켜짐", "대기"),
      },
      {
        key: "trans",
        label: "번역",
        ...dashboardFeatureRow(FEATURE_CONFIG.domTranslationEnabled !== false, false, healthy, MOD_STATUS.domReplacedCount > 0, "적용", "대기"),
      },
      {
        key: "threat",
        label: "위협",
        dot: COMBAT_ASSIST_STATE.watcherIds.size > 0 ? "err" : (COMBAT_ASSIST_STATE.mobAggroCount > 0 ? "warn" : "ok"),
        text: COMBAT_ASSIST_STATE.watcherIds.size > 0
          ? `주시 ${COMBAT_ASSIST_STATE.watcherIds.size}명`
          : (COMBAT_ASSIST_STATE.mobAggroCount > 0 ? `어그로 ${COMBAT_ASSIST_STATE.mobAggroCount}` : "없음"),
      },
    ];
  }

  function ensureDashboardStyle() {
    if (DASHBOARD_STATE.styleInstalled) return;
    const style = document.createElement("style");
    style.textContent = [
      "#hkr-dashboard{position:fixed;left:8px;top:8px;z-index:2147483600;font:600 11px/1.45 -apple-system,'Segoe UI',sans-serif;color:#e8eef6;background:rgba(14,18,26,0.82);border:1px solid rgba(120,140,170,0.35);border-radius:7px;padding:4px 7px 5px;min-width:120px;box-shadow:0 3px 12px rgba(0,0,0,0.5);-webkit-user-select:none;user-select:none}",
      "#hkr-dashboard .hkr-dash-header{display:flex;align-items:center;gap:5px;cursor:move;margin-bottom:3px;padding-bottom:3px;border-bottom:1px solid rgba(120,140,170,0.2)}",
      "#hkr-dashboard .hkr-dash-title{flex:1;letter-spacing:0.3px;opacity:0.92}",
      "#hkr-dashboard .hkr-dash-hide{cursor:pointer;opacity:0.5;padding:0 2px}",
      "#hkr-dashboard .hkr-dash-hide:hover{opacity:1}",
      "#hkr-dashboard .hkr-dash-row{display:flex;align-items:center;gap:5px;padding:1px 0}",
      "#hkr-dashboard .hkr-dash-lbl{flex:1;opacity:0.86}",
      "#hkr-dashboard .hkr-dash-val{opacity:0.7;font-weight:500;font-size:10px}",
      "#hkr-dashboard .hkr-dash-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px;background:#5a6470}",
      "#hkr-dashboard .hkr-dash-dot.dot-ok{background:#37d67a;box-shadow:0 0 5px rgba(55,214,122,0.7)}",
      "#hkr-dashboard .hkr-dash-dot.dot-warn{background:#f5c042;box-shadow:0 0 5px rgba(245,192,66,0.6)}",
      "#hkr-dashboard .hkr-dash-dot.dot-err{background:#ff4d4d;box-shadow:0 0 6px rgba(255,77,77,0.75)}",
      "#hkr-dashboard .hkr-dash-dot.dot-off{background:#5a6470;box-shadow:none}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
    DASHBOARD_STATE.styleInstalled = true;
  }

  function applyDashboardSavedPosition(host) {
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(DASHBOARD_POS_KEY) || "null"); } catch { pos = null; }
    const x = pos && Number.isFinite(pos.x) ? pos.x : 8;
    const y = pos && Number.isFinite(pos.y) ? pos.y : 8;
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
  }

  function installDashboardDrag(host, handle) {
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const rect = host.getBoundingClientRect();
      DASHBOARD_STATE.dragging = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      const drag = DASHBOARD_STATE.dragging;
      if (!drag) return;
      const maxX = Math.max(0, (Number(pageWindow.innerWidth) || 800) - 40);
      const maxY = Math.max(0, (Number(pageWindow.innerHeight) || 600) - 18);
      host.style.left = `${Math.round(clamp(event.clientX - drag.dx, 0, maxX))}px`;
      host.style.top = `${Math.round(clamp(event.clientY - drag.dy, 0, maxY))}px`;
    });
    document.addEventListener("mouseup", () => {
      if (!DASHBOARD_STATE.dragging) return;
      DASHBOARD_STATE.dragging = null;
      try {
        const rect = host.getBoundingClientRect();
        localStorage.setItem(DASHBOARD_POS_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
      } catch {
        // storage may be unavailable
      }
    });
  }

  function ensureDashboardHost() {
    if (DASHBOARD_STATE.host && document.contains(DASHBOARD_STATE.host)) return DASHBOARD_STATE.host;
    if (!document.body) return null;
    ensureDashboardStyle();

    const host = document.createElement("div");
    host.id = "hkr-dashboard";

    const header = document.createElement("div");
    header.className = "hkr-dash-header";
    const master = document.createElement("span");
    master.className = "hkr-dash-master hkr-dash-dot dot-warn";
    const title = document.createElement("span");
    title.className = "hkr-dash-title";
    title.textContent = "KR 상태";
    const hide = document.createElement("span");
    hide.className = "hkr-dash-hide";
    hide.textContent = "✕";
    hide.title = "숨기기 (콘솔 HordesKrMod.toggleDashboard() 로 다시 표시)";
    hide.addEventListener("click", (event) => {
      event.stopPropagation();
      setDashboardEnabled(false);
    });
    header.append(master, title, hide);

    const body = document.createElement("div");
    body.className = "hkr-dash-body";

    host.append(header, body);
    document.body.appendChild(host);
    applyDashboardSavedPosition(host);
    installDashboardDrag(host, header);

    DASHBOARD_STATE.host = host;
    DASHBOARD_STATE.body = body;
    DASHBOARD_STATE.rows.clear();
    return host;
  }

  function renderDashboard(rows) {
    const host = ensureDashboardHost();
    if (!host) return;
    const body = DASHBOARD_STATE.body;

    const master = host.querySelector(".hkr-dash-master");
    if (master) master.className = `hkr-dash-master hkr-dash-dot dot-${rows[0].dot}`;

    for (const row of rows) {
      let el = DASHBOARD_STATE.rows.get(row.key);
      if (!el || !body.contains(el)) {
        el = document.createElement("div");
        el.className = "hkr-dash-row";
        const dot = document.createElement("span");
        dot.className = "hkr-dash-dot";
        const label = document.createElement("span");
        label.className = "hkr-dash-lbl";
        label.textContent = row.label;
        const value = document.createElement("span");
        value.className = "hkr-dash-val";
        el.append(dot, label, value);
        body.appendChild(el);
        DASHBOARD_STATE.rows.set(row.key, el);
      }
      const dotClass = `hkr-dash-dot dot-${row.dot}`;
      if (el.children[0].className !== dotClass) el.children[0].className = dotClass;
      if (el.children[2].textContent !== row.text) el.children[2].textContent = row.text;
    }
  }

  function hideDashboard() {
    if (DASHBOARD_STATE.host) DASHBOARD_STATE.host.style.display = "none";
  }

  function updateStatusDashboard() {
    try {
      if (!isDashboardEnabled()) {
        hideDashboard();
        return;
      }
      renderDashboard(computeDashboardRows());
      if (DASHBOARD_STATE.host) DASHBOARD_STATE.host.style.display = "block";
    } catch {
      // never let the dashboard break the page
    }
  }

  function installStatusDashboard() {
    if (DASHBOARD_STATE.timer) return;
    DASHBOARD_STATE.timer = setInterval(updateStatusDashboard, DASHBOARD_REFRESH_MS);
    updateStatusDashboard();
  }

  function setDashboardEnabled(value) {
    FEATURE_CONFIG.dashboardEnabled = Boolean(value);
    saveFeatureConfig();
    if (!FEATURE_CONFIG.dashboardEnabled) hideDashboard();
    else updateStatusDashboard();
    return FEATURE_CONFIG.dashboardEnabled;
  }

  function updateRuntimeNameOverlay() {
    const now = Date.now();
    if (now - TARGET_DISTANCE_STATE.lastOverlayTickAt >= TARGET_DISTANCE_OVERLAY_REFRESH_MS) {
      TARGET_DISTANCE_STATE.lastOverlayTickAt = now;
      updateTargetDistanceOverlay();
    }

    if (now - HIGHLIGHT_STATE.lastMinimapOverlayTickAt >= MINIMAP_OVERLAY_REFRESH_MS) {
      HIGHLIGHT_STATE.lastMinimapOverlayTickAt = now;
      updateMinimapNameOverlay();
    }

    if (now - HIGHLIGHT_STATE.lastPresetBarTickAt >= PRESET_QUICKBAR_REFRESH_MS) {
      HIGHLIGHT_STATE.lastPresetBarTickAt = now;
      updatePresetQuickBar();
    }

    try { updateThreatHud(); } catch { /* HUD must never break the overlay */ }

    try {
      if (!shouldRunRuntimeNameOverlay()) {
        clearRuntimeNameOverlay();
        return;
      }

      if (now - HIGHLIGHT_STATE.lastRuntimeOverlayTickAt < RUNTIME_NAME_OVERLAY_REFRESH_MS) return;
      HIGHLIGHT_STATE.lastRuntimeOverlayTickAt = now;

      const runtime = getExposedRuntime();
      if (!runtime) {
        clearRuntimeNameOverlay();
        return;
      }

      const incomingGroups = collectIncomingWarningOverlayEntities(runtime);
      const incomingCandidates = incomingGroups.skills;
      const incomingTargetWatchCandidates = incomingGroups.watches;

      const host = ensureRuntimeNameOverlayHost();
      if (!host || !getRuntimeProjectionMatrix(runtime)) {
        clearRuntimeNameOverlay();
        return;
      }

      const overlayHighlightNames = getOverlayHighlightNames();
      const candidates = [
        ...incomingCandidates,
        ...incomingTargetWatchCandidates,
        ...(
          overlayHighlightNames.length > 0
            ? collectRuntimeOverlayEntities(overlayHighlightNames, {
                limit: 16,
                maxDepth: 5,
                maxObjects: 3000,
              })
            : []
        ),
      ];
      const projected = [];
      const buffSpikeOn = isBuffSpikeWarnEnabled();

      for (const candidate of dedupeRuntimeOverlayCandidates(candidates).sort(sortRuntimeOverlayCandidateForDisplay)) {
        // Track buff state for every loaded watched/highlighted enemy (even off-screen
        // ones) so a baseline exists before they pop; flag the ones that just spiked.
        const hostile = isHostileEntity(candidate.entity, runtime);
        candidate.buffSpike = buffSpikeOn && hostile && updateBuffSpikeForEntity(candidate.entity, now);
        candidate.keyBuffs = buffSpikeOn && hostile ? getEntityKeyBuffIcons(candidate.entity, runtime) : [];
        candidate.castSkill = buffSpikeOn && hostile ? getEntityCastIcon(candidate.entity, runtime) : null;

        const point = (candidate.incomingSkill || candidate.incomingTargetWatch)
          ? projectRuntimeIncomingWarningPoint(candidate, runtime)
          : projectRuntimeEntityToScreen(candidate, runtime);
        if (!point) continue;

        projected.push({ ...candidate, screen: point, offScreen: Boolean(point.offScreen) });
        if (projected.length >= 18) break;
      }
      if (buffSpikeOn) pruneBuffSpikeTracker(now);

      renderRuntimeNameOverlayLabels(host, projected);
      HIGHLIGHT_STATE.lastRuntimeOverlayMatches = projected.slice(0, 8).map((candidate) => ({
        id: String(getRuntimeEntityId(candidate.entity) ?? ""),
        name: candidate.name,
        path: candidate.path,
        incomingSkill: Boolean(candidate.incomingSkill),
        incomingTargetWatch: Boolean(candidate.incomingTargetWatch),
        position: candidate.position.map(roundCoord),
        screen: {
          x: roundCoord(candidate.screen.x),
          y: roundCoord(candidate.screen.y),
        },
      }));
      HIGHLIGHT_STATE.lastIncomingSkillOverlayMatches = projected
        .filter((candidate) => candidate.incomingSkill)
        .slice(0, 8)
        .map((candidate) => ({
          id: String(getRuntimeEntityId(candidate.entity) ?? ""),
          name: candidate.name,
          skillId: candidate.skillId || "",
          distance: candidate.distanceText || "",
          relation: candidate.relation ? candidate.relation.type : "",
          path: candidate.path,
        }));
      HIGHLIGHT_STATE.lastIncomingTargetWatchMatches = projected
        .filter((candidate) => candidate.incomingTargetWatch)
        .slice(0, 8)
        .map((candidate) => ({
          id: String(getRuntimeEntityId(candidate.entity) ?? ""),
          name: candidate.name,
          distance: candidate.distanceText || "",
          relation: candidate.relation ? candidate.relation.type : "",
          targetField: candidate.watchTargetField || "",
          path: candidate.path,
        }));

      if (projected.length > 0) {
        HIGHLIGHT_STATE.runtimeOverlayHits += projected.length;
        HIGHLIGHT_STATE.lastRuntimeOverlayAt = Date.now();
        HIGHLIGHT_STATE.lastRuntimeOverlayError = "";
      }

      const incomingCount = projected.filter((candidate) => candidate.incomingSkill).length;
      if (incomingCount > 0) {
        HIGHLIGHT_STATE.incomingSkillOverlayHits += incomingCount;
        HIGHLIGHT_STATE.lastIncomingSkillOverlayAt = Date.now();
        HIGHLIGHT_STATE.lastIncomingSkillOverlayError = "";
      }

      const watchCount = projected.filter((candidate) => candidate.incomingTargetWatch).length;
      if (watchCount > 0) {
        HIGHLIGHT_STATE.incomingTargetWatchHits += watchCount;
        HIGHLIGHT_STATE.lastIncomingTargetWatchAt = Date.now();
        HIGHLIGHT_STATE.lastIncomingTargetWatchError = "";
      }
    } catch (error) {
      HIGHLIGHT_STATE.lastRuntimeOverlayError = error && error.message ? error.message : String(error);
      HIGHLIGHT_STATE.lastIncomingSkillOverlayError = HIGHLIGHT_STATE.lastRuntimeOverlayError;
      HIGHLIGHT_STATE.lastIncomingTargetWatchError = HIGHLIGHT_STATE.lastRuntimeOverlayError;
      clearRuntimeNameOverlay();
    }
  }

  function getChatPanelRect() {
    return getVisibleElementRect(document.getElementById("chat"))
      || getVisibleElementRect(document.querySelector(".l-corner-ll"));
  }

  function getVisibleElementRect(element) {
    if (!element || !document.contains(element)) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function updateTargetDistanceOverlay() {
    try {
      if (!isTargetDistanceEnabled()) {
        clearTargetDistanceOverlay();
        return;
      }

      if (Date.now() - TARGET_DISTANCE_STATE.lastCanvasAt < 250) {
        clearTargetDistanceOverlay();
        return;
      }

      const result = getTargetDistance(false);
      if (!result.available || !result.target || !result.target.screen) {
        clearTargetDistanceOverlay();
        return;
      }

      const host = ensureTargetDistanceOverlayHost();
      if (!host) return;

      const label = ensureTargetDistanceOverlayLabel(host);
      const targetName = result.target.name || "";
      const offsetX = getTargetDistanceOverlayOffsetX(targetName);
      const text = `${result.stale ? "~" : ""}${formatTargetDistance(result.distance)}`;
      const left = `${Math.round(result.target.screen.x + offsetX)}px`;
      const top = `${Math.round(result.target.screen.y + TARGET_DISTANCE_OVERLAY_OFFSET_Y)}px`;
      const title = `${targetName || "타겟"} / 3D ${formatTargetDistance(result.distance3d)}${result.stale ? " / 마지막 좌표" : ""}`;

      if (label.textContent !== text) label.textContent = text;
      if (label.style.left !== left) label.style.left = left;
      if (label.style.top !== top) label.style.top = top;
      if (label.title !== title) label.title = title;

      TARGET_DISTANCE_STATE.overlayHits++;
      TARGET_DISTANCE_STATE.lastOverlayAt = Date.now();
      TARGET_DISTANCE_STATE.lastOverlayError = "";
    } catch (error) {
      TARGET_DISTANCE_STATE.lastOverlayError = error && error.message ? error.message : String(error);
      clearTargetDistanceOverlay();
    }
  }

  function ensureTargetDistanceOverlayLabel(host) {
    if (TARGET_DISTANCE_STATE.overlayLabel && host.contains(TARGET_DISTANCE_STATE.overlayLabel)) {
      return TARGET_DISTANCE_STATE.overlayLabel;
    }

    const label = document.createElement("div");
    label.className = "hordes-kr-target-distance-label";
    host.replaceChildren(label);
    TARGET_DISTANCE_STATE.overlayLabel = label;
    return label;
  }

  function clearTargetDistanceOverlay() {
    const host = TARGET_DISTANCE_STATE.overlayHost;
    if (host) host.replaceChildren();
    TARGET_DISTANCE_STATE.overlayLabel = null;
  }

  function getTargetDistanceOverlayOffsetX(name) {
    const length = String(name || "").trim().length;
    return clamp(Math.round(length * 4.9 + 30), 48, 160);
  }

  function getTargetDistanceOverlayStatus() {
    const label = TARGET_DISTANCE_STATE.overlayLabel;
    return {
      targetDistance: getTargetDistance(true),
      enabled: isTargetDistanceEnabled(),
      dom: {
        host: Boolean(TARGET_DISTANCE_STATE.overlayHost && document.contains(TARGET_DISTANCE_STATE.overlayHost)),
        label: Boolean(label && document.contains(label)),
        text: label ? label.textContent : "",
        left: label ? label.style.left : "",
        top: label ? label.style.top : "",
        hits: TARGET_DISTANCE_STATE.overlayHits,
        lastAt: TARGET_DISTANCE_STATE.lastOverlayAt
          ? new Date(TARGET_DISTANCE_STATE.lastOverlayAt).toISOString()
          : null,
        lastError: TARGET_DISTANCE_STATE.lastOverlayError,
      },
      canvas: {
        hits: TARGET_DISTANCE_STATE.canvasHits,
        text: TARGET_DISTANCE_STATE.lastCanvasText,
        lastAt: TARGET_DISTANCE_STATE.lastCanvasAt || null,
        targetMatch: TARGET_DISTANCE_STATE.lastCanvasTargetMatch || null,
      },
      lock: getTargetDistanceLockStatus(),
      deepSearchCache: {
        size: TARGET_DISTANCE_STATE.deepSearchCache.size,
        ttlMs: TARGET_DISTANCE_DEEP_SEARCH_CACHE_MS,
      },
      scriptHook: {
        attemptedScripts: [...HIGHLIGHT_STATE.scriptHookAttemptedScripts],
        patchedScripts: [...HIGHLIGHT_STATE.scriptHookPatchedScripts],
        errors: [...HIGHLIGHT_STATE.scriptHookErrors],
      },
      runtime: getExposedRuntimeSummary(),
    };
  }

  function updateMinimapNameOverlay() {
    try {
      const labelsEnabled = Boolean(HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.minimapLabelsEnabled);
      const listEnabled = Boolean(HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.minimapListEnabled);
      const hasHighlightNames = HIGHLIGHT_CONFIG.names.length > 0;
      const listAllHostiles = Boolean(listEnabled && HIGHLIGHT_CONFIG.minimapListAllHostiles);
      if ((!labelsEnabled && !listEnabled) || (!hasHighlightNames && !listAllHostiles)) {
        clearMinimapNameOverlay();
        clearMinimapHighlightList();
        return;
      }

      const host = labelsEnabled && hasHighlightNames ? ensureMinimapNameOverlayHost() : null;
      const listHost = listEnabled ? ensureMinimapHighlightListHost() : null;
      const runtime = getExposedRuntime();
      const context = getMinimapProjectionContext(runtime);
      if ((!host && labelsEnabled && hasHighlightNames) || (!listHost && listEnabled) || !context) {
        clearMinimapNameOverlay();
        clearMinimapHighlightList();
        return;
      }

      const highlightedCandidates = hasHighlightNames
        ? collectRuntimeOverlayEntities(HIGHLIGHT_CONFIG.names, {
            limit: 24,
            maxDepth: 5,
            maxObjects: 3000,
          })
        : [];
      const hostileCandidates = listAllHostiles
        ? collectRuntimeHostilePlayerOverlayEntities(runtime, context, { limit: 80 })
        : [];
      const labelProjected = projectMinimapOverlayCandidates(highlightedCandidates, runtime, context, 16);
      const listProjected = projectMinimapOverlayCandidates(
        listAllHostiles
          ? dedupeRuntimeOverlayCandidates([...highlightedCandidates, ...hostileCandidates])
          : highlightedCandidates,
        runtime,
        context,
        listAllHostiles ? 48 : 16
      );

      if (labelsEnabled) {
        renderMinimapNameOverlayLabels(host, labelProjected);
      } else {
        clearMinimapNameOverlay();
      }

      if (listEnabled) {
        renderMinimapHighlightList(listHost, listProjected, context);
      } else {
        clearMinimapHighlightList();
      }

      HIGHLIGHT_STATE.lastMinimapOverlayMatches = listProjected.slice(0, 10).map((candidate) => ({
        id: String(getRuntimeEntityId(candidate.entity) ?? ""),
        name: candidate.name,
        path: candidate.path,
        position: candidate.position.map(roundCoord),
        minimap: {
          x: roundCoord(candidate.minimap.x),
          y: roundCoord(candidate.minimap.y),
          canvasX: roundCoord(candidate.minimap.canvasX),
          canvasY: roundCoord(candidate.minimap.canvasY),
        },
      }));

      if (listProjected.length > 0 || labelProjected.length > 0) {
        HIGHLIGHT_STATE.minimapOverlayHits += labelProjected.length;
        HIGHLIGHT_STATE.lastMinimapOverlayAt = Date.now();
        HIGHLIGHT_STATE.lastMinimapOverlayError = "";
        if (listEnabled) {
          HIGHLIGHT_STATE.minimapListHits += listProjected.length;
          HIGHLIGHT_STATE.lastMinimapListAt = Date.now();
          HIGHLIGHT_STATE.lastMinimapListError = "";
        }
      }
    } catch (error) {
      HIGHLIGHT_STATE.lastMinimapOverlayError = error && error.message ? error.message : String(error);
      HIGHLIGHT_STATE.lastMinimapListError = HIGHLIGHT_STATE.lastMinimapOverlayError;
      clearMinimapNameOverlay();
      clearMinimapHighlightList();
    }
  }

  function projectMinimapOverlayCandidates(candidates, runtime, context, limit) {
    const projected = [];
    for (const candidate of candidates || []) {
      if (context.self && isSameRuntimeEntity(candidate.entity, context.self.entity)) continue;

      const point = projectRuntimeEntityToMinimap(candidate, runtime, context);
      if (!point) continue;

      projected.push({ ...candidate, minimap: point });
      if (projected.length >= limit) break;
    }
    return projected;
  }

  function renderMinimapNameOverlayLabels(host, candidates) {
    const activeKeys = new Set();
    const now = Date.now();

    for (const candidate of candidates) {
      const id = getRuntimeEntityId(candidate.entity);
      const key = id !== undefined ? `id:${String(id)}` : `${candidate.name}:${candidate.path}`;
      activeKeys.add(key);

      let label = HIGHLIGHT_STATE.minimapOverlayItems.get(key);
      if (!label) {
        label = document.createElement("div");
        label.className = "hordes-kr-minimap-name-label";
        host.appendChild(label);
        HIGHLIGHT_STATE.minimapOverlayItems.set(key, label);
      }

      if (label.dataset.hordesKrName !== candidate.name) {
        label.textContent = candidate.name;
        label.dataset.hordesKrName = candidate.name;
      }

      label.title = `${candidate.name} / id ${String(id ?? "unknown")}`;
      const left = `${Math.round(candidate.minimap.x)}px`;
      const top = `${Math.round(candidate.minimap.y)}px`;
      if (label.style.left !== left) label.style.left = left;
      if (label.style.top !== top) label.style.top = top;
      label.dataset.hordesKrSeenAt = String(now);
    }

    for (const [key, label] of HIGHLIGHT_STATE.minimapOverlayItems.entries()) {
      if (activeKeys.has(key)) continue;
      const seenAt = Number(label.dataset.hordesKrSeenAt) || 0;
      if (now - seenAt < 700) continue;

      label.remove();
      HIGHLIGHT_STATE.minimapOverlayItems.delete(key);
    }
  }

  function renderMinimapHighlightList(host, candidates, context) {
    if (!host || !context || !context.minimap) return;

    const listCandidates = candidates
      .map((candidate) => enrichMinimapListCandidate(candidate, context))
      .filter(Boolean)
      .sort((left, right) => left.distance - right.distance);

    const minimap = context.minimap;
    const scale = getMinimapHighlightListScale();
    const widthNumber = Math.max(Math.round(170 * scale), Math.round(minimap.rect.width * scale));
    const position = getMinimapHighlightListPosition(minimap, widthNumber);
    const leftNumber = position.x;
    const topNumber = position.y;
    const left = `${leftNumber}px`;
    const top = `${topNumber}px`;
    const width = `${widthNumber}px`;
    if (host.style.left !== left) host.style.left = left;
    if (host.style.top !== top) host.style.top = top;
    if (host.style.width !== width) host.style.width = width;
    if (host.style.getPropertyValue("--hordes-kr-minimap-list-scale") !== String(scale)) {
      host.style.setProperty("--hordes-kr-minimap-list-scale", String(scale));
    }

    const lockedId = getLockedTargetId();
    const selectedId = getSelectedTargetIdFromContext(context);

    // Reconcile rows in place (keyed by entity id) instead of rebuilding the
    // whole panel each tick. A full rebuild reset the panel scroll position and
    // destroyed the row under the cursor mid-click (so single clicks were often
    // swallowed) because distance/position values change every frame.
    const { panel, count } = ensureMinimapHighlightListShell(host);
    count.textContent = `${listCandidates.length}`;
    reconcileMinimapHighlightListRows(panel, listCandidates, { lockedId, selectedId });

    HIGHLIGHT_STATE.lastMinimapListMatches = listCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      distance: roundCoord(candidate.distance),
      visualDistance: roundCoord(candidate.visualDistance),
      classId: candidate.classId,
      health: candidate.health,
      path: candidate.path,
      selected: Boolean(candidate.id && candidate.id === selectedId),
      locked: Boolean(candidate.id && candidate.id === lockedId),
      minimap: {
        x: roundCoord(candidate.minimap.x),
        y: roundCoord(candidate.minimap.y),
      },
    }));
  }

  function updatePresetQuickBar() {
    const host = ensurePresetQuickBarHost();
    if (!host) return;

    const widthNumber = Math.max(170, Math.round(host.getBoundingClientRect().width || 180));
    const position = getPresetQuickBarPosition(widthNumber);
    const left = `${position.x}px`;
    const top = `${position.y}px`;
    if (host.style.left !== left) host.style.left = left;
    if (host.style.top !== top) host.style.top = top;

    const combatStatus = getPresetQuickBarCombatStatus();
    const renderKey = [
      left,
      top,
      getQuickGearPresetRenderKey(),
      getQuickSkillPresetRenderKey(),
      combatStatus.key,
    ].join("\u0002");
    if (HIGHLIGHT_STATE.presetBarRenderKey === renderKey) return;
    HIGHLIGHT_STATE.presetBarRenderKey = renderKey;

    const panel = createUiElement("div", "hordes-kr-preset-quickbar-panel");
    panel.append(
      createPresetQuickBarGearControls(combatStatus),
      createPresetQuickBarSkillControls(combatStatus),
      createPresetQuickBarStatus(combatStatus),
      createPresetQuickBarResetButton(),
      createPresetQuickBarDragHandle()
    );
    const stack = createUiElement("div", "hordes-kr-preset-quickbar-stack");
    stack.appendChild(panel);

    host.replaceChildren(stack);
  }

  function getPresetQuickBarPosition(widthNumber) {
    if (Number.isFinite(HIGHLIGHT_CONFIG.presetBarX) && Number.isFinite(HIGHLIGHT_CONFIG.presetBarY)) {
      return clampPresetQuickBarPosition(HIGHLIGHT_CONFIG.presetBarX, HIGHLIGHT_CONFIG.presetBarY, widthNumber);
    }

    const anchor = findFindRateButtonRect();
    if (anchor) {
      return clampPresetQuickBarPosition(anchor.right + 5, anchor.top + Math.max(0, Math.round((anchor.height - 35) / 2)), widthNumber);
    }

    return clampPresetQuickBarPosition(306, 4, widthNumber);
  }

  function findFindRateButtonRect() {
    const candidates = Array.from(document.querySelectorAll(".btnbar .btn, .btn.border.black.textcyan, .textcyan"));
    for (const element of candidates) {
      const text = String(element.innerText || element.textContent || "").trim();
      if (!/\bFIND\b/i.test(text)) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      return rect;
    }

    return null;
  }

  function clampPresetQuickBarPosition(x, y, widthNumber) {
    const viewportWidth = Math.max(320, Number(pageWindow.innerWidth) || 0);
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    const maxX = Math.max(4, viewportWidth - Math.max(60, Number(widthNumber) || 0) - 4);
    const maxY = Math.max(4, viewportHeight - 42);
    return {
      x: Math.round(clamp(Number(x) || 4, 4, maxX)),
      y: Math.round(clamp(Number(y) || 4, 4, maxY)),
    };
  }

  function getPresetQuickBarCombatStatus() {
    const runtime = getExposedRuntime();
    const player = runtime && findLocalPlayerEntity(runtime);
    const entity = player && player.entity || runtime && runtime.player;
    const stats = entity && safeReadValue(entity, "stats");
    const timer = stats && safeReadValue(stats, "combatTimer");
    // combatTimer.end/remaining/done live on the engine clock (I.time, seconds) —
    // that's the exact value the game itself passes (combatTimer.remaining(I.time)).
    // The old code passed runtime.frameTime, which is the rAF timestamp in ms (a
    // different axis), so done() was always true => the bar was stuck on "비전투".
    const engine = runtime && safeReadValue(runtime, "engine");
    const engineTime = Number(engine && safeReadValue(engine, "time"));

    if (!timer || !Number.isFinite(engineTime)) {
      return {
        available: false,
        inCombat: false,
        remaining: null,
        text: "전투 ?",
        className: "unknown",
        key: "unknown",
        title: "전투 상태를 읽지 못했습니다.",
      };
    }

    const remaining = callRuntimeTimerNumber(timer, "remaining", engineTime);
    const done = callRuntimeTimerBoolean(timer, "done", engineTime);
    const inCombat = done === false && (!Number.isFinite(remaining) || remaining > 0);
    const safeRemaining = Number.isFinite(remaining) ? Math.max(0, remaining) : null;
    const text = inCombat
      ? `전투 ${formatPresetQuickBarCombatRemaining(safeRemaining)}`
      : "비전투";

    return {
      available: true,
      inCombat,
      remaining: safeRemaining,
      text,
      className: inCombat ? "combat" : "ready",
      key: `${inCombat ? 1 : 0}:${Number.isFinite(safeRemaining) ? Math.ceil(safeRemaining * 2) / 2 : ""}`,
      title: inCombat
        ? `전투 중에는 프리셋 전환이 불가능합니다. 비전투까지 약 ${formatPresetQuickBarCombatRemaining(safeRemaining)}`
        : "프리셋 전환 가능",
    };
  }

  function callRuntimeTimerNumber(timer, method, frameTime) {
    try {
      const fn = safeReadValue(timer, method);
      if (typeof fn !== "function") return null;

      const value = Number(fn.call(timer, frameTime));
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  function callRuntimeTimerBoolean(timer, method, frameTime) {
    try {
      const fn = safeReadValue(timer, method);
      return typeof fn === "function" ? Boolean(fn.call(timer, frameTime)) : null;
    } catch {
      return null;
    }
  }

  function formatPresetQuickBarCombatRemaining(seconds) {
    if (!Number.isFinite(seconds)) return "?초";
    if (seconds >= 10) return `${Math.ceil(seconds)}초`;
    return `${Math.ceil(seconds * 10) / 10}초`;
  }

  function createPresetQuickBarGearControls(combatStatus) {
    return createPresetQuickBarPresetGroup(
      GEAR_PRESET_QUICK_NAMES,
      (presetName) => getGearQuickPresetButtonConfig(presetName, combatStatus)
    );
  }

  function createPresetQuickBarSkillControls(combatStatus) {
    return createPresetQuickBarPresetGroup(
      SKILL_PRESET_QUICK_NAMES,
      (presetName) => getSkillQuickPresetButtonConfig(presetName, combatStatus)
    );
  }

  function createPresetQuickBarPresetGroup(presetNames, buildConfig) {
    const group = createUiElement("div", "hordes-kr-preset-quickbar-group");

    for (const presetName of presetNames) {
      group.appendChild(createPresetQuickBarPresetButton(buildConfig(presetName)));
    }

    return group;
  }

  function createPresetQuickBarPresetButton(config) {
    const button = createUiButton(config.className, "", "", config.onClick);
    const match = config.match || {};

    button.classList.toggle("empty", config.count === 0);
    button.classList.toggle("running", config.isRunning);
    button.classList.toggle("active", match.complete === true);
    button.classList.toggle("partial", match.complete !== true && Number(match.matched) > 0);
    button.classList.toggle("error", match.complete !== true && config.isLastErrored);
    button.textContent = config.text;
    button.title = config.title;
    button.disabled = config.disabled;
    return button;
  }

  function getGearQuickPresetButtonConfig(presetName, combatStatus) {
    const preset = getGearPreset(presetName);
    const count = preset && Array.isArray(preset.items) ? preset.items.length : 0;
    const match = getGearPresetMatchStatus(presetName);
    const isRunning = GEAR_PRESET_STATE.running && GEAR_PRESET_STATE.pendingPresetName === presetName;
    const isLastRequested = !isRunning && GEAR_PRESET_STATE.lastRequestedPresetName === presetName;
    const isLastErrored = isLastRequested && GEAR_PRESET_STATE.lastResult && (
      (GEAR_PRESET_STATE.lastResult.errors && GEAR_PRESET_STATE.lastResult.errors.length > 0) ||
      (GEAR_PRESET_STATE.lastResult.verify && !GEAR_PRESET_STATE.lastResult.verify.complete)
    );
    const title = count > 0
      ? joinStatusParts([
          `프리셋 ${presetName}`,
          `저장 ${count}개`,
          isRunning ? "전송 중" : "",
          match.complete ? "적용 확인됨" : `장착 확인 ${match.matched}/${match.total}`,
          match.extraEquipped && match.extraEquipped.length > 0 ? `남은 장착 ${match.extraEquipped.length}개` : "",
          isLastErrored ? "최근 실행 불완전/오류" : "",
          combatStatus.inCombat ? combatStatus.title : "",
        ])
      : `프리셋 ${presetName} 저장 없음${combatStatus.inCombat ? ` / ${combatStatus.title}` : ""}`;

    return {
      className: "hordes-kr-preset-quickbar-btn",
      count,
      match,
      isRunning,
      isLastErrored,
      disabled: count === 0 || combatStatus.inCombat || (GEAR_PRESET_STATE.running && !isRunning),
      text: formatPresetQuickBarPresetButtonText(presetName, isRunning, match.complete, isLastErrored),
      title,
      onClick: () => {
        if (combatStatus.inCombat) return;
        runPresetQuickBarAction(() => pageWindow.HordesKrMod.equipGearPreset(presetName));
      },
    };
  }

  function getSkillQuickPresetButtonConfig(presetName, combatStatus) {
    const preset = getSkillPreset(presetName);
    const count = filterConfigurableSkillPresetIds(preset && preset.skillIds || []).length;
    const match = getSkillPresetMatchStatus(presetName);
    const isRunning = SKILL_PRESET_STATE.running && SKILL_PRESET_STATE.pendingPresetName === presetName;
    const isLastRequested = !isRunning && SKILL_PRESET_STATE.lastRequestedPresetName === presetName;
    const isLastErrored = isLastRequested && SKILL_PRESET_STATE.lastResult && (
      (SKILL_PRESET_STATE.lastResult.errors && SKILL_PRESET_STATE.lastResult.errors.length > 0) ||
      (SKILL_PRESET_STATE.lastResult.verify && !SKILL_PRESET_STATE.lastResult.verify.complete)
    );
    const label = `S${presetName}`;
    const title = count > 0
      ? joinStatusParts([
          `스킬 프리셋 ${presetName}`,
          `저장 ${count}포인트`,
          isRunning ? "전송 중" : "",
          match.complete ? "적용 확인됨" : `스킬 확인 ${match.matched}/${match.total}`,
          match.missing && match.missing.length > 0 ? `미적용 ${match.missing.length}포인트` : "",
          match.extra && match.extra.length > 0 ? `추가활성 ${match.extra.length}포인트` : "",
          isLastErrored ? "최근 실행 불완전/오류" : "",
          combatStatus.inCombat ? combatStatus.title : "",
        ])
      : `스킬 프리셋 ${presetName} 저장 없음${combatStatus.inCombat ? ` / ${combatStatus.title}` : ""}`;

    return {
      className: "hordes-kr-preset-quickbar-btn skill",
      count,
      match,
      isRunning,
      isLastErrored,
      disabled: count === 0 || combatStatus.inCombat || (SKILL_PRESET_STATE.running && !isRunning),
      text: formatPresetQuickBarPresetButtonText(label, isRunning, match.complete, isLastErrored),
      title,
      onClick: () => {
        if (combatStatus.inCombat) return;
        runPresetQuickBarAction(() => pageWindow.HordesKrMod.applySkillPreset(presetName));
      },
    };
  }

  function formatPresetQuickBarPresetButtonText(label, isRunning, isComplete, isLastErrored) {
    if (isRunning) return `${label}…`;
    if (isComplete) return `${label}✓`;
    if (isLastErrored) return `${label}!`;
    return label;
  }

  function runPresetQuickBarAction(action) {
    HIGHLIGHT_STATE.presetBarRenderKey = "";
    updatePresetQuickBar();
    Promise.resolve()
      .then(action)
      .finally(refreshPresetQuickBarAndStatus);
    renderStatusUi();
  }

  function refreshPresetQuickBarAndStatus() {
    HIGHLIGHT_STATE.presetBarRenderKey = "";
    updatePresetQuickBar();
    renderStatusUi();
  }

  function runPresetPanelAction(action) {
    refreshPresetQuickBarAndStatus();
    Promise.resolve()
      .then(action)
      .finally(refreshPresetQuickBarAndStatus);
    renderStatusUi();
  }

  function createPresetQuickBarStatus(combatStatus) {
    const status = createUiElement("span", `hordes-kr-preset-quickbar-status ${combatStatus.className || ""}`, combatStatus.text);
    status.title = combatStatus.title;
    return status;
  }

  function createPresetQuickBarResetButton() {
    return createUiButton("hordes-kr-preset-quickbar-reset", "↺", "프리셋 바 위치 리셋", () => {
      resetPresetQuickBarPosition();
    });
  }

  function createPresetQuickBarDragHandle() {
    const handle = createUiElement("span", "hordes-kr-preset-quickbar-drag", "⋮");
    handle.title = "프리셋 바 이동";
    installPresetQuickBarDragHandle(handle);
    return handle;
  }

  function installPresetQuickBarDragHandle(handle) {
    installWindowPointerDrag(handle, {
      getDrag: () => HIGHLIGHT_STATE.presetBarDragging,
      setDrag: (drag) => {
        HIGHLIGHT_STATE.presetBarDragging = drag;
      },
      getSubject: () => HIGHLIGHT_STATE.presetBarHost,
      getWidth: (rect) => getFiniteNumber(rect.width, 180),
      onStart: () => {
        const panel = handle.closest(".hordes-kr-preset-quickbar-panel");
        if (panel) panel.dataset.dragging = "true";
      },
      onMove: handlePresetQuickBarDragMove,
      onEnd: handlePresetQuickBarDragEnd,
    });
  }

  function handlePresetQuickBarDragMove(event) {
    const drag = HIGHLIGHT_STATE.presetBarDragging;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const position = clampPresetQuickBarPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
      drag.width
    );
    HIGHLIGHT_CONFIG.presetBarX = position.x;
    HIGHLIGHT_CONFIG.presetBarY = position.y;
    HIGHLIGHT_STATE.presetBarRenderKey = "";
    applyPresetQuickBarHostPosition(position.x, position.y);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePresetQuickBarDragEnd(event, endedDrag) {
    const drag = endedDrag || HIGHLIGHT_STATE.presetBarDragging;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!endedDrag) HIGHLIGHT_STATE.presetBarDragging = null;

    const host = HIGHLIGHT_STATE.presetBarHost;
    const panel = host && host.querySelector(".hordes-kr-preset-quickbar-panel");
    if (panel) delete panel.dataset.dragging;

    saveHighlightConfig();
    HIGHLIGHT_STATE.presetBarRenderKey = "";
    updatePresetQuickBar();
    event.preventDefault();
    event.stopPropagation();
  }

  function applyPresetQuickBarHostPosition(x, y) {
    const host = HIGHLIGHT_STATE.presetBarHost;
    if (!host) return;

    const left = `${Math.round(x)}px`;
    const top = `${Math.round(y)}px`;
    if (host.style.left !== left) host.style.left = left;
    if (host.style.top !== top) host.style.top = top;
  }

  function resetPresetQuickBarPosition() {
    HIGHLIGHT_CONFIG.presetBarX = null;
    HIGHLIGHT_CONFIG.presetBarY = null;
    HIGHLIGHT_STATE.presetBarRenderKey = "";
    saveHighlightConfig();
    updatePresetQuickBar();
  }

  function createMinimapListScaleButton(label, delta) {
    return createUiButton(
      "hordes-kr-minimap-list-scale-btn",
      label,
      label === "+" ? "강조목록 크게" : "강조목록 작게",
      () => {
        adjustMinimapHighlightListScale(delta);
      }
    );
  }

  function createMinimapListResetButton() {
    return createUiButton("hordes-kr-minimap-list-scale-btn", "↺", "강조목록 위치 리셋", () => {
      resetMinimapHighlightListPosition();
    });
  }

  function createMinimapListAllHostilesButton() {
    const button = createUiButton(
      "hordes-kr-minimap-list-scale-btn",
      "A",
      HIGHLIGHT_CONFIG.minimapListAllHostiles
        ? "주변 적대 유저 전체 표시 중"
        : "강조 ID만 표시 중. 클릭하면 주변 적대 유저 전체 표시",
      () => {
        toggleMinimapHighlightListAllHostiles();
      }
    );
    button.classList.toggle("active", HIGHLIGHT_CONFIG.minimapListAllHostiles === true);
    return button;
  }

  function installMinimapHighlightListDragHandle(handle, host) {
    if (!handle || !host) return;

    installWindowPointerDrag(handle, {
      getDrag: () => HIGHLIGHT_STATE.minimapListDragging,
      setDrag: (drag) => {
        HIGHLIGHT_STATE.minimapListDragging = drag;
      },
      getSubject: () => host,
      canStart: (event) => !isMinimapListControlTarget(event.target),
      getWidth: (rect) => getFiniteNumber(rect.width, getFiniteNumber(parseFloat(host.style.width), 170)),
      onStart: () => {
        host.dataset.hordesKrDragging = "true";
      },
      onMove: handleMinimapHighlightListDragMove,
      onEnd: handleMinimapHighlightListDragEnd,
    });
  }

  function isMinimapListControlTarget(target) {
    return !!(
      target &&
      typeof target.closest === "function" &&
      target.closest(".hordes-kr-minimap-list-title-controls, button, input, textarea, select, a")
    );
  }

  function handleMinimapHighlightListDragMove(event) {
    const drag = HIGHLIGHT_STATE.minimapListDragging;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const position = clampMinimapHighlightListPosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
      drag.width
    );
    HIGHLIGHT_CONFIG.minimapListX = position.x;
    HIGHLIGHT_CONFIG.minimapListY = position.y;
    HIGHLIGHT_STATE.minimapListRenderKey = "";
    applyMinimapHighlightListHostPosition(position.x, position.y);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleMinimapHighlightListDragEnd(event, endedDrag) {
    const drag = endedDrag || HIGHLIGHT_STATE.minimapListDragging;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!endedDrag) HIGHLIGHT_STATE.minimapListDragging = null;

    const host = HIGHLIGHT_STATE.minimapListHost;
    if (host) delete host.dataset.hordesKrDragging;
    saveHighlightConfig();
    HIGHLIGHT_STATE.minimapListRenderKey = "";
    updateMinimapNameOverlay();
    event.preventDefault();
    event.stopPropagation();
  }

  function applyMinimapHighlightListHostPosition(x, y) {
    const host = HIGHLIGHT_STATE.minimapListHost;
    if (!host) return;

    const left = `${Math.round(x)}px`;
    const top = `${Math.round(y)}px`;
    if (host.style.left !== left) host.style.left = left;
    if (host.style.top !== top) host.style.top = top;
  }

  function getQuickGearPresetRenderKey() {
    return [
      GEAR_PRESET_STATE.running ? "running" : "idle",
      ...GEAR_PRESET_QUICK_NAMES.map((presetName) => {
        const preset = getGearPreset(presetName);
        const count = preset && Array.isArray(preset.items) ? preset.items.length : 0;
        const savedAt = preset && preset.savedAt || "";
        const match = getGearPresetMatchStatus(presetName);
        return `${presetName}:${count}:${savedAt}:${match.matched}/${match.total}:${match.complete ? 1 : 0}`;
      }),
    ].join("|");
  }

  function getQuickSkillPresetRenderKey() {
    return [
      SKILL_PRESET_STATE.running ? "running" : "idle",
      ...SKILL_PRESET_QUICK_NAMES.map((presetName) => {
        const preset = getSkillPreset(presetName);
        const count = filterConfigurableSkillPresetIds(preset && preset.skillIds || []).length;
        const savedAt = preset && preset.savedAt || "";
        const match = getSkillPresetMatchStatus(presetName);
        return `${presetName}:${count}:${savedAt}:${match.matched}/${match.total}:${match.complete ? 1 : 0}`;
      }),
    ].join("|");
  }

  function buildMinimapHighlightListRenderKey({ left, top, width, lockedId, selectedId, scale, candidates }) {
    return [
      left,
      top,
      width,
      lockedId || "",
      selectedId || "",
      scale,
      HIGHLIGHT_CONFIG.minimapListAllHostiles ? "all" : "highlight",
      candidates.map((candidate) => [
        candidate.id || "",
        candidate.name || "",
        candidate.distanceText || "",
        candidate.classId ?? "",
        candidate.health ? `${candidate.health.currentText}/${candidate.health.maxText}/${candidate.health.ratio}` : "",
        Math.round(candidate.minimap.x),
        Math.round(candidate.minimap.y),
      ].join(":")).join("\u0001"),
    ].join("\u0002");
  }

  function ensureMinimapHighlightListShell(host) {
    const existing = host.querySelector(".hordes-kr-minimap-list-panel");
    if (existing && existing.__hkrCount) {
      return { panel: existing, count: existing.__hkrCount };
    }

    const panel = createUiElement("div", "hordes-kr-minimap-list-panel");
    const title = createUiElement("div", "hordes-kr-minimap-list-title");
    const titleMain = createUiElement("div", "hordes-kr-minimap-list-title-main");
    const count = createUiElement("span", "hordes-kr-minimap-list-count", "0");
    titleMain.append(count);

    const controls = createUiElement("div", "hordes-kr-minimap-list-title-controls");
    controls.append(
      createMinimapListScaleButton("-", -0.1),
      createMinimapListScaleButton("+", 0.1),
      createMinimapListResetButton(),
      createMinimapListAllHostilesButton()
    );
    title.append(titleMain, controls);
    panel.appendChild(title);
    installMinimapHighlightListDragHandle(title, host);

    panel.__hkrCount = count;
    host.replaceChildren(panel);
    return { panel, count };
  }

  function reconcileMinimapHighlightListRows(panel, candidates, state) {
    const existing = new Map();
    panel.querySelectorAll(".hordes-kr-minimap-list-row").forEach((row) => {
      if (row.dataset.rowKey) existing.set(row.dataset.rowKey, row);
    });

    let empty = panel.querySelector(".hordes-kr-minimap-list-empty");

    if (candidates.length === 0) {
      existing.forEach((row) => row.remove());
      if (!empty) {
        empty = createUiElement("div", "hordes-kr-minimap-list-empty", "감지 없음");
        panel.appendChild(empty);
      }
      return;
    }

    if (empty) empty.remove();

    const usedKeys = new Set();
    candidates.forEach((candidate, index) => {
      const key = candidate.id ? `id:${candidate.id}` : `nm:${candidate.name || ""}:${index}`;
      usedKeys.add(key);
      let row = existing.get(key);
      if (!row) {
        row = createMinimapHighlightListRowShell();
        row.dataset.rowKey = key;
      }
      updateMinimapHighlightListRow(row, candidate, state);
      // appendChild moves the existing node into sorted order (after the title)
      // without recreating it, so its click target and the panel scroll survive.
      panel.appendChild(row);
    });

    existing.forEach((row, key) => {
      if (!usedKeys.has(key)) row.remove();
    });
  }

  function enrichMinimapListCandidate(candidate, context) {
    if (!candidate || !context || !context.selfPosition) return null;

    const id = getRuntimeEntityId(candidate.entity);
    const range = getCorrectedRuntimeRangeDistance(
      context.self.entity,
      candidate.entity,
      context.selfCombatPosition || context.selfPosition,
      {
        position: candidate.position,
        source: candidate.positionSource,
      }
    );
    const distance = range ? range.distance : getHorizontalRuntimeDistance(context.selfPosition.position, candidate.position);
    if (!Number.isFinite(distance)) return null;

    return {
      ...candidate,
      id: id !== undefined ? String(id) : "",
      distance,
      visualDistance: getHorizontalRuntimeDistance(context.selfPosition.position, candidate.position),
      distanceText: `${formatTargetDistance(distance)}m`,
      classId: getRuntimeEntityClassId(candidate.entity),
      classIconUrl: getRuntimeEntityClassIconUrl(candidate.entity),
      health: getRuntimeEntityHealthInfo(candidate.entity),
    };
  }

  function createMinimapHighlightListRowShell() {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "hordes-kr-minimap-list-row";

    const identity = createUiElement("span", "identity");
    const nameLine = createUiElement("span", "name-line");

    const icon = document.createElement("img");
    icon.className = "class-icon";
    icon.alt = "";
    icon.decoding = "async";
    icon.loading = "lazy";
    icon.hidden = true;
    icon.addEventListener("error", () => {
      icon.hidden = true;
    });

    const name = createUiElement("span", "name");

    const health = createUiElement("span", "hp");
    const healthBar = createUiElement("span", "hp-bar");
    const healthFill = createUiElement("span", "hp-fill");
    const healthText = createUiElement("span", "hp-text");
    healthBar.appendChild(healthFill);
    health.append(healthBar, healthText);

    const distance = createUiElement("span", "distance");
    const status = createUiElement("span", "state");

    // Trash button to drop this name from the 강조 list (click or right-click anywhere).
    const del = createUiElement("span", "del-btn");
    del.textContent = "🗑";
    del.setAttribute("role", "button");
    del.title = "강조 ID에서 삭제";

    nameLine.append(icon, name);
    identity.append(nameLine, health);
    row.append(identity, distance, status, del);

    row.__hkrParts = { icon, name, health, healthBar, healthFill, healthText, distance, status, del };

    const dropRowHighlight = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rowName = row.dataset.hordesKrTargetName || "";
      if (!rowName) return;
      try { pageWindow.HordesKrMod.removeHighlightName(rowName); } catch { /* ignore */ }
      try { showGearPresetProgressOverlay(`강조 삭제: ${rowName}`, "running", 1300); } catch { /* toast optional */ }
      refreshNameHighlights();
      updateMinimapNameOverlay();
      updateTargetDistanceOverlay();
      renderStatusUi();
    };
    del.addEventListener("click", dropRowHighlight);
    del.addEventListener("mousedown", (event) => event.stopPropagation()); // don't start a list drag

    row.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // Read identity from the row at click time so reused rows always act on
      // their current candidate, not the one captured when the row was created.
      const id = row.dataset.hordesKrTargetId || "";
      const rowName = row.dataset.hordesKrTargetName || "";
      const result = row.classList.contains("targeted")
        ? pageWindow.HordesKrMod.clearHighlightedTarget()
        : pageWindow.HordesKrMod.targetMinimapHighlight(id, rowName);
      HIGHLIGHT_STATE.lastMinimapTargetResult = result;
      updateMinimapNameOverlay();
      updateTargetDistanceOverlay();
      renderStatusUi();
    });

    // Right-click anywhere on the row also drops it (same as the 🗑 button).
    row.addEventListener("contextmenu", dropRowHighlight);

    return row;
  }

  function updateMinimapHighlightListRow(row, candidate, state) {
    const parts = row.__hkrParts;
    if (!parts) return;

    const selected = Boolean(candidate.id && state.selectedId && candidate.id === state.selectedId);
    const locked = Boolean(candidate.id && state.lockedId && candidate.id === state.lockedId);

    row.classList.toggle("targeted", selected);
    row.classList.toggle("locked", !selected && locked);
    row.classList.toggle("nearby", Number.isFinite(candidate.distance) && candidate.distance <= 35);
    row.dataset.hordesKrTargetId = candidate.id || "";
    row.dataset.hordesKrTargetName = candidate.name || "";
    row.title = getMinimapListRowTitle(candidate, selected);

    const nameText = candidate.name || "unknown";
    if (parts.name.textContent !== nameText) parts.name.textContent = nameText;

    if (candidate.classIconUrl) {
      if (parts.icon.getAttribute("src") !== candidate.classIconUrl) parts.icon.src = candidate.classIconUrl;
      parts.icon.title = `직업 ${candidate.classId}`;
      parts.icon.hidden = false;
    } else {
      parts.icon.hidden = true;
      parts.icon.removeAttribute("src");
    }

    const info = candidate.health;
    if (!info || !Number.isFinite(info.ratio)) {
      parts.health.hidden = true;
    } else {
      parts.health.hidden = false;
      const hpPercent = Math.max(0, Math.min(100, Math.round(info.ratio * 100)));
      parts.healthFill.style.setProperty("width", `${hpPercent > 0 ? Math.max(2, hpPercent) : 0}%`, "important");
      const text = info.maxText ? `${info.currentText}/${info.maxText}` : info.currentText;
      if (parts.healthText.textContent !== text) parts.healthText.textContent = text;
      parts.healthBar.title = `HP ${text}`;
    }

    const distanceText = candidate.distanceText || "-";
    if (parts.distance.textContent !== distanceText) parts.distance.textContent = distanceText;

    const statusText = selected ? "타겟 ON" : locked ? "고정" : "OFF";
    if (parts.status.textContent !== statusText) parts.status.textContent = statusText;
  }

  function getMinimapListRowTitle(candidate, selected) {
    const health = candidate.health;
    return joinStatusParts([
      candidate.name,
      candidate.distanceText,
      health && health.maxText ? `HP ${health.currentText}/${health.maxText}` : "",
      selected ? "클릭하면 타겟 해제" : "클릭하면 실제 타겟 지정",
      "우클릭하면 강조 삭제",
    ]);
  }

  function getLockedTargetId() {
    const locked = TARGET_DISTANCE_STATE.lockedTarget;
    return locked && locked.id ? String(locked.id) : "";
  }

  function getSelectedTargetIdFromContext(context) {
    if (!context || !context.self) return "";

    const runtime = getExposedRuntime();
    const selected = runtime ? getSelectedTargetId(runtime, context.self.entity) : null;
    return selected && selected.id ? String(selected.id) : "";
  }

  function clearMinimapNameOverlay() {
    const host = HIGHLIGHT_STATE.minimapOverlayHost;
    if (host) host.replaceChildren();
    HIGHLIGHT_STATE.minimapOverlayItems.clear();
    HIGHLIGHT_STATE.lastMinimapOverlayMatches = [];
  }

  function clearMinimapHighlightList() {
    const host = HIGHLIGHT_STATE.minimapListHost;
    if (host) host.replaceChildren();
    HIGHLIGHT_STATE.lastMinimapListMatches = [];
    HIGHLIGHT_STATE.minimapListRenderKey = "";
  }

  function getMinimapOverlayStatus() {
    return {
      enabled: HIGHLIGHT_CONFIG.minimapLabelsEnabled,
      installed: !!HIGHLIGHT_STATE.runtimeOverlayTimer,
      host: !!HIGHLIGHT_STATE.minimapOverlayHost,
      labels: HIGHLIGHT_STATE.minimapOverlayItems.size,
      hits: HIGHLIGHT_STATE.minimapOverlayHits,
      lastAt: HIGHLIGHT_STATE.lastMinimapOverlayAt
        ? new Date(HIGHLIGHT_STATE.lastMinimapOverlayAt).toISOString()
        : null,
      lastError: HIGHLIGHT_STATE.lastMinimapOverlayError,
      lastMatches: [...HIGHLIGHT_STATE.lastMinimapOverlayMatches],
      minimap: summarizeRuntimeMinimap(getExposedRuntime()),
    };
  }

  function getMinimapHighlightListStatus() {
    return {
      enabled: HIGHLIGHT_CONFIG.minimapListEnabled,
      allHostiles: HIGHLIGHT_CONFIG.minimapListAllHostiles === true,
      scale: getMinimapHighlightListScale(),
      position: hasCustomMinimapHighlightListPosition()
        ? {
            mode: "custom",
            x: HIGHLIGHT_CONFIG.minimapListX,
            y: HIGHLIGHT_CONFIG.minimapListY,
          }
        : { mode: "default" },
      host: !!HIGHLIGHT_STATE.minimapListHost,
      hits: HIGHLIGHT_STATE.minimapListHits,
      lastAt: HIGHLIGHT_STATE.lastMinimapListAt
        ? new Date(HIGHLIGHT_STATE.lastMinimapListAt).toISOString()
        : null,
      lastError: HIGHLIGHT_STATE.lastMinimapListError,
      lastMatches: [...HIGHLIGHT_STATE.lastMinimapListMatches],
      lastTargetResult: HIGHLIGHT_STATE.lastMinimapTargetResult,
    };
  }

  function normalizeOptionalScreenCoordinate(value) {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function clearInvalidDefaultScreenCoordinatePair(config, xKey, yKey) {
    if (!config) return;

    const x = config[xKey];
    const y = config[yKey];
    if ((x === 0 && y === 0) || (x === 4 && y === 4)) {
      config[xKey] = null;
      config[yKey] = null;
    }
  }

  function hasCustomMinimapHighlightListPosition() {
    return (
      Number.isFinite(HIGHLIGHT_CONFIG.minimapListX) &&
      Number.isFinite(HIGHLIGHT_CONFIG.minimapListY)
    );
  }

  function getMinimapHighlightListPosition(minimap, widthNumber) {
    if (hasCustomMinimapHighlightListPosition()) {
      const position = clampMinimapHighlightListPosition(
        HIGHLIGHT_CONFIG.minimapListX,
        HIGHLIGHT_CONFIG.minimapListY,
        widthNumber
      );
      HIGHLIGHT_CONFIG.minimapListX = position.x;
      HIGHLIGHT_CONFIG.minimapListY = position.y;
      return position;
    }

    return getDefaultMinimapHighlightListPosition(minimap, widthNumber);
  }

  function getDefaultMinimapHighlightListPosition(minimap, widthNumber) {
    const rightEdge = Math.round(minimap.rect.left + minimap.rect.width);
    return {
      x: Math.max(4, rightEdge - widthNumber),
      y: Math.round(minimap.rect.top + minimap.rect.height + 5),
    };
  }

  function clampMinimapHighlightListPosition(x, y, widthNumber) {
    const host = HIGHLIGHT_STATE.minimapListHost;
    const hostRect = host ? host.getBoundingClientRect() : null;
    const hostHeight = hostRect && hostRect.height > 0 ? hostRect.height : 42;
    const viewportWidth = Math.max(320, Number(pageWindow.innerWidth) || 0);
    const viewportHeight = Math.max(240, Number(pageWindow.innerHeight) || 0);
    const maxX = Math.max(4, Math.round(viewportWidth - Math.max(36, Number(widthNumber) || 0) - 4));
    const maxY = Math.max(4, Math.round(viewportHeight - Math.min(hostHeight, viewportHeight - 8) - 4));

    return {
      x: Math.round(clamp(Number(x) || 4, 4, maxX)),
      y: Math.round(clamp(Number(y) || 4, 4, maxY)),
    };
  }

  function resetMinimapHighlightListPosition() {
    HIGHLIGHT_CONFIG.minimapListX = null;
    HIGHLIGHT_CONFIG.minimapListY = null;
    HIGHLIGHT_STATE.minimapListRenderKey = "";
    saveHighlightConfig();
    updateMinimapNameOverlay();
    return getMinimapHighlightListStatus();
  }

  function toggleMinimapHighlightListAllHostiles() {
    HIGHLIGHT_CONFIG.minimapListAllHostiles = !HIGHLIGHT_CONFIG.minimapListAllHostiles;
    HIGHLIGHT_STATE.minimapListRenderKey = "";
    saveHighlightConfig();
    updateMinimapNameOverlay();
    return getMinimapHighlightListStatus();
  }

  function normalizeMinimapHighlightListScale(scale) {
    const numericScale = Number(scale);
    const fallback = Number.isFinite(numericScale) && numericScale > 0
      ? numericScale
      : MINIMAP_LIST_DEFAULT_SCALE;
    return Math.max(MINIMAP_LIST_MIN_SCALE, Math.round(fallback * 100) / 100);
  }

  function applyMinimapListScaleDefaultMigration() {
    try {
      if (localStorage.getItem(MINIMAP_LIST_SCALE_DEFAULT_VERSION_KEY) === MINIMAP_LIST_SCALE_DEFAULT_VERSION) return;

      if (HIGHLIGHT_CONFIG.minimapListScale < MINIMAP_LIST_DEFAULT_SCALE) {
        HIGHLIGHT_CONFIG.minimapListScale = MINIMAP_LIST_DEFAULT_SCALE;
        saveHighlightConfig();
      }

      localStorage.setItem(MINIMAP_LIST_SCALE_DEFAULT_VERSION_KEY, MINIMAP_LIST_SCALE_DEFAULT_VERSION);
    } catch {
      // Storage may be unavailable; the normalized runtime default still applies.
    }
  }

  function getMinimapHighlightListScale() {
    return normalizeMinimapHighlightListScale(HIGHLIGHT_CONFIG.minimapListScale);
  }

  function setMinimapHighlightListScale(scale) {
    HIGHLIGHT_CONFIG.minimapListScale = normalizeMinimapHighlightListScale(scale);
    saveHighlightConfig();
    HIGHLIGHT_STATE.minimapListRenderKey = "";
    updateMinimapNameOverlay();
    return HIGHLIGHT_CONFIG.minimapListScale;
  }

  function adjustMinimapHighlightListScale(delta) {
    return setMinimapHighlightListScale(getMinimapHighlightListScale() + Number(delta || 0));
  }

  function getMinimapProjectionContext(runtime) {
    if (!runtime) return null;

    const minimap = getRuntimeMinimapState(runtime);
    if (!minimap) return null;

    const self = findLocalPlayerEntity(runtime);
    if (!self) return null;

    const selfPosition = getRuntimeWorldPosition(self.entity);
    if (!selfPosition) return null;

    return {
      minimap,
      self,
      selfPosition,
      selfCombatPosition: getRuntimeCombatPosition(self.entity) || selfPosition,
    };
  }

  function getRuntimeMinimapState(runtime) {
    const minimap = runtime && isRuntimeObject(runtime.minimap) ? runtime.minimap : {};
    const canvas = getRuntimeMinimapCanvas(minimap);
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    const canvasWidth = getFiniteNumber(canvas.width, getFiniteNumber(safeReadValue(minimap, "width"), 200));
    const canvasHeight = getFiniteNumber(canvas.height, getFiniteNumber(safeReadValue(minimap, "height"), 200));
    return {
      canvas,
      rect,
      canvasWidth,
      canvasHeight,
      scale: getFiniteNumber(safeReadValue(minimap, "scale"), MINIMAP_DEFAULT_SCALE),
      offsetX: getFiniteNumber(safeReadValue(minimap, "offsetX"), 0),
      offsetY: getFiniteNumber(safeReadValue(minimap, "offsetY"), 0),
      enlarged: Boolean(safeReadValue(minimap, "enlarged")),
    };
  }

  function getRuntimeMinimapCanvas(minimap) {
    const runtimeCanvas = minimap && safeReadValue(minimap, "canvas");
    if (isVisibleCanvasElement(runtimeCanvas)) return runtimeCanvas;

    return Array.from(document.querySelectorAll("#minimapcontainer canvas.minimap, canvas.minimap"))
      .find(isVisibleCanvasElement) || null;
  }

  function summarizeRuntimeMinimap(runtime) {
    const minimap = getRuntimeMinimapState(runtime);
    if (!minimap) {
      return {
        available: false,
      };
    }

    return {
      available: true,
      scale: roundCoord(minimap.scale),
      offsetX: roundCoord(minimap.offsetX),
      offsetY: roundCoord(minimap.offsetY),
      enlarged: minimap.enlarged,
      canvas: {
        width: Math.round(minimap.canvasWidth),
        height: Math.round(minimap.canvasHeight),
        left: Math.round(minimap.rect.left),
        top: Math.round(minimap.rect.top),
        clientWidth: Math.round(minimap.rect.width),
        clientHeight: Math.round(minimap.rect.height),
      },
    };
  }

  function projectRuntimeEntityToMinimap(candidate, runtime, context) {
    const projection = context || getMinimapProjectionContext(runtime);
    if (!projection) return null;

    const { minimap, selfPosition } = projection;
    const position = Array.isArray(candidate.position)
      ? candidate.position
      : (getRuntimeWorldPosition(candidate.entity) || {}).position;
    if (!position || position.length < 3) return null;

    const centerX = Number(selfPosition.position[0]) + minimap.offsetX;
    const centerZ = Number(selfPosition.position[2]) + minimap.offsetY;
    const worldRange = (minimap.scale < 0.4 ? 16 : 4) * 64;
    const pixelRange = minimap.scale * 64;
    const canvasX = minimap.canvasWidth / 2 + ((Number(position[0]) - centerX) / worldRange) * pixelRange;
    const canvasY = minimap.canvasHeight / 2 + ((Number(position[2]) - centerZ) / worldRange) * pixelRange;

    if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) return null;
    if (canvasX < -50 || canvasY < -50 || canvasX > minimap.canvasWidth + 50 || canvasY > minimap.canvasHeight + 50) {
      return null;
    }

    const clampedX = Math.min(minimap.canvasWidth - 3, Math.max(0, canvasX));
    const clampedY = Math.min(minimap.canvasHeight - 3, Math.max(0, canvasY));
    return {
      x: minimap.rect.left + clampedX * (minimap.rect.width / minimap.canvasWidth),
      y: minimap.rect.top + clampedY * (minimap.rect.height / minimap.canvasHeight),
      canvasX: clampedX,
      canvasY: clampedY,
      source: "runtime.entities",
    };
  }

  function getMinimapEntityReport(options) {
    const runtime = getExposedRuntime();
    const context = getMinimapProjectionContext(runtime);
    const entities = collectLoadedRuntimeEntities(runtime, options);
    const projected = [];

    for (const item of entities.items) {
      const point = context ? projectRuntimeEntityToMinimap(item, runtime, context) : null;
      if (point) projected.push({ ...item, minimap: point });
    }

    return {
      available: Boolean(runtime && context),
      minimap: summarizeRuntimeMinimap(runtime),
      totalLoaded: entities.items.length,
      projectedCount: projected.length,
      items: projected.map(summarizeRuntimeEntityForReport),
    };
  }

  function getLoadedEntityReport(options) {
    const runtime = getExposedRuntime();
    const entities = collectLoadedRuntimeEntities(runtime, options);
    return {
      available: Boolean(runtime),
      totalLoaded: entities.items.length,
      items: entities.items.map(summarizeRuntimeEntityForReport),
    };
  }

  function getIncomingTargetReport(options) {
    const runtime = getExposedRuntime();
    if (!runtime) {
      return {
        available: false,
        reason: "런타임을 찾지 못했습니다.",
        targetingMe: [],
        players: [],
        all: [],
      };
    }

    const self = findLocalPlayerEntity(runtime);
    if (!self) {
      return {
        available: false,
        reason: "내 캐릭터 객체를 찾지 못했습니다.",
        targetingMe: [],
        players: [],
        all: [],
      };
    }

    const scanOptions = normalizeEntityReportOptions(options);
    const entities = collectLoadedRuntimeEntities(runtime, {
      ...scanOptions,
      playersOnly: false,
      limit: scanOptions.limit || 900,
    });
    const all = [];

    for (const item of entities.items) {
      if (isSameRuntimeEntity(item.entity, self.entity)) continue;

      const targetInfo = getRuntimeEntityTargetInfo(item.entity, runtime, self.entity);
      if (!targetInfo.targetsSelf) continue;

      const relation = getRuntimeEntityRelation(item.entity, self.entity);
      all.push({
        ...summarizeRuntimeEntityForReport(item),
        relation,
        target: targetInfo.target,
        targetFields: targetInfo.activeFields,
      });
    }

    const players = all.filter((item) => item.type === 0);
    return {
      available: true,
      self: summarizeIncomingTargetSelf(self),
      count: all.length,
      playerCount: players.length,
      targetingMe: all,
      players,
      all,
      note: all.length > 0
        ? "현재 런타임 target 필드가 내 캐릭터 id를 가리키는 엔티티입니다."
        : "현재 로드된 엔티티 중 내 캐릭터 id를 target으로 들고 있는 대상은 없습니다.",
    };
  }

  function getTargetFieldReport(options) {
    const runtime = getExposedRuntime();
    const self = runtime ? findLocalPlayerEntity(runtime) : null;
    const scanOptions = normalizeEntityReportOptions(options);
    const entities = collectLoadedRuntimeEntities(runtime, {
      ...scanOptions,
      limit: scanOptions.limit || 120,
    });
    const items = [];

    for (const item of entities.items) {
      const targetInfo = getRuntimeEntityTargetInfo(item.entity, runtime, self && self.entity);
      if (!targetInfo.hasTargetField) continue;

      items.push({
        ...summarizeRuntimeEntityForReport(item),
        targetsSelf: targetInfo.targetsSelf,
        activeTarget: targetInfo.target,
        fields: targetInfo.fields,
      });
    }

    return {
      available: Boolean(runtime),
      self: self ? summarizeIncomingTargetSelf(self) : null,
      totalLoaded: entities.items.length,
      withTargetFields: items.length,
      items,
    };
  }

  function summarizeIncomingTargetSelf(self) {
    return {
      id: String(getRuntimeEntityId(self.entity) ?? ""),
      name: getRuntimeEntityLabel(self.entity),
      path: self.path || "",
    };
  }

  function getRuntimeEntityTargetInfo(entity, runtime, selfEntity) {
    const fields = [];
    const activeFields = [];
    const seenFieldKeys = new Set();
    let target = null;
    let targetsSelf = false;

    const addField = (field) => {
      if (!field) return;
      const fieldKey = `${String(field.key || "")}|${String(field.id || "")}|${field.targetsSelf ? "self" : ""}`;
      if (seenFieldKeys.has(fieldKey)) return;
      seenFieldKeys.add(fieldKey);
      fields.push(field);

      if (!field.active) return;
      activeFields.push(field);
      if (!target) target = field;
      if (field.targetsSelf) targetsSelf = true;
    };

    for (const key of getRuntimeTargetFieldKeys(entity)) {
      const raw = safeReadValue(entity, key);
      addField(parseRuntimeTargetField(key, raw, runtime, selfEntity));
    }

    for (const field of getRuntimeSkillTargetFields(entity, runtime, selfEntity)) {
      addField(field);
      if (field && field.active && field.targetsSelf) target = field;
    }

    for (const field of getRuntimeNestedTargetFields(entity, runtime, selfEntity)) {
      addField(field);
      if (field && field.active && field.targetsSelf && (!target || !target.targetsSelf)) target = field;
    }

    return {
      hasTargetField: fields.length > 0,
      targetsSelf,
      target,
      fields,
      activeFields,
    };
  }

  function getRuntimeSkillTargetFields(entity, runtime, selfEntity) {
    const skills = safeReadValue(entity, "skills");
    if (!isRuntimeObject(skills)) return [];

    const fields = [];
    const timedTarget = safeReadValue(skills, "timedTarget");
    const timedField = parseRuntimeTargetField("skills.timedTarget", timedTarget, runtime, selfEntity);
    timedField.skill = summarizeRuntimeTimedSkill(skills, runtime);
    fields.push(timedField);

    for (const key of ["castTarget", "castingTarget", "currentTarget", "queuedTarget"]) {
      const raw = safeReadValue(skills, key);
      if (raw === undefined) continue;

      const field = parseRuntimeTargetField(`skills.${key}`, raw, runtime, selfEntity);
      field.skill = summarizeRuntimeTimedSkill(skills, runtime);
      fields.push(field);
    }

    return fields;
  }

  function getRuntimeNestedTargetFields(entity, runtime, selfEntity) {
    if (!isRuntimeObject(entity)) return [];

    const fields = [];
    const queue = [{ value: entity, path: "", depth: 0 }];
    const seen = new WeakSet();
    const seenFields = new Set();
    let visited = 0;

    for (
      let cursor = 0;
      cursor < queue.length && visited < INCOMING_TARGET_WATCH_NESTED_SCAN_OBJECTS;
      cursor++
    ) {
      const item = queue[cursor];
      const value = item.value;
      if (!isRuntimeTraversable(value, item.path || "entity") || seen.has(value)) continue;

      seen.add(value);
      visited++;

      const keys = safeOwnKeys(value).slice(0, INCOMING_TARGET_WATCH_NESTED_CHILD_LIMIT);
      for (const key of keys) {
        if (shouldSkipRuntimeTargetWatchTraversalKey(key, item.path)) continue;

        const path = item.path ? `${item.path}.${key}` : key;
        const raw = safeReadValue(value, key);
        if (isRuntimeTargetWatchFieldPath(path, raw)) {
          const field = parseRuntimeTargetField(path, raw, runtime, selfEntity);
          const fieldKey = `${field.key}|${String(field.id || "")}|${field.targetsSelf ? "self" : ""}`;
          if (!seenFields.has(fieldKey)) {
            seenFields.add(fieldKey);
            fields.push(field);
          }
        }

        if (item.depth >= INCOMING_TARGET_WATCH_NESTED_SCAN_DEPTH) continue;
        if (!isRuntimeTraversable(raw, path)) continue;
        queue.push({ value: raw, path, depth: item.depth + 1 });
      }
    }

    return fields;
  }

  function isRuntimeTargetWatchFieldPath(path, raw) {
    const key = String(path || "").split(".").pop() || "";
    if (!isRuntimeWatchTargetFieldKey(key)) return false;
    if (raw === undefined || raw === null || raw === "" || raw === false || raw === 0 || raw === "0") return false;
    if (isRuntimeObject(raw)) return Boolean(getRuntimeWorldPosition(raw) || getRuntimeEntityId(raw) !== undefined);
    return Boolean(normalizeRuntimeEntityId(raw));
  }

  function shouldSkipRuntimeTargetWatchTraversalKey(key, path) {
    const normalized = String(key || "");
    const lower = normalized.toLowerCase();
    if (!normalized) return true;
    if (normalized.startsWith("_") && !isRuntimeTargetWatchContainerKey(normalized)) return true;
    if (path === "" && lower === "skills") return true;
    if (/^(parent|root|scene|mesh|geometry|material|children|dom|element|canvas|texture|sprite|model|object3d)$/i.test(normalized)) return true;
    if (/^(history|log|logs|cache|pool|buffer|buffers|queue|queues|listeners|events)$/i.test(normalized)) return true;
    if (/interiorlight|targetmode|targettimer/i.test(normalized)) return true;
    return false;
  }

  function isRuntimeTargetWatchContainerKey(key) {
    const normalized = String(key || "").replace(/^_+/, "");
    return /target|selected|focus|attack|enemy|combat|controller|selection|targeting|state/i.test(normalized);
  }

  function summarizeRuntimeTimedSkill(skills, runtime) {
    const timedSkill = safeReadValue(skills, "timedSkill");
    const timedCast = safeReadValue(skills, "timedCast");

    return {
      id: safeReadValue(timedSkill, "id") ?? "",
      name: safeReadValue(timedSkill, "name") || "",
      active: isRuntimeTimedCastActive(timedCast, runtime),
      remaining: getRuntimeTimedCastRemaining(timedCast, runtime),
    };
  }

  function isRuntimeTimedCastActive(timedCast, runtime) {
    if (!isRuntimeObject(timedCast)) return false;

    const start = Number(safeReadValue(timedCast, "start"));
    const end = Number(safeReadValue(timedCast, "end"));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const now = getRuntimeCastClock(runtime);
      if (!Number.isFinite(now)) return true;
      return now >= start - 0.15 && now <= end + 0.25;
    }

    const duration = Number(safeReadValue(timedCast, "duration"));
    return Number.isFinite(duration) && duration > 0;
  }

  function getRuntimeTimedCastRemaining(timedCast, runtime) {
    if (!isRuntimeObject(timedCast)) return null;

    const end = Number(safeReadValue(timedCast, "end"));
    const now = getRuntimeCastClock(runtime);
    if (!Number.isFinite(end) || !Number.isFinite(now)) return null;

    return Math.max(0, end - now);
  }

  function getRuntimeCastClock(runtime) {
    const engine = runtime && safeReadValue(runtime, "engine");
    const engineTime = Number(engine && safeReadValue(engine, "time"));
    if (Number.isFinite(engineTime)) return engineTime;

    const runtimeTime = Number(runtime && safeReadValue(runtime, "time"));
    return Number.isFinite(runtimeTime) ? runtimeTime : null;
  }

  function getRuntimeTargetFieldKeys(entity) {
    if (!isRuntimeObject(entity)) return [];

    const baseKeys = [
      "target",
      "targetId",
      "targetUnit",
      "targetUnitId",
      "targetEntity",
      "targetEntityId",
      "selectedTarget",
      "selectedTargetId",
      "selectedEntity",
      "selectedEntityId",
      "currentTarget",
      "currentTargetId",
      "attackTarget",
      "attackTargetId",
      "focusTarget",
      "focusTargetId",
      "enemyTarget",
      "enemyTargetId",
      "aggroTarget",
      "aggroTargetId",
      "combatTarget",
      "combatTargetId",
    ];
    const dynamicKeys = safeOwnKeys(entity).filter((key) => (
      /target|selected|focus|attack|aggro|enemy|combat/i.test(key) &&
      !/interiorlight|targetMode|targetTimer/i.test(key)
    ));

    return uniqueRuntimeStrings([...baseKeys, ...dynamicKeys])
      .filter((key) => {
        try {
          return key in entity;
        } catch {
          return false;
        }
      });
  }

  function parseRuntimeTargetField(key, raw, runtime, selfEntity) {
    const id = normalizeRuntimeEntityId(raw);
    const selfId = normalizeRuntimeEntityId(getRuntimeEntityId(selfEntity));
    let resolved = null;
    let targetEntity = null;

    if (id) {
      resolved = findRuntimeEntityById(runtime, id, null);
      targetEntity = resolved && resolved.entity;
    } else if (isRuntimeObject(raw) && getRuntimeWorldPosition(raw)) {
      targetEntity = raw;
    }

    const targetId = targetEntity
      ? normalizeRuntimeEntityId(getRuntimeEntityId(targetEntity))
      : id;
    const targetName = targetEntity ? getRuntimeEntityLabel(targetEntity) : "";
    const targetsSelf = Boolean(
      selfEntity &&
      (
        (targetEntity && isSameRuntimeEntity(targetEntity, selfEntity)) ||
        (selfId && targetId && targetId === selfId)
      )
    );

    return {
      key,
      raw: summarizeRuntimeTargetRaw(raw),
      active: Boolean(targetId || targetEntity),
      id: targetId || "",
      name: targetName,
      resolved: Boolean(targetEntity),
      path: resolved ? resolved.path : "",
      targetsSelf,
    };
  }

  function summarizeRuntimeTargetRaw(raw) {
    if (raw === null || raw === undefined || raw === "" || raw === false || raw === 0 || raw === "0") return raw;
    if (!isRuntimeObject(raw)) return raw;

    return {
      type: Object.prototype.toString.call(raw).replace(/^\[object |\]$/g, ""),
      id: String(getRuntimeEntityId(raw) ?? ""),
      name: getRuntimeNameValueLoose(raw),
      keys: safeOwnKeys(raw).slice(0, 16),
    };
  }

  function uniqueRuntimeStrings(values) {
    const seen = new Set();
    const result = [];

    values.forEach((value) => {
      const text = String(value || "");
      if (!text || seen.has(text)) return;

      seen.add(text);
      result.push(text);
    });

    return result;
  }

  function collectLoadedRuntimeEntities(runtime, options = {}) {
    const normalizedOptions = normalizeEntityReportOptions(options);
    const limit = clamp(Number(normalizedOptions.limit) || 300, 1, 1200);
    const items = [];
    const seenObjects = new WeakSet();
    const seenIds = new Set();

    const add = (entity, path) => {
      if (items.length >= limit || !isRuntimeObject(entity)) return;
      if (seenObjects.has(entity)) return;
      seenObjects.add(entity);

      const positionInfo = getRuntimeWorldPosition(entity);
      if (!positionInfo) return;

      const id = getRuntimeEntityId(entity);
      const idKey = id !== undefined ? String(id) : "";
      if (idKey && seenIds.has(idKey)) return;
      if (idKey) seenIds.add(idKey);

      const type = getRuntimeEntityType(entity);
      if (normalizedOptions.playersOnly && type !== 0) return;

      const name = getRuntimeEntityLabel(entity);
      const highlighted = Boolean(getMatchingHighlightName(name));
      if (normalizedOptions.highlightedOnly && !highlighted) return;

      items.push({
        entity,
        path,
        id: idKey,
        name,
        type,
        highlighted,
        position: positionInfo.position,
        positionSource: positionInfo.source,
      });
    };

    if (!runtime) return { items };

    add(runtime.player, "runtime.player");
    add(runtime.target, "runtime.target");

    const engine = safeReadValue(runtime, "engine");
    add(safeReadValue(engine, "player"), "runtime.engine.player");
    add(safeReadValue(engine, "target"), "runtime.engine.target");

    const entities = safeReadValue(engine, "entities");
    scanRuntimeEntityCollection(safeReadValue(entities, "array"), "runtime.engine.entities.array", add, limit);
    scanRuntimeEntityCollection(safeReadValue(entities, "map"), "runtime.engine.entities.map", add, limit);

    return { items };
  }

  function normalizeEntityReportOptions(options) {
    if (options === true) return { playersOnly: true };
    return isObject(options) ? options : {};
  }

  function summarizeRuntimeEntityForReport(item) {
    const summary = {
      id: item.id || "",
      name: item.name || "",
      type: item.type,
      highlighted: Boolean(item.highlighted),
      path: item.path || "",
      position: Array.isArray(item.position) ? item.position.map(roundCoord) : null,
      positionSource: item.positionSource || "",
    };

    if (item.minimap) {
      summary.minimap = {
        x: roundCoord(item.minimap.x),
        y: roundCoord(item.minimap.y),
        canvasX: roundCoord(item.minimap.canvasX),
        canvasY: roundCoord(item.minimap.canvasY),
      };
    }

    return summary;
  }

  function getRuntimeEntityRelation(entity, selfEntity) {
    const entityType = getRuntimeEntityType(entity);
    const selfType = getRuntimeEntityType(selfEntity);
    const faction = normalizeRuntimeTeamValue(safeReadValue(entity, "faction"));
    const selfFaction = normalizeRuntimeTeamValue(safeReadValue(selfEntity, "faction"));
    const party = normalizeRuntimeGroupValue(safeReadValue(entity, "party"));
    const selfParty = normalizeRuntimeGroupValue(safeReadValue(selfEntity, "party"));
    const clan = normalizeRuntimeClanValue(safeReadValue(entity, "clan"));
    const selfClan = normalizeRuntimeClanValue(safeReadValue(selfEntity, "clan"));
    const sameEntity = isSameRuntimeEntity(entity, selfEntity);
    const bothPlayers = entityType === 0 && selfType === 0;
    const sameParty = bothPlayers && party !== "" && selfParty !== "" && party === selfParty;
    const sameFaction = bothPlayers && faction !== "" && selfFaction !== "" && faction === selfFaction;
    const sameClan = bothPlayers && clan !== "" && selfClan !== "" && clan.toLowerCase() === selfClan.toLowerCase();
    const hostile = bothPlayers && faction !== "" && selfFaction !== "" && faction !== selfFaction;
    const friendly = sameEntity || sameParty || sameFaction;

    return {
      type: friendly ? "friendly" : hostile ? "hostile" : "neutral",
      friendly,
      hostile,
      sameParty,
      sameFaction,
      sameClan,
      faction,
      party,
      clan,
      selfFaction,
      selfParty,
      selfClan,
    };
  }

  function normalizeRuntimeTeamValue(value) {
    if (value === null || value === undefined || value === "" || value === false) return "";

    const number = Number(value);
    if (Number.isFinite(number)) return number === 0 ? "0" : String(Math.trunc(number));

    return String(value);
  }

  function normalizeRuntimeGroupValue(value) {
    const normalized = normalizeRuntimeTeamValue(value);
    return normalized === "0" ? "" : normalized;
  }

  function normalizeRuntimeClanValue(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function getRuntimeEntityType(entity) {
    const type = Number(safeReadValue(entity, "type"));
    return Number.isFinite(type) ? type : null;
  }

  function getFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function readEntityTargetId(entity) {
    try {
      const t = entity && entity.target;
      if (typeof t === "number") return t;
      if (t && typeof t === "object" && typeof t.id === "number") return t.id;
    } catch {
      // unreadable mid-transition
    }
    return null;
  }

  function entityHpFraction(entity) {
    try {
      const stats = entity && entity.stats;
      if (stats && typeof stats.getResource === "function" && typeof stats.getStat === "function") {
        const max = stats.getStat(6);
        if (max > 0) return stats.getResource(6) / max;
      }
    } catch {
      // stats unreadable
    }
    return -1;
  }

  // Fast incoming-warning scan. The engine's entity list (engine.entities.array)
  // carries the authoritative `target` (entity id) and `skills.timedTarget/timedCast`
  // fields, so one flat pass answers both "who targets me" and "who casts at me" —
  // no reflection BFS. Verified live: a full scan costs ~0.002ms for ~100 entities.
  // Returns null when the engine list is unavailable so the caller can fall back to
  // the legacy deep scan.
  function collectIncomingWarningOverlayEntitiesFast(runtime, self, selfPosition, wantsSkill, wantsWatch) {
    const engine = runtime && runtime.engine;
    const arr = engine && engine.entities && engine.entities.array;
    if (!arr || typeof arr.length !== "number" || arr.length === 0) return null;
    const myId = getRuntimeEntityId(self.entity);
    if (myId === undefined || myId === null) return null;

    const engineTime = typeof engine.time === "number" ? engine.time : null;
    const skills = [];
    const watches = [];
    const watcherIds = new Set();
    const watcherNames = [];
    let mobAggro = 0;

    for (let index = 0; index < arr.length; index++) {
      const entity = arr[index];
      if (!entity || entity.id === myId) continue;

      const targetsMe = readEntityTargetId(entity) === myId;

      // mob aggro count for the threat HUD (any living non-player aiming at me)
      if (targetsMe && entity.type === 1 && entityHpFraction(entity) > 0) mobAggro++;

      const isPlayer = entity.type === 0;
      if (!isPlayer && !targetsMe) continue;

      let relation = null;
      const needRelation = (wantsWatch && isPlayer && targetsMe) || wantsSkill;
      if (!needRelation) continue;

      // casting at me? (cheap field reads — only escalate when there is a live cast)
      let castAtMe = null;
      if (wantsSkill) {
        try {
          const entitySkills = entity.skills;
          const timedSkill = entitySkills && entitySkills.timedSkill;
          if (timedSkill && timedSkill.id != null) {
            const timedCast = entitySkills.timedCast;
            const castLive = timedCast && (engineTime === null || engineTime <= Number(timedCast.end) + 0.2);
            const timedTargetId = (() => {
              const t = entitySkills.timedTarget;
              if (typeof t === "number") return t;
              return t && typeof t === "object" && typeof t.id === "number" ? t.id : null;
            })();
            if (castLive && timedTargetId === myId) {
              castAtMe = {
                id: timedSkill.id,
                remaining: timedCast && engineTime !== null ? Math.max(0, Number(timedCast.end) - engineTime) : null,
              };
            }
          }
        } catch {
          castAtMe = null;
        }
      }

      const wantThisWatch = wantsWatch && isPlayer && targetsMe;
      if (!wantThisWatch && !castAtMe) continue;

      relation = getRuntimeEntityRelation(entity, self.entity);
      if (relation.friendly) continue;

      const positionInfo = getRuntimeWorldPosition(entity);
      if (!positionInfo) continue;
      const distance = getHorizontalRuntimeDistance(selfPosition.position, positionInfo.position);
      const name = String(entity.name || "");

      if (castAtMe) {
        const skillId = normalizeSkillIconId(castAtMe.id);
        skills.push({
          entity,
          path: `engine.entities.array[${index}]`,
          name,
          matchedName: name.toLowerCase(),
          position: positionInfo.position,
          positionSource: positionInfo.source,
          score: 1000 + (isPlayer ? 120 : 0),
          incomingSkill: true,
          relation,
          skillId,
          skillIconUrl: skillId ? getSkillIconUrl(skillId) : "",
          skillTargetField: "skills.timedTarget",
          skillRemaining: castAtMe.remaining,
          distance,
          distanceText: Number.isFinite(distance) ? `${formatTargetDistance(distance)}m` : "",
        });
      }

      if (wantThisWatch) {
        watcherIds.add(entity.id);
        if (watcherNames.length < 8) watcherNames.push(name);
        watches.push({
          entity,
          path: `engine.entities.array[${index}]`,
          name,
          matchedName: name.toLowerCase(),
          position: positionInfo.position,
          positionSource: positionInfo.source,
          score: 920 + (relation.hostile ? 80 : 0),
          incomingTargetWatch: true,
          relation,
          watchTargetField: "target",
          watchTargetResolved: true,
          distance,
          distanceText: Number.isFinite(distance) ? `${formatTargetDistance(distance)}m` : "",
        });
      }
    }

    updateThreatState(watcherIds, watcherNames, mobAggro);
    COMBAT_ASSIST_STATE.fastPathHits++;
    COMBAT_ASSIST_STATE.fastPathLastAt = Date.now();
    return { skills, watches };
  }

  // ===== Threat HUD (위협 표시) =====
  function updateThreatState(watcherIds, watcherNames, mobAggro) {
    const state = COMBAT_ASSIST_STATE;
    const now = Date.now();
    let hasNewWatcher = false;
    for (const id of watcherIds) {
      if (!state.watcherIds.has(id)) { hasNewWatcher = true; break; }
    }
    state.watcherIds = watcherIds;
    state.watcherNames = watcherNames;
    state.mobAggroCount = mobAggro;
    if (hasNewWatcher) {
      state.threatFlashUntil = now + THREAT_FLASH_MS;
      if (FEATURE_CONFIG.watchBeepEnabled && now - state.lastBeepAt > WATCH_BEEP_MIN_GAP_MS) {
        state.lastBeepAt = now;
        playWatchBeep();
      }
    }
  }

  function playWatchBeep() {
    try {
      const AudioCtx = pageWindow.AudioContext || pageWindow.webkitAudioContext;
      if (!AudioCtx) return;
      if (!COMBAT_ASSIST_STATE.audioCtx) COMBAT_ASSIST_STATE.audioCtx = new AudioCtx();
      const ctx = COMBAT_ASSIST_STATE.audioCtx;
      if (ctx.state === "suspended") { ctx.resume().catch(() => {}); }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // audio unavailable
    }
  }

  function ensureThreatHudHost() {
    let host = COMBAT_ASSIST_STATE.threatHost;
    if (host && document.contains(host)) return host;
    if (!document.body) return null;
    host = document.createElement("div");
    host.id = "hkr-threat-hud";
    host.style.cssText = [
      "position:fixed", "left:50%", "top:11%", "transform:translateX(-50%)",
      "z-index:2147483500", "pointer-events:none", "display:none",
      "font:900 16px -apple-system,'Segoe UI',sans-serif", "color:#ff5252",
      "background:rgba(12,4,4,0.72)", "border:1px solid rgba(255,82,82,0.55)",
      "border-radius:7px", "padding:3px 12px",
      "text-shadow:0 1px 2px rgba(0,0,0,0.9)",
      "box-shadow:0 2px 10px rgba(0,0,0,0.55)",
    ].join(";");
    document.body.appendChild(host);
    COMBAT_ASSIST_STATE.threatHost = host;
    return host;
  }

  function updateThreatHud() {
    const host = ensureThreatHudHost();
    if (!host) return;
    const state = COMBAT_ASSIST_STATE;
    const watchers = state.watcherIds.size;
    const mobs = state.mobAggroCount;
    if (FEATURE_CONFIG.threatHudEnabled === false || (watchers === 0 && mobs === 0)) {
      if (host.style.display !== "none") host.style.display = "none";
      return;
    }
    const flash = Date.now() < state.threatFlashUntil;
    const parts = [];
    if (watchers > 0) parts.push(`🎯 주시 ${watchers}명${state.watcherNames.length ? " (" + state.watcherNames.slice(0, 3).join(", ") + ")" : ""}`);
    if (mobs > 0) parts.push(`몹 어그로 ${mobs}`);
    const text = parts.join(" · ");
    if (host.textContent !== text) host.textContent = text;
    host.style.display = "block";
    host.style.background = flash ? "rgba(120,8,8,0.92)" : "rgba(12,4,4,0.72)";
    host.style.fontSize = flash ? "19px" : "16px";
  }

  // Casting goes through runtime.useSkillbarSlot (the same packet path a keypress takes).
  // Used by the auto-interrupt path.
  function callRuntimeUseSkillbarSlot(runtime, slot) {
    try {
      if (runtime && typeof runtime.useSkillbarSlot === "function") return runtime.useSkillbarSlot(slot);
    } catch (error) {
      COMBAT_ASSIST_STATE.lastError = (error && error.message) || String(error);
    }
    return null;
  }

  function findEngineEntityById(engine, id) {
    try {
      if (engine && typeof engine.getEntityById === "function") return engine.getEntityById(id) || null;
      const arr = engine && engine.entities && engine.entities.array;
      if (arr) { for (const entity of arr) { if (entity && entity.id === id) return entity; } }
    } catch {
      // unreadable
    }
    return null;
  }

  // Local cooldown of whatever skill currently sits in a skillbar slot, in seconds.
  // Reads settings.skillbarsettings[name][slot-1].id -> player.skills.skills.get(id).cd
  // (verified live: slot 5 cd readable; a never-cast skill has no cd object -> ready).
  // null = unreadable (treat as ready and just fire).
  function getSlotCooldownRemaining(runtime, engine, me, slot) {
    try {
      const settings = runtime && runtime.settings;
      const bar = settings && settings.skillbarsettings && settings.skillbarsettings[me.name];
      const entry = bar && bar[slot - 1];
      const id = entry && Number(entry.id);
      if (!Number.isFinite(id) || id < 0) return null;
      const skillMap = me.skills && me.skills.skills;
      const skill = skillMap && typeof skillMap.get === "function" ? skillMap.get(id) : null;
      const cd = skill && skill.cd;
      const engineTime = engine && engine.time;
      if (!cd || typeof cd.end !== "number" || typeof engineTime !== "number") return null;
      return Math.max(0, cd.end - engineTime);
    } catch {
      return null;
    }
  }

  // First interrupt slot that is off cooldown right now (so "5 on cd -> fire 9" happens
  // in the same tick, no retry wait). Returns 0 when every slot is cooling down.
  function pickReadyInterruptSlot(runtime, engine, me, slots) {
    for (const slot of slots) {
      const remaining = getSlotCooldownRemaining(runtime, engine, me, slot);
      if (remaining === null || remaining <= AUTO_INTERRUPT_CD_READY_S) return slot;
    }
    return 0;
  }

  // Scan highlighted enemies in range for a live cast of a trigger skill; target the
  // caster and fire the first off-cooldown interrupt slot. One enemy cast = one castKey
  // (entity id + skill id + cast start), max AUTO_INTERRUPT_MAX_TRIES fires per cast.
  function autoInterruptTick(runtime, engine, me, now, fromWs) {
    if (!FEATURE_CONFIG.autoInterruptEnabled) return;
    const slots = FEATURE_CONFIG.autoInterruptSlots;
    if (!slots.length) return;
    if (now - COMBAT_ASSIST_STATE.lastInterruptAt < AUTO_INTERRUPT_GAP_MS) return;
    // By default interrupt ANY hostile in range; only restrict to the 강조 list when the
    // user explicitly turns highlight-only on. (Most Volley casters in a fight aren't
    // on your highlight list, which is why it felt like it never fired.)
    const highlightOnly = FEATURE_CONFIG.autoInterruptHighlightOnly === true;
    if (highlightOnly && !HIGHLIGHT_CONFIG.names.length) return;
    const arr = engine.entities && engine.entities.array;
    if (!arr) return;
    const engineTime = typeof engine.time === "number" ? engine.time : null;
    if (engineTime === null) return;
    const triggers = FEATURE_CONFIG.autoInterruptSkillIds;
    const rangeM = FEATURE_CONFIG.autoInterruptRangeM;

    for (const entity of arr) {
      if (!entity || entity.type !== 0 || entity.id === me.id) continue;
      if (entity.faction === undefined || me.faction === undefined || entity.faction === me.faction) continue;

      let castSkillId = null, castEnd = 0, castStart = 0, instant = false;
      try {
        const entitySkills = entity.skills;
        const timedSkill = entitySkills && entitySkills.timedSkill;
        if (!timedSkill || timedSkill.id == null) continue;
        const sid = Number(timedSkill.id);
        if (triggers.indexOf(sid) < 0) continue;
        const timedCast = entitySkills.timedCast;
        castEnd = Number(timedCast && timedCast.end);
        castStart = Number(timedCast && timedCast.start);
        if (Number.isFinite(castEnd) && castEnd > engineTime) {
          // A real cast/channel bar is still AHEAD of us (future end). Skip only if it's
          // basically done — interrupting a cast 0.2s from firing just wastes the tool.
          if (engineTime > castEnd - AUTO_INTERRUPT_MIN_REMAIN_S) continue;
        } else {
          // timedSkill is active but there is NO future cast-bar end. Two cases, both
          // "happening right now → cut immediately":
          //   - an ongoing CHANNEL (Volley = 3s arrow stream; its timedCast doesn't track
          //     the whole channel, so the old code wrongly skipped it as "cast done"),
          //   - an INSTANT skill (Charge).
          // Bucket the key by ~0.5s so a long channel keeps retrying as interrupt slots
          // free up, while one short use isn't spammed (the 250ms gap also caps fire rate).
          instant = true;
          castStart = Math.floor(engineTime * 2) / 2;
        }
        castSkillId = sid;
      } catch {
        continue;
      }

      const skillLabel = KEY_CAST_SKILL_MAP[castSkillId] || `#${castSkillId}`;
      const name = String(entity.name || "");
      if (highlightOnly && (!name || !getMatchingHighlightName(name))) continue;

      let distance = Infinity;
      try {
        const pos = entity.pos || entity.visualPosition;
        const myPos = me.pos || me.visualPosition;
        if (pos && myPos) distance = Math.hypot(pos[0] - myPos[0], pos[2] - myPos[2]);
      } catch {
        continue;
      }
      // Record what we saw (for diagnostics — combatAssistStatus().autoInterrupt.detect).
      COMBAT_ASSIST_STATE.lastInterruptDetect = {
        name, skill: skillLabel, distM: Number.isFinite(distance) ? Math.round(distance) : null,
        remainS: instant ? 0 : +(castEnd - engineTime).toFixed(2), at: now,
      };
      if (!(distance <= rangeM)) {
        COMBAT_ASSIST_STATE.lastInterruptSkip = { reason: `사거리 밖 (${Math.round(distance)}m>${rangeM}m)`, name, skill: skillLabel, at: now };
        continue;
      }

      const castKey = `${entity.id}:${castSkillId}:${Math.round(castStart * 10)}`;
      const tries = COMBAT_ASSIST_STATE.interruptTries.get(castKey) || 0;
      if (tries >= AUTO_INTERRUPT_MAX_TRIES) continue;

      // Per-skill response: Charge gets Blind only (the last configured slot); everything
      // else tries the full list (Vamp first, Blind fallback). Pick the first slot that is
      // actually off cooldown so "5 on cd -> fire 9" happens in this same tick.
      const responseSlots = (castSkillId === AUTO_INTERRUPT_CHARGE_ID && slots.length > 1)
        ? [slots[slots.length - 1]]
        : slots;
      const slot = pickReadyInterruptSlot(runtime, engine, me, responseSlots);
      if (!slot) {
        COMBAT_ASSIST_STATE.lastInterruptSkip = { reason: "대응 슬롯이 모두 쿨타임", name, skill: skillLabel, at: now };
        continue;
      }

      COMBAT_ASSIST_STATE.interruptTries.set(castKey, tries + 1);
      if (COMBAT_ASSIST_STATE.interruptTries.size > 64) {
        COMBAT_ASSIST_STATE.interruptTries.delete(COMBAT_ASSIST_STATE.interruptTries.keys().next().value);
      }

      try { if (readEntityTargetId(me) !== entity.id && typeof runtime.changeTarget === "function") runtime.changeTarget(entity.id); } catch { /* keep casting */ }
      const castResult = callRuntimeUseSkillbarSlot(runtime, slot);
      COMBAT_ASSIST_STATE.lastInterruptAt = now;
      COMBAT_ASSIST_STATE.interruptHits++;
      COMBAT_ASSIST_STATE.lastInterruptResult = {
        ...(castResult && typeof castResult === "object" ? castResult : { raw: castResult }),
        slotTried: slot, skill: skillLabel, at: now,
      };
      COMBAT_ASSIST_STATE.lastInterruptInfo = `${name} ${skillLabel} → ${slot}번`;
      const castOk = !castResult || typeof castResult !== "object" || castResult.ok !== false;
      const slotName = slots.length && slot === slots[slots.length - 1] && slot !== slots[0] ? "블라인드" : "뱀프";
      const srcTag = fromWs ? "WS" : "폴";
      pushDamageLogNote(`⚔ 끊기[${srcTag}] ${name} · ${skillLabel} → ${slotName}(${slot})${castOk ? "" : " ✖실패"}`, "dmg-interrupt");
      try { showGearPresetProgressOverlay(`⚔ 끊기: ${name} ${skillLabel} → ${slot}번`, "running", 1600); } catch { /* toast optional */ }
      return; // one interrupt attempt per pulse
    }
  }

  // Dedicated fast pulse for the interrupt only — detection latency ≤ AUTO_INTERRUPT_TICK_MS.
  function autoInterruptFastTick(fromWs) {
    try {
      if (!FEATURE_CONFIG.autoInterruptEnabled) return;
      const runtime = pageWindow.__HORDES_KR_RUNTIME__;
      const engine = runtime && runtime.engine;
      const me = engine && engine.player;
      if (!me) return;
      const before = COMBAT_ASSIST_STATE.interruptHits;
      autoInterruptTick(runtime, engine, me, Date.now(), fromWs === true);
      if (fromWs && COMBAT_ASSIST_STATE.interruptHits > before) COMBAT_ASSIST_STATE.wsHookFires++;
    } catch (error) {
      COMBAT_ASSIST_STATE.lastError = (error && error.message) || String(error);
    }
  }

  // Experimental: event-driven interrupt detection. The game decodes each inbound WS
  // message and updates entity.skills.timedSkill; we listen on the same socket and, via a
  // debounced microtask (which runs AFTER the game's handler finished the dispatch, so the
  // state is fresh regardless of listener order), run the detection immediately — shaving
  // the up-to-one-pulse polling delay. We never read/decode the binary ourselves, so the
  // game's message processing is untouched.
  function onGameSocketMessageForInterrupt() {
    COMBAT_ASSIST_STATE.wsHookMsgCount++;
    if (!FEATURE_CONFIG.autoInterruptEnabled || FEATURE_CONFIG.autoInterruptWsHook === false) return;
    if (COMBAT_ASSIST_STATE.wsHookPending) return;
    COMBAT_ASSIST_STATE.wsHookPending = true;
    queueMicrotask(() => {
      COMBAT_ASSIST_STATE.wsHookPending = false;
      COMBAT_ASSIST_STATE.lastWsHookAt = Date.now();
      autoInterruptFastTick(true);
    });
  }

  // ===== Team sync (팀파이트 멤버 상태 공유) =====
  function isTeamSyncEnabled() {
    return FEATURE_CONFIG.teamSyncEnabled === true;
  }

  // Remaining cooldown (s) of a skill id on the local player; 0 = ready, null = unknown.
  function skillCooldownRemaining(engine, me, id) {
    try {
      const map = me.skills && me.skills.skills;
      const skill = map && typeof map.get === "function" ? map.get(Number(id)) : null;
      const cd = skill && skill.cd;
      const t = engine && engine.time;
      if (!cd || typeof cd.end !== "number" || typeof t !== "number") return null;
      return Math.max(0, Math.round((cd.end - t) * 10) / 10);
    } catch {
      return null;
    }
  }

  // Candle (Ghost Candles) charm state. Verified live: a charm is item.type==="charm"
  // with item.tier === the charm index (11 = Ghost Candles). Usable only when EQUIPPED
  // (a worn charm slot, key >= 100; the charm bag sits at 33-50) AND placed in a
  // skillbar shortcut. The shortcut entry's .id is the use-skill whose cd
  // (player.skills.skills.get(id).cd) is the candle cooldown.
  // { equipped, slotted, remain } — remain seconds, 0 = ready, null = unknown.
  function readCandleState(runtime, engine, me) {
    const result = { equipped: false, slotted: false, remain: null };
    const TIER = TEAM_SYNC_CANDLE_TIER;
    try {
      const slots = me.inventory && me.inventory.slots;
      if (slots && typeof slots.forEach === "function") {
        slots.forEach((it, key) => {
          if (it && Number(key) >= 100 && it.type === "charm" && Number(it.tier) === TIER) result.equipped = true;
        });
      }
      const settings = runtime && runtime.settings;
      const bar = settings && settings.skillbarsettings && settings.skillbarsettings[me.name];
      if (Array.isArray(bar)) {
        for (const entry of bar) {
          const it = entry && entry.item;
          if (it && it.type === "charm" && Number(it.tier) === TIER) {
            result.slotted = true;
            result.remain = skillCooldownRemaining(engine, me, entry.id);
            break;
          }
        }
      }
    } catch {
      // inventory unreadable mid-transition
    }
    return result;
  }

  function buildTeamSyncPayload(runtime, engine, me) {
    const klass = Number(me.class);
    const defs = TEAM_SYNC_CLASS_SKILLS[klass] || [];
    const skills = {};
    for (const def of defs) {
      const remain = skillCooldownRemaining(engine, me, def.id);
      skills[def.id] = remain === null ? 0 : remain; // unknown -> treat as ready
    }
    const hp = entityHpFraction(me);
    return {
      klass,
      faction: Number(me.faction),
      payload: {
        skills,
        candle: readCandleState(runtime, engine, me),
        hp: hp >= 0 ? Math.round(hp * 100) : null,
        inCombat: (() => {
          try {
            const timer = me.stats && me.stats.combatTimer;
            return timer && typeof timer.done === "function" && engine && typeof engine.time === "number"
              ? !timer.done(engine.time) : false;
          } catch { return false; }
        })(),
      },
    };
  }

  async function teamSyncTick() {
    if (!isTeamSyncEnabled() || TEAM_SYNC_STATE.inFlight) return;
    let runtime, engine, me;
    try {
      runtime = getExposedRuntime();
      engine = runtime && runtime.engine;
      me = engine && engine.player;
    } catch { return; }
    if (!me || !me.name || me.class === undefined) return;

    const body = buildTeamSyncPayload(runtime, engine, me);
    body.room = FEATURE_CONFIG.teamSyncRoom;
    body.name = String(me.name);

    const url = `${FEATURE_CONFIG.teamSyncServer}?action=sync&token=${encodeURIComponent(FEATURE_CONFIG.teamSyncToken)}`;
    TEAM_SYNC_STATE.inFlight = true;
    try {
      const fetchFn = originalFetch || pageWindow.fetch;
      // text/plain = CORS "simple request": no OPTIONS preflight (cafe24 nginx 403s
      // OPTIONS). PHP reads the raw php://input body, so the JSON still parses.
      const response = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
      });
      const json = await response.json();
      if (json && json.ok && Array.isArray(json.members)) {
        TEAM_SYNC_STATE.members = json.members;
        TEAM_SYNC_STATE.lastSyncAt = Date.now();
        TEAM_SYNC_STATE.lastError = "";
      } else {
        TEAM_SYNC_STATE.lastError = (json && json.error) || "bad response";
      }
    } catch (error) {
      TEAM_SYNC_STATE.lastError = (error && error.message) || String(error);
    } finally {
      TEAM_SYNC_STATE.inFlight = false;
    }
    try { renderTeamSyncList(); } catch { /* UI must not break sync */ }
  }

  function scheduleTeamSync() {
    if (TEAM_SYNC_STATE.timer) { pageWindow.clearTimeout(TEAM_SYNC_STATE.timer); TEAM_SYNC_STATE.timer = null; }
    if (!isTeamSyncEnabled()) { renderTeamSyncList(); return; }
    let combat = false;
    try {
      const me = getExposedRuntime() && getExposedRuntime().engine && getExposedRuntime().engine.player;
      combat = me && COMBAT_ASSIST_STATE.watcherIds.size > 0;
    } catch { combat = false; }
    teamSyncTick();
    TEAM_SYNC_STATE.timer = pageWindow.setTimeout(scheduleTeamSync, combat ? TEAM_SYNC_POLL_COMBAT_MS : TEAM_SYNC_POLL_IDLE_MS);
  }

  function setTeamSyncEnabled(value) {
    FEATURE_CONFIG.teamSyncEnabled = Boolean(value);
    saveFeatureConfig();
    if (!FEATURE_CONFIG.teamSyncEnabled) {
      try {
        const me = getExposedRuntime() && getExposedRuntime().engine && getExposedRuntime().engine.player;
        if (me && me.name) {
          const url = `${FEATURE_CONFIG.teamSyncServer}?action=leave&room=${encodeURIComponent(FEATURE_CONFIG.teamSyncRoom)}&name=${encodeURIComponent(me.name)}&token=${encodeURIComponent(FEATURE_CONFIG.teamSyncToken)}`;
          (originalFetch || pageWindow.fetch)(url, { cache: "no-store", credentials: "omit" }).catch(() => {});
        }
      } catch { /* leave is best-effort */ }
      TEAM_SYNC_STATE.members = [];
      renderTeamSyncList();
    }
    scheduleTeamSync();
    renderStatusUi();
    return FEATURE_CONFIG.teamSyncEnabled;
  }

  function ensureTeamSyncStyle() {
    if (TEAM_SYNC_STATE.styleInstalled) return;
    const style = document.createElement("style");
    style.textContent = [
      "#hkr-teamsync{position:fixed;right:8px;top:34%;transform-origin:top left;z-index:2147483550;font:600 11px/1.4 -apple-system,'Segoe UI',sans-serif;color:#e8eef6;background:rgba(12,16,24,0.82);border:1px solid rgba(120,140,170,0.32);border-radius:7px;padding:4px 6px 6px;min-width:150px;max-width:240px;box-shadow:0 3px 12px rgba(0,0,0,0.5);-webkit-user-select:none;user-select:none}",
      "#hkr-teamsync .ts-head{display:flex;align-items:center;gap:5px;cursor:move;margin-bottom:3px;padding-bottom:3px;border-bottom:1px solid rgba(120,140,170,0.2)}",
      "#hkr-teamsync .ts-title{flex:1;opacity:0.92;letter-spacing:0.2px}",
      "#hkr-teamsync .ts-btn{cursor:pointer;width:14px;height:14px;line-height:13px;text-align:center;border-radius:3px;font-size:12px;font-weight:800;opacity:0.7;background:rgba(120,140,170,0.18);border:1px solid rgba(120,140,170,0.3)}",
      "#hkr-teamsync .ts-btn:hover{opacity:1;background:rgba(120,140,170,0.34)}",
      "#hkr-teamsync .ts-room{opacity:0.55;font-size:9px;font-weight:500}",
      "#hkr-teamsync .ts-row{display:flex;align-items:center;gap:4px;padding:1px 0}",
      "#hkr-teamsync .ts-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px}",
      "#hkr-teamsync .ts-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:78px}",
      "#hkr-teamsync .ts-name.off{opacity:0.4}",
      "#hkr-teamsync .ts-sk{display:inline-flex;align-items:center;gap:2px}",
      "#hkr-teamsync .ts-ico{width:15px;height:15px;flex:0 0 15px;object-fit:contain;border-radius:2px}",
      "#hkr-teamsync .ts-ico.cd{filter:grayscale(1) brightness(0.55)}",
      "#hkr-teamsync .ts-ind{display:inline-flex;align-items:center;justify-content:center;min-width:13px;height:13px;font-size:9px;font-weight:800}",
      "#hkr-teamsync .ts-ind.ready{width:9px;height:9px;min-width:9px;border-radius:50%;background:#46d07a;box-shadow:0 0 3px rgba(70,208,122,0.85)}",
      "#hkr-teamsync .ts-ind.cd{color:#ffffff;text-shadow:0 0 2px #000,0 1px 2px #000}",
      "#hkr-teamsync .ts-candle{font-size:13px;flex:0 0 auto}",
      "#hkr-teamsync .ts-empty{opacity:0.5;font-size:10px;font-weight:500;padding:2px 0}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
    TEAM_SYNC_STATE.styleInstalled = true;
  }

  // Uniform panel resize via CSS zoom (reflows + keeps getBoundingClientRect honest,
  // so drag-clamping still works). Persisted so it survives reloads.
  function setTeamSyncScale(value) {
    const next = clamp(Math.round(Number(value) * 100) / 100, 0.6, 2.2);
    TEAM_SYNC_STATE.scale = next;
    // transform (not zoom) with top-left origin: the anchor corner stays put, so
    // getBoundingClientRect().left === style.left and dragging math stays correct.
    const host = TEAM_SYNC_STATE.host;
    if (host) host.style.transform = `scale(${next})`;
    try { localStorage.setItem("hordesKrMod.teamSync.scale", String(next)); } catch { /* ignore */ }
    return next;
  }

  function ensureTeamSyncHost() {
    if (TEAM_SYNC_STATE.host && document.contains(TEAM_SYNC_STATE.host)) return TEAM_SYNC_STATE.host;
    if (!document.body) return null;
    ensureTeamSyncStyle();
    const host = document.createElement("div");
    host.id = "hkr-teamsync";
    const head = document.createElement("div");
    head.className = "ts-head";
    const title = document.createElement("span");
    title.className = "ts-title";
    title.textContent = "팀";
    const shrink = document.createElement("span");
    shrink.className = "ts-btn";
    shrink.textContent = "−";
    shrink.title = "패널 축소";
    const grow = document.createElement("span");
    grow.className = "ts-btn";
    grow.textContent = "+";
    grow.title = "패널 확대";
    const room = document.createElement("span");
    room.className = "ts-room";
    head.append(title, shrink, grow, room);
    const stepScale = (delta, event) => {
      if (event) { event.stopPropagation(); event.preventDefault(); }
      setTeamSyncScale(TEAM_SYNC_STATE.scale + delta);
    };
    // Buttons live inside the draggable head — stop their mousedown from starting a drag.
    shrink.addEventListener("mousedown", (e) => e.stopPropagation());
    grow.addEventListener("mousedown", (e) => e.stopPropagation());
    shrink.addEventListener("click", (e) => stepScale(-0.1, e));
    grow.addEventListener("click", (e) => stepScale(0.1, e));
    const bodyEl = document.createElement("div");
    bodyEl.className = "ts-body";
    host.append(head, bodyEl);
    document.body.appendChild(host);
    try {
      const pos = JSON.parse(localStorage.getItem("hordesKrMod.teamSync.pos") || "null");
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        host.style.left = `${pos.x}px`; host.style.top = `${pos.y}px`; host.style.right = "auto";
        TEAM_SYNC_STATE.hasSavedPos = true;
      }
    } catch { /* default position */ }
    try {
      // One-time migration: adopt the larger 1.3x default (= old 1.0 + three +clicks)
      // and re-anchor cleanly (the old zoom-based drag had left the saved pos off).
      if (localStorage.getItem("hordesKrMod.teamSync.scaleDefaultV2") !== "1") {
        TEAM_SYNC_STATE.scale = 1.3;
        TEAM_SYNC_STATE.hasSavedPos = false;
        host.style.left = ""; host.style.top = ""; host.style.right = "";
        localStorage.setItem("hordesKrMod.teamSync.scale", "1.3");
        localStorage.setItem("hordesKrMod.teamSync.scaleDefaultV2", "1");
        try { localStorage.removeItem("hordesKrMod.teamSync.pos"); } catch { /* ignore */ }
      } else {
        const s = Number(localStorage.getItem("hordesKrMod.teamSync.scale"));
        if (Number.isFinite(s) && s > 0) TEAM_SYNC_STATE.scale = clamp(s, 0.6, 2.2);
      }
    } catch { /* default scale */ }
    host.style.transform = `scale(${TEAM_SYNC_STATE.scale})`;
    head.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const rect = host.getBoundingClientRect();
      TEAM_SYNC_STATE.dragging = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.preventDefault();
    });
    document.addEventListener("mousemove", (event) => {
      const drag = TEAM_SYNC_STATE.dragging; if (!drag) return;
      host.style.left = `${Math.round(clamp(event.clientX - drag.dx, 0, (pageWindow.innerWidth || 800) - 40))}px`;
      host.style.top = `${Math.round(clamp(event.clientY - drag.dy, 0, (pageWindow.innerHeight || 600) - 16))}px`;
      host.style.right = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (!TEAM_SYNC_STATE.dragging) return;
      TEAM_SYNC_STATE.dragging = null;
      TEAM_SYNC_STATE.hasSavedPos = true;
      try { const r = host.getBoundingClientRect(); localStorage.setItem("hordesKrMod.teamSync.pos", JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch { /* ignore */ }
    });
    TEAM_SYNC_STATE.host = host;
    TEAM_SYNC_STATE.body = bodyEl;
    TEAM_SYNC_STATE.headRoom = room;
    return host;
  }

  function teamSyncSkillCell(def, remain) {
    const cell = document.createElement("span");
    cell.className = "ts-sk";
    cell.title = def.name;
    const icon = document.createElement("img");
    icon.className = remain > 0.3 ? "ts-ico cd" : "ts-ico";
    icon.alt = "";
    icon.src = buildDataAssetUrl("ui/skills/" + def.id);
    icon.addEventListener("error", () => icon.remove(), { once: true });
    cell.appendChild(icon);
    const tag = document.createElement("span");
    if (remain > 0.3) { tag.className = "ts-ind cd"; tag.textContent = Math.ceil(remain) + ""; }
    else { tag.className = "ts-ind ready"; } // ready = filled green circle (no glyph)
    cell.appendChild(tag);
    return cell;
  }

  // Default placement: just left of the player health bar (#ufplayer). Only applied
  // until the user drags the panel (then their saved position wins). Retries each
  // render until #ufplayer has real layout, since the game UI mounts asynchronously.
  function positionTeamSyncDefault(host) {
    if (TEAM_SYNC_STATE.hasSavedPos || TEAM_SYNC_STATE.posApplied) return;
    const anchor = document.getElementById("ufplayer");
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) return;
    // offsetWidth is the unscaled layout width; the rendered panel is scaled by transform.
    const w = (host.offsetWidth || 160) * (TEAM_SYNC_STATE.scale || 1);
    const gap = 8;
    const left = clamp(r.left - w - gap, 4, (pageWindow.innerWidth || 800) - w - 4);
    const top = clamp(r.top, 4, (pageWindow.innerHeight || 600) - 30);
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
    host.style.right = "auto";
    TEAM_SYNC_STATE.posApplied = true;
  }

  function renderTeamSyncList() {
    if (!isTeamSyncEnabled()) {
      if (TEAM_SYNC_STATE.host) TEAM_SYNC_STATE.host.style.display = "none";
      return;
    }
    const host = ensureTeamSyncHost();
    if (!host) return;
    host.style.display = "block";
    positionTeamSyncDefault(host);
    if (TEAM_SYNC_STATE.headRoom) TEAM_SYNC_STATE.headRoom.textContent = FEATURE_CONFIG.teamSyncRoom;
    const body = TEAM_SYNC_STATE.body;
    body.replaceChildren();
    const members = TEAM_SYNC_STATE.members || [];
    if (!members.length) {
      const empty = document.createElement("div");
      empty.className = "ts-empty";
      empty.textContent = TEAM_SYNC_STATE.lastError ? `오류: ${TEAM_SYNC_STATE.lastError}` : "대기 중… (같은 방/토큰 멤버 표시)";
      body.appendChild(empty);
      return;
    }
    for (const member of members) {
      const row = document.createElement("div");
      row.className = "ts-row";
      const dot = document.createElement("span");
      dot.className = "ts-dot";
      dot.style.background = TEAM_SYNC_CLASS_COLOR[member.klass] || "#8893a0";
      const name = document.createElement("span");
      name.className = member.ageSec > 8 ? "ts-name off" : "ts-name";
      name.textContent = member.name;
      name.title = `${member.name} · ${TEAM_SYNC_CLASS_LABEL[member.klass] || "?"}${member.payload && member.payload.hp != null ? " · HP " + member.payload.hp + "%" : ""} · ${member.ageSec}s 전`;
      row.append(dot, name);

      const defs = TEAM_SYNC_CLASS_SKILLS[member.klass] || [];
      const skills = (member.payload && member.payload.skills) || {};
      for (const def of defs) {
        const remain = Number(skills[def.id]);
        row.appendChild(teamSyncSkillCell(def, Number.isFinite(remain) ? remain : 0));
      }
      const candle = member.payload && member.payload.candle;
      if (candle) {
        // Emoji ignore CSS color, so a green 🕯 looked identical to a ready one. Pair the
        // candle with the same green-circle / white-cooldown indicator the skills use.
        const cell = document.createElement("span");
        cell.className = "ts-sk";
        const ico = document.createElement("span");
        ico.className = "ts-candle";
        ico.textContent = "🕯";
        cell.appendChild(ico);
        if (!candle.equipped) {
          ico.style.opacity = "0.22";
          cell.title = "candle 미착용";
        } else {
          const remain = Number(candle.remain);
          const tag = document.createElement("span");
          if (remain > 0.3) {
            ico.style.filter = "grayscale(1) brightness(0.6)";
            tag.className = "ts-ind cd";
            tag.textContent = Math.ceil(remain) + "";
            cell.title = `candle 쿨 ${Math.ceil(remain)}s`;
          } else {
            tag.className = "ts-ind ready";
            cell.title = "candle 사용가능";
          }
          cell.appendChild(tag);
        }
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
  }

  function installCombatAssist() {
    if (COMBAT_ASSIST_STATE.interruptTimer) return;
    COMBAT_ASSIST_STATE.interruptTimer = setInterval(autoInterruptFastTick, AUTO_INTERRUPT_TICK_MS);
    scheduleTeamSync();
    startDangerOverlayLoop();
  }

  function collectIncomingWarningOverlayEntities(runtime) {
    const self = findLocalPlayerEntity(runtime);
    if (!self) return { skills: [], watches: [] };

    const selfPosition = getRuntimeWorldPosition(self.entity);
    if (!selfPosition) return { skills: [], watches: [] };

    const wantsSkill = isIncomingSkillOverlayEnabled();
    const wantsWatch = isIncomingTargetWatchEnabled();
    if (!wantsSkill && !wantsWatch) return { skills: [], watches: [] };

    const fast = collectIncomingWarningOverlayEntitiesFast(runtime, self, selfPosition, wantsSkill, wantsWatch);
    if (fast) return fast;

    const entities = collectLoadedRuntimeEntities(runtime, {
      limit: INCOMING_WARNING_SCAN_LIMIT,
      playersOnly: false,
    });
    const skills = [];
    const watches = [];

    for (const item of entities.items) {
      if (isSameRuntimeEntity(item.entity, self.entity)) continue;

      const relation = getRuntimeEntityRelation(item.entity, self.entity);
      if (relation.friendly) continue;

      const distance = getHorizontalRuntimeDistance(selfPosition.position, item.position);

      if (wantsSkill) {
        const skillField = getIncomingSkillField({
          activeFields: getRuntimeSkillTargetFields(item.entity, runtime, self.entity),
        });
        if (skillField) {
          const skillId = normalizeSkillIconId(skillField.skill && skillField.skill.id);
          skills.push({
            entity: item.entity,
            path: item.path,
            name: item.name,
            matchedName: item.name.toLowerCase(),
            position: item.position,
            positionSource: item.positionSource,
            score: 1000 + (item.type === 0 ? 120 : 0),
            incomingSkill: true,
            relation,
            skillId,
            skillIconUrl: skillId ? getSkillIconUrl(skillId) : "",
            skillTargetField: skillField.key,
            skillRemaining: skillField.skill && skillField.skill.remaining,
            distance,
            distanceText: Number.isFinite(distance) ? `${formatTargetDistance(distance)}m` : "",
          });
        }
      }

      if (wantsWatch && item.type === 0 && isLikelyRuntimePlayerEntity(item.entity, item.name)) {
        const targetInfo = getRuntimeEntityTargetInfo(item.entity, runtime, self.entity);
        const watchField = getIncomingTargetWatchField(targetInfo);
        if (watchField) {
          watches.push({
            entity: item.entity,
            path: item.path,
            name: item.name,
            matchedName: item.name.toLowerCase(),
            position: item.position,
            positionSource: item.positionSource,
            score: 920 + (relation.hostile ? 80 : 0),
            incomingTargetWatch: true,
            relation,
            watchTargetField: watchField.key,
            watchTargetResolved: Boolean(watchField.resolved),
            distance,
            distanceText: Number.isFinite(distance) ? `${formatTargetDistance(distance)}m` : "",
          });
        }
      }
    }

    return { skills, watches };
  }

  function getIncomingSkillField(targetInfo) {
    if (!targetInfo || !Array.isArray(targetInfo.activeFields)) return null;

    return targetInfo.activeFields.find((field) => (
      field &&
      field.targetsSelf &&
      /^skills\./.test(field.key || "") &&
      Boolean(field.skill && field.skill.active)
    )) || null;
  }

  function getIncomingTargetWatchField(targetInfo) {
    if (!targetInfo || !Array.isArray(targetInfo.activeFields)) return null;

    return targetInfo.activeFields
      .filter((field) => (
        field &&
        field.targetsSelf &&
        !/^skills\./.test(field.key || "") &&
        isRuntimeWatchTargetFieldKey(field.key)
      ))
      .sort((left, right) => scoreIncomingTargetWatchField(right) - scoreIncomingTargetWatchField(left))
      [0] || null;
  }

  function scoreIncomingTargetWatchField(field) {
    const key = String(field && field.key || "").toLowerCase();
    let score = 0;
    if (field && field.resolved) score += 20;
    if (/(^|\.)target(entity|unit)?$/i.test(key)) score += 80;
    if (/(^|\.)(current|selected|focus)target/i.test(key)) score += 70;
    if (/(^|\.)(attack|enemy|combat)target/i.test(key)) score += 60;
    if (/controller|combat|selection|targeting|state/.test(key)) score += 25;
    return score;
  }

  function isRuntimeWatchTargetFieldKey(key) {
    const normalized = String(key || "");
    if (!normalized) return false;
    if (/aggroMode|targetMode|targetTimer|interiorlight/i.test(normalized)) return false;
    return /target|selected|focus|attack|enemy|combat/i.test(normalized);
  }

  function sortRuntimeOverlayCandidateForDisplay(left, right) {
    if (left.incomingSkill !== right.incomingSkill) return left.incomingSkill ? -1 : 1;
    if (left.incomingTargetWatch !== right.incomingTargetWatch) return left.incomingTargetWatch ? -1 : 1;
    return (right.score || 0) - (left.score || 0);
  }

  function normalizeSkillIconId(value) {
    if (value === null || value === undefined || value === "") return "";

    const id = Number(value);
    return Number.isFinite(id) && id >= 0 ? String(Math.trunc(id)) : "";
  }

  function getSkillIconUrl(skillId) {
    const version = getGameAssetVersion();
    return `/data/ui/skills/${encodeURIComponent(skillId)}.avif${version ? `?v=${encodeURIComponent(version)}` : ""}`;
  }

  function getGameAssetVersion() {
    if (getGameAssetVersion.cached !== undefined) return getGameAssetVersion.cached;

    let version = "";
    try {
      const asset = document.querySelector("script[src*='?v='], link[href*='?v='], img[src*='?v=']");
      const rawUrl = asset && (asset.getAttribute("src") || asset.getAttribute("href"));
      const url = rawUrl ? new URL(rawUrl, location.href) : null;
      version = url ? (url.searchParams.get("v") || "") : "";
    } catch {
      version = "";
    }

    getGameAssetVersion.cached = version;
    return version;
  }

  function clearRuntimeNameOverlay() {
    const host = HIGHLIGHT_STATE.runtimeOverlayHost;
    if (host) host.replaceChildren();
    HIGHLIGHT_STATE.runtimeOverlayItems.clear();
    HIGHLIGHT_STATE.runtimeOverlayActiveEntries = [];
    HIGHLIGHT_STATE.lastRuntimeOverlayMatches = [];
  }

  function renderRuntimeNameOverlayLabels(host, candidates) {
    const activeKeys = new Set();
    const activeVisualKeys = new Set();
    const activeEntries = [];
    const now = Date.now();

    for (const candidate of candidates) {
      const visualKey = getRuntimeOverlayVisualKey(candidate);
      if (visualKey && activeVisualKeys.has(visualKey)) continue;
      if (visualKey) activeVisualKeys.add(visualKey);

      const id = getRuntimeEntityId(candidate.entity);
      const key = id !== undefined ? `id:${String(id)}` : `${candidate.name}:${candidate.path}`;
      activeKeys.add(key);

      let label = HIGHLIGHT_STATE.runtimeOverlayItems.get(key);
      if (!label) {
        label = document.createElement("div");
        label.className = "hordes-kr-runtime-name-label";
        host.appendChild(label);
        HIGHLIGHT_STATE.runtimeOverlayItems.set(key, label);
      }

      label.classList.toggle("incoming-skill", Boolean(candidate.incomingSkill));
      label.classList.toggle("incoming-watch", Boolean(candidate.incomingTargetWatch && !candidate.incomingSkill));
      label.classList.toggle("normal-highlight", !candidate.incomingSkill && !candidate.incomingTargetWatch);
      label.classList.toggle("buff-spike", Boolean(candidate.buffSpike));
      label.classList.toggle("has-key-buff", Boolean((candidate.keyBuffs && candidate.keyBuffs.length) || candidate.castSkill));
      renderRuntimeNameOverlayLabelContent(label, candidate);

      const left = `${Math.round(candidate.screen.x)}px`;
      const top = `${Math.round(candidate.screen.y - getRuntimeOverlayLabelYOffset(candidate))}px`;
      if (label.style.left !== left) label.style.left = left;
      if (label.style.top !== top) label.style.top = top;
      label.dataset.hordesKrSeenAt = String(now);
      activeEntries.push({ key, candidate });
    }

    HIGHLIGHT_STATE.runtimeOverlayActiveEntries = activeEntries;

    for (const [key, label] of HIGHLIGHT_STATE.runtimeOverlayItems.entries()) {
      if (activeKeys.has(key)) continue;
      const seenAt = Number(label.dataset.hordesKrSeenAt) || 0;
      if (now - seenAt < 120) continue;

      label.remove();
      HIGHLIGHT_STATE.runtimeOverlayItems.delete(key);
    }
  }

  function startRuntimeOverlayPositionLoop() {
    if (HIGHLIGHT_STATE.runtimeOverlayRafId) return;

    const tick = () => {
      HIGHLIGHT_STATE.runtimeOverlayRafId = pageWindow.requestAnimationFrame(tick);
      updateRuntimeOverlayLabelPositionsFast();
    };

    HIGHLIGHT_STATE.runtimeOverlayRafId = pageWindow.requestAnimationFrame(tick);
  }

  function updateRuntimeOverlayLabelPositionsFast() {
    const entries = HIGHLIGHT_STATE.runtimeOverlayActiveEntries;
    if (!entries || entries.length === 0) return;
    if (!shouldRunRuntimeNameOverlay()) return;

    const runtime = getExposedRuntime();
    if (!runtime || !getRuntimeProjectionMatrix(runtime)) return;

    for (const entry of entries) {
      const label = HIGHLIGHT_STATE.runtimeOverlayItems.get(entry.key);
      const candidate = entry.candidate;
      if (!label || !candidate || !candidate.entity || !document.contains(label)) continue;

      const positionInfo = getRuntimeWorldPosition(candidate.entity);
      if (!positionInfo) continue;

      candidate.position = positionInfo.position;
      candidate.positionSource = positionInfo.source;
      const point = projectRuntimeEntityToScreen(candidate, runtime);
      if (!point) continue;

      const left = `${Math.round(point.x)}px`;
      const top = `${Math.round(point.y - getRuntimeOverlayLabelYOffset(candidate))}px`;
      if (label.style.left !== left) label.style.left = left;
      if (label.style.top !== top) label.style.top = top;
      candidate.screen = point;
    }
  }

  function getRuntimeOverlayVisualKey(candidate) {
    if (!candidate || !candidate.screen) return "";
    const name = String(candidate.name || "").trim().toLowerCase();
    if (!name) return "";

    const kind = candidate.incomingSkill
      ? "skill"
      : candidate.incomingTargetWatch
        ? "watch"
        : "normal";
    const x = Math.round(Number(candidate.screen.x) / 12);
    const y = Math.round(Number(candidate.screen.y) / 12);
    return `${kind}:${name}:${x}:${y}`;
  }

  function getRuntimeOverlayLabelYOffset(candidate) {
    if (!candidate || candidate.incomingSkill || candidate.incomingTargetWatch) return 0;
    return 10;
  }

  function renderRuntimeNameOverlayLabelContent(label, candidate) {
    const signature = [
      candidate.name,
      candidate.incomingSkill ? "incoming" : candidate.incomingTargetWatch ? "watch" : "normal",
      candidate.skillId || "",
      candidate.skillIconUrl || "",
      candidate.distanceText || "",
      candidate.relation ? candidate.relation.type : "",
      candidate.watchTargetField || "",
      candidate.buffSpike ? "buff" : "",
      (candidate.keyBuffs || []).map((b) => b.label).join(","),
      candidate.castSkill ? "cast:" + candidate.castSkill.label : "",
    ].join("|");
    if (label.dataset.hordesKrSignature === signature) return;

    label.dataset.hordesKrSignature = signature;
    label.dataset.hordesKrName = candidate.name;
    label.replaceChildren();

    const appendCastSkillIcon = () => {
      if (!candidate.castSkill) return;
      const icon = document.createElement("img");
      icon.className = "cast-skill-icon";
      icon.alt = "";
      icon.decoding = "async";
      icon.src = candidate.castSkill.iconUrl;
      icon.title = candidate.castSkill.label + " 시전 중";
      icon.addEventListener("error", () => icon.remove(), { once: true });
      label.appendChild(icon);
    };

    const appendKeyBuffIcons = () => {
      const list = candidate.keyBuffs || [];
      for (const buff of list) {
        const isDef = buff.kind === "def";
        const icon = document.createElement("img");
        icon.className = isDef ? "key-buff-icon def" : "key-buff-icon";
        icon.alt = "";
        icon.decoding = "async";
        icon.src = buff.iconUrl;
        icon.title = buff.label + (isDef ? " — 방어 스킬" : " — 버프");
        if (isDef && buff.remain != null && buff.remain > 0.3) {
          // Defensive buff with a live timer → overlay the remaining seconds in bold white.
          const wrap = document.createElement("span");
          wrap.className = "key-buff-wrap def";
          wrap.title = icon.title;
          const cd = document.createElement("span");
          cd.className = "key-buff-cd";
          cd.textContent = Math.ceil(buff.remain) + "";
          wrap.append(icon, cd);
          icon.addEventListener("error", () => wrap.remove(), { once: true });
          label.appendChild(wrap);
        } else {
          icon.addEventListener("error", () => icon.remove(), { once: true });
          label.appendChild(icon);
        }
      }
    };

    const appendBuffSpikeBadge = () => {
      if (!candidate.buffSpike) return;
      const badge = document.createElement("span");
      badge.className = "buff-spike-badge";
      badge.textContent = "⚡버프";
      label.appendChild(badge);
    };

    if (!candidate.incomingSkill && !candidate.incomingTargetWatch) {
      const hasExtras = candidate.buffSpike || candidate.castSkill || (candidate.keyBuffs && candidate.keyBuffs.length);
      if (hasExtras) {
        appendCastSkillIcon();
        appendKeyBuffIcons();
        appendBuffSpikeBadge();
        const nameOnly = document.createElement("span");
        nameOnly.className = "name";
        nameOnly.textContent = candidate.name;
        label.appendChild(nameOnly);
        const buffLabels = (candidate.keyBuffs || []).map((b) => b.label).join(", ");
        const castLabel = candidate.castSkill ? `${candidate.castSkill.label} 시전 중` : "";
        label.title = `${candidate.name}${castLabel ? " — " + castLabel : ""}${buffLabels ? " — " + buffLabels : ""}${candidate.buffSpike ? " (버프 활성화 감지)" : ""}`;
      } else {
        label.textContent = candidate.name;
        label.title = candidate.name;
      }
      return;
    }

    if (candidate.incomingTargetWatch && !candidate.incomingSkill) {
      const prefix = document.createElement("span");
      prefix.className = "watch-prefix";
      prefix.textContent = "주시";
      label.appendChild(prefix);
    }

    if (candidate.skillIconUrl) {
      const icon = document.createElement("img");
      icon.className = "skill-icon";
      icon.alt = "";
      icon.decoding = "async";
      icon.loading = "eager";
      icon.src = candidate.skillIconUrl;
      icon.addEventListener("error", () => {
        icon.remove();
      }, { once: true });
      label.appendChild(icon);
    }

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = candidate.name;
    label.appendChild(name);

    if (candidate.distanceText) {
      const distance = document.createElement("span");
      distance.className = "distance";
      distance.textContent = candidate.distanceText;
      label.appendChild(distance);
    }

    appendCastSkillIcon();
    appendKeyBuffIcons();
    appendBuffSpikeBadge();

    label.title = joinStatusParts([
      `${candidate.name} -> 나`,
      candidate.skillId ? `skill ${candidate.skillId}` : "",
      candidate.incomingTargetWatch ? "주시" : "",
      candidate.castSkill ? `${candidate.castSkill.label} 시전 중` : "",
      (candidate.keyBuffs || []).map((b) => b.label).join(", "),
      candidate.buffSpike ? "버프 활성화(교전 징조)" : "",
      candidate.distanceText ? `거리 ${candidate.distanceText}` : "",
      candidate.relation ? `관계 ${candidate.relation.type}` : "",
    ]);
  }

  function collectRuntimeOverlayEntities(names, options = {}) {
    const normalizedNames = names === HIGHLIGHT_CONFIG.names
      ? getHighlightNameCache().names
      : uniqueHighlightNames(names).sort((a, b) => b.length - a.length);
    if (normalizedNames.length === 0) return [];

    const lowerNames = names === HIGHLIGHT_CONFIG.names
      ? getHighlightNameCache().lowerNames
      : normalizedNames.map((name) => name.toLowerCase());
    const runtime = getExposedRuntime();
    if (!runtime) return [];

    const limit = options.limit || 16;
    const maxDepth = options.maxDepth || 7;
    const maxObjects = options.maxObjects || 9000;
    const directCandidates = collectDirectRuntimeOverlayCandidates(runtime, lowerNames, maxObjects);
    if (directCandidates.length > 0) {
      return dedupeRuntimeOverlayCandidates(directCandidates)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    const cacheKey = `${lowerNames.join("\u0001")}|${limit}|${maxDepth}|${maxObjects}`;
    const now = Date.now();
    if (
      HIGHLIGHT_STATE.runtimeDeepScanCacheKey === cacheKey &&
      now - HIGHLIGHT_STATE.runtimeDeepScanAt < 1000
    ) {
      return HIGHLIGHT_STATE.runtimeDeepScanCandidates.slice(0, limit);
    }

    const roots = [{ value: runtime, path: "runtime", depth: 0 }];
    if (runtime.engine) roots.push({ value: runtime.engine, path: "runtime.engine", depth: 0 });

    const queue = roots.slice();
    const seen = new WeakSet();
    const candidates = [];
    let visited = 0;

    for (let cursor = 0; cursor < queue.length && visited < maxObjects && candidates.length < limit * 3; cursor++) {
      const item = queue[cursor];
      const value = item.value;
      if (!isRuntimeObject(value) || seen.has(value)) continue;

      seen.add(value);
      visited++;

      const candidate = summarizeRuntimeOverlayEntity(value, item.path, lowerNames);
      if (candidate) candidates.push(candidate);

      if (item.depth >= maxDepth) continue;
      const childLimit = item.depth === 0 ? 800 : 140;
      for (const child of getRuntimeChildren(value, item.path, childLimit)) {
        queue.push({ ...child, depth: item.depth + 1 });
      }
    }

    const result = dedupeRuntimeOverlayCandidates(candidates)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    HIGHLIGHT_STATE.runtimeDeepScanCacheKey = cacheKey;
    HIGHLIGHT_STATE.runtimeDeepScanAt = now;
    HIGHLIGHT_STATE.runtimeDeepScanCandidates = result;
    return result;
  }

  function collectRuntimeHostilePlayerOverlayEntities(runtime, context, options = {}) {
    if (!runtime || !context || !context.self || !context.self.entity) return [];

    const limit = clamp(Number(options.limit) || 48, 1, 120);
    const entities = collectLoadedRuntimeEntities(runtime, {
      limit: Math.max(300, limit * 8),
      playersOnly: true,
    });
    const candidates = [];

    for (const item of entities.items) {
      if (!item || !item.entity || !item.name || !Array.isArray(item.position)) continue;
      if (isSameRuntimeEntity(item.entity, context.self.entity)) continue;
      if (!isLikelyRuntimePlayerEntity(item.entity, item.name)) continue;

      const relation = getRuntimeEntityRelation(item.entity, context.self.entity);
      if (!relation.hostile) continue;

      const distance = getHorizontalRuntimeDistance(context.selfPosition.position, item.position);
      candidates.push({
        entity: item.entity,
        path: item.path,
        name: item.name,
        matchedName: item.name.toLowerCase(),
        position: item.position,
        positionSource: item.positionSource,
        relation,
        score: 900 - (Number.isFinite(distance) ? Math.min(500, distance) : 500),
      });
    }

    return dedupeRuntimeOverlayCandidates(candidates)
      .sort((left, right) => compareRuntimeHostileCandidates(left, right, context))
      .slice(0, limit);
  }

  function compareRuntimeHostileCandidates(left, right, context) {
    const leftDistance = getHorizontalRuntimeDistance(context.selfPosition.position, left.position);
    const rightDistance = getHorizontalRuntimeDistance(context.selfPosition.position, right.position);
    const leftSort = Number.isFinite(leftDistance) ? leftDistance : Number.POSITIVE_INFINITY;
    const rightSort = Number.isFinite(rightDistance) ? rightDistance : Number.POSITIVE_INFINITY;
    return leftSort - rightSort || String(left.name).localeCompare(String(right.name));
  }

  function isLikelyRuntimePlayerEntity(entity, name) {
    if (!isRuntimeObject(entity)) return false;
    if (getRuntimeEntityType(entity) !== 0) return false;
    if (hasRuntimeNpcOrBotMarker(entity, name)) return false;

    const classId = getRuntimeEntityClassId(entity);
    if (classId === 4) return false;
    if (classId !== null && (classId < 0 || classId > 3)) return false;

    if (hasRuntimePlayerIdentityMarker(entity)) return true;
    if (hasRuntimeAiControlMarker(entity)) return false;

    return classId !== null;
  }

  function hasRuntimeNpcOrBotMarker(entity, name) {
    if (isLikelyBotOrNpcName(name || getRuntimeEntityLabel(entity))) return true;

    const className = String(safeReadValue(entity, "constructor") && safeReadValue(entity, "constructor").name || "").toLowerCase();
    if (/\b(?:npc|mob|monster|bot|pet|summon|minion)\b/.test(className)) return true;

    return hasRuntimeNpcOrBotFieldMarker(entity);
  }

  function hasRuntimeNpcOrBotFieldMarker(entity) {
    const booleanKeys = [
      "isNpc",
      "npc",
      "isMob",
      "mob",
      "isMonster",
      "monster",
      "isBot",
      "bot",
      "isPet",
      "pet",
      "isSummon",
      "summon",
      "summoned",
      "isMinion",
      "minion",
      "isAi",
      "isAI",
      "aiControlled",
      "ai",
    ];
    for (const key of booleanKeys) {
      const value = safeReadValue(entity, key);
      if (value === true || value === 1 || value === "1") return true;
    }

    for (const key of ["owner", "ownerId", "ownerName", "summoner", "summonerId", "master", "masterId", "controller", "controllerId"]) {
      const value = safeReadValue(entity, key);
      if (value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0") return true;
    }

    const kind = [
      safeReadValue(entity, "kind"),
      safeReadValue(entity, "category"),
      safeReadValue(entity, "entityType"),
      safeReadValue(entity, "unitType"),
      safeReadValue(entity, "aiType"),
      safeReadValue(entity, "role"),
      safeReadValue(entity, "template"),
    ].map((value) => String(value || "").toLowerCase()).join(" ");
    return /\b(?:npc|mob|monster|bot|pet|summon|minion)\b/.test(kind);
  }

  function isLikelyBotOrNpcName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return true;
    return /\b(?:bot|dummy|training|guard|sentry|sentinel|totem|pet|summon|minion|wolf|spider|skeleton|zombie|goblin|orc|imp|drone|clone)\b/.test(normalized);
  }

  function hasRuntimeAiControlMarker(entity) {
    for (const key of [
      "aiController",
      "aiState",
      "brain",
      "behavior",
      "behaviour",
      "pathfinder",
      "navAgent",
      "navigation",
      "spawn",
      "spawnId",
      "spawnid",
      "templateId",
      "templateid",
      "npcId",
      "npcid",
      "mobId",
      "mobid",
      "monsterId",
      "monsterid",
    ]) {
      const value = safeReadValue(entity, key);
      if (value !== null && value !== undefined && value !== "" && value !== false && value !== 0 && value !== "0") return true;
    }
    return false;
  }

  function hasRuntimePlayerIdentityMarker(entity) {
    for (const key of ["accountId", "accountid", "userId", "userid", "characterId", "characterid", "playerId", "playerid"]) {
      const value = safeReadValue(entity, key);
      if (value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0") return true;
    }

    for (const key of ["character", "profile", "player", "user"]) {
      const value = safeReadValue(entity, key);
      if (!isRuntimeObject(value)) continue;
      if (getRuntimeNameValueLoose(value) || getRuntimeEntityClassId(value) !== null) return true;
    }

    return false;
  }

  function collectDirectRuntimeOverlayCandidates(runtime, lowerNames, maxObjects) {
    const candidates = [];
    const seen = new WeakSet();
    let visited = 0;

    const add = (value, path) => {
      if (visited >= maxObjects || !isRuntimeObject(value) || seen.has(value)) return;
      seen.add(value);
      visited++;

      const candidate = summarizeRuntimeOverlayEntity(value, path, lowerNames);
      if (candidate) candidates.push(candidate);
    };

    add(runtime.player, "runtime.player");
    add(runtime.target, "runtime.target");

    const engine = runtime.engine;
    if (!engine) return candidates;

    add(safeReadValue(engine, "player"), "runtime.engine.player");
    add(safeReadValue(engine, "target"), "runtime.engine.target");

    const entities = safeReadValue(engine, "entities");
    scanRuntimeEntityCollection(safeReadValue(entities, "array"), "runtime.engine.entities.array", add, maxObjects);

    for (const key of ["list", "items", "values", "players", "mobs", "units", "actors", "objects"]) {
      scanRuntimeEntityCollection(safeReadValue(entities, key), `runtime.engine.entities.${key}`, add, maxObjects);
      scanRuntimeEntityCollection(safeReadValue(engine, key), `runtime.engine.${key}`, add, maxObjects);
      if (visited >= maxObjects) break;
    }

    return candidates;
  }

  function scanRuntimeEntityCollection(collection, path, add, maxObjects) {
    if (!collection || typeof add !== "function") return;

    if (Array.isArray(collection)) {
      const length = Math.min(collection.length, maxObjects);
      for (let index = 0; index < length; index++) {
        add(collection[index], `${path}[${index}]`);
      }
      return;
    }

    if (collection instanceof Map || collection instanceof Set) {
      let index = 0;
      for (const value of collection.values()) {
        if (index >= maxObjects) break;
        add(value, `${path}.${collection instanceof Map ? "map" : "set"}[${index}]`);
        index++;
      }
    }
  }

  function summarizeRuntimeOverlayEntity(value, path, lowerNames) {
    const name = getRuntimeNameValueLoose(value);
    if (!name) return null;

    const lowerName = name.trim().toLowerCase();
    const matchedName = lowerNames.find((target) => lowerName === target); // exact, not substring
    if (!matchedName) return null;

    const positionInfo = getRuntimeWorldPosition(value);
    if (!positionInfo) return null;

    return {
      entity: value,
      path,
      name,
      matchedName,
      position: positionInfo.position,
      positionSource: positionInfo.source,
      score: scoreRuntimeOverlayCandidate(value, name, matchedName, path, positionInfo.source),
    };
  }

  function scoreRuntimeOverlayCandidate(value, name, matchedName, path, positionSource) {
    let score = name.toLowerCase() === matchedName ? 120 : 80;
    if (/visual/i.test(positionSource)) score += 30;
    if (/entity|player|unit|mob|actor/i.test(path)) score += 20;
    if (Number.isFinite(Number(safeReadValue(value, "id")))) score += 8;
    if (Number.isFinite(Number(safeReadValue(value, "level")))) score += 8;
    if (Number.isFinite(Number(safeReadValue(value, "health") ?? safeReadValue(value, "hp")))) score += 8;
    return score;
  }

  function dedupeRuntimeOverlayCandidates(candidates) {
    const seen = new Set();
    const result = [];

    for (const candidate of candidates) {
      const id = safeReadValue(candidate.entity, "id") ?? safeReadValue(candidate.entity, "entityId");
      const positionKey = candidate.position.map((value) => Math.round(value * 10)).join(",");
      const key = id !== undefined
        ? `${candidate.name}:id:${String(id)}`
        : `${candidate.name}:${positionKey}`;

      if (seen.has(key)) continue;
      seen.add(key);
      result.push(candidate);
    }

    return result;
  }

  function getRuntimeNameValueLoose(value) {
    const ownName = getRuntimeNameValue(value);
    if (ownName) return ownName;

    const keys = ["name", "playerName", "charName", "characterName", "displayName", "username", "nick", "nickname"];
    for (const key of keys) {
      const candidate = safeReadValue(value, key);
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }

    return "";
  }

  function getRuntimeWorldPosition(value) {
    const direct = parseRuntimeVector(value);
    if (direct) return { position: direct, source: "self" };

    const directX = Number(safeReadValue(value, "x"));
    const directY = Number(safeReadValue(value, "y"));
    const directZ = Number(safeReadValue(value, "z"));
    if (Number.isFinite(directX) && Number.isFinite(directY) && Number.isFinite(directZ)) {
      return { position: [directX, directY, directZ], source: "x/y/z" };
    }

    for (const key of ["visualPosition", "worldPosition", "position", "pos", "coords"]) {
      const position = parseRuntimeVector(safeReadValue(value, key));
      if (position) return { position, source: key };
    }

    for (const key of ["transform", "model", "object", "mesh", "node"]) {
      const nested = safeReadValue(value, key);
      if (!isRuntimeObject(nested)) continue;

      const nestedPosition = getRuntimeWorldPositionFromContainer(nested, key);
      if (nestedPosition) return nestedPosition;
    }

    return null;
  }

  function getRuntimeWorldPositionFromContainer(container, sourcePrefix) {
    for (const key of ["visualPosition", "worldPosition", "position", "pos", "translation"]) {
      const position = parseRuntimeVector(safeReadValue(container, key));
      if (position) return { position, source: `${sourcePrefix}.${key}` };
    }

    for (const key of ["matrix", "worldMatrix", "modelMatrix", "transform"]) {
      const matrix = parseRuntimeMatrix16(safeReadValue(container, key));
      if (matrix) return { position: [matrix[12], matrix[13], matrix[14]], source: `${sourcePrefix}.${key}` };
    }

    return null;
  }

  function getRuntimeCombatPosition(value) {
    for (const key of ["pos", "position", "worldPosition", "coords", "visualPosition"]) {
      const position = parseRuntimeVector(safeReadValue(value, key));
      if (position) return { position, source: key };
    }

    return getRuntimeWorldPosition(value);
  }

  function getRuntimeCombatRangeDistance(selfEntity, targetEntity, selfPosition, targetPosition) {
    const selfSize = getRuntimeEntityCombatSize(selfEntity);
    const targetSize = getRuntimeEntityCombatSize(targetEntity);
    const dx = Number(selfPosition[0]) - Number(targetPosition[0]);
    const dy = Math.max(0, Math.abs(Number(selfPosition[1]) - Number(targetPosition[1])) - selfSize);
    const dz = Number(selfPosition[2]) - Number(targetPosition[2]);
    const centerDistance = Math.hypot(dx, dy, dz);
    const sizePadding = selfSize + targetSize;

    return {
      distance: Math.max(0, centerDistance - sizePadding),
      centerDistance,
      selfSize,
      targetSize,
      sizePadding,
      verticalPenalty: dy,
    };
  }

  function getCorrectedRuntimeRangeDistance(selfEntity, targetEntity, selfPositionInfo, targetPositionInfo) {
    if (!selfEntity || !targetEntity || !selfPositionInfo || !targetPositionInfo) return null;

    const selfCombatPosition = getRuntimeCombatPosition(selfEntity) || selfPositionInfo;
    const targetCombatPosition = getRuntimeCombatPosition(targetEntity) || targetPositionInfo;
    if (!selfCombatPosition || !targetCombatPosition) return null;

    return getRuntimeCombatRangeDistance(
      selfEntity,
      targetEntity,
      selfCombatPosition.position,
      targetCombatPosition.position
    );
  }

  function getRuntimeEntityCombatSize(entity) {
    const size = Number(safeReadValue(entity, "size"));
    if (Number.isFinite(size) && size >= 0) return size;

    const radius = Number(safeReadValue(entity, "radius"));
    if (Number.isFinite(radius) && radius >= 0) return radius * 2;

    return 0;
  }

  function parseRuntimeVector(value) {
    if (!value) return null;

    if ((Array.isArray(value) || ArrayBuffer.isView(value)) && value.length >= 3) {
      const vector = [Number(value[0]), Number(value[1]), Number(value[2])];
      return vector.every(Number.isFinite) ? vector : null;
    }

    if (typeof value === "object") {
      const x = Number(safeReadValue(value, "x"));
      const y = Number(safeReadValue(value, "y"));
      const z = Number(safeReadValue(value, "z"));
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];

      const indexed = [Number(safeReadValue(value, "0")), Number(safeReadValue(value, "1")), Number(safeReadValue(value, "2"))];
      if (indexed.every(Number.isFinite)) return indexed;
    }

    return null;
  }

  function parseRuntimeMatrix16(value) {
    if (!value || (!Array.isArray(value) && !ArrayBuffer.isView(value)) || value.length < 16) return null;

    const matrix = Array.from(value.slice ? value.slice(0, 16) : Array.prototype.slice.call(value, 0, 16)).map(Number);
    return matrix.every(Number.isFinite) ? matrix : null;
  }

  function projectRuntimeEntityToScreen(candidate, runtime) {
    const position = candidate.position.slice();
    position[1] += getRuntimeEntityNameYOffset(candidate.entity);
    return projectRuntimePointToScreen(position, runtime);
  }

  // Incoming-warning threats (someone targeting/casting at me) are most
  // dangerous when off-screen or directly behind the camera — exactly the case
  // where projectRuntimePointToScreen returns null and the warning would be
  // dropped. For those candidates only, clamp to the nearest screen edge so the
  // warning still shows instead of silently disappearing.
  function projectRuntimeIncomingWarningPoint(candidate, runtime) {
    const onScreen = projectRuntimeEntityToScreen(candidate, runtime);
    if (onScreen) return onScreen;

    const matrix = getRuntimeProjectionMatrix(runtime);
    const rect = getRuntimeCanvasRect(runtime);
    if (!matrix || !rect || rect.width <= 0 || rect.height <= 0) return null;

    const position = candidate.position.slice();
    position[1] += getRuntimeEntityNameYOffset(candidate.entity);

    const raw = projectRuntimePointWithMatrix(position, matrix, rect, true)
      || projectRuntimePointWithMatrix(position, matrix, rect, false);
    if (!raw) return null;

    let ndcX = raw.ndcX;
    let ndcY = raw.ndcY;
    if (raw.clipW <= 0) {
      // Behind the camera the projected NDC is mirrored; flip it so the edge
      // marker sits on the side the threat is actually coming from.
      ndcX = -ndcX;
      ndcY = -ndcY;
    }

    const limit = 0.98;
    const clampedX = Math.max(-limit, Math.min(limit, ndcX));
    const clampedY = Math.max(-limit, Math.min(limit, ndcY));
    return {
      x: rect.left + (clampedX * 0.5 + 0.5) * rect.width,
      y: rect.top + (-clampedY * 0.5 + 0.5) * rect.height,
      offScreen: true,
    };
  }

  function getRuntimeEntityCanvasPoint(entity) {
    const hudPosition = parseRuntimeVector(safeReadValue(entity, "hudPos"));
    if (!hudPosition) return null;

    const x = Number(hudPosition[0]);
    const y = Number(hudPosition[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
      x,
      y,
      z: Number.isFinite(Number(hudPosition[2])) ? Number(hudPosition[2]) : null,
      source: "hudPos",
    };
  }

  function getRuntimeEntityNameYOffset(entity) {
    const explicitKeys = ["nameplateHeight", "height", "displayHeight"];
    for (const key of explicitKeys) {
      const value = Number(safeReadValue(entity, key));
      if (Number.isFinite(value) && value > 0 && value < 12) return value + 0.35;
    }

    const size = Number(safeReadValue(entity, "size") ?? safeReadValue(entity, "scale") ?? safeReadValue(entity, "radius"));
    if (Number.isFinite(size) && size > 0 && size < 8) return Math.max(1.9, size * 1.55);

    return 2.35;
  }

  function projectRuntimePointToScreen(position, runtime) {
    const matrix = getRuntimeProjectionMatrix(runtime);
    const rect = getRuntimeCanvasRect(runtime);
    if (!matrix || !rect || rect.width <= 0 || rect.height <= 0) return null;

    const columnMajor = projectRuntimePointWithMatrix(position, matrix, rect, true);
    if (isUsableProjectedPoint(columnMajor)) return columnMajor;

    const rowMajor = projectRuntimePointWithMatrix(position, matrix, rect, false);
    if (isUsableProjectedPoint(rowMajor)) return rowMajor;

    return null;
  }

  function projectRuntimePointWithMatrix(position, matrix, rect, columnMajor) {
    const x = position[0];
    const y = position[1];
    const z = position[2];
    let clipX;
    let clipY;
    let clipW;

    if (columnMajor) {
      clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
      clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
      clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    } else {
      clipX = matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3];
      clipY = matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7];
      clipW = matrix[12] * x + matrix[13] * y + matrix[14] * z + matrix[15];
    }

    if (!Number.isFinite(clipX) || !Number.isFinite(clipY) || !Number.isFinite(clipW) || Math.abs(clipW) < 0.00001) {
      return null;
    }

    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    return {
      x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
      y: rect.top + (-ndcY * 0.5 + 0.5) * rect.height,
      ndcX,
      ndcY,
      clipW,
      columnMajor,
    };
  }

  function isUsableProjectedPoint(point) {
    return (
      point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.clipW > 0 &&
      point.ndcX >= -1.35 &&
      point.ndcX <= 1.35 &&
      point.ndcY >= -1.35 &&
      point.ndcY <= 1.35
    );
  }

  function getRuntimeProjectionMatrix(runtime) {
    const camera = runtime && runtime.camera;
    if (!camera) return null;

    for (const key of ["projectionViewMatrix", "viewProjectionMatrix", "viewProjection", "projectionMatrix"]) {
      const matrix = parseRuntimeMatrix16(safeReadValue(camera, key));
      if (matrix) return matrix;
    }

    return parseRuntimeMatrix16(camera);
  }

  function getRuntimeCanvasRect(runtime) {
    const canvases = [runtime && runtime.webglCanvas, runtime && runtime.overlayCanvas]
      .filter(isVisibleCanvasElement);
    if (canvases.length > 0) return canvases[0].getBoundingClientRect();

    return getLargestCanvasRect();
  }

  function getLargestCanvasRect() {
    const canvases = Array.from(document.querySelectorAll("canvas"))
      .map((canvas) => ({ canvas, rect: canvas.getBoundingClientRect() }))
      .filter((item) => item.rect.width > 0 && item.rect.height > 0)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

    return canvases[0] ? canvases[0].rect : null;
  }

  function isVisibleCanvasElement(value) {
    const CanvasElement = pageWindow.HTMLCanvasElement;
    return !!(CanvasElement && value instanceof CanvasElement && value.isConnected && value.getBoundingClientRect().width > 0);
  }

  // ===== Danger-zone overlay (boss floor AoE on the 3D screen) =====
  // Enemy ground AoEs are type-11 mesh decals carrying a netDeletion timer (~2s) before
  // they resolve. We project each pending decal's ground position onto the screen and draw
  // a red ring — so a wall pattern shows as a row of rings and the SAFE GAP is the empty
  // spot you can move into. No safe-spot guessing; you read it directly off the screen.
  // DANGER_OVERLAY_STATE is declared up near COMBAT_ASSIST_STATE (needed before boot).
  const DANGER_OVERLAY_MAX = 80;          // marker cap per frame
  const DANGER_OVERLAY_LEAD_S = 4;        // show decals resolving within this many seconds
  const DANGER_OVERLAY_RANGE_M = 55;      // ignore decals farther than this (cuts decor/noise)
  const DANGER_OVERLAY_WORLD_RADIUS = 3;  // fallback AoE radius (world units) for ring sizing

  function isDangerOverlayEnabled() {
    return FEATURE_CONFIG.dangerOverlayEnabled !== false;
  }

  function ensureDangerOverlayStyle() {
    if (DANGER_OVERLAY_STATE.styleInstalled || document.getElementById("hordes-kr-danger-style")) {
      DANGER_OVERLAY_STATE.styleInstalled = true;
      return;
    }
    const style = document.createElement("style");
    style.id = "hordes-kr-danger-style";
    style.textContent = [
      "#hordes-kr-danger-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483540;overflow:hidden}",
      "#hordes-kr-danger-overlay .hkr-danger{position:absolute;transform:translate(-50%,-50%);border-radius:50%;border:3px solid rgba(255,45,45,0.95);background:radial-gradient(closest-side,rgba(255,30,30,0.30),rgba(255,30,30,0.12) 70%,transparent);box-shadow:0 0 11px rgba(255,30,30,0.65),inset 0 0 14px rgba(255,70,70,0.5)}",
      "#hordes-kr-danger-overlay .hkr-danger.soon{border-color:rgba(255,210,40,0.95);background:radial-gradient(closest-side,rgba(255,200,40,0.22),rgba(255,200,40,0.08) 70%,transparent);box-shadow:0 0 9px rgba(255,200,40,0.55)}",
      "#hordes-kr-danger-overlay .hkr-danger.imminent{animation:hkrDangerPulse 0.3s ease-in-out infinite}",
      "@keyframes hkrDangerPulse{0%,100%{border-color:rgba(255,45,45,1);box-shadow:0 0 11px rgba(255,30,30,0.7),inset 0 0 14px rgba(255,70,70,0.5)}50%{border-color:rgba(255,255,255,0.98);box-shadow:0 0 18px rgba(255,90,90,0.95),inset 0 0 16px rgba(255,120,120,0.6)}}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
    DANGER_OVERLAY_STATE.styleInstalled = true;
  }

  function ensureDangerOverlayHost() {
    if (DANGER_OVERLAY_STATE.host && document.contains(DANGER_OVERLAY_STATE.host)) return DANGER_OVERLAY_STATE.host;
    if (!document.body) return null;
    ensureDangerOverlayStyle();
    const host = document.createElement("div");
    host.id = "hordes-kr-danger-overlay";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    DANGER_OVERLAY_STATE.host = host;
    DANGER_OVERLAY_STATE.markers = new Map();
    return host;
  }

  function clearDangerOverlay() {
    if (DANGER_OVERLAY_STATE.host) DANGER_OVERLAY_STATE.host.replaceChildren();
    if (DANGER_OVERLAY_STATE.markers) DANGER_OVERLAY_STATE.markers.clear();
  }

  function updateDangerOverlay() {
    if (!isDangerOverlayEnabled()) {
      if (DANGER_OVERLAY_STATE.markers && DANGER_OVERLAY_STATE.markers.size) clearDangerOverlay();
      return;
    }
    const runtime = getExposedRuntime();
    const engine = runtime && runtime.engine;
    const me = engine && engine.player;
    if (!me || !getRuntimeProjectionMatrix(runtime)) {
      if (DANGER_OVERLAY_STATE.markers && DANGER_OVERLAY_STATE.markers.size) clearDangerOverlay();
      return;
    }
    const arr = engine.entities && engine.entities.array;
    const now = typeof engine.time === "number" ? engine.time : null;
    if (!arr || now === null) return;
    const host = ensureDangerOverlayHost();
    if (!host) return;

    const mp = me.pos || me.visualPosition;
    const markers = DANGER_OVERLAY_STATE.markers;
    const live = new Set();
    let shown = 0;
    for (const e of arr) {
      if (!e || e.type !== 11) continue;
      const del = e.netDeletion;
      const end = del && typeof del.end === "number" ? del.end : null;
      if (end === null) continue;
      const remain = end - now;
      if (remain <= 0 || remain > DANGER_OVERLAY_LEAD_S) continue;
      const pos = e.pos;
      if (!pos) continue;
      if (mp) {
        const d = Math.hypot(pos[0] - mp[0], pos[2] - mp[2]);
        if (d > DANGER_OVERLAY_RANGE_M) continue;
      }
      const pt = projectRuntimePointToScreen(pos, runtime);
      if (!pt) continue;
      // perspective-correct ring size: project points offset by the AoE world radius on
      // both ground axes and take the larger screen delta.
      const wr = Math.max(Number(e.radius) || 0, DANGER_OVERLAY_WORLD_RADIUS);
      let rad = 0;
      const px1 = projectRuntimePointToScreen([pos[0] + wr, pos[1], pos[2]], runtime);
      const px2 = projectRuntimePointToScreen([pos[0], pos[1], pos[2] + wr], runtime);
      if (px1) rad = Math.max(rad, Math.hypot(px1.x - pt.x, px1.y - pt.y));
      if (px2) rad = Math.max(rad, Math.hypot(px2.x - pt.x, px2.y - pt.y));
      const size = rad > 0 ? Math.max(18, Math.min(520, rad * 2)) : 36;

      const key = String(e.id);
      live.add(key);
      let mk = markers.get(key);
      if (!mk) {
        mk = document.createElement("div");
        mk.className = "hkr-danger";
        host.appendChild(mk);
        markers.set(key, mk);
      }
      const cls = remain < 0.6 ? "hkr-danger imminent" : (remain > 2 ? "hkr-danger soon" : "hkr-danger");
      if (mk.className !== cls) mk.className = cls;
      mk.style.left = `${Math.round(pt.x)}px`;
      mk.style.top = `${Math.round(pt.y)}px`;
      mk.style.width = `${Math.round(size)}px`;
      mk.style.height = `${Math.round(size)}px`;
      if (++shown >= DANGER_OVERLAY_MAX) break;
    }
    for (const [key, mk] of markers) {
      if (live.has(key)) continue;
      mk.remove();
      markers.delete(key);
    }
  }

  function startDangerOverlayLoop() {
    if (DANGER_OVERLAY_STATE.rafId) return;
    const tick = () => {
      DANGER_OVERLAY_STATE.rafId = pageWindow.requestAnimationFrame(tick);
      try { updateDangerOverlay(); } catch { /* overlay best-effort */ }
    };
    DANGER_OVERLAY_STATE.rafId = pageWindow.requestAnimationFrame(tick);
  }

  function getExposedRuntime() {
    try {
      const runtime = pageWindow.__HORDES_KR_RUNTIME__ || null;
      refreshRuntimeEntityReferences(runtime);
      return runtime;
    } catch {
      return null;
    }
  }

  function refreshRuntimeEntityReferences(runtime) {
    if (!runtime) return;

    const engine = safeReadValue(runtime, "engine");
    const player = findRuntimePlayerReference(runtime, engine);
    if (player) {
      runtime.player = player;

      const target = findRuntimeTargetReference(runtime, player);
      if (target) runtime.target = target;
    }
  }

  function findRuntimePlayerReference(runtime, engine) {
    for (const container of [runtime, engine]) {
      if (!isRuntimeObject(container)) continue;

      for (const key of ["player", "localPlayer", "myPlayer", "character", "hero", "avatar", "controlledEntity"]) {
        const value = safeReadValue(container, key);
        if (isRuntimeObject(value)) return value;
      }
    }

    const byConfiguredName = findRuntimeEntityByConfiguredHighlightNames(runtime);
    if (byConfiguredName) return byConfiguredName.entity;

    return null;
  }

  function findRuntimeTargetReference(runtime, player) {
    for (const container of [runtime, player]) {
      if (!isRuntimeObject(container)) continue;

      for (const key of ["target", "targetUnit", "targetEntity", "selectedTarget", "selectedEntity", "currentTarget", "attackTarget", "focusTarget", "enemyTarget"]) {
        const value = safeReadValue(container, key);
        const resolved = resolveRuntimeEntityReference(value, runtime, `${container === runtime ? "runtime" : "player"}.${key}`, player);
        if (resolved) return resolved.entity;
      }
    }

    return null;
  }

  function getExposedRuntimeSummary() {
    const runtime = getExposedRuntime();
    if (!runtime) {
      return {
        exposed: false,
      };
    }

    const rect = getRuntimeCanvasRect(runtime);
    return {
      exposed: true,
      keys: safeOwnKeys(runtime),
      hasEngine: !!runtime.engine,
      hasPlayer: !!runtime.player,
      hasTarget: !!runtime.target,
      hasSkillStore: Boolean(runtime.skillStores && runtime.skillStores.active),
      hasActiveSkillGetter: typeof safeReadValue(runtime, "getActiveSkillConfig") === "function",
      hasCamera: !!runtime.camera,
      hasProjectionMatrix: !!getRuntimeProjectionMatrix(runtime),
      hasWebglCanvas: isVisibleCanvasElement(runtime.webglCanvas),
      hasOverlayCanvas: isVisibleCanvasElement(runtime.overlayCanvas),
      hasTargetController: typeof safeReadValue(runtime, "changeTarget") === "function",
      hasHoverTargetController: typeof safeReadValue(runtime, "setHoverTarget") === "function",
      clientTargetState: summarizeRuntimeTargetControllerState(getRuntimeTargetControllerState(runtime)),
      minimap: summarizeRuntimeMinimap(runtime),
      canvas: rect
        ? {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
      updatedAgoMs: Number.isFinite(runtime.updatedAt) ? Date.now() - runtime.updatedAt : null,
      patchedBy: runtime.patchedBy || "",
      patchedVersion: runtime.patchedVersion || "",
      patchedSource: runtime.patchedSource || "",
      hookHits: runtime.hookHits || null,
      hookErrors: Array.isArray(runtime.hookErrors) ? runtime.hookErrors.slice(-8) : [],
      frameLoopSeenAgoMs: Number.isFinite(runtime.frameLoopSeenAt) ? Date.now() - runtime.frameLoopSeenAt : null,
      debug: summarizeRuntimeDebug(runtime),
    };
  }

  function getRuntimeDebugReport() {
    const runtime = getExposedRuntime();
    return {
      version: MOD_VERSION,
      scriptHook: getScriptHookDiagnosticSummary(),
      runtime: getExposedRuntimeSummary(),
      targetDistance: getTargetDistance(true),
      engine: summarizeRuntimeObjectForDebug(runtime && runtime.engine),
      player: summarizeRuntimeObjectForDebug(runtime && runtime.player),
      target: summarizeRuntimeObjectForDebug(runtime && runtime.target),
    };
  }

  function stringifyRuntimeDebugReport() {
    return JSON.stringify(getRuntimeDebugReport(), null, 2);
  }

  function runRuntimeProbeNow() {
    try {
      const probe = pageWindow.__HORDES_KR_RUNTIME_PROBE_NOW__;
      if (typeof probe === "function") probe();
    } catch {
      // Manual probe is diagnostic only.
    }
  }

  function getScriptHookDiagnosticSummary() {
    const patchedScripts = [...HIGHLIGHT_STATE.scriptHookPatchedScripts];
    const patchNames = [...new Set(patchedScripts.flatMap((script) => Array.isArray(script.patches) ? script.patches : []))];
    const expected = [
      "client-runtime-probe",
      "client-engine-setter",
      "client-render-state",
      "client-engine-tick",
      "client-prototype-runtime",
      "client-skill-runtime",
    ];

    return {
      attemptedScripts: [...HIGHLIGHT_STATE.scriptHookAttemptedScripts],
      patchedScripts,
      patchNames,
      missingExpectedPatches: expected.filter((name) => !patchNames.includes(name)),
      errors: [...HIGHLIGHT_STATE.scriptHookErrors],
      onloadGuard: getClientOnloadGuardSummary(),
    };
  }

  function getClientOnloadGuardSummary() {
    const state = pageWindow.__hordesKrClientOnloadGuardState;
    return {
      installed: Boolean(pageWindow.__hordesKrClientOnloadGuardInstalled),
      hasPatchedOnload: Boolean(state && state.patchedOnload),
      hasOriginalOnload: Boolean(state && state.lastOriginalOnload),
      assignments: state && Array.isArray(state.assignments) ? [...state.assignments] : [],
    };
  }

  function summarizeRuntimeDebug(runtime) {
    const debug = runtime && isRuntimeObject(runtime.debug) ? runtime.debug : null;
    return {
      debugKeys: debug ? safeOwnKeys(debug).slice(0, 40) : [],
      frameLoopAtAgoMs: debug && Number.isFinite(debug.frameLoopAt) ? Date.now() - debug.frameLoopAt : null,
      frameLoopIType: debug ? debug.frameLoopIType || "" : "",
      frameLoopIConstructor: debug ? debug.frameLoopIConstructor || "" : "",
      frameLoopIKeys: debug && Array.isArray(debug.frameLoopIKeys) ? debug.frameLoopIKeys : [],
      runtimeProbeAtAgoMs: debug && Number.isFinite(debug.runtimeProbeAt)
        ? Date.now() - debug.runtimeProbeAt
        : null,
      runtimeProbeIType: debug ? debug.runtimeProbeIType || "" : "",
      runtimeProbeIConstructor: debug ? debug.runtimeProbeIConstructor || "" : "",
      runtimeProbeIKeys: debug && Array.isArray(debug.runtimeProbeIKeys) ? debug.runtimeProbeIKeys : [],
      runtimeProbeEngineReadError: debug ? debug.runtimeProbeEngineReadError || "" : "",
      clientEngineSetterAtAgoMs: debug && Number.isFinite(debug.clientEngineSetterAt)
        ? Date.now() - debug.clientEngineSetterAt
        : null,
      clientEngineSetterKeys: debug && Array.isArray(debug.clientEngineSetterKeys) ? debug.clientEngineSetterKeys : [],
      clientOnloadAtAgoMs: debug && Number.isFinite(debug.clientOnloadAt)
        ? Date.now() - debug.clientOnloadAt
        : null,
      clientOnloadEngineKeys: debug && Array.isArray(debug.clientOnloadEngineKeys) ? debug.clientOnloadEngineKeys : [],
      prototypePatchAtAgoMs: debug && Number.isFinite(debug.prototypePatchAt)
        ? Date.now() - debug.prototypePatchAt
        : null,
      prototypePatchFhType: debug ? debug.prototypePatchFhType || "" : "",
      prototypePatchFhKeys: debug && Array.isArray(debug.prototypePatchFhKeys) ? debug.prototypePatchFhKeys : [],
      prototypeEngineKeys: debug && Array.isArray(debug.prototypeEngineKeys) ? debug.prototypeEngineKeys : [],
      prototypeTickAtAgoMs: debug && Number.isFinite(debug.prototypeTickAt)
        ? Date.now() - debug.prototypeTickAt
        : null,
      prototypeSetPlayerAtAgoMs: debug && Number.isFinite(debug.prototypeSetPlayerAt)
        ? Date.now() - debug.prototypeSetPlayerAt
        : null,
      prototypeSetStateAtAgoMs: debug && Number.isFinite(debug.prototypeSetStateAt)
        ? Date.now() - debug.prototypeSetStateAt
        : null,
      engineReadError: debug ? debug.engineReadError || "" : "",
      playerReadError: debug ? debug.playerReadError || "" : "",
      targetReadError: debug ? debug.targetReadError || "" : "",
    };
  }

  function summarizeRuntimeObjectForDebug(value) {
    if (!isRuntimeObject(value)) return null;

    const position = getRuntimeWorldPosition(value);
    return {
      summary: describeRuntimeValue(value),
      name: getRuntimeNameValueLoose(value),
      id: getRuntimeEntityId(value),
      position: position ? position.position.map(roundCoord) : null,
      positionSource: position ? position.source : "",
      keys: safeOwnKeys(value).slice(0, 80),
    };
  }

  function getRuntimeOverlayStatus() {
    return {
      enabled: HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.runtimeOverlayEnabled,
      installed: !!HIGHLIGHT_STATE.runtimeOverlayTimer,
      host: !!HIGHLIGHT_STATE.runtimeOverlayHost,
      labels: HIGHLIGHT_STATE.runtimeOverlayItems.size,
      hits: HIGHLIGHT_STATE.runtimeOverlayHits,
      lastAt: HIGHLIGHT_STATE.lastRuntimeOverlayAt
        ? new Date(HIGHLIGHT_STATE.lastRuntimeOverlayAt).toISOString()
        : null,
      lastError: HIGHLIGHT_STATE.lastRuntimeOverlayError,
      lastMatches: [...HIGHLIGHT_STATE.lastRuntimeOverlayMatches],
      incomingSkill: {
        enabled: isIncomingSkillOverlayEnabled(),
        friendlyFiltered: true,
        hits: HIGHLIGHT_STATE.incomingSkillOverlayHits,
        lastAt: HIGHLIGHT_STATE.lastIncomingSkillOverlayAt
          ? new Date(HIGHLIGHT_STATE.lastIncomingSkillOverlayAt).toISOString()
          : null,
        lastError: HIGHLIGHT_STATE.lastIncomingSkillOverlayError,
        lastMatches: [...HIGHLIGHT_STATE.lastIncomingSkillOverlayMatches],
        list: {
          enabled: false,
          host: false,
          hits: 0,
          lastAt: null,
          lastError: "",
          lastMatches: [],
        },
      },
      incomingTargetWatch: {
        enabled: isIncomingTargetWatchEnabled(),
        friendlyFiltered: true,
        hits: HIGHLIGHT_STATE.incomingTargetWatchHits,
        lastAt: HIGHLIGHT_STATE.lastIncomingTargetWatchAt
          ? new Date(HIGHLIGHT_STATE.lastIncomingTargetWatchAt).toISOString()
          : null,
        lastError: HIGHLIGHT_STATE.lastIncomingTargetWatchError,
        lastMatches: [...HIGHLIGHT_STATE.lastIncomingTargetWatchMatches],
      },
      runtime: getExposedRuntimeSummary(),
    };
  }

  function collectRuntimeOverlayEntitySummaries(names) {
    return collectRuntimeOverlayEntities(names, {
      limit: 20,
      maxDepth: 7,
      maxObjects: 9000,
    }).map((candidate) => ({
      name: candidate.name,
      matchedName: candidate.matchedName,
      path: candidate.path,
      position: candidate.position.map(roundCoord),
      positionSource: candidate.positionSource,
      score: candidate.score,
    }));
  }

  function countDomHighlightElements() {
    try {
      return document.querySelectorAll(".hordes-kr-name-highlight").length;
    } catch {
      return 0;
    }
  }

  function inspectRuntimeForNameplates(name) {
    const names = getInspectionNames(name);
    const report = {
      version: MOD_VERSION,
      url: location.href,
      readyState: document.readyState,
      names,
      highlight: getHighlightStatus(),
      canvases: getCanvasReport(),
      domMatches: collectDomNameMatches(names, 20),
      windowKeys: collectInterestingWindowKeys(120),
      runtimeOverlayCandidates: collectRuntimeOverlayEntitySummaries(names),
      candidates: findRuntimeNameCandidates(name, { limit: 40, maxDepth: 3, maxObjects: 3500 }),
    };

    console.info("[Hordes KR Mod] Runtime inspection", report);
    if (report.candidates.length > 0) {
      console.table(report.candidates.map((candidate) => ({
        path: candidate.path,
        name: candidate.name,
        position: candidate.position,
        shape: candidate.shape,
      })));
    }
    return report;
  }

  function getInspectionNames(name) {
    const explicit = normalizeHighlightName(name);
    return explicit ? [explicit] : [...getHighlightNameCache().names];
  }

  function getCanvasReport() {
    return Array.from(document.querySelectorAll("canvas")).map((canvas, index) => ({
      index,
      selector: getElementSelector(canvas),
      parent: canvas.parentElement ? getElementSelector(canvas.parentElement) : "",
      width: canvas.width,
      height: canvas.height,
      clientWidth: Math.round(canvas.getBoundingClientRect().width),
      clientHeight: Math.round(canvas.getBoundingClientRect().height),
      className: String(canvas.className || ""),
      id: canvas.id || "",
    }));
  }

  function collectDomNameMatches(names, limit) {
    const matcher = buildNameMatcherForNames(names);
    if (!matcher || !document.body) return [];

    const matches = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (matches.length >= limit) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !matcher.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        matcher.lastIndex = 0;
        return shouldSkipHighlightNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node && matches.length < limit) {
      matches.push({
        selector: getElementSelector(node.parentElement),
        text: normalizeText(node.nodeValue).slice(0, 120),
      });
      node = walker.nextNode();
    }

    return matches;
  }

  function buildNameMatcherForNames(names) {
    const normalized = names.map(normalizeHighlightName).filter(Boolean).sort((a, b) => b.length - a.length);
    return normalized.length > 0 ? new RegExp(normalized.map(escapeRegExp).join("|"), "gi") : null;
  }

  function collectInterestingWindowKeys(limit) {
    const keyPattern = /horde|game|world|scene|render|entity|entities|player|players|nameplate|unit|camera|engine|client|network|socket|target/i;
    const keys = safeOwnKeys(pageWindow).filter((key) => keyPattern.test(key));
    const result = [];

    for (const key of keys) {
      if (result.length >= limit) break;
      const descriptor = safeGetDescriptor(pageWindow, key);
      if (!descriptor) continue;

      if ("value" in descriptor) {
        result.push({
          key,
          summary: describeRuntimeValue(descriptor.value),
        });
      } else {
        result.push({
          key,
          summary: "[getter]",
        });
      }
    }

    return result;
  }

  function findRuntimeNameCandidates(name, options = {}) {
    const names = getInspectionNames(name).map((value) => value.toLowerCase());
    const limit = options.limit || 50;
    const maxDepth = options.maxDepth || 3;
    const maxObjects = options.maxObjects || 3000;
    const candidates = [];
    const queue = [{ value: pageWindow, path: "window", depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;

    for (let cursor = 0; cursor < queue.length && visited < maxObjects && candidates.length < limit; cursor++) {
      const item = queue[cursor];
      const value = item.value;
      if (!isRuntimeObject(value) || seen.has(value)) continue;

      seen.add(value);
      visited++;

      if (item.depth > 0) {
        const candidate = summarizeRuntimeCandidate(value, item.path, names);
        if (candidate) candidates.push(candidate);
      }

      if (item.depth >= maxDepth) continue;
      const children = getRuntimeChildren(value, item.path, item.depth === 0 ? 500 : 80);
      children.forEach((child) => queue.push({ ...child, depth: item.depth + 1 }));
    }

    return candidates;
  }

  function summarizeRuntimeCandidate(value, path, names) {
    const name = getRuntimeNameValue(value);
    if (!name) return null;

    const lowerName = name.toLowerCase();
    const matched = names.length === 0 || names.some((target) => lowerName.includes(target));
    const position = getRuntimePositionSummary(value);
    const keys = safeOwnKeys(value).slice(0, 30);
    const shape = keys.filter((key) => /id|entity|player|target|faction|class|level|health|hp|mana|pos|position|x|y|z/i.test(key)).slice(0, 12);

    if (!matched && !position && shape.length === 0) return null;

    return {
      path,
      name,
      matched,
      position,
      shape,
      keys,
      summary: describeRuntimeValue(value),
    };
  }

  function getRuntimeNameValue(value) {
    const keys = ["name", "playerName", "charName", "characterName", "displayName", "username", "nick", "nickname"];
    for (const key of keys) {
      const candidate = safeReadOwnValue(value, key);
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
  }

  function getRuntimePositionSummary(value) {
    const directX = safeReadOwnValue(value, "x");
    const directY = safeReadOwnValue(value, "y");
    const directZ = safeReadOwnValue(value, "z");
    if (Number.isFinite(directX) && Number.isFinite(directY)) {
      return `x:${roundCoord(directX)} y:${roundCoord(directY)}${Number.isFinite(directZ) ? ` z:${roundCoord(directZ)}` : ""}`;
    }

    for (const key of ["pos", "position", "worldPosition", "coords"]) {
      const position = safeReadOwnValue(value, key);
      const summary = summarizePositionValue(position);
      if (summary) return `${key} ${summary}`;
    }

    return "";
  }

  function summarizePositionValue(position) {
    if (!position) return "";
    if (Array.isArray(position) && position.length >= 2) {
      return `[${position.slice(0, 3).map(roundCoord).join(", ")}]`;
    }

    if (typeof position === "object") {
      const x = safeReadOwnValue(position, "x");
      const y = safeReadOwnValue(position, "y");
      const z = safeReadOwnValue(position, "z");
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return `{x:${roundCoord(x)} y:${roundCoord(y)}${Number.isFinite(z) ? ` z:${roundCoord(z)}` : ""}}`;
      }
    }

    return "";
  }

  function roundCoord(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
  }

  function getRuntimeChildren(value, path, limit) {
    const children = [];
    forEachRuntimeChild(value, path, limit, (childValue, childPath) => {
      children.push({ value: childValue, path: childPath });
      return true;
    });
    return children;
  }

  function forEachRuntimeChild(value, path, limit, visit) {
    if (!isRuntimeTraversable(value, path)) return;

    if (Array.isArray(value)) {
      const length = Math.min(value.length, limit);
      for (let index = 0; index < length; index++) {
        const child = value[index];
        if (isRuntimeObject(child) && visit(child, `${path}[${index}]`) === false) break;
      }
      return;
    }

    if (value instanceof Map || value instanceof Set) {
      let index = 0;
      for (const entry of value.values()) {
        if (index >= limit) break;
        if (isRuntimeObject(entry) && visit(entry, `${path}.${value instanceof Map ? "map" : "set"}[${index}]`) === false) break;
        index++;
      }
      return;
    }

    let visited = 0;
    for (const key of safeOwnKeys(value)) {
      if (visited >= limit) break;
      if (shouldSkipRuntimeKey(key)) continue;

      const child = safeReadOwnValue(value, key);
      if (isRuntimeObject(child) && isRuntimeTraversable(child, `${path}.${key}`)) {
        visited++;
        if (visit(child, `${path}.${key}`) === false) break;
      }
    }
  }

  function shouldSkipRuntimeKey(key) {
    return (
      key === "window" ||
      key === "self" ||
      key === "top" ||
      key === "parent" ||
      key === "frames" ||
      key === "document" ||
      key === "localStorage" ||
      key === "sessionStorage" ||
      key === "navigator" ||
      key === "location" ||
      key === "history" ||
      key === "performance" ||
      key === "console" ||
      key.startsWith("on")
    );
  }

  function isRuntimeObject(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }

  function isRuntimeTraversable(value, path) {
    if (!isRuntimeObject(value)) return false;
    if (value === pageWindow) return path === "window";
    if (value === document) return false;

    const NodeCtor = pageWindow.Node;
    if (NodeCtor && value instanceof NodeCtor) return false;
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false;

    const tag = Object.prototype.toString.call(value);
    return !/\b(Date|RegExp|Error|Promise|WeakMap|WeakSet|Storage|Location|Navigator|History|Screen|Performance|CSSStyleDeclaration|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext)\b/.test(tag);
  }

  function describeRuntimeValue(value) {
    if (value === null) return "null";
    const type = typeof value;
    if (type !== "object" && type !== "function") return type;

    const tag = Object.prototype.toString.call(value).replace(/^\[object |\]$/g, "");
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Map) return `Map(${value.size})`;
    if (value instanceof Set) return `Set(${value.size})`;
    const keys = safeOwnKeys(value).slice(0, 8);
    return `${tag}${keys.length ? ` {${keys.join(", ")}}` : ""}`;
  }

  function safeOwnKeys(value) {
    try {
      return Object.getOwnPropertyNames(value);
    } catch {
      return [];
    }
  }

  function safeGetDescriptor(value, key) {
    try {
      return Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
  }

  function safeReadOwnValue(value, key) {
    const descriptor = safeGetDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return undefined;
    return descriptor.value;
  }

  function safeReadValue(value, key) {
    try {
      return value ? value[key] : undefined;
    } catch {
      return undefined;
    }
  }

  function getCachedDeepRuntimeSearch(cacheKey, searchFn) {
    const now = Date.now();
    const cache = TARGET_DISTANCE_STATE.deepSearchCache;
    const cached = cache.get(cacheKey);
    if (cached && now - cached.at < TARGET_DISTANCE_DEEP_SEARCH_CACHE_MS) {
      return cached.result;
    }

    const result = searchFn();
    cache.set(cacheKey, { at: now, result });
    trimDeepRuntimeSearchCache();
    return result;
  }

  function trimDeepRuntimeSearchCache() {
    const cache = TARGET_DISTANCE_STATE.deepSearchCache;
    if (cache.size <= TARGET_DISTANCE_DEEP_SEARCH_CACHE_MAX) return;

    const overflow = cache.size - TARGET_DISTANCE_DEEP_SEARCH_CACHE_MAX;
    let removed = 0;
    for (const key of cache.keys()) {
      cache.delete(key);
      removed++;
      if (removed >= overflow) break;
    }
  }

  function clearDeepRuntimeSearchCache() {
    TARGET_DISTANCE_STATE.deepSearchCache.clear();
  }

  function getTargetDistance(force = false) {
    const now = Date.now();
    if (
      !force &&
      TARGET_DISTANCE_STATE.lastResult &&
      now - TARGET_DISTANCE_STATE.lastAt < TARGET_DISTANCE_CACHE_MS
    ) {
      return TARGET_DISTANCE_STATE.lastResult;
    }

    const result = calculateTargetDistance();
    TARGET_DISTANCE_STATE.lastAt = now;
    TARGET_DISTANCE_STATE.lastResult = result;
    return result;
  }

  function calculateTargetDistance() {
    const runtime = getExposedRuntime();
    if (!runtime) return getUnavailableTargetDistance("런타임을 찾지 못했습니다.");

    const self = findLocalPlayerEntity(runtime);
    if (!self) return getUnavailableTargetDistance("내 캐릭터 객체를 찾지 못했습니다.");

    const selfPosition = getRuntimeWorldPosition(self.entity);
    if (!selfPosition) return getUnavailableTargetDistance("내 캐릭터 좌표를 찾지 못했습니다.");

    const target = findLockedTargetEntity(runtime, self.entity)
      || findSelectedTargetEntity(runtime, self.entity)
      || findTrackedTargetEntity(runtime, self.entity);
    if (!target) return getUnavailableTargetDistance("타겟 객체를 찾지 못했습니다.");

    const targetPosition = getRuntimeWorldPosition(target.entity);
    if (!targetPosition) return getUnavailableTargetDistance("타겟 좌표를 찾지 못했습니다.");

    const selfCombatPosition = getRuntimeCombatPosition(self.entity) || selfPosition;
    const targetCombatPosition = getRuntimeCombatPosition(target.entity) || targetPosition;
    const rangeDistance = getRuntimeCombatRangeDistance(
      self.entity,
      target.entity,
      selfCombatPosition.position,
      targetCombatPosition.position
    );
    const visualHorizontalDistance = getHorizontalRuntimeDistance(selfPosition.position, targetPosition.position);
    const visualDistance3d = getRuntimeVectorDistance(selfPosition.position, targetPosition.position);
    const targetScreen = projectRuntimeEntityToScreen(
      {
        entity: target.entity,
        position: targetPosition.position,
      },
      runtime
    );
    const targetCanvas = getRuntimeEntityCanvasPoint(target.entity);
    const targetSnapshot = rememberTargetDistanceEntity(target, targetPosition, targetCombatPosition);
    const staleAgeMs = target.snapshot && Number.isFinite(target.snapshot.savedAt)
      ? Date.now() - target.snapshot.savedAt
      : null;

    return {
      available: true,
      stale: Boolean(target.stale),
      staleAgeMs,
      distance: roundCoord(rangeDistance.distance),
      distance3d: roundCoord(visualDistance3d),
      units: "gameRange",
      centerDistance: roundCoord(rangeDistance.centerDistance),
      visualDistance: roundCoord(visualHorizontalDistance),
      tracking: {
        source: target.source,
        locked: Boolean(target.locked),
        stale: Boolean(target.stale),
        lastKnownAt: targetSnapshot ? targetSnapshot.savedAt : null,
      },
      rangeModel: {
        source: "combatRangeCheck",
        selfSize: roundCoord(rangeDistance.selfSize),
        targetSize: roundCoord(rangeDistance.targetSize),
        sizePadding: roundCoord(rangeDistance.sizePadding),
        verticalPenalty: roundCoord(rangeDistance.verticalPenalty),
        combatPositionSource: {
          self: selfCombatPosition.source,
          target: targetCombatPosition.source,
        },
      },
      self: {
        name: getRuntimeEntityLabel(self.entity),
        path: self.path,
        position: selfCombatPosition.position.map(roundCoord),
        positionSource: selfCombatPosition.source,
        visualPosition: selfPosition.position.map(roundCoord),
        visualPositionSource: selfPosition.source,
      },
      target: {
        name: getRuntimeEntityLabel(target.entity),
        path: target.path,
        position: targetCombatPosition.position.map(roundCoord),
        positionSource: targetCombatPosition.source,
        visualPosition: targetPosition.position.map(roundCoord),
        visualPositionSource: targetPosition.source,
        referenceSource: target.source,
        stale: Boolean(target.stale),
        staleAgeMs,
        screen: targetScreen
          ? {
              x: roundCoord(targetScreen.x),
              y: roundCoord(targetScreen.y),
            }
          : null,
        canvas: targetCanvas
          ? {
              x: roundCoord(targetCanvas.x),
              y: roundCoord(targetCanvas.y),
              source: targetCanvas.source,
            }
          : null,
      },
    };
  }

  function getUnavailableTargetDistance(reason) {
    return {
      available: false,
      reason,
      distance: null,
      distance3d: null,
      units: "world",
    };
  }

  function rememberTargetDistanceEntity(target, targetPosition, targetCombatPosition) {
    if (!target || !isRuntimeObject(target.entity)) return null;

    if (target.stale && target.snapshot) return target.snapshot;

    const snapshot = createTargetDistanceSnapshot(target.entity, target.path, target.source, targetPosition, targetCombatPosition);
    if (!snapshot) return null;

    TARGET_DISTANCE_STATE.lastSelectedTarget = snapshot;
    if (isSameTargetDistanceSnapshot(TARGET_DISTANCE_STATE.lockedTarget, snapshot)) {
      TARGET_DISTANCE_STATE.lockedTarget = {
        ...snapshot,
        lockedAt: TARGET_DISTANCE_STATE.lockedTarget.lockedAt || Date.now(),
        locked: true,
      };
    }
    return snapshot;
  }

  function createTargetDistanceSnapshot(entity, path, source, worldPosition, combatPosition) {
    const visual = worldPosition || getRuntimeWorldPosition(entity);
    const combat = combatPosition || getRuntimeCombatPosition(entity) || visual;
    if (!visual || !combat) return null;

    const id = getRuntimeEntityId(entity);
    const name = getRuntimeEntityLabel(entity);
    const rawSize = safeReadValue(entity, "size");
    const rawRadius = safeReadValue(entity, "radius");
    const size = Number(rawSize);
    const radius = Number(rawRadius);

    return {
      id: id !== undefined ? String(id) : "",
      name,
      path: path || "",
      source: source || path || "",
      position: combat.position.slice(0, 3),
      positionSource: combat.source,
      visualPosition: visual.position.slice(0, 3),
      visualPositionSource: visual.source,
      size: rawSize !== null && rawSize !== undefined && Number.isFinite(size) ? size : null,
      radius: rawRadius !== null && rawRadius !== undefined && Number.isFinite(radius) ? radius : null,
      savedAt: Date.now(),
    };
  }

  function createTargetEntityFromSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.position) || snapshot.position.length < 3) return null;

    return {
      id: snapshot.id || undefined,
      name: snapshot.name || "target",
      pos: snapshot.position.slice(0, 3),
      position: snapshot.position.slice(0, 3),
      visualPosition: Array.isArray(snapshot.visualPosition)
        ? snapshot.visualPosition.slice(0, 3)
        : snapshot.position.slice(0, 3),
      size: snapshot.size,
      radius: snapshot.radius,
      __hordesKrTargetSnapshot: true,
    };
  }

  function createTargetIdSnapshot(id, name, source) {
    const normalizedId = normalizeRuntimeEntityId(id);
    if (!normalizedId) return null;

    const normalizedName = normalizeHighlightName(name);
    return {
      id: normalizedId,
      name: normalizedName || `id:${normalizedId}`,
      path: "",
      source: source || "targetId",
      position: null,
      positionSource: "",
      visualPosition: null,
      visualPositionSource: "",
      size: null,
      radius: null,
      idOnly: true,
      savedAt: Date.now(),
    };
  }

  function findLockedTargetEntity(runtime, selfEntity) {
    const locked = TARGET_DISTANCE_STATE.lockedTarget;
    if (!locked) return null;

    const live = findLiveTargetFromSnapshot(runtime, locked, selfEntity);
    if (live) return { ...live, source: "lockedTarget", locked: true };

    return createTrackedTargetFromSnapshot(locked, "lockedTarget:lastKnown", true);
  }

  function findTrackedTargetEntity(runtime, selfEntity) {
    const selectedId = getSelectedTargetId(runtime, selfEntity);
    if (selectedId && selectedId.id !== "") {
      const byId = findRuntimeEntityById(runtime, selectedId.id, selfEntity);
      if (byId) return { ...byId, source: selectedId.source };

      const selectedSnapshot = getMatchingTargetSnapshot(selectedId.id, "");
      if (selectedSnapshot) {
        return createTrackedTargetFromSnapshot(selectedSnapshot, `${selectedId.source}:lastKnown`, false);
      }
    }

    const locked = TARGET_DISTANCE_STATE.lockedTarget;
    if (!locked) return null;

    const liveLocked = findLiveTargetFromSnapshot(runtime, locked, selfEntity);
    if (liveLocked) return { ...liveLocked, source: "lockedTarget", locked: true };

    return createTrackedTargetFromSnapshot(locked, "lockedTarget:lastKnown", true);
  }

  function createTrackedTargetFromSnapshot(snapshot, source, locked) {
    const entity = createTargetEntityFromSnapshot(snapshot);
    if (!entity) return null;

    return {
      entity,
      path: source,
      source,
      stale: true,
      locked: Boolean(locked),
      snapshot,
    };
  }

  function getMatchingTargetSnapshot(id, name) {
    const snapshots = [TARGET_DISTANCE_STATE.lastSelectedTarget, TARGET_DISTANCE_STATE.lockedTarget].filter(Boolean);
    return snapshots.find((snapshot) => isTargetSnapshotMatch(snapshot, id, name)) || null;
  }

  function isTargetSnapshotMatch(snapshot, id, name) {
    if (!snapshot) return false;

    const expectedId = id !== null && id !== undefined && id !== "" ? String(id) : "";
    if (expectedId && snapshot.id && snapshot.id === expectedId) return true;

    const expectedName = normalizeHighlightName(name).toLowerCase();
    return Boolean(expectedName && snapshot.name && snapshot.name.toLowerCase() === expectedName);
  }

  function isSameTargetDistanceSnapshot(left, right) {
    if (!left || !right) return false;
    if (left.id && right.id && left.id === right.id) return true;
    return Boolean(left.name && right.name && left.name.toLowerCase() === right.name.toLowerCase());
  }

  function findLiveTargetFromSnapshot(runtime, snapshot, selfEntity) {
    if (!snapshot) return null;

    if (snapshot.id) {
      const byId = findRuntimeEntityById(runtime, snapshot.id, selfEntity);
      if (byId) return byId;
    }

    if (snapshot.name) {
      return findRuntimeEntityByExactName(runtime, snapshot.name, selfEntity);
    }

    return null;
  }

  function lockCurrentTargetDistance() {
    const selected = getSelectedTargetIdStatus();
    if (selected.id) {
      const lockedById = lockTargetDistanceById(
        selected.id,
        selected.name || (TARGET_DISTANCE_STATE.lastSelectedTarget && TARGET_DISTANCE_STATE.lastSelectedTarget.name) || "",
        selected.source || "selectedTargetId"
      );
      return {
        ...lockedById,
        selectedTarget: selected,
      };
    }

    const result = getTargetDistance(true);
    const snapshot = TARGET_DISTANCE_STATE.lastSelectedTarget;
    if (!result.available || !snapshot || !snapshot.id) {
      return {
        ok: false,
        reason: result.reason || "현재 타겟 id를 찾지 못했습니다.",
        selectedTarget: selected,
        ...getTargetDistanceLockStatus(),
      };
    }

    return lockTargetDistanceById(snapshot.id, snapshot.name, snapshot.source || "lastSelected");
  }

  function lockTargetDistanceByName(name) {
    const normalized = normalizeHighlightName(name);
    if (!normalized) {
      return {
        ok: false,
        reason: "이름이 비어 있습니다.",
        ...getTargetDistanceLockStatus(),
      };
    }

    const runtime = getExposedRuntime();
    const self = runtime ? findLocalPlayerEntity(runtime) : null;
    const live = runtime ? findRuntimeEntityByExactName(runtime, normalized, self && self.entity) : null;
    if (live) {
      const worldPosition = getRuntimeWorldPosition(live.entity);
      const combatPosition = getRuntimeCombatPosition(live.entity) || worldPosition;
      const snapshot = createTargetDistanceSnapshot(live.entity, live.path, `lockName:${normalized}`, worldPosition, combatPosition);
      if (snapshot) {
        TARGET_DISTANCE_STATE.lockedTarget = {
          ...snapshot,
          lockedAt: Date.now(),
          locked: true,
        };
        TARGET_DISTANCE_STATE.lastAt = 0;
        clearDeepRuntimeSearchCache();
        return {
          ok: true,
          ...getTargetDistanceLockStatus(),
        };
      }
    }

    const selected = getSelectedTargetIdStatus();
    if (selected.id) {
      const selectedSnapshot = getMatchingTargetSnapshot(selected.id, normalized);
      return lockTargetDistanceById(
        selected.id,
        (selectedSnapshot && selectedSnapshot.name) || selected.name || normalized,
        `selectedTargetId:${normalized}`
      );
    }

    const snapshot = getMatchingTargetSnapshot("", normalized);
    if (snapshot) {
      if (snapshot.id) {
        return lockTargetDistanceById(snapshot.id, snapshot.name || normalized, `lastSnapshot:${normalized}`);
      }

      TARGET_DISTANCE_STATE.lockedTarget = {
        ...snapshot,
        name: snapshot.name || normalized,
        source: `lastSnapshot:${normalized}`,
        lockedAt: Date.now(),
        locked: true,
      };
      TARGET_DISTANCE_STATE.lastAt = 0;
      TARGET_DISTANCE_STATE.lastResult = null;
      clearDeepRuntimeSearchCache();
      return {
        ok: true,
        stale: true,
        ...getTargetDistanceLockStatus(),
      };
    }

    return {
      ok: false,
      reason: `"${normalized}" 엔티티를 현재 런타임에서 찾지 못했습니다.`,
      ...getTargetDistanceLockStatus(),
    };
  }

  function lockTargetDistanceById(rawId, name, source) {
    const id = normalizeRuntimeEntityId(rawId);
    if (!id) {
      return {
        ok: false,
        reason: "타겟 id가 비어 있습니다.",
        ...getTargetDistanceLockStatus(),
      };
    }

    const runtime = getExposedRuntime();
    const self = runtime ? findLocalPlayerEntity(runtime) : null;
    const live = runtime ? findRuntimeEntityById(runtime, id, self && self.entity) : null;
    let snapshot = null;

    if (live) {
      const worldPosition = getRuntimeWorldPosition(live.entity);
      const combatPosition = getRuntimeCombatPosition(live.entity) || worldPosition;
      snapshot = createTargetDistanceSnapshot(live.entity, live.path, source || `targetId:${id}`, worldPosition, combatPosition);
    }

    if (!snapshot) {
      const existing = getMatchingTargetSnapshot(id, name);
      if (existing) {
        snapshot = {
          ...existing,
          id,
          name: existing.name || normalizeHighlightName(name) || `id:${id}`,
          source: source || existing.source || `targetId:${id}`,
          savedAt: existing.savedAt || Date.now(),
        };
      }
    }

    if (!snapshot) {
      snapshot = createTargetIdSnapshot(id, name, source || `targetId:${id}`);
    }

    TARGET_DISTANCE_STATE.lockedTarget = {
      ...snapshot,
      id,
      lockedAt: Date.now(),
      locked: true,
    };
    TARGET_DISTANCE_STATE.lastAt = 0;
    TARGET_DISTANCE_STATE.lastResult = null;
    clearDeepRuntimeSearchCache();

    return {
      ok: true,
      resolved: Boolean(live),
      idOnly: Boolean(snapshot.idOnly || !Array.isArray(snapshot.position)),
      ...getTargetDistanceLockStatus(),
    };
  }

  function targetRuntimeEntityById(rawId, name, source) {
    const id = normalizeRuntimeEntityId(rawId);
    if (!id) {
      return {
        ok: false,
        reason: "타겟 id가 비어 있습니다.",
      };
    }

    const runtime = getExposedRuntime();
    const self = runtime ? findLocalPlayerEntity(runtime) : null;
    const live = runtime ? findRuntimeEntityById(runtime, id, self && self.entity) : null;
    const targetName = live ? getRuntimeEntityLabel(live.entity) : normalizeHighlightName(name);
    TARGET_DISTANCE_STATE.lockedTarget = null;
    clearDeepRuntimeSearchCache();

    const controllerSelection = live && self
      ? applyRuntimeTargetController(runtime, self.entity, id)
      : {
          ok: false,
          reason: live ? "내 캐릭터 객체를 찾지 못했습니다." : "현재 런타임에서 해당 id 엔티티를 찾지 못했습니다.",
          attempts: [],
        };
    let actualSelection = getActualRuntimeTargetSelection(runtime, self && self.entity, id);

    const clickSelection = actualSelection.selected
      ? {
          ok: false,
          skipped: true,
          reason: "클라이언트 타겟 함수로 이미 선택했습니다.",
        }
      : live
      ? dispatchRuntimeTargetClick(runtime, live.entity)
      : {
          ok: false,
          reason: "현재 런타임에서 해당 id 엔티티를 찾지 못했습니다.",
        };
    if (!actualSelection.selected && clickSelection.ok) {
      actualSelection = getActualRuntimeTargetSelection(runtime, self && self.entity, id);
    }

    const propertySelection = actualSelection.selected
      ? {
          ok: false,
          skipped: true,
          reason: "이미 선택된 타겟입니다.",
          attempts: [],
        }
      : live && self
      ? applyRuntimeTargetSelection(runtime, self.entity, live.entity, id)
      : {
          ok: false,
          reason: live ? "내 캐릭터 객체를 찾지 못했습니다." : "현재 런타임에서 해당 id 엔티티를 찾지 못했습니다.",
          attempts: [],
        };
    if (!actualSelection.selected && propertySelection.ok) {
      actualSelection = getActualRuntimeTargetSelection(runtime, self && self.entity, id);
    }

    const selected = Boolean(actualSelection.selected);

    TARGET_DISTANCE_STATE.lastAt = 0;
    TARGET_DISTANCE_STATE.lastResult = null;
    if (selected) getTargetDistance(true);

    const result = {
      ok: selected,
      id,
      name: targetName,
      resolved: Boolean(live),
      selected,
      actualSelection,
      selection: {
        controller: controllerSelection,
        click: clickSelection,
        property: propertySelection,
      },
    };

    setStatus({
      lastState: selected ? `타겟 ON: ${targetName || id}` : `타겟 실패: ${targetName || id}`,
      lastError: selected
        ? ""
        : (actualSelection.reason || controllerSelection.reason || clickSelection.reason || propertySelection.reason || "실제 게임 타겟으로 지정하지 못했습니다."),
    });
    return result;
  }

  function getActualRuntimeTargetSelection(runtime, selfEntity, expectedId) {
    const expected = normalizeRuntimeEntityId(expectedId);
    if (!runtime || !selfEntity) {
      return {
        selected: false,
        id: "",
        reason: "런타임 또는 내 캐릭터 객체를 찾지 못했습니다.",
      };
    }

    const selected = getSelectedTargetId(runtime, selfEntity);
    const selectedId = selected && selected.id ? String(selected.id) : "";
    return {
      selected: Boolean(expected && selectedId === expected),
      id: selectedId,
      source: selected ? selected.source : "",
      reason: selectedId ? "" : "현재 선택된 타겟 id가 없습니다.",
    };
  }

  function clearRuntimeTargetSelection() {
    const runtime = getExposedRuntime();
    const self = runtime ? findLocalPlayerEntity(runtime) : null;
    const attempts = [];

    if (runtime && self && self.entity) {
      tryCallRuntimeTargetController(runtime, self.entity, "0", attempts);
    }

    if (self && self.entity) {
      tryCallRuntimeTargetMethods(self.entity, null, "0", "self", attempts);
      tryAssignRuntimeTargetValue(self.entity, "target", 0, "self.target", attempts);
    }

    TARGET_DISTANCE_STATE.lockedTarget = null;
    TARGET_DISTANCE_STATE.lastAt = 0;
    TARGET_DISTANCE_STATE.lastResult = null;
    clearDeepRuntimeSearchCache();
    clearTargetDistanceOverlay();

    const selected = runtime && self ? getSelectedTargetId(runtime, self.entity) : null;
    const ok = !selected || !selected.id;
    setStatus({
      lastState: ok ? "타겟 OFF" : "타겟 해제 실패",
      lastError: ok ? "" : `현재 타겟 id ${selected.id}`,
    });

    return {
      ok,
      attempts,
      selectedTarget: selected || null,
    };
  }

  function dispatchRuntimeTargetClick(runtime, targetEntity) {
    const canvas = getRuntimeInputCanvas(runtime);
    if (!canvas) {
      return {
        ok: false,
        reason: "입력 캔버스를 찾지 못했습니다.",
      };
    }

    const point = getRuntimeEntityTargetClickPoint(runtime, targetEntity);
    if (!point) {
      return {
        ok: false,
        reason: "대상 화면 좌표를 계산하지 못했습니다.",
      };
    }

    const rect = canvas.getBoundingClientRect();
    if (!isPointInsideRect(point, rect)) {
      return {
        ok: false,
        reason: "대상이 현재 화면 밖에 있습니다.",
        point: summarizeScreenPoint(point),
      };
    }

    try {
      if (typeof canvas.focus === "function") canvas.focus({ preventScroll: true });
    } catch {
      // Canvas focus is only a convenience for games that track active input.
    }

    const ok = dispatchCanvasMouseSequence(canvas, point);
    return {
      ok,
      reason: ok ? "" : "캔버스 클릭 이벤트 전송 실패",
      point: summarizeScreenPoint(point),
      canvas: getElementSelector(canvas),
    };
  }

  function getRuntimeInputCanvas(runtime) {
    const canvases = [
      runtime && runtime.overlayCanvas,
      runtime && runtime.webglCanvas,
      ...Array.from(document.querySelectorAll("canvas")),
    ].filter(isVisibleCanvasElement);

    if (canvases.length === 0) return null;
    return canvases
      .map((canvas) => ({ canvas, rect: canvas.getBoundingClientRect() }))
      .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0].canvas;
  }

  function getRuntimeEntityTargetClickPoint(runtime, entity) {
    const combat = getRuntimeCombatPosition(entity) || getRuntimeWorldPosition(entity);
    if (!combat) return null;

    const base = combat.position.slice(0, 3);
    const size = getRuntimeEntityCombatSize(entity);
    const offsets = [
      Math.max(0.75, Math.min(2.2, size * 0.75)),
      Math.max(0.45, Math.min(1.5, size * 0.45)),
      0.25,
      getRuntimeEntityNameYOffset(entity) * 0.45,
    ];

    for (const offset of offsets) {
      const point = projectRuntimePointToScreen([base[0], base[1] + offset, base[2]], runtime);
      if (point && isFiniteScreenPoint(point)) return point;
    }

    return null;
  }

  function dispatchCanvasMouseSequence(canvas, point) {
    const events = [
      ["pointermove", { buttons: 0 }],
      ["mousemove", { buttons: 0 }],
      ["pointerdown", { buttons: 1 }],
      ["mousedown", { buttons: 1 }],
      ["pointerup", { buttons: 0 }],
      ["mouseup", { buttons: 0 }],
      ["click", { buttons: 0 }],
    ];

    let dispatched = 0;
    for (const [type, options] of events) {
      const event = createCanvasMouseEvent(type, canvas, point, options);
      if (!event) continue;
      canvas.dispatchEvent(event);
      dispatched++;
    }

    return dispatched > 0;
  }

  function createCanvasMouseEvent(type, canvas, point, options = {}) {
    const rect = canvas.getBoundingClientRect();
    const offsetX = point.x - rect.left;
    const offsetY = point.y - rect.top;
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: pageWindow,
      clientX: point.x,
      clientY: point.y,
      screenX: Math.round((pageWindow.screenX || 0) + point.x),
      screenY: Math.round((pageWindow.screenY || 0) + point.y),
      button: 0,
      buttons: options.buttons || 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    };

    const isPointer = type.startsWith("pointer") && typeof pageWindow.PointerEvent === "function";
    const event = isPointer
      ? new pageWindow.PointerEvent(type, {
          ...init,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          width: 1,
          height: 1,
          pressure: type === "pointerdown" ? 0.5 : 0,
        })
      : new pageWindow.MouseEvent(type, init);

    defineSyntheticMouseOffset(event, offsetX, offsetY);
    return event;
  }

  function defineSyntheticMouseOffset(event, offsetX, offsetY) {
    const properties = {
      offsetX,
      offsetY,
      layerX: offsetX,
      layerY: offsetY,
      x: event.clientX,
      y: event.clientY,
    };

    for (const [key, value] of Object.entries(properties)) {
      try {
        Object.defineProperty(event, key, {
          configurable: true,
          get() {
            return value;
          },
        });
      } catch {
        // Native event accessors may be non-configurable in some browsers.
      }
    }
  }

  function isPointInsideRect(point, rect) {
    return (
      point &&
      rect &&
      point.x >= rect.left &&
      point.y >= rect.top &&
      point.x <= rect.right &&
      point.y <= rect.bottom
    );
  }

  function isFiniteScreenPoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function summarizeScreenPoint(point) {
    return point
      ? {
          x: roundCoord(point.x),
          y: roundCoord(point.y),
        }
      : null;
  }

  function applyRuntimeTargetController(runtime, selfEntity, id) {
    const attempts = [];
    return {
      ok: tryCallRuntimeTargetController(runtime, selfEntity, id, attempts),
      attempts,
      clientState: summarizeRuntimeTargetControllerState(getRuntimeTargetControllerState(runtime)),
    };
  }

  function tryCallRuntimeTargetController(runtime, selfEntity, rawId, attempts) {
    if (!isRuntimeObject(runtime)) {
      attempts.push({
        type: "client-controller",
        path: "runtime",
        ok: false,
        reason: "런타임을 찾지 못했습니다.",
      });
      return false;
    }

    const idText = rawId === 0 ? "0" : String(rawId ?? "");
    const normalizedId = idText === "0" ? "0" : normalizeRuntimeEntityId(idText);
    if (!normalizedId) {
      attempts.push({
        type: "client-controller",
        path: "runtime.changeTarget",
        ok: false,
        reason: "타겟 id가 비어 있습니다.",
      });
      return false;
    }

    const numericId = Number(normalizedId);
    const targetArgument = Number.isFinite(numericId) ? numericId : normalizedId;
    const expectedId = normalizedId === "0" ? "" : normalizedId;
    const calls = [
      {
        kind: "hover",
        path: "runtime.setHoverTarget",
        fn: safeReadValue(runtime, "setHoverTarget"),
        args: [targetArgument, normalizedId !== "0"],
      },
      {
        kind: "target",
        path: "runtime.changeTarget",
        fn: safeReadValue(runtime, "changeTarget"),
        args: [targetArgument],
      },
    ];

    let sawController = false;
    let targetOk = false;

    for (const call of calls) {
      if (typeof call.fn !== "function") continue;
      sawController = true;

      try {
        const returnValue = call.fn(...call.args);
        const clientState = getRuntimeTargetControllerState(runtime);
        const selected = selfEntity ? getSelectedTargetId(runtime, selfEntity) : null;
        const currentTargetId = selected && selected.id
          ? selected.id
          : normalizeRuntimeEntityId(clientState && clientState.target);
        const ok = call.kind === "hover"
          ? isRuntimeTargetControllerValueMatch(clientState && clientState.hover, normalizedId)
          : expectedId
            ? currentTargetId === expectedId || isRuntimeTargetControllerValueMatch(clientState && clientState.target, normalizedId)
            : !currentTargetId || isRuntimeTargetControllerValueMatch(clientState && clientState.target, "0");

        attempts.push({
          type: "client-controller",
          path: call.path,
          argument: call.args.map(formatRuntimeTargetControllerArgument).join(","),
          ok,
          returnValue: typeof returnValue === "boolean" ? returnValue : undefined,
          currentTargetId,
          clientState: summarizeRuntimeTargetControllerState(clientState),
        });

        if (call.kind === "target" && ok) targetOk = true;
      } catch (error) {
        attempts.push({
          type: "client-controller",
          path: call.path,
          argument: call.args.map(formatRuntimeTargetControllerArgument).join(","),
          ok: false,
          error: error && error.message ? error.message : String(error),
        });
      }
    }

    if (!sawController) {
      attempts.push({
        type: "client-controller",
        path: "runtime.changeTarget",
        ok: false,
        reason: "클라이언트 타겟 함수가 아직 노출되지 않았습니다.",
      });
    }

    return targetOk;
  }

  function getRuntimeTargetControllerState(runtime) {
    if (!isRuntimeObject(runtime)) return null;

    const getter = safeReadValue(runtime, "getClientTargetState");
    if (typeof getter !== "function") return null;

    try {
      return getter();
    } catch {
      return null;
    }
  }

  function summarizeRuntimeTargetControllerState(state) {
    if (!isRuntimeObject(state)) return null;

    return {
      hover: normalizeRuntimeEntityId(state.hover),
      target: normalizeRuntimeEntityId(state.target),
      lastCandidate: normalizeRuntimeEntityId(state.lastCandidate),
      hoverActive: Boolean(state.hoverActive),
    };
  }

  function isRuntimeTargetControllerValueMatch(value, normalizedId) {
    if (normalizedId === "0") {
      return value === 0 || value === "0" || normalizeRuntimeEntityId(value) === "";
    }

    return normalizeRuntimeEntityId(value) === normalizedId;
  }

  function formatRuntimeTargetControllerArgument(value) {
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number" || typeof value === "string") return String(value);
    return typeof value;
  }

  function applyRuntimeTargetSelection(runtime, selfEntity, targetEntity, id) {
    const attempts = [];
    const normalizedId = normalizeRuntimeEntityId(id);
    const roots = [
      { value: selfEntity, path: "self" },
      { value: runtime, path: "runtime" },
      { value: runtime && safeReadValue(runtime, "engine"), path: "runtime.engine" },
    ].filter((root) => isRuntimeObject(root.value));

    const objectKeys = ["target", "targetUnit", "targetEntity", "selectedTarget", "selectedEntity", "currentTarget", "focusTarget", "enemyTarget"];
    const idKeys = ["targetId", "targetUnitId", "targetEntityId", "selectedTargetId", "selectedEntityId", "currentTargetId", "focusTargetId", "enemyTargetId"];

    for (const root of roots) {
      tryCallRuntimeTargetMethods(root.value, targetEntity, normalizedId, root.path, attempts);

      for (const key of idKeys) {
        const idValue = coerceRuntimeTargetIdValue(root.value, key, normalizedId);
        tryAssignRuntimeTargetValue(root.value, key, idValue, `${root.path}.${key}`, attempts);
      }

      for (const key of objectKeys) {
        const current = safeReadValue(root.value, key);
        if (!isRuntimeObject(current)) continue;
        tryAssignRuntimeTargetValue(root.value, key, targetEntity, `${root.path}.${key}`, attempts);
      }
    }

    return {
      ok: attempts.some((attempt) => attempt.ok),
      attempts,
    };
  }

  function tryAssignRuntimeTargetValue(container, key, value, path, attempts) {
    if (!isRuntimeObject(container)) return false;

    try {
      if (!(key in container)) return false;
    } catch {
      return false;
    }

    try {
      container[key] = value;
      const current = safeReadValue(container, key);
      const ok = current === value || normalizeRuntimeEntityId(current) === normalizeRuntimeEntityId(value);
      attempts.push({
        type: "assign",
        path,
        ok,
      });
      return ok;
    } catch (error) {
      attempts.push({
        type: "assign",
        path,
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
      return false;
    }
  }

  function coerceRuntimeTargetIdValue(container, key, normalizedId) {
    const current = safeReadValue(container, key);
    if (typeof current === "number") {
      const number = Number(normalizedId);
      return Number.isFinite(number) ? number : normalizedId;
    }
    return normalizedId;
  }

  function tryCallRuntimeTargetMethods(container, targetEntity, normalizedId, path, attempts) {
    const methods = ["setTarget", "selectTarget", "setSelectedTarget", "setCurrentTarget", "focusTarget"];
    const numericId = Number(normalizedId);
    const args = [];
    if (Number.isFinite(numericId)) args.push(numericId);
    args.push(normalizedId, targetEntity);

    for (const method of methods) {
      const fn = safeReadValue(container, method);
      if (typeof fn !== "function") continue;

      for (const value of args.filter((item) => item !== null && item !== undefined && item !== "")) {
        try {
          const returnValue = fn.call(container, value);
          const currentTargetId = getRuntimeTargetIdFromContainer(container);
          const ok = returnValue === true || currentTargetId === normalizedId;
          attempts.push({
            type: "method",
            path: `${path}.${method}`,
            argument: typeof value === "object" ? "entity" : String(value),
            ok,
            returnValue: typeof returnValue === "boolean" ? returnValue : undefined,
            currentTargetId,
          });
          if (ok) break;
        } catch (error) {
          attempts.push({
            type: "method",
            path: `${path}.${method}`,
            argument: typeof value === "object" ? "entity" : String(value),
            ok: false,
            error: error && error.message ? error.message : String(error),
          });
        }
      }
    }
  }

  function getRuntimeTargetIdFromContainer(container) {
    if (!isRuntimeObject(container)) return "";

    for (const key of ["target", "targetId", "targetUnitId", "targetEntityId", "selectedTargetId", "currentTargetId", "focusTargetId", "enemyTargetId"]) {
      const id = normalizeRuntimeEntityId(safeReadValue(container, key));
      if (id) return id;
    }

    return "";
  }

  function unlockTargetDistance() {
    TARGET_DISTANCE_STATE.lockedTarget = null;
    TARGET_DISTANCE_STATE.lastAt = 0;
    TARGET_DISTANCE_STATE.lastResult = null;
    clearDeepRuntimeSearchCache();
    return getTargetDistanceLockStatus();
  }

  function getSelectedTargetIdStatus() {
    const runtime = getExposedRuntime();
    if (!runtime) {
      return {
        id: "",
        source: "",
        resolved: false,
        reason: "런타임을 찾지 못했습니다.",
      };
    }

    const self = findLocalPlayerEntity(runtime);
    if (!self) {
      return {
        id: "",
        source: "",
        resolved: false,
        reason: "내 캐릭터 객체를 찾지 못했습니다.",
      };
    }

    const selected = getSelectedTargetId(runtime, self.entity);
    if (!selected || !selected.id) {
      return {
        id: "",
        source: "",
        resolved: false,
        reason: "현재 선택된 타겟 id가 없습니다.",
      };
    }

    const live = findRuntimeEntityById(runtime, selected.id, self.entity);
    const livePosition = live ? getRuntimeWorldPosition(live.entity) : null;
    return {
      id: selected.id,
      source: selected.source,
      resolved: Boolean(live),
      name: live ? getRuntimeEntityLabel(live.entity) : "",
      path: live ? live.path : "",
      position: livePosition ? livePosition.position.map(roundCoord) : null,
    };
  }

  function getTargetDistanceLockStatus() {
    const last = TARGET_DISTANCE_STATE.lastSelectedTarget;
    const locked = TARGET_DISTANCE_STATE.lockedTarget;
    return {
      selectedTarget: getSelectedTargetIdStatus(),
      locked: summarizeTargetDistanceSnapshot(locked),
      lastSelected: summarizeTargetDistanceSnapshot(last),
    };
  }

  function summarizeTargetDistanceSnapshot(snapshot) {
    if (!snapshot) return null;

    return {
      id: snapshot.id || "",
      name: snapshot.name || "",
      source: snapshot.source || "",
      idOnly: Boolean(snapshot.idOnly || !Array.isArray(snapshot.position)),
      position: Array.isArray(snapshot.position) ? snapshot.position.map(roundCoord) : null,
      visualPosition: Array.isArray(snapshot.visualPosition) ? snapshot.visualPosition.map(roundCoord) : null,
      savedAt: snapshot.savedAt ? new Date(snapshot.savedAt).toISOString() : null,
      ageMs: snapshot.savedAt ? Date.now() - snapshot.savedAt : null,
      lockedAt: snapshot.lockedAt ? new Date(snapshot.lockedAt).toISOString() : null,
    };
  }

  function findLocalPlayerEntity(runtime) {
    refreshRuntimeEntityReferences(runtime);

    const directKeys = ["player", "localPlayer", "myPlayer", "character", "hero", "avatar", "controlledEntity", "entity", "unit", "actor"];
    for (const root of getRuntimeSearchRoots(runtime)) {
      const direct = resolveFirstRuntimeEntityFromKeys(root.value, runtime, directKeys, root.path);
      if (direct) return direct;
    }

    const byConfiguredName = findRuntimeEntityByConfiguredHighlightNames(runtime);
    if (byConfiguredName) return { ...byConfiguredName, source: "highlightNames" };

    return findBestRuntimeEntity(runtime, (value, path) => scoreLocalPlayerEntity(value, path));
  }

  function findSelectedTargetEntity(runtime, selfEntity) {
    refreshRuntimeEntityReferences(runtime);

    const directKeys = ["target", "targetUnit", "targetEntity", "selectedTarget", "selectedEntity", "currentTarget", "attackTarget", "focusTarget", "enemyTarget"];
    const targetIdKeys = ["targetId", "targetUnitId", "targetEntityId", "selectedTargetId", "selectedEntityId", "currentTargetId", "attackTargetId", "focusTargetId", "enemyTargetId"];
    const roots = [
      { value: selfEntity, path: "self" },
      ...getRuntimeSearchRoots(runtime),
    ];

    for (const root of roots) {
      const direct = resolveFirstRuntimeEntityFromKeys(root.value, runtime, directKeys, root.path, selfEntity);
      if (direct) return direct;

      for (const key of targetIdKeys) {
        const id = safeReadValue(root.value, key);
        const byId = findRuntimeEntityById(runtime, id, selfEntity);
        if (byId) return { ...byId, source: `${root.path}.${key}` };
      }
    }

    const selfId = getRuntimeEntityId(selfEntity);
    return getCachedDeepRuntimeSearch(`selected:${selfId === undefined ? "unknown" : String(selfId)}`, () =>
      findBestRuntimeEntity(runtime, (value, path) => scoreSelectedTargetEntity(value, path, selfEntity))
    );
  }

  function getSelectedTargetId(runtime, selfEntity) {
    const targetKeys = [
      "target",
      "targetId",
      "targetUnitId",
      "targetEntityId",
      "selectedTarget",
      "selectedTargetId",
      "selectedEntity",
      "selectedEntityId",
      "currentTarget",
      "currentTargetId",
      "attackTarget",
      "attackTargetId",
      "focusTarget",
      "focusTargetId",
      "enemyTarget",
      "enemyTargetId",
    ];
    const roots = [
      { value: selfEntity, path: "self" },
      ...getRuntimeSearchRoots(runtime),
    ];

    for (const root of roots) {
      if (!isRuntimeObject(root.value)) continue;

      for (const key of targetKeys) {
        const raw = safeReadValue(root.value, key);
        const id = normalizeRuntimeEntityId(raw);
        if (id !== "") return { id, source: `${root.path}.${key}` };
      }
    }

    return null;
  }

  function normalizeRuntimeEntityId(value) {
    if (value === null || value === undefined || value === "" || value === false || value === 0 || value === "0") return "";

    if (isRuntimeObject(value)) {
      const id = getRuntimeEntityId(value);
      const normalized = id !== undefined && id !== null && id !== "" ? String(id) : "";
      return normalized === "0" ? "" : normalized;
    }

    return String(value);
  }

  function resolveFirstRuntimeEntityFromKeys(container, runtime, keys, path, selfEntity) {
    if (!isRuntimeObject(container)) return null;

    for (const key of keys) {
      const entity = resolveRuntimeEntityReference(
        safeReadValue(container, key),
        runtime,
        `${path}.${key}`,
        selfEntity
      );
      if (entity) return entity;
    }

    return null;
  }

  function resolveRuntimeEntityReference(reference, runtime, source, selfEntity) {
    if (reference === null || reference === undefined || reference === false) return null;

    if (isRuntimeObject(reference)) {
      const entity = unwrapRuntimeEntityReference(reference, selfEntity);
      if (entity) return { entity, path: source, source };

      const id = getRuntimeEntityId(reference);
      const byId = findRuntimeEntityById(runtime, id, selfEntity);
      return byId ? { ...byId, source } : null;
    }

    const byId = findRuntimeEntityById(runtime, reference, selfEntity);
    return byId ? { ...byId, source } : null;
  }

  function unwrapRuntimeEntityReference(reference, selfEntity, depth = 0) {
    if (!isRuntimeObject(reference) || depth > 2) return null;
    if (!isSameRuntimeEntity(reference, selfEntity) && getRuntimeWorldPosition(reference)) return reference;

    for (const key of ["entity", "target", "unit", "actor", "player", "object", "model", "owner"]) {
      const nested = safeReadValue(reference, key);
      if (!isRuntimeObject(nested) || nested === reference) continue;

      const entity = unwrapRuntimeEntityReference(nested, selfEntity, depth + 1);
      if (entity) return entity;
    }

    return null;
  }

  function findRuntimeEntityById(runtime, id, selfEntity) {
    if (id === null || id === undefined || id === "") return null;

    const expected = String(id);
    const direct = findRuntimeEntityByIdDirect(runtime, id, expected, selfEntity);
    if (direct) return direct;

    // If the engine exposes its authoritative entity Map, a Direct miss is definitive —
    // skip the expensive deep object scan (the prior per-unloaded-id cost).
    const authMap = safeReadValue(safeReadValue(safeReadValue(runtime, "engine"), "entities"), "map");
    if (authMap && typeof authMap.get === "function" && Number(authMap.size) > 0) return null;

    return getCachedDeepRuntimeSearch(`id:${expected}`, () =>
      findBestRuntimeEntity(runtime, (value) => {
        if (isSameRuntimeEntity(value, selfEntity)) return 0;

        const actual = getRuntimeEntityId(value);
        if (actual === undefined || String(actual) !== expected) return 0;
        return getRuntimeWorldPosition(value) ? 130 : 0;
      })
    );
  }

  function findRuntimeEntityByIdDirect(runtime, rawId, expected, selfEntity) {
    if (!runtime || expected === "") return null;

    const engine = safeReadValue(runtime, "engine");
    const entities = safeReadValue(engine, "entities");

    // Fast path: engine.entities.map is the authoritative Map(numberId -> entity). When
    // populated, a get() resolves O(1) and a miss means "not loaded", so we skip the
    // accessor probes + linear scans over 9 collections (the profiled hot path).
    const directMap = safeReadValue(entities, "map");
    if (directMap && typeof directMap.get === "function" && Number(directMap.size) > 0) {
      const numId = Number(expected);
      if (Number.isFinite(numId)) {
        const hit = directMap.get(numId);
        return hit && isResolvedRuntimeEntity(hit, selfEntity, expected)
          ? { entity: hit, path: "runtime.engine.entities.map", source: "runtime.engine.entities.map" }
          : null;
      }
    }

    const methodArgs = [...new Set([rawId, expected, Number(expected)].filter((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))))];
    for (const method of ["getEntityById", "getEntity", "entity"]) {
      const fn = safeReadValue(engine, method);
      if (typeof fn !== "function") continue;

      for (const methodArg of methodArgs) {
        try {
          const entity = fn.call(engine, methodArg);
          if (isResolvedRuntimeEntity(entity, selfEntity, expected)) {
            return { entity, path: `runtime.engine.${method}(${expected})`, source: `runtime.engine.${method}` };
          }
        } catch {
          // Some engine accessors throw for missing IDs.
        }
      }
    }

    const entityArray = safeReadValue(entities, "array");
    const byArray = findRuntimeEntityInIndexedCollection(entityArray, expected, selfEntity, "runtime.engine.entities.array");
    if (byArray) return byArray;

    for (const key of ["list", "items", "values", "players", "mobs", "units", "actors", "objects"]) {
      const collection = safeReadValue(entities, key) || safeReadValue(engine, key);
      const found = findRuntimeEntityInIndexedCollection(collection, expected, selfEntity, `runtime.engine.${key}`);
      if (found) return found;
    }

    return null;
  }

  function findRuntimeEntityInIndexedCollection(collection, expected, selfEntity, path) {
    if (!collection) return null;

    if (Array.isArray(collection) || ArrayBuffer.isView(collection)) {
      const length = Number(collection.length) || 0;
      for (let index = 0; index < length; index++) {
        const entity = collection[index];
        if (isResolvedRuntimeEntity(entity, selfEntity, expected)) {
          return { entity, path: `${path}[${index}]`, source: path };
        }
      }
      return null;
    }

    if (collection instanceof Map || collection instanceof Set) {
      let index = 0;
      for (const entity of collection.values()) {
        if (isResolvedRuntimeEntity(entity, selfEntity, expected)) {
          return { entity, path: `${path}.${collection instanceof Map ? "map" : "set"}[${index}]`, source: path };
        }
        index++;
      }
    }

    return null;
  }

  function isResolvedRuntimeEntity(entity, selfEntity, expected) {
    if (!isRuntimeObject(entity) || isSameRuntimeEntity(entity, selfEntity)) return false;

    const actual = getRuntimeEntityId(entity);
    if (actual === undefined || String(actual) !== expected) return false;
    return Boolean(getRuntimeWorldPosition(entity));
  }

  function findRuntimeEntityByConfiguredHighlightNames(runtime) {
    const { lowerNames } = getHighlightNameCache();
    if (lowerNames.length === 0) return null;

    return findBestRuntimeEntity(runtime, (value, path) => {
      if (!getRuntimeWorldPosition(value)) return 0;

      const name = getRuntimeNameValueLoose(value).toLowerCase();
      if (!name || !lowerNames.includes(name)) return 0;

      let score = 145;
      if (/(\.|^)player$/i.test(path)) score += 50;
      if (/local|myPlayer|self|controlled|character|hero|avatar/i.test(path)) score += 40;
      if (safeReadValue(value, "isSelf") === true || safeReadValue(value, "isLocal") === true) score += 80;
      if (getRuntimeEntityId(value) !== undefined) score += 8;
      return score;
    });
  }

  function findRuntimeEntityByExactName(runtime, name, selfEntity) {
    const expected = normalizeHighlightName(name).toLowerCase();
    if (!expected) return null;

    return getCachedDeepRuntimeSearch(`name:${expected}`, () =>
      findBestRuntimeEntity(runtime, (value, path) => {
        if (isSameRuntimeEntity(value, selfEntity)) return 0;

        const actual = getRuntimeNameValueLoose(value).toLowerCase();
        if (actual !== expected) return 0;
        if (!getRuntimeWorldPosition(value)) return 0;

        let score = 120;
        if (/target|selected|focus/i.test(path)) score += 40;
        if (/entities|players|mobs|units|actors/i.test(path)) score += 15;
        if (getRuntimeEntityId(value) !== undefined) score += 8;
        return score;
      })
    );
  }

  function findBestRuntimeEntity(runtime, scoreEntity) {
    const queue = getRuntimeSearchRoots(runtime).map((root) => ({ ...root, depth: 0 }));
    const seen = new WeakSet();
    let visited = 0;
    let best = null;

    for (let cursor = 0; cursor < queue.length && visited < TARGET_DISTANCE_MAX_OBJECTS; cursor++) {
      const item = queue[cursor];
      const value = item.value;
      if (!isRuntimeObject(value) || seen.has(value)) continue;

      seen.add(value);
      visited++;

      const score = Number(scoreEntity(value, item.path)) || 0;
      if (score > 0 && (!best || score > best.score)) {
        best = { entity: value, path: item.path, source: item.path, score };
      }

      if (item.depth >= TARGET_DISTANCE_MAX_DEPTH) continue;
      const childLimit = item.depth === 0 ? 420 : 90;
      forEachRuntimeChild(value, item.path, childLimit, (childValue, childPath) => {
        queue.push({ value: childValue, path: childPath, depth: item.depth + 1 });
        return true;
      });
    }

    return best;
  }

  function scoreLocalPlayerEntity(value, path) {
    let score = 0;
    if (/(\.|^)player$/i.test(path)) score += 90;
    if (/local|myPlayer|self|controlled|character|hero|avatar/i.test(path)) score += 60;
    if (safeReadValue(value, "isSelf") === true || safeReadValue(value, "isLocal") === true) score += 80;
    if (getRuntimeNameValueLoose(value)) score += 10;
    if (getRuntimeEntityId(value) !== undefined) score += 8;
    if (score <= 0 || !getRuntimeWorldPosition(value)) return 0;
    return score;
  }

  function scoreSelectedTargetEntity(value, path, selfEntity) {
    if (isSameRuntimeEntity(value, selfEntity)) return 0;

    let score = 0;
    if (/target|selected|focus/i.test(path)) score += 55;
    for (const key of ["isTarget", "isTargeted", "targeted", "isSelected", "selected", "isCurrentTarget"]) {
      if (safeReadValue(value, key) === true) score += 80;
    }
    if (getRuntimeNameValueLoose(value)) score += 12;
    if (getRuntimeEntityId(value) !== undefined) score += 8;
    if (score < 80 || !getRuntimeWorldPosition(value)) return 0;
    return score;
  }

  function getRuntimeSearchRoots(runtime) {
    const roots = [{ value: runtime, path: "runtime" }];
    if (runtime && runtime.player) roots.push({ value: runtime.player, path: "runtime.player" });
    if (runtime && runtime.target) roots.push({ value: runtime.target, path: "runtime.target" });
    if (runtime && runtime.engine) {
      roots.push({ value: runtime.engine, path: "runtime.engine" });

      for (const key of ["entities", "entityList", "players", "mobs", "units", "actors", "objects", "world", "scene"]) {
        const value = safeReadValue(runtime.engine, key);
        if (isRuntimeObject(value)) roots.push({ value, path: `runtime.engine.${key}` });
      }
    }
    return roots;
  }

  function getRuntimeEntityId(entity) {
    for (const key of ["id", "entityId", "uid", "guid", "uuid", "networkId", "serverId"]) {
      const value = safeReadValue(entity, key);
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return undefined;
  }

  function getRuntimeEntityLabel(entity) {
    return getRuntimeNameValueLoose(entity) || String(getRuntimeEntityId(entity) ?? "unknown");
  }

  function getRuntimeEntityClassId(entity) {
    const directKeys = ["class", "classId", "classid", "classType", "characterClass", "playerClass", "job", "profession"];
    for (const key of directKeys) {
      const id = normalizeRuntimeClassId(safeReadValue(entity, key));
      if (id !== null) return id;
    }

    for (const key of ["data", "info", "character", "profile", "stats"]) {
      const nested = safeReadValue(entity, key);
      if (!isRuntimeObject(nested)) continue;

      for (const nestedKey of directKeys) {
        const id = normalizeRuntimeClassId(safeReadValue(nested, nestedKey));
        if (id !== null) return id;
      }
    }

    return null;
  }

  function normalizeRuntimeClassId(value) {
    if (value === null || value === undefined || value === "") return null;

    if (isRuntimeObject(value)) {
      for (const key of ["id", "classId", "classid", "value"]) {
        const id = normalizeRuntimeClassId(safeReadValue(value, key));
        if (id !== null) return id;
      }
      return null;
    }

    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 8) return null;
    return number;
  }

  function getRuntimeEntityClassIconUrl(entity) {
    const classId = getRuntimeEntityClassId(entity);
    if (classId === null) return "";

    const version = getGameAssetVersion();
    return `/data/ui/classes/${classId}.avif${version ? `?v=${version}` : ""}`;
  }

  function getRuntimeEntityHealthInfo(entity) {
    const stats = safeReadValue(entity, "stats");
    const currentFromMap = readRuntimeMapNumber(safeReadValue(stats, "resource"), 6);
    const maxFromMap = readRuntimeMapNumber(safeReadValue(stats, "stat"), 6);
    const current = Number.isFinite(currentFromMap)
      ? currentFromMap
      : readRuntimeEntityNumber(
          entity,
          ["health", "hp", "currentHealth", "healthCurrent", "currentHp", "hitpoints", "life"],
          ["current", "value", "amount", "now", "health", "hp"]
        );
    const max = Number.isFinite(maxFromMap)
      ? maxFromMap
      : readRuntimeEntityNumber(
          entity,
          ["maxHealth", "healthMax", "maximumHealth", "maxHp", "hpMax", "maxHP", "maxHitpoints", "maxLife"],
          ["max", "maximum", "total", "maxHealth", "maxHp", "hpMax"]
        );

    if (!Number.isFinite(current) && !Number.isFinite(max)) return null;

    const ratio = Number.isFinite(current) && Number.isFinite(max) && max > 0
      ? clamp(current / max, 0, 1)
      : Number.isFinite(current) && current >= 0 && current <= 1
        ? clamp(current, 0, 1)
        : null;

    return {
      current: Number.isFinite(current) ? current : null,
      max: Number.isFinite(max) ? max : null,
      ratio,
      currentText: Number.isFinite(current) ? formatRuntimeCompactNumber(current) : "-",
      maxText: Number.isFinite(max) ? formatRuntimeCompactNumber(max) : "",
    };
  }

  function readRuntimeMapNumber(mapLike, key) {
    try {
      if (mapLike instanceof Map) {
        return coerceRuntimeNumber(mapLike.get(key));
      }
    } catch {
      return NaN;
    }

    return NaN;
  }

  function readRuntimeEntityNumber(entity, keys, nestedKeys = keys) {
    for (const key of keys) {
      const number = coerceRuntimeNumber(safeReadValue(entity, key));
      if (Number.isFinite(number)) return number;
    }

    for (const containerKey of ["health", "hp", "stats", "resources", "combat"]) {
      const container = safeReadValue(entity, containerKey);
      if (!isRuntimeObject(container)) continue;

      for (const key of nestedKeys) {
        const number = coerceRuntimeNumber(safeReadValue(container, key));
        if (Number.isFinite(number)) return number;
      }
    }

    return NaN;
  }

  function coerceRuntimeNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "string" && value.trim() !== "") {
      const number = Number(value.replace(/,/g, ""));
      return Number.isFinite(number) ? number : NaN;
    }
    return NaN;
  }

  function formatRuntimeCompactNumber(value) {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value) >= 1000) return String(Math.round(value).toLocaleString("en-US"));
    if (Math.abs(value) >= 100) return String(Math.round(value));
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }

  function isSameRuntimeEntity(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;

    const leftId = getRuntimeEntityId(left);
    const rightId = getRuntimeEntityId(right);
    return leftId !== undefined && rightId !== undefined && String(leftId) === String(rightId);
  }

  function getHorizontalRuntimeDistance(left, right) {
    const dx = Number(left[0]) - Number(right[0]);
    const dz = Number(left[2]) - Number(right[2]);
    if (Number.isFinite(dx) && Number.isFinite(dz)) return Math.hypot(dx, dz);

    const dy = Number(left[1]) - Number(right[1]);
    return Math.hypot(dx, dy);
  }

  function getRuntimeVectorDistance(left, right) {
    return Math.hypot(
      Number(left[0]) - Number(right[0]),
      Number(left[1]) - Number(right[1]),
      Number(left[2]) - Number(right[2])
    );
  }

  function saveGearPresetConfig() {
    saveJsonConfig(GEAR_PRESET_CONFIG_KEY, GEAR_PRESET_CONFIG);
  }

  function initGameWebSocketCapture() {
    const OriginalWebSocket = pageWindow.WebSocket;
    if (typeof OriginalWebSocket !== "function") return;

    if (!OriginalWebSocket.prototype.__hordesKrGameSocketSendWrapped) {
      const originalSend = OriginalWebSocket.prototype.send;
      Object.defineProperty(OriginalWebSocket.prototype, "__hordesKrGameSocketSendWrapped", {
        configurable: true,
        value: true,
      });
      Object.defineProperty(OriginalWebSocket.prototype, "__hordesKrOriginalSend", {
        configurable: true,
        value: originalSend,
      });
      OriginalWebSocket.prototype.send = function hordesKrTrackedSend(data) {
        rememberGameWebSocket(this);
        return originalSend.call(this, data);
      };
    }

    if (OriginalWebSocket.__hordesKrGameSocketCtorWrapped) return;

    function HordesKrTrackedWebSocket(url, protocols) {
      const socket = protocols === undefined
        ? new OriginalWebSocket(url)
        : new OriginalWebSocket(url, protocols);
      rememberGameWebSocket(socket);
      return socket;
    }

    HordesKrTrackedWebSocket.prototype = OriginalWebSocket.prototype;
    Object.setPrototypeOf(HordesKrTrackedWebSocket, OriginalWebSocket);
    Object.defineProperty(HordesKrTrackedWebSocket, "__hordesKrGameSocketCtorWrapped", {
      configurable: true,
      value: true,
    });

    try {
      pageWindow.WebSocket = HordesKrTrackedWebSocket;
      GEAR_PRESET_STATE.socketWrapped = true;
    } catch (error) {
      GEAR_PRESET_STATE.lastError = error && error.message ? error.message : String(error);
    }
  }

  function rememberGameWebSocket(socket) {
    if (!socket || !isHordesGameSocketUrl(socket.url)) return;

    GEAR_PRESET_STATE.gameSocket = socket;
    if (!socket.__hordesKrGameSocketTracked) {
      Object.defineProperty(socket, "__hordesKrGameSocketTracked", {
        configurable: true,
        value: true,
      });
      socket.addEventListener("close", () => {
        if (GEAR_PRESET_STATE.gameSocket === socket) GEAR_PRESET_STATE.gameSocket = null;
        COMBAT_ASSIST_STATE.wsHookAttached = false;
      });
      // Event-driven auto-interrupt: react the instant a message updates entity state.
      try {
        socket.addEventListener("message", onGameSocketMessageForInterrupt);
        COMBAT_ASSIST_STATE.wsHookAttached = true;
      } catch { /* listener attach is best-effort */ }
    }
  }

  function isHordesGameSocketUrl(url) {
    return /^wss:\/\/game\d+\.hordes\.io:\d+\/play/i.test(String(url || ""));
  }

  function getGameWebSocket() {
    const socket = GEAR_PRESET_STATE.gameSocket;
    if (!socket || socket.readyState !== HORDES_WEB_SOCKET_OPEN) return null;
    return socket;
  }

  function getGearSocketStatus() {
    const socket = GEAR_PRESET_STATE.gameSocket;
    return {
      wrapped: GEAR_PRESET_STATE.socketWrapped,
      available: Boolean(socket && socket.readyState === HORDES_WEB_SOCKET_OPEN),
      url: socket && socket.url || "",
      readyState: socket ? socket.readyState : null,
    };
  }

  function sendHordesClientCommand(command, payload) {
    const socket = getGameWebSocket();
    if (!socket) throw new Error("게임 WebSocket을 찾지 못했습니다. 새로고침 후 다시 시도하세요.");

    socket.send(encodeHordesClientCommand(command, String(payload || "")));
    rememberGameWebSocket(socket);
    return true;
  }

  function sendHordesChatMessage(channel, message) {
    const normalizedChannel = normalizeHordesChatChannel(channel);
    const body = String(message || "").replace(/\s+/g, " ").trim();
    if (!body) throw new Error(`${getHordesChatChannelLabel(normalizedChannel)} 메시지가 비어 있습니다.`);
    if (!HORDES_CHAT_CHANNELS.has(normalizedChannel)) {
      throw new Error(`지원하지 않는 채팅 채널입니다: ${channel}`);
    }

    sendHordesClientCommand(normalizedChannel, body.slice(0, 480));
    return {
      ok: true,
      method: "websocket",
      channel: normalizedChannel,
      body,
    };
  }

  function sendHordesItemMove(fromSlot, toSlot) {
    if (!Number.isInteger(fromSlot) || !Number.isInteger(toSlot)) {
      throw new Error(`잘못된 슬롯입니다: ${fromSlot} -> ${toSlot}`);
    }

    return sendHordesClientCommand("itemmove", `${fromSlot} ${toSlot}`);
  }

  function sendHordesItemSplitOne(slotIndex) {
    const slot = Number(slotIndex);
    if (!Number.isInteger(slot) || slot < 0) {
      throw new Error(`잘못된 분리 슬롯입니다: ${slotIndex}`);
    }

    return sendHordesClientCommand("itemsplitone", String(slot));
  }

  function encodeHordesClientCommand(command, payload) {
    const commandBytes = encodeUtf8(command);
    const payloadBytes = encodeUtf8(payload);
    const commandLength = encodeVarUint(commandBytes.length);
    const payloadLength = encodeVarUint(payloadBytes.length);
    const packet = new Uint8Array(
      1 + commandLength.length + commandBytes.length + payloadLength.length + payloadBytes.length
    );
    let offset = 0;
    packet[offset++] = HORDES_CLIENT_COMMAND_HEADER;
    packet.set(commandLength, offset);
    offset += commandLength.length;
    packet.set(commandBytes, offset);
    offset += commandBytes.length;
    packet.set(payloadLength, offset);
    offset += payloadLength.length;
    packet.set(payloadBytes, offset);
    return packet;
  }

  function encodeUtf8(text) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(String(text));

    const encoded = unescape(encodeURIComponent(String(text)));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes;
  }

  function encodeVarUint(value) {
    const bytes = [];
    let next = Math.max(0, Number(value) || 0);
    while (next > 127) {
      bytes.push((next & 127) | 128);
      next >>= 7;
    }
    bytes.push(next & 127);
    return Uint8Array.from(bytes);
  }

  function normalizeGearPresetName(name) {
    const normalized = String(name || GEAR_PRESET_CONFIG.lastPreset || GEAR_PRESET_DEFAULT_NAME).trim();
    return normalized || GEAR_PRESET_DEFAULT_NAME;
  }

  function scanVisibleBagGearItems() {
    return Array.from(document.querySelectorAll('[id^="bag"].slot.filled'))
      .map((slot) => summarizeBagGearSlot(slot))
      .filter((item) => item && item.iconKey && isGearPresetEquippableItem(item));
  }

  function scanRuntimeGearItems() {
    return getRuntimeInventorySlotEntries()
      .map(([slotIndex, item]) => summarizeRuntimeGearItem(slotIndex, item))
      .filter((item) => item && item.dbid && isGearPresetEquippableItem(item));
  }

  function scanRuntimeInventoryItems() {
    return getRuntimeInventorySlotEntries()
      .map(([slotIndex, item]) => summarizeRuntimeInventoryItem(slotIndex, item))
      .filter((item) => item && item.dbid)
      .sort((left, right) => left.slotIndex - right.slotIndex);
  }

  function scanRuntimeEquippedGearItems() {
    return scanRuntimeGearItems()
      .filter((item) => isGearEquipSlot(item.slotIndex))
      .sort((left, right) => left.slotIndex - right.slotIndex);
  }

  function getRuntimeInventorySlotEntries() {
    const runtime = getExposedRuntime();
    const player = runtime && runtime.player;
    const inventory = player && safeReadValue(player, "inventory");
    const slots = inventory && safeReadValue(inventory, "slots");
    if (!slots) return [];

    if (slots instanceof Map) {
      return Array.from(slots.entries())
        .map(([slot, item]) => [Number(slot), item])
        .filter(([slot, item]) => Number.isInteger(slot) && item);
    }

    if (Array.isArray(slots)) {
      return slots
        .map((item, slot) => [slot, item])
        .filter(([slot, item]) => Number.isInteger(slot) && item);
    }

    if (isObject(slots)) {
      return Object.entries(slots)
        .map(([slot, item]) => [Number(slot), item])
        .filter(([slot, item]) => Number.isInteger(slot) && item);
    }

    return [];
  }

  function getRuntimeInventorySize() {
    const runtime = getExposedRuntime();
    const player = runtime && runtime.player;
    const inventory = player && safeReadValue(player, "inventory");
    const size = Number(inventory && safeReadValue(inventory, "size"));
    if (Number.isInteger(size) && size > 0) return size;

    const bagSlots = getRuntimeInventorySlotEntries()
      .map(([slotIndex]) => slotIndex)
      .filter((slotIndex) => Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < 100);
    return bagSlots.length > 0 ? Math.max(...bagSlots) + 1 : 0;
  }

  function getRuntimeUsedSlotIndexes() {
    return new Set(getRuntimeInventorySlotEntries().map(([slotIndex]) => slotIndex));
  }

  function takeEmptyRuntimeBagSlots(count, usedSlots = getRuntimeUsedSlotIndexes()) {
    const size = getRuntimeInventorySize();
    const slots = [];
    for (let slotIndex = 0; slotIndex < size && slots.length < count; slotIndex += 1) {
      if (usedSlots.has(slotIndex)) continue;

      usedSlots.add(slotIndex);
      slots.push(slotIndex);
    }
    return slots;
  }

  function summarizeRuntimeGearItem(slotIndex, item) {
    const summary = summarizeRuntimeInventoryItem(slotIndex, item);
    if (!summary) return null;

    const equipSlot = isGearEquipSlot(slotIndex) ? slotIndex : getGearEquipSlotForItem({ itemType: summary.itemType });
    return {
      ...summary,
      equipSlot,
    };
  }

  function summarizeRuntimeInventoryItem(slotIndex, item) {
    if (!item || !Number.isInteger(slotIndex)) return null;

    const itemType = String(safeReadValue(item, "type") || "").toLowerCase();
    const tier = safeReadValue(item, "tier");
    const dbid = safeReadValue(item, "dbid");
    if (!itemType || dbid === undefined || dbid === null) return null;

    const numericTier = Number.isFinite(Number(tier)) ? Number(tier) : null;
    const bound = Number(safeReadValue(item, "bound"));
    const iconKey = getRuntimeGearIconKey(itemType, tier);
    return {
      slotId: isGearEquipSlot(slotIndex) ? `equip${slotIndex}` : `bag${slotIndex}`,
      slotIndex,
      equipSlot: null,
      dbid: String(dbid),
      itemType,
      tier: numericTier,
      upgrade: Number.isFinite(Number(safeReadValue(item, "upgrade"))) ? Number(safeReadValue(item, "upgrade")) : 0,
      quality: Number.isFinite(Number(safeReadValue(item, "quality"))) ? Number(safeReadValue(item, "quality")) : null,
      stacks: Number.isFinite(Number(safeReadValue(item, "stacks"))) ? Number(safeReadValue(item, "stacks")) : null,
      gearScore: Number.isFinite(Number(safeReadValue(item, "gs"))) ? Number(safeReadValue(item, "gs")) : null,
      bound: Number.isFinite(bound) ? bound : null,
      tradable: !Number.isFinite(bound) || bound === 0,
      owner: String(safeReadValue(item, "owner") || ""),
      iconKey,
      iconSrc: iconKey,
      source: "runtime",
      fromRuntime: true,
    };
  }

  function getRuntimeGearIconKey(itemType, tier) {
    if (!itemType || tier === undefined || tier === null) return "";
    return `/data/items/${itemType}/${tier}.avif`;
  }

  function isGearEquipSlot(slotIndex) {
    return GEAR_EQUIP_SLOT_SET.has(Number(slotIndex));
  }

  function summarizeBagGearSlot(slot) {
    if (!slot || !slot.id) return null;

    const icon = slot.querySelector("img.icon");
    const iconSrc = icon && icon.getAttribute("src");
    const iconKey = normalizeGearIconSrc(iconSrc);
    if (!iconKey) return null;

    const rect = slot.getBoundingClientRect();
    const stack = slot.querySelector(".stacks");
    const slotIndex = getBagSlotIndex(slot.id);
    return {
      slotId: slot.id,
      slotIndex,
      itemType: getGearItemTypeFromIconKey(iconKey),
      equipSlot: null,
      dbid: "",
      iconKey,
      iconSrc: icon ? icon.src : iconSrc,
      rarity: getGearSlotRarity(slot),
      upgradeText: stack ? stack.textContent.trim() : "",
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      element: slot,
    };
  }

  function getBagSlotIndex(slotId) {
    const match = String(slotId || "").match(/^bag(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function normalizeGearIconSrc(src) {
    if (!src) return "";

    try {
      return new URL(src, location.href).pathname;
    } catch {
      return String(src).split("?")[0];
    }
  }

  function getGearItemTypeFromIconKey(iconKey) {
    const match = String(iconKey || "").match(/\/data\/items\/([^/]+)\//i);
    return match ? match[1].toLowerCase() : "";
  }

  function getGearSlotRarity(slot) {
    const className = String(slot && slot.className || "");
    const match = className.match(/\b(grey|white|green|blue|purp|orange|red)\b/i);
    return match ? match[1].toLowerCase() : "";
  }

  function isGearPresetEquippableItem(item) {
    if (!item || !item.itemType) return false;
    return !GEAR_PRESET_NON_EQUIP_TYPES.has(item.itemType);
  }

  function stripGearPresetElement(item) {
    if (!item) return item;
    const { element, ...safeItem } = item;
    return safeItem;
  }

  function saveGearPresetFromVisibleBag(name) {
    const presetName = normalizeGearPresetName(name);
    const items = scanVisibleBagGearItems().map(stripGearPresetElement);

    if (items.length === 0) {
      GEAR_PRESET_STATE.lastState = "저장 실패";
      GEAR_PRESET_STATE.lastError = "현재 보이는 가방에서 장착 가능한 아이템을 찾지 못했습니다.";
      renderStatusUi();
      return getGearPresetStatus();
    }

    GEAR_PRESET_CONFIG.presets[presetName] = {
      name: presetName,
      savedAt: new Date().toISOString(),
      items,
    };
    GEAR_PRESET_CONFIG.lastPreset = presetName;
    saveGearPresetConfig();

    GEAR_PRESET_STATE.lastState = `${items.length}개 저장됨`;
    GEAR_PRESET_STATE.lastError = "";
    GEAR_PRESET_STATE.lastSavedAt = new Date();
    renderStatusUi();
    return getGearPresetStatus();
  }

  function saveGearPresetFromCurrentEquipment(name) {
    const presetName = normalizeGearPresetName(name);
    const items = scanRuntimeEquippedGearItems().map(stripGearPresetElement);

    if (items.length === 0) {
      GEAR_PRESET_STATE.lastState = "저장 실패";
      GEAR_PRESET_STATE.lastError = "현재 장착 중인 아이템을 런타임 인벤토리에서 찾지 못했습니다. 새로고침 후 다시 시도하세요.";
      renderStatusUi();
      return getGearPresetStatus();
    }

    GEAR_PRESET_CONFIG.presets[presetName] = {
      name: presetName,
      savedAt: new Date().toISOString(),
      source: "equipped",
      exactSlots: true,
      items,
    };
    GEAR_PRESET_CONFIG.lastPreset = presetName;
    saveGearPresetConfig();

    GEAR_PRESET_STATE.lastState = `프리셋 ${presetName} / ${items.length}개 저장`;
    GEAR_PRESET_STATE.lastError = "";
    GEAR_PRESET_STATE.lastSavedAt = new Date();
    renderStatusUi();
    return getGearPresetStatus();
  }

  function getGearPreset(name) {
    const presetName = normalizeGearPresetName(name);
    return GEAR_PRESET_CONFIG.presets[presetName] || null;
  }

  async function runGearPresetByName(name) {
    const presetName = normalizeGearPresetName(name);
    const preset = getGearPreset(presetName);
    if (!preset || !Array.isArray(preset.items) || preset.items.length === 0) {
      GEAR_PRESET_STATE.lastState = "장착 실패";
      GEAR_PRESET_STATE.lastError = "저장된 장비 프리셋이 없습니다.";
      renderStatusUi();
      return getGearPresetStatus();
    }

    return equipGearItems(preset.items, `preset:${presetName}`, {
      allowSavedSlots: true,
      exactSlots: preset.exactSlots === true || preset.source === "equipped",
      presetName,
    });
  }

  async function equipVisibleBagGear() {
    const items = scanVisibleBagGearItems().map(stripGearPresetElement);
    if (items.length === 0) {
      GEAR_PRESET_STATE.lastState = "장착 실패";
      GEAR_PRESET_STATE.lastError = "현재 보이는 가방에서 장착 가능한 아이템을 찾지 못했습니다.";
      renderStatusUi();
      return getGearPresetStatus();
    }

    return equipGearItems(items, "visibleBag", { allowSavedSlots: false });
  }

  async function equipGearItems(items, source, options = {}) {
    if (GEAR_PRESET_STATE.running) return getGearPresetStatus();

    const presetName = String(options.presetName || "").trim();
    const requested = sortGearPresetItemsForEquip(Array.isArray(items) ? items.filter(Boolean) : []);
    const resolved = resolveGearPresetItemsAtStart(requested, options);
    const plannedEquipCount = resolved.filter((item) => item.slotIndex !== item.equipSlot).length;
    const plannedUnequipCount = options.exactSlots === true
      ? resolveGearPresetUnequipMoves(requested).length
      : 0;
    let progressDone = 0;
    let progressTotal = plannedEquipCount + plannedUnequipCount;
    const result = {
      source,
      presetName,
      requested: requested.length,
      resolved: resolved.length,
      equipped: 0,
      unequipped: 0,
      skipped: 0,
      alreadyMissing: 0,
      savedSlotFallback: 0,
      exactSlots: options.exactSlots === true,
      verify: null,
      errors: [],
      items: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    GEAR_PRESET_STATE.running = true;
    GEAR_PRESET_STATE.pendingPresetName = presetName;
    GEAR_PRESET_STATE.lastRequestedPresetName = presetName;
    GEAR_PRESET_STATE.lastVerifiedPresetName = "";
    GEAR_PRESET_STATE.lastState = "장착 중";
    GEAR_PRESET_STATE.lastError = "";
    GEAR_PRESET_STATE.lastResult = result;
    renderStatusUi();
    if (presetName) {
      showGearPresetProgressOverlay(formatGearPresetProgressMessage(presetName, progressDone, progressTotal));
    }

    let fatalError = null;
    try {
      if (!getGameWebSocket()) {
        throw new Error("게임 WebSocket을 찾지 못했습니다. 새로고침 후 다시 시도하세요.");
      }

      for (const item of requested) {
        const current = resolved.find((candidate) => candidate.requestedItem === item);
        if (!current) {
          result.alreadyMissing += 1;
          result.items.push({ ...stripGearPresetElement(item), state: "not-found-or-already-equipped" });
          continue;
        }

        let sentMove = false;
        try {
          if (current.slotIndex === current.equipSlot) {
            result.skipped += 1;
            result.items.push({ ...stripGearPresetElement(current), state: "already-equipped" });
            continue;
          }

          sendHordesItemMove(current.slotIndex, current.equipSlot);
          sentMove = true;
          result.equipped += 1;
          if (current.fromSavedSlot) result.savedSlotFallback += 1;
          result.items.push({ ...stripGearPresetElement(current), state: "sent" });
        } catch (error) {
          result.errors.push(error && error.message ? error.message : String(error));
          result.items.push({ ...stripGearPresetElement(current), state: "error" });
        }

        progressDone += 1;
        if (presetName) {
          showGearPresetProgressOverlay(formatGearPresetProgressMessage(presetName, progressDone, progressTotal));
        }
        if (sentMove) await delay(GEAR_PRESET_EQUIP_DELAY_MS);
      }

      if (options.exactSlots === true) {
        const unequipMoves = resolveGearPresetUnequipMoves(requested);
        result.unequipRequested = unequipMoves.length;
        progressTotal = Math.max(progressTotal, progressDone + unequipMoves.length);
        if (presetName) {
          showGearPresetProgressOverlay(formatGearPresetProgressMessage(presetName, progressDone, progressTotal));
        }

        for (const move of unequipMoves) {
          let sentMove = false;
          try {
            if (!Number.isInteger(move.toSlot)) {
              throw new Error(move.error || "빈 가방 칸을 찾지 못했습니다.");
            }

            sendHordesItemMove(move.slotIndex, move.toSlot);
            sentMove = true;
            result.unequipped += 1;
            result.items.push({ ...stripGearPresetElement(move), state: "unequip-sent" });
          } catch (error) {
            result.errors.push(error && error.message ? error.message : String(error));
            result.items.push({ ...stripGearPresetElement(move), state: "unequip-error" });
          }

          progressDone += 1;
          if (presetName) {
            showGearPresetProgressOverlay(formatGearPresetProgressMessage(presetName, progressDone, progressTotal));
          }
          if (sentMove) await delay(GEAR_PRESET_EQUIP_DELAY_MS);
        }
      }

      if (presetName) {
        showGearPresetProgressOverlay(`프리셋 ${presetName} 전환 확인 중`);
      }
      await delay(120);
      result.verify = await waitForGearPresetVerification(requested, {
        exactSlots: options.exactSlots === true,
      });
    } catch (error) {
      fatalError = error;
      result.errors.push(error && error.message ? error.message : String(error));
    } finally {
      result.finishedAt = new Date().toISOString();
      GEAR_PRESET_STATE.running = false;
      GEAR_PRESET_STATE.pendingPresetName = "";
      GEAR_PRESET_STATE.lastRunAt = new Date();
      GEAR_PRESET_STATE.lastResult = result;
      if (presetName && result.verify && result.verify.complete) {
        GEAR_PRESET_STATE.lastVerifiedPresetName = presetName;
      }
      GEAR_PRESET_STATE.lastState = result.verify
        ? `${result.verify.matched}/${result.verify.total}개 확인`
        : `${result.equipped}/${result.requested}개 전송`;
      GEAR_PRESET_STATE.lastError = result.errors[0] ||
        (result.verify && !result.verify.complete ? `미장착 ${result.verify.missing.length}개` : "");
      if (presetName) {
        if (fatalError || result.errors.length > 0) {
          showGearPresetProgressOverlay(`프리셋 ${presetName} 전환 실패`, "error", 2400);
        } else if (result.verify && result.verify.complete) {
          showGearPresetProgressOverlay(`프리셋 ${presetName} 전환 완료`, "success", 1800);
        } else if (result.verify) {
          showGearPresetProgressOverlay(formatGearPresetIncompleteMessage(presetName, result.verify), "warn", 3600);
        } else {
          showGearPresetProgressOverlay(`프리셋 ${presetName} 전환 확인 실패`, "warn", 2400);
        }
      }
      renderStatusUi();
    }

    return getGearPresetStatus();
  }

  function findCurrentBagSlotForGearPresetItem(savedItem, usedSlotIds) {
    const currentItems = scanVisibleBagGearItems().filter((item) => !usedSlotIds.has(item.slotId));
    const exactSlot = currentItems.find(
      (item) => item.slotId === savedItem.slotId && item.iconKey === savedItem.iconKey
    );
    if (exactSlot) return exactSlot;

    return currentItems.find((item) => item.iconKey === savedItem.iconKey) || null;
  }

  function findRuntimeSlotForGearPresetItem(savedItem, usedSlotIds) {
    const dbid = savedItem && savedItem.dbid ? String(savedItem.dbid) : "";
    if (!dbid) return null;

    return scanRuntimeGearItems().find((item) => (
      item.dbid === dbid &&
      !usedSlotIds.has(item.slotId) &&
      Number.isInteger(item.slotIndex)
    )) || null;
  }

  function resolveGearPresetUnequipMoves(presetItems) {
    const expectedSlots = getGearPresetExpectedEquipSlots(presetItems);
    const extras = scanRuntimeEquippedGearItems()
      .filter((item) => (
        GEAR_PRESET_EXACT_UNEQUIP_SLOTS.includes(item.slotIndex) &&
        !expectedSlots.has(item.slotIndex)
      ));
    const emptySlots = takeEmptyRuntimeBagSlots(extras.length);
    const moves = [];

    for (let index = 0; index < extras.length; index += 1) {
      const toSlot = emptySlots[index];
      if (!Number.isInteger(toSlot)) {
        moves.push({
          ...stripGearPresetElement(extras[index]),
          toSlot: null,
          error: "빈 가방 칸 없음",
        });
        continue;
      }

      moves.push({
        ...stripGearPresetElement(extras[index]),
        toSlot,
      });
    }

    return moves;
  }

  function getGearPresetExpectedEquipSlots(items) {
    const slots = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const slot = getGearEquipSlotForPresetItem(item, item);
      if (isGearEquipSlot(slot)) slots.add(slot);
    }
    return slots;
  }

  function resolveGearPresetItemsAtStart(items, options = {}) {
    const usedSlotIds = new Set();
    const resolved = [];

    for (const item of items) {
      const current = findRuntimeSlotForGearPresetItem(item, usedSlotIds) ||
        findCurrentBagSlotForGearPresetItem(item, usedSlotIds) ||
        (options.allowSavedSlots ? resolveSavedGearPresetSlot(item, usedSlotIds) : null);
      if (!current) continue;

      const equipSlot = getGearEquipSlotForPresetItem(item, current);
      if (!Number.isInteger(current.slotIndex) || !Number.isInteger(equipSlot)) continue;

      usedSlotIds.add(current.slotId);
      resolved.push({
        ...stripGearPresetElement(current),
        equipSlot,
        requestedItem: item,
      });
    }

    return resolved;
  }

  function resolveSavedGearPresetSlot(savedItem, usedSlotIds) {
    if (!savedItem) return null;

    const slotIndex = Number(savedItem.slotIndex);
    const slotId = savedItem.slotId || (Number.isInteger(slotIndex) ? `bag${slotIndex}` : "");
    if (!slotId || usedSlotIds.has(slotId) || !Number.isInteger(slotIndex)) return null;

    return {
      ...stripGearPresetElement(savedItem),
      slotId,
      slotIndex,
      fromSavedSlot: true,
    };
  }

  function getGearEquipSlotForItem(item) {
    return GEAR_EQUIP_SLOT_BY_TYPE[item && item.itemType] || null;
  }

  function getGearEquipSlotForPresetItem(savedItem, currentItem) {
    const savedSlot = Number(savedItem && savedItem.equipSlot);
    if (isGearEquipSlot(savedSlot)) return savedSlot;

    const currentSlot = Number(currentItem && currentItem.equipSlot);
    if (isGearEquipSlot(currentSlot)) return currentSlot;

    return getGearEquipSlotForItem(currentItem || savedItem);
  }

  function verifyGearPresetItemsEquipped(items, options = {}) {
    const equippedItems = scanRuntimeEquippedGearItems();
    const expectedSlots = getGearPresetExpectedEquipSlots(items);
    const expected = (Array.isArray(items) ? items : [])
      .filter((item) => item && item.dbid)
      .map((item) => ({
        dbid: String(item.dbid),
        equipSlot: getGearEquipSlotForPresetItem(item, item),
        itemType: item.itemType || "",
      }));
    const matched = [];
    const missing = [];

    for (const item of expected) {
      const found = equippedItems.find((candidate) => (
        candidate.dbid === item.dbid &&
        (!isGearEquipSlot(item.equipSlot) || candidate.slotIndex === item.equipSlot)
      ));

      if (found) {
        matched.push({
          dbid: item.dbid,
          slotIndex: found.slotIndex,
          itemType: found.itemType,
        });
      } else {
        missing.push(item);
      }
    }

    const extraEquipped = options.exactSlots === true
      ? equippedItems
        .filter((item) => (
          GEAR_PRESET_EXACT_UNEQUIP_SLOTS.includes(item.slotIndex) &&
          !expectedSlots.has(item.slotIndex)
        ))
        .map(stripGearPresetElement)
      : [];

    return {
      total: expected.length,
      matched: matched.length,
      complete: expected.length > 0 && missing.length === 0 && extraEquipped.length === 0,
      missing,
      extraEquipped,
      matchedItems: matched,
      checkedAt: new Date().toISOString(),
    };
  }

  async function waitForGearPresetVerification(items, options = {}) {
    const maxAttempts = GEAR_PRESET_VERIFY_RETRY_DELAYS_MS.length + 1;
    let verify = null;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      if (attemptIndex > 0) {
        await delay(GEAR_PRESET_VERIFY_RETRY_DELAYS_MS[attemptIndex - 1]);
      }

      verify = verifyGearPresetItemsEquipped(items, options);
      verify.attempt = attemptIndex + 1;
      verify.maxAttempts = maxAttempts;
      if (verify.complete) return verify;
    }

    return verify;
  }

  function getGearPresetMatchStatus(presetName) {
    const preset = getGearPreset(presetName);
    if (!preset || !Array.isArray(preset.items) || preset.items.length === 0) {
      return {
        presetName,
        saved: false,
        total: 0,
        matched: 0,
        complete: false,
        missing: [],
      };
    }

    return {
      presetName,
      saved: true,
      exactSlots: preset.exactSlots === true || preset.source === "equipped",
      ...verifyGearPresetItemsEquipped(preset.items, {
        exactSlots: preset.exactSlots === true || preset.source === "equipped",
      }),
    };
  }

  function sortGearPresetItemsForEquip(items) {
    return items.slice().sort((left, right) => {
      const leftTypeWeight = getGearPresetEquipTypeWeight(left);
      const rightTypeWeight = getGearPresetEquipTypeWeight(right);
      if (leftTypeWeight !== rightTypeWeight) return leftTypeWeight - rightTypeWeight;

      const leftSlot = Number.isFinite(left.slotIndex) ? left.slotIndex : -1;
      const rightSlot = Number.isFinite(right.slotIndex) ? right.slotIndex : -1;
      return rightSlot - leftSlot;
    });
  }

  function getGearPresetEquipTypeWeight(item) {
    const type = item && item.itemType;
    if (type === "bag") return 100;
    return 0;
  }

  function delay(ms) {
    return new Promise((resolve) => {
      pageWindow.setTimeout(resolve, ms);
    });
  }

  function getGearPresetStatus() {
    const visibleItems = scanVisibleBagGearItems().map(stripGearPresetElement);
    const runtimeItems = scanRuntimeGearItems().map(stripGearPresetElement);
    const equippedItems = runtimeItems.filter((item) => isGearEquipSlot(item.slotIndex));
    const preset = getGearPreset(GEAR_PRESET_CONFIG.lastPreset);
    return {
      running: GEAR_PRESET_STATE.running,
      lastState: GEAR_PRESET_STATE.lastState,
      lastError: GEAR_PRESET_STATE.lastError,
      lastSavedAt: GEAR_PRESET_STATE.lastSavedAt,
      lastRunAt: GEAR_PRESET_STATE.lastRunAt,
      visibleCount: visibleItems.length,
      visibleItems,
      runtimeCount: runtimeItems.length,
      runtimeItems,
      equippedCount: equippedItems.length,
      equippedItems,
      quickPresets: GEAR_PRESET_QUICK_NAMES.map((presetName) => {
        const quickPreset = getGearPreset(presetName);
        const match = getGearPresetMatchStatus(presetName);
        return {
          name: presetName,
          savedAt: quickPreset && quickPreset.savedAt || "",
          count: quickPreset && Array.isArray(quickPreset.items) ? quickPreset.items.length : 0,
          match,
        };
      }),
      preset: preset
        ? {
            name: preset.name || GEAR_PRESET_CONFIG.lastPreset,
            savedAt: preset.savedAt || "",
            count: Array.isArray(preset.items) ? preset.items.length : 0,
            items: Array.isArray(preset.items) ? preset.items.slice() : [],
          }
        : null,
      socket: getGearSocketStatus(),
      lastResult: GEAR_PRESET_STATE.lastResult,
    };
  }

  function saveSkillPresetConfig() {
    saveJsonConfig(SKILL_PRESET_CONFIG_KEY, SKILL_PRESET_CONFIG);
  }

  function normalizeSkillPresetName(name) {
    const normalized = String(name || SKILL_PRESET_CONFIG.lastPreset || SKILL_PRESET_DEFAULT_NAME).trim();
    return normalized || SKILL_PRESET_DEFAULT_NAME;
  }

  function getSkillPreset(name) {
    const presetName = normalizeSkillPresetName(name);
    return SKILL_PRESET_CONFIG.presets[presetName] || null;
  }

  function getRuntimeSkillController() {
    const runtime = getExposedRuntime();
    const player = runtime && runtime.player;
    return player && safeReadValue(player, "skills") || null;
  }

  function scanRuntimeActiveSkillIds() {
    const storeIds = scanRuntimeActiveSkillStoreIds();
    if (storeIds.length > 0) return storeIds;

    const controller = getRuntimeSkillController();
    if (!controller) return [];

    const activeIds = safeReadValue(controller, "skillIdsActive");
    if (Array.isArray(activeIds) && activeIds.length > 0) {
      return normalizeSkillPresetIds(activeIds);
    }

    return expandSkillEntriesToIds(scanRuntimeActiveSkillEntries());
  }

  function scanRuntimeActiveSkillEntries() {
    const storeEntries = scanRuntimeActiveSkillStoreEntries();
    if (storeEntries.length > 0) return storeEntries;

    const controller = getRuntimeSkillController();
    const skills = controller && safeReadValue(controller, "skills");
    if (!skills) return [];

    const entries = [];
    const pushEntry = (rawId, value) => {
      const skill = summarizeRuntimeSkillEntry(rawId, value);
      if (skill && skill.configurable) entries.push(skill);
    };

    if (skills instanceof Map) {
      skills.forEach((value, key) => pushEntry(key, value));
    } else if (Array.isArray(skills)) {
      skills.forEach((value, key) => value && pushEntry(key, value));
    } else if (isObject(skills)) {
      Object.entries(skills).forEach(([key, value]) => pushEntry(key, value));
    }

    return entries.sort((left, right) => left.id - right.id);
  }

  function scanRuntimeActiveSkillStoreIds() {
    const runtime = getExposedRuntime();
    if (!runtime) return [];

    const getter = safeReadValue(runtime, "getActiveSkillConfig");
    if (typeof getter === "function") {
      try {
        const ids = normalizeSkillPresetIds(getter.call(runtime));
        if (ids.length > 0) return ids;
      } catch {
        // Fall back to reading the Svelte store directly.
      }
    }

    return expandSkillEntriesToIds(scanRuntimeActiveSkillStoreEntries());
  }

  function scanRuntimeActiveSkillStoreEntries() {
    const runtime = getExposedRuntime();
    const stores = runtime && safeReadValue(runtime, "skillStores");
    const activeStore = stores && safeReadValue(stores, "active");
    const activeValue = readSvelteStoreValue(activeStore);
    return summarizeSkillStoreEntries(activeValue, runtime);
  }

  function readSvelteStoreValue(store) {
    const subscribe = safeReadValue(store, "subscribe");
    if (typeof subscribe !== "function") return null;

    let value = null;
    let gotValue = false;
    let unsubscribe = null;
    try {
      unsubscribe = subscribe.call(store, (nextValue) => {
        if (gotValue) return;
        value = nextValue;
        gotValue = true;
      });
    } catch {
      return null;
    } finally {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
          // Store reads are diagnostic and should not affect game execution.
        }
      }
    }

    return gotValue ? value : null;
  }

  function summarizeSkillStoreEntries(value, runtime) {
    const entries = [];
    const pushEntry = (rawId, rawLevel) => {
      const id = normalizeSkillPresetId(rawId);
      const level = normalizeSkillStoreLevel(rawLevel);
      if (!Number.isInteger(id) || level <= 0) return;
      if (!isRuntimeSkillConfigurable(runtime, id)) return;

      entries.push({
        id,
        level,
        engineOnly: false,
        configurable: true,
        minlevel: 0,
      });
    };

    if (!value) return entries;

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (Array.isArray(entry)) {
          pushEntry(entry[0], entry[1] === undefined ? 1 : entry[1]);
        } else if (isObject(entry)) {
          pushEntry(safeReadValue(entry, "id") ?? safeReadValue(entry, "skillId") ?? index, safeReadValue(entry, "level") ?? 1);
        } else {
          pushEntry(entry, 1);
        }
      });
    } else if (typeof safeReadValue(value, "forEach") === "function") {
      try {
        value.forEach((level, id) => pushEntry(id, level));
      } catch {
        // Fall back to object scanning below.
      }
    } else if (isObject(value)) {
      Object.entries(value).forEach(([id, level]) => pushEntry(id, level));
    }

    return entries.sort((left, right) => left.id - right.id);
  }

  function isRuntimeSkillConfigurable(runtime, id) {
    const normalizedId = normalizeSkillPresetId(id);
    if (!Number.isInteger(normalizedId)) return false;

    const helper = runtime && safeReadValue(runtime, "isSkillConfigurable");
    if (typeof helper === "function") {
      try {
        return helper.call(runtime, normalizedId) !== false;
      } catch {
        // Fall through to exposed skill definition metadata.
      }
    }

    const definitions = runtime && safeReadValue(runtime, "skillDefinitions");
    const definition = readRuntimeSkillDefinition(definitions, normalizedId);
    if (definition) return !Boolean(safeReadValue(definition, "engineOnly"));

    return true;
  }

  function readRuntimeSkillDefinition(definitions, id) {
    if (!definitions) return null;

    if (typeof safeReadValue(definitions, "get") === "function") {
      try {
        return definitions.get(id) || null;
      } catch {
        return null;
      }
    }

    if (Array.isArray(definitions)) return definitions[id] || null;
    if (isObject(definitions)) return definitions[id] || definitions[String(id)] || null;
    return null;
  }

  function normalizeSkillStoreLevel(value) {
    if (isObject(value)) {
      for (const key of ["level", "count", "points", "value"]) {
        const normalized = normalizeSkillStoreLevel(safeReadValue(value, key));
        if (normalized > 0) return normalized;
      }
      return 0;
    }

    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function summarizeRuntimeSkillEntry(rawId, value) {
    const logic = value && safeReadValue(value, "logic");
    const id = normalizeSkillPresetId(
      logic && safeReadValue(logic, "id") !== undefined ? safeReadValue(logic, "id") : rawId
    );
    const level = Math.max(0, Math.floor(Number(value && safeReadValue(value, "level")) || 0));
    if (!Number.isInteger(id) || level <= 0) return null;

    const engineOnly = Boolean(logic && safeReadValue(logic, "engineOnly"));
    return {
      id,
      level,
      engineOnly,
      configurable: !engineOnly,
      minlevel: Number(logic && safeReadValue(logic, "minlevel")) || 0,
    };
  }

  function expandSkillEntriesToIds(entries) {
    const ids = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      const id = normalizeSkillPresetId(entry && entry.id);
      const level = Math.max(0, Math.floor(Number(entry && entry.level) || 0));
      if (!Number.isInteger(id) || level <= 0) continue;
      for (let index = 0; index < level; index += 1) ids.push(id);
    }
    return ids;
  }

  function normalizeSkillPresetId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  function normalizeSkillPresetIds(values) {
    return (Array.isArray(values) ? values : [])
      .map(normalizeSkillPresetId)
      .filter(Number.isInteger);
  }

  function saveSkillPresetFromCurrentConfig(name) {
    const presetName = normalizeSkillPresetName(name);
    const skillIds = scanRuntimeActiveSkillIds();

    if (skillIds.length === 0) {
      SKILL_PRESET_STATE.lastState = "저장 실패";
      SKILL_PRESET_STATE.lastError = "현재 활성 스킬 구성을 찾지 못했습니다. 스킬 패널에서 스킬을 적용한 뒤 다시 저장하세요.";
      renderStatusUi();
      return getSkillPresetStatus();
    }

    SKILL_PRESET_CONFIG.presets[presetName] = {
      name: presetName,
      savedAt: new Date().toISOString(),
      skillIds,
    };
    SKILL_PRESET_CONFIG.lastPreset = presetName;
    saveSkillPresetConfig();

    SKILL_PRESET_STATE.lastState = `스킬 프리셋 ${presetName} / ${skillIds.length}포인트 저장`;
    SKILL_PRESET_STATE.lastError = "";
    SKILL_PRESET_STATE.lastSavedAt = new Date();
    renderStatusUi();
    return getSkillPresetStatus();
  }

  async function runSkillPresetByName(name) {
    if (SKILL_PRESET_STATE.running) return getSkillPresetStatus();

    const presetName = normalizeSkillPresetName(name);
    const preset = getSkillPreset(presetName);
    const skillIds = filterConfigurableSkillPresetIds(preset && preset.skillIds || []);
    if (!preset || skillIds.length === 0) {
      SKILL_PRESET_STATE.lastState = "적용 실패";
      SKILL_PRESET_STATE.lastError = "저장된 스킬 프리셋이 없습니다.";
      renderStatusUi();
      return getSkillPresetStatus();
    }

    const result = {
      presetName,
      requested: skillIds.length,
      sent: false,
      verify: null,
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    SKILL_PRESET_STATE.running = true;
    SKILL_PRESET_STATE.pendingPresetName = presetName;
    SKILL_PRESET_STATE.lastRequestedPresetName = presetName;
    SKILL_PRESET_STATE.lastVerifiedPresetName = "";
    SKILL_PRESET_STATE.lastState = "적용 중";
    SKILL_PRESET_STATE.lastError = "";
    SKILL_PRESET_STATE.lastResult = result;
    showGearPresetProgressOverlay(`스킬 프리셋 ${presetName} 적용 중`);
    renderStatusUi();

    let fatalError = null;
    try {
      if (!getGameWebSocket()) {
        throw new Error("게임 WebSocket을 찾지 못했습니다. 새로고침 후 다시 시도하세요.");
      }

      sendHordesSkillConfig(skillIds);
      result.sent = true;
      showGearPresetProgressOverlay(`스킬 프리셋 ${presetName} 적용 확인 중`);
      result.verify = await waitForSkillPresetVerification(skillIds);
    } catch (error) {
      fatalError = error;
      result.errors.push(error && error.message ? error.message : String(error));
    } finally {
      result.finishedAt = new Date().toISOString();
      SKILL_PRESET_STATE.running = false;
      SKILL_PRESET_STATE.pendingPresetName = "";
      SKILL_PRESET_STATE.lastRunAt = new Date();
      SKILL_PRESET_STATE.lastResult = result;
      if (presetName && result.verify && result.verify.complete) {
        SKILL_PRESET_STATE.lastVerifiedPresetName = presetName;
      }
      SKILL_PRESET_STATE.lastState = result.verify
        ? `${result.verify.matched}/${result.verify.total}포인트 확인`
        : result.sent
          ? "전송됨"
          : "적용 실패";
      SKILL_PRESET_STATE.lastError = result.errors[0] ||
        (result.verify && !result.verify.complete ? `미적용 ${result.verify.missing.length}포인트` : "");

      if (fatalError || result.errors.length > 0) {
        showGearPresetProgressOverlay(`스킬 프리셋 ${presetName} 적용 실패`, "error", 2400);
      } else if (result.verify && result.verify.complete) {
        showGearPresetProgressOverlay(`스킬 프리셋 ${presetName} 적용 완료`, "success", 1800);
      } else if (result.verify) {
        showGearPresetProgressOverlay(formatSkillPresetIncompleteMessage(presetName, result.verify), "warn", 3600);
      } else {
        showGearPresetProgressOverlay(`스킬 프리셋 ${presetName} 적용 확인 실패`, "warn", 2400);
      }

      renderStatusUi();
    }

    return getSkillPresetStatus();
  }

  function sendHordesSkillConfig(skillIds) {
    const ids = filterConfigurableSkillPresetIds(normalizeSkillPresetIds(skillIds));
    if (ids.length === 0) throw new Error("적용할 스킬 ID가 없습니다.");
    return sendHordesClientCommand("skillconfig", ids.join(","));
  }

  function filterConfigurableSkillPresetIds(skillIds) {
    const runtime = getExposedRuntime();
    return normalizeSkillPresetIds(skillIds).filter((id) => isRuntimeSkillConfigurable(runtime, id));
  }

  async function waitForSkillPresetVerification(skillIds) {
    const maxAttempts = GEAR_PRESET_VERIFY_RETRY_DELAYS_MS.length + 1;
    let verify = null;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      if (attemptIndex > 0) {
        await delay(GEAR_PRESET_VERIFY_RETRY_DELAYS_MS[attemptIndex - 1]);
      }

      verify = verifySkillPresetApplied(skillIds);
      verify.attempt = attemptIndex + 1;
      verify.maxAttempts = maxAttempts;
      if (verify.complete) return verify;
    }

    return verify;
  }

  function verifySkillPresetApplied(skillIds) {
    const expected = normalizeSkillPresetIds(skillIds);
    const actual = scanRuntimeActiveSkillIds();
    const expectedCounts = countSkillPresetIds(expected);
    const actualCounts = countSkillPresetIds(actual);
    const missing = [];
    const extra = [];

    expectedCounts.forEach((count, id) => {
      const actualCount = actualCounts.get(id) || 0;
      for (let index = actualCount; index < count; index += 1) missing.push(id);
    });

    actualCounts.forEach((count, id) => {
      const expectedCount = expectedCounts.get(id) || 0;
      for (let index = expectedCount; index < count; index += 1) extra.push(id);
    });

    return {
      total: expected.length,
      matched: Math.max(0, expected.length - missing.length),
      complete: expected.length > 0 && missing.length === 0 && extra.length === 0,
      missing,
      extra,
      active: actual,
      checkedAt: new Date().toISOString(),
    };
  }

  function countSkillPresetIds(skillIds) {
    const counts = new Map();
    for (const id of normalizeSkillPresetIds(skillIds)) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }

  function getSkillPresetMatchStatus(presetName) {
    const preset = getSkillPreset(presetName);
    const skillIds = filterConfigurableSkillPresetIds(preset && preset.skillIds || []);
    if (!preset || skillIds.length === 0) {
      return {
        presetName,
        saved: false,
        total: 0,
        matched: 0,
        complete: false,
        missing: [],
        extra: [],
      };
    }

    return {
      presetName,
      saved: true,
      ...verifySkillPresetApplied(skillIds),
    };
  }

  function getSkillPresetStatus() {
    const activeSkillIds = scanRuntimeActiveSkillIds();
    return {
      running: SKILL_PRESET_STATE.running,
      lastState: SKILL_PRESET_STATE.lastState,
      lastError: SKILL_PRESET_STATE.lastError,
      lastSavedAt: SKILL_PRESET_STATE.lastSavedAt,
      lastRunAt: SKILL_PRESET_STATE.lastRunAt,
      activeSkillIds,
      activeSkillCounts: summarizeSkillPresetIds(activeSkillIds),
      quickPresets: SKILL_PRESET_QUICK_NAMES.map((presetName) => {
        const preset = getSkillPreset(presetName);
        const skillIds = filterConfigurableSkillPresetIds(preset && preset.skillIds || []);
        return {
          name: presetName,
          savedAt: preset && preset.savedAt || "",
          count: skillIds.length,
          match: getSkillPresetMatchStatus(presetName),
        };
      }),
      lastResult: SKILL_PRESET_STATE.lastResult,
      socket: getGearSocketStatus(),
    };
  }

  function getCurrentSkillConfigSummary() {
    const activeSkillIds = scanRuntimeActiveSkillIds();
    return {
      activeSkillIds,
      activeSkillCounts: summarizeSkillPresetIds(activeSkillIds),
      entries: scanRuntimeActiveSkillEntries(),
    };
  }

  function summarizeSkillPresetIds(skillIds) {
    const counts = countSkillPresetIds(skillIds);
    return Array.from(counts.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([id, count]) => count > 1 ? `${id}x${count}` : String(id))
      .join(", ");
  }

  function formatSkillPresetIncompleteMessage(presetName, verify) {
    const title = presetName ? `스킬 프리셋 ${presetName}` : "스킬 프리셋";
    const lines = [
      `${title} 적용 불완전`,
      `${verify.matched}/${verify.total}포인트 확인`,
    ];
    if (verify.missing && verify.missing.length > 0) {
      lines.push(`미적용: ${summarizeSkillPresetIds(verify.missing)}`);
    }
    if (verify.extra && verify.extra.length > 0) {
      lines.push(`추가활성: ${summarizeSkillPresetIds(verify.extra)}`);
    }
    return lines.join("\n");
  }

  function getElementSelector(element) {
    if (!element || !element.tagName) return "";

    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = String(element.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((className) => `.${className}`)
      .join("");
    return `${tag}${id}${classes}`;
  }

  function initStatusUi() {
    installStatusUiKeyboardGuard();

    const mount = () => {
      if (!document.body) {
        setTimeout(mount, 50);
        return;
      }

      document.getElementById("hordes-kr-mod-bootstrap-fallback-root")?.remove();
      if (document.getElementById("hordes-kr-mod-status-root")) return;

      const host = document.createElement("div");
      host.id = "hordes-kr-mod-status-root";
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host {
            all: initial;
            position: fixed;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #dff8f5;
            pointer-events: auto;
            --panel-width: 400px;
            --panel-height: auto;
            --font-scale: 1;
          }
          * {
            box-sizing: border-box;
          }
          button {
            font: inherit;
          }
          .badge {
            display: flex;
            align-items: center;
            gap: 7px;
            border: 1px solid rgba(166, 220, 213, 0.4);
            background: rgba(16, 19, 29, 0.92);
            color: #dff8f5;
            border-radius: 6px;
            padding: 6px 9px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          }
          .badge:hover {
            border-color: rgba(245, 194, 71, 0.8);
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #f5c247;
            box-shadow: 0 0 8px rgba(245, 194, 71, 0.8);
            flex: 0 0 auto;
          }
          .dot.ok {
            background: #34cb49;
            box-shadow: 0 0 8px rgba(52, 203, 73, 0.85);
          }
          .dot.off,
          .dot.error {
            background: #f42929;
            box-shadow: 0 0 8px rgba(244, 41, 41, 0.85);
          }
          .panel {
            width: var(--panel-width);
            height: var(--panel-height);
            min-width: 340px;
            min-height: 250px;
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 24px);
            margin-bottom: 8px;
            border: 1px solid rgba(166, 220, 213, 0.35);
            border-radius: 8px;
            background: rgba(16, 19, 29, 0.96);
            box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45);
            overflow: auto;
            resize: both;
          }
          .panel[hidden] {
            display: none;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 11px 14px;
            background: rgba(245, 194, 71, 0.1);
            border-bottom: 1px solid rgba(166, 220, 213, 0.16);
            font-size: calc(14px * var(--font-scale));
            font-weight: 800;
            cursor: move;
            user-select: none;
          }
          .version {
            color: #a6dcd5;
            font-size: 11px;
            font-weight: 700;
          }
          .body {
            display: grid;
            gap: 10px;
            padding: 12px 14px 14px;
            font-size: calc(13px * var(--font-scale));
          }
          .group-title {
            color: #f5c247;
            font-size: calc(11px * var(--font-scale));
            font-weight: 900;
            letter-spacing: 0.5px;
            margin: 0 0 7px;
            opacity: 0.95;
          }
          .group-title:not(:first-child) {
            margin-top: 10px;
          }
          .row {
            display: grid;
            grid-template-columns: 82px 1fr;
            gap: 8px;
            min-width: 0;
          }
          .label {
            color: #5b858e;
            font-weight: 700;
          }
          .value {
            color: #dff8f5;
            min-width: 0;
            overflow-wrap: anywhere;
          }
          .actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 2px;
          }
          .actions.three {
            grid-template-columns: repeat(3, 1fr);
          }
          .actions.five {
            grid-template-columns: repeat(5, 1fr);
          }
          .input-row.three-fields {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
          }
          .action {
            border: 1px solid rgba(166, 220, 213, 0.28);
            background: rgba(61, 89, 95, 0.75);
            color: #dff8f5;
            border-radius: 5px;
            padding: 8px 10px;
            font-size: calc(13px * var(--font-scale));
            font-weight: 800;
            cursor: pointer;
          }
          .action:hover {
            border-color: rgba(245, 194, 71, 0.8);
          }
          .action.off {
            background: rgba(35, 41, 55, 0.78);
            color: #8ea6aa;
            border-color: rgba(142, 166, 170, 0.22);
          }
          .input-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 6px;
            margin-top: 7px;
          }
          .input-row.api-key {
            grid-template-columns: minmax(0, 1fr) auto auto;
          }
          .text-input {
            min-width: 0;
            border: 1px solid rgba(166, 220, 213, 0.28);
            background: rgba(4, 8, 16, 0.72);
            color: #dff8f5;
            border-radius: 5px;
            padding: 6px 8px;
            font: inherit;
            outline: none;
          }
          .text-input:focus {
            border-color: rgba(245, 194, 71, 0.8);
          }
          select.text-input {
            appearance: auto;
          }
          details.section {
            border-top: 1px solid rgba(166, 220, 213, 0.16);
            padding-top: 8px;
            margin-top: 2px;
          }
          details.section > summary {
            color: #dff8f5;
            cursor: pointer;
            font-size: 12px;
            font-weight: 900;
            list-style-position: inside;
            user-select: none;
          }
          details.section[open] > summary {
            margin-bottom: 8px;
          }
          .summary-status {
            float: right;
            max-width: 145px;
            color: #a6dcd5;
            font-size: 11px;
            font-weight: 800;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .rule-list {
            display: grid;
            gap: 5px;
            margin-top: 7px;
          }
          .rule-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(245, 194, 71, 0.2);
            background: rgba(84, 72, 30, 0.28);
            border-radius: 5px;
            padding: 5px 6px;
          }
          .rule-main {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #fff3b0;
            font-weight: 800;
          }
          .rule-sub {
            color: #a6dcd5;
            font-size: 11px;
            margin-top: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .highlight-list {
            display: grid;
            gap: 5px;
            margin-top: 7px;
          }
          .highlight-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(166, 220, 213, 0.16);
            background: rgba(61, 89, 95, 0.28);
            border-radius: 5px;
            padding: 5px 6px;
          }
          .highlight-name {
            color: #dff8f5;
            font-weight: 800;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            background: transparent;
            border: none;
            padding: 0;
            font: inherit;
            text-align: left;
            cursor: pointer;
          }
          .highlight-name:hover {
            color: #f5c247;
          }
          .highlight-item.locked {
            border-color: rgba(245, 194, 71, 0.8);
            background: rgba(245, 194, 71, 0.14);
          }
          .highlight-item.locked .highlight-name {
            color: #f5c247;
          }
          .remove {
            border: 1px solid rgba(166, 220, 213, 0.24);
            background: rgba(4, 8, 16, 0.35);
            color: #a6dcd5;
            border-radius: 5px;
            padding: 4px 7px;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
          }
          .remove:hover {
            border-color: rgba(244, 41, 41, 0.7);
            color: #ffffff;
          }
          .note {
            color: #a6dcd5;
            font-size: 11px;
            line-height: 1.35;
          }
          .section {
            border-top: 1px solid rgba(166, 220, 213, 0.16);
            padding-top: 9px;
            margin-top: 2px;
          }
        </style>
        <div id="panel" class="panel" hidden>
          <div class="header">
            <span>Hordes KR Mod</span>
            <span id="version" class="version"></span>
          </div>
          <div class="body">
            <div class="section">
              <div class="row"><span class="label">타겟 거리</span><span id="targetDistance" class="value"></span></div>
            </div>
            <div class="section">
              <div class="group-title">표시 · 번역</div>
              <div class="feature-grid">
                <button id="toggle" class="action" type="button"></button>
                <button id="toggleChatTranslation" class="action" type="button"></button>
                <button id="toggleHighlight" class="action" type="button"></button>
                <button id="toggleSelfHighlight" class="action" type="button"></button>
                <button id="toggleMinimapLabels" class="action" type="button"></button>
                <button id="toggleHighlightList" class="action" type="button"></button>
                <button id="toggleTargetDistance" class="action" type="button"></button>
                <button id="toggleIncomingSkill" class="action" type="button"></button>
              </div>
              <div class="group-title">전투 보조</div>
              <div class="feature-grid">
                <button id="toggleAutoInterrupt" class="action" type="button"></button>
                <button id="toggleDangerOverlay" class="action" type="button"></button>
                <button id="toggleTeamSync" class="action" type="button"></button>
              </div>
            </div>
            <details class="section">
              <summary>프리셋</summary>
              <div class="row"><span class="label">장비프리셋</span><span id="gearPresetStatus" class="value"></span></div>
              <div class="actions five">
                <button id="saveGearPreset1" class="action" type="button">1 저장</button>
                <button id="saveGearPreset2" class="action" type="button">2 저장</button>
                <button id="saveGearPreset3" class="action" type="button">3 저장</button>
                <button id="saveGearPreset4" class="action" type="button">4 저장</button>
                <button id="saveGearPreset5" class="action" type="button">5 저장</button>
              </div>
              <div class="actions five">
                <button id="equipGearPreset1" class="action" type="button">1 장착</button>
                <button id="equipGearPreset2" class="action" type="button">2 장착</button>
                <button id="equipGearPreset3" class="action" type="button">3 장착</button>
                <button id="equipGearPreset4" class="action" type="button">4 장착</button>
                <button id="equipGearPreset5" class="action" type="button">5 장착</button>
              </div>
              <div id="gearPresetNote" class="note"></div>
              <div class="section">
              <div class="row"><span class="label">스킬프리셋</span><span id="skillPresetStatus" class="value"></span></div>
              <div class="actions five">
                <button id="saveSkillPreset1" class="action" type="button">1 저장</button>
                <button id="saveSkillPreset2" class="action" type="button">2 저장</button>
                <button id="saveSkillPreset3" class="action" type="button">3 저장</button>
                <button id="saveSkillPreset4" class="action" type="button">4 저장</button>
                <button id="saveSkillPreset5" class="action" type="button">5 저장</button>
              </div>
              <div class="actions five">
                <button id="applySkillPreset1" class="action" type="button">1 적용</button>
                <button id="applySkillPreset2" class="action" type="button">2 적용</button>
                <button id="applySkillPreset3" class="action" type="button">3 적용</button>
                <button id="applySkillPreset4" class="action" type="button">4 적용</button>
                <button id="applySkillPreset5" class="action" type="button">5 적용</button>
              </div>
              <div id="skillPresetNote" class="note"></div>
              </div>
            </details>
            <details class="section">
              <summary>채팅 번역 키</summary>
              <div class="row"><span class="label">채팅 키</span><span id="chatApiKeyStatus" class="value"></span></div>
              <div class="input-row api-key">
                <input id="chatApiKeyInput" class="text-input" type="password" placeholder="OpenAI API 키" autocomplete="off" spellcheck="false" />
                <button id="saveChatApiKey" class="action" type="button">저장</button>
                <button id="clearChatApiKey" class="action" type="button">삭제</button>
              </div>
            </details>
            <details class="section">
              <summary>강조 ID</summary>
              <div class="row"><span class="label">강조 ID</span><span id="highlightCount" class="value"></span></div>
              <div id="highlightList" class="highlight-list"></div>
              <div class="input-row">
                <input id="highlightInput" class="text-input" type="text" maxlength="32" placeholder="닉네임 입력" autocomplete="off" />
                <button id="addHighlight" class="action" type="button">추가</button>
              </div>
            </details>
            <details class="section">
              <summary>기타 UI</summary>
              <div class="feature-grid">
                <button id="togglePartyUi" class="action" type="button"></button>
                <button id="togglePartyCommandPanel" class="action" type="button"></button>
                <button id="toggleSwiftshotTurbo" class="action" type="button"></button>
                <button id="partyPreset5x2" class="action" type="button">파티5x2</button>
              </div>
            </details>
          </div>
        </div>
        <button id="badge" class="badge" type="button">
          <span id="dot" class="dot"></span>
          <span>KR 번역</span>
          <span id="badgeState">대기</span>
        </button>
      `;

      STATUS_UI.host = host;
      STATUS_UI.shadow = shadow;
      applyUiConfig();

      shadow.getElementById("badge").addEventListener("click", () => {
        STATUS_UI.panelOpen = !STATUS_UI.panelOpen;
        renderStatusUi();
      });

      shadow.getElementById("toggle").addEventListener("click", () => {
        pageWindow.HordesKrMod.toggleTranslation();
      });

      shadow.getElementById("toggleHighlight").addEventListener("click", () => {
        pageWindow.HordesKrMod.toggleNameHighlight();
        renderStatusUi();
      });

      installFeatureToggleHandlers(shadow);
      installChatApiKeyHandlers(shadow);
      installGearPresetHandlers(shadow);
      installSkillPresetHandlers(shadow);

      shadow.getElementById("addHighlight").addEventListener("click", () => {
        addHighlightNameFromUi();
      });

      shadow.getElementById("highlightInput").addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        addHighlightNameFromUi();
      });

      installStatusUiInputGuards(shadow);
      installUiDragging(shadow);
      installUiResizeObserver(shadow);
      renderStatusUi();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    }
    mount();
  }

  function installStatusUiKeyboardGuard() {
    if (STATUS_UI.keyboardGuardInstalled) return;
    STATUS_UI.keyboardGuardInstalled = true;

    const guard = (event) => {
      if (!isStatusUiKeyboardEvent(event)) return;

      if (event.type === "keydown") {
        handleStatusUiKeydown(event);
      }

      event.stopImmediatePropagation();
    };

    STATUS_UI_KEYBOARD_EVENTS.forEach((type) => {
      pageWindow.addEventListener(type, guard, true);
      document.addEventListener(type, guard, true);
    });
  }

  function isStatusUiKeyboardEvent(event) {
    const inputs = getStatusUiTextInputs();
    if (inputs.length === 0) return false;

    if (typeof event.composedPath === "function") {
      const path = event.composedPath();
      if (inputs.some((input) => path.includes(input))) return true;
    }

    return inputs.includes(getStatusUiActiveElement());
  }

  function getStatusUiTextInputs() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return [];

    return STATUS_UI_TEXT_INPUT_IDS
      .map((id) => shadow.getElementById(id))
      .filter(Boolean);
  }

  function getStatusUiActiveElement() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return null;

    return shadow.activeElement || null;
  }

  function handleStatusUiKeydown(event) {
    const active = getStatusUiActiveElement();
    if (!active) return;

    if (event.key === "Enter") {
      event.preventDefault();
      if (active.id === "highlightInput") {
        addHighlightNameFromUi();
      } else if (active.id === "chatApiKeyInput") {
        saveChatApiKeyFromUi();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      active.blur();
    }
  }

  function installStatusUiInputGuards(shadow) {
    STATUS_UI_TEXT_INPUT_IDS.forEach((id) => {
      const input = shadow.getElementById(id);
      if (input) installInputEventGuards(input);
    });
  }

  function installInputEventGuards(input) {
    HIGHLIGHT_INPUT_POINTER_EVENTS.forEach((type) => {
      input.addEventListener(type, (event) => {
        event.stopPropagation();
        pageWindow.requestAnimationFrame(() => input.focus({ preventScroll: true }));
      });
    });

    STATUS_UI_KEYBOARD_EVENTS.forEach((type) => {
      input.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    });
  }

  function applyUiConfig() {
    const host = STATUS_UI.host;
    if (!host) return;

    host.style.setProperty("--panel-width", `${clamp(UI_CONFIG.width || 400, 280, 560)}px`);
    host.style.setProperty("--font-scale", String(clamp(UI_CONFIG.fontScale || 1, 0.85, 1.25)));
    if (UI_CONFIG.height) {
      host.style.setProperty("--panel-height", `${clamp(UI_CONFIG.height, 250, window.innerHeight - 24)}px`);
    } else {
      host.style.setProperty("--panel-height", "auto");
    }

    if (Number.isFinite(UI_CONFIG.x) && Number.isFinite(UI_CONFIG.y)) {
      host.style.left = `${clamp(UI_CONFIG.x, 0, window.innerWidth - 40)}px`;
      host.style.top = `${clamp(UI_CONFIG.y, 0, window.innerHeight - 32)}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    } else {
      host.style.left = "auto";
      host.style.top = "auto";
      host.style.right = "2px";
      host.style.bottom = "2px";
    }
  }

  function installUiDragging(shadow) {
    const handle = shadow.querySelector(".header");
    if (!handle) return;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const rect = STATUS_UI.host.getBoundingClientRect();
      STATUS_UI.dragging = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      const dragging = STATUS_UI.dragging;
      if (!dragging || dragging.pointerId !== event.pointerId) return;

      const rect = STATUS_UI.host.getBoundingClientRect();
      UI_CONFIG.x = Math.round(clamp(dragging.originX + event.clientX - dragging.startX, 0, window.innerWidth - rect.width));
      UI_CONFIG.y = Math.round(clamp(dragging.originY + event.clientY - dragging.startY, 0, window.innerHeight - rect.height));
      applyUiConfig();
    });

    const finishDrag = (event) => {
      const dragging = STATUS_UI.dragging;
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      STATUS_UI.dragging = null;
      saveJsonConfig(UI_CONFIG_KEY, UI_CONFIG);
    };

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  }

  function installUiResizeObserver(shadow) {
    const panel = shadow.getElementById("panel");
    if (!panel || typeof ResizeObserver !== "function") return;

    STATUS_UI.resizeObserver = new ResizeObserver((entries) => {
      if (!STATUS_UI.panelOpen) return;

      const entry = entries[0];
      if (!entry) return;

      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width >= 280) UI_CONFIG.width = width;
      if (height >= 250) UI_CONFIG.height = height;
      saveJsonConfig(UI_CONFIG_KEY, UI_CONFIG);
      applyUiConfig();
    });
    STATUS_UI.resizeObserver.observe(panel);
  }

  function resetUiConfig() {
    UI_CONFIG.x = null;
    UI_CONFIG.y = null;
    UI_CONFIG.width = 320;
    UI_CONFIG.height = null;
    UI_CONFIG.fontScale = 1;
    saveJsonConfig(UI_CONFIG_KEY, UI_CONFIG);
    applyUiConfig();
    renderStatusUi();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    const base = Number.isFinite(number) ? number : Number(fallback);
    return Math.round(clamp(Number.isFinite(base) ? base : min, min, max));
  }

  function setStatus(nextStatus) {
    Object.assign(MOD_STATUS, nextStatus);
    renderStatusUi();
  }

  function renderStatusUi() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return;

    const enabled = isEnabled();
    const state = MOD_STATUS.lastState || "";
    const isError = state.includes("오류") || state.includes("실패") || state.includes("키 없음");
    const isApplied =
      state === "적용됨" ||
      state.includes("적용됨") ||
      state.includes("성공") ||
      MOD_STATUS.domReplacedCount > 0;
    const isReady = state.includes("준비됨");
    const isBusy = state.includes("적용 중") || state.includes("테스트 중");
    const badgeState = getBadgeState(enabled, isApplied, isReady, isBusy, isError);

    const dot = shadow.getElementById("dot");
    dot.className = `dot ${enabled ? (isApplied ? "ok" : isError ? "error" : "") : "off"}`;

    shadow.getElementById("panel").hidden = !STATUS_UI.panelOpen;
    shadow.getElementById("version").textContent = `v${MOD_VERSION}`;
    shadow.getElementById("badgeState").textContent = badgeState;
    setFeatureToggleButton(shadow, "toggle", "번역", enabled);
    setFeatureToggleButton(shadow, "toggleHighlight", "강조", HIGHLIGHT_CONFIG.enabled);
    setFeatureToggleButton(shadow, "toggleSelfHighlight", "내이름", HIGHLIGHT_CONFIG.selfHighlight);
    setFeatureToggleButton(shadow, "toggleAutoInterrupt", "자동끊기", FEATURE_CONFIG.autoInterruptEnabled);
    setFeatureToggleButton(shadow, "toggleDangerOverlay", "장판경고", isDangerOverlayEnabled());
    setFeatureToggleButton(shadow, "toggleTeamSync", "팀공유", FEATURE_CONFIG.teamSyncEnabled);
    renderFeatureToggles(shadow);
    renderChatApiKeyUi(shadow);
    renderGearPresetUi(shadow);
    renderSkillPresetUi(shadow);
    renderTargetDistanceUi(shadow);
    renderHighlightUi(shadow);
  }

  function installFeatureToggleHandlers(shadow) {
    const actions = {
      toggleMinimapLabels: () => pageWindow.HordesKrMod.toggleMinimapNameLabels(),
      toggleIncomingSkill: () => pageWindow.HordesKrMod.toggleIncomingSkillOverlay(),
      toggleTargetDistance: () => pageWindow.HordesKrMod.toggleTargetDistanceOverlay(),
      toggleChatTranslation: () => pageWindow.HordesKrMod.toggleChatTranslation(),
      toggleHighlightList: () => pageWindow.HordesKrMod.toggleMinimapHighlightList(),
      toggleSelfHighlight: () => pageWindow.HordesKrMod.toggleSelfHighlight(),
      toggleAutoInterrupt: () => pageWindow.HordesKrMod.toggleAutoInterrupt(),
      toggleDangerOverlay: () => pageWindow.HordesKrMod.toggleDangerOverlay(),
      toggleTeamSync: () => pageWindow.HordesKrMod.toggleTeamSync(),
      togglePartyUi: () => pageWindow.HordesKrMod.togglePartyUi(),
      togglePartyCommandPanel: () => pageWindow.HordesKrMod.togglePartyCommandPanel(),
      toggleSwiftshotTurbo: () => pageWindow.HordesKrMod.toggleSwiftshotTurbo(),
      partyPreset5x2: () => pageWindow.HordesKrMod.partyUiPreset5x2(),
    };

    Object.entries(actions).forEach(([id, action]) => {
      const button = shadow.getElementById(id);
      if (!button) return;

      button.addEventListener("click", () => {
        action();
        renderStatusUi();
      });
    });
  }

  function installChatApiKeyHandlers(shadow) {
    const input = shadow.getElementById("chatApiKeyInput");
    const save = shadow.getElementById("saveChatApiKey");
    const clear = shadow.getElementById("clearChatApiKey");

    if (save) {
      save.addEventListener("click", () => {
        saveChatApiKeyFromUi();
      });
    }

    if (clear) {
      clear.addEventListener("click", () => {
        clearChatApiKeyFromUi();
      });
    }

    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          saveChatApiKeyFromUi();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          input.blur();
        }
      });
    }
  }

  function getInputValue(shadow, id) {
    const input = shadow && shadow.getElementById(id);
    return input ? String(input.value || "").trim() : "";
  }

  function setInputValueUnlessActive(input, active, value) {
    if (input && active !== input) input.value = value;
  }

  function saveChatApiKeyFromUi() {
    const shadow = STATUS_UI.shadow;
    const input = shadow && shadow.getElementById("chatApiKeyInput");
    const apiKey = input && input.value ? input.value.trim() : "";

    if (!apiKey) {
      setStatus({
        lastState: "채팅번역 키 없음",
        lastError: "API 키를 입력한 뒤 저장하세요.",
      });
      if (input) input.focus({ preventScroll: true });
      return false;
    }

    const saved = pageWindow.HordesKrMod.setChatTranslationApiKey(apiKey);
    if (input) input.value = "";
    renderStatusUi();
    return saved;
  }

  function clearChatApiKeyFromUi() {
    const shadow = STATUS_UI.shadow;
    const input = shadow && shadow.getElementById("chatApiKeyInput");
    if (input) input.value = "";
    const cleared = pageWindow.HordesKrMod.clearChatTranslationApiKey();
    renderStatusUi();
    return cleared;
  }

  function addHighlightNameFromUi() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return;

    const input = shadow.getElementById("highlightInput");
    const name = normalizeHighlightName(input && input.value);
    if (!name) return;

    pageWindow.HordesKrMod.addHighlightName(name);
    if (input) input.value = "";
    renderStatusUi();
  }

  function renderHighlightUi(shadow) {
    const count = shadow.getElementById("highlightCount");
    const list = shadow.getElementById("highlightList");
    if (!count || !list) return;

    const names = HIGHLIGHT_CONFIG.names.slice();
    const locked = TARGET_DISTANCE_STATE.lockedTarget;
    const lockedName = locked && locked.name ? locked.name.toLowerCase() : "";
    count.textContent = names.length > 0 ? `${names.length}개` : "없음";
    list.replaceChildren(
      ...names.map((name) => {
        const row = document.createElement("div");
        const isLocked = Boolean(lockedName && lockedName === name.toLowerCase());
        const value = createUiButton(
          "highlight-name",
          name,
          isLocked ? "클릭하면 거리 추적을 해제합니다" : "클릭하면 이 이름을 거리 추적 대상으로 고정합니다",
          () => {
            if (isLocked) {
              pageWindow.HordesKrMod.unlockTargetDistance();
            } else {
              pageWindow.HordesKrMod.lockTargetDistanceByName(name);
            }
            renderStatusUi();
          }
        );
        const remove = createUiButton("remove", "삭제", "", () => {
          if (isLocked) pageWindow.HordesKrMod.unlockTargetDistance();
          pageWindow.HordesKrMod.removeHighlightName(name);
          renderStatusUi();
        });

        row.className = isLocked ? "highlight-item locked" : "highlight-item";
        row.append(value, remove);
        return row;
      })
    );
  }

  function renderTargetDistanceUi(shadow) {
    const targetDistance = shadow.getElementById("targetDistance");
    if (!targetDistance) return;

    if (!isTargetDistanceEnabled()) {
      targetDistance.textContent = "꺼짐";
      targetDistance.title = "";
      return;
    }

    if (!STATUS_UI.panelOpen) {
      targetDistance.textContent = "-";
      targetDistance.title = "";
      return;
    }

    const result = getTargetDistance(false);
    if (!result.available) {
      targetDistance.textContent = "-";
      targetDistance.title = result.reason || "";
      return;
    }

    const targetName = result.target && result.target.name ? result.target.name : "대상";
    const locked = Boolean(result.tracking && result.tracking.locked);
    const prefix = locked ? "🔒 " : "";
    targetDistance.textContent = `${prefix}${result.stale ? "~" : ""}${formatTargetDistance(result.distance)} (${targetName})`;
    targetDistance.title = joinStatusParts([
      locked ? "이름으로 고정된 타겟" : "",
      `3D ${formatTargetDistance(result.distance3d)}`,
      result.target.referenceSource || result.target.path,
      result.stale ? "마지막 좌표 기준" : "",
    ]);
  }

  function formatTargetDistance(distance) {
    const value = Number(distance);
    if (!Number.isFinite(value)) return "-";
    return value < 100 ? value.toFixed(1) : String(Math.round(value));
  }

  function getBadgeState(enabled, isApplied, isReady, isBusy, isError) {
    if (!enabled) return "꺼짐";
    if (isError) return "오류";
    if (isApplied) return MOD_STATUS.domReplacedCount > 0 ? "DOM 적용됨" : "적용됨";
    if (isReady) return "준비됨";
    if (isBusy) return "진행 중";
    return "대기";
  }
})();
