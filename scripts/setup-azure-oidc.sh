#!/usr/bin/env bash
# Bootstrap GitHub OIDC, Azure roles, and remote Terraform state for CI/CD.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-azure-oidc.sh [options]

Options:
  --acr-name NAME       Globally unique Azure Container Registry name
  --repo OWNER/REPO     GitHub repository (default: current repository)
  --project-name NAME   Azure resource prefix (default: northridge-video)
  --location REGION     Azure region (default: westus2)
EOF
}

acr_name=""
repo=""
project_name="northridge-video"
location="westus2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --acr-name)
      acr_name="${2:?Missing value for --acr-name}"
      shift 2
      ;;
    --repo)
      repo="${2:?Missing value for --repo}"
      shift 2
      ;;
    --project-name)
      project_name="${2:?Missing value for --project-name}"
      shift 2
      ;;
    --location)
      location="${2:?Missing value for --location}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in az gh jq openssl; do
  command -v "$command" >/dev/null || {
    echo "Required command not found: $command" >&2
    exit 1
  }
done

if [[ -z "$acr_name" ]]; then
  acr_name="northridgevideo$(openssl rand -hex 4)"
  echo "No ACR name supplied; using globally unique name: $acr_name"
fi
if [[ ! "$acr_name" =~ ^[a-z0-9]{5,50}$ ]]; then
  echo "--acr-name must be 5-50 lowercase letters or numbers." >&2
  exit 2
fi

az account show >/dev/null
gh auth status >/dev/null

if [[ -z "$repo" ]]; then
  repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

subscription_id="$(az account show --query id --output tsv)"
tenant_id="$(az account show --query tenantId --output tsv)"
suffix="$(openssl rand -hex 4)"
app_name="${project_name}-github-oidc-${suffix}"
state_resource_group="${project_name}-tfstate"
state_storage_account="nrvstate${suffix}"
state_container="tfstate"
state_key="${project_name}.tfstate"

echo "Creating Azure OIDC application: $app_name"
app_id="$(az ad app create --display-name "$app_name" --query appId --output tsv)"
az ad sp create --id "$app_id" >/dev/null
service_principal_id="$(az ad sp show --id "$app_id" --query id --output tsv)"

create_federated_credential() {
  local name="$1"
  local subject="$2"
  az ad app federated-credential create \
    --id "$app_id" \
    --parameters "$(jq -n \
      --arg name "$name" \
      --arg subject "$subject" \
      '{
        name: $name,
        issuer: "https://token.actions.githubusercontent.com",
        subject: $subject,
        audiences: ["api://AzureADTokenExchange"],
        description: "GitHub Actions OIDC federation"
      }')" >/dev/null
}

create_federated_credential "github-dev" "repo:${repo}:environment:dev"
create_federated_credential "github-prod" "repo:${repo}:environment:prod"

subscription_scope="/subscriptions/${subscription_id}"
for role in Contributor "Role Based Access Control Administrator" AcrPush; do
  az role assignment create \
    --assignee-object-id "$service_principal_id" \
    --assignee-principal-type ServicePrincipal \
    --role "$role" \
    --scope "$subscription_scope" >/dev/null
done

az group create \
  --name "$state_resource_group" \
  --location "$location" \
  --output none
az storage account create \
  --name "$state_storage_account" \
  --resource-group "$state_resource_group" \
  --location "$location" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --output none
state_storage_id="$(az storage account show \
  --name "$state_storage_account" \
  --resource-group "$state_resource_group" \
  --query id \
  --output tsv)"
az role assignment create \
  --assignee-object-id "$service_principal_id" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$state_storage_id" >/dev/null
az storage container create \
  --name "$state_container" \
  --account-name "$state_storage_account" \
  --auth-mode login \
  --output none

set_repo_variable() {
  gh variable set "$1" --repo "$repo" --body "$2"
}

set_repo_variable AZURE_CLIENT_ID "$app_id"
set_repo_variable AZURE_TENANT_ID "$tenant_id"
set_repo_variable AZURE_SUBSCRIPTION_ID "$subscription_id"
set_repo_variable AZURE_LOCATION "$location"
set_repo_variable ACR_NAME "$acr_name"
set_repo_variable CONTAINER_IMAGE_NAME "northridge-video"
set_repo_variable TF_PROJECT_NAME "$project_name"
set_repo_variable TF_STATE_RESOURCE_GROUP "$state_resource_group"
set_repo_variable TF_STATE_STORAGE_ACCOUNT "$state_storage_account"
set_repo_variable TF_STATE_CONTAINER "$state_container"
set_repo_variable TF_STATE_KEY "$state_key"

gh api --method PUT "repos/${repo}/environments/dev" >/dev/null
gh api --method PUT "repos/${repo}/environments/prod" >/dev/null

echo "Verifying Azure identity and state access..."
az ad sp show --id "$app_id" --query appId --output tsv >/dev/null
for role in Contributor "Role Based Access Control Administrator" AcrPush; do
  az role assignment list \
    --assignee "$service_principal_id" \
    --scope "$subscription_scope" \
    --role "$role" \
    --query '[0].roleDefinitionName' \
    --output tsv | grep -Fx "$role" >/dev/null
done
az storage container show \
  --name "$state_container" \
  --account-name "$state_storage_account" \
  --auth-mode login \
  --output none
gh variable list --repo "$repo" >/dev/null

cat <<EOF
Azure OIDC bootstrap complete for ${repo}.

Service principal client ID: ${app_id}
Subscription: ${subscription_id}
ACR name: ${acr_name}
Terraform state: ${state_storage_account}/${state_container}/${state_key}

The workflow identity intentionally has subscription-scoped Contributor,
Role Based Access Control Administrator, and AcrPush permissions for this POC.
Narrow those assignments before production use.
EOF
