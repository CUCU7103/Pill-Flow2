variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "availability_zone" {
  type    = string
  default = "ap-northeast-1a"
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "root_volume_size_gb" {
  type    = number
  default = 20
}

variable "domain_name" {
  type    = string
  default = "pillflow.app"
}

variable "api_subdomain" {
  type    = string
  default = "api"
}

variable "github_repository" {
  description = "OIDC 신뢰 대상 저장소 (owner/name, 대소문자 정확히)"
  type        = string
  default     = "CUCU7103/Pill-Flow2"
}

variable "supabase_project_ref" {
  type    = string
  default = "igyydnnehdjrwujxqdry"
}

variable "db_pooler_host" {
  description = "Supavisor session 모드 호스트 (IPv4)"
  type        = string
  default     = "aws-1-ap-northeast-1.pooler.supabase.com"
}

variable "cors_allowed_origins" {
  type    = string
  default = "https://pillflow-app.vercel.app,https://localhost,https://pillflow.app"
}

variable "monthly_budget_usd" {
  type    = number
  default = 30
}

variable "alert_email" {
  description = "Budget 알림 수신 이메일 — terraform.tfvars에만 적는다(공개 저장소)"
  type        = string
}
