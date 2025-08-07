import { db } from './database';
import { logger } from './logger';
import type { Perspective, Venue } from './types';
import stringSimilarity from 'string-similarity';

/**
 * Upsert a full perspective document (overwrite or create)
 */
export async function savePerspectiveFull(perspective: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  // Use permalink as unique identifier for upsert
  const filter = { permalink: perspective.permalink };
  const result = await collection.replaceOne(filter, perspective, { upsert: true });
  logger.info('Saved full perspective to DB', {
    permalink: perspective.permalink,
    upserted: result.upsertedId,
    modified: result.modifiedCount
  });
  return result;
}

/**
 * Smart upsert for perspectives that appends to arrays and preserves existing data
 * Uses mediaId as the unique identifier since each media item should have its own perspective
 */
export async function upsertPerspectiveSmartly(newPerspective: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  const existing = await collection.findOne({ mediaId: newPerspective.mediaId });
  
  if (existing) {
    // Merge arrays intelligently
    const mediaDescriptions = Array.isArray(existing.mediaDescription) ? existing.mediaDescription : [];
    const audioDescriptions = Array.isArray(existing.audioDescription) ? existing.audioDescription : [];
    const venues = Array.isArray(existing.venues) ? existing.venues : [];
    const locations = Array.isArray(existing.locations) ? existing.locations : [];
    
    // Add new mediaDescription entries if provided and not already present
    if (Array.isArray(newPerspective.mediaDescription)) {
      newPerspective.mediaDescription.forEach(desc => {
        if (desc && !mediaDescriptions.includes(desc)) {
          mediaDescriptions.push(desc);
        }
      });
    }
    
    // Merge venues (simple append for now - duplicates handled in saveVenue)
    if (Array.isArray(newPerspective.venues)) {
      newPerspective.venues.forEach(venue => {
        venues.push(venue);
      });
    }
    
    // Merge locations (avoid duplicates by name)
    if (Array.isArray(newPerspective.locations)) {
      newPerspective.locations.forEach(location => {
        if (!locations.some(l => l.name === location.name)) {
          locations.push(location);
        }
      });
    }
    
    // Update with merged data
    const updatedPerspective = {
      ...existing,
      ...newPerspective,
      mediaDescription: mediaDescriptions,
      audioDescription: audioDescriptions,
      venues,
      locations,
      updatedAt: new Date().toISOString()
    };
    
    const result = await collection.replaceOne({ mediaId: newPerspective.mediaId }, updatedPerspective);
    logger.info('Smart upserted perspective to DB', {
      mediaId: newPerspective.mediaId,
      permalink: newPerspective.permalink,
      mediaDescriptions: mediaDescriptions.length,
      venues: venues.length,
      locations: locations.length,
      modified: result.modifiedCount
    });
    return result;
  } else {
    // Create new with arrays properly initialized
    const newDoc = {
      ...newPerspective,
      mediaDescription: Array.isArray(newPerspective.mediaDescription) ? newPerspective.mediaDescription : [],
      audioDescription: Array.isArray(newPerspective.audioDescription) ? newPerspective.audioDescription : [],
      venues: Array.isArray(newPerspective.venues) ? newPerspective.venues : [],
      locations: Array.isArray(newPerspective.locations) ? newPerspective.locations : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await collection.insertOne(newDoc);
    logger.info('Created new perspective with smart upsert', {
      mediaId: newPerspective.mediaId,
      permalink: newPerspective.permalink,
      insertedId: result.insertedId
    });
    return result;
  }
}

export async function findPerspectiveByPermalink(permalink: string): Promise<Perspective | null> {
  const collection = db.getCollection<Perspective>('perspectives');
  return await collection.findOne({ permalink });
}

export async function findPerspectiveByMediaId(mediaId: string): Promise<Perspective | null> {
  const collection = db.getCollection<Perspective>('perspectives');
  return await collection.findOne({ mediaId });
}

export async function addQueryToPerspective(permalink: string, query: string, newPerspective?: Perspective): Promise<void> {
  const collection = db.getCollection<Perspective>('perspectives');
  const perspective = await collection.findOne({ permalink });
  if (perspective) {
    let queries: string[] = Array.isArray(perspective.context?.w)
      ? perspective.context.w
      : [];
    if (!queries.includes(query)) {
      queries.push(query);
      await collection.updateOne({ permalink }, { $set: { 'context.w': queries } });
      logger.info('Added query to existing perspective', { permalink, query });
    }
  } else {
    if (!newPerspective) {
      throw new Error('Full Perspective object required to create new perspective');
    }
    await collection.insertOne(newPerspective);
    logger.info('Created new perspective with full object', { permalink, query });
  }
}

export async function getQueriesForPermalink(permalink: string): Promise<string[]> {
  const collection = db.getCollection<Perspective>('perspectives');
  const perspective = await collection.findOne({ permalink });
  if (Array.isArray(perspective?.context?.w)) return perspective.context.w;
  return [];
}

/**
 * Venue business logic
 */
export async function getVenue(name: string, address: string, postcode: string): Promise<Venue | null> {
  const collection = db.getCollection<Venue>('venues');
  return await collection.findOne({
    name,
    'location.address': address,
    'location.postcode': postcode
  });
}

export async function saveVenue(venue: Venue) {
  const collection = db.getCollection<Venue>('venues');
  
  // Check for existing venues with fuzzy matching on name and postcode
  const existingVenues = await collection.find({}).toArray();
  const venueName = venue.name || '';
  const venuePostcode = venue.location?.postcode || '';
  
  let bestScore = 0;
  let bestMatch: any = null;
  
  for (const existing of existingVenues) {
    const existingName = existing.name || '';
    const existingPostcode = existing.location?.postcode || '';
    
    // Fuzzy match on name
    const nameScore = stringSimilarity.compareTwoStrings(
      existingName.toLowerCase(),
      venueName.toLowerCase()
    );
    
    // If both have postcodes, use combined name+postcode match
    let combinedScore = nameScore;
    if (existingPostcode && venuePostcode) {
      const combinedA = `${existingName} ${existingPostcode}`.toLowerCase();
      const combinedB = `${venueName} ${venuePostcode}`.toLowerCase();
      combinedScore = stringSimilarity.compareTwoStrings(combinedA, combinedB);
    }
    
    const score = Math.max(nameScore, combinedScore);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = existing;
    }
  }
  
  // If best match is above threshold, update existing venue
  if (bestScore >= 0.85 && bestMatch) {
    const filter = { _id: bestMatch._id };
    const result = await collection.replaceOne(filter, venue);
    logger.info('Updated existing venue with fuzzy match', {
      name: venue.name,
      bestScore,
      matchedName: bestMatch.name,
      modified: result.modifiedCount
    });
    return result;
  }
  
  // Otherwise create new venue
  const result = await collection.insertOne(venue);
  logger.info('Saved new venue to DB', {
    name: venue.name,
    address: venue.location.address,
    postcode: venue.location.postcode,
    insertedId: result.insertedId
  });
  return result;
}
