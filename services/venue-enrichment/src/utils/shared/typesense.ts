import Typesense from 'typesense'
import type { Client } from 'typesense'
import { logger } from './logger'

/**
 * Typesense Client Manager
 * Handles connection to Typesense Cloud for search indexing
 */
class TypesenseManager {
  private client: Client | null = null
  private isInitialized = false

  /**
   * Initialize Typesense client
   */
  initialize(): void {
    if (this.isInitialized && this.client) {
      logger.info('Typesense client already initialized', { service: 'typesense' })
      return
    }

    const host = process.env['typesense-host']
    const port = process.env['typesense-port']
    const protocol = process.env['typesense-protocol']
    const apiKey = process.env['typesense-api-key']

    if (!host || !port || !protocol || !apiKey) {
      logger.warn('Typesense configuration missing - search indexing disabled', {
        service: 'typesense',
        hasHost: !!host,
        hasPort: !!port,
        hasProtocol: !!protocol,
        hasApiKey: !!apiKey
      })
      return
    }

    try {
      this.client = new Typesense.Client({
        nodes: [{
          host,
          port: parseInt(port, 10),
          protocol
        }],
        apiKey,
        connectionTimeoutSeconds: 5,
        retryIntervalSeconds: 0.1,
        numRetries: 3,
        logLevel: 'info'
      })

      this.isInitialized = true
      
      logger.info('✅ Typesense client initialized', {
        service: 'typesense',
        host,
        port,
        protocol
      })
    } catch (error) {
      logger.error('❌ Failed to initialize Typesense client', error as Error, {
        service: 'typesense'
      })
    }
  }

  /**
   * Get Typesense client instance
   */
  getClient(): Client | null {
    return this.client
  }

  /**
   * Check if Typesense is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null
  }

  /**
   * Health check for Typesense connection
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.client || !this.isInitialized) {
      return { status: 'disabled' }
    }

    try {
      const start = Date.now()
      await this.client.health.retrieve()
      const latency = Date.now() - start

      return { status: 'healthy', latency }
    } catch (error) {
      logger.error('Typesense health check failed', error as Error, {
        service: 'typesense'
      })
      return { status: 'error' }
    }
  }
}

// Export singleton instance
export const typesenseManager = new TypesenseManager()
