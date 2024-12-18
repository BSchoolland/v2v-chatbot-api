const { dbRun, dbGet, generateUniqueId } = require('./database.js');
const { getWebsiteById } = require('./websites.js');
const { getPagesByWebsite } = require('./pages.js');

// create a chatbot
async function createChatbot(plan_id, name, model_id, system_prompt, website_id) {
    const chatbot_id = await generateUniqueId('chatbots', 'chatbot_id');
    const chatbot = await dbRun(
        'INSERT INTO chatbots (chatbot_id, plan_id, name, model_id, system_prompt, website_id) VALUES (?, ?, ?, ?, ?, ?)', 
        [chatbot_id, plan_id, name, model_id, system_prompt, website_id]
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

// TODO: make this more efficient by storing the full system prompt, rather than having to rebuild it every time
async function getSystemPrompt(chatbotId) {
    const chatbot = await dbGet('SELECT system_prompt, website_id FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
    let systemPrompt = chatbot.system_prompt;
    try {
        let website = await getWebsiteById(chatbot.website_id);
        console.log(website);
        let allPages = await getPagesByWebsite(website.website_id);
        // log length of allPages
        console.log(allPages.length);
        systemPrompt += "\nHere are all the pages that exist on this site starting with the home page: \n"
        for (let i = 0; i < allPages.length; i++) {
            let page = allPages[i];
            if (!page.internal) {
                console.log("Skipping external page:", page.url);
                continue;
            }
            systemPrompt += page.url;
            if (page.summary) {
                systemPrompt += "   notes: " + page.summary;
            }
            systemPrompt += "\n";
        }
        // add external resources to the system message
        systemPrompt += "\nExternal resources referenced on this site: \n"
        for (let i = 0; i < allPages.length; i++) {
            let page = allPages[i];
            if (page.internal) {
                console.log("Skipping internal page:", page.url);
                continue;
            }
            systemPrompt += page.url;
            if (page.summary) {
                systemPrompt += "   notes: " + page.summary;
            }
            systemPrompt += "\n";
        }
        // add the current date as well as the current page
        systemPrompt += "\nToday's date is: " + new Date().toDateString() + "\n";
        // systemPrompt += "\nThe user is currently on the page: " + currentUrl + "\n";
    } catch (error) {
        console.error(error);
    }
    console.log(systemPrompt);
    return systemPrompt;
}

module.exports = {
    createChatbot,
    getChatbot,
    updateChatbot,
    getChatbotFromPlanId,
    editChatbotName,
    editChatbotSystemPrompt,
    assignWebsiteIdToChatbot,
    getSystemPrompt
};