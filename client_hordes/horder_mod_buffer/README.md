# Horder Mod Buffer

Hordes.io 보조(버퍼) 계정용 Tampermonkey 스크립트입니다. 수동 1버튼 버프 + **웹 패널로 제어되는 자율(뉴비 위장) 행동**을 합니다.

## 1. 수동 버프 (기존 기능)

- 화면 오른쪽 아래 `Buffer` 패널.
- `1` 키 / `Guardstone` 버튼 → Guardstone 경로, `2` 키 / `Headless` 버튼 → Headless Landing 경로.
- 실행 순서: 주변 `Conjurer` 상호작용 → `Faivel` 이동 → 4번(옵션)·5번 스킬바 사용 → 다시 Conjurer → 목적지(Guardstone/Headless) 이동.

## 2. 자율 행동 (신규, v0.3)

뉴비처럼 보이도록 평소엔 마을 주변을 배회하고, 신호/시간에 따라 버프를 수행합니다.

| 상황 | 동작 |
| --- | --- |
| 평소(자율 ON) | 마을 anchor 반경 안에서 가벼운 배회(랜덤 WASD·점프·멈춤) |
| 웹 패널 `버프` 명령 | (필요시) 마을 리콜 → Conjurer 접근 → 버프 경로 1회 실행 |
| 웹 패널 `귀환` 명령 | 마을 리콜 후 Conjurer 앞 대기 |
| 웹 패널 `정지` 명령 | 자율 행동 중지(폴링은 유지) |
| obelisk 시간(KST 3·6·9·12시, 매시 0~20분) | Conjurer 앞 대기 + 4분마다 버프 경로 자동 실행 |

- **계정 식별**: 인게임 캐릭터명을 자동 감지해 패널에 자동 등록(계정 추가 시 설정 불필요).
- **통신**: `https://kbr1.cafe24.com/hordes_panel` 와 6초 주기 폴링(heartbeat + 명령 수신). HTTPS라 mixed-content 문제 없음.
- 명령(버프/귀환/정지)은 **자율 토글과 무관하게** 항상 실행됩니다. 배회/오벨 자동 버프만 토글로 켜집니다.

### 설정 (Buffer 패널)

- `AI 자동(배회/오벨)` 체크: 자율 배회 + 오벨 자동버프 on/off (기본 off).
- `리콜 슬롯`: **기본값 3** (각 봇 스킬바 3번에 마을 리콜 바인드 기준). 슬롯의 스킬을 그대로 시전해 마을 귀환. 0으로 두면 공용 리콜 스킬(id 40)을 직접 자동 시전(바인드 불필요 폴백). 다른 슬롯에 넣었으면 그 번호로 변경.
- 상태줄에 현재 모드/계정/패널연결 표시.

### 콘솔 API

```js
HorderModBuffer.aiStatus()           // 현재 자율 상태
HorderModBuffer.setAi(true)          // 자율 on/off
HorderModBuffer.setRecallSlot(8)     // 마을 리콜 스킬 슬롯 지정
HorderModBuffer.setFinalDest("Headless Landing")  // 버프 후 이동 목적지(기본 Guardstone)
HorderModBuffer.setPanelToken("...") // 공개배포 시 토큰을 localStorage로 비공개 지정
HorderModBuffer.status()             // 런타임/버퍼 상태
HorderModBuffer.diagnose()           // 진단
```

## 설치

현재 플레이하는 Brave 프로필에서 아래 URL을 열어 Tampermonkey에 설치합니다.

- https://raw.githubusercontent.com/ycutil/hordes_kr_mod/main/client_hordes/horder_mod_buffer/horder-mod-buffer.user.js

설치 후 `https://hordes.io/play`를 완전 새로고침합니다. (배포 반영하려면 GitHub repo에 push 필요)

## 튜닝 포인트 (스크립트 상단 상수)

- `OBELISK_HOURS_KST`, `OBELISK_WINDOW_END_MIN`, `OBELISK_REBUFF_MS`: 오벨 시간/창/재버프 주기.
- `WANDER_RADIUS`, `NEAR_CONJURER_DIST`, `MOVE_PULSE_MS`: 배회 반경·접근 거리·이동 펄스.
- `RECALL_FAR_DIST`, `RECALL_WAIT_MS`: 리콜 발동 거리·캐스트 대기.
- `PANEL_BASE_URL`, `PANEL_TOKEN`: 패널 주소·토큰(공개배포 시 `setPanelToken`으로 덮어쓰기 권장).

## 주의 / 한계

- 이동은 **합성 WASD + 실시간 좌표 피드백**(좌표 패킷 조작 아님, 안티치트 안전). CDP 라이브 검증 완료(W 홀드→전진, keyup→정지). 카메라 방향을 모르므로 NPC 복귀는 그리디 보정이라 지형/장거리에선 느리거나 막힐 수 있음.
- 마을 귀환은 **공용 리콜 스킬(id 40) 자동 시전**(5초 캐스트). 오벨 버프 경로가 Guardstone/Headless로 텔포하므로 재버프 시 자동 리콜로 마을 복귀함.
- 인게임 동작(이동·NPC 접근·오벨 의미)은 실측 후 상단 상수로 튜닝하세요.
- 버퍼 계정에서는 KR 모드를 끄고 Buffer만 켜야 합니다.

## 진단

```js
HorderModBuffer.status()
HorderModBuffer.diagnose()
HorderModBuffer.aiStatus()
```
