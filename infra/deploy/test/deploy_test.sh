#!/usr/bin/env bash
# deploy.sh 동작 테스트 — 실제 AWS/Docker 없이 가짜 명령으로 성공·롤백·최초 실패·특수문자 보존을 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../deploy.sh"
REPO="123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/pillflow-api"
failures=0

setup() {
  export DEPLOY_DIR; DEPLOY_DIR="$(mktemp -d)"
  export CALLS_FILE="$DEPLOY_DIR/calls.log"; : > "$CALLS_FILE"
  export FAKE_PARAMS_JSON="$DEPLOY_DIR/params.json"
  cat > "$FAKE_PARAMS_JSON" <<'JSON'
{"Parameters":[
 {"Name":"/pillflow/prod/app/DB_URL","Value":"jdbc:postgresql://h:5432/postgres?sslmode=require"},
 {"Name":"/pillflow/prod/app/DB_PASSWORD","Value":"p@ss=wo#rd with space"}
]}
JSON
  export PATH="$HERE/fakes:$PATH"
  export HEALTH_ATTEMPTS=2 HEALTH_INTERVAL=0
}

assert() { # assert <설명> <명령...>
  local desc="$1"; shift
  if "$@"; then echo "  ok   - $desc"; else echo "  FAIL - $desc"; failures=$((failures+1)); fi
}

echo "케이스 1: 정상 배포"
setup
set +e; bash "$SCRIPT" "$REPO" good1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 0" test "$rc" -eq 0
assert "current_tag = good1" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env에 새 이미지" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "특수문자 보존" grep -qxF 'DB_PASSWORD=p@ss=wo#rd with space' "$DEPLOY_DIR/app.env"
assert "app.env 권한 600" test "$(stat -c %a "$DEPLOY_DIR/app.env" 2>/dev/null || stat -f %Lp "$DEPLOY_DIR/app.env")" = "600"
assert "caddy 기동" grep -q "docker compose up -d caddy" "$CALLS_FILE"

echo "케이스 2: 헬스체크 실패 → 이전 태그로 롤백"
setup
echo "good1" > "$DEPLOY_DIR/current_tag"
set +e; bash "$SCRIPT" "$REPO" bad2 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 유지(good1)" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env가 이전 이미지로 복구" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "롤백 시 pull 안 함" bash -c "! grep -q 'docker pull $REPO:good1' '$CALLS_FILE'"

echo "케이스 3: 최초 배포 실패(이전 태그 없음)"
setup
set +e; bash "$SCRIPT" "$REPO" bad1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 없음" test ! -f "$DEPLOY_DIR/current_tag"
assert "app 중지" grep -q "docker compose stop app" "$CALLS_FILE"

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "deploy_test 전체 통과"
