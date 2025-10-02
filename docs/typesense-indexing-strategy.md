# Typesense Indexing Strategy for Hotels

## Executive Summary

This document outlines the recommended approach for indexing hotel data into Typesense for fast, typo-tolerant search capabilities.

---

## Question 1: How Should We Index Hotels? 🔄

### Recommended Approach: **MongoDB Change Streams** (NOT Triggers)

#### Why Change Streams Over Triggers?

| Feature | Change Streams | Triggers |
|---------|---------------|----------|
| **Flexibility** | ✅ Full control in app code | ❌ Limited logic in Atlas |
| **Error Handling** | ✅ Robust retry logic | ❌ Basic retries only |
| **Deployment** | ✅ No Atlas dependency | ❌ Requires Atlas setup |
| **Testing** | ✅ Easy to test locally | ❌ Hard to test/debug |
| **Performance** | ✅ Batching possible | ❌ Per-document processing |
| **Cost** | ✅ Included | 💰 Trigger execution costs |

### Implementation Architecture

```
MongoDB (groundry.hotels)
    ↓ (Change Stream)
    ↓
Typesense Sync Service (Node.js)
    ↓ (Batch Updates)
    ↓
Typesense Cluster
    ↓
Search API
```

### Recommended Implementation

#### Option A: Dedicated Sync Service (Best for Production)

Create a new microservice: `services/typesense-sync/`

```typescript
// services/typesense-sync/src/index.ts
import { MongoClient } from 'mongodb';
import Typesense from 'typesense';
import { logger } from './utils/logger';

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST!,
    port: 443,
    protocol: 'https'
  }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 10
});

async function startChangeStreamListener() {
  const client = await MongoClient.connect(process.env.MONGODB_URI!);
  const db = client.db('groundry');
  const collection = db.collection('hotels');
  
  // Watch for changes
  const changeStream = collection.watch([
    {
      $match: {
        operationType: { $in: ['insert', 'update', 'replace'] }
      }
    }
  ], { fullDocument: 'updateLookup' });

  logger.info('🔄 Change stream listener started for hotels collection');

  // Process changes
  changeStream.on('change', async (change) => {
    try {
      if (change.fullDocument) {
        const searchDoc = transformHotelForSearch(change.fullDocument);
        await indexHotelInTypesense(searchDoc);
        logger.info('✅ Indexed hotel', { 
          id: change.fullDocument._id,
          name: change.fullDocument.name 
        });
      }
    } catch (error) {
      logger.error('❌ Failed to index hotel', error, { 
        changeId: change._id 
      });
      // Implement retry logic here
    }
  });

  // Handle errors
  changeStream.on('error', async (error) => {
    logger.error('❌ Change stream error', error);
    // Reconnect logic
    await changeStream.close();
    setTimeout(() => startChangeStreamListener(), 5000);
  });
}
```

**Pros:**
- ✅ Real-time indexing (< 1 second lag)
- ✅ Automatic updates on any hotel change
- ✅ Resilient with retry logic
- ✅ Independent deployment

**Cons:**
- ❌ Another service to maintain
- ❌ Requires always-on process

#### Option B: Plugin in Venue-Enrichment Service (Good for MVP)

Add Typesense indexing as a plugin:

```typescript
// services/venue-enrichment/src/plugins/05-typesense.ts
import { defineNitroPlugin } from 'nitropack/runtime';
import Typesense from 'typesense';
import { logger } from '../utils/shared/logger';
import { db } from '../utils/shared/database';

export default defineNitroPlugin(async (nitroApp) => {
  if (process.env.ENABLE_TYPESENSE_SYNC !== 'true') {
    logger.info('⏭️  Typesense sync disabled');
    return;
  }

  const typesenseClient = new Typesense.Client({
    nodes: [{
      host: process.env.TYPESENSE_HOST!,
      port: 443,
      protocol: 'https'
    }],
    apiKey: process.env.TYPESENSE_API_KEY!
  });

  // Start change stream listener
  const groundryDb = db.getSpecificDatabase('groundry');
  const collection = groundryDb.collection('hotels');
  
  const changeStream = collection.watch([
    { $match: { operationType: { $in: ['insert', 'update'] } } }
  ], { fullDocument: 'updateLookup' });

  changeStream.on('change', async (change) => {
    // Index to Typesense
  });

  logger.info('🔄 Typesense sync plugin initialized');
});
```

**Pros:**
- ✅ Quick to implement
- ✅ No new service needed
- ✅ Shares DB connection

**Cons:**
- ❌ Couples search sync to enrichment service
- ❌ Only runs when enrichment service is running

#### Option C: Manual Trigger After Enrichment (Simplest for MVP)

Add Typesense indexing directly in `handleEnrichRoomResponse`:

```typescript
// services/venue-enrichment/src/utils/enrich-static/handlers/handleEnrichRoomResponse.ts

async function handleEnrichRoomResponse(message: any) {
  // ... existing enrichment logic ...
  
  // After successfully saving to MongoDB
  if (result.success) {
    // Index to Typesense
    await indexHotelToTypesense(venue_id);
  }
}
```

**Pros:**
- ✅ Simplest implementation
- ✅ No background processes
- ✅ Guaranteed consistency

**Cons:**
- ❌ Only indexes newly enriched hotels
- ❌ Doesn't catch manual DB updates
- ❌ Adds latency to enrichment process

---

## Question 2: How Much Data Should We Index? 📊

### Typesense Schema Design

Based on your hotel schema and typical search patterns, here's the recommended Typesense collection schema:

```typescript
// Typesense Collection Schema
const hotelSearchSchema = {
  name: 'hotels',
  fields: [
    // === PRIMARY SEARCH FIELDS === 
    { name: 'id', type: 'string', facet: false }, // MongoDB _id
    { name: 'name', type: 'string', facet: false, sort: true },
    { name: 'slug', type: 'string', facet: false },
    
    // === LOCATION (High Priority) ===
    { name: 'city', type: 'string', facet: true, sort: true },
    { name: 'country', type: 'string', facet: true },
    { name: 'region', type: 'string', facet: true, optional: true },
    { name: 'neighborhood', type: 'string', facet: true, optional: true },
    { name: 'coordinates', type: 'geopoint', optional: true }, // [lat, lon]
    
    // === HOTEL IDENTITY ===
    { name: 'starRating', type: 'int32', facet: true, optional: true },
    { name: 'priceTier', type: 'string', facet: true, optional: true },
    { name: 'hotelTypes', type: 'string[]', facet: true, optional: true }, // ["Boutique", "Historic"]
    { name: 'brandAffiliation', type: 'string', facet: true, optional: true },
    { name: 'descriptionShort', type: 'string', facet: false, optional: true },
    
    // === AGGREGATED ROOM INFO ===
    { name: 'roomCount', type: 'int32', facet: true },
    { name: 'lowestRoomPrice', type: 'float', facet: true, optional: true },
    { name: 'highestRoomPrice', type: 'float', facet: true, optional: true },
    { name: 'roomTypes', type: 'string[]', facet: true }, // Unique room types
    
    // === AMENITIES (Searchable) ===
    { name: 'hotelAmenities', type: 'string[]', facet: true, optional: true },
    { name: 'hasParking', type: 'bool', facet: true, optional: true },
    { name: 'hasSpa', type: 'bool', facet: true, optional: true },
    { name: 'hasRestaurant', type: 'bool', facet: true, optional: true },
    { name: 'isPetFriendly', type: 'bool', facet: true, optional: true },
    { name: 'hasWifi', type: 'bool', facet: true, optional: true },
    
    // === REVIEWS ===
    { name: 'reviewScore', type: 'float', facet: true, sort: true, optional: true },
    { name: 'reviewCount', type: 'int32', facet: true, sort: true, optional: true },
    
    // === METADATA ===
    { name: 'createdAt', type: 'int64', sort: true }, // Unix timestamp
    { name: 'updatedAt', type: 'int64', sort: true, optional: true },
    { name: 'hasMedia', type: 'bool', facet: true, optional: true },
    { name: 'photoCount', type: 'int32', facet: true, optional: true }
  ],
  default_sorting_field: 'reviewScore'
};
```

### What to Index vs What to Exclude

#### ✅ INCLUDE (Search & Filter Priorities)

**Must Have:**
- Hotel name, slug, ID
- Location: city, country, neighborhood, coordinates
- Star rating, price tier
- Room count and types
- Key amenities (parking, WiFi, spa, pet-friendly)
- Review scores

**Nice to Have:**
- Hotel description (short version only)
- Hotel types (boutique, resort, etc.)
- Points of interest nearby
- Restaurant names
- Sustainability certifications

#### ❌ EXCLUDE (Keep Out of Typesense)

**Heavy Data (Store in MongoDB only):**
- Full room details (identity, features, media)
- Full hotel descriptions
- All review snippets
- Media galleries (URLs and metadata)
- Full source references
- Policy text blocks
- Complete contact information

**Why Exclude?**
- Typesense costs scale with document size
- Most fields aren't searchable/filterable
- Full data fetched from MongoDB after search
- Reduces index size by ~70-80%

### Document Size Estimation

```typescript
// Example indexed document (~1-2KB each)
{
  "id": "68a4a7c7c0cfc3faba6e44cf",
  "name": "The Peninsula Shanghai",
  "slug": "peninsula-shanghai-k3r4",
  "city": "Shanghai",
  "country": "China",
  "neighborhood": "The Bund",
  "coordinates": [31.2397, 121.4900],
  "starRating": 5,
  "priceTier": "$$$$$",
  "hotelTypes": ["Luxury", "Historic"],
  "roomCount": 9,
  "lowestRoomPrice": 450.00,
  "highestRoomPrice": 2500.00,
  "roomTypes": ["Deluxe King", "Premier Suite", "Peninsula Suite"],
  "hotelAmenities": ["Pool", "Spa", "Fitness Center", "Restaurant", "Bar"],
  "hasParking": true,
  "hasSpa": true,
  "isPetFriendly": false,
  "reviewScore": 4.7,
  "reviewCount": 1243,
  "createdAt": 1696204800,
  "hasMedia": true,
  "photoCount": 47
}

// vs Full MongoDB document (~50-100KB each)
```

**Storage Impact:**
- 10,000 hotels × 1.5KB = ~15MB (Typesense)
- 10,000 hotels × 75KB = ~750MB (MongoDB)
- **50x storage reduction in search index**

---

## Recommended Architecture

### Phase 1: MVP (Quick Start)
1. **Indexing Method:** Option C (Manual trigger after enrichment)
2. **Schema:** Minimal fields (name, location, basic filters)
3. **Update Strategy:** Only new enrichments

### Phase 2: Production (Scalable)
1. **Indexing Method:** Option A (Dedicated sync service with Change Streams)
2. **Schema:** Full schema as outlined above
3. **Update Strategy:** Real-time via change streams
4. **Batch Backfill:** Script to index existing hotels

### Phase 3: Advanced
1. **Synonyms:** Add hotel-specific synonyms (e.g., "5-star" → "luxury")
2. **Curations:** Featured hotels, seasonal promotions
3. **Analytics:** Track search queries, click-through rates
4. **A/B Testing:** Different ranking algorithms

---

## Implementation Checklist

### Setup
- [ ] Install Typesense client: `pnpm add typesense`
- [ ] Add Typesense env vars (host, API key)
- [ ] Create collection schema in Typesense
- [ ] Test connection and schema

### Transform Function
- [ ] Create `transformHotelForSearch()` function
- [ ] Extract relevant fields from MongoDB document
- [ ] Aggregate room data (count, types, price ranges)
- [ ] Convert timestamps to Unix format
- [ ] Handle optional fields gracefully

### Indexing Logic
- [ ] Implement chosen indexing method (A, B, or C)
- [ ] Add error handling and retries
- [ ] Log indexing operations
- [ ] Add metrics/monitoring

### Backfill (For Existing Hotels)
- [ ] Create backfill script
- [ ] Batch processing (100-1000 hotels at a time)
- [ ] Progress tracking
- [ ] Idempotent updates

### Testing
- [ ] Test search by name (typo-tolerance)
- [ ] Test geo-search (by coordinates)
- [ ] Test faceted filters (city, star rating, amenities)
- [ ] Test sorting (by price, rating, distance)
- [ ] Load testing (concurrent searches)

---

## Sample Code Snippets

### Transform Function
```typescript
function transformHotelForSearch(hotel: HotelDocument): any {
  // Extract unique room types
  const roomTypes = [...new Set(hotel.rooms.map(r => r.identity.roomType))];
  
  // Calculate price range
  const roomPrices = hotel.rooms
    .map(r => r.pricingContext?.avgNightlyRate?.min)
    .filter(p => p !== undefined);
  
  return {
    id: hotel._id,
    name: hotel.name,
    slug: hotel.slug,
    city: hotel.location?.city,
    country: hotel.location?.country,
    region: hotel.location?.region,
    neighborhood: hotel.location?.neighborhood,
    coordinates: hotel.location?.coordinates 
      ? [hotel.location.coordinates.lat, hotel.location.coordinates.lon]
      : undefined,
    starRating: hotel.identity?.starRating,
    priceTier: hotel.identity?.priceTier,
    hotelTypes: hotel.identity?.hotelType,
    brandAffiliation: hotel.identity?.brandAffiliation,
    descriptionShort: hotel.identity?.descriptionShort?.substring(0, 200), // Truncate
    roomCount: hotel.rooms.length,
    lowestRoomPrice: roomPrices.length ? Math.min(...roomPrices) : undefined,
    highestRoomPrice: roomPrices.length ? Math.max(...roomPrices) : undefined,
    roomTypes: roomTypes,
    hotelAmenities: hotel.facilities?.hotelAmenities?.slice(0, 20), // Limit
    hasParking: hotel.facilities?.parking?.available,
    hasSpa: !!hotel.facilities?.spa,
    hasRestaurant: hotel.foodAndBeverage?.restaurants?.length > 0,
    isPetFriendly: hotel.policies?.petPolicy?.petFriendly,
    hasWifi: hotel.facilities?.hotelAmenities?.includes('Free WiFi'),
    reviewScore: hotel.reviews?.aggregate?.score,
    reviewCount: hotel.reviews?.aggregate?.count,
    createdAt: new Date(hotel.createdAt).getTime() / 1000,
    updatedAt: hotel.contentLastUpdated 
      ? new Date(hotel.contentLastUpdated).getTime() / 1000 
      : undefined,
    hasMedia: !!hotel.media?.primaryImage,
    photoCount: hotel.media?.photoCount
  };
}
```

### Search API Example
```typescript
// Search hotels by name with filters
const searchResults = await typesenseClient
  .collections('hotels')
  .documents()
  .search({
    q: 'peninsula shanghai',
    query_by: 'name,city,neighborhood',
    filter_by: 'starRating:>=4 && isPetFriendly:true',
    sort_by: 'reviewScore:desc',
    per_page: 20
  });
```

---

## Performance Expectations

### Search Latency
- Simple text search: **< 50ms**
- Geo + filters: **< 100ms**
- Complex faceted search: **< 150ms**

### Indexing Speed
- Single hotel: **< 100ms**
- Batch (100 hotels): **< 2 seconds**
- Full backfill (10K hotels): **< 5 minutes**

---

## Cost Considerations

### Typesense Cloud Pricing (Example)
- **Starter:** $19/month (1M searches, 10GB RAM)
- **Growth:** $89/month (10M searches, 30GB RAM)
- **Business:** Custom pricing

### Self-Hosted
- Single node: $20-50/month (DigitalOcean/AWS)
- HA cluster (3 nodes): $150-200/month

**Recommendation:** Start with Cloud, migrate to self-hosted if costs grow.

---

## Summary

### For Your Questions:

**1. How to index?**
→ Use **MongoDB Change Streams** in a dedicated sync service (Option A) for production
→ Use **Manual trigger** (Option C) for quick MVP

**2. How much data to index?**
→ **~20-25 fields** from the full schema (~1-2KB per hotel)
→ Focus on searchable/filterable data only
→ Store full details in MongoDB, fetch after search

This gives you typo-tolerant search, geo-search, faceted filtering, and sub-100ms query times while keeping index size and costs manageable! 🚀
