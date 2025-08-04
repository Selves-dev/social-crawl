import type { LetterboxHandler } from '../shared/letterboxTypes';
import { handlePrepareMedia } from './handlers/handlePrepareMedia';
import { logger } from '../shared/logger';

/**
 * Prep-Media Letterbox - Internal Office Mail Handler
 * 
 * Receives prep requests from PostOffice and handles them within the office.
 * Directly processes preparation requests and returns results.
 */
const prepMediaLetterbox: LetterboxHandler = async (message) => {
  logger.info('[prep-media letterbox] Processing prep request in office', { message });
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;
  
  if (!workflow) {
    logger.error('[prep-media letterbox] Missing workflow context in message');
    throw new Error('[prep-media letterbox] Missing workflow context in message');
  }
  
  // Handle prep-media processing directly in the office
  const prepResult = await handlePrepareMedia({ util, type, workflow, payload });
  
  return { status: 'prep-media-processed', prepResult };
};

export { prepMediaLetterbox };