# Hordes.io 마을 지도 (CDP 라이브 측량)

단일 맵(`world="main"`). 좌표 = `[x, y(height), z]`. 거리/위치 판단은 **x·z 평면** 사용.
NPC/오브젝트는 `static=true` 엔티티. 타입맵: `2=Conjurer, 4=Merchant, 5=Stash, 6=Blacksmith, 7=TrainingDummy, 8=Trader, 9=Sage, 12=Priest`.

## 이동 그래프 (Conjurer 텔레포트)

```
Guardstone(메인) ──┬── Faivel (Lv.35+)
                   └── Headless Landing (Lv.25+)
Faivel ────────────┬── Guardstone (Lv.1+)
                   └── Headless Landing (Lv.25+)        (+ War Conjurer 별도)
Headless Landing ──┬── Guardstone (Lv.1+)
                   └── Faivel (Lv.35+)
```
텔레포트는 매번 **목적지 Conjurer 바로 옆**에 착지. 리콜(스킬 id 40 / 슬롯3)은 **현재 마을 Conjurer 옆**으로 복귀(검증됨).

---

## 1. Guardstone (메인 타운) — 중심 ≈ (3210, 1234)
Conjurer 텔포: → Headless Landing, Faivel

| 역할 | 이름 | 좌표(x,z) | Lv |
|---|---|---|---|
| Conjurer | Conjurer | 3208, 1235 | 99 |
| Merchant | Merchant | 3218, 1261 | 99 |
| Blacksmith | Blacksmith | 3199, 1226 | 99 |
| Stash(창고) | Stash | 3209, 1258 | 99 |
| Sage | Sage | 3212, 1250 | 99 |
| Priest | Priest | 3180, 1235 | 1 |
| Trader | General Trader | 3242, 1235 | 99 |
| Trader | Warrior Trader | 3237, 1245 | 99 |
| Trader | Archer Trader | 3235, 1247 | 99 |
| Trader | Mage Trader | 3239, 1243 | 99 |
| Trader | Shaman Trader | 3240, 1240 | 99 |
| Trader | Charm Trader | 3258, 1245 | 99 |
| Trader | Pet Trader | 3267, 1234 | 99 |
| Trader | Mount Trader | 3266, 1229 | 99 |
| 훈련목 | Training Dummy ×6 | 3233~3250, 1256~1271 | 15 |

**건물/구역 추론**: 서편 (3199~3218) = 상점가(Blacksmith/Merchant/Stash/Conjurer/Sage/Priest). 동편 (3235~3267) = 트레이더 거리(클래스·특수 트레이더). 남동 (3233~3250, 1256~1271) = 훈련장(더미). **충돌 벽 확인**: x≈3227~3228 부근에 배리어(트레이더 거리↔중앙광장 분리) — 걸어서 통과 불가, 우회 필요.

## 2. Faivel — 중심 ≈ (4257, 4197)
Conjurer 텔포: → Guardstone, Headless Landing. **War Conjurer 별도 존재**(전쟁/오벨 존 추정).

| 역할 | 이름 | 좌표(x,z) | Lv |
|---|---|---|---|
| Conjurer | Conjurer | 4259, 4199 | 99 |
| Conjurer | War Conjurer | 4244, 4176 | 99 |
| Trader | General Trader | 4236, 4190 | 99 |
| Stash | Stash | 4234, 4188 | 99 |
| Sage | Sage | 4263, 4191 | 99 |
| Priest | Priest | 4269, 4207 | 31 |
| 훈련목 | Training Dummy ×3 | 4222~4228, 4172~4176 | 35 |

**건물/구역 추론**: 중앙(4234~4263) = 편의시설(Conjurer/Trader/Stash/Sage/Priest). 북서(4222~4244) = 훈련장 + War Conjurer(전쟁 출정).

## 3. Headless Landing — 중심 ≈ (1996, 3629)
Conjurer 텔포: → Guardstone, Faivel. 소형 전초기지(상점/대장장이/클래스트레이더 없음).

| 역할 | 이름 | 좌표(x,z) | Lv |
|---|---|---|---|
| Conjurer | Conjurer | 1998, 3630 | 99 |
| Trader | General Trader | 1985, 3635 | 99 |
| Stash | Stash | 2009, 3625 | 99 |
| Priest | Priest | 2010, 3602 | 21 |

---

## 건물·오브젝트 (chunk props에서 추출)

맵 지오메트리는 chunk `props`(정적 배치물)로 저장됨: `id`=모델종류, 월드좌표=`chunk.origin+prop.pos`, `scale/rot/matrix` 포함. **희귀 모델(마을당 1~2회 배치)=건물/구조물**, 다회 반복=장식(나무/울타리/바닥). 마을당 props: Guardstone 79개, Faivel 61개, Headless 92개. 전체 좌표는 `*_props.json`, 라벨링 결과는 `towns.json`의 `buildingCandidates`.

**건물 모델 타입(교차마을 식별)**:
- `#1497` = Conjurer 관 (Faivel·Headless의 Conjurer 옆 4~5유닛)
- `#1499` = 상점 건물 (Merchant/Trader 옆 ~4~9유닛)
- `#1601` = 대장간/창고 (Guardstone: Blacksmith 1.0유닛, Stash 4.5유닛)
- `#1504`(scale 3.1) = Faivel 대형 구조물, `#1483/1538/1539/1548/1603/1608` = Guardstone 외곽 구조물
- 상세 좌표·최근접 NPC 매핑은 `towns.json` 참조.

**건물 위치 = 최근접 NPC로 라벨**: 예) Guardstone 대장간(3198,1226)=Blacksmith, 창고건물(3213,1260)=Stash, 상점(3227,1262)=Merchant. Faivel Conjurer관(4263,4196), 창고(4231,4189)=Stash. Headless Conjurer관(1998,3626), 상점(1986,3631)=General Trader.

## 문턱(threshold)/실내 — 캡처 확정 ✅
- **실내 감지 = `player.interiorlightTarget`(vec4)**: 실외 `[0,0,0,0]`, 건물 진입 시 0→비0으로 **램프업**(4번째 성분=실내 블렌드, 완전 실내=1.0). 라이브 검증 완료 — 마을에 **실제 출입 가능한 건물 내부 + 문턱이 존재**.
- **검증 예 (Guardstone Blacksmith 건물 #1601 @3198,1226)**:
  - 바깥 [3205,1232] `[0,0,0,0]` → 문턱 [3204,1230] `[0.07,0.1,0.14,0]` → 실내 [3204,1228] `[0.26,0.43,0.46,0.34]` → 깊은실내 [3200,1227] `[0.29,0.45,0.48,0.5]`.
  - **문턱(출입구) ≈ (3204, 1229)**, 실내 구역 ≈ x3198~3204 / z1226~1230.
- **활용**: 봇이 런타임에 `interiorlightTarget[3]>0`으로 "건물 안인지" 즉시 판단 가능 → "건물 들어가→둘러보기→나오기" 구경 동작에 사용 가능.
- **전체 스윕 한계**: 마을 보행이 건물 충돌로 제약(특히 Guardstone 동편 트레이더 거리 x≈3227 배리어)이라, 모든 건물 출입구를 일일이 통과 측량하려면 포그라운드 + 견고한 우회 네비가 필요. 방법·신호는 확립됨(위 예). NPC 좌표가 대부분 출입구/실내 근사치이므로 실용적 지도는 NPC+props로 충분.

## 운영 발견 (중요)
- **유휴 끊김**: 탭이 백그라운드(`document.hidden=true`)면 hordes가 "Browser is idle"로 **월드를 끊음**(엔티티 0, 엔진 정지) → 봇 정지. **해결**: Page Visibility를 visible로 스푸핑(`document.hidden→false` + `visibilitychange` 발생)하면 즉시 재연결("Loading World"→복구). **이걸 유저스크립트에 넣으면 백그라운드 봇이 안 끊김** (추천 추가).
- **이동**: 마을 보행은 건물 충돌로 직선 막힘. 리콜(스킬40/슬롯3)이 **현재 마을 Conjurer 옆 복귀**로 가장 확실. 텔포는 매번 목적지 Conjurer 옆 착지.
- 텔포 클릭: Conjurer 대화의 `div.btn`에 `pointerover→down→up→mouseup→click` full 시퀀스 필요(단순 click 무시됨).

## 데이터 파일
- `towns.json` — 통합(중심·NPC·건물후보·장식모델·이동목적지)
- `guardstone.json`·`faivel.json`·`headless.json` — NPC/Conjurer 원본
- `guardstone_props.json`·`faivel_props.json`·`headless_props.json` — 건물/오브젝트 props 전체 좌표
