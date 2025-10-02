/**
 * Backfill Existing Hotels to Typesense
 * 
 * This script indexes all existing hotels from MongoDB s_payload.hotels
 * into Typesense. Use this for:
 * - Initial setup when you have existing hotels
 * - Re-indexing after schema changes
 * - Recovery after Typesense data loss
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'
import Typesense from 'typesense'

// MongoDB configuration
const MONGODB_URI = process.env['mongodb-uri']
const HOTELS_DB_NAME = process.env['hotels-db-name'] || 's_payload'

// Typesense configuration
const TYPESENSE_HOST = process.env['typesense-host']
const TYPESENSE_PORT = parseInt(process.env['typesense-port'] || '443')
const TYPESENSE_PROTOCOL = process.env['typesense-protocol'] || 'https'
const TYPESENSE_API_KEY = process.env['typesense-api-key']

if (!MONGODB_URI || !TYPESENSE_HOST || !TYPESENSE_API_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('Required: mongodb-uri, typesense-host, typesense-api-key')
  process.exit(1)
}

/**
 * Transform MongoDB hotel document to Typesense format
 */
function transformHotelForTypesense(hotel) {
  try {
    const id = String(hotel._id)
    const name = hotel.name || 'Unknown Hotel'
    const slug = hotel.slug || id

    // Location
    const location = hotel.location || {}
    const city = location.city || ''
    const country = location.country || ''
    const region = location.region || ''
    const address = location.address || ''
    const coordinates = location.coordinates || { lat: 0, lon: 0 }
    const neighborhood = location.neighborhood || ''

    // Rooms
    const rooms = hotel.rooms || []
    const roomTypes = [...new Set(rooms.map(r => r.identity?.roomType).filter(Boolean))]
    const roomTiers = [...new Set(rooms.map(r => r.hierarchy?.tier).filter(Boolean))]
    
    // Prices
    const roomPrices = rooms
      .map(r => r.pricingContext?.avgNightlyRate?.min)
      .filter(p => p != null && p > 0)
    const minPrice = roomPrices.length > 0 ? Math.min(...roomPrices) : 0
    const maxPrice = roomPrices.length > 0 ? Math.max(...roomPrices) : 0
    const avgPrice = roomPrices.length > 0 ? Math.round(roomPrices.reduce((a, b) => a + b, 0) / roomPrices.length) : 0
    const priceCurrency = rooms[0]?.pricingContext?.avgNightlyRate?.currency || 'USD'

    // Room sizes
    const roomSizes = rooms
      .map(r => r.identity?.sizeSqMeters)
      .filter(s => s != null && s > 0)
    const minRoomSize = roomSizes.length > 0 ? Math.min(...roomSizes) : 0
    const maxRoomSize = roomSizes.length > 0 ? Math.max(...roomSizes) : 0

    // Capacity
    const capacities = rooms
      .map(r => (r.identity?.capacity?.maxAdults || 0) + (r.identity?.capacity?.maxChildren || 0))
      .filter(c => c > 0)
    const maxCapacity = capacities.length > 0 ? Math.max(...capacities) : 0

    // Amenities
    const facilityAmenities = hotel.facilities?.hotelAmenities || []
    const amenitySet = new Set(facilityAmenities.map(a => a.toLowerCase()))
    
    const hasWifi = amenitySet.has('wifi') || amenitySet.has('wi-fi') || amenitySet.has('internet')
    const hasPool = amenitySet.has('pool') || amenitySet.has('swimming pool')
    const hasSpa = hotel.facilities?.spa != null && hotel.facilities.spa.length > 0
    const hasGym = amenitySet.has('gym') || amenitySet.has('fitness') || amenitySet.has('fitness center')
    const hasRestaurant = (hotel.foodAndBeverage?.restaurants || []).length > 0
    const hasBar = amenitySet.has('bar') || amenitySet.has('lounge')
    const hasParking = hotel.facilities?.parking?.available === true
    const hasPetFriendly = hotel.policies?.petPolicy?.petFriendly === true
    const hasAirConditioning = amenitySet.has('air conditioning') || amenitySet.has('ac') || amenitySet.has('climate control')
    const hasRoomService = amenitySet.has('room service')
    const hasConciergeMoment = hotel.facilities?.concierge != null && hotel.facilities.concierge.length > 0
    const hasBusinessCenter = (hotel.facilities?.businessAndEvents || []).length > 0
    const hasAirportShuttle = hotel.facilities?.airportShuttle?.available === true

    // Semantic
    const idealFor = [...new Set(rooms.flatMap(r => r.wouldMatch?.idealFor || []))].filter(Boolean)
    const roomTags = [...new Set(rooms.flatMap(r => r.wouldMatch?.tags || []))].filter(Boolean)
    const uniqueSellingPoints = hotel.marketPosition?.uniqueSellingPoints || []
    const nearbyPOIs = (hotel.location?.pointsOfInterest || []).map(poi => poi.name)
    
    const viewTypes = []

    // Reviews
    const reviewScore = hotel.reviews?.aggregate?.score || 0
    const reviewCount = hotel.reviews?.aggregate?.count || 0

    // Sustainability
    const sustainabilityCerts = hotel.sustainability?.certifications || []
    const sustainabilityPractices = hotel.sustainability?.practices || []
    const sustainabilityScore = sustainabilityCerts.length + sustainabilityPractices.length

    // Media
    const primaryImageUrl = hotel.media?.primaryImage?.url || ''
    const imageCount = hotel.media?.photoCount || 0

    return {
      id,
      name,
      slug,
      city,
      country,
      region,
      postalCode: '',
      streetAddress: address,
      latitude: coordinates.lat,
      longitude: coordinates.lon,
      neighborhood,
      distanceToCenter: 0,
      distanceToAirport: 0,
      roomCount: rooms.length,
      roomTypes,
      roomTiers,
      viewTypes,
      minPrice,
      maxPrice,
      avgPrice,
      priceCurrency,
      minRoomSize,
      maxRoomSize,
      roomSizeUnit: 'sqm',
      maxCapacity,
      hasWifi,
      hasPool,
      hasSpa,
      hasGym,
      hasRestaurant,
      hasBar,
      hasParking,
      hasPetFriendly,
      hasAirConditioning,
      hasRoomService,
      hasConciergeMoment,
      hasBusinessCenter,
      hasAirportShuttle,
      idealFor,
      roomTags,
      uniqueSellingPoints,
      nearbyPOIs,
      reviewScore,
      reviewCount,
      sustainabilityScore,
      primaryImageUrl,
      imageCount,
      createdAt: hotel.createdAt ? Math.floor(new Date(hotel.createdAt).getTime() / 1000) : 0,
      updatedAt: hotel.contentLastUpdated ? Math.floor(new Date(hotel.contentLastUpdated).getTime() / 1000) : Math.floor(Date.now() / 1000)
    }
  } catch (error) {
    console.error(`Error transforming hotel ${hotel._id}:`, error.message)
    return null
  }
}

async function main() {
  console.log('🚀 Starting hotel backfill to Typesense...\n')

  // Connect to MongoDB
  console.log('📊 Connecting to MongoDB...')
  const mongoClient = new MongoClient(MONGODB_URI)
  await mongoClient.connect()
  console.log('✅ MongoDB connected\n')

  // Initialize Typesense client
  console.log('🔍 Connecting to Typesense...')
  const typesenseClient = new Typesense.Client({
    nodes: [{
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL
    }],
    apiKey: TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 10
  })

  // Test Typesense connection
  await typesenseClient.health.retrieve()
  console.log('✅ Typesense connected\n')

  try {
    // Get hotels from MongoDB
    const hotelsDb = mongoClient.db(HOTELS_DB_NAME)
    const hotelsCollection = hotelsDb.collection('hotels')
    
    console.log(`📚 Fetching hotels from ${HOTELS_DB_NAME}.hotels...`)
    const hotels = await hotelsCollection.find({}).toArray()
    console.log(`✅ Found ${hotels.length} hotels\n`)

    if (hotels.length === 0) {
      console.log('⚠️  No hotels to index')
      return
    }

    // Transform and index hotels
    console.log('🔄 Transforming and indexing hotels...')
    let successCount = 0
    let errorCount = 0

    for (const hotel of hotels) {
      try {
        const typesenseDoc = transformHotelForTypesense(hotel)
        
        if (!typesenseDoc) {
          console.error(`❌ Failed to transform hotel: ${hotel.name} (${hotel._id})`)
          errorCount++
          continue
        }

        await typesenseClient.collections('hotels').documents().upsert(typesenseDoc)
        successCount++
        console.log(`✅ [${successCount}/${hotels.length}] Indexed: ${hotel.name}`)
      } catch (error) {
        console.error(`❌ Failed to index hotel: ${hotel.name} (${hotel._id})`, error.message)
        errorCount++
      }
    }

    console.log('\n📊 Backfill Summary:')
    console.log(`   Total hotels: ${hotels.length}`)
    console.log(`   ✅ Successfully indexed: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)

    // Verify count in Typesense
    const collection = await typesenseClient.collections('hotels').retrieve()
    console.log(`   🔍 Typesense document count: ${collection.num_documents}`)

  } finally {
    await mongoClient.close()
    console.log('\n✅ Backfill complete!')
  }
}

main().catch(error => {
  console.error('❌ Backfill failed:', error)
  process.exit(1)
})
