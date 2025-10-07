#!/bin/bash

##
# Complete Elasticsearch Reindex Script
# 
# This script will:
# 1. Delete existing indices
# 2. Recreate indices with proper mappings
# 3. Reindex all data from MongoDB
#
# Usage:
#   ./scripts/reindex-all.sh
#
# Or with custom MongoDB URI:
#   MONGODB_URI=mongodb://... ./scripts/reindex-all.sh
##

set -e  # Exit on error

echo "🔄 Complete Elasticsearch Reindex"
echo "=================================="
echo ""

# Check required environment variables
if [ -z "$ES_ENDPOINT" ]; then
  export ES_ENDPOINT="https://my-elasticsearch-project-c3c5dc.es.europe-west1.gcp.elastic.cloud:443"
fi

if [ -z "$ES_API_KEY" ]; then
  echo "❌ Error: ES_API_KEY environment variable is required"
  echo ""
  echo "Usage:"
  echo "  ES_API_KEY=your-key ./scripts/reindex-all.sh"
  echo ""
  echo "Or set in your environment:"
  echo "  export ES_API_KEY=your-key"
  echo "  ./scripts/reindex-all.sh"
  exit 1
fi

if [ -z "$MONGODB_URI" ]; then
  echo "❌ Error: MONGODB_URI environment variable is required"
  echo ""
  echo "Usage:"
  echo "  MONGODB_URI=mongodb://... ES_API_KEY=your-key ./scripts/reindex-all.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📋 Configuration:"
echo "   Elasticsearch: $ES_ENDPOINT"
echo "   MongoDB: $MONGODB_URI"
echo "   Script directory: $SCRIPT_DIR"
echo ""

# Step 1: Recreate indices
echo "=== Step 1: Recreating Elasticsearch Indices ==="
echo ""
bash "$SCRIPT_DIR/recreate-elasticsearch-indices.sh"

if [ $? -ne 0 ]; then
  echo "❌ Failed to recreate indices"
  exit 1
fi

echo ""
echo "✅ Indices recreated successfully"
echo ""

# Wait a moment for indices to be ready
echo "⏳ Waiting for indices to be ready..."
sleep 3
echo ""

# Step 2: Index data from MongoDB
echo "=== Step 2: Indexing Data from MongoDB ==="
echo ""

cd "$SCRIPT_DIR"
node index-mongodb-to-elasticsearch.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to index data"
  exit 1
fi

echo ""
echo "✅ Data indexed successfully"
echo ""

# Step 3: Verify indices
echo "=== Step 3: Verifying Indices ==="
echo ""

echo "📊 Hotels index:"
curl -s -X GET "$ES_ENDPOINT/hotels/_count" \
  -H "Authorization: ApiKey $ES_API_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "📊 Rooms index:"
curl -s -X GET "$ES_ENDPOINT/rooms/_count" \
  -H "Authorization: ApiKey $ES_API_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✨ Reindex complete!"
echo ""
echo "Next steps:"
echo "  1. Test the search API: http://localhost:3000/api/search/venues-v2"
echo "  2. Try a query: http://localhost:3000/api/search/venues-v2?q=london"
echo "  3. Try with tags: http://localhost:3000/api/search/venues-v2?tags[]=wifi"
echo ""
