const { dbRun, dbGet } = require('./database.js');
const bcrypt = require('bcrypt');


// Register a new user
async function registerUser(email, password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = await dbRun(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, hashedPassword]
        );
        return userId;
    } catch (err) {
        throw err;
    }
}

// Authenticate user login
async function authenticateUser(email, password) {
    try {
        const user = await dbGet(
            `SELECT * FROM users WHERE email = ?`,
            [email]
        );
        
        if (user && await bcrypt.compare(password, user.password)) {
            return user;
        }
        throw new Error('Invalid credentials');
    } catch (err) {
        throw err;
    }
}

// Retrieve user information
async function getUserById(userId) {
    try {
        const user = await dbGet(
            `SELECT user_id, email FROM users WHERE user_id = ?`,
            [userId]
        );
        return user;
    } catch (err) {
        throw err;
    }
}

// Update user details
async function updateUser(userId, email, password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbRun(
            `UPDATE users SET email = ?, password = ? WHERE user_id = ?`,
            [email, hashedPassword, userId]
        );
    } catch (err) {
        throw err;
    }
}

// Delete a user account
async function deleteUser(userId) {
    try {
        await dbRun(
            `DELETE FROM users WHERE user_id = ?`,
            [userId]
        );
    } catch (err) {
        throw err;
    }
}

module.exports = {
    registerUser,
    authenticateUser,
    getUserById,
    updateUser,
    deleteUser,
};