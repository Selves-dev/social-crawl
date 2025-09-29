import { handleFindInfo } from './handlers/handleFindInfo';
import { handleInfoData } from './handlers/handleInfoData';
import { logger } from '../shared/logger';

const findInfoLetterbox = async (message: any) => {
  // Expect standardized shape: { util, type, workflow, payload }
  const { util, type, workflow, payload } = message;

  if (!workflow) {
    logger.error('[find-info letterbox] Missing workflow context');
    throw new Error('[find-info letterbox] Missing workflow context');
  }

  switch (type) {
    case 'find-info-request': {
      const result = await handleFindInfo(workflow);
      return result;
    }
    case 'find-info-response': {
      // Call handleInfoData as the response handler (to be implemented)
      return handleInfoData(payload, workflow);
    }
    default:
      logger.warn(`[find-info letterbox] Unknown message type: ${type}`);
      return { error: 'Unknown message type', type };
  }
}

export { findInfoLetterbox };
