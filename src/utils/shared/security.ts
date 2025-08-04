/**
 * Security Utilities
 * Handles API token validation and message security
 */

import { logger } from './logger'

export interface SecurityConfig {
  apiToken: string
  messageSecurityToken: string
  apiTokenHeaderName: string
  messageTokenProperty: string
  enableApiSecurity: boolean
}

export class SecurityManager {
  private config: SecurityConfig

  constructor(config: SecurityConfig) {
    this.config = config
  }

  /**
   * Validate API token from request headers
   */
  validateApiToken(headers: Record<string, string | string[] | undefined>): boolean {
    if (!this.config.enableApiSecurity) {
      logger.debug('API security disabled, allowing request', { service: 'security' })
      return true
    }

    const headerName = this.config.apiTokenHeaderName.toLowerCase()
    const providedToken = headers[headerName]

    if (!providedToken) {
      logger.warn('API request missing security token', { 
        service: 'security',
        headerName: this.config.apiTokenHeaderName
      })
      return false
    }

    const tokenValue = Array.isArray(providedToken) ? providedToken[0] : providedToken

    if (tokenValue !== this.config.apiToken) {
      logger.warn('API request with invalid security token', { 
        service: 'security',
        tokenLength: tokenValue?.length || 0
      })
      return false
    }

    logger.debug('API request authenticated successfully', { service: 'security' })
    return true
  }

  /**
   * Add security token to outgoing message
   */
  addMessageSecurity(messageProperties: any): any {
    return {
      ...messageProperties,
      [this.config.messageTokenProperty]: this.config.messageSecurityToken
    }
  }

  /**
   * Validate security token in incoming message
   */
  validateMessageSecurity(messageProperties: any): boolean {
    const providedToken = messageProperties?.[this.config.messageTokenProperty]

    if (!providedToken) {
      logger.warn('Message missing security token', { 
        service: 'security',
        messageId: messageProperties?.messageId
      })
      return false
    }

    if (providedToken !== this.config.messageSecurityToken) {
      logger.warn('Message with invalid security token', { 
        service: 'security',
        messageId: messageProperties?.messageId,
        tokenLength: providedToken?.length || 0
      })
      return false
    }

    logger.debug('Message authenticated successfully', { 
      service: 'security',
      messageId: messageProperties?.messageId
    })
    return true
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return result
  }

  /**
   * Create authentication error response
   */
  static createAuthError(message: string = 'Authentication required') {
    return {
      error: true,
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Get security configuration from environment variables
 */
export function getSecurityConfigFromEnv(): SecurityConfig {
  const apiToken = process.env["api-token"]
  const messageSecurityToken = process.env["message-security-token"]
  const apiTokenHeaderName = process.env["api-token-header-name"] || 'x-api-token'
  const messageTokenProperty = process.env["message-token-property"] || 'securityToken'
  const enableApiSecurity = process.env["enable-api-security"] !== 'false'

  if (!apiToken || !messageSecurityToken) {
    throw new Error('Security tokens not configured. Please set API_TOKEN and MESSAGE_SECURITY_TOKEN environment variables.')
  }

  if (apiToken.length < 32 || messageSecurityToken.length < 32) {
    logger.warn('Security tokens should be at least 32 characters long', { 
      service: 'security',
      apiTokenLength: apiToken.length,
      messageTokenLength: messageSecurityToken.length
    })
  }

  return {
    apiToken,
    messageSecurityToken,
    apiTokenHeaderName,
    messageTokenProperty,
    enableApiSecurity
  }
}

// Export singleton instance
let securityManager: SecurityManager | null = null

export function getSecurityManager(): SecurityManager {
  if (!securityManager) {
    const config = getSecurityConfigFromEnv()
    securityManager = new SecurityManager(config)
  }
  return securityManager
}

export { SecurityManager as default }
