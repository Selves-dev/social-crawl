/**
 * Crawl Media Throttle Queue Utilities
 * Handles concurrent scraping of media URLs
 */


import { handleMediaScrape } from './handlers/handleMediaScrape';

export interface CrawlMediaJob {
  platform: string;
  url: string;
  query: string;
}

export class CrawlMediaThrottleQueue {
  private queue: CrawlMediaJob[] = [];
  private activeWorkers = 0;
  private readonly maxConcurrentJobs: number;
  private isInitialized = false;
  private isProcessing = false;

  constructor(maxConcurrentJobs = 5) {
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  async initialize(): Promise<void> {
    // Stub: Add any connection logic here
    this.isInitialized = true;
  }

  async startProcessing(): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;
    this.isProcessing = true;
    // Start processing jobs using handleMediaScrape as the worker
    await this.processJobs(handleMediaScrape);
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
    // Stub: Add any cleanup logic here
  }

  addJob(job: CrawlMediaJob) {
    this.queue.push(job);
  }

  async processJobs(scrapeFn: (job: CrawlMediaJob) => Promise<any>): Promise<any[]> {
    const results: any[] = [];
    const processNext = async () => {
      if (this.queue.length === 0) return;
      if (this.activeWorkers >= this.maxConcurrentJobs) return;
      const job = this.queue.shift();
      if (!job) return;
      this.activeWorkers++;
      try {
        const result = await scrapeFn(job);
        results.push(result);
      } finally {
        this.activeWorkers--;
        await processNext();
      }
    };
    const workers = Array.from({ length: this.maxConcurrentJobs }, () => processNext());
    await Promise.all(workers);
    return results;
  }
}

export const crawlMediaQueue = new CrawlMediaThrottleQueue();
