#!/usr/bin/env bash
# 운영 DB를 Flyway 버전 1로 baseline한다(V1 SQL은 실행하지 않음). 최초 1회만 실행한다.
# 접속 정보는 SSM /pillflow/prod/migration/* 에서 읽는다(로컬 AWS 자격증명 필요).
set -euo pipefail
get() { aws ssm get-parameter --region ap-northeast-1 --name "/pillflow/prod/migration/$1" --with-decryption --query Parameter.Value --output text; }
env_file="$(mktemp)"; chmod 600 "$env_file"; trap 'rm -f "$env_file"' EXIT
{
  echo "FLYWAY_URL=$(get FLYWAY_URL)"
  echo "FLYWAY_USER=$(get FLYWAY_USERNAME)"
  echo "FLYWAY_PASSWORD=$(get FLYWAY_PASSWORD)"
} > "$env_file"
docker run --rm --env-file "$env_file" flyway/flyway:11.14.1 \
  -schemas=flyway -defaultSchema=flyway -createSchemas=true -baselineVersion=1 \
  -baselineDescription="2026-09-25 ALTER 방식 적용분" baseline
docker run --rm --env-file "$env_file" flyway/flyway:11.14.1 -schemas=flyway -defaultSchema=flyway info
