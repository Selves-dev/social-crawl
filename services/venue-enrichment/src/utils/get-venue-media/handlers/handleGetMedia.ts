import type { PostOfficeMessage } from '../../shared/types';
import { crawlSearch } from '../../shared/crawlSearch';
import type { BlobManifest } from '../../shared/types';
import { uploadJsonToBlob, getBlobName, getPlatform } from '../../shared/azureBlob';
import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';

export async function handleGetMedia(message: PostOfficeMessage): Promise<void> {
  try {
    logger.info('[get-venue-media] handleGetMedia START', { message });
    const { payload, workflow } = message;
    const job = payload;
    if (!job.link) {
      logger.warn('[get-venue-media] Job missing link property, skipping', { job });
      return;
    }
    const platform = job.platform || getPlatform(job.link);
    logger.info('[get-venue-media] Scraping media for job', {
      link: job.link,
      platform,
      workflow,
      query: workflow?.query
    });
    const mappedObject = await crawlSearch(job.link, platform, workflow, logger) as BlobManifest;
    if (!mappedObject) {
      logger.error(`[get-venue-media] No result from crawlSearch: job=${JSON.stringify(job)}, platform=${platform}`);
      return;
    }
    try {
      if (!workflow) {
        logger.error('[get-venue-media] Missing workflow context, cannot route to prep-media', new Error('Missing workflow context'), { job });
        return;
      }
      const containerName = 'media';
      const id = mappedObject.mediaId || mappedObject.id;
      if (!id) {
        logger.error('[get-venue-media] Cannot determine unique id for blob naming', new Error('Missing unique identifier'), {
          platform,
          link: job.payload?.link,
          mappedObject: { 
            mediaId: mappedObject.mediaId, 
            id: mappedObject.id, 
            link: mappedObject.link 
          }
        });
        return;
      }
      const blobName = getBlobName({ platform, id });
      logger.info('[get-venue-media] Uploading mappedObject to blob', { containerName, blobName });
      const blobUrl = await uploadJsonToBlob(containerName, blobName, mappedObject);
      logger.info('[get-venue-media] Routing blobUrl to post-office for prep-media', { blobUrl, workflow });
      await sendToPostOffice({
        util: 'prep-media',
        type: 'prep-media',
        apiSecret: process.env['taash-secret'],
        workflow,
        payload: {
          blobUrl,
        }
      });
      logger.info('[get-venue-media] handleGetMedia END - blobUrl routed to prep-media', { blobUrl });
    } catch (err) {
      logger.error('[get-venue-media] Failed to route blobUrl to post-office for prep-media', err instanceof Error ? err : new Error(String(err)), { job });
    }
  } catch (error) {
    logger.error('[get-venue-media] Error processing message', error instanceof Error ? error : new Error(String(error)));
  }
}
