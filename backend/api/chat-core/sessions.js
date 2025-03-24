// sessions.js
const { v4: uuidv4 } = require('uuid');

function generateChatId() {
    return uuidv4();
}

function getSessionId(chatId) {
    if (!chatId || chatId === -1) {
        // generate a new chatId
        chatId = generateChatId();
    }
    return chatId;
}

module.exports = {
    getSessionId,
};