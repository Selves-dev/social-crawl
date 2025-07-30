import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv } from '../utils/shared'

export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting service bus connection plugin...', { service: 'serviceBus' })
  try {
    const config = getServiceBusConfigFromEnv()
    await serviceBus.connect(config)
    nitroApp.hooks.hook('close', async () => {
      logger.info('Closing service bus connection...', { service: 'serviceBus' })
      await serviceBus.disconnect()
    })
  } catch (error) {
    logger.error('❌ Failed to connect to service bus', error as Error, { service: 'serviceBus' })
    logger.warn('Continuing without service bus connection', { service: 'serviceBus' })
  }
})
