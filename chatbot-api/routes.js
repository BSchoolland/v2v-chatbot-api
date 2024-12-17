// routes for chatbot api

const express = require('express');
const router = express.Router();
const { getSessionId, appendMessageToSession } = require('./sessions.js');
const { getChatbotResponse } = require('./chatbotResponse.js');
const { checkRateLimit } = require('./utils/rateLimiter.js');
const { isValidOrigin } = require('./utils/originValidator');

router.post('/chat/:chatbotId', async (req, res) => {
    const origin = req.get('Origin');
    if (!await isValidOrigin(origin, req.params.chatbotId)) {
        console.log('Unauthorized origin:', origin);
        res.status(403).json({ error: 'Unauthorized origin' });
        return;
    }
    
    if (!await checkRateLimit(req)) {
        res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        return;
    }
    const chatId = getSessionId(req.body.chatId);
    appendMessageToSession(chatId, req.body.message, 'user');
    const response = await getChatbotResponse(chatId, req.params.chatbotId);
    res.json(response);
});

module.exports = router;