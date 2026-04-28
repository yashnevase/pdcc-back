const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Email configuration from environment variables
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
};

// From email address
const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER;

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransport(EMAIL_CONFIG);
};

// Generate random password
const generatePassword = (length = 10) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    
    // Ensure password has at least one number and one special char
    if (!/\d/.test(password)) {
        password = password.slice(0, -1) + Math.floor(Math.random() * 10);
    }
    if (!/[!@#$%^&*]/.test(password)) {
        password = password.slice(0, -1) + '!';
    }
    
    return password;
};

// Send contractor credentials email
const sendContractorCredentials = async (contractorEmail, password, contractorName, loginUrl) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: FROM_EMAIL,
            to: contractorEmail,
            subject: 'Your Contractor Login Credentials - IWMS Zilla Parishad',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
                        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .credentials { background-color: white; padding: 20px; margin: 20px 0; border-left: 4px solid #1e40af; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                        .warning { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to IWMS Zilla Parishad</h1>
                        </div>
                        <div class="content">
                            <p>Dear ${contractorName || 'Contractor'},</p>
                            
                            <p>Your contractor account has been created successfully. Below are your login credentials:</p>
                            
                            <div class="credentials">
                                <p><strong>Email/Username:</strong> ${contractorEmail}</p>
                                <p><strong>Temporary Password:</strong> <code style="background-color: #f3f4f6; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${password}</code></p>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
                            </div>
                            
                            <p>Click the button below to access the login page:</p>
                            
                            <a href="${loginUrl}" class="button">Login to Your Account</a>
                            
                            <p>Or copy and paste this link in your browser:<br>
                            <a href="${loginUrl}">${loginUrl}</a></p>
                            
                            <p>If you have any questions or need assistance, please contact the administrator.</p>
                            
                            <p>Best regards,<br>
                            IWMS Zilla Parishad Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>&copy; ${new Date().getFullYear()} IWMS Zilla Parishad. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Contractor credentials email sent to ${contractorEmail}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        logger.error(`Failed to send contractor credentials email to ${contractorEmail}:`, error);
        throw error;
    }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: FROM_EMAIL,
            to: email,
            subject: 'Password Reset Request - IWMS Zilla Parishad',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
                        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                        .warning { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            
                            <p>We received a request to reset your password. Click the button below to reset it:</p>
                            
                            <a href="${resetUrl}" class="button">Reset Password</a>
                            
                            <p>Or copy and paste this link in your browser:<br>
                            <a href="${resetUrl}">${resetUrl}</a></p>
                            
                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
                            </div>
                            
                            <p>Best regards,<br>
                            IWMS Zilla Parishad Team</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>&copy; ${new Date().getFullYear()} IWMS Zilla Parishad. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Password reset email sent to ${email}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        logger.error(`Failed to send password reset email to ${email}:`, error);
        throw error;
    }
};

module.exports = {
    generatePassword,
    sendContractorCredentials,
    sendPasswordResetEmail
};
