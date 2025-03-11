const { dbAll } = require('./database.js');

async function logToolCall(toolName = "", success = false, params = "", result = "", metadata = {}) {
    try {
        const arguments = JSON.stringify(params);
        const timestamp = new Date().toISOString();
        result = result.slice(0, 250); // limit result to 250 characters to save space in the database
        await dbAll('INSERT INTO tool_calls (timestamp, tool_name, success, arguments, result, chatbot_id, message_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [timestamp, toolName, success, arguments, result, metadata.chatbotId, metadata.messageId]);

    } catch (error) {
        console.error("Error logging tool call", error);
    }
}

module.exports = {
    logToolCall
}