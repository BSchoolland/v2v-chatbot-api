const { dbRun, dbGet } = require('./database.js');
const bcrypt = require('bcryptjs');

// Register a new user
async function registerUser(email, password) {
    try {
        await dbRun(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, password]
        );
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

// check if a email already exists
async function checkEmailExists(email) {
    try {
        const user = await getUserByEmail(email);
        return user !== undefined;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    registerUser,
    getUserByEmail,
    checkEmailExists
};