'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
// const {tools, readPageContent, siteWideSearch} = require("./tools.js");
// const { getWebsiteByUrl, getUrlsByWebsiteId, getPageByUrl} = require('./database.js');
dotenv.config();

const { appendMessageToSession, getSession } = require('./sessions.js');
const { dbGet } = require('../database/database.js');

const { getTools } = require('./builtInTools.js');

// gets the model name from the database (e.g. gpt-4o-mini, claude-3-5-sonnet...)
async function getChatbotModel(chatbotId) {
    console.log("getting chatbot model for chatbot id", chatbotId);
    const chatbot = await dbGet(`SELECT * FROM chatbots WHERE chatbot_id = ?`, [chatbotId]);
    console.log(chatbot);
    const model = await dbGet(`SELECT * FROM models WHERE model_id = ?`, [chatbot.model_id]);
    console.log(model);
    return {model: model.api_string, service: model.service};
}

// make an openai call
async function openAiCall(systemPrompt, history, chatbotId, model) {
    console.log("sending request to openai's", model);
    const historyWithSystemPrompt = [
        { role: "system", content: systemPrompt },
        ...history
    ];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: model,
            messages: historyWithSystemPrompt,
            tools: await getTools(chatbotId)
        }),
    });
    const responseData = await response.json();
    const message = responseData.choices[0].message.content
    const tool_calls = responseData.choices[0].message.tool_calls;
    return {message, tool_calls};
}

async function llmCall(systemPrompt, history, chatbotId) {
    // get the model name from the database
    const {model, service} = await getChatbotModel(chatbotId);
    // call the model
    let message, tool_calls;
    if (service === "openai") {
        ({message, tool_calls} = await openAiCall(systemPrompt, history, chatbotId, model));
    } else if (service === "anthropic") {
        console.error("anthropic is not implemented yet");
        message = "Sorry, this tool is not yet implemented.";
        tool_calls = null;
    }
    return {message, tool_calls};
}

async function getChatbotResponse(sessionId, chatbotId) {
    const history = getSession(sessionId);
    // TODO: implement tool calls
    const {message, tool_calls} = await llmCall('you are a helpful assistant', history, chatbotId);
    // as a test append a message to the session
    appendMessageToSession(sessionId, message, 'assistant');

    return {
        message: message,
        chatId: sessionId
    };
}


module.exports = {
    getChatbotResponse
};