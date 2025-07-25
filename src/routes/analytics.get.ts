import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuth } from '../middleware/auth'
import { WorkflowDatabase } from '../utils/shared/workflowDatabase'

export default defineEventHandler(async (event) => {
  // Require authentication for analytics
  await requireAuth(event)
  
  const query = getQuery(event)
  const { locationId } = query
  
  if (!locationId || typeof locationId !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'locationId query parameter is required'
    })
  }

  try {
    // Get analytics for the location
    const analytics = await WorkflowDatabase.getLocationAnalytics(locationId)
    
    if (!analytics) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Location not found or no data available'
      })
    }

    return {
      status: 'success',
      data: analytics,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve analytics'
    })
  }
})
