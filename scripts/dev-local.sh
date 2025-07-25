#!/bin/bash

# Development script for running with local Azure Service Bus
# This script loads environment variables and starts the dev server

echo "🚀 Starting Social Crawl development server with local configuration..."

# Load environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Start the development server
npm run dev
