# MongoDB Atlas Database Integration

## Overview

The Social Crawl application now includes MongoDB Atlas integration with a shared connection pool for efficient database operations throughout the workflow.

## Configuration

### Connection Settings
- **Pool Size**: 10 connections
- **Server Selection Timeout**: 5 seconds
- **Socket Timeout**: 45 seconds
- **Retry Writes**: Enabled
- **Write Concern**: Majority

### Environment Variables

**Development** (`.env`):
```bash
MONGODB_URI=mongodb+srv://emily:D0s6tMp75d7Rgzld@yond.fhg1was.mongodb.net/ta_crawler_st?retryWrites=true&w=majority&appName=Yond
```

**Production** (`.env.secrets`):
```bash
MONGODB_URI=mongodb+srv://emily:D0s6tMp75d7Rgzld@yond.fhg1was.mongodb.net/ta_crawler?retryWrites=true&w=majority&appName=Yond
```

### Database Names
- **Development**: `ta_crawler_st` (staging)
- **Production**: `ta_crawler`

## Architecture

### Database Manager
- **Singleton Pattern**: Single shared connection across the application
- **Auto-Discovery**: Database name extracted from connection URI
- **Health Monitoring**: Built-in connection health checks
- **Graceful Shutdown**: Proper connection cleanup on server shutdown

### Collections

#### `workflows`
Stores workflow context and progress tracking:
```typescript
interface WorkflowDocument {
  _id?: string
  batchId: string
  locationId: string
  status: 'active' | 'completed' | 'failed'
  currentStage: string
  createdAt: Date
  updatedAt: Date
  context: WorkflowContext
}
```

#### `locations`
Stores location information and metadata:
```typescript
interface LocationDocument {
  _id?: string
  locationId: string
  locationName?: string
  countryCode?: string
  createdAt: Date
  updatedAt: Date
  metadata: {
    queries?: string[]
    coordinates?: { lat: number, lng: number }
  }
}
```

#### `media`
Stores processed media items:
```typescript
interface MediaDocument {
  _id?: string
  itemId: string
  itemUrl: string
  itemType: 'video' | 'image' | 'post'
  locationId: string
  batchId: string
  processedAt?: Date
  metadata: {
    duration?: number
    size?: number
    analysisResults?: any
  }
}
```

## Usage Examples

### Basic Database Operations

```typescript
import { db, WorkflowDatabase } from '../utils/shared'

// Check connection status
if (db.isConnectedStatus()) {
  console.log('Database is connected')
}

// Get a collection
const collection = db.getCollection<WorkflowDocument>('workflows')

// Health check
const health = await db.healthCheck()
console.log(`Database status: ${health.status}, latency: ${health.latency}ms`)
```

### Workflow Database Operations

```typescript
import { WorkflowDatabase } from '../utils/shared'

// Save workflow context
await WorkflowDatabase.saveWorkflow(context)

// Get workflow by batch ID
const context = await WorkflowDatabase.getWorkflow(batchId)

// Save location data
await WorkflowDatabase.saveLocation(context)

// Save media item
await WorkflowDatabase.saveMediaItem(context)

// Get analytics
const analytics = await WorkflowDatabase.getLocationAnalytics(locationId)
```

### Integration with Workflow Stages

```typescript
// Example: In postman processor
import { WorkflowDatabase } from '../utils/shared'

async function handleNewBatch(context: WorkflowContext, payload: any) {
  // Save initial workflow state
  await WorkflowDatabase.saveWorkflow(context)
  await WorkflowDatabase.saveLocation(context)
  
  // Continue with workflow processing...
}

async function handleStageComplete(context: WorkflowContext, payload: any) {
  // Update workflow progress
  await WorkflowDatabase.saveWorkflow(context)
  
  // If media item, save it
  if (context.itemId) {
    await WorkflowDatabase.saveMediaItem(context)
  }
}
```

## Health Monitoring

The database status is included in the health endpoint:

```bash
curl http://localhost:3000/health
```

Response includes:
```json
{
  "checks": {
    "database": "connected",
    "databaseLatency": "23ms"
  }
}
```

## Error Handling

- **Connection Failures**: Server continues without database, logs warnings
- **Operation Failures**: Individual operations are wrapped in try-catch blocks
- **Retry Logic**: MongoDB driver handles automatic retries for transient failures
- **Graceful Degradation**: Application remains functional even if database is unavailable

## Security

- **Connection String**: Stored in environment variables, not committed to code
- **Authentication**: Uses MongoDB Atlas built-in authentication
- **Network Security**: Connection encrypted with SSL/TLS
- **Access Control**: Database credentials have appropriate permissions

## Performance

- **Connection Pooling**: Shared pool of 10 connections for optimal performance
- **Indexing**: Collections should be indexed on frequently queried fields:
  - `workflows`: `batchId`, `locationId`, `status`
  - `locations`: `locationId`, `countryCode`
  - `media`: `itemId`, `locationId`, `batchId`

## Deployment

### Local Development
- Uses staging database (`ta_crawler_st`)
- Connection established automatically on server start
- Hot reload preserves database connection

### Production
- Uses production database (`ta_crawler`)
- Connection string loaded from `.env.secrets`
- Automatic failover and retry capabilities

## Monitoring

- All database operations are logged with structured logging
- Connection events tracked in application logs
- Health endpoint provides real-time database status
- Performance metrics available through MongoDB Atlas dashboard
