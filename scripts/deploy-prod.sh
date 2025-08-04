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




# Step: Upload .env.secrets as a file to the container and set env var references
if [[ -f ".env.secrets" ]]; then
  echo -e "${BLUE}🔐 Syncing secrets from .env.secrets to Azure Container App as container app secrets...${NC}"
  SECRET_ARGS=()
  SECRET_ENV_VARS=()
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    value=$(echo "$value" | xargs)
    SECRET_ARGS+=("$key=$value")
    SECRET_ENV_VARS+=("$key=secretref:$key")
  done < ".env.secrets"
  if (( ${#SECRET_ARGS[@]} > 0 )); then
    echo -e "${BLUE}🔑 Registering container app secrets: ${SECRET_ARGS[*]}${NC}"
    az containerapp secret set --name "social-crawl" --resource-group "social-crawl-rg" --secrets "${SECRET_ARGS[@]}"
  fi
  if (( ${#SECRET_ENV_VARS[@]} > 0 )); then
    echo -e "${BLUE}🔄 Injecting container app secrets as env vars: ${SECRET_ENV_VARS[*]}${NC}"
    az containerapp update --name "social-crawl" --resource-group "social-crawl-rg" --set-env-vars "${SECRET_ENV_VARS[@]}"
  fi
  echo -e "${YELLOW}⚠️  To mount .env.secrets as a file, configure a secret volume in your container app definition.${NC}"
  echo -e "${GREEN}✅ .env.secrets synced to Azure Container App as container app secrets and env vars.${NC}"
fi

# Step: Upload standard env vars from .env as name=value pairs (excluding secrets)
if [[ -f "$ENV_FILE" ]]; then
  echo -e "${BLUE}🔄 Syncing standard env vars from $ENV_FILE to Azure Container App...${NC}"
  STD_ENV_VARS=()
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key=$(echo "$key" | xargs | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    value=$(echo "$value" | xargs)
    # Only add if not already a secretref (avoid overwriting secret envs)
    if ! grep -q "^$key=" .env.secrets 2>/dev/null; then
      STD_ENV_VARS+=("$key=$value")
    fi
  done < "$ENV_FILE"
  if (( ${#STD_ENV_VARS[@]} > 0 )); then
    echo -e "${BLUE}🔄 Injecting standard env vars: ${STD_ENV_VARS[*]}${NC}"
    az containerapp update --name "social-crawl" --resource-group "social-crawl-rg" --set-env-vars "${STD_ENV_VARS[@]}"
  fi
  echo -e "${GREEN}✅ Standard env vars from $ENV_FILE synced to Azure Container App.${NC}"
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

# Step 4: Update Azure Container App with new image
az containerapp update \
  --name "social-crawl" \
  --resource-group "social-crawl-rg" \
  --image "$LATEST_TAG"
echo -e "${GREEN}✅ Azure Container App updated with new image.${NC}"

# Step 5: Output health check URL
APP_URL=$(az containerapp show --name "social-crawl" --resource-group "social-crawl-rg" --query properties.configuration.ingress.fqdn -o tsv)
if [[ -n "$APP_URL" ]]; then
  echo -e "${BLUE}🌐 App URL: https://$APP_URL${NC}"
  echo -e "${BLUE}🏥 Health check: https://$APP_URL/health${NC}"
else
  echo -e "${YELLOW}⚠️ Could not determine app URL. Check Azure portal.${NC}"
fi

echo -e "${GREEN}🎉 Production deployment completed!${NC}"
