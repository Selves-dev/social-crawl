#!/bin/bash

# Gemma 3 Azure Container Instance Deployment Script
# Deploys a containerized Gemma 3 model to Azure Container Instances

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="rg-social-crawl-ai"
LOCATION="eastus"
CONTAINER_GROUP_NAME="gemma-3-container"
CONTAINER_NAME="gemma-api"
ACR_NAME="socialcrawlacr"
IMAGE_NAME="gemma-3-api"
IMAGE_TAG="latest"
DNS_LABEL="gemma-social-crawl"

# Model configuration
MODEL_SIZE=${1:-"E2B"}  # E2B or E4B
USE_GPU=${2:-"false"}  # true or false

echo -e "${BLUE}🚀 Starting Gemma 3 Azure Container Instance deployment...${NC}"
echo -e "${BLUE}📋 Model size: ${MODEL_SIZE}, GPU: ${USE_GPU}${NC}"

# Validate model size
if [[ "$MODEL_SIZE" != "E2B" && "$MODEL_SIZE" != "E4B" ]]; then
    echo -e "${RED}❌ Invalid model size. Use 'E2B' or 'E4B'${NC}"
    exit 1
fi

# Login to Azure (if not already logged in)
echo -e "${BLUE}🔐 Checking Azure login...${NC}"
if ! az account show > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Not logged in to Azure. Please log in...${NC}"
    az login
fi

# Create resource group if it doesn't exist
echo -e "${BLUE}📁 Creating resource group...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output table

# Create Azure Container Registry if it doesn't exist
echo -e "${BLUE}🏗️ Setting up Azure Container Registry...${NC}"
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Creating new Azure Container Registry...${NC}"
    az acr create \
        --name "$ACR_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --sku Basic \
        --admin-enabled true \
        --output table
else
    echo -e "${GREEN}✅ Azure Container Registry already exists${NC}"
fi

# Get ACR credentials
echo -e "${BLUE}🔑 Getting ACR credentials...${NC}"
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

# Model configuration
case $MODEL_SIZE in
    "E2B")
        MODEL_NAME="google/gemma-3n-E2B-it"
        CPU_CORES=4
        MEMORY_GB=12
        MAX_TOKENS=512
        ;;
    "E4B")
        MODEL_NAME="google/gemma-3n-E4B-it"
        CPU_CORES=8
        MEMORY_GB=16
        MAX_TOKENS=1024
        ;;
esac

# Configure GPU settings
GPU_ARGS=""
if [[ "$USE_GPU" == "true" ]]; then
    GPU_ARGS="--gpu-count 1 --gpu-sku V100"
    CONTAINER_GROUP_NAME="${CONTAINER_GROUP_NAME}-gpu"
    DNS_LABEL="${DNS_LABEL}-gpu"
    echo -e "${BLUE}🎮 GPU deployment enabled${NC}"
else
    CONTAINER_GROUP_NAME="${CONTAINER_GROUP_NAME}-cpu"
    DNS_LABEL="${DNS_LABEL}-cpu"
    echo -e "${BLUE}💻 CPU-only deployment${NC}"
fi

# Build container image if it doesn't exist in ACR
echo -e "${BLUE}🔨 Checking if container image exists...${NC}"
if ! az acr repository show --name "$ACR_NAME" --repository "$IMAGE_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Container image not found. Building...${NC}"
    
    # Create temporary Dockerfile
    cat > Dockerfile.temp << EOF
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    wget \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .

# Expose port
EXPOSE 8080

# Set environment variables
ENV MODEL_NAME=${MODEL_NAME}
ENV MAX_TOKENS=${MAX_TOKENS}
ENV TEMPERATURE=0.7

# Start the application
CMD ["python", "server.py"]
EOF

    # Create requirements.txt
    cat > requirements.txt.temp << EOF
torch>=2.0.0
transformers>=4.30.0
accelerate>=0.20.0
flask>=2.3.0
gunicorn>=21.0.0
sentencepiece>=0.1.99
protobuf>=3.20.0
EOF

    # Create basic server.py (will be replaced with full implementation)
    cat > server.py.temp << EOF
from flask import Flask, request, jsonify
import os
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": os.getenv('MODEL_NAME')})

@app.route('/generate', methods=['POST'])
def generate_text():
    # Placeholder - replace with actual model implementation
    return jsonify({
        "success": True,
        "text": "Model placeholder response",
        "tokens_used": 10,
        "processing_time": 0.1,
        "model": os.getenv('MODEL_NAME')
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
EOF

    # Build and push image
    docker build -f Dockerfile.temp -t "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" .
    
    # Login to ACR and push
    az acr login --name "$ACR_NAME"
    docker push "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Cleanup temporary files
    rm -f Dockerfile.temp requirements.txt.temp server.py.temp
    
    echo -e "${GREEN}✅ Container image built and pushed${NC}"
else
    echo -e "${GREEN}✅ Container image already exists${NC}"
fi

# Delete existing container group if it exists
echo -e "${BLUE}🗑️ Checking for existing container group...${NC}"
if az container show --name "$CONTAINER_GROUP_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Deleting existing container group...${NC}"
    az container delete \
        --name "$CONTAINER_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --yes
    
    # Wait for deletion to complete
    echo -e "${BLUE}⏳ Waiting for deletion to complete...${NC}"
    sleep 30
fi

# Deploy container to Azure Container Instance
echo -e "${BLUE}🚀 Deploying container to Azure Container Instance...${NC}"
az container create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP_NAME" \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
    --cpu "$CPU_CORES" \
    --memory "$MEMORY_GB" \
    $GPU_ARGS \
    --dns-name-label "$DNS_LABEL" \
    --ports 8080 \
    --environment-variables \
        MODEL_NAME="$MODEL_NAME" \
        MAX_TOKENS="$MAX_TOKENS" \
        TEMPERATURE=0.7 \
    --registry-login-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --restart-policy OnFailure \
    --output table

# Wait for container to be ready
echo -e "${BLUE}⏳ Waiting for container to start...${NC}"
sleep 60

# Get container details
echo -e "${BLUE}📋 Getting container details...${NC}"
CONTAINER_IP=$(az container show \
    --name "$CONTAINER_GROUP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query ipAddress.ip \
    --output tsv)

CONTAINER_FQDN=$(az container show \
    --name "$CONTAINER_GROUP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query ipAddress.fqdn \
    --output tsv)

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
HEALTH_URL="http://${CONTAINER_FQDN}:8080/health"
if curl -s "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✅ Container is responding to health checks${NC}"
    curl -s "$HEALTH_URL" | jq .
else
    echo -e "${YELLOW}⚠️ Container may still be starting up${NC}"
fi

# Display deployment information
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Deployment Details:${NC}"
echo -e "  • Resource Group: $RESOURCE_GROUP"
echo -e "  • Container Group: $CONTAINER_GROUP_NAME"
echo -e "  • Model: $MODEL_NAME"
echo -e "  • CPU: $CPU_CORES cores"
echo -e "  • Memory: ${MEMORY_GB}GB"
echo -e "  • GPU: $USE_GPU"
echo -e "  • IP Address: $CONTAINER_IP"
echo -e "  • FQDN: $CONTAINER_FQDN"
echo -e "  • Health URL: http://${CONTAINER_FQDN}:8080/health"
echo -e "  • API URL: http://${CONTAINER_FQDN}:8080/generate"

echo -e "${YELLOW}🚀 Next steps:${NC}"
echo -e "  • Test the API: curl -X POST http://${CONTAINER_FQDN}:8080/generate -H 'Content-Type: application/json' -d '{\"prompt\":\"Hello\"}'"
echo -e "  • Monitor logs: az container logs --name $CONTAINER_GROUP_NAME --resource-group $RESOURCE_GROUP"
echo -e "  • Update Social Crawl config: GEMMA_ENDPOINT_URL=http://${CONTAINER_FQDN}:8080"
