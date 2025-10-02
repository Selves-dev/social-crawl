

import { defineNitroPlugin } from 'nitropack/runtime'
import { logger } from '../utils/shared'
import { postOffice } from '../utils/shared/postOffice/postman';
import { prepMediaLetterbox } from '../utils/prep-media/letterbox';
import { aiServiceLetterbox } from '../utils/ai-service/letterbox';
import { analyseMediaLetterbox } from '../utils/analyse-media/letterbox';
import { getVenueMediaLetterbox } from '../utils/get-venue-media/letterbox';
import { findInfoLetterbox } from '../utils/find-info/letterbox';
import { enrichStaticLetterbox } from '../utils/enrich-static/letterbox';

export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting PostOffice plugin...', { service: 'post-office' })
  try {
  postOffice.registerLetterbox('find-info', findInfoLetterbox);
  postOffice.registerLetterbox('enrich-static', enrichStaticLetterbox);
    postOffice.registerLetterbox('prep-media', prepMediaLetterbox);
    postOffice.registerLetterbox('ai-service', aiServiceLetterbox);
    postOffice.registerLetterbox('analyse-media', analyseMediaLetterbox);
  // postOffice.registerLetterbox('get-media', handleGetMediaLetterbox);
    // Add more as needed

    logger.info('📪 PostOffice letterboxes registered', { service: 'post-office', registeredUtils: postOffice.getRegisteredUtils() })

    // Initialize and start post-office queue processing (new architecture)
    const { postOfficeQueue } = await import('../utils/shared/postOffice/queue');
    await postOfficeQueue.initialize();
    await postOfficeQueue.startProcessing();
    logger.info('📪 PostOffice queue processing started - ready for routing messages', { service: 'post-office' })

    nitroApp.hooks.hook('close', async () => {
      logger.info('Shutting down PostOffice...', { service: 'post-office' })
      await postOfficeQueue.stop();
      logger.info('PostOffice shutdown complete', { service: 'post-office' })
    });
  } catch (error) {
    logger.error('❌ Failed to start PostOffice', error as Error, { service: 'post-office' });
    logger.warn('Continuing without PostOffice', { service: 'post-office' });
  }
})
