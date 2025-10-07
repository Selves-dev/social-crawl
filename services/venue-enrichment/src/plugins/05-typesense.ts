import { defineNitroPlugin } from 'nitropack/runtime'
import type { ChangeStreamDocument, ChangeStreamInsertDocument, ChangeStreamUpdateDocument } from 'mongodb'
import { db } from '../utils/shared/database'
import { typesenseManager } from '../utils/shared/typesense'
import { transformHotelForTypesense } from '../utils/shared/typesenseTransform'
import { logger } from '../utils/shared/logger'
import type { HotelDocument } from '../types/hotel'

/**
 * Typesense Sync Plugin - Two Collection Strategy
 * Initializes Typesense client and sets up MongoDB Change Stream
 * to automatically sync hotel documents to Typesense search indexes
 * 
 * TWO COLLECTIONS:
 * - hotels: Parent entities with aggregated stats
 * - rooms: Child entities with hotel_id reference
 */
export default defineNitroPlugin(async () => {
  // Initialize Typesense client
  typesenseManager.initialize()

  if (!typesenseManager.isReady()) {
    logger.warn('Typesense not configured - skipping Change Stream setup', {
      service: 'typesense-sync'
    })
    return
  }

  // Wait for database connection
  let retries = 0
  const maxRetries = 10
  while (!db.isConnectedStatus() && retries < maxRetries) {
    logger.info('⏳ Waiting for database connection before setting up Change Stream...', {
      service: 'typesense-sync',
      retry: retries + 1
    })
    await new Promise(resolve => setTimeout(resolve, 500))
    retries++
  }

  if (!db.isConnectedStatus()) {
    logger.error('❌ Database not connected - cannot set up Change Stream', undefined as any, {
      service: 'typesense-sync'
    })
    return
  }

  const hotelsDbName = process.env['hotels-db-name'] || 's_payload'

  try {
    // Get hotels database and collection
    const hotelsDb = db.getSpecificDatabase(hotelsDbName)
    const hotelsCollection = hotelsDb.collection<HotelDocument>('hotels')

    logger.info('🔍 Setting up MongoDB Change Stream for Typesense sync (Two Collection Strategy)', {
      service: 'typesense-sync',
      database: hotelsDbName,
      collection: 'hotels'
    })

    // Create change stream to watch for inserts and updates
    const changeStream = hotelsCollection.watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] }
        }
      }
    ], {
      fullDocument: 'updateLookup' // Get full document for updates
    })

    // Handle change stream events
    changeStream.on('change', async (change: ChangeStreamDocument<HotelDocument>) => {
      try {
        const operationType = change.operationType
        const documentId = 'documentKey' in change ? change.documentKey?._id : 'unknown'
        
        logger.info('📝 MongoDB Change Stream event detected', {
          service: 'typesense-sync',
          operationType,
          documentId
        })

        // Get the full hotel document
        let hotelDoc: HotelDocument | null = null

        if (operationType === 'insert') {
          hotelDoc = (change as ChangeStreamInsertDocument<HotelDocument>).fullDocument
        } else if (operationType === 'update' || operationType === 'replace') {
          hotelDoc = (change as ChangeStreamUpdateDocument<HotelDocument>).fullDocument || null
        }

        if (!hotelDoc) {
          logger.warn('No full document available for change stream event', {
            service: 'typesense-sync',
            operationType,
            documentId
          })
          return
        }

        // Transform hotel document to Typesense format (two collections)
        const { hotel, rooms } = transformHotelForTypesense(hotelDoc)

        if (!hotel) {
          logger.error('Failed to transform hotel document for Typesense', undefined as any, {
            service: 'typesense-sync',
            hotelId: hotelDoc._id
          })
          return
        }

        // Get Typesense client
        const client = typesenseManager.getClient()
        if (!client) {
          logger.error('Typesense client not available', undefined as any, {
            service: 'typesense-sync'
          })
          return
        }

        // Index hotel in hotels collection
        await client.collections('hotels').documents().upsert(hotel)

        logger.info('✅ Hotel document indexed in Typesense', {
          service: 'typesense-sync',
          hotelId: hotelDoc._id,
          hotelName: hotelDoc.name,
          operationType
        })

        // Index all rooms in rooms collection
        if (rooms.length > 0) {
          let successfulUpserts = 0
          let failedUpserts = 0
          
          // First upsert all rooms, tracking successes and failures
          const upsertResults = await Promise.allSettled(
            rooms.map(room => 
              client.collections('rooms').documents().upsert(room)
            )
          )

          // Count successes and failures
          upsertResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              successfulUpserts++
            } else {
              failedUpserts++
              logger.error('Failed to upsert room in Typesense', result.reason as Error, {
                service: 'typesense-sync',
                hotelId: hotel.id,
                roomId: rooms[index].id,
                roomName: rooms[index].room_name
              })
            }
          })

          // NOTE: We don't delete old rooms anymore since room IDs are now unique (hotelId-roomId)
          // The upsert operation will replace existing documents with the same ID
          // If room structure changes, we'd need a manual cleanup or collection recreation

          logger.info('✅ Room documents indexed in Typesense', {
            service: 'typesense-sync',
            hotelId: hotelDoc._id,
            successful: successfulUpserts,
            failed: failedUpserts,
            total: rooms.length,
            operationType
          })
        }

      } catch (error) {
        const documentId = 'documentKey' in change ? change.documentKey?._id : 'unknown'
        logger.error('Failed to sync hotel document to Typesense', error as Error, {
          service: 'typesense-sync',
          operationType: change.operationType,
          documentId
        })
      }
    })

    changeStream.on('error', (error: Error) => {
      logger.error('MongoDB Change Stream error', error, {
        service: 'typesense-sync'
      })
    })

    changeStream.on('end', () => {
      logger.warn('MongoDB Change Stream ended', {
        service: 'typesense-sync'
      })
    })

    logger.info('✅ MongoDB Change Stream active - Typesense sync enabled (Two Collections)', {
      service: 'typesense-sync',
      database: hotelsDbName,
      collection: 'hotels',
      strategy: 'hotels + rooms collections'
    })

  } catch (error) {
    logger.error('Failed to set up MongoDB Change Stream for Typesense sync', error as Error, {
      service: 'typesense-sync',
      database: hotelsDbName
    })
  }
})
