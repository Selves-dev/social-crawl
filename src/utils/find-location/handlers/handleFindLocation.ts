import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import { db } from '../../shared/database';
import { upsertLocationData } from './handleLocationData';

// Location-Finder: Handlers only (letterbox is in letterbox.ts)

interface LocationResponse {
  l: string;      // location name
  cc: string;     // country code
  queries: string[];
}

interface WorkflowContext {
  batchId?: string;
  l?: string;
  cc?: string;
  w?: string[];
  [key: string]: any;
}

/**
 * Builds the prompt for the AI model to suggest the next location.
 */
export async function handleLocationRequest(workflowContext: WorkflowContext): Promise<void> {
  try {
    logger.info('[location-request] Starting location request', { 
      batchId: workflowContext?.batchId 
    });
 
    const { buildLocationInstruction } = await import('./buildLocationPrompt');
    const prompt = await buildLocationInstruction();
    
    await sendToPostOffice({
      util: 'ai-service',
      type: 'text',
      apiSecret: process.env['taash-secret'],
      workflow: workflowContext,
      payload: {
        prompt,
        responseHandler: {
          util: 'find-location',
          type: 'find-location-response'
        }
      }
    });
    
    logger.info('[location-request] Location request completed');
    
  } catch (error) {
    logger.error('[location-request] Failed to process location request', 
      error instanceof Error ? error : new Error(String(error))
    );
    throw error; // Re-throw to allow caller to handle
  }
}

export async function handleLocationResponse(aiResponse: any, workflowContext: WorkflowContext): Promise<void> {
  try {
    logger.info('[location-response] Starting location response processing', { 
      batchId: workflowContext?.batchId 
    });
    
    const locationData = parseLocationResponse(aiResponse);
    if (!locationData) {
      logger.warn('[location-response] No valid location data found in AI response');
      return;
    }

    const { locationName, countryCode, queries } = locationData;
    logger.info('[location-response] Extracted location details', { 
      locationName, 
      countryCode, 
      queryCount: queries.length 
    });

    await processSearchQueries(queries, locationName, countryCode, workflowContext);
    logger.info('[location-response] Location response processing completed');
    
  } catch (error) {
    logger.error('[location-response] Failed to process location response', 
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Parses the AI response and extracts location data
 */
function parseLocationResponse(aiResponse: any): { locationName: string; countryCode: string; queries: string[] } | null {
  const text = aiResponse?.result?.text;
  if (!text || typeof text !== 'string') {
    logger.debug('[location-response] No valid text found in AI response');
    return null;
  }

  try {
    // Remove code block markers
    const cleanedText = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    const parsed: LocationResponse = JSON.parse(cleanedText);
    
    const locationName = parsed.l || '';
    const countryCode = parsed.cc || '';
    const queries = Array.isArray(parsed.queries) ? parsed.queries : [];
    
    if (!locationName || !countryCode || queries.length === 0) {
      logger.warn('[location-response] Incomplete location data', { locationName, countryCode, queries });
      return null;
    }
    
    return { locationName, countryCode, queries };
    
  } catch (parseError) {
    logger.error('[location-response] Failed to parse AI response JSON', { 
      text, 
      error: parseError instanceof Error ? parseError.message : String(parseError) 
    });
    return null;
  }
}

/**
 * Processes search queries by sending them to the search service
 */
async function processSearchQueries(
  queries: string[], 
  locationName: string, 
  countryCode: string, 
  workflowContext: WorkflowContext
): Promise<void> {
  const validQueries = queries.filter(query => !query.includes('google.com'));
  
  if (validQueries.length === 0) {
    logger.info('[location-response] No valid queries to process (all contained google.com)');
    return;
  }

  logger.info('[location-response] Processing queries', { 
    totalQueries: queries.length,
    validQueries: validQueries.length,
    skippedGoogleQueries: queries.length - validQueries.length
  });

  // Process each query as a separate job
  for (const query of validQueries) {
    await sendSearchJob(query, locationName, countryCode, workflowContext);
  }
}

/**
 * Sends a single search job to the post office
 */
async function sendSearchJob(
  query: string, 
  locationName: string, 
  countryCode: string, 
  workflowContext: WorkflowContext
): Promise<void> {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const searchWorkflow: WorkflowContext = {
    ...workflowContext,
    l: locationName,
    cc: countryCode,
    w: [query],
    batchId
  };

  logger.debug('[location-response] Sending search job', { 
    query, 
    locationName, 
    countryCode, 
    batchId 
  });

  await sendToPostOffice({
    util: 'get-media',
    type: 'search-list',
    apiSecret: process.env['taash-secret'],
    workflow: searchWorkflow,
    payload: {
      query,
      location: locationName,
      countryCode,
      meta: {
        source: 'find-location',
        timestamp: new Date().toISOString()
      }
    }
  });
}