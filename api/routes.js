const Chatbot = require('./openAI.js')

const chatbot = new Chatbot();

const MESSAGE_LIMIT = 5;
const RESET_MINUTES = 2;
const sessions = {};

// based on the user's IP address and user agent
function generateSessionId(req) {
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || req.connection.remoteAddress;
    const userAgent = req.headers.get('user-agent');
    return `${ip}-${userAgent}`;
}

async function handleChatbotRequest(req, res) {
    try {
        const message = req.body.message;
        console.log('user: ', message);
        const history = [{ role: 'user', content: message }]
        const chatBotResponse = await chatbot.sendMessage(history);
        console.log('chatbot:', chatBotResponse);
        res.send({ reply: chatBotResponse });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = (app) => {
    app.post('/api/chatbot', handleChatbotRequest);
}