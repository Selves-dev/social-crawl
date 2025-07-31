import type { LetterboxHandler } from '../shared/letterboxTypes';
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
import { handleTextImageRequest, handleTextRequest } from './handlers/handleModelRequest'

import { logger } from '../shared/logger'
export const letterbox: LetterboxHandler = async (message) => {
  logger.info('[letterbox] Routing by message.type', { type: message.type });
  logger.info('[letterbox] message.mediaUrl:', { mediaUrl: message.mediaUrl });
  logger.info('[letterbox] message.payload.mediaUrl:', { mediaUrl: message?.payload?.mediaUrl });
  if (!message.workflow) {
    logger.error('[ai-service letterbox] Missing workflow context in message');
    throw new Error('[ai-service letterbox] Missing workflow context in message');
  }
  let aiResult;
  switch (message.type) {
    case 'text':
      message.modelType = 'text';
      aiResult = await handleTextRequest(message);
      break;
    case 'text-image':
      message.modelType = 'text-image';
      aiResult = await handleTextImageRequest(message);
      break;
    case 'text-audio':
      message.modelType = 'text-audio';
      aiResult = await handleTextRequest(message);
      break;
    default:
      aiResult = await handleTextRequest(message);
      break;
  }

  if (message.responseHandler && message.responseHandler.util && message.responseHandler.type) {
    await sendPostmanMessage({
      util: message.responseHandler.util,
      context: message.workflow,
      payload: {
        type: message.responseHandler.type,
        ...aiResult
      }
    });
  } else {
    logger.warn('[AI-Service] No valid responseHandler specified in ai_request', { message, workflow: message.workflow });
  }
  return { status: 'ai-request-processed', aiResult };
}
