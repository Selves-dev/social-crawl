// Letterbox for analyse-media jobs

import { logger } from '../shared/logger';
import { sendPostmanMessage } from '../shared/serviceBus';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';

export async function letterbox(message: any) {
  // ...existing code...
  if (!message) {
    logger.error('[analyse-media letterbox] Message is undefined or null');
    return { error: 'Message is undefined or null' };
  }
  if (!message.workflow) {
    logger.error('[analyse-media letterbox] Missing workflow context in message');
    throw new Error('[analyse-media letterbox] Missing workflow context in message');
  }
  switch (message.type) {
    case 'ai_response': {
      const responseResult = await import('./handlers/handleAnalysisResponse').then(mod => mod.handleAnalysisResponse(message));
      return responseResult;
    }
    default: {
      const analyseResult = await handleAnalyseMedia(message);
      return analyseResult;
    }
  }
}
