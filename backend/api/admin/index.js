const express = require('express');
const router = express.Router();

const loggingRoutes = require('./logging.js');

// Register admin routes
router.use('/logging', loggingRoutes);

module.exports = router; 