import { defineEventHandler, getQuery, createError } from 'h3'
import { typesenseManager } from '../../../utils/shared/typesense'
import { searchHotelsAndRooms } from '../../../utils/shared/typesenseSearch'

/**
 * Combined Search Endpoint - Search both hotels and rooms
 * GET /api/search?q=knight+suite&page=1&per_page=20
 */
export default defineEventHandler(async (event) => {
  const client = typesenseManager.getClient()
  
  if (!client) {
    throw createError({
      statusCode: 503,
      message: 'Typesense search service is not available'
    })
  }

  const query = getQuery(event)
  const searchQuery = String(query.q || '')
  
  if (!searchQuery) {
    throw createError({
      statusCode: 400,
      message: 'Query parameter "q" is required'
    })
  }

  const page = parseInt(String(query.page || '1'), 10)
  const perPage = parseInt(String(query.per_page || '20'), 10)

  try {
    const results = await searchHotelsAndRooms(client, searchQuery, {
      page,
      perPage
    })

    return {
      success: true,
      query: searchQuery,
      parsed: results.parsed,
      hotels: {
        found: results.hotels.found,
        hits: results.hotels.hits,
        search_time_ms: results.hotels.search_time_ms
      },
      rooms: {
        found: results.rooms.found,
        hits: results.rooms.hits,
        search_time_ms: results.rooms.search_time_ms
      }
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Search failed',
      data: error
    })
  }
})
