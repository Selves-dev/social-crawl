
import { logger } from '../../shared/logger';
import { getBlobJson } from '../../shared/azureBlob';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import { buildVenueBasicsPrompt } from './buildAnalysisPrompts';


/**
 * Handler for extracting venue basics from media or metadata.
 * @param message - The workflow message or job object
 */
export async function handleVenueBasics(message: any): Promise<any> {
  logger.info('[handleVenueBasics] Called with message:', { message });

  const prompt = buildVenueBasicsPrompt(message);
  logger.info('[handleVenueBasics] Built prompt for search service:', { prompt });
  // Send to search service (ai-service) for further enrichment
  await sendToPostOffice({
    util: 'ai-service',
    type: 'search',
    apiSecret: process.env['taash-secret'],
    workflow: message.workflow,
    payload: {
      prompt,
      responseHandler: {
        util: 'analyse-media',
        type: 'ai_SearchResponse'
      }
    }
  });
  return { status: 'venue-basics-requested', prompt };
}
