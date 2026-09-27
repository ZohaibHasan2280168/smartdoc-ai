terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27.0"
    }
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kubeconfig_context
}

# Namespace
resource "kubernetes_namespace" "smartdoc" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name" = "smartdoc-ai"
      "managed-by"             = "terraform"
    }
  }
}

# ConfigMap for Backend
resource "kubernetes_config_map" "backend_config" {
  metadata {
    name      = "backend-config"
    namespace = kubernetes_namespace.smartdoc.metadata[0].name
  }

  data = {
    PROJECT_NAME = "SmartDoc AI Backend"
    ENVIRONMENT  = var.environment
    DATABASE_URL = "postgresql://${var.db_user}:${var.db_password}@postgres.${kubernetes_namespace.smartdoc.metadata[0].name}.svc.cluster.local:5432/${var.db_name}"
    REDIS_URL    = "redis://redis.${kubernetes_namespace.smartdoc.metadata[0].name}.svc.cluster.local:6379/0"
    CORS_ORIGINS = "*"
    OPENAI_MODEL = "gpt-3.5-turbo"
  }
}

# Secret for Backend
resource "kubernetes_secret" "backend_secret" {
  metadata {
    name      = "backend-secret"
    namespace = kubernetes_namespace.smartdoc.metadata[0].name
  }

  data = {
    OPENAI_API_KEY = var.openai_api_key
  }

  type = "Opaque"
}
