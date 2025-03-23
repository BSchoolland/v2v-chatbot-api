const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/fileLogger.js');
const { sendVerificationEmail } = require('../utils/emailService.js');
const { validateInput, authMiddleware } = require('../middleware/middleware.js');

const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

require('dotenv').config();
// Determine if the environment is production
const isProduction = process.env.ENV !== 'development';

const { 
    getUserByEmail, 
    registerUser, 
    checkEmailExists,
    getUserByGoogleSub,
    updateUserGoogleSub
} = require('../../database/queries/auth/users.js');

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
        logger.error(err);
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
    let { firstName, lastName, email, password } = req.body;
    // TODO: Record the user's name in the database
    try {
        // Check if email already exists
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
            logger.info('Email already exists')
            return res.status(409).json({ message: 'Email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Register user
        const user = await registerUser(email, hashedPassword);


        // send verification email
        // // TODO: generate and store a secure token, then use it to set verified status in the database
        const token = 'example-token';
        // sendVerificationEmail(email, token);

        // TODO: send email to user with verification link

        // Generate JWT
        const sessionToken = jwt.sign(
            { 
                userId: user.user_id,
                email: user.email 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Set secure cookie
        res.cookie('session', sessionToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ message: 'Failed to register user' });
    }
});

// Check authentication status
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await getUserByEmail(req.email);
        if (user.user_id !== req.userId) {
            return res.status(401).json({ authenticated: false });
        }
        if (user) {
            return res.status(200).json({
                authenticated: true,
                email: user.email,
                userId: user.user_id
            });
        }
        res.status(401).json({ authenticated: false });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ message: 'Failed to check authentication status' });
    }
});

// Google Authentication route
router.post('/google-auth', async (req, res) => {
    const { credential } = req.body;

    try {
        logger.info('Starting Google authentication');
        
        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, sub } = payload;
        logger.info('Google token verified', { email, sub });

        // First try to find user by Google sub (primary identifier)
        let user = await getUserByGoogleSub(sub);
        logger.info('Google sub lookup result:', { found: !!user });

        if (!user) {
            // If not found by sub, check by email as fallback
            user = await getUserByEmail(email);
            logger.info('Email fallback lookup result:', { found: !!user });
            
            if (user) {
                logger.info('Updating existing user with Google sub', { userId: user.user_id, sub });
                // If user exists with email but no sub, update their record with the sub
                await updateUserGoogleSub(user.user_id, sub);
                // Refresh user data after update
                user = await getUserByGoogleSub(sub);
                logger.info('User data refreshed after update:', { success: !!user });
            } else {
                // If user doesn't exist at all, register them
                logger.info('Registering new user with Google credentials');
                const randomPassword = Math.random().toString(36).slice(-12);
                const hashedPassword = await bcrypt.hash(randomPassword, 10);
                
                user = await registerUser(email, hashedPassword, sub);
                logger.info('New user registered:', { userId: user.user_id });
            }
        }

        // Generate JWT
        const token = jwt.sign(
            { 
                userId: user.user_id,
                email: user.email,
                googleSub: sub
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        logger.info('JWT generated successfully');
        
        // Set secure cookie
        res.cookie('session', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        return res.status(200).json({ 
            success: true,
            message: 'Google authentication successful',
            email: user.email
        });

    } catch (error) {
        logger.error('Google authentication error:', {
            error: error,
            stack: error.stack,
            credential: credential ? 'present' : 'missing'
        });
        return res.status(401).json({ 
            success: false,
            message: 'Google authentication failed' 
        });
    }
});

// log the user out
router.get('/logout', (req, res) => {
    res.clearCookie('session');
    res.status(200).json({ message: 'Logout successful' });
});


module.exports = router;