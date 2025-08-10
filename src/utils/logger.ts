import { getConfig } from '../config/index.js';

/**
 * Log levels enumeration
 */
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Simple logger implementation
 */
class Logger {
  private level: LogLevel | undefined;

  constructor(level?: string) {
    if (level) {
      this.level = this.parseLogLevel(level);
    }
  }

  private getLevel(): LogLevel {
    if (this.level === undefined) {
      // Lazy load the log level from config
      this.level = this.parseLogLevel(getConfig().LOG_LEVEL);
    }
    return this.level;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.getLevel()) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    console.log(`[${timestamp}] ${levelName}: ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

export const logger = new Logger();
