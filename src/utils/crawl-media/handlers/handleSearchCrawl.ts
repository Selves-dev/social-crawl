
import { crawlMediaQueue } from '../throttleQueue';
import { sendPostmanMessage } from '../../shared/serviceBus';
import { crawlSearch } from '../../shared/crawlSearch';
import { WorkflowContext } from '../../shared/workflow';
import { logger } from '../../shared/logger';



// Generic job envelope type
export type JobEnvelope<T = any> = {
  type: string;
  context: T;
  workflow: WorkflowContext;
};

export type SearchCrawlContext = {
  query: string;
  platform: string;
};

export async function handleSearchCrawl(job: JobEnvelope<SearchCrawlContext>) {
  try {

    logger.info('[handleSearchCrawl] START', { job });
    logger.info('[handleSearchCrawl] Initial workflow context:', { workflow: job.workflow });
    logger.info('[handleSearchCrawl] Initial batchId:', { batchId: job.workflow?.batchId });
    if (!job.context?.query) {
      logger.error('[handleSearchCrawl] Missing query in job context', new Error('Missing query in job'), { job });
      logger.error('[handleSearchCrawl] Workflow context at error:', { workflow: job.workflow });
      logger.error('[handleSearchCrawl] BatchId at error:', { batchId: job.workflow?.batchId });
      throw new Error('Missing query in job');
    }
    logger.info('[handleSearchCrawl] Using query:', { query: job.context.query });
    logger.info('[handleSearchCrawl] Workflow context at query:', { workflow: job.workflow });
    logger.info('[handleSearchCrawl] BatchId at query:', { batchId: job.workflow?.batchId });

    const query = job.context.query;
    logger.info('[handleSearchCrawl] Calling crawlSearch with', { query, platform: job.context.platform });
    logger.info('[handleSearchCrawl] Workflow context before crawlSearch:', { workflow: job.workflow });
    logger.info('[handleSearchCrawl] BatchId before crawlSearch:', { batchId: job.workflow?.batchId });

    const rawResults = await crawlSearch(query);
    let parsedResults: Record<string, string[]> = {};
    try {
      parsedResults = JSON.parse(rawResults);
    } catch (err) {
      logger.error('[handleSearchCrawl] Failed to parse crawlSearch results as JSON', err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let totalLinks = 0;
    for (const platform of Object.keys(parsedResults)) {
      const links = parsedResults[platform];
      logger.info('[handleSearchCrawl] Links found for platform:', { platform, count: links.length, links });
      logger.info('[handleSearchCrawl] Workflow context at platform:', { workflow: job.workflow });
      logger.info('[handleSearchCrawl] BatchId at platform:', { batchId: job.workflow?.batchId });
      for (const link of links) {
        logger.info('[handleSearchCrawl] Processing link:', { platform, link });
        logger.info('[handleSearchCrawl] Workflow context at link:', { workflow: job.workflow });
        logger.info('[handleSearchCrawl] BatchId at link:', { batchId: job.workflow?.batchId });
        // Enforce workflow context presence
        if (!job.workflow || !job.workflow.batchId) {
          logger.warn('[handleSearchCrawl] Missing workflow context, cannot propagate batchId. Skipping job.', { job });
          logger.warn('[handleSearchCrawl] Workflow context at skip:', { workflow: job.workflow });
          logger.warn('[handleSearchCrawl] BatchId at skip:', { batchId: job.workflow?.batchId });
          continue;
        }
        // Log the full workflow context for debugging
        logger.info('[handleSearchCrawl] Workflow context before sending to postman:', { workflow: job.workflow });
        logger.info('[handleSearchCrawl] batchId before sending to postman:', { batchId: job.workflow.batchId });
        // Build payload for letterbox
        const payload = {
          type: 'crawl-media-queued',
          link,
          platform,
          workflow: job.workflow
        };
        logger.info('[handleSearchCrawl] Sending job to post-office (sendPostmanMessage):', {
          util: 'crawl-media',
          payload
        });
        await sendPostmanMessage({
          util: 'crawl-media',
          payload
        });
        totalLinks++;
      }
    }
    logger.info(`[handleSearchCrawl] Sent ${totalLinks} media scrape jobs to letterbox`);
  } catch (error) {
    logger.error('[handleSearchCrawl] Error processing job', error instanceof Error ? error : new Error(String(error)));
  }
}


function structureQuery(query: string): string {
  // TODO: Implement actual query structuring logic
  return query;
}
