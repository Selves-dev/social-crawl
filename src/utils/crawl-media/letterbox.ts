import type { LetterboxHandler } from '../shared/letterboxTypes';
import { handleSearchCrawl } from "./handlers/handleSearchCrawl";
import { handleMediaScrape } from "./handlers/handleMediaScrape";
import { QueueManager } from "../shared/index";
import { sendPostmanMessage } from "../shared/serviceBus";
import { searchCrawlQueue, crawlMediaQueue } from "./throttleQueue";

export const letterbox: LetterboxHandler = async (message) => {
  // Log incoming message
  console.info('[letterbox] Incoming message:', JSON.stringify(message, null, 2));
  switch (message.type) {
    case 'search-crawl-queued': {
      // Add jobs to internal searchCrawl
      console.info('[letterbox] Processing type: search-crawl-queued');
      if (Array.isArray(message.jobsQueued)) {
        console.info(`[letterbox] Adding ${message.jobsQueued.length} jobs to searchCrawlQueue`);
        for (const job of message.jobsQueued) {
          console.info('[crawl-media.letterbox] Received job:', job);
          console.info('[crawl-media.letterbox] Workflow context in job:', job.workflow);
          console.info('[crawl-media.letterbox] batchId in job:', job.workflow?.batchId);
          if (!job.workflow) {
            console.error('[letterbox] Job missing workflow property!', job);
          } else {
            console.info('[letterbox] Job workflow present', { batchId: job.workflow.batchId });
          }
          await searchCrawlQueue.addJob(job);
        }
      } else {
        console.warn('[letterbox] No jobsQueued array found in message:', message);
      }
      // Ensure queue is initialized
      if (!searchCrawlQueue['isInitialized']) {
        await searchCrawlQueue.initialize();
        console.info('[letterbox] searchCrawlQueue initialized');
      }
      // Start the queue if not running
      if (!searchCrawlQueue['isProcessing']) {
        // Adapter: convert SearchCrawlJob to JobEnvelope<SearchCrawlContext>
        const handler = async (job) => {
          const envelope = {
            type: job.type || 'search-crawl',
            context: {
              query: job.query || '',
              platform: job.platform
            },
            workflow: job.workflow
          };
          return handleSearchCrawl(envelope);
        };
        await searchCrawlQueue.startProcessing(handler);
        console.info('[letterbox] searchCrawlQueue started');
        return { status: 'search-crawl-queue-started' };
      }
      console.info('[letterbox] searchCrawlQueue already running');
      return { status: 'search-crawl-queue-already-running' };
    }
    case 'crawl-media-queued': {
      console.info('[letterbox] Processing type: media-scrape-queued');
      // Add job to crawlMedia and start processing only if not already running
      // Ensure job shape matches MediaScrapeJob interface
      const job = {
        link: message.link,
        snippet: message.snippet || '',
        title: message.title || '',
        workflow: message.workflow, // Always use workflow from message
        platform: message.platform
      };
      // Log workflow context and batchId for debugging
      console.info('[letterbox] Workflow context for crawl-media job:', job.workflow);
      console.info('[letterbox] batchId for crawl-media job:', job.workflow?.batchId);
      console.info('[letterbox] Queuing crawl-media job:', JSON.stringify(job, null, 2));
      await crawlMediaQueue.addJob(job);
      if (!crawlMediaQueue['isInitialized']) {
        await crawlMediaQueue.initialize();
        console.info('[letterbox] crawlMedia initialized');
      }
      if (!crawlMediaQueue['isProcessing']) {
        await crawlMediaQueue.startProcessing(handleMediaScrape);
        console.info('[letterbox] crawlMediaQueue started');
      }
      // Only stop the queue if all jobs are finished
      if (crawlMediaQueue['queue'].length === 0 && crawlMediaQueue['activeWorkers'] === 0) {
        await QueueManager.stopCrawlMediaProcessing();
      }
      return { status: 'crawl-media-job-queued' };
    }
    default:
      return { error: 'Unknown message type', type: message.type };
  }
};
letterbox.initializeQueue = async () => {
  await searchCrawlQueue.initialize();
};

letterbox.shutdownQueue = async () => {
  await QueueManager.stopSearchCrawlProcessing();
};
