# Amazon Linux 2023 arm64 최신 AMI (AWS 공개 SSM 파라미터)
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "api" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.api.name
  user_data              = file("${path.module}/user_data.sh")

  # 버스트 크레딧 초과 과금을 막아 비용을 예측 가능하게 유지한다.
  credit_specification {
    cpu_credits = "standard"
  }

  # IMDSv2 강제, hop limit 1 → 컨테이너에서 인스턴스 자격증명에 접근할 수 없다.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
  }

  tags = { Name = "pillflow-api" }

  # 새 AMI가 나올 때마다 인스턴스가 교체되지 않도록 한다(교체는 의도적으로만).
  lifecycle {
    ignore_changes = [ami]
  }

  # 라우팅이 준비되기 전에 부팅해 user_data(1회성)가 인터넷 연결 없이 실행되는 것을 막는다.
  depends_on = [aws_route_table_association.public]
}

resource "aws_eip" "api" {
  domain   = "vpc"
  instance = aws_instance.api.id
  tags     = { Name = "pillflow-api" }

  # IGW가 준비된 뒤에 EIP를 연결한다.
  depends_on = [aws_internet_gateway.main]
}

# 하드웨어(시스템 상태 검사) 장애 시 EC2 자동 복구
resource "aws_cloudwatch_metric_alarm" "api_system_recover" {
  alarm_name          = "pillflow-api-system-recover"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions          = { InstanceId = aws_instance.api.id }
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover"]
}
