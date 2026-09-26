#!/usr/bin/env bash
# EC2에서 실행되는 배포 스크립트 — 새 이미지로 app을 교체하고 헬스체크에 실패하면 이전 태그로 롤백한다.
# 사용법: deploy.sh <image_repo_uri> <tag>
set -euo pipefail

REPO_URI="$1"
TAG="$2"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pillflow}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
PARAM_PATH="${PARAM_PATH:-/pillflow/prod/app/}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/actuator/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-24}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

cd "$DEPLOY_DIR"

# SSM 런타임 파라미터 → app.env (이름의 마지막 경로 조각을 변수명으로, 값은 가공 없이 그대로)
write_app_env() {
  umask 077
  aws ssm get-parameters-by-path --region "$AWS_REGION" --path "$PARAM_PATH" --with-decryption --output json \
    | jq -r '.Parameters[] | "\(.Name | split("/") | last)=\(.Value)"' > app.env.tmp
  chmod 600 app.env.tmp
  mv app.env.tmp app.env
}

# compose가 읽는 .env에 실행할 이미지를 기록하고 app만 재생성한다.
start_app() {
  printf 'APP_IMAGE=%s\n' "$1" > .env
  docker compose up -d app
}

wait_healthy() {
  local i
  for ((i = 1; i <= HEALTH_ATTEMPTS; i++)); do
    if curl -fsS "$HEALTH_URL" > /dev/null 2>&1; then return 0; fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

registry="${REPO_URI%%/*}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
write_app_env

previous=""
if [[ -f current_tag ]]; then previous="$(cat current_tag)"; fi

docker pull "$REPO_URI:$TAG"
# caddy는 app과 독립적으로 항상 떠 있어야 한다(없을 때만 생성).
docker compose up -d caddy
start_app "$REPO_URI:$TAG"

if wait_healthy; then
  echo "$TAG" > current_tag
  docker image prune -f > /dev/null
  echo "배포 성공: $TAG"
  exit 0
fi

echo "헬스체크 실패: $TAG" >&2
if [[ -n "$previous" ]]; then
  # 이전 이미지는 인스턴스에 이미 있으므로 pull 없이 기동한다(ECR에서 만료됐어도 롤백 가능).
  start_app "$REPO_URI:$previous"
  if wait_healthy; then echo "이전 태그로 롤백 완료: $previous" >&2; else echo "롤백 후에도 비정상: $previous" >&2; fi
else
  docker compose stop app
  echo "이전 태그가 없어 app을 중지했다" >&2
fi
exit 1
