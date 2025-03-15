const fs = require('fs');
const path = require('path');

/**
 * Format a date to YYYY-MM-DD format
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a date to YYYY-MM-DD HH:MM:SS.SSS format
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string with time
 */
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * A simple file-based logger for less frequently accessed logs
 */
class FileLogger {
    /**
     * Create a new FileLogger instance
     * @param {Object} options - Logger configuration options
     * @param {string} options.logDir - Directory to store log files (default: 'logs')
     * @param {string} options.logPrefix - Prefix for log files (default: 'app')
     * @param {boolean} options.dailyRotation - Whether to create a new log file each day (default: true)
     * @param {boolean} options.appendTimestamp - Whether to append timestamp to each log entry (default: true)
     */
    constructor(options = {}) {
        this.logDir = options.logDir || 'data/logs';
        this.logPrefix = options.logPrefix || 'app';
        this.dailyRotation = options.dailyRotation !== false;
        this.appendTimestamp = options.appendTimestamp !== false;
        
        // Create log directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Get the current log file path
     * @returns {string} - Path to the current log file
     */
    getLogFilePath() {
        let filename;
        
        if (this.dailyRotation) {
            const dateStr = formatDate(new Date());
            filename = `${this.logPrefix}-${dateStr}.log`;
        } else {
            filename = `${this.logPrefix}.log`;
        }
        
        return path.join(this.logDir, filename);
    }

    /**
     * Format a log message
     * @param {string} level - Log level (info, warn, error, etc.)
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     * @returns {string} - Formatted log message
     */
    formatLogMessage(level, message, data = null) {
        let logEntry = '';
        
        if (this.appendTimestamp) {
            logEntry += `[${formatDateTime(new Date())}] `;
        }
        
        logEntry += `[${level.toUpperCase()}] ${message}`;
        
        if (data) {
            try {
                if (typeof data === 'object') {
                    logEntry += ` ${JSON.stringify(data)}`;
                } else {
                    logEntry += ` ${data}`;
                }
            } catch (error) {
                logEntry += ` [Error serializing data: ${error.message}]`;
            }
        }
        
        return logEntry;
    }

    /**
     * Write a log entry to the file
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    log(level, message, data = null) {
        try {
            const logFilePath = this.getLogFilePath();
            const logEntry = this.formatLogMessage(level, message, data);
            
            fs.appendFileSync(logFilePath, logEntry + '\n');
        } catch (error) {
            console.error(`Error writing to log file: ${error.message}`);
        }
    }

    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    info(message, data = null) {
        this.log('info', message, data);
    }

    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    warn(message, data = null) {
        this.log('warn', message, data);
    }

    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    error(message, data = null) {
        this.log('error', message, data);
    }

    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    debug(message, data = null) {
        this.log('debug', message, data);
    }

    /**
     * Create a child logger with a specific context
     * @param {string} context - Context name for the child logger
     * @returns {Object} - Child logger instance
     */
    child(context) {
        const childLogger = {};
        
        ['info', 'warn', 'error', 'debug'].forEach(level => {
            childLogger[level] = (message, data = null) => {
                this.log(level, `[${context}] ${message}`, data);
            };
        });
        
        return childLogger;
    }
}

// Create default logger instance
const defaultLogger = new FileLogger();

module.exports = {
    FileLogger,
    logger: defaultLogger
}; 