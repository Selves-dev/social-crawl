/**
 * Create Typesense Collections V2 - Minimal Schema
 * 
 * Hotels: 20 fields + full document
 * Rooms: 14 fields + full document
 */

import 'dotenv/config'
import Typesense from 'typesense'
import { config } from 'dotenv'

// Load env from parent directory
config({ path: '../.env' })

const client = new Typesense.Client({
  nodes: [{
    host: process.env['typesense-host'],
    port: parseInt(process.env['typesense-port']),
    protocol: process.env['typesense-protocol']
  }],
  apiKey: process.env['typesense-api-key'],
  connectionTimeoutSeconds: 10
})

// Hotels Collection Schema - 20 fields
const hotelsSchema = {
  name: 'hotels_v2',
  enable_nested_fields: true,  // Required for document field
  fields: [
    // Identifiers (3)
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'slug', type: 'string' },
    
    // Location (4) - for geo search
    { name: 'city', type: 'string', facet: true },
    { name: 'country', type: 'string', facet: true },
    { name: 'latitude', type: 'float' },
    { name: 'longitude', type: 'float' },
    
    // Pricing (3)
    { name: 'minPrice', type: 'int32', optional: true },
    { name: 'maxPrice', type: 'int32', optional: true },
    { name: 'currency', type: 'string', optional: true },
    
    // Key Amenities (6) - Only common filters
    { name: 'hasPool', type: 'bool', facet: true },
    { name: 'hasSpa', type: 'bool', facet: true },
    { name: 'hasGym', type: 'bool', facet: true },
    { name: 'hasParking', type: 'bool', facet: true },
    { name: 'hasPetFriendly', type: 'bool', facet: true },
    { name: 'hasBreakfastIncluded', type: 'bool', facet: true },
    
    // Reviews (2)
    { name: 'reviewScore', type: 'float' },  // Required for default sorting
    { name: 'reviewCount', type: 'int32', optional: true },
    
    // Meta (2)
    { name: 'updatedAt', type: 'int64' },
    { name: 'document', type: 'object', optional: true, index: false }
  ],
  default_sorting_field: 'reviewScore'
}

// Rooms Collection Schema - 14 fields
const roomsSchema = {
  name: 'rooms',
  enable_nested_fields: true,  // Required for document field
  fields: [
    // Identifiers (3)
    { name: 'id', type: 'string' },
    { name: 'roomSlug', type: 'string' },
    { name: 'roomName', type: 'string' },
    
    // Hotel Reference (3)
    { name: 'hotelId', type: 'string', facet: true },
    { name: 'hotelName', type: 'string' },
    { name: 'hotelSlug', type: 'string' },
    
    // Classification (2)
    { name: 'roomType', type: 'string', facet: true },
    { name: 'tier', type: 'string', facet: true, optional: true },
    
    // Pricing (2)
    { name: 'avgPrice', type: 'int32' },  // Required for default sorting
    { name: 'currency', type: 'string', optional: true },
    
    // Capacity (3)
    { name: 'sizeSqMeters', type: 'int32', optional: true },
    { name: 'maxAdults', type: 'int32', optional: true },
    { name: 'maxChildren', type: 'int32', optional: true },
    
    // Semantic Matching (2) - Flexible tags approach
    { name: 'tags', type: 'string[]', facet: true, optional: true },
    { name: 'idealFor', type: 'string[]', facet: true, optional: true },
    
    // Meta (2)
    { name: 'updatedAt', type: 'int64' },
    { name: 'document', type: 'object', optional: true, index: false }
  ],
  default_sorting_field: 'avgPrice'
}

async function createCollections() {
  console.log('🚀 Creating Typesense Collections V2 (Minimal Schema)\n')
  
  try {
    // Test connection
    await client.health.retrieve()
    console.log('✅ Connected to Typesense\n')
    
    // Delete old collections if they exist
    console.log('🗑️  Checking for existing collections...')
    try {
      await client.collections('hotels').delete()
      console.log('   Deleted old hotels collection')
    } catch (e) {
      console.log('   No old hotels collection')
    }
    
    try {
      await client.collections('hotels_v2').delete()
      console.log('   Deleted hotels_v2 collection')
    } catch (e) {
      console.log('   No hotels_v2 collection')
    }
    
    try {
      await client.collections('rooms').delete()
      console.log('   Deleted rooms collection')
    } catch (e) {
      console.log('   No rooms collection')
    }
    
    console.log()
    
    // Create hotels collection
    console.log('📚 Creating hotels_v2 collection...')
    await client.collections().create(hotelsSchema)
    console.log('✅ Hotels collection created')
    console.log(`   - ${hotelsSchema.fields.length} fields`)
    console.log('   - Fields: id, name, slug, city, country, lat/lng, prices, 6 amenities, reviews, updatedAt, document')
    console.log()
    
    // Create rooms collection
    console.log('🛏️  Creating rooms collection...')
    await client.collections().create(roomsSchema)
    console.log('✅ Rooms collection created')
    console.log(`   - ${roomsSchema.fields.length} fields`)
    console.log('   - Fields: id, name, slug, hotel ref, type, tier, price, capacity, tags, idealFor, updatedAt, document')
    console.log()
    
    // Verify
    const hotels = await client.collections('hotels_v2').retrieve()
    const rooms = await client.collections('rooms').retrieve()
    
    console.log('📊 Collection Summary:')
    console.log(`   Hotels: ${hotels.num_documents} documents`)
    console.log(`   Rooms: ${rooms.num_documents} documents`)
    console.log()
    console.log('✅ Schema creation complete!')
    console.log()
    console.log('Next steps:')
    console.log('1. Run: node backfill-typesense-v2.js')
    console.log('2. Test search queries')
    console.log('3. Update Change Stream plugin')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.httpStatus) {
      console.error('   HTTP Status:', error.httpStatus)
    }
    process.exit(1)
  }
}

createCollections()
