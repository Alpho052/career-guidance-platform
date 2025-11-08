const nodemailer = require('nodemailer');

// Mock email service for development
let emailEnabled = false;
let transporter = null;

// Only initialize email if credentials are provided
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    emailEnabled = true;
    console.log('✅ Email service configured');
  } catch (error) {
    console.log('⚠️ Email service configuration failed');
  }
} else {
  console.log('📧 Email service disabled - running in development mode');
}

// Send verification email
const sendVerificationEmail = async (email, verificationCode) => {
  console.log(`📧 Verification code for ${email}: ${verificationCode}`);
  
  if (!emailEnabled || !transporter) {
    console.log(`🔑 Development mode - Use this code to verify: ${verificationCode}`);
    return true;
  }

  try {
    const mailOptions = {
      from: `"Career Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification - Career Platform Lesotho',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #2c5aa0; text-align: center;">Email Verification</h2>
          <p>Hello,</p>
          <p>Thank you for registering with <strong>Career Platform Lesotho</strong>!</p>
          <p>Your verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #2c5aa0; letter-spacing: 5px;">
              ${verificationCode}
            </span>
          </div>
          <p>Enter this code on the verification page to complete your registration.</p>
          <p style="color: #666; font-size: 14px;">This code will expire in 24 hours.</p>
          <br>
          <p>Best regards,<br><strong>Career Platform Team</strong></p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to: ${email}`);
    return true;
  } catch (error) {
    console.log(`⚠️ Email sending failed - use this code: ${verificationCode}`);
    return true; // Don't fail registration because of email
  }
};

module.exports = { 
  sendVerificationEmail
};