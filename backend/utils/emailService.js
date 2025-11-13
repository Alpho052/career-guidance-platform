// utils/emailservices.js
const sgMail = require('@sendgrid/mail');

// Set your SendGrid API key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendVerificationEmail = async (email, verificationCode) => {
  console.log(`📧 Sending verification code to ${email}...`);

  // Construct the email
  const msg = {
    to: email,
    from: 'no-reply@careerplatform.com', // must be verified in SendGrid
    subject: 'Verify Your Email - Career Platform Lesotho',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2c5aa0;">Verify Your Email</h2>
        <p>Thank you for joining <strong>Career Platform Lesotho</strong>!</p>
        <p>Your verification code is:</p>
        <div style="text-align:center;margin:30px 0;">
          <span style="font-size:32px;font-weight:bold;color:#2c5aa0;">${verificationCode}</span>
        </div>
        <p>Please enter this code on the website to verify your account.</p>
        <br>
        <p>Best regards,<br><strong>Career Platform Team</strong></p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Verification email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send verification email to ${email}:`, error.response?.body || error.message);
    return false; // Don't fail registration if email fails
  }
};

module.exports = { sendVerificationEmail };
