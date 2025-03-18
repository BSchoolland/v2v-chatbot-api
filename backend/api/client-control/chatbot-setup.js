const express = require('express');
const router = express.Router();
require('dotenv').config();

const {scraperManager} = require('../../../webscraping/scraperManager');

const { authMiddleware } = require('../middleware/middleware.js');

const { 
    createChatbot, 
    getChatbotFromPlanId, 
    editChatbotName, 
    editChatbotSystemPrompt, 
    editChatbotInitialMessage, 
    editChatbotQuestions, 
    editChatbotContactInfo, editChatbotRateLimit, assignWebsiteIdToChatbot, resetConfig, editChatbotModel 
} = require('../../database/queries');

const { getPlan, setChatbotIdForPlan } = require('../../database/queries/billing/plans.js');
const { getAvailableModelsForPlanType } = require('../../database/queries/config/models.js');
const { getWebsiteByUrl } = require('../../database/queries');
const { getExternalPages, deletePage, getPagesByWebsite } = require('../../database/queries');

const { automateConfiguration } = require('./automated-config.js');
const { logger } = require('../utils/fileLogger');

// user owns plan
async function userOwnsPlan(userId, planId) {
    const plan = await getPlan(planId);
    return plan.user_id === userId;
}

// create a chatbot
router.post('/create-chatbot', authMiddleware, async (req, res) => {
    try {
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
        // Start with minimal default values
        const systemPrompt = "";
        const websiteId = -1;
        const initialMessage = "";
        const questions = "[]";  // Empty array as JSON string
        const chatbotId = await createChatbot(planId, chatbotName, null, systemPrompt, websiteId, initialMessage, questions);
        await setChatbotIdForPlan(planId, chatbotId);
        res.status(200).json({ success: true, chatbotId: chatbotId });
    } catch (error) {
        logger.error('Error creating chatbot:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
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

    // check if the url already exists in the database as a registered website
    const existingWebsite = await getWebsiteByUrl(url);
    // check if the website belongs to this chatbot
    if (existingWebsite) {
        if (existingWebsite.chatbot_id !== chatbotId) {
            logger.error('website already exists in the database, and is registered to another chatbot');
            return res.status(403).json({ success: false, message: `The website ${url} is already registered to another chatbot. Please contact support if you believe this is an error.` });
        } else {
            logger.info('You\'ve already registered this website to this chatbot before, move to the next step!');
            return res.status(200).json({ success: true, websiteId: existingWebsite.website_id });
        }
    }

    const {job, websiteId} = await scraperManager.addJob(url, chatbotId, 5, 50, 'initial');
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
        clearInterval(statusInterval);
        if (job && !job.isJobComplete()) {
            job.cleanup();
        }
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

// get chatbot details
router.get('/get-chatbot', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const planId = req.query.planId;
    // make sure the user owns the plan
    const ownsThisPlan = await userOwnsPlan(userId, planId);
    if (!ownsThisPlan) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const chatbot = await getChatbotFromPlanId(planId);
    if (!chatbot) {
        return res.status(404).json({ success: false, message: 'Chatbot not found' });
    }
    res.status(200).json({ success: true, chatbot });
});

// update chatbot details
router.post('/update-chatbot', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const planId = req.body.planId;
    // make sure the user owns the plan
    const ownsThisPlan = await userOwnsPlan(userId, planId);
    if (!ownsThisPlan) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const chatbot = await getChatbotFromPlanId(planId);
    if (!chatbot) {
        return res.status(404).json({ success: false, message: 'Chatbot not found' });
    }
    const { name, systemPrompt, initialMessage, questions, contactInfo, rateLimit } = req.body;
    await editChatbotName(chatbot.chatbot_id, name);
    await editChatbotSystemPrompt(chatbot.chatbot_id, systemPrompt);
    await editChatbotInitialMessage(chatbot.chatbot_id, initialMessage);
    await editChatbotQuestions(chatbot.chatbot_id, questions);
    await editChatbotContactInfo(chatbot.chatbot_id, contactInfo);
    if (rateLimit) {
        await editChatbotRateLimit(chatbot.chatbot_id, parseInt(rateLimit));
    }
    res.status(200).json({ success: true });
});

// automated configuration
router.post('/automated-configuration', authMiddleware, async (req, res) => {
    const userId = req.userId;
    const planId = req.body.planId;
    
    // make sure the user owns the plan
    const ownsThisPlan = await userOwnsPlan(userId, planId);
    if (!ownsThisPlan) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // get the chatbot
    const chatbot = await getChatbotFromPlanId(planId);
    if (!chatbot) {
        return res.status(404).json({ success: false, message: 'Chatbot not found' });
    }

    await automateConfiguration(chatbot);
    res.status(200).json({ success: true });
});

// Add reset endpoint
router.post('/chatbot/:chatbotId/reset', async (req, res) => {
    try {
        const { chatbotId } = req.params;
        await resetConfig(chatbotId);
        res.json({ success: true, message: 'Chatbot configuration reset to initial values' });
    } catch (error) {
        logger.error('Error resetting chatbot configuration:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get available models for a plan type
router.get('/available-models', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const planId = req.query.planId;
        
        // make sure the user owns the plan
        const ownsThisPlan = await userOwnsPlan(userId, planId);
        if (!ownsThisPlan) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Get the plan to find its type
        const plan = await getPlan(planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        // Get available models for this plan type
        const models = await getAvailableModelsForPlanType(plan.plan_type_id);
        res.status(200).json({ success: true, models });
    } catch (error) {
        logger.error('Error getting available models:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update chatbot model
router.post('/update-model', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { planId, modelId } = req.body;

        if (!planId || !modelId) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // make sure the user owns the plan
        const ownsThisPlan = await userOwnsPlan(userId, planId);
        if (!ownsThisPlan) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Get the chatbot
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot) {
            return res.status(404).json({ success: false, message: 'Chatbot not found' });
        }

        // Update the model
        await editChatbotModel(chatbot.chatbot_id, modelId);
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Error updating chatbot model:', error);
        if (error.message === 'Model not available for this plan type') {
            res.status(400).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
});

// Add single external page to chatbot's website
router.post('/add-external-page', authMiddleware, async (req, res) => {
    try {
        const { planId, url } = req.body;
        if (!planId || !url) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        // Get chatbot and website info
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot || !chatbot.website_id) {
            return res.status(404).json({ success: false, message: 'Chatbot or website not found' });
        }

        // Initialize scraper for this single page
        const { scraperManager } = require('../webscraping/scraperManager.js');
        await scraperManager.scrapeSinglePage(chatbot.website_id, url);

        res.json({ success: true, message: 'Page added successfully' });
    } catch (error) {
        logger.error('Error adding external page:', error);
        res.status(500).json({ success: false, message: 'Error adding external page' });
    }
});

// Get all pages for a chatbot
router.get('/all-pages', authMiddleware, async (req, res) => {
    try {
        const { planId } = req.query;
        if (!planId) {
            return res.status(400).json({ success: false, message: 'Missing plan ID' });
        }

        // Get chatbot and website info
        const chatbot = await getChatbotFromPlanId(planId);
        if (!chatbot || !chatbot.website_id) {
            return res.status(404).json({ success: false, message: 'Chatbot or website not found' });
        }

        // Get all pages (both internal and external)
        const pages = await getPagesByWebsite(chatbot.website_id);
        res.json({ success: true, pages });
    } catch (error) {
        logger.error('Error getting pages:', error);
        res.status(500).json({ success: false, message: 'Error getting pages' });
    }
});

// Delete an external page
router.delete('/external-page/:pageId', authMiddleware, async (req, res) => {
    try {
        const { pageId } = req.params;
        await deletePage(pageId);
        res.json({ success: true, message: 'Page deleted successfully' });
    } catch (error) {
        logger.error('Error deleting external page:', error);
        res.status(500).json({ success: false, message: 'Error deleting external page' });
    }
});

module.exports = router;