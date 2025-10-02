# Room ID Batching Fix

## Problem
When batching rooms for enrichment (3 rooms per batch), the AI was generating room IDs (1, 2, 3) during the **enrichment stage**. This caused each batch to reset the room ID counter, resulting in duplicate room IDs and only partial hotel data being saved.

### Example of the Issue:
- Batch 1: Rooms get IDs 1, 2, 3
- Batch 2: Rooms get IDs 1, 2, 3 (duplicates!)
- Batch 3: Rooms get IDs 1, 2, 3 (duplicates!)

This meant only the last batch would be saved to the database (with IDs 1, 2, 3), losing all other rooms.

## Solution
Move the room ID assignment from the **Enrichment stage** (which is batched) to the **Ranking stage** (which processes all rooms together).

### Pipeline Flow:
1. **Research Stage** → Gathers facts about ALL rooms (not batched)
2. **Ranking Stage** → Establishes hierarchy and **ASSIGNS ROOM IDs 1-N** (not batched) ✅ FIXED HERE
3. **Enrichment Stage** → Formats data, **PRESERVES existing room IDs** (batched into groups of 3)

## Changes Made

### 1. Updated Ranking Prompt (`buildRankRoomPrompt`)
**File:** `src/utils/enrich-static/handlers/buildEnrichPrompt.ts`

Added room ID assignment to the ranking stage output:
```typescript
{
  "rankedRooms": [
    {
      "venue_id": "...",
      "roomId": 1,  // ← Added here!
      "roomName": "Superior King Room",
      "hierarchy": { ... },
      "pricingEstimate": { ... }
    }
  ]
}
```

Added instructions:
- **ASSIGN SEQUENTIAL roomId numbers (1, 2, 3, etc.) to ALL rooms in order of their ranking**
- The roomId MUST be unique within this hotel and should reflect the room hierarchy

### 2. Updated Enrichment Prompt (`buildEnrichRoomPrompt`)
**File:** `src/utils/enrich-static/handlers/buildEnrichPrompt.ts`

Changed from generating room IDs to preserving them:

**Before:**
```
- Assign sequential roomId numbers (1, 2, 3, etc.)
```

**After:**
```
- **USE the roomId from the ranked data - DO NOT generate new room numbers**
- Preserve the roomId that was assigned during the ranking stage
```

Added note at the beginning:
```
**NOTE:** Each ranked room includes a `roomId` field assigned during ranking. 
You MUST preserve this roomId in the identity section.
```

## Why This Works
- The **Ranking stage** processes ALL rooms at once (not batched), so it can assign unique sequential IDs across all rooms
- The **Enrichment stage** receives rooms with pre-assigned IDs and simply preserves them
- Even though enrichment is batched (3 rooms at a time), each batch already has correct unique IDs that don't conflict

## Testing
To verify the fix works:
1. Test with a hotel that has more than 3 rooms (e.g., 9 rooms)
2. Check that all rooms get unique sequential IDs (1-9)
3. Verify all rooms are saved to the database (not just the last batch)
4. Confirm no duplicate room IDs exist for the same hotel

## Files Modified
- `/services/venue-enrichment/src/utils/enrich-static/handlers/buildEnrichPrompt.ts`
  - Modified `buildRankRoomPrompt()` function
  - Modified `buildEnrichRoomPrompt()` function
