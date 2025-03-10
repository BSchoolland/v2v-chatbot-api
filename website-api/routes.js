const express = require('express');
const router = express.Router();

const userRoutes = require('./users.js');
const dashboardRoutes = require('./dashboard.js');
const plansRoutes = require('./plans.js');
const chatbotSetupRoutes = require('./chatbot-setup.js');
const paymentRoutes = require('./payments.js');
const devToolsRoutes = require('./dev-tools.js');

router.use('', userRoutes);
router.use('', dashboardRoutes);
router.use('', plansRoutes);
router.use('/chatbot-setup', chatbotSetupRoutes);
router.use('/payments', paymentRoutes);

// Development tools routes - only available in development mode
if (process.env.ENV === 'development') {
    router.use('/dev-tools', devToolsRoutes);
    console.log('Development tools routes enabled');
}

// Use cookie-parser middleware
module.exports = router;