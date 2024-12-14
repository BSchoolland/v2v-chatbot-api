const express = require('express');
const router = express.Router();

const userRoutes = require('./users.js');
const dashboardRoutes = require('./dashboard.js');
const plansRoutes = require('./plans.js');

router.use('', userRoutes);
router.use('', dashboardRoutes);
router.use('', plansRoutes);


// Use cookie-parser middleware
module.exports = router;