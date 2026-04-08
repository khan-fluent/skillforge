output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

output "ecs_service_name" {
  description = "Name of the skillforge ECS service"
  value       = module.ecs_service.service_name
}
