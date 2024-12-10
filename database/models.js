import { db } from './database.js';

// Add new model
function addModel(maxContext, name, description, apiString, messageCost) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO model (max_context, name, description, api_string, message_cost) VALUES (?, ?, ?, ?, ?)`,
        [maxContext, name, description, apiString, messageCost],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }
  
  // Retrieve model information
  function getModelById(modelId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM model WHERE model_id = ?`,
        [modelId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
  
  // Delete a model
  function deleteModel(modelId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM model WHERE model_id = ?`,
        [modelId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
}

module.exports = {
    addModel,
    getModelById,
    deleteModel,
};