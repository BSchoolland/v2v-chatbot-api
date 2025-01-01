const express = require('express');
const router = express.Router();

const userRoutes = require('./users.js');
const dashboardRoutes = require('./dashboard.js');
const plansRoutes = require('./plans.js');
const chatbotSetupRoutes = require('./chatbot-setup.js');
const paymentRoutes = require('./payments.js');

router.use('', userRoutes);
router.use('', dashboardRoutes);
router.use('', plansRoutes);
router.use('/chatbot-setup', chatbotSetupRoutes);
router.use('/payments', paymentRoutes);

// Use cookie-parser middleware
module.exports = router;