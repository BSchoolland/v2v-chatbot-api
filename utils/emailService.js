/**
 * Email Service Module
 * 
 * A reusable module for sending emails that can be imported into other projects.
 * Provides a clean abstraction over Nodemailer with configurable options.
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const { logger } = require('./fileLogger.js');

dotenv.config();  

/**
 * EmailService class for sending emails
 */
class EmailService {
  /**
   * Create an email service instance
   * 
   * @param {Object} config - Configuration object
   * @param {string} config.host - SMTP host
   * @param {number} config.port - SMTP port
   * @param {boolean} config.secure - Whether to use TLS (true for 465, false for other ports)
   * @param {Object} config.auth - Authentication details
   * @param {string} config.auth.user - SMTP username
   * @param {string} config.auth.pass - SMTP password
   * @param {Object} [config.tls] - TLS options
   * @param {boolean} [config.debug] - Enable debug mode
   * @param {string} [config.defaultFrom] - Default sender email address
   */
  constructor(config) {
    this.config = config;
    this.defaultFrom = config.defaultFrom || config.auth.user;
    
    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      },
      tls: config.tls || { rejectUnauthorized: false },
      debug: config.debug || false
    });
  }

  /**
   * Send an email
   * 
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address(es), comma separated for multiple
   * @param {string} options.subject - Email subject
   * @param {string} [options.text] - Plain text email body
   * @param {string} [options.html] - HTML email body
   * @param {string} [options.from] - Sender email address (defaults to config.defaultFrom)
   * @param {Array<Object>} [options.attachments] - Array of attachment objects
   * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
   */
  async sendEmail(options) {
    if (!options.to) {
      throw new Error('Recipient (to) is required');
    }
    
    if (!options.subject) {
      throw new Error('Subject is required');
    }
    
    if (!options.text && !options.html) {
      throw new Error('Either text or html content is required');
    }
    logger.info('Sending email to:', options.to);

    const mailOptions = {
      from: options.from || this.defaultFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments
    };

    try {
      return await this.transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Verify SMTP connection configuration
   * 
   * @returns {Promise<Object>} - Promise resolving to verification result
   */
  async verifyConnection() {
    try {
      return await this.transporter.verify();
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      throw error;
    }
  }
}

/**
 * Create a preconfigured email service for Visions to Visuals
 * 
 * @returns {EmailService} - Configured email service instance
 */
function createVisionsToVisualsEmailService() {
  return new EmailService({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: process.env.NODE_ENV === 'development',
    defaultFrom: process.env.EMAIL_FROM
  });
}
// a singleton instance of the email service, useful for sending emails easily
const defaultEmailService = createVisionsToVisualsEmailService();


/**
 * Send a verification email
 * @param {string} email - The email address to send the verification email to
 * @param {string} token - The token to include in the verification email
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendVerificationEmail(email, token) {
  const html = `
  <h1>Verify your email</h1>
  <p>Click the link below to verify your email</p>
  <a href="${process.env.FRONTEND_URL}/verify/${token}">Verify email</a>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: 'Visions to Visuals - Verify your email', html });
}

/**
 * Send a password reset email
 * @param {string} email - The email address to send the password reset email to
 * @param {string} token - The token to include in the password reset email
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendPasswordResetEmail(email, token) {
  const html = `
  <h1>Reset your password</h1>
  <p>We received a request to reset your password. If you did not make this request, you can safely ignore this email.</p>
  <p>Click the link below to reset your password</p>
  <a href="${process.env.FRONTEND_URL}/reset-password/${token}">Reset password</a>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: 'Visions to Visuals - Reset your password', html });
}

/**
 * Send a credits half warning email
 * @param {string} email - The email address to send the credits half warning email to
 * @param {string} websiteName - The name of the website to include in the credits half warning email
 * @param {string} renewalDate - The date of the next renewal
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendCreditsHalfWarningEmail(email, websiteName, renewalDate) {
  const html = `
  <h1>Credits half gone for this month</h1>
  <p>You have half of your credits remaining for this month. </p>
  <p>Your website's visitors are really enjoying your chatbot on ${websiteName}!  However, you might want to consider upgrading to a higher plan or purchasing additional credits to make sure you don't run out.</p>
  <p>You can upgrade to a higher plan or purchase additional credits <a href="${process.env.FRONTEND_URL}/dashboard">here</a>.</p>
  <p>Credits will automatically be refilled on ${renewalDate}.</p>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: 'Visions to Visuals - Half credits remaining', html });
}

/**
 * Send a credits low warning email
 * @param {string} email - The email address to send the credits low warning email to
 * @param {string} websiteName - The name of the website to include in the credits low warning email
 * @param {number} credits - The number of credits remaining
 * @param {string} renewalDate - The date of the next renewal
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendCreditsLowWarningEmail(email, websiteName, credits, renewalDate) {
  const html = `
  <h1>Credits low warning</h1>
  <p>You have ${credits} credits remaining for this month and your chatbot will stop working if you run out!  Please consider upgrading to a higher plan or purchasing additional credits.</p>
  <p>You can upgrade to a higher plan or purchase additional credits <a href="${process.env.FRONTEND_URL}/dashboard">here</a>.</p>
  <p>If you have any questions, please don't hesitate to <a href="${process.env.FRONTEND_URL}/contact">contact us</a>.</p>
  <p>Credits will automatically be refilled on ${renewalDate}.</p>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: 'Visions to Visuals - Credits low warning', html });
}

/**
 * Send a credits exhausted email
 * @param {string} email - The email address to send the credits exhausted email to
 * @param {string} websiteName - The name of the website to include in the credits exhausted email
 * @param {string} renewalDate - The date of the next renewal
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendCreditsExhaustedEmail(email, websiteName, renewalDate) {
  const html = `
  <h1>All credits exhausted</h1>
  <p>You have <strong>no credits remaining for this month</strong>.  Unfortunately, your chatbot has been disabled until ${renewalDate}.</p>
  <p>We'd love to get you back up and running as soon as possible.  Please consider upgrading to a higher plan or making a one-time purchase of 1000 credits.  You can do so <a href="${process.env.FRONTEND_URL}/dashboard">here</a> and your chatbot will be enabled again immediately!</p>
  <p>If you have any questions, please don't hesitate to <a href="${process.env.FRONTEND_URL}/contact">contact us</a>.</p>
  <p>Credits will automatically be refilled on ${renewalDate}.</p>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: `IMPORTANT: Your chatbot on ${websiteName} has been disabled`, html });
}

/**
 * Send a password reset success email
 * @param {string} email - The email address to send the password reset success email to
 * @returns {Promise<Object>} - Promise resolving to the info object from Nodemailer
 */
function sendPasswordResetSuccessEmail(email) {
  const html = `
  <h1>Password reset successful</h1>
  <p>Your password has been reset successfully.  If you did not make this request, please contact us immediately.</p>
  `;
  return defaultEmailService.sendEmail({ to: email, subject: 'Password reset successful', html });
}

module.exports = {
  defaultEmailService,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendCreditsHalfWarningEmail,
  sendCreditsLowWarningEmail,
  sendCreditsExhaustedEmail,
  sendPasswordResetSuccessEmail
}; 