#!/usr/bin/env python3
"""
Quick fix for the generation parameter issue in the deployed Gemma container.
This script creates a corrected server file and shows how to patch it.
"""

import requests
import json

# Fixed server code with corrected generation parameters
FIXED_SERVER_CODE = '''"""
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
        
        # Configure 8-bit quantization to reduce memory usage
        quantization_config = BitsAndBytesConfig(
            load_in_8bit=True,
            llm_int8_enable_fp32_cpu_offload=True,
            llm_int8_has_fp16_weight=False,
            llm_int8_threshold=6.0,
        )
        
        # Load tokenizer
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            cache_dir="/app/cache",
            token=os.getenv('HF_TOKEN')
        )
        
        # Load model with 8-bit quantization
        logger.info("Loading model with 8-bit quantization...")
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            quantization_config=quantization_config,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True,
            cache_dir="/app/cache",
            token=os.getenv('HF_TOKEN'),
            device_map="auto"
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
            "quantization": "8-bit" if model_loaded else "unknown",
            "memory": memory_info,
            "timestamp": time.time()
        }
        return jsonify(status), 200 if model_loaded else 503
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    """Main analysis endpoint with multimodal support - FIXED VERSION"""
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
        
        # Tokenize input with proper max_length
        inputs = tokenizer(
            prompt, 
            return_tensors="pt", 
            padding=True, 
            truncation=True,
            max_length=512  # Add explicit max_length
        )
        
        if torch.cuda.is_available():
            inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        # Generate with corrected parameters - REMOVED duplicate attention_mask
        with torch.no_grad():
            outputs = model.generate(
                input_ids=inputs['input_ids'],
                attention_mask=inputs['attention_mask'],
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
            "quantization": "8-bit"
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
'''

def test_endpoint():
    """Test the current endpoint to see the error"""
    url = "http://gemma-e4b-westeurope-social-crawl.westeurope.azurecontainer.io:8080/analyze"
    
    payload = {
        "prompt": "What is the capital of France?",
        "maxTokens": 50
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    print("🔧 Testing current endpoint...")
    result = test_endpoint()
    print(f"Current result: {result}")
    
    print("\n✅ Fixed server code created!")
    print("📝 Key fixes applied:")
    print("1. Removed duplicate attention_mask parameter")
    print("2. Added explicit max_length to tokenizer")
    print("3. Cleaned up generation parameters")
    
    print(f"\n💾 Fixed server code saved to: {__file__.replace('.py', '_fixed_server.py')}")
    
    # Save the fixed server code
    with open(__file__.replace('.py', '_fixed_server.py'), 'w') as f:
        f.write(FIXED_SERVER_CODE)
