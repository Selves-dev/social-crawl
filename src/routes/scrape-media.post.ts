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
    let errorMsg = 'Failed to trigger media scrape';
    if (err && typeof err === 'object' && 'isAxiosError' in err && (err as any).isAxiosError) {
      // Axios error: show status and message only
      const status = (err as any).response?.status;
      const msg = (err as any).message || '';
      errorMsg = `AxiosError: ${msg}${status ? ' (status ' + status + ')' : ''}`;
      logger.warn('[scrape-media] Axios error', { message: msg, status });
    } else {
      logger.error('[scrape-media] Error handling request', err instanceof Error ? err : new Error(String(err)));
    }
    return { error: errorMsg };
  }
});
