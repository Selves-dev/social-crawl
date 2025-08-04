import { logger } from '../logger'
// Node-only: Enable verbose logging for Azure Service Bus SDK and route to app logger
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    // Dynamically require to avoid plugin bundling issues
    const { setLogLevel, setLogger } = require('@azure/logger');
    setLogLevel('info');
    setLogger({
      info: (...args) => logger.info('[AzureSDK]', ...args),
      warning: (...args) => logger.warn('[AzureSDK]', ...args),
      error: (...args) => logger.error('[AzureSDK]', ...args),
      verbose: (...args) => logger.debug('[AzureSDK]', ...args),
    });
    process.env['AZURE_LOG_LEVEL'] = 'info';
    logger.info('[sendToPostOffice] Set AZURE_LOG_LEVEL to info for diagnostics');
  } catch (err) {
    logger.warn('[sendToPostOffice] Azure logger setup failed', { error: err });
  }
}
import type { PostOfficeMessage } from '../types'
import { getSecurityManager } from '../security'
import { serviceBus } from '../serviceBus'


export interface Letterbox {
  (message: PostOfficeMessage): Promise<any>
}

export class PostOffice {
  private letterboxes: Map<string, Letterbox> = new Map()

 registerLetterbox(util: string, letterbox: Letterbox): void {
    this.letterboxes.set(util, letterbox)
    logger.info(`📪 Letterbox registered for util: ${util}`, {
      service: 'post-office',
      util
    })
  }

  /**
   * Route a message to the appropriate letterbox based on util field
   */
  async routeMessage(message: PostOfficeMessage): Promise<void> {
    const { util, type, workflow, payload } = message

    logger.info('📮 PostOffice routing message', {
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
      logger.info(`📪✉️ Delivering message to ${util} letterbox`, {
        service: 'post-office',
        util,
        type
      })

      await letterbox(message)

      logger.info(`📪✅ Message delivered successfully to ${util} letterbox`, {
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


/**
 * Send a message to the single post-office queue for routing to letterboxes.
 * All validation and logging is retained.
 */
// Persistent sender instance for post-office queue
let persistentSender: any = null;

export async function sendToPostOffice(message: any): Promise<void> {
  try {
    logger.info('[sendToPostOffice] Called', { message });
    if (!message || typeof message !== 'object') {
      logger.error('[sendToPostOffice] Invalid message: not an object', new Error(JSON.stringify({ message })));
      throw new Error('sendToPostOffice: message must be an object');
    }
    const { util, type, workflow, payload } = message;
    logger.info('[sendToPostOffice] Validating message fields', { util, type, workflow, payload });
    if (!util) {
      logger.error('[sendToPostOffice] Missing util', new Error(JSON.stringify({ message })));
      throw new Error('sendToPostOffice: message.util is required');
    }
    if (!type) {
      logger.error('[sendToPostOffice] Missing type', new Error(JSON.stringify({ message })));
      throw new Error('sendToPostOffice: message.type is required');
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
    logger.info('[sendToPostOffice] Sending to post-office queue', { queueName });
    if (!persistentSender) {
      persistentSender = serviceBus.createQueueSender(queueName);
      logger.info('[sendToPostOffice] Created persistent sender for queue', { queueName });
    }
    const security = getSecurityManager();
    const applicationProperties = security.addMessageSecurity({ type });
    const messageBody = { util, type, workflow, payload };
    const messageId = message?.id || undefined;
    logger.info('[sendToPostOffice] Sending message to post-office queue', {
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
    logger.info('[sendToPostOffice] Message sent successfully to post-office', {
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
// Export singleton instance
export const postOffice = new PostOffice()
