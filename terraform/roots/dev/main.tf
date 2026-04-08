terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

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
      Project   = "khan-fluent"
      ManagedBy = "terraform"
      Stack     = "skillforge"
    }
  }
}

locals {
  name = "skillforge"
}

################################################################################
# Shared infra coordinates (provisioned by devops-portfolio stack)
################################################################################

data "aws_ssm_parameter" "ecs_cluster_arn" {
  name = "/khan-fluent/ecs/cluster_arn"
}

data "aws_ssm_parameter" "rds_host" {
  name = "/khan-fluent/rds/host"
}

data "aws_ssm_parameter" "rds_port" {
  name = "/khan-fluent/rds/port"
}

data "aws_ssm_parameter" "rds_username" {
  name = "/khan-fluent/rds/username"
}

data "aws_ssm_parameter" "rds_master_secret_arn" {
  name = "/khan-fluent/rds/master_secret_arn"
}

################################################################################
# Application secrets — SSM SecureString (free-tier vs Secrets Manager $0.40/mo)
################################################################################

resource "aws_ssm_parameter" "anthropic_api_key" {
  name  = "/skillforge/anthropic-api-key"
  type  = "SecureString"
  value = var.anthropic_api_key
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
# ECS service on shared khan-fluent cluster
################################################################################

module "ecs_service" {
  source = "git::https://github.com/khan-fluent/terraform-modules.git//modules/ecs-service-ec2?ref=v1"

  service_name       = local.name
  cluster_id         = data.aws_ssm_parameter.ecs_cluster_arn.value
  ecr_repository_url = module.ecr.repository_url
  container_port     = 3003
  log_retention_days = 7
  container_memory   = 192

  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3003" },
    { name = "DB_HOST", value = data.aws_ssm_parameter.rds_host.value },
    { name = "DB_PORT", value = data.aws_ssm_parameter.rds_port.value },
    { name = "DB_NAME", value = "skillforge" },
    { name = "DB_USERNAME", value = data.aws_ssm_parameter.rds_username.value },
  ]

  secrets = [
    {
      name      = "DB_PASSWORD"
      valueFrom = "${data.aws_ssm_parameter.rds_master_secret_arn.value}:password::"
    },
    {
      name      = "ANTHROPIC_API_KEY"
      valueFrom = aws_ssm_parameter.anthropic_api_key.arn
    },
  ]

  execution_role_secretsmanager_arns = [
    data.aws_ssm_parameter.rds_master_secret_arn.value,
  ]

  execution_role_ssm_parameter_arns = [
    aws_ssm_parameter.anthropic_api_key.arn,
  ]
}
