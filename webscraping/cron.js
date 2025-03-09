const { scraperManager } = require('./scraperManager.js');
const { scheduleJob } = require('node-schedule');

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
    scheduleJob('*/2 * * * *', async () => {
        await reCrawlOldWebsites();
    });
}

async function reCrawlOldWebsites() {
    const websites = await getWebsitesByLastScrapedBefore(new Date(Date.now() - 30 * 60 * 1000));
        // to avoid overloading the scraper, we'll only scrape the oldest website (the others can wait until the next cron job)

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
