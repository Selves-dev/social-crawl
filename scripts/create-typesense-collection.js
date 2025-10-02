/**
 * Typesense Collection Schema for Hotels
 * 
 * This schema defines the searchable fields for hotel data.
 * Based on: /docs/TYPESENSE-SCHEMA.md
 * 
 * Run this script to create the collection:
 * node scripts/create-typesense-collection.js
 */

import Typesense from 'typesense';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../config/.env.typesense') });

// Initialize Typesense client with ADMIN key
const client = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: parseInt(process.env.TYPESENSE_PORT),
    protocol: process.env.TYPESENSE_PROTOCOL
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  connectionTimeoutSeconds: 10
});

// Hotel collection schema
const hotelSchema = {
  name: 'hotels',
  fields: [
    // ==========================================
    // CORE IDENTIFIERS
    // ==========================================
    { name: 'id', type: 'string', facet: false },
    { name: 'name', type: 'string', facet: false, sort: true },
    { name: 'slug', type: 'string', facet: false },
    { name: 'selves_id', type: 'string', facet: false, optional: true },
    
    // ==========================================
    // LOCATION
    // ==========================================
    { name: 'city', type: 'string', facet: true, sort: true, optional: true },
    { name: 'country', type: 'string', facet: true, optional: true },
    { name: 'region', type: 'string', facet: true, optional: true },
    { name: 'neighborhood', type: 'string', facet: true, optional: true },
    { name: 'locationSlug', type: 'string', facet: false, optional: true },
    { name: 'address', type: 'string', facet: false, optional: true },
    { name: 'coordinates', type: 'geopoint', optional: true },
    { name: 'walkabilityScore', type: 'int32', facet: true, sort: true, optional: true },
    { name: 'nearbyPOIs', type: 'string[]', facet: true, optional: true },
    { name: 'poiCategories', type: 'string[]', facet: true, optional: true },
    
    // ==========================================
    // HOTEL IDENTITY
    // ==========================================
    { name: 'starRating', type: 'int32', facet: true, sort: true, optional: true },
    { name: 'priceTier', type: 'string', facet: true, optional: true },
    { name: 'hotelTypes', type: 'string[]', facet: true, optional: true },
    { name: 'brandAffiliation', type: 'string', facet: true, optional: true },
    { name: 'descriptionShort', type: 'string', facet: false, optional: true },
    { name: 'registryId', type: 'string', facet: false, optional: true },
    
    // ==========================================
    // ROOM AGGREGATES
    // ==========================================
    { name: 'roomCount', type: 'int32', facet: true, sort: true },
    { name: 'lowestRoomPrice', type: 'float', facet: true, sort: true, optional: true },
    { name: 'highestRoomPrice', type: 'float', facet: true, sort: true, optional: true },
    { name: 'priceCurrency', type: 'string', facet: true, optional: true },
    { name: 'roomTypes', type: 'string[]', facet: true },
    { name: 'roomTiers', type: 'string[]', facet: true, optional: true },
    { name: 'viewTypes', type: 'string[]', facet: true, optional: true },
    { name: 'bedConfigurations', type: 'string[]', facet: true, optional: true },
    { name: 'smallestRoomSqm', type: 'int32', facet: true, optional: true },
    { name: 'largestRoomSqm', type: 'int32', facet: true, optional: true },
    
    // ==========================================
    // AMENITIES (Boolean flags + list)
    // ==========================================
    { name: 'hasWifi', type: 'bool', facet: true, optional: true },
    { name: 'hasParking', type: 'bool', facet: true, optional: true },
    { name: 'hasParkingOnSite', type: 'bool', facet: true, optional: true },
    { name: 'hasSpa', type: 'bool', facet: true, optional: true },
    { name: 'hasPool', type: 'bool', facet: true, optional: true },
    { name: 'hasFitnessCenter', type: 'bool', facet: true, optional: true },
    { name: 'hasRestaurant', type: 'bool', facet: true, optional: true },
    { name: 'hasBar', type: 'bool', facet: true, optional: true },
    { name: 'hasRoomService', type: 'bool', facet: true, optional: true },
    { name: 'hasAirportShuttle', type: 'bool', facet: true, optional: true },
    { name: 'hasConcierge', type: 'bool', facet: true, optional: true },
    { name: 'hasBusinessCenter', type: 'bool', facet: true, optional: true },
    { name: 'isPetFriendly', type: 'bool', facet: true, optional: true },
    { name: 'hotelAmenities', type: 'string[]', facet: true, optional: true },
    
    // ==========================================
    // FOOD & BEVERAGE
    // ==========================================
    { name: 'restaurantCount', type: 'int32', facet: true, optional: true },
    { name: 'restaurantNames', type: 'string[]', facet: false, optional: true },
    { name: 'cuisineTypes', type: 'string[]', facet: true, optional: true },
    { name: 'hasBreakfast', type: 'bool', facet: true, optional: true },
    { name: 'breakfastIncluded', type: 'bool', facet: true, optional: true },
    { name: 'dietaryOptions', type: 'string[]', facet: true, optional: true },
    
    // ==========================================
    // REVIEWS
    // ==========================================
    { name: 'reviewScore', type: 'float', facet: true, sort: true }, // Required (default sort field)
    { name: 'reviewCount', type: 'int32', facet: true, sort: true, optional: true },
    { name: 'reviewSource', type: 'string', facet: false, optional: true },
    { name: 'locationScore', type: 'float', facet: true, optional: true },
    { name: 'cleanlinessScore', type: 'float', facet: true, optional: true },
    { name: 'serviceScore', type: 'float', facet: true, optional: true },
    { name: 'valueScore', type: 'float', facet: true, optional: true },
    
    // ==========================================
    // SEMANTIC MATCHING (Critical for NLP!)
    // ==========================================
    { name: 'idealFor', type: 'string[]', facet: true, optional: true },
    { name: 'uniqueSellingPoints', type: 'string[]', facet: false, optional: true },
    { name: 'roomTags', type: 'string[]', facet: true, optional: true },
    
    // ==========================================
    // SUSTAINABILITY
    // ==========================================
    { name: 'hasSustainabilityCert', type: 'bool', facet: true, optional: true },
    { name: 'sustainabilityCerts', type: 'string[]', facet: true, optional: true },
    
    // ==========================================
    // MEDIA
    // ==========================================
    { name: 'hasMedia', type: 'bool', facet: true, optional: true },
    { name: 'photoCount', type: 'int32', facet: true, sort: true, optional: true },
    { name: 'hasPrimaryImage', type: 'bool', facet: true, optional: true },
    
    // ==========================================
    // METADATA
    // ==========================================
    { name: 'createdAt', type: 'int64', sort: true },
    { name: 'updatedAt', type: 'int64', sort: true, optional: true },
    { name: 'isFullyEnriched', type: 'bool', facet: true, optional: true },
    
    // ==========================================
    // EXTERNAL INTEGRATION
    // ==========================================
    { name: 'externalIds', type: 'string[]', facet: false, optional: true }
  ],
  
  default_sorting_field: 'reviewScore',
  
  // Enable prefix search for better matching
  token_separators: ['-', '_', '/'],
  
  // Symbols to index for better semantic matching
  symbols_to_index: ['&', '@', '#', '+']
};

/**
 * Create the hotels collection
 */
async function createCollection() {
  try {
    console.log('🔍 Checking Typesense connection...');
    
    // Test connection
    const health = await client.health.retrieve();
    console.log('✅ Typesense is healthy:', health);
    
    console.log('\n📦 Creating hotels collection...');
    
    // Try to retrieve existing collection
    try {
      const existing = await client.collections('hotels').retrieve();
      console.log('⚠️  Collection "hotels" already exists!');
      console.log('   Fields:', existing.num_documents, 'documents');
      console.log('\n❓ Do you want to:');
      console.log('   1. Keep it (do nothing)');
      console.log('   2. Delete and recreate (WARNING: loses all data)');
      console.log('\n   To delete and recreate, run:');
      console.log('   node scripts/create-typesense-collection.js --force');
      
      if (process.argv.includes('--force')) {
        console.log('\n🗑️  Deleting existing collection...');
        await client.collections('hotels').delete();
        console.log('✅ Collection deleted');
        
        // Create new one
        await client.collections().create(hotelSchema);
        console.log('✅ Collection "hotels" created successfully!');
      }
      
    } catch (error) {
      if (error.httpStatus === 404) {
        // Collection doesn't exist, create it
        await client.collections().create(hotelSchema);
        console.log('✅ Collection "hotels" created successfully!');
      } else {
        throw error;
      }
    }
    
    // Retrieve and display collection info
    const collection = await client.collections('hotels').retrieve();
    console.log('\n📊 Collection Details:');
    console.log('   Name:', collection.name);
    console.log('   Fields:', collection.fields.length);
    console.log('   Documents:', collection.num_documents);
    console.log('   Default sort:', collection.default_sorting_field);
    
    console.log('\n✨ Ready for indexing!');
    console.log('   Next step: Run the backfill script to index existing hotels');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.importError) {
      console.error('   Import Error:', error.importError);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createCollection();
}

export { hotelSchema, client };
