import type { HotelDocument, HotelRoom } from '../../types/hotel'
import { logger } from './logger'
import type { TypesenseHotelDocument, TypesenseRoomDocument } from './typesenseSchemas'

/**
 * Transform MongoDB hotel document to Typesense two-collection schema
 * - Hotels collection: Parent entities with aggregated room stats
 * - Rooms collection: Child entities with hotel_id reference
 */
export interface TransformResult {
  hotel: TypesenseHotelDocument | null
  rooms: TypesenseRoomDocument[]
}

/**
 * Transform hotel document for Typesense indexing
 * Returns both hotel and room documents for two-collection strategy
 */
export function transformHotelForTypesense(hotel: HotelDocument): TransformResult {
  try {
    const hotelId = String(hotel._id)
    const rooms = hotel.rooms || []

    // Transform hotel document
    const hotelDoc = transformHotelDocument(hotel, hotelId, rooms)
    
    // Transform all room documents
    const roomDocs = rooms.map(room => 
      transformRoomDocument(room, hotel, hotelId)
    ).filter(Boolean) as TypesenseRoomDocument[]

    return {
      hotel: hotelDoc,
      rooms: roomDocs
    }
  } catch (error) {
    logger.error('Failed to transform hotel for Typesense', error as Error, {
      service: 'typesense-transform',
      hotelId: hotel._id
    })
    return {
      hotel: null,
      rooms: []
    }
  }
}

/**
 * Transform hotel to Typesense hotel document with aggregated room stats
 */
function transformHotelDocument(
  hotel: HotelDocument, 
  hotelId: string,
  rooms: HotelRoom[]
): TypesenseHotelDocument | null {
  try {
    const location = hotel.location || {}
    const identity = hotel.identity || {}
    const facilities = hotel.facilities || {}
    const foodAndBeverage = hotel.foodAndBeverage || {}
    const policies = hotel.policies || {}
    const reviews = hotel.reviews || {}
    const marketPosition = hotel.marketPosition || {}

    // Aggregate room statistics
    const roomStats = calculateRoomStatistics(rooms)

    // Extract amenities
    const amenities = facilities.hotelAmenities || []
    const amenitySet = new Set(amenities.map(a => a.toLowerCase()))

    // Extract restaurant info
    const restaurants = foodAndBeverage.restaurants || []
    const cuisines = [...new Set(restaurants.map(r => r.cuisine).filter(Boolean))] as string[]
    const hasMichelin = restaurants.some(r => 
      r.awards?.some(a => a.toLowerCase().includes('michelin'))
    )

    // Extract POI data
    const pois = location.pointsOfInterest || []
    const poiNames = pois.map(p => p.name).filter(Boolean)
    const poiCategories = [...new Set(pois.map(p => p.category).filter(Boolean))]

    // Build hotel document
    const hotelDoc: TypesenseHotelDocument = {
      id: hotelId,
      name: hotel.name || 'Unknown Hotel',
      slug: hotel.slug || hotelId,
      selves_id: hotel.selves_id,
      
      // Classification
      star_rating: identity.starRating,
      price_tier: identity.priceTier,
      hotel_types: identity.hotelType,
      brand_affiliation: identity.brandAffiliation,
      
      // Location
      location_slug: hotel.locationSlug,
      country: location.country,
      region: location.region,
      city: location.city,
      neighborhood: location.neighborhood,
      location: location.coordinates?.lat && location.coordinates?.lon
        ? [location.coordinates.lat, location.coordinates.lon]
        : undefined,
      walkability_score: location.walkabilityScore,
      
      // Content
      description: identity.descriptionShort,
      unique_selling_points: marketPosition.uniqueSellingPoints,
      
      // Amenities
      amenities,
      has_spa: !!facilities.spa,
      has_parking: facilities.parking?.available === true,
      has_airport_shuttle: facilities.airportShuttle?.available === true,
      pet_friendly: policies.petPolicy?.petFriendly === true,
      
      // Food & Beverage
      restaurant_count: restaurants.length,
      restaurant_cuisines: cuisines,
      has_michelin_restaurant: hasMichelin,
      breakfast_included: foodAndBeverage.breakfast?.includedInRate === true,
      
      // Reviews (provide defaults for required sorting fields)
      review_score: reviews.aggregate?.score ?? 0,
      review_count: reviews.aggregate?.count ?? 0,
      location_score: reviews.scoresByCategory?.location,
      cleanliness_score: reviews.scoresByCategory?.cleanliness,
      service_score: reviews.scoresByCategory?.service,
      
      // Sustainability
      sustainability_certifications: hotel.sustainability?.certifications,
      
      // Aggregated room stats
      ...roomStats,
      
      // Points of Interest
      nearby_poi_names: poiNames,
      nearby_poi_categories: poiCategories,
      
      // Metadata
      created_at: hotel.createdAt ? Math.floor(new Date(hotel.createdAt).getTime() / 1000) : undefined,
      content_last_updated: hotel.contentLastUpdated 
        ? Math.floor(new Date(hotel.contentLastUpdated).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    }

    return hotelDoc
  } catch (error) {
    logger.error('Failed to transform hotel document', error as Error, {
      service: 'typesense-transform',
      hotelId
    })
    return null
  }
}

/**
 * Transform room to Typesense room document with hotel context
 */
function transformRoomDocument(
  room: HotelRoom,
  hotel: HotelDocument,
  hotelId: string
): TypesenseRoomDocument | null {
  try {
    const identity = room.identity
    const features = room.features
    const pricingContext = room.pricingContext
    const wouldMatch = room.wouldMatch
    const capacity = identity?.capacity

    // Extract amenities - combine amenity types (but NOT unique features)
    const allAmenities: string[] = []
    
    // Check for simple roomAmenities array (from AI enrichment)
    if ((features as any)?.roomAmenities && Array.isArray((features as any).roomAmenities)) {
      allAmenities.push(...(features as any).roomAmenities)
      logger.info('[typesense-transform] Found roomAmenities', {
        roomId: room.roomId,
        count: (features as any).roomAmenities.length
      })
    } else {
      logger.warn('[typesense-transform] No roomAmenities found', {
        roomId: room.roomId,
        features: JSON.stringify(features)
      })
    }
    
    // Also check structured amenities format
    if (features?.amenities?.climateControl) allAmenities.push(...features.amenities.climateControl)
    if (features?.amenities?.entertainment) allAmenities.push(...features.amenities.entertainment)
    if (features?.amenities?.workspace) allAmenities.push(...features.amenities.workspace)
    // Note: uniqueFeatures kept separate, not added to amenities
    
    const amenities = allAmenities
    const amenitySet = new Set(amenities.map((a: string) => a.toLowerCase()))

    // Calculate total max occupancy
    const totalMaxOccupancy = (capacity?.maxAdults || 0) + 
                              (capacity?.maxChildren || 0) + 
                              (capacity?.maxInfants || 0) || 1  // Default to 1 if all are 0

    // Extract size (handle both number and { min, max } object)
    const sizeSqm = identity?.sizeSqMeters
    let sizeMin: number | undefined
    let sizeMax: number | undefined
    
    if (typeof sizeSqm === 'number') {
      sizeMin = sizeSqm
      sizeMax = sizeSqm
    } else if (sizeSqm && typeof sizeSqm === 'object') {
      const sizeObj = sizeSqm as any
      sizeMin = sizeObj.min
      sizeMax = sizeObj.max
    }

    const roomDoc: TypesenseRoomDocument = {
      id: `${hotelId}-${room.roomId || room.id || identity?.name || 'unknown'}`,
      room_name: room.roomName || identity?.name || 'Unknown Room',
      room_slug: room.roomSlug || `${hotel.slug}-${room.roomId || room.id}`,
      room_type: identity?.roomType || '',
      
      // Parent reference
      hotel_id: hotelId,
      
      // Denormalized hotel context
      hotel_name: hotel.name || 'Unknown Hotel',
      hotel_slug: hotel.slug || hotelId,
      location_slug: hotel.locationSlug,
      hotel_image_url: hotel.media?.primaryImage?.url,
      city: hotel.location?.city,
      location: hotel.location?.coordinates?.lat && hotel.location?.coordinates?.lon
        ? [hotel.location.coordinates.lat, hotel.location.coordinates.lon]
        : undefined,
      
      // Physical characteristics
      size_sqm_min: sizeMin,
      size_sqm_max: sizeMax,
      max_adults: capacity?.maxAdults,
      max_children: capacity?.maxChildren,
      max_infants: capacity?.maxInfants,
      total_max_occupancy: totalMaxOccupancy,
      bathroom_type: features?.bathroomType,
      
      // Hierarchy
      tier: room.hierarchy?.tier,
      
      // Amenities & Features
      amenities,
      unique_features: features?.uniqueFeatures,
      climate_control: features?.amenities?.climateControl,
      has_coffee_machine: amenitySet.has('coffee machine') || 
                         amenitySet.has('coffee maker') || 
                         features?.amenities?.refreshments?.coffeeMachine != null,
      has_mini_fridge: amenitySet.has('mini fridge') || 
                      amenitySet.has('minibar') ||
                      features?.amenities?.refreshments?.miniFridge === true,
      has_workspace: amenitySet.has('desk') || 
                    amenitySet.has('work desk') || 
                    amenitySet.has('workspace') ||
                    (features?.amenities?.workspace && features.amenities.workspace.length > 0),
      
      // AI Matching Tags
      tags: wouldMatch?.tags,
      ideal_for: wouldMatch?.idealFor,
      not_ideal_for: wouldMatch?.notIdealFor,
      
      // Content
      description: identity?.descriptionShort || identity?.description,
    }

    return roomDoc
  } catch (error) {
    logger.error('Failed to transform room document', error as Error, {
      service: 'typesense-transform',
      hotelId,
      roomId: room.id
    })
    return null
  }
}

/**
 * Calculate aggregated statistics from rooms array
 */
function calculateRoomStatistics(rooms: HotelRoom[]) {
  if (!rooms || rooms.length === 0) {
    return {
      room_type_count: 0,
      room_types_available: [],
      min_room_size_sqm: undefined,
      max_room_size_sqm: undefined,
      min_room_price: undefined,
      max_room_price: undefined,
      max_occupancy_available: undefined,
      currency: undefined,
    }
  }

  // Collect room types
  const roomTypes = [...new Set(rooms.map(r => r.identity?.roomType).filter(Boolean))] as string[]

  // Collect sizes
  const sizes: number[] = []
  rooms.forEach(r => {
    const sizeSqm = r.identity?.sizeSqMeters
    if (typeof sizeSqm === 'number') {
      sizes.push(sizeSqm)
    }
  })

  // Collect prices
  const prices: number[] = []
  rooms.forEach(r => {
    const avgRate = r.pricingContext?.avgNightlyRate
    if (avgRate) {
      if (avgRate.min) prices.push(avgRate.min)
      if (avgRate.max) prices.push(avgRate.max)
    }
  })

  // Collect max occupancies
  const occupancies = rooms.map(r => {
    const cap = r.identity?.capacity
    if (!cap) return 0
    return (cap.maxAdults || 0) + (cap.maxChildren || 0) + (cap.maxInfants || 0)
  }).filter(o => o > 0)

  // Get currency from first room with pricing
  const currency = rooms.find(r => r.pricingContext?.avgNightlyRate?.currency)?.pricingContext?.avgNightlyRate?.currency

  return {
    room_type_count: rooms.length,
    room_types_available: roomTypes,
    min_room_size_sqm: sizes.length > 0 ? Math.min(...sizes) : undefined,
    max_room_size_sqm: sizes.length > 0 ? Math.max(...sizes) : undefined,
    min_room_price: prices.length > 0 ? Math.min(...prices) : undefined,
    max_room_price: prices.length > 0 ? Math.max(...prices) : undefined,
    max_occupancy_available: occupancies.length > 0 ? Math.max(...occupancies) : undefined,
    currency,
  }
}
