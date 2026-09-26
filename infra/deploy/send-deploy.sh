#!/usr/bin/env bash
# GitHub 러너에서 실행 — 배포 파일을 SSM Run Command로 EC2에 전달하고 deploy.sh 결과를 기다린다.
# 사용법: send-deploy.sh <instance_id> <image_repo_uri> <tag>
set -euo pipefail

INSTANCE_ID="$1"
REPO_URI="$2"
TAG="$3"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-180}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
DIR="$(cd "$(dirname "$0")" && pwd)"

# 원격 셸 명령 문자열에 그대로 삽입되므로, 공백·셸 메타문자가 섞이지 않도록 미리 검증한다.
if [[ ! "$TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "잘못된 태그: $TAG" >&2
  exit 1
fi
if [[ ! "$REPO_URI" =~ ^[A-Za-z0-9._/:-]+$ ]]; then
  echo "잘못된 이미지 저장소 URI: $REPO_URI" >&2
  exit 1
fi

b64() { base64 < "$1" | tr -d '\n'; }

# 원격에서 실행할 명령 목록(JSON 배열). 파일은 base64로 전달해 따옴표·개행 문제를 없앤다.
commands="$(jq -n \
  --arg compose "$(b64 "$DIR/compose.yml")" \
  --arg caddy "$(b64 "$DIR/Caddyfile")" \
  --arg deploy "$(b64 "$DIR/deploy.sh")" \
  --arg run "/opt/pillflow/deploy.sh $REPO_URI $TAG" \
  '[
    "set -eu",
    "install -d -m 755 /opt/pillflow /opt/pillflow/caddy-data /opt/pillflow/caddy-config",
    "echo \($compose) | base64 -d > /opt/pillflow/compose.yml",
    "echo \($caddy) | base64 -d > /opt/pillflow/Caddyfile",
    "echo \($deploy) | base64 -d > /opt/pillflow/deploy.sh",
    "chmod 755 /opt/pillflow/deploy.sh",
    $run
  ]')"
parameters="$(jq -cn --argjson c "$commands" '{commands: $c, executionTimeout: ["900"]}')"

command_id="$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "pillflow deploy $TAG" \
  --parameters "$parameters" \
  --query Command.CommandId --output text)"

# aws ssm wait는 최대 대기 시간이 짧아 직접 폴링한다.
# 명령이 아직 인스턴스에 전달되지 않아 생기는 InvocationDoesNotExist만 "대기 중"으로 재시도한다.
# AccessDenied 등 다른 오류는 숨기지 않고 즉시 출력한 뒤 실패로 종료한다.
err_file="$(mktemp)"; trap 'rm -f "$err_file"' EXIT
status="Pending"
for ((i = 1; i <= POLL_ATTEMPTS; i++)); do
  if status="$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" --query Status --output text 2>"$err_file")"; then
    :
  else
    err="$(cat "$err_file")"
    if [[ "$err" == *InvocationDoesNotExist* ]]; then
      status="Pending"
    else
      echo "$err" >&2
      exit 1
    fi
  fi
  case "$status" in
    Pending | InProgress | Delayed) sleep "$POLL_INTERVAL" ;;
    *) break ;;
  esac
done

echo "원격 상태: $status"
aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text || true

if [[ "$status" != "Success" ]]; then exit 1; fi
