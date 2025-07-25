/**
 * Logging Utilities
 * Provides structured logging across all services
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  service?: string
  requestId?: string
  userId?: string
  [key: string]: any
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message
    // TODO: Implement structured debug logging
    console.debug(`[DEBUG] ${truncatedMessage}`, context ? JSON.stringify(context) : '')
  },
  
  info: (message: string, context?: LogContext) => {
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message
    // TODO: Implement structured info logging
    console.info(`[INFO] ${truncatedMessage}`, context ? JSON.stringify(context) : '')
  },
  
  warn: (message: string, context?: LogContext) => {
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message
    // TODO: Implement structured warn logging
    console.warn(`[WARN] ${truncatedMessage}`, context ? JSON.stringify(context) : '')
  },
  
  error: (message: string, error?: Error, context?: LogContext) => {
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message
    // TODO: Implement structured error logging
    console.error(`[ERROR] ${truncatedMessage}`, error?.stack || error, context ? JSON.stringify(context) : '')
  }
}
