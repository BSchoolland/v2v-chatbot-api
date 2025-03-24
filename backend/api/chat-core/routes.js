// routes for chatbot api
const { defaultTools } = require('./builtInTools.js');
const { ChatbotManager } = require('@benschoolland/ai-tools');
const { logger } = require('../utils/fileLogger.js')

const { getChatbotModel, getSystemPrompt, getWebsiteId } = require('../../database/queries');
const express = require('express');
const expressWs = require('express-ws');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Enable WebSocket for this router
expressWs(router);

const { getSessionId } = require('./sessions.js');
const { getInitialMessage } = require('../../database/queries');
const { checkRateLimit } = require('./utils/rateLimiter.js');
const { storeConversation } = require('../../database/queries/data/conversations.js');
const path = require('path');
const { dbGet } = require('../../database/config/database.js');
const { logMessage } = require('../../database/logging/messages.js');


// showdown converts the ai's markdown to html
const showdown = require('showdown');
const converter = new showdown.Converter();

// Initialize chat session
router.get('/init-chat', (req, res) => {
    const chatId = getSessionId();
    res.json({ chatId });
});

// WebSocket route
router.ws('/ws', (ws, req) => {
    // The wsManager will handle the connection details
});

const chatbotManager = new ChatbotManager({
    model: "gpt-4o-mini",
    tools: defaultTools,
});

router.post('/chat/:chatbotId', async (req, res) => {
    try {
        // Extract user ID from session token if it exists
        const sessionToken = req.cookies?.session;
        if (sessionToken) {
            try {
                const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
                req.userId = decoded.userId;
            } catch (err) {
                console.error('Invalid session token:', err);
                // Don't fail the request, just continue without user ID.  This is a user using a client's chatbot
            }
        }

        if (!await checkRateLimit(req)) {
            res.status(429).json({ error: 'Sorry, you\'ve run out of messages for today.  Please try again later.' });
            return;
        }

        const chatId = getSessionId(req.body.chatId);
        // create a new conversation or get the existing one with configs from the chatbot
        const model = await getChatbotModel(req.params.chatbotId);
        const systemMessage = await getSystemPrompt(req.params.chatbotId);
        const conversation = await chatbotManager.getConversation(
            {
                conversationID: chatId,
                model: model,
                systemMessage: systemMessage,
                customIdentifier: {
                    chatbotId: req.params.chatbotId,
                    websiteId: await getWebsiteId(req.params.chatbotId),
                    chatId: chatId
                }
            }
        )
        const chatbotResponse = await conversation.sendMessage(req.body.message);
        logMessage(chatbotResponse || "Chatbot error", {chatbotId: req.params.chatbotId});
        // Store the conversation after getting the response
        try {
            // Filter out tool responses and only keep user and assistant messages
            const messages = conversation.getHistory().history
                .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && !msg.tool_calls && !msg.tool_call_id && !msg.tool_name))
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
            
            // Store the entire conversation each time, using chatId to update the same record
            await storeConversation(
                req.params.chatbotId,
                messages,
                req.headers.referer || 'Unknown',
                new Date().toISOString(),
                chatId
            );
        } catch (error) {
            logger.error('Error storing conversation:', error);
            // Don't fail the request if storage fails
        }
        res.json({
            message: converter.makeHtml(chatbotResponse),
            chatId: chatId
        });
    } catch (error) {
        logger.error('Error processing chat request:', error);  
        res.status(500).json({ error: 'Oops!  Something went wrong.  Please try again later.' });
    }
});

router.get('/initial-message/:chatbotId', async (req, res) => {
    const response = await getInitialMessage(req.params.chatbotId);
    res.json(response);
});

// Chatbot frontend
router.get('/frontend/component.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../chatbot-frontend/dist/chatbot.min.js'));
});

// Get contact info for a chatbot
router.get('/contact-info/:chatbotId', async (req, res) => {
    try {
        const chatbotId = req.params.chatbotId;
        const chatbot = await dbGet('SELECT contact_info FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
        if (!chatbot) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }
        res.json({ contact_info: chatbot.contact_info || '' });
    } catch (error) {
        console.error('Error fetching contact info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
