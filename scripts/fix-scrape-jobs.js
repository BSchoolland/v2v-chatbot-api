/**
 * Script to fix existing scrape job records with incorrect success values
 */
const { fixExistingScrapeJobs } = require('../database/logging/scraper.js');

async function main() {
    try {
        console.log("Starting scrape job fix script...");
        
        // Run the fix
        const fixedCount = await fixExistingScrapeJobs();
        
        console.log(`Script completed. Fixed ${fixedCount} scrape job records.`);
        process.exit(0);
    } catch (error) {
        console.error("Error running fix script:", error);
        process.exit(1);
    }
}

// Run the script
main(); 