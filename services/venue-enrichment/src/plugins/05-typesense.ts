import { defineNitroPlugin } from 'nitropack/runtime'
import type { ChangeStreamDocument, ChangeStreamInsertDocument, ChangeStreamUpdateDocument } from 'mongodb'
import { db } from '../utils/shared/database'
import { typesenseManager } from '../utils/shared/typesense'
import { transformHotelForTypesense } from '../utils/shared/typesenseTransform'
import { logger } from '../utils/shared/logger'
import type { HotelDocument } from '../types/hotel'

/**
 * Typesense Sync Plugin
 * Initializes Typesense client and sets up MongoDB Change Stream
 * to automatically sync hotel documents to Typesense search index
 * Uses single 'hotels' collection with nested rooms
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

    logger.info('🔍 Setting up MongoDB Change Stream for Typesense sync', {
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

        // Transform hotel document to Typesense format
        const typesenseHotel = transformHotelForTypesense(hotelDoc)

        if (!typesenseHotel) {
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

        // Index hotel in hotels collection (includes nested rooms)
        await client.collections('hotels').documents().upsert(typesenseHotel)

        logger.info('✅ Hotel document indexed in Typesense', {
          service: 'typesense-sync',
          hotelId: hotelDoc._id,
          hotelName: hotelDoc.name,
          roomCount: hotelDoc.rooms?.length || 0,
          operationType
        })

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

    logger.info('✅ MongoDB Change Stream active - Typesense sync enabled', {
      service: 'typesense-sync',
      database: hotelsDbName,
      collection: 'hotels'
    })

  } catch (error) {
    logger.error('Failed to set up MongoDB Change Stream for Typesense sync', error as Error, {
      service: 'typesense-sync',
      database: hotelsDbName
    })
  }
})
