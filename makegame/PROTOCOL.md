# hordes.io 프로토콜 실측 노트 (Phase B)

이 클론의 프로토콜은 실제 hordes.io를 **실측**해 맞춘 것입니다. 출처:
- `client.js` 정적 분석 (메시지 레지스트리 `Mt`, 엔티티 필드 할당)
- CDP 라이브 캡처 (`tools/capture-hordes.js` — `Network.webSocketFrame*`)

## 메시지 레지스트리 = opcode (실측 확정)

`client.js`의 `Mt` 객체 정의 순서가 곧 **바이너리 opcode 인덱스**임을 라이브 캡처로 확인.

| opcode | 이름 | 방향 | 라이브 관측 |
|---|---|---|---|
| 0 | clientPlayerInput | C→S | sent (이동/조준 시) |
| 1 | clientPlayerChangeTarget | C→S | |
| 2 | clientPlayerSkill | C→S | |
| 3 | clientPlayerEnvSkill | C→S | |
| 4 | clientPlayerInteract | C→S | |
| 5 | clientCommand | C→S | |
| 6 | serverOnClientConnect | S→C | 접속 시 1회 |
| **7** | **serverEntityDelta** | S→C | **최다 빈도** (유휴 ~3–6/s) |
| 8 | serverPartyUpdate | S→C | |
| 9 | serverWarUpdate | S→C | |
| 10 | serverPartyPositions | S→C | |
| 11 | serverChangeWorld | S→C | |
| 12 | serverMapUpdate | S→C | |
| 13 | serverChat | S→C | |
| 14 | serverSystemMessage | S→C | |
| 15 | serverQueue | S→C | |
| **16** | **ping** | C↔S | ~2초 주기 하트비트 |

검증: 8초 캡처에서 `recv {7:50, 16:4}`, `sent {0:1, 16:4}` → opcode 7=엔티티델타(고빈도), 16=ping(양방향), 0=입력(유휴라 드묾).

## 실측 페이로드 샘플 (hex)

```
ping (16)            : 1038                 # [opcode=0x10][payload 1B]  송신=수신 echo
serverEntityDelta(7) : 07 01 8e2b1300 0077d923 40320000 0200000000 b2774000   (23B)
                       └op┘└cnt┘└id u32 LE┘└── 변경 필드 값들 ──┘
                       id = 0x00132b8e = 1256334
clientPlayerInput(0) : 00 0389c984 45c86e07 447e0d83 45 000001fe              (18B)
                       └op┘└── float32 LE 조준/이동 벡터 추정 ──┘└입력 비트┘
```

엔티티 델타 프레이밍(추정): `[opcode 7][entity count u8][per-entity: id u32 LE + 변경필드 비트마스크 + 값들]`.
전체 비트마스크/필드 오프셋 완전 역설계는 후속 과제(캡처 도구가 준비됨 — 인게임에서 이동/전투하며 더 떠서 매칭).

## 엔티티 필드셋 (client.js 할당부 실측)

실제 디코드에서 엔티티에 쓰는 필드: `name, faction, level, party, target, pos, rot, speed, hp, mp, buffs, creatureId`
→ 이 클론의 `server/Entity.js` 모델과 일치(추가로 type/radius/size, `gear-data.json` 스냅샷 기반).

## 이 클론과의 매핑/차이

| 항목 | 실제 hordes | 이 클론 | 비고 |
|---|---|---|---|
| 인코딩 | 바이너리 (opcode+packData) | **JSON** `{t,...}` | 가독·디버그용. 의미 동일 |
| 메시지 종류 | 위 17종 | 동일 이름 사용(`shared/protocol.js`) | HELLO만 클론 자체 추가 |
| 엔티티 델타 | **가변/이벤트성**, 변경분만, 근접만 | 고정 20Hz, 근접 스냅샷 | 실측 차이 명시 |
| ping | 2바이트 하트비트 | `{t:"ping",time}` | |
| 좌표 | 3D (x,y,z) | 2D (x,z) | y(높이) 생략 |

## 재현

```bash
node tools/capture-hordes.js 8      # 브라우저 :9222의 hordes 탭(인게임)에서 프레임 캡처/요약
```
