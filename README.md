# Hordes KR Custom Mod

Hordes.io용 Tampermonkey 커스텀 모드입니다. 현재 범위는 게임 UI 한국어 번역 강제 적용과 커스텀 번역 패치입니다. 채팅창 실시간 번역은 보류했습니다.

## 동작 방식

- 화면 오른쪽 아래에 `KR 번역` 상태 배지를 표시합니다.
- 게임이 `/data/loc/*.json` 언어 파일을 요청하면 모드가 가로챕니다.
- Hordes.io가 직접 제공하는 `/data/loc/ko.json`을 불러옵니다.
- `hordes-kr-mod.user.js` 안의 `KO_PATCH`를 덮어씌워 부족하거나 어색한 UI 번역을 보강합니다.
- 언어팩 요청을 못 잡는 경우를 대비해, `/data/loc/en.json`과 한국어 언어팩을 비교한 뒤 화면에 보이는 UI 텍스트를 직접 치환합니다.
- 언어팩 PR 없이 모드 안에서만 커스텀 번역을 적용합니다.

참고한 언어팩 저장소:

- https://github.com/dekdevy/hordes-loc

## 설치

1. Tampermonkey에서 새 스크립트를 만듭니다.
2. `hordes-kr-mod.user.js` 내용을 붙여넣습니다.
3. `https://hordes.io/` 또는 `https://hordes.io/play`를 새로고침합니다.

직접 설치 URL:

- https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/hordes-kr-mod.user.js

`v0.2.0`부터는 Tampermonkey 헤더에 `@grant unsafeWindow`가 필요합니다. 게임 페이지의 실제 `fetch`와 `XMLHttpRequest`를 패치하기 위한 설정입니다.
`v0.4.1`부터는 언어팩 가로채기가 실패해도 DOM 텍스트 치환 fallback이 동작합니다.
`v0.4.2`부터는 진영 설명, 튜토리얼, 칭호, 신고 사유, 일부 스탯/획득 메시지의 한국어 표현을 정리했습니다.
`v0.4.3`부터는 스킬북 설명 전체, 일부 장비 설명, NPC 대사, 파티/보관함/설정/스킬 툴팁 문구를 추가 정리했습니다.
`v0.4.5`부터는 영어로 남아 있던 아이템 설명 148개와 상인/클랜/파티/설정 UI의 오역 후보를 정리했습니다.
`v0.5.0`부터는 Gloomfury/Obelisk 일정표와 10분/5분/1분 전 알림, KR 패널 이동/크기 조절을 지원합니다.
`v0.5.2`부터는 이벤트 일정을 KST 기준으로 표시하고, KR 번역 토글 배지의 기본 위치를 우측 하단에 더 붙였습니다.
`v0.5.3`부터는 배지 클릭 패널을 이벤트 일정과 번역 켜기/끄기 중심으로 단순화했습니다.
`v0.5.4`부터는 패널에서 남은 시간과 다음 이벤트만 표시합니다.
`v0.5.5`부터는 가까운 이벤트 3회 일정표를 짧게 다시 표시합니다.
`v0.6.0`부터는 콘솔 명령으로 특정 닉네임을 화면에서 강조 표시할 수 있습니다.
`v0.6.1`부터는 2D 캔버스 텍스트 강조와 런타임 진단 명령을 추가했습니다.
`v0.6.2`부터는 `HO2`를 기본 강조 닉네임으로 등록합니다.
`v0.6.3`부터는 `HMage`도 기본 강조 닉네임으로 등록합니다.
`v0.6.4`부터는 닉네임 강조 배경과 테두리 대비를 더 강하게 조정했습니다.
`v0.6.5`는 Tampermonkey 업데이트 감지를 위한 버전 갱신입니다.
`v0.6.6`부터는 강조 닉네임 글자 자체를 더 크고 굵게 덧그립니다.
`v0.6.7`부터는 글자 짤림을 줄이고 DOM 강조 레이어를 최상위로 올렸습니다.
`v0.6.8`부터는 패널에 닉네임 강조 켜기/끄기 버튼을 추가했습니다.
`v0.6.9`부터는 강조 배경/테두리를 제거하고 굵은 글자만 표시합니다.
`v0.7.0`부터는 클릭 상태처럼 보이도록 글자 외곽선과 굵은 덧칠을 적용합니다.
`v0.7.1`부터는 클릭 상태에 더 가깝게 글자 외곽선과 크기를 강화합니다.
`v0.7.2`부터는 클릭된 이름표 스타일을 캡처해 강조 스타일로 재사용할 수 있습니다.
`v0.7.3`부터는 WebGL 이름표를 위해 게임 클라이언트 스크립트를 로드 전에 패치하고, 런타임 좌표 기반 오버레이 이름표를 별도로 그립니다.
`v0.7.4`부터는 실제 플레이 클라이언트인 `/client.js`의 엔진, 카메라, 프레임 루프 패턴을 추가로 패치합니다.
`v0.7.5`부터는 `/client.js` 런타임 값을 개별 대입하고 엔진 생성 직후에도 한 번 더 노출해 후킹 성공 여부를 더 정확히 표시합니다.
`v0.7.6`부터는 원본 `/client.js`가 먼저 실행되는 레이스를 줄이기 위해 동기 XHR로 패치본을 즉시 삽입합니다.
`v0.7.7`부터는 `/play`에서 원본 외부 클라이언트 스크립트를 CSP로 차단하고 inline 패치본만 실행되도록 게이트를 추가합니다.
`v0.7.8`부터는 Tampermonkey 샌드박스 단계에서 CSP 게이트를 먼저 설치해 원본 `/client.js` 선실행 레이스를 더 줄입니다.
`v0.7.9`부터는 `@inject-into page`로 페이지 컨텍스트에서 바로 실행해 샌드박스 주입 지연을 줄입니다.

적용 확인:

- 화면 오른쪽 아래의 `KR 번역` 배지를 클릭합니다.
- 언어팩 요청을 가로챘으면 상태가 `적용됨`으로 표시됩니다.
- 언어팩 요청이 없더라도 화면 텍스트 치환이 일어나면 배지가 `DOM 적용됨`으로 표시되고, 패널의 `DOM` 숫자가 증가합니다.

이벤트 일정:

- Obelisk: KST 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 시작
- Gloomfury: KST 01:00, 04:00, 07:00, 10:00, 13:00, 16:00, 19:00, 22:00 시작
- 각 이벤트는 1시간 지속되며, Gloomfury 다음 1시간은 휴식 시간으로 표시합니다.
- 알림은 기본으로 10분/5분/1분 전에 패널 상태에 표시됩니다. 브라우저/소리 알림은 콘솔 명령으로 제어할 수 있습니다.

UI 조정:

- 패널 머리글을 드래그하면 위치가 저장됩니다.
- 패널 오른쪽 아래 크기 조절 핸들로 크기를 조정할 수 있습니다.
- 위치와 크기는 콘솔의 `HordesKrMod.resetUi()`로 기본값으로 되돌릴 수 있습니다.

## 제어

브라우저 콘솔에서 다음 명령을 사용할 수 있습니다.

```js
HordesKrMod.disable()
HordesKrMod.enable()
HordesKrMod.clearCache()
HordesKrMod.disableScriptGate()
HordesKrMod.enableScriptGate()
HordesKrMod.testRequest()
HordesKrMod.status()
HordesKrMod.eventStatus()
HordesKrMod.toggleEventAlarms()
HordesKrMod.toggleEventSound()
HordesKrMod.resetUi()
HordesKrMod.addHighlightName("닉네임")
HordesKrMod.removeHighlightName("닉네임")
HordesKrMod.clearHighlightNames()
HordesKrMod.highlightNames()
HordesKrMod.toggleNameHighlight()
HordesKrMod.toggleCanvasNameHighlight()
HordesKrMod.toggleRuntimeNameOverlay()
HordesKrMod.highlightStatus()
HordesKrMod.scriptHookStatus()
HordesKrMod.runtimeOverlayStatus()
HordesKrMod.inspectRuntime("닉네임")
HordesKrMod.findNameplateCandidates("닉네임")
HordesKrMod.captureSelectedNameStyle("닉네임", 4000)
HordesKrMod.nameplateStyleStatus()
HordesKrMod.clearCapturedNameplateStyle()
```

비활성화 후에는 페이지를 새로고침해야 게임 기본 언어 요청으로 돌아갑니다.

닉네임 강조는 채팅/파티/클랜/목록처럼 DOM 텍스트로 보이는 영역, 2D 캔버스의 `fillText`/`strokeText` 이름표, WebGL 런타임 좌표 기반 오버레이에 적용됩니다. 클릭한 이름표 스타일을 재사용하려면 대상 캐릭터를 클릭해 둔 상태로 `await HordesKrMod.captureSelectedNameStyle("닉네임", 4000)`을 실행합니다. `sampleCount`가 0이면 WebGL 경로이므로 새로고침 후 `HordesKrMod.scriptHookStatus()`와 `HordesKrMod.runtimeOverlayStatus()`를 확인하세요.

## 다음 작업

- 아이템명/스킬명 한국어화 여부 결정
- 실제 게임 화면에서 긴 문구가 UI 영역 밖으로 넘치는지 확인
- 알림 기준 시간이 게임 업데이트와 달라질 경우 일정 기준값 조정
