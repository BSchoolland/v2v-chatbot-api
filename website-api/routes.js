const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const { 
    getUserByEmail, 
    registerUser, 
    checkEmailExists 
} = require('../database/users.js');
require('dotenv').config();

// Determine if the environment is production
const isProduction = process.env.ENV !== 'development';

// Use cookie-parser middleware
router.use(cookieParser());

// Input validation middleware
const validateInput = (req, res, next) => {
    let { email, password } = req.body;
    
    // Trim inputs
    email = email.trim();
    
    // Password validation
    if (!password || password.length < 8) {
        console.log('password not long enough')
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    
    next();
};

// login
router.post('/login', validateInput, async (req, res) => {
    let { email, password } = req.body;
    try {
        const user = await getUserByEmail(email);
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
                    success: true,
                    email: user.email 
                });
            }
        }
        res.status(401).json({ message: 'Invalid email or password' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to login' });
    }
});

// logout
router.post('/logout', (req, res) => {
    res.clearCookie('session');
    res.status(200).json({ message: 'Logout successful' });
});

// register
router.post('/register', validateInput, async (req, res) => {
    let { email: email, password } = req.body;
    try {
        // Check if email already exists
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
            console.log('Email already exists')
            return res.status(409).json({ message: 'Email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Register user
        await registerUser(email, hashedPassword);

        console.log('User registered successfully')
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to register user' });
    }
});


module.exports = router;