const { dbGet, dbRun, dbAll } = require('./database.js');

// Add new model
function addModel(maxContext, name, description, apiString, messageCost) {
    return dbRun(
        `INSERT INTO models (max_context, name, description, api_string, message_cost) VALUES (?, ?, ?, ?, ?)`,
        [maxContext, name, description, apiString, messageCost]
    );
}

// Get model by ID
function getModelById(modelId) {
    return dbGet(
        `SELECT * FROM models WHERE model_id = ?`,
        [modelId]
    );
}

// Get model by name
function getModelByName(name) {
    return dbGet(
        `SELECT * FROM models WHERE name = ?`,
        [name]
    );
}

// Get available models for plan type
function getAvailableModelsForPlanType(planTypeId) {
    return dbAll(
        `SELECT m.* FROM models m
        INNER JOIN plan_type_model ptm ON m.model_id = ptm.model_id
        WHERE ptm.plan_type_id = ?`,
        [planTypeId]
    );
}

// Check if model is available for plan type
function isModelAvailableForPlanType(modelId, planTypeId) {
    return dbGet(
        `SELECT 1 FROM plan_type_model 
        WHERE model_id = ? AND plan_type_id = ?`,
        [modelId, planTypeId]
    ).then(row => !!row);
}

// Get the default model
function getDefaultModel() {
    return dbGet(
        `SELECT * FROM models WHERE name = ?`,
        ['default']
    );
}

// Delete a model
function deleteModel(modelId) {
    return dbRun(
        `DELETE FROM models WHERE model_id = ?`,
        [modelId]
    );
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