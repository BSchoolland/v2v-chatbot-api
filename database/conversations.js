import { db } from './database.js';

// Store a recorded conversation
function storeConversation(chatbotId, conversation, pageUrl, date) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO recorded_conversation (chatbot_id, conversation, page_url, date) VALUES (?, ?, ?, ?)`,
        [chatbotId, conversation, pageUrl, date],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve conversations for a chatbot
  function getConversationsByChatbot(chatbotId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM recorded_conversation WHERE chatbot_id = ?`,
        [chatbotId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
  
  // Delete a recorded conversation
  function deleteConversation(recordedConversationId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM recorded_conversation WHERE recorded_conversation_id = ?`,
        [recordedConversationId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
}

module.exports = {
    storeConversation,
    getConversationsByChatbot,
    deleteConversation,
};