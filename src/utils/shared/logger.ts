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

// Global log level (set to 'info' to suppress debug logs)
let globalLogLevel: LogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel) {
  globalLogLevel = level;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (globalLogLevel !== LogLevel.DEBUG) return;
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message;
    console.debug(`[DEBUG] ${truncatedMessage}`, context ? JSON.stringify(context) : '');
  },
  info: (message: string, context?: LogContext) => {
    if (globalLogLevel === LogLevel.ERROR || globalLogLevel === LogLevel.WARN) return;
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message;
    console.info(`[INFO] ${truncatedMessage}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: LogContext) => {
    if (globalLogLevel === LogLevel.ERROR) return;
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message;
    console.warn(`[WARN] ${truncatedMessage}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: Error, context?: LogContext) => {
    const truncatedMessage = message.length > 300 ? message.substring(0, 300) + '...' : message;
    console.error(`[ERROR] ${truncatedMessage}`, error?.stack || error, context ? JSON.stringify(context) : '');
  }
};
