import db from "./database.js";
// Assign a plan to a user
function assignPlanToUser(userId, planTypeId) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO plan (user_id) VALUES (?)`,
            [userId],
            function (err) {
                if (err) reject(err);
                else {
                    const planId = this.lastID;
                    // Initialize plan credits and associate plan type
                    db.run(
                        `UPDATE plan SET remaining_credits = (SELECT monthly_credits FROM plan_type WHERE plan_type_id = ?), plan_type_id = ? WHERE plan_id = ?`,
                        [planTypeId, planTypeId, planId],
                        function (err) {
                            if (err) reject(err);
                            else resolve(planId);
                        }
                    );
                }
            }
        );
    });
}

// Retrieve user's plan details
function getUserPlan(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM plan WHERE user_id = ?`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Update plan credits
function updatePlanCredits(planId, credits) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE plan SET remaining_credits = ? WHERE plan_id = ?`,
            [credits, planId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Cancel a user's plan
function cancelUserPlan(planId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM plan WHERE plan_id = ?`,
            [planId],
            function (err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}
module.exports = {
    assignPlanToUser,
    getUserPlan,
    updatePlanCredits,
    cancelUserPlan,
};