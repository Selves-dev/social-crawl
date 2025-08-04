import { logger } from '../../shared/logger';
/**
 * Upserts location data: adds new queries to existing location, or creates if not present.
 */
export async function upsertLocationData({ location, countryCode, queries}: {
  location: string;
  countryCode: string;
  queries: string[];
}) {
  if (!db.isConnectedStatus()) {
    logger.error('[upsertLocationData] Database not connected. Call connect() first.', new Error(`location: ${location}, countryCode: ${countryCode}, queries: ${JSON.stringify(queries)}`));
    throw new Error('Database not connected. Call connect() first.');
  }
  const collection = db.getCollection('locations');
  logger.debug('[upsertLocationData] Got collection', { collectionName: 'locations' });
  // Log all locations for debugging
  const allLocations = await collection.find({}).toArray();
  const filter = { location: location.trim(), countryCode: countryCode.trim() };
  // Log the result of the filter before upsert
  const matched = await collection.find(filter).toArray();
  const update = {
    $addToSet: { queries: { $each: queries } },
    $setOnInsert: { venuesFound: 1 },
    $set: {
      timestamp: new Date().toISOString()
    }
  };
  const options = { upsert: true };
  try {
    const result = await collection.updateOne(filter, update, options);
    if (result.upsertedCount > 0) {
      logger.debug(`[upsertLocationData] Inserted new location: ${location}, ${countryCode}`);
    } else if (result.modifiedCount > 0) {
      logger.debug(`[INFO][upsertLocationData] Updated location: ${location}, ${countryCode}`);
    } else {
      logger.debug(`[upsertLocationData] No changes made for location: ${location}, ${countryCode}`);
    }
  } catch (err) {
    logger.error(`[upsertLocationData] Error upserting location: ${location}, ${countryCode}`);
    logger.error('[upsertLocationData] Error details:', err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}
import { db } from '../../shared/database';


export async function handleLocationData(collectionName: string) {
  if (!db.isConnectedStatus()) {
    throw new Error('Database not connected. Call connect() first.')
  }
  const collection = db.getCollection(collectionName);
  const crawlRecords = await collection.find({}).toArray();

  const crawlData = crawlRecords.map(record => ({
    l: typeof record.location === 'string' ? record.location.trim() : '',
    vF: typeof record.venuesFound === 'number' ? record.venuesFound : 0,
    cc: typeof record.countryCode === 'string' ? record.countryCode : '',
    queries: Array.isArray(record.queries) ? record.queries : [],
  }));

  const existingQueries = crawlData
    .map(entry => Array.isArray(entry.queries) ? entry.queries : [])
    .flat();

  return { crawlData, existingQueries };
}
