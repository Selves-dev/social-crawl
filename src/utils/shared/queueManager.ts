/**
 * Queue Manager Utilities
 * Handles on-demand starting and stopping of throttle queues
 */

import { logger } from '../shared/logger'
import { prepMediaQueue, PrepMediaJob } from '../prep-media'
import { aiServiceQueue, AIJob } from '../ai-service'
import { crawlMediaQueue, CrawlMediaJob } from '../crawl-media/throttleQueue'
export class QueueManager {
  private static prepMediaRunning = false;
  private static aiServiceRunning = false;
  private static crawlMediaRunning = false;

  /**
   * Start crawl-media throttle queue processing
   * Call this when you have crawl-media jobs to process
   */
  static async startCrawlMediaProcessing(): Promise<void> {
    if (this.crawlMediaRunning) {
      logger.info('Crawl media queue already running', { service: 'queue-manager' });
      return;
    }
    try {
      await crawlMediaQueue.startProcessing();
      this.crawlMediaRunning = true;
      logger.info('✅ Crawl media throttle queue started', {
        service: 'queue-manager',
        queue: 'crawl-media'
      });
    } catch (error) {
      logger.error('Failed to start crawl media queue', error as Error, {
        service: 'queue-manager'
      });
      throw error;
    }
  }

  /**
   * Stop crawl-media throttle queue processing
   * Call this when no more crawl-media jobs are expected
   */
  static async stopCrawlMediaProcessing(): Promise<void> {
    if (!this.crawlMediaRunning) {
      return;
    }
    try {
      await crawlMediaQueue.stop();
      this.crawlMediaRunning = false;
      logger.info('⏹️ Crawl media throttle queue stopped', {
        service: 'queue-manager',
        queue: 'crawl-media'
      });
    } catch (error) {
      logger.error('Failed to stop crawl media queue', error as Error, {
        service: 'queue-manager'
      });
    }
  }

  /**
   * Start prep-media throttle queue processing
   * Call this when you have media jobs to process
   */
  static async startPrepMediaProcessing(): Promise<void> {
    if (this.prepMediaRunning) {
      logger.info('Prep media queue already running', { service: 'queue-manager' })
      return
    }

    try {
      await prepMediaQueue.startProcessing()
      this.prepMediaRunning = true
      logger.info('✅ Prep media throttle queue started', { 
        service: 'queue-manager',
        queue: 'prep-media'
      })
    } catch (error) {
      logger.error('Failed to start prep media queue', error as Error, { 
        service: 'queue-manager' 
      })
      throw error
    }
  }

  /**
   * Start AI service throttle queue processing
   * Call this when you have AI jobs to process
   */
  static async startAIServiceProcessing(): Promise<void> {
    if (this.aiServiceRunning) {
      logger.info('AI service queue already running', { service: 'queue-manager' })
      return
    }

    try {
      await aiServiceQueue.startProcessing()
      this.aiServiceRunning = true
      logger.info('✅ AI service throttle queue started', { 
        service: 'queue-manager',
        queue: 'ai-service'
      })
    } catch (error) {
      logger.error('Failed to start AI service queue', error as Error, { 
        service: 'queue-manager' 
      })
      throw error
    }
  }

  /**
   * Stop prep-media throttle queue processing
   * Call this when no more media jobs are expected
   */
  static async stopPrepMediaProcessing(): Promise<void> {
    if (!this.prepMediaRunning) {
      return
    }

    try {
      await prepMediaQueue.stop()
      this.prepMediaRunning = false
      logger.info('⏹️ Prep media throttle queue stopped', { 
        service: 'queue-manager',
        queue: 'prep-media'
      })
    } catch (error) {
      logger.error('Failed to stop prep media queue', error as Error, { 
        service: 'queue-manager' 
      })
    }
  }

  /**
   * Stop AI service throttle queue processing
   * Call this when no more AI jobs are expected
   */
  static async stopAIServiceProcessing(): Promise<void> {
    if (!this.aiServiceRunning) {
      return
    }

    try {
      await aiServiceQueue.stop()
      this.aiServiceRunning = false
      logger.info('⏹️ AI service throttle queue stopped', { 
        service: 'queue-manager',
        queue: 'ai-service'
      })
    } catch (error) {
      logger.error('Failed to stop AI service queue', error as Error, { 
        service: 'queue-manager' 
      })
    }
  }

  /**
   * Start all throttle queues
   * Useful for batch processing or when you know jobs are coming
   */
  static async startAllThrottleQueues(): Promise<void> {
    logger.info('Starting all throttle queues...', { service: 'queue-manager' })
    await Promise.all([
      this.startPrepMediaProcessing(),
      this.startAIServiceProcessing(),
      this.startCrawlMediaProcessing()
    ])
    logger.info('✅ All throttle queues started', { service: 'queue-manager' })
  }

  /**
   * Stop all throttle queues
   * Useful for graceful shutdown or when scaling to zero
   */
  static async stopAllThrottleQueues(): Promise<void> {
    logger.info('Stopping all throttle queues...', { service: 'queue-manager' })
    await Promise.all([
      this.stopPrepMediaProcessing(),
      this.stopAIServiceProcessing(),
      this.stopCrawlMediaProcessing()
    ])
    logger.info('⏹️ All throttle queues stopped', { service: 'queue-manager' })
  }

  /**
   * Initialize all throttle queues without starting processing
   * Call this during app startup
   */
  static async initializeAllQueues(): Promise<void> {
    logger.info('Initializing all throttle queues...', { service: 'queue-manager' })
    try {
      await Promise.all([
        prepMediaQueue.initialize(),
        aiServiceQueue.initialize(),
        crawlMediaQueue.initialize()
      ])
      logger.info('✅ All throttle queues initialized', { service: 'queue-manager' })
    } catch (error) {
      logger.error('Failed to initialize throttle queues', error as Error, {
        service: 'queue-manager'
      })
      throw error
    }
  }

  /**
   * Get status of all queues
   */
  static getQueueStatus(): Record<string, boolean> {
    return {
      prepMedia: this.prepMediaRunning,
      aiService: this.aiServiceRunning,
      crawlMedia: this.crawlMediaRunning
    }
  }
  /**
   * Send job to crawl-media queue
   */
  static async sendCrawlMediaJob(job: CrawlMediaJob): Promise<void> {
    await crawlMediaQueue.addJob(job)
  }

  /**
   * Send job to prep-media queue
   */
  static async sendPrepMediaJob(job: PrepMediaJob): Promise<void> {
    await prepMediaQueue.sendJob(job)
  }

  /**
   * Send job to AI service queue
   */
  static async sendAIJob(job: AIJob): Promise<void> {
    await aiServiceQueue.sendJob(job)
  }
}
