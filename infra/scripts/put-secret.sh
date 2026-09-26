#!/usr/bin/env bash
# 비밀번호를 화면·셸 기록에 남기지 않고 SSM SecureString으로 저장한다.
# 사용법: put-secret.sh <parameter_name>
set -euo pipefail
name="$1"
read -rsp "값 입력 ($name): " value; echo
[[ -n "$value" ]] || { echo "빈 값은 저장하지 않는다" >&2; exit 1; }
aws ssm put-parameter --region ap-northeast-1 --name "$name" --type SecureString --overwrite --value "$value" > /dev/null
echo "저장 완료: $name"
