import { handleLocationRequest, handleLocationResponse } from './handlers/handleFindLocation'
import { logger } from '../shared/logger'

/**
 * General letterbox entry point for all find-location messages.
 * Postman should call this with the message and context.
 */
export async function letterbox(message: any, context: any) {
  switch (message.type) {
    case 'find-location-request':
      return handleLocationRequest(context);
    case 'find-location-response':
      return handleLocationResponse(message, context);
    default:
      logger.warn(`[Location-Finder] Unknown message type: ${message.type}`, { message, context });
      return { error: 'Unknown message type', type: message.type };
  }
}
