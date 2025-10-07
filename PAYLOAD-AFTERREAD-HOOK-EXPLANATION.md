# How to Filter Private Fields - Best Practice for HTTP API

Since you're calling Payload via HTTP (`localhost:3333`), not using Payload Local API directly, you need to filter at the **Payload level** so private data never goes over the wire.

## Solution: Add `afterRead` Hook in Payload

**File**: `selves-payload/src/collections/Hotels.ts`

```typescript
export const Hotels: CollectionConfig = {
  slug: 'hotels',
  access: {
    read: () => true,
  },
  hooks: {
    afterRead: [
      ({ req, doc }) => {
        // Check if this is a public (non-authenticated) request
        // Payload sets req.user for authenticated requests
        if (!req.user) {
          // Remove private fields before sending response
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
    // Your existing fields - no changes needed!
  ]
}
```

## How It Works

1. **Nuxt calls**: `http://localhost:3333/api/hotels?where[slug][equals]=maids-head-norwich`
2. **Payload fetches** hotel from MongoDB (all fields)
3. **afterRead hook runs**: Checks if `req.user` exists
   - ❌ No user → Remove private fields
   - ✅ Has user (admin logged in) → Keep all fields
4. **Response sent**: Hotel data without private fields

## Why This is Better Than Deleting in Nuxt

| Location | Pros | Cons |
|----------|------|------|
| **Delete in Payload (afterRead)** ✅ | Never sent over network, works for all API calls, single source of truth | Still fetches from DB |
| Delete in Nuxt | - | Private data goes over network, must filter in every endpoint |
| Query with `select` | Never fetched from DB | Only works with Local API, not HTTP REST |

## For Your Setup (HTTP API)

**Best option**: `afterRead` hook in Payload

The data is still fetched from MongoDB, but private fields are stripped **before** sending the HTTP response. This means:

- ✅ Private data never leaves Payload server
- ✅ Works for all Nuxt endpoints automatically
- ✅ Works if you add GraphQL later
- ✅ Single place to manage privacy

## If You Want True "Never Fetch"

You'd need to either:

1. **Use Payload Local API** - Import Payload directly in Nuxt (complex setup)
2. **Create custom Payload endpoint** with explicit field selection
3. **Use Payload GraphQL** - Supports field selection

For your current HTTP setup, the `afterRead` hook is the cleanest solution.
