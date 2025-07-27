import { defineEventHandler, readBody, sendError, createError } from 'h3'
import { AIQueueMessage } from '../utils/ai-service/types/aiQueueTypes'
import { WorkflowContext } from '../utils/shared/workflowTracker'
import { sendPostmanMessage } from '../utils/shared/serviceBus'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Basic validation
    // No prompt required for find-location; prompt is built in handler
    if (!body?.workflow || typeof body.workflow !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing workflow context' }))
    }
    if (!body?.responseHandler || typeof body.responseHandler !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Missing response handler' }))
    }

    // Send a postman message of type 'find-location' to the postman queue
    await sendPostmanMessage({
      type: 'find-location',
      context: body.workflow as WorkflowContext,
      payload: {
        responseHandler: body.responseHandler,
        options: body.options,
        meta: body.meta
      }
    })

    return { status: 'queued', message: 'find-location request accepted for processing (via postman)' }
  } catch (err: any) {
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Internal error' }))
  }
})
