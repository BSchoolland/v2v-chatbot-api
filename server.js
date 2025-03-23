const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./backend/database/config/database.js');
const { initializeLoggingDatabase } = require('./backend/database/logging/database.js');
const { dbRun, dbGet, dbAll } = require('./backend/database/config/database.js');
const { scraperManager } = require('./webscraping/scraperManager.js');
const { scheduleCronJobs } = require('./webscraping/cron.js');
const expressWs = require('express-ws');
const http = require('http');
const wsManager = require('./backend/api/chat-core/wsManager.js');

const websiteApiRoutes = require('./backend/api/routes.js');
const chatbotApiRoutes = require('./backend/api/chat-core/routes.js');
const adminRoutes = require('./backend/api/admin/index.js');

const cookieParser = require('cookie-parser');
const conversationsRoutes = require('./backend/api/client-control/conversations.js');
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
    origin: process.env.FRONTEND_URL,
    credentials: true
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
app.use('/api/admin', adminRoutes);

// set development-ui as the public folder
app.use(express.static('development-ui'));

async function startServer() {
    try {
        // Initialize database and run migrations
        await initializeDatabase(dbGet, dbRun, dbAll);
        await initializeLoggingDatabase();
        // Schedule cron jobs (credit renewal and website re-crawling)
        scheduleCronJobs();
        
        // Start the server using the http server instance
        const port = process.env.PORT || 3000;
        server.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM signal received. Cleaning up...');
            await scraperManager.cleanup();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT signal received. Cleaning up...');
            await scraperManager.cleanup();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

