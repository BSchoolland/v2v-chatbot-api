import { db } from './database.js';

// Register a new website
function addWebsite(chatbotId, domain, lastCrawled) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO website (chatbot_id, domain, last_crawled) VALUES (?, ?, ?)`,
        [chatbotId, domain, lastCrawled],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve website details
  function getWebsiteById(websiteId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM website WHERE website_id = ?`,
        [websiteId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
  
  // Delete a website
  function deleteWebsite(websiteId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM website WHERE website_id = ?`,
        [websiteId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

}

module.exports = {
    addWebsite,
    getWebsiteById,
    deleteWebsite,
};