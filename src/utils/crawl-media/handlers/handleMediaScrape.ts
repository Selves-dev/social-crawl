
import { crawlSearch } from '../../shared/crawlSearch';
// ...existing code...
import { parseHtml as parseYoutubeHtml } from '../../shared/crawlSearch/youtubeParser';
// import { parseHtml as parseInstagramHtml } from '../../shared/crawlSearch/instagramParser';
import type { MediaObject } from '../../shared/crawlSearch/types';
import { MediaScrapeJob } from '../../shared/types';
import { uploadJsonToBlob, getBlobName, getPlatform } from '../../utils/shared/azureBlob';
import type { BlobManifest } from '../../shared/types';
import { logger } from '../../shared/logger';
import { sendPostmanMessage } from '../../shared/serviceBus';



export async function handleMediaScrape(job: MediaScrapeJob) {
  try {
    logger.info('[handleMediaScrape] START', { job });
    const query = job.workflow?.query;
    if (!job.link) {
      logger.warn('[handleMediaScrape] Job missing link property, skipping', { job });
      return;
    }

    const platform = job.platform || getPlatform(job.link);
    logger.info('[handleMediaScrape] Scraping media for job', {
      link: job.link,
      platform,
      workflow: job.workflow,
      query
    });

    const mappedObject = await crawlSearch(job.link, platform) as BlobManifest;
    if (!mappedObject) {
      logger.error(`[handleMediaScrape] No result from crawlSearch: job=${JSON.stringify(job)}, platform=${platform}`);
      return;
    }

    // Upload mappedObject to Azure Blob and route blob URL to prep-media
    try {
      if (!job.workflow) {
        logger.error('[handleMediaScrape] Missing workflow context, cannot route to prep-media', new Error('Missing workflow context'), { job });
        return;
      }
      const workflow = job.workflow;
      const containerName = 'media';
      const blobName = getBlobName({ platform, id: mappedObject.id || job.link });
      logger.info('[handleMediaScrape] Uploading mappedObject to blob', { containerName, blobName });
      const blobUrl = await uploadJsonToBlob(containerName, blobName, mappedObject);
      logger.info('[handleMediaScrape] Routing blobUrl to post-office for prep-media', { blobUrl, workflow });
      await sendPostmanMessage({
        type: 'prep-media',
        context: workflow,
        payload: {
          blobUrl
        }
      });
      logger.info('[handleMediaScrape] END - blobUrl routed to prep-media', { blobUrl });
    } catch (err) {
      logger.error('[handleMediaScrape] Failed to route blobUrl to post-office for prep-media', err instanceof Error ? err : new Error(String(err)), { job });
    }
  } catch (error) {
    logger.error('[handleMediaScrape] Error processing job', error instanceof Error ? error : new Error(String(error)));
  }
}
