// routes for chatbot api

const express = require('express');
const router = express.Router();
const { getSessionId, appendMessageToSession } = require('./sessions.js');
const { getChatbotResponse } = require('./chatbotResponse.js');

router.post('/chat/:chatbotId', async (req, res) => {
    const chatId = getSessionId(req.body.chatId);
    appendMessageToSession(chatId, req.body.message, 'user');
    const response = await getChatbotResponse(chatId, req.params.chatbotId);
    res.json(response);
});

module.exports = router;