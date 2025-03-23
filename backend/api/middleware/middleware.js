const jwt = require('jsonwebtoken'); // Add this
require('dotenv').config();

// Auth middleware to verify token and extract userId
const authMiddleware = (req, res, next) => {
    // Allow bypassing auth in development mode if admin flag is set
    if (process.env.ENV === 'development' && req.query.admin === 'true') {
        req.userId = 1; // Set a default admin user ID
        return next();
    }

    const token = req.cookies?.session;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.email = decoded.email;
        next();
    } catch (err) {
        console.error('Invalid token:', err);
        res.status(401).json({ message: 'Not authenticated' });
    }
};

const validateInput = (req, res, next) => {
    let { email, password } = req.body;
    
    // Trim inputs
    email = email.trim();
    
    // Password validation
    // if (!password || password.length < 8) {
    //     return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    // }
    
    next();
};

module.exports = {
    authMiddleware,
    validateInput
};  