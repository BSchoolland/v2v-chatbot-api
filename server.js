const express = require('express');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/database.js');

const app = express();
const port = 3000;

// Use bodyParser middleware before defining routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// TODO: use development ui folder
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

console.log('Initializing database...');
initializeDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database, exiting:', err);
    });

