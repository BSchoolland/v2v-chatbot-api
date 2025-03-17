const { dbAll, dbRun, dbGet } = require('./config/database.js');
const { allocateMonthlyCredits } = require('./credits.js');
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
    // Get the current date to set as the billing anchor day
    const now = new Date();
    const billingAnchorDay = now.getDate();
    
    // renews_at is the date the plan will renew, one month from now
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const plan = await dbRun('INSERT INTO plans (user_id, chatbot_id, plan_type_id, rate_limiting_policy, name, renews_at, billing_anchor_day) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, chatbotId, planTypeId, "default", planName, renewsAt, billingAnchorDay]);
    
    // Get the plan ID from the last insert
    const newPlan = await dbGet('SELECT * FROM plans WHERE rowid = last_insert_rowid()');
    
    // Allocate initial credits
    await allocateMonthlyCredits(newPlan.plan_id);
    
    return newPlan;
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
        // Get current plan details
        const currentPlan = await getPlan(planId);
        if (!currentPlan) {
            throw new Error('Plan not found');
        }

        // If changing plan type, cancel any active subscriptions
        if (currentPlan.plan_type_id !== planTypeId) {
            await cancelActiveSubscriptions(planId);
        }

        // Get plan type details for credit amounts
        const planTypeCredits = {
            0: 50,      // Free
            1: 1000,    // Basic
            2: 10000    // Pro
        };

        let newCredits = currentPlan.remaining_credits;
        let additionalCredits = currentPlan.additional_credits;
        let subscriptionActive = currentPlan.subscription_active || 0;
        let renewsAt = currentPlan.renews_at;
        let billingAnchorDay = currentPlan.billing_anchor_day;

        // If billing anchor day is not set, set it to the current renewal date's day
        if (!billingAnchorDay && renewsAt) {
            billingAnchorDay = new Date(renewsAt).getDate();
        }

        // Handle different plan change scenarios
        if (currentPlan.plan_type_id === 0 && planTypeId > 0) {
            // Free to Paid: Keep 50 credits until activation
            newCredits = currentPlan.remaining_credits;
            subscriptionActive = 0; // Needs payment activation
        } 
        else if (currentPlan.plan_type_id > 0 && planTypeId === 0) {
            // Paid to Free: Keep current credits until renewal date
            newCredits = Math.max(currentPlan.remaining_credits, 50);
            subscriptionActive = 1; // Free plans are always active
        }
        else if (currentPlan.plan_type_id > 0 && planTypeId > 0 && planTypeId !== currentPlan.plan_type_id) {
            // Paid to Different Paid Plan
            if (planTypeId > currentPlan.plan_type_id) {
                // Upgrading: Give full new plan credits immediately
                newCredits = planTypeCredits[planTypeId];
            } else {
                // Downgrading: Keep current credits even if above new plan limit
                newCredits = currentPlan.remaining_credits;
            }
            // Keep subscription active until new one is created
            subscriptionActive = currentPlan.subscription_active;
        }

        // Update the plan with all fields preserved
        await dbRun(
            `UPDATE plans 
             SET user_id = ?,
                 chatbot_id = ?,
                 plan_type_id = ?,
                 name = ?,
                 remaining_credits = ?,
                 additional_credits = ?,
                 subscription_active = ?,
                 renews_at = ?,
                 billing_anchor_day = ?
             WHERE plan_id = ?`,
            [
                userId,
                chatbotId,
                planTypeId,
                planName,
                newCredits,
                additionalCredits,
                subscriptionActive,
                renewsAt,
                billingAnchorDay,
                planId
            ]
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