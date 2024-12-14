const { dbGet, dbRun } = require('./database');

// Get all plans for a user
async function getUserPlans(userId) {
    const plans = await dbGet('SELECT * FROM plans WHERE user_id = ?', [userId]);
    if (!plans) {
        return [];
    }
    return plans;
}
// add a plan for a user
async function addPlan(userId, chatbotId, planTypeId) {
    const plan = await dbRun('INSERT INTO plans (user_id, chatbot_id, plan_type_id, rate_limiting_policy) VALUES (?, ?, ?, ?)', [userId, chatbotId, planTypeId, "default"]);
    return plan;
}

module.exports = {
    getUserPlans,
    addPlan,
};