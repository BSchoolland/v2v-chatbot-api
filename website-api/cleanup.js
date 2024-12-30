const cron = require('node-cron');
const { deleteOldConversations } = require('../database/conversations');

// Schedule cleanup task to run at midnight every day
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Starting daily conversation cleanup...');
        const daysToKeep = process.env.CONVERSATION_RETENTION_DAYS || 30;
        await deleteOldConversations(daysToKeep);
        console.log('Conversation cleanup completed successfully');
    } catch (error) {
        console.error('Error during conversation cleanup:', error);
    }
}); 