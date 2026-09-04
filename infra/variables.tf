# Inputs for the shared Azure Container Apps POC infrastructure.
variable "project_name" {
  description = "Lowercase project name used in Azure resource names."
  type        = string
  default     = "northridge-video"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "project_name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "westus2"
}

variable "acr_name" {
  description = "Globally unique alphanumeric name for the shared Azure Container Registry."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{5,50}$", var.acr_name))
    error_message = "acr_name must be 5-50 characters using only lowercase letters and numbers."
  }
}

variable "container_image_name" {
  description = "Repository name in the shared Azure Container Registry."
  type        = string
  default     = "northridge-video"
}

variable "container_image_tag" {
  description = "Container image tag to deploy in both environments."
  type        = string
  default     = "latest"
}

variable "environments" {
  description = "Container Apps environments and their replica bounds."
  type = map(object({
    min_replicas = number
    max_replicas = number
  }))

  default = {
    dev = {
      min_replicas = 0
      max_replicas = 1
    }
    prod = {
      min_replicas = 0
      max_replicas = 1
    }
  }

  validation {
    condition = alltrue([
      for settings in values(var.environments) :
      settings.min_replicas >= 0 &&
      settings.max_replicas >= settings.min_replicas
    ])
    error_message = "Each environment must have non-negative replicas and max_replicas >= min_replicas."
  }
}

variable "log_analytics_retention_days" {
  description = "Retention period for the shared Log Analytics workspace."
  type        = number
  default     = 30

  validation {
    condition     = var.log_analytics_retention_days >= 7 && var.log_analytics_retention_days <= 730
    error_message = "Log Analytics retention must be between 7 and 730 days."
  }
}
