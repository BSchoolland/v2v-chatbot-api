const { dbRun, dbGet } = require('./database.js');

// create a chatbot
async function createChatbot(plan_id, name, model_id, system_prompt, website_id) {
    const chatbot = await dbRun('INSERT INTO chatbots (plan_id, name, model_id, system_prompt, website_id) VALUES (?, ?, ?, ?, ?)', [plan_id, name, model_id, system_prompt, website_id]);
    return chatbot;
}

// assign a website id to a chatbot
async function assignWebsiteIdToChatbot(chatbotId, websiteId) {
    const chatbot = await dbRun('UPDATE chatbots SET website_id = ? WHERE chatbot_id = ?', [websiteId, chatbotId]);
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

// edit a chatbot's name
async function editChatbotName(chatbotId, name) {
    const chatbot = await dbRun('UPDATE chatbots SET name = ? WHERE chatbot_id = ?', [name, chatbotId]);
    return chatbot;
}

// edit a chatbot's system prompt
async function editChatbotSystemPrompt(chatbotId, systemPrompt) {
    const chatbot = await dbRun('UPDATE chatbots SET system_prompt = ? WHERE chatbot_id = ?', [systemPrompt, chatbotId]);
    return chatbot;
}

module.exports = {
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId,
    editChatbotName,
    editChatbotSystemPrompt,
    assignWebsiteIdToChatbot
};