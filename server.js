const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/database.js');
const { ScraperManager } = require('./webscraping/scraperManager.js');
const WebSocket = require('ws');
const http = require('http');

const websiteApiRoutes = require('./website-api/routes.js');
const chatbotApiRoutes = require('./chatbot-api/routes.js');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 3000;

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('error', console.error);
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Export WebSocket server for use in other modules
module.exports.wss = wss;

// allow all cors origins as this is a public api
const cors = require('cors');
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Use bodyParser middleware before defining routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// catch errors universally
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

// Use chatbot and website API routes
app.use('/website/api', websiteApiRoutes);
app.use('/chatbot/api', chatbotApiRoutes);


// set development-ui as the public folder
app.use(express.static('development-ui'));

const scraperManager = new ScraperManager();

// Wrap the initialization in an async IIFE
(async () => {
    try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialization complete, starting server...');
        
        server.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to initialize database, exiting:', err);
        process.exit(1);
    }
})();

