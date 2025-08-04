import type { PostOfficeMessage } from '../shared/types';
import { logger } from '../shared/logger';
import { handleSearchList } from './handlers/handleSearchList';
import { handleGetMedia } from './handlers/handleGetMedia';

// Letterbox routes message to correct handler
export async function getMediaLetterbox(message: PostOfficeMessage): Promise<void> {

  const { util, type, workflow, payload } = message;

  if (!workflow) {
    logger.error('[find-location letterbox] Missing workflow context');
    throw new Error('[find-location letterbox] Missing workflow context');
  }

  switch (message.type) {
    case 'search-list':
      await handleSearchList(message);
      break;
    case 'get-media':
      await handleGetMedia(message);
      break;
    default:
      logger.warn('[get-media] Unknown message type', { type: message.type, payload: message.payload });
  }
}
