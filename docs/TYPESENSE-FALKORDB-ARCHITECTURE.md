# Typesense + FalkorDB Architecture

## The Problem with Our Current Approach

**We're fighting the document model!** 

MongoDB stores:
```
Hotel {
  _id,
  name,
  location,
  rooms: [
    { roomId, roomName, identity, features, ... },
    { roomId, roomName, identity, features, ... }
  ],
  facilities,
  policies,
  reviews
}
```

Our Typesense V2 split it into:
- `hotels` collection (loses room details)
- `rooms` collection (duplicates hotel data)

**Problems:**
- ❌ Doesn't match MongoDB structure
- ❌ Harder to maintain (sync 2 collections)
- ❌ Duplicates data (hotel info in every room)
- ❌ Can't query nested room data naturally
- ❌ Doesn't leverage FalkorDB for relationships

---

## Better Solution: MongoDB-like + FalkorDB Graph

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MONGODB (s_payload)                   │
│  Source of truth - Full nested hotel documents          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Change Stream
                     ↓
      ┌──────────────────────────────┐
      │                              │
      ↓                              ↓
┌──────────────────┐        ┌──────────────────┐
│   TYPESENSE      │        │    FALKORDB      │
│                  │        │   (Graph DB)     │
│  Full-text       │←──────→│   Relationships  │
│  search          │        │                  │
└──────────────────┘        └──────────────────┘
```

### Component Roles

#### 1. **MongoDB** - Source of Truth
- Stores complete hotel documents
- Nested structure preserved
- All enrichment data

#### 2. **Typesense** - Full-Text Search Engine
- Single `hotels` collection
- Stores full document AS IS (nested rooms)
- Minimal flat fields for filtering
- Fast text search on hotel/room names, descriptions

#### 3. **FalkorDB** - Graph Relationships
- Hotel → Location relationships
- Hotel → Amenity relationships  
- Room → RoomType relationships
- Hotel → Hotel (similar hotels)
- Complex graph queries

---

## Typesense Schema: One Collection, Full Documents

### Hotels Collection (Single Source)

```typescript
{
  name: 'hotels',
  fields: [
    // === FLAT FIELDS FOR FILTERING (15 fields) ===
    
    // Core
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'slug', type: 'string' },
    
    // Location
    { name: 'city', type: 'string', facet: true },
    { name: 'country', type: 'string', facet: true },
    { name: 'latitude', type: 'float' },
    { name: 'longitude', type: 'float' },
    
    // Price range (computed from rooms)
    { name: 'minPrice', type: 'int32', optional: true },
    { name: 'maxPrice', type: 'int32', optional: true },
    
    // Key amenities (6)
    { name: 'hasPool', type: 'bool', facet: true },
    { name: 'hasSpa', type: 'bool', facet: true },
    { name: 'hasGym', type: 'bool', facet: true },
    { name: 'hasParking', type: 'bool', facet: true },
    { name: 'hasPetFriendly', type: 'bool', facet: true },
    { name: 'hasBreakfast', type: 'bool', facet: true },
    
    // Reviews
    { name: 'reviewScore', type: 'float', optional: true },
    
    // Timestamp
    { name: 'updatedAt', type: 'int64' },
    
    // === NESTED SEARCHABLE FIELDS (rooms) ===
    // Typesense supports searching nested arrays!
    
    { name: 'rooms', type: 'object[]', optional: true, facet: false },
    // Can search: rooms.roomName, rooms.identity.roomType, rooms.wouldMatch.tags
    
    // === FULL DOCUMENT (non-indexed, for display) ===
    { name: 'document', type: 'object', optional: true, index: false }
  ],
  
  default_sorting_field: 'reviewScore'
}
```

### Example Document in Typesense

```json
{
  "id": "68a4a7c7c0cfc3faba6e44cf",
  "name": "One Hundred Shoreditch Hotel",
  "slug": "one-hundred-shoreditch-london",
  "city": "London",
  "country": "England",
  "latitude": 51.52569,
  "longitude": -0.077457,
  "minPrice": 150,
  "maxPrice": 450,
  "hasPool": false,
  "hasSpa": true,
  "hasGym": true,
  "hasParking": true,
  "hasPetFriendly": true,
  "hasBreakfast": true,
  "reviewScore": 8.8,
  "updatedAt": 1759409400,
  
  "rooms": [
    {
      "roomId": "room-001",
      "roomName": "Studio Plus",
      "roomSlug": "studio-plus",
      "identity": {
        "roomType": "Studio",
        "sizeSqMeters": 25,
        "capacity": { "maxAdults": 2, "maxChildren": 0 }
      },
      "hierarchy": { "tier": "Mid-range" },
      "pricingContext": {
        "avgNightlyRate": { "min": 150, "max": 200, "currency": "USD" }
      },
      "wouldMatch": {
        "tags": ["workspace", "city-view"],
        "idealFor": ["business", "couples"]
      },
      "features": { ... },
      "media": { ... }
    },
    { ... more rooms ... }
  ],
  
  "document": { /* Full MongoDB hotel document */ }
}
```

---

## Search Queries with Nested Rooms

### Find hotels with specific room types
```typescript
client.collections('hotels').documents().search({
  q: 'luxury suite',
  query_by: 'name,rooms.roomName,rooms.identity.roomType',
  filter_by: 'city:London && hasPool:true'
})
```

### Find hotels with rooms that have specific tags
```typescript
client.collections('hotels').documents().search({
  q: 'workspace',
  query_by: 'rooms.wouldMatch.tags',
  filter_by: 'city:London && minPrice:<200'
})
```

### Find hotels with rooms for families
```typescript
client.collections('hotels').documents().search({
  q: '*',
  filter_by: 'city:Paris && rooms.wouldMatch.idealFor:=families'
})
```

**Key insight**: Typesense can search nested arrays! No need to flatten.

---

## FalkorDB Graph Schema

Use FalkorDB for **relationships and graph queries**, not for storing full documents.

### Nodes
```cypher
// Hotel nodes (lightweight)
(:Hotel {
  id: "68a4a7c7c0cfc3faba6e44cf",
  name: "One Hundred Shoreditch",
  slug: "one-hundred-shoreditch-london",
  city: "London",
  reviewScore: 8.8
})

// Location nodes
(:City { name: "London", country: "England" })
(:Neighborhood { name: "Shoreditch", city: "London" })

// Amenity nodes
(:Amenity { name: "Spa", category: "wellness" })
(:Amenity { name: "Pool", category: "recreation" })

// Room Type nodes
(:RoomType { name: "Studio", tier: "Mid-range" })
```

### Relationships
```cypher
// Hotel relationships
(hotel)-[:LOCATED_IN]->(city)
(hotel)-[:IN_NEIGHBORHOOD]->(neighborhood)
(hotel)-[:HAS_AMENITY]->(amenity)
(hotel)-[:OFFERS]->(roomType)
(hotel)-[:SIMILAR_TO {score: 0.85}]->(otherHotel)

// Location relationships
(neighborhood)-[:PART_OF]->(city)
(city)-[:IN_COUNTRY]->(country)
```

### Graph Queries

**Find similar hotels in same area:**
```cypher
MATCH (h:Hotel {id: "hotel123"})-[:LOCATED_IN]->(city)
MATCH (similar:Hotel)-[:LOCATED_IN]->(city)
WHERE similar.reviewScore >= h.reviewScore - 0.5
  AND similar.id <> h.id
RETURN similar
LIMIT 5
```

**Find hotels near POIs:**
```cypher
MATCH (poi:POI {name: "British Museum"})
MATCH (h:Hotel)-[:NEAR {distance_km: <2}]->(poi)
RETURN h
```

**Find hotels with specific amenity combinations:**
```cypher
MATCH (h:Hotel)-[:HAS_AMENITY]->(a1:Amenity {name: "Spa"})
MATCH (h)-[:HAS_AMENITY]->(a2:Amenity {name: "Pool"})
MATCH (h)-[:HAS_AMENITY]->(a3:Amenity {name: "Gym"})
RETURN h
```

---

## Unified Search Architecture

### Query Flow

```
User Query: "Find family-friendly hotels with pool near British Museum"
    │
    ↓
┌────────────────────────────┐
│  1. Text Search (Typesense) │
│  → "family-friendly"        │
│  → hasPool: true            │
└───────────┬────────────────┘
            │
            │ Get hotel IDs
            ↓
┌────────────────────────────┐
│  2. Graph Filter (FalkorDB)│
│  → Near British Museum      │
│  → Similar hotels           │
└───────────┬────────────────┘
            │
            │ Merge results
            ↓
┌────────────────────────────┐
│  3. Get Full Docs (MongoDB)│
│  OR use document field      │
│  from Typesense             │
└────────────────────────────┘
```

### Example Implementation

```typescript
async function searchHotels(query: {
  text?: string
  city?: string
  amenities?: string[]
  nearPOI?: string
  priceRange?: { min: number, max: number }
}) {
  // 1. Text search in Typesense
  const typesenseResults = await typesense.collections('hotels')
    .documents()
    .search({
      q: query.text || '*',
      query_by: 'name,rooms.roomName,rooms.wouldMatch.tags',
      filter_by: buildFilter(query)
    })
  
  const hotelIds = typesenseResults.hits.map(h => h.document.id)
  
  // 2. If location query, use FalkorDB
  if (query.nearPOI) {
    const graphResults = await falkordb.query(`
      MATCH (poi:POI {name: $poiName})
      MATCH (h:Hotel)-[:NEAR]->(poi)
      WHERE h.id IN $hotelIds
      RETURN h.id
    `, { poiName: query.nearPOI, hotelIds })
    
    // Filter to graph-matched hotels
    hotelIds = graphResults.map(r => r['h.id'])
  }
  
  // 3. Return full documents (already in Typesense results)
  return typesenseResults.hits
    .filter(h => hotelIds.includes(h.document.id))
    .map(h => h.document.document) // Full MongoDB doc
}
```

---

## Change Stream Implementation

**Single Change Stream → Both Typesense + FalkorDB**

```typescript
changeStream.on('change', async (change) => {
  const hotel = getFullDocument(change)
  
  // 1. Index in Typesense (one document, nested rooms)
  await typesense.collections('hotels')
    .documents()
    .upsert(transformHotelForTypesense(hotel))
  
  // 2. Update graph in FalkorDB
  await updateHotelGraph(hotel)
})

function updateHotelGraph(hotel: HotelDocument) {
  // Create/update hotel node
  await falkordb.query(`
    MERGE (h:Hotel {id: $id})
    SET h.name = $name,
        h.slug = $slug,
        h.reviewScore = $reviewScore
  `, {
    id: hotel._id,
    name: hotel.name,
    slug: hotel.slug,
    reviewScore: hotel.reviews?.aggregate?.score
  })
  
  // Create location relationships
  if (hotel.location?.city) {
    await falkordb.query(`
      MATCH (h:Hotel {id: $hotelId})
      MERGE (c:City {name: $city})
      MERGE (h)-[:LOCATED_IN]->(c)
    `, {
      hotelId: hotel._id,
      city: hotel.location.city
    })
  }
  
  // Create amenity relationships
  for (const amenity of hotel.facilities?.hotelAmenities || []) {
    await falkordb.query(`
      MATCH (h:Hotel {id: $hotelId})
      MERGE (a:Amenity {name: $amenity})
      MERGE (h)-[:HAS_AMENITY]->(a)
    `, {
      hotelId: hotel._id,
      amenity
    })
  }
}
```

---

## Summary: Best of Both Worlds

| Aspect | MongoDB | Typesense | FalkorDB |
|--------|---------|-----------|----------|
| **Role** | Source of truth | Full-text search | Graph relationships |
| **Structure** | Nested documents | Nested documents | Graph nodes/edges |
| **Use Cases** | CRUD operations | Text search, filters | Complex relationships |
| **Rooms** | Nested in hotel | Nested in hotel | Node type |
| **Queries** | By ID, simple filters | Text, geo, facets | Graph traversal |
| **Data Loss** | None | None | Lightweight refs only |

### When to Use Each

**Typesense:**
- "Find hotels with 'spa' in London"
- "Hotels with 'workspace' rooms under $200"
- Filter by amenities, location, price
- Sort by review score

**FalkorDB:**
- "Hotels similar to this one"
- "Hotels near British Museum"
- "Hotels in same neighborhood as..."
- "Most connected hotels" (social graph)

**MongoDB:**
- Get full hotel details
- Update enrichment data
- Complex aggregations

---

## Next Steps

1. ✅ Keep Typesense as **one collection** with nested rooms
2. ✅ Store full document in `document` field
3. ✅ Add FalkorDB for graph queries
4. ✅ Use both together for powerful search

Want me to implement this unified approach?
