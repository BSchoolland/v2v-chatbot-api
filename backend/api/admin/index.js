const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/middleware.js');
const loggingRoutes = require('./logging.js');

router.use(authMiddleware);

// Register admin routes
router.use('/logging', loggingRoutes);

module.exports = router; 