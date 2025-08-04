const { MongoClient } = require('mongodb');

const uri = process.env.COSMOSDB_URI || '<YOUR_COSMOSDB_CONNECTION_STRING>';
const dbName = 'social-crawl'; // Use your actual DB name
const collectionName = 'locations';

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.updateMany(
      {},
      { $set: { venuesFound: 1 } }
    );
    console.log(`Updated ${result.modifiedCount} records (venuesFound => 1)`);
  } catch (err) {
    console.error('Error updating venuesFound:', err);
  } finally {
    await client.close();
  }
})();
