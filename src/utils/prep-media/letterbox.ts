import type { LetterboxHandler } from '../shared/letterboxTypes';

import { QueueManager } from '../index';
import { handlePrepareMedia } from './handlers/handlePrepareMedia';
import { logger } from '../shared/logger';
import { sendPostmanMessage } from '../shared/serviceBus';

/**
 * Ensures the prep-media queue is started before enqueueing a request.
 */
export async function ensurePrepMediaQueueRunning() {
  await QueueManager.startPrepMediaProcessing();
}

/**
 * Attempts to stop the prep-media queue if it is empty, with a small delay to avoid rapid cycling.
 * You should call this after processing a job.
 */
export async function shutdownPrepMediaQueueIfIdle(checkIsEmpty: () => Promise<boolean>, delayMs = 2000) {
  setTimeout(async () => {
    if (await checkIsEmpty()) {
      await QueueManager.stopPrepMediaProcessing();
    }
  }, delayMs);
}
export const letterbox: LetterboxHandler = async (message) => {
  if (!message) {
    logger.error('[prep-media letterbox] Message is undefined or null');
    return { error: 'Message is undefined or null' };
  }
  if (!message.workflow) {
    throw new Error('[prep-media letterbox] Missing workflow context in message');
  }
  // Always process as prep-media job
  const prepResult = await handlePrepareMedia(message);
  // Optionally route to next handler or send postman message here
  // Example: sendPostmanMessage({ util: 'next-util', payload: { ... } });
  return { status: 'prep-media-processed', prepResult };
}
letterbox.initializeQueue = async () => {
  await QueueManager.startPrepMediaProcessing();
};

letterbox.shutdownQueue = async () => {
  await QueueManager.stopPrepMediaProcessing();
};
