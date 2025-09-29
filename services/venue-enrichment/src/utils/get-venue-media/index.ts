import { getVenueMediaQueue } from './throttleQueue';
import { handleGetMedia } from './handlers/handleGetMedia';
import { logger } from '../shared/logger';
import type { PostOfficeMessage } from '../shared/types';

export function startGetVenueMediaIntray() {
  logger.debug('[StartGetVenueMediaIntray] Registering queue subscriber for getVenueMediaQueue');
  getVenueMediaQueue.subscribe(async (message: PostOfficeMessage) => {
    logger.info('[Get-Venue-Media-Intray] Received message from queue', { type: message.type, workflow: message.workflow, payload: message.payload });
    const { type, workflow } = message;
    if (!workflow) {
      logger.error('[Get-Venue-Media-Intray] Missing workflow context');
      throw new Error('[Get-Venue-Media-Intray] Missing workflow context');
    }
    switch (type) {
      case 'get-media':
        logger.info('[Get-Venue-Media-Intray] Routing to handleGetMedia');
        await handleGetMedia(message);
        break;
      default:
        logger.warn('[get-venue-media] Unknown message type', { type: message.type, payload: message.payload });
    }
  });
}