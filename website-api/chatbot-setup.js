const express = require('express');
const router = express.Router();
require('dotenv').config();

const {ScraperManager} = require('../webscraping/scraperManager');

const { authMiddleware } = require('./middleware');

const { createChatbot, getChatbotFromPlanId, editChatbotName, editChatbotSystemPrompt, assignWebsiteIdToChatbot } = require('../database/chatbots');

const { getPlan, setChatbotIdForPlan } = require('../database/plans');

const scraper = new ScraperManager();

// user owns plan
async function userOwnsPlan(userId, planId) {
    const plan = await getPlan(planId);
    return plan.user_id === userId;
}

// create a chatbot
router.post('/create-chatbot', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const planId = req.body.planId;
    // make sure the user owns the plan
    const ownsThisPlan = await userOwnsPlan(userId, planId);
    if (!ownsThisPlan) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const chatbotName = req.body.name;
    // make sure there is not already a chatbot with this planId
    const existingChatbot = await getChatbotFromPlanId(planId);
    if (existingChatbot) {
        
        return res.status(200).json({ success: true, chatbotId: existingChatbot.chatbot_id });
    }
    // model and system prompt will be set later
    const modelId = 1;
    const systemPrompt = "You are a helpful assistant.";
    const websiteId = -1;
    const chatbotId = await createChatbot(planId, chatbotName, modelId, systemPrompt, websiteId);
    await setChatbotIdForPlan(planId, chatbotId);
    res.status(200).json({ success: true, chatbotId: chatbotId });
});

router.get('/scrape-site-progress', authMiddleware, async (req, res) => {
    // make sure the user owns the plan
    const userId = req.userId;
    const planId = req.query.planId;
    const ownsThisPlan = await userOwnsPlan(userId, planId);
    if (!ownsThisPlan) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    let url = req.query.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    // if the url ends with a /, remove it
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Function to send SSE updates
    const sendUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // get the id of the chatbot belonging to this plan
    const chatbot = await getChatbotFromPlanId(planId);
    if (!chatbot) {
        return res.status(404).json({ success: false, message: 'Chatbot not found' });
    }
    const chatbotId = chatbot.chatbot_id;

    const {job, websiteId} = await scraper.addJob(url, chatbotId);
    // assign the website id to the chatbot
    await assignWebsiteIdToChatbot(chatbotId, websiteId);
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

    });
});

router.post('/save-chatbot-info', authMiddleware, async (req, res) => {
    // TODO: add more fields than just name
    const chatbotId = req.body.chatbotId;
    const name = req.body.name;
    await editChatbotName(chatbotId, name);
    res.status(200).json({ success: true });
});

router.post('/save-system-prompt', authMiddleware, async (req, res) => {
    const chatbotId = req.body.chatbotId;
    const systemPrompt = req.body.systemPrompt;
    await editChatbotSystemPrompt(chatbotId, systemPrompt);
    res.status(200).json({ success: true });
});

module.exports = router;