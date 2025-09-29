/**
 * Security Middleware
 * Authentication middleware for API endpoints
 */

import { createError, defineEventHandler } from 'h3'
import { getSecurityManager, SecurityManager } from '../utils/shared'

/**
 * Middleware to validate API token
 */
export async function requireAuth(event: any): Promise<void> {
  const security = getSecurityManager()
  const headers = event.node.req.headers

  if (!security.validateApiToken(headers)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: SecurityManager.createAuthError('Invalid or missing API token')
    })
  }
}

/**
 * Optional auth - logs warning but doesn't block
 */
export async function optionalAuth(event: any): Promise<boolean> {
  const security = getSecurityManager()
  const headers = event.node.req.headers

  return security.validateApiToken(headers)
}

// Default middleware (not actually used, but Nitro expects it)
export default defineEventHandler(async (event) => {
  // This is just a placeholder - actual auth is handled in routes
})
