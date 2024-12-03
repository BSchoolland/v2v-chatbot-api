const express = require('express');
const bodyParser = require('body-parser');
const setupRoutes = require('./api/routes.js');
const crawlSite = require('./api/crawlWebsite.js');

// run crawlSite every 24 hours
crawlSite();
setInterval(crawlSite, 24 * 60 * 3000);

const app = express();
const port = 3000;

// Use bodyParser middleware before defining routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


setupRoutes(app); // Call the setupRoutes function and pass the app object

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/api/chatbot', (req, res) => {
    
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});