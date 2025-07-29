import { crawlMediaQueue, downloadQueue } from '../throttleQueue';
import { sendPostmanMessage } from '../../shared/serviceBus';
import { crawlSearch } from '../../shared/crawlSearch';
import { WorkflowContext } from '../../shared/workflow';
import { logger } from '../../shared/logger';


// Minimal job type for search crawl stage
export type SearchCrawlJob = {
  link?: string;
  platform: string;
  workflow: WorkflowContext;
};

export async function handleSearchCrawl(event: any) {
  try {
    logger.info('[handleSearchCrawl] Received event', { event });
    const { query } = event;
    const structuredQuery = structureQuery(query);
    logger.info('[handleSearchCrawl] Structured query', { structuredQuery });

    const searchResults = await crawlSearch(structuredQuery);
    let jobsQueued: SearchCrawlJob[] = [];
    const workflow: WorkflowContext = event.workflow || {
      batchId: event.batchId || '',
      locationId: event.locationId || '',
      locationName: event.locationName,
      countryCode: event.countryCode,
      stage: 'crawl-media',
      timestamp: new Date().toISOString(),
      completedStages: [],
      metadata: {}
    };

    // Build jobsQueued array only, filter out jobs with no link
    for (const platform of Object.keys(searchResults)) {
      for (const link of searchResults[platform]) {
        if (!link) {
          logger.error(`[handleSearchCrawl] Missing link for platform ${platform}, cannot create job.`, new Error(`Missing link for platform ${platform}`));
          throw new Error(`Missing link for platform ${platform}`);
        }
        if (link.includes('google.com')) {
          logger.info(`[handleSearchCrawl] Skipping google.com link for platform ${platform}`);
          continue;
        }
        jobsQueued.push({
          platform,
          link,
          workflow,
        });
      }
    }
    logger.info('[handleSearchCrawl] Jobs queued', { count: jobsQueued.length });

    // Pass each job to letterbox for media-scrape processing individually
    const { letterbox } = await import('../letterbox');
    for (const job of jobsQueued) {
      await letterbox(job, workflow);
    }
  } catch (error) {
    logger.error('[handleSearchCrawl] Error processing event', error instanceof Error ? error : new Error(String(error)));
  }
}

function structureQuery(query: string): string {
  // TODO: Implement actual query structuring logic
  return query;
}
