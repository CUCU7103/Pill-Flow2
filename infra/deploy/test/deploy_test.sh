#!/usr/bin/env bash
# deploy.sh 동작 테스트 — 실제 AWS/Docker 없이 가짜 명령으로 성공·롤백·최초 실패·특수문자 보존을 검증한다.
# 케이스 6만 예외적으로 실제 docker(compose)를 사용해 env_file 값이 컨테이너 런타임에
# 그대로 전달되는지 확인한다(가짜 명령으로는 dotenv 파싱 자체를 검증할 수 없기 때문).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../deploy.sh"
REPO="123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/pillflow-api"
failures=0

# PATH를 가짜 명령으로 덮어쓰기 전에 실제 docker 경로를 미리 저장해 둔다(케이스 6용).
REAL_DOCKER="$(command -v docker || true)"

TMP_DIRS=()
cleanup() {
  local d
  for d in "${TMP_DIRS[@]:-}"; do
    [[ -n "$d" && -d "$d" ]] && rm -rf "$d"
  done
}
trap cleanup EXIT

setup() {
  export DEPLOY_DIR; DEPLOY_DIR="$(mktemp -d)"
  TMP_DIRS+=("$DEPLOY_DIR")
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

# 로그 파일에서 <first>가 <second>보다 먼저 나타나는지 확인한다(C1: .env가 없는 상태에서
# 다른 서비스를 compose로 기동하면 안 되므로, app이 caddy보다 먼저 떠야 한다).
assert_order() {
  local first="$1" second="$2" file="$3" la lb
  la="$(grep -n -F "$first" "$file" | head -1 | cut -d: -f1)"
  lb="$(grep -n -F "$second" "$file" | head -1 | cut -d: -f1)"
  [[ -n "$la" && -n "$lb" && "$la" -lt "$lb" ]]
}

echo "케이스 1: 정상 배포"
setup
set +e; bash "$SCRIPT" "$REPO" good1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 0" test "$rc" -eq 0
assert "current_tag = good1" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env에 새 이미지" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "특수문자 보존(작은따옴표로 감싸짐)" grep -qxF "DB_PASSWORD='p@ss=wo#rd with space'" "$DEPLOY_DIR/app.env"
assert "app.env 권한 600" test "$(stat -c %a "$DEPLOY_DIR/app.env" 2>/dev/null || stat -f %Lp "$DEPLOY_DIR/app.env")" = "600"
assert "caddy 기동" grep -q "docker compose up -d caddy" "$CALLS_FILE"
assert "app이 caddy보다 먼저 기동(.env 없이 compose 호출 금지)" assert_order "docker compose up -d app" "docker compose up -d caddy" "$CALLS_FILE"

echo "케이스 2: 헬스체크 실패 → 이전 태그로 롤백"
setup
echo "good1" > "$DEPLOY_DIR/current_tag"
printf 'MARKER=old-app-env\n' > "$DEPLOY_DIR/app.env"
chmod 600 "$DEPLOY_DIR/app.env"
set +e; bash "$SCRIPT" "$REPO" bad2 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 유지(good1)" test "$(cat "$DEPLOY_DIR/current_tag")" = "good1"
assert ".env가 이전 이미지로 복구" grep -qx "APP_IMAGE=$REPO:good1" "$DEPLOY_DIR/.env"
assert "롤백 시 pull 안 함" bash -c "! grep -q 'docker pull $REPO:good1' '$CALLS_FILE'"
assert "app.env가 롤백 시 이전 내용으로 복원" grep -qx 'MARKER=old-app-env' "$DEPLOY_DIR/app.env"

echo "케이스 3: 최초 배포 실패(이전 태그 없음)"
setup
set +e; bash "$SCRIPT" "$REPO" bad1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "current_tag 없음" test ! -f "$DEPLOY_DIR/current_tag"
assert "app 중지" grep -q "docker compose stop app" "$CALLS_FILE"

echo "케이스 4: 파라미터 값에 작은따옴표 포함 → 아무 것도 바꾸지 않고 중단"
setup
cat > "$FAKE_PARAMS_JSON" <<'JSON'
{"Parameters":[{"Name":"/pillflow/prod/app/BAD","Value":"a'b"}]}
JSON
set +e; bash "$SCRIPT" "$REPO" good1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "app.env 미생성" test ! -f "$DEPLOY_DIR/app.env"
assert "current_tag 미생성" test ! -f "$DEPLOY_DIR/current_tag"
assert ".env 미생성" test ! -f "$DEPLOY_DIR/.env"

echo "케이스 5: SSM 파라미터 0개 → 아무 것도 바꾸지 않고 중단"
setup
cat > "$FAKE_PARAMS_JSON" <<'JSON'
{"Parameters":[]}
JSON
set +e; bash "$SCRIPT" "$REPO" good1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "app.env 미생성" test ! -f "$DEPLOY_DIR/app.env"
assert "current_tag 미생성" test ! -f "$DEPLOY_DIR/current_tag"

echo "케이스 6: 특수문자 값이 실제 docker compose 런타임에 그대로 전달(가짜 명령 아님)"
if [[ -z "$REAL_DOCKER" ]]; then
  echo "  FAIL - 실제 docker를 찾을 수 없다"; failures=$((failures+1))
else
  WORKDIR="$(mktemp -d)"; TMP_DIRS+=("$WORKDIR")
  cp "$HERE/../compose.yml" "$WORKDIR/compose.yml"
  cp "$HERE/../Caddyfile" "$WORKDIR/Caddyfile"
  # deploy.sh의 write_app_env가 만드는 형식(NAME='value')을 그대로 재현한다.
  cat > "$WORKDIR/app.env" <<'ENV'
DOLLAR_VAL='a$b'
HASH_VAL='x #not-a-comment'
QUOTE_START_VAL='"leading-quote'
ENV
  # awslogs 드라이버는 AWS 자격 증명이 필요해 로컬에서 실패하므로 테스트에서만 json-file로 덮어쓴다.
  cat > "$WORKDIR/override.yml" <<'YAML'
services:
  app:
    logging:
      driver: json-file
YAML
  PROJECT="pillflow-test-$$"
  set +e
  # shellcheck disable=SC2016 # 컨테이너 내부 sh가 해석해야 하므로 $VAR를 호스트 bash에서 보간하면 안 된다
  run_out="$(cd "$WORKDIR" && APP_IMAGE=alpine "$REAL_DOCKER" compose -p "$PROJECT" -f compose.yml -f override.yml \
    run --rm --no-deps --entrypoint sh app -c 'printf "%s\n%s\n%s\n" "$DOLLAR_VAL" "$HASH_VAL" "$QUOTE_START_VAL"' 2> "$WORKDIR/run.err")"
  run_rc=$?
  (cd "$WORKDIR" && "$REAL_DOCKER" compose -p "$PROJECT" down --remove-orphans > /dev/null 2>&1)
  set -e
  if [[ "$run_rc" -eq 0 ]]; then
    dollar_line="$(printf '%s\n' "$run_out" | sed -n '1p')"
    hash_line="$(printf '%s\n' "$run_out" | sed -n '2p')"
    quote_line="$(printf '%s\n' "$run_out" | sed -n '3p')"
    # shellcheck disable=SC2016 # 원본 값 자체를 비교하는 리터럴 문자열이며 보간되면 안 된다
    assert "DOLLAR_VAL 원본과 동일(변수 보간 안 됨)" test "$dollar_line" = 'a$b'
    assert "HASH_VAL 원본과 동일(주석 처리 안 됨)" test "$hash_line" = 'x #not-a-comment'
    assert "QUOTE_START_VAL 원본과 동일" test "$quote_line" = '"leading-quote'
  else
    echo "  FAIL - docker compose run 실패: $(cat "$WORKDIR/run.err" 2>/dev/null)"
    failures=$((failures+1))
  fi
fi

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "deploy_test 전체 통과"
