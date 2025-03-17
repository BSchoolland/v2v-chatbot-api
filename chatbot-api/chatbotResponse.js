'use server';
const fetch = require("node-fetch");
const dotenv = require("dotenv");
// const {tools, readPageContent, siteWideSearch} = require("./tools.js");
// const { getWebsiteByUrl, getUrlsByWebsiteId, getPageByUrl} = require('./database.js');
dotenv.config();

const { appendMessageToSession, getSession } = require('./sessions.js');
const { dbGet } = require('../database/database.js');

const { getPlanFromChatbotId, subtractFromPlan } = require('../database/plans.js');

const { getSystemPrompt } = require('../database/chatbots.js');
const { getWebsiteByChatbotId } = require('../database/websites.js');
const { 
    checkAndRenewCredits,
    getMonthlyCredits,
    checkAndSetWarningFlag
} = require('../database/credits.js');

const { logger } = require('../utils/fileLogger.js');

const { sendCreditsExhaustedEmail, sendCreditsLowWarningEmail, sendCreditsHalfWarningEmail } = require('../utils/emailService.js');

const { getEmailByPlanId } = require('../database/users.js');

// use tool requires tool name and params
const { getTools, useTool } = require('./builtInTools.js');

// showdown converts the ai's markdown to html
const showdown = require('showdown');
const converter = new showdown.Converter();

const wsManager = require('./wsManager');

// Function to broadcast tool usage to all connected clients
function broadcastToolUsage(toolName, reference) {
    wsManager.broadcastToolUsage(toolName, reference);
}

// gets the model name from the database (e.g. gpt-4o-mini, claude-3-5-sonnet...)
async function getChatbotModel(chatbotId) {
    const chatbot = await dbGet(`SELECT * FROM chatbots WHERE chatbot_id = ?`, [chatbotId]);
    const model = await dbGet(`SELECT * FROM models WHERE model_id = ?`, [chatbot.model_id]);
    return model;
}

// make an openai call
async function openAiCall(systemPrompt, history, chatbotId, model) {
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
    const message = responseData.choices[0].message.content;
    const tool_calls = responseData.choices[0].message.tool_calls;
    return {message, tool_calls};
}

async function llmCall(systemPrompt, history, chatbotId, model, service) {
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
    return chatbot.website_id;
}

async function getChatbotResponse(sessionId, chatbotId) {
    const history = getSession(sessionId);
    let toolCallsExist = true;
    // get the system prompt
    const chatbot = await dbGet(`SELECT * FROM chatbots WHERE chatbot_id = ?`, [chatbotId]);
    if (!chatbot) {
        return {
            error: "Chatbot not found.  If you're the owner of this chatbot, please make sure you correctly copied the script.  If you need help, please email us at contact@visionstovisuals.com",
            chatId: sessionId
        };
    }
    const model = await getChatbotModel(chatbotId);
    const systemPrompt = await getSystemPrompt(chatbotId);
    
    // check if the plan has enough tokens
    let plan = await getPlanFromChatbotId(chatbotId);
    
    // If credits are low, try to renew them
    if (plan.remaining_credits + plan.additional_credits < model.message_cost) {
        // Attempt to renew credits
        await checkAndRenewCredits(plan.plan_id);
        // Get updated plan after potential renewal
        plan = await getPlanFromChatbotId(chatbotId);
    }

    // TODO: email the client in a variety of different situations
    // If they get below 10% of their credits, send an email
    // If they cross into their additional credits, send an email
    // If they completely run out of credits, send an email
    // If they had run low on credits and then credits are added or the plan is renewed, send an email
    if (plan.remaining_credits + plan.additional_credits < model.message_cost) {
        if (!plan.credits_exhausted_warning_sent) {
            logger.warn("Plan:", plan.plan_id, "is out of credits, chatbot will be paused until the plan is renewed or additional credits are added.");
            try {
                const shouldSend = await checkAndSetWarningFlag(plan.plan_id, 'exhausted');
                if (shouldSend) {
                    const website = await getWebsiteByChatbotId(chatbotId);
                    const renewalDate = new Date(plan.renews_at);
                    const renewalDateFormatted = renewalDate.toLocaleDateString();
                    const email = await getEmailByPlanId(plan.plan_id);
                    await sendCreditsExhaustedEmail(email, website.url, renewalDateFormatted);
                    logger.info("Plan:", plan.plan_id, "has sent a credits exhausted warning email.");
                }
            } catch (error) {
                logger.error("Failed to send credits exhausted email:", error);
                // Continue execution even if email fails
            }
        }
        return {
            error: "Plan out of credits, chatbot will be paused until the plan is renewed or additional credits are added.",
            chatId: sessionId
        };
    } else {
        
        const monthlyCredits = await getMonthlyCredits(plan.plan_id);   
        const website = await getWebsiteByChatbotId(chatbotId);
        // convert the renewal date to a date object
        const renewalDate = new Date(plan.renews_at);
        // format it to mm/dd/yyyy
        const renewalDateFormatted = renewalDate.toLocaleDateString();
        
        if (plan.remaining_credits + plan.additional_credits < monthlyCredits * 0.1) {
            try {
                const shouldSend = await checkAndSetWarningFlag(plan.plan_id, 'low');
                if (shouldSend) {
                    const email = await getEmailByPlanId(plan.plan_id);
                    await sendCreditsLowWarningEmail(email, website.url, plan.remaining_credits + plan.additional_credits, renewalDateFormatted);
                    logger.info("Plan:", plan.plan_id, "has sent a credits low warning email due to being below 10% of credits.");
                }
            } catch (error) {
                logger.error("Failed to send credits low warning email:", error);
                // Continue execution even if email fails
            }
        } else if (plan.remaining_credits + plan.additional_credits < monthlyCredits * 0.5) {
            try {
                const shouldSend = await checkAndSetWarningFlag(plan.plan_id, 'half');
                if (shouldSend) {
                    const email = await getEmailByPlanId(plan.plan_id);
                    await sendCreditsHalfWarningEmail(email, website.url, renewalDateFormatted);
                    logger.info("Plan:", plan.plan_id, "has sent a credits half warning email due to being below 50% of credits.");
                }
            } catch (error) {
                logger.error("Failed to send credits half warning email:", error);
                // Continue execution even if email fails
            }
        }
    }
    
    while (toolCallsExist) {
        const {message, tool_calls} = await llmCall(systemPrompt, history, chatbotId, model.api_string, model.service);
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
                const toolResult = await useTool(tool_call.function.name, tool_call.function.arguments, {
                    chatbotId: chatbotId, 
                    websiteId: await getWebsiteId(chatbotId),
                    chatId: sessionId
                });
                
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

    // update the plan with the cost of the message
    subtractFromPlan(plan.plan_id, model.message_cost); // not await because this can happen after the response is sent

    return {
        message: converter.makeHtml(lastMessage.content),
        chatId: sessionId
    };
}

module.exports = {
    getChatbotResponse
};