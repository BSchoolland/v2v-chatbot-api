const Chatbot = require('./openAI.js');
const { v4: uuidv4 } = require('uuid');

const chatbot = new Chatbot();

const sessions = {};
const sessionTimestamps = {};
const sessionTimeout = process.env.SESSION_TIMEOUT || 30 * 60 * 1000; // 30 minutes

function generateChatId() {
    return uuidv4();
}

function cleanupSessions() {
    try {
        const now = Date.now();
        for (const [chatId, timestamp] of Object.entries(sessionTimestamps)) {
            if (now - timestamp > sessionTimeout) {
                console.log(`Cleaning up session: ${chatId}`);
                delete sessions[chatId];
                delete sessionTimestamps[chatId];
            }
        }
    } catch (err) {
        console.error('Error cleaning up sessions:', err);
    }
}
setInterval(cleanupSessions, 10 * 60 * 1000); // Run cleanup every 10 minutes

async function handleChatbotRequest(req, res) {
    try {
        const { message, chatId } = req.body;
        console.log('user:', message);

        let sessionId = chatId;

        // Create a new session if needed
        if (!sessions[chatId]) {
            if (chatId === -1) {
                sessionId = generateChatId();
                sessions[sessionId] = [];
            } else {
                res.status(404).send('Chat session not found');
                return;
            }
        }

        sessionTimestamps[sessionId] = Date.now(); // Update session timestamp

        // Append user message to the session history
        sessions[sessionId].push({ role: 'user', content: message });

        // Get chatbot response
        let chatBotResponse;
        try {
            const history = sessions[sessionId];
            chatBotResponse = await chatbot.sendMessage(history);
        } catch (error) {
            console.error('Error getting chatbot response:', error);
            chatBotResponse = 'Sorry, something went wrong. Please try again later.';
        }

        // Append chatbot response to the session history
        sessions[sessionId].push({ role: 'assistant', content: chatBotResponse });

        res.send({ chatId: sessionId, message: chatBotResponse });
    } catch (err) {
        console.error('Error handling chatbot request:', err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = (app) => {
    app.post('/api/chatbot', handleChatbotRequest);
};
