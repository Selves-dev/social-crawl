#!/bin/bash

# Deploy Gemma 3n E4B to Azure AI Model Catalog (Azure AI Studio)
# This eliminates memory management issues and provides managed infrastructure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="social-crawler-rg"
AI_STUDIO_NAME="social-crawler-ai"
MODEL_NAME="gemma-3n-e4b"
DEPLOYMENT_NAME="gemma-e4b-deployment"
REGIONS=("uksouth" "westeurope" "eastus" "westus2")

echo -e "${BLUE}🚀 Starting Gemma 3n E4B deployment to Azure AI Model Catalog...${NC}"

# Check Azure login
echo -e "${BLUE}🔐 Checking Azure login...${NC}"
if ! az account show > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Not logged in to Azure. Please log in...${NC}"
    az login
fi

# Install Azure ML extension
echo -e "${BLUE}🔧 Installing Azure ML extension...${NC}"
az extension add --name ml --yes --only-show-errors 2>/dev/null || true

# Function to try deployment in a region
try_ai_studio_deployment() {
    local region=$1
    local workspace_name="${AI_STUDIO_NAME}-${region}"
    
    echo -e "${BLUE}🌍 Trying Azure AI Studio deployment in ${region}...${NC}"
    
    # Create resource group in this region
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$region" \
        --output none 2>/dev/null || true
    
    # Create Azure AI Studio workspace
    echo -e "${BLUE}🏗️ Creating Azure AI Studio workspace in ${region}...${NC}"
    if ! az ml workspace show --name "$workspace_name" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
        az ml workspace create \
            --name "$workspace_name" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$region" \
            --output none
    fi
    
    # Check available models
    echo -e "${BLUE}🔍 Checking available Gemma models...${NC}"
    available_models=$(az ml model list \
        --workspace-name "$workspace_name" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[?contains(name, 'gemma')].name" -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$available_models" ]]; then
        echo -e "${YELLOW}⚠️ Checking model catalog for Gemma models...${NC}"
        # Try to find Gemma in model catalog
        catalog_models=$(az ml model list \
            --workspace-name "$workspace_name" \
            --resource-group "$RESOURCE_GROUP" \
            --include-model-catalog \
            --query "[?contains(name, 'Gemma') || contains(name, 'gemma')].{name:name, version:version}" -o table 2>/dev/null || echo "")
        
        if [[ -n "$catalog_models" ]]; then
            echo -e "${GREEN}✅ Found Gemma models in catalog:${NC}"
            echo "$catalog_models"
        else
            echo -e "${RED}❌ No Gemma models found in ${region}${NC}"
            return 1
        fi
    fi
    
    # Create online endpoint
    echo -e "${BLUE}🔗 Creating online endpoint...${NC}"
    endpoint_name="${MODEL_NAME}-endpoint-${region}"
    
    # Check if endpoint exists
    if az ml online-endpoint show --name "$endpoint_name" --workspace-name "$workspace_name" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Endpoint already exists, deleting...${NC}"
        az ml online-endpoint delete \
            --name "$endpoint_name" \
            --workspace-name "$workspace_name" \
            --resource-group "$RESOURCE_GROUP" \
            --yes --no-wait
        sleep 30
    fi
    
    # Create endpoint configuration
    cat > endpoint-config.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/managedOnlineEndpoint.schema.json
name: ${endpoint_name}
description: Gemma 3n E4B endpoint for social crawler
auth_mode: key
EOF
    
    # Create the endpoint
    if az ml online-endpoint create \
        --file endpoint-config.yml \
        --workspace-name "$workspace_name" \
        --resource-group "$RESOURCE_GROUP" \
        --output none; then
        
        echo -e "${GREEN}✅ Endpoint created successfully!${NC}"
        
        # Create deployment configuration for model catalog model
        cat > deployment-config.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/managedOnlineDeployment.schema.json
name: ${DEPLOYMENT_NAME}
endpoint_name: ${endpoint_name}
model: azureml://registries/azureml/models/Gemma-2b-it/versions/1
instance_type: Standard_NC6s_v3
instance_count: 1
environment_variables:
  TEMPERATURE: "0.7"
  MAX_TOKENS: "2048"
EOF
        
        echo -e "${BLUE}🚀 Deploying Gemma model...${NC}"
        if az ml online-deployment create \
            --file deployment-config.yml \
            --workspace-name "$workspace_name" \
            --resource-group "$RESOURCE_GROUP" \
            --all-traffic \
            --output none; then
            
            echo -e "${GREEN}✅ Model deployed successfully!${NC}"
            
            # Get endpoint details
            ENDPOINT_URI=$(az ml online-endpoint show \
                --name "$endpoint_name" \
                --workspace-name "$workspace_name" \
                --resource-group "$RESOURCE_GROUP" \
                --query scoring_uri -o tsv)
            
            ENDPOINT_KEY=$(az ml online-endpoint get-credentials \
                --name "$endpoint_name" \
                --workspace-name "$workspace_name" \
                --resource-group "$RESOURCE_GROUP" \
                --query primaryKey -o tsv)
            
            echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
            echo -e "${GREEN}🔗 Endpoint URI: ${ENDPOINT_URI}${NC}"
            echo -e "${GREEN}🔑 Endpoint Key: ${ENDPOINT_KEY}${NC}"
            echo -e "${GREEN}🌍 Region: ${region}${NC}"
            echo -e "${GREEN}💼 Workspace: ${workspace_name}${NC}"
            
            # Save credentials to file
            cat > ai-studio-credentials.json << EOF
{
  "endpoint_uri": "${ENDPOINT_URI}",
  "endpoint_key": "${ENDPOINT_KEY}",
  "region": "${region}",
  "workspace": "${workspace_name}",
  "deployment_name": "${DEPLOYMENT_NAME}"
}
EOF
            
            echo -e "${GREEN}💾 Credentials saved to ai-studio-credentials.json${NC}"
            
            # Clean up temp files
            rm -f endpoint-config.yml deployment-config.yml
            
            return 0
        else
            echo -e "${RED}❌ Failed to deploy model in ${region}${NC}"
            rm -f endpoint-config.yml deployment-config.yml
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to create endpoint in ${region}${NC}"
        rm -f endpoint-config.yml
        return 1
    fi
}

# Try deployment across regions
DEPLOYED=false

for region in "${REGIONS[@]}"; do
    if [[ "$DEPLOYED" == "true" ]]; then
        break
    fi
    
    if try_ai_studio_deployment "$region"; then
        DEPLOYED=true
        break
    fi
    
    echo -e "${YELLOW}⏳ Waiting before trying next region...${NC}"
    sleep 10
done

if [[ "$DEPLOYED" == "false" ]]; then
    echo -e "${RED}❌ Failed to deploy in any region${NC}"
    echo -e "${YELLOW}💡 Suggestions:${NC}"
    echo -e "${YELLOW}   - Check Azure AI Studio availability in your subscription${NC}"
    echo -e "${YELLOW}   - Verify you have sufficient quota for GPU instances${NC}"
    echo -e "${YELLOW}   - Try deploying through Azure AI Studio portal manually${NC}"
    exit 1
fi

echo -e "${BLUE}🎉 Gemma 3n E4B deployment to Azure AI Model Catalog complete!${NC}"
echo -e "${BLUE}📖 Next steps:${NC}"
echo -e "${BLUE}   1. Test the endpoint with the provided credentials${NC}"
echo -e "${BLUE}   2. Update your application to use the managed endpoint${NC}"
echo -e "${BLUE}   3. Monitor usage and performance in Azure AI Studio${NC}"
