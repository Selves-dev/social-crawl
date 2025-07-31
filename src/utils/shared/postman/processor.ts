/**
 * Postman Message Processor
 * Handles main queue processing and workflow orchestration
 */

import { serviceBus } from '../serviceBus'
import { logger } from '../logger'
import { WorkflowTracker, WorkflowContext, WorkflowStage } from '../workflow'
import { QueueManager } from '../index'
import { getSecurityManager } from '../security'
import { ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus'
// import { WorkflowDatabase } from '../workflowDatabase' // Removed: file does not exist
import { postmanMappers } from './mappers'

export interface PostmanMessage {
  type: string;
  util: string;
  context: WorkflowContext;
  payload?: any;
}

export class PostmanProcessor {
  private receiver: ServiceBusReceiver | null = null
  private isProcessing = false

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected')
    }

    this.receiver = serviceBus.createQueueReceiver() // Uses default post-office queue
    
    // ...existing code...
  }

  async startProcessing(): Promise<void> {
    if (!this.receiver || this.isProcessing) {
      return
    }

    this.isProcessing = true
    // ...existing code...

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
    // ...existing code...
    const postmanMessage = message.body;
    if (!postmanMessage) {
      logger.error('[postmanProcessor] No message body found', { message });
      await this.receiver?.completeMessage(message);
      return;
    }
    // Security validation
    try {
      const security = getSecurityManager();
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('[postmanProcessor] Message failed security validation', new Error('Invalid security token'), {
          service: 'postman-processor',
          messageId: message.messageId
        });
        await this.receiver?.completeMessage(message);
        return;
      }
      // Util lookup
      const util = postmanMessage.util || postmanMessage.type;
      if (!util) {
        logger.error('[postmanProcessor] No util specified in message', { postmanMessage });
        await this.receiver?.completeMessage(message);
        return;
      }
      const mapper = postmanMappers[util];
      if (!mapper) {
        logger.warn(`[postmanProcessor] Unknown util: ${util}`, { postmanMessage });
        await this.receiver?.completeMessage(message);
        return;
      }
      // ...existing code...
      // Compose payload for mapper
      let payload = postmanMessage.payload || {};
      if (postmanMessage.type && !payload.type) payload.type = postmanMessage.type;
      if (postmanMessage.context) {
        payload.workflow = postmanMessage.context;
      }
      // ...existing code...
      // Call util mapper
      await mapper(payload, payload.workflow);
      // ...existing code...
      await this.receiver?.completeMessage(message);
    } catch (error) {
      logger.error('[postmanProcessor] Failed to process message', error as Error, {
        service: 'postman-processor',
        messageId: message.messageId
      });
      await this.receiver?.abandonMessage(message);
    }
  }
  
  
  private async handleWorkflowProgress(context: WorkflowContext, payload: any): Promise<void> {
    const progress = WorkflowTracker.getProgress(context)
    
    // Save workflow progress update to database
    // await WorkflowDatabase.saveWorkflow(context)
    
    // ...existing code...
  }

  private async handleError(context: WorkflowContext, payload: { error: string, stage?: string }): Promise<void> {
    const errorContext = WorkflowTracker.logError(context, payload.error)
    
    // Save error state to database
    // await WorkflowDatabase.saveWorkflow(errorContext)
    
    // TODO: Implement error handling strategy (retry, dead letter, etc.)
    logger.warn(`Error handling not yet implemented for: ${payload.error}`, {
      service: 'postman-processor',
      batchId: context.batchId
    })
  }

  private async logWorkflowComplete(context: WorkflowContext): Promise<void> {
    const progress = WorkflowTracker.getProgress(context)
    
    // Save final workflow state to database
    // await WorkflowDatabase.saveWorkflow(context)
    // await WorkflowDatabase.saveMediaItem(context)
    
    // ...existing code...
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
    // ...existing code...
  }
}

// Export singleton instance
export const postmanProcessor = new PostmanProcessor()
