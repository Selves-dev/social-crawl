/**
 * Test Typesense Connection and Search
 * 
 * Run this to verify your Typesense setup is working
 * node scripts/test-typesense-search.js
 */

import Typesense from 'typesense';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../config/.env.typesense') });

// Initialize client with SEARCH key (what frontend will use)
const searchClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: parseInt(process.env.TYPESENSE_PORT),
    protocol: process.env.TYPESENSE_PROTOCOL
  }],
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY,
  connectionTimeoutSeconds: 10
});

// Initialize admin client for collection info
const adminClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: parseInt(process.env.TYPESENSE_PORT),
    protocol: process.env.TYPESENSE_PROTOCOL
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  connectionTimeoutSeconds: 10
});

async function testConnection() {
  try {
    console.log('🔍 Testing Typesense connection...\n');
    
    // 1. Check health
    const health = await adminClient.health.retrieve();
    console.log('✅ Server Health:', health);
    
    // 2. Get collection info
    try {
      const collection = await adminClient.collections('hotels').retrieve();
      console.log('\n📊 Collection Info:');
      console.log('   Name:', collection.name);
      console.log('   Fields:', collection.fields.length);
      console.log('   Documents:', collection.num_documents);
      console.log('   Default sort:', collection.default_sorting_field);
      
      if (collection.num_documents === 0) {
        console.log('\n⚠️  No documents yet. Run backfill script to index hotels.');
        return;
      }
      
      // 3. Test simple search
      console.log('\n🔍 Testing search (using search-only key)...');
      const searchResults = await searchClient
        .collections('hotels')
        .documents()
        .search({
          q: '*',
          query_by: 'name',
          per_page: 3
        });
      
      console.log(`✅ Found ${searchResults.found} documents`);
      console.log('\nFirst 3 results:');
      searchResults.hits?.forEach((hit, i) => {
        console.log(`   ${i + 1}. ${hit.document.name} (${hit.document.city || 'Unknown city'})`);
      });
      
      // 4. Test semantic search
      if (searchResults.found > 0) {
        console.log('\n🎯 Testing semantic search...');
        const semanticResults = await searchClient
          .collections('hotels')
          .documents()
          .search({
            q: 'romantic hotel with views',
            query_by: 'name,idealFor,roomTags,nearbyPOIs,uniqueSellingPoints',
            per_page: 3
          });
        
        console.log(`Found ${semanticResults.found} results for "romantic hotel with views"`);
        semanticResults.hits?.slice(0, 3).forEach((hit, i) => {
          console.log(`   ${i + 1}. ${hit.document.name}`);
          if (hit.document.idealFor) {
            console.log(`      Ideal for: ${hit.document.idealFor.slice(0, 2).join(', ')}`);
          }
        });
      }
      
      // 5. Test filters
      console.log('\n🔧 Testing filters...');
      const filterResults = await searchClient
        .collections('hotels')
        .documents()
        .search({
          q: '*',
          query_by: 'name',
          filter_by: 'starRating:>=4',
          per_page: 3
        });
      
      console.log(`Found ${filterResults.found} hotels with 4+ stars`);
      
      console.log('\n✨ All tests passed! Typesense is ready.');
      
    } catch (error) {
      if (error.httpStatus === 404) {
        console.log('\n⚠️  Collection "hotels" not found.');
        console.log('   Run: npm run create-collection');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.httpStatus) {
      console.error('   HTTP Status:', error.httpStatus);
    }
    process.exit(1);
  }
}

testConnection();
