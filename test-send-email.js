/**
 * Test Email Sending Script
 * 
 * This script tests sending an email using the updated email service configuration.
 */

const { defaultEmailService } = require('./utils/emailService');
const { logger } = require('./utils/fileLogger');
const dotenv = require('dotenv');

dotenv.config();

async function testSendEmail() {
  try {
    console.log('Sending test email...');
    const result = await defaultEmailService.sendEmail({
      to: process.env.TEST_EMAIL || process.env.EMAIL_USER,
      subject: 'Test Email - Fixed Configuration',
      text: 'This is a test email sent with the fixed email service configuration.'
    });
    
    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testSendEmail().catch(console.error); 