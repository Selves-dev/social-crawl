import { defineEventHandler, getQuery, createError } from 'h3'
import { typesenseManager } from '../../../utils/shared/typesense'
import { searchHotels } from '../../../utils/shared/typesenseSearch'

/**
 * Search Hotels Endpoint
 * GET /api/search/hotels?q=knight+suite&page=1&per_page=20
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
  const sortBy = query.sort_by ? String(query.sort_by) : undefined

  try {
    const results = await searchHotels(client, searchQuery, {
      page,
      perPage,
      sortBy
    })

    return {
      success: true,
      query: searchQuery,
      results: {
        found: results.found,
        hits: results.hits,
        page: results.page,
        search_time_ms: results.search_time_ms
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
