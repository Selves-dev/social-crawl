import { QueueManager } from '../shared/index';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';

// Singleton throttle queue for analyse-media jobs
export const analyseMediaQueue = {
  jobs: [] as any[],
  running: false,
  maxConcurrentJobs: parseInt(process.env["ANALYSE-MEDIA-MAX-CONCURRENT-JOBS"] || "2", 10),
  async startProcessing(handler?: (job: any) => Promise<void>) {
    if (this.running) return;
    this.running = true;
    const worker = async () => {
      while (this.running && this.jobs.length > 0) {
        const job = this.jobs.shift();
        if (handler && job) await handler(job);
        await new Promise(res => setTimeout(res, 1000)); // throttle
      }
    };
    // Start workers
    const workers = Array.from({ length: this.maxConcurrentJobs }, () => worker());
    await Promise.all(workers);
  },
  async stop() {
    this.running = false;
  },
  async addJob(job: any) {
    this.jobs.push(job);
  }
};

export const startAnalyseMediaProcessing = async () => {
  await analyseMediaQueue.startProcessing(handleAnalyseMedia);
};

export const stopAnalyseMediaProcessing = async () => {
  await analyseMediaQueue.stop();
};
