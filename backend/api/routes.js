const express = require('express');
const router = express.Router();

const userRoutes = require('./auth/users.js');
const plansRoutes = require('./billing/plans.js');
const chatbotSetupRoutes = require('./client-control/chatbot-setup.js');
const paymentRoutes = require('./billing/payments.js');
const fileRoutes = require('./files/files.js');

router.use('', userRoutes);
router.use('', plansRoutes);
router.use('/chatbot-setup', chatbotSetupRoutes);
router.use('/payments', paymentRoutes);
router.use('/files', fileRoutes);


// Use cookie-parser middleware
module.exports = router;