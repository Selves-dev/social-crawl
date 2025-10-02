# Typesense Two-Collection Architecture

**Date:** 2025-10-02  
**Status:** ✅ Implemented

## Overview

This document describes the new two-collection Typesense architecture for hotel and room search indexing, replacing the previous single nested collection approach.

## Architecture

### Collections

#### 1. **hotels** Collection
Parent entities containing hotel-level information and aggregated room statistics.

**Key Features:**
- 40+ searchable and filterable fields
- Aggregated room statistics (min/max pricing, sizes, occupancy)
- Geolocation support
- Faceted filtering on amenities, location, ratings
- Default sorting by `review_score`

**Sample Document:**
```typescript
{
  id: "68a4a7c7c0cfc3faba6e44cf",
  name: "The Maids Head Hotel",
  slug: "maids-head-norwich-k3r4",
  selves_id: "maids-head-norwich-k3r4",
  
  // Classification
  star_rating: 4,
  price_tier: "$$$",
  hotel_types: ["Boutique", "Historic"],
  brand_affiliation: "Historic Hotels of Britain",
  
  // Location
  city: "Norwich",
  country: "England",
  region: "Norfolk",
  neighborhood: "Cathedral Quarter",
  location: [52.6323, 1.2989], // [lat, lon]
  walkability_score: 98,
  
  // Amenities
  amenities: ["Free WiFi", "Restaurant", "Bar"],
  has_spa: false,
  has_parking: true,
  pet_friendly: true,
  
  // Reviews
  review_score: 4.6,
  review_count: 3150,
  location_score: 4.9,
  
  // Aggregated Room Stats
  room_count: 84,
  room_types_available: ["Standard", "Superior", "Deluxe"],
  min_room_size_sqm: 18,
  max_room_size_sqm: 45,
  min_room_price: 120,
  max_room_price: 350,
  max_occupancy_available: 4,
  currency: "GBP"
}
```

#### 2. **rooms** Collection
Child entities containing room-specific information with parent hotel references.

**Key Features:**
- 30+ searchable and filterable fields
- Parent hotel reference via `hotel_id`
- Denormalized hotel context (name, slug, city, location)
- Physical characteristics (size, occupancy, bathroom)
- Pricing, amenities, and AI matching tags
- Default sorting by `min_price`

**Sample Document:**
```typescript
{
  id: "1",
  room_name: "Superior King Room",
  room_slug: "maids-head-norwich-k3r4-1",
  room_type: "Superior King",
  
  // Parent Reference
  hotel_id: "68a4a7c7c0cfc3faba6e44cf",
  
  // Denormalized Hotel Context
  hotel_name: "The Maids Head Hotel",
  hotel_slug: "maids-head-norwich-k3r4",
  city: "Norwich",
  location: [52.6323, 1.2989],
  
  // Physical Characteristics
  size_sqm_min: 28,
  size_sqm_max: 30,
  max_adults: 2,
  total_max_occupancy: 2,
  bathroom_type: "En-suite with bath and shower",
  tier: "Mid-range",
  
  // Pricing
  min_price: 165,
  max_price: 195,
  currency: "GBP",
  
  // Amenities & Features
  amenities: ["Air conditioning", "Flat-screen TV", "Free Wi-Fi"],
  unique_features: ["Panoramic city view"],
  has_coffee_machine: true,
  has_workspace: true,
  
  // AI Matching
  tags: ["city view", "business", "couples"],
  ideal_for: ["Business travelers", "Couples seeking city views"],
  not_ideal_for: ["Large families"]
}
```

## Benefits Over Previous Approach

### 1. **Independent Scaling**
- Hotels and rooms indexed separately
- Update rooms without re-indexing entire hotel
- Better performance for room-specific searches

### 2. **Flexible Querying**
- Search hotels, rooms, or both independently
- Filter rooms by hotel-level criteria using `hotel_id`
- Cross-collection multi-search for unified results

### 3. **Better Room Visibility**
- Rooms appear in dedicated search results
- Room-specific features more discoverable
- Easier to implement room-first search flows

### 4. **Optimized Filtering**
- Hotel-level filters on aggregated stats
- Room-level filters on specific amenities
- Combine both for precise matching

## Query Patterns

### Pattern 1: Search Hotels Only
```typescript
// Find luxury hotels in Shanghai with spa
const results = await client.collections('hotels')
  .documents()
  .search({
    q: 'luxury spa',
    query_by: 'name,slug,description,unique_selling_points,city,neighborhood,amenities,restaurant_cuisines,nearby_poi_names,nearby_poi_categories',
    filter_by: 'city:=Shanghai && star_rating:>=4 && has_spa:=true',
    sort_by: 'review_score:desc'
  })
```

### Pattern 2: Search Rooms Only
```typescript
// Find suites with king beds
const results = await client.collections('rooms')
  .documents()
  .search({
    q: 'suite king bed',
    query_by: 'room_name,room_slug,room_type,description,amenities,unique_features,climate_control,bathroom_type,tags,ideal_for',
    filter_by: 'max_adults:>=2',
    sort_by: 'total_max_occupancy:desc'
  })
```

### Pattern 3: Unified Multi-Collection Search
```typescript
// UNIFIED SEARCH: Search across both collections with consistent scoring
const results = await client.multiSearch.perform({
  searches: [
    {
      collection: 'hotels',
      q: 'spa wellness massage',
      query_by: 'name,slug,description,unique_selling_points,city,neighborhood,amenities,restaurant_cuisines,nearby_poi_names',
      per_page: 20,
      // Add metadata to identify result type
      hidden_hits: 'result_type:hotel'
    },
    {
      collection: 'rooms',
      q: 'spa wellness massage',
      query_by: 'room_name,room_slug,room_type,description,amenities,unique_features,climate_control,bathroom_type,tags,ideal_for',
      per_page: 20,
      hidden_hits: 'result_type:room'
    }
  ]
})

// Merge and rank unified results
const unified = mergeAndRankResults(results)
```

### Pattern 4: Cross-Collection Search (Japanese Toilets Example)

### Pattern 2: Search Rooms Only
```typescript
// Find rooms with balcony for 2 adults under $200
const results = await client.collections('rooms')
  .documents()
  .search({
    q: 'balcony view',
    query_by: 'room_name,description,unique_features',
    filter_by: 'city:=Miami && max_adults:>=2 && max_price:<=200',
    sort_by: 'min_price:asc'
  })
```

### Pattern 3: Cross-Collection Search
```typescript
### Pattern 4: Cross-Collection Search (Japanese Toilets Example)
```typescript
// Search for "japanese toilet" across hotels AND rooms
const results = await client.multiSearch.perform({
  searches: [
    {
      collection: 'hotels',
      q: 'japanese toilet bidet',
      query_by: 'name,description,amenities,unique_selling_points'
    },
    {
      collection: 'rooms',
      q: 'japanese toilet bidet',
      query_by: 'room_name,description,amenities,bathroom_type,unique_features'
    }
  ]
})

// Merge results with unified scoring
const unified = mergeAndRankResults(results)
```

### Pattern 5: Hotel + Its Rooms
```

### Pattern 4: Hotel + Its Rooms
```typescript
// Get a specific hotel and all its rooms
const results = await client.multiSearch.perform({
  searches: [
    {
      collection: 'hotels',
      q: 'Peninsula Shanghai',
      query_by: 'name',
      per_page: 1
    },
    {
      collection: 'rooms',
      q: '*',
      filter_by: `hotel_id:=${hotelId}`,
      per_page: 50,
      sort_by: 'min_price:asc'
    }
  ]
})
```

### Pattern 5: Room Size Range Search
```typescript
// Find rooms between 35-50 sqm
const results = await client.collections('rooms')
  .documents()
  .search({
    q: '*',
    filter_by: 'size_sqm_max:>=35 && size_sqm_min:<=50',
    sort_by: 'min_price:asc'
  })
```

## Sync Strategy

### MongoDB Change Stream → Typesense
Automatic real-time syncing via Change Stream plugin:

```typescript
// On hotel insert/update in MongoDB:
1. Transform hotel document
2. Upsert to hotels collection
3. Delete existing rooms for this hotel
4. Upsert all current rooms to rooms collection
```

**Handled Operations:**
- ✅ Hotel created → Index hotel + rooms
- ✅ Hotel updated → Re-index hotel + rooms
- ✅ Rooms added/updated → Re-index all rooms
- ✅ Rooms deleted → Delete from rooms collection

## Field Mapping

### Hotel Aggregations
These fields are calculated from rooms array:

| Field | Calculation |
|-------|-------------|
| `room_count` | Total number of rooms |
| `room_types_available` | Unique room types |
| `min_room_size_sqm` | Smallest room min size |
| `max_room_size_sqm` | Largest room max size |
| `min_room_price` | Lowest room price |
| `max_room_price` | Highest room price |
| `max_occupancy_available` | Highest room occupancy |

### Room Denormalizations
These hotel fields are copied to each room:

| Field | Source |
|-------|--------|
| `hotel_name` | hotel.name |
| `hotel_slug` | hotel.slug |
| `city` | hotel.location.city |
| `location` | hotel.location.coordinates |

## FalkorDB Integration (Future)

The two-collection structure enables future graph relationships:

```cypher
// Hotel nodes
(:Hotel {id, name, city, ...})

// Room nodes  
(:Room {id, hotel_id, name, tier, ...})

// Relationships
(:Hotel)-[:HAS_ROOM]->(:Room)
(:Room)-[:UPGRADES_TO]->(:Room)
(:Hotel)-[:SIMILAR_TO]->(:Hotel)
(:Hotel)-[:NEAR {distance_km}]->(:POI)
```

**Query Example:**
```cypher
// Find similar hotels with available rooms
MATCH (h:Hotel {id: $hotel_id})-[:SIMILAR_TO]->(similar:Hotel)
MATCH (similar)-[:HAS_ROOM]->(r:Room)
WHERE r.max_adults >= 2 AND r.min_price <= 300
RETURN similar, collect(r) as rooms
ORDER BY similar.review_score DESC
```

## Migration from Previous Schema

### Before (Nested):
```typescript
{
  id: "hotel123",
  name: "Hotel Name",
  // ... hotel fields
  rooms: [/* nested room objects */],
  document: {/* full MongoDB doc */}
}
```

### After (Two Collections):
```typescript
// hotels collection
{
  id: "hotel123",
  name: "Hotel Name",
  // ... hotel fields
  room_count: 50,
  min_room_price: 120
}

// rooms collection (50 separate documents)
{
  id: "room1",
  hotel_id: "hotel123",
  hotel_name: "Hotel Name",
  // ... room fields
}
```

## Performance Considerations

### Indexing
- **Hotels:** ~1-2ms per document
- **Rooms:** ~0.5ms per document
- **Bulk operations:** Batch upserts for better throughput

### Storage
- **Hotels:** ~2-5KB per document
- **Rooms:** ~1-2KB per document
- **Total:** Approximately same as nested approach

### Query Speed
- **Single collection:** Same or better (no nested field traversal)
- **Cross-collection:** Slightly slower (2 searches) but more flexible
- **Filtering:** Faster (indexed flat fields vs nested)

## Implementation Files

| File | Purpose |
|------|---------|
| `src/utils/shared/typesenseSchemas.ts` | Collection schemas and types |
| `src/utils/shared/typesenseTransform.ts` | MongoDB → Typesense transform |
| `src/plugins/05-typesense.ts` | Change Stream sync plugin |
| `scripts/create-typesense-collections-two-collection.js` | Collection setup script |

## Testing

### 1. Create Collections
```bash
cd scripts
node create-typesense-collections-two-collection.js
```

### 2. Verify Collections
```bash
curl "http://localhost:8108/collections" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}"
```

### 3. Test Hotel Search
```bash
curl "http://localhost:8108/collections/hotels/documents/search?q=luxury&query_by=name" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}"
```

### 4. Test Room Search
```bash
curl "http://localhost:8108/collections/rooms/documents/search?q=suite&query_by=room_name&filter_by=hotel_id:=hotel123" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}"
```

## Next Steps

1. ✅ Implement two-collection schema
2. ✅ Update transform logic
3. ✅ Update Change Stream plugin
4. ⏳ Create backfill script for existing data
5. ⏳ Implement cross-collection search helpers
6. ⏳ Add FalkorDB graph integration
7. ⏳ Build unified search API endpoint

## References

- [Typesense Multi-Search Documentation](https://typesense.org/docs/0.25.0/api/federated-multi-search.html)
- [Typesense Geolocation](https://typesense.org/docs/0.25.0/api/geosearch.html)
- [MongoDB Change Streams](https://www.mongodb.com/docs/manual/changeStreams/)
