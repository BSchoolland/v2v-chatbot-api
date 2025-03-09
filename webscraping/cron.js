const { scraperManager } = require('./scraperManager.js');
const { scheduleJob } = require('node-schedule');
const dotenv = require('dotenv');
dotenv.config();
const reCrawlInterval = process.env.RE_CRAWL_INTERVAL || 1440; // 1440 minutes = 24 hours
const cronCheckInterval = process.env.CRON_CHECK_INTERVAL || 15; // 15 minutes in production, 2 minutes in development
const { getWebsitesByLastScrapedBefore } = require('../database/websites');
let cronsScheduled = false;
function scheduleCronJobs() {
    // safeguard to prevent multiple cron jobs from being scheduled
    if (cronsScheduled) {
        return;
    }
    cronsScheduled = true;
    reCrawlOldWebsites();
    // run a scrape on all websites that have a last_scraped_at that is older than 30 minutes, check every 2 minutes
    scheduleJob(`*/${cronCheckInterval} * * * *`, async () => {
        await reCrawlOldWebsites();
    });
}

async function reCrawlOldWebsites() {
        // to avoid overloading the scraper, we'll only scrape the oldest website (the others can wait until the next cron job)
        const time = new Date(Date.now() - reCrawlInterval * 60 * 1000); // reCrawlInterval in minutes
        const websites = await getWebsitesByLastScrapedBefore(time);
        if (websites.length > 0) {
            console.log(`Found ${websites.length} websites waiting to be re-crawled`);
            const oldestWebsite = websites[0];
            console.log(`Re-crawling website ${oldestWebsite.domain} for chatbot ${oldestWebsite.chatbot_id}`);
            await scraperManager.addJob(oldestWebsite.domain, oldestWebsite.chatbot_id);
        } else {
        console.log('No websites waiting to be re-crawled');
    }
}

module.exports = {
    scheduleCronJobs
};
