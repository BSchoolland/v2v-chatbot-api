const { dbGet, dbRun } = require('../../database/database.js');

// Rate limit window in milliseconds
// (10 requests per minute for testing)
// TODO: allow client to set
// TODO: return how long until next request is allowed
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10; 

async function generateVisitorId(req) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return `${ip}_${userAgent}`;
}

async function checkRateLimit(req) {
    const visitorId = await generateVisitorId(req);
    const now = Date.now();
    
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
    
    if (count.count >= MAX_REQUESTS) {
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