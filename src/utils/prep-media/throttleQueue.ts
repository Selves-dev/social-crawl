import { ServiceBusReceiver, ServiceBusSender, ServiceBusReceivedMessage } from '@azure/service-bus';
import { serviceBus } from '../shared/serviceBus';
import { logger } from '../shared/logger';
import { getSecurityManager } from '../shared/security';
import type { PostOfficeMessage } from '../shared/types';

export class PrepMediaThrottleQueue {
  private receiver: ServiceBusReceiver | null = null;
  private sender: ServiceBusSender | null = null;
  private readonly queueName: string;
  private readonly maxConcurrentJobs: number;

  constructor() {
    this.queueName = process.env["asb-prep-media-queue"] || 'prep-media';
    this.maxConcurrentJobs = parseInt(process.env["prep-media-max-concurrent-jobs"] || '5', 10);
  }

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure postman plugin is loaded.');
    }

    this.receiver = serviceBus.createQueueReceiver(this.queueName);
    this.sender = serviceBus.createQueueSender(this.queueName);

    logger.debug('Prep media throttle queue initialized', {
      service: 'prep-media',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    });
  }

  async sendJob(job: PostOfficeMessage): Promise<void> {
    if (!this.sender) {
      throw new Error('Throttle queue not initialized');
    }

    const security = getSecurityManager();
    const applicationProperties = security.addMessageSecurity({
      jobType: job.type,
      timestamp: Date.now().toString()
    });

    const messageId = `${job.util || 'prep-media'}_${job.type}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.sender.sendMessages({
      body: job,
      contentType: 'application/json',
      messageId,
      applicationProperties
    });

    logger.debug(`Prep media job queued: ${messageId}`, {
      service: 'prep-media',
      jobId: messageId,
      jobType: job.type
    });
  }

  subscribe(handler: (message: PostOfficeMessage) => Promise<void>): void {
    if (!this.receiver) {
      throw new Error('PrepMediaThrottleQueue not initialized. Call initialize() first.');
    }

    this.receiver.subscribe({
      processMessage: async (msg: ServiceBusReceivedMessage) => {
        try {
          const security = getSecurityManager();
          if (!security.validateMessageSecurity(msg.applicationProperties)) {
            logger.error('Prep media job failed security validation', new Error('Invalid security token'), {
              service: 'prep-media',
              messageId: msg.messageId
            });
            await this.receiver?.completeMessage(msg);
            return;
          }

          await handler(msg.body as PostOfficeMessage);
          await this.receiver?.completeMessage(msg);
        } catch (error) {
          logger.error('Message handler error', error as Error, {
            service: 'prep-media',
            messageId: msg.messageId
          });
          await this.receiver?.abandonMessage(msg);
        }
      },
      processError: async (args) => {
        logger.error('PrepMediaThrottleQueue processing error', args.error, {
          service: 'prep-media',
          source: args.errorSource
        });
      }
    }, {
      maxConcurrentCalls: this.maxConcurrentJobs,
      autoCompleteMessages: false
    });
  }

  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.close();
      this.receiver = null;
    }

    if (this.sender) {
      await this.sender.close();
      this.sender = null;
    }

    logger.info('Prep media throttle queue stopped', { service: 'prep-media' });
  }
}

// Export singleton instance
export const prepMediaQueue = new PrepMediaThrottleQueue();
