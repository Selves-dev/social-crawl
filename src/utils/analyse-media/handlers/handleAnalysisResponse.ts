import { logger } from '../../shared/logger';

export async function handleAnalysisResponse(message: any) {
  logger.info('[handleAnalysisResponse] Received AI response', { response: message });
  return message;
}
