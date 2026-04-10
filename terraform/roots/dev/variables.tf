variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "llm_provider" {
  description = "LLM provider: anthropic, openai, bedrock, or azure"
  type        = string
  default     = "anthropic"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret key for signing JWT tokens"
  type        = string
  sensitive   = true
}
