/**
 * Create Typesense Collection - Single Hotels Collection with Nested Rooms
 * 
 * Mirrors MongoDB structure - no splitting, no data loss
 */

import dotenv from 'dotenv'
import Typesense from 'typesense'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') })

const client = new Typesense.Client({
  nodes: [{
    host: process.env['typesense-host'],
    port: parseInt(process.env['typesense-port']),
    protocol: process.env['typesense-protocol']
  }],
  apiKey: process.env['typesense-api-key'],
  connectionTimeoutSeconds: 10
})

// Single Hotels Collection - 18 flat fields + nested rooms + full document
const hotelsSchema = {
  name: 'hotels',
  fields: [
    // === Core (3) ===
    { name: 'id', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'slug', type: 'string' },
    
    // === Location (4) ===
    { name: 'city', type: 'string', facet: true },
    { name: 'country', type: 'string', facet: true },
    { name: 'latitude', type: 'float' },
    { name: 'longitude', type: 'float' },
    
    // === Pricing (2) - computed from rooms ===
    { name: 'minPrice', type: 'int32', optional: true },
    { name: 'maxPrice', type: 'int32', optional: true },
    
    // === Key Amenities (6) ===
    { name: 'hasPool', type: 'bool', facet: true },
    { name: 'hasSpa', type: 'bool', facet: true },
    { name: 'hasGym', type: 'bool', facet: true },
    { name: 'hasParking', type: 'bool', facet: true },
    { name: 'hasPetFriendly', type: 'bool', facet: true },
    { name: 'hasBreakfast', type: 'bool', facet: true },
    
    // === Reviews (2) ===
    { name: 'reviewScore', type: 'float', optional: true },
    { name: 'reviewCount', type: 'int32', optional: true },
    
    // === Timestamp (1) ===
    { name: 'updatedAt', type: 'int64' },
    
    // === NESTED ROOMS (searchable!) ===
    { name: 'rooms', type: 'object[]', optional: true },
    
    // === FULL DOCUMENT (not indexed, for display) ===
    { name: 'document', type: 'object', optional: true, index: false }
  ],
  default_sorting_field: 'updatedAt',
  enable_nested_fields: true  // Allow searching nested room fields
}

async function createCollection() {
  console.log('🚀 Creating Typesense Hotels Collection\n')
  console.log('📋 Schema:')
  console.log('   - Single collection with nested rooms')
  console.log('   - 18 flat fields for filtering')
  console.log('   - rooms[] array (searchable)')
  console.log('   - Full MongoDB document preserved\n')
  
  try {
    // Test connection
    await client.health.retrieve()
    console.log('✅ Connected to Typesense\n')
    
    // Delete old collections
    console.log('🗑️  Cleaning up old collections...')
    const collectionsToDelete = ['hotels', 'hotels_v2', 'rooms']
    
    for (const collName of collectionsToDelete) {
      try {
        await client.collections(collName).delete()
        console.log(`   Deleted: ${collName}`)
      } catch (e) {
        // Collection doesn't exist, that's fine
      }
    }
    console.log()
    
    // Create new collection
    console.log('📚 Creating hotels collection...')
    await client.collections().create(hotelsSchema)
    console.log('✅ Hotels collection created!')
    console.log()
    
    // Show schema details
    console.log('📊 Schema Details:')
    console.log('   Flat Fields: 18')
    console.log('   - Core: id, name, slug')
    console.log('   - Location: city, country, lat, lng')
    console.log('   - Pricing: minPrice, maxPrice')
    console.log('   - Amenities: 6 boolean flags')
    console.log('   - Reviews: score, count')
    console.log('   - Meta: updatedAt')
    console.log()
    console.log('   Nested Fields:')
    console.log('   - rooms[] (searchable array)')
    console.log('   - document (full MongoDB doc)')
    console.log()
    
    // Verify
    const collection = await client.collections('hotels').retrieve()
    console.log('📈 Collection Status:')
    console.log(`   Name: ${collection.name}`)
    console.log(`   Documents: ${collection.num_documents}`)
    console.log(`   Fields: ${collection.fields.length}`)
    console.log()
    
    console.log('✅ Setup complete!')
    console.log()
    console.log('🎯 Next Steps:')
    console.log('   1. Restart venue-enrichment service')
    console.log('   2. Enrich a hotel (it will auto-sync)')
    console.log('   3. Query nested rooms:')
    console.log('      query_by: "rooms.roomName,rooms.identity.roomType"')
    console.log('      filter_by: "rooms.wouldMatch.tags:=workspace"')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.httpStatus) {
      console.error('   HTTP Status:', error.httpStatus)
    }
    if (error.importResults) {
      console.error('   Details:', JSON.stringify(error.importResults, null, 2))
    }
    process.exit(1)
  }
}

createCollection()
