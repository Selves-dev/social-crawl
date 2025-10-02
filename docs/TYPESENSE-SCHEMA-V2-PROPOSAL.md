# Improved Typesense Schema Design

## Problems with Current Schema

1. **Data Loss**: Flattening loses nested structures (room features, policies, facilities details)
2. **No Room Listings**: Can't search/list individual rooms, only aggregate data
3. **Zero Noise**: `0` values for missing data (avgPrice=0, maxCapacity=0) are misleading
4. **Hard to Maintain**: Transform function duplicates MongoDB structure logic
5. **Not Queryable**: Can't filter by specific room features, only aggregates

## Solution: Two Collections + JSON Fields

### Collection 1: `hotels` - Hotel Search
**Purpose**: Find hotels by location, amenities, price range  
**Structure**: Flat searchable fields + full JSON document

```typescript
{
  // Essential flat fields for filtering/sorting
  id: string
  name: string
  slug: string
  city: string
  country: string
  region: string
  neighborhood: string
  latitude: float
  longitude: float
  
  // Price range (from rooms)
  minPrice?: int32
  maxPrice?: int32
  currency?: string
  
  // Amenities (boolean flags for filtering)
  hasWifi: boolean
  hasPool: boolean
  hasSpa: boolean
  hasGym: boolean
  hasRestaurant: boolean
  hasBar: boolean
  hasParking: boolean
  hasPetFriendly: boolean
  hasAirConditioning: boolean
  hasRoomService: boolean
  hasConcierge: boolean
  hasBusinessCenter: boolean
  hasAirportShuttle: boolean
  
  // Reviews
  reviewScore?: float
  reviewCount?: int32
  
  // Timestamps
  createdAt: int64
  updatedAt: int64
  
  // FULL DOCUMENT as JSON (optional field, not searchable)
  document?: object  // Complete MongoDB document for display
}
```

**Benefits**:
- Only 25 flat fields (vs 68)
- No data loss - full document stored
- No `0` noise - optional fields
- Easy to query: "hotels with pool in London under $200"

---

### Collection 2: `rooms` - Room Search & Listings
**Purpose**: Search/list individual rooms, show on hotel detail pages

```typescript
{
  // Room identifiers
  id: string              // roomId
  roomSlug: string
  roomName: string
  
  // Hotel reference
  hotelId: string         // Reference to hotel._id
  hotelName: string
  hotelSlug: string
  hotelCity: string
  hotelCountry: string
  
  // Room classification
  roomType: string        // "Studio", "Suite", "Deluxe", etc.
  tier?: string           // "Entry-level", "Mid-range", "Premium", "Luxury"
  
  // Pricing
  avgPrice?: int32        // Average nightly rate
  priceMin?: int32
  priceMax?: int32
  currency?: string
  
  // Size & Capacity
  sizeSqMeters?: int32
  maxAdults?: int32
  maxChildren?: int32
  maxInfants?: int32
  
  // Features (for filtering)
  hasBalcony: boolean
  hasKitchenette: boolean
  hasWorkspace: boolean
  hasBathtub: boolean
  viewType?: string       // "City", "Ocean", "Garden", etc.
  
  // Semantic matching
  tags: string[]          // ["spacious", "luxury", "quiet"]
  idealFor: string[]      // ["couples", "business", "families"]
  
  // Media
  primaryImageUrl?: string
  imageCount?: int32
  
  // Timestamps
  createdAt: int64
  updatedAt: int64
  
  // FULL ROOM DOCUMENT as JSON
  document?: object       // Complete room object from MongoDB
}
```

**Benefits**:
- Individual room listings
- Search specific room types
- Filter by room features (balcony, workspace, etc.)
- Link back to hotel
- Full room data preserved

---

## Implementation Changes

### 1. Create Two Collections

```javascript
// scripts/create-typesense-collections-v2.js

// Collection 1: Hotels
{
  name: 'hotels',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'city', type: 'string', facet: true },
    { name: 'country', type: 'string', facet: true },
    { name: 'region', type: 'string', facet: true, optional: true },
    { name: 'neighborhood', type: 'string', optional: true },
    { name: 'latitude', type: 'float' },
    { name: 'longitude', type: 'float' },
    { name: 'minPrice', type: 'int32', optional: true },
    { name: 'maxPrice', type: 'int32', optional: true },
    { name: 'currency', type: 'string', optional: true },
    { name: 'hasWifi', type: 'bool', facet: true },
    { name: 'hasPool', type: 'bool', facet: true },
    { name: 'hasSpa', type: 'bool', facet: true },
    { name: 'hasGym', type: 'bool', facet: true },
    { name: 'hasRestaurant', type: 'bool', facet: true },
    { name: 'hasBar', type: 'bool', facet: true },
    { name: 'hasParking', type: 'bool', facet: true },
    { name: 'hasPetFriendly', type: 'bool', facet: true },
    { name: 'hasAirConditioning', type: 'bool', facet: true },
    { name: 'hasRoomService', type: 'bool', facet: true },
    { name: 'hasConcierge', type: 'bool', facet: true },
    { name: 'hasBusinessCenter', type: 'bool', facet: true },
    { name: 'hasAirportShuttle', type: 'bool', facet: true },
    { name: 'reviewScore', type: 'float', optional: true },
    { name: 'reviewCount', type: 'int32', optional: true },
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64' },
    { name: 'document', type: 'object', optional: true, index: false }  // Full doc
  ],
  default_sorting_field: 'reviewScore'
}

// Collection 2: Rooms
{
  name: 'rooms',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'roomSlug', type: 'string' },
    { name: 'roomName', type: 'string' },
    { name: 'hotelId', type: 'string', facet: true },
    { name: 'hotelName', type: 'string' },
    { name: 'hotelSlug', type: 'string' },
    { name: 'hotelCity', type: 'string', facet: true },
    { name: 'hotelCountry', type: 'string', facet: true },
    { name: 'roomType', type: 'string', facet: true },
    { name: 'tier', type: 'string', facet: true, optional: true },
    { name: 'avgPrice', type: 'int32', optional: true },
    { name: 'priceMin', type: 'int32', optional: true },
    { name: 'priceMax', type: 'int32', optional: true },
    { name: 'currency', type: 'string', optional: true },
    { name: 'sizeSqMeters', type: 'int32', optional: true },
    { name: 'maxAdults', type: 'int32', optional: true },
    { name: 'maxChildren', type: 'int32', optional: true },
    { name: 'maxInfants', type: 'int32', optional: true },
    { name: 'hasBalcony', type: 'bool', facet: true },
    { name: 'hasKitchenette', type: 'bool', facet: true },
    { name: 'hasWorkspace', type: 'bool', facet: true },
    { name: 'hasBathtub', type: 'bool', facet: true },
    { name: 'viewType', type: 'string', facet: true, optional: true },
    { name: 'tags', type: 'string[]', facet: true, optional: true },
    { name: 'idealFor', type: 'string[]', facet: true, optional: true },
    { name: 'primaryImageUrl', type: 'string', optional: true },
    { name: 'imageCount', type: 'int32', optional: true },
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64' },
    { name: 'document', type: 'object', optional: true, index: false }  // Full room object
  ],
  default_sorting_field: 'avgPrice'
}
```

### 2. Simplified Transform Functions

```typescript
// transformHotelForTypesense - Much simpler!
function transformHotelForTypesense(hotel: HotelDocument) {
  const rooms = hotel.rooms || []
  const prices = rooms
    .map(r => r.pricingContext?.avgNightlyRate?.min)
    .filter(p => p > 0)
  
  return {
    id: String(hotel._id),
    name: hotel.name,
    slug: hotel.slug,
    city: hotel.location?.city || '',
    country: hotel.location?.country || '',
    region: hotel.location?.region,
    neighborhood: hotel.location?.neighborhood,
    latitude: hotel.location?.coordinates?.lat || 0,
    longitude: hotel.location?.coordinates?.lon || 0,
    minPrice: prices.length > 0 ? Math.min(...prices) : undefined,
    maxPrice: prices.length > 0 ? Math.max(...prices) : undefined,
    currency: rooms[0]?.pricingContext?.avgNightlyRate?.currency,
    hasWifi: checkAmenity(hotel, 'wifi'),
    hasPool: checkAmenity(hotel, 'pool'),
    // ... other amenities
    reviewScore: hotel.reviews?.aggregate?.score,
    reviewCount: hotel.reviews?.aggregate?.count,
    createdAt: toUnixTimestamp(hotel.createdAt),
    updatedAt: toUnixTimestamp(hotel.contentLastUpdated),
    document: hotel  // FULL DOCUMENT - no data loss!
  }
}

// transformRoomForTypesense - New!
function transformRoomForTypesense(room: HotelRoom, hotel: HotelDocument) {
  return {
    id: room.roomId,
    roomSlug: room.roomSlug,
    roomName: room.roomName,
    hotelId: String(hotel._id),
    hotelName: hotel.name,
    hotelSlug: hotel.slug,
    hotelCity: hotel.location?.city || '',
    hotelCountry: hotel.location?.country || '',
    roomType: room.identity?.roomType || '',
    tier: room.hierarchy?.tier,
    avgPrice: room.pricingContext?.avgNightlyRate?.min,
    priceMin: room.pricingContext?.avgNightlyRate?.min,
    priceMax: room.pricingContext?.avgNightlyRate?.max,
    currency: room.pricingContext?.avgNightlyRate?.currency,
    sizeSqMeters: room.identity?.sizeSqMeters,
    maxAdults: room.identity?.capacity?.maxAdults,
    maxChildren: room.identity?.capacity?.maxChildren,
    maxInfants: room.identity?.capacity?.maxInfants,
    hasBalcony: checkRoomFeature(room, 'balcony'),
    hasKitchenette: checkRoomFeature(room, 'kitchenette'),
    hasWorkspace: checkRoomFeature(room, 'workspace'),
    hasBathtub: room.features?.bathroomType?.includes('bathtub') || false,
    viewType: extractViewType(room),
    tags: room.wouldMatch?.tags || [],
    idealFor: room.wouldMatch?.idealFor || [],
    primaryImageUrl: room.media?.primaryImageUrl,
    imageCount: room.media?.photoCount,
    createdAt: toUnixTimestamp(hotel.createdAt),
    updatedAt: toUnixTimestamp(hotel.contentLastUpdated),
    document: room  // FULL ROOM OBJECT
  }
}
```

### 3. Change Stream Updates Both Collections

```typescript
changeStream.on('change', async (change) => {
  const hotel = getFullDocument(change)
  
  // Index hotel
  await typesenseClient.collections('hotels')
    .documents().upsert(transformHotelForTypesense(hotel))
  
  // Index all rooms
  for (const room of hotel.rooms || []) {
    await typesenseClient.collections('rooms')
      .documents().upsert(transformRoomForTypesense(room, hotel))
  }
})
```

---

## Query Examples

### Search Hotels
```typescript
// Find hotels with pool in London under $200/night
client.collections('hotels').documents().search({
  q: '*',
  filter_by: 'city:London && hasPool:true && maxPrice:<200',
  sort_by: 'reviewScore:desc'
})
```

### Search Rooms
```typescript
// Find spacious rooms for couples with balcony
client.collections('rooms').documents().search({
  q: '*',
  filter_by: 'hotelCity:London && hasBalcony:true && sizeSqMeters:>30 && idealFor:couples',
  sort_by: 'avgPrice:asc'
})

// Get all rooms for a specific hotel
client.collections('rooms').documents().search({
  q: '*',
  filter_by: 'hotelId:68a4a7c7c0cfc3faba6e44cf'
})
```

### Get Full Details
```typescript
// Search returns flat fields + full document
const result = await search()
const hotel = result.hits[0].document
console.log(hotel.name) // Flat field
console.log(hotel.document.facilities) // Full nested structure
console.log(hotel.document.policies) // No data loss!
```

---

## Benefits Summary

| Aspect | Old Schema | New Schema |
|--------|-----------|------------|
| **Fields** | 68 flat fields | 29 (hotels) + 29 (rooms) |
| **Data Loss** | ❌ Nested data flattened | ✅ Full document preserved |
| **Room Listings** | ❌ Only aggregates | ✅ Individual rooms searchable |
| **Zero Noise** | ❌ Many 0 values | ✅ Optional fields |
| **Maintenance** | ❌ Complex transform | ✅ Simple mapping |
| **Queries** | ❌ Limited | ✅ Rich filtering |
| **Storage** | Efficient | Slightly larger (JSON) |

---

## Migration Plan

1. **Create new collections** (`hotels-v2`, `rooms`)
2. **Update transform functions**
3. **Run backfill script**
4. **Update Change Stream** to index both collections
5. **Test queries**
6. **Delete old `hotels` collection**
7. **Rename `hotels-v2` → `hotels`**

Should I implement this improved schema?
