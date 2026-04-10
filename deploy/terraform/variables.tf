################################################################################
# Required — must be provided
################################################################################

variable "image" {
  description = "Full Docker image URI (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/skillforge:latest or ghcr.io/org/skillforge:1.0.0)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the service will run"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ECS service (private subnets recommended)"
  type        = list(string)
}

variable "jwt_secret" {
  description = "Secret key for signing JWT tokens (min 32 characters)"
  type        = string
  sensitive   = true
}

################################################################################
# Database — provide either an existing connection or let the module create RDS
################################################################################

variable "db_host" {
  description = "PostgreSQL host (provide this to use an existing database)"
  type        = string
  default     = ""
}

variable "db_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "skillforge"
}

variable "db_username" {
  description = "PostgreSQL username"
  type        = string
  default     = "skillforge"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "create_rds" {
  description = "Set to true to provision a new RDS PostgreSQL instance"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class (only used when create_rds = true)"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "RDS storage in GB (only used when create_rds = true)"
  type        = number
  default     = 20
}

################################################################################
# ECS configuration
################################################################################

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name prefix for all resources"
  type        = string
  default     = "skillforge"
}

variable "ecs_cluster_arn" {
  description = "ARN of an existing ECS cluster (leave empty to create a new one)"
  type        = string
  default     = ""
}

variable "launch_type" {
  description = "ECS launch type: FARGATE or EC2"
  type        = string
  default     = "FARGATE"
}

variable "cpu" {
  description = "Fargate CPU units (256, 512, 1024, etc.)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate memory in MB (512, 1024, etc.)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

variable "container_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3003
}

variable "assign_public_ip" {
  description = "Whether to assign a public IP to ECS tasks (set true if using public subnets)"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

################################################################################
# Application config
################################################################################

variable "llm_provider" {
  description = "LLM provider: anthropic, openai, bedrock, or azure"
  type        = string
  default     = "anthropic"
}

variable "llm_api_key" {
  description = "API key for the configured LLM provider (not needed for bedrock)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "llm_chat_model" {
  description = "Override the default chat model (optional — each provider has sensible defaults)"
  type        = string
  default     = ""
}

variable "llm_fast_model" {
  description = "Override the default fast/generation model (optional)"
  type        = string
  default     = ""
}

variable "auth_method" {
  description = "Authentication method: local, oidc, or saml"
  type        = string
  default     = "local"
}

variable "extra_env_vars" {
  description = "Additional environment variables to pass to the container (for SSO config, etc.)"
  type        = map(string)
  default     = {}
}

variable "extra_secrets" {
  description = "Additional secrets from SSM/Secrets Manager (map of ENV_NAME → SSM ARN)"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
