import { serviceBus } from '../shared/serviceBus';
import { logger } from '../shared/logger';
import { getSecurityManager } from '../shared/security';
import { ServiceBusReceiver, ServiceBusSender } from '@azure/service-bus';
import type { GetMediaJob } from '../shared/types';

export class GetMediaThrottleQueue {
  private receiver: ServiceBusReceiver | null = null;
  private sender: ServiceBusSender | null = null;
  private isProcessing = false;
  private readonly queueName: string;
  private readonly maxConcurrentJobs: number;

  constructor() {
    this.queueName = process.env["asb-get-media-queue"] || 'get-media';
    this.maxConcurrentJobs = parseInt(process.env["get-media-max-concurrent-jobs"] || '2', 10);
  }

  async initialize(): Promise<void> {
    if (!serviceBus.isConnected()) {
      throw new Error('Service bus not connected. Ensure postman plugin is loaded.')
    }
    this.receiver = serviceBus.createQueueReceiver(this.queueName);
    this.sender = serviceBus.createQueueSender(this.queueName);
    logger.info('Get media throttle queue initialized', {
      service: 'get-media',
      queueName: this.queueName,
      maxConcurrentJobs: this.maxConcurrentJobs
    });
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessing || !this.receiver) return;
    this.isProcessing = true;
    // TODO: Add message handler logic here
    logger.info('Get media throttle queue started processing', { service: 'get-media' });
  }

  async sendJob(job: GetMediaJob): Promise<void> {
    if (!this.sender) throw new Error('Queue sender not initialized');
    const security = getSecurityManager();
    const applicationProperties = security.addMessageSecurity({ type: 'get-media' });
    await this.sender.sendMessages({
      body: job,
      contentType: 'application/json',
      applicationProperties
    });
    logger.info('Job sent to get-media queue', { service: 'get-media', job });
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
    this.isProcessing = false;
    logger.info('Get media throttle queue stopped', { service: 'get-media' });
  }
}

// Export singleton instance
export const getMediaQueue = new GetMediaThrottleQueue();
