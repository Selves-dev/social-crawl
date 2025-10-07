# Payload CMS Organization for Public vs Private Data

## The Better Approach ✅

Your existing field structure already groups public vs private data naturally:

**PUBLIC fields** (already grouped):
- `identity` - name, description, star rating, etc.
- `location` - address, coordinates, POIs
- `contact` - phone, website (public)
- `marketPosition` - USPs, ideal for, tradeoffs
- `reviews` - ratings, highlights
- `amenities` - features
- `accessibility` - features, hazards
- `sustainability` - highlights
- `dietary` - options
- `rooms` - room details
- `dataGovernance` - data level, PACT

**PRIVATE fields** (keep separate):
- `externalIds` - Hotelston, HBX, Roibos IDs ❌
- `internalNotes` - Staff notes ❌
- `costData` - Internal costs ❌
- `margins` - Business margins ❌

---

## Simple Solution: Just Add a Hook

Your current `Hotels.ts` is fine! Just add one hook to filter private fields for public requests:

```typescript
// In selves-payload/src/collections/Hotels.ts

export const Hotels: CollectionConfig = {
  slug: 'hotels',
  access: {
    read: () => true,
  },
  hooks: {
    afterRead: [
      ({ req, doc }) => {
        // If no authenticated user (public request), remove private fields
        if (!req.user) {
          delete doc.externalIds
          delete doc.internalNotes
          delete doc.costData
          delete doc.margins
          delete doc._internalMetadata
        }
        return doc
      }
    ]
  },
  fields: [
    // Your existing fields - keep as is!
    { name: 'name', type: 'text' },
    { name: 'slug', type: 'text' },
    { name: 'selves_id', type: 'text' },
    { name: 'identity', type: 'json' },    // ✅ PUBLIC
    { name: 'location', type: 'json' },    // ✅ PUBLIC
    { name: 'contact', type: 'json' },     // ✅ PUBLIC
    { name: 'externalIds', type: 'json' }, // ❌ PRIVATE (filtered by hook)
    // ... rest of your fields
  ]
}
```

---

## That's It!

Your existing groupings (`identity`, `location`, etc.) already make sense for public data.

Just add the `afterRead` hook and you're done. No need to reorganize anything.

---

## Benefits

1. ✅ Keep your current structure
2. ✅ One hook filters private fields automatically
3. ✅ Public requests get clean data
4. ✅ Admin requests get everything (for CMS editing)

---

## For Reference: What Each Group Contains

### identity (PUBLIC ✅)
- name, starRating, priceTier, hotelType
- brandAffiliation, descriptionShort

### location (PUBLIC ✅)
- Country, Region, City, address
- coordinates, neighborhood, walkabilityScore
- pointsOfInterest

### contact (PUBLIC ✅)
- phone, email, websiteUrl
- googleMapsUrl

### marketPosition (PUBLIC ✅)
- uniqueSellingPoints, idealFor
- keyTradeoffs, similarHotels

### externalIds (PRIVATE ❌)
- hotelston, hbx, roibos IDs
- **Filtered by afterRead hook**

### internalNotes (PRIVATE ❌)
- Staff comments
- **Filtered by afterRead hook**
