
import { crawlMediaQueue } from '../throttleQueue';
import { sendPostmanMessage } from '../../shared/serviceBus';
import { crawlSearch } from '../../shared/crawlSearch';
import { WorkflowContext } from '../../shared/workflow';
import { logger } from '../../shared/logger';
import { JobEnvelope } from '../../shared/types';
import { SearchCrawlContext } from '../../shared/crawlSearch/types';

export async function handleSearchCrawl(job: JobEnvelope<SearchCrawlContext>) {
  try {

    logger.info('[handleSearchCrawl] START', { job });
    if (!job.context?.query) {
      logger.error('[handleSearchCrawl] Missing query in job context', new Error('Missing query in job'), { job });
      throw new Error('Missing query in job');
    }

    const query = job.context.query;
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
      for (const link of links) {
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
