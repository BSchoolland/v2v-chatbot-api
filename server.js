const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/database.js');
const { ScraperManager } = require('./webscraping/scraperManager.js');
const { deleteOldConversations } = require('./database/conversations.js');

const websiteApiRoutes = require('./website-api/routes.js');
const chatbotApiRoutes = require('./chatbot-api/routes.js');
const conversationsRoutes = require('./website-api/conversations.js');
const app = express();
const port = 3000;
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
app.use('/api/conversations', conversationsRoutes);

// set development-ui as the public folder
app.use(express.static('development-ui'));

const scraperManager = new ScraperManager();

// Schedule conversation cleanup task (runs daily at midnight)
const scheduleCleanup = () => {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // tomorrow
        0, 0, 0 // midnight
    );
    const msUntilMidnight = night.getTime() - now.getTime();

    // Run first cleanup at next midnight
    setTimeout(async () => {
        try {
            console.log('Running scheduled conversation cleanup...');
            await deleteOldConversations();
            console.log('Conversation cleanup completed');
        } catch (error) {
            console.error('Error during conversation cleanup:', error);
        }
        // Schedule next cleanup in 24 hours
        setInterval(async () => {
            try {
                console.log('Running scheduled conversation cleanup...');
                await deleteOldConversations();
                console.log('Conversation cleanup completed');
            } catch (error) {
                console.error('Error during conversation cleanup:', error);
            }
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
};

// Wrap the initialization in an async IIFE
(async () => {
    try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialization complete, starting server...');
        
        // Schedule the cleanup task
        scheduleCleanup();
        
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to initialize database, exiting:', err);
        process.exit(1);
    }
})();

