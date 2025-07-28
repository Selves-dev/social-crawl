import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv, QueueManager } from '../utils/shared'
import { postmanProcessor } from '../utils/shared/postman/processor'
export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting postman plugin...', { service: 'postman' })
  
  try {
    // Get configuration from environment variables
    const config = getServiceBusConfigFromEnv()
    
    // Connect to Azure Service Bus
    await serviceBus.connect(config)
    
    // Initialize throttle queues (but don't start processing yet)
    await QueueManager.initializeAllQueues()
    
    await postmanProcessor.initialize()
    
    logger.info('✅ Postman and throttle queues initialized', { 
      service: 'postman',
      throttleQueues: ['prep-media', 'ai-service', 'crawl-media'],
      mainQueue: 'post-office'
    })
    
    // Start main postman queue processing (long-running)
    await postmanProcessor.startProcessing()
    
    logger.info('📬 Postman processing started - ready for workflow messages', { 
      service: 'postman'
    })
    
    // Graceful shutdown handler
    nitroApp.hooks.hook('close', async () => {
      logger.info('Shutting down postman and throttle queues...', { service: 'postman' })
      
      // Stop main postman processor first
      await postmanProcessor.stop()
      
      // Stop throttle queues
      await QueueManager.stopAllThrottleQueues()
      
      // Then close main service bus connection
      await serviceBus.disconnect()
      
      logger.info('Postman shutdown complete', { service: 'postman' })
    })
    
  } catch (error) {
    logger.error('❌ Failed to connect to postman', error as Error, { service: 'postman' })
    
    // You might want to handle this error appropriately
    // For example, set a flag or retry logic
    // For now, we'll continue without postman connection
    logger.warn('Continuing without postman connection', { service: 'postman' })
  }
})
