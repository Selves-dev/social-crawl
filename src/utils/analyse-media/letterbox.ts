import type { LetterboxHandler } from '../shared/letterboxTypes';
import { QueueManager } from '../shared/index';
// Letterbox for analyse-media jobs

import { logger } from '../shared/logger';
import { sendPostmanMessage } from '../shared/serviceBus';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';
import { handleVenueBasics } from './handlers/handleVenueBasics';
import { handleVenueResponse } from './handlers/handleVenueResponse';

export const analyseMediaLetterbox: LetterboxHandler = async (message) => {
  if (!message) {
    logger.error('[analyse-media letterbox] Message is undefined or null');
    return { error: 'Message is undefined or null' };
  }
  if (!message.workflow) {
    logger.error('[analyse-media letterbox] Missing workflow context in message');
    throw new Error('[analyse-media letterbox] Missing workflow context in message');
  }

  switch (message.type) {
    case 'anayse_media':
      return await handleAnalyseMedia(message);
    case 'venue_basics':
      return await handleVenueBasics(message);
    case 'ai_response':
      return await import('./handlers/handleAnalysisResponse').then(mod => mod.handleAnalysisResponse(message));
    case 'ai_SearchResponse':
      return await import('./handlers/handleVenueResponse').then(mod => mod.handleVenueResponse(message));
    default:
      return await handleAnalyseMedia(message);
  }
};

analyseMediaLetterbox.initializeQueue = async () => {
  await QueueManager.startAnalyseMediaProcessing();
};

analyseMediaLetterbox.shutdownQueue = async () => {
  await QueueManager.stopAnalyseMediaProcessing();
};
