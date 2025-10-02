# Typesense Schema: What Can We Cut?

## Analysis: Essential vs Nice-to-Have Fields

### Hotels Collection - Current Proposal (29 fields)

#### ✅ **ESSENTIAL** (Keep - 15 fields)
```typescript
// Core identifiers - NEED for linking/display
id: string
name: string
slug: string

// Location - NEED for "hotels near me" / map search
city: string
country: string
latitude: float
longitude: float

// Price - NEED for budget filtering
minPrice?: int32
maxPrice?: int32
currency?: string

// Reviews - NEED for sorting by quality
reviewScore?: float
reviewCount?: int32

// Timestamps - NEED for "recently added"
updatedAt: int64

// Full document - NEED to avoid data loss
document?: object
```

#### ❓ **QUESTIONABLE** (Consider cutting - 11 fields)
```typescript
// Do you actually filter by region/neighborhood?
region: string              // → Cut if you only filter by city
neighborhood: string        // → Cut if you only show it, not filter

// Do you need ALL these amenity filters?
hasWifi: boolean           // → Everyone has WiFi, cut?
hasPool: boolean           // ✅ Keep - differentiator
hasSpa: boolean            // ✅ Keep - luxury filter
hasGym: boolean            // ✅ Keep - business travelers
hasRestaurant: boolean     // → Cut - most hotels have one
hasBar: boolean            // → Cut - not a common filter
hasParking: boolean        // ✅ Keep - important for drivers
hasPetFriendly: boolean    // ✅ Keep - deal-breaker for some
hasAirConditioning: boolean // → Cut - expected in most places
hasRoomService: boolean    // → Cut - not a common filter
hasConcierge: boolean      // → Cut - niche filter
hasBusinessCenter: boolean // → Cut - covered by "hasGym" for business
hasAirportShuttle: boolean // → Cut - can show in details

// Timestamp
createdAt: int64           // → Cut - updatedAt is enough
```

#### 🎯 **RECOMMENDED: Hotels Collection (20 fields)**
```typescript
{
  // Identifiers (3)
  id: string
  name: string
  slug: string
  
  // Location (4)
  city: string
  country: string
  latitude: float
  longitude: float
  
  // Price (3)
  minPrice?: int32
  maxPrice?: int32
  currency?: string
  
  // Key Amenities (6) - Only common deal-breakers
  hasPool: boolean
  hasSpa: boolean
  hasGym: boolean
  hasParking: boolean
  hasPetFriendly: boolean
  hasBreakfastIncluded: boolean  // Add this - important!
  
  // Reviews (2)
  reviewScore?: float
  reviewCount?: int32
  
  // Meta (2)
  updatedAt: int64
  document?: object
}
```

---

### Rooms Collection - Current Proposal (29 fields)

#### ✅ **ESSENTIAL** (Keep - 18 fields)
```typescript
// Identifiers
id: string
roomSlug: string
roomName: string

// Hotel link - NEED to show which hotel
hotelId: string
hotelName: string
hotelSlug: string

// Classification - NEED for filtering
roomType: string
tier?: string

// Pricing - NEED for budget filtering
avgPrice?: int32
currency?: string

// Size & Capacity - NEED for group size
sizeSqMeters?: int32
maxAdults?: int32
maxChildren?: int32

// Semantic - NEED for matching user needs
tags: string[]
idealFor: string[]

// Meta
updatedAt: int64
document?: object
```

#### ❌ **CUT** (Remove - 11 fields)
```typescript
// Hotel location - REDUNDANT (join from hotel)
hotelCity: string          // → Join from hotels collection
hotelCountry: string       // → Join from hotels collection

// Price range - REDUNDANT (just use avgPrice)
priceMin?: int32           // → avgPrice is enough
priceMax?: int32           // → avgPrice is enough

// Capacity detail - TOO GRANULAR
maxInfants?: int32         // → Most parents just need "maxChildren"

// Room features - TOO SPECIFIC (show in document, not filter)
hasBalcony: boolean        // → Use tags instead
hasKitchenette: boolean    // → Use tags instead
hasWorkspace: boolean      // → Use tags instead
hasBathtub: boolean        // → Use tags instead
viewType?: string          // → Use tags instead

// Media - NOT NEEDED (get from document)
primaryImageUrl?: string   // → Get from document
imageCount?: int32         // → Get from document

// Timestamp
createdAt: int64           // → updatedAt is enough
```

#### 🎯 **RECOMMENDED: Rooms Collection (14 fields)**
```typescript
{
  // Identifiers (3)
  id: string
  roomSlug: string
  roomName: string
  
  // Hotel reference (3)
  hotelId: string
  hotelName: string
  hotelSlug: string
  
  // Classification (2)
  roomType: string
  tier?: string
  
  // Pricing (2)
  avgPrice?: int32
  currency?: string
  
  // Capacity (3)
  sizeSqMeters?: int32
  maxAdults?: int32
  maxChildren?: int32
  
  // Semantic matching (2)
  tags: string[]      // ["balcony", "workspace", "city-view", "bathtub"]
  idealFor: string[]  // ["couples", "business", "families"]
  
  // Meta (2)
  updatedAt: int64
  document?: object
}
```

---

## Summary: Cuts & Reasoning

### Hotels: 29 → 20 fields (-9 fields)

**Cut:**
- ❌ `region` - Redundant with city
- ❌ `neighborhood` - Show in details, not filter
- ❌ `hasWifi` - Everyone has it
- ❌ `hasRestaurant` - Too common
- ❌ `hasBar` - Niche filter
- ❌ `hasAirConditioning` - Expected
- ❌ `hasRoomService` - Niche
- ❌ `hasConcierge` - Niche
- ❌ `hasBusinessCenter` - Redundant with gym
- ❌ `hasAirportShuttle` - Show in details
- ❌ `createdAt` - Only need updatedAt

**Add:**
- ✅ `hasBreakfastIncluded` - Important filter!

### Rooms: 29 → 14 fields (-15 fields!)

**Cut:**
- ❌ `hotelCity/hotelCountry` - Join from hotels collection
- ❌ `priceMin/priceMax` - Just use avgPrice
- ❌ `maxInfants` - Too granular
- ❌ `hasBalcony/hasKitchenette/hasWorkspace/hasBathtub/viewType` - **Use `tags` array instead!**
- ❌ `primaryImageUrl/imageCount` - Get from document
- ❌ `createdAt` - Only need updatedAt

**Why tags are better:**
```typescript
// Instead of 10 boolean fields:
hasBalcony: true
hasWorkspace: true
hasKitchenette: false
hasBathtub: true
viewType: "city"

// Use one array:
tags: ["balcony", "workspace", "bathtub", "city-view", "bathtub", "king-bed"]

// Query: rooms with balcony OR city-view
filter_by: 'tags: [balcony, city-view]'
```

---

## Final Minimal Schema

### Hotels: 20 fields
- 3 identifiers
- 4 location (for geo search)
- 3 pricing
- 6 key amenities
- 2 reviews
- 2 meta (updatedAt + document)

### Rooms: 14 fields
- 3 identifiers
- 3 hotel reference
- 2 classification
- 2 pricing
- 3 capacity
- 2 semantic (tags + idealFor)
- 2 meta (updatedAt + document)

**Total: 34 fields** (vs 58 in original proposal)

---

## Trade-offs

### What You Lose
1. **Can't filter by neighborhood directly** - but can filter by city + show neighborhood in results
2. **No individual amenity counts** - but who filters "hotels with breakfast AND bar AND shuttle"?
3. **Room features not as queryable** - but tags array covers 90% of use cases
4. **No hotel location in room records** - but one JOIN gets it (Typesense supports JOINs)

### What You Gain
1. **Simpler maintenance** - 40% fewer fields
2. **Faster indexing** - Less data to process
3. **Cheaper storage** - Fewer fields = smaller index
4. **Flexible room features** - Tags grow as you add features, no schema changes
5. **Cleaner code** - Less transform logic

---

## My Recommendation

**Start with the minimal 34-field schema** (20 + 14). You can always add fields later if needed, but removing them is harder (have to re-index everything).

The `document` field gives you escape hatch - anything not in flat fields can still be shown in UI from the full document.

**Should I implement the minimal version?**
