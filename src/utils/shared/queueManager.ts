import type { SearchCrawlJob, MediaScrapeJob, PrepMediaJob, AnalyseMediaJob } from './types';
import * as azureBlobUtils from '../../utils/shared/azureBlob';
import { prepMediaQueue } from '../prep-media/throttleQueue';
import { aiServiceQueue } from '../ai-service/throttleQueue';
import { logger } from './logger';
import { analyseMediaQueue } from '../analyse-media/throttleQueue';
import { getMediaQueue } from '../get-media/throttleQueue';

// Ensure all environment variable references use lowercase-dash convention
// Example: process.env['asb-post-office-queue']

// Types for better type safety
interface QueueInstance {
  initialize(): Promise<void>;
  stop(): Promise<void>;
  sendJob(job: any): Promise<void>;
  subscribe(handler: (job: any) => Promise<void>): void;
}

interface QueueConfig {
  name: string;
  instance: QueueInstance;
}

interface QueueStatus {
  running: Record<string, boolean>;
  initialized: Record<string, boolean>;
  totalRunning: number;
  totalQueues: number;
}

export class QueueManager {
  private static running: Record<string, boolean> = {};
  private static _initialized = false;
  private static _started = false;

  // Centralized queue-config - easier to maintain and extend
  // Note: handlers are registered by individual letterboxes, not here
  private static readonly queueConfigs: QueueConfig[] = [
    { name: 'prep-media', instance: prepMediaQueue },
    { name: 'ai-service', instance: aiServiceQueue },
    //{ name: 'search-crawl', instance: searchCrawlQueue },
    //{ name: 'crawl-media', instance: crawlMediaQueue },
    { name: 'analyse-media', instance: analyseMediaQueue },
    { name: 'get-media', instance: getMediaQueue }
  ];

  // Helper method to find queue-config
  private static findQueueConfig(name: string): QueueConfig {
    const queueConfig = this.queueConfigs.find(q => q.name === name);
    if (!queueConfig) {
      throw new Error(`Queue not found: ${name}. Available queues: ${this.queueConfigs.map(q => q.name).join(', ')}`);
    }
    return queueConfig;
  }

  // Helper method to check if queue supports handlers (deprecated - handlers now registered via letterbox subscribe)
  private static hasRegisterHandler(instance: QueueInstance): boolean {
    // This method is deprecated since we use letterbox.subscribe() pattern now
    return false;
  }

  static async stopQueue(name: string): Promise<void> {
    if (!this.running[name]) {
      logger.info(`${name} queue already stopped`, { service: 'queue-manager', queue: name });
      return;
    }

    const { instance } = this.findQueueConfig(name);
    
    try {
      await instance.stop();
      this.running[name] = false;
      logger.info(`⏹️ ${name} queue stopped`, { service: 'queue-manager', queue: name });
    } catch (error) {
      logger.error(`Failed to stop ${name} queue`, error as Error, { service: 'queue-manager', queue: name });
      throw error;
    }
  }

  static async initializeAllQueues(): Promise<void> {
    if (this._initialized) {
      logger.info('All queues already initialized, skipping.', { service: 'queue-manager' });
      return;
    }

    logger.info('🚀 Initializing all queues...', { service: 'queue-manager' });
    
    try {
      const initPromises = this.queueConfigs.map(async ({ name, instance }) => {
        try {
          await instance.initialize();
          logger.debug(`${name} queue-config initialized`, { service: 'queue-manager', queue: name });
        } catch (error) {
          logger.error(`Failed to initialize ${name} queue-config`, error as Error, { service: 'queue-manager', queue: name });
          throw error;
        }
      });

      await Promise.all(initPromises);
      this._initialized = true;
      logger.info('✅ All queue-configs initialized', { service: 'queue-manager' });
    } catch (error) {
      logger.error('Failed to initialize queue-configs', error as Error, { service: 'queue-manager' });
      this._initialized = false; // Reset on failure
      throw error;
    }
  }

  static async stopAllQueues(): Promise<void> {
    if (!this._started) {
      logger.info('All queues already stopped', { service: 'queue-manager' });
      return;
    }

    logger.info('Stopping all queues...', { service: 'queue-manager' });
    
    try {
      const stopPromises = this.queueConfigs.map(({ name }) => this.stopQueue(name));
      await Promise.all(stopPromises);
      this._started = false;
      logger.info('⏹️ All queues stopped', { service: 'queue-manager' });
    } catch (error) {
      logger.error('Failed to stop all queues', error as Error, { service: 'queue-manager' });
      throw error;
    }
  }

  static getQueueStatus(): Record<string, boolean> {
    return { ...this.running };
  }

  static getDetailedStatus(): QueueStatus {
    const running = this.getQueueStatus();
    const initialized = Object.fromEntries(
      this.queueConfigs.map(({ name, instance }) => [name, !!instance])
    );
    
    return {
      running,
      initialized,
      totalRunning: Object.values(running).filter(Boolean).length,
      totalQueues: this.queueConfigs.length
    };
  }

  static async sendJob(queueName: string, job: any): Promise<void> {
    const { instance } = this.findQueueConfig(queueName);
    
    try {
      await instance.sendJob(job);
      logger.info(`Job sent to ${queueName} queue`, { 
        service: 'queue-manager', 
        queue: queueName,
        jobType: job?.type 
      });
    } catch (error) {
      logger.error(`Failed to send job to ${queueName} queue`, error as Error, { 
        service: 'queue-manager', 
        queue: queueName,
        jobType: job?.type 
      });
      throw error;
    }
  }

  // Utility methods for better usability
  static getAvailableQueues(): string[] {
    return this.queueConfigs.map(q => q.name);
  }

  static isQueueRunning(name: string): boolean {
    return !!this.running[name];
  }

  static isInitialized(): boolean {
    return this._initialized;
  }

  static isStarted(): boolean {
    return this._started;
  }

  // Reset state - useful for testing or restart scenarios
  static reset(): void {
    this.running = {};
    this._initialized = false;
    this._started = false;
    logger.info('Queue manager state reset', { service: 'queue-manager' });
  }
}