import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import { buildEnrichRoomPrompt } from './buildEnrichPrompt';
import { sendToPostOffice } from '../../shared/postOffice/postman';

// Utility functions for parsing responses
function cleanJsonString(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Find the first { and last } to extract just the JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove any trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix common JSON issues
  cleaned = cleaned
    .replace(/,\s*,/g, ',') // Remove duplicate commas
    .replace(/\n/g, ' ')    // Replace newlines with spaces
    .replace(/\r/g, '')     // Remove carriage returns
    .trim();
  
  return cleaned;
}

function parseJsonSafely(text: string, context: string): any | null {
  try {
    const cleaned = cleanJsonString(text);
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`[enrich-static] Failed to parse ${context}`, err as Error, { 
      text: text.substring(0, 500) + '...',
      cleanedLength: cleanJsonString(text).length,
      errorPosition: (err as any).message?.match(/position (\d+)/)?.[1]
    });
    
    // Try to find and log the problematic section
    const cleaned = cleanJsonString(text);
    const errorPos = parseInt((err as any).message?.match(/position (\d+)/)?.[1] || '0');
    if (errorPos > 0) {
      const start = Math.max(0, errorPos - 100);
      const end = Math.min(cleaned.length, errorPos + 100);
      logger.error('[enrich-static] Problematic JSON section', new Error('JSON Parse Context'), {
        section: cleaned.substring(start, end),
        position: errorPos
      });
    }
    
    return null;
  }
}

function extractRawPayload(message: any): any {
  // Try parsing string results first
  if (message?.payload?.result) {
    if (typeof message.payload.result === 'string') {
      return parseJsonSafely(message.payload.result, 'AI rank response string');
    }
    if (message.payload.result.text && typeof message.payload.result.text === 'string') {
      return parseJsonSafely(message.payload.result.text, 'AI rank response text');
    }
    if (typeof message.payload.result === 'object') {
      return message.payload.result;
    }
  }

  // Fallback to payload or message
  return message?.payload || message;
}

function extractRankedData(raw: any): { rooms: any[]; venue_id?: string } {
  // Handle rankedRooms structure
  if (Array.isArray(raw?.rankedRooms)) {
    return {
      rooms: raw.rankedRooms,
      venue_id: raw.venue_id
    };
  }

  if (raw?.result && Array.isArray(raw.result.rankedRooms)) {
    return {
      rooms: raw.result.rankedRooms,
      venue_id: raw.result.venue_id
    };
  }

  // Handle direct array
  if (Array.isArray(raw)) {
    return {
      rooms: raw,
      venue_id: raw[0]?.venue_id
    };
  }

  return { rooms: [] };
}

// Handles the ranking/hierarchy room response
export async function handleRankRoomResponse(message: any) {
  logger.debug('[enrich-static] Received AI room rank response', { message });

  const raw = extractRawPayload(message);
  if (!raw) {
    return { status: 'error', error: 'Failed to parse AI rank response' };
  }

  let { rooms, venue_id } = extractRankedData(raw);
  
  // Fallback: extract venue_id from first room
  if (!venue_id && rooms.length > 0) {
    venue_id = rooms[0].venue_id;
  }

  if (!venue_id || rooms.length === 0) {
    logger.error('[enrich-static] Invalid room rank payload', 
      new Error('Missing venue_id or rooms'), { venue_id, rooms });
    return { status: 'error', error: 'Missing venue_id or rooms', venue_id, rooms };
  }

  // Fetch original research data from database and merge with ranking
  let researchedRooms: any[] = [];
  try {
    const hotelsDb = db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload');
    const roomResearchCollection = hotelsDb.collection('room_research_registry');
    researchedRooms = await roomResearchCollection.find({ venue_id: venue_id as any }).toArray();
    
    logger.info('[enrich-static] Fetched research data for merging', {
      venue_id,
      researchedCount: researchedRooms.length,
      rankedCount: rooms.length
    });
  } catch (error) {
    logger.error('[enrich-static] Failed to fetch research data', error as Error, { venue_id });
    return { status: 'error', error: 'Failed to fetch research data for ranking merge' };
  }

  // Merge ranking info with original research data
  const mergedRooms = rooms.map((rankedRoom: any) => {
    const research = researchedRooms.find((r: any) => r.roomName === rankedRoom.roomName);
    if (!research) {
      logger.warn('[enrich-static] No research data found for ranked room', { 
        roomName: rankedRoom.roomName,
        venue_id 
      });
    }
    return {
      ...rankedRoom,
      originalData: research || { roomName: rankedRoom.roomName }
    };
  });

  logger.info('[enrich-static] Merged ranking with research data', {
    venue_id,
    mergedCount: mergedRooms.length
  });

  // Get venue/hotel data from database for context
  let venueData = null;
  try {
    const hotelsDb = db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload');
    const hotelCollection = hotelsDb.collection('hotels');
    venueData = await hotelCollection.findOne({ _id: venue_id as any });
  } catch (error) {
    logger.warn('[enrich-static] Could not fetch venue data for context', { venue_id, error });
  }

  // Build enrich prompt for all rooms with proper context
  const enrichData = {
    VENUE_DATA: venueData || { _id: venue_id, name: 'Unknown Hotel' },
    RANKED_ROOM_DATA: mergedRooms,
    venue_id
  };

  // Batch rooms into chunks of 3 for enrichment to avoid timeouts
  const BATCH_SIZE = 3;
  const batches: any[][] = [];
  
  for (let i = 0; i < mergedRooms.length; i += BATCH_SIZE) {
    batches.push(mergedRooms.slice(i, i + BATCH_SIZE));
  }

  logger.info('[enrich-static] Batching rooms for enrichment', { 
    venue_id, 
    totalRooms: mergedRooms.length, 
    batchCount: batches.length,
    batchSize: BATCH_SIZE 
  });

  // Send each batch as a separate enrichment request
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    const batchEnrichData = {
      VENUE_DATA: venueData || { _id: venue_id, name: 'Unknown Hotel' },
      RANKED_ROOM_DATA: batch,
      venue_id,
      batchInfo: {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        roomsInBatch: batch.length
      }
    };

    const { prompt, payload: enrichPayload } = buildEnrichRoomPrompt(batchEnrichData);

    const enrichMessage = {
      util: 'ai-service',
      type: 'text',
      workflow: message.workflow || {},
      payload: {
        venue_id,
        prompt,
        enrichPayload,
        apiSecret: process.env['taash-secret'],
        options: {
          maxTokens: 8000 // Reduced since we're batching
        },
        responseHandler: {
          util: 'enrich-static',
          type: 'enrich-static-ai-enrich-room-response'
        }
      }
    };

    await sendToPostOffice(enrichMessage);
    
    logger.info('[enrich-static] Queued enrich batch to post office', { 
      venue_id, 
      batchIndex: batchIndex + 1,
      totalBatches: batches.length,
      roomsInBatch: batch.length,
      roomNames: batch.map((r: any) => r.roomName || r.originalData?.roomName)
    });
  }

  return { 
    status: 'success', 
    venue_id, 
    totalRooms: mergedRooms.length,
    batchesQueued: batches.length 
  };
}