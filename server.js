const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/database.js');
const { dbRun, dbGet, dbAll } = require('./database/database.js');
const { ScraperManager } = require('./webscraping/scraperManager.js');
const { scheduleCreditRenewal } = require('./services/scheduler.js');
const expressWs = require('express-ws');
const http = require('http');
const wsManager = require('./chatbot-api/wsManager');

const websiteApiRoutes = require('./website-api/routes.js');
const chatbotApiRoutes = require('./chatbot-api/routes.js');

const cookieParser = require('cookie-parser');
const conversationsRoutes = require('./website-api/conversations.js');
const app = express();
const server = http.createServer(app);

// Initialize express-ws with options
const wsInstance = expressWs(app, server, {
    wsOptions: {
        perMessageDeflate: false
    }
});

// Initialize WebSocket manager with the express-ws instance
wsManager.initialize(wsInstance.getWss());

// allow all cors origins as this is a public api
const cors = require('cors');
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Use middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

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
app.use('/api/conversations', conversationsRoutes);

// set development-ui as the public folder
app.use(express.static('development-ui'));

const scraperManager = new ScraperManager();

async function startServer() {
    try {
        // Initialize database and run migrations
        await initializeDatabase(dbGet, dbRun, dbAll);
        
        // Initialize credit renewal scheduler
        scheduleCreditRenewal();
        
        // Start the server using the http server instance
        const port = process.env.PORT || 3000;
        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

