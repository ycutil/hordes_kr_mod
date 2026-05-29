# makegame — hordes.io 학습용 클론

[hordes.io](https://hordes.io)의 구조를 **학습 목적**으로 재현한 미니 MMO입니다.
실제 게임처럼 **권위 서버(authoritative server) + WebSocket + 브라우저 클라이언트**
구조를 따르며, 프로토콜·엔티티 모델·클래스/진영·아이템 모델은 실제 게임에서
**실측**한 데이터에 기반합니다. (실측 과정: [PROTOCOL.md](PROTOCOL.md))

> ⚠️ 개인 학습용입니다. 실제 게임의 에셋/아트/코드는 복제하지 않았고,
> **모든 에셋은 자체 생성**(절차적 스프라이트·3D 메시·합성 SFX·자작 SVG)입니다.

---

## 실행

```bash
cd makegame
node server/server.js        # http+ws 서버 (기본 :8787)
# 브라우저에서 http://localhost:8787 → 이름/클래스/진영 선택 → 월드 입장
```

의존성은 저장소 루트의 `ws` 하나뿐(추가 설치 불필요). 포트: `PORT=9000 node server/server.js`.
3D는 `client/vendor/three.module.js`(로컬 벤더링, r160)로 동작 — 오프라인 가능.

## 조작

| 키 | 동작 |
|----|------|
| WASD / 방향키 | 이동 |
| 마우스 | 캐릭터가 커서 방향을 바라봄 (3D는 레이캐스트 조준) |
| 클릭 / Tab | 대상 지정 |
| 1~5 | 스킬 시전 |
| I / C | 캐릭터·가방 창 |
| V | 3D ↔ 2D 뷰 전환 |
| Esc | 창 닫기 / 대상 해제 |

---

## 구현 기능 (페이즈별)

**코어** — 권위 서버 20Hz 틱, 클라 입력(intent)만 전송 → `serverEntityDelta` 브로드캐스트,
클라 예측(self)+보간(others), 4클래스 스킬(즉시·시전·투사체·AoE·DoT/HoT·대시·돌진·버프·디버프·힐, 쿨/마나/사거리/GCD),
전투(치명타·방어경감·흡수막), 몹 AI(배회→어그로→추격→공격→리쉬→리스폰), 경험치/레벨업, HP/MP 재생.

**A. 에셋(원본)** — `client/js/assets.js`: 절차적 캐릭터/몹 스프라이트, 지형 타일, 스킬 아이콘,
WebAudio 합성 SFX(shoot/cast/hit/crit/heal/death/levelup) + 자작 SVG(로고/진영 문장).

**B. 라이브 패킷 실측** — `tools/capture-hordes.js`로 실제 hordes WebSocket 프레임 캡처.
opcode 매핑 확정(7=serverEntityDelta, 16=ping, 0=clientPlayerInput …), 엔티티 필드셋 일치 확인. → [PROTOCOL.md](PROTOCOL.md)

**C. 아이템/장비** — `server/data/items.js`: 실측 스탯 모델(base/bonus, 품질%→옵션수, 스탯 인덱스 0–19),
부위별 생성·롤, 장비 슬롯 7종, 스탯 집계→전투 반영, 몹 드랍, 캐릭터·가방 UI(I), 시작 무기 지급.

**D. 존/전환** — `server/data/zones.js`: 다중 존(Greenfields/Darkwood), `WorldManager`가 멀티월드 관리,
포털로 `serverChangeWorld` 전환, 존별 스폰테이블, 글로벌 엔티티/아이템 ID.

**E. 3D 렌더링** — `client/js/render3d.js`(Three.js): 퍼스펙티브 카메라 추적, 엔티티 메시(클래스/진영 색·조준),
3D 지형/프롭(나무·바위·물·포털), 나메플레이트+HP 스프라이트, 레이캐스트 조준. 2D 캔버스 렌더러는 V로 폴백.

## 범위/한계 (학습 슬라이스)

- 서버 로직은 관찰 기반 **재구현/근사**(실제 서버 코드 비공개) — 밸런스·정확한 공식은 다름
- 엔티티 델타: 실제는 **가변/이벤트성 바이너리**, 이 클론은 고정 20Hz JSON (PROTOCOL.md 참조)
- 계정/DB/영속성/파티/PvP전쟁/채팅서버/안티치트 미구현, 단일 프로세스 인메모리

## 검증 (헤드리스 + 실브라우저 CDP)

```bash
node server/server.js &
node smoke-test.js          # 전투+아이템: 데미지/킬, 장비 착용→스탯변화 (SMOKE TEST PASS)
node zone-test.js           # 포털 걸어가 starter→forest 전환 (ZONE TEST PASS)
node cdp-client-check.js    # 브라우저(:9222) 임시탭 로드/접속/무에러 (CLIENT CHECK PASS)
OPEN_INV=1 node cdp-screenshot.js out.png   # 스크린샷(인벤토리)
node tools/capture-hordes.js 8              # 실제 hordes 패킷 캡처(인게임 탭)
```

## 파일 맵

```
shared/      protocol.js  constants.js
server/      server.js  WorldManager.js  World.js  Entity.js  Combat.js
             data/ classes.js  skills.js  mobs.js  items.js  zones.js
client/      index.html  css/style.css  vendor/three.module.js
             assets/ logo.svg  crest-blue.svg  crest-red.svg
             js/ game.js  net.js  input.js  render.js(2D)  render3d.js(3D)
                 ui.js  inventory.js  assets.js  state.js
PROTOCOL.md  smoke-test.js  zone-test.js  cdp-client-check.js  cdp-screenshot.js
tools/capture-hordes.js
```

## 다음 단계

- 라이브 바이너리 델타 완전 디코드(필드 비트마스크) → 필드 1:1 매칭
- 파티/PvP, 채팅, 영속성(DB), 추가 존, 바이너리 프로토콜 전환, 보간 버퍼 고도화
