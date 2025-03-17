// routes for chatbot api

const express = require('express');
const expressWs = require('express-ws');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Enable WebSocket for this router
expressWs(router);

const { getSessionId, appendMessageToSession, getSession } = require('./sessions.js');
const { getChatbotResponse } = require('./chatbotResponse.js');
const { getInitialMessage } = require('../database/queries');
const { checkRateLimit } = require('./utils/rateLimiter.js');
const { isValidOrigin } = require('./utils/originValidator.js');
const { storeConversation } = require('../database/conversations.js');
const path = require('path');
const { dbGet } = require('../database/config/database.js');
const { logMessage } = require('../database/logging/messages.js');
// Initialize chat session
router.get('/init-chat', (req, res) => {
    const chatId = getSessionId();
    res.json({ chatId });
});

// WebSocket route
router.ws('/ws', (ws, req) => {
    // The wsManager will handle the connection details
});

router.post('/chat/:chatbotId', async (req, res) => {
    const origin = req.get('Origin');
    // TODO: allow clients to set whether they want to use the origin validator (for if they need to test locally)
    // if (!await isValidOrigin(origin, req.params.chatbotId)) {
    //     console.log('Unauthorized origin:', origin);
    //     res.status(403).json({ error: 'Unauthorized origin' });
    //     return;
    // }

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
    appendMessageToSession(chatId, req.body.message, 'user');
    const response = await getChatbotResponse(chatId, req.params.chatbotId);
    logMessage(response.message || response.error || "No response from chatbot", {chatbotId: req.params.chatbotId});
    // Store the conversation after getting the response
    try {
        // Filter out tool responses and only keep user and assistant messages
        const messages = getSession(chatId)
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
        console.error('Error storing conversation:', error);
        // Don't fail the request if storage fails
    }
    res.json(response);
});

router.get('/initial-message/:chatbotId', async (req, res) => {
    const response = await getInitialMessage(req.params.chatbotId);
    res.json(response);
});

router.get('/frontend/component.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.html'));
}); 

router.get('/frontend/component.css', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.css'));
});

// Images
router.get('/frontend/component.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.js'));
});

router.get('/frontend/user.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/user.png'));
});

router.get('/frontend/send.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/send.png'));
});

router.get('/frontend/chatbot-logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/chatbot-logo.png'));
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
