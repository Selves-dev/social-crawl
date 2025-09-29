import { db } from './database';
import { logger } from './logger';
import type { Perspective, Venue } from './types';
import { ObjectId } from 'mongodb';

// PERSPECTIVE OPERATIONS
export async function savePerspectiveFull(perspective: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  const result = await collection.replaceOne(
    { permalink: perspective.permalink }, 
    perspective, 
    { upsert: true }
  );
  return result;
}

export async function upsertPerspective(newPerspective: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  
  // Check for duplicate by mediaId OR permalink
  const existing = await collection.findOne({
    $or: [
      { mediaId: newPerspective.mediaId },
      { permalink: newPerspective.permalink }
    ]
  });
  
  if (existing) {
    // Merge venues intelligently - remove venues without venueId if there's a linked version
    const allVenues = [...(existing.venues || []), ...(newPerspective.venues || [])];
    const cleanedVenues = mergeVenues(allVenues);
    
    const merged = {
      ...existing,
      ...newPerspective,
      mediaDescription: mergeArrays(existing.mediaDescription, newPerspective.mediaDescription),
      venues: cleanedVenues,
      locations: mergeLocationsByName(existing.locations, newPerspective.locations),
      updatedAt: new Date().toISOString()
    };
    return await collection.replaceOne({ _id: existing._id }, merged);
  }
  
  return await collection.insertOne({
    ...newPerspective,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function findPerspectiveByPermalink(permalink: string): Promise<Perspective | null> {
  return await db.getCollection<Perspective>('perspectives').findOne({ permalink });
}

export async function findPerspectiveByMediaId(mediaId: string): Promise<Perspective | null> {
  return await db.getCollection<Perspective>('perspectives').findOne({ mediaId });
}

export async function addQueryToPerspective(permalink: string, query: string, newPerspective?: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  const existing = await collection.findOne({ permalink });
  
  if (existing) {
    const queries = existing.context?.w || [];
    if (!queries.includes(query)) {
      await collection.updateOne({ permalink }, { $set: { 'context.w': [...queries, query] } });
    }
  } else if (newPerspective) {
    await collection.insertOne(newPerspective);
  } else {
    throw new Error('Perspective not found and no fallback provided');
  }
}

export async function getQueriesForPermalink(permalink: string): Promise<string[]> {
  const perspective = await findPerspectiveByPermalink(permalink);
  return perspective?.context?.w || [];
}

// VENUE OPERATIONS
export async function saveVenue(venue: any, mediaId?: string) {
  const collection = db.getCollection<Venue>('venues');
  
  // Check for duplicates by name + zipcode OR name + coordinates
  const duplicateQuery = {
    name: venue.name,
    $or: [
      { 'location.zipcode': venue.location?.zipcode },
      ...(venue.location?.lat && venue.location?.lon ? [{
        'location.lat': { $gte: venue.location.lat - 0.001, $lte: venue.location.lat + 0.001 },
        'location.lon': { $gte: venue.location.lon - 0.001, $lte: venue.location.lon + 0.001 }
      }] : [])
    ]
  };
  
  const existing = await collection.findOne(duplicateQuery);
  
  if (existing) {
    // Merge mediaIds - handle legacy venues that might have single mediaId
    const existingMediaIds = existing.mediaIds || [];
    if (mediaId && !existingMediaIds.includes(mediaId)) {
      existingMediaIds.push(mediaId);
    }
    
    const merged = { 
      ...existing, 
      ...venue, 
      _id: existing._id,
      mediaIds: existingMediaIds,
      updatedAt: new Date().toISOString()
    };
    
    await collection.replaceOne({ _id: existing._id }, merged);
    if (mediaId) await linkVenueToPerspective(existing._id.toString(), mediaId, venue.name);
    return existing._id;
  }
  
  // Create new venue
  if (mediaId) {
    venue.mediaIds = [mediaId];
    venue.createdAt = new Date().toISOString();
  }
  
  const result = await collection.insertOne(venue);
  if (mediaId && result.insertedId) {
    await linkVenueToPerspective(result.insertedId.toString(), mediaId, venue.name);
  }
  
  return result.insertedId;
}

export async function getVenue(name: string, address: string, zipcode: string): Promise<Venue | null> {
  return await db.getCollection<Venue>('venues').findOne({
    name,
    'location.address': address,
    'location.zipcode': zipcode
  });
}

export async function getVenuesByMediaId(mediaId: string): Promise<Venue[]> {
  return await db.getCollection<Venue>('venues').find({ mediaIds: mediaId }).toArray();
}

export async function getPerspectivesByVenueId(venueId: string): Promise<Perspective[]> {
  return await db.getCollection<Perspective>('perspectives').find({ 'venues.venueId': venueId }).toArray();
}

// LINKING OPERATIONS
export async function linkVenueToPerspective(venueId: string, mediaId: string, venueName: string) {
  try {
    // Add venue to perspective
    const perspectiveResult = await db.getCollection<Perspective>('perspectives').findOneAndUpdate(
      { mediaId },
      { 
        $addToSet: { 
          venues: { name: venueName, venueId, confidence: 0.99 }
        },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: 'after' }
    );
    
    // Check if perspective was found
    if (!perspectiveResult) {
      logger.warn('[linkVenueToPerspective] No perspective found with mediaId', { 
        mediaId, 
        venueId, 
        venueName 
      });
      return; // Exit gracefully - venue is still saved, just not linked
    }
    
    logger.debug('[linkVenueToPerspective] Successfully linked venue to perspective', {
      venueId,
      perspectiveId: perspectiveResult._id.toString(),
      mediaId,
      venueName
    });
  } catch (error) {
    logger.error('Failed to link venue to perspective', error instanceof Error ? error : new Error(String(error)), { venueId, mediaId });
  }
}

// UTILITY FUNCTIONS
function mergeArrays(existing: any[] = [], incoming: any[] = []): any[] {
  const merged = [...existing];
  incoming.forEach(item => {
    if (item && !merged.includes(item)) merged.push(item);
  });
  return merged;
}

function mergeVenues(venues: Array<{ name: string; confidence: number; venueId?: string }> = []): Array<{ name: string; confidence: number; venueId?: string }> {
  const venueMap = new Map<string, { name: string; confidence: number; venueId?: string }>();
  
  // Process all venues, keeping the one with highest confidence
  // If there's a venue with venueId and one without for the same name, keep the one with venueId
  venues.forEach(venue => {
    const key = venue.name.toLowerCase().trim();
    const existing = venueMap.get(key);
    
    if (!existing) {
      venueMap.set(key, venue);
    } else {
      // Prefer venue with venueId
      if (venue.venueId && !existing.venueId) {
        venueMap.set(key, venue);
      } else if (!venue.venueId && existing.venueId) {
        // Keep existing (which has venueId)
        return;
      } else {
        // Both have venueId or both don't - keep higher confidence
        if (venue.confidence > existing.confidence) {
          venueMap.set(key, venue);
        }
      }
    }
  });
  
  return Array.from(venueMap.values());
}

function mergeLocationsByName(existing: any[] = [], incoming: any[] = []): any[] {
  const merged = [...existing];
  incoming.forEach(location => {
    if (!merged.some(l => l.name === location.name)) {
      merged.push(location);
    }
  });
  return merged;
}
