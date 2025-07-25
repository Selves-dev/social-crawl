# Azure Deployment Quick Reference

## Available Commands

### Build Commands
```bash
# Build for local development
npm run build:local

# Build for production
npm run build:prod
```

### Deployment Commands
```bash
# Check current Azure environment
npm run deploy:check

# Setup Azure resources (one-time)
npm run deploy:setup

# Configure secrets in Key Vault
npm run setup:secrets

# Deploy to production
npm run deploy:prod

# Remove all Azure resources (DESTRUCTIVE)
npm run deploy:remove
```

## Deployment Workflow

### First Time Setup
1. **Prerequisites**: Ensure Azure CLI and Docker are installed
2. **Login to Azure**: `az login`
3. **Setup Azure Resources**: `npm run deploy:setup`
4. **Configure Secrets**: `npm run setup:secrets`
5. **Build for Production**: `npm run build:prod`
6. **Deploy**: `npm run deploy:prod`

### Regular Deployments
1. **Build**: `npm run build:prod`
2. **Deploy**: `npm run deploy:prod`

### Environment Check
```bash
# Check what's currently deployed
npm run deploy:check
```

## Azure Resources Created

- **Resource Group**: `social-crawl-rg`
- **Key Vault**: `social-crawl-kv` (for secrets)
- **Container Registry**: `socialcrawlacr` (for Docker images)
- **App Service Plan**: `social-crawl-plan` (Linux B1)
- **Web App**: `social-crawl` (containerized)

## Secrets Configuration

The following secrets need to be configured in Azure Key Vault:

### Azure Service Bus
- `azure-service-bus-connection-string`
- `azure-service-bus-queue-name` (default: post-office)
- `azure-service-bus-prep-media-queue` (default: prep-media)
- `azure-service-bus-ai-service-queue` (default: ai-service)

### MongoDB
- `mongodb-connection-string`
- `mongodb-database-name`

### Application Settings
- `prep-media-max-concurrent-jobs` (default: 5)
- `ai-service-max-concurrent-jobs` (default: 3)
- `log-level` (default: info)

## Build Outputs

Builds are created in:
- `builds/local/` - Local development build
- `builds/prod/` - Production build

Each build includes:
- Compiled TypeScript application
- Docker configuration
- Environment templates
- Build manifest with version info

## Troubleshooting

### Common Issues
1. **Azure CLI not logged in**: Run `az login`
2. **Docker not running**: Start Docker Desktop
3. **Build not found**: Run build command first
4. **Secrets not configured**: Run `npm run setup:secrets`

### Check Deployment Status
```bash
# View app logs
az webapp log tail --name social-crawl --resource-group social-crawl-rg

# Check app settings
az webapp config appsettings list --name social-crawl --resource-group social-crawl-rg

# View container logs
az webapp log config --name social-crawl --resource-group social-crawl-rg --docker-container-logging filesystem
```

## Environment URLs

- **Production**: `https://social-crawl.azurewebsites.net`
- **Health Check**: `https://social-crawl.azurewebsites.net/health`
- **Queue Status**: `https://social-crawl.azurewebsites.net/queues`
