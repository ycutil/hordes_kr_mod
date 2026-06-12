<?php
// teamsync - 팀파이트 멤버 상태 공유 (yerp.cafe24.com 온호스트 PHP + MySQL)
// trackingBL 과 같은 DB/계정, teamsync_ 프리픽스 테이블.
define('TS_DB_HOST', 'localhost');
define('TS_DB_USER', 'yerp');
define('TS_DB_PASS', 'Rhffla00!@');
define('TS_DB_NAME', 'yerp');

// KR 모드 클라이언트와 동일해야 하는 공유 시크릿(길드원에게 배포).
define('TS_TOKEN', 'b7f3a91c4e2d6580a1c9f0e3d4b5a6c7');

// 이 초보다 오래 보고 없으면 offline(목록에서 제외 또는 회색).
define('TS_OFFLINE_SEC', 12);
// 응답에 포함할 멤버 last_seen 윈도(초).
define('TS_LIST_WINDOW_SEC', 12);
