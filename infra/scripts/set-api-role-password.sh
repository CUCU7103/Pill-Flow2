#!/usr/bin/env bash
# pillflow_api 비밀번호를 무작위 생성해 DB에 설정하고 SSM에 저장한다. 비밀번호는 화면에 출력하지 않는다.
# 전제: V2 마이그레이션으로 pillflow_api role이 이미 존재한다.
set -euo pipefail
get() { aws ssm get-parameter --region ap-northeast-1 --name "/pillflow/prod/migration/$1" --with-decryption --query Parameter.Value --output text; }
url="$(get FLYWAY_URL)"          # jdbc:postgresql://host:5432/postgres?sslmode=require
hostport="${url#jdbc:postgresql://}"; hostport="${hostport%%/*}"
admin_user="$(get FLYWAY_USERNAME)"
admin_pw="$(get FLYWAY_PASSWORD)"
new_pw="$(openssl rand -hex 24)"   # 16진수만 사용 → SQL·env 인용 문제 없음
printf '\\set pw %s\nALTER ROLE pillflow_api PASSWORD :'"'"'pw'"'"';\n' "$new_pw" \
  | docker run --rm -i -e PGPASSWORD="$admin_pw" postgres:17-alpine \
      psql "host=${hostport%%:*} port=${hostport##*:} dbname=postgres user=$admin_user sslmode=require" -v ON_ERROR_STOP=1 -q
aws ssm put-parameter --region ap-northeast-1 --name /pillflow/prod/app/DB_PASSWORD --type SecureString --overwrite --value "$new_pw" > /dev/null
echo "pillflow_api 비밀번호 설정 및 SSM 저장 완료"
