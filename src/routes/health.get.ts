import { defineEventHandler, setHeaders } from 'h3'
import { optionalAuth } from '../middleware/auth'
import { db } from '../utils/shared/database'
import { createGemmaClientFromEnv } from '../utils/ai-service'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  
  // Optional auth - logs warning but doesn't block health checks
  const isAuthenticated = await optionalAuth(event)
  
  // Check database health
  const dbHealth = await db.healthCheck()
  
  // Check Gemma AI health (if configured)
  let gemmaHealth = 'not-configured'
  const gemmaClient = createGemmaClientFromEnv()
  if (gemmaClient) {
    try {
      const isHealthy = await gemmaClient.healthCheck()
      gemmaHealth = isHealthy ? 'healthy' : 'unhealthy'
    } catch (error) {
      gemmaHealth = 'error'
    }
  }
  
  // Basic health checks
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      server: 'ok',
      serviceBus: 'connected', // TODO: Check actual service bus connection status
      database: dbHealth.status,
      gemmaAI: gemmaHealth,
      ...(dbHealth.latency && { databaseLatency: `${dbHealth.latency}ms` }),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      },
      authenticated: isAuthenticated
    },
    responseTime: `${Date.now() - startTime}ms`
  }
  
  // Set appropriate headers
  setHeaders(event, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  })
  
  return health
})
