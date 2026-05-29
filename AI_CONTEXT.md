# Hordes KR Mod AI Context

이 문서는 다음 작업자가 `hordes-kr-mod.user.js` 전체를 처음부터 읽지 않고도 구조를 잡기 위한 진입점이다.
런타임 동작은 `hordes-kr-mod.user.js` 단일 Tampermonkey 스크립트가 담당한다.

## 핵심 원칙

- 갱신 주기, WebSocket 패킷, 게임 클라이언트 후킹, 런타임 엔티티 탐색은 성능/기능 영향이 크므로 리팩토링 우선순위에서 뒤로 둔다.
- 줄 수를 줄이는 것보다 기능 경계, 의존성, 상태 객체를 명확히 하는 것이 우선이다.
- 안전 리팩토링은 작은 단위로 하고 매번 `node --check hordes-kr-mod.user.js`와 `git diff --check`를 통과시킨다.
- 기존 사용자 설정 키는 유지한다. localStorage 키 변경은 마이그레이션 없이 하지 않는다.

## 파일 구조

- `hordes-kr-mod.user.js`: 실제 배포/수동 설치용 단일 유저스크립트.
- `server/target-order-server.js`: 스크립트 사용자 간 타겟 오더용 Node 서버.
- `TRANSLATION_AUDIT.md`: 번역 검토 기록.
- `README.md`: 설치/사용 설명.

## 주요 구간

| 구간 | 대략 위치 | 역할 |
| --- | ---: | --- |
| 부트스트랩/메타 | 1-288 | Tampermonkey 초기화, CSP/페이지 주입, OpenAI bridge |
| 설정/상태/상수 | 289-925 | localStorage 키, feature config, 전역 상태 객체 |
| `KO_PATCH` | 926-2800 | 게임 한국어 번역 보강 데이터 |
| 공개 API/초기화 | 2801-3660 | `window.HordesKrMod` API, fetch/XHR 언어팩 가로채기 |
| 채팅 번역 | 3661-5339 | 채팅 DOM 스캔, 캐시, OpenAI 요청, outgoing 번역 |
| 타겟 오더 | 5340-5949 | 외부 Node 서버 연결, G 단축키, 수신 알림 |
| 파티 UI/오더 패널 | 5950-7110 | 파티창 이동, 오더 버튼 패널 |
| DOM/캔버스 이름 강조 | 7111-8440 | 강조 ID, 컨텍스트 메뉴, canvas text hook |
| 클라이언트 후킹/런타임 CSS | 8441-9900 | `client.js` 패치, overlay CSS |
| 런타임 오버레이/미니맵 목록 | 9901-12240 | 이름표, 미니맵 라벨, 강조 목록, 프리셋바 |
| 타겟 거리/타겟팅/디버그 | 12241-14580 | 거리 계산, 대상 고정/클릭, runtime debug |
| 장비/스킬 프리셋 | 14581-16420 | WebSocket 명령, 장비/스킬 저장/적용/검증 |
| 관리 패널 | 16421-끝 | 우측 하단 설정 패널, feature toggles |

## 상태 객체 기준

- `FEATURE_CONFIG`: 기능 on/off. UI에서 사용자가 보는 큰 토글 기준.
- `HIGHLIGHT_CONFIG`: 이름 강조, 미니맵 라벨/목록, 클랜명 숨김.
- `HIGHLIGHT_STATE`: 런타임 오버레이, 미니맵, 프리셋바, 후킹 상태까지 포함하는 큰 상태 객체.
- `TARGET_DISTANCE_STATE`: 타겟 거리, 고정 타겟, 캔버스 거리 라벨 상태.
- `GEAR_PRESET_STATE`, `SKILL_PRESET_STATE`: 프리셋 적용 실행/검증 상태.
- `CHAT_TRANSLATION_STATE`: 채팅 번역 큐, 캐시, OpenAI 요청 상태.
- `PARTY_COMMAND_CONFIG`, `PARTY_COMMAND_STATE`: 오더 패널 위치/채널/전송 상태.

## 리팩토링 우선순위

### 1. 안전

- 죽은 코드 제거:
  - `incomingSkillList` UI/렌더러/상태는 제거됐다. 공개 상태는 호환 목적으로 `enabled: false` 형태만 유지한다.
  - `collectIncomingSkillOverlayEntities`, `collectIncomingTargetWatchOverlayEntities`는 통합 함수로 대체되어 제거됐다.
  - `extractChatMessageText`, `drawCanvasImageAt`, `getHighlighterTime`는 제거됐다.
- 중복 UI 이벤트 가드 함수 재사용.
- `createUiButton()`은 파티 오더/프리셋바/강조목록 버튼부터 공통화되어 있다. 새 작은 버튼은 이 헬퍼를 우선 사용한다.
- 단순 `div`/`span` 등 DOM 생성은 `createUiElement()`를 우선 사용한다.
- `installWindowPointerDrag()`는 파티 오더 패널, 프리셋바, 미니맵 강조목록 드래그에 적용되어 있다.
- 프리셋바 버튼은 `createPresetQuickBarPresetGroup()` + `getGearQuickPresetButtonConfig()`/`getSkillQuickPresetButtonConfig()` 구조다.
- 관리패널의 장비/스킬 프리셋 클릭 핸들러는 `installPresetPanelHandlers()`로 공통화되어 있다.
- 관리패널 버튼의 `disabled`/`off`/`title`/`text` 상태는 `setPanelButtonState()`를 우선 사용한다.
- 관리패널 텍스트 입력 이벤트 가드는 `installStatusUiInputGuards()`가 일괄 설치한다.
- `" / "`로 이어지는 UI 상태 문자열은 `joinStatusParts()`를 우선 사용한다.
- 미니맵 강조목록 행의 직업 아이콘/체력바/title 조립은 `createMinimapListClassIcon()`, `createMinimapListHealth()`, `getMinimapListRowTitle()`로 분리되어 있다.
- 타겟거리의 비싼 deep runtime search는 `getCachedDeepRuntimeSearch()`로 1초 캐시된다. 직접 ID/배열 조회는 매 틱 유지한다.
- 런타임 엔티티 스코어러는 ID/이름/플래그/경로처럼 싼 조건을 먼저 검사하고, 후보일 때만 `getRuntimeWorldPosition()`을 호출한다.
- `isResolvedRuntimeEntity()`는 ID 일치 여부를 먼저 확인한 뒤 좌표를 파싱한다. ID 기반 직접 조회 경로에서 좌표 파싱 순서를 다시 비싸게 바꾸지 않는다.
- `findBestRuntimeEntity()` hot path는 `forEachRuntimeChild()`를 직접 사용해 자식 배열 생성을 피한다. 외부 디버그용 `getRuntimeChildren()` API는 유지한다.
- 강조 ID 목록은 로드/저장 시 unique 처리하고, `getHighlightNameCache()`는 원본 배열 참조/키가 바뀔 때만 sort/lower/matcher를 재계산한다. 캔버스 텍스트 강조 매칭은 `HIGHLIGHT_NAME_CACHE.matchCache`로 짧게 캐시된다.
- 강조 ID 우클릭 추가는 타겟 체력바 메뉴와 채팅 유저 컨텍스트 메뉴 둘 다 지원한다. 채팅에서는 `.linewrap`의 채널/레벨/닉네임 형태를 파싱해 닉네임만 추가한다. `sanitizeChatContextName`/`extractChatContextNameFromText`는 ASCII 전용이 아니라 유니코드(`\p{L}\p{N}_-`)를 허용해 한글 등 비ASCII 닉도 추가 가능하다(채널 단어 블록리스트는 유지). 선택 타겟 경로는 클릭 요소가 `#uftarget, .targetframes` 안이면 표시 텍스트가 잘려도 이름 텍스트 매칭 없이 인정한다.
- 미니맵 강조 리스트(`renderMinimapHighlightList`)는 매 틱 전체 재생성(replaceChildren) 대신 id 기반 **재조정**을 쓴다: `ensureMinimapHighlightListShell`이 패널/타이틀/컨트롤/드래그핸들을 1회만 만들고, `reconcileMinimapHighlightListRows`가 행을 `data-row-key`로 재사용(appendChild로 거리순 재정렬)하며 `updateMinimapHighlightListRow`가 텍스트만 갱신한다. 이전엔 거리/좌표가 매 프레임 바뀌어 렌더키가 항상 달라져 패널 스크롤 초기화 + 커서 아래 행 파괴로 클릭이 씹혔다. 행 클릭 핸들러는 생성 시 닫힌 candidate 대신 `row.dataset`에서 현재 id/name을 읽는다. (`buildMinimapHighlightListRenderKey`는 죽은 코드로 남음)
- `시전/주시` 경고는 시전 대상뿐 아니라 다른 플레이어 엔티티의 직접/nested target 계열 필드가 내 캐릭터를 가리키는지도 감지한다. 예전 비활성화 상태를 2026-05-27 마이그레이션으로 기본 활성화한다. 오버레이 라벨은 적 엔티티의 화면 투영 위치에 붙는데, `isUsableProjectedPoint`가 `clipW>0`(카메라 앞)+NDC ±1.35만 통과시켜 **등 뒤/화면 밖** 적은 투영 null로 버려졌다(경고가 가장 필요한데 누락). 그래서 incoming 후보(`incomingSkill`/`incomingTargetWatch`)에 한해 `projectRuntimeIncomingWarningPoint`로 폴백해 화면 가장자리에 클램프한다(카메라 뒤는 NDC가 미러라 부호 반전 후 클램프 — 근사치). 일반 강조 라벨은 종전대로 화면 밖이면 표시 안 함. `screen.offScreen`/candidate `offScreen` 플래그로 구분.
- `runtimeDebug().scriptHook.missingExpectedPatches`는 현재 클라이언트에서 실제 성공하는 핵심 패치만 기준으로 본다. 예전 `client-frame-loop`, `client-onload-runtime`, `client-set-state` 계열은 특정 client.js 빌드에서 안 잡혀도 현재 runtime 노출이 정상일 수 있다.
- `Swiftshot Turbo`는 기본 `R, 1, 5, Q, E, F` 꾹 누름 보조 기능이다. 입력창/채팅/관리패널에서는 동작하지 않고, 실제 첫 keydown은 통과시키며 이후 반복 keydown은 막고 synthetic pulse를 보낸다. `Digit1` 추가는 `SWIFTSHOT_TURBO_KEYS_DEFAULT_VERSION` 키로 기존 저장 설정에도 1회 마이그레이션된다. 펄스마다 `canvas.focus()`를 호출하던 동작은 이미 캔버스가 포커스된 경우 건너뛴다 — 매 펄스 재포커스가 이동키 keyup을 흘려 전진키가 잠기던 문제를 막기 위함(synthetic 이벤트는 dispatchEvent+버블링으로 포커스와 무관하게 전달됨).
- 파티 오더 패널처럼 제거된 UI의 잔여 CSS 제거.

### 2. 중간 위험

- 드래그 로직 공통화:
  - 파티 UI와 관리 패널은 아직 별도 로직이다. Shadow DOM/게임 UI 의존성이 있어 후순위로 둔다.
- 버튼/행 생성 헬퍼화:
  - `createButton`, `createRow`, `setButtonState` 같은 작은 DOM helper 도입.
- 관리 패널 렌더링을 기능별 schema 기반으로 정리.

### 3. 고위험

- `client.js` 후킹 문자열 패치 구조 변경.
- 런타임 엔티티 탐색/타겟팅/거리 계산 통합.
- 장비/스킬 프리셋 WebSocket 명령 흐름 공통화.
- 채팅 번역 큐/DOM 스캔 방식 변경.

## 검증 루틴

항상 최소 검증:

```bash
node --check hordes-kr-mod.user.js
git diff --check
```

브라우저 런타임 확인이 필요하면 CDP에서 다음을 본다:

```js
HordesKrMod.version
HordesKrMod.runtimeDebug?.()
HordesKrMod.highlightStatus?.()
HordesKrMod.targetDistance?.()
HordesKrMod.partyCommandPanelStatus?.()
```

## 다음에 AI가 바로 보면 좋은 포인트

- 기능이 안 보이면 먼저 현재 브라우저가 최신 userscript 버전을 로드했는지 확인한다.
- “기본 위치” 문제는 저장된 `x/y`가 있으면 리셋 전까지 새 기본값이 안 보인다.
- 성능 문제는 먼저 타이머 주기보다 DOM mutation scan, runtime entity scan, canvas hook 중 어디가 병목인지 구분한다.
- 거래소 관련 기능은 제거됨. 경매 문자열은 번역 데이터로만 남아 있을 수 있다.
