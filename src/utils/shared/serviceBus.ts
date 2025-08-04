/**
 * Azure Service Bus Client Manager
 * Pure infrastructure layer - handles Azure Service Bus connections only
 * No business logic or message routing
 */

import { ServiceBusClient, ServiceBusReceiver, ServiceBusSender } from '@azure/service-bus'
import { logger } from './logger'

export interface ServiceBusConfig {
  connectionString: string
  queueName: string
  maxConcurrentCalls?: number
  maxAutoRenewDurationMinutes?: number
}

class ServiceBusManager {
  private client: ServiceBusClient | null = null
  private config: ServiceBusConfig | null = null

  async connect(config: ServiceBusConfig): Promise<void> {
    try {
      logger.info('Connecting to Azure Service Bus...', { service: 'service-bus' })
      
      this.config = config
      this.client = new ServiceBusClient(config.connectionString)
      
      // Test the connection by creating a sender (this will validate the connection)
      const testSender = this.client.createSender(config.queueName)
      await testSender.close()
      
      logger.info('✅ Service Bus connection established', { 
        service: 'service-bus',
        queueName: config.queueName,
        tier: 'Basic'
      })
    } catch (error) {
      logger.error('❌ Failed to connect to Service Bus', error as Error, { service: 'service-bus' })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.config = null
      logger.info('Service Bus connection closed', { service: 'service-bus' })
    }
  }

  createQueueSender(queueName?: string): ServiceBusSender {
    if (!this.client) {
      throw new Error('Service Bus client not connected. Call connect() first.')
    }
    const queue = queueName || this.config?.queueName
    if (!queue) {
      throw new Error('Queue name not provided')
    }
    return this.client.createSender(queue)
  }

  createQueueReceiver(queueName?: string): ServiceBusReceiver {
    if (!this.client) {
      throw new Error('Service Bus client not connected. Call connect() first.')
    }
    const queue = queueName || this.config?.queueName
    if (!queue) {
      throw new Error('Queue name not provided')
    }
    return this.client.createReceiver(queue)
  }

  isConnected(): boolean {
    return this.client !== null
  }

  getQueueName(): string | undefined {
    return this.config?.queueName
  }
}

// Export singleton instance
export const serviceBus = new ServiceBusManager()

// Helper function to get config from environment variables
export function getServiceBusConfigFromEnv(): ServiceBusConfig {
  const connectionString = process.env["azure-service-bus-connection-string"]
  const queueName = process.env["asb-post-office-queue"]  // Always post-office queue
  
  if (!connectionString) {
    throw new Error('AZURE-SERVICE-BUS-CONNECTION-STRING environment variable is required')
  }
  
  if (!queueName) {
    throw new Error('ASB-POST-OFFICE-QUEUE environment variable is required')
  }

  return {
    connectionString,
    queueName,
    maxConcurrentCalls: process.env["asb-max-concurrent-calls"] 
      ? parseInt(process.env["asb-max-concurrent-calls"], 10) 
      : 10,
    maxAutoRenewDurationMinutes: process.env["asb-max-auto-renew-duration-minutes"]
      ? parseInt(process.env["asb-max-auto-renew-duration-minutes"], 10)
      : 5
  }
}
