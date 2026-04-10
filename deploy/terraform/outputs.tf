output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = local.cluster_arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.this.name
}

output "log_group" {
  description = "CloudWatch log group for the application"
  value       = aws_cloudwatch_log_group.this.name
}

output "rds_endpoint" {
  description = "RDS endpoint (only set when create_rds = true)"
  value       = var.create_rds ? aws_db_instance.this[0].endpoint : ""
}

output "task_role_arn" {
  description = "ARN of the ECS task role (attach additional policies here for Bedrock, etc.)"
  value       = aws_iam_role.task.arn
}
