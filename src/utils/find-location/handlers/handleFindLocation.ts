import { logger } from '../../shared/logger'
import { sendToPostOffice } from '../../shared/postOffice/postman'
import { db } from '../../shared/database'
import { upsertLocationData } from './handleLocationData'
// Location-Finder: Handlers only (letterbox is in letterbox.ts)

/**
 * Builds the prompt for the AI model to suggest the next location.
 * For now, returns a simple prompt. In future, can use workflow context.
 */
export async function handleLocationRequest(workflowContext: any) {
  logger.info('[handleLocationRequest] Received workflowContext:', workflowContext);
  logger.info('[handleLocationRequest] batchId:', workflowContext?.batchId);
 
  // Build the full prompt using live crawl data
  const { buildLocationInstruction } = await import('./buildLocationPrompt');
  const prompt = await buildLocationInstruction();
  // Send message to ai-service letterbox using standardized shape
  await sendToPostOffice({
    util: 'ai-service',
    type: 'ai_request',
    workflow: workflowContext,
    payload: {
      prompt,
      responseHandler: { util: 'find-location', type: 'find-location-response' },
      options: { maxTokens: 512 }
    }
  });
  return { status: 'ai-request-enqueued', prompt };
}



/**
 * Handles the AI response for a location-finding request.
 * Extracts the location and triggers the next workflow step.
 */

export async function handleLocationResponse(aiResponse: any, workflowContext: any) {
  logger.info('[handleLocationResponse] Received workflowContext:', workflowContext);
  logger.info('[handleLocationResponse] batchId:', workflowContext?.batchId);
  
  logger.info('[handleLocationResponse] Raw aiResponse received', { aiResponse });

  let parsedAiContent: any = null;
  let locationName: string = 'Unknown location';
  let countryCode: string = 'Unknown';
  let queries: string[] = [];

  try {
    // Step 1: Parse the 'text' field from the aiResponse, which contains the AI's JSON output
    // The actual text is in aiResponse.response.text, not aiResponse.text
    const responseText = aiResponse?.response?.text || aiResponse?.text;
    logger.info('[handleLocationResponse] Parsing AI response text', { responseText });
    if (responseText && typeof responseText === 'string') {
      parsedAiContent = JSON.parse(responseText);
      logger.info('[handleLocationResponse] Parsed AI content', { parsedAiContent });

      locationName = parsedAiContent.l; 
      countryCode = parsedAiContent.cc;
      queries = parsedAiContent.queries;

      logger.info('[handleLocationResponse] Extracted location details', { locationName, countryCode, queries });
    } else {
      logger.warn('[handleLocationResponse] AI response text field is missing or not a string, cannot parse location details.', { aiResponse });
    }
  } catch (error) {
    logger.error(`[handleLocationResponse] Failed to parse AI response text: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn('[handleLocationResponse] Raw AI response text for failed parse', {
      text: aiResponse?.response?.text || aiResponse?.text,
      service: 'find-location'
    });
    // Fallback if parsing fails
    locationName = 'Parsing failed';
  }

  // Persist location details to the database using abstraction
  try {
    logger.info('[handleLocationResponse] Upserting location data to database', { location: locationName, countryCode, queries });
    await upsertLocationData({
      location: locationName,
      countryCode,
      queries
    });
    logger.info('[handleLocationResponse] Location upserted in database', { location: locationName, countryCode });
  } catch (err) {
    logger.error('[handleLocationResponse] Failed to persist location to database', err instanceof Error ? err : undefined);
  }

  // Only send the first query as a message to the post-office for crawl-media
  if (Array.isArray(queries) && queries.length > 0 && locationName && countryCode) {
    const query = queries[0];
    logger.info('[handleLocationResponse] Preparing to send search-crawl job', { locationName, countryCode, query });
    if (!query.includes('google.com')) {
      logger.info('[handleLocationResponse] Creating get-media job', { workflowContext, batchId: workflowContext?.batchId });
      await sendToPostOffice({
        util: 'get-media',
        type: 'search-list',
        workflow: workflowContext,
        payload: {
          location: locationName,
          countryCode,
          query,
          meta: {
            source: 'find-location',
            timestamp: new Date().toISOString()
          }
        }
      });
      logger.info('[handleLocationResponse] Sent get-media job to post-office', { location: locationName, countryCode, query });
      logger.info('[handleLocationResponse] Sent job envelope', { workflowContext, batchId: workflowContext?.batchId });
    } else {
      logger.info('[handleLocationResponse] Skipped sending search-crawl job for google.com query', { query });
    }
  }

}
