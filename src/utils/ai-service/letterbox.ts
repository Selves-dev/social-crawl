import type { PostOfficeMessage } from '../shared/types';
import { aiServiceQueue } from './throttleQueue';
import { sendToPostOffice } from '../shared/postOffice/postman';
import { handleTextImageRequest, handleTextRequest } from './handlers/handleModelRequest';
import { handleSearchRequest } from './handlers/handleSearchRequest';
import { logger } from '../shared/logger';


// Function for PostOffice to deliver a message to the intray (enqueue to queue)
export const aiServiceLetterbox: (message: PostOfficeMessage) => Promise<void> = async (message) => {
  const { util, type, workflow, payload } = message;
  logger.debug('[aiServiceLetterbox] Called with message', { util, type, workflow, payload });
  if (!workflow) {
    logger.error('[aiServiceLetterbox] Missing workflow context');
    throw new Error('[aiServiceLetterbox] Missing workflow context');
  }
  // Enqueue the message to aiServiceQueue
  await aiServiceQueue.sendJob(message);
  logger.debug('[aiServiceLetterbox] Message enqueued to aiServiceQueue', { type });
}

// Register the intray as the queue subscriber
export function startAIServiceIntray() {
  logger.debug('[StartAIServiceIntray] Registering queue subscriber for aiServiceQueue');
  aiServiceQueue.subscribe(async (message: PostOfficeMessage) => {
    logger.debug('[AI-Service-Intray] Received message from queue', { type: message.type, workflow: message.workflow, payload: message.payload });
    const { type, workflow, payload } = message;
    if (!workflow) {
      logger.error('[AI-Service-Intray] Missing workflow context');
      throw new Error('[AI-Service-Intray] Missing workflow context');
    }
    let result;
    switch (type) {
      case 'text':
        logger.debug('[AI-Service-Intray] Routing to handleTextRequest');
        result = await handleTextRequest(message);
        break;
      case 'text-image':
        logger.debug('[AI-Service-Intray] Routing to handleTextImageRequest');
        result = await handleTextImageRequest(message);
        break;
      case 'search':
        logger.info('[AI-Service-Intray] Routing to handleSearchRequest');
        result = await handleSearchRequest(message);
        break;
      default:
        logger.warn('[ai-service] Unknown message type', { type: message.type, payload: message.payload });
        result = { error: true, message: 'Unknown message type' };
    }
    // Send response back to PostOffice using responseHandler pattern
    try {
      const responseHandler = payload?.responseHandler;
      if (!responseHandler || !responseHandler.util || !responseHandler.type) {
        throw new Error('Missing responseHandler in payload');
      }
      await sendToPostOffice({
        util: responseHandler.util,
        type: responseHandler.type,
        apiSecret: process.env['taash-secret'],
        workflow,
        payload: {
          request: message,
          result
        }
      });
      logger.info('[AI-Service-Intray] Response sent to PostOffice');
      logger.debug('[AI-Service-Intray] Response sent to PostOffice', { workflow, result });
    } catch (err) {
      logger.error('[AI-Service-Intray] Failed to send response to PostOffice', err as Error, { workflow, result });
    }
  });
}
