const { dbRun, dbGet } = require('./database.js');

async function allocateMonthlyCredits(planId) {
    try {
        // Get the plan and its type
        const plan = await dbGet(
            `SELECT p.*, pt.monthly_credits 
             FROM plans p
             JOIN plan_type pt ON p.plan_type_id = pt.plan_type_id
             WHERE p.plan_id = ?`,
            [planId]
        );

        if (!plan) {
            throw new Error('Plan not found');
        }

        // Set renewal date to one month from now
        const renewalDate = new Date();
        renewalDate.setMonth(renewalDate.getMonth() + 1);

        // Update the plan with new credits and renewal date
        await dbRun(
            `UPDATE plans 
             SET remaining_credits = ?,
                 renews_at = ?
             WHERE plan_id = ?`,
            [plan.monthly_credits, renewalDate.toISOString(), planId]
        );

        return {
            credits: plan.monthly_credits,
            renewalDate: renewalDate.toISOString()
        };
    } catch (error) {
        console.error('Error allocating monthly credits:', error);
        throw error;
    }
}

async function resetToFreeCredits(planId) {
    try {
        // Get the free plan type credits
        const freePlanType = await dbGet(
            'SELECT monthly_credits FROM plan_type WHERE plan_type_id = 0'
        );

        if (!freePlanType) {
            throw new Error('Free plan type not found');
        }

        // Set renewal date to one month from now
        const renewalDate = new Date();
        renewalDate.setMonth(renewalDate.getMonth() + 1);

        // Update the plan with free credits
        await dbRun(
            `UPDATE plans 
             SET remaining_credits = ?,
                 renews_at = ?
             WHERE plan_id = ?`,
            [freePlanType.monthly_credits, renewalDate.toISOString(), planId]
        );

        return {
            credits: freePlanType.monthly_credits,
            renewalDate: renewalDate.toISOString()
        };
    } catch (error) {
        console.error('Error resetting to free credits:', error);
        throw error;
    }
}

async function checkAndRenewCredits(planId) {
    try {
        const plan = await dbGet(
            `SELECT p.*, pt.monthly_credits, pt.plan_type_id
             FROM plans p
             JOIN plan_type pt ON p.plan_type_id = pt.plan_type_id
             WHERE p.plan_id = ?`,
            [planId]
        );

        if (!plan) {
            throw new Error('Plan not found');
        }

        const now = new Date();
        let shouldRenew = false;

        // For free plans (plan_type_id = 0), always check renewal
        if (plan.plan_type_id === 0) {
            // If no renewal date set, or renewal date is in the past
            shouldRenew = !plan.renews_at || now >= new Date(plan.renews_at);
        } else {
            // For paid plans, only renew if there's an active subscription and renewal is due
            shouldRenew = plan.subscription_active && plan.renews_at && now >= new Date(plan.renews_at);
        }

        if (shouldRenew) {
            // Renew credits
            const nextRenewal = new Date();
            nextRenewal.setMonth(nextRenewal.getMonth() + 1);

            await dbRun(
                `UPDATE plans 
                 SET remaining_credits = remaining_credits + ?,
                     renews_at = ?
                 WHERE plan_id = ?`,
                [plan.monthly_credits, nextRenewal.toISOString(), planId]
            );

            return {
                credits: plan.monthly_credits,
                renewalDate: nextRenewal.toISOString()
            };
        }

        return null; // No renewal needed
    } catch (error) {
        console.error('Error checking/renewing credits:', error);
        throw error;
    }
}

module.exports = {
    allocateMonthlyCredits,
    resetToFreeCredits,
    checkAndRenewCredits
}; 