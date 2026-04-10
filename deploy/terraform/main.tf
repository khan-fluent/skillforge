################################################################################
# Skillforge — Standalone Deployment for Any AWS Account
#
# This Terraform root deploys Skillforge on ECS Fargate (or EC2).
# It can either create its own ECS cluster + RDS or connect to existing ones.
#
# Quick start:
#   1. Copy terraform.tfvars.example → terraform.tfvars and fill in values
#   2. Run: terraform init && terraform plan
#   3. Run: terraform apply
################################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state:
  # backend "s3" {
  #   bucket       = "YOUR-STATE-BUCKET"
  #   key          = "skillforge/terraform.tfstate"
  #   region       = "us-east-1"
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge({
      Application = var.name
      ManagedBy   = "terraform"
    }, var.tags)
  }
}

data "aws_caller_identity" "current" {}

################################################################################
# ECS Cluster — create one or use an existing one
################################################################################

resource "aws_ecs_cluster" "this" {
  count = var.ecs_cluster_arn == "" ? 1 : 0
  name  = var.name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

locals {
  cluster_arn = var.ecs_cluster_arn != "" ? var.ecs_cluster_arn : aws_ecs_cluster.this[0].arn
}

################################################################################
# RDS PostgreSQL — create one or use an existing connection
################################################################################

resource "aws_db_subnet_group" "this" {
  count      = var.create_rds ? 1 : 0
  name       = "${var.name}-db"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "rds" {
  count       = var.create_rds ? 1 : 0
  name        = "${var.name}-rds"
  description = "Allow PostgreSQL from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "random_password" "db" {
  count   = var.create_rds && var.db_password == "" ? 1 : 0
  length  = 32
  special = false
}

resource "aws_db_instance" "this" {
  count = var.create_rds ? 1 : 0

  identifier           = var.name
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.rds_instance_class
  allocated_storage    = var.rds_allocated_storage
  db_name              = var.db_name
  username             = var.db_username
  password             = var.db_password != "" ? var.db_password : random_password.db[0].result
  db_subnet_group_name = aws_db_subnet_group.this[0].name
  vpc_security_group_ids = [aws_security_group.rds[0].id]
  skip_final_snapshot  = true
  publicly_accessible  = false
}

locals {
  db_host     = var.create_rds ? aws_db_instance.this[0].address : var.db_host
  db_port     = var.create_rds ? tostring(aws_db_instance.this[0].port) : tostring(var.db_port)
  db_password = var.create_rds ? (var.db_password != "" ? var.db_password : random_password.db[0].result) : var.db_password
}

################################################################################
# Secrets — stored in SSM Parameter Store
################################################################################

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.name}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/${var.name}/db-password"
  type  = "SecureString"
  value = local.db_password
}

resource "aws_ssm_parameter" "llm_api_key" {
  count = var.llm_api_key != "" ? 1 : 0
  name  = "/${var.name}/llm-api-key"
  type  = "SecureString"
  value = var.llm_api_key
}

################################################################################
# Security Group for ECS tasks
################################################################################

resource "aws_security_group" "ecs" {
  count       = var.create_rds ? 1 : 0
  name        = "${var.name}-ecs"
  description = "Skillforge ECS tasks"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

################################################################################
# CloudWatch Logs
################################################################################

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
}

################################################################################
# IAM — ECS task execution role + task role
################################################################################

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_base" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

locals {
  ssm_arns = concat(
    [
      aws_ssm_parameter.jwt_secret.arn,
      aws_ssm_parameter.db_password.arn,
    ],
    var.llm_api_key != "" ? [aws_ssm_parameter.llm_api_key[0].arn] : [],
    values(var.extra_secrets),
  )
}

resource "aws_iam_role_policy" "execution_ssm" {
  name = "${var.name}-ssm-access"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters"]
      Resource = local.ssm_arns
    }]
  })
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

################################################################################
# LLM provider → env var mapping
################################################################################

locals {
  llm_env_name = {
    anthropic = "ANTHROPIC_API_KEY"
    openai    = "OPENAI_API_KEY"
    azure     = "AZURE_OPENAI_API_KEY"
    bedrock   = ""
  }
}

################################################################################
# ECS Task Definition
################################################################################

locals {
  base_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(var.container_port) },
    { name = "DB_HOST", value = local.db_host },
    { name = "DB_PORT", value = local.db_port },
    { name = "DB_NAME", value = var.db_name },
    { name = "DB_USERNAME", value = var.db_username },
    { name = "LLM_PROVIDER", value = var.llm_provider },
    { name = "AUTH_METHOD", value = var.auth_method },
  ]

  model_env = concat(
    var.llm_chat_model != "" ? [{ name = "LLM_CHAT_MODEL", value = var.llm_chat_model }] : [],
    var.llm_fast_model != "" ? [{ name = "LLM_FAST_MODEL", value = var.llm_fast_model }] : [],
  )

  extra_env = [for k, v in var.extra_env_vars : { name = k, value = v }]

  base_secrets = [
    { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
    { name = "DB_PASSWORD", valueFrom = aws_ssm_parameter.db_password.arn },
  ]

  llm_secret = var.llm_api_key != "" ? [{
    name      = local.llm_env_name[var.llm_provider]
    valueFrom = aws_ssm_parameter.llm_api_key[0].arn
  }] : []

  extra_secret_list = [for k, v in var.extra_secrets : { name = k, valueFrom = v }]
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = [var.launch_type]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = var.name
    image     = var.image
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = concat(local.base_env, local.model_env, local.extra_env)
    secrets     = concat(local.base_secrets, local.llm_secret, local.extra_secret_list)

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = var.name
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.container_port}/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 15
    }
  }])
}

################################################################################
# ECS Service
################################################################################

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = local.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = var.launch_type

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.create_rds ? [aws_security_group.ecs[0].id] : []
    assign_public_ip = var.assign_public_ip
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [task_definition]
  }
}
