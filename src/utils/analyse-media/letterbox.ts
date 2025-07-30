// Letterbox for analyse-media jobs

import { logger } from '../shared/logger';
import { sendPostmanMessage } from '../shared/serviceBus';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';

export async function letterbox(message: any) {
  logger.info('[analyse-media letterbox] Entry', { message });
  if (!message) {
    logger.error('[analyse-media letterbox] Message is undefined or null');
    return { error: 'Message is undefined or null' };
  }
  if (!('type' in message)) {
    logger.error('[analyse-media letterbox] Message missing type property: ' + JSON.stringify(message));
    return { error: 'Message missing type property', message };
  }
  if (!message.workflow) {
    throw new Error('[analyse-media letterbox] Missing workflow context in message');
  }
  switch (message.type) {
    case 'analyse-media': {
      const analyseResult = await handleAnalyseMedia(message);
      // Optionally route to next handler or send postman message here
      logger.info('analyseMediaLetterbox: Job processed', { message, analyseResult });
      return analyseResult;
    }
    default:
      logger.warn(`[analyse-media] Unknown message type: ${message.type}`, { message });
      return { error: 'Unknown message type', message };
  }
}
