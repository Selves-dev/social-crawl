/**
 * Upserts location data: adds new queries to existing location, or creates if not present.
 */
export async function upsertLocationData({ location, countryCode, queries, aiResponse }: {
  location: string;
  countryCode: string;
  queries: string[];
}) {
  if (!db.isConnectedStatus()) {
    throw new Error('Database not connected. Call connect() first.')
  }
  const collection = db.getCollection('locations');
  await collection.updateOne(
    { location, countryCode },
    {
      $addToSet: { queries: { $each: queries } },
      $setOnInsert: { venuesFound: 0 },
      $set: {
        timestamp: new Date().toISOString()
      }
    },
    { upsert: true }
  );
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
