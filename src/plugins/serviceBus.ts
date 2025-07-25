import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv } from '../utils/shared'

export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting service bus connection plugin...', { service: 'serviceBus' })
  
  try {
    // Get configuration from environment variables
    const config = getServiceBusConfigFromEnv()
    
    // Connect to Azure Service Bus
    await serviceBus.connect(config)
    
    // Graceful shutdown handler
    nitroApp.hooks.hook('close', async () => {
      logger.info('Closing service bus connection...', { service: 'serviceBus' })
      await serviceBus.disconnect()
    })
    
  } catch (error) {
    logger.error('❌ Failed to connect to service bus', error as Error, { service: 'serviceBus' })
    
    // You might want to handle this error appropriately
    // For example, set a flag or retry logic
    // For now, we'll continue without service bus connection
    logger.warn('Continuing without service bus connection', { service: 'serviceBus' })
  }
})
