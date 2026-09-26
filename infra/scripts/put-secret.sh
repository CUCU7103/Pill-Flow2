#!/usr/bin/env bash
# 비밀번호를 화면·셸 기록에 남기지 않고 SSM SecureString으로 저장한다.
# 사용법: put-secret.sh <parameter_name>
set -euo pipefail
name="$1"
read -rsp "값 입력 ($name): " value; echo
[[ -n "$value" ]] || { echo "빈 값은 저장하지 않는다" >&2; exit 1; }
# --value로 비밀값을 넘기면 docker/aws 프로세스 인자가 되어 ps로 노출되므로,
# 임시 JSON 파일을 경유해 --cli-input-json으로 전달한다.
umask 077
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
jq -n --arg name "$name" --arg value "$value" '{Name:$name, Type:"SecureString", Overwrite:true, Value:$value}' > "$tmp"
aws ssm put-parameter --region ap-northeast-1 --cli-input-json "file://$tmp" > /dev/null
echo "저장 완료: $name"
