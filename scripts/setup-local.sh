#!/bin/bash

# Quick setup script for local development
# Sets up Service Bus queues in the taash-local namespace

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Setting up local development Service Bus queues..."
echo ""

# Run the queue setup script for local environment
"$SCRIPT_DIR/setup-queues.sh" local

echo ""
echo "✅ Local development setup complete!"
echo "   You can now start your development server with: npm run dev"
