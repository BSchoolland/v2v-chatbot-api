const { dbRun } = require('./database.js');

async function logCreditRenewal(planId = "", credits_added = 0, credits_before = 0, metadata = {}) {
    try {
        const timestamp = new Date().toISOString();
        await dbRun('INSERT INTO credit_renewals (timestamp, credits_added, credits_before, plan_id) VALUES (?, ?, ?, ?)', [timestamp, credits_added, credits_before, planId]);
    } catch (error) {
        console.error("Error logging credit renewal", error);
    }
}

module.exports = {
    logCreditRenewal
}