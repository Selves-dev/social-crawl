/**
 * Letterbox handler for media crawl requests
 * Receives and processes media crawl jobs
 */


import { handleSearchCrawl } from "./handlers/handleSearchCrawl";
import { logger, QueueManager } from "../shared/index";

/**
 * General letterbox entry point for all crawl-media messages.
 * Postman should call this with the message and context.
 */
export async function letterbox(message: any, context: any) {
  switch (message.type) {
    case 'media-crawl-request':
      logger.info('[Crawl-Media] Received media-crawl-request', { message, context, timestamp: new Date().toISOString() });
      await QueueManager.startCrawlMediaProcessing();
      const result = await handleSearchCrawl(message);
      await QueueManager.stopCrawlMediaProcessing();
      return result;
    default:
      logger.warn(`[Crawl-Media] Unknown message type: ${message.type}`, { message, context });
      return { error: 'Unknown message type', type: message.type };
  }
}
