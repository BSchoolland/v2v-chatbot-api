const express = require('express');
const router = express.Router();

const userRoutes = require('./users.js');
const dashboardRoutes = require('./dashboard.js');

router.use('', userRoutes);
router.use('', dashboardRoutes);

// Use cookie-parser middleware
module.exports = router;