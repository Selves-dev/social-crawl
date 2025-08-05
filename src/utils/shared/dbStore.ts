import { db } from './database';
import { logger } from './logger';
import type { Perspective, Venue } from './types';

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

export async function findPerspectiveByPermalink(permalink: string): Promise<Perspective | null> {
  const collection = db.getCollection<Perspective>('perspectives');
  return await collection.findOne({ permalink });
}

export async function addQueryToPerspective(permalink: string, query: string, newPerspective?: Perspective): Promise<void> {
  const collection = db.getCollection<Perspective>('perspectives');
  const perspective = await collection.findOne({ permalink });
  if (perspective) {
    let queries: string[] = Array.isArray(perspective.context?.w)
      ? perspective.context.w
      : typeof perspective.context?.w === 'string' && perspective.context.w.trim() !== ''
        ? [perspective.context.w]
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
  if (typeof perspective?.context?.w === 'string' && perspective.context.w.trim() !== '') return [perspective.context.w];
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
  // Use name+address+postcode as unique identifier for upsert
  const filter = {
    name: venue.name,
    'location.address': venue.location.address,
    'location.postcode': venue.location.postcode
  };
  const result = await collection.replaceOne(filter, venue, { upsert: true });
  logger.info('Saved venue to DB', {
    name: venue.name,
    address: venue.location.address,
    postcode: venue.location.postcode,
    upserted: result.upsertedId,
    modified: result.modifiedCount
  });
  return result;
}
