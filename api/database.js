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
    } else {
        console.log('Websites table created or already exists.');
    }
});
// table for pages
//TODO: add more columns to pages table
db.run(`
    CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites (id),
        UNIQUE (url)
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('Pages table created or already exists.');
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

async function insertOrUpdatePage(websiteId, url, content) {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR REPLACE INTO pages (website_id, url, content) VALUES (?, ?, ?)', [websiteId, url, content], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

async function getWebsiteByUrl(url) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM websites WHERE url = ?', [url], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function getPageByUrl(url) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM pages WHERE url = ?', [url], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


module.exports = {
    db,
    insertWebsite,
    insertOrUpdatePage,
    getWebsiteByUrl,
    getPageByUrl
};