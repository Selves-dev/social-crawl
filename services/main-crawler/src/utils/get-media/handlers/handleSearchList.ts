import type { PostOfficeMessage } from '../../shared/types';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import { crawlSearch } from '../../shared/crawlSearch';
import { logger } from '../../shared/logger';

export async function handleSearchList(message: PostOfficeMessage): Promise<void> {
  try {
    const job = message.payload as any;
    const workflow = message.workflow;

    logger.info('[search-list] handleSearchList START', { job });
    
    if (!job.query) {
      logger.error('[search-list] Missing query in job payload', new Error('Missing query in job'), { job });
      throw new Error('Missing query in job');
    }

    const query = job.query;
    const rawResults = await crawlSearch(query);

    let parsedResults: string[] = [];
    try {
      parsedResults = JSON.parse(rawResults);
    } catch (err) {
      logger.error('[search-list] Failed to parse crawlSearch results as JSON', err instanceof Error ? err : new Error(String(err)));
      return;
    }

    for (const link of parsedResults) {
      logger.debug('[search-list] Sending job to post-office (sendToPostOffice):', {
        util: 'get-media',
        type: 'get-media',
        workflow: job.workflow,
        payload: { link }
      });

      await sendToPostOffice({
        util: 'get-media',
        type: 'get-media',
        apiSecret: process.env['taash-secret'],
        workflow,
        payload: { link }
      });
    }
    logger.info(`[search-list] Sent ${parsedResults.length} media scrape jobs to post-office`, { job });
  } catch (error) {
    logger.error('[search-list] Error processing message', error instanceof Error ? error : new Error(String(error)));
  }
}

function structureQuery(query: string): string {
  // TODO: Implement actual query structuring logic
  return query;
}