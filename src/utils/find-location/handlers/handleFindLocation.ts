
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
 
  // Build the full prompt using live crawl data
  const { buildLocationInstruction } = await import('./buildLocationPrompt');
  const prompt = await buildLocationInstruction();
  // Send message to ai-service letterbox
  await sendPostmanMessage({
    util: 'ai-service',
    context: workflowContext,
    payload: {
      type: 'ai_request',
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
  
  let parsedAiContent: any = null;
  let locationName: string = 'Unknown location';
  let countryCode: string = 'Unknown';
  let queries: string[] = [];

  try {
    // Step 1: Parse the 'text' field from the aiResponse, which contains the AI's JSON output
    // Ensure aiResponse.text exists and is a string before parsing
    if (aiResponse?.text && typeof aiResponse.text === 'string') {
      parsedAiContent = JSON.parse(aiResponse.text);

      // Step 2: Extract the specific fields from the parsed content
      locationName = parsedAiContent.l || 'Unknown location';
      countryCode = parsedAiContent.cc || 'Unknown';
      queries = parsedAiContent.queries || [];

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

  // Send each query as a separate message to the post-office for crawl-media (last step)
  if (Array.isArray(queries) && locationName && countryCode) {
    for (const query of queries) {
      await sendPostmanMessage({
        util: 'crawl-media',
        context: workflowContext,
        payload: {
          type: 'media-crawl-request',
          location: locationName,
          countryCode,
          query,
          meta: {
            source: 'find-location',
            timestamp: new Date().toISOString()
          }
        }
      });
      logger.info('Sent crawl-media request to post-office', { location: locationName, countryCode, query });
    }
  }

  // Optionally, return the location details for further processing
  return {
    l: locationName,
    cc: countryCode,
    queries: queries
  };
}
