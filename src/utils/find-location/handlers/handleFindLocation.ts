
import { logger } from '../../shared/logger'
import { sendPostmanMessage } from '../../shared/serviceBus'
// Location-Finder: Handlers only (letterbox is in letterbox.ts)

/**
 * Builds the prompt for the AI model to suggest the next location.
 * For now, returns a simple prompt. In future, can use workflow context.
 */
export async function handleLocationRequest(workflowContext: any) {
  logger.info('[Location-Finder] handleLocationRequest called', {
    service: 'find-location',
    workflowContext: JSON.stringify(workflowContext),
    timestamp: new Date().toISOString()
  });
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
  logger.info('[Location-Finder] AI request enqueued', {
    service: 'find-location',
    prompt,
    workflowContext: JSON.stringify(workflowContext),
    timestamp: new Date().toISOString()
  });
  return { status: 'ai-request-enqueued', prompt };
}



/**
 * Handles the AI response for a location-finding request.
 * Extracts the location and triggers the next workflow step.
 */
export async function handleLocationResponse(aiResponse: any, workflowContext: any) {
  logger.info('[Location-Finder] handleLocationResponse called', {
    service: 'find-location',
    aiResponse: JSON.stringify(aiResponse),
    workflowContext: JSON.stringify(workflowContext),
    timestamp: new Date().toISOString()
  });
  // Example: extract the location from the AI response
  const location = aiResponse?.text || 'Unknown location';
  // TODO: Queue the next workflow step (e.g., enrich-venue, crawl-media, etc.)
  // Log the result using the main logger
  logger.info(`[Location-Finder] Next location: ${location}`, {
    service: 'find-location',
    location: location,
    workflowContext: JSON.stringify(workflowContext),
    aiResponse: JSON.stringify(aiResponse),
    timestamp: new Date().toISOString()
  });
  // Optionally, return the location for further processing
  return { location };
}
