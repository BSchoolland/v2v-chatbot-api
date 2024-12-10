import { db } from './database.js';

// Create a new chatbot
function createChatbot(planId, modelId, systemPrompt) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO chatbot (plan_id, model_id, system_prompt) VALUES (?, ?, ?)`,
        [planId, modelId, systemPrompt],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve chatbot details
  function getChatbotById(chatbotId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM chatbot WHERE chatbot_id = ?`,
        [chatbotId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
  
  // Update chatbot settings
  function updateChatbot(chatbotId, modelId, systemPrompt) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE chatbot SET model_id = ?, system_prompt = ? WHERE chatbot_id = ?`,
        [modelId, systemPrompt, chatbotId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  
  // Delete a chatbot
  function deleteChatbot(chatbotId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM chatbot WHERE chatbot_id = ?`,
        [chatbotId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
}

module.exports = {
    createChatbot,
    getChatbotById,
    updateChatbot,
    deleteChatbot,
};