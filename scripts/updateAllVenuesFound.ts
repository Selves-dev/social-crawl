import { MongoClient } from 'mongodb';

// Use your actual CosmosDB connection string here or set as env var COSMOSDB_URI
const uri = process.env.COSMOSDB_URI || '<YOUR_COSMOSDB_CONNECTION_STRING>';
const dbName = 'social-crawl'; // Use your actual DB name
const collectionName = 'locations';

async function updateAllVenuesFound() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    // Update all records where venuesFound is 0 to be 1
    const result = await collection.updateMany(
      { venuesFound: 0 },
      { $set: { venuesFound: 1 } }
    );
    console.log(`Updated ${result.modifiedCount} records (venuesFound: 0 => 1)`);
  } catch (err) {
    console.error('Error updating venuesFound:', err);
  } finally {
    await client.close();
  }
}

updateAllVenuesFound();
