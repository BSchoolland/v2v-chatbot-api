const { dbRun, dbGet } = require('./database.js');

// create a chatbot
async function createChatbot(plan_id, name, model_id, system_prompt) {
    const chatbot = await dbRun('INSERT INTO chatbots (plan_id, name, model_id, system_prompt) VALUES (?, ?, ?, ?)', [plan_id, name, model_id, system_prompt]);
    return chatbot;
}

// get a chatbot
async function getChatbot(chatbotId) {
    const chatbot = await dbGet('SELECT * FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
    return chatbot;
}

// update a chatbot
async function updateChatbot(chatbotId, chatbotName) {
    const chatbot = await dbRun('UPDATE chatbots SET name = ? WHERE chatbot_id = ?', [chatbotName, chatbotId]);
    return chatbot;
}

// get a chatbot from a plan id
async function getChatbotFromPlanId(planId) {
    const chatbot = await dbGet('SELECT * FROM chatbots WHERE plan_id = ?', [planId]);
    return chatbot;
}

module.exports = {
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId
};