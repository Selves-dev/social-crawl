# Environment and Secrets Management

## Overview

The Social Crawl project uses a multi-layer environment configuration system:

- **`.env`** - Non-secret configuration that can be committed to version control
- **`.env.local`** - Local development secrets (not committed)
- **`.env.secrets`** - Production secrets for Azure Key Vault upload (not committed)

## File Structure

```
.env                     # Non-secret config (committed)
.env.local              # Local dev secrets (not committed)
.env.secrets           # Production secrets for Key Vault (not committed)
```

## Configuration Types

### Non-Secret Configuration (`.env`)
- Server settings (PORT, HOST)
- Queue names
- Feature flags
- Logging configuration
- Database names (without connection strings)

### Local Development Secrets (`.env.local`)
- Local Azure Service Bus connection strings
- Development API keys
- Local database connections
- Debug settings

### Production Secrets (`.env.secrets`)
- Production Azure Service Bus connection strings
- Production MongoDB connection strings
- API keys for external services
- Webhook secrets
- Encryption keys

## Setup Process

### 1. Local Development
```bash
# Copy and edit with your local values
cp .env.local.example .env.local
```

### 2. Production Deployment
```bash
# 1. Edit .env.secrets with production values
nano .env.secrets

# 2. Upload secrets to Azure Key Vault
npm run setup:secrets

# 3. Deploy the application
npm run deploy:prod
```

## Secret Categories

### Azure Service Bus
- `AZURE_SERVICE_BUS_CONNECTION_STRING` - Main connection string
- Queue names are in `.env` (non-secret)

### MongoDB
- `MONGODB_CONNECTION_STRING` - Full connection string with credentials
- `MONGODB_DATABASE_NAME` - Database name

### AI Services
- `OPENAI_API_KEY` - OpenAI API key
- `AZURE_COGNITIVE_SERVICES_KEY` - Azure Cognitive Services key
- `AZURE_COGNITIVE_SERVICES_ENDPOINT` - Service endpoint

### Media Processing
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Social Media APIs
- `TWITTER_BEARER_TOKEN` - Twitter API access
- `INSTAGRAM_ACCESS_TOKEN` - Instagram API access
- `YOUTUBE_API_KEY` - YouTube Data API key

### External Services
- `GOOGLE_MAPS_API_KEY` - Google Maps API
- `YELP_API_KEY` - Yelp API key

### Application Security
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - Data encryption key
- `WEBHOOK_SECRET` - Webhook verification secret

## Azure Key Vault Integration

Secrets are automatically uploaded to Azure Key Vault and referenced in the deployed application using:

```
@Microsoft.KeyVault(VaultName=social-crawl-kv;SecretName=secret-name)
```

## Security Best Practices

1. **Never commit secrets files** - `.env.local` and `.env.secrets.*` are in `.gitignore`
2. **Use different keys for different environments** - Development, staging, and production should have separate API keys
3. **Rotate secrets regularly** - Update API keys and secrets periodically
4. **Use Azure Key Vault** - Production secrets are stored securely in Azure Key Vault
5. **Limit access** - Only authorized personnel should have access to production secrets

## Environment Loading Priority

1. `.env.local` (highest priority, local development)
2. `.env` (base configuration)
3. Azure Key Vault (production, via app settings)

## Troubleshooting

### Missing Secrets
If you see errors about missing environment variables:

1. Check if the variable is in the correct file (`.env` vs `.env.local`)
2. Verify Azure Key Vault contains the secret
3. Check app settings in Azure Web App
4. Ensure secrets were uploaded correctly

### Key Vault Access Issues
```bash
# Check if you have access
az keyvault secret list --vault-name social-crawl-kv

# Check app service identity has access
az webapp identity show --name social-crawl --resource-group social-crawl-rg
```

### Updating Secrets
```bash
# Update a specific secret
az keyvault secret set --vault-name social-crawl-kv --name secret-name --value "new-value"

# Re-upload all secrets from file
npm run setup:secrets
```
