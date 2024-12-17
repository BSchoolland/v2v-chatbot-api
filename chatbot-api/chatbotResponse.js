'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
// const {tools, readPageContent, siteWideSearch} = require("./tools.js");
// const { getWebsiteByUrl, getUrlsByWebsiteId, getPageByUrl} = require('./database.js');
dotenv.config();

const { appendMessageToSession, getSession } = require('./sessions.js');
const { dbGet } = require('../database/database.js');

// use tool requires tool name and params
const { getTools, useTool } = require('./builtInTools.js');

// gets the model name from the database (e.g. gpt-4o-mini, claude-3-5-sonnet...)
async function getChatbotModel(chatbotId) {
    const chatbot = await dbGet(`SELECT * FROM chatbots WHERE chatbot_id = ?`, [chatbotId]);
    const model = await dbGet(`SELECT * FROM models WHERE model_id = ?`, [chatbot.model_id]);
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
        message = "Sorry, this model is not yet implemented.";
        tool_calls = null;
    }
    return {message, tool_calls};
}

async function getWebsiteId(chatbotId) {
    const chatbot = await dbGet(`SELECT * FROM chatbots WHERE chatbot_id = ?`, [chatbotId]);
    console.log(chatbot);
    return chatbot.website_id;
}

async function getChatbotResponse(sessionId, chatbotId) {
    const history = getSession(sessionId);
    let toolCallsExist = true;
    while (toolCallsExist) {
        const {message, tool_calls} = await llmCall('you are a helpful assistant', history, chatbotId);
        
        // Add the assistant's message to the history
        appendMessageToSession(sessionId, message, 'assistant', tool_calls);
        
        // If there are no tool calls, break the loop
        if (!tool_calls) {
            toolCallsExist = false;
            continue;
        }

        // Process each tool call
        for (const tool_call of tool_calls) {
            try {
                // Use the tool and get the result
                const toolResult = await useTool(tool_call.function.name, tool_call.function.arguments, {chatbotId: chatbotId, websiteId: await getWebsiteId(chatbotId)});
                
                // Add the tool response to the session
                appendMessageToSession(
                    sessionId, 
                    toolResult, 
                    'tool', 
                    null, 
                    tool_call.id, 
                    tool_call.function.name
                );
            } catch (error) {
                console.error(`Error using tool ${tool_call.function.name}:`, error);
                appendMessageToSession(
                    sessionId, 
                    "Sorry, there was an error using this tool.", 
                    'tool', 
                    null, 
                    tool_call.id, 
                    tool_call.function.name
                );
            }
        }
    }

    // Get the final history after all tool calls are processed
    const finalHistory = getSession(sessionId);
    const lastMessage = finalHistory[finalHistory.length - 1];

    return {
        message: lastMessage.content,
        chatId: sessionId
    };
}


module.exports = {
    getChatbotResponse
};