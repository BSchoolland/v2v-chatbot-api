import db from './database.js';
// Register a new user
function registerUser(email, password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, hashedPassword],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Authenticate user login
function authenticateUser(email, password) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM users WHERE email = ?`,
            [email],
            (err, row) => {
                if (err) reject(err);
                else if (row && bcrypt.compareSync(password, row.password)) {
                    resolve(row);
                } else {
                    reject(new Error('Invalid credentials'));
                }
            }
        );
    });
}

// Retrieve user information
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT user_id, email FROM users WHERE user_id = ?`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Update user details
function updateUser(userId, email, password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users SET email = ?, password = ? WHERE user_id = ?`,
            [email, hashedPassword, userId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Delete a user account
function deleteUser(userId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM users WHERE user_id = ?`,
            [userId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });

}
// Export the functions
export default {
    registerUser,
    authenticateUser,
    getUserById,
    updateUser,
    deleteUser,
};