import type { Client } from 'typesense'
import { logger } from './logger'

/**
 * Typesense AND Search Implementation
 * Handles intelligent query parsing and filtering for hotel/room search
 */

// Known room types for extraction
const ROOM_TYPES = [
  'suite', 'suites',
  'deluxe', 'superior', 'standard', 'executive',
  'king', 'queen', 'double', 'twin', 'single',
  'penthouse', 'studio', 'apartment',
  'family', 'connecting'
]

// Known location keywords (extend this list as needed)
const LOCATION_KEYWORDS = [
  'knightsbridge', 'mayfair', 'soho', 'covent garden',
  'westminster', 'kensington', 'chelsea', 'belgravia',
  'piccadilly', 'strand', 'bloomsbury', 'fitzrovia'
]

export interface ParsedQuery {
  originalQuery: string
  roomTypes: string[]
  locations: string[]
  remainingTerms: string[]
}

export interface SearchParams {
  q: string
  query_by: string
  filter_by?: string
  per_page?: number
  page?: number
  sort_by?: string
}

/**
 * Parse user query into structured components
 * Example: "knight suite" -> { roomTypes: ['suite'], locations: ['knightsbridge'], remainingTerms: [] }
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase().trim()
  const terms = lowerQuery.split(/\s+/)
  
  const roomTypes: string[] = []
  const locations: string[] = []
  const remainingTerms: string[] = []

  for (const term of terms) {
    let matched = false

    // Check for room type matches
    for (const roomType of ROOM_TYPES) {
      if (term.includes(roomType) || roomType.includes(term)) {
        roomTypes.push(roomType)
        matched = true
        break
      }
    }

    if (matched) continue

    // Check for location matches (including partial matches like "knight" -> "knightsbridge")
    for (const location of LOCATION_KEYWORDS) {
      if (location.includes(term) || term.includes(location)) {
        locations.push(location)
        matched = true
        break
      }
    }

    if (!matched) {
      remainingTerms.push(term)
    }
  }

  return {
    originalQuery: query,
    roomTypes: [...new Set(roomTypes)],
    locations: [...new Set(locations)],
    remainingTerms
  }
}

/**
 * Build filter_by string with AND logic
 */
function buildFilterString(parsed: ParsedQuery): string {
  const filters: string[] = []

  // Add room type filters
  if (parsed.roomTypes.length > 0) {
    const roomTypeFilters = parsed.roomTypes.map(rt => `room_type:=${rt}`)
    if (roomTypeFilters.length === 1) {
      filters.push(roomTypeFilters[0])
    } else {
      // Multiple room types use OR within room types
      filters.push(`(${roomTypeFilters.join(' || ')})`)
    }
  }

  // Add location filters (neighborhood or city)
  if (parsed.locations.length > 0) {
    const locationFilters = parsed.locations.map(loc => 
      `(neighborhood:=${loc} || city:=${loc})`
    )
    if (locationFilters.length === 1) {
      filters.push(locationFilters[0])
    } else {
      filters.push(`(${locationFilters.join(' || ')})`)
    }
  }

  // Combine all filters with AND logic
  return filters.join(' && ')
}

/**
 * Search hotels with AND logic
 */
export async function searchHotels(
  client: Client,
  query: string,
  options: {
    page?: number
    perPage?: number
    sortBy?: string
  } = {}
): Promise<any> {
  const parsed = parseSearchQuery(query)
  
  const searchParams: SearchParams = {
    q: query,
    query_by: 'name,description,neighborhood,city,amenities,unique_selling_points',
    per_page: options.perPage || 20,
    page: options.page || 1
  }

  // Add filters if we detected structured terms
  const filterString = buildFilterString(parsed)
  if (filterString) {
    searchParams.filter_by = filterString
  }

  // Add sorting
  if (options.sortBy) {
    searchParams.sort_by = options.sortBy
  }

  logger.info('🔍 Searching hotels with AND logic', {
    service: 'typesense-search',
    originalQuery: query,
    parsed,
    filterString
  })

  try {
    const results = await client
      .collections('hotels')
      .documents()
      .search(searchParams)

    return results
  } catch (error) {
    logger.error('Hotel search failed', error as Error, {
      service: 'typesense-search',
      query
    })
    throw error
  }
}

/**
 * Search rooms with AND logic
 */
export async function searchRooms(
  client: Client,
  query: string,
  options: {
    hotelId?: string
    page?: number
    perPage?: number
    sortBy?: string
    maxOccupancy?: number
  } = {}
): Promise<any> {
  const parsed = parseSearchQuery(query)
  
  const searchParams: SearchParams = {
    q: query,
    query_by: 'room_name,room_type,description,amenities,tags,ideal_for,hotel_name,city',
    per_page: options.perPage || 20,
    page: options.page || 1
  }

  // Build filters
  const filters: string[] = []
  
  // Add parsed filters
  const parsedFilter = buildFilterString(parsed)
  if (parsedFilter) {
    filters.push(`(${parsedFilter})`)
  }

  // Add hotel_id filter if specified
  if (options.hotelId) {
    filters.push(`hotel_id:=${options.hotelId}`)
  }

  // Add occupancy filter if specified
  if (options.maxOccupancy) {
    filters.push(`total_max_occupancy:>=${options.maxOccupancy}`)
  }

  // Combine all filters with AND
  if (filters.length > 0) {
    searchParams.filter_by = filters.join(' && ')
  }

  // Add sorting
  if (options.sortBy) {
    searchParams.sort_by = options.sortBy
  }

  logger.info('🔍 Searching rooms with AND logic', {
    service: 'typesense-search',
    originalQuery: query,
    parsed,
    filterString: searchParams.filter_by
  })

  try {
    const results = await client
      .collections('rooms')
      .documents()
      .search(searchParams)

    return results
  } catch (error) {
    logger.error('Room search failed', error as Error, {
      service: 'typesense-search',
      query
    })
    throw error
  }
}

/**
 * Combined search: Search both hotels and rooms
 */
export async function searchHotelsAndRooms(
  client: Client,
  query: string,
  options: {
    page?: number
    perPage?: number
  } = {}
): Promise<{
  hotels: any
  rooms: any
  parsed: ParsedQuery
}> {
  const parsed = parseSearchQuery(query)

  const [hotelResults, roomResults] = await Promise.all([
    searchHotels(client, query, options),
    searchRooms(client, query, options)
  ])

  return {
    hotels: hotelResults,
    rooms: roomResults,
    parsed
  }
}
