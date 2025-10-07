import { ObjectId } from 'mongodb';
import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import { HotelDocument, HotelRoom } from '../../../types/hotel';

// Utility functions for parsing responses
function cleanJsonString(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Find the first { or [ and last } or ] to extract just the JSON
  const firstBrace = Math.min(
    cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : Infinity,
    cleaned.indexOf('[') !== -1 ? cleaned.indexOf('[') : Infinity
  );
  const lastBrace = Math.max(
    cleaned.lastIndexOf('}'),
    cleaned.lastIndexOf(']')
  );
  
  if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace > firstBrace) {
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
      return parseJsonSafely(message.payload.result, 'AI enrich response string');
    }
    if (message.payload.result.text && typeof message.payload.result.text === 'string') {
      return parseJsonSafely(message.payload.result.text, 'AI enrich response text');
    }
    if (typeof message.payload.result === 'object') {
      return message.payload.result;
    }
  }

  // Fallback to payload or message
  return message?.payload || message;
}

function extractRegistryEntries(payload: any): { entries: any[]; venue_id: string } {
  const venue_id = payload.venue_id || payload.parentHotelId || '';

  // Check if payload is already an array (direct AI response)
  if (Array.isArray(payload)) {
    return { entries: payload, venue_id: venue_id || payload[0]?.parentHotelId || '' };
  }

  // Try various array formats
  const possibleArrays = [
    payload.enrichedRooms,
    payload.registryEntry,
    payload.result,
    payload
  ];

  for (const arr of possibleArrays) {
    if (Array.isArray(arr)) {
      return { entries: arr, venue_id: venue_id || arr[0]?.parentHotelId || '' };
    }
  }

  // Handle single object
  if (payload.registryEntry && typeof payload.registryEntry === 'object') {
    return { entries: [payload.registryEntry], venue_id };
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { entries: [payload], venue_id };
  }

  return { entries: [], venue_id };
}

// Final enrichment handler - structures data and upserts to database
export async function handleEnrichRoomResponse(message: any) {
  logger.info('[enrich-static] Received final room enrichment response', { message });

  const payload = extractRawPayload(message);
  if (!payload) {
    return { status: 'error', error: 'Failed to parse enrichment response' };
  }

  const { entries: registryEntries, venue_id } = extractRegistryEntries(payload);

  if (!venue_id || registryEntries.length === 0) {
    logger.error('[enrich-static] Invalid enrichment room payload', 
      new Error('Missing venue_id or registryEntry'), { venue_id, registryEntries });
    return { status: 'error', error: 'Missing venue_id or registryEntry', venue_id, registryEntries };
  }

  try {
    const hotelsDb = db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload');
    const collection = hotelsDb.collection<HotelDocument>('hotels');

    // Convert venue_id to ObjectId if it's a string
    const venueObjectId = typeof venue_id === 'string' ? new ObjectId(venue_id) : venue_id;

    let upserted = 0;
    const skippedEntries: any[] = [];

    for (const entry of registryEntries) {
      const roomId = entry.roomId || entry.identity?.roomId || entry.roomName || '';
      
      if (!roomId) {
        skippedEntries.push(entry);
        continue;
      }

      // Create the room object by merging registry entry with room structure
      const roomData = {
        roomName: entry.identity?.name || entry.name || '',
        roomId: roomId,
        roomSlug: `${venue_id}-${roomId}`,
        identity: entry.identity || {},
        hierarchy: entry.hierarchy || {},
        pricingContext: entry.pricingContext || {},
        wouldMatch: entry.wouldMatch || {},
        features: entry.features || {},
        reviewSnippets: entry.reviewSnippets || [],
        dataConfidence: entry.dataConfidence || {},
        id: roomId
      };

      // First try to update existing room
      const updateResult = await collection.updateOne(
        { _id: venueObjectId, 'rooms.roomId': roomId },
        { $set: { 'rooms.$': roomData } }
      );

      if (updateResult.matchedCount > 0) {
        // Room existed and was updated
        upserted += updateResult.modifiedCount;
        logger.info('[enrich-static] Final room registry entry updated', 
          { venue_id: venueObjectId, roomId, modified: updateResult.modifiedCount });
      } else {
        // Room doesn't exist, add it
        const addResult = await collection.updateOne(
          { _id: venueObjectId },
          { $push: { rooms: roomData } },
          { upsert: true }
        );
        
        upserted += addResult.upsertedId ? 1 : addResult.modifiedCount;
        logger.info('[enrich-static] Final room registry entry added', 
          { venue_id: venueObjectId, roomId, result: addResult });
      }
    }

    logger.info('[enrich-static] Final room registry entries batch upserted', 
      { venue_id: venueObjectId, upserted, skipped: skippedEntries.length });

    if (skippedEntries.length > 0) {
      logger.error('[enrich-static] Final registry entries missing roomId', 
        undefined, { venue_id, skippedEntries });
    }

    return { status: 'success', venue_id, upserted, skipped: skippedEntries.length };
  } catch (error) {
    logger.error('[enrich-static] Failed to upsert final room registry entry', 
      error as Error, { venue_id, registryEntries });
    return { status: 'error', error: (error as Error).message, venue_id, registryEntries };
  }
}