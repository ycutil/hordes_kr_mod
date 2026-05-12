// ==UserScript==
// @name         Hordes KR Custom Mod
// @namespace    https://hordes.io/
// @version      0.9.0
// @description  Korean localization override for Hordes.io. Chat live translation is intentionally excluded.
// @author       Siri
// @match        https://hordes.io/*
// @match        https://www.hordes.io/*
// @run-at       document-start
// @grant        unsafeWindow
// @inject-into  page
// @updateURL    https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/hordes-kr-mod.user.js
// @downloadURL  https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/hordes-kr-mod.user.js
// ==/UserScript==

(function hordesKrModBootstrap() {
  "use strict";

  installEarlyClientScriptGate();

  if (typeof unsafeWindow !== "undefined" && unsafeWindow !== window) {
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
    return;
  }

  function installEarlyClientScriptGate() {
    if (!/^\/play(?:\/|$)/.test(location.pathname)) return;

    try {
      if (localStorage.getItem("hordesKrMod.scriptGate.disabled") === "true") return;
      if (localStorage.getItem("hordesKrMod.scriptGate.enabled") !== "true") return;
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

  const MOD_VERSION = "0.9.0";
  const ENABLED_KEY = "hordesKrMod.translation.enabled";
  const UI_CONFIG_KEY = "hordesKrMod.ui.config";
  const EVENT_CONFIG_KEY = "hordesKrMod.events.config";
  const HIGHLIGHT_CONFIG_KEY = "hordesKrMod.highlight.config";
  const SCRIPT_GATE_DISABLED_KEY = "hordesKrMod.scriptGate.disabled";
  const SCRIPT_GATE_ENABLED_KEY = "hordesKrMod.scriptGate.enabled";
  const HIGHLIGHT_DEFAULTS_VERSION_KEY = "hordesKrMod.highlight.defaultsVersion";
  const HIGHLIGHT_DEFAULTS_VERSION = "2026-05-12-ho2-hmage";
  const DEFAULT_HIGHLIGHT_NAMES = ["HO2", "HMage"];
  const HOUR_MS = 60 * 60 * 1000;
  const MINUTE_MS = 60 * 1000;
  const EVENT_PHASES = {
    obelisk: {
      name: "Obelisk",
      label: "오벨리스크",
      description: "PvP 이벤트",
    },
    gloomfury: {
      name: "Gloomfury",
      label: "Gloomfury",
      description: "월드 보스",
    },
    rest: {
      name: "Rest",
      label: "휴식",
      description: "다음 이벤트 준비",
    },
  };
  const UI_CONFIG = loadJsonConfig(UI_CONFIG_KEY, {
    x: null,
    y: null,
    width: 320,
    height: null,
    fontScale: 1,
  });
  const EVENT_CONFIG = loadJsonConfig(EVENT_CONFIG_KEY, {
    alarmsEnabled: true,
    soundEnabled: false,
    browserNotification: false,
    alarmMinutes: [10, 5, 1],
  });
  const HIGHLIGHT_CONFIG = loadJsonConfig(HIGHLIGHT_CONFIG_KEY, {
    names: DEFAULT_HIGHLIGHT_NAMES,
    enabled: true,
    canvasEnabled: true,
    runtimeOverlayEnabled: true,
    hideClanNames: true,
    nameplateStyle: null,
  });
  if (!Array.isArray(HIGHLIGHT_CONFIG.names)) HIGHLIGHT_CONFIG.names = [];
  HIGHLIGHT_CONFIG.enabled = HIGHLIGHT_CONFIG.enabled !== false;
  HIGHLIGHT_CONFIG.canvasEnabled = HIGHLIGHT_CONFIG.canvasEnabled !== false;
  HIGHLIGHT_CONFIG.runtimeOverlayEnabled = HIGHLIGHT_CONFIG.runtimeOverlayEnabled !== false;
  HIGHLIGHT_CONFIG.hideClanNames = HIGHLIGHT_CONFIG.hideClanNames !== false;
  applyDefaultHighlightNames();
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
  const EVENT_STATE = {
    current: null,
    next: null,
    schedule: [],
    firedAlarms: new Set(),
    timer: null,
  };
  const HIGHLIGHT_STATE = {
    observer: null,
    pending: false,
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
    canvasDrawSeq: 0,
    pendingCanvasNames: [],
    pendingCanvasNameFlushTimer: null,
    canvasDynamicAlignHits: 0,
    canvasDeferredNameHits: 0,
    lastCanvasTextOverlayKey: "",
    lastCanvasTextOverlayAt: 0,
    canvasInternalDraw: false,
    styleCapture: null,
    scriptHookInstalled: false,
    scriptObserver: null,
    scriptGateInstalled: false,
    scriptGateError: "",
    scriptHookAttemptedScripts: [],
    scriptHookPatchedScripts: [],
    scriptHookErrors: [],
    runtimeOverlayHost: null,
    runtimeOverlayItems: new Map(),
    runtimeOverlayTimer: null,
    runtimeOverlayHits: 0,
    lastRuntimeOverlayAt: 0,
    lastRuntimeOverlayError: "",
    lastRuntimeOverlayMatches: [],
  };
  const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

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
          description:
            "종은 선택한 신에게 바치는 헌신의 상징으로 자주 쓰입니다. 이 종 안쪽에는 은으로 새긴 글귀가 있지만, 그 해석은 세월 속에 사라졌습니다.",
        },
        1: {
          description:
            "화석화된 몬스터 알은 장수의 상징으로 해석되는 경우가 많습니다. 하지만 이 생물들에 대한 기록은 최근 시대 이전에는 남아 있지 않습니다.",
        },
        2: {
          description:
            "오크 부족은 존경의 표시로 강한 적의 두개골을 보관하곤 합니다. 이 두개골에는 생전 그 적이 지녔던 힘을 상징하는 문신이 새겨져 있습니다.",
        },
        3: {
          description:
            "전함 꼭대기에 게양된 깃발은 pennant라 불렸습니다. 이 선박 깃발은 Headless Landing에 처음 도착한 난파 전함들 중 하나에서 나온 것입니다.",
        },
        4: {
          description:
            "마나가 부족하던 시기에 마법사들은 마나를 얻는 대체 수단을 만들었습니다. 이 구슬은 마나 네트워크가 극심한 압박을 받던 Arcane Crisis 시기에 만들어졌습니다.",
        },
        5: {
          description:
            "Crimson Volcano의 녹아내린 심장에서 벼려진 이 도끼날은 적들이 앞에 쓰러져야만 만족하던 전사의 이야기를 속삭입니다.",
        },
        6: {
          description:
            "한밤중, Emdells의 발톱은 그림자조차 따라잡기 힘들 만큼 빠르게 내리쳤다고 전해집니다.",
        },
        7: {
          description:
            "Red Lion이 홀로 무리에 맞섰던 것처럼, 정수가 줄어들수록 결의는 굳어지고 공격은 더 깊어질 것입니다.",
        },
        8: {
          description:
            "전설은 파도 아래에서도 숨 쉬기를 감행한 개구리 Dehnu를 속삭입니다. 그는 물에 잠기는 어둠에 맞서는 같은 저항의 힘을 여행자들에게 나누어 주었습니다.",
        },
        9: {
          description:
            "숨겨진 숲 빈터의 수호 정령 Jylia는 속삭이는 숲에서 안식처를 찾는 이들을 감싸지만, 움직임은 그들의 존재를 드러냅니다.",
        },
        10: {
          description:
            "Dhiwy의 마법에 닿은 이 버섯들은 용감한 이들을, 고대 별빛 아래 밤에 속삭이는 이야기만큼 작은 크기로 줄입니다.",
        },
        11: {
          description:
            "한 유명한 연금술사는 촛불을 복제하던 중 자신의 의지대로 시간을 휘게 하는 방법을 발견했고, 눈 깜짝할 사이에 주문을 시전할 수 있게 되었습니다.",
        },
        12: {
          description:
            "Aurum Wraiths가 벼려낸 이 방패는 감히 공격하는 자에게 되받아치며, 꺾이지 않는 용기의 증거가 됩니다.",
        },
        13: {
          description:
            "이야기도 신화도 아닙니다. 그저 오크의 정신을 몸에 담고, 사나운 자들만 이끼 냄새를 맡는 곳을 자유롭게 누비려는 순수한 의지입니다.",
        },
        14: {
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
          3: "지능",
          6: "생명력",
          7: "마나",
          8: "생명력 재생/5초",
          9: "MP 재생/5초",
          10: "최소 피해",
          11: "최대 피해",
          13: "막기",
          15: "이동 속도",
          16: "가속",
          18: "아이템 발견",
          19: "가방 칸",
          20: "프레스티지",
          24: "최대 스킬 포인트",
          25: "장비 점수",
          27: "크기",
          28: "투명화",
          29: "시야",
          30: "% 피해 증가",
          31: "% 어그로 생성 증가",
          32: "% 이동 속도 감소",
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

  const originalFetch = pageWindow.fetch ? pageWindow.fetch.bind(pageWindow) : null;
  if (!originalFetch) return;

  initCanvasTextHighlighter();
  initGameScriptRuntimeHook();
  initStatusUi();
  installXhrInterceptor();
  initDomTranslator();
  initNameHighlighter();
  initRuntimeNameOverlay();
  initEventScheduler();

  pageWindow.fetch = async function hordesKrFetch(input, init) {
    const url = toUrl(input);
    if (url && isEnabled() && isLocalizationRequest(url)) {
      return buildKoreanLocalizationResponse(url, "fetch");
    }

    return originalFetch(input, init);
  };

  pageWindow.HordesKrMod = {
    version: MOD_VERSION,
    enable() {
      localStorage.setItem(ENABLED_KEY, "true");
      CACHE.clear();
      setStatus({
        lastState: "켜짐 - 새로고침 필요",
        lastError: "",
      });
      console.info("[Hordes KR Mod] Korean localization enabled. Refresh the page to apply from startup.");
    },
    disable() {
      localStorage.setItem(ENABLED_KEY, "false");
      CACHE.clear();
      setStatus({
        lastState: "꺼짐 - 새로고침 필요",
        lastError: "",
      });
      console.info("[Hordes KR Mod] Korean localization disabled. Refresh the page to restore the game locale.");
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
      localStorage.setItem(SCRIPT_GATE_ENABLED_KEY, "true");
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
    eventStatus() {
      updateEventState();
      return {
        config: { ...EVENT_CONFIG },
        current: EVENT_STATE.current,
        next: EVENT_STATE.next,
        schedule: EVENT_STATE.schedule,
      };
    },
    toggleEventAlarms() {
      if (
        EVENT_CONFIG.alarmsEnabled &&
        !EVENT_CONFIG.browserNotification &&
        "Notification" in pageWindow &&
        pageWindow.Notification.permission === "default"
      ) {
        requestNotificationPermission();
        renderStatusUi();
        return EVENT_CONFIG.alarmsEnabled;
      }

      EVENT_CONFIG.alarmsEnabled = !EVENT_CONFIG.alarmsEnabled;
      saveJsonConfig(EVENT_CONFIG_KEY, EVENT_CONFIG);
      if (EVENT_CONFIG.alarmsEnabled) requestNotificationPermission();
      renderStatusUi();
      return EVENT_CONFIG.alarmsEnabled;
    },
    toggleEventSound() {
      EVENT_CONFIG.soundEnabled = !EVENT_CONFIG.soundEnabled;
      saveJsonConfig(EVENT_CONFIG_KEY, EVENT_CONFIG);
      renderStatusUi();
      return EVENT_CONFIG.soundEnabled;
    },
    resetUi() {
      resetUiConfig();
      renderStatusUi();
    },
    highlightNames() {
      return [...HIGHLIGHT_CONFIG.names];
    },
    addHighlightName(name) {
      const normalized = normalizeHighlightName(name);
      if (!normalized) return [...HIGHLIGHT_CONFIG.names];

      const exists = HIGHLIGHT_CONFIG.names.some(
        (current) => current.toLowerCase() === normalized.toLowerCase()
      );
      if (!exists) {
        HIGHLIGHT_CONFIG.names.push(normalized);
        saveHighlightConfig();
      }

      refreshNameHighlights();
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
      HIGHLIGHT_CONFIG.enabled = !HIGHLIGHT_CONFIG.enabled;
      saveHighlightConfig();
      refreshNameHighlights();
      updateRuntimeNameOverlay();
      return HIGHLIGHT_CONFIG.enabled;
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
    if (!isEnabled()) return;

    try {
      const enUrl = new URL("/data/loc/en.json", location.origin);
      const [enResponse, koLoc] = await Promise.all([
        originalFetch(enUrl.toString(), { credentials: "same-origin" }),
        loadPatchedKoreanLocalization(enUrl),
      ]);

      if (!enResponse.ok) throw new Error(`en locale request failed: ${enResponse.status}`);

      const enLoc = await enResponse.json();
      const dictionary = buildTextDictionary(enLoc, koLoc);

      setStatus({
        lastState: "DOM 번역 준비됨",
        source: "DOM 텍스트 치환 + ko.json + KR 패치",
        lastError: "",
      });

      const apply = () => {
        if (!isEnabled()) return;
        if (!document.body) return;
        const replaced = translateDomTree(document.body, dictionary);
        if (replaced > 0) {
          setStatus({
            lastState: "DOM 번역 적용됨",
            domReplacedCount: MOD_STATUS.domReplacedCount + replaced,
            lastAppliedAt: new Date(),
            lastError: "",
          });
        }
      };

      const start = () => {
        apply();
        const observer = new MutationObserver((mutations) => {
          if (!isEnabled()) return;

          let replaced = 0;
          for (const mutation of mutations) {
            if (mutation.type === "characterData") {
              replaced += translateTextNode(mutation.target, dictionary);
            } else {
              mutation.addedNodes.forEach((node) => {
                replaced += translateDomTree(node, dictionary);
              });
            }
          }

          if (replaced > 0) {
            setStatus({
              lastState: "DOM 번역 적용됨",
              domReplacedCount: MOD_STATUS.domReplacedCount + replaced,
              lastAppliedAt: new Date(),
              lastError: "",
            });
          }
        });

        observer.observe(document.body, {
          childList: true,
          characterData: true,
          subtree: true,
        });
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
    }
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
    if (element.closest("#hordes-kr-mod-status-root")) return true;
    if (element.closest(".hordes-kr-name-highlight")) return true;
    if (element.closest("#chat, #chatinput, .chat, [class*='chat']")) return true;
    return !!element.closest("script, style, textarea, input, canvas, code, pre");
  }

  function initNameHighlighter() {
    const start = () => {
      if (!document.body) return;

      HIGHLIGHT_STATE.observer = new MutationObserver(() => {
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

  function scheduleNameHighlightRefresh() {
    if (HIGHLIGHT_STATE.pending) return;
    HIGHLIGHT_STATE.pending = true;

    setTimeout(() => {
      HIGHLIGHT_STATE.pending = false;
      refreshNameHighlights();
    }, 80);
  }

  function refreshNameHighlights() {
    if (!document.body) return;

    disconnectNameHighlights();
    unwrapNameHighlights(document.body);
    if (HIGHLIGHT_CONFIG.enabled && HIGHLIGHT_CONFIG.names.length > 0) {
      highlightNamesInTree(document.body);
    }
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
    if (element.closest("#hordes-kr-mod-status-root")) return true;
    if (element.closest("#hordes-kr-runtime-name-overlay")) return true;
    if (element.closest(".hordes-kr-name-highlight")) return true;
    return !!element.closest("script, style, textarea, input, canvas, code, pre");
  }

  function buildHighlightMatcher() {
    const names = HIGHLIGHT_CONFIG.names
      .map(normalizeHighlightName)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (names.length === 0) return null;
    return new RegExp(names.map(escapeRegExp).join("|"), "gi");
  }

  function normalizeHighlightName(name) {
    return String(name || "").trim();
  }

  function saveHighlightConfig() {
    HIGHLIGHT_CONFIG.names = uniqueHighlightNames(HIGHLIGHT_CONFIG.names);
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
        const result = originalFillText.apply(this, arguments);
        drawCanvasNameTextOverlay(this, text, x, y, maxWidth, originalFillText, originalStrokeText);
        return result;
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
        const result = originalStrokeText.apply(this, arguments);
        drawCanvasNameTextOverlay(this, text, x, y, maxWidth, originalFillText, originalStrokeText);
        return result;
      };
    }

    if (typeof originalDrawImage === "function") {
      proto.drawImage = function hordesKrDrawImage() {
        if (HIGHLIGHT_STATE.canvasInternalDraw) {
          return originalDrawImage.apply(this, arguments);
        }

        const seq = ++HIGHLIGHT_STATE.canvasDrawSeq;
        const now = getHighlighterTime();
        flushStalePendingCanvasNames(now, seq);

        const imageText = getCanvasImageText(arguments[0]);
        const dest = getDrawImageDestination(arguments);
        const highlightedName = getCanvasHighlightedName(imageText);
        if (highlightedName) {
          queuePendingCanvasName(this, arguments, highlightedName, originalDrawImage, originalFillText, originalStrokeText, dest, now, seq);
          return undefined;
        }

        if (resolvePendingCanvasNameWithClan(this, imageText, dest, now, seq)) {
          return undefined;
        }

        return originalDrawImage.apply(this, arguments);
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

  function drawCanvasNameHighlight(ctx, text, x, y, maxWidth) {
    if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.canvasEnabled) return;

    const rawText = String(text ?? "");
    if (!getMatchingHighlightName(rawText)) return;

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

  function getCanvasFontSize(font) {
    const match = String(font || "").match(/(\d+(?:\.\d+)?)px/);
    return match ? Math.max(8, Number(match[1])) : 14;
  }

  function getBoostedCanvasFontSize(fontSize) {
    return Math.max(fontSize + 3, Math.round(fontSize * 1.24));
  }

  function getCanvasFontFamily(font) {
    const family = String(font || "")
      .replace(/^.*?(\d+(?:\.\d+)?px(?:\/[^\s]+)?\s*)/, "")
      .trim() || "sans-serif";
    return family;
  }

  function getBoostedCanvasFont(font, fontSize, targetSize) {
    return `900 ${targetSize || getBoostedCanvasFontSize(fontSize)}px ${getCanvasFontFamily(font)}`;
  }

  function getCapturedCanvasFont(font, fontSize, targetSize) {
    const captured = HIGHLIGHT_CONFIG.nameplateStyle;
    const family = getCanvasFontFamily((captured && captured.font) || font);
    return `900 ${targetSize || fontSize}px ${family}`;
  }

  function getFittedCanvasFontSize(ctx, text, maxWidth, fontSize) {
    let targetSize = getTargetCanvasFontSize(fontSize);
    const widthLimit = Number(maxWidth);
    if (!Number.isFinite(widthLimit) || widthLimit <= 0) return targetSize;

    try {
      const originalFont = ctx.font;
      while (targetSize > fontSize) {
        ctx.font = getCapturedCanvasFont(originalFont, fontSize, targetSize);
        if (ctx.measureText(String(text)).width <= widthLimit * 0.98) break;
        targetSize--;
      }
      ctx.font = originalFont;
    } catch {
      // Measuring text can fail on unusual canvas contexts. Use the default target size.
    }

    return Math.max(fontSize, targetSize);
  }

  function getTargetCanvasFontSize(fontSize) {
    const captured = HIGHLIGHT_CONFIG.nameplateStyle;
    const capturedSize = captured && Number(captured.fontSize);
    if (Number.isFinite(capturedSize) && capturedSize > 0) {
      return Math.max(fontSize, Math.round(capturedSize));
    }

    return getBoostedCanvasFontSize(fontSize);
  }

  function drawCanvasNameTextOverlay(ctx, text, x, y, maxWidth, originalFillText, originalStrokeText) {
    if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.canvasEnabled) return;
    if (typeof originalFillText !== "function") return;

    const rawText = String(text ?? "");
    if (!getMatchingHighlightName(rawText)) return;

    const numberX = Number(x);
    const numberY = Number(y);
    if (!Number.isFinite(numberX) || !Number.isFinite(numberY)) return;

    const now = pageWindow.performance && pageWindow.performance.now
      ? pageWindow.performance.now()
      : Date.now();
    const overlayKey = [
      rawText,
      Math.round(numberX),
      Math.round(numberY),
      ctx.font,
      ctx.canvas ? `${ctx.canvas.width}x${ctx.canvas.height}` : "",
    ].join("|");
    if (
      HIGHLIGHT_STATE.lastCanvasTextOverlayKey === overlayKey &&
      now - HIGHLIGHT_STATE.lastCanvasTextOverlayAt < 12
    ) {
      return;
    }
    HIGHLIGHT_STATE.lastCanvasTextOverlayKey = overlayKey;
    HIGHLIGHT_STATE.lastCanvasTextOverlayAt = now;

    const fontSize = getCanvasFontSize(ctx.font);

    try {
      ctx.save();
      const capturedStyle = HIGHLIGHT_CONFIG.nameplateStyle || {};
      const widthLimit = Number(maxWidth);
      const capturedMaxWidth = Number(capturedStyle.maxWidth);
      const overlayMaxWidth = Number.isFinite(capturedMaxWidth) && capturedMaxWidth > 0
        ? capturedMaxWidth
        : Number.isFinite(widthLimit) && widthLimit > 0
          ? widthLimit
          : undefined;
      const targetFontSize = getFittedCanvasFontSize(ctx, rawText, overlayMaxWidth, fontSize);
      ctx.font = getCapturedCanvasFont(ctx.font, fontSize, targetFontSize);
      ctx.globalAlpha = 1;
      if (capturedStyle.textAlign) ctx.textAlign = capturedStyle.textAlign;
      if (capturedStyle.textBaseline) ctx.textBaseline = capturedStyle.textBaseline;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.shadowColor = capturedStyle.shadowColor || "rgba(8, 15, 29, 0.85)";
      ctx.shadowBlur = Math.max(Number(capturedStyle.shadowBlur) || 0, Math.round(targetFontSize * 0.12));

      if (typeof originalStrokeText === "function") {
        ctx.lineWidth = Math.max(Number(capturedStyle.lineWidth) || 0, Math.round(targetFontSize * 0.26), 4);
        ctx.strokeStyle = capturedStyle.strokeStyle || "rgba(6, 12, 24, 1)";
        drawCanvasTextCall(originalStrokeText, ctx, rawText, numberX, numberY, overlayMaxWidth);
      }

      ctx.fillStyle = capturedStyle.fillStyle || "#ffffff";
      drawCanvasTextCall(originalFillText, ctx, rawText, numberX, numberY, overlayMaxWidth);
      drawCanvasTextCall(originalFillText, ctx, rawText, numberX + 0.35, numberY, overlayMaxWidth);
      drawCanvasTextCall(originalFillText, ctx, rawText, numberX - 0.35, numberY, overlayMaxWidth);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      drawCanvasTextCall(originalFillText, ctx, rawText, numberX, numberY - 0.35, overlayMaxWidth);
      ctx.restore();
    } catch {
      try {
        ctx.restore();
      } catch {
        // Ignore canvas state recovery failures from third-party contexts.
      }
    }
  }

  function drawCanvasTextCall(drawText, ctx, text, x, y, maxWidth) {
    if (maxWidth !== undefined) {
      drawText.call(ctx, text, x, y, maxWidth);
      return;
    }

    drawText.call(ctx, text, x, y);
  }

  function getCanvasHighlightedName(imageText) {
    const rawText = String(imageText || "").trim();
    return getMatchingHighlightName(rawText) ? rawText : "";
  }

  function drawCanvasImageAt(ctx, args, originalDrawImage, dest) {
    if (!dest) return originalDrawImage.apply(ctx, args);

    const nextArgs = Array.prototype.slice.call(args);
    if (nextArgs.length >= 9) {
      nextArgs[5] = dest.x;
      nextArgs[6] = dest.y;
      nextArgs[7] = dest.width;
      nextArgs[8] = dest.height;
    } else if (nextArgs.length >= 5) {
      nextArgs[1] = dest.x;
      nextArgs[2] = dest.y;
      nextArgs[3] = dest.width;
      nextArgs[4] = dest.height;
    } else {
      nextArgs[1] = dest.x;
      nextArgs[2] = dest.y;
    }

    return originalDrawImage.apply(ctx, nextArgs);
  }

  function queuePendingCanvasName(ctx, args, name, originalDrawImage, originalFillText, originalStrokeText, dest, now, seq) {
    if (!dest) {
      drawCanvasImageAt(ctx, args, originalDrawImage, dest);
      return;
    }

    HIGHLIGHT_STATE.pendingCanvasNames.push({
      ctx,
      canvas: ctx && ctx.canvas ? ctx.canvas : null,
      args: Array.prototype.slice.call(args),
      text: String(name || "").trim(),
      originalDrawImage,
      originalFillText,
      originalStrokeText,
      dest: { ...dest },
      at: now,
      seq,
    });
    HIGHLIGHT_STATE.canvasDeferredNameHits++;

    if (HIGHLIGHT_STATE.pendingCanvasNames.length > 12) {
      flushPendingCanvasName(HIGHLIGHT_STATE.pendingCanvasNames.shift());
    }

    schedulePendingCanvasNameFlush();
  }

  function schedulePendingCanvasNameFlush() {
    if (HIGHLIGHT_STATE.pendingCanvasNameFlushTimer !== null) return;

    HIGHLIGHT_STATE.pendingCanvasNameFlushTimer = pageWindow.setTimeout(() => {
      HIGHLIGHT_STATE.pendingCanvasNameFlushTimer = null;
      flushPendingCanvasNames(true);
    }, 0);
  }

  function flushStalePendingCanvasNames(now, seq) {
    const remaining = [];
    HIGHLIGHT_STATE.pendingCanvasNames.forEach((pending) => {
      if (!pending || now - pending.at > 50 || seq - pending.seq > 10) {
        flushPendingCanvasName(pending);
      } else {
        remaining.push(pending);
      }
    });
    HIGHLIGHT_STATE.pendingCanvasNames = remaining;
  }

  function flushPendingCanvasNames(force) {
    const now = getHighlighterTime();
    const seq = HIGHLIGHT_STATE.canvasDrawSeq;
    const remaining = [];

    HIGHLIGHT_STATE.pendingCanvasNames.forEach((pending) => {
      if (force || !pending || now - pending.at > 50 || seq - pending.seq > 10) {
        flushPendingCanvasName(pending);
      } else {
        remaining.push(pending);
      }
    });
    HIGHLIGHT_STATE.pendingCanvasNames = remaining;
  }

  function flushPendingCanvasName(pending, nextDest) {
    if (!pending) return;

    const dest = nextDest || pending.dest;
    drawCanvasImageAt(pending.ctx, pending.args, pending.originalDrawImage, dest);
    drawCanvasImageNameOverlay(
      pending.ctx,
      pending.args,
      pending.text,
      pending.originalFillText,
      pending.originalStrokeText,
      dest
    );
  }

  function drawCanvasImageNameOverlay(ctx, args, imageText, originalFillText, originalStrokeText, knownDest) {
    if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.canvasEnabled) return false;
    if (HIGHLIGHT_STATE.canvasInternalDraw) return false;
    if (typeof originalFillText !== "function") return false;

    const rawText = String(imageText || "").trim();
    const matchedName = getMatchingHighlightName(rawText);
    if (!matchedName) return false;

    const dest = knownDest || getDrawImageDestination(args);
    if (!dest) return false;

    const now = pageWindow.performance && pageWindow.performance.now
      ? pageWindow.performance.now()
      : Date.now();
    const drawKey = [
      rawText,
      Math.round(dest.x),
      Math.round(dest.y),
      Math.round(dest.width),
      Math.round(dest.height),
      ctx.canvas ? `${ctx.canvas.width}x${ctx.canvas.height}` : "",
    ].join("|");
    const shouldCount =
      HIGHLIGHT_STATE.lastCanvasImageDrawKey !== drawKey ||
      now - HIGHLIGHT_STATE.lastCanvasImageDrawAt >= 40;
    if (shouldCount) {
      HIGHLIGHT_STATE.lastCanvasImageDrawKey = drawKey;
      HIGHLIGHT_STATE.lastCanvasImageDrawAt = now;
      HIGHLIGHT_STATE.canvasImageHits++;
    }
    HIGHLIGHT_STATE.lastCanvasImageText = rawText.slice(0, 80);

    try {
      HIGHLIGHT_STATE.canvasInternalDraw = true;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      const fontSize = clamp(Math.round(dest.height * 1.16), 18, 30);
      const fontFamily = getCanvasFontFamily(String(ctx.font || "")) || "hordes, Arial, sans-serif";
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
      ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const x = Math.round(dest.x + dest.width / 2);
      const y = Math.round(dest.y + dest.height + 1);

      if (typeof originalStrokeText === "function") {
        ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.22));
        ctx.strokeStyle = "rgba(5, 10, 22, 0.98)";
        originalStrokeText.call(ctx, rawText, x, y);
      }

      ctx.fillStyle = "#ffffff";
      originalFillText.call(ctx, rawText, x, y);
      originalFillText.call(ctx, rawText, x + 0.35, y);
      originalFillText.call(ctx, rawText, x - 0.35, y);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      originalFillText.call(ctx, rawText, x, y - 0.35);
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

  function resolvePendingCanvasNameWithClan(ctx, imageText, dest, now, seq) {
    if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.canvasEnabled || !HIGHLIGHT_CONFIG.hideClanNames) {
      return false;
    }
    if (!dest) return false;

    const rawText = String(imageText || "").trim();
    if (!rawText || rawText.length > 80) return false;
    if (getMatchingHighlightName(rawText)) return false;
    if (!looksLikeCanvasClanText(rawText)) return false;

    const match = findPendingCanvasNameForClan(ctx, dest, now, seq);
    if (!match) return false;

    const pending = HIGHLIGHT_STATE.pendingCanvasNames.splice(match.index, 1)[0];
    const alignedDest = getCenteredCanvasNameDest(pending.dest, dest);
    flushPendingCanvasName(pending, alignedDest);
    rememberHiddenCanvasClan(rawText);
    HIGHLIGHT_STATE.canvasDynamicAlignHits++;
    return true;
  }

  function looksLikeCanvasClanText(text) {
    return /[A-Za-z가-힣]/.test(String(text || ""));
  }

  function findPendingCanvasNameForClan(ctx, clanDest, now, seq) {
    const canvas = ctx && ctx.canvas ? ctx.canvas : null;
    let best = null;
    let bestScore = Infinity;

    for (let index = HIGHLIGHT_STATE.pendingCanvasNames.length - 1; index >= 0; index--) {
      const pending = HIGHLIGHT_STATE.pendingCanvasNames[index];
      if (!pending || !pending.dest) continue;
      if (pending.canvas && canvas && pending.canvas !== canvas) continue;
      if (now - pending.at > 80 || seq - pending.seq > 10) continue;
      if (!isLikelyClanForPendingCanvasName(pending.dest, clanDest)) continue;

      const pendingCenterY = pending.dest.y + pending.dest.height / 2;
      const clanCenterY = clanDest.y + clanDest.height / 2;
      const score = Math.abs(seq - pending.seq) * 100 + Math.abs(pendingCenterY - clanCenterY);
      if (score < bestScore) {
        best = { index, pending };
        bestScore = score;
      }
    }

    return best;
  }

  function isLikelyClanForPendingCanvasName(nameDest, clanDest) {
    const nameCenterY = nameDest.y + nameDest.height / 2;
    const clanCenterY = clanDest.y + clanDest.height / 2;
    const sameRow = Math.abs(nameCenterY - clanCenterY) <= Math.max(24, (nameDest.height + clanDest.height) * 0.8);
    const clanRight = clanDest.x + clanDest.width;
    const leftOfName = clanDest.x < nameDest.x + nameDest.width * 0.35;
    const closeToName = Math.abs(clanRight - nameDest.x) <= Math.max(90, (nameDest.width + clanDest.width) * 0.85);
    return sameRow && leftOfName && closeToName;
  }

  function getCenteredCanvasNameDest(nameDest, clanDest) {
    const minX = Math.min(nameDest.x, clanDest.x);
    const maxX = Math.max(nameDest.x + nameDest.width, clanDest.x + clanDest.width);
    const centerX = minX + (maxX - minX) / 2;
    const nextX = Math.round(centerX - nameDest.width / 2);
    const shiftX = nextX - nameDest.x;
    const maxShift = Math.max(16, Math.min(180, clanDest.width + 24));

    if (shiftX >= -2 || Math.abs(shiftX) > maxShift) {
      return nameDest;
    }

    return {
      x: nextX,
      y: nameDest.y,
      width: nameDest.width,
      height: nameDest.height,
    };
  }

  function rememberHiddenCanvasClan(text) {
    HIGHLIGHT_STATE.canvasClanHiddenHits++;
    HIGHLIGHT_STATE.lastCanvasClanText = String(text || "").slice(0, 80);
  }

  function getHighlighterTime() {
    return pageWindow.performance && pageWindow.performance.now
      ? pageWindow.performance.now()
      : Date.now();
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

  function getCanvasAlignOffset(textAlign, width) {
    if (textAlign === "center") return width / 2;
    if (textAlign === "right" || textAlign === "end") return width;
    return 0;
  }

  function getCanvasBaselineOffset(textBaseline, height, metrics, fontSize) {
    if (textBaseline === "top") return 0;
    if (textBaseline === "hanging") return fontSize * 0.2;
    if (textBaseline === "middle") return height / 2;
    if (textBaseline === "bottom" || textBaseline === "ideographic") return height;
    return metrics.actualBoundingBoxAscent || fontSize * 0.78;
  }

  function getMatchingHighlightName(text) {
    const haystack = String(text || "").toLowerCase();
    if (!haystack) return "";

    return HIGHLIGHT_CONFIG.names.find((name) => {
      const normalized = normalizeHighlightName(name).toLowerCase();
      return normalized && haystack.includes(normalized);
    }) || "";
  }

  function getHighlightStatus() {
    return {
      enabled: HIGHLIGHT_CONFIG.enabled,
      canvasEnabled: HIGHLIGHT_CONFIG.canvasEnabled,
      runtimeOverlayEnabled: HIGHLIGHT_CONFIG.runtimeOverlayEnabled,
      hideClanNames: HIGHLIGHT_CONFIG.hideClanNames,
      names: [...HIGHLIGHT_CONFIG.names],
      domHighlights: countDomHighlightElements(),
      canvasInstalled: HIGHLIGHT_STATE.canvasInstalled,
      canvasHits: HIGHLIGHT_STATE.canvasHits,
      canvasImageHits: HIGHLIGHT_STATE.canvasImageHits,
      canvasClanHiddenHits: HIGHLIGHT_STATE.canvasClanHiddenHits,
      pendingCanvasNames: HIGHLIGHT_STATE.pendingCanvasNames.length,
      canvasDynamicAlignHits: HIGHLIGHT_STATE.canvasDynamicAlignHits,
      canvasDeferredNameHits: HIGHLIGHT_STATE.canvasDeferredNameHits,
      lastCanvasText: HIGHLIGHT_STATE.lastCanvasText,
      lastCanvasImageText: HIGHLIGHT_STATE.lastCanvasImageText,
      lastCanvasClanText: HIGHLIGHT_STATE.lastCanvasClanText,
      nameplateStyle: getNameplateStyleStatus(),
      scriptHook: getScriptHookStatus(),
      runtimeOverlay: getRuntimeOverlayStatus(),
    };
  }

  function initGameScriptRuntimeHook() {
    if (HIGHLIGHT_STATE.scriptHookInstalled) return;
    HIGHLIGHT_STATE.scriptHookInstalled = true;

    installClientScriptGate();
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
    if (!/^\/play(?:\/|$)/.test(location.pathname)) return false;

    try {
      return (
        localStorage.getItem(SCRIPT_GATE_DISABLED_KEY) !== "true" &&
        localStorage.getItem(SCRIPT_GATE_ENABLED_KEY) === "true"
      );
    } catch {
      return false;
    }
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

    return (
      path.endsWith("/script.js") ||
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

    patched = replaceClientSourceOnce(
      patched,
      "Ku=t=>{ne=t}",
      "Ku=t=>{ne=t;try{window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};window.__HORDES_KR_RUNTIME__.engine=t;window.__HORDES_KR_RUNTIME__.updatedAt=Date.now()}catch(o){}}",
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
      "Vy=(t,e)=>{Iu(t),tt(ot,!0),Ii(he,!0),em(e);try{window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};Object.assign(window.__HORDES_KR_RUNTIME__,{engine:ne,camera:he,webglCanvas:ko,overlayCanvas:yn,renderState:N,settings:Te,frameTime:e,updatedAt:Date.now()})}catch(o){}ne.tick(t),",
      patches,
      "frame-loop"
    );

    patched = replaceClientSourceOnce(
      patched,
      "N3=t=>{I=t}",
      "N3=t=>{I=t;try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=t;r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientEngineSetter=(r.hookHits.clientEngineSetter||0)+1}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientEngineSetter:\"+((o&&o.message)||o))}catch(i){}}}",
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
      "QA=(t,e)=>{W3(e),HA(e);try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=I;try{r.camera=gt}catch(i){}try{r.cameraTransform=Qt}catch(i){}try{r.webglCanvas=To}catch(i){}try{r.overlayCanvas=Ln}catch(i){}try{r.renderState=tt}catch(i){}try{r.settings=fe}catch(i){}r.delta=t;r.frameTime=e;r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientFrameLoop=(r.hookHits.clientFrameLoop||0)+1}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientFrameLoop:\"+((o&&o.message)||o))}catch(i){}}I&&I.player?(wx(t),RA(t),I.tick(t),zA(t),wA(t,I),BA(t,I)):I&&I.tick(t)}",
      patches,
      "client-frame-loop"
    );

    patched = replaceClientSourceOnce(
      patched,
      "N3(new Fh({})),Z_(!0),z9()",
      "N3(new Fh({}));try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.engine=I;try{r.camera=gt}catch(i){}try{r.cameraTransform=Qt}catch(i){}try{r.webglCanvas=To}catch(i){}try{r.overlayCanvas=Ln}catch(i){}try{r.renderState=tt}catch(i){}try{r.settings=fe}catch(i){}r.updatedAt=Date.now();r.hookHits=r.hookHits||{};r.hookHits.clientOnload=(r.hookHits.clientOnload||0)+1}catch(o){try{var r=window.__HORDES_KR_RUNTIME__=window.__HORDES_KR_RUNTIME__||{};r.hookErrors=r.hookErrors||[];r.hookErrors.push(\"clientOnload:\"+((o&&o.message)||o))}catch(i){}};Z_(!0),z9()",
      patches,
      "client-onload-runtime"
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

    if (HIGHLIGHT_STATE.runtimeOverlayTimer) return;
    HIGHLIGHT_STATE.runtimeOverlayTimer = setInterval(updateRuntimeNameOverlay, 80);
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
      .hordes-kr-runtime-name-prefix {
        color: #2f7dff !important;
        -webkit-text-stroke: 0.7px rgba(5, 10, 22, 0.98) !important;
        text-shadow:
          2px 0 0 rgba(5, 10, 22, 0.98),
          -2px 0 0 rgba(5, 10, 22, 0.98),
          0 2px 0 rgba(5, 10, 22, 0.98),
          0 -2px 0 rgba(5, 10, 22, 0.98),
          0 0 5px rgba(64, 121, 255, 0.95) !important;
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

  function updateRuntimeNameOverlay() {
    try {
      if (!HIGHLIGHT_CONFIG.enabled || !HIGHLIGHT_CONFIG.runtimeOverlayEnabled || HIGHLIGHT_CONFIG.names.length === 0) {
        clearRuntimeNameOverlay();
        return;
      }

      const host = ensureRuntimeNameOverlayHost();
      const runtime = getExposedRuntime();
      if (!host || !runtime || !getRuntimeProjectionMatrix(runtime)) {
        clearRuntimeNameOverlay();
        return;
      }

      const candidates = collectRuntimeOverlayEntities(HIGHLIGHT_CONFIG.names, {
        limit: 16,
        maxDepth: 7,
        maxObjects: 9000,
      });
      const projected = [];

      for (const candidate of candidates) {
        const point = projectRuntimeEntityToScreen(candidate, runtime);
        if (!point) continue;

        projected.push({ ...candidate, screen: point });
        if (projected.length >= 12) break;
      }

      renderRuntimeNameOverlayLabels(host, projected);
      HIGHLIGHT_STATE.lastRuntimeOverlayMatches = projected.slice(0, 8).map((candidate) => ({
        name: candidate.name,
        path: candidate.path,
        position: candidate.position.map(roundCoord),
        screen: {
          x: roundCoord(candidate.screen.x),
          y: roundCoord(candidate.screen.y),
        },
      }));

      if (projected.length > 0) {
        HIGHLIGHT_STATE.runtimeOverlayHits += projected.length;
        HIGHLIGHT_STATE.lastRuntimeOverlayAt = Date.now();
        HIGHLIGHT_STATE.lastRuntimeOverlayError = "";
      }
    } catch (error) {
      HIGHLIGHT_STATE.lastRuntimeOverlayError = error && error.message ? error.message : String(error);
      clearRuntimeNameOverlay();
    }
  }

  function clearRuntimeNameOverlay() {
    const host = HIGHLIGHT_STATE.runtimeOverlayHost;
    if (host) host.replaceChildren();
    HIGHLIGHT_STATE.runtimeOverlayItems.clear();
    HIGHLIGHT_STATE.lastRuntimeOverlayMatches = [];
  }

  function renderRuntimeNameOverlayLabels(host, candidates) {
    const activeKeys = new Set();

    for (const candidate of candidates) {
      const key = `${candidate.name}:${candidate.path}`;
      activeKeys.add(key);

      let label = HIGHLIGHT_STATE.runtimeOverlayItems.get(key);
      if (!label) {
        label = document.createElement("div");
        label.className = "hordes-kr-runtime-name-label";

        const prefix = document.createElement("span");
        prefix.className = "hordes-kr-runtime-name-prefix";
        prefix.textContent = "#KR";

        const name = document.createElement("span");
        name.dataset.hordesKrRuntimeName = "true";

        label.append(prefix, document.createTextNode(" "), name);
        host.appendChild(label);
        HIGHLIGHT_STATE.runtimeOverlayItems.set(key, label);
      }

      const nameNode = label.querySelector("[data-hordes-kr-runtime-name]");
      if (nameNode) nameNode.textContent = candidate.name;
      label.style.left = `${Math.round(candidate.screen.x)}px`;
      label.style.top = `${Math.round(candidate.screen.y)}px`;
    }

    for (const [key, label] of HIGHLIGHT_STATE.runtimeOverlayItems.entries()) {
      if (activeKeys.has(key)) continue;

      label.remove();
      HIGHLIGHT_STATE.runtimeOverlayItems.delete(key);
    }
  }

  function collectRuntimeOverlayEntities(names, options = {}) {
    const normalizedNames = names.map(normalizeHighlightName).filter(Boolean);
    if (normalizedNames.length === 0) return [];

    const lowerNames = normalizedNames.map((name) => name.toLowerCase());
    const runtime = getExposedRuntime();
    if (!runtime) return [];

    const limit = options.limit || 16;
    const maxDepth = options.maxDepth || 7;
    const maxObjects = options.maxObjects || 9000;
    const roots = [{ value: runtime, path: "runtime", depth: 0 }];
    if (runtime.engine) roots.push({ value: runtime.engine, path: "runtime.engine", depth: 0 });

    const queue = roots.slice();
    const seen = new WeakSet();
    const candidates = [];
    let visited = 0;

    while (queue.length > 0 && visited < maxObjects && candidates.length < limit * 3) {
      const item = queue.shift();
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

    return dedupeRuntimeOverlayCandidates(candidates)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function summarizeRuntimeOverlayEntity(value, path, lowerNames) {
    const name = getRuntimeNameValueLoose(value);
    if (!name) return null;

    const lowerName = name.toLowerCase();
    const matchedName = lowerNames.find((target) => lowerName.includes(target));
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

  function getExposedRuntime() {
    try {
      return pageWindow.__HORDES_KR_RUNTIME__ || null;
    } catch {
      return null;
    }
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
      hasCamera: !!runtime.camera,
      hasProjectionMatrix: !!getRuntimeProjectionMatrix(runtime),
      hasWebglCanvas: isVisibleCanvasElement(runtime.webglCanvas),
      hasOverlayCanvas: isVisibleCanvasElement(runtime.overlayCanvas),
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
    const names = explicit ? [explicit] : HIGHLIGHT_CONFIG.names.map(normalizeHighlightName);
    return [...new Set(names.filter(Boolean))];
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

    while (queue.length > 0 && visited < maxObjects && candidates.length < limit) {
      const item = queue.shift();
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
    if (!isRuntimeTraversable(value, path)) return children;

    if (Array.isArray(value)) {
      const length = Math.min(value.length, limit);
      for (let index = 0; index < length; index++) {
        const child = value[index];
        if (isRuntimeObject(child)) children.push({ value: child, path: `${path}[${index}]` });
      }
      return children;
    }

    if (value instanceof Map || value instanceof Set) {
      let index = 0;
      for (const entry of value.values()) {
        if (index >= limit) break;
        if (isRuntimeObject(entry)) children.push({ value: entry, path: `${path}.${value instanceof Map ? "map" : "set"}[${index}]` });
        index++;
      }
      return children;
    }

    for (const key of safeOwnKeys(value)) {
      if (children.length >= limit) break;
      if (shouldSkipRuntimeKey(key)) continue;

      const child = safeReadOwnValue(value, key);
      if (isRuntimeObject(child) && isRuntimeTraversable(child, `${path}.${key}`)) {
        children.push({ value: child, path: `${path}.${key}` });
      }
    }

    return children;
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

  function initEventScheduler() {
    updateEventState();
    checkEventAlarms();

    if (EVENT_STATE.timer) clearInterval(EVENT_STATE.timer);
    EVENT_STATE.timer = setInterval(() => {
      updateEventState();
      checkEventAlarms();
      renderStatusUi();
    }, 1000);
  }

  function updateEventState() {
    const now = Date.now();
    const current = getEventPhaseAt(new Date(now));
    current.remainingMs = Math.max(0, current.endAt - now);

    EVENT_STATE.current = current;
    EVENT_STATE.schedule = buildEventSchedule(now, 8);
    EVENT_STATE.next = EVENT_STATE.schedule.find((event) => event.startAt > now) || null;
    pruneFiredEventAlarms(now);
  }

  function getEventPhaseAt(date) {
    const startAt = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0
    );
    const phaseIndex = ((date.getUTCHours() % 3) + 3) % 3;
    const phaseKey = phaseIndex === 0 ? "obelisk" : phaseIndex === 1 ? "gloomfury" : "rest";
    const phase = EVENT_PHASES[phaseKey];

    return {
      key: phaseKey,
      name: phase.name,
      label: phase.label,
      description: phase.description,
      startAt,
      endAt: startAt + HOUR_MS,
    };
  }

  function buildEventSchedule(now, count) {
    const date = new Date(now);
    const currentHourStart = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0
    );
    const events = [];

    for (let offset = 0; offset < 36 && events.length < count; offset += 1) {
      const phase = getEventPhaseAt(new Date(currentHourStart + offset * HOUR_MS));
      if (phase.key === "rest" || phase.endAt <= now) continue;
      events.push(phase);
    }

    return events;
  }

  function checkEventAlarms() {
    if (!EVENT_CONFIG.alarmsEnabled) return;

    const now = Date.now();
    for (const event of EVENT_STATE.schedule.slice(0, 4)) {
      if (event.startAt <= now) continue;

      for (const minute of EVENT_CONFIG.alarmMinutes) {
        const beforeMs = minute * MINUTE_MS;
        const diff = event.startAt - now;
        const alarmKey = `${event.key}:${event.startAt}:${minute}`;

        if (diff <= beforeMs && diff > -5000 && !EVENT_STATE.firedAlarms.has(alarmKey)) {
          EVENT_STATE.firedAlarms.add(alarmKey);
          fireEventAlarm(event, minute);
        }
      }
    }
  }

  function pruneFiredEventAlarms(now) {
    for (const key of EVENT_STATE.firedAlarms) {
      const parts = key.split(":");
      const startAt = Number(parts[1]);
      if (Number.isFinite(startAt) && startAt + HOUR_MS < now) {
        EVENT_STATE.firedAlarms.delete(key);
      }
    }
  }

  function fireEventAlarm(event, minute) {
    const message = `${event.label} 시작 ${minute}분 전`;
    EVENT_STATE.lastAlarm = `${message} (${formatKstTime(event.startAt)})`;
    setStatus({
      lastState: `이벤트 알림: ${message}`,
      lastError: "",
    });

    if (EVENT_CONFIG.soundEnabled) playEventSound();
    showBrowserNotification("Hordes KR Mod", EVENT_STATE.lastAlarm);
  }

  function requestNotificationPermission() {
    if (!("Notification" in pageWindow)) return;

    if (pageWindow.Notification.permission === "granted") {
      EVENT_CONFIG.browserNotification = true;
      saveJsonConfig(EVENT_CONFIG_KEY, EVENT_CONFIG);
      return;
    }

    if (pageWindow.Notification.permission === "default") {
      pageWindow.Notification.requestPermission().then((permission) => {
        EVENT_CONFIG.browserNotification = permission === "granted";
        saveJsonConfig(EVENT_CONFIG_KEY, EVENT_CONFIG);
        renderStatusUi();
      });
    }
  }

  function showBrowserNotification(title, body) {
    if (!EVENT_CONFIG.browserNotification || !("Notification" in pageWindow)) return;
    if (pageWindow.Notification.permission !== "granted") return;

    try {
      new pageWindow.Notification(title, {
        body,
        silent: !EVENT_CONFIG.soundEnabled,
      });
    } catch {
      // Browser notification can fail if the page is not allowed to show it.
    }
  }

  function playEventSound() {
    try {
      const AudioContext = pageWindow.AudioContext || pageWindow.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.4);
      setTimeout(() => audioContext.close(), 700);
    } catch {
      // Autoplay policies can block audio until the user interacts with the page.
    }
  }

  function formatKstTime(timestamp) {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
    if (minutes > 0) return `${minutes}분 ${seconds}초`;
    return `${seconds}초`;
  }

  function initStatusUi() {
    installStatusUiKeyboardGuard();

    const mount = () => {
      if (!document.body) {
        setTimeout(mount, 50);
        return;
      }

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
            --panel-width: 320px;
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
            min-width: 280px;
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
            padding: 10px 12px;
            background: rgba(245, 194, 71, 0.1);
            border-bottom: 1px solid rgba(166, 220, 213, 0.16);
            font-size: calc(13px * var(--font-scale));
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
            gap: 8px;
            padding: 10px 12px 12px;
            font-size: calc(12px * var(--font-scale));
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
          .action {
            border: 1px solid rgba(166, 220, 213, 0.28);
            background: rgba(61, 89, 95, 0.75);
            color: #dff8f5;
            border-radius: 5px;
            padding: 6px 8px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
          }
          .action:hover {
            border-color: rgba(245, 194, 71, 0.8);
          }
          .input-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 6px;
            margin-top: 7px;
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
          .schedule {
            display: grid;
            gap: 5px;
            padding-top: 2px;
          }
          .schedule-row {
            display: grid;
            grid-template-columns: 82px 1fr;
            gap: 8px;
            color: #dff8f5;
            line-height: 1.3;
          }
          .schedule-time {
            color: #a6dcd5;
            font-weight: 800;
          }
        </style>
        <div id="panel" class="panel" hidden>
          <div class="header">
            <span>Hordes KR Mod</span>
            <span id="version" class="version"></span>
          </div>
          <div class="body">
            <div class="section">
              <div class="row"><span class="label">남은 시간</span><span id="eventRemaining" class="value"></span></div>
              <div class="row"><span class="label">다음</span><span id="eventNext" class="value"></span></div>
              <div id="eventSchedule" class="schedule"></div>
            </div>
            <div class="actions">
              <button id="toggle" class="action" type="button"></button>
              <button id="toggleHighlight" class="action" type="button"></button>
            </div>
            <div class="section">
              <div class="row"><span class="label">강조 ID</span><span id="highlightCount" class="value"></span></div>
              <div id="highlightList" class="highlight-list"></div>
              <div class="input-row">
                <input id="highlightInput" class="text-input" type="text" maxlength="32" placeholder="닉네임 입력" autocomplete="off" />
                <button id="addHighlight" class="action" type="button">추가</button>
              </div>
            </div>
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
        if (isEnabled()) {
          pageWindow.HordesKrMod.disable();
        } else {
          pageWindow.HordesKrMod.enable();
        }
      });

      shadow.getElementById("toggleHighlight").addEventListener("click", () => {
        pageWindow.HordesKrMod.toggleNameHighlight();
        renderStatusUi();
      });

      shadow.getElementById("addHighlight").addEventListener("click", () => {
        addHighlightNameFromUi();
      });

      shadow.getElementById("highlightInput").addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        addHighlightNameFromUi();
      });

      installHighlightInputGuards(shadow);
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

    [
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
    ].forEach((type) => {
      pageWindow.addEventListener(type, guard, true);
      document.addEventListener(type, guard, true);
    });
  }

  function isStatusUiKeyboardEvent(event) {
    const input = STATUS_UI.shadow && STATUS_UI.shadow.getElementById("highlightInput");
    if (!input) return false;

    if (typeof event.composedPath === "function" && event.composedPath().includes(input)) {
      return true;
    }

    return getStatusUiActiveElement() === input;
  }

  function getStatusUiActiveElement() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return null;

    return shadow.activeElement || null;
  }

  function handleStatusUiKeydown(event) {
    const active = getStatusUiActiveElement();
    if (!active || active.id !== "highlightInput") return;

    if (event.key === "Enter") {
      event.preventDefault();
      addHighlightNameFromUi();
    } else if (event.key === "Escape") {
      event.preventDefault();
      active.blur();
    }
  }

  function installHighlightInputGuards(shadow) {
    const input = shadow.getElementById("highlightInput");
    if (!input) return;

    ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend"].forEach((type) => {
      input.addEventListener(type, (event) => {
        event.stopPropagation();
        pageWindow.requestAnimationFrame(() => input.focus({ preventScroll: true }));
      });
    });

    ["keydown", "keypress", "keyup", "beforeinput", "input", "paste", "copy", "cut", "compositionstart", "compositionupdate", "compositionend"].forEach((type) => {
      input.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    });
  }

  function applyUiConfig() {
    const host = STATUS_UI.host;
    if (!host) return;

    host.style.setProperty("--panel-width", `${clamp(UI_CONFIG.width || 320, 280, 520)}px`);
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

  function setUiScale(delta) {
    UI_CONFIG.fontScale = clamp((UI_CONFIG.fontScale || 1) + delta, 0.85, 1.25);
    UI_CONFIG.width = clamp((UI_CONFIG.width || 320) + delta * 600, 280, 520);
    saveJsonConfig(UI_CONFIG_KEY, UI_CONFIG);
    applyUiConfig();
    renderStatusUi();
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

  function setStatus(nextStatus) {
    Object.assign(MOD_STATUS, nextStatus);
    renderStatusUi();
  }

  function renderStatusUi() {
    const shadow = STATUS_UI.shadow;
    if (!shadow) return;

    const enabled = isEnabled();
    const state = MOD_STATUS.lastState || "";
    const isError = state.includes("오류") || state.includes("실패");
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
    shadow.getElementById("toggle").textContent = enabled ? "번역 끄기" : "번역 켜기";
    shadow.getElementById("toggleHighlight").textContent = HIGHLIGHT_CONFIG.enabled ? "강조 끄기" : "강조 켜기";
    renderEventUi(shadow);
    renderHighlightUi(shadow);
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
    count.textContent = names.length > 0 ? `${names.length}개` : "없음";
    list.replaceChildren(
      ...names.map((name) => {
        const row = document.createElement("div");
        const value = document.createElement("span");
        const remove = document.createElement("button");

        row.className = "highlight-item";
        value.className = "highlight-name";
        value.textContent = name;
        remove.className = "remove";
        remove.type = "button";
        remove.textContent = "삭제";
        remove.addEventListener("click", () => {
          pageWindow.HordesKrMod.removeHighlightName(name);
          renderStatusUi();
        });
        row.append(value, remove);
        return row;
      })
    );
  }

  function renderEventUi(shadow) {
    if (!EVENT_STATE.current) updateEventState();

    const current = EVENT_STATE.current;
    const next = EVENT_STATE.next;
    shadow.getElementById("eventRemaining").textContent = current
      ? `${formatDuration(current.remainingMs)} (${formatKstTime(current.endAt)} KST 종료)`
      : "-";
    shadow.getElementById("eventNext").textContent = next
      ? `${next.label} ${formatKstTime(next.startAt)} KST`
      : "-";

    const schedule = shadow.getElementById("eventSchedule");
    if (!schedule) return;

    schedule.replaceChildren(
      ...EVENT_STATE.schedule.slice(0, 3).map((event) => {
        const row = document.createElement("div");
        const time = document.createElement("span");
        const value = document.createElement("span");

        row.className = "schedule-row";
        time.className = "schedule-time";
        value.className = "value";
        time.textContent = `${formatKstTime(event.startAt)} KST`;
        value.textContent = event.label;
        row.append(time, value);
        return row;
      })
    );
  }

  function getAlarmButtonText() {
    if (!EVENT_CONFIG.alarmsEnabled) return "알림 켜기";
    if (
      !EVENT_CONFIG.browserNotification &&
      "Notification" in pageWindow &&
      pageWindow.Notification.permission === "default"
    ) {
      return "권한 요청";
    }
    return "알림 끄기";
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
