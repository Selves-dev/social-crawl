import { searchCrawlQueue, crawlMediaQueue } from '../crawl-media/throttleQueue';
import type { SearchCrawlJob, MediaScrapeJob, PrepMediaJob, AIServiceJob } from './types';
import { prepMediaQueue } from '../prep-media/throttleQueue';
import { aiServiceQueue } from '../ai-service/throttleQueue';
import { logger } from './logger';
import { analyseMediaQueue } from '../analyse-media/throttleQueue';

// Use the singleton prepMediaQueue exported from throttleQueue.ts

export class QueueManager {
  // --- AI SERVICE QUEUE ---
  // ...existing code...
  static async startAIServiceProcessing(): Promise<void> {
    if (this.aiServiceRunning) {
      logger.info('AI service queue already running', { service: 'queue-manager' });
      return;
    }
    try {
      await aiServiceQueue.startProcessing();
      this.aiServiceRunning = true;
      logger.info('✅ AI service throttle queue started', {
        service: 'queue-manager',
        queue: 'ai-service'
      });
    } catch (error) {
      logger.error('Failed to start AI service queue', error as Error, {
        service: 'queue-manager'
      });
      throw error;
    }
  }

  static async stopAIServiceProcessing(): Promise<void> {
    if (!this.aiServiceRunning) {
      return;
    }
    try {
      // Add logic to stop AI service queue if/when implemented
      this.aiServiceRunning = false;
      // logger.info('⏹️ AI service throttle queue stopped', {
      //   service: 'queue-manager',
      //   queue: 'ai-service'
      // });
    } catch (error) {
      // logger.error('Failed to stop AI service queue', error as Error, {
      //   service: 'queue-manager'
      // });
    }
  }
  // --- PREP MEDIA QUEUE ---
  static async startPrepMediaProcessing(): Promise<void> {
    if (this.prepMediaRunning) {
      // logger.info('Prep media queue already running', { service: 'queue-manager' });
      return;
    }
    try {
      await prepMediaQueue.startProcessing();
      this.prepMediaRunning = true;
      // logger.info('✅ Prep media throttle queue started', {
      //   service: 'queue-manager',
      //   queue: 'prep-media'
      // });
    } catch (error) {
      // logger.error('Failed to start prep media queue', error as Error, {
      //   service: 'queue-manager'
      // });
      throw error;
    }
  }

  static async stopPrepMediaProcessing(): Promise<void> {
    if (!this.prepMediaRunning) {
      return;
    }
    try {
      await prepMediaQueue.stop();
      this.prepMediaRunning = false;
      // logger.info('⏹️ Prep media throttle queue stopped', {
      //   service: 'queue-manager',
      //   queue: 'prep-media'
      // });
    } catch (error) {
      // logger.error('Failed to stop prep media queue', error as Error, {
      //   service: 'queue-manager'
      // });
    }
  }
  private static prepMediaRunning = false;
  private static aiServiceRunning = false;
  private static searchCrawlRunning = false;
  private static crawlMediaRunning = false;
  private static analyseMediaRunning = false;

  // ...existing code...

  static async startSearchCrawlProcessing(): Promise<void> {
    if (this.searchCrawlRunning) {
      logger.info('Search crawl queue already running', { service: 'queue-manager' });
      return;
    }
    try {
      const { handleSearchCrawl } = await import('../crawl-media/handlers/handleSearchCrawl');
      await searchCrawlQueue.startProcessing(handleSearchCrawl);
      this.searchCrawlRunning = true;
      logger.info('✅ Search crawl throttle queue started', {
        service: 'queue-manager',
        queue: 'search-crawl'
      });
    } catch (error) {
      logger.error('Failed to start search crawl queue', error as Error, {
        service: 'queue-manager'
      });
      throw error;
    }
  }

  static async stopSearchCrawlProcessing(): Promise<void> {
    if (!this.searchCrawlRunning) {
      return;
    }
    try {
      await searchCrawlQueue.stop();
      this.searchCrawlRunning = false;
      logger.info('⏹️ Search crawl throttle queue stopped', {
        service: 'queue-manager',
        queue: 'search-crawl'
      });
    } catch (error) {
      logger.error('Failed to stop search crawl queue', error as Error, {
        service: 'queue-manager'
      });
    }
  }

  static async startCrawlMediaProcessing(): Promise<void> {
    if (this.crawlMediaRunning) {
      logger.info('Crawl media queue already running', { service: 'queue-manager' });
      return;
    }
    try {
      // Import the handler for crawl media jobs
      const { handleMediaScrape } = await import('../crawl-media/handlers/handleMediaScrape');
      await crawlMediaQueue.startProcessing(handleMediaScrape);
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

  static async startAnalyseMediaProcessing(handler?: (job: any) => Promise<void>): Promise<void> {
    if (this.analyseMediaRunning) {
      return;
    }
    try {
      await analyseMediaQueue.startProcessing(handler);
      this.analyseMediaRunning = true;
    } catch (error) {
      throw error;
    }
  }

  static async stopAnalyseMediaProcessing(): Promise<void> {
    if (!this.analyseMediaRunning) {
      return;
    }
    try {
      await analyseMediaQueue.stop();
      this.analyseMediaRunning = false;
    } catch (error) {
      // Optionally log error
    }
  }

  static async startAllThrottleQueues(): Promise<void> {
    logger.info('Starting all throttle queues...', { service: 'queue-manager' });
    await Promise.all([
      this.startAIServiceProcessing(),
      this.startSearchCrawlProcessing(),
      this.startCrawlMediaProcessing()
    ]);
    logger.info('✅ All throttle queues started', { service: 'queue-manager' });
  }

  static async stopAllThrottleQueues(): Promise<void> {
    logger.info('Stopping all throttle queues...', { service: 'queue-manager' });
    await Promise.all([
      this.stopAIServiceProcessing(),
      this.stopSearchCrawlProcessing(),
      this.stopCrawlMediaProcessing()
    ]);
    logger.info('⏹️ All throttle queues stopped', { service: 'queue-manager' });
  }

  static async initializeAllQueues(): Promise<void> {
    logger.info('Initializing all throttle queues...', { service: 'queue-manager' });
    try {
      await Promise.all([
      prepMediaQueue.initialize(),
      aiServiceQueue.initialize(),
      searchCrawlQueue.initialize(),
      crawlMediaQueue.initialize()
      ]);
      logger.info('✅ All throttle queues initialized', { service: 'queue-manager' });
    } catch (error) {
      logger.error('Failed to initialize throttle queues', error as Error, {
        service: 'queue-manager'
      });
      throw error;
    }
  }

  static getQueueStatus(): Record<string, boolean> {
    return {
      prepMedia: this.prepMediaRunning,
      aiService: this.aiServiceRunning,
      searchCrawl: this.searchCrawlRunning,
      crawlMedia: this.crawlMediaRunning
    };
  }

  static async sendSearchCrawlJob(job: SearchCrawlJob): Promise<void> {
    await searchCrawlQueue.addJob(job);
  }

  static async sendCrawlMediaJob(job: MediaScrapeJob): Promise<void> {
    await crawlMediaQueue.addJob(job);
  }

  // ...existing code for prepMedia and aiService...
}