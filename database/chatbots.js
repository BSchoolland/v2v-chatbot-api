const { dbRun, dbGet, generateUniqueId } = require('./database.js');
const { getWebsiteById } = require('./websites.js');
const { getPagesByWebsite } = require('./pages.js');
const { version } = require('./migrate.js');

// schema:
// chatbot_id TEXT PRIMARY KEY,
// plan_id INTEGER,
// website_id INTEGER,
// model_id INTEGER NOT NULL,
// name TEXT,
// system_prompt TEXT,
// initial_message TEXT,
// questions TEXT,
// version TEXT,
// FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
// FOREIGN KEY (website_id) REFERENCES website(website_id),
// FOREIGN KEY (model_id) REFERENCES models(model_id)

// create a chatbot
async function createChatbot(plan_id, name, model_id, system_prompt, website_id, initial_message = '', questions = '') {
    const chatbot_id = await generateUniqueId('chatbots', 'chatbot_id');
    const chatbot = await dbRun(
        'INSERT INTO chatbots (chatbot_id, plan_id, name, model_id, system_prompt, website_id, initial_message, questions, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [chatbot_id, plan_id, name, model_id, system_prompt, website_id, initial_message, questions, version]
    );
    return chatbot_id;
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

// edit a chatbot's initial message
async function editChatbotInitialMessage(chatbotId, initialMessage) {
    const chatbot = await dbRun('UPDATE chatbots SET initial_message = ? WHERE chatbot_id = ?', [initialMessage, chatbotId]);
    return chatbot;
}

// edit a chatbot's questions
async function editChatbotQuestions(chatbotId, questions) {
    const chatbot = await dbRun('UPDATE chatbots SET questions = ? WHERE chatbot_id = ?', [questions, chatbotId]);
    return chatbot;
}

// TODO: make this more efficient by storing the full system prompt, rather than having to rebuild it every time
async function getSystemPrompt(chatbotId) {
    let chatbot = await getChatbotById(chatbotId);
    let systemPrompt = chatbot.system_prompt;
    try {
        let website = await getWebsiteById(chatbot.website_id);
        let allPages = await getPagesByWebsite(website.website_id);
        
        // Add all internal pages to the system prompt
        systemPrompt += "\nHere are all the pages that exist on this site starting with the home page: \n"
        for (let i = 0; i < allPages.length; i++) {
            let page = allPages[i];
            if (!page.internal) {
                continue;
            }
            systemPrompt += page.url;
            if (page.summary) {
                systemPrompt += " - " + page.summary;
            }
            systemPrompt += "\n";
        }
        
        // Add external resources to the system message
        systemPrompt += "\nExternal resources referenced on this site: \n"
        for (let i = 0; i < allPages.length; i++) {
            let page = allPages[i];
            if (page.internal) {
                continue;
            }
            systemPrompt += page.url;
            if (page.summary) {
                systemPrompt += " - " + page.summary;
            }
            systemPrompt += "\n";
        }
        
        // Add the current date
        systemPrompt += "\nToday's date is: " + new Date().toDateString() + "\n";
        // systemPrompt += "\nThe user is currently on the page: " + currentUrl + "\n";
    } catch (error) {
        console.error(error);
    }
    return systemPrompt;
}

// get the initial message for a chatbot
async function getInitialMessage(chatbotId) {
    const chatbot = await dbGet('SELECT initial_message, questions FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
    if (chatbot.questions === null || chatbot.questions === '') {
        return { message: chatbot.initial_message, questions: [] };
    }
    try {
        const questions = JSON.parse(chatbot.questions);
        return { message: chatbot.initial_message, questions };
    } catch (error) {
        console.error('Error parsing questions JSON:', error);
        return { message: chatbot.initial_message, questions: [] };
    }
}

// get a chatbot by id
async function getChatbotById(chatbotId) {
    const chatbot = await dbGet('SELECT * FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
    return chatbot;
}

module.exports = {
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId,
    editChatbotName,
    editChatbotSystemPrompt,
    editChatbotInitialMessage,
    editChatbotQuestions,
    assignWebsiteIdToChatbot,
    getSystemPrompt,
    getInitialMessage,
    getChatbotById
};