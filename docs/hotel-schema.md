# Hotel Schema Documentation

## Overview
This document describes the MongoDB schema for the `hotels` collection in the `groundry` database. The schema represents comprehensive hotel and room information for the social crawl project.

## Database Information
- **Database**: `groundry`
- **Collection**: `hotels`
- **Sample Generated**: 2025-09-27
- **TypeScript Types**: `/src/types/hotel.ts`
- **Sample JSON**: `/docs/hotel-schema-sample.json`

## Main Hotel Document Structure

### Core Fields
- `_id` (string): MongoDB ObjectId as string
- `name` (string): Hotel display name
- `slug` (string): URL-friendly hotel identifier
- `createdAt` (string): ISO date of document creation
- `rooms` (array): Array of hotel room objects

### Optional Hotel Fields

#### Identity & Branding
- `identity.name`: Official hotel name
- `identity.starRating`: 1-5 star rating
- `identity.priceTier`: Price category (e.g., "$$$")
- `identity.hotelType`: Array of hotel types (e.g., ["Boutique", "Historic"])
- `identity.brandAffiliation`: Hotel chain or group
- `identity.descriptionShort`: Brief hotel description

#### Location Information
- `location.country`: Country name
- `location.region`: State/region
- `location.city`: City name
- `location.address`: Full street address
- `location.coordinates`: Lat/lon coordinates object
- `location.neighborhood`: Local area name
- `location.walkabilityScore`: Walkability rating (0-100)
- `location.pointsOfInterest`: Array of nearby attractions

#### Contact & Services
- `contact.phone`: Hotel phone number
- `contact.email`: Reservations email
- `contact.websiteUrl`: Official website
- `amenitiesAndServices`: Comprehensive amenities object
- `foodAndBeverage`: Restaurant and dining information

#### Business Information
- `registryId`: External registry identifier
- `policies`: Check-in/out, cancellation, pet policies
- `reviews`: Aggregate review scores and ratings
- `marketPosition`: Competitive positioning data
- `sustainability`: Environmental certifications and practices

## Room Structure

Each room in the `rooms` array contains:

### Core Room Fields
- `roomName`: Display name for the room
- `roomId`: Unique room identifier
- `roomSlug`: URL-friendly room identifier
- `identity`: Room details (name, type, size, capacity)
- `id`: MongoDB ObjectId for the room

### Room Details
- `hierarchy`: Room tier and upgrade path information
- `pricingContext`: Rate ranges and pricing vs standard rooms
- `wouldMatch`: Matching tags and ideal guest types
- `media`: Room images, virtual tours, and photo galleries
- `features`: Amenities, bathroom type, unique features
- `reviewSnippets`: Guest review excerpts
- `policyOverrides`: Room-specific policy exceptions

## Data Relationships

### External References
- `registryId`: Links to external hotel registry systems
- `marketPosition.similarHotels[].registryId`: References to competitor hotels
- `hierarchy.upgradeFromRoomId`/`upgradeToRoomId`: Room upgrade paths

### Internal Structure
- Hotels contain multiple rooms
- Rooms have detailed feature and media collections
- Reviews are aggregated at hotel level with category breakdowns

## Usage Examples

### TypeScript Integration
```typescript
import { HotelDocument, HotelRoom } from '@/types/hotel';

// Type-safe hotel operations
const hotel: HotelDocument = await db.collection('hotels').findOne({slug: 'hotel-slug'});
const rooms: HotelRoom[] = hotel.rooms;
```

### Common Queries
```javascript
// Find hotels in a city
db.hotels.find({"location.city": "Norwich"})

// Find hotels with specific amenities
db.hotels.find({"amenitiesAndServices.hotelAmenities": "Free WiFi"})

// Find rooms by type
db.hotels.find({"rooms.identity.roomType": "Superior Double"})
```

## Development Notes

### Field Optionality
Most fields are optional except:
- `_id`, `name`, `slug` (hotel level)
- `roomName`, `roomId`, `roomSlug`, `identity` (room level)

### Coordinate System
- Location coordinates use `{lat, lon}` format (not GeoJSON)
- Consider indexing for geospatial queries

### Media Handling
- Images stored as URLs with alt text and captions
- Gallery arrays support tagging for categorization
- Photo counts tracked separately from actual arrays

### Extensions
The schema supports easy extension through:
- Additional amenity categories
- Custom room features
- Extended review systems
- New sustainability metrics

## Migration Considerations
- Schema designed for gradual population from external sources
- All optional fields allow for incomplete data during development
- Type guards provided for runtime validation