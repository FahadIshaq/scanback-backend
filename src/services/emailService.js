const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Send email with temporary password
   */
  async sendTempPasswordEmail(userEmail, userName, tempPassword) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'ScanBack <noreply@scanback.co.za>',
      to: userEmail,
      subject: 'Welcome to ScanBack - Your Temporary Password',
      html: this.getTempPasswordEmailTemplate(userName, tempPassword)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Temp password email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send temp password email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send item found notification
   */
  async sendItemFoundNotification(userEmail, userName, itemDetails, finderDetails) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'ScanBack <noreply@scanback.co.za>',
      to: userEmail,
      subject: `🎉 Great News! Your ${itemDetails.type === 'pet' ? 'Pet' : 'Item'} Has Been Found!`,
      html: this.getItemFoundEmailTemplate(userName, itemDetails, finderDetails)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Item found email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send item found email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send QR code scan notification
   */
  async sendScanNotification(userEmail, userName, qrCodeDetails, scanData) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'ScanBack <noreply@scanback.co.za>',
      to: userEmail,
      subject: `📱 Someone Scanned Your ${qrCodeDetails.type === 'pet' ? 'Pet' : 'Item'} Tag`,
      html: this.getScanNotificationEmailTemplate(userName, qrCodeDetails, scanData)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Scan notification email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send scan notification email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(userEmail, userName, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'ScanBack <noreply@scanback.co.za>',
      to: userEmail,
      subject: 'Verify Your ScanBack Email Address',
      html: this.getEmailVerificationTemplate(userName, verificationUrl)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email verification sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send email verification:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Temp password email template
   */
  getTempPasswordEmailTemplate(userName, tempPassword) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ScanBack</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6, #0f766e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .password-box { background: #1e293b; color: #fbbf24; padding: 20px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; }
          .button { display: inline-block; background: #14b8a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to ScanBack!</h1>
            <p>Your QR code stickers are ready to protect your valuables</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for joining ScanBack! Your account has been created successfully.</p>
            
            <p><strong>Your temporary password is:</strong></p>
            <div class="password-box">${tempPassword}</div>
            
            <p>Please use this password to log in and change it to something more secure.</p>
            
            <a href="${process.env.FRONTEND_URL}/auth/login" class="button">Login to Your Account</a>
            
            <h3>What's Next?</h3>
            <ul>
              <li>📱 Login with your email and temporary password</li>
              <li>🔐 Change your password to something secure</li>
              <li>🏷️ Create your first QR code stickers</li>
              <li>📧 Verify your email address</li>
            </ul>
            
            <p><strong>Important:</strong> This temporary password expires in 24 hours. Please change it as soon as possible.</p>
          </div>
          <div class="footer">
            <p>© 2025 ScanBack Technologies. All rights reserved.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Item found email template
   */
  getItemFoundEmailTemplate(userName, itemDetails, finderDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your ${itemDetails.type === 'pet' ? 'Pet' : 'Item'} Has Been Found!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .contact-box { background: #1e293b; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Great News!</h1>
            <p>Your ${itemDetails.type === 'pet' ? 'Pet' : 'Item'} Has Been Found!</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Someone found your ${itemDetails.type === 'pet' ? 'pet' : 'item'} and used your ScanBack tag to contact you!</p>
            
            <div class="info-box">
              <h3>${itemDetails.type === 'pet' ? '🐾 Pet Details' : '📱 Item Details'}</h3>
              <p><strong>Name:</strong> ${itemDetails.name}</p>
              ${itemDetails.description ? `<p><strong>Description:</strong> ${itemDetails.description}</p>` : ''}
              ${itemDetails.breed ? `<p><strong>Breed:</strong> ${itemDetails.breed}</p>` : ''}
              ${itemDetails.brand ? `<p><strong>Brand:</strong> ${itemDetails.brand}</p>` : ''}
            </div>
            
            <div class="contact-box">
              <h3>👤 Finder Contact Information</h3>
              <p><strong>Name:</strong> ${finderDetails.finderName}</p>
              <p><strong>Phone:</strong> ${finderDetails.finderPhone}</p>
              ${finderDetails.finderEmail ? `<p><strong>Email:</strong> ${finderDetails.finderEmail}</p>` : ''}
              <p><strong>Found Location:</strong> ${finderDetails.foundLocation}</p>
              ${finderDetails.notes ? `<p><strong>Notes:</strong> ${finderDetails.notes}</p>` : ''}
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>📞 Contact the finder using the information above</li>
              <li>📍 Arrange a meeting place to collect your ${itemDetails.type === 'pet' ? 'pet' : 'item'}</li>
              <li>✅ Update your ScanBack account once recovered</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">View in Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Scan notification email template
   */
  getScanNotificationEmailTemplate(userName, qrCodeDetails, scanData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Code Scanned</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📱 QR Code Scanned</h1>
            <p>Someone scanned your ${qrCodeDetails.type === 'pet' ? 'pet' : 'item'} tag</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Someone just scanned the QR code on your ${qrCodeDetails.type === 'pet' ? 'pet' : 'item'} tag.</p>
            
            <div class="info-box">
              <h3>${qrCodeDetails.type === 'pet' ? '🐾 Pet' : '📱 Item'} Information</h3>
              <p><strong>Name:</strong> ${qrCodeDetails.name}</p>
              <p><strong>Scanned at:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Location:</strong> ${scanData.location || 'Unknown'}</p>
            </div>
            
            <p>This could mean someone found your ${qrCodeDetails.type === 'pet' ? 'pet' : 'item'} and is trying to contact you. Check your dashboard for any messages or contact attempts.</p>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Check Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Email verification template
   */
  getEmailVerificationTemplate(userName, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Verify Your Email</h1>
            <p>Complete your ScanBack account setup</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Please verify your email address to complete your ScanBack account setup.</p>
            
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #64748b;">${verificationUrl}</p>
            
            <p><strong>Note:</strong> This verification link expires in 24 hours.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: this.from,
      to: email,
      subject: 'Password Reset - ScanBack',
      html: this.getPasswordResetEmailTemplate(resetUrl)
    };

    await this.transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
  }

  /**
   * Get password reset email template
   */
  getPasswordResetEmailTemplate(resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - ScanBack</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 2rem; font-weight: bold;">ScanBack</h1>
            <p style="color: #e2e8f0; margin: 0.5rem 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="padding: 2rem;">
            <h2 style="color: #1e293b; margin: 0 0 1rem 0;">Reset Your Password</h2>
            
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 1.5rem 0;">
              You requested to reset your password for your ScanBack account. Click the button below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 1rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1.1rem;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #64748b; line-height: 1.6; margin: 1.5rem 0 0 0;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #64748b; background: #f1f5f9; padding: 1rem; border-radius: 6px; margin: 0.5rem 0 0 0;">${resetUrl}</p>
            
            <p style="color: #64748b; line-height: 1.6; margin: 1.5rem 0 0 0;">
              <strong>Note:</strong> This reset link expires in 1 hour for security reasons.
            </p>
            
            <p style="color: #64748b; line-height: 1.6; margin: 1.5rem 0 0 0;">
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send QR activation email to existing user
   */
  async sendExistingUserQRActivationEmail(userEmail, userName, itemName, loginEmail) {
    const mailOptions = {
      from: this.from,
      to: userEmail,
      subject: 'New QR Code Activated - ScanBack',
      html: this.getExistingUserQRActivationEmailTemplate(userName, itemName, loginEmail)
    };

    await this.transporter.sendMail(mailOptions);
    console.log('Existing user QR activation email sent to:', userEmail);
  }

  /**
   * Get existing user QR activation email template
   */
  getExistingUserQRActivationEmailTemplate(userName, itemName, loginEmail) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New QR Code Activated - ScanBack</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 2rem; font-weight: bold;">ScanBack</h1>
            <p style="color: #e2e8f0; margin: 0.5rem 0 0 0;">New QR Code Activated</p>
          </div>
          
          <div style="padding: 2rem;">
            <h2 style="color: #1e293b; margin: 0 0 1rem 0;">Hello ${userName}!</h2>
            
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 1.5rem 0;">
              Great news! You've successfully activated a new QR code for <strong>"${itemName}"</strong>.
            </p>
            
            <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1.5rem 0;">
              <h3 style="color: #1e293b; margin: 0 0 0.5rem 0; font-size: 1.1rem;">Your Login Credentials</h3>
              <p style="color: #64748b; margin: 0; font-size: 0.9rem;">
                <strong>Email:</strong> ${loginEmail}<br>
                <strong>Password:</strong> Your existing password
              </p>
            </div>
            
            <p style="color: #64748b; line-height: 1.6; margin: 1.5rem 0;">
              You can now manage all your QR codes from your dashboard. This new QR code has been added to your account.
            </p>
            
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 1rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1.1rem;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #64748b; line-height: 1.6; margin: 1.5rem 0 0 0;">
              <strong>Note:</strong> If you don't remember your password, you can use the "Forgot Password" feature on the login page.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
