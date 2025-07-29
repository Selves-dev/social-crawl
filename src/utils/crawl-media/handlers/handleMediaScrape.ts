/**
 * Handles scraping of media URLs from the throttle queue
 * Standardises media info: username, thumbnail, video url, caption
 */

import { crawlSearch } from '../../shared/crawlSearch';
import { uploadJsonToBlob, getBlobName, getPlatform } from '../../shared/azureBlob';
import { logger } from '../../shared/logger';

export async function handleMediaScrape(job: { link: string; snippet: string; title: string; workflow: any }) {
  try {
    logger.info('[handleMediaScrape] Starting scrape for job', { link: job.link, workflow: job.workflow });
    const [mappedObject] = await crawlSearch(job.link);
    if (!mappedObject) {
      logger.error('[handleMediaScrape] No result from crawlSearch', new Error('No result from crawlSearch'));
      return;
    }

    const blobData = {
      ...mappedObject,
      workflow: job.workflow
    };

    const containerName = 'media-json'; // Change as needed
    const platform = getPlatform(mappedObject.link);
    const blobName = getBlobName({
      platform,
      type: 'json',
      id: mappedObject.id
    });
    const blobUrl = await uploadJsonToBlob(containerName, blobName, blobData);
    logger.info('[handleMediaScrape] Uploaded blob', { blobUrl });

    const postOfficeMessage = {
      blobUrl,
      workflow: job.workflow,
      action: 'prepare-media'
    };

    // await postOfficeQueue.addJob(postOfficeMessage);
    logger.info('[handleMediaScrape] Queued post-office message', { postOfficeMessage });
  } catch (error) {
    logger.error('[handleMediaScrape] Error processing job', error instanceof Error ? error : new Error(String(error)));
  }
}
