const { dbRun, dbGet, dbAll } = require('./database');

// Store a recorded conversation
async function storeConversation(chatbotId, conversation, pageUrl, date) {
    return await dbRun(
        `INSERT INTO recorded_conversations (chatbot_id, conversation, page_url, date) VALUES (?, ?, ?, ?)`,
        [chatbotId, JSON.stringify(conversation), pageUrl, date]
    );
}

// Retrieve conversations for a chatbot with pagination and filters
async function getConversationsByChatbot(chatbotId, page = 1, limit = 10, dateFilter = null, pageFilter = '') {
    const offset = (page - 1) * limit;
    
    // Build the WHERE clause based on filters
    let whereClause = 'WHERE chatbot_id = ?';
    const params = [chatbotId];
    
    if (dateFilter) {
        whereClause += ' AND date >= ?';
        params.push(dateFilter);
    }
    
    if (pageFilter) {
        whereClause += ' AND page_url LIKE ?';
        params.push(`%${pageFilter}%`);
    }
    
    // Get total count with filters
    const totalCount = await dbGet(
        `SELECT COUNT(*) as count FROM recorded_conversations ${whereClause}`,
        params
    );

    // Get paginated conversations with filters
    const conversations = await dbAll(
        `SELECT * FROM recorded_conversations 
         ${whereClause}
         ORDER BY date DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    // Parse conversation JSON strings back to objects
    const parsedConversations = conversations.map(conv => ({
        ...conv,
        conversation: JSON.parse(conv.conversation)
    }));

    return {
        conversations: parsedConversations,
        totalCount: totalCount.count,
        currentPage: page,
        totalPages: Math.ceil(totalCount.count / limit)
    };
}

// Delete a recorded conversation
async function deleteConversation(conversationId) {
    return await dbRun(
        `DELETE FROM recorded_conversations WHERE recorded_conversation_id = ?`,
        [conversationId]
    );
}

module.exports = {
    storeConversation,
    getConversationsByChatbot,
    deleteConversation
};