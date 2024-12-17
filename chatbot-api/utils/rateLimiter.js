const { dbGet, dbRun } = require('../../database/database.js');

// Rate limit window in milliseconds
// (2 requests per minute for testing)
// TODO: change to 10 requests per hour, or allow client to set
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 2; 

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
    
    console.log('count', count);
    if (count.count >= MAX_REQUESTS) {
        console.log('rate limit exceeded');
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