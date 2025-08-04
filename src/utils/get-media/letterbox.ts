
import type { PostOfficeMessage } from '../shared/types';
import { logger } from '../shared/logger';
import { handleSearchList } from './handlers/handleSearchList';
import { handleGetMedia } from './handlers/handleGetMedia';
import { getMediaQueue } from './throttleQueue';


// Function for PostOffice to deliver a message to the letterbox (enqueue to queue)
export const getMediaLetterbox: (message: PostOfficeMessage) => Promise<void> = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;
  logger.debug('[getMediaLetterbox] Called with message', { util, type, workflow, payload });
  if (!workflow) {
    logger.error('[getMediaLetterbox] Missing workflow context');
    throw new Error('[getMediaLetterbox] Missing workflow context');
  }
  // Enqueue the message to getMediaQueue
  await getMediaQueue.sendJob(message);
  logger.debug('[getMediaLetterbox] Message enqueued to getMediaQueue', { type });
}

// Register the letterbox as the queue subscriber
export function startGetMediaIntray() {
  logger.debug('[StartGetMediaIntray] Registering queue subscriber for getMediaQueue');
  getMediaQueue.subscribe(async (message: PostOfficeMessage) => {
    logger.info('[Get-Media-Intray] Received message from queue', { type: message.type, workflow: message.workflow, payload: message.payload });
    const { type, workflow } = message;
    if (!workflow) {
      logger.error('[Get-Media-Intray] Missing workflow context');
      throw new Error('[Get-Media-Intray] Missing workflow context');
    }
    switch (type) {
      case 'search-list':
        logger.info('[Get-Media-Intray] Routing to handleSearchList');
        await handleSearchList(message);
        break;
      case 'get-media':
        logger.info('[Get-Media-Intray] Routing to handleGetMedia');
        await handleGetMedia(message);
        break;
      default:
        logger.warn('[get-media] Unknown message type', { type: message.type, payload: message.payload });
    }
  });
}
