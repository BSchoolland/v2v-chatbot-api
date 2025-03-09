import { scraperManager } from './scraperManager.js';
import { scheduleJob } from 'node-schedule';

// run a scrape on the bschoolland.com website every 3 minutes
scraperManager.addJob('https://bschoolland.com', 'bschoolland');
scheduleJob('*/3 * * * *', async () => {
    await scraperManager.addJob('https://bschoolland.com', 'bschoolland');
});

