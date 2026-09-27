output "namespace_name" {
  description = "Created Kubernetes namespace"
  value       = kubernetes_namespace.smartdoc.metadata[0].name
}

output "config_map_name" {
  description = "Backend ConfigMap name"
  value       = kubernetes_config_map.backend_config.metadata[0].name
}
