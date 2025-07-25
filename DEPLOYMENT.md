# Social Crawl Deployment Configuration

This project uses a multi-environment deployment setup with the following stack:

## Technology Stack
- **Runtime**: Node.js with Nitro framework
- **Language**: TypeScript (local) → JavaScript (production)
- **Database**: MongoDB Atlas
- **Cloud**: Microsoft Azure
- **Secrets**: Azure Key Vault
- **Containerization**: Docker
- **Message Queue**: Azure Service Bus

## Build Environments
- **Local**: `builds/local/` - Development builds with TypeScript
- **Production**: `builds/prod/` - Optimized JavaScript builds for deployment

## Environment Variables
- Local development uses `.env.local`
- Production uses Azure Key Vault for secrets
- Environment-specific configurations managed via build scripts

## Deployment Flow
1. Build locally (`npm run build:local` or `npm run build:prod`)
2. Package with Docker
3. Deploy to Azure using deployment scripts
4. Secrets injected from Azure Key Vault

## Requirements
- Docker installed locally
- Azure CLI configured
- Access to MongoDB Atlas
- Access to Azure subscription with Key Vault permissions
