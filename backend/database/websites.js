const { dbRun, dbGet, dbAll } = require('./config/database.js');

// Add a new website to the database
async function addWebsite(url, chatbotId) {
    try {
        const websiteId = await dbRun(
            `INSERT INTO website (domain, chatbot_id) VALUES (?, ?)`,
            [url, chatbotId]
        );
        return websiteId;
    } catch (err) {
        throw err;
    }
}

// Retrieve website by URL
async function getWebsiteById(websiteId) {
    try {
        const website = await dbGet(
            `SELECT * FROM website WHERE website_id = ?`,
            [websiteId]
        );
        return website;
    } catch (err) {
        throw err;
    }
}

// get website by URL
async function getWebsiteByUrl(url) {
    try {
        const website = await dbGet(
            `SELECT * FROM website WHERE domain = ?`,
            [url]
        );
        return website;
    } catch (err) {
        throw err;
    }
}

async function setLastCrawled(websiteId, lastCrawled) {
    try {
        await dbRun(
            `UPDATE website SET last_crawled = ? WHERE website_id = ?`,
            [lastCrawled, websiteId]
        );
    } catch (err) {
        throw err;
    }
}
async function getWebsitesByLastScrapedBefore(time) {
    try {
        const websites = await dbAll(
            `SELECT * FROM website 
             WHERE datetime(last_crawled) < datetime(?) OR last_crawled IS NULL OR last_crawled = ''
             ORDER BY last_crawled ASC`,
            [time.toISOString()]
        );
        return websites;
    } catch (err) {
        console.error('Error in getWebsitesByLastScrapedBefore:', err);
        throw err;
    }
}

// get the website url by chatbot id
async function getWebsiteByChatbotId(chatbotId) {
    const chatbot = await dbGet('SELECT website_id FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
    const website = await getWebsiteById(chatbot.website_id);
    return website;
}

module.exports = {
    addWebsite,
    getWebsiteById,
    getWebsiteByUrl,
    getWebsitesByLastScrapedBefore,
    setLastCrawled,
    getWebsiteByChatbotId
};