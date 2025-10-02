/**
 * Create Typesense Collections - Two Collection Strategy
 * 
 * This script creates two separate Typesense collections:
 * 1. hotels - Parent entities with aggregated stats
 * 2. rooms - Child entities with hotel_id references
 * 
 * This replaces the previous single nested collection approach
 */

import Typesense from 'typesense'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '../config/.env.typesense' })

// Define schemas directly (mirrors typesenseSchemas.ts)
const hotelsSchema = {
  name: 'hotels',
  fields: [
    // Core Identity
    { name: 'id', type: 'string', facet: false },
    { name: 'name', type: 'string', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'selves_id', type: 'string', facet: false, optional: true },
    
    // Classification
    { name: 'star_rating', type: 'int32', facet: true, optional: true },
    { name: 'price_tier', type: 'string', facet: true, optional: true },
    { name: 'hotel_types', type: 'string[]', facet: true, optional: true },
    { name: 'brand_affiliation', type: 'string', facet: true, optional: true },
    
    // Location
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
    
    // Aggregated Room Stats
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
  ],
  default_sorting_field: 'review_score',
}

const roomsSchema = {
  name: 'rooms',
  fields: [
    // Core Identity
    { name: 'id', type: 'string', facet: false },
    { name: 'room_name', type: 'string', facet: false },
    { name: 'room_slug', type: 'string', facet: false },
    { name: 'room_type', type: 'string', facet: true },
    
    // Parent Reference
    { name: 'hotel_id', type: 'string', facet: true },
    
    // Denormalized hotel context
    { name: 'hotel_name', type: 'string', facet: false },
    { name: 'hotel_slug', type: 'string', facet: false },
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

const client = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http'
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || '',
  connectionTimeoutSeconds: 10
})

async function createCollections() {
  console.log('🚀 Creating Typesense collections (Two Collection Strategy)...\n')

  try {
    // Delete existing collections if they exist
    console.log('🗑️  Deleting existing collections if they exist...')
    try {
      await client.collections('hotels').delete()
      console.log('   ✅ Deleted existing hotels collection')
    } catch (error) {
      console.log('   ℹ️  hotels collection does not exist (OK)')
    }

    try {
      await client.collections('rooms').delete()
      console.log('   ✅ Deleted existing rooms collection')
    } catch (error) {
      console.log('   ℹ️  rooms collection does not exist (OK)')
    }

    console.log('')

    // Create hotels collection
    console.log('📦 Creating hotels collection...')
    await client.collections().create(hotelsSchema)
    console.log('   ✅ hotels collection created')
    console.log(`   Fields: ${hotelsSchema.fields.length}`)
    console.log(`   Default sorting: ${hotelsSchema.default_sorting_field}`)
    console.log('')

    // Create rooms collection
    console.log('📦 Creating rooms collection...')
    await client.collections().create(roomsSchema)
    console.log('   ✅ rooms collection created')
    console.log(`   Fields: ${roomsSchema.fields.length}`)
    console.log(`   Default sorting: ${roomsSchema.default_sorting_field}`)
    console.log('')

    // Verify collections
    console.log('🔍 Verifying collections...')
    const collections = await client.collections().retrieve()
    const hotelsColl = collections.find(c => c.name === 'hotels')
    const roomsColl = collections.find(c => c.name === 'rooms')

    if (hotelsColl && roomsColl) {
      console.log('   ✅ Both collections verified')
      console.log(`   hotels: ${hotelsColl.num_documents} documents`)
      console.log(`   rooms: ${roomsColl.num_documents} documents`)
    } else {
      console.log('   ❌ Collection verification failed')
    }

    console.log('')
    console.log('✨ Collection setup complete!')
    console.log('')
    console.log('📝 Collection Strategy:')
    console.log('   - hotels: Parent entities with aggregated room stats')
    console.log('   - rooms: Child entities with hotel_id references')
    console.log('')
    console.log('🔗 Query Examples:')
    console.log('   - Search hotels: Search "hotels" collection')
    console.log('   - Search rooms: Search "rooms" collection with hotel_id filter')
    console.log('   - Cross-search: Multi-search across both collections')
    console.log('')

  } catch (error) {
    console.error('❌ Error creating collections:', error)
    process.exit(1)
  }
}

// Run the script
createCollections()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
