# Shared ACR plus isolated dev/prod Container Apps environments.
locals {
  shared_resource_group_name = "${var.project_name}-shared"
  resource_group_names = {
    for environment in keys(var.environments) :
    environment => "${var.project_name}-${environment}"
  }
  container_app_names = {
    for environment in keys(var.environments) :
    environment => "${var.project_name}-${environment}"
  }
}

resource "azurerm_resource_group" "shared" {
  name     = local.shared_resource_group_name
  location = var.location
}

resource "azurerm_resource_group" "environment" {
  for_each = var.environments

  name     = local.resource_group_names[each.key]
  location = var.location
}

resource "azurerm_container_registry" "shared" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.shared.name
  location            = azurerm_resource_group.shared.location
  sku                 = "Basic"
  admin_enabled       = false
}

resource "azurerm_log_analytics_workspace" "shared" {
  name                = "${var.project_name}-logs"
  resource_group_name = azurerm_resource_group.shared.name
  location            = azurerm_resource_group.shared.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days
}

resource "azurerm_container_app_environment" "environment" {
  for_each = var.environments

  name                       = "${var.project_name}-${each.key}-cae"
  resource_group_name        = azurerm_resource_group.environment[each.key].name
  location                   = azurerm_resource_group.environment[each.key].location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.shared.id
}

resource "azurerm_user_assigned_identity" "container_app" {
  for_each = var.environments

  name                = "${var.project_name}-${each.key}-identity"
  resource_group_name = azurerm_resource_group.environment[each.key].name
  location            = azurerm_resource_group.environment[each.key].location
}

resource "azurerm_role_assignment" "acr_pull" {
  for_each = var.environments

  scope                = azurerm_container_registry.shared.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.container_app[each.key].principal_id
}

resource "azurerm_container_app" "application" {
  for_each = var.environments

  name                         = local.container_app_names[each.key]
  resource_group_name          = azurerm_resource_group.environment[each.key].name
  container_app_environment_id = azurerm_container_app_environment.environment[each.key].id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.container_app[each.key].id]
  }

  registry {
    server   = azurerm_container_registry.shared.login_server
    identity = azurerm_user_assigned_identity.container_app[each.key].id
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas

    container {
      name   = var.container_image_name
      image  = "${azurerm_container_registry.shared.login_server}/${var.container_image_name}:${var.container_image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}
