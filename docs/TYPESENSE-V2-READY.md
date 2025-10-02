# Typesense V2 Setup Complete! ✅

## What We Built

### 🎯 Two Collections - Minimal Schema

**Hotels Collection (`hotels_v2`)** - 20 fields
```
✅ Created with 0 documents
- Identifiers: id, name, slug
- Location: city, country, lat, lng
- Pricing: minPrice, maxPrice, currency
- Amenities: 6 boolean flags (pool, spa, gym, parking, petFriendly, breakfastIncluded)
- Reviews: reviewScore (required), reviewCount
- Meta: updatedAt, document (full MongoDB doc)
```

**Rooms Collection (`rooms`)** - 17 fields
```
✅ Created with 0 documents
- Identifiers: id, roomSlug, roomName
- Hotel Ref: hotelId, hotelName, hotelSlug
- Classification: roomType, tier
- Pricing: avgPrice (required), currency
- Capacity: sizeSqMeters, maxAdults, maxChildren
- Semantic: tags[], idealFor[]
- Meta: updatedAt, document (full room object)
```

### 🔄 Auto-Sync Enabled

Change Stream plugin updated to sync **both collections** when hotels are enriched:

1. **Hotel inserted/updated** in MongoDB `s_payload.hotels`
2. **Change Stream triggers**
3. **Transform hotel** → Index in `hotels_v2`
4. **Transform each room** → Index in `rooms`
5. **Log results**: hotel + rooms indexed count

## 📊 Schema Benefits

| Feature | Old | New V2 |
|---------|-----|--------|
| Collections | 1 | 2 (hotels + rooms) |
| Fields | 68 flat | 20 + 17 = 37 |
| Room Listings | ❌ No | ✅ Yes |
| Data Loss | ❌ Yes | ✅ No (full document) |
| Zero Noise | ❌ Many 0s | ✅ Optional fields |
| Maintenance | ❌ Complex | ✅ Simple |

## 🚀 Testing

### Start the Server
```bash
cd /Users/merry/Documents/projects/social-crawl/services/venue-enrichment
pnpm run dev
```

**Expected logs:**
```
✅ Typesense client initialized
⏳ Waiting for database connection...
✅ MongoDB Atlas connected
🔍 Setting up MongoDB Change Stream for Typesense sync
✅ MongoDB Change Stream active - Typesense sync enabled
```

### Run Hotel Enrichment
When you enrich a hotel, you should see:
```
📝 MongoDB Change Stream event detected
✅ Hotel and rooms synced to Typesense
   - hotelId: 68a4a7c7c0cfc3faba6e44cf
   - hotelName: One Hundred Shoreditch Hotel
   - roomsIndexed: 8
   - roomsError: 0
```

### Verify in Typesense
```bash
cd /Users/merry/Documents/projects/social-crawl/scripts

# Check hotels
node -e "
const Typesense = require('typesense');
const client = new Typesense.Client({
  nodes: [{ host: '5i1q8hfruw7lnjezp-1.a1.typesense.net', port: 443, protocol: 'https' }],
  apiKey: '9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV'
});
client.collections('hotels_v2').retrieve()
  .then(c => console.log('Hotels:', c.num_documents))
"

# Check rooms
node -e "
const Typesense = require('typesense');
const client = new Typesense.Client({
  nodes: [{ host: '5i1q8hfruw7lnjezp-1.a1.typesense.net', port: 443, protocol: 'https' }],
  apiKey: '9P80UXCzFeM4nyHvvhZCWXmbzgWAVeXV'
});
client.collections('rooms').retrieve()
  .then(c => console.log('Rooms:', c.num_documents))
"
```

## 🔍 Query Examples

### Search Hotels
```javascript
// Hotels with pool in London, sorted by review score
client.collections('hotels_v2').documents().search({
  q: '*',
  filter_by: 'city:London && hasPool:true',
  sort_by: 'reviewScore:desc'
})

// Budget hotels under $150
client.collections('hotels_v2').documents().search({
  q: '*',
  filter_by: 'maxPrice:<150',
  sort_by: 'reviewScore:desc'
})
```

### Search Rooms
```javascript
// Get all rooms for a hotel
client.collections('rooms').documents().search({
  q: '*',
  filter_by: 'hotelId:68a4a7c7c0cfc3faba6e44cf'
})

// Find spacious rooms for couples
client.collections('rooms').documents().search({
  q: '*',
  filter_by: 'idealFor:couples && sizeSqMeters:>30',
  sort_by: 'avgPrice:asc'
})

// Rooms with workspace (using tags)
client.collections('rooms').documents().search({
  q: '*',
  filter_by: 'tags:workspace',
  sort_by: 'avgPrice:asc'
})
```

### Get Full Details
```javascript
const result = await client.collections('hotels_v2').documents().search({
  q: 'Shoreditch'
})

const hotel = result.hits[0].document
console.log(hotel.name)              // Flat field: "One Hundred Shoreditch Hotel"
console.log(hotel.hasPool)           // Flat field: true
console.log(hotel.document.policies) // Full nested structure from MongoDB!
console.log(hotel.document.facilities) // No data loss!
```

## 📁 Files Updated

| File | Purpose |
|------|---------|
| `scripts/create-typesense-collections-v2.js` | Creates hotels_v2 + rooms collections |
| `services/venue-enrichment/src/utils/shared/typesenseTransformV2.ts` | Transform functions (20 + 17 fields) |
| `services/venue-enrichment/src/plugins/05-typesense.ts` | Change Stream → syncs both collections |

## 🎨 What's Different

### Hotels Transformation
```typescript
// OLD: 68 fields with data loss
{
  id, name, slug, city, country, region, neighborhood,
  latitude, longitude, postalCode, streetAddress,
  distanceToCenter, distanceToAirport,
  roomCount, roomTypes[], roomTiers[], viewTypes[],
  minPrice, maxPrice, avgPrice, priceCurrency,
  minRoomSize, maxRoomSize, roomSizeUnit, maxCapacity,
  hasWifi, hasPool, hasSpa, hasGym, hasRestaurant, hasBar,
  hasParking, hasPetFriendly, hasAirConditioning, hasRoomService,
  hasConciergeMoment, hasBusinessCenter, hasAirportShuttle,
  idealFor[], roomTags[], uniqueSellingPoints[], nearbyPOIs[],
  reviewScore, reviewCount, sustainabilityScore,
  primaryImageUrl, imageCount, createdAt, updatedAt
  // No full document! Data loss!
}

// NEW: 20 fields + full document
{
  id, name, slug,
  city, country, latitude, longitude,
  minPrice, maxPrice, currency,
  hasPool, hasSpa, hasGym, hasParking, hasPetFriendly, hasBreakfastIncluded,
  reviewScore, reviewCount,
  updatedAt,
  document: { ...fullMongoDBDocument } // ✅ No data loss!
}
```

### Rooms Transformation (NEW!)
```typescript
{
  id, roomSlug, roomName,
  hotelId, hotelName, hotelSlug,
  roomType, tier,
  avgPrice, currency,
  sizeSqMeters, maxAdults, maxChildren,
  tags: ["workspace", "balcony", "city-view"],  // ✅ Flexible!
  idealFor: ["couples", "business"],
  updatedAt,
  document: { ...fullRoomObject } // ✅ No data loss!
}
```

## 💡 Key Improvements

1. **Room Listings**: Can now search/filter individual rooms
2. **No Data Loss**: Full MongoDB document stored in `document` field
3. **Flexible Tags**: Room features as tags array (easier to extend)
4. **Cleaner Schema**: 37 fields vs 68 (45% reduction)
5. **Better Queries**: Can filter rooms by features, hotel by amenities
6. **Easier Maintenance**: Simple transform logic

## ⚠️ Important Notes

- **Collection Name**: Using `hotels_v2` to keep old `hotels` collection as backup
- **Required Fields**: `reviewScore` and `avgPrice` are required (default to 0)
- **Nested Fields**: Enabled for `document` field
- **No Backfill Needed**: Change Stream will index as hotels are enriched

## 🎯 Next Steps

1. ✅ Collections created
2. ✅ Transform functions updated
3. ✅ Change Stream plugin updated
4. 🔲 Test with hotel enrichment
5. 🔲 Build search API endpoints
6. 🔲 Create search UI

**Status: Ready to test!** Run your hotel enrichment workflow and watch both collections populate automatically.
