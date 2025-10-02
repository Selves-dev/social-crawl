import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import { buildRankRoomPrompt } from './buildEnrichPrompt';
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
  
  return cleaned.trim();
}

function parseJsonSafely(text: string, context: string): any | null {
  try {
    const cleaned = cleanJsonString(text);
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`[enrich-static] Failed to parse ${context}`, err as Error, { 
      text: text.substring(0, 500) + '...',
      cleanedLength: cleanJsonString(text).length 
    });
    return null;
  }
}

function extractRawPayload(message: any): any {
  // Try parsing string results first
  if (message?.payload?.result) {
    if (typeof message.payload.result === 'string') {
      return parseJsonSafely(message.payload.result, 'AI research response string');
    }
    if (message.payload.result.text && typeof message.payload.result.text === 'string') {
      return parseJsonSafely(message.payload.result.text, 'AI research response text');
    }
    if (typeof message.payload.result === 'object') {
      return message.payload.result;
    }
  }

  // Fallback to payload or message
  return message?.payload || message;
}

function extractRoomsData(raw: any): { rooms: any[]; venue_id?: string } {
  // Handle researchedRooms structure
  if (Array.isArray(raw?.researchedRooms)) {
    return {
      rooms: raw.researchedRooms,
      venue_id: raw.venue_id
    };
  }

  if (raw?.result && Array.isArray(raw.result.researchedRooms)) {
    return {
      rooms: raw.result.researchedRooms,
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

// Handles the research/fact-gathering room response
export async function handleResearchRoomResponse(message: any) {
  logger.debug('[enrich-static] Received AI room research response', { message });

  const raw = extractRawPayload(message);
  if (!raw) {
    return { status: 'error', error: 'Failed to parse AI research response' };
  }

  let { rooms, venue_id } = extractRoomsData(raw);
  
  // Fallback: extract venue_id from first room
  if (!venue_id && rooms.length > 0) {
    venue_id = rooms[0].venue_id;
  }

  if (!venue_id || rooms.length === 0) {
    logger.error('[enrich-static] Invalid room research payload', 
      new Error('Missing venue_id or rooms'), { venue_id, rooms });
    return { status: 'error', error: 'Missing venue_id or rooms', venue_id, rooms };
  }

  // Get venue/hotel data from database for context
  let venueData = null;
  try {
    const hotelsDb = db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload');
    const hotelCollection = hotelsDb.collection('hotels');
    venueData = await hotelCollection.findOne({ _id: venue_id as any });
  } catch (error) {
    logger.warn('[enrich-static] Could not fetch venue data for context', { venue_id, error });
  }

  // Build rank prompt for all rooms with proper context
  const rankData = {
    VENUE_DATA: venueData || { _id: venue_id, name: 'Unknown Hotel' },
    RESEARCHED_ROOM_DATA: rooms,
    venue_id
  };

  const { prompt, payload: rankPayload } = buildRankRoomPrompt(rankData);

  const rankMessage = {
    util: 'ai-service',
    type: 'text',
    workflow: message.workflow || {},
    payload: {
      venue_id,
      prompt,
      rankPayload,
      apiSecret: process.env['taash-secret'],
      options: {
        maxTokens: 4000 // Reduced - ranking should be lightweight
      },
      responseHandler: {
        util: 'enrich-static',
        type: 'enrich-static-ai-rank-room-response'
      }
    }
  };

  await sendToPostOffice(rankMessage);
  logger.info('[enrich-static] Queued rank prompt to post office (all rooms)', 
    { venue_id, roomCount: rooms.length });

  return { status: 'success', venue_id, roomsQueued: rooms.length };
}