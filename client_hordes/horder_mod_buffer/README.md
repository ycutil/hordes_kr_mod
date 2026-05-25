# Horder Mod Buffer

Hordes.io 보조 계정용 Tampermonkey 스크립트입니다.

## 동작

- 화면 오른쪽 아래 `Buffer` 패널을 추가합니다.
- `1` 키 또는 `Guardstone` 버튼을 누르면 Guardstone 경로를 실행합니다.
- `Headless` 버튼을 누르면 Headless Landing 경로를 실행합니다.
- 실행 순서는 다음과 같습니다.
  1. 주변 `Conjurer`를 찾아 상호작용합니다.
  2. `Faivel` 이동 선택지를 누릅니다.
  3. Faivel 로딩을 기다린 뒤 4번 스킬바를 사용합니다.
  4. 1초 뒤 5번 스킬바를 사용합니다.
  5. 다시 `Conjurer`를 열고 `Guardstone` 또는 `Headless Landing`으로 이동합니다.

## 설치

1. Tampermonkey에서 새 스크립트를 만듭니다.
2. `horder-mod-buffer.user.js` 내용을 붙여넣습니다.
3. `https://hordes.io/play`를 새로고침합니다.

## 주의

- 캐릭터가 Conjurer 근처에 있어야 합니다.
- 목적지 선택지는 게임에서 실제로 보이는 이름을 기준으로 찾습니다.
- `런타임 연결 실패`가 뜨면 스크립트를 업데이트한 뒤 `https://hordes.io/play`를 완전 새로고침합니다.
- CDP는 필요하지 않게 만들었습니다. 9222 포트는 건드리지 않습니다.

## 진단

브라우저 콘솔에서 현재 상태를 볼 수 있습니다.

```js
HorderModBuffer.status()
HorderModBuffer.diagnose()
```
