const { dbRun, dbGet } = require('./database.js');
const { getCurrentDate } = require('./dateUtils.js');
const { logCreditRenewal } = require('./logging/credits.js');
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

        // Set billing anchor day to today's day of month
        const now = getCurrentDate();
        const billingAnchorDay = now.getDate();
        
        // Set renewal date to one month from now, preserving the billing anchor day
        const renewalDate = new Date(now);
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        
        // Update the plan with new credits, renewal date, and billing anchor day
        await dbRun(
            `UPDATE plans 
             SET remaining_credits = ?,
                 renews_at = ?,
                 billing_anchor_day = ?
             WHERE plan_id = ?`,
            [plan.monthly_credits, renewalDate.toISOString(), billingAnchorDay, planId]
        );

        return {
            credits: plan.monthly_credits,
            renewalDate: renewalDate.toISOString(),
            billingAnchorDay: billingAnchorDay
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

        // Get current plan to preserve billing anchor day
        const currentPlan = await dbGet('SELECT billing_anchor_day FROM plans WHERE plan_id = ?', [planId]);
        if (!currentPlan) {
            console.error(`Error: Could not find plan with ID ${planId} when trying to preserve billing anchor day. Using current date instead.`);
        }
        const billingAnchorDay = currentPlan?.billing_anchor_day || getCurrentDate().getDate();
        
        // Set renewal date to one month from now, using the billing anchor day
        const now = getCurrentDate();
        const renewalDate = new Date(now.getFullYear(), now.getMonth() + 1, billingAnchorDay);
        
        // If the calculated day doesn't exist in the next month, use the last day of that month
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
        if (billingAnchorDay > lastDayOfMonth) {
            renewalDate.setDate(lastDayOfMonth);
        }

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

// This function is replaced with a new implementation that uses the billing anchor day
function addOneMonthWithBillingAnchor(date, billingAnchorDay) {
    const newDate = new Date(date);
    
    // Move to the next month
    newDate.setMonth(newDate.getMonth() + 1);
    
    // Set the day to the billing anchor day
    const lastDayOfNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
    
    // If billing anchor day is greater than the last day of the month, use the last day
    if (billingAnchorDay > lastDayOfNewMonth) {
        newDate.setDate(lastDayOfNewMonth);
    } else {
        newDate.setDate(billingAnchorDay);
    }
    
    return newDate;
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

        const now = getCurrentDate();
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
            // Get the billing anchor day, default to the day the plan was created if not set
            const billingAnchorDay = plan.billing_anchor_day || new Date(plan.renews_at).getDate();
            
            // Calculate next renewal date using the billing anchor day
            const nextRenewal = addOneMonthWithBillingAnchor(new Date(plan.renews_at), billingAnchorDay);
            // log the renewal
            logCreditRenewal(planId, plan.monthly_credits, plan.remaining_credits);
            // credits are not retained between renewals, so we need to reset the credits to the monthly limit
            await dbRun(
                `UPDATE plans 
                 SET remaining_credits = ?,
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