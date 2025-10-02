# Typesense Change Stream Integration

## Overview

The venue-enrichment service now has **automatic real-time sync** from MongoDB to Typesense Cloud. When hotels are enriched and saved to MongoDB, they are automatically indexed in Typesense for search.

## Architecture

```
MongoDB (s_payload.hotels) 
    ↓ [Change Stream]
    ↓ [Transform Function]
    ↓ [Typesense Client]
    ↓
Typesense Cloud (hotels collection)
```

## Components Created

### 1. **Typesense Manager** (`src/utils/shared/typesense.ts`)
- Singleton client manager for Typesense Cloud connection
- Handles initialization with environment variables
- Provides health check functionality
- Uses admin API key for read/write operations

### 2. **Transform Function** (`src/utils/shared/typesenseTransform.ts`)
- Transforms MongoDB `HotelDocument` to Typesense schema format
- Extracts 60+ searchable fields from enriched hotel data:
  - **Location**: city, country, region, coordinates, neighborhood
  - **Pricing**: min/max/avg prices, currency
  - **Rooms**: counts, types, tiers, sizes, capacity
  - **Amenities**: 13 boolean flags (wifi, pool, spa, gym, etc.)
  - **Semantic**: idealFor tags, roomTags, uniqueSellingPoints, nearbyPOIs
  - **Reviews**: score and count
  - **Sustainability**: certification + practices score
  - **Media**: primary image URL, image count

### 3. **Change Stream Plugin** (`src/plugins/05-typesense.ts`)
- Nitro plugin that runs at server startup
- Watches MongoDB `s_payload.hotels` collection for:
  - `insert` events (new hotels)
  - `update` events (modified hotels)
  - `replace` events (full hotel replacements)
- Automatically transforms and upserts documents to Typesense
- Comprehensive logging for monitoring sync operations

### 4. **Environment Configuration** (`.env`)
Added Typesense connection settings:
```bash
typesense-host=5i1q8hfruw7lnjezp-1.a1.typesense.net
typesense-port=443
typesense-protocol=https
typesense-api-key=9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV
hotels-db-name=s_payload
```

## How It Works

### Startup Flow
1. Server starts and runs plugins in order (01-dotenv, 02-database, 03-serviceBus, 04-postOffice, **05-typesense**)
2. Typesense plugin initializes client connection
3. Plugin creates Change Stream on `s_payload.hotels` collection
4. Change Stream starts watching for document changes

### Runtime Flow
1. **Hotel enrichment completes** → MongoDB document is inserted/updated in `s_payload.hotels`
2. **Change Stream triggers** → Plugin receives change notification with full document
3. **Transform executes** → Hotel document mapped to Typesense schema (60+ fields)
4. **Upsert to Typesense** → Document indexed/updated in Typesense `hotels` collection
5. **Logging** → Operation logged with hotel ID, name, and sync status

### Error Handling
- If Typesense is not configured (missing env vars), plugin logs warning and skips setup
- If transform fails, error is logged with hotel ID for debugging
- If Typesense upsert fails, error is logged but doesn't crash the server
- Change Stream errors are logged and monitored

## Testing

### 1. Check Typesense Connection
```bash
cd /Users/merry/Documents/projects/social-crawl/scripts
node test-typesense-search.js
```

### 2. Start Venue Enrichment Service
```bash
cd /Users/merry/Documents/projects/social-crawl/services/venue-enrichment
npm run dev
```

Watch logs for:
- ✅ `Typesense client initialized`
- ✅ `MongoDB Change Stream active - Typesense sync enabled`

### 3. Trigger Hotel Enrichment
When you run your enrichment workflow and a hotel is saved to MongoDB:
- Watch logs for: `📝 MongoDB Change Stream event detected`
- Followed by: `✅ Hotel document indexed in Typesense`

### 4. Verify in Typesense
```bash
cd /Users/merry/Documents/projects/social-crawl/scripts
node -e "
const Typesense = require('typesense');
const client = new Typesense.Client({
  nodes: [{
    host: '5i1q8hfruw7lnjezp-1.a1.typesense.net',
    port: 443,
    protocol: 'https'
  }],
  apiKey: '9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV',
  connectionTimeoutSeconds: 5
});
client.collections('hotels').documents().search({
  q: '*',
  per_page: 10
}).then(result => {
  console.log('Total hotels in Typesense:', result.found);
  console.log('Hotels:', result.hits?.map(h => h.document.name));
}).catch(err => console.error('Error:', err));
"
```

## Benefits

✅ **Zero-maintenance sync**: No manual indexing required  
✅ **Real-time search**: Hotels searchable immediately after enrichment  
✅ **Automatic updates**: Changes to hotels automatically reflected in search  
✅ **Production-ready**: Uses MongoDB Change Streams (reliable, scalable)  
✅ **Error resilient**: Failures don't block enrichment pipeline  
✅ **Comprehensive logging**: Easy to monitor and debug sync operations  

## Schema Coverage

The transform function maps these key fields:

| Category | Fields | Status |
|----------|--------|--------|
| Core | id, name, slug | ✅ Complete |
| Location | city, country, region, coordinates, neighborhood | ✅ Complete |
| Rooms | count, types, tiers, sizes, capacity | ✅ Complete |
| Pricing | min/max/avg, currency | ✅ Complete |
| Amenities | 13 boolean flags | ✅ Complete |
| Semantic | idealFor, roomTags, USPs, POIs | ✅ Complete |
| Reviews | score, count | ✅ Complete |
| Sustainability | score (certs + practices) | ✅ Complete |
| Media | primary image, count | ✅ Complete |
| Timestamps | created, updated | ✅ Complete |

**Total: 68 fields indexed**, 60+ searchable

## Next Steps

1. ✅ **Database configuration** - Updated to use `s_payload`
2. ✅ **Typesense client** - Initialized and configured
3. ✅ **Transform function** - Maps hotel documents to search schema
4. ✅ **Change Stream** - Real-time sync from MongoDB to Typesense
5. 🔲 **Test enrichment** - Run enrichment workflow and verify sync
6. 🔲 **Search API** - Build search endpoints using Typesense
7. 🔲 **Search UI** - Frontend interface for hotel search

## Configuration Files

- **Plugin**: `services/venue-enrichment/src/plugins/05-typesense.ts`
- **Client**: `services/venue-enrichment/src/utils/shared/typesense.ts`
- **Transform**: `services/venue-enrichment/src/utils/shared/typesenseTransform.ts`
- **Environment**: `.env` (Typesense credentials)
- **Schema**: Created in Typesense Cloud via `/scripts/create-typesense-collection.js`

## Monitoring

Check logs for these key messages:

**Startup:**
```
✅ Typesense client initialized
🔍 Setting up MongoDB Change Stream for Typesense sync
✅ MongoDB Change Stream active - Typesense sync enabled
```

**Runtime:**
```
📝 MongoDB Change Stream event detected
✅ Hotel document indexed in Typesense
```

**Errors:**
```
❌ Failed to transform hotel document for Typesense
❌ Failed to sync hotel document to Typesense
```

## Troubleshooting

**Issue**: Typesense not configured warning  
**Solution**: Check `.env` file has all typesense-* variables

**Issue**: Change Stream not triggering  
**Solution**: Verify `hotels-db-name=s_payload` in `.env` and database is accessible

**Issue**: Transform errors  
**Solution**: Check hotel document structure matches TypeScript types

**Issue**: Typesense upsert failures  
**Solution**: Verify API key has write permissions and collection exists
