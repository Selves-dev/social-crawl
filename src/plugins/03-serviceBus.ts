import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv, QueueManager } from '../utils/shared'
import { startGetMediaIntray } from '../utils/get-media/letterbox'
import { startPrepMediaIntray } from '../utils/prep-media/letterbox'
import { startAnalyseMediaIntray } from '../utils/analyse-media/letterbox'
import { startAIServiceIntray } from '../utils/ai-service/letterbox'


export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting service bus connection plugin...', { service: 'serviceBus' })
  try {
    // Use lowercase-dash convention for env var
    const config = getServiceBusConfigFromEnv()
    await serviceBus.connect(config)
    await QueueManager.initializeAllQueues()
    
    // Register queue subscribers (intrays) - letterboxes handle queue subscription
    startGetMediaIntray()
    startPrepMediaIntray()
    startAnalyseMediaIntray()
    startAIServiceIntray()
    
    logger.info('✅ Service bus and queues initialized', {
      service: 'serviceBus',
      queues: ['prep-media', 'ai-service', 'get-media', 'analyse-media']
    })
    
    nitroApp.hooks.hook('close', async () => {
      logger.info('🛑 Gracefully shutting down service bus and queues...', { service: 'serviceBus' })
      try {
        // Give in-flight jobs a moment to complete
        logger.info('Waiting for in-flight jobs to complete...', { service: 'serviceBus' })
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Stop all throttle queues
        await QueueManager.stopAllQueues()
        
        // Disconnect from service bus
        await serviceBus.disconnect()
        
        logger.info('✅ Service bus and queues shut down gracefully', { service: 'serviceBus' })
      } catch (error) {
        logger.error('❌ Error during graceful shutdown', error as Error, { service: 'serviceBus' })
      }
    })
  } catch (error) {
    logger.error('❌ Failed to connect to service bus or start queues', error as Error, { service: 'serviceBus' })
    logger.warn('Continuing without service bus connection', { service: 'serviceBus' })
  }
})
