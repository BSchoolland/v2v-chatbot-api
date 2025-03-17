const express = require('express');
const router = express.Router();
require('dotenv').config();

const { 
    getUserPlans
} = require('../backend/database/queries/billing/plans.js');

const { authMiddleware } = require('./middleware.js');
const { dbGet, dbAll } = require('../backend/database/config/database.js');
const { checkAndRenewCredits } = require('../backend/database/queries');

// Get all plans for a user
router.get('/user-plans', authMiddleware, async (req, res) => {
    try {
        const plans = await dbAll(
            `SELECT * FROM plans WHERE user_id = ?`,
            [req.userId]
        );

        // Check each plan for credit renewal
        for (const plan of plans) {
            await checkAndRenewCredits(plan.plan_id);
        }

        // Get updated plans after potential credit renewal
        const updatedPlans = await dbAll(
            `SELECT * FROM plans WHERE user_id = ?`,
            [req.userId]
        );

        res.json({ success: true, plans: updatedPlans });
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch plans' });
    }
});

module.exports = router;