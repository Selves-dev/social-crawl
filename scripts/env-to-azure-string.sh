#!/bin/bash
# Generate Azure Container App env string from .env
ENV_FILE=".env"
ENV_STRING=""
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  # For secrets, you can add logic here to use secretref
  ENV_STRING+="$key=$value "
done < "$ENV_FILE"
echo "$ENV_STRING"
