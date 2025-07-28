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
    cc: typeof record.cc === 'string' ? record.cc : '',
    queries: Array.isArray(record.queries) ? record.queries : [],
  }));

  const existingQueries = crawlData
    .map(entry => Array.isArray(entry.queries) ? entry.queries : [])
    .flat();

  return { crawlData, existingQueries };
}
