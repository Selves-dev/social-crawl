import { QueueManager } from '../index'
/**
 * Ensures the AI service queue is started before enqueueing a request.
 */
export async function ensureAIServiceQueueRunning() {
  await QueueManager.startAIServiceProcessing()
}

/**
 * Attempts to stop the AI service queue if it is empty, with a small delay to avoid rapid cycling.
 * You should call this after processing a job.
 */
export async function shutdownAIServiceQueueIfIdle(checkIsEmpty: () => Promise<boolean>, delayMs = 2000) {
  setTimeout(async () => {
    if (await checkIsEmpty()) {
      await QueueManager.stopAIServiceProcessing()
    }
  }, delayMs)
}
import { sendPostmanMessage } from '../shared/serviceBus'


import { handleModelRequest } from './handlers/handleModelRequest'

/**
 * General letterbox entry point for all ai-service messages.
 * Postman should call this with the message and context.
 */
import { logger } from '../shared/logger'
export async function letterbox(message: any, context: any) {
  switch (message.type) {
    case 'ai_request': {
      logger.info('[AI-Service] Received ai_request', { message, context, timestamp: new Date().toISOString() });
      // Pass message as-is; handleModelRequest will determine modelType
      const aiResult = await handleModelRequest(message, context);
      if (message.responseHandler && message.responseHandler.util && message.responseHandler.type) {
        await sendPostmanMessage({
          util: message.responseHandler.util,
          context,
          payload: {
            type: message.responseHandler.type,
            ...aiResult
          }
        });
        logger.info('[AI-Service] Sent AI response to response handler', {
          to: message.responseHandler,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('[AI-Service] No valid responseHandler specified in ai_request', { message, context });
      }
      return { status: 'ai-request-processed', aiResult };
    }
    default:
      logger.warn(`[AI-Service] Unknown message type: ${message.type}`, { message, context });
      return { error: 'Unknown message type', type: message.type };
  }
}
