/**
 * Migration Script: Typesense → Elasticsearch
 * 
 * This script copies all hotels and rooms from Typesense to Elasticsearch
 * 
 * Usage:
 *   ES_ENDPOINT=https://your-endpoint ES_API_KEY=your-key node migrate-to-elasticsearch.js
 */

import { Client } from '@elastic/elasticsearch'
import Typesense from 'typesense'

// Elasticsearch setup
const ES_ENDPOINT = process.env.ES_ENDPOINT
const ES_API_KEY = process.env.ES_API_KEY

if (!ES_ENDPOINT || !ES_API_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   ES_ENDPOINT: Elasticsearch endpoint URL')
  console.error('   ES_API_KEY: Elasticsearch API key')
  process.exit(1)
}

const esClient = new Client({
  node: ES_ENDPOINT,
  auth: {
    apiKey: ES_API_KEY
  }
})

// Typesense setup (from your existing config)
const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108'),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http'
  }],
  apiKey: process.env.TYPESENSE_API_KEY || '',
  connectionTimeoutSeconds: 10
})

async function migrateCollection(collectionName, indexName) {
  console.log(`\n📦 Migrating ${collectionName} → ${indexName}...`)
  
  let page = 1
  let totalMigrated = 0
  const perPage = 250
  
  try {
    while (true) {
      // Fetch from Typesense
      const results = await typesenseClient
        .collections(collectionName)
        .documents()
        .search({
          q: '*',
          query_by: collectionName === 'hotels' ? 'name' : 'room_name',
          per_page: perPage,
          page: page
        })
      
      if (!results.hits || results.hits.length === 0) {
        break
      }
      
      // Prepare bulk operations for Elasticsearch
      const operations = results.hits.flatMap((hit) => {
        const doc = hit.document
        
        // Convert timestamps (Typesense uses unix timestamps in seconds, ES uses milliseconds)
        if (doc.created_at) {
          doc.created_at = new Date(doc.created_at * 1000).toISOString()
        }
        if (doc.updated_at) {
          doc.updated_at = new Date(doc.updated_at * 1000).toISOString()
        }
        if (doc.content_last_updated) {
          doc.content_last_updated = new Date(doc.content_last_updated * 1000).toISOString()
        }
        
        // Convert location from [lat, lon] array to {lat, lon} object if present
        if (doc.location && Array.isArray(doc.location)) {
          doc.location = {
            lat: doc.location[0],
            lon: doc.location[1]
          }
        }
        
        return [
          { index: { _index: indexName, _id: doc.id } },
          doc
        ]
      })
      
      // Bulk index to Elasticsearch
      const bulkResponse = await esClient.bulk({
        refresh: false,
        operations
      })
      
      if (bulkResponse.errors) {
        console.error('❌ Bulk indexing errors:', bulkResponse.items.filter(item => item.index?.error))
      }
      
      totalMigrated += results.hits.length
      console.log(`   ✓ Migrated ${totalMigrated} documents (page ${page})`)
      
      // Check if we've reached the end
      if (results.hits.length < perPage) {
        break
      }
      
      page++
    }
    
    console.log(`✅ Completed: ${totalMigrated} ${collectionName} migrated to ${indexName}`)
    
  } catch (error) {
    console.error(`❌ Error migrating ${collectionName}:`, error.message)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting Typesense → Elasticsearch migration...')
  console.log(`   Elasticsearch: ${ES_ENDPOINT}`)
  console.log(`   Typesense: ${process.env.TYPESENSE_HOST || 'localhost'}:${process.env.TYPESENSE_PORT || '8108'}`)
  
  try {
    // Test Elasticsearch connection
    const esInfo = await esClient.info()
    console.log(`✅ Connected to Elasticsearch ${esInfo.version.number}`)
    
    // Test Typesense connection
    const tsHealth = await typesenseClient.health.retrieve()
    console.log(`✅ Connected to Typesense (${tsHealth.ok ? 'healthy' : 'unhealthy'})`)
    
    // Migrate hotels
    await migrateCollection('hotels', 'hotels')
    
    // Migrate rooms
    await migrateCollection('rooms', 'rooms')
    
    // Refresh indices
    console.log('\n🔄 Refreshing indices...')
    await esClient.indices.refresh({ index: 'hotels,rooms' })
    
    // Get counts
    const hotelsCount = await esClient.count({ index: 'hotels' })
    const roomsCount = await esClient.count({ index: 'rooms' })
    
    console.log('\n✅ Migration complete!')
    console.log(`   Hotels: ${hotelsCount.count}`)
    console.log(`   Rooms: ${roomsCount.count}`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
