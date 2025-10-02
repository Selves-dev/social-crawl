# Typesense MongoDB Integration Plan

**Date**: October 2, 2025  
**Goal**: Production-ready real-time search indexing for hotel data  
**Reference**: https://typesense.org/docs/guide/mongodb-full-text-search.html

---

## 🎯 Architecture Overview

```
MongoDB Atlas (groundry.hotels)
        ↓
   Change Stream
        ↓
typesense-mongodb CLI
        ↓
   Typesense Cloud
        ↓
   Search API
```

---

## ✅ Implementation Plan

### Option 1: Official Typesense CLI (RECOMMENDED ⭐)

Typesense provides an official Node.js CLI that handles everything:
- **Package**: `typesense/typesense-mongodb`
- **Features**: 
  - Automatic change stream handling
  - Resume token persistence
  - Error recovery
  - Backfill support
  - Battle-tested in production

**Why use this?**
- ✅ Maintained by Typesense team
- ✅ Production-ready out of the box
- ✅ Handles edge cases
- ✅ Active development and support
- ✅ Minimal code to maintain

### Option 2: Custom Service (If you need special logic)

Build our own using the patterns from the guide.

**When to choose this?**
- Need custom transformation logic
- Want to integrate with existing monitoring
- Have specific deployment requirements

---

## 📋 Step-by-Step Implementation

### Phase 1: Prerequisites (15 mins)

#### 1.1 Verify MongoDB is a Replica Set ✓
**Current Status**: MongoDB Atlas is already a replica set by default
- No action needed if using Atlas
- Change streams require replica set

#### 1.2 Set Up Typesense
**Choose one:**

**A) Typesense Cloud (Easiest - $19/month)**
```bash
# Sign up at https://cloud.typesense.org
# Get your API keys and host URL
# No infrastructure to manage
```

**B) Self-Hosted Docker (Development)**
```bash
# Create docker-compose.yml in project root
docker-compose up -d typesense
```

**C) Production Docker (Your infrastructure)**
```bash
# Deploy to your existing infrastructure
# 3-node cluster for HA
```

#### 1.3 Install Typesense MongoDB CLI
```bash
# In project root
npm install -g typesense-mongodb

# Or run directly with npx
npx typesense-mongodb
```

---

### Phase 2: Configuration (30 mins)

#### 2.1 Create Configuration File

**File**: `/config/typesense-sync-config.json`

```json
{
  "mongodb": {
    "uri": "mongodb+srv://...",
    "database": "groundry",
    "collection": "hotels"
  },
  "typesense": {
    "host": "xxx.a1.typesense.net",
    "port": 443,
    "protocol": "https",
    "apiKey": "xyz"
  },
  "schema": {
    "name": "hotels",
    "fields": [
      {"name": "id", "type": "string"},
      {"name": "name", "type": "string", "sort": true},
      {"name": "city", "type": "string", "facet": true},
      // ... (see detailed schema below)
    ],
    "default_sorting_field": "reviewScore"
  },
  "transform": {
    "script": "./scripts/transform-hotel.js"
  },
  "options": {
    "batchSize": 100,
    "resumeTokenPath": "./data/resume-token.json"
  }
}
```

#### 2.2 Create Transform Function

**File**: `/scripts/transform-hotel.js`

```javascript
// Transform MongoDB document to Typesense format
module.exports = function transformHotel(mongoDoc) {
  // Extract all the semantic richness!
  const roomTypes = [...new Set(mongoDoc.rooms.map(r => r.identity?.roomType))];
  const roomTiers = [...new Set(mongoDoc.rooms.map(r => r.hierarchy?.tier))];
  const idealFor = [...new Set(mongoDoc.rooms.flatMap(r => r.wouldMatch?.idealFor || []))];
  
  // Price range
  const roomPrices = mongoDoc.rooms
    .map(r => r.pricingContext?.avgNightlyRate?.min)
    .filter(Boolean);
  
  // POIs for semantic matching
  const nearbyPOIs = (mongoDoc.location?.pointsOfInterest || [])
    .map(p => p.name)
    .slice(0, 30);
  
  return {
    id: mongoDoc._id.toString(),
    name: mongoDoc.name,
    slug: mongoDoc.slug,
    
    // Location (critical for search)
    city: mongoDoc.location?.city,
    country: mongoDoc.location?.country,
    neighborhood: mongoDoc.location?.neighborhood,
    coordinates: mongoDoc.location?.coordinates 
      ? [mongoDoc.location.coordinates.lat, mongoDoc.location.coordinates.lon]
      : null,
    
    // Classification
    starRating: mongoDoc.identity?.starRating,
    priceTier: mongoDoc.identity?.priceTier,
    hotelTypes: mongoDoc.identity?.hotelType,
    descriptionShort: mongoDoc.identity?.descriptionShort?.substring(0, 500),
    
    // Room aggregates
    roomCount: mongoDoc.rooms.length,
    lowestRoomPrice: roomPrices.length ? Math.min(...roomPrices) : null,
    highestRoomPrice: roomPrices.length ? Math.max(...roomPrices) : null,
    roomTypes,
    roomTiers,
    
    // Amenities (boolean flags for fast filtering)
    hotelAmenities: mongoDoc.facilities?.hotelAmenities?.slice(0, 50),
    hasParking: mongoDoc.facilities?.parking?.available,
    hasSpa: !!mongoDoc.facilities?.spa,
    hasPool: mongoDoc.facilities?.hotelAmenities?.some(a => 
      a.toLowerCase().includes('pool')),
    hasRestaurant: mongoDoc.foodAndBeverage?.restaurants?.length > 0,
    isPetFriendly: mongoDoc.policies?.petPolicy?.petFriendly,
    hasWifi: mongoDoc.facilities?.hotelAmenities?.some(a => 
      a.toLowerCase().includes('wifi')),
    
    // Reviews
    reviewScore: mongoDoc.reviews?.aggregate?.score,
    reviewCount: mongoDoc.reviews?.aggregate?.count,
    
    // Semantic matching gold!
    nearbyPOIs,
    idealFor,
    uniqueSellingPoints: mongoDoc.marketPosition?.uniqueSellingPoints,
    
    // Metadata
    createdAt: Math.floor(new Date(mongoDoc.createdAt).getTime() / 1000),
    isFullyEnriched: mongoDoc.rooms.length > 0 && 
      mongoDoc.rooms.some(r => r.identity && r.features)
  };
};
```

---

### Phase 3: Initial Backfill (1 hour)

**Goal**: Index all existing hotels before starting live sync

```bash
# Run backfill with the official CLI
npx typesense-mongodb backfill \
  --config ./config/typesense-sync-config.json \
  --batch-size 100

# OR with our custom script
node scripts/backfill-typesense.js
```

**Expected Output**:
```
✅ Connected to MongoDB
✅ Connected to Typesense  
✅ Collection 'hotels' created/verified
📦 Backfilling 47 documents...
   ⏳ Batch 1/1 (47 documents)
   ✅ Indexed 47 documents
⏱️  Total time: 2.3 seconds
```

---

### Phase 4: Live Sync (Ongoing)

#### 4.1 Start Change Stream Listener

**Using Official CLI (Recommended)**:
```bash
# Run as a background service
npx typesense-mongodb watch \
  --config ./config/typesense-sync-config.json \
  --log-level info

# OR with PM2 for production
pm2 start "npx typesense-mongodb watch --config ./config/typesense-sync-config.json" \
  --name typesense-sync
```

**Using Custom Service**:
```bash
cd services/typesense-sync
pnpm install
pnpm dev  # Development
pnpm start  # Production
```

#### 4.2 Verify Live Sync

```bash
# Test: Add a new hotel in MongoDB
# Watch the logs
# Search in Typesense immediately after

# Should see:
# [typesense-sync] Change detected: insert
# [typesense-sync] ✅ Synced hotel: "New Hotel Name"
```

---

### Phase 5: Search API Integration (2 hours)

#### 5.1 Create Search Endpoint

**File**: `services/venue-enrichment/src/routes/search.get.ts`

```typescript
import { defineEventHandler, getQuery } from 'h3';
import Typesense from 'typesense';

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST!,
    port: 443,
    protocol: 'https'
  }],
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY!
});

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  
  const searchParams = {
    q: query.q as string || '*',
    query_by: 'name,city,neighborhood,nearbyPOIs,hotelTypes',
    filter_by: buildFilters(query),
    sort_by: query.sort || 'reviewScore:desc',
    per_page: parseInt(query.per_page as string) || 20,
    page: parseInt(query.page as string) || 1
  };
  
  const results = await typesenseClient
    .collections('hotels')
    .documents()
    .search(searchParams);
  
  // Fetch full details from MongoDB for results
  const hotelIds = results.hits?.map(hit => hit.document.id);
  const fullHotels = await fetchFullHotelsFromMongoDB(hotelIds);
  
  return {
    results: results.hits,
    fullDetails: fullHotels,
    facets: results.facet_counts,
    meta: {
      found: results.found,
      page: results.page
    }
  };
});
```

#### 5.2 Example Search Queries

```bash
# Text search with typo tolerance
GET /search?q=penninsula+shanghi
# → Finds "Peninsula Shanghai" despite typos

# Semantic matching with filters
GET /search?q=luxury+hotel+near+bund&city=Shanghai&starRating>=4

# Geo search
GET /search?q=*&filter_by=coordinates:(31.23, 121.49, 5 km)

# Faceted search
GET /search?q=pet+friendly&hasParking=true&hasSpa=true
```

---

## 🏗️ Infrastructure Decisions

### Decision 1: Typesense Hosting

| Option | Cost | Setup Time | Pros | Cons |
|--------|------|------------|------|------|
| **Cloud** | $19-89/mo | 5 mins | Managed, HA, backups | Recurring cost |
| **Self-host** | $20-50/mo | 2 hours | Full control | Maintenance burden |
| **Docker (dev)** | Free | 10 mins | Local testing | Dev only |

**Recommendation**: Start with **Typesense Cloud**, migrate to self-hosted if costs become significant (>$200/mo).

### Decision 2: Sync Method

| Option | Complexity | Maintenance | Features |
|--------|-----------|-------------|----------|
| **Official CLI** | Low | Minimal | Full-featured |
| **Custom Service** | Medium | Active | Custom logic |

**Recommendation**: Use **Official CLI** (`typesense-mongodb`) unless you need custom transformation logic beyond what's possible with the transform script.

---

## 🧪 Testing Plan

### Test 1: Backfill Verification
```bash
# Count in MongoDB
db.hotels.countDocuments()  # → 47

# Count in Typesense
curl "http://localhost:8108/collections/hotels/documents/export"
# → Should be 47 documents
```

### Test 2: Live Sync
```bash
# Insert new hotel in MongoDB
db.hotels.insertOne({...})

# Wait 1 second, then search in Typesense
curl "http://localhost:8108/collections/hotels/documents/search?q=new+hotel"
# → Should find the new hotel immediately
```

### Test 3: Search Quality
```bash
# Typo tolerance
search("penninsula") → Finds "Peninsula"

# Semantic matching
search("luxury hotel with spa near bund") 
  → Returns hotels with spa, high star rating, in The Bund neighborhood

# Faceted filtering
search("pet friendly hotels", filters: { city: "Shanghai", hasParking: true })
  → Returns only matching hotels
```

---

## 📊 Monitoring

### Metrics to Track
1. **Sync Lag**: Time between MongoDB write and Typesense index
2. **Search Latency**: p50, p95, p99 response times
3. **Error Rate**: Failed sync operations
4. **Index Size**: Typesense collection size over time

### Alerting
- Alert if sync lag > 10 seconds
- Alert if error rate > 1%
- Alert if search latency p95 > 200ms

---

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] MongoDB is a replica set (Atlas ✓)
- [ ] Typesense instance running
- [ ] Configuration file created
- [ ] Transform function tested
- [ ] Backfill completed successfully

### Deployment
- [ ] Start sync service with PM2 or systemd
- [ ] Verify change stream is active
- [ ] Test insert/update/delete operations
- [ ] Verify resume token persistence

### Post-deployment
- [ ] Set up monitoring dashboard
- [ ] Configure alerts
- [ ] Document search API for frontend team
- [ ] Load test search endpoints

---

## 💰 Cost Estimate

### Typesense Cloud
- **Starter**: $19/month (1M searches, good for 10K hotels)
- **Growth**: $89/month (10M searches, good for 100K hotels)

### MongoDB Atlas (Current)
- No additional cost (already using it)

### Compute
- Sync service: Negligible (Node.js process, ~50MB RAM)

**Total**: ~$20-90/month depending on scale

---

## 🎯 Success Metrics

After implementation, we should see:

1. **Search Speed**: < 50ms for typical queries
2. **Typo Tolerance**: Finds results despite 2-3 character typos
3. **Sync Latency**: < 1 second from MongoDB write to searchable
4. **Uptime**: 99.9%+ availability
5. **Semantic Matching**: High relevance for natural language queries

---

## 📚 Resources

- [Typesense MongoDB Guide](https://typesense.org/docs/guide/mongodb-full-text-search.html)
- [Official CLI: typesense-mongodb](https://github.com/typesense/typesense-mongodb)
- [Typesense Cloud](https://cloud.typesense.org/)
- [MongoDB Change Streams](https://docs.mongodb.com/manual/changeStreams/)

---

## 🤔 Open Questions

1. **Where should we host Typesense?**
   - Recommendation: Start with Cloud, evaluate self-hosting at scale

2. **Do we need custom transformation logic?**
   - Recommendation: Try official CLI first, it supports custom transform scripts

3. **How do we handle schema evolution?**
   - Recommendation: Version the collection name (hotels_v1, hotels_v2) and use aliases

4. **What about multi-region search?**
   - Recommendation: Typesense Cloud has multi-region support built-in

---

## ⏭️ Next Steps

**Immediate** (This Week):
1. Sign up for Typesense Cloud (or set up Docker locally)
2. Install `typesense-mongodb` CLI
3. Create config file and transform script
4. Run backfill of existing 47 hotels
5. Start change stream sync

**Short-term** (Next Week):
1. Build search API endpoints
2. Test semantic matching quality
3. Set up monitoring

**Long-term** (Next Month):
1. Integrate with frontend
2. Add search analytics
3. Optimize relevance tuning

---

**Ready to start?** Let's begin with Step 1: Setting up Typesense!
