const express = require('express');
const router = express.Router();
const { storeConversation, getConversationsByChatbot, deleteConversation } = require('../database/conversations');

// Store a new conversation
router.post('/store', async (req, res) => {
    try {
        const { chatbotId, conversation, pageUrl, chatId } = req.body;
        const date = new Date().toISOString();
        
        const conversationId = await storeConversation(chatbotId, conversation, pageUrl, date, chatId);
        res.json({ success: true, conversationId });
    } catch (error) {
        console.error('Error storing conversation:', error);
        res.status(500).json({ success: false, error: 'Failed to store conversation' });
    }
});

// Get conversations for a chatbot with pagination and filters
router.get('/:chatbotId', async (req, res) => {
    try {
        const { chatbotId } = req.params;
        const { page = 1, limit = 10, dateRange = 'all', pageFilter = '' } = req.query;
        
        // Calculate date filter
        let dateFilter = null;
        const now = new Date();
        
        switch (dateRange) {
            case 'today':
                dateFilter = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                break;
            case 'week':
                dateFilter = new Date(now.setDate(now.getDate() - 7)).toISOString();
                break;
            case 'month':
                dateFilter = new Date(now.setDate(now.getDate() - 30)).toISOString();
                break;
            default:
                dateFilter = null;
        }
        
        const conversations = await getConversationsByChatbot(
            chatbotId,
            page,
            limit,
            dateFilter,
            pageFilter
        );
        
        res.json({ success: true, ...conversations });
    } catch (error) {
        console.error('Error retrieving conversations:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve conversations' });
    }
});

// Delete a conversation
router.delete('/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        await deleteConversation(conversationId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ success: false, error: 'Failed to delete conversation' });
    }
});

module.exports = router; 