# Social Crawl - Nitro Server

A lightweight Nitro server with service bus integration and health monitoring.

## Features

- 🚀 **Pure Nitro** - No Express, lightweight and fast
- 🔌 **Service Bus Plugin** - Startup plugin for service bus connection
- 🩺 **Health Endpoint** - Comprehensive health check endpoint
- 📝 **TypeScript** - Full type safety

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Health Check
`GET /health`

Returns server health status including:
- Server status
- Service bus connection status
- Memory usage
- Uptime
- Response time

Example response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-25T10:30:00.000Z",
  "uptime": 123.45,
  "checks": {
    "server": "ok",
    "serviceBus": "connected",
    "memory": {
      "used": 25,
      "total": 50,
      "unit": "MB"
    }
  },
  "responseTime": "2ms"
}
```

## Project Structure

```
```
src/
├── plugins/
│   └── postman.ts            # Postman (Azure Service Bus) connection plugin
├── routes/
│   └── health.get.ts         # Health check endpoint
└── utils/                    # Organized utility modules
    ├── shared/               # Shared utilities (cross-service)
    │   ├── database.ts       # Database connection utilities
    │   ├── logger.ts         # Structured logging utilities
    │   ├── serviceBus.ts     # Postman (Azure Service Bus) utilities
    │   └── index.ts          # Shared exports
    ├── ai-service/           # AI-related operations
    ├── analyse-media/        # Media content analysis
    ├── control/              # Control and orchestration
    ├── crawl-media/          # Media crawling and collection
    ├── enrich-venue/         # Venue data enrichment
    ├── find-location/        # Location detection and geocoding
    ├── prep-media/           # Media preprocessing
    └── index.ts              # Utils module exports
```
```

## Service Bus Integration

The service bus plugin (`src/plugins/serviceBus.ts`) runs at startup and:
- Establishes connection to the service bus
- Logs connection status
- Handles connection errors gracefully

Currently implemented as a simulation with logging. Replace the placeholder code with your actual service bus client.

## Development

The server runs on `http://localhost:3000` by default in development mode.

- Health endpoint: `http://localhost:3000/health`
- Logs show service bus connection status on startup

## Production

Build the project and run with:
```bash
npm run build
npm start
```
