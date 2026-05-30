# Hordes.io 아이템 최적 옵션·세팅 분석 리포트

> 캐릭터 **Aharu** (Lv45 Archer, faction 0, 클랜 #KR, 명성랭크 3) 기준
> 분석일: 2026-05-24 · 데이터 출처: 실행 중인 클라이언트 런타임(CDP) + `client.js` 디컴파일 + 공식 위키

---

## 0. 조사 방법 (어떻게 얻었나)

| 소스 | 방법 | 얻은 것 |
| --- | --- | --- |
| 실행 중 게임 런타임 | CDP(Brave :9222) → `window.__HORDES_KR_RUNTIME__.player.inventory` | 내 캐릭터/장비/인벤토리 원시 객체 |
| `https://hordes.io/client.js?v=8845418` | 다운로드(682KB) 후 minified 코드 분석 | 스탯 생성/품질/업그레이드/기어스코어 로직 |
| `https://hordes.io/data/loc/en.json` | 다운로드 후 파싱 | 스탯 인덱스→이름 매핑 |
| `hordesio.miraheze.org` 위키 | Firecrawl 스크래핑 | 스탯 효과, 품질→옵션 개수 규칙, Archer 빌드 |

재현용 도구는 같은 폴더에 보관: `cdp-eval.js`(CDP 평가기), `extract-gear.js`(장비 추출), `gear-data.json`(원시 결과), `client.js`/`en.json`(원본).

---

## 1. 게임의 아이템 옵션 시스템 (내부 구조 기준)

런타임에서 본 아이템 1개의 실제 구조 (장착한 활):

```
item = {
  type:"bow", tier:7, upgrade:6, quality:109, gs:218, dbid, bound,
  logic: { level:41, class:2(Archer), id:24, stats:Map{ statId -> {min,max} } },  // 아이템 템플릿(고정)
  stats: Map{ statId -> {type:"base"|"bonus", qual, value} },                      // 실제 적용 스탯
  rolls:[109,12,109,36,...] (20개), currentRoll:9                                  // 생성 시 소비된 난수
}
```

핵심 사실 3가지:

1. **base 스탯 = 아이템 종류 고유**(무기는 Min/Max Dmg + Attack Spd, 방어구는 HP/Defense 등). 바꿀 수 없음.
2. **bonus 스탯 = "옵션". 드랍 시점에 종류·수치가 무작위로 확정**된다. `client.js`의 `setRolls()`/`nextRoll()`이 미리 뽑아둔 난수배열(`rolls`)을 순서대로 소비해 옵션을 만든다. **게임 안에 옵션 리롤 기능은 없다** → 더 좋은 옵션을 원하면 *더 좋은 아이템을 새로 구해야* 한다.
3. **옵션 개수는 quality(품질%)가 결정**한다 (위키 + 코드 일치):

| 등급 | 품질 roll | 추가(bonus) 옵션 수 |
| --- | --- | --- |
| Common | 0–26% | 0 |
| Common | 27–50% | 1 |
| Uncommon | 50–55% | 1 |
| Uncommon | 56–69% | 2 |
| Rare | 70–78% | 2 |
| Rare | 79–89% | 3 |
| Epic | 90–98% | 3 |
| **Epic** | **99–110%** | **4 (최대)** |

> **upgrade(+N)** 는 룬으로 올리며 품질·스탯 수치를 비례 상승시킨다(`(1+level*(1+upgrade))^(1.2+upgrade*0.2)` 형태). 즉 같은 옵션이라도 +업글이 높을수록 수치가 커진다. **옵션 종류는 안 바뀐다.**

### 스탯 인덱스 → 이름 (en.json `ui.stats.array`)

`0 Str · 1 Sta · 2 Dex · 3 Int · 4 Wis · 5 Luck · 6 HP · 7 MP · 8 HPreg · 9 MPreg · 10 MinDmg · 11 MaxDmg · 12 Defense · 13 Block · 14 Critical · 15 MoveSpd · 16 Haste · 17 AtkSpd · 18 ItemFind · 19 BagSlots …`

---

## 2. Archer(궁수) 스탯 우선순위 — 무엇이 "좋은 옵션"인가

위키 메커니즘 + 커뮤니티 합의 기준. (Archer 블러드라인: **Dexterity 1당 Min/Max Dmg +0.4**, Dex 1당 Critical +0.05%)

| 등급 | 스탯 | 이유 |
| --- | --- | --- |
| **S (핵심 DPS)** | **Dexterity, Critical, Haste** | Dex=주 피해+크리, Critical=피해 2배 확률, Haste=쿨/시전/평타 속도(딜 사이클 전체) |
| **A (DPS 보조)** | Max Dmg., Min Dmg., Attack Spd. | 직접 피해. 무기 base에 이미 붙음 |
| **B (생존/PvP)** | HP, Stamina, Defense, Block | PvP·옵셀리스크·Gloomfury 생존용. 순수 PvE 딜에는 비효율 |
| **D (딜에 낭비)** | Item Find, MP/MPreg, Move Spd, Bag Slots, Str/Int/Wis/Luck | Archer DPS에 직접 기여 0 (Item Find는 파밍 전용) |

**이상적인 장비 1칸 옵션 = Dexterity + Critical + Haste (+ Max Dmg)** 조합.

---

## 3. 내 장비 옵션 진단 (착용 11칸)

DPS 점수 = bonus 옵션을 S=2 / A=1.5 / B=0.5 / D=0 으로 합산 (만점 = 옵션수×2).

| 슬롯 | 부위 | t/up/q | bonus 옵션 (등급) | 점수 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 105 | boot | t5 +7 q101 | Crit[S] Haste[S] Dex[S] MaxDmg[A] | **7.5/8** | ★ 최상. 유지 |
| 103 | armor | t4 +6 q105 | Haste[S] Crit[S] **Block[B]** Dex[S] | 6.5/8 | 우수(Block만 생존옵) |
| 102 | armlet | t5 +6 q93 | Crit[S] Haste[S] Dex[S] | **6.0/6** | ★ 완벽(3옵 전부 S) |
| 104 | bag | t0 +7 q79 | Crit[S] Haste[S] Dex[S] | **6.0/6** | ★ 완벽 |
| 108 | amulet | t2 +7 q80 | Dex[S] Crit[S] Haste[S] | **6.0/6** | ★ 완벽 (단 tier 낮음↓) |
| 109 | quiver | t4 +7 q110 | **Defense[B]** MaxDmg[A] Haste[S] Dex[S] | 6.0/8 | 양호(Defense만 생존옵) |
| 107 | ring | t4 +7 q83 | Dex[S] MaxDmg[A] Haste[S] | 5.5/6 | 우수 (tier 낮음↓) |
| 106 | glove | t5 +7 q105 | Haste[S] Dex[S] **ItemFind[D]** MaxDmg[A] | 5.5/8 | ItemFind 1칸 낭비 |
| 101 | **bow(무기)** | t7 +6 q109 | Dex[S] **HP[B]** **ItemFind[D]** Crit[S] | **4.5/8** | ⚠ 4옵 중 2개 비효율 |
| 110 | charm | t11 +0 q90 | (옵션 없음) | – | charm은 고정효과 |
| 111 | charm | t2 +0 q90 | (옵션 없음) | – | charm은 고정효과 |

### 결론 요약

- **완벽/최상 (그대로 유지)**: boot, armlet, bag, armor, amulet, quiver, ring — 7칸은 이미 거의 이상적.
- **개선 1순위 — 활(bow, slot 101)**: 가장 중요한 무기인데 4옵션 중 **Item Find(딜 무기여)·HP** 2개가 비효율. 이상적인 활은 `Dex + Crit + Haste + Max Dmg`. q109 에픽 4옵이라 교체 난도는 높지만, **딜 상승폭이 가장 큰 부위**. → t7 이상, q99%+ 에픽 활 중 옵션이 Dex/Crit/Haste/MaxDmg로 뜬 것을 노릴 것.
- **개선 2순위 — 장갑(glove, slot 106)**: Item Find 1칸을 Crit 또는 Dex로 바꾼 q99%+ 장갑으로 교체.
- **티어 업그레이드 후보**: amulet(t2), ring(t4), armor(t4), quiver(t4)는 옵션은 좋지만 **tier가 낮아 base 스탯·기어스코어가 작다**. Lv45에 맞는 더 높은 tier 동일-옵션 아이템으로 갈아타면 base 수치(HP/Defense/Dmg)가 크게 오른다. (옵션이 이미 S급이라 우선순위는 무기보다 뒤.)
- **생존 옵션(armor의 Block, quiver의 Defense, bow의 HP)**: PvP/옵셀리스크/Gloomfury 위주라면 **그대로 두는 게 낫다**. 순수 PvE 딜 극대화만 본다면 약점.

---

## 4. 세팅(스탯 포인트 · 스킬)

### 스탯 포인트 (Lv45 = 총 135 포인트)
- Archer 딜 빌드 정석 = **전부 Dexterity**. (Dex 1당 Min/Max Dmg +0.4 + Critical +0.05% → 딜·크리 동시 상승)
- PvP 생존이 필요하면 일부 Stamina(1당 HP+4, Defense+1) 분배. PvE 극딜이면 순수 Dex.

### 현재 스킬 구성 (런타임에서 추출한 active skill bar)
스킬 슬롯에 올라간 ID와 레벨: `id9 Lv5 · id10 Lv5 · id11 Lv5 · id25 Lv4 · id26 Lv4 · id29 Lv1 · id31 Lv5 · id38 Lv1 · id39 Lv1`
(※ 런타임 `skillDefinitions`가 비어 있어 ID→이름 자동 매핑은 불가. Archer 핵심 딜 스킬군은 Swift Shot / Precise Shot / Volley / Bone Shot / Serpent Arrows / Poison Arrows, 버프는 Invigorate·Temporal Dilation·Cranial Punctures(크리 패시브)·Pathfinding 임.)

권장: **Cranial Punctures(크리 패시브), Serpent Arrows·Poison Arrows(Precise Shot 강화 패시브)** 를 최대 레벨로 유지하고, 단일 보스(Gloomfury)엔 Bone Shot, 다수엔 Volley 중심.

---

## 5. 한 줄 액션 아이템

1. **활(bow) 교체가 최우선** — `Dex/Crit/Haste/MaxDmg` 4옵 q99%+ 에픽 활을 구하면 단일 딜 최대 상승.
2. **장갑(glove)** 의 Item Find 옵션을 Crit/Dex 옵션 장갑으로 교체.
3. amulet/ring/armor/quiver 는 **옵션은 완성형** → 여유될 때 같은 옵션의 더 높은 tier로 base 수치만 끌어올리기.
4. 스탯 포인트는 **순수 Dexterity** (PvP 비중 크면 Stamina 약간).
5. boot·armlet·bag·amulet 는 이미 S급 — 손대지 말 것.
