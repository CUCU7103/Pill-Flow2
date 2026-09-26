output "instance_id" {
  value = aws_instance.api.id
}

output "api_public_ip" {
  value = aws_eip.api.public_ip
}

output "api_fqdn" {
  value = aws_route53_record.api.fqdn
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
