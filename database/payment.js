import { db } from './database.js';
// Add a payment method for a user
function addPaymentMethod(userId) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO payment_method (user_id) VALUES (?)`,
            [userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Retrieve user's payment methods
function getPaymentMethods(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM payment_method WHERE user_id = ?`,
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Remove a payment method
function removePaymentMethod(paymentId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM payment_method WHERE payment_id = ?`,
            [paymentId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

module.exports = {
    addPaymentMethod,
    getPaymentMethods,
    removePaymentMethod,
};