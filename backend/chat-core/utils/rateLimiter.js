const { dbGet, dbRun } = require('../../database/config/database.js');

// Rate limit window in milliseconds
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)
const DEFAULT_RATE_LIMIT = 1000; // Default rate limit if not specified in database (messages per day)

async function generateVisitorId(req) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}_${userAgent}`;
}

// Check if the user owns the chatbot through plan ownership
async function userOwnsChatbot(userId, chatbotId) {
    if (!userId) return false;
    
    const query = `
        SELECT p.user_id 
        FROM plans p
        JOIN chatbots c ON p.plan_id = c.plan_id
        WHERE c.chatbot_id = ? AND p.user_id = ?
    `;
    
    try {
        const result = await dbGet(query, [chatbotId, userId]);
        return !!result;
    } catch (error) {
        console.error('Error checking chatbot ownership:', error);
        return false;
    }
}

async function getChatbotRateLimit(chatbotId) {
    try {
        const chatbot = await dbGet('SELECT rate_limit FROM chatbots WHERE chatbot_id = ?', [chatbotId]);
        return chatbot?.rate_limit || DEFAULT_RATE_LIMIT;
    } catch (error) {
        console.error('Error fetching chatbot rate limit:', error);
        return DEFAULT_RATE_LIMIT;
    }
}

async function checkRateLimit(req) {
    // If user is authenticated and owns the chatbot, bypass rate limiting
    if (req.userId && req.params.chatbotId) {
        const isOwner = await userOwnsChatbot(req.userId, req.params.chatbotId);
        if (isOwner) {
            return true; // Bypass rate limiting for chatbot owners
        }
    }

    const visitorId = await generateVisitorId(req);
    const now = Date.now();
    
    // Get the chatbot's rate limit
    const maxRequests = await getChatbotRateLimit(req.params.chatbotId);
    
    // First clean up old records
    await dbRun(`
        DELETE FROM rate_limits 
        WHERE visitor_id = ? AND timestamp < ?
    `, [visitorId, now - WINDOW_MS]);
    
    // Get current count BEFORE inserting new record
    const count = await dbGet(`
        SELECT COUNT(*) as count 
        FROM rate_limits 
        WHERE visitor_id = ? AND timestamp > ?
    `, [visitorId, now - WINDOW_MS]);
    
    if (count.count >= maxRequests) {
        return false; // Rate limit exceeded
    }
    
    // Add new request record
    await dbRun(`
        INSERT INTO rate_limits (visitor_id, timestamp)
        VALUES (?, ?)
    `, [visitorId, now]);
    
    return true;
}

module.exports = {
    checkRateLimit
}; 