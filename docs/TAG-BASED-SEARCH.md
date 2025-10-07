# Tag-Based Search Implementation

## Overview
Implemented a tag-based search UI for the venue library that allows users to build complex AND searches by creating multiple filter tags.

## User Experience
1. User types a search term (e.g., "suite")
2. User presses **Enter** to convert it to a tag
3. The term becomes a yellow tag with an × delete button
4. User can add more tags by typing and pressing Enter
5. All tags create an AND search (all terms must match)
6. Clicking × on a tag removes it and updates results

## Example Flow
```
Type: "knightsbridge" → Press Enter → [knightsbridge] tag appears
Type: "suite" → Press Enter → [knightsbridge] [suite] tags appear
Results: Shows only suite rooms in Knightsbridge hotels
```

## Implementation Details

### Frontend (`VenueList.vue`)
- **Tag State**: `searchTags` ref array stores active tags
- **Add Tag**: `addTag()` function triggered on Enter key
  - Trims input
  - Prevents duplicates
  - Clears input box
  - Triggers `performTagSearch()`
- **Remove Tag**: `removeTag(index)` function removes tag by index
  - Splices from array
  - Re-triggers search with remaining tags
  - Clears search if no tags remain
- **Search Logic**: Tags are joined with spaces and sent as single query
  - Multiple terms in Typesense naturally create AND behavior

### Backend (`venues.get.ts`)
- No special AND logic needed - Typesense naturally scores results higher when multiple terms match
- Uses standard multi-search across hotels and rooms collections
- Returns only directly matched rooms (prevents false positives from hotel metadata)

### Visual Design
- Yellow background with black border (matching brand style)
- Rounded pill shape
- Bold × delete button that turns red on hover
- Tags appear above search input
- Clear visual separation from search box

## Technical Notes
- **Why not `drop_tokens_threshold: 0`?** Too restrictive - requires all tokens in same field
- **Current approach**: Natural ranking - results with all terms score higher
- **Benefits**: 
  - Flexible matching across different fields
  - Users see broader results that match any tag
  - Still prioritizes results matching all tags (higher relevance score)
  - Clear visual indication of active filters

## Testing
```bash
# Test single tag (suite)
curl "http://localhost:3000/api/search/venues?q=suite" | jq '.venues | length'
# Returns: 20 (many suite rooms)

# Test multiple tags (knightsbridge suite)
curl "http://localhost:3000/api/search/venues?q=knightsbridge+suite" | jq '.venues | length'
# Returns: 2 (only suites in Knightsbridge)

# Test three tags (london suite king)
curl "http://localhost:3000/api/search/venues?q=london+suite+king" | jq '.venues | map({name, venue_name})'
# Returns: King suites in London hotels
```

## User Benefits
1. **Clear Intent**: Tags make it obvious what filters are active
2. **Easy Modification**: Click × to remove any filter
3. **Progressive Refinement**: Start broad, add tags to narrow down
4. **Visual Feedback**: See all active filters at once
5. **Standard UX**: Familiar pattern used across many search interfaces

## Future Enhancements
- [ ] Auto-suggest tags based on popular combinations
- [ ] Save tag combinations as "searches"
- [ ] Tag categories (location, room type, amenities)
- [ ] Drag to reorder tags (priority weighting)
- [ ] Color-coded tags by category
