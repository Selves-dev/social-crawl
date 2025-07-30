/**
 * Upserts location data: adds new queries to existing location, or creates if not present.
 */
export async function upsertLocationData({ location, countryCode, queries}: {
  location: string;
  countryCode: string;
  queries: string[];
}) {
  console.info('[upsertLocationData] START', { location, countryCode, queries });
  if (!db.isConnectedStatus()) {
    console.error('[upsertLocationData] Database not connected. Call connect() first.', { location, countryCode, queries });
    throw new Error('Database not connected. Call connect() first.');
  }
  const collection = db.getCollection('locations');
  console.info('[upsertLocationData] Got collection', { collectionName: 'locations' });
  // Log all locations for debugging
  const allLocations = await collection.find({}).toArray();
  console.info('[upsertLocationData] All locations:', allLocations);
  const filter = { location: location.trim(), countryCode: countryCode.trim() };
  // Log the result of the filter before upsert
  const matched = await collection.find(filter).toArray();
  console.info('[upsertLocationData] Matched locations for filter:', matched);
  const update = {
    $addToSet: { queries: { $each: queries } },
    $setOnInsert: { venuesFound: 0 },
    $set: {
      timestamp: new Date().toISOString()
    }
  };
  const options = { upsert: true };
  console.info('[upsertLocationData] UpdateOne filter:', filter);
  console.info('[upsertLocationData] UpdateOne update:', update);
  console.info('[upsertLocationData] UpdateOne options:', options);
  try {
    const result = await collection.updateOne(filter, update, options);
    console.info('[upsertLocationData] updateOne result:', result);
    if (result.upsertedCount > 0) {
      console.info(`[upsertLocationData] Inserted new location: ${location}, ${countryCode}`);
    } else if (result.modifiedCount > 0) {
      console.info(`[upsertLocationData] Updated location: ${location}, ${countryCode}`);
    } else {
      console.warn(`[upsertLocationData] No changes made for location: ${location}, ${countryCode}`);
    }
  } catch (err) {
    console.error(`[upsertLocationData] Error upserting location: ${location}, ${countryCode}`);
    console.error('[upsertLocationData] Error details:', err);
    throw err;
  }
  console.info('[upsertLocationData] END', { location, countryCode });
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
