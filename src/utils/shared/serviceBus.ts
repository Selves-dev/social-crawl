/**
 * Send a message to the main postman queue
 */
import { getSecurityManager } from './security'

export async function sendPostmanMessage(message: any, queueName?: string): Promise<void> {
  const sender = serviceBus.createQueueSender(queueName)
  const security = getSecurityManager()
  const applicationProperties = security.addMessageSecurity({
    ...(message?.type && { type: message.type })
  })
  await sender.sendMessages({
    body: message,
    contentType: 'application/json',
    messageId: message?.id || undefined,
    applicationProperties
  })
}
/**
 * Azure Service Bus Utilities (Basic Tier - Queue Only)
 * Handles Azure Service Bus connections and queue operations
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
      logger.info('Connecting to postman (Azure Service Bus)...', { service: 'postman' })
      
      this.config = config
      this.client = new ServiceBusClient(config.connectionString)
      
      // Test the connection by creating a sender (this will validate the connection)
      const testSender = this.client.createSender(config.queueName)
      await testSender.close()
      
      logger.info('✅ Postman connection established', { 
        service: 'postman',
        queueName: config.queueName,
        tier: 'Basic'
      })
    } catch (error) {
      logger.error('❌ Failed to connect to postman', error as Error, { service: 'postman' })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.config = null
      logger.info('Postman connection closed', { service: 'postman' })
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
  const connectionString = process.env["AZURE-SERVICE-BUS-CONNECTION-STRING"]
  const queueName = process.env["ASB-POST-OFFICE-QUEUE"]
  
  if (!connectionString) {
    throw new Error('AZURE-SERVICE-BUS-CONNECTION-STRING environment variable is required')
  }
  
  if (!queueName) {
    throw new Error('ASB-POST-OFFICE-QUEUE environment variable is required')
  }

  return {
    connectionString,
    queueName,
    maxConcurrentCalls: process.env["ASB-MAX-CONCURRENT-CALLS"] 
      ? parseInt(process.env["ASB-MAX-CONCURRENT-CALLS"], 10) 
      : 10,
    maxAutoRenewDurationMinutes: process.env["ASB-MAX-AUTO-RENEW-DURATION-MINUTES"]
      ? parseInt(process.env["ASB-MAX-AUTO-RENEW-DURATION-MINUTES"], 10)
      : 5
  }
}

export const analyseMediaQueueName = process.env["ASB-ANALYSE-MEDIA-QUEUE"] || 'analyse-media';
