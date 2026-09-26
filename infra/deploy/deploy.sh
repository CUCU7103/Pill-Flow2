#!/usr/bin/env bash
# EC2에서 실행되는 배포 스크립트 — 새 이미지로 app을 교체하고 헬스체크에 실패하면 이전 태그로 롤백한다.
# 사용법: deploy.sh <image_repo_uri> <tag>
set -euo pipefail

# SSM Run Command는 셸 환경이 최소화되어 HOME이 비어 있을 수 있고, docker/compose는 설정·인증
# 파일 경로를 계산할 때 HOME을 참조하므로 미리 채워 둔다.
export HOME="${HOME:-/root}"

REPO_URI="$1"
TAG="$2"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pillflow}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
PARAM_PATH="${PARAM_PATH:-/pillflow/prod/app/}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/actuator/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-24}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

cd "$DEPLOY_DIR"

# SSM 런타임 파라미터 → app.env (이름의 마지막 경로 조각을 변수명으로, 값은 작은따옴표로 감싸 그대로 보존한다).
# compose의 env_file(dotenv) 파서는 작은따옴표 값 안의 $·#·공백을 문자 그대로 취급하므로
# 값 자체에 작은따옴표나 개행이 있으면 안전하게 표현할 수 없다 — 그 경우 아무 파일도 건드리지 않고 중단한다.
write_app_env() {
  umask 077
  local params count
  params="$(aws ssm get-parameters-by-path --region "$AWS_REGION" --path "$PARAM_PATH" --with-decryption --output json)"
  count="$(printf '%s' "$params" | jq '.Parameters | length')"
  if [[ "$count" -eq 0 ]]; then
    echo "SSM 파라미터가 비어 있다: $PARAM_PATH" >&2
    return 1
  fi
  local q
  printf -v q '%s' "'"
  # 값이 백슬래시로 끝나면(예: 'abc\') compose dotenv 파서가 닫는 작은따옴표를 이스케이프된 문자로 오인해
  # 따옴표가 닫히지 않은 것으로 해석하므로 이 경우도 안전하게 표현할 수 없다.
  if printf '%s' "$params" | jq -e --arg q "$q" '.Parameters[] | select(.Value | contains($q) or contains("\n") or endswith("\\"))' > /dev/null; then
    echo "파라미터 값에 작은따옴표·개행이 있거나 끝이 백슬래시라 안전하게 표현할 수 없다 — 중단한다" >&2
    return 1
  fi
  printf '%s' "$params" | jq -r --arg q "$q" '.Parameters[] | "\(.Name | split("/") | last)=" + $q + .Value + $q' > app.env.tmp
  chmod 600 app.env.tmp
  # 이전 app.env는 롤백 시 복원할 수 있도록 보관해 둔다.
  if [[ -f app.env ]]; then cp app.env app.env.prev; fi
  mv app.env.tmp app.env
}

# compose가 읽는 .env에 실행할 이미지를 기록하고 app만 재생성한다.
# .env는 compose 파일 전체를 보간하는 데 쓰이므로, 다른 서비스(caddy 포함)를 기동하기 전에 항상 먼저 있어야 한다.
start_app() {
  printf 'APP_IMAGE=%s\n' "$1" > .env
  docker compose up -d app
}

wait_healthy() {
  local i
  for ((i = 1; i <= HEALTH_ATTEMPTS; i++)); do
    if curl --max-time 5 -fsS "$HEALTH_URL" > /dev/null 2>&1; then return 0; fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

# Caddyfile 변경을 반영하되, 실패해도 배포 자체를 실패시키지 않고 경고만 남긴다.
reload_caddy() {
  if ! docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "caddy reload 실패(경고) — 다음 재시작 시 반영된다" >&2
  fi
}

registry="${REPO_URI%%/*}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
write_app_env

previous=""
if [[ -f current_tag ]]; then previous="$(cat current_tag)"; fi

docker pull "$REPO_URI:$TAG"

# .env(APP_IMAGE)를 먼저 써야 하므로 app을 caddy보다 먼저 기동한다(최초 배포에서 caddy를 먼저 올리면 .env가 없어 실패한다).
app_started=1
start_app "$REPO_URI:$TAG" || app_started=0

# caddy는 app과 독립적으로 항상 떠 있어야 한다(없을 때만 생성).
# caddy 기동 자체가 실패해도(포트 점유, 이미지 pull 실패, compose.yml 변경으로 재생성 실패 등)
# 검증되지 않은 새 앱이 그대로 남으면 안 되므로 헬스체크 실패와 같은 경로(롤백/중지)로 보낸다.
if docker compose up -d caddy; then
  reload_caddy
else
  echo "caddy 기동 실패" >&2
  app_started=0
fi

if [[ "$app_started" -eq 1 ]] && wait_healthy; then
  echo "$TAG" > current_tag
  # 이번에 실제로 서비스에 반영된 env를 "마지막으로 확인된 정상 상태"로 별도 보관한다.
  # app.env.prev는 매 실행마다 "직전 한 걸음"만 담아 실패가 반복되면 낡은 값일 수 있으므로,
  # 롤백은 이 파일을 우선한다.
  cp app.env app.env.good
  docker image prune -f > /dev/null
  echo "배포 성공: $TAG"
  exit 0
fi

echo "헬스체크 실패: $TAG" >&2
if [[ -n "$previous" ]]; then
  # 이전 이미지는 인스턴스에 이미 있으므로 pull 없이 기동한다(ECR에서 만료됐어도 롤백 가능).
  # 마지막으로 확인된 정상 env(app.env.good)를 우선 복원하고, 없으면 직전 값(app.env.prev)으로 대체한다.
  if [[ -f app.env.good ]]; then
    cp app.env.good app.env
  elif [[ -f app.env.prev ]]; then
    cp app.env.prev app.env
  fi
  start_app "$REPO_URI:$previous" || true
  if wait_healthy; then echo "이전 태그로 롤백 완료: $previous" >&2; else echo "롤백 후에도 비정상: $previous" >&2; fi
else
  docker compose stop app
  echo "이전 태그가 없어 app을 중지했다" >&2
fi
exit 1
