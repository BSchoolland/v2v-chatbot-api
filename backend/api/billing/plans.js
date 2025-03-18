const express = require('express');
const router = express.Router();
require('dotenv').config();
const { dbAll } = require('../../database/config/database.js');
const { checkAndRenewCredits } = require('../../database/queries');
const { 
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan
} = require('../../database/queries/billing/plans.js');

const { authMiddleware } = require('../middleware/middleware.js');

// Add a plan for a user
router.post('/add-plan', authMiddleware, async (req, res) => {
    try {
        const { chatbotId, planTypeId, planName } = req.body;
        const plan = await addPlan(req.userId, chatbotId, planTypeId, planName);
        res.status(200).json({ plan, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get a plan for a user
router.get('/user-plan/:planId', authMiddleware, async (req, res) => {
    const { planId } = req.params;
    const plan = await getPlan(planId);
    res.status(200).json({ plan, success: true });
});

// Update a plan for a user
router.put('/user-plan/:planId', authMiddleware, async (req, res) => {
    const { planId } = req.params;
    const { planName, planTypeId } = req.body;
    const plan = await updatePlan(planId, req.userId, 0, planName, planTypeId);
    res.status(200).json({ plan, success: true });
});

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