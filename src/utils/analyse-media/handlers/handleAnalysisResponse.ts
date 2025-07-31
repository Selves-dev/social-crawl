import { logger } from '../../shared/logger';
import { savePerspective } from '../../shared/perspective';

export async function handleAnalysisResponse(message: any) {
  logger.info('[handleAnalysisResponse] Received AI response', { response: message });
  // Parse the AI response JSON
  let aiResult;
  if (typeof message?.response?.text === 'string') {
    try {
      aiResult = JSON.parse(message.response.text);
    } catch (err) {
      logger.error('Failed to parse AI response text as JSON', err as Error);
      return message;
    }
  } else {
    aiResult = message?.response;
  }

  // Extract workflow context
  const workflow = message.workflow || {};
  // Build perspective object
  const perspective = {
    ...aiResult,
    audioDescription: [],
    l: workflow.l || aiResult?.context?.l || '',
    cc: workflow.cc || aiResult?.context?.cc || '',
    w: workflow.w || aiResult?.context?.w || '',
  };
  await savePerspective(perspective);
  return perspective;
}
