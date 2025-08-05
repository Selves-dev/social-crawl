import { logger } from '../../shared/logger';
import { addQueryToPerspective, savePerspectiveFull, upsertPerspectiveSmartly } from '../../shared/dbStore';

export async function handleAnalysisResponse(message: any) {
  // Support message.payload.result as the primary AI response location
  const response = message?.payload?.result ?? message?.result ?? message?.payload?.response ?? message?.response;
  logger.debug('[handleAnalysisResponse] Received AI response', { response });
  // Debug: log raw response text if present
  if (typeof response?.text === 'string') {
    logger.debug('[handleAnalysisResponse] Raw AI response text', { text: response.text });
  }

  let aiResult;
  if (response && typeof response.text === 'string') {
    try {
      // Replace non-breaking spaces (U+00A0) with regular spaces and then trim
      const cleanedText = response.text.replace(/\u00A0/g, ' ').trim();
      aiResult = JSON.parse(cleanedText);
      // Unwrap nested aiResult if present
      if (aiResult && aiResult.aiResult) {
        aiResult = aiResult.aiResult;
      }
      logger.debug('[handleAnalysisResponse] Parsed AI response (from text)', { aiResult });
    } catch (err) {
      logger.error('Failed to parse AI response text as JSON', err as Error);
      return message; // Return original message on parse failure
    }
  } else if (response && typeof response === 'object' && Object.keys(response).length > 0) {
    aiResult = response;
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
  const aiContext = aiResult.context || {};
  const workflowContext = message?.workflow || {};
  const perspectiveContext = {
    l: aiContext.l ?? workflowContext.l ?? '',
    cc: aiContext.cc ?? workflowContext.cc ?? '',
    w: Array.isArray(aiContext.w)
      ? aiContext.w
      : aiContext.w !== undefined
        ? [aiContext.w]
        : Array.isArray(workflowContext.w)
          ? workflowContext.w
          : workflowContext.w !== undefined
            ? [workflowContext.w]
            : [],
  };
  const perspective = {
    ...rest,
    mediaDescription: rest.mediaDescription ? [rest.mediaDescription] : [],
    audioDescription: [],
    context: perspectiveContext,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  logger.info('[handleAnalysisResponse] Final perspective object', { perspective });

  try {
    // Use smart upsert to append mediaDescription and merge other fields
    await upsertPerspectiveSmartly(perspective);
  } catch (err) {
    logger.error('Failed to save perspective to database', err as Error);
  }

  return perspective;
}