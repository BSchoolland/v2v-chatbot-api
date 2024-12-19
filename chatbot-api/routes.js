// routes for chatbot api

const express = require('express');
const router = express.Router();
const { getSessionId, appendMessageToSession } = require('./sessions.js');
const { getChatbotResponse } = require('./chatbotResponse.js');
const { checkRateLimit } = require('./utils/rateLimiter.js');
const { isValidOrigin } = require('./utils/originValidator');
const path = require('path');
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
    // const response = await getChatbotResponse(chatId, req.params.chatbotId);
    res.json({ message: 'Hello, world!', chatId: chatId });
});

router.get('/frontend/component.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.html'));
}); 

router.get('/frontend/component.css', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.css'));
});

router.get('/frontend/component.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/component.js'));
});

router.get('/frontend/user.png', (req, res) => {
    res.sendFile(path.join(__dirname, '../chatbot-frontend/user.png'));
});

module.exports = router;
