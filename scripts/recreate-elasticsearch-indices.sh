#!/bin/bash

# Elasticsearch Index Recreation Script with NGram Analyzers
# This script deletes existing indices and recreates them with improved ngram analyzers

# Set your Elasticsearch endpoint and API key
ES_ENDPOINT="${ES_ENDPOINT:-https://my-elasticsearch-project-c3c5dc.es.europe-west1.gcp.elastic.cloud:443}"
ES_API_KEY="${ES_API_KEY}"

if [ -z "$ES_API_KEY" ]; then
  echo "❌ Error: ES_API_KEY environment variable is required"
  echo "Usage: ES_ENDPOINT=https://your-endpoint ES_API_KEY=your-key ./recreate-elasticsearch-indices.sh"
  exit 1
fi

echo "🔧 Recreating Elasticsearch indices with standard analyzer..."
echo "Endpoint: $ES_ENDPOINT"
echo ""

SCHEMA_FILE="$(dirname "$0")/elasticsearch-setup-standard.json"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "❌ Error: Schema file not found: $SCHEMA_FILE"
  exit 1
fi

# Function to delete an index if it exists
delete_index() {
  local index_name=$1
  echo "🗑️  Checking if $index_name exists..."
  
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X HEAD "$ES_ENDPOINT/$index_name" \
    -H "Authorization: ApiKey $ES_API_KEY")
  
  if [ "$status_code" = "200" ]; then
    echo "📦 Deleting existing $index_name index..."
    curl -s -X DELETE "$ES_ENDPOINT/$index_name" \
      -H "Authorization: ApiKey $ES_API_KEY" | jq '.'
    echo ""
  else
    echo "✅ Index $index_name does not exist, no need to delete"
    echo ""
  fi
}

# Function to create an index
create_index() {
  local index_name=$1
  local jq_path=$2
  
  echo "📦 Creating $index_name index with ngram analyzers..."
  curl -s -X PUT "$ES_ENDPOINT/$index_name" \
    -H "Authorization: ApiKey $ES_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(cat $SCHEMA_FILE | jq "$jq_path")" | jq '.'
  echo ""
}

# Delete existing indices
echo "=== Step 1: Deleting existing indices ==="
delete_index "hotels"
delete_index "rooms"

# Create new indices with ngram analyzers
echo "=== Step 2: Creating new indices with ngram analyzers ==="
create_index "hotels" '.hotels_index'
create_index "rooms" '.rooms_index'

echo "✨ Done! Indices recreated with edge ngram analyzers."
echo ""
echo "⚠️  Note: You'll need to re-index all documents!"
