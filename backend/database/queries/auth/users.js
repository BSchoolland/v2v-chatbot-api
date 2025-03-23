const { dbRun, dbGet } = require('../../config/database.js');
const bcrypt = require('bcryptjs');

// Register a new user
async function registerUser(email, password) {
    try {
        const result = await dbRun(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, password]
        );
        console.log('user id', result);
        return { email, password, user_id: result};
    } catch (err) {
        throw err;
    }
}

// get a user by email
async function getUserByEmail(email) {
    try {
        const user = await dbGet(
            `SELECT * FROM users WHERE email = ?`,
            [email]
        );
        return user;
    } catch (err) {
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

module.exports = {
    registerUser,
    getUserByEmail,
    getUserById,
    checkEmailExists,
    getUserByPlanId
};