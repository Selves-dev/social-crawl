#!/usr/bin/env node
/**
 * Payload Schema Audit Script
 * 
 * Purpose: Compare actual MongoDB hotel documents against:
 * 1. Payload CMS schema definition
 * 2. TypeScript type definitions
 * 3. Target Schema.org structure
 * 
 * Usage:
 *   node scripts/audit-payload-schema.js
 *   
 * Environment:
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/s_payload)
 */

import { MongoClient } from 'mongodb';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 's_payload';
const COLLECTION_NAME = 'hotels';

// Expected Payload fields (from Hotels.ts)
const EXPECTED_HOTEL_FIELDS = [
  'name', 'slug', 'selves_id', 'contentLastUpdated',
  'booking_ids', 'identity', 'contact', 'location',
  'marketPosition', 'reviews', 'media', 'facilities',
  'foodAndBeverage', 'policies', 'security', 'sustainability', 'sources',
  'rooms', '_id', 'createdAt', 'updatedAt', '__v', '_status', 'locationSlug'
];

const EXPECTED_ROOM_FIELDS = [
  'roomName', 'roomId', 'roomSlug', 'identity', 'hierarchy',
  'pricingContext', 'wouldMatch', 'media', 'features',
  'reviewSnippets', 'policyOverrides', 'id'
];

// New fields from TypeScript but not in Payload
const TYPESCRIPT_ONLY_FIELDS = [
  'externalIds',  // Hotel level
  'references'    // Hotel level
];

// Target Schema.org fields (missing from current Payload)
const SCHEMA_ORG_TARGET_FIELDS = {
  hotel: [
    'accessibilityFeatures',
    'inclusivitySignals',
    'accessInformation',
    'containedInPlace',
    'nearbyAttraction',
    'additionalProperty',
    'potentialAction',
    'relatedLink'
  ],
  room: [
    'decisionDimensions',     // CRITICAL
    'tradeOffs',              // CRITICAL
    'requirements',           // CRITICAL
    'satisfactionPredictors',
    'usagePatterns',
    'comparableRooms'
  ]
};

async function auditSchema() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔍 Starting Payload Schema Audit...\n');
    console.log(`📊 Connecting to: ${MONGODB_URI}`);
    console.log(`📁 Database: ${DB_NAME}`);
    console.log(`📄 Collection: ${COLLECTION_NAME}\n`);
    
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Get total hotel count
    const totalCount = await collection.countDocuments();
    console.log(`✅ Found ${totalCount} hotels in database\n`);
    
    if (totalCount === 0) {
      console.log('❌ No hotels found in database. Nothing to audit.');
      return;
    }
    
    // Sample a few hotels for detailed analysis
    const sampleSize = Math.min(10, totalCount);
    const hotels = await collection.find({}).limit(sampleSize).toArray();
    
    console.log(`📋 Analyzing ${sampleSize} sample hotel(s)...\n`);
    
    // Analysis 1: Field presence across hotels
    const hotelFieldPresence = analyzeFieldPresence(hotels, EXPECTED_HOTEL_FIELDS, 'hotel');
    
    // Analysis 2: Room field presence
    const allRooms = hotels.flatMap(h => h.rooms || []);
    const roomFieldPresence = analyzeFieldPresence(allRooms, EXPECTED_ROOM_FIELDS, 'room');
    
    // Analysis 3: Check for TypeScript-only fields
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚨 CRITICAL GAP: TypeScript Fields NOT in Payload Schema');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    TYPESCRIPT_ONLY_FIELDS.forEach(field => {
      const count = hotels.filter(h => h[field] !== undefined).length;
      const percentage = ((count / hotels.length) * 100).toFixed(1);
      const status = count > 0 ? '⚠️' : '❌';
      console.log(`${status} ${field.padEnd(20)} | ${count}/${hotels.length} hotels (${percentage}%)`);
      
      if (count > 0) {
        console.log(`   ⚠️  WARNING: This field exists in DB but NOT in Payload schema!`);
        console.log(`   → Action: Add to selves-payload/src/collections/Hotels.ts\n`);
      }
    });
    
    // Analysis 4: Check for Schema.org target fields
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Schema.org Target Fields (AI-Critical)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('HOTEL LEVEL:');
    SCHEMA_ORG_TARGET_FIELDS.hotel.forEach(field => {
      const count = hotels.filter(h => h[field] !== undefined).length;
      const percentage = ((count / hotels.length) * 100).toFixed(1);
      const priority = ['accessibilityFeatures', 'inclusivitySignals'].includes(field) ? '🔥 HIGH' : '🟢 LOW';
      console.log(`  ${field.padEnd(25)} | ${count}/${hotels.length} (${percentage}%) | ${priority}`);
    });
    
    console.log('\nROOM LEVEL:');
    SCHEMA_ORG_TARGET_FIELDS.room.forEach(field => {
      const count = allRooms.filter(r => r[field] !== undefined).length;
      const percentage = allRooms.length > 0 ? ((count / allRooms.length) * 100).toFixed(1) : '0.0';
      const priority = ['decisionDimensions', 'tradeOffs', 'requirements'].includes(field) ? '🔥 CRITICAL' : 
                       ['satisfactionPredictors', 'comparableRooms'].includes(field) ? '🟡 HIGH' : '🟢 MEDIUM';
      console.log(`  ${field.padEnd(25)} | ${count}/${allRooms.length} (${percentage}%) | ${priority}`);
    });
    
    // Analysis 5: Field consistency check
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Data Quality Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check for hotels with no rooms
    const hotelsWithoutRooms = hotels.filter(h => !h.rooms || h.rooms.length === 0);
    console.log(`Hotels without rooms: ${hotelsWithoutRooms.length}/${hotels.length}`);
    if (hotelsWithoutRooms.length > 0) {
      console.log(`  ⚠️  Hotels with no rooms: ${hotelsWithoutRooms.map(h => h.name).join(', ')}`);
    }
    
    // Check for core field completeness
    const coreFields = ['identity', 'location', 'contact', 'facilities', 'policies'];
    const completeness = {};
    coreFields.forEach(field => {
      completeness[field] = hotels.filter(h => h[field] && Object.keys(h[field]).length > 0).length;
    });
    
    console.log('\nCore Field Completeness:');
    Object.entries(completeness).forEach(([field, count]) => {
      const percentage = ((count / hotels.length) * 100).toFixed(1);
      const status = percentage >= 80 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
      console.log(`  ${status} ${field.padEnd(15)} | ${count}/${hotels.length} (${percentage}%)`);
    });
    
    // Analysis 6: Sample hotel structure
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Sample Hotel Structure (First Hotel)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const firstHotel = hotels[0];
    console.log(`Hotel: ${firstHotel.name}`);
    console.log(`ID: ${firstHotel._id}`);
    console.log(`Rooms: ${firstHotel.rooms?.length || 0}\n`);
    
    console.log('Top-level keys present:');
    Object.keys(firstHotel).sort().forEach(key => {
      const type = typeof firstHotel[key];
      const value = Array.isArray(firstHotel[key]) ? `Array(${firstHotel[key].length})` : 
                    type === 'object' && firstHotel[key] !== null ? `Object(${Object.keys(firstHotel[key]).length} keys)` :
                    type === 'string' && firstHotel[key].length > 50 ? `String(${firstHotel[key].length} chars)` :
                    firstHotel[key];
      console.log(`  ${key.padEnd(25)} : ${value}`);
    });
    
    if (firstHotel.rooms && firstHotel.rooms.length > 0) {
      console.log('\nSample room keys:');
      Object.keys(firstHotel.rooms[0]).sort().forEach(key => {
        const type = typeof firstHotel.rooms[0][key];
        const value = Array.isArray(firstHotel.rooms[0][key]) ? `Array(${firstHotel.rooms[0][key].length})` : 
                      type === 'object' && firstHotel.rooms[0][key] !== null ? `Object(${Object.keys(firstHotel.rooms[0][key]).length} keys)` :
                      type;
        console.log(`  ${key.padEnd(25)} : ${value}`);
      });
    }
    
    // Summary and recommendations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Action Items Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('PRIORITY 1 - Add to Payload Schema (Week 1):');
    console.log('  • externalIds (if used by enrichment service)');
    console.log('  • references (if used by enrichment service)');
    console.log('  • decisionDimensions (room level) - CRITICAL for AI matching');
    console.log('  • tradeOffs (room level) - CRITICAL for AI matching');
    console.log('  • requirements (room level) - CRITICAL for AI matching');
    
    console.log('\nPRIORITY 2 - Add to Payload Schema (Week 2-3):');
    console.log('  • accessibilityFeatures (hotel level)');
    console.log('  • inclusivitySignals (hotel level)');
    console.log('  • satisfactionPredictors (room level)');
    console.log('  • comparableRooms (room level)');
    
    console.log('\nPRIORITY 3 - Nice to Have (When data available):');
    console.log('  • usagePatterns (room level - requires analytics)');
    console.log('  • accessInformation, nearbyAttraction (hotel level)');
    
    console.log('\n✅ Audit complete! See docs/PAYLOAD-SCHEMA-AUDIT.md for details.\n');
    
  } catch (error) {
    console.error('❌ Error during audit:', error);
    throw error;
  } finally {
    await client.close();
  }
}

function analyzeFieldPresence(documents, expectedFields, entityType) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 ${entityType.toUpperCase()} Field Presence Analysis`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const fieldStats = {};
  
  expectedFields.forEach(field => {
    const count = documents.filter(doc => doc[field] !== undefined).length;
    const percentage = documents.length > 0 ? ((count / documents.length) * 100).toFixed(1) : '0.0';
    fieldStats[field] = { count, percentage };
    
    const status = percentage >= 90 ? '✅' : percentage >= 50 ? '⚠️' : '❌';
    console.log(`${status} ${field.padEnd(25)} | ${count}/${documents.length} (${percentage}%)`);
  });
  
  return fieldStats;
}

// Run the audit
auditSchema().catch(console.error);
