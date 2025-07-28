/**
 * MongoDB Atlas Database Connection
 * Handles database connections with connection pooling
 */

import { MongoClient, Db, MongoClientOptions } from 'mongodb'
import { logger } from './logger'

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
    const uri = process.env["MONGODB-URI"]
    if (!uri) {
      throw new Error('MONGODB-URI environment variable is required')
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
    return db.collection<T>(name)
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
