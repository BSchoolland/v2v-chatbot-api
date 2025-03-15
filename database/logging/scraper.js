const { dbRun, dbGet, dbAll } = require('./database.js');

// Status constants
const JOB_STATUS = {
    IN_PROGRESS: 0,
    COMPLETED: 1,
    FAILED: 2
};

/**
 * Log the start of a scrape job
 * @param {string} action - The action that triggered the scrape job (e.g., 'manual', 'scheduled', 'single_page')
 * @param {string} chatbotId - The ID of the chatbot associated with the scrape job
 * @returns {string} - The timestamp of when the job started (can be used to calculate duration)
 */
async function logScrapeJobStart(action = "", chatbotId = "") {
    try {
        const timestamp = new Date().toISOString();
        // We'll insert a placeholder record with default values that will be updated when the job completes
        await dbRun(
            'INSERT INTO scrape_jobs (timestamp, duration, pages_scraped, pages_failed, action, chatbot_id, success, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [timestamp, "0", 0, 0, action, chatbotId, 0, JOB_STATUS.IN_PROGRESS]
        );
        
        
        return timestamp;
    } catch (error) {
        console.error("Error logging scrape job start:", error);
        return new Date().toISOString(); // Return current timestamp even if logging failed
    }
}

/**
 * Log the completion of a scrape job
 * @param {string} startTimestamp - The timestamp when the job started (from logScrapeJobStart)
 * @param {number} pagesScraped - The number of pages successfully scraped
 * @param {number} pagesFailed - The number of pages that failed to scrape
 * @param {boolean} success - Whether the overall job was successful
 * @param {string} action - The action that triggered the scrape job
 * @param {string} chatbotId - The ID of the chatbot associated with the scrape job
 */
async function logScrapeJobCompletion(startTimestamp, pagesScraped = 0, pagesFailed = 0, success = true, action = "", chatbotId = "") {
    try {
        const endTimestamp = new Date();
        const startDate = new Date(startTimestamp);
        
        // Calculate duration in milliseconds
        const durationMs = endTimestamp - startDate;
        
        // Format duration as a human-readable string (e.g., "2m 30s")
        const durationFormatted = formatDuration(durationMs);
        
        // Convert boolean to integer for SQLite (1 for true, 0 for false)
        const successInt = success ? 1 : 0;
        
        // Set status based on success
        const status = success ? JOB_STATUS.COMPLETED : JOB_STATUS.FAILED;
        
        
        // First, check if the record exists
        const existingJob = await dbGet(
            'SELECT id FROM scrape_jobs WHERE chatbot_id = ? ORDER BY timestamp DESC LIMIT 1',
            [chatbotId]
        );
        
        if (!existingJob) {
            console.error(`No scrape job record found for chatbot ${chatbotId}. Creating a new record.`);
            // Create a new record if none exists
            await dbRun(
                'INSERT INTO scrape_jobs (timestamp, duration, pages_scraped, pages_failed, action, chatbot_id, success, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [startTimestamp, durationFormatted, pagesScraped, pagesFailed, action, chatbotId, successInt, status]
            );
        } else {
            // Update the existing record
            await dbRun(
                'UPDATE scrape_jobs SET duration = ?, pages_scraped = ?, pages_failed = ?, success = ?, action = ?, status = ? WHERE id = ?',
                [durationFormatted, pagesScraped, pagesFailed, successInt, action, status, existingJob.id]
            );
        }
        
        // Verify the update was successful
        const updatedJob = await dbGet(
            'SELECT * FROM scrape_jobs WHERE chatbot_id = ? ORDER BY timestamp DESC LIMIT 1',
            [chatbotId]
        );
        
        if (updatedJob) {
        } else {
            console.error(`Failed to verify scrape job update. No matching record found for chatbot ${chatbotId}.`);
        }
    } catch (error) {
        console.error("Error logging scrape job completion:", error);
    }
}

/**
 * Get all scrape job logs
 * @param {number} limit - Maximum number of logs to retrieve
 * @param {number} offset - Number of logs to skip
 * @returns {Array} - Array of scrape job logs
 */
async function getScrapeJobLogs(limit = 100, offset = 0) {
    try {
        return await dbAll(
            'SELECT * FROM scrape_jobs ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
    } catch (error) {
        console.error("Error retrieving scrape job logs", error);
        return [];
    }
}

/**
 * Get scrape job logs for a specific chatbot
 * @param {string} chatbotId - The ID of the chatbot
 * @param {number} limit - Maximum number of logs to retrieve
 * @param {number} offset - Number of logs to skip
 * @returns {Array} - Array of scrape job logs for the chatbot
 */
async function getScrapeJobLogsByChatbot(chatbotId, limit = 100, offset = 0) {
    try {
        return await dbAll(
            'SELECT * FROM scrape_jobs WHERE chatbot_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
            [chatbotId, limit, offset]
        );
    } catch (error) {
        console.error("Error retrieving scrape job logs for chatbot", error);
        return [];
    }
}

/**
 * Get scrape job statistics
 * @returns {Object} - Object containing scrape job statistics
 */
async function getScrapeJobStats() {
    try {
        const totalJobs = await dbGet('SELECT COUNT(*) as count FROM scrape_jobs');
        const completedJobs = await dbGet('SELECT COUNT(*) as count FROM scrape_jobs WHERE status = ?', [JOB_STATUS.COMPLETED]);
        const inProgressJobs = await dbGet('SELECT COUNT(*) as count FROM scrape_jobs WHERE status = ?', [JOB_STATUS.IN_PROGRESS]);
        const failedJobs = await dbGet('SELECT COUNT(*) as count FROM scrape_jobs WHERE status = ?', [JOB_STATUS.FAILED]);
        const totalPagesScraped = await dbGet('SELECT SUM(pages_scraped) as count FROM scrape_jobs');
        const totalPagesFailed = await dbGet('SELECT SUM(pages_failed) as count FROM scrape_jobs');
        
        // For backward compatibility, also check success field
        const successfulJobs = await dbGet('SELECT COUNT(*) as count FROM scrape_jobs WHERE success = 1');
        
        return {
            totalJobs: totalJobs.count,
            completedJobs: completedJobs.count,
            inProgressJobs: inProgressJobs.count,
            failedJobs: failedJobs.count,
            successfulJobs: successfulJobs.count, // For backward compatibility
            completionRate: totalJobs.count > 0 ? ((completedJobs.count / totalJobs.count) * 100) : 0,
            successRate: totalJobs.count > 0 ? ((successfulJobs.count / totalJobs.count) * 100) : 0, // For backward compatibility
            totalPagesScraped: totalPagesScraped.count || 0,
            totalPagesFailed: totalPagesFailed.count || 0,
            pageSuccessRate: (totalPagesScraped.count + totalPagesFailed.count) > 0 
                ? (totalPagesScraped.count / (totalPagesScraped.count + totalPagesFailed.count)) * 100 
                : 0
        };
    } catch (error) {
        console.error("Error retrieving scrape job statistics:", error);
        return {
            totalJobs: 0,
            completedJobs: 0,
            inProgressJobs: 0,
            failedJobs: 0,
            successfulJobs: 0,
            completionRate: 0,
            successRate: 0,
            totalPagesScraped: 0,
            totalPagesFailed: 0,
            pageSuccessRate: 0
        };
    }
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration string (e.g., "2h 30m 15s")
 */
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    
    return result.trim();
}

module.exports = { 
    logScrapeJobStart, 
    logScrapeJobCompletion,
    getScrapeJobLogs,
    getScrapeJobLogsByChatbot,
    getScrapeJobStats,
    JOB_STATUS,
};
