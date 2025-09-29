
import { defineEventHandler, readBody, sendError, createError } from 'h3';
import { requireAuth } from '../middleware/auth';
import { WorkflowContext, WorkflowStage } from '../utils/ai-service/types/types';
import { sendToPostOffice } from '../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  try {
    const body = await readBody(event)
    // Build workflow context
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2,8)}`;
    const workflow: WorkflowContext = {
      batchId,
      locationId: body.locationId || '',
      locationName: body.locationName,
      countryCode: body.countryCode,
      stage: WorkflowStage.FIND_LOCATION,
      timestamp: new Date().toISOString(),
      completedStages: [],
    };
    await sendToPostOffice({
      util: 'find-location',
      type: 'find-location-request',
      workflow,
      payload: {},
      apiSecret: process.env['taash-secret']
    })

    return { status: 'queued', message: 'find-location request accepted for processing (via postman)' }
  } catch (err: any) {
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Internal error' }))
  }
})
