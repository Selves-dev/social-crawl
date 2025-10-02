import type { HotelDocument } from '../../types/hotel'
import { logger } from './logger'

/**
 * Transform MongoDB hotel document to Typesense schema
 * Single collection with nested rooms - mirrors MongoDB structure
 * 18 flat fields for filtering + rooms array + full document
 */
export function transformHotelForTypesense(hotel: HotelDocument): any | null {
  try {
    // Core identifiers
    const id = String(hotel._id)
    const name = hotel.name || 'Unknown Hotel'
    const slug = hotel.slug || id

    // Location fields
    const location = hotel.location || {}
    const city = location.city || ''
    const country = location.country || ''
    const coordinates = location.coordinates || { lat: 0, lon: 0 }

    // Price aggregates from rooms
    const rooms = hotel.rooms || []
    const roomPrices = rooms
      .map(r => r.pricingContext?.avgNightlyRate?.min)
      .filter(p => p != null && p > 0) as number[]
    const minPrice = roomPrices.length > 0 ? Math.min(...roomPrices) : undefined
    const maxPrice = roomPrices.length > 0 ? Math.max(...roomPrices) : undefined

    // Extract key amenities from facilities
    const facilityAmenities = hotel.facilities?.hotelAmenities || []
    const amenitySet = new Set(facilityAmenities.map(a => a.toLowerCase()))
    
    const hasPool = amenitySet.has('pool') || amenitySet.has('swimming pool')
    const hasSpa = hotel.facilities?.spa != null && hotel.facilities.spa.length > 0
    const hasGym = amenitySet.has('gym') || amenitySet.has('fitness') || amenitySet.has('fitness center')
    const hasParking = hotel.facilities?.parking?.available === true
    const hasPetFriendly = hotel.policies?.petPolicy?.petFriendly === true
    const hasBreakfast = hotel.foodAndBeverage?.breakfast?.includedInRate === true

    // Reviews
    const reviewScore = hotel.reviews?.aggregate?.score || undefined
    const reviewCount = hotel.reviews?.aggregate?.count || undefined

    // Timestamp
    const updatedAt = hotel.contentLastUpdated 
      ? Math.floor(new Date(hotel.contentLastUpdated).getTime() / 1000) 
      : Math.floor(Date.now() / 1000)

    // Build Typesense document with 18 flat fields + nested rooms + full document
    const typesenseDoc = {
      // 18 flat fields for filtering/faceting
      id,
      name,
      slug,
      city,
      country,
      latitude: coordinates.lat,
      longitude: coordinates.lon,
      minPrice,
      maxPrice,
      hasPool,
      hasSpa,
      hasGym,
      hasParking,
      hasPetFriendly,
      hasBreakfast,
      reviewScore,
      reviewCount,
      updatedAt,
      
      // Nested rooms array - searchable with enable_nested_fields
      rooms: hotel.rooms || [],
      
      // Full MongoDB document for display (not indexed)
      document: hotel
    }

    return typesenseDoc
  } catch (error) {
    logger.error('Failed to transform hotel for Typesense', error as Error, {
      service: 'typesense-transform',
      hotelId: hotel._id
    })
    return null
  }
}
