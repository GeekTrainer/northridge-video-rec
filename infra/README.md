# Azure Container Apps infrastructure

This Terraform root creates a low-cost POC deployment in West US 2:

- One shared Basic Azure Container Registry
- One shared Log Analytics workspace
- Separate resource groups and Container Apps environments for `dev` and `prod`
- One externally reachable Container App per environment on port 3000
- User-assigned managed identities with `AcrPull` access
- Zero-to-one replicas in both environments

The application image must be pushed to the shared registry before the
Container Apps can start. The registry name is required because Azure Container
Registry names are globally unique.

```bash
az login
az account set --subscription "$ARM_SUBSCRIPTION_ID"

cp dev.tfvars.example dev.tfvars
# Edit dev.tfvars with a unique acr_name.

terraform init
terraform fmt -recursive
terraform validate
# Create the shared registry first so the image can be pushed.
terraform apply -target=azurerm_container_registry.shared -var-file=dev.tfvars
```

Build and push the image, then apply the complete infrastructure:

```bash
az acr login --name <acr_name>
docker build --tag <acr_login_server>/northridge-video:latest ..
docker push <acr_login_server>/northridge-video:latest

terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

Use a separate `prod.tfvars` file and Terraform state for production. Store
Terraform state in a remote backend before using this configuration beyond the
POC.

## GitHub Actions

Run `scripts/setup-azure-oidc.sh` from a machine authenticated to both Azure CLI
and GitHub CLI. It generates a globally unique ACR name by default; pass
`--acr-name <globally-unique-name>` if you want to choose one. It creates the
federated OIDC application, the low-cost Blob state backend, the required
repository variables, and the `dev`/`prod` GitHub environments.

After setup:

1. Run **Provision Azure infrastructure** once from the Actions tab. It
   creates the shared registry, pushes the current commit image, and creates
   both Container Apps environments.
2. Merges to `main` run the test workflow, then build and deploy an immutable
   commit-SHA image to dev.
3. Run **Deploy prod** manually to promote the latest successful dev image
   without rebuilding it.

The bootstrap identity uses subscription-scoped `Contributor`,
`Role Based Access Control Administrator`, and `AcrPush` roles for this POC.
Replace these with narrower assignments before production use.
