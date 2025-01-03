const { dbAll, dbRun, dbGet } = require('./database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// schema:
// 
// plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
// chatbot_id INTEGER,
// plan_type_id INTEGER NOT NULL,
// user_id INTEGER NOT NULL,
// remaining_credits INTEGER DEFAULT 0,
// additional_credits INTEGER DEFAULT 0,
// renews_at TEXT,
// rate_limiting_policy TEXT,
// name TEXT,
// FOREIGN KEY (chatbot_id) REFERENCES chatbot(chatbot_id),
// FOREIGN KEY (plan_type_id) REFERENCES plan_type(plan_type_id),
// FOREIGN KEY (user_id) REFERENCES users(user_id)


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
    // renews_at is the date the plan will renew, one month from now
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const plan = await dbRun('INSERT INTO plans (user_id, chatbot_id, plan_type_id, rate_limiting_policy, name, renews_at) VALUES (?, ?, ?, ?, ?, ?)', [userId, chatbotId, planTypeId, "default", planName, renewsAt]);
    return plan;
}

// get a plan for a user
async function getPlan(planId) {
    const plan = await dbGet('SELECT * FROM plans WHERE plan_id = ?', [planId]);
    return plan;
}

// Cancel any active subscriptions for a plan
async function cancelActiveSubscriptions(planId) {
    try {
        // Get active subscriptions for this plan
        const subscriptions = await dbAll(
            `SELECT * FROM stripe_subscriptions 
             WHERE plan_id = ? AND status = 'active'`,
            [planId]
        );

        for (const sub of subscriptions) {
            // Cancel in Stripe
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            
            // Update our database
            await dbRun(
                `UPDATE stripe_subscriptions 
                 SET status = 'canceled', updated_at = CURRENT_TIMESTAMP 
                 WHERE stripe_subscription_id = ?`,
                [sub.stripe_subscription_id]
            );
        }
    } catch (error) {
        console.error('Error canceling subscriptions:', error);
        throw error;
    }
}

// update a plan for a user
async function updatePlan(planId, userId, chatbotId, planName, planTypeId) {
    try {
        // Get current plan to check if we're changing plan type
        const currentPlan = await getPlan(planId);
        if (currentPlan && currentPlan.plan_type_id !== planTypeId) {
            // If changing plan type, cancel any active subscriptions
            await cancelActiveSubscriptions(planId);
        }

        // Update the plan details
        await dbRun(
            `UPDATE plans 
             SET user_id = ?, 
                 chatbot_id = ?, 
                 name = ?, 
                 plan_type_id = ?,
                 subscription_active = CASE 
                     WHEN ? = 0 THEN 1  -- Free plans are always "active"
                     ELSE 0             -- Paid plans need subscription
                 END
             WHERE plan_id = ?`,
            [userId, chatbotId, planName, planTypeId, planTypeId, planId]
        );

        return await getPlan(planId);
    } catch (error) {
        console.error('Error updating plan:', error);
        throw error;
    }
}

// set chatbot id for a plan
async function setChatbotIdForPlan(planId, chatbotId) {
    await dbRun('UPDATE plans SET chatbot_id = ? WHERE plan_id = ?', [chatbotId, planId]);
}   


// subtract from the plan
async function subtractFromPlan(planId, amount) {
    // check if the plan has enough regular credits
    const plan = await getPlan(planId);
    if (plan.remaining_credits >= amount) {
        await dbRun('UPDATE plans SET remaining_credits = remaining_credits - ? WHERE plan_id = ?', [amount, planId]);
    } else {
        console.log("Plan:", planId, "is out of monthly credits, using additional credits");
        // use the last of the remaining credits and then use the additional credits
        await dbRun('UPDATE plans SET remaining_credits = 0, additional_credits = additional_credits - ? WHERE plan_id = ?', [amount - plan.remaining_credits, planId]);
    }
}

// get the plan from the chatbot id
async function getPlanFromChatbotId(chatbotId) {
    const plan = await dbGet('SELECT * FROM plans WHERE chatbot_id = ?', [chatbotId]);
    return plan;
}

module.exports = {
    getUserPlans,
    addPlan,
    getPlan,
    updatePlan,
    setChatbotIdForPlan,
    subtractFromPlan,
    getPlanFromChatbotId,
    cancelActiveSubscriptions
};