import { QueueManager } from '../shared/queueManager';
import { analyseMediaLetterbox } from './letterbox';
import { handleAnalyseMedia } from './handlers/handleMediaAnalysis';

// Singleton throttle queue for analyse-media jobs
export const analyseMediaQueue = {
  jobs: [] as any[],
  running: false,
  async startProcessing(handler?: (job: any) => Promise<void>) {
    if (this.running) return;
    this.running = true;
    // Simple loop for demonstration; replace with real throttle logic
    while (this.running && this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (handler) await handler(job);
      await new Promise(res => setTimeout(res, 1000)); // throttle
    }
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
