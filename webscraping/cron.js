const { scraperManager } = require('./scraperManager.js');
const { scheduleJob } = require('node-schedule');
const dotenv = require('dotenv');
const { dbAll } = require('../backend/database/config/database.js');
const { checkAndRenewCredits } = require('../backend/database/queries');
const { getCurrentDate } = require('../backend/database/utils/dateUtils.js');
dotenv.config();

const reCrawlInterval = process.env.RE_CRAWL_INTERVAL || 1440; // 1440 minutes = 24 hours
const cronCheckInterval = process.env.CRON_CHECK_INTERVAL || 15; // 15 minutes in production, 2 minutes in development
const { getWebsitesByLastScrapedBefore } = require('../backend/database/queries');
let cronsScheduled = false;

async function checkRenewalOnCredits() {
    try {
        // Get all plans
        const plans = await dbAll('SELECT plan_id FROM plans');
        
        // Check and renew credits for each plan
        for (const plan of plans) {
            try {
                await checkAndRenewCredits(plan.plan_id);
            } catch (error) {
                console.error(`Error renewing credits for plan ${plan.plan_id}:`, error);
                // Continue with other plans even if one fails
            }
        }
    } catch (error) {
        console.error('Error in credit renewal job:', error);
    }
}

function scheduleCronJobs() {
    // safeguard to prevent multiple cron jobs from being scheduled
    if (cronsScheduled) {
        return;
    }
    cronsScheduled = true;

    // Schedule immediate execution of re-crawling
    reCrawlOldWebsites();
    checkRenewalOnCredits();

    // Schedule recurring website re-crawling
    scheduleJob(`*/${cronCheckInterval} * * * *`, async () => {
        await reCrawlOldWebsites();
    });

    // Schedule credit renewal to run every ____
    scheduleJob(`*/${cronCheckInterval} * * * *`, async () => {
        await checkRenewalOnCredits();
    });

    console.log('Cron jobs scheduled: website re-crawling and credit renewal');
}

async function reCrawlOldWebsites() {
    // to avoid overloading the scraper, we'll only scrape the oldest website (the others can wait until the next cron job)
    const now = getCurrentDate();
    const time = new Date(now.getTime() - reCrawlInterval * 60 * 1000); // reCrawlInterval in minutes
    const websites = await getWebsitesByLastScrapedBefore(time);
    if (websites.length > 0) {
        const oldestWebsite = websites[0];
        await scraperManager.addJob(oldestWebsite.domain, oldestWebsite.chatbot_id, 5, 50, 'scheduled');
    } 
}

module.exports = {
    scheduleCronJobs,
    checkRenewalOnCredits // Exported for testing purposes
};
