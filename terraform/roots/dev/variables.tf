################################################################################
# Infrastructure coordinates
################################################################################

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Parent project namespace (used for SSM path prefixes and tags)"
  type        = string
  default     = "khan-fluent"
}

variable "stack" {
  description = "Stack name for this application"
  type        = string
  default     = "skillforge"
}

variable "ssm_prefix" {
  description = "SSM parameter prefix for shared infra coordinates"
  type        = string
  default     = "/khan-fluent"
}

variable "terraform_modules_source" {
  description = "Git URL base for shared Terraform modules"
  type        = string
  default     = "git::https://github.com/khan-fluent/terraform-modules.git"
}

################################################################################
# Application config
################################################################################

variable "llm_provider" {
  description = "LLM provider: anthropic, openai, bedrock, or azure"
  type        = string
  default     = "anthropic"
}

variable "auth_method" {
  description = "Authentication method: local, oidc, or saml"
  type        = string
  default     = "local"
}

variable "container_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3003
}

variable "container_memory" {
  description = "Container memory in MB"
  type        = number
  default     = 192
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

################################################################################
# Secrets
################################################################################

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude (only needed if llm_provider=anthropic)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "Secret key for signing JWT tokens"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "AES-256 key for encrypting secrets at rest (64-char hex). Generate with: openssl rand -hex 32"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Comma-separated allowed CORS origins"
  type        = string
  default     = "https://skillforge.khanfluent.digital"
}
