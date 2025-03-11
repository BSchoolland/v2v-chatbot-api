const { dbRun } = require('./database.js');

async function logMessage(message = "", metadata = {}) {
    try {
        const timestamp = new Date().toISOString();
        await dbRun('INSERT INTO chatbot_messages (timestamp, message, chatbot_id) VALUES (?, ?, ?)', [timestamp, message, metadata.chatbotId]);
        console.log("logged message", message, metadata.chatbotId);
    } catch (error) {
        console.error("Error logging message", error);
    }
}

module.exports = {
    logMessage
}