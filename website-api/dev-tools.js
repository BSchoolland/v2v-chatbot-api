const express = require('express');
const router = express.Router();
const { setDateOffset, resetDateOffset, getDateOffsetInfo } = require('../database/dateUtils');
const { checkRenewalOnCredits } = require('../webscraping/cron');

/**
 * Development tools routes - only available in development mode
 */

// Middleware to ensure we're in development mode
const requireDevMode = (req, res, next) => {
    if (process.env.ENV !== 'development') {
        return res.status(403).json({
            success: false,
            message: 'This endpoint is only available in development mode'
        });
    }
    next();
};

// Apply the middleware to all routes in this router
router.use(requireDevMode);

/**
 * @route GET /date-info
 * @description Get current date offset information
 * @access Development only
 */
router.get('/date-info', (req, res) => {
    const info = getDateOffsetInfo();
    res.json(info);
});

/**
 * @route POST /set-date-offset
 * @description Set a date offset for testing
 * @access Development only
 * @body {days, hours, minutes} - Offset values (can be positive or negative)
 */
router.post('/set-date-offset', (req, res) => {
    const { days = 0, hours = 0, minutes = 0 } = req.body;
    
    // Validate input
    if (isNaN(days) || isNaN(hours) || isNaN(minutes)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid input: days, hours, and minutes must be numbers'
        });
    }
    
    const result = setDateOffset(parseInt(days), parseInt(hours), parseInt(minutes));
    res.json(result);
});

/**
 * @route POST /reset-date-offset
 * @description Reset any date offset
 * @access Development only
 */
router.post('/reset-date-offset', (req, res) => {
    const result = resetDateOffset();
    res.json(result);
});

/**
 * @route POST /trigger-credit-renewal
 * @description Manually trigger credit renewal check for all plans
 * @access Development only
 */
router.post('/trigger-credit-renewal', async (req, res) => {
    try {
        await checkRenewalOnCredits();
        res.json({
            success: true,
            message: 'Credit renewal check triggered for all plans'
        });
    } catch (error) {
        console.error('Error triggering credit renewal:', error);
        res.status(500).json({
            success: false,
            message: 'Error triggering credit renewal',
            error: error.message
        });
    }
});

module.exports = router; 