#!/usr/bin/env bash
# send-deploy.sh 테스트 — SSM으로 보내는 명령에 세 파일이 손상 없이 담기는지, 원격 실패가 종료 코드로 전달되는지 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../send-deploy.sh"
failures=0
assert() { local d="$1"; shift; if "$@"; then echo "  ok   - $d"; else echo "  FAIL - $d"; failures=$((failures+1)); fi; }

export CALLS_FILE; CALLS_FILE="$(mktemp)"
trap 'rm -f "$CALLS_FILE"' EXIT
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

echo "케이스 3: 태그에 셸 메타문자 → SSM 호출 없이 즉시 중단"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Success
set +e; bash "$SCRIPT" i-0abc repo.example/pillflow-api 'sha1; rm -rf /' > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "send-command 호출 안 함" bash -c "! grep -q 'aws ssm send-command' '$CALLS_FILE'"

echo "케이스 4: REPO_URI에 공백 포함 → SSM 호출 없이 즉시 중단"
: > "$CALLS_FILE"; export FAKE_SSM_STATUS=Success
set +e; bash "$SCRIPT" i-0abc 'repo example/pillflow-api' sha1 > /dev/null 2>&1; rc=$?; set -e
assert "종료 코드 1" test "$rc" -eq 1
assert "send-command 호출 안 함" bash -c "! grep -q 'aws ssm send-command' '$CALLS_FILE'"

echo "케이스 5: get-command-invocation이 AccessDenied류 오류 → Pending으로 숨기지 않고 즉시 실패(M9)"
: > "$CALLS_FILE"; unset FAKE_SSM_STATUS; export FAKE_SSM_ERROR="An error occurred (AccessDeniedException) when calling the GetCommandInvocation operation"
start_ts=$(date +%s)
set +e; out="$(bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 2>&1)"; rc=$?; set -e
end_ts=$(date +%s)
unset FAKE_SSM_ERROR
assert "종료 코드 1" test "$rc" -eq 1
assert "오류 메시지를 그대로 출력" bash -c "echo \"\$1\" | grep -q AccessDeniedException" _ "$out"
assert "폴링 재시도 없이 빠르게 종료(2회 대기하지 않음)" test $((end_ts - start_ts)) -lt 5

echo "케이스 6: InvocationDoesNotExist는 Pending으로 재시도(회귀 방지, M9)"
: > "$CALLS_FILE"; export POLL_ATTEMPTS=3
export FAKE_SSM_ERROR="An error occurred (InvocationDoesNotExist) when calling the GetCommandInvocation operation"
# 명령이 아직 인스턴스에 전달되지 않은 상태를 재현한다 — 매 시도마다 재시도하다
# POLL_ATTEMPTS 소진 후 status=Pending으로 실패 종료해야 한다(AccessDenied처럼 즉시 중단되면 안 됨).
set +e; bash "$SCRIPT" i-0abc repo.example/pillflow-api sha1 > /dev/null 2>&1; rc=$?; set -e
unset FAKE_SSM_ERROR; export POLL_ATTEMPTS=2
assert "종료 코드 1(계속 Pending 취급되다 시도 소진)" test "$rc" -eq 1
assert "get-command-invocation을 여러 번 폴링함" test "$(grep -c 'ssm get-command-invocation' "$CALLS_FILE")" -ge 3

if [[ $failures -gt 0 ]]; then echo "실패 $failures건"; exit 1; fi
echo "send_deploy_test 전체 통과"
