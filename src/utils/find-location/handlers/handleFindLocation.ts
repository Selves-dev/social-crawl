
import { logger } from '../../shared/logger'
// Location-Finder: Prompt builder and response handler

/**
 * Builds the prompt for the AI model to suggest the next location.
 * For now, returns a simple prompt. In future, can use workflow context.
 */
export function buildLocationPrompt(/* context?: any */): string {
  return 'Where in the world shall we go next?'
}

/**
 * Handles the AI response for a location-finding request.
 * Extracts the location and triggers the next workflow step.
 */
export async function handleLocationResponse(aiResponse: any, workflowContext: any) {
  // Example: extract the location from the AI response
  const location = aiResponse?.text || 'Unknown location'
  // TODO: Queue the next workflow step (e.g., enrich-venue, crawl-media, etc.)
  // Log the result using the main logger
  logger.info(`[Location-Finder] Next location: ${location}`, {
    service: 'find-location',
    location,
    workflowContext
  })
  // Optionally, return the location for further processing
  return { location }
}
