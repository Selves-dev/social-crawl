import type { PostOfficeMessage } from '../shared/types';
import { logger } from '../shared/logger';
import { prepMediaQueue } from './throttleQueue';
import { handlePrepareMedia } from './handlers/handlePrepareMedia';

// Function for PostOffice to deliver a message to the intray (enqueue to queue)
export const prepMediaLetterbox: (message: PostOfficeMessage) => Promise<void> = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;
  logger.debug('[prepMediaLetterbox] Called with message', { util, type, workflow, payload });
  if (!workflow) {
    logger.error('[prepMediaLetterbox] Missing workflow context');
    throw new Error('[prepMediaLetterbox] Missing workflow context');
  }
  // Enqueue the message to prepMediaQueue
  await prepMediaQueue.sendJob(message);
  logger.debug('[prepMediaLetterbox] Message enqueued to prepMediaQueue', { type });
}

// Register the intray as the queue subscriber
export function startPrepMediaIntray() {
  logger.debug('[StartPrepMediaIntray] Registering queue subscriber for prepMediaQueue');
  prepMediaQueue.subscribe(async (message: PostOfficeMessage) => {
    logger.info('[Prep-Media-Intray] Received message from queue', { type: message.type, workflow: message.workflow, payload: message.payload });
    const { type, workflow } = message;
    if (!workflow) {
      logger.error('[Prep-Media-Intray] Missing workflow context');
      throw new Error('[Prep-Media-Intray] Missing workflow context');
    }
    switch (type) {
      case 'prepare-media':
        logger.info('[Prep-Media-Intray] Routing to handlePrepareMedia');
        await handlePrepareMedia(message);
        break;
      default:
        logger.warn('[prep-media] Unknown message type', { type: message.type, payload: message.payload });
    }
  });
}