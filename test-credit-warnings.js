/**
 * Test Credit Warning Logic
 * 
 * This script tests the credit warning logic to ensure it works correctly.
 */

const { 
    shouldSendCreditsHalfWarning,
    shouldSendCreditsLowWarning,
    shouldSendCreditsExhaustedWarning,
    setCreditsHalfWarningSent,
    setCreditsLowWarningSent,
    setCreditsExhaustedWarningSent,
    resetWarnings
} = require('./database/credits.js');

const { dbRun, dbGet } = require('./database/database.js');
const dotenv = require('dotenv');

dotenv.config();

async function testCreditWarnings() {
    try {
        console.log('Testing credit warning logic...');
        
        // Create a test plan for testing
        // First, get a test chatbot and user
        const testChatbotId = 1; // Use an existing chatbot ID or create one
        const testUserId = 1; // Use an existing user ID or create one
        
        // Insert the test plan
        const planId = await dbRun(`
            INSERT INTO plans (
                chatbot_id, 
                plan_type_id, 
                user_id, 
                remaining_credits, 
                additional_credits, 
                renews_at,
                credits_half_warning_sent,
                credits_low_warning_sent,
                credits_exhausted_warning_sent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            testChatbotId, 
            0, 
            testUserId, 
            25, 
            0, 
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            0,
            0,
            0
        ]);
        
        console.log('Test plan created with ID:', planId);
        
        // Test shouldSendCreditsHalfWarning
        let shouldSendHalf = await shouldSendCreditsHalfWarning(planId);
        console.log('Should send half warning:', shouldSendHalf);
        
        // Set half warning sent
        await setCreditsHalfWarningSent(planId, 1);
        shouldSendHalf = await shouldSendCreditsHalfWarning(planId);
        console.log('Should send half warning after setting flag:', shouldSendHalf);
        
        // Test shouldSendCreditsLowWarning
        let shouldSendLow = await shouldSendCreditsLowWarning(planId);
        console.log('Should send low warning:', shouldSendLow);
        
        // Set low warning sent
        await setCreditsLowWarningSent(planId, 1);
        shouldSendLow = await shouldSendCreditsLowWarning(planId);
        console.log('Should send low warning after setting flag:', shouldSendLow);
        
        // Test shouldSendCreditsExhaustedWarning
        let shouldSendExhausted = await shouldSendCreditsExhaustedWarning(planId);
        console.log('Should send exhausted warning:', shouldSendExhausted);
        
        // Set exhausted warning sent
        await setCreditsExhaustedWarningSent(planId, 1);
        shouldSendExhausted = await shouldSendCreditsExhaustedWarning(planId);
        console.log('Should send exhausted warning after setting flag:', shouldSendExhausted);
        
        // Test resetWarnings
        await resetWarnings(planId);
        shouldSendHalf = await shouldSendCreditsHalfWarning(planId);
        shouldSendLow = await shouldSendCreditsLowWarning(planId);
        shouldSendExhausted = await shouldSendCreditsExhaustedWarning(planId);
        console.log('After reset - Should send half warning:', shouldSendHalf);
        console.log('After reset - Should send low warning:', shouldSendLow);
        console.log('After reset - Should send exhausted warning:', shouldSendExhausted);
        
        // Clean up
        await dbRun('DELETE FROM plans WHERE plan_id = ?', [planId]);
        console.log('Test plan deleted');
        
        console.log('Credit warning logic tests completed successfully!');
    } catch (error) {
        console.error('Error testing credit warnings:', error);
    }
}

// Only run the test if this file is executed directly
if (require.main === module) {
    testCreditWarnings().catch(console.error);
}

module.exports = { testCreditWarnings }; 