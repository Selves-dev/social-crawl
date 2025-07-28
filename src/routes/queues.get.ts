// (removed, queue status is now handled by postman or not needed)
import { defineEventHandler, createError, getQuery } from 'h3'
import { QueueManager, logger } from '../utils/shared'
import { requireAuth } from '../middleware/auth'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication for queue management
    await requireAuth(event)
    
    const query = getQuery(event)
    const action = query.action as string
    const queue = query.queue as string

    logger.info(`Queue control request: ${action} ${queue || 'all'}`, { 
      service: 'queue-control',
      action,
      queue 
    })

    switch (action) {
      case 'start':
        if (queue === 'prep-media') {
          await QueueManager.startPrepMediaProcessing()
        } else if (queue === 'ai-service') {
          await QueueManager.startAIServiceProcessing()
        } else if (!queue || queue === 'all') {
          await QueueManager.startAllThrottleQueues()
        } else {
          throw createError({
            statusCode: 400,
            statusMessage: `Unknown queue: ${queue}`
          })
        }
        break

      case 'stop':
        if (queue === 'prep-media') {
          await QueueManager.stopPrepMediaProcessing()
        } else if (queue === 'ai-service') {
          await QueueManager.stopAIServiceProcessing()
        } else if (!queue || queue === 'all') {
          await QueueManager.stopAllThrottleQueues()
        } else {
          throw createError({
            statusCode: 400,
            statusMessage: `Unknown queue: ${queue}`
          })
        }
        break

      case 'status':
        return {
          status: 'success',
          queues: QueueManager.getQueueStatus(),
          timestamp: new Date().toISOString()
        }

      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid action. Use: start, stop, or status'
        })
    }

    return {
      status: 'success',
      action,
      queue: queue || 'all',
      message: `Queue ${action} completed`,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    logger.error('Queue control error', error as Error, { service: 'queue-control' })
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error // Re-throw HTTP errors
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal queue control error'
    })
  }
})
