#!/bin/bash

# Elasticsearch Serverless Setup Script
# This script creates the hotels and rooms indices in Elasticsearch

# Set your Elasticsearch endpoint and API key
ES_ENDPOINT="${ES_ENDPOINT:-https://your-elasticsearch-endpoint.es.us-east-1.aws.elastic.cloud}"
ES_API_KEY="${ES_API_KEY}"

if [ -z "$ES_API_KEY" ]; then
  echo "Error: ES_API_KEY environment variable not set"
  echo "Usage: ES_ENDPOINT=https://your-endpoint ES_API_KEY=your-key ./create-elasticsearch-indices.sh"
  exit 1
fi

echo "🔧 Creating Elasticsearch indices..."
echo "Endpoint: $ES_ENDPOINT"
echo ""

# Load the JSON schema
SCHEMA_FILE="$(dirname "$0")/elasticsearch-setup.json"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Error: Schema file not found: $SCHEMA_FILE"
  exit 1
fi

# Create hotels index
echo "📦 Creating hotels index..."
curl -X PUT "${ES_ENDPOINT}/hotels" \
  -H "Authorization: ApiKey ${ES_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(cat $SCHEMA_FILE | jq '.hotels_index')" \
  | jq '.'

echo ""
echo "📦 Creating rooms index..."
curl -X PUT "${ES_ENDPOINT}/rooms" \
  -H "Authorization: ApiKey ${ES_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(cat $SCHEMA_FILE | jq '.rooms_index')" \
  | jq '.'

echo ""
echo "✅ Indices created successfully!"
echo ""
echo "Verify with:"
echo "curl -X GET '${ES_ENDPOINT}/_cat/indices?v' -H 'Authorization: ApiKey ${ES_API_KEY}'"
