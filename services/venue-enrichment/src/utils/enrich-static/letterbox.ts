import { handleEnrichStatic } from './handlers/handleEnrichStatic';
import { handleEnrichHotelResponse } from './handlers/handleEnrichHotelResponse';
import { handleResearchRoomResponse } from './handlers/handleResearchRoomResponse';
import { handleRankRoomResponse } from './handlers/handleRankRoomResponse';
import { handleEnrichRoomResponse } from './handlers/handleEnrichRoomResponse';
// Dummy letterbox for enrich-static, modeled after find-info

import { logger } from '../shared/logger';

const enrichStaticLetterbox = async (message: any) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;

  if (!workflow) {
    logger.error('[enrich-static letterbox] Missing workflow context');
    throw new Error('[enrich-static letterbox] Missing workflow context');
  }

  switch (type) {
    case 'enrich-static-request': {
      // Call the handler with the full message (so it can access payload.venue_id)
      const result = await handleEnrichStatic(message);
      return result;
    }
    case 'enrich-static-ai-hotel-response': {
      // Handle the AI hotel enrichment response
      const result = await handleEnrichHotelResponse(message);
      return result;
    }
    case 'enrich-static-ai-research-room-response': {
      // Handle the AI room research response (facts gathering)
      const result = await handleResearchRoomResponse(message);
      return result;
    }
    case 'enrich-static-ai-rank-room-response': {
      // Handle the AI room ranking response (hierarchy establishment)
      const result = await handleRankRoomResponse(message);
      return result;
    }
    case 'enrich-static-ai-enrich-room-response': {
      // Handle the AI room enrichment response (final structuring and upsert)
      const result = await handleEnrichRoomResponse(message);
      return result;
    }
    default:
      logger.warn(`[enrich-static letterbox] Unknown message type: ${type}`);
      return { error: 'Unknown message type', type };
  }
}

export { enrichStaticLetterbox };




