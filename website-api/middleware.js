const jwt = require('jsonwebtoken'); // Add this
require('dotenv').config();

// Auth middleware to verify token and extract userId
const authMiddleware = (req, res, next) => {
    const sessionToken = req.cookies.session;
    if (!sessionToken) {
        console.log('No session token');
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
        req.userId = decoded.userId; // Attach userId to request
        next();
    } catch (err) {
        console.error('Invalid token:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const validateInput = (req, res, next) => {
    let { email, password } = req.body;
    
    // Trim inputs
    email = email.trim();
    
    // Password validation
    // if (!password || password.length < 8) {
    //     console.log('password not long enough')
    //     return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    // }
    
    next();
};

module.exports = {
    authMiddleware,
    validateInput
};  