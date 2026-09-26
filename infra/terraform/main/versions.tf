terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
  }
  # 버킷 이름(계정 ID 포함)은 공개 저장소에 두지 않고 backend.hcl로 주입한다: terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "pillflow"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
