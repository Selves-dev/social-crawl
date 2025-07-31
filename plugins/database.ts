/**
 * Database Plugin
 * Initializes MongoDB Atlas connection on server startup
 */

export default defineNitroPlugin(async (nitroApp) => {
  logger.info('🚀 Starting database plugin...', { service: 'database' })
  try {
    const uri = process.env["MONGODB-URI"]
    await db.connect(uri)
    logger.info('✅ Database plugin initialized successfully', { service: 'database' })
  } catch (error) {
    logger.error('❌ Failed to initialize database plugin', error as Error, { service: 'database' })
    logger.warn('Continuing without database connection', { service: 'database' })
  }
  nitroApp.hooks.hook('close', async () => {
    logger.info('🔄 Closing database connection...', { service: 'database' })
    await db.disconnect()
  })
})
