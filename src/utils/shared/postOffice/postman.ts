
import { logger } from '../logger'
import { WorkflowTracker } from '../workflow'
import { WorkflowContext, WorkflowStage } from '../../ai-service/types/types'
// Export singleton instance
import { postOfficeQueue } from './queue' 

export interface Letterbox {
  (message: any): Promise<any>
}

export class PostOffice {
  private letterboxes: Map<string, Letterbox> = new Map()

  registerLetterbox(util: string, letterbox: Letterbox): void {
    this.letterboxes.set(util, letterbox)
  }

  /**
   * Route a message to the appropriate letterbox based on util field
   */
  async routeMessage(message: any): Promise<void> {
    const { util, type, workflow, payload } = message
    logger.debug('[PostOffice] Received message', { util, type, workflowId: workflow?.batchId || 'unknown', payload });
    logger.debug('📮 PostOffice routing message', {
      service: 'post-office',
      util,
      type,
      workflowId: workflow?.batchId || 'unknown'
    })

    // Find the letterbox for this util
    const letterbox = this.letterboxes.get(util)
    if (!letterbox) {
      logger.error(`📪❌ No letterbox found for util: ${util}`, new Error(`Unknown util: ${util}`), {
        service: 'post-office',
        util,
        availableUtils: Array.from(this.letterboxes.keys())
      })
      throw new Error(`PostOffice: No letterbox registered for util: ${util}`)
    }
    try {
      logger.debug(`📪✉️ Delivering message to ${util} letterbox`, {
        service: 'post-office',
        util,
        type
      })
      await letterbox(message)
      logger.debug(`📪✅ Message delivered successfully to ${util} letterbox`, {
        service: 'post-office',
        util,
        type
      })
    } catch (error) {
      logger.error(`📪❌ Failed to deliver message to ${util} letterbox`, error as Error, {
        service: 'post-office',
        util,
        type,
        message
      })
      throw error
    }
  }

  /**
   * Get list of registered utils
   */
  getRegisteredUtils(): string[] {
    return Array.from(this.letterboxes.keys())
  }

  hasLetterbox(util: string): boolean {
    return this.letterboxes.has(util)
  }

  /**
   * Health status for postOffice queue
   */
  health() {
    return {
      registeredLetterboxes: this.getRegisteredUtils(),
      letterboxCount: this.letterboxes.size,
      // Add more diagnostics as needed
    };
  }
}
import { getSecurityManager } from '../security'
import { serviceBus } from '../serviceBus'

let persistentSender: any = null;

export async function sendToPostOffice(message: any): Promise<void> {
  try {
    logger.debug('[sendToPostOffice] Called', { message });
    if (!message || typeof message !== 'object') {
      logger.error('[sendToPostOffice] Invalid message: not an object', new Error(JSON.stringify({ message })));
      throw new Error('sendToPostOffice: message must be an object');
    }
    // Enforce API secret validation globally
    const apiSecret = process.env['taash-secret'];
    const clientSecret = message.apiSecret || message?.payload?.apiSecret;
    if (!apiSecret || clientSecret !== apiSecret) {
      logger.error('[sendToPostOffice] Unauthorized: Invalid API secret', new Error('Invalid API secret'), { clientSecret });
      throw new Error('sendToPostOffice: Unauthorized: Invalid API secret');
    }
    const { util, type, workflow, payload } = message;
    logger.debug('[sendToPostOffice] Validating message fields', { util, type, workflow, payload });
    if (!util) {
      logger.error('[sendToPostOffice] Missing util', new Error(JSON.stringify({ message })));
      throw new Error('sendToPostOffice: message.util is required');
    }
    if (!type) {
      logger.warn('[sendToPostOffice] Missing type', { message });
      // type is now optional, do not throw
    }
    if (!workflow || typeof workflow !== 'object') {
      logger.error('[sendToPostOffice] Invalid workflow', new Error(JSON.stringify({ workflow })));
      throw new Error('sendToPostOffice: message.workflow is required and must be an object');
    }
    if (!payload || typeof payload !== 'object') {
      logger.error('[sendToPostOffice] Invalid payload', new Error(JSON.stringify({ payload })));
      throw new Error('sendToPostOffice: message.payload is required and must be an object');
    }

    // Always send to the single post-office queue
    const queueName = process.env['asb-post-office-queue'] || 'post-office';
    logger.debug('[sendToPostOffice] Sending to post-office queue', { queueName });
    if (!persistentSender) {
      persistentSender = serviceBus.createQueueSender(queueName);
      logger.debug('[sendToPostOffice] Created persistent sender for queue', { queueName });
    }
    const security = getSecurityManager();
    const applicationProperties = security.addMessageSecurity({ type });
    const messageBody = { util, type, workflow, payload };
    const messageId = message?.id || undefined;
    logger.debug('[sendToPostOffice] Sending message to post-office queue', {
      queueName,
      messageBody,
      messageId,
      applicationProperties
    });
    await persistentSender.sendMessages({
      body: messageBody,
      contentType: 'application/json',
      messageId,
      applicationProperties
    });
    logger.debug('[sendToPostOffice] Message sent successfully to post-office', {
      queueName,
      messageId
    });
  } catch (error) {
    logger.error('[sendToPostOffice] Failed to send message', error instanceof Error ? error : new Error(String(error)), {
      message
    });
    throw error;
  }
}


export class PostmanProcessor {
  async initialize(): Promise<void> {
    // Initialize the post-office queue
    await postOfficeQueue.initialize()
    
    logger.info('[postmanProcessor] PostOffice and letterboxes initialized', {
      service: 'postman-processor',
      registeredUtils: postOffice.getRegisteredUtils()
    })
  }

  async startProcessing(): Promise<void> {
    logger.info('[postmanProcessor] Starting post-office queue processing via PostOffice', {
      service: 'postman-processor'
    })
    
    await postOfficeQueue.startProcessing()
    
    logger.info('[postmanProcessor] PostOffice processing started', {
      service: 'postman-processor'
    })
  }

  // Legacy workflow tracking methods - can be used by letterboxes if needed
  
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
    logger.info('[postmanProcessor] Stopping post-office queue via PostOffice', {
      service: 'postman-processor'
    })
    await postOfficeQueue.stop()
  }
}

// Export singleton instance
export const postOffice = new PostOffice();
