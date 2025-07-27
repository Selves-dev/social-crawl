import os
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch
from fastapi import FastAPI, Request
from pydantic import BaseModel

app = FastAPI()

MODEL_NAME = os.getenv("MODEL_NAME", "google/gemma-3n-E4B")

# 8-bit quantization config
bnb_config = BitsAndBytesConfig(load_in_8bit=True)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    device_map="auto",
    quantization_config=bnb_config,
    trust_remote_code=True
)

class PromptRequest(BaseModel):
    prompt: str
    max_tokens: int = 2048
    temperature: float = 0.7

@app.post("/score")
def score(request: PromptRequest):
    input_ids = tokenizer(request.prompt, return_tensors="pt").input_ids.to(model.device)
    output = model.generate(
        input_ids,
        max_new_tokens=request.max_tokens,
        temperature=request.temperature
    )
    result = tokenizer.decode(output[0], skip_special_tokens=True)
    return {"result": result}
