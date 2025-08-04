import type { LetterboxHandler } from '../shared/types';
import { handleLocationRequest, handleLocationResponse } from './handlers/handleFindLocation'
import { logger } from '../shared/logger'


const findLocationLetterbox: LetterboxHandler = async (message) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;

  if (!workflow) {
    logger.error('[find-location letterbox] Missing workflow context');
    throw new Error('[find-location letterbox] Missing workflow context');
  }

  // Handle internal office routing - call appropriate handlers directly
  switch (type) {
    case 'find-location-request': {
      const result = await handleLocationRequest(workflow);
      return result;
    }
    case 'find-location-response': {
      const result = await handleLocationResponse(payload, workflow);
      return result;
    }
    default:
      logger.warn(`[find-location letterbox] Unknown message type: ${type}`);
      return { error: 'Unknown message type', type };
  }
}

export { findLocationLetterbox };