import { crawlMediaQueue, downloadQueue, DownloadJob } from '../throttleQueue';
import { crawlSearch } from '../../shared/crawlSearch';
import { WorkflowContext } from '../../shared/workflow';
import { logger } from '../../shared/logger';

export async function handleSearchCrawl(event: any) {
  try {
    logger.info('[handleSearchCrawl] Received event', { event });
    const { query } = event;
    const structuredQuery = structureQuery(query);
    logger.info('[handleSearchCrawl] Structured query', { structuredQuery });

    const searchResults = await crawlSearch(structuredQuery);
    logger.info('[handleSearchCrawl] Search results', { count: searchResults.length });

    const jobsQueued: DownloadJob[] = [];
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
    for (const result of searchResults) {
      const job: DownloadJob = { ...result, workflow };
      downloadQueue.addJob(job);
      jobsQueued.push(job);
    }
    logger.info('[handleSearchCrawl] Jobs queued', { count: jobsQueued.length });
  } catch (error) {
    logger.error('[handleSearchCrawl] Error processing event', error instanceof Error ? error : new Error(String(error)));
  }
}

function structureQuery(query: string): string {
  // TODO: Implement actual query structuring logic
  return query;
}
