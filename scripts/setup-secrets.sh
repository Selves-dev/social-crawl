#!/bin/bash

# Social Crawl Environment Setup Script
# Sets up secrets in Azure Key Vault and configures environment variables

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KEY_VAULT_NAME="social-crawl-kv"
RESOURCE_GROUP="social-crawl-rg"
SECRETS_FILE=".env.secrets"

echo -e "${BLUE}🔐 Social Crawl Environment Setup${NC}"

# Check if Key Vault exists
if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
    echo -e "${RED}❌ Key Vault '$KEY_VAULT_NAME' not found. Run setup first.${NC}"
    exit 1
fi

# Check if secrets file exists
if [[ ! -f "$SECRETS_FILE" ]]; then
    echo -e "${RED}❌ Secrets file '$SECRETS_FILE' not found.${NC}"
    echo -e "${YELLOW}ℹ️ Please create the file and add your secrets before running this script.${NC}"
    exit 1
fi

echo -e "${BLUE}🔧 Setting up secrets in Azure Key Vault from $SECRETS_FILE...${NC}"

# Function to set secret
set_secret() {
    local secret_name="$1"
    local description="$2"
    
    echo -e "${YELLOW}🔑 Setting up: $description${NC}"
    read -s -p "Enter value for $secret_name: " secret_value
    echo
    
    if [[ -n "$secret_value" ]]; then
        az keyvault secret set \
            --vault-name "$KEY_VAULT_NAME" \
            --name "$secret_name" \
            --value "$secret_value" \
            --description "$description"
        echo -e "${GREEN}✅ Secret '$secret_name' set successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ Skipping empty secret for '$secret_name'${NC}"
    fi
}

# Function to upload secrets from file
upload_secrets_from_file() {
    echo -e "${BLUE}📤 Uploading secrets from $SECRETS_FILE...${NC}"
    
    # Read and process the secrets file
    while IFS='=' read -r key value || [[ -n "$key" ]]; do
        # Skip empty lines and comments
        if [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Clean up the key and value
        key=$(echo "$key" | xargs)  # Remove leading/trailing whitespace
        value=$(echo "$value" | xargs)
        
        if [[ -n "$key" && -n "$value" && "$value" != "your_"* ]]; then
            # Convert to kebab-case for Key Vault naming
            secret_name=$(echo "$key" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
            
            echo -e "${YELLOW}🔑 Uploading: $secret_name${NC}"
            
            az keyvault secret set \
                --vault-name "$KEY_VAULT_NAME" \
                --name "$secret_name" \
                --value "$value" \
                --description "Auto-uploaded from $SECRETS_FILE" \
                > /dev/null
            
            echo -e "${GREEN}✅ Secret '$secret_name' uploaded successfully${NC}"
        elif [[ -n "$key" && "$value" == "your_"* ]]; then
            echo -e "${YELLOW}⚠️ Skipping placeholder value for '$key'${NC}"
        fi
    done < "$SECRETS_FILE"
}

# Main execution - choose upload method
echo -e "${BLUE}📋 Choose secrets upload method:${NC}"
echo -e "  1. Upload from $SECRETS_FILE (recommended)"
echo -e "  2. Interactive input"
read -p "Select option (1-2): " upload_choice

case "$upload_choice" in
    "1")
        upload_secrets_from_file
        ;;
    "2")
        # Azure Service Bus Configuration
        echo -e "${BLUE}📨 Azure Service Bus Configuration${NC}"
        set_secret "azure-service-bus-connection-string" "Azure Service Bus connection string for production"
        set_secret "azure-service-bus-queue-name" "Main queue name (default: post-office)"
        set_secret "azure-service-bus-prep-media-queue" "Prep media throttle queue name (default: prep-media)"
        set_secret "azure-service-bus-ai-service-queue" "AI service throttle queue name (default: ai-service)"

        # MongoDB Configuration
        echo -e "${BLUE}🗄️ MongoDB Configuration${NC}"
        set_secret "mongodb-connection-string" "MongoDB Atlas connection string"
        set_secret "mongodb-database-name" "MongoDB database name"

        # AI Services
        echo -e "${BLUE}🤖 AI Service API Keys${NC}"
        set_secret "openai-api-key" "OpenAI API key for AI processing"
        set_secret "azure-cognitive-services-key" "Azure Cognitive Services key"
        set_secret "azure-cognitive-services-endpoint" "Azure Cognitive Services endpoint"

        # Application Configuration
        echo -e "${BLUE}⚙️ Application Configuration${NC}"
        set_secret "prep-media-max-concurrent-jobs" "Max concurrent jobs for prep-media queue (default: 5)"
        set_secret "ai-service-max-concurrent-jobs" "Max concurrent jobs for ai-service queue (default: 3)"
        set_secret "log-level" "Application log level (default: info)"
        ;;
    *)
        echo -e "${RED}❌ Invalid option selected${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Environment setup completed!${NC}"

# Show current secrets (names only)
echo -e "${BLUE}📋 Secrets in Key Vault:${NC}"
az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[].{Name:name, Updated:attributes.updated}" --output table

echo -e "${YELLOW}ℹ️ Next steps:${NC}"
echo -e "  1. Verify all secrets are correctly set"
echo -e "  2. Run deployment script: ./scripts/deploy.sh prod deploy"
echo -e "  3. Test the deployed application"
