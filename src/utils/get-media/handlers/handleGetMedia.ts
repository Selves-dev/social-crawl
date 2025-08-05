import type { PostOfficeMessage } from '../../shared/types';
import { crawlSearch } from '../../shared/crawlSearch';
import type { CrawlSearchResult } from '../../shared/crawlSearch/types';
import { uploadJsonToBlob, getBlobName, getPlatform } from '../../shared/azureBlob';
import type { BlobManifest } from '../../shared/types';
import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';

export async function handleGetMedia(message: PostOfficeMessage): Promise<void> {
  try {
    logger.info('[get-media] handleGetMedia START', { message });
    
    const { payload, workflow } = message;
    const job = payload; // Assuming payload contains the job data
    
    if (!job.link) {
      logger.warn('[get-media] Job missing link property, skipping', { job });
      return;
    }

    const platform = job.platform || getPlatform(job.link);
    logger.info('[get-media] Scraping media for job', {
      link: job.link,
      platform,
      workflow,
      query: workflow?.query
    });

    const mappedObject = await crawlSearch(job.link, platform) as BlobManifest;
    if (!mappedObject) {
      logger.error(`[get-media] No result from crawlSearch: job=${JSON.stringify(job)}, platform=${platform}`);
      return;
    }

    // Upload mappedObject to Azure Blob and route blob URL to prep-media
    try {
      if (!workflow) {
        logger.error('[get-media] Missing workflow context, cannot route to prep-media', new Error('Missing workflow context'), { job });
        return;
      }
      
      const containerName = 'media';
      // Use mediaId or id, never link
      const id = mappedObject.mediaId || mappedObject.id;
      if (!id) {
        logger.error('[get-media] Cannot determine unique id for blob naming', new Error('Missing unique identifier'), {
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
      logger.debug('[get-media] Uploading mappedObject to blob', { containerName, blobName });
      const blobUrl = await uploadJsonToBlob(containerName, blobName, mappedObject);
      
      logger.debug('[get-media] Routing blobUrl to post-office for prep-media', { blobUrl, workflow });
      await sendToPostOffice({
        util: 'prep-media',
        type: 'prep-media',
        apiSecret: process.env['taash-secret'],
        workflow,
        payload: {
          blobUrl
        }
      });
      
      logger.info('[get-media] handleGetMedia END - blobUrl routed to prep-media', { blobUrl });
    } catch (err) {
      logger.error('[get-media] Failed to route blobUrl to post-office for prep-media', err instanceof Error ? err : new Error(String(err)), { job });
    }
  } catch (error) {
    logger.error('[get-media] Error processing message', error instanceof Error ? error : new Error(String(error)));
  }
}