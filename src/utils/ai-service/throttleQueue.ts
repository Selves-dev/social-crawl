/**
 * AI Service Throttle Queue Utilities
 * Handles AI processing job throttling and processing
 */

import { serviceBus } from '../shared/serviceBus'
import { logger } from '../shared/logger'
import { getSecurityManager } from '../shared/security'
import { ServiceBusReceiver, ServiceBusSender, ServiceBusReceivedMessage } from '@azure/service-bus'

export interface AIJob {
  id: string
  type: 'analyze_media' | 'generate_caption' | 'classify_content'
  inputData: {
    mediaUrl?: string
    text?: string
    metadata?: Record<string, any>
  }
  parameters?: Record<string, any>
  timestamp: string
}

export class AIServiceThrottleQueue {
  private receiver: ServiceBusReceiver | null = null
  private sender: ServiceBusSender | null = null
  private isProcessing = false
  private readonly queueName: string
  private readonly maxConcurrentJobs: number

  constructor() {
    this.queueName = process.env.AZURE_SERVICE_BUS_AI_SERVICE_QUEUE || 'ai-service'
    this.maxConcurrentJobs = parseInt(process.env.AI_SERVICE_MAX_CONCURRENT_JOBS || '2', 10)
  }

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure postman plugin is loaded.')
    }

    this.receiver = serviceBus.createQueueReceiver(this.queueName)
    this.sender = serviceBus.createQueueSender(this.queueName)

    logger.info('AI service throttle queue initialized', {
      service: 'ai-service',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    })
  }

  async sendJob(job: AIJob): Promise<void> {
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

    logger.info(`AI job queued: ${job.id}`, {
      service: 'ai-service',
      jobId: job.id,
      jobType: job.type
    })
  }

  async startProcessing(): Promise<void> {
    if (!this.receiver || this.isProcessing) {
      return
    }

    this.isProcessing = true
    logger.info('Starting AI job processing', {
      service: 'ai-service',
      maxConcurrency: this.maxConcurrentJobs
    })

    this.receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        await this.processJob(message)
      },
      processError: async (args) => {
        logger.error('AI service queue processing error', args.error, {
          service: 'ai-service',
          source: args.errorSource
        })
      }
    }, {
      maxConcurrentCalls: this.maxConcurrentJobs,
      autoCompleteMessages: false
    })
  }

  private async processJob(message: ServiceBusReceivedMessage): Promise<void> {
    let job: AIJob | null = null
    
    try {
      // Validate message security
      const security = getSecurityManager()
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('AI job failed security validation', new Error('Invalid security token'), {
          service: 'ai-service',
          messageId: message.messageId
        })
        await this.receiver?.completeMessage(message)
        return
      }

      job = message.body as AIJob
      
      logger.info(`Processing AI job: ${job.id}`, {
        service: 'ai-service',
        jobId: job.id,
        jobType: job.type
      })

      // TODO: Implement actual AI processing logic
      const result = await this.processAITask(job)

      // Complete the message on success
      await this.receiver?.completeMessage(message)
      
      logger.info(`AI job completed: ${job.id}`, {
        service: 'ai-service',
        jobId: job.id,
        resultKeys: Object.keys(result)
      })

    } catch (error) {
      logger.error(`AI job failed: ${job?.id || 'unknown'}`, error as Error, {
        service: 'ai-service',
        jobId: job?.id,
        jobType: job?.type
      })

      // Abandon the message for retry (or dead letter if max retries exceeded)
      await this.receiver?.abandonMessage(message)
    }
  }

  private async processAITask(job: AIJob): Promise<Record<string, any>> {
    // TODO: Implement actual AI processing logic based on job type
    switch (job.type) {
      case 'analyze_media':
        return await this.analyzeMedia(job.inputData)
      case 'generate_caption':
        return await this.generateCaption(job.inputData)
      case 'classify_content':
        return await this.classifyContent(job.inputData)
      default:
        throw new Error(`Unknown AI job type: ${job.type}`)
    }
  }

  private async analyzeMedia(inputData: any): Promise<Record<string, any>> {
    // TODO: Implement media analysis
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate AI processing
    return { analysis: 'placeholder_result' }
  }

  private async generateCaption(inputData: any): Promise<Record<string, any>> {
    // TODO: Implement caption generation
    await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate AI processing
    return { caption: 'placeholder_caption' }
  }

  private async classifyContent(inputData: any): Promise<Record<string, any>> {
    // TODO: Implement content classification
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate AI processing
    return { classification: 'placeholder_category' }
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
    logger.info('AI service throttle queue stopped', { service: 'ai-service' })
  }
}

// Export singleton instance
export const aiServiceQueue = new AIServiceThrottleQueue()
