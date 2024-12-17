const express = require('express');
const router = express.Router();
require('dotenv').config();

const { 
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan
} = require('../database/plans.js');

const { authMiddleware } = require('./middleware.js');

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

module.exports = router;