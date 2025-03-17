const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./middleware');
const { getChatbot, 
    storeConversation, 
    getConversationsByChatbot, 
    deleteConversation, 
    getConversationById 
} = require('../backend/database/queries');

// Get conversations for a chatbot with pagination and filters
router.get('/:chatbotId', authMiddleware, async (req, res) => {
    try {
        const { chatbotId } = req.params;
        const { page = 1, limit = 10, dateRange = 'all', pageFilter = '' } = req.query;
        
        // Verify chatbot ownership
        const chatbot = await getChatbot(chatbotId);
        if (!chatbot || chatbot.plan_id !== req.userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to chatbot' });
        }
        
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
router.delete('/:conversationId', authMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // Get the conversation to check ownership
        const conversation = await getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        
        // Verify chatbot ownership
        const chatbot = await getChatbot(conversation.chatbot_id);
        if (!chatbot || chatbot.plan_id !== req.userId) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to chatbot' });
        }
        
        await deleteConversation(conversationId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ success: false, error: 'Failed to delete conversation' });
    }
});

module.exports = router; 