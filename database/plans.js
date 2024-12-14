const { dbAll, dbRun, dbGet } = require('./database');

// Get all plans for a user
async function getUserPlans(userId) {
    const plans = await dbAll('SELECT * FROM plans WHERE user_id = ?', [userId]);
    if (!plans) {
        return [];
    }
    // if there is just one plan, return it as an array
    if (!Array.isArray(plans)) {
        return [plans];
    }
    return plans;
}

// add a plan for a user
async function addPlan(userId, chatbotId, planTypeId, planName) {
    console.log('Adding plan:', userId, chatbotId, planTypeId, planName);   
    const plan = await dbRun('INSERT INTO plans (user_id, chatbot_id, plan_type_id, rate_limiting_policy, name) VALUES (?, ?, ?, ?, ?)', [userId, chatbotId, planTypeId, "default", planName]);
    return plan;
}

// get a plan for a user
async function getPlan(planId) {
    const plan = await dbGet('SELECT * FROM plans WHERE plan_id = ?', [planId]);
    return plan;
}

// update a plan for a user
async function updatePlan(planId, userId, chatbotId, planName, planTypeId) {
    // FIXME: this will overwrite other data in the plan
    const plan = await dbRun('REPLACE INTO plans (user_id, chatbot_id, plan_id, name, plan_type_id) VALUES (?, ?, ?, ?, ?)', [userId, chatbotId, planId, planName, planTypeId]);
    return plan;
}

module.exports = {
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan
};