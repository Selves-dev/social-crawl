/**
 * Letterbox handler for media crawl requests
 * Receives and processes media crawl jobs
 */


import { handleSearchCrawl } from "./handlers/handleSearchCrawl";
import { handleMediaScrape } from "./handlers/handleMediaScrape";
import { QueueManager } from "../shared/index";
import { sendPostmanMessage } from "../shared/serviceBus";
import { searchCrawl, mediaScrape } from "./throttleQueue";

/**
 * General letterbox entry point for all crawl-media messages.
 * Postman should call this with the message and context.
 */
export async function letterbox(message: any, context: any) {
  switch (message.type) {
    case 'search-crawl-queued': {
      // Add jobs to internal searchCrawl
      if (Array.isArray(message.jobsQueued)) {
        console.info(`[letterbox] Adding ${message.jobsQueued.length} jobs to searchCrawl`);
        for (const job of message.jobsQueued) {
          console.info('[letterbox] Adding job to searchCrawl:', job);
          await searchCrawl.addJob(job);
        }
      } else {
        console.warn('[letterbox] No jobsQueued array found in message:', message);
      }
      // Ensure queue is initialized
      if (!searchCrawl['isInitialized']) {
        await searchCrawl.initialize();
        console.info('[letterbox] searchCrawl initialized');
      }
      // Start the queue if not running
      if (!searchCrawl['isProcessing']) {
        await searchCrawl.startProcessing(handleSearchCrawl);
        console.info('[letterbox] searchCrawl started');
        return { status: 'search-crawl-queue-started' };
      }
      console.info('[letterbox] searchCrawl already running');
      return { status: 'search-crawl-queue-already-running' };
    }
    case 'media-scrape-queued': {
      // Add job to mediaScrape and start processing if not already running
      await mediaScrape.addJob(message);
      if (!mediaScrape['isInitialized']) {
        await mediaScrape.initialize();
        console.info('[letterbox] mediaScrape initialized');
      }
      await mediaScrape.startProcessing();
      // Only stop the queue if all jobs are finished
      if (mediaScrape['queue'].length === 0 && mediaScrape['activeWorkers'] === 0) {
        await QueueManager.stopCrawlMediaProcessing();
      }
      return { status: 'media-scrape-job-queued' };
    }
    default:
      return { error: 'Unknown message type', type: message.type };
  }
}
