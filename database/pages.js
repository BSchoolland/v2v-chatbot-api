import db from "./database.js";

// Add a page to a website
function addPage(websiteId, internal, url, summary, content, lastSeen) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO page (website_id, internal, url, summary, content, last_seen) VALUES (?, ?, ?, ?, ?, ?)`,
        [websiteId, internal, url, summary, content, lastSeen],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve pages for a website
  function getPagesByWebsite(websiteId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM page WHERE website_id = ?`,
        [websiteId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  // Delete a page
  function deletePage(pageId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM page WHERE page_id = ?`,
        [pageId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
}

module.exports = {
    addPage,
    getPagesByWebsite,
    deletePage,
};