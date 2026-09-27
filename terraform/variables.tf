variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Kubernetes context to target (e.g. minikube)"
  type        = string
  default     = "minikube"
}

variable "namespace" {
  description = "Kubernetes namespace for SmartDoc AI"
  type        = string
  default     = "smartdoc-ai"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "db_user" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  default   = "postgres"
  sensitive = true
}

variable "db_name" {
  type    = string
  default = "smartdoc_db"
}

variable "openai_api_key" {
  type      = string
  default   = ""
  sensitive = true
}
