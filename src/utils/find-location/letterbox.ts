import type { LetterboxHandler } from '../shared/letterboxTypes';
import { handleLocationRequest, handleLocationResponse } from './handlers/handleFindLocation'
import { logger } from '../shared/logger'

/**
 * General letterbox entry point for all find-location messages.
 * Postman should call this with the message and context.
 */
export const letterbox: LetterboxHandler = async (message) => {
  console.info('[find-location.letterbox] Incoming message:', message);
  console.info('[find-location.letterbox] Workflow context:', message.workflow);
  console.info('[find-location.letterbox] batchId:', message.workflow?.batchId);
  if (message.type === 'find-location-request') {
    console.info('[find-location.letterbox] Passing workflow to handleLocationRequest:', message.workflow);
    console.info('[find-location.letterbox] batchId to handleLocationRequest:', message.workflow?.batchId);
    return handleLocationRequest(message.workflow);
  }
  const workflowContext = message.workflow;
  if (!workflowContext) {
    throw new Error('[find-location letterbox] Missing workflow context');
  }
  console.info('[find-location.letterbox] Passing workflow to handleLocationResponse:', workflowContext);
  console.info('[find-location.letterbox] batchId to handleLocationResponse:', workflowContext?.batchId);
  switch (message.type) {
    case 'find-location-response':
      return handleLocationResponse(message, workflowContext);
    default:
      logger.warn(`[Location-Finder] Unknown message type: ${message.type}`, { message });
      return { error: 'Unknown message type', type: message.type };
  }
}
