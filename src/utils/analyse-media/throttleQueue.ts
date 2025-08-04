import { serviceBus } from '../shared/serviceBus';
import { logger } from '../shared/logger';
import { getSecurityManager } from '../shared/security';
import { ServiceBusReceiver, ServiceBusSender, ServiceBusReceivedMessage } from '@azure/service-bus';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';
import type { AnalyseMediaJob } from '../shared/types';

export class AnalyseMediaThrottleQueue {
  private receiver: ServiceBusReceiver | null = null;
  private sender: ServiceBusSender | null = null;
  private isProcessing = false;
  private readonly queueName: string;
  private readonly maxConcurrentJobs: number;

  constructor() {
    this.queueName = process.env["asb-analyse-media-queue"] || 'analyse-media';
    this.maxConcurrentJobs = parseInt(process.env["analyse-media-max-concurrent-jobs"] || '2', 10);
  }

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure postman plugin is loaded.');
    }

    this.receiver = serviceBus.createQueueReceiver(this.queueName);
    this.sender = serviceBus.createQueueSender(this.queueName);

    logger.info('Analyse media throttle queue initialized', {
      service: 'analyse-media',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    });
  }

  async sendJob(job: AnalyseMediaJob): Promise<void> {
    if (!this.sender) {
      throw new Error('Throttle queue not initialized');
    }

    const security = getSecurityManager();
    const applicationProperties = security.addMessageSecurity({
      jobType: job.type || 'analyse-media',
      timestamp: job.timestamp
    });

    const messageId = job.id || `analyse_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await this.sender.sendMessages({
      body: job,
      contentType: 'application/json',
      messageId,
      applicationProperties
    });

    logger.info(`Analyse media job queued: ${messageId}`, {
      service: 'analyse-media',
      jobId: job.id,
      blobUrl: job.blobUrl
    });
  }

  async startProcessing(handler?: (job: AnalyseMediaJob) => Promise<void>): Promise<void> {
    if (!this.receiver || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    logger.info('Starting analyse media job processing', {
      service: 'analyse-media',
      maxConcurrency: this.maxConcurrentJobs
    });

    this.receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        await this.processJob(message, handler || handleAnalyseMedia);
      },
      processError: async (args) => {
        logger.error('Analyse media queue processing error', args.error, {
          service: 'analyse-media',
          source: args.errorSource
        });
      }
    }, {
      maxConcurrentCalls: this.maxConcurrentJobs,
      autoCompleteMessages: false
    });
  }

  private async processJob(message: ServiceBusReceivedMessage, handler: (job: AnalyseMediaJob) => Promise<void>): Promise<void> {
    let job: AnalyseMediaJob | null = null;
    try {
      const security = getSecurityManager();
      if (!security.validateMessageSecurity(message.applicationProperties)) {
        logger.error('Analyse media job failed security validation', new Error('Invalid security token'), {
          service: 'analyse-media',
          messageId: message.messageId
        });
        await this.receiver?.completeMessage(message);
        return;
      }

      job = message.body as AnalyseMediaJob;
      logger.info(`Processing analyse media job: ${job.id}`, {
        service: 'analyse-media',
        jobId: job.id,
        blobUrl: job.blobUrl
      });

      await handler(job);
      await this.receiver?.completeMessage(message);
      logger.info(`Analyse media job completed: ${job.id}`, {
        service: 'analyse-media',
        jobId: job.id
      });
    } catch (error) {
      logger.error(`Analyse media job failed: ${job?.id || 'unknown'}`, error as Error, {
        service: 'analyse-media',
        jobId: job?.id
      });
      await this.receiver?.abandonMessage(message);
    }
  }

  async stop(): Promise<void> {
    if (this.receiver) {
      await this.receiver.close();
      this.receiver = null;
    }
    this.isProcessing = false;
    logger.info('Analyse media throttle queue stopped', {
      service: 'analyse-media'
    });
  }
}

// Export singleton instance
export const analyseMediaQueue = new AnalyseMediaThrottleQueue();
