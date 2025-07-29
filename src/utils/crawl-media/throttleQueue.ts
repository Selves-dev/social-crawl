/**
 * Crawl Media Throttle Queue Utilities
 * Handles concurrent scraping of media URLs
 */


import { handleMediaScrape } from './handlers/handleMediaScrape';
// import { WorkflowContext } from '../../shared/workflow';

export interface CrawlMediaJob {
  platform: string;
  url: string;
  query: string;
}

// Accepts CrawlSearchResult and workflow details
export interface DownloadJob {
  link: string;
  snippet: string;
  title: string;
  workflow: any; // Use 'any' for now to avoid import error
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
    this.isInitialized = true;
  }

  async startProcessing(): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;
    this.isProcessing = true;
    await this.processJobs(handleMediaScrape);
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
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

export class DownloadThrottleQueue {
  private queue: DownloadJob[] = [];
  private activeWorkers = 0;
  private readonly maxConcurrentJobs: number;
  private isInitialized = false;
  private isProcessing = false;

  constructor(maxConcurrentJobs = 5) {
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async startProcessing(scrapeFn: (job: DownloadJob) => Promise<any>): Promise<void> {
    if (!this.isInitialized || this.isProcessing) return;
    this.isProcessing = true;
    await this.processJobs(scrapeFn);
  }

  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
  }

  addJob(job: DownloadJob) {
    this.queue.push(job);
  }

  async processJobs(scrapeFn: (job: DownloadJob) => Promise<any>): Promise<any[]> {
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
export const downloadQueue = new DownloadThrottleQueue();
