import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv } from '../utils/shared'
import { postmanProcessor } from '../utils/shared/postman/processor'
import { QueueManager } from '../utils/shared/index'

export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting postman plugin...', { service: 'postman' })
  try {
    const config = getServiceBusConfigFromEnv()
    await serviceBus.connect(config)
    await QueueManager.initializeAllQueues()
    await postmanProcessor.initialize()
    logger.info('✅ Postman and throttle queues initialized', { 
      service: 'postman',
      throttleQueues: ['prep-media', 'ai-service', 'search-crawl', 'crawl-media'],
      mainQueue: 'post-office'
    })
    await postmanProcessor.startProcessing()
    logger.info('📬 Postman processing started - ready for workflow messages', { service: 'postman' })
    nitroApp.hooks.hook('close', async () => {
      logger.info('Shutting down postman and throttle queues...', { service: 'postman' })
      await postmanProcessor.stop()
      await QueueManager.stopAllThrottleQueues()
      await serviceBus.disconnect()
      logger.info('Postman shutdown complete', { service: 'postman' })
    })
  } catch (error) {
    logger.error('❌ Failed to connect to postman', error as Error, { service: 'postman' })
    logger.warn('Continuing without postman connection', { service: 'postman' })
  }
})
