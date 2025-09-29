import { logger } from '../../shared/logger';
import { addQueryToPerspective, savePerspectiveFull, upsertPerspective, findPerspectiveByMediaId } from '../../shared/dbStore';
import { getBlobJson } from '../../shared/azureBlob';
import { analyseMediaLetterbox } from '../letterbox';

// Helper: Extract first JSON object from a string
function extractFirstJsonObject(text: string): string | null {
  // This regex finds the first {...} or [...] block in the string
  const match = text.match(/([\[{][\s\S]*[\]}])/);
  return match ? match[0] : null;
}

export async function handleAnalysisResponse(message: any) {
  logger.debug('[handleAnalysisResponse] Full message structure (stringified)', { message: JSON.stringify(message, null, 2) });
  logger.debug('[handleAnalysisResponse] Top-level keys', { keys: Object.keys(message || {}) });

  // Support message.payload.result as the primary AI response location
  const response = message?.payload?.result;
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
      // Try to extract the first JSON object/array from the text
      const jsonString = extractFirstJsonObject(cleanedText);
      if (!jsonString) throw new Error('No JSON object found in AI response text');
      aiResult = JSON.parse(jsonString);
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
    logger.debug('[handleAnalysisResponse] Parsed AI response (object)', { aiResult });
  } else if (typeof message?.text === 'string') {
    try {
      // **CRITICAL FIX:** Clean the string before parsing for this case too
      const cleanedText = message.text.replace(/\u00A0/g, ' ').trim();
      const jsonString = extractFirstJsonObject(cleanedText);
      if (!jsonString) throw new Error('No JSON object found in message.text');
      aiResult = JSON.parse(jsonString);
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
      : Array.isArray(workflowContext.w)
        ? workflowContext.w
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

  let thumbnailUrl = '';
  try {
    const blobUrl = message?.payload?.mediaUrl;
    if (blobUrl) {
      const blobJson = await getBlobJson(blobUrl);
      blobFields = {
        mediaId: blobJson.mediaId || '',
        permalink: blobJson.link || '',
        source: blobJson.source || '',
        username: blobJson.username || '',
        adminTitle: blobJson.title || '',
        date: blobJson.date || '',
        thumbnail: blobJson.thumbnail || ''
      };
      // Extract thumbnail URL ONLY from media array (processed/uploaded thumbnail)
      // Don't use the original thumbnail URL from blobFields.thumbnail
      
      // Debug: Log media array content
      logger.debug('[handleAnalysisResponse] Media array inspection', {
        mediaId: blobJson.mediaId,
        mediaArrayLength: blobJson.media?.length || 0,
        mediaArray: blobJson.media || [],
        hasThumbnailType: Array.isArray(blobJson.media) ? blobJson.media.some((m: any) => m.type === 'thumbnail') : false
      });
      
      try {
        if (Array.isArray(blobJson.media)) {
          for (const m of blobJson.media) {
            if (m.type === 'thumbnail' && m.url) {
              thumbnailUrl = m.url;
              break;
            }
          }
        }
      } catch (err) {
        logger.warn('[handleAnalysisResponse] Failed to extract thumbnail from media array', err as Error);
      }
      
      logger.debug('[handleAnalysisResponse] Thumbnail extraction result', {
        mediaId: blobJson.mediaId,
        foundThumbnail: !!thumbnailUrl,
        thumbnailUrl: thumbnailUrl
      });
      logger.debug('[handleAnalysisResponse] Extracted blob fields', { blobFields, thumbnailUrl });
    } else {
      logger.warn('[handleAnalysisResponse] No mediaUrl found in message payload', { payload: message?.payload });
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
    venues: rest.venues ?? [],
    locations: rest.locations ?? [],
    context: perspectiveContext,
    mediaId: blobFields.mediaId || '',
    permalink: blobFields.permalink || '',
    source: blobFields.source || '',
    username: blobFields.username || '',
    title: blobFields.adminTitle || rest.title || '',
    date: blobFields.date || '',
    slug: rest.slug || '',
    thumbnail: thumbnailUrl || '', // Only use processed thumbnail from media array
    audioDescription: rest.audioDescription ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  logger.info('[handleAnalysisResponse] Final perspective object', { perspective });

  try {
    // Use smart upsert to append mediaDescription and merge other fields
    const upsertResult = await upsertPerspective(perspective);
    
    logger.info('[handleAnalysisResponse] Perspective saved', { 
      mediaId: perspective.mediaId,
      hasInsertedId: !!(upsertResult as any).insertedId,
      hasModifiedCount: typeof (upsertResult as any).modifiedCount === 'number'
    });
    
    // For each venue, queue a venue-basics request
    if (Array.isArray(perspective.venues)) {
      for (const venue of perspective.venues) {
        // Merge l, cc, w from perspective.context into the workflow for downstream context
        // Preserve original workflow values if perspective context is empty
        const workflow = {
          ...message.workflow,
          l: perspective.context.l || message.workflow?.l,
          cc: perspective.context.cc || message.workflow?.cc,
          w: perspective.context.w?.length > 0 ? perspective.context.w : (message.workflow?.w || []),
        };
        const venueBasicsMessage = {
          util: 'analyse-media',
          type: 'venue-basics',
          workflow,
          apiSecret: process.env['taash-secret'],
          payload: {
            venue,
            mediaId: perspective.mediaId, // Use mediaId to link back to perspective
          },
        };
        await analyseMediaLetterbox(venueBasicsMessage);
      }
    }
  } catch (err) {
    logger.error('Failed to save perspective to database', err as Error);
  }
  return perspective;
}