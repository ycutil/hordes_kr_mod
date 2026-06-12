<?php
// teamsync API — 하나의 sync 요청으로 내 상태 발행(UPSERT) + 룸 전체 수신.
// CORS: hordes.io 페이지 컨텍스트의 fetch(cross-origin) 허용.
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($arr) { echo json_encode($arr); exit; }
function clean_room($r) { $r = preg_replace('/[^A-Za-z0-9_\-]/', '', (string)$r); return substr($r, 0, 48); }

$action = isset($_GET['action']) ? $_GET['action'] : 'sync';
$token  = isset($_GET['token']) ? $_GET['token'] : (isset($_POST['token']) ? $_POST['token'] : '');
if (!hash_equals(TS_TOKEN, (string)$token)) { http_response_code(403); out(array('ok' => false, 'error' => 'bad_token')); }

$conn = ts_db();

if ($action === 'sync' || $action === 'push') {
    // body: {room,name,klass,faction,payload:{...}}  (JSON or form)
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) $body = $_POST;

    $room    = clean_room(isset($body['room']) ? $body['room'] : '');
    $name    = substr(trim((string)(isset($body['name']) ? $body['name'] : '')), 0, 64);
    $klass   = (int)(isset($body['klass']) ? $body['klass'] : -1);
    $faction = (int)(isset($body['faction']) ? $body['faction'] : -1);
    $payload = isset($body['payload']) ? $body['payload'] : null;
    if ($room === '' || $name === '') out(array('ok' => false, 'error' => 'room_and_name_required'));

    $payloadJson = json_encode($payload === null ? new stdClass() : $payload, JSON_UNESCAPED_UNICODE);
    if (strlen($payloadJson) > 4000) $payloadJson = substr($payloadJson, 0, 4000);

    $stmt = $conn->prepare(
        "INSERT INTO teamsync_members (room, name, klass, faction, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE klass=VALUES(klass), faction=VALUES(faction),
            payload=VALUES(payload), updated_at=NOW()"
    );
    $stmt->bind_param('ssiis', $room, $name, $klass, $faction, $payloadJson);
    $stmt->execute();
    $stmt->close();

    // 같은 요청에서 룸 전체(최근 보고분)를 반환 → RTT 1번으로 발행+수신.
    out(array('ok' => true, 'serverTime' => gmdate('c'), 'members' => ts_list($conn, $room)));
}

if ($action === 'list') {
    $room = clean_room(isset($_GET['room']) ? $_GET['room'] : '');
    if ($room === '') out(array('ok' => false, 'error' => 'room_required'));
    out(array('ok' => true, 'serverTime' => gmdate('c'), 'members' => ts_list($conn, $room)));
}

if ($action === 'leave') {
    $room = clean_room(isset($_GET['room']) ? $_GET['room'] : '');
    $name = substr(trim((string)(isset($_GET['name']) ? $_GET['name'] : '')), 0, 64);
    if ($room !== '' && $name !== '') {
        $stmt = $conn->prepare("DELETE FROM teamsync_members WHERE room=? AND name=?");
        $stmt->bind_param('ss', $room, $name);
        $stmt->execute();
        $stmt->close();
    }
    out(array('ok' => true));
}

http_response_code(400);
out(array('ok' => false, 'error' => 'unknown_action'));

function ts_list($conn, $room) {
    // 오래된 행은 가끔 정리(확률적 GC).
    if (mt_rand(1, 20) === 1) {
        @$conn->query("DELETE FROM teamsync_members WHERE updated_at < (NOW() - INTERVAL 120 SECOND)");
    }
    // get_result()/mysqlnd 가 없는 호스트라 plain escaped 쿼리 사용(room 은 이미
    // [A-Za-z0-9_-] 로 정제됨).
    $win = (int)TS_LIST_WINDOW_SEC;
    $roomEsc = $conn->real_escape_string($room);
    $sql = "SELECT name, klass, faction, payload,
                   TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS age
            FROM teamsync_members
            WHERE room='$roomEsc' AND updated_at >= (NOW() - INTERVAL $win SECOND)
            ORDER BY klass, name";
    $res = $conn->query($sql);
    $members = array();
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $members[] = array(
                'name'    => $row['name'],
                'klass'   => (int)$row['klass'],
                'faction' => (int)$row['faction'],
                'ageSec'  => (int)$row['age'],
                'payload' => json_decode($row['payload'], true),
            );
        }
        $res->free();
    }
    return $members;
}
