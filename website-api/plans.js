const express = require('express');
const router = express.Router();
require('dotenv').config();

const { 
    getUserPlans,
    addPlan
} = require('../database/plans.js');

const { authMiddleware } = require('./middleware.js');

// Add a plan for a user
router.post('/add-plan', authMiddleware, async (req, res) => {
    console.log('req.body:', req.body);
    try {
        const { chatbotId, planTypeId, planName } = req.body;
        const plan = await addPlan(req.userId, chatbotId, planTypeId, planName);
        res.status(200).json({ plan, success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;