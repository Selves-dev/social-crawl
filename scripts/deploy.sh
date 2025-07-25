#!/bin/bash

# Social Crawl Deployment Script
# Deploys the application to Azure with environment setup and secret management

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT=${1:-prod}
ACTION=${2:-deploy}  # deploy, check, setup, remove
RESOURCE_GROUP="social-crawl-rg"
APP_NAME="social-crawl"
LOCATION="eastus"
KEY_VAULT_NAME="social-crawl-kv"
CONTAINER_REGISTRY="socialcrawlacr"
BUILD_DIR="builds/$ENVIRONMENT"

echo -e "${BLUE}🚀 Social Crawl Deployment Script${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Action: $ACTION${NC}"

# Validate inputs
if [[ "$ENVIRONMENT" != "local" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}❌ Invalid environment. Use 'local' or 'prod'${NC}"
    exit 1
fi

if [[ "$ACTION" != "deploy" && "$ACTION" != "check" && "$ACTION" != "setup" && "$ACTION" != "remove" ]]; then
    echo -e "${RED}❌ Invalid action. Use 'deploy', 'check', 'setup', or 'remove'${NC}"
    exit 1
fi

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        echo -e "${RED}❌ Azure CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
        exit 1
    fi
    
    # Check if logged into Azure
    if ! az account show &> /dev/null; then
        echo -e "${RED}❌ Not logged into Azure. Please run: az login${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Check current Azure environment
check_environment() {
    echo -e "${BLUE}🔍 Checking current Azure environment...${NC}"
    
    # Get current subscription
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    
    echo -e "${BLUE}📍 Current subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)${NC}"
    
    # Check resource group
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}✅ Resource group '$RESOURCE_GROUP' exists${NC}"
        
        # List resources in the group
        echo -e "${BLUE}📋 Resources in $RESOURCE_GROUP:${NC}"
        az resource list --resource-group "$RESOURCE_GROUP" --query "[].{Name:name, Type:type, Location:location}" --output table
    else
        echo -e "${YELLOW}⚠️ Resource group '$RESOURCE_GROUP' does not exist${NC}"
    fi
    
    # Check Key Vault
    if az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
        echo -e "${GREEN}✅ Key Vault '$KEY_VAULT_NAME' exists${NC}"
        
        # List secrets (names only)
        echo -e "${BLUE}🔐 Secrets in Key Vault:${NC}"
        az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[].name" --output table
    else
        echo -e "${YELLOW}⚠️ Key Vault '$KEY_VAULT_NAME' does not exist${NC}"
    fi
    
    # Check Container Registry
    if az acr show --name "$CONTAINER_REGISTRY" &> /dev/null; then
        echo -e "${GREEN}✅ Container Registry '$CONTAINER_REGISTRY' exists${NC}"
    else
        echo -e "${YELLOW}⚠️ Container Registry '$CONTAINER_REGISTRY' does not exist${NC}"
    fi
    
    # Check Service Bus and Queues
    if az servicebus namespace show --name "social-crawl-sb" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}✅ Service Bus Namespace 'social-crawl-sb' exists${NC}"
        
        # Check queues
        echo -e "${BLUE}📬 Service Bus Queues:${NC}"
        az servicebus queue list \
            --namespace-name "social-crawl-sb" \
            --resource-group "$RESOURCE_GROUP" \
            --query "[].{Name:name, Status:status, MessageCount:messageCount}" \
            --output table
    else
        echo -e "${YELLOW}⚠️ Service Bus Namespace 'social-crawl-sb' does not exist${NC}"
    fi
}

# Setup Azure resources
setup_azure_resources() {
    echo -e "${BLUE}🏗️ Setting up Azure resources...${NC}"
    
    # Create resource group
    echo -e "${BLUE}📁 Creating resource group...${NC}"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    
    # Create Key Vault (if it doesn't exist)
    echo -e "${BLUE}🔐 Setting up Key Vault...${NC}"
    if az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
        echo -e "${GREEN}✅ Key Vault '$KEY_VAULT_NAME' already exists${NC}"
    else
        echo -e "${BLUE}🔐 Creating Key Vault...${NC}"
        az keyvault create \
            --name "$KEY_VAULT_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku standard
        echo -e "${GREEN}✅ Key Vault '$KEY_VAULT_NAME' created${NC}"
    fi
    
    # Create Service Bus Namespace (if it doesn't exist)
    echo -e "${BLUE}📨 Setting up Service Bus Namespace...${NC}"
    if az servicebus namespace show --name "social-crawl-sb" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}✅ Service Bus Namespace 'social-crawl-sb' already exists${NC}"
    else
        echo -e "${BLUE}📨 Creating Service Bus Namespace...${NC}"
        az servicebus namespace create \
            --name "social-crawl-sb" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku Basic
        echo -e "${GREEN}✅ Service Bus Namespace 'social-crawl-sb' created${NC}"
    fi
    
    # Create Service Bus Queues (if they don't exist)
    echo -e "${BLUE}📬 Setting up Service Bus Queues...${NC}"
    
    # Function to create queue if it doesn't exist
    create_queue_if_not_exists() {
        local queue_name="$1"
        if az servicebus queue show --namespace-name "social-crawl-sb" --resource-group "$RESOURCE_GROUP" --name "$queue_name" &> /dev/null; then
            echo -e "${GREEN}✅ Queue '$queue_name' already exists${NC}"
        else
            echo -e "${BLUE}📬 Creating queue '$queue_name'...${NC}"
            az servicebus queue create \
                --namespace-name "social-crawl-sb" \
                --resource-group "$RESOURCE_GROUP" \
                --name "$queue_name" \
                --max-size 1024 \
                --default-message-time-to-live "P14D"
            echo -e "${GREEN}✅ Queue '$queue_name' created${NC}"
        fi
    }
    
    # Create queues
    create_queue_if_not_exists "post-office"
    create_queue_if_not_exists "prep-media"
    create_queue_if_not_exists "ai-service"
    
    # Create Container Registry (if it doesn't exist)
    echo -e "${BLUE}🐳 Setting up Container Registry...${NC}"
    if az acr show --name "$CONTAINER_REGISTRY" &> /dev/null; then
        echo -e "${GREEN}✅ Container Registry '$CONTAINER_REGISTRY' already exists${NC}"
    else
        echo -e "${BLUE}🐳 Creating Container Registry...${NC}"
        az acr create \
            --name "$CONTAINER_REGISTRY" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku Basic \
            --admin-enabled true
        echo -e "${GREEN}✅ Container Registry '$CONTAINER_REGISTRY' created${NC}"
    fi
    
    # Create App Service Plan (if it doesn't exist)
    echo -e "${BLUE}🏭 Setting up App Service Plan...${NC}"
    if az appservice plan show --name "${APP_NAME}-plan" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}✅ App Service Plan '${APP_NAME}-plan' already exists${NC}"
    else
        echo -e "${BLUE}🏭 Creating App Service Plan...${NC}"
        az appservice plan create \
            --name "${APP_NAME}-plan" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --is-linux \
            --sku B1
        echo -e "${GREEN}✅ App Service Plan '${APP_NAME}-plan' created${NC}"
    fi
    
    # Create Web App (if it doesn't exist)
    echo -e "${BLUE}🌐 Setting up Web App...${NC}"
    if az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${GREEN}✅ Web App '$APP_NAME' already exists${NC}"
    else
        echo -e "${BLUE}🌐 Creating Web App...${NC}"
        az webapp create \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --plan "${APP_NAME}-plan" \
            --deployment-container-image-name "${CONTAINER_REGISTRY}.azurecr.io/${APP_NAME}:latest"
        echo -e "${GREEN}✅ Web App '$APP_NAME' created${NC}"
    fi
    
    # Setup Service Bus queues
    echo -e "${BLUE}📬 Setting up Service Bus queues...${NC}"
    if "$SCRIPT_DIR/setup-queues.sh" "$ENVIRONMENT"; then
        echo -e "${GREEN}✅ Service Bus queues setup completed${NC}"
    else
        echo -e "${YELLOW}⚠️ Service Bus queue setup failed, but continuing...${NC}"
    fi
    
    echo -e "${GREEN}✅ Azure resources setup completed${NC}"
}

# Remove Azure resources
remove_azure_resources() {
    echo -e "${YELLOW}⚠️ This will remove ALL resources in the '$RESOURCE_GROUP' resource group!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🗑️ Removing resource group and all resources...${NC}"
        az group delete --name "$RESOURCE_GROUP" --yes
        echo -e "${GREEN}✅ Resources removed${NC}"
    else
        echo -e "${BLUE}ℹ️ Operation cancelled${NC}"
    fi
}

# Deploy application
deploy_application() {
    echo -e "${BLUE}🚀 Deploying application...${NC}"
    
    # Check if build exists
    if [[ ! -d "$BUILD_DIR" ]]; then
        echo -e "${RED}❌ Build directory '$BUILD_DIR' not found. Run build script first.${NC}"
        exit 1
    fi
    
    # Login to container registry
    echo -e "${BLUE}🔑 Logging into Container Registry...${NC}"
    az acr login --name "$CONTAINER_REGISTRY"
    
    # Build and push Docker image
    IMAGE_TAG="${CONTAINER_REGISTRY}.azurecr.io/${APP_NAME}:$(date +%Y%m%d_%H%M%S)"
    LATEST_TAG="${CONTAINER_REGISTRY}.azurecr.io/${APP_NAME}:latest"
    
    echo -e "${BLUE}🐳 Building Docker image...${NC}"
    docker build -t "$IMAGE_TAG" -t "$LATEST_TAG" "$BUILD_DIR"
    
    echo -e "${BLUE}📤 Pushing Docker image...${NC}"
    docker push "$IMAGE_TAG"
    docker push "$LATEST_TAG"
    
    # Update web app with new image
    echo -e "${BLUE}🔄 Updating Web App...${NC}"
    az webapp config container set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --docker-custom-image-name "$LATEST_TAG"
    
    # Configure app settings from Key Vault
    echo -e "${BLUE}⚙️ Configuring app settings...${NC}"
    
    # Set Key Vault references for secrets
    az webapp config appsettings set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
        AZURE_SERVICE_BUS_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=azure-service-bus-connection-string)" \
        MONGODB_CONNECTION_STRING="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=mongodb-connection-string)" \
        MONGODB_DATABASE_NAME="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=mongodb-database-name)" \
        OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=openai-api-key)" \
        AZURE_COGNITIVE_SERVICES_KEY="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=azure-cognitive-services-key)" \
        AZURE_COGNITIVE_SERVICES_ENDPOINT="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=azure-cognitive-services-endpoint)" \
        CLOUDINARY_CLOUD_NAME="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=cloudinary-cloud-name)" \
        CLOUDINARY_API_KEY="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=cloudinary-api-key)" \
        CLOUDINARY_API_SECRET="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=cloudinary-api-secret)" \
        NODE_ENV="production" \
        PORT="8000" \
        WEBSITES_PORT="8000" \
        AZURE_SERVICE_BUS_QUEUE_NAME="post-office" \
        AZURE_SERVICE_BUS_PREP_MEDIA_QUEUE="prep-media" \
        AZURE_SERVICE_BUS_AI_SERVICE_QUEUE="ai-service" \
        PREP_MEDIA_MAX_CONCURRENT_JOBS="5" \
        AI_SERVICE_MAX_CONCURRENT_JOBS="3" \
        LOG_LEVEL="info" \
        ENABLE_WORKFLOW_TRACKING="true" \
        ENABLE_QUEUE_MONITORING="true" \
        ENABLE_HEALTH_CHECKS="true"
    
    # Restart the app
    echo -e "${BLUE}🔄 Restarting Web App...${NC}"
    az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"
    
    # Get the app URL
    APP_URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    
    echo -e "${GREEN}✅ Deployment completed!${NC}"
    echo -e "${BLUE}🌐 App URL: https://$APP_URL${NC}"
    echo -e "${BLUE}🏥 Health check: https://$APP_URL/health${NC}"
}

# Main execution
case "$ACTION" in
    "check")
        check_prerequisites
        check_environment
        ;;
    "setup")
        check_prerequisites
        setup_azure_resources
        ;;
    "remove")
        check_prerequisites
        remove_azure_resources
        ;;
    "deploy")
        check_prerequisites
        check_environment
        deploy_application
        ;;
    *)
        echo -e "${RED}❌ Unknown action: $ACTION${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Script completed successfully!${NC}"
