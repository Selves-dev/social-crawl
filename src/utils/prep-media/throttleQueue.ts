/**
 * Prep Media Throttle Queue Utilities
 * Handles media preparation job throttling and processing
 */

import { serviceBus } from '../shared/serviceBus'
import { logger } from '../shared/logger'
import { getSecurityManager } from '../shared/security'
import { ServiceBusReceiver, ServiceBusSender, ServiceBusReceivedMessage } from '@azure/service-bus'

export interface PrepMediaJob {
  id: string
  mediaUrl: string
  type: 'image' | 'video'
  metadata?: Record<string, any>
  timestamp: string
}

export class PrepMediaThrottleQueue {
  private receiver: ServiceBusReceiver | null = null
  private sender: ServiceBusSender | null = null
  private isProcessing = false
  private readonly queueName: string
  private readonly maxConcurrentJobs: number

  constructor() {
    this.queueName = process.env["ASB-PREP-MEDIA-QUEUE"] || 'prep-media'
    this.maxConcurrentJobs = parseInt(process.env["PREP-MEDIA-MAX-CONCURRENT-JOBS"] || '3', 10)
  }

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure postman plugin is loaded.')
    }

    this.receiver = serviceBus.createQueueReceiver(this.queueName)
    this.sender = serviceBus.createQueueSender(this.queueName)

    logger.info('Prep media throttle queue initialized', {
      service: 'prep-media',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    })
  }

  async sendJob(job: PrepMediaJob): Promise<void> {
    if (!this.sender) {
      throw new Error('Throttle queue not initialized')
    }

    // Add security token to message
    const security = getSecurityManager()
    const applicationProperties = security.addMessageSecurity({
      jobType: job.type,
      timestamp: job.timestamp
    })

    await this.sender.sendMessages({
      body: job,
      contentType: 'application/json',
      messageId: job.id,
      applicationProperties
    })

    logger.info(`Prep media job queued: ${job.id}`, {
      service: 'prep-media',
      jobId: job.id,
      mediaType: job.type
    })
  }

  async startProcessing(): Promise<void> {
    if (!this.receiver || this.isProcessing) {
      return
    }

    this.isProcessing = true
    logger.info('Starting prep media job processing', {
      service: 'prep-media',
      maxConcurrency: this.maxConcurrentJobs
    })

    this.receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        await this.processJob(message)
      },
      processError: async (args) => {
        logger.error('Prep media queue processing error', args.error, {
          service: 'prep-media',
          source: args.errorSource
        })
      }
    }, {
      maxConcurrentCalls: this.maxConcurrentJobs,
      autoCompleteMessages: false
    })
  }

  private async processJob(message: ServiceBusReceivedMessage): Promise<void> {
    let job: PrepMediaJob | null = null
    
    try {
      // Validate message security
      const security = getSecurityManager()
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('Prep media job failed security validation', new Error('Invalid security token'), {
          service: 'prep-media',
          messageId: message.messageId
        })
        await this.receiver?.completeMessage(message)
        return
      }

      job = message.body as PrepMediaJob
      
      logger.info(`Processing prep media job: ${job.id}`, {
        service: 'prep-media',
        jobId: job.id,
        mediaType: job.type
      })

      // TODO: Implement actual media preparation logic
      await this.prepareMedia(job)

      // Complete the message on success
      await this.receiver?.completeMessage(message)
      
      logger.info(`Prep media job completed: ${job.id}`, {
        service: 'prep-media',
        jobId: job.id
      })

    } catch (error) {
      logger.error(`Prep media job failed: ${job?.id || 'unknown'}`, error as Error, {
        service: 'prep-media',
        jobId: job?.id
      })

      // Abandon the message for retry (or dead letter if max retries exceeded)
      await this.receiver?.abandonMessage(message)
    }
  }

  private async prepareMedia(job: PrepMediaJob): Promise<void> {
    // TODO: Implement actual media preparation logic
    // This is where you'd process the media file
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate work
  }

  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.close()
      this.receiver = null
    }
    if (this.sender) {
      await this.sender.close()
      this.sender = null
    }
    this.isProcessing = false
    logger.info('Prep media throttle queue stopped', { service: 'prep-media' })
  }
}

// Export singleton instance
export const prepMediaQueue = new PrepMediaThrottleQueue()
