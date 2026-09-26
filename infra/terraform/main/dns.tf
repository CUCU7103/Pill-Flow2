# Route53에서 구매할 때 자동 생성된 호스팅 영역 — 새로 만들지 않고 참조만 한다.
data "aws_route53_zone" "main" {
  name = "${var.domain_name}."
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.api.public_ip]
}
