import { MongoClient } from 'mongodb';

const client = new MongoClient("mongodb+srv://yond-info:0gVh89H6CxYjVRIi@yond.fhg1was.mongodb.net/?retryWrites=true&w=majority&appName=Yond");

async function checkHotel() {
  try {
    await client.connect();
    const db = client.db('s_payload');
    const hotel = await db.collection('hotels').findOne({ 
      name: "Millennium Hotel London Knightsbridge" 
    });
    
    console.log('\n🔍 HOTEL TOP-LEVEL FIELDS:');
    console.log(Object.keys(hotel).sort().join('\n'));
    
    console.log('\n\n🏠 EXTERNAL IDS:');
    console.log(JSON.stringify(hotel.externalIds, null, 2));
    
    console.log('\n\n🔗 REFERENCES:');
    console.log(JSON.stringify(hotel.references, null, 2));
    
    console.log('\n\n🚪 FIRST ROOM FIELDS:');
    console.log(Object.keys(hotel.rooms[0]).sort().join('\n'));
    
    console.log('\n\n📊 ROOM DATA CONFIDENCE:');
    console.log(JSON.stringify(hotel.rooms[0].dataConfidence, null, 2));
    
  } finally {
    await client.close();
  }
}

checkHotel().catch(console.error);
