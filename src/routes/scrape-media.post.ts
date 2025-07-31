import { defineEventHandler, readBody } from 'h3';
import { handleMediaScrape } from '../utils/crawl-media/handlers/handleMediaScrape';
import { logger } from '../utils/shared/logger';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { link, workflow, platform } = body || {};
    if (!link) {
      logger.warn('[scrape-media] Missing link in request body', { body });
      return { error: 'Missing link in request body' };
    }
    // Build MediaScrapeJob
    const job = {
      link,
      platform: platform || '',
      workflow: workflow || {},
    };
    await handleMediaScrape(job);
    return { status: 'ok', message: 'Media scrape triggered', link };
  } catch (err) {
    logger.error('[scrape-media] Error handling request', err instanceof Error ? err : new Error(String(err)));
    return { error: 'Failed to trigger media scrape' };
  }
});
