# Typesense Integration - Ready to Test! 🚀

## What We Built

✅ **Database Configuration** - Fixed references from 'groundry' to 's_payload'  
✅ **Typesense Client** - Connection manager with health checks  
✅ **Transform Function** - Maps 68 hotel fields to searchable format  
✅ **Change Stream Plugin** - Auto-syncs MongoDB → Typesense in real-time  
✅ **Environment Setup** - Configured with Typesense Cloud credentials  

## How to Test

### Step 1: Start the Venue Enrichment Service

```bash
cd /Users/merry/Documents/projects/social-crawl/services/venue-enrichment
npm run dev
```

**Expected logs:**
```
✅ MongoDB Atlas connected successfully
✅ Typesense client initialized
🔍 Setting up MongoDB Change Stream for Typesense sync
✅ MongoDB Change Stream active - Typesense sync enabled
```

### Step 2: Run Your Hotel Enrichment

When you enrich a hotel and it gets saved to `s_payload.hotels`, the Change Stream will automatically:

1. Detect the insert/update
2. Transform the document (68 fields)
3. Index it in Typesense

**Expected logs:**
```
📝 MongoDB Change Stream event detected
✅ Hotel document indexed in Typesense
```

### Step 3: Verify Hotels in Typesense

```bash
cd /Users/merry/Documents/projects/social-crawl/scripts
node test-typesense-search.js
```

Or check document count:
```bash
node -e "
const Typesense = require('typesense');
const client = new Typesense.Client({
  nodes: [{
    host: '5i1q8hfruw7lnjezp-1.a1.typesense.net',
    port: 443,
    protocol: 'https'
  }],
  apiKey: '9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV'
});
client.collections('hotels').retrieve()
  .then(c => console.log('Hotels indexed:', c.num_documents))
  .catch(err => console.error('Error:', err));
"
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   ENRICHMENT WORKFLOW                    │
│                                                          │
│  Research → Rank → Enrich (Batches of 3 rooms)         │
│                      ↓                                   │
│                  Save to MongoDB                         │
│              (s_payload.hotels)                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ MongoDB Change Stream (real-time)
                     ↓
┌─────────────────────────────────────────────────────────┐
│              CHANGE STREAM PLUGIN                        │
│  05-typesense.ts (runs in venue-enrichment service)     │
│                                                          │
│  1. Detects insert/update event                         │
│  2. Gets full hotel document                            │
│  3. Transforms to Typesense schema (68 fields)          │
│  4. Upserts to Typesense Cloud                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 TYPESENSE CLOUD                          │
│      5i1q8hfruw7lnjezp-1.a1.typesense.net               │
│                                                          │
│  Collection: hotels                                      │
│  Documents: <count increases as hotels enrich>          │
│  Schema: 68 fields, 60+ searchable                      │
└─────────────────────────────────────────────────────────┘
```

## What Gets Indexed

Every hotel document transformed includes:

### Core (3 fields)
- id, name, slug

### Location (10 fields)  
- city, country, region, coordinates (lat/lon)
- neighborhood, postal code, street address
- distance to center, distance to airport

### Rooms (14 fields)
- Room count, types, tiers, view types
- Price: min/max/avg, currency
- Size: min/max, unit
- Max capacity

### Amenities (13 boolean fields)
- WiFi, Pool, Spa, Gym, Restaurant, Bar
- Parking, Pet-friendly, A/C, Room service
- Concierge, Business center, Airport shuttle

### Semantic Search (4 arrays)
- idealFor (tags like "business travelers", "families")
- roomTags (tags like "spacious", "luxury")
- uniqueSellingPoints (USPs from market position)
- nearbyPOIs (attractions from location data)

### Reviews & Media (5 fields)
- Review score, review count
- Primary image URL, image count
- Sustainability score

### Timestamps (2 fields)
- Created at, updated at

**Total: 68 fields indexed**, ready for advanced search queries!

## Next Steps

1. **Test the integration** - Run enrichment and watch logs
2. **Verify Typesense** - Check documents are being indexed
3. **Build search API** - Create endpoints to query Typesense
4. **Test search queries** - Filter by amenities, location, price, etc.

## Configuration Files

| File | Purpose |
|------|---------|
| `services/venue-enrichment/src/plugins/05-typesense.ts` | Change Stream listener |
| `services/venue-enrichment/src/utils/shared/typesense.ts` | Typesense client manager |
| `services/venue-enrichment/src/utils/shared/typesenseTransform.ts` | Document transformer |
| `.env` | Typesense credentials + database config |
| `scripts/create-typesense-collection.js` | Collection schema (already run) |

## Troubleshooting

**Q: Typesense not configured warning?**  
A: Check `.env` has `typesense-host`, `typesense-port`, `typesense-protocol`, `typesense-api-key`

**Q: Change Stream not triggering?**  
A: Verify `hotels-db-name=s_payload` in `.env` and MongoDB is accessible

**Q: Transform errors?**  
A: Check enriched hotel document has expected structure (rooms, location, etc.)

**Q: How do I disable Typesense sync temporarily?**  
A: Comment out the typesense-* vars in `.env` - plugin will skip setup

## Documentation

- **Setup Guide**: `docs/TYPESENSE-CHANGE-STREAM.md`
- **Schema Reference**: `docs/TYPESENSE-SCHEMA.md`
- **Database Config**: `docs/DATABASE-CONFIGURATION.md`
- **Implementation Plan**: `docs/TYPESENSE-IMPLEMENTATION-PLAN.md`

---

**Status**: ✅ Ready to test! Start the service and run your enrichment workflow.
