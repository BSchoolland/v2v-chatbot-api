const { dbRun, dbGet } = require('../../config/database.js');
const bcrypt = require('bcryptjs');
const { logger } = require('../../../api/utils/fileLogger.js');

// Register a new user
async function registerUser(email, password, googleSub = null) {
    try {
        logger.info(`Attempting to register user with email: ${email}, googleSub: ${googleSub}`);
        const result = await dbRun(
            `INSERT INTO users (email, password, google_sub) VALUES (?, ?, ?)`,
            [email, password, googleSub]
        );
        logger.info(`Successfully registered user with ID: ${result}`);
        return { email, password, user_id: result, google_sub: googleSub };
    } catch (err) {
        logger.error('Error in registerUser:', { error: err, email, googleSub });
        throw err;
    }
}

// get a user by email
async function getUserByEmail(email) {
    try {
        logger.info(`Looking up user by email: ${email}`);
        const user = await dbGet(
            `SELECT * FROM users WHERE email = ?`,
            [email]
        );
        logger.info(`User lookup by email result:`, { found: !!user });
        return user;
    } catch (err) {
        logger.error('Error in getUserByEmail:', { error: err, email });
        throw err;
    }
}

// get a user by Google sub
async function getUserByGoogleSub(googleSub) {
    try {
        logger.info(`Looking up user by Google sub: ${googleSub}`);
        const user = await dbGet(
            `SELECT * FROM users WHERE google_sub = ?`,
            [googleSub]
        );
        logger.info(`User lookup by Google sub result:`, { found: !!user });
        return user;
    } catch (err) {
        logger.error('Error in getUserByGoogleSub:', { error: err, googleSub });
        throw err;
    }
}

// get a user by ID
async function getUserById(userId) {
    try {
        const user = await dbGet(
            `SELECT * FROM users WHERE user_id = ?`,
            [userId]
        );
        return user;
    } catch (err) {
        throw err;
    }
}

// check if a email already exists
async function checkEmailExists(email) {
    try {
        const user = await getUserByEmail(email);
        return user !== undefined;
    } catch (err) {
        throw err;
    }
}

async function getUserByPlanId(planId) {
    try {
        const user = await dbGet('SELECT * FROM users WHERE user_id = (SELECT user_id FROM plans WHERE plan_id = ?)', [planId]);
        return user;
    } catch (err) {
        throw err;
    }
}

async function updateUserGoogleSub(userId, googleSub) {
    try {
        logger.info(`Updating Google sub for user ${userId} to ${googleSub}`);
        const result = await dbRun(
            'UPDATE users SET google_sub = ? WHERE user_id = ?',
            [googleSub, userId]
        );
        logger.info(`Update result:`, { result });
        
        // Verify the update
        const user = await getUserById(userId);
        if (!user || user.google_sub !== googleSub) {
            logger.error('Update verification failed:', { userId, googleSub, user });
            throw new Error('Failed to verify Google sub update');
        }
    } catch (err) {
        logger.error('Error in updateUserGoogleSub:', { error: err, userId, googleSub });
        throw err;
    }
}

module.exports = {
    registerUser,
    getUserByEmail,
    getUserById,
    checkEmailExists,
    getUserByPlanId,
    getUserByGoogleSub,
    updateUserGoogleSub
};