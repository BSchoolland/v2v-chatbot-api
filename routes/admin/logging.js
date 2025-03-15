const express = require('express');
const router = express.Router();
const { getScrapeJobLogs, getScrapeJobLogsByChatbot, getScrapeJobStats } = require('../../database/logging/scraper.js');

/**
 * @route GET /api/admin/logging/scrape-jobs
 * @desc Get all scrape job logs
 * @access Admin
 */
router.get('/scrape-jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const logs = await getScrapeJobLogs(limit, offset);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Error retrieving scrape job logs:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route GET /api/admin/logging/scrape-jobs/chatbot/:chatbotId
 * @desc Get scrape job logs for a specific chatbot
 * @access Admin
 */
router.get('/scrape-jobs/chatbot/:chatbotId', async (req, res) => {
    try {
        const { chatbotId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const logs = await getScrapeJobLogsByChatbot(chatbotId, limit, offset);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Error retrieving scrape job logs for chatbot:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * @route GET /api/admin/logging/scrape-jobs/stats
 * @desc Get scrape job statistics
 * @access Admin
 */
router.get('/scrape-jobs/stats', async (req, res) => {
    try {
        const stats = await getScrapeJobStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error retrieving scrape job statistics:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router; 