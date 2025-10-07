# Typesense AND Search Implementation

**Date:** 2025-10-03  
**Status:** ✅ Implemented

## Overview

This document describes the AND search implementation for Typesense that allows intelligent query parsing and filtering for hotel and room searches.

## Use Case

When users search for "knight suite", the system should:
1. Parse "knight" → "knightsbridge" (location)
2. Parse "suite" → room type filter
3. Return suite rooms in Knightsbridge hotels using AND logic

## Architecture

### Query Parser

The `parseSearchQuery()` function in `typesenseSearch.ts` intelligently parses user queries into:
- **Room types**: suite, deluxe, superior, king, queen, etc.
- **Locations**: knightsbridge, mayfair, soho, etc.
- **Remaining terms**: other search terms

### Filter Builder

The `buildFilterString()` function creates Typesense `filter_by` strings with AND logic:
```typescript
// Example: "knight suite"
filter_by: "(room_type:=suite) && (neighborhood:=knightsbridge || city:=knightsbridge)"
```

### Search Functions

Three main search functions:

1. **`searchHotels()`** - Search hotels collection
2. **`searchRooms()`** - Search rooms collection  
3. **`searchHotelsAndRooms()`** - Search both simultaneously

## API Endpoints

### 1. Search Hotels
```
GET /api/search/hotels?q=knight+suite&page=1&per_page=20
```

**Query Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page (default: 20)
- `sort_by` (optional): Sort field

**Response:**
```json
{
  "success": true,
  "query": "knight suite",
  "results": {
    "found": 15,
    "hits": [...],
    "page": 1,
    "search_time_ms": 12
  }
}
```

### 2. Search Rooms
```
GET /api/search/rooms?q=knight+suite&page=1&per_page=20&hotel_id=xxx&max_occupancy=2
```

**Query Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page (default: 20)
- `sort_by` (optional): Sort field
- `hotel_id` (optional): Filter by specific hotel
- `max_occupancy` (optional): Minimum occupancy required

**Response:**
```json
{
  "success": true,
  "query": "knight suite",
  "filters": {
    "hotelId": "xxx",
    "maxOccupancy": 2
  },
  "results": {
    "found": 42,
    "hits": [...],
    "page": 1,
    "search_time_ms": 8
  }
}
```

### 3. Combined Search
```
GET /api/search?q=knight+suite&page=1&per_page=20
```

**Response:**
```json
{
  "success": true,
  "query": "knight suite",
  "parsed": {
    "originalQuery": "knight suite",
    "roomTypes": ["suite"],
    "locations": ["knightsbridge"],
    "remainingTerms": []
  },
  "hotels": {
    "found": 15,
    "hits": [...],
    "search_time_ms": 12
  },
  "rooms": {
    "found": 42,
    "hits": [...],
    "search_time_ms": 8
  }
}
```

## How It Works

### Example Query: "knight suite"

1. **Parse Query:**
   ```typescript
   {
     originalQuery: "knight suite",
     roomTypes: ["suite"],
     locations: ["knightsbridge"],
     remainingTerms: []
   }
   ```

2. **Build Filters:**
   ```typescript
   filter_by: "(room_type:=suite) && (neighborhood:=knightsbridge || city:=knightsbridge)"
   ```

3. **Execute Search:**
   - Search query: "knight suite"
   - Query fields: `name,description,neighborhood,city,amenities`
   - Apply filters with AND logic
   - Return matching results

### Example Query: "deluxe mayfair parking"

1. **Parse Query:**
   ```typescript
   {
     originalQuery: "deluxe mayfair parking",
     roomTypes: ["deluxe"],
     locations: ["mayfair"],
     remainingTerms: ["parking"]
   }
   ```

2. **Build Filters:**
   ```typescript
   filter_by: "(room_type:=deluxe) && (neighborhood:=mayfair || city:=mayfair)"
   ```

3. **Execute Search:**
   - Filters narrow to deluxe rooms in Mayfair
   - Full-text search includes "parking" in amenities

## Extending Location Keywords

To add more locations, edit `LOCATION_KEYWORDS` in `typesenseSearch.ts`:

```typescript
const LOCATION_KEYWORDS = [
  'knightsbridge', 'mayfair', 'soho', 'covent garden',
  'westminster', 'kensington', 'chelsea', 'belgravia',
  // Add more locations here
]
```

## Extending Room Types

To add more room types, edit `ROOM_TYPES` in `typesenseSearch.ts`:

```typescript
const ROOM_TYPES = [
  'suite', 'suites',
  'deluxe', 'superior', 'standard', 'executive',
  // Add more room types here
]
```

## Testing

### Test Hotel Search
```bash
curl "http://localhost:3000/api/search/hotels?q=knight+suite"
```

### Test Room Search
```bash
curl "http://localhost:3000/api/search/rooms?q=knight+suite&max_occupancy=2"
```

### Test Combined Search
```bash
curl "http://localhost:3000/api/search?q=knight+suite"
```

## Future Enhancements

### 1. Synonym Configuration
Configure Typesense synonyms for automatic expansion:
```typescript
{
  "synonyms": [
    {
      "id": "location-synonyms-1",
      "synonyms": ["knight", "knightsbridge", "knights bridge"]
    },
    {
      "id": "room-type-synonyms-1", 
      "synonyms": ["suite", "suites", "luxury suite"]
    }
  ]
}
```

### 2. Machine Learning Enhancement
- Use historical search data to improve query parsing
- Learn new location/room type patterns

### 3. Faceted Search UI
- Return facet counts for filtering
- Allow users to refine searches interactively

### 4. Geo-Search Integration
- Combine text search with radius-based location filtering
- "suites within 2km of Big Ben"

## Files Modified/Created

- ✅ `src/utils/shared/typesenseSearch.ts` - Core search logic
- ✅ `src/routes/api/search/hotels.get.ts` - Hotel search endpoint
- ✅ `src/routes/api/search/rooms.get.ts` - Room search endpoint
- ✅ `src/routes/api/search/index.get.ts` - Combined search endpoint
- ✅ `docs/TYPESENSE-AND-SEARCH.md` - This documentation
