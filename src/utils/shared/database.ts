/**
 * Retrieve a venue by address and postcode
 */
export async function getVenue(name: string, address: string, postcode: string): Promise<Venue | null> {
  const collection = db.getCollection<Venue>('venues');
  return await collection.findOne({
    name,
    'location.address': address,
    'location.postcode': postcode
  });
}
import type { Venue } from './types';
export async function saveVenue(venue: Venue) {
  const collection = db.getCollection<Venue>('venues');
  // Use name+address+postcode as unique identifier for upsert
  const filter = {
    name: venue.name,
    'location.address': venue.location.address,
    'location.postcode': venue.location.postcode
  };
  const result = await collection.replaceOne(filter, venue, { upsert: true });
  logger.info('Saved venue to DB', {
    name: venue.name,
    address: venue.location.address,
    postcode: venue.location.postcode,
    upserted: result.upsertedId,
    modified: result.modifiedCount
  });
  return result;
}
/**
 * MongoDB Atlas Database Connection
 * Handles database connections with connection pooling
 */

import { MongoClient, Db, MongoClientOptions } from 'mongodb'
import type { Document } from 'mongodb'
import { logger } from './logger'
import { Perspective } from './types'

export interface DatabaseConfig {
  uri: string
  databaseName: string
  options?: MongoClientOptions
}

class DatabaseManager {
  private client: MongoClient | null = null
  private db: Db | null = null
  private isConnected = false

  /**
   * Get database configuration from environment
   */
  private getConfig(): DatabaseConfig {
    const uri = process.env["mongodb-uri"]
    if (!uri) {
      throw new Error('mongodb-uri environment variable is required')
    }

    // Extract database name from URI, with fallback
    const dbNameMatch = uri.match(/\.net\/([^?]+)/)
    const databaseName = dbNameMatch?.[1] || 'ta_crawler'

    const config: DatabaseConfig = {
      uri,
      databaseName,
      options: {
        maxPoolSize: 10,           // Connection pool size
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      }
    }

    return config
  }

  /**
   * Connect to MongoDB Atlas
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      logger.info('Database already connected', { service: 'database' })
      return
    }

    try {
      const config = this.getConfig()
      
      logger.info('🔌 Connecting to MongoDB Atlas...', {
        service: 'database',
        database: config.databaseName,
        poolSize: config.options?.maxPoolSize
      })

      this.client = new MongoClient(config.uri, config.options)
      await this.client.connect()
      
      // Test the connection
      await this.client.db('admin').command({ ping: 1 })
      
      this.db = this.client.db(config.databaseName)
      this.isConnected = true

      logger.info('✅ MongoDB Atlas connected successfully', {
        service: 'database',
        database: config.databaseName,
        poolSize: config.options?.maxPoolSize
      })

    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB Atlas', error as Error, {
        service: 'database'
      })
      throw error
    }
  }

  /**
   * Disconnect from MongoDB Atlas
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return
    }

    try {
      await this.client.close()
      this.client = null
      this.db = null
      this.isConnected = false

      logger.info('🔌 MongoDB Atlas disconnected', { service: 'database' })
    } catch (error) {
      logger.error('Failed to disconnect from MongoDB Atlas', error as Error, {
        service: 'database'
      })
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): Db {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.')
    }
    return this.db
  }

  /**
   * Check if database is connected
   */
  isConnectedStatus(): boolean {
    return this.isConnected
  }

  /**
   * Get collection with proper typing
   */
  getCollection<T = any>(name: string) {
    const db = this.getDatabase()
    return db.collection<T extends Document ? T : Document>(name)
  }

  /**
   * Health check for the database connection
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.client || !this.isConnected) {
      return { status: 'disconnected' }
    }

    try {
      const start = Date.now()
      await this.client.db('admin').command({ ping: 1 })
      const latency = Date.now() - start

      return { status: 'connected', latency }
    } catch (error) {
      logger.error('Database health check failed', error as Error, {
        service: 'database'
      })
      return { status: 'error' }
    }
  }
}

// Export singleton instance
export const db = new DatabaseManager()

// Export types
export { Db, Collection, MongoClient } from 'mongodb'

export async function savePerspective(perspective: Perspective) {
  const collection = db.getCollection<Perspective>('perspectives');
  
  // Use mediaId as the unique identifier for upsert operations
  // This way MongoDB will generate _id automatically for new documents
  const result = await collection.replaceOne(
    { mediaId: perspective.mediaId }, 
    perspective, 
    { upsert: true }
  );
  
  logger.info('Saved perspective to DB', { 
    mediaId: perspective.mediaId,
    upserted: result.upsertedId,
    modified: result.modifiedCount 
  });
}

export async function getPerspective(_id: string): Promise<Perspective | null> {
  const collection = db.getCollection<Perspective>('perspectives');
  // Ensure _id is an ObjectId for MongoDB queries
  const { ObjectId } = await import('mongodb');
  let objectId: any = _id;
  // Only convert if _id is a string and valid ObjectId
  if (typeof _id === 'string' && /^[a-fA-F0-9]{24}$/.test(_id)) {
    objectId = new ObjectId(_id);
  }
  return await collection.findOne({ _id: objectId });
}
