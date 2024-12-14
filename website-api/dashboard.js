const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Add this
require('dotenv').config();

const { 
    getUserPlans
} = require('../database/plans.js');

// Auth middleware to verify token and extract userId
const authMiddleware = (req, res, next) => {
    const sessionToken = req.cookies.session;
    console.log('sessionToken:', sessionToken);
    if (!sessionToken) {
        console.log('No session token');
        return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
        console.log('decoded:', decoded);
        req.userId = decoded.userId; // Attach userId to request
        next();
    } catch (err) {
        console.error('Invalid token:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Get all plans for a user
router.get('/user-plans', authMiddleware, async (req, res) => {
    try {
        const plans = await getUserPlans(req.userId);
        res.status(200).json({ plans, success: true });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;