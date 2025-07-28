#!/bin/bash
# Generate Azure Container App env JSON array from .env
ENV_FILE=".env"
JSON_ARRAY="["
FIRST=1
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  if [[ $FIRST -eq 0 ]]; then
    JSON_ARRAY+="," 
  fi
  JSON_ARRAY+="{\"name\": \"$key\", \"value\": \"$value\"}"
  FIRST=0
  
  # For safety, escape double quotes in value
  JSON_ARRAY=${JSON_ARRAY//"/\\"}
done < "$ENV_FILE"
JSON_ARRAY+="]"
echo "$JSON_ARRAY"
