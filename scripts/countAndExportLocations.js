// countAndExportLocations.js
// Usage: node scripts/countAndExportLocations.js
// Prints count of records with venuesFound: 0 and exports all records to locations_export.json

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = process.env.COSMOSDB_URI || process.env['mongodb-uri'];
if (!uri) {
  console.error('No CosmosDB URI found in environment variables.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('ta_crawler'); // Match application code default database name
    const collection = db.collection('locations');
    // Update all venuesFound fields to 1
    const updateResult = await collection.updateMany({}, { $set: { venuesFound: 1 } });
    console.log(`Updated ${updateResult.modifiedCount} records (venuesFound => 1)`);

    // Export all records after update
    const allRecords = await collection.find({}).toArray();
    fs.writeFileSync('locations_export.json', JSON.stringify(allRecords, null, 2));
    console.log(`Exported ${allRecords.length} records to locations_export.json`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
