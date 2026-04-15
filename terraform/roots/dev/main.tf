terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend is configured per-environment. Override with:
  #   terraform init -backend-config=backend.hcl
  # Or update the bucket/key/region below for your AWS account.
  backend "s3" {
    bucket       = "skillforge-tfstate-282353614364"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Stack     = var.stack
    }
  }
}

locals {
  name = var.stack
}

################################################################################
# Shared infra coordinates (provisioned by the platform stack)
################################################################################

data "aws_ssm_parameter" "ecs_cluster_arn" {
  name = "${var.ssm_prefix}/ecs/cluster_arn"
}

data "aws_ssm_parameter" "rds_host" {
  name = "${var.ssm_prefix}/rds/host"
}

data "aws_ssm_parameter" "rds_port" {
  name = "${var.ssm_prefix}/rds/port"
}

data "aws_ssm_parameter" "rds_username" {
  name = "${var.ssm_prefix}/rds/username"
}

data "aws_ssm_parameter" "rds_master_secret_arn" {
  name = "${var.ssm_prefix}/rds/master_secret_arn"
}

################################################################################
# Application secrets — SSM SecureString (free-tier vs Secrets Manager $0.40/mo)
################################################################################

resource "aws_ssm_parameter" "llm_provider" {
  name  = "/${local.name}/llm-provider"
  type  = "String"
  value = var.llm_provider
}

resource "aws_ssm_parameter" "anthropic_api_key" {
  name  = "/${local.name}/anthropic-api-key"
  type  = "SecureString"
  value = var.anthropic_api_key
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${local.name}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "/${local.name}/encryption-key"
  type  = "SecureString"
  value = var.encryption_key
}

resource "aws_ssm_parameter" "cors_allowed_origins" {
  name  = "/${local.name}/cors-allowed-origins"
  type  = "String"
  value = var.cors_allowed_origins
}

################################################################################
# ECR
################################################################################

module "ecr" {
  source = "git::https://github.com/khan-fluent/terraform-modules.git//modules/ecr?ref=v1"

  name                  = local.name
  lifecycle_description = "Keep only the 3 most recent images"
}

################################################################################
# ECS service on shared cluster
################################################################################

module "ecs_service" {
  source = "git::https://github.com/khan-fluent/terraform-modules.git//modules/ecs-service-ec2?ref=v1"

  service_name       = local.name
  cluster_id         = data.aws_ssm_parameter.ecs_cluster_arn.value
  ecr_repository_url = module.ecr.repository_url
  container_port     = var.container_port
  log_retention_days = var.log_retention_days
  container_memory   = var.container_memory

  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(var.container_port) },
    { name = "DB_HOST", value = data.aws_ssm_parameter.rds_host.value },
    { name = "DB_PORT", value = data.aws_ssm_parameter.rds_port.value },
    { name = "DB_NAME", value = local.name },
    { name = "DB_USERNAME", value = data.aws_ssm_parameter.rds_username.value },
    { name = "AUTH_METHOD", value = var.auth_method },
  ]

  secrets = [
    {
      name      = "DB_PASSWORD"
      valueFrom = "${data.aws_ssm_parameter.rds_master_secret_arn.value}:password::"
    },
    {
      name      = "LLM_PROVIDER"
      valueFrom = aws_ssm_parameter.llm_provider.arn
    },
    {
      name      = "ANTHROPIC_API_KEY"
      valueFrom = aws_ssm_parameter.anthropic_api_key.arn
    },
    {
      name      = "JWT_SECRET"
      valueFrom = aws_ssm_parameter.jwt_secret.arn
    },
    {
      name      = "ENCRYPTION_KEY"
      valueFrom = aws_ssm_parameter.encryption_key.arn
    },
    {
      name      = "CORS_ALLOWED_ORIGINS"
      valueFrom = aws_ssm_parameter.cors_allowed_origins.arn
    },
  ]

  execution_role_secretsmanager_arns = [
    data.aws_ssm_parameter.rds_master_secret_arn.value,
  ]

  execution_role_ssm_parameter_arns = [
    aws_ssm_parameter.llm_provider.arn,
    aws_ssm_parameter.anthropic_api_key.arn,
    aws_ssm_parameter.jwt_secret.arn,
    aws_ssm_parameter.encryption_key.arn,
    aws_ssm_parameter.cors_allowed_origins.arn,
  ]
}
