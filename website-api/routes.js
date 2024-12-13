const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const { 
    getUserByUsername, 
    registerUser, 
    checkUsernameExists 
} = require('../database/users.js');
require('dotenv').config();

// Determine if the environment is production
const isProduction = process.env.ENV !== 'development';

// Use cookie-parser middleware
router.use(cookieParser());

// Input validation middleware
const validateInput = (req, res, next) => {
    const { username, password } = req.body;
    
    // Trim inputs
    username = username.trim();
    
    // Username validation
    if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).send('Username must be between 3 and 20 characters');
    }
    
    // Password validation
    if (!password || password.length < 8) {
        return res.status(400).send('Password must be at least 8 characters long');
    }
    
    next();
};

// login
router.post('/login', validateInput, async (req, res) => {
    let { username, password } = req.body;
    try {
        const user = await getUserByUsername(username);
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                // Generate unique session token
                const sessionToken = uuidv4();
                
                // Set a secure cookie
                res.cookie('session', sessionToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: 'Strict',
                    maxAge: 24 * 60 * 60 * 1000 // 1 day
                });
                
                return res.status(200).json({ 
                    message: 'Login successful',
                    username: user.username 
                });
            }
        }
        res.status(401).send('Invalid username or password');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to login');
    }
});

// logout
router.post('/logout', (req, res) => {
    res.clearCookie('session');
    res.status(200).send('Logged out');
});

// register
router.post('/register', validateInput, async (req, res) => {
    let { username, password } = req.body;
    
    try {
        // Check if username already exists
        const usernameExists = await checkUsernameExists(username);
        if (usernameExists) {
            return res.status(409).send('Username already exists');
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Register user
        await registerUser(username, hashedPassword);
        
        res.status(201).send('User registered successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to register user');
    }
});

module.exports = router;