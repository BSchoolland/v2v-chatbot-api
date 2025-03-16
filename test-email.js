/**
 * Email Connection Test Script
 * 
 * This script tests the email connection and logs detailed information about any errors.
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

async function testEmailConnection() {
  console.log('Testing email connection with the following settings:');
  console.log(`Host: ${process.env.EMAIL_HOST}`);
  console.log(`Port: ${process.env.EMAIL_PORT}`);
  console.log(`Secure: ${process.env.EMAIL_SECURE}`);
  console.log(`User: ${process.env.EMAIL_USER}`);
  
  // Create transporter with debug enabled
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // Try with explicit false first
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    debug: true, // Enable debug output
    logger: true // Log to console
  });

  try {
    console.log('Verifying connection...');
    const result = await transporter.verify();
    console.log('Connection successful:', result);
    
    // Try sending a test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'bschoolland@gmail.com', // Use the same recipient from the error log
      subject: 'Test Email',
      text: 'This is a test email to verify the connection.'
    });
    
    console.log('Email sent successfully:', info);
  } catch (error) {
    console.error('Error:', error);
    
    // Try with different TLS settings
    console.log('\nRetrying with explicit TLS settings...');
    const transporterWithTLS = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      debug: true,
      logger: true
    });
    
    try {
      const result = await transporterWithTLS.verify();
      console.log('Connection with TLS settings successful:', result);
      
      // Try sending a test email with TLS settings
      const info = await transporterWithTLS.sendMail({
        from: process.env.EMAIL_FROM,
        to: 'bschoolland@gmail.com',
        subject: 'Test Email with TLS Settings',
        text: 'This is a test email to verify the connection with TLS settings.'
      });
      
      console.log('Email with TLS settings sent successfully:', info);
    } catch (tlsError) {
      console.error('Error with TLS settings:', tlsError);
      
      // Try with SSL (port 465)
      console.log('\nRetrying with SSL settings (port 465)...');
      const transporterWithSSL = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        debug: true,
        logger: true
      });
      
      try {
        const result = await transporterWithSSL.verify();
        console.log('Connection with SSL settings successful:', result);
        
        // Try sending a test email with SSL settings
        const info = await transporterWithSSL.sendMail({
          from: process.env.EMAIL_FROM,
          to: 'bschoolland@gmail.com',
          subject: 'Test Email with SSL Settings',
          text: 'This is a test email to verify the connection with SSL settings.'
        });
        
        console.log('Email with SSL settings sent successfully:', info);
      } catch (sslError) {
        console.error('Error with SSL settings:', sslError);
      }
    }
  }
}

testEmailConnection().catch(console.error); 