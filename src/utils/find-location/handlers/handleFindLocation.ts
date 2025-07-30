import { logger } from '../../shared/logger'
import { sendPostmanMessage } from '../../shared/serviceBus'
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
  // Send message to ai-service letterbox
  await sendPostmanMessage({
    util: 'ai-service',
    payload: {
      type: 'ai_request',
      prompt,
      workflow: workflowContext,
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
  
  let parsedAiContent: any = null;
  let locationName: string = 'Unknown location';
  let countryCode: string = 'Unknown';
  let queries: string[] = [];

  try {
    // Step 1: Parse the 'text' field from the aiResponse, which contains the AI's JSON output
    // Ensure aiResponse.text exists and is a string before parsing
    if (aiResponse?.text && typeof aiResponse.text === 'string') {
      parsedAiContent = JSON.parse(aiResponse.text);

      locationName = parsedAiContent.l; 
      countryCode = parsedAiContent.cc;
      queries = parsedAiContent.queries;

    } else {
      logger.warn('AI response text field is missing or not a string, cannot parse location details.', { aiResponse });
    }
  } catch (error) {
    logger.error(`Failed to parse AI response text: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn('Raw AI response text for failed parse', {
      text: aiResponse?.text,
      service: 'find-location'
    });
    // Fallback if parsing fails
    locationName = 'Parsing failed';
  }

  // Persist location details to the database using abstraction
  try {
    await upsertLocationData({
      location: locationName,
      countryCode,
      queries
    });
    logger.info('Location upserted in database', { location: locationName, countryCode });
  } catch (err) {
    logger.error('Failed to persist location to database', err instanceof Error ? err : undefined);
  }

  // Only send the first query as a message to the post-office for crawl-media
  if (Array.isArray(queries) && queries.length > 0 && locationName && countryCode) {
    const query = queries[0];
    if (!query.includes('google.com')) {
      logger.info('[handleLocationResponse] Creating search-crawl job envelope with workflowContext:', workflowContext);
      logger.info('[handleLocationResponse] batchId for job envelope:', workflowContext?.batchId);
      await sendPostmanMessage({
        util: 'crawl-media',
        context: workflowContext,
        payload: {
          type: 'search-crawl-queued',
          jobsQueued: [{
            type: 'search-crawl-queued',
            context: {
              location: locationName,
              countryCode,
              query,
              // add other context fields as needed
            },
            workflow: workflowContext,
            meta: {
              source: 'find-location',
              timestamp: new Date().toISOString()
            }
          }]
        }
      });
      logger.info('Sent search-crawl request to post-office', { location: locationName, countryCode, query });
      logger.info('[handleLocationResponse] Sent job envelope with workflowContext:', workflowContext);
      logger.info('[handleLocationResponse] batchId sent:', workflowContext?.batchId);
    } else {
      logger.info('Skipped sending search-crawl job for google.com query', { query });
    }
  }

}
