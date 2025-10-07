#!/bin/bash

##
# Quick Reindex Command
# Loads .env and runs reindex
##

# Load from selves-marketing .env if it exists
ENV_FILE="/Users/merry/Documents/projects/social-crawl/selves-marketing/.env"

if [ -f "$ENV_FILE" ]; then
  echo "📦 Loading environment from: $ENV_FILE"
  export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
else
  echo "⚠️  No .env file found at: $ENV_FILE"
fi

# Also check for MONGODB_URI from payload
PAYLOAD_ENV="/Users/merry/Documents/projects/social-crawl/selves-payload/.env"
if [ -f "$PAYLOAD_ENV" ] && [ -z "$MONGODB_URI" ]; then
  echo "📦 Loading MONGODB_URI from: $PAYLOAD_ENV"
  export MONGODB_URI=$(cat "$PAYLOAD_ENV" | grep MONGODB_URI | cut -d '=' -f2-)
fi

# Verify we have what we need
if [ -z "$ES_API_KEY" ]; then
  echo "❌ ES_API_KEY not found in environment"
  echo "   Please set it manually:"
  echo "   export ES_API_KEY='your-key'"
  exit 1
fi

if [ -z "$MONGODB_URI" ] && [ -z "$mongodb-uri" ]; then
  echo "❌ MONGODB_URI not found in environment"
  echo "   Please set it manually:"
  echo "   export MONGODB_URI='mongodb://...'"
  exit 1
fi

# Use mongodb-uri if MONGODB_URI not set
if [ -z "$MONGODB_URI" ] && [ -n "$mongodb-uri" ]; then
  export MONGODB_URI="$mongodb-uri"
fi

# Set ES_ENDPOINT from ELASTICSEARCH_ENDPOINT if available
if [ -z "$ES_ENDPOINT" ] && [ -n "$ELASTICSEARCH_ENDPOINT" ]; then
  export ES_ENDPOINT="$ELASTICSEARCH_ENDPOINT"
fi

# Set ES_API_KEY from ELASTICSEARCH_API_KEY if available
if [ -z "$ES_API_KEY" ] && [ -n "$ELASTICSEARCH_API_KEY" ]; then
  export ES_API_KEY="$ELASTICSEARCH_API_KEY"
fi

echo ""
echo "✅ Environment loaded:"
echo "   ES_ENDPOINT: ${ES_ENDPOINT:0:50}..."
echo "   ES_API_KEY: ${ES_API_KEY:0:20}..."
echo "   MONGODB_URI: ${MONGODB_URI:0:30}..."
echo ""

# Run the reindex script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/reindex-all.sh"
