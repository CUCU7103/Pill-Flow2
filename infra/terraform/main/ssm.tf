locals {
  jdbc_url = "jdbc:postgresql://${var.db_pooler_host}:5432/postgres?sslmode=require"

  # 런타임 파라미터 (EC2 역할만 읽는다)
  app_plain_params = {
    DB_URL               = local.jdbc_url
    DB_USERNAME          = "pillflow_api.${var.supabase_project_ref}"
    SUPABASE_URL         = "https://${var.supabase_project_ref}.supabase.co"
    CORS_ALLOWED_ORIGINS = var.cors_allowed_origins
  }

  # DDL 파라미터 (GitHub 배포 역할만 읽는다)
  migration_plain_params = {
    FLYWAY_URL      = local.jdbc_url
    FLYWAY_USERNAME = "postgres.${var.supabase_project_ref}"
  }

  # 값은 infra/scripts/put-secret.sh로 따로 넣는다.
  secret_params = {
    "/pillflow/prod/app/DB_PASSWORD"           = "런타임 pillflow_api 비밀번호"
    "/pillflow/prod/migration/FLYWAY_PASSWORD" = "Supabase postgres 비밀번호"
  }
}

resource "aws_ssm_parameter" "app_plain" {
  for_each = local.app_plain_params
  name     = "/pillflow/prod/app/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "migration_plain" {
  for_each = local.migration_plain_params
  name     = "/pillflow/prod/migration/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "secret" {
  for_each    = local.secret_params
  name        = each.key
  description = each.value
  type        = "SecureString"
  # write-only 인자라 복호화된 값이 상태 파일에 저장되지 않는다; 실제 값은 put-secret.sh로 덮어쓴다.
  value_wo         = "CHANGE_ME"
  value_wo_version = 1

  lifecycle {
    # value_wo/value_wo_version은 상태에 실제 값을 담지 못해 항상 "CHANGE_ME"·1로 남는다.
    # description·tier 등 다른 속성을 바꿔 in-place update가 발생하면 provider가 value_wo를
    # 다시 적용해 put-secret.sh로 넣어 둔 실제 비밀번호를 "CHANGE_ME"로 덮어써 버린다.
    # 이 리소스는 최초 생성 이후 전부 무시해 실수로 값이 초기화되는 것을 막는다.
    ignore_changes = all
  }
}
