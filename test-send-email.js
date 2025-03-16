/**
 * Test Email Sending Script
 * 
 * This script tests sending an email using the updated email service configuration.
 */

const { defaultEmailService } = require('./utils/emailService');
const { logger } = require('./utils/fileLogger');

async function testSendEmail() {
  try {
    console.log('Sending test email...');
    const result = await defaultEmailService.sendEmail({
      to: 'bschoolland@gmail.com',
      subject: 'Test Email - Fixed Configuration',
      text: 'This is a test email sent with the fixed email service configuration.'
    });
    
    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testSendEmail().catch(console.error); 