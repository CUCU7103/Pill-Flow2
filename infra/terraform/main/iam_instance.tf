data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "pillflow-api-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# SSM Session Manager 접속과 Run Command 수신
resource "aws_iam_role_policy_attachment" "instance_ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

locals {
  param_arn_prefix = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "EcrPull"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = [aws_ecr_repository.api.arn]
  }
  # 런타임 파라미터만 읽는다. /pillflow/prod/migration/* 는 읽을 수 없다.
  statement {
    sid       = "AppParams"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["${local.param_arn_prefix}/pillflow/prod/app", "${local.param_arn_prefix}/pillflow/prod/app/*"]
  }
  # AmazonSSMManagedInstanceCore 관리형 정책이 ssm:GetParameter*를 Resource "*"에 허용하므로,
  # migration 파라미터에 대해 명시적으로 Deny하여 AppParams 위 주석("읽을 수 없다")을 실제로 강제한다.
  statement {
    sid       = "DenyMigrationParams"
    effect    = "Deny"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["${local.param_arn_prefix}/pillflow/prod/migration", "${local.param_arn_prefix}/pillflow/prod/migration/*"]
  }
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "pillflow-api-instance"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "api" {
  name = "pillflow-api-instance"
  role = aws_iam_role.instance.name
}
