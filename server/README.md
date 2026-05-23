# Target Order Server

Hordes KR Custom Mod 사용자끼리 타겟 오더를 공유하기 위한 Node.js WebSocket relay 서버입니다.

## 실행

```bash
npm install
ADMIN_TOKEN=your-admin-token npm run target-order-server
```

기본 포트는 `8787`입니다.

```text
ws://localhost:8787
http://localhost:8787/admin?token=your-admin-token
```

## 관리

어드민 페이지에서 다음을 관리합니다.

- 방 생성/삭제
- 유저 이름 + 토큰 생성
- 오더 허용자 지정/해제
- 현재 접속자 확인

클라이언트 스크립트에는 서버 URL, 방 코드, 닉네임, 유저 토큰을 입력합니다.

## 동작

- 오더 허용자만 `target-call`을 보낼 수 있습니다.
- 서버는 같은 방의 다른 사용자에게만 타겟 오더를 전달합니다.
- 수신자는 3초 안에 본인 단축키를 눌러 타겟 적용을 시도합니다.
- 서버는 메시지 본문을 장기 저장하지 않고 relay만 합니다.
