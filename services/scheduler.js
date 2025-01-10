const { dbAll } = require('../database/database.js');
const { checkAndRenewCredits } = require('../database/credits.js');

async function renewAllCredits() {
    try {
        // Get all plans
        const plans = await dbAll('SELECT plan_id FROM plans');
        
        // Check and renew credits for each plan
        for (const plan of plans) {
            try {
                await checkAndRenewCredits(plan.plan_id);
            } catch (error) {
                console.error(`Error renewing credits for plan ${plan.plan_id}:`, error);
                // Continue with other plans even if one fails
            }
        }
    } catch (error) {
        console.error('Error in credit renewal job:', error);
    }
}

// Schedule the credit renewal to run daily at midnight
function scheduleCreditRenewal() {
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // next day
        0, // midnight
        0, // 0 minutes
        0  // 0 seconds
    );
    
    const msUntilMidnight = night.getTime() - now.getTime();
    
    // Schedule first run at next midnight
    setTimeout(() => {
        renewAllCredits();
        // Then schedule to run every 24 hours
        setInterval(renewAllCredits, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    console.log('Credit renewal scheduler initialized, first run at:', night.toLocaleString());
}

module.exports = {
    renewAllCredits,
    scheduleCreditRenewal
}; 