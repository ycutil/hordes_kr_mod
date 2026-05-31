# Obelisk (전쟁/점령전) 연구 노트 — CDP+디옵 클라이언트

> 2026-05-31 KST 20:24 기준 **비활성**(전쟁 엔티티 없음). 점령/contributor 메커니즘은 **활성 윈도우에서만 라이브 관찰 가능**.

## 입장
- **⚠️ Lv.35+ 필수 (라이브 검증)**: Conjurer 텔포 선택지 "Teleport to Faivel. **(Lv. 35+)**". War Conjurer가 Faivel에 있으므로 **Lv35 미만은 오벨 입구(Faivel)에 도달 불가**. 테스트 캐릭 Lv32로 Faivel 클릭 시 위치 변화 없음(거부). → 봇은 Lv35까지 렙업 후 오벨 참여 가능. 유저스크립트에 `OBELISK_MIN_LEVEL=35` 가드 추가.
- 리콜(skill 40)은 **현재 바인딩된 마을 Conjurer 옆**으로 복귀(테스트: Crocodile Beach(1625,4091)→ Headless계열 Conjurer(1713,3597)). 일반 Conjurer 대화 = Guardstone(Lv1+)·Faivel(Lv35+) 텔포 + 파티/EXP레이트 표시.
- **War Conjurer**(Faivel ≈ 4244,4176)의 대화 → 오벨리스크 포트로 입장. 클라이언트 이펙트 `conjurer_obeliskport`(Dk) 존재. (대화 선택지 텍스트는 Lv35+ 캐릭으로 실측 필요)
- 입장 시 **queue** 가능: `serverQueue` 패킷 → "Queue Position: N" 상태 표시(state machine).
- 텔포 클릭은 일반 Conjurer와 동일하게 대화창 `.btn` 풀 포인터시퀀스 필요(기존 `openConjurer` 인프라 재사용 가능).

## 목표·점령
- 핵심 목표 = **오벨리스크 점령**. 점령 시 메시지(id 49): `Obelisk: Captured obelisk for $fm{fame} and $m{money}` → **fame + 골드 보상**.
- 점령 진행은 `serverWarUpdate` 패킷의 **`contributors[]`**(점령 기여 플레이어 목록)로 관리. 디옵: `n.contributors=[]; for(...)` + 스토어 `Yi.update(...)`. 빈 contributors 업데이트는 이전 값 유지.
- **obeliskbuff**(스킬 버프 아이콘) = 오벨 점령/보유 시 받는 버프 추정.
- 점령 서클 반경 등은 미관찰(대부분의 `circleRadius`는 스킬 AoE라 무관).

## 스케줄
- **클라이언트에 스케줄 없음**(서버 구동). 다음 윈도우 시각을 클라에서 못 읽음. 사용자 제공: KST 3·6·9·12(추정, ~3h 간격). 활성 여부는 `serverWarUpdate` 수신/전쟁월드 진입으로 판단해야 함.

## 봇 운영 설계(스캐폴드 — 라이브 검증 대기)
1. **윈도우 스케줄러**: KST 지정 시각대에만 입장 시도(밖에선 no-op, 렙업 방해 X).
2. **입장**: 리콜→Faivel→War Conjurer 대화→오벨 포트(기존 텔포 인프라 재사용).
3. **전쟁 중**: 친군집(같은 faction type-0 = AI봇 zerg) centroid 추종 → 목표지 도달, **적진영(type-0 faction≠나) + 몹**을 가장 가까운 순으로 전투(기존 farmStep 일반화). 점령 서클 안 체류로 contributors 기여.
4. **검증 필요(윈도우에서)**: 전쟁월드 진입 신호, 오벨 엔티티/서클 좌표, contributors 반영, 입장 queue 동작, 사망/리스폰 처리.

관련: [[hordes-leveling-party-system]], [[hordes-mob-entity-types]], [[hordes-skill-cast-gcd-mechanics]].
