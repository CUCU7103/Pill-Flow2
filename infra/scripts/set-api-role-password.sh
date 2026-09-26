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

# admin_pw를 docker run -e로 넘기면 docker 프로세스 인자가 되어 ps로 노출되므로
# 임시 env 파일로 전달한다. new_pw도 같은 이유로 SSM에는 --cli-input-json 파일로 전달한다.
umask 077
pg_env="$(mktemp)"; ssm_json="$(mktemp)"
trap 'rm -f "$pg_env" "$ssm_json"' EXIT
printf 'PGPASSWORD=%s\n' "$admin_pw" > "$pg_env"

# Supabase는 log_statement=ddl이라 ALTER ROLE 문장이 서버 로그에 남는다.
# 평문 대신 로컬에서 계산한 SCRAM-SHA-256 verifier만 보낸다(psql \password와 같은 방식).
# new_pw는 프로세스 인자로 노출되지 않도록 stdin으로 python에 넘긴다.
verifier="$(printf '%s' "$new_pw" | python3 -c '
import base64, hashlib, hmac, os, sys
pw = sys.stdin.read().encode(); salt = os.urandom(16); it = 4096
salted = hashlib.pbkdf2_hmac("sha256", pw, salt, it)
client_key = hmac.new(salted, b"Client Key", "sha256").digest()
server_key = hmac.new(salted, b"Server Key", "sha256").digest()
b64 = lambda b: base64.b64encode(b).decode()
print(f"SCRAM-SHA-256${it}:{b64(salt)}${b64(hashlib.sha256(client_key).digest())}:{b64(server_key)}")
')"
printf '\\set pw '"'"'%s'"'"'\nALTER ROLE pillflow_api PASSWORD :'"'"'pw'"'"';\n' "$verifier" \
  | docker run --rm -i --env-file "$pg_env" postgres:17-alpine \
      psql "host=${hostport%%:*} port=${hostport##*:} dbname=postgres user=$admin_user sslmode=require" -v ON_ERROR_STOP=1 -q

jq -n --arg value "$new_pw" '{Name:"/pillflow/prod/app/DB_PASSWORD", Type:"SecureString", Overwrite:true, Value:$value}' > "$ssm_json"
aws ssm put-parameter --region ap-northeast-1 --cli-input-json "file://$ssm_json" > /dev/null
echo "pillflow_api 비밀번호 설정 및 SSM 저장 완료"
