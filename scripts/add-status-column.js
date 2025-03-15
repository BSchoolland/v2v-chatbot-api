/**
 * Script to add the status column to the scrape_jobs table
 */
const sqlite3 = require('sqlite3').verbose();
const { JOB_STATUS } = require('../database/logging/scraper.js');

async function main() {
    try {
        console.log("Starting migration to add status column to scrape_jobs table...");
        
        // Open the database
        const db = new sqlite3.Database('data/logging_database.db', sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                process.exit(1);
            }
        });
        
        // Promisify db.run
        const run = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                resolve(this);
            });
        });
        
        // Promisify db.all
        const all = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        
        // Check if status column exists
        const tableInfo = await all("PRAGMA table_info(scrape_jobs)");
        const statusColumnExists = tableInfo.some(column => column.name === 'status');
        
        if (statusColumnExists) {
            console.log("Status column already exists. No migration needed.");
        } else {
            console.log("Adding status column to scrape_jobs table...");
            
            // Add the status column with default value of IN_PROGRESS (0)
            await run("ALTER TABLE scrape_jobs ADD COLUMN status INTEGER NOT NULL DEFAULT 0");
            
            // Update existing records based on success value
            console.log("Updating existing records with appropriate status values...");
            await run("UPDATE scrape_jobs SET status = ? WHERE success = 1", [JOB_STATUS.COMPLETED]);
            await run("UPDATE scrape_jobs SET status = ? WHERE success = 0", [JOB_STATUS.FAILED]);
            
            console.log("Migration completed successfully.");
        }
        
        // Close the database
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            }
        });
        
        process.exit(0);
    } catch (error) {
        console.error("Error during migration:", error);
        process.exit(1);
    }
}

// Run the script
main(); 