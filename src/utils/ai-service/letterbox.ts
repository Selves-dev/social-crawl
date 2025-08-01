import type { LetterboxHandler } from '../shared/letterboxTypes';
import { QueueManager } from '../shared/index'
import { sendPostmanMessage } from '../shared/serviceBus'
import { handleTextImageRequest, handleTextRequest } from './handlers/handleModelRequest'
import { handleSearchRequest } from './handlers/handleSearchRequest'
import { logger } from '../shared/logger'

export const aiServiceLetterbox: LetterboxHandler = async (message) => {
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
    case 'search':
      message.modelType = 'search';
      aiResult = await handleSearchRequest(message);
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
        response: aiResult
      }
    });
  } else {
    logger.warn('[AI-Service] No valid responseHandler specified in ai_request', { message, workflow: message.workflow });
  }
  return { status: 'ai-request-processed', aiResult };
}


export async function ensureAIServiceQueueRunning() {
  await QueueManager.startAIServiceProcessing()
}

export async function shutdownAIServiceQueueIfIdle(checkIsEmpty: () => Promise<boolean>, delayMs = 2000) {
  setTimeout(async () => {
    if (await checkIsEmpty()) {
      await QueueManager.stopAIServiceProcessing()
    }
  }, delayMs)
}