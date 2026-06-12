<?php
require_once __DIR__ . '/config.php';

function ts_db() {
    static $conn = null;
    if ($conn !== null) return $conn;
    $conn = @new mysqli(TS_DB_HOST, TS_DB_USER, TS_DB_PASS, TS_DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        die(json_encode(array('ok' => false, 'error' => 'db_connect_failed')));
    }
    $conn->set_charset('utf8mb4');
    ts_ensure_schema($conn);
    return $conn;
}

function ts_ensure_schema($conn) {
    // 멤버 1명당 1행. payload 는 클라가 만든 상태 JSON(직업/스킬쿨/charm)을 그대로 보관.
    // 이름은 hordes 전역 유일 → (room,name) PK. 데이터는 휘발성(수 초 수명).
    $conn->query(
        "CREATE TABLE IF NOT EXISTS teamsync_members (
            room       VARCHAR(48)  NOT NULL,
            name       VARCHAR(64)  NOT NULL,
            klass      TINYINT      NOT NULL DEFAULT -1,
            faction    TINYINT      NOT NULL DEFAULT -1,
            payload    TEXT         NOT NULL,
            updated_at DATETIME     NOT NULL,
            PRIMARY KEY (room, name),
            KEY idx_room_updated (room, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}
