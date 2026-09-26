#!/usr/bin/env bash
# send-deploy.sh 테스트 — SSM으로 보내는 명령에 세 파일이 손상 없이 담기는지, 원격 실패가 종료 코드로 전달되는지 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../send-deploy.sh"
failures=0
assert() { local d="$1"; shift; if "$@"; then echo "  ok   - $d"; else echo "  FAIL - $d"; failures=$((failures+1)); fi; }

export CALLS_FILE; CALLS_FILE="$(mktemp)"
export PATH="$HERE/fakes:$PATH" POLL_ATTEMPTS=2 POLL_INTERVAL=0

echo "케이스 1: 원격 성공"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Success
set +e; bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 > /dev/null; rc=$?; set -e
assert "종료 코드 0" test "$rc" -eq 0
params="$(grep 'aws ssm send-command' "$CALLS_FILE" | sed -E 's/.*--parameters (\{.*\})( --|$).*/\1/')"
assert "deploy.sh 실행 명령 포함" bash -c "echo '$params' | jq -e '.commands | any(. == \"/opt/pillflow/deploy.sh repo.example/pillflow-api sha1\")' > /dev/null"
for f in compose.yml Caddyfile deploy.sh; do
  b64="$(echo "$params" | jq -r --arg f "$f" '.commands[] | select(endswith("> /opt/pillflow/" + $f)) | capture("^echo (?<b>[A-Za-z0-9+/=]+) ").b')"
  assert "$f 내용 일치" bash -c "diff <(echo '$b64' | base64 --decode) '$HERE/../$f' > /dev/null"
done

echo "케이스 2: 원격 실패"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Failed
set +e; bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "send_deploy_test 전체 통과"
