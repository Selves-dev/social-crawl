/**
 * Postman Message Processor
 * Handles main queue processing and workflow orchestration
 */

import { serviceBus } from './serviceBus'
import { logger } from './logger'
import { WorkflowTracker, WorkflowContext, WorkflowStage } from './workflowTracker'
import { QueueManager } from './queueManager'
import { getSecurityManager } from './security'
import { ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus'

export interface PostmanMessage {
  type: 'workflow_progress' | 'new_batch' | 'item_found' | 'stage_complete' | 'error'
  context: WorkflowContext
  payload?: any
}

export class PostmanProcessor {
  private receiver: ServiceBusReceiver | null = null
  private isProcessing = false

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected')
    }

    this.receiver = serviceBus.createQueueReceiver() // Uses default post-office queue
    
    logger.info('Postman processor initialized', {
      service: 'postman-processor',
      queue: serviceBus.getQueueName()
    })
  }

  async startProcessing(): Promise<void> {
    if (!this.receiver || this.isProcessing) {
      return
    }

    this.isProcessing = true
    logger.info('🚀 Starting postman message processing', {
      service: 'postman-processor'
    })

    this.receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        await this.processMessage(message)
      },
      processError: async (args) => {
        logger.error('Postman processing error', args.error, {
          service: 'postman-processor',
          source: args.errorSource
        })
      }
    }, {
      maxConcurrentCalls: 10, // Main queue can handle more concurrency
      autoCompleteMessages: false
    })
  }

  private async processMessage(message: ServiceBusReceivedMessage): Promise<void> {
    try {
      // Validate message security
      const security = getSecurityManager()
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('Message failed security validation', new Error('Invalid security token'), {
          service: 'postman-processor',
          messageId: message.messageId
        })
        await this.receiver!.completeMessage(message)
        return
      }

      const postmanMessage = message.body as PostmanMessage
      const { type, context, payload } = postmanMessage

      logger.info(`📨 Processing postman message: ${type}`, {
        service: 'postman-processor',
        messageType: type,
        batchId: context.batchId,
        stage: context.stage,
        ...(context.itemId && { itemId: context.itemId })
      })

      switch (type) {
        case 'new_batch':
          await this.handleNewBatch(context, payload)
          break
          
        case 'item_found':
          await this.handleItemFound(context, payload)
          break
          
        case 'stage_complete':
          await this.handleStageComplete(context, payload)
          break
          
        case 'workflow_progress':
          await this.handleWorkflowProgress(context, payload)
          break
          
        case 'error':
          await this.handleError(context, payload)
          break
          
        default:
          logger.warn(`Unknown postman message type: ${type}`, {
            service: 'postman-processor',
            messageType: type
          })
      }

      // Complete the message
      await this.receiver?.completeMessage(message)

    } catch (error) {
      logger.error('Failed to process postman message', error as Error, {
        service: 'postman-processor'
      })
      
      // Abandon for retry
      await this.receiver?.abandonMessage(message)
    }
  }

  private async handleNewBatch(context: WorkflowContext, payload: any): Promise<void> {
    logger.info(`🏁 New batch started: ${context.locationName || context.locationId}`, {
      service: 'postman-processor',
      batchId: context.batchId,
      locationId: context.locationId
    })

    // TODO: Trigger find-location processing
    // This would typically start the location search process
  }

  private async handleItemFound(context: WorkflowContext, payload: { itemUrl: string, itemType: string }): Promise<void> {
    // Create item context and start prep-media processing
    const itemContext = WorkflowTracker.createItemContext(
      context, 
      this.generateItemId(), 
      payload.itemUrl, 
      payload.itemType as any
    )

    // Ensure prep-media queue is running
    await QueueManager.startPrepMediaProcessing()

    // Send to prep-media queue
    await QueueManager.sendPrepMediaJob({
      id: itemContext.itemId!,
      mediaUrl: payload.itemUrl,
      type: payload.itemType as any,
      metadata: { workflowContext: itemContext },
      timestamp: new Date().toISOString()
    })

    logger.info(`📱 Item queued for prep-media: ${itemContext.itemId}`, {
      service: 'postman-processor',
      batchId: context.batchId,
      itemId: itemContext.itemId,
      itemType: payload.itemType
    })
  }

  private async handleStageComplete(context: WorkflowContext, payload: any): Promise<void> {
    const updatedContext = WorkflowTracker.completeStage(context, payload.results)
    
    // Route to next stage based on current stage
    switch (context.stage) {
      case WorkflowStage.PREP_MEDIA:
        await this.routeToAIService(updatedContext, payload.results)
        break
        
      case WorkflowStage.ANALYSE_MEDIA:
        await this.routeToEnrichVenue(updatedContext, payload.results)
        break
        
      case WorkflowStage.ENRICH_VENUE:
        // Workflow complete for this item
        this.logWorkflowComplete(updatedContext)
        break
        
      default:
        logger.info(`Stage ${context.stage} completed, no auto-routing`, {
          service: 'postman-processor',
          batchId: context.batchId,
          stage: context.stage
        })
    }
  }

  private async routeToAIService(context: WorkflowContext, prepResults: any): Promise<void> {
    if (!context.itemId) return

    // Ensure AI service queue is running
    await QueueManager.startAIServiceProcessing()

    // Send to AI service queue
    await QueueManager.sendAIJob({
      id: context.itemId,
      type: 'analyze_media',
      inputData: {
        mediaUrl: context.itemUrl,
        metadata: prepResults
      },
      parameters: { workflowContext: context },
      timestamp: new Date().toISOString()
    })

    logger.info(`🤖 Item queued for AI analysis: ${context.itemId}`, {
      service: 'postman-processor',
      batchId: context.batchId,
      itemId: context.itemId
    })
  }

  private async routeToEnrichVenue(context: WorkflowContext, analysisResults: any): Promise<void> {
    // TODO: Implement venue enrichment routing
    logger.info(`🏢 Item ready for venue enrichment: ${context.itemId}`, {
      service: 'postman-processor',
      batchId: context.batchId,
      itemId: context.itemId,
      analysisComplete: true
    })
  }

  private async handleWorkflowProgress(context: WorkflowContext, payload: any): Promise<void> {
    const progress = WorkflowTracker.getProgress(context)
    
    logger.info(`📊 Workflow progress update`, {
      service: 'postman-processor',
      ...progress
    })
  }

  private async handleError(context: WorkflowContext, payload: { error: string, stage?: string }): Promise<void> {
    const errorContext = WorkflowTracker.logError(context, payload.error)
    
    // TODO: Implement error handling strategy (retry, dead letter, etc.)
    logger.warn(`Error handling not yet implemented for: ${payload.error}`, {
      service: 'postman-processor',
      batchId: context.batchId
    })
  }

  private logWorkflowComplete(context: WorkflowContext): void {
    const progress = WorkflowTracker.getProgress(context)
    
    logger.info(`🎉 Item workflow complete: ${context.itemId}`, {
      service: 'postman-processor',
      batchId: context.batchId,
      itemId: context.itemId,
      progressPercentage: progress.progressPercentage,
      hasErrors: progress.hasErrors
    })
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.close()
      this.receiver = null
    }
    this.isProcessing = false
    logger.info('Postman processor stopped', { service: 'postman-processor' })
  }
}

// Export singleton instance
export const postmanProcessor = new PostmanProcessor()
