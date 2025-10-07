# Schema Implementation TODO

## Quick Setup Checklist

### 1. Add Payload Hook ✅ (5 minutes)

**File**: `selves-payload/src/collections/Hotels.ts`

Add this hook (keep your existing field structure - no changes needed):

```typescript
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
  // ... rest of your existing config (no changes needed!)
}
```

That's it! Your existing groupings (identity, location, etc.) are already perfect.

### 2. Update Room Page

**File**: `selves-marketing/app/pages/library/[location]/sleep/[hotel]/[room].vue`

**Add at top of script**:
```vue
<script setup>
// Existing code...
const { fetchPublicSchema, injectSchemaToHead, fetchPublicData } = useHotelSchema()

// Add JSON-LD to <head> for SEO
onMounted(async () => {
  const schema = await fetchPublicSchema(hotelSlug)
  if (schema) injectSchemaToHead(schema)
})

// For JSON toggle
const publicData = ref(null)
watch(isJsonView, async (show) => {
  if (show && !publicData.value) {
    publicData.value = await fetchPublicData(hotelSlug)
  }
})
</script>
```

**Update JSON display**:
```vue
<pre v-if="isJsonView">{{ JSON.stringify(publicData, null, 2) }}</pre>
```

### 3. Test Endpoints

```bash
# Start your servers
cd selves-payload && npm run dev  # Port 3333
cd selves-marketing && npm run dev  # Port 3000

# Test Schema.org endpoint
curl http://localhost:3000/api/hotels/YOUR-HOTEL-SLUG/schema

# Test public JSON endpoint
curl http://localhost:3000/api/hotels/YOUR-HOTEL-SLUG/public
```

### 4. Validate SEO

1. Open hotel page in browser
2. View source → Look for `<script type="application/ld+json">`
3. Copy JSON
4. Test at: https://search.google.com/test/rich-results
5. Verify: No errors

### 5. Apply to Other Collections (Optional)

- Restaurants
- Bars
- Attractions

Same pattern: Public tab + Private tab + afterRead hook

---

## Files Already Created ✅

- `server/utils/schema-transform.ts` - Transformer
- `server/api/hotels/[slug]/schema.get.ts` - Schema endpoint
- `server/api/hotels/[slug]/public.get.ts` - Public JSON endpoint
- `app/composables/useHotelSchema.ts` - Vue composable
- `PAYLOAD-PUBLIC-PRIVATE-ORGANIZATION.md` - Full guide
- `README-SCHEMA.md` - Quick reference

---

## Key Principle

**Only fetch what you need from the database.**

No stripping, no filtering - just don't ask for private fields in the first place!
