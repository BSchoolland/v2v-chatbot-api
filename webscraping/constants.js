/**
 * Constants for web scraping functionality
 */

// Define job action types
const JOB_ACTION_TYPES = {
    INITIAL: 'initial',       // First crawl triggered by API
    SCHEDULED: 'scheduled',   // Triggered by cron scheduler
    MANUAL: 'manual',         // Manually triggered by user
    SINGLE_PAGE: 'single_page' // Single page scrape
};

module.exports = {
    JOB_ACTION_TYPES
}; 