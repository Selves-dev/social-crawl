/**
 * Index MongoDB (Payload) Hotels to Elasticsearch
 * 
 * This script indexes hotels and rooms from MongoDB s_payload.hotels
 * directly into Elasticsearch with ngram analyzers
 * 
 * Usage:
 *   MONGODB_URI=mongodb://... ES_ENDPOINT=https://... ES_API_KEY=... node index-mongodb-to-elasticsearch.js
 */

import { MongoClient } from 'mongodb'
import { Client } from '@elastic/elasticsearch'

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env['mongodb-uri']
const HOTELS_DB_NAME = process.env.HOTELS_DB_NAME || 's_payload'

// Elasticsearch configuration
const ES_ENDPOINT = process.env.ES_ENDPOINT
const ES_API_KEY = process.env.ES_API_KEY

if (!MONGODB_URI || !ES_ENDPOINT || !ES_API_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   MONGODB_URI: MongoDB connection string')
  console.error('   ES_ENDPOINT: Elasticsearch endpoint URL')
  console.error('   ES_API_KEY: Elasticsearch API key')
  process.exit(1)
}

const esClient = new Client({
  node: ES_ENDPOINT,
  auth: {
    apiKey: ES_API_KEY
  }
})

/**
 * Transform MongoDB hotel document to Elasticsearch hotel format
 */
function transformHotelForES(hotel) {
  const location = hotel.location || {}
  const coordinates = location.coordinates || { lat: 0, lon: 0 }
  const facilities = hotel.facilities || {}
  const reviews = hotel.reviews || {}
  
  return {
    id: String(hotel._id),
    name: hotel.name || 'Unknown Hotel',
    slug: hotel.slug || String(hotel._id),
    selves_id: hotel.selvesId || null,
    
    // Ratings & Reviews
    star_rating: hotel.starRating || 0,
    price_tier: hotel.priceTier || null,
    hotel_types: hotel.hotelTypes || [],
    brand_affiliation: hotel.brandAffiliation || null,
    
    // Location
    location_slug: location.slug || null,
    country: location.country || '',
    region: location.region || '',
    city: location.city || '',
    neighborhood: location.neighborhood || '',
    location: coordinates.lat && coordinates.lon ? {
      lat: coordinates.lat,
      lon: coordinates.lon
    } : null,
    walkability_score: location.walkabilityScore || 0,
    
    // Description
    description: hotel.description || '',
    unique_selling_points: hotel.uniqueSellingPoints || '',
    
    // Amenities
    amenities: facilities.hotelAmenities || [],
    has_spa: (facilities.hotelAmenities || []).some(a => a.toLowerCase().includes('spa')),
    has_parking: (facilities.hotelAmenities || []).some(a => a.toLowerCase().includes('parking')),
    has_airport_shuttle: (facilities.hotelAmenities || []).some(a => a.toLowerCase().includes('airport') || a.toLowerCase().includes('shuttle')),
    pet_friendly: (facilities.hotelAmenities || []).some(a => a.toLowerCase().includes('pet')),
    
    // Dining
    restaurant_count: facilities.restaurants?.length || 0,
    restaurant_cuisines: facilities.restaurants?.map(r => r.cuisine).filter(Boolean) || [],
    has_michelin_restaurant: (facilities.restaurants || []).some(r => r.michelinStars > 0),
    breakfast_included: facilities.breakfastIncluded || false,
    
    // Reviews
    review_score: reviews.overallScore || 0,
    review_count: reviews.totalReviews || 0,
    location_score: reviews.locationScore || 0,
    cleanliness_score: reviews.cleanlinessScore || 0,
    service_score: reviews.serviceScore || 0,
    
    // Sustainability
    sustainability_certifications: hotel.sustainabilityCertifications || [],
    
    // Room stats (calculated from rooms)
    room_type_count: 0, // Will be filled in
    room_types_available: [], // Will be filled in
    min_room_size_sqm: 0,
    max_room_size_sqm: 0,
    min_room_price: 0,
    max_room_price: 0,
    max_occupancy_available: 0,
    currency: 'USD',
    
    // POI
    nearby_poi_names: (hotel.nearbyPOIs || []).map(poi => poi.name).filter(Boolean),
    nearby_poi_categories: (hotel.nearbyPOIs || []).map(poi => poi.category).filter(Boolean),
    
    // Metadata
    created_at: hotel.createdAt || new Date().toISOString(),
    content_last_updated: hotel.contentLastUpdated || hotel.updatedAt || new Date().toISOString(),
    updated_at: hotel.updatedAt || new Date().toISOString(),
    status: hotel._status || 'published'
  }
}

/**
 * Transform MongoDB room document to Elasticsearch room format
 */
function transformRoomForES(room, hotel, hotelES) {
  const identity = room.identity || {}
  const features = room.features || {}
  const wouldMatch = room.wouldMatch || {}
  const pricing = room.pricingContext || {}
  const sizeSqMeters = identity.sizeSqMeters || {}
  
  // Get room amenities from features.roomAmenities
  const roomAmenities = features.roomAmenities || []
  const amenitiesStr = roomAmenities.join(' ').toLowerCase()
  
  // Create unique room ID: hotel_id-room_id
  const roomId = room.id || room.roomId
  const uniqueId = `${hotel._id}-${roomId}`
  
  return {
    id: uniqueId,
    room_name: room.roomName || identity.name || 'Unknown Room',
    room_slug: room.roomSlug || room.slug || uniqueId,
    room_type: identity.roomType || '',
    
    // Hotel reference
    hotel_id: String(hotel._id),
    hotel_name: hotel.name || 'Unknown Hotel',
    hotel_slug: hotel.slug || String(hotel._id),
    hotel_image_url: hotel.primaryImage || null,
    location_slug: hotel.location?.slug || null,
    city: hotel.location?.city || '',
    neighborhood: hotel.location?.neighborhood || '',
    location: hotelES.location,
    
    // Size & Capacity - handle both object {min, max} and number formats
    size_sqm_min: typeof sizeSqMeters === 'object' ? (sizeSqMeters.min || 0) : (sizeSqMeters || 0),
    size_sqm_max: typeof sizeSqMeters === 'object' ? (sizeSqMeters.max || 0) : (sizeSqMeters || 0),
    max_adults: identity.maxOccupancy || 2,
    max_children: 0,
    max_infants: 0,
    total_max_occupancy: identity.maxOccupancy || 2,
    bathroom_type: features.bathroomType || null,
    
    // Tier
    tier: room.hierarchy?.tier || null,
    
    // Amenities & Features
    amenities: roomAmenities,
    unique_features: (features.uniqueFeatures || []).join(', '),
    climate_control: roomAmenities.some(a => a.toLowerCase().includes('air conditioning')) ? 'Air conditioning' : null,
    has_coffee_machine: amenitiesStr.includes('coffee'),
    has_mini_fridge: amenitiesStr.includes('fridge') || amenitiesStr.includes('minibar'),
    has_workspace: amenitiesStr.includes('desk') || amenitiesStr.includes('workspace'),
    
    // Tags & Targeting - from wouldMatch
    tags: room.tags || [],
    ideal_for: wouldMatch.idealFor || [],
    not_ideal_for: wouldMatch.notIdealFor || [],
    
    // Description
    description: identity.descriptionShort || room.description || ''
  }
}

/**
 * Index hotels and rooms to Elasticsearch
 */
async function indexToElasticsearch() {
  console.log('🚀 Starting MongoDB → Elasticsearch indexing...')
  console.log(`   MongoDB: ${HOTELS_DB_NAME}.hotels`)
  console.log(`   Elasticsearch: ${ES_ENDPOINT}`)
  console.log('')

  let mongoClient
  
  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...')
    mongoClient = await MongoClient.connect(MONGODB_URI)
    const db = mongoClient.db(HOTELS_DB_NAME)
    const hotelsCollection = db.collection('hotels')
    
    // Connect to Elasticsearch
    console.log('📦 Connecting to Elasticsearch...')
    const esInfo = await esClient.info()
    console.log(`✅ Connected to Elasticsearch ${esInfo.version.number}`)
    console.log('')
    
    // Get all hotels with published status
    const hotels = await hotelsCollection.find({ 
      _status: 'published' 
    }).toArray()
    
    console.log(`📊 Found ${hotels.length} published hotels`)
    console.log('')
    
    let hotelCount = 0
    let roomCount = 0
    let errorCount = 0
    
    // Process each hotel
    for (const hotel of hotels) {
      try {
        const hotelES = transformHotelForES(hotel)
        const rooms = hotel.rooms || []
        
        // Calculate room stats for hotel
        if (rooms.length > 0) {
          const roomTypes = [...new Set(rooms.map(r => r.identity?.roomType).filter(Boolean))]
          const roomSizes = rooms.map(r => {
            const size = r.identity?.sizeSqMeters
            if (typeof size === 'object') return size.max || size.min || 0
            return size || 0
          }).filter(s => s > 0)
          const roomPrices = rooms.map(r => r.pricingContext?.avgNightlyRate?.min).filter(p => p > 0)
          const capacities = rooms.map(r => {
            const cap = r.identity?.capacity || {}
            return (cap.maxAdults || 0) + (cap.maxChildren || 0) + (cap.maxInfants || 0)
          }).filter(c => c > 0)
          
          hotelES.room_type_count = roomTypes.length
          hotelES.room_types_available = roomTypes
          hotelES.min_room_size_sqm = roomSizes.length > 0 ? Math.min(...roomSizes) : 0
          hotelES.max_room_size_sqm = roomSizes.length > 0 ? Math.max(...roomSizes) : 0
          hotelES.min_room_price = roomPrices.length > 0 ? Math.min(...roomPrices) : 0
          hotelES.max_room_price = roomPrices.length > 0 ? Math.max(...roomPrices) : 0
          hotelES.max_occupancy_available = capacities.length > 0 ? Math.max(...capacities) : 0
          hotelES.currency = rooms[0]?.pricingContext?.avgNightlyRate?.currency || 'USD'
        }
        
        // Index hotel
        await esClient.index({
          index: 'hotels',
          id: hotelES.id,
          document: hotelES
        })
        hotelCount++
        
        // Index rooms
        for (const room of rooms) {
          if (!room.id && !room.roomId) {
            console.error(`   ⚠️  Skipping room without id in hotel ${hotel.name}`)
            continue
          }
          
          try {
            const roomES = transformRoomForES(room, hotel, hotelES)
            await esClient.index({
              index: 'rooms',
              id: roomES.id,
              document: roomES
            })
            roomCount++
          } catch (error) {
            console.error(`   ❌ Failed to index room ${room.id || room.roomId} in ${hotel.name}:`, error.message)
            errorCount++
          }
        }
        
        // Progress update every 10 hotels
        if (hotelCount % 10 === 0) {
          console.log(`   ✅ Indexed ${hotelCount} hotels, ${roomCount} rooms...`)
        }
        
      } catch (error) {
        console.error(`❌ Failed to index hotel ${hotel._id}:`, error.message)
        errorCount++
      }
    }
    
    // Refresh indices to make documents searchable
    console.log('')
    console.log('🔄 Refreshing indices...')
    await esClient.indices.refresh({ index: 'hotels' })
    await esClient.indices.refresh({ index: 'rooms' })
    
    console.log('')
    console.log('✨ Indexing complete!')
    console.log(`   Hotels indexed: ${hotelCount}`)
    console.log(`   Rooms indexed: ${roomCount}`)
    console.log(`   Errors: ${errorCount}`)
    
  } catch (error) {
    console.error('❌ Indexing failed:', error)
    throw error
  } finally {
    if (mongoClient) {
      await mongoClient.close()
    }
  }
}

// Run the indexing
indexToElasticsearch()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
