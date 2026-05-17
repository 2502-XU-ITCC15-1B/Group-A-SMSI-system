require('dotenv').config();
const nodemailer = require('nodemailer');

// ============================================================
// NODEMAILER TRANSPORTER (Mailtrap SMTP)
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
  port: process.env.MAIL_PORT || 2525,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ============================================================
// SEND RESOLUTION EMAIL
// ============================================================
const sendResolutionEmail = async ({ to, name, workOrderId, title, resolution }) => {
  try {
    const mailOptions = {
      from: 'noreply@womantickets.com',
      to,
      subject: `[${workOrderId}] Your Ticket Has Been Resolved`,
      html: `
        <h2>Ticket Resolution Notice</h2>
        <p>Hello ${name},</p>
        <p>Your support ticket has been resolved:</p>
        <p>
          <strong>Work Order ID:</strong> ${workOrderId}<br/>
          <strong>Title:</strong> ${title}
        </p>
        <p>
          <strong>Resolution:</strong><br/>
          ${resolution || 'Your issue has been resolved by our technical team.'}
        </p>
        <p>If you have any further questions, please reply to this email or submit a new ticket.</p>
        <p>Thank you for using our support system.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] Resolution email sent to ${to}:`, info.response);

    return {
      success: true,
      message: 'Resolution email sent successfully.'
    };
  } catch (err) {
    console.error(`[MAIL ERROR] Failed to send resolution email to ${to}:`, err.message);
    return {
      success: false,
      message: 'Failed to send email.',
      error: err.message
    };
  }
};

// ============================================================
// SEND FORGOT PASSWORD EMAIL
// ============================================================
const sendForgotPasswordEmail = async ({ to, name, resetToken }) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-confirmation.html?token=${resetToken}`;

    const mailOptions = {
      from: 'noreply@womantickets.com',
      to,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>You have requested a password reset. Click the link below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
        <p><strong>This link will expire in 30 minutes.</strong></p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <p>Thank you.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] Forgot password email sent to ${to}:`, info.response);

    return {
      success: true,
      message: 'Password reset email sent successfully.'
    };
  } catch (err) {
    console.error(`[MAIL ERROR] Failed to send password reset email to ${to}:`, err.message);
    return {
      success: false,
      message: 'Failed to send email.',
      error: err.message
    };
  }
};

// ============================================================
// SEND PASSWORD RESET CONFIRMATION EMAIL
// ============================================================
const sendPasswordResetConfirmation = async ({ to, name }) => {
  try {
    const mailOptions = {
      from: 'noreply@womantickets.com',
      to,
      subject: 'Password Reset Successful',
      html: `
        <h2>Password Reset Confirmation</h2>
        <p>Hello ${name},</p>
        <p>Your password has been successfully reset. You can now log in with your new password.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p>Thank you.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[MAIL] Password reset confirmation sent to ${to}:`, info.response);

    return {
      success: true,
      message: 'Confirmation email sent successfully.'
    };
  } catch (err) {
    console.error(`[MAIL ERROR] Failed to send confirmation email to ${to}:`, err.message);
    return {
      success: false,
      message: 'Failed to send email.',
      error: err.message
    };
  }
};

module.exports = {
  sendResolutionEmail,
  sendForgotPasswordEmail,
  sendPasswordResetConfirmation
};