const express = require('express');
const router = express.Router();
require('dotenv').config();

const {ScraperManager} = require('../webscraping/scraperManager');

const scraper = new ScraperManager();

// Sample website structure for simulation
const samplePages = [
    { url: '/home', title: 'Home Page', summary: 'This is the home page of the website.' },
    { url: '/about', title: 'About Us', summary: 'This is the about us page of the website.' },
    { url: '/products', title: 'Our Products', summary: 'This is the products page of the website.' },
    { url: '/services', title: 'Services', summary: 'This is the services page of the website.' },
    { url: '/contact', title: 'Contact Us', summary: 'This is the contact us page of the website.' },
    { url: '/pricing', title: 'Pricing', summary: 'This is the pricing page of the website.' },
    { url: '/faq', title: 'FAQ', summary: 'This is the FAQ page of the website.' }
];

// create a chatbot
router.post('/create-chatbot', async (req, res) => {
    console.log('create-chatbot');
    const chatbotData = req.body;
    console.log(chatbotData);
    res.status(200).json({ success: true });
});

router.get('/scrape-site-progress', async (req, res) => {
    console.log('req.body', req.body);
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Function to send SSE updates
    const sendUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const job = await scraper.addJob(url);
    
    // Send initial status
    sendUpdate({ status: 'started', message: 'Starting website analysis...' });

    let completedPages = [];
    // Set up interval to check job status
    const statusInterval = setInterval(async () => {
        if (job.isJobComplete()) {
            clearInterval(statusInterval);
            sendUpdate({ 
                complete: true,
                message: 'Website analysis complete',
                pagesScraped: job.getScrapedPagesCount(),
                newlyCompletedPages: []
            });
        } else {
            sendUpdate({
                complete: false,
                status: 'in_progress', 
                message: 'Analyzing website...',
                pagesScraped: job.getScrapedPagesCount(),
                newlyCompletedPages: job.getCompletedPagesExcludingList(completedPages)
            });
            completedPages.push(...job.getCompletedPagesExcludingList(completedPages));
        }
    }, 1000);

    // Handle client disconnect
    req.on('close', () => {
        console.log('Client disconnected');
    });

});

router.post('/save-chatbot-info', async (req, res) => {
    console.log('save-chatbot-info');
    const chatbotData = req.body;
    console.log(chatbotData);
    res.status(200).json({ success: true });
});

router.post('/save-system-prompt', async (req, res) => {
    console.log('save-system-prompt');
    const chatbotData = req.body;
    console.log(chatbotData);
    res.status(200).json({ success: true });
});

module.exports = router;