import type { LetterboxHandler } from '../shared/letterboxTypes';
import { analyseMediaQueue } from './throttleQueue';
import { logger } from '../shared/logger';
import { handleVenueBasics } from './handlers/handleVenueBasics';

/**
 * Analyse-Media Letterbox - Internal Office Mail Handler
 * 
 * Receives analysis requests from PostOffice and puts them in internal office trays.
 * Some messages go to internal throttle queues, others are handled directly.
 */
const analyseMediaLetterbox: LetterboxHandler = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;
  
  if (!workflow) {
    logger.error('[analyse-media letterbox] Missing workflow context in message');
    throw new Error('[analyse-media letterbox] Missing workflow context in message');
  }

  switch (type) {
    case 'analyse_media':
    case 'anayse_media': // Keep typo for backward compatibility
    default:
      // Queue the job to internal office tray (throttle queue)
      const job = {
        id: `analyse_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        workflow: workflow,
        blobUrl: payload.blobUrl,
        mediaUrl: payload.mediaUrl,
        type: 'analyse_media'
      };
      
      await analyseMediaQueue.sendJob(job);
      
      return { status: 'analyse-media-job-queued' };
      
    case 'venue_basics':
      return await handleVenueBasics({ util, type, workflow, payload });
      
    case 'ai_response':
      return await import('./handlers/handleAnalysisResponse').then(mod => 
        mod.handleAnalysisResponse({ util, type, workflow, payload })
      );
      
    case 'ai_SearchResponse':
      return await import('./handlers/handleVenueResponse').then(mod => 
        mod.handleVenueResponse({ util, type, workflow, payload })
      );
  }
};

export { analyseMediaLetterbox };