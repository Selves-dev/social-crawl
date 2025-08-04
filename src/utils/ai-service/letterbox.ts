import type { LetterboxHandler } from '../shared/letterboxTypes';
import { sendToPostOffice } from '../shared/postOffice/postman';
import { handleTextImageRequest, handleTextRequest } from './handlers/handleModelRequest'
import { handleSearchRequest } from './handlers/handleSearchRequest'
import { logger } from '../shared/logger'

/**
 * AI-Service Letterbox - Internal Office Mail Handler
 * 
 * Receives AI requests from PostOffice and handles internal processing.
 * Processes AI requests and sends responses back through the postal system.
 */
const aiServiceLetterbox: LetterboxHandler = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload, responseHandler } = message;
  
  if (!workflow) {
    logger.error('[ai-service letterbox] Missing workflow context in message');
    throw new Error('[ai-service letterbox] Missing workflow context in message');
  }

  let aiResult;
  switch (type) {
    case 'text':
      payload.modelType = 'text';
      aiResult = await handleTextRequest(payload);
      break;
    case 'text-image':
      payload.modelType = 'text-image';
      aiResult = await handleTextImageRequest(payload);
      break;
    case 'search':
      payload.modelType = 'search';
      aiResult = await handleSearchRequest(payload);
      break;
    default:
      aiResult = await handleTextRequest(payload);
      break;
  }

  logger.info('[ai-service letterbox] AI handler result', { aiResult });

  if (responseHandler && responseHandler.util && responseHandler.type) {
    await sendToPostOffice({
      util: responseHandler.util,
      type: responseHandler.type,
      workflow,
      payload: {
        response: aiResult
      }
    });
  } else {
    logger.warn('[ai-service letterbox] No valid responseHandler specified', { workflow });
  }

  return { status: 'ai-request-processed', aiResult };
}

export { aiServiceLetterbox };