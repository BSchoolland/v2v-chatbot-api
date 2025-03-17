const { dbGet } = require('../../../database/database');

const dotenv = require('dotenv');
dotenv.config();
// if not production, allow localhost:3000 to access the chatbot
const isProduction = process.env.ENV != 'development';
let extraAllowedOrigins = [];
if (!isProduction) {
    extraAllowedOrigins = ['http://localhost:3000', 'null'];
}

// add the chatbot site to the allowed origins so that the client can test the chatbot on our site as well as their own
extraAllowedOrigins.push('https://chatbot.visionstovisuals.com');


async function isValidOrigin(origin, chatbotId) {
    // if origin is null it will still be a string
    if (!origin) return false;
    if (extraAllowedOrigins.includes(origin)) return true;
    // Extract domain from origin
    // Convert origins like 'https://example.com' or 'http://example.com:3000' to 'example.com'
    const domain = origin.replace(/^https?:\/\//, '').split(':')[0];
    
    // Query to check if the domain is associated with the chatbot
    const query = `
        SELECT w.domain 
        FROM website w
        JOIN chatbots c ON w.chatbot_id = c.chatbot_id
        WHERE c.chatbot_id = ? AND w.domain = ?
    `;
    
    try {
        const result = await dbGet(query, [chatbotId, domain]);
        return !!result; // returns true if a matching record was found, false otherwise
    } catch (error) {
        console.error('Error checking origin:', error);
        return false; // fail closed on errors
    }
}

module.exports = { isValidOrigin }; 