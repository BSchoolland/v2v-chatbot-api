const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

require('dotenv').config();
// Determine if the environment is production
const isProduction = process.env.ENV !== 'development';

const { 
    getUserByEmail, 
    registerUser, 
    checkEmailExists 
} = require('../database/users.js');
// Input validation middleware

const { validateInput } = require('./middleware.js');

// login
router.post('/login', validateInput, async (req, res) => {
    let { email, password } = req.body;
    try {
        const user = await getUserByEmail(email);
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                // Generate JWT
                const token = jwt.sign(
                    { 
                        userId: user.user_id,
                        email: user.email 
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                // Set secure cookie
                res.cookie('session', token, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: 'Strict',
                    maxAge: 24 * 60 * 60 * 1000 // 1 day
                });
                
                return res.status(200).json({ 
                    success: true,
                    message: 'Login successful',
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
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to register user' });
    }
});

router.use(cookieParser());


module.exports = router;