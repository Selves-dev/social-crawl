#!/bin/bash

# Social Crawl Build Script
# Buil# Copy only the built files and essential deployment files
echo -e "${BLUE}📦 Copying built application...${NC}"
mkdir -p "$BUILD_DIR/dist"

# Copy entire server directory structure (includes chunks and dependencies)
if [[ -d ".output/server" ]]; then
    cp -r .output/server "$BUILD_DIR/dist/"
fi

# Copy public files (if any)
if [[ -d ".output/public" ]]; then
    cp -r .output/public "$BUILD_DIR/dist/"
fion for different environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-local}
BUILD_DIR="builds/$ENVIRONMENT"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}🚀 Starting Social Crawl build for environment: ${ENVIRONMENT}${NC}"

# Validate environment
if [[ "$ENVIRONMENT" != "local" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}❌ Invalid environment. Use 'local' or 'prod'${NC}"
    echo "Usage: $0 [local|prod]"
    exit 1
fi

# Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build the application in the main project directory
echo -e "${BLUE}🔨 Building application...${NC}"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    NODE_ENV=production pnpm run build
else
    pnpm run build
fi

# Check if build was successful
if [[ ! -d ".output" ]]; then
    echo -e "${RED}❌ Build failed - no .output directory found${NC}"
    exit 1
fi

# Copy only the built files and essential deployment files
echo -e "${BLUE}� Copying built application...${NC}"
mkdir -p "$BUILD_DIR/dist/server"
mkdir -p "$BUILD_DIR/dist/public"

# Copy server files
if [[ -f ".output/server/index.mjs" ]]; then
    cp .output/server/index.mjs "$BUILD_DIR/dist/server/"
    cp .output/server/package.json "$BUILD_DIR/dist/server/"
    [[ -f ".output/server/index.mjs.map" ]] && cp .output/server/index.mjs.map "$BUILD_DIR/dist/server/"
fi

# Copy public files (if any)
if [[ -d ".output/public" ]]; then
    cp -r .output/public/* "$BUILD_DIR/dist/public/" 2>/dev/null || true
fi

# Copy only essential files for deployment
echo -e "${BLUE}📁 Copying deployment files...${NC}"
cp package.json "$BUILD_DIR/"
cp pnpm-lock.yaml "$BUILD_DIR/" 2>/dev/null || cp package-lock.json "$BUILD_DIR/" 2>/dev/null || echo -e "${YELLOW}⚠️ No lock file found${NC}"
cp README.md "$BUILD_DIR/"
cp DEPLOYMENT.md "$BUILD_DIR/"

# Copy environment-specific files
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo -e "${BLUE}🔧 Setting up local environment...${NC}"
    cp .env.local "$BUILD_DIR/.env" 2>/dev/null || echo -e "${YELLOW}⚠️ No .env.local found${NC}"
    
    # Create local-specific Dockerfile
    cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY dist/ ./dist/

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server/index.mjs"]
EOF

elif [[ "$ENVIRONMENT" == "prod" ]]; then
    echo -e "${BLUE}🏭 Setting up production environment...${NC}"
    
    # Create production environment template (secrets from Key Vault)
    cat > "$BUILD_DIR/.env.template" << 'EOF'
# Production Environment Template
# Actual values will be injected from Azure Key Vault during deployment

# Azure Service Bus Configuration
AZURE_SERVICE_BUS_CONNECTION_STRING={{AZURE_SERVICE_BUS_CONNECTION_STRING}}
AZURE_SERVICE_BUS_QUEUE_NAME={{AZURE_SERVICE_BUS_QUEUE_NAME}}
AZURE_SERVICE_BUS_PREP_MEDIA_QUEUE={{AZURE_SERVICE_BUS_PREP_MEDIA_QUEUE}}
AZURE_SERVICE_BUS_AI_SERVICE_QUEUE={{AZURE_SERVICE_BUS_AI_SERVICE_QUEUE}}

# MongoDB Configuration
MONGODB_CONNECTION_STRING={{MONGODB_CONNECTION_STRING}}
MONGODB_DATABASE_NAME={{MONGODB_DATABASE_NAME}}

# Throttle Queue Settings
PREP_MEDIA_MAX_CONCURRENT_JOBS={{PREP_MEDIA_MAX_CONCURRENT_JOBS}}
AI_SERVICE_MAX_CONCURRENT_JOBS={{AI_SERVICE_MAX_CONCURRENT_JOBS}}

# Application Settings
NODE_ENV=production
LOG_LEVEL={{LOG_LEVEL}}
PORT={{PORT}}
EOF

    # Create production Dockerfile
    cat > "$BUILD_DIR/Dockerfile" << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nitro -u 1001

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy built application
COPY dist/ ./dist/

# Copy environment template
COPY .env.template ./

# Change ownership to non-root user
RUN chown -R nitro:nodejs /app
USER nitro

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server/index.mjs"]
EOF
fi

# Clean up build artifacts in main project
echo -e "${BLUE}🧹 Cleaning up build artifacts...${NC}"
rm -rf .output .nitro

# Create build manifest
echo -e "${BLUE}📋 Creating build manifest...${NC}"
cat > "$BUILD_DIR/build-manifest.json" << EOF
{
  "environment": "$ENVIRONMENT",
  "buildTime": "$TIMESTAMP",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${BLUE}📍 Build location: $(pwd)/$BUILD_DIR${NC}"
echo -e "${BLUE}📋 Build manifest: $(pwd)/$BUILD_DIR/build-manifest.json${NC}"

# Show build size
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
echo -e "${BLUE}📏 Build size: $BUILD_SIZE${NC}"

# Next steps
echo -e "${YELLOW}🚀 Next steps:${NC}"
if [[ "$ENVIRONMENT" == "local" ]]; then
    echo -e "  • Test locally: cd $BUILD_DIR && node dist/server/index.mjs"
    echo -e "  • Build Docker image: docker build -t social-crawl:local $BUILD_DIR"
else
    echo -e "  • Deploy to production: ./scripts/deploy.sh"
    echo -e "  • Build Docker image: docker build -t social-crawl:prod $BUILD_DIR"
fi
