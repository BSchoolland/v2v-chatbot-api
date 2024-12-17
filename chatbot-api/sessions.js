// sessions.js

const { v4: uuidv4 } = require('uuid');

const sessions = {};
const sessionTimestamps = {};
const sessionTimeout = process.env.SESSION_TIMEOUT || 30 * 60 * 3000; // 30 minutes

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

function getSessionId(chatId) {
    if (!chatId || chatId === -1) {
        // generate a new chatId
        chatId = generateChatId();
    }
    // check if the chatId is already in the sessions object
    if (!sessions[chatId]) {
        // create a new session
        sessions[chatId] = [];
    }
    return chatId;
}

function appendMessageToSession(chatId, message, role = 'user', tool_calls = null, tool_call_id = null, tool_name = null) {
    sessions[chatId].push({ role: role, content: message, tool_calls: tool_calls, tool_call_id: tool_call_id, tool_name: tool_name });
}

function getSession(chatId) {
    return sessions[chatId];
}

setInterval(cleanupSessions, 10 * 60 * 3000); // Run cleanup every 10 minutes

module.exports = {
    getSessionId,
    appendMessageToSession,
    getSession
};