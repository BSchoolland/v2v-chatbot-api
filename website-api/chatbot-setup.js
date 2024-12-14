const express = require('express');
const router = express.Router();
require('dotenv').config();

// Sample website structure for simulation
const samplePages = [
    { url: '/home', title: 'Home Page' },
    { url: '/about', title: 'About Us' },
    { url: '/products', title: 'Our Products' },
    { url: '/services', title: 'Services' },
    { url: '/blog', title: 'Blog' },
    { url: '/blog/post-1', title: 'Blog Post 1' },
    { url: '/blog/post-2', title: 'Blog Post 2' },
    { url: '/contact', title: 'Contact Us' },
    { url: '/pricing', title: 'Pricing' },
    { url: '/faq', title: 'FAQ' }
];

router.get('/scrape-site-progress', async (req, res) => {
    console.log('scrape-site-progress');
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

    // Simulate crawling process
    const simulateCrawling = async () => {
        const baseUrl = new URL(url).origin;
        let processedPages = [];

        // Initial discovery phase
        sendUpdate({
            totalPages: 0,
            currentPage: baseUrl,
            newPage: baseUrl,
            status: "Starting crawl...",
            complete: false
        });

        // Simulate finding and processing each page
        for (let page of samplePages) {
            const fullUrl = `${baseUrl}${page.url}`;
            
            // Simulate page discovery
            await new Promise(resolve => setTimeout(resolve, 500));
            sendUpdate({
                totalPages: processedPages.length + 1,
                currentPage: fullUrl,
                newPage: fullUrl,
                status: `Discovered: ${page.title}`,
                complete: false
            });

            // Simulate page processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            processedPages.push({
                url: fullUrl,
                title: page.title,
                content: `Sample content for ${page.title}`
            });

            sendUpdate({
                totalPages: processedPages.length,
                currentPage: fullUrl,
                newPage: null,
                status: `Processed: ${page.title}`,
                complete: false
            });
        }

        // Send final update with results
        sendUpdate({
            totalPages: processedPages.length,
            currentPage: null,
            newPage: null,
            status: "Crawl completed",
            complete: true,
            result: {
                pages: processedPages,
                metadata: {
                    totalPages: processedPages.length,
                    baseUrl: baseUrl,
                    crawlDuration: `${processedPages.length * 1.5} seconds`
                }
            }
        });
    };

    // Handle client disconnect
    req.on('close', () => {
        console.log('Client disconnected');
    });

    // Start the simulation
    simulateCrawling().catch(error => {
        console.error('Simulation error:', error);
        sendUpdate({
            error: error.message,
            complete: true
        });
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