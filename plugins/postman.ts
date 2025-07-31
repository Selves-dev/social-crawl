import { defineNitroPlugin } from 'nitropack/runtime'
import { logger, serviceBus, getServiceBusConfigFromEnv, QueueManager } from '../utils/shared'
import { postmanProcessor } from '../utils/shared/postman/processor'
export default defineNitroPlugin(() => {
  // Minimal hello world plugin for Nitro
  // If you see this log, plugin system works
  // eslint-disable-next-line no-console
  console.log('[postman plugin] Hello world: plugin loaded');
})
  
  // This plugin is stubbed out to isolate issues with postman
