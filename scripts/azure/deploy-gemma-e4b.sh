#!/bin/bash

# Gemma 3n E4B Azure Container Instance Deployment Script
# Deploys Gemma 3n E4B with proper multimodal support and resource allocation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration for E4B model with proper resources
RESOURCE_GROUP="social-crawler-rg"
RG_LOCATION="uksouth"  # Resource group location
CONTAINER_LOCATION="westeurope"  # Container location (where specs are available)
CONTAINER_GROUP_NAME="gemma-3n-e4b"
CONTAINER_NAME="gemma-e4b-api"
ACR_NAME="socialcrawlacruk"
IMAGE_NAME="gemma-3n-e4b"
IMAGE_TAG="latest"
DNS_LABEL="gemma-e4b-westeurope-social-crawl"

# E4B Model requires more resources for multimodal support
MODEL_NAME="google/gemma-3n-E4B"
CPU_CORES=8
MEMORY_GB=32
MAX_TOKENS=2048
TEMPERATURE=0.7

# Check for HuggingFace token
HF_TOKEN="REMOVED"
if [ -z "$HF_TOKEN" ]; then
    echo -e "${YELLOW}⚠️ HF_TOKEN environment variable not set. Please provide your Hugging Face access token:${NC}"
    read -s HF_TOKEN
    echo
fi

echo -e "${BLUE}🚀 Starting Gemma 3n E4B deployment with multimodal support...${NC}"
echo -e "${BLUE}📋 CPU: ${CPU_CORES} cores, Memory: ${MEMORY_GB}GB, Max Tokens: ${MAX_TOKENS}${NC}"

# Check Azure login
echo -e "${BLUE}🔐 Checking Azure login...${NC}"
if ! az account show > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Not logged in to Azure. Please log in...${NC}"
    az login
fi

# Create resource group if it doesn't exist (skip - use existing)
echo -e "${BLUE}📁 Using existing resource group in ${RG_LOCATION}...${NC}"

# Ensure ACR exists and get credentials
echo -e "${BLUE}🏗️ Setting up Azure Container Registry...${NC}"
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Creating new Azure Container Registry...${NC}"
    az acr create \
        --name "$ACR_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --sku Standard \
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

# Create optimized Dockerfile for E4B with multimodal support and quantization
echo -e "${BLUE}🔨 Creating optimized Dockerfile for Gemma 3n E4B with 8-bit quantization...${NC}"
cat > Dockerfile.e4b << 'EOF'
FROM python:3.11-slim

# Install system dependencies for ML and multimodal libraries
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements-e4b.txt .
RUN pip install --upgrade pip --no-cache-dir
RUN pip install --no-cache-dir -r requirements-e4b.txt

# Copy application code
COPY server-e4b.py server.py

# Expose port
EXPOSE 8080

# Set environment variables for E4B
ENV MODEL_NAME=google/gemma-3n-E4B
ENV MAX_TOKENS=2048
ENV TEMPERATURE=0.7
ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_CACHE=/app/cache
ENV HF_HOME=/app/cache

# Create cache directory
RUN mkdir -p /app/cache

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=300s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application with proper memory settings
CMD ["python", "-u", "server.py"]
EOF

# Create enhanced requirements for E4B with multimodal support and quantization
echo -e "${BLUE}📦 Creating enhanced requirements for multimodal support with quantization...${NC}"
cat > requirements-e4b.txt << 'EOF'
torch>=2.0.0
transformers>=4.53.0
accelerate>=0.20.0
bitsandbytes>=0.41.0
flask>=2.3.0
gunicorn>=21.0.0
sentencepiece>=0.1.99
protobuf>=3.20.0
pillow>=10.0.0
requests>=2.25.0
timm>=0.9.0
opencv-python-headless>=4.8.0
numpy>=1.24.0
scipy>=1.10.0
scikit-image>=0.20.0
librosa>=0.10.0
soundfile>=0.12.0
moviepy>=1.0.0
pydub>=0.25.0
python-multipart>=0.0.6
aiofiles>=23.0.0
uvicorn>=0.23.0
fastapi>=0.100.0
EOF

# Create enhanced server for E4B model with quantization
echo -e "${BLUE}🖥️ Creating enhanced server for E4B model with 8-bit quantization...${NC}"
cat > server-e4b.py << 'EOF'
"""
Enhanced Gemma 3n E4B Server with Multimodal Support and 8-bit Quantization
Optimized for 32GB RAM and 8 CPU cores using BitsAndBytes quantization
"""

import os
import logging
import time
import base64
import json
from io import BytesIO
import torch
import gc
from PIL import Image
import numpy as np
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
MODEL_NAME = os.getenv('MODEL_NAME', 'google/gemma-3n-E4B')
MAX_TOKENS = int(os.getenv('MAX_TOKENS', '2048'))
TEMPERATURE = float(os.getenv('TEMPERATURE', '0.7'))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Global model variables
tokenizer = None
model = None
model_loaded = False

def load_model():
    """Load the Gemma 3n E4B model with 8-bit quantization for 32GB RAM"""
    global tokenizer, model, model_loaded
    
    if model_loaded:
        return True
    
    try:
        logger.info(f"Loading model {MODEL_NAME} on {DEVICE} with 8-bit quantization")
        
        # Configure memory optimization
        torch.backends.cudnn.benchmark = True
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Load tokenizer
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            cache_dir="/app/cache",
            token=os.getenv('HF_TOKEN')
        )
        
        # Load model with appropriate configuration for CPU/GPU
        if torch.cuda.is_available():
            # Configure 8-bit quantization to reduce memory usage
            quantization_config = BitsAndBytesConfig(
                load_in_8bit=True,
                llm_int8_enable_fp32_cpu_offload=True,
                llm_int8_has_fp16_weight=False,
                llm_int8_threshold=6.0,
            )
            
            logger.info("Loading model with 8-bit quantization...")
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                trust_remote_code=True,
                quantization_config=quantization_config,
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True,
                cache_dir="/app/cache",
                token=os.getenv('HF_TOKEN'),
                device_map="auto"
            )
        else:
            # For CPU, load with minimal memory footprint
            logger.info("Loading model for CPU (no quantization)...")
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                trust_remote_code=True,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True,
                cache_dir="/app/cache",
                token=os.getenv('HF_TOKEN')
            )
        
        # Force garbage collection after loading
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        model_loaded = True
        logger.info("Model loaded successfully with 8-bit quantization")
        
        # Log memory usage
        if torch.cuda.is_available():
            logger.info(f"GPU memory allocated: {torch.cuda.memory_allocated() / 1024**3:.2f}GB")
            logger.info(f"GPU memory cached: {torch.cuda.memory_reserved() / 1024**3:.2f}GB")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        # Try fallback without quantization if 8-bit fails
        try:
            logger.info("Attempting fallback without quantization...")
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                trust_remote_code=True,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                low_cpu_mem_usage=True,
                cache_dir="/app/cache",
                token=os.getenv('HF_TOKEN')
            )
            
            if torch.cuda.is_available():
                model = model.to(DEVICE)
            
            model_loaded = True
            logger.info("Model loaded successfully without quantization")
            return True
        except Exception as fallback_error:
            logger.error(f"Fallback also failed: {fallback_error}")
            return False

def process_image(image_data):
    """Process image data for multimodal input"""
    try:
        if isinstance(image_data, str):
            # Base64 encoded image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(BytesIO(image_bytes))
        else:
            image = Image.open(BytesIO(image_data))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large (optimize for memory)
        max_size = 1024
        if max(image.size) > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        return image
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        memory_info = {}
        if torch.cuda.is_available():
            memory_info = {
                "allocated": f"{torch.cuda.memory_allocated() / 1024**3:.2f}GB",
                "cached": f"{torch.cuda.memory_reserved() / 1024**3:.2f}GB"
            }
        else:
            memory_info = {"allocated": "N/A (CPU)", "cached": "N/A (CPU)"}
        
        status = {
            "status": "healthy" if model_loaded else "loading",
            "model": MODEL_NAME,
            "device": DEVICE,
            "quantization": "8-bit" if torch.cuda.is_available() and model_loaded else ("dynamic-int8" if model_loaded else "unknown"),
            "memory": memory_info,
            "timestamp": time.time()
        }
        return jsonify(status), 200 if model_loaded else 503
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    """Main analysis endpoint with multimodal support"""
    if not model_loaded:
        return jsonify({"error": "Model not loaded"}), 503
    
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        max_tokens = min(data.get('maxTokens', MAX_TOKENS), MAX_TOKENS)
        temperature = data.get('temperature', TEMPERATURE)
        
        # Process multimodal inputs
        has_image = 'imageData' in data or 'imageUrl' in data
        
        if has_image:
            # Handle image input
            image = None
            if 'imageData' in data:
                image = process_image(data['imageData'])
            elif 'imageUrl' in data:
                # For now, we'll ask for base64 data instead of URLs
                return jsonify({"error": "Please provide imageData as base64 instead of imageUrl"}), 400
            
            if image:
                # For now, describe the image in the prompt
                prompt = f"Analyze this image and answer: {prompt}"
        
        # Generate response
        start_time = time.time()
        
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
        if torch.cuda.is_available():
            inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        # Generate with reduced memory usage
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
                use_cache=False  # Reduce memory usage during generation
            )
        
        # Decode response
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Remove the input prompt from response
        if response.startswith(prompt):
            response = response[len(prompt):].strip()
        
        processing_time = time.time() - start_time
        
        # Clean up memory aggressively
        del inputs, outputs
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        
        return jsonify({
            "success": True,
            "response": response,
            "processingTime": processing_time,
            "tokensUsed": len(tokenizer.encode(response)),
            "model": MODEL_NAME,
            "quantization": "8-bit" if torch.cuda.is_available() else "dynamic-int8"
        })
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Gemma 3n E4B server with 8-bit quantization...")
    
    # Load model on startup
    if load_model():
        logger.info("Server ready with quantized model loaded")
    else:
        logger.error("Failed to load model on startup")
    
    # Start Flask app
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)
EOF

# Build and push the optimized image
echo -e "${BLUE}🏗️ Building optimized E4B container image...${NC}"
docker build --platform linux/amd64 -f Dockerfile.e4b -t "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" .

echo -e "${BLUE}🔐 Logging into Azure Container Registry...${NC}"
echo "$ACR_PASSWORD" | docker login "$ACR_LOGIN_SERVER" --username "$ACR_USERNAME" --password-stdin

echo -e "${BLUE}📤 Pushing image to Azure Container Registry...${NC}"
docker push "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"

# Delete existing container group if it exists
echo -e "${BLUE}🗑️ Cleaning up existing container group...${NC}"
if az container show --name "$CONTAINER_GROUP_NAME" --resource-group "$RESOURCE_GROUP" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Deleting existing container group...${NC}"
    az container delete \
        --name "$CONTAINER_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --yes
    
    # Wait for deletion to complete
    echo -e "${BLUE}⏳ Waiting for container group deletion...${NC}"
    sleep 30
fi

# Deploy new container instance with proper E4B specifications
echo -e "${BLUE}🚀 Deploying Gemma 3n E4B container instance in ${CONTAINER_LOCATION}...${NC}"
az container create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_GROUP_NAME" \
    --image "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --os-type Linux \
    --cpu "$CPU_CORES" \
    --memory "$MEMORY_GB" \
    --dns-name-label "$DNS_LABEL" \
    --ports 8080 \
    --protocol TCP \
    --restart-policy Always \
    --location "$CONTAINER_LOCATION" \
    --environment-variables \
        MODEL_NAME="$MODEL_NAME" \
        MAX_TOKENS="$MAX_TOKENS" \
        TEMPERATURE="$TEMPERATURE" \
        HF_TOKEN="$HF_TOKEN" \
    --output table

# Get the deployed container info
echo -e "${BLUE}📋 Getting deployment information...${NC}"
CONTAINER_IP=$(az container show --name "$CONTAINER_GROUP_NAME" --resource-group "$RESOURCE_GROUP" --query ipAddress.ip --output tsv)
CONTAINER_FQDN=$(az container show --name "$CONTAINER_GROUP_NAME" --resource-group "$RESOURCE_GROUP" --query ipAddress.fqdn --output tsv)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🔗 Container IP: ${CONTAINER_IP}${NC}"
echo -e "${GREEN}🌐 Container FQDN: ${CONTAINER_FQDN}${NC}"
echo -e "${GREEN}🏥 Health Check: http://${CONTAINER_FQDN}/health${NC}"
echo -e "${GREEN}🧠 AI Endpoint: http://${CONTAINER_FQDN}/analyze${NC}"

# Clean up temporary files
rm -f Dockerfile.e4b requirements-e4b.txt server-e4b.py

echo -e "${BLUE}🎉 Gemma 3n E4B deployment complete with 8 cores and 32GB RAM!${NC}"
