
import { crawlSearch } from '../../shared/crawlSearch';
import { parseHtml as parseTiktokHtml } from '../../shared/crawlSearch/tiktokParser';
import { parseHtml as parseYoutubeHtml } from '../../shared/crawlSearch/youtubeParser';
// import { parseHtml as parseInstagramHtml } from '../../shared/crawlSearch/instagramParser';
import type { MediaObject } from '../../shared/crawlSearch/types';
import { uploadJsonToBlob, getBlobName, getPlatform } from '../../shared/azureBlob';
import { logger } from '../../shared/logger';
import { sendPostmanMessage } from '../../shared/serviceBus';

async function crawlMedia(link: string, platform: string): Promise<MediaObject | null> {
  const html = await crawlSearch(link);
  if (platform === 'tiktok') {
    const arr = parseTiktokHtml(html);
    return arr && arr[0] ? arr[0] : null;
  } else if (platform === 'youtube') {
    const arr = parseYoutubeHtml(html);
    return arr && arr[0] ? arr[0] : null;
  }
  // Add more platforms as needed
  return null;
}

export async function handleMediaScrape(job: { link: string; platform?: string; workflow: any }) {
  try {
    const query = job.workflow?.query;
    if (!job.link) {
      logger.warn('[handleMediaScrape] Job missing link property, skipping', { job });
      return;
    }
    if (job.link.includes('google.com')) {
      logger.info('[handleMediaScrape] Skipping job with google.com link', { link: job.link });
      return;
    }
    logger.info('[handleMediaScrape] Starting scrape for job', {
      link: job.link,
      platform: job.platform,
      workflow: job.workflow,
      query
    });
    const platform = job.platform || getPlatform(job.link);
    const mappedObject = await crawlMedia(job.link, platform);
    if (!mappedObject) {
      logger.error('[handleMediaScrape] No result from crawlMedia', new Error('No result from crawlMedia'));
      return;
    }
    // Example: continue processing mappedObject as needed
    // ...existing code for processing mappedObject, blob upload, post-office message...
  } catch (error) {
    logger.error('[handleMediaScrape] Error processing job', error instanceof Error ? error : new Error(String(error)));
  }
}
