#!/bin/bash
set -e

echo -e "\033[1;34m🧹 Cleaning and building production...\033[0m"
./scripts/build-clean.sh prod
set -e

# Colors for output
BLUE='\033[1;34m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

# Paths
ENV_FILE=".env"
BUILD_DIR="builds/prod"
DOCKERFILE_PATH="$BUILD_DIR/Dockerfile"

# Step 1: Check for .env file

# If .env.secrets exists, append its contents to .env (secrets take precedence)

# Step: Sync secrets from .env.secrets to Azure Key Vault
if [[ -f ".env.secrets" ]]; then
  echo -e "${BLUE}🔐 Syncing secrets from .env.secrets to Azure Key Vault (always updating)...${NC}"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    key_dash=$(echo "$key" | tr '_' '-')
    echo -e "${BLUE}� Setting secret '$key_dash' in Key Vault${NC}"
    az keyvault secret set --vault-name "social-crawl-va" --name "$key_dash" --value "$value"
  done < ".env.secrets"
  echo -e "${GREEN}✅ .env.secrets synced to Azure Key Vault (all secrets updated).${NC}"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}❌ .env file not found in project root after merging. Aborting.${NC}"
  exit 1
fi

# Step 2: Merge .env into Dockerfile as ENV instructions


# Step 3: Build and push Docker image
IMAGE_TAG="socialcrawlcr.azurecr.io/social-crawl:$(date +%Y%m%d_%H%M%S)"
LATEST_TAG="socialcrawlcr.azurecr.io/social-crawl:latest"
echo -e "${BLUE}🔨 Building Docker image for linux/amd64 platform in directory: $BUILD_DIR${NC}"
docker buildx build --platform linux/amd64 -t "$IMAGE_TAG" -t "$LATEST_TAG" --push "$BUILD_DIR"
echo -e "${GREEN}✅ Docker image built and pushed for linux/amd64.${NC}"

# Step 4: Update Azure Container App with new image

# Step 4a: Update Azure Container App with new image
az containerapp update \
  --name "social-crawl" \
  --resource-group "social-crawl-rg" \
  --image "$LATEST_TAG"
echo -e "${GREEN}✅ Azure Container App updated with new image.${NC}"

# Step 4b: Update Azure Container App environment variables from .env
echo -e "${BLUE}🔄 Updating Azure Container App environment variables from .env...${NC}"
ENV_STRING=$(bash scripts/env-to-azure-string.sh)
az containerapp update \
  --name "social-crawl" \
  --resource-group "social-crawl-rg" \
  --set-env-vars $ENV_STRING
echo -e "${GREEN}✅ Azure Container App environment variables updated from .env.${NC}"

# Step 5: Output health check URL
APP_URL=$(az containerapp show --name "social-crawl" --resource-group "social-crawl-rg" --query properties.configuration.ingress.fqdn -o tsv)
if [[ -n "$APP_URL" ]]; then
  echo -e "${BLUE}🌐 App URL: https://$APP_URL${NC}"
  echo -e "${BLUE}🏥 Health check: https://$APP_URL/health${NC}"
else
  echo -e "${YELLOW}⚠️ Could not determine app URL. Check Azure portal.${NC}"
fi

echo -e "${GREEN}🎉 Production deployment completed!${NC}"
