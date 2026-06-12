# teamsync — 팀파이트 멤버 상태 공유

길드원끼리 **직업 · 주요 AoE/자버프 쿨다운 · candle charm 사용가능여부**를 실시간(폴링) 공유. 웹소켓/Redis 없이 cafe24 PHP + MySQL HTTP 폴링.

## 구성

- `web/config.php` — DB(yerp 온호스트) + 공유 토큰 + 윈도 상수.
- `web/db.php` — `teamsync_members` 테이블 자동 생성 (`(room,name)` PK, payload TEXT).
- `web/api.php` — `action=sync`(POST: 내 상태 UPSERT + 룸 전체 반환 = RTT 1번), `list`, `leave`.
- `deploy.sh` — curl FTP 업로드.

## 동작

KR 모드 클라이언트(`hordes-kr-mod.user.js`, `팀공유` 토글)가:
1. 내 상태를 로컬에서 읽음 — class, `me.skills.skills.get(id).cd` 기반 직업별 키스킬 쿨, candle(장비 착용 && 단축슬롯).
2. 전투 1.5초 / 평시 4초 간격으로 `action=sync` POST → 응답으로 같은 방 멤버 전체 수신.
3. 우측 HUD에 직업색·스킬 아이콘(쿨숫자/✓)·🕯로 표시.

## CORS 주의 (중요)

cafe24 nginx 가 **OPTIONS 프리플라이트를 403** 으로 막음. 그래서 클라는 `Content-Type: text/plain` (CORS 단순요청)으로 POST → 프리플라이트 회피. PHP는 `php://input` 원문을 json_decode 하므로 그대로 파싱됨. `application/json` 으로 보내면 "Failed to fetch" 발생.

## 호스트 메모

mysqlnd 없음 → `$stmt->get_result()` 사용 금지. SELECT는 `real_escape_string` + `$conn->query()`. yerp docroot = FTP 루트(`/`), 업로드 경로 `ftp://yerp.cafe24.com/teamsync/`.
