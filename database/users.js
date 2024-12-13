const { dbRun, dbGet } = require('./database.js');
const bcrypt = require('bcrypt');

// Register a new user
async function registerUser(username, password) {
    try {
        await dbRun(
            `INSERT INTO user (username, password) VALUES (?, ?)`,
            [username, password]
        );
    } catch (err) {
        throw err;
    }
}

// get a user by username
async function getUserByUsername(username) {
    try {
        const user = await dbGet(
            `SELECT * FROM user WHERE username = ?`,
            [username]
        );
        return user;
    } catch (err) {
        throw err;
    }
}

// check if a username already exists
async function checkUsernameExists(username) {
    try {
        const user = await getUserByUsername(username);
        return user !== undefined;
    } catch (err) {
        throw err;
    }
}

module.exports = {
    registerUser,
    getUserByUsername,
    checkUsernameExists
};