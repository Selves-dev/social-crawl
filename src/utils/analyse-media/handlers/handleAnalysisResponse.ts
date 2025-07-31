import { logger } from '../../shared/logger';
import { savePerspective } from '../../shared/database';

export async function handleAnalysisResponse(message: any) {
  logger.info('[handleAnalysisResponse] Received AI response', { response: message.response });
  // Debug: log raw response text if present
  if (typeof message?.response?.text === 'string') {
    logger.info('[handleAnalysisResponse] Raw AI response text', { text: message.response.text });
  }

  let aiResult;
  if (message?.response && typeof message.response.text === 'string') {
    try {
      // **CRITICAL FIX:** Clean the string before parsing
      // Replace non-breaking spaces (U+00A0) with regular spaces and then trim
      const cleanedText = message.response.text.replace(/\u00A0/g, ' ').trim();
      aiResult = JSON.parse(cleanedText);
      // Unwrap nested aiResult if present
      if (aiResult && aiResult.aiResult) {
        aiResult = aiResult.aiResult;
      }
      logger.info('[handleAnalysisResponse] Parsed AI response (from text)', { aiResult });
    } catch (err) {
      logger.error('Failed to parse AI response text as JSON', err as Error);
      return message; // Return original message on parse failure
    }
  } else if (message?.response && typeof message.response === 'object' && Object.keys(message.response).length > 0) {
    aiResult = message.response;
    // Unwrap nested aiResult if present
    if (aiResult && aiResult.aiResult) {
      aiResult = aiResult.aiResult;
    }
    logger.info('[handleAnalysisResponse] Parsed AI response (object)', { aiResult });
  } else if (typeof message?.text === 'string') {
    try {
      // **CRITICAL FIX:** Clean the string before parsing for this case too
      const cleanedText = message.text.replace(/\u00A0/g, ' ').trim();
      aiResult = JSON.parse(cleanedText);
      // Unwrap nested aiResult if present
      if (aiResult && aiResult.aiResult) {
        aiResult = aiResult.aiResult;
      }
      logger.info('[handleAnalysisResponse] Parsed AI response (from top-level text)', { aiResult });
    } catch (err) {
      logger.error('Failed to parse top-level message.text as JSON', err as Error);
      return message; // Return original message on parse failure
    }
  } else {
    logger.error('AI response missing or invalid format', new Error(typeof message === 'string' ? message : JSON.stringify(message)));
    return message; // Return original message if format is invalid
  }

  // Build perspective object
  const { createdAt, updatedAt, ...rest } = aiResult;
  const contextObj = aiResult.context || {};
  const perspective = {
    ...rest,
    audioDescription: [],
    context: {
      l: contextObj.l ?? '',
      cc: contextObj.cc ?? '',
      w: contextObj.w ?? '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  logger.info('[handleAnalysisResponse] Final perspective object', { perspective });

  try {
    await savePerspective(perspective);
  } catch (err) {
    logger.error('Failed to save perspective to database', err as Error);
  }

  return perspective;
}