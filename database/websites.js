const { dbRun, dbGet } = require('./database.js');

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


module.exports = {
    addWebsite,
    getWebsiteById,
    getWebsiteByUrl
};