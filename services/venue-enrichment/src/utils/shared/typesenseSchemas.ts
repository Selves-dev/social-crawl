/**
 * Typesense + FalkorDB Architecture for Hotels & Rooms
 * 
 * STRATEGY:
 * 1. Typesense: Fast full-text search and filtering
 *    - Hotels collection: Parent entities stored once
 *    - Rooms collection: Child entities with hotel_id reference
 * 
 * 2. FalkorDB: Graph relationships and contextual queries (future enhancement)
 *    - Hotel nodes
 *    - Room nodes  
 *    - Relationship edges (HAS_ROOM, NEAR, SIMILAR_TO, etc.)
 * 
 * 3. Query Flow:
 *    - Search in Typesense → Get IDs → Enrich with FalkorDB graph
 *    OR
 *    - Graph query in FalkorDB → Get IDs → Fetch full data from Typesense
 */

import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'

// ============================================
// TYPESENSE: HOTELS COLLECTION
// ============================================
export const hotelsSchema: CollectionCreateSchema = {
  name: 'hotels',
  fields: [
    // Core Identity
    { name: 'id', type: 'string', facet: false }, // Same as MongoDB _id
    { name: 'name', type: 'string', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'selves_id', type: 'string', facet: false, optional: true },
    
    // Classification
    { name: 'star_rating', type: 'int32', facet: true, optional: true },
    { name: 'price_tier', type: 'string', facet: true, optional: true },
    { name: 'hotel_types', type: 'string[]', facet: true, optional: true },
    { name: 'brand_affiliation', type: 'string', facet: true, optional: true },
    
    // Location
    { name: 'location_slug', type: 'string', facet: false, optional: true },
    { name: 'country', type: 'string', facet: true, optional: true },
    { name: 'region', type: 'string', facet: true, optional: true },
    { name: 'city', type: 'string', facet: true, optional: true },
    { name: 'neighborhood', type: 'string', facet: true, optional: true },
    { name: 'location', type: 'geopoint', facet: false, optional: true },
    { name: 'walkability_score', type: 'int32', facet: false, optional: true },
    
    // Searchable Content
    { name: 'description', type: 'string', facet: false, optional: true },
    { name: 'unique_selling_points', type: 'string[]', facet: false, optional: true },
    
    // Amenities
    { name: 'amenities', type: 'string[]', facet: true, optional: true },
    { name: 'has_spa', type: 'bool', facet: true, optional: true },
    { name: 'has_parking', type: 'bool', facet: true, optional: true },
    { name: 'has_airport_shuttle', type: 'bool', facet: true, optional: true },
    { name: 'pet_friendly', type: 'bool', facet: true, optional: true },
    
    // Food & Beverage
    { name: 'restaurant_count', type: 'int32', facet: false, optional: true },
    { name: 'restaurant_cuisines', type: 'string[]', facet: true, optional: true },
    { name: 'has_michelin_restaurant', type: 'bool', facet: true, optional: true },
    { name: 'breakfast_included', type: 'bool', facet: true, optional: true },
    
    // Reviews
    { name: 'review_score', type: 'float', facet: false },
    { name: 'review_count', type: 'int32', facet: false, optional: true },
    { name: 'location_score', type: 'float', facet: false, optional: true },
    { name: 'cleanliness_score', type: 'float', facet: false, optional: true },
    { name: 'service_score', type: 'float', facet: false, optional: true },
    
    // Sustainability
    { name: 'sustainability_certifications', type: 'string[]', facet: true, optional: true },
    
    // Aggregated Room Stats (for hotel-level filtering)
    { name: 'room_type_count', type: 'int32', facet: false, optional: true },
    { name: 'room_types_available', type: 'string[]', facet: true, optional: true },
    { name: 'min_room_size_sqm', type: 'float', facet: false, optional: true },
    { name: 'max_room_size_sqm', type: 'float', facet: false, optional: true },
    { name: 'min_room_price', type: 'float', facet: false, optional: true },
    { name: 'max_room_price', type: 'float', facet: false, optional: true },
    { name: 'max_occupancy_available', type: 'int32', facet: false, optional: true },
    { name: 'currency', type: 'string', facet: true, optional: true },
    
    // Points of Interest
    { name: 'nearby_poi_names', type: 'string[]', facet: false, optional: true },
    { name: 'nearby_poi_categories', type: 'string[]', facet: true, optional: true },
    
    // Metadata
    { name: 'created_at', type: 'int64', facet: false, optional: true },
    { name: 'content_last_updated', type: 'int64', facet: false, optional: true },
    { name: 'updated_at', type: 'int64', facet: false, optional: true },
    { name: 'status', type: 'string', facet: true, optional: true },
  ],
  default_sorting_field: 'review_score',
}

// ============================================
// TYPESENSE: ROOMS COLLECTION
// ============================================
export const roomsSchema: CollectionCreateSchema = {
  name: 'rooms',
  fields: [
    // Core Identity
    { name: 'id', type: 'string', facet: false }, // room.id from MongoDB
    { name: 'room_name', type: 'string', facet: false },
    { name: 'room_slug', type: 'string', facet: false },
    { name: 'room_type', type: 'string', facet: true },
    
    // ** PARENT REFERENCE **
    { name: 'hotel_id', type: 'string', facet: true }, // Links to hotels.id
    
    // Denormalized hotel context (for display in search results)
    { name: 'hotel_name', type: 'string', facet: false },
    { name: 'hotel_slug', type: 'string', facet: false },
    { name: 'location_slug', type: 'string', facet: false, optional: true },
    { name: 'city', type: 'string', facet: true, optional: true },
    { name: 'location', type: 'geopoint', facet: false, optional: true },
    
    // Physical Characteristics
    { name: 'size_sqm_min', type: 'float', facet: false, optional: true },
    { name: 'size_sqm_max', type: 'float', facet: false, optional: true },
    { name: 'max_adults', type: 'int32', facet: true, optional: true },
    { name: 'max_children', type: 'int32', facet: true, optional: true },
    { name: 'max_infants', type: 'int32', facet: true, optional: true },
    { name: 'total_max_occupancy', type: 'int32', facet: true },
    { name: 'bathroom_type', type: 'string', facet: true, optional: true },
    
    // Hierarchy
    { name: 'tier', type: 'string', facet: true, optional: true },
    
    // Amenities & Features
    { name: 'amenities', type: 'string[]', facet: true, optional: true },
    { name: 'unique_features', type: 'string[]', facet: false, optional: true },
    { name: 'climate_control', type: 'string[]', facet: true, optional: true },
    { name: 'has_coffee_machine', type: 'bool', facet: true, optional: true },
    { name: 'has_mini_fridge', type: 'bool', facet: true, optional: true },
    { name: 'has_workspace', type: 'bool', facet: true, optional: true },
    
    // AI Matching Tags
    { name: 'tags', type: 'string[]', facet: true, optional: true },
    { name: 'ideal_for', type: 'string[]', facet: true, optional: true },
    { name: 'not_ideal_for', type: 'string[]', facet: true, optional: true },
    
    // Content
    { name: 'description', type: 'string', facet: false, optional: true },
  ],
  default_sorting_field: 'total_max_occupancy',
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TypesenseHotelDocument {
  id: string
  name: string
  slug: string
  selves_id?: string
  star_rating?: number
  price_tier?: string
  hotel_types?: string[]
  brand_affiliation?: string
  location_slug?: string
  country?: string
  region?: string
  city?: string
  neighborhood?: string
  location?: [number, number] // [lat, lon]
  walkability_score?: number
  description?: string
  unique_selling_points?: string[]
  amenities?: string[]
  has_spa?: boolean
  has_parking?: boolean
  has_airport_shuttle?: boolean
  pet_friendly?: boolean
  restaurant_count?: number
  restaurant_cuisines?: string[]
  has_michelin_restaurant?: boolean
  breakfast_included?: boolean
  review_score?: number
  review_count?: number
  location_score?: number
  cleanliness_score?: number
  service_score?: number
  sustainability_certifications?: string[]
  room_type_count?: number
  room_types_available?: string[]
  min_room_size_sqm?: number
  max_room_size_sqm?: number
  min_room_price?: number
  max_room_price?: number
  max_occupancy_available?: number
  currency?: string
  nearby_poi_names?: string[]
  nearby_poi_categories?: string[]
  created_at?: number
  content_last_updated?: number
}

export interface TypesenseRoomDocument {
  id: string
  room_name: string
  room_slug: string
  room_type: string
  hotel_id: string
  hotel_name: string
  hotel_slug: string
  location_slug?: string
  hotel_image_url?: string
  city?: string
  location?: [number, number] // [lat, lon]
  size_sqm_min?: number
  size_sqm_max?: number
  max_adults?: number
  max_children?: number
  max_infants?: number
  total_max_occupancy: number
  bathroom_type?: string
  tier?: string
  amenities?: string[]
  unique_features?: string[]
  climate_control?: string[]
  has_coffee_machine?: boolean
  has_mini_fridge?: boolean
  has_workspace?: boolean
  tags?: string[]
  ideal_for?: string[]
  not_ideal_for?: string[]
  description?: string
}
