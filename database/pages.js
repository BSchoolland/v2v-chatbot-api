const { dbRun, dbGet, dbAll } = require('./database.js');

// Add a new page to the database or update if exists
async function addPage(websiteId, url, summary, content, internal = true, internalLinks = '', externalLinks = '') {
    try {
        const existingPage = await dbGet(
            `SELECT page_id FROM page WHERE website_id = ? AND url = ?`,
            [websiteId, url]
        );

        if (existingPage) {
            await dbRun(
                `UPDATE page 
                SET summary = ?, content = ?, date_updated = ?
                WHERE website_id = ? AND url = ?`,
                [summary, content, new Date().toISOString(), websiteId, url]
            );
            return existingPage.page_id;
        } else {
            const pageId = await dbRun(
                `INSERT INTO page (website_id, internal, url, summary, content, date_updated) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [websiteId, internal, url, summary, content, new Date().toISOString()]
            );
            return pageId;
        }
    } catch (err) {
        throw err;
    }
}

// Retrieve pages for a website
async function getPagesByWebsite(websiteId) {
    try {
        const pages = await dbAll(
            `SELECT * FROM page WHERE website_id = ?`,
            [websiteId]
        );
        if (!Array.isArray(pages)) {
            return [pages];
        }
        return pages;
    } catch (err) {
        throw err;
    }
}

// retrieve page by url and website id
async function getPageByUrlAndWebsiteId(websiteId, url) {
    try {
        const page = await dbGet(
            `SELECT * FROM page WHERE website_id = ? AND url = ?`,
            [websiteId, url]
        );
        return page;
    } catch (err) {
        throw err;
    }
}

// Delete a page from the database
async function deletePage(pageId) {
    try {
        await dbRun(
            `DELETE FROM page WHERE page_id = ?`,
            [pageId]
        );
    } catch (err) {
        throw err;
    }
}

async function getPageSummariesBySiteId(websiteId) {
    try {
        const pages = await dbGet(
            `SELECT url, summary FROM page WHERE website_id = ?`,
            [websiteId]
        );
        return pages;
    } catch (err) {
        throw err;
    }
}


module.exports = {
    addPage,
    getPagesByWebsite,
    getPageByUrlAndWebsiteId,
    deletePage,
    getPageSummariesBySiteId
};