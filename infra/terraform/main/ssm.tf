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
  value       = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}
