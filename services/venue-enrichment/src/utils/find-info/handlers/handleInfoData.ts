
import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';

/**
 * Parses the AI response and processes each query by sending it to the post office.
 */
export async function handleInfoData(aiResponse: any, workflowContext: any): Promise<void> {
  try {
    logger.info('[find-info-response] Processing AI response for find-info', { aiResponse });
    const text = aiResponse?.result?.text || aiResponse?.text || aiResponse;
    if (!text || typeof text !== 'string') {
      logger.warn('[find-info-response] No valid text found in AI response');
      return;
    }

    // Remove code block markers if present
    const cleanedText = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (err) {
      logger.error('[find-info-response] Failed to parse AI response JSON', err instanceof Error ? err : new Error(String(err)), { cleanedText });
      return;
    }

    const venueName = parsed.venueName || '';
    const venueLocation = parsed.venueLocation || '';
    const queries = Array.isArray(parsed.queries) ? parsed.queries : [];

    if (!venueName || !venueLocation || queries.length === 0) {
      logger.warn('[find-info-response] Incomplete info data', { venueName, venueLocation, queries });
      return;
    }

    logger.info('[find-info-response] Processing queries', {
      venueName,
      venueLocation,
      totalQueries: queries.length
    });

    for (const query of queries) {
      await sendToPostOffice({
        util: 'get-venue-media',
        type: 'search',
        apiSecret: process.env['taash-secret'],
        workflow: {
          ...workflowContext,
          venueName,
          venueLocation,
          query
        },
        payload: {
          query,
          venueName,
          venueLocation,
          meta: {
            source: 'find-info',
            timestamp: new Date().toISOString()
          }
        }
      });
    }
    logger.info('[find-info-response] All queries sent to get-venue-media');
  } catch (error) {
    logger.error('[find-info-response] Failed to process info response', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
