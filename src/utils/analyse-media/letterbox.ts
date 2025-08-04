import type { PostOfficeMessage } from '../shared/types';
import { logger } from '../shared/logger';
import { analyseMediaQueue } from './throttleQueue';
import { handleVenueBasics } from './handlers/handleVenueBasics';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';

// Function for PostOffice to deliver a message to the intray (enqueue to queue)
export const analyseMediaLetterbox: (message: PostOfficeMessage) => Promise<void> = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;
  logger.debug('[analyseMediaLetterbox] Called with message', { util, type, workflow, payload });
  if (!workflow) {
    logger.error('[analyseMediaLetterbox] Missing workflow context');
    throw new Error('[analyseMediaLetterbox] Missing workflow context');
  }
  // Enqueue the message to analyseMediaQueue
  await analyseMediaQueue.sendJob(message);
  logger.debug('[analyseMediaLetterbox] Message enqueued to analyseMediaQueue', { type });
}

// Register the intray as the queue subscriber
export function startAnalyseMediaIntray() {
  logger.debug('[StartAnalyseMediaIntray] Registering queue subscriber for analyseMediaQueue');
  analyseMediaQueue.subscribe(async (message: PostOfficeMessage) => {
    logger.info('[Analyse-Media-Intray] Received message from queue', { type: message.type, workflow: message.workflow, payload: message.payload });
    const { type, workflow } = message;
    if (!workflow) {
      logger.error('[Analyse-Media-Intray] Missing workflow context');
      throw new Error('[Analyse-Media-Intray] Missing workflow context');
    }
    switch (type) {
      case 'analyse_media': {
        logger.info('[Analyse-Media-Intray] Routing to handleAnalyseMedia');
        await handleAnalyseMedia(message);
        break;
      }
      case 'venue_basics':
        logger.info('[Analyse-Media-Intray] Routing to handleVenueBasics');
        await handleVenueBasics(message);
        break;
      default:
        logger.warn('[analyse-media] Unknown message type', { type: message.type, payload: message.payload });
    }
  });
}