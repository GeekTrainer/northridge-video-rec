# Deployment endpoints and image information for the Azure POC.
output "container_registry_login_server" {
  description = "Login server for pushing the Northridge Video image."
  value       = azurerm_container_registry.shared.login_server
}

output "container_app_urls" {
  description = "Public default HTTPS URLs for each environment."
  value = {
    for environment, app in azurerm_container_app.application :
    environment => "https://${app.latest_revision_fqdn}"
  }
}

output "container_app_names" {
  description = "Container App names keyed by environment."
  value = {
    for environment, app in azurerm_container_app.application :
    environment => app.name
  }
}
