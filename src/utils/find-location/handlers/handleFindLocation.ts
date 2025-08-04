import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import { db } from '../../shared/database';
import { upsertLocationData } from './handleLocationData';

// Location-Finder: Handlers only (letterbox is in letterbox.ts)

/**
 * Builds the prompt for the AI model to suggest the next location.
 * For now, returns a simple prompt. In future, can use workflow context.
 */
export async function handleLocationRequest(workflowContext: any): Promise<void> {
  try {
    logger.info('[location-request] handleLocationRequest START', { 
      workflowContext, 
      batchId: workflowContext?.batchId 
    });
 
    // Build the full prompt using live crawl data
    const { buildLocationInstruction } = await import('./buildLocationPrompt');
    const prompt = await buildLocationInstruction();
    
    // Send message to ai-service using standardized shape
    await sendToPostOffice({
      util: 'ai-service',
      type: 'ai-request',
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
    
    logger.info('[location-request] handleLocationRequest completed');
  } catch (error) {
    logger.error('[location-request] Error processing location request', 
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

export async function handleLocationResponse(aiResponse: any, workflowContext: any): Promise<void> {
  try {
    logger.info('[location-response] handleLocationResponse START', { workflowContext });
    
    let locationName = '';
    let countryCode = '';
    let queries: string[] = [];
    
    const text = aiResponse?.response?.text || aiResponse?.text;
    logger.info('[location-response] Parsing AI response text', { text });
    
    if (text && typeof text === 'string') {
      // Remove code block markers (handles ```json and ```)
      const cleanedText = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedText);
        locationName = parsed.l || '';
        countryCode = parsed.cc || '';
        queries = parsed.queries || [];
        
        logger.info('[location-response] Extracted location details', { 
          locationName, 
          countryCode, 
          queries 
        });
      } catch (err) {
        logger.error('[location-response] Failed to parse AI response text', 
          err instanceof Error ? err : new Error(String(err)), 
          { text: cleanedText }
        );
        locationName = 'Parsing failed';
        countryCode = 'Unknown';
        queries = [];
      }
    } else {
      logger.warn('[location-response] AI response text field is missing or not a string', { 
        aiResponse 
      });
      locationName = 'Parsing failed';
      countryCode = 'Unknown';
      queries = [];
    }

    // Persist location details to the database
    try {
      logger.debug('[location-response] Upserting location data to database', { 
        location: locationName, 
        countryCode, 
        queries 
      });
      
      await upsertLocationData({
        location: locationName,
        countryCode,
        queries
      });
      
      logger.info('[location-response] Location upserted in database', { 
        location: locationName, 
        countryCode 
      });
    } catch (err) {
      logger.error('[location-response] Failed to persist location to database', 
        err instanceof Error ? err : new Error(String(err))
      );
    }

    // Send the first query as a message to post-office for search-list
    if (Array.isArray(queries) && queries.length > 0 && locationName && countryCode) {
      const query = queries[0];
      
      logger.debug('[location-response] Preparing to send search-list job', { 
        locationName, 
        countryCode, 
        query 
      });
      
      if (!query.includes('google.com')) {
        logger.info('[location-response] Creating search-list job', { 
          workflowContext, 
          batchId: workflowContext?.batchId 
        });
        
        await sendToPostOffice({
          util: 'get-media',
          type: 'search-list',
          apiSecret: process.env['taash-secret'],
          workflow: workflowContext,
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
        
        logger.info('[location-response] handleLocationResponse completed - job sent to search-list');
      } else {
        logger.info('[location-response] Skipped sending search-list job for google.com query', { 
          query 
        });
      }
    } else {
      logger.warn('[location-response] No valid queries to process', { 
        queries, 
        locationName, 
        countryCode 
      });
    }
  } catch (error) {
    logger.error('[location-response] Error processing location response', 
      error instanceof Error ? error : new Error(String(error))
    );
  }
}