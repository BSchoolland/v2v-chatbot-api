const Chatbot = require('./openAI.js');
const { v4: uuidv4 } = require('uuid');
const showdown = require('showdown');


const chatbot = new Chatbot();
chatbot.init(); // FIXME: this needs to be awaited

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

function convertMarkdownToHtml(markdown) {
    // Convert markdown to HTML
    const converter = new showdown.Converter();
    return converter.makeHtml(markdown);
}


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
        let history;
        try {
            history = sessions[sessionId];
            history = await chatbot.sendMessage(history);
            // Set chatbot response to the session history
            sessions[sessionId] = history;
            // get the response from the chatbot
            console.log(history);
            chatBotResponse = history[history.length - 1].content;
            chatBotResponse = convertMarkdownToHtml(chatBotResponse);
            res.send({ chatId: sessionId, message: chatBotResponse });
        } catch (error) {
            console.error('Error getting chatbot response:', error);
            chatBotResponse = 'Sorry, something went wrong. Please try again later.';
            res.status(500).send({ chatId: sessionId, message: chatBotResponse });
        }
        
        
    } catch (err) {
        console.error('Error handling chatbot request:', err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = (app) => {
    app.post('/api/chatbot', handleChatbotRequest);
};
