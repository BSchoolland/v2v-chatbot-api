// routes for chatbot api

const express = require('express');
const expressWs = require('express-ws');
const router = express.Router();

// Enable WebSocket for this router
expressWs(router);

const { getSessionId, appendMessageToSession } = require('./sessions.js');
const { getChatbotResponse } = require('./chatbotResponse.js');
const { getInitialMessage } = require('../database/chatbots.js');
const { checkRateLimit } = require('./utils/rateLimiter.js');
const { isValidOrigin } = require('./utils/originValidator');
const path = require('path');

// WebSocket route
router.ws('/ws', (ws, req) => {
    console.log('WebSocket connection request received');
});

router.post('/chat/:chatbotId', async (req, res) => {
    const origin = req.get('Origin');
    // TODO: allow clients to set whether they want to use the origin validator (for if they need to test locally)
    // if (!await isValidOrigin(origin, req.params.chatbotId)) {
    //     console.log('Unauthorized origin:', origin);
    //     res.status(403).json({ error: 'Unauthorized origin' });
    //     return;
    // }
    if (!await checkRateLimit(req)) {
        res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        return;
    }
    const chatId = getSessionId(req.body.chatId);
    appendMessageToSession(chatId, req.body.message, 'user');
    const response = await getChatbotResponse(chatId, req.params.chatbotId);
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
    console.log('Sending send.png');
    res.sendFile(path.join(__dirname, '../chatbot-frontend/send.png'));
});

router.get('/frontend/chatbot-logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/chatbot-logo.png'));
});

module.exports = router;
