import { defineEventHandler, createError, readBody } from 'h3'
import { serviceBus } from '../utils/shared'
import { WorkflowTracker, WorkflowStage } from '../utils/shared'
import { logger } from '../utils/shared'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { locationId, locationName, countryCode, queries, action } = body

    if (!locationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'locationId is required'
      })
    }

    switch (action) {
      case 'start_batch':
        return await startWorkflowBatch(locationId, locationName, countryCode, queries)
      
      case 'simulate_item':
        return await simulateItemFound(locationId, body.itemUrl, body.itemType, locationName, countryCode)
      
      default:
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid action. Use: start_batch, simulate_item'
        })
    }

  } catch (error) {
    logger.error('Workflow API error', error as Error, { service: 'workflow-api' })
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal workflow error'
    })
  }
})

async function startWorkflowBatch(locationId: string, locationName?: string, countryCode?: string, queries?: string[]) {
  // Create new workflow context
  const context = WorkflowTracker.createBatch(locationId, locationName, countryCode, queries)
  
  // Send message to postman
  const sender = serviceBus.createQueueSender()
  await sender.sendMessages({
    body: {
      type: 'new_batch',
      context,
      payload: { locationId, locationName, countryCode, queries }
    },
    contentType: 'application/json',
    messageId: context.batchId
  })
  await sender.close()

  logger.info(`📬 Workflow batch message sent to postman`, {
    service: 'workflow-api',
    batchId: context.batchId,
    locationId,
    countryCode
  })

  return {
    status: 'success',
    message: 'Workflow batch started',
    batchId: context.batchId,
    locationId,
    locationName,
    countryCode,
    queries,
    timestamp: new Date().toISOString()
  }
}

async function simulateItemFound(locationId: string, itemUrl: string, itemType: string, locationName?: string, countryCode?: string) {
  if (!itemUrl || !itemType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'itemUrl and itemType are required for simulation'
    })
  }

  // Create a mock batch context (in real workflow, this would come from existing batch)
  const context = WorkflowTracker.createBatch(locationId, locationName, countryCode)
  const progressedContext = WorkflowTracker.progressToStage(context, WorkflowStage.CRAWL_MEDIA)

  // Send item found message to postman
  const sender = serviceBus.createQueueSender()
  await sender.sendMessages({
    body: {
      type: 'item_found',
      context: progressedContext,
      payload: { itemUrl, itemType }
    },
    contentType: 'application/json',
    messageId: `${context.batchId}_item_${Date.now()}`
  })
  await sender.close()

  logger.info(`📱 Item found message sent to postman`, {
    service: 'workflow-api',
    batchId: context.batchId,
    itemUrl: itemUrl.substring(0, 100),
    itemType
  })

  return {
    status: 'success',
    message: 'Item found simulation sent',
    batchId: context.batchId,
    itemUrl,
    itemType,
    timestamp: new Date().toISOString()
  }
}
