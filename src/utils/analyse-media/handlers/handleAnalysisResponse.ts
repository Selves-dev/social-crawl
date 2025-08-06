import { logger } from '../../shared/logger';
import { addQueryToPerspective, savePerspectiveFull, upsertPerspectiveSmartly } from '../../shared/dbStore';
import { getBlobJson } from '../../shared/azureBlob';

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

  // Fetch blob JSON to get mediaId, permalink, and source
  let blobFields = {
    mediaId: '',
    permalink: '',
    source: '',
    username: '',
    adminTitle: '',
    date: '',
    thumbnail: ''
  };

  try {
    // The AI service response wraps the original request in payload.request
    // Original blobUrl is in payload.request.payload.mediaUrl or payload.request.payload.blobUrl
    const blobUrl = message?.payload?.mediaUrl || 
                   message?.payload?.blobUrl ||
                   message?.payload?.request?.payload?.mediaUrl ||
                   message?.payload?.request?.payload?.blobUrl;
                   
    if (blobUrl) {
      const blobJson = await getBlobJson(blobUrl);
      blobFields = {
        mediaId: blobJson.mediaId || blobJson.id || '',
        permalink: blobJson.link || blobJson.permalink || '',
        source: blobJson.platform || blobJson.source || '',
        username: blobJson.username || '',
        adminTitle: blobJson.adminTitle || blobJson.title || '',
        date: blobJson.date || blobJson.publishDate || new Date().toISOString().slice(0, 10),
        thumbnail: blobJson.thumbnail || blobJson.thumbnailUrl || blobJson.thumb || ''
      };
      logger.debug('[handleAnalysisResponse] Extracted blob fields', { 
        blobFields,
        availableFields: {
          mediaId: blobJson.mediaId,
          id: blobJson.id,
          permalink: blobJson.permalink,
          link: blobJson.link,
          platform: blobJson.platform,
          source: blobJson.source,
          allKeys: Object.keys(blobJson)
        }
      });
    } else {
      logger.warn('[handleAnalysisResponse] No blobUrl found in message payload', { 
        payload: message?.payload,
        requestPayload: message?.payload?.request?.payload
      });
    }
  } catch (err) {
    logger.error('[handleAnalysisResponse] Failed to fetch blob JSON for perspective fields', err as Error);
  }

  const perspective = {
    // _id is omitted here; MongoDB will add it automatically if not present
    caption: rest.caption || '',
    mediaDescription: rest.mediaDescription ? [rest.mediaDescription] : [],
    likeCount: rest.likeCount ?? null,
    viewCount: rest.viewCount ?? null,
    places: rest.places ?? [],
    locations: rest.locations ?? [],
    context: perspectiveContext,
    mediaId: blobFields.mediaId || '',
    permalink: blobFields.permalink || '',
    source: blobFields.source || '',
    username: blobFields.username || '',
    title: blobFields.adminTitle || rest.title || '',
    date: blobFields.date || '',
    slug: rest.slug || '',
    thumbnail: blobFields.thumbnail || '',
    audioDescription: rest.audioDescription ?? [],
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