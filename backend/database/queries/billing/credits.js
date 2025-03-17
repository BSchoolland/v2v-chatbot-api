const { dbRun, dbGet } = require('../../config/database.js');
const { getCurrentDate } = require('../../utils/dateUtils.js');
const { logCreditRenewal } = require('../../logging/credits.js');
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

        // Check if the plan needs to be renewed
        const now = new Date();
        const renewalDate = new Date(plan.renews_at);
        let shouldRenew = false;
        // If the renewal date is in the past, and the plan is free or active, renew the plan
        if (now >= renewalDate && (plan.plan_type_id == 0 || plan.subscription_active)) {
            shouldRenew = true;
        }
        
        if (shouldRenew) {
            // reset warnings for the plan
            await resetWarnings(planId);
            // Get the billing anchor day, default to the day the plan was created if not set
            const billingAnchorDay = plan.billing_anchor_day || new Date(plan.renews_at).getDate();
            
            // Calculate the next renewal date based on the billing anchor day
            const nextRenewalDate = addOneMonthWithBillingAnchor(new Date(plan.renews_at), billingAnchorDay);
            logCreditRenewal(planId, plan.monthly_credits, plan.remaining_credits);
            // Update the plan with the new renewal date and reset the remaining credits
            await dbRun(
                `UPDATE plans 
                 SET remaining_credits = ?, renews_at = ? 
                 WHERE plan_id = ?`,
                [plan.monthly_credits, nextRenewalDate.toISOString(), planId]
            );
            
            return {
                renewed: true,
                nextRenewalDate,
                credits: plan.monthly_credits
            };
        }
        
        return {
            renewed: false,
            nextRenewalDate: renewalDate,
            credits: plan.remaining_credits
        };
    } catch (error) {
        console.error('Error renewing credits:', error);
        throw error;
    }
}


// reset warnings for a plan
async function resetWarnings(planId) {
    await dbRun('UPDATE plans SET credits_half_warning_sent = 0, credits_low_warning_sent = 0, credits_exhausted_warning_sent = 0 WHERE plan_id = ?', [planId]);
}

// Check and set warning flag in a single transaction to prevent race conditions
async function checkAndSetWarningFlag(planId, flagType) {
    // Begin transaction
    await dbRun('BEGIN TRANSACTION');
    
    try {
        // Check if warning should be sent
        let shouldSend = false;
        
        if (flagType === 'half') {
            const plan = await dbGet('SELECT credits_half_warning_sent FROM plans WHERE plan_id = ?', [planId]);
            shouldSend = !plan.credits_half_warning_sent;
            
            if (shouldSend) {
                await dbRun('UPDATE plans SET credits_half_warning_sent = 1 WHERE plan_id = ?', [planId]);
            }
        } else if (flagType === 'low') {
            const plan = await dbGet('SELECT credits_low_warning_sent FROM plans WHERE plan_id = ?', [planId]);
            shouldSend = !plan.credits_low_warning_sent;
            
            if (shouldSend) {
                await dbRun('UPDATE plans SET credits_low_warning_sent = 1 WHERE plan_id = ?', [planId]);
            }
        } else if (flagType === 'exhausted') {
            const plan = await dbGet('SELECT credits_exhausted_warning_sent FROM plans WHERE plan_id = ?', [planId]);
            shouldSend = !plan.credits_exhausted_warning_sent;
            
            if (shouldSend) {
                await dbRun('UPDATE plans SET credits_exhausted_warning_sent = 1 WHERE plan_id = ?', [planId]);
            }
        }
        
        // Commit transaction
        await dbRun('COMMIT');
        
        return shouldSend;
    } catch (error) {
        // Rollback transaction on error
        await dbRun('ROLLBACK');
        throw error;
    }
}

async function getMonthlyCredits(planId) {
    const plan = await dbGet(
        `SELECT p.*, pt.monthly_credits, pt.plan_type_id
         FROM plans p
         JOIN plan_type pt ON p.plan_type_id = pt.plan_type_id
         WHERE p.plan_id = ?`,
        [planId]
    );
    return plan.monthly_credits;
}

module.exports = {
    allocateMonthlyCredits,
    resetToFreeCredits,
    checkAndRenewCredits,
    getMonthlyCredits,
    checkAndSetWarningFlag
}; 