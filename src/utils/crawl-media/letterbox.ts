/**
 * Letterbox handler for media crawl requests
 * Receives and processes media crawl jobs
 */


import { handleSearchCrawl } from "./handlers/handleSearchCrawl";
import { QueueManager } from "../shared/index";

/**
 * General letterbox entry point for all crawl-media messages.
 * Postman should call this with the message and context.
 */
export async function letterbox(message: any, context: any) {
  switch (message.type) {
    case 'media-crawl-request': {
      await QueueManager.startCrawlMediaProcessing();
      const result = await handleSearchCrawl(message);
      // Only stop the queue if all jobs are finished
      const { crawlMediaQueue } = await import('./throttleQueue');
      if (crawlMediaQueue['queue'].length === 0 && crawlMediaQueue['activeWorkers'] === 0) {
        await QueueManager.stopCrawlMediaProcessing();
      }
      return result;
    }
    default:
      return { error: 'Unknown message type', type: message.type };
  }
}
