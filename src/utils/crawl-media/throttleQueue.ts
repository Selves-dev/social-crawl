
import { SearchCrawlJob, MediaScrapeJob } from '../shared/types';

export class SearchCrawlThrottleQueue {
  private queue: SearchCrawlJob[] = [];
  private activeWorkers = 0;
  private readonly maxConcurrentJobs: number;
  private isInitialized = false;
  private isProcessing = false;

  constructor(maxConcurrentJobs?: number) {
    // Read from env, default to 2
    const envVal = process.env["SEARCH-CRAWL-MAX-CONCURRENT-JOBS"];
    this.maxConcurrentJobs = maxConcurrentJobs ?? (envVal ? parseInt(envVal, 10) : 2);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async startProcessing(scrapeFn: (job: SearchCrawlJob) => Promise<any>): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;
    this.isProcessing = true;
    await this.processJobs(scrapeFn);
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
  }

  async addJob(job: SearchCrawlJob) {
    this.queue.push(job);
  }

  async processJobs(scrapeFn: (job: SearchCrawlJob) => Promise<any>): Promise<any[]> {
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


export class CrawlMediaQueue {
  private queue: MediaScrapeJob[] = [];
  private activeWorkers = 0;
  private readonly maxConcurrentJobs: number;
  private isInitialized = false;
  private isProcessing = false;

  constructor(maxConcurrentJobs?: number) {
    // Read from env, default to 2
    const envVal = process.env["CRAWL-MEDIA-MAX-CONCURRENT-JOBS"];
    this.maxConcurrentJobs = maxConcurrentJobs ?? (envVal ? parseInt(envVal, 10) : 2);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async startProcessing(scrapeFn: (job: MediaScrapeJob) => Promise<any>): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;
    this.isProcessing = true;
    await this.processJobs(scrapeFn);
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
  }

  async addJob(job: MediaScrapeJob) {
    this.queue.push(job);
  }

  async processJobs(scrapeFn: (job: MediaScrapeJob) => Promise<any>): Promise<any[]> {
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

export const searchCrawlQueue = new SearchCrawlThrottleQueue();
export const crawlMediaQueue = new CrawlMediaQueue();