import type { PostOfficeMessage } from '../shared/types';
import { handleSearch } from './handlers/handleSearch';
import { handleGetMedia } from './handlers/handleGetMedia';
import { getVenueMediaQueue } from './throttleQueue';

// Letterbox for get-venue-media
// To be implemented


export const getVenueMediaLetterbox = async (message: PostOfficeMessage) => {
  const { type } = message;
  switch (type) {
    case 'search':
      return handleSearch(message);
    case 'get-media':
      // Enqueue the job for throttled processing
      await getVenueMediaQueue.sendJob(message);
      return;
    default:
      throw new Error(`[get-venue-media:letterbox] Unknown message type: ${type}`);
  }
};
