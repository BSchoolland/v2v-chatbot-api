const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.resolve(__dirname, 'database.sqlite');

// Create and open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});


// table for websites
db.run(`
    CREATE TABLE IF NOT EXISTS websites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    }
});
// table for pages
db.run(`
    CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        external BOOLEAN DEFAULT 0,
        FOREIGN KEY (website_id) REFERENCES websites (id),
        UNIQUE (url)
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    }
});

async function insertWebsite(url) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO websites (url) VALUES (?)', [url], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function insertOrUpdatePage(websiteId, url, content, summary, external = false) {
    // if summary is not provided, use existing one or empty string
    if (!summary) {
        const existingPage = await getPageByUrl(url);
        summary = existingPage ? existingPage.summary : '';
    }
    return new Promise((resolve, reject) => {
        db.run('INSERT OR REPLACE INTO pages (website_id, url, summary, content, external) VALUES (?, ?, ?, ?, ?)', [websiteId, url, summary, content, external], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

async function getWebsiteByUrl(url, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                db.get('SELECT * FROM websites WHERE url = ?', [url], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        } catch (err) {
            if (attempt < retries) {
                await setTimeoutPromise(delay);
            } else {
                console.error('All attempts failed.');
                throw err;
            }
        }
    }
}

async function getPageByUrl(url) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM pages WHERE url = ?', [url], (err, row) => {
            if (err) {
                console.error("Error executing query:", err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function getUrlsByWebsiteId(websiteId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT url FROM pages WHERE website_id = ?', [websiteId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const urls = rows.map(row => row.url);
                resolve(urls);
            }
        });
    });
}


module.exports = {
    db,
    insertWebsite,
    insertOrUpdatePage,
    getWebsiteByUrl,
    getPageByUrl,
    getUrlsByWebsiteId
};