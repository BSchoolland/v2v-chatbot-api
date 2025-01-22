const { db } = require('./database.js');

// Add new model
function addModel(maxContext, name, description, apiString, messageCost) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO models (max_context, name, description, api_string, message_cost) VALUES (?, ?, ?, ?, ?)`,
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
            `SELECT * FROM models WHERE model_id = ?`,
            [modelId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Get model by name
function getModelByName(name) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM models WHERE name = ?`,
            [name],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Get all available models for a plan type
function getAvailableModelsForPlanType(planTypeId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT m.* 
             FROM models m
             JOIN plan_type_model ptm ON m.model_id = ptm.model_id
             WHERE ptm.plan_type_id = ?
             ORDER BY m.message_cost ASC`,
            [planTypeId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Validate if a model is available for a plan type
function isModelAvailableForPlanType(modelId, planTypeId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 1 
             FROM plan_type_model 
             WHERE model_id = ? AND plan_type_id = ?`,
            [modelId, planTypeId],
            (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            }
        );
    });
}

// Get the default model
function getDefaultModel() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM models WHERE name = ?`,
            ['default'],
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
            `DELETE FROM models WHERE model_id = ?`,
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
    getModelByName,
    getAvailableModelsForPlanType,
    isModelAvailableForPlanType,
    getDefaultModel,
    deleteModel
};