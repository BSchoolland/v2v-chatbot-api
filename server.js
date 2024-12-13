const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/database.js');
const { registerUser } = require('./database/users.js');
const { ScraperManager } = require('./webscraping/scraperManager.js');

const app = express();
const port = 3000;

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

// set development-ui as the public folder
app.use(express.static('development-ui'));

const scraperManager = new ScraperManager();

console.log('Initializing database...');
initializeDatabase()
    .then(async () => {
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
        try {
            await registerUser('test username', 'test password');
            console.log('User registered successfully');
        } catch (err) {
            console.error('Failed to register user:', err);
        };
        // scraperManager.addJob('https://bschoolland.com', 5, 200);

    })
    .catch((err) => {
        console.error('Failed to initialize database, exiting:', err);
    });

