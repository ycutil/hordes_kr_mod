#!/usr/bin/env bash
# teamsync 서버(PHP) → yerp.cafe24.com 배포. (trackingBL 과 같은 계정/DB, teamsync_ 테이블)
# 서비스 URL: https://yerp.cafe24.com/teamsync/api.php
set -euo pipefail
cd "$(dirname "$0")/web"

FTP="ftp://yerp.cafe24.com"
USER="yerp"
PASS='Rhffla00!@'

for f in config.php db.php api.php; do
  curl -sS --ftp-create-dirs -T "$f" "$FTP/teamsync/$f" --user "$USER:$PASS" \
    -w "  uploaded $f (%{http_code})\n"
done
echo "done → https://yerp.cafe24.com/teamsync/api.php"
