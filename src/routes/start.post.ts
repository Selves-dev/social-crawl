import { defineEventHandler, readBody, sendError, createError } from 'h3'
import { AIQueueMessage } from '../utils/ai-service/types/types'
import { WorkflowContext } from '../utils/shared/workflow'
import { sendToPostOffice } from '../utils/shared/postOffice/router'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Basic validation
    // No prompt required for find-location; prompt is built in handler
    // Always create workflow context from scratch
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2,8)}`;
    const { getSecurityManager } = await import('../utils/shared/security');
    const security = getSecurityManager();
    const messageSecurity = security.addMessageSecurity({ batchId, stage: 'find-location', timestamp: new Date().toISOString() });
    let workflow = {
      batchId,
      stage: 'find-location',
      timestamp: new Date().toISOString(),
      messageSecurity
    };
    // ...existing code...

    // Send a postman message with util and type at the top level for generic routing
    await sendToPostOffice({
      util: 'find-location',
      payload: {
        type: body.type || 'find-location-request',
        workflow,
        responseHandler: body.responseHandler,
        options: body.options,
        meta: body.meta
      }
    })
    console.info('[start.post] Sent postman message with workflow:', workflow);
    console.info('[start.post] batchId sent:', workflow?.batchId);

    return { status: 'queued', message: 'find-location request accepted for processing (via postman)' }
  } catch (err: any) {
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Internal error' }))
  }
})
