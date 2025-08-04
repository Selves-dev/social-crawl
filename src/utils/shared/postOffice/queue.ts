
import { serviceBus } from '../serviceBus'
import { logger } from '../logger'
import { getSecurityManager } from '../security'
import { postOffice } from './postman'
import type { PostOfficeMessage } from '../types'
import { ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus'

export class PostOfficeQueue {
    
  private receiver: ServiceBusReceiver | null = null
  private isProcessing = false
  // Only one queue for all PostOffice routing
  private readonly queueName: string = process.env['asb-post-office-queue'] || 'post-office'
  private readonly maxConcurrentJobs: number = parseInt(process.env['post-office-max-concurrent-jobs'] || '5', 10)

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure service bus plugin is loaded.')
    }
    // Only one queue receiver for post-office
    this.receiver = serviceBus.createQueueReceiver(this.queueName)
    logger.info('📮 Post-office queue initialized', {
      service: 'post-office-queue',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    })
  }

  async startProcessing(): Promise<void> {
    try {
      if (!this.receiver || this.isProcessing) {
        logger.warn('[PostOfficeQueue] Cannot start processing: receiver not initialized or already processing', {
          receiverInitialized: !!this.receiver,
          isProcessing: this.isProcessing
        })
        return
      } else {
        logger.info('📮 [PostOfficeQueue] Starting queue processing...', {
          receiverInitialized: !!this.receiver,
          isProcessing: this.isProcessing
        })
      }
      this.isProcessing = true
      logger.info('📮 Starting post-office message processing', {
        service: 'post-office-queue',
        maxConcurrency: this.maxConcurrentJobs
      })
      // Only one handler: postOffice.routeMessage
      logger.info('📮 Post-office queue handler (router) registered and ready to process messages', {
        service: 'post-office-queue',
        handler: 'postOffice.routeMessage'
      })
      this.receiver.subscribe({
        processMessage: async (message: ServiceBusReceivedMessage) => {
          logger.info('📮 Post-office received message', {
            service: 'post-office-queue',
            messageId: message.messageId
          })
          await this.processMessage(message)
        },
        processError: async (args) => {
          logger.error('📮 Post-office processing error', args.error, {
            service: 'post-office-queue',
            source: args.errorSource
          })
        }
      }, {
        maxConcurrentCalls: this.maxConcurrentJobs,
        autoCompleteMessages: false
      })
    } catch (error) {
      logger.error('[PostOfficeQueue] Failed to start queue processing', error instanceof Error ? error : new Error(String(error)), {
        service: 'post-office-queue'
      })
      throw error
    }
  }

  // Only one queue, all routing is to letterboxes
  private async processMessage(message: ServiceBusReceivedMessage): Promise<void> {
    logger.debug('[DEBUG] [queue.ts] Entered processMessage', {
      service: 'post-office-queue',
      messageId: message.messageId,
      rawBody: message.body,
      applicationProperties: message.applicationProperties
    });
    // Safe logging: only log serializable properties, stringify if needed
    let safeBody, safeAppProps;
    try {
      safeBody = typeof message.body === 'object' ? JSON.stringify(message.body) : message.body;
    } catch (err) {
      safeBody = '[Unserializable body]';
    }
    try {
      safeAppProps = typeof message.applicationProperties === 'object' ? JSON.stringify(message.applicationProperties) : message.applicationProperties;
    } catch (err) {
      safeAppProps = '[Unserializable applicationProperties]';
    }
    logger.info('📮 [processMessage] ENTRY', {
      service: 'post-office-queue',
      messageId: message.messageId,
      bodyType: typeof message.body,
      rawBody: safeBody,
      applicationProperties: safeAppProps
    });

    // Log before security validation
    logger.info('📮 [processMessage] Before security validation', {
      service: 'post-office-queue',
      messageId: message.messageId,
      applicationProperties: message.applicationProperties
    });
    let postOfficeMessage: PostOfficeMessage | null = null;

    try {
      // Validate message security
      const security = getSecurityManager();
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('📮 Message failed security validation', new Error('Invalid security token'), {
          service: 'post-office-queue',
          messageId: message.messageId
        });
        logger.debug('[DEBUG] Calling completeMessage due to failed security validation', { messageId: message.messageId });
        await this.receiver?.completeMessage(message);
        return;
      }

      // Robustly handle message body as string, Buffer, or object
      if (typeof message.body === 'string') {
        try {
          postOfficeMessage = JSON.parse(message.body);
        } catch (err) {
          logger.error('📮 Message body could not be parsed as JSON', err as Error, {
            service: 'post-office-queue',
            messageId: message.messageId
          });
          logger.debug('[DEBUG] Calling abandonMessage due to JSON parse error', { messageId: message.messageId });
          await this.receiver?.abandonMessage(message);
          return;
        }
      } else if (Buffer.isBuffer(message.body)) {
        try {
          postOfficeMessage = JSON.parse(message.body.toString('utf8'));
        } catch (err) {
          logger.error('📮 Buffer message body could not be parsed as JSON', err as Error, {
            service: 'post-office-queue',
            messageId: message.messageId
          });
          logger.debug('[DEBUG] Calling abandonMessage due to Buffer parse error', { messageId: message.messageId });
          await this.receiver?.abandonMessage(message);
          return;
        }
      } else if (typeof message.body === 'object' && message.body !== null) {
        postOfficeMessage = message.body as PostOfficeMessage;
      } else {
        logger.error('📮 Message body is not a valid object, string, or Buffer', new Error('Invalid message body type'), {
          service: 'post-office-queue',
          messageId: message.messageId
        });
        logger.debug('[DEBUG] Calling abandonMessage due to invalid body type', { messageId: message.messageId });
        await this.receiver?.abandonMessage(message);
        return;
      }

      if (!postOfficeMessage) {
        logger.error('📮 postOfficeMessage is null after deserialization, abandoning message', new Error('Null postOfficeMessage'), {
          service: 'post-office-queue',
          messageId: message.messageId
        });
        logger.debug('[DEBUG] Calling abandonMessage due to null postOfficeMessage', { messageId: message.messageId });
        await this.receiver?.abandonMessage(message);
        return;
      }

      logger.info('📮 Processing post-office message', {
        service: 'post-office-queue',
        messageId: message.messageId,
        util: postOfficeMessage.util,
        type: postOfficeMessage.type
      });

      // Route through PostOffice (single queue, multiple letterboxes)
      await postOffice.routeMessage(postOfficeMessage);
      // Complete the message
      logger.debug('[DEBUG] Calling completeMessage after successful processing', { messageId: message.messageId });
      await this.receiver?.completeMessage(message);
      logger.info('📮 Post-office message completed', {
        service: 'post-office-queue',
        messageId: message.messageId,
        util: postOfficeMessage.util,
        type: postOfficeMessage.type
      });

    } catch (error) {
      logger.error('📮 Post-office message failed', error as Error, {
        service: 'post-office-queue',
        messageId: message.messageId,
        util: postOfficeMessage?.util,
        type: postOfficeMessage?.type
      });

      // Abandon the message for retry
      logger.debug('[DEBUG] Calling abandonMessage after error', { messageId: message.messageId });
      await this.receiver?.abandonMessage(message);
    }
  }


  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.close()
      this.receiver = null
    }
    
    this.isProcessing = false
    
    logger.info('📮 Post-office queue stopped', { 
      service: 'post-office-queue' 
    })
  }
}

// Export singleton instance
export const postOfficeQueue = new PostOfficeQueue()
