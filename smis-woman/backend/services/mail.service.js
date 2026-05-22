const nodemailer = require('nodemailer');

const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@woman-system.local';
const MAIL_HOST = process.env.MAIL_HOST || null;
const MAIL_PORT = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : 587;
const MAIL_USER = process.env.MAIL_USER || null;
const MAIL_PASS = process.env.MAIL_PASS || null;
const MAIL_SECURE = process.env.MAIL_SECURE === 'true';

let transporter = null;
if (MAIL_HOST && MAIL_USER && MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  });
}

const sendMail = async ({ to, subject, text, html }) => {
  const payload = {
    from: MAIL_FROM,
    to,
    subject,
    text,
    html
  };

  if (!transporter) {
    console.log('[MAIL FALLBACK]', 'No SMTP configured. Email payload:', payload);
    return {
      success: true,
      message: 'Email prepared but SMTP is not configured. Check MAIL_HOST, MAIL_USER, MAIL_PASS.'
    };
  }

  await transporter.sendMail(payload);
  return { success: true, message: 'Email sent successfully.' };
};

const sendResolutionEmail = async ({ to, name, workOrderId, title, resolution }) => {
  const payloadText = `Hello ${name},\n\nYour ticket ${workOrderId} has been closed.\n\nTitle: ${title}\nResolution: ${resolution || 'Resolved by technician head.'}\n\nThank you.`;

  return await sendMail({
    to,
    subject: `Resolution for ${workOrderId}`,
    text: payloadText,
    html: `<p>Hello ${name},</p><p>Your ticket <strong>${workOrderId}</strong> has been closed.</p><p><strong>Title:</strong> ${title}</p><p><strong>Resolution:</strong> ${resolution || 'Resolved by technician head.'}</p><p>Thank you.</p>`
  });
};

module.exports = {
  sendMail,
  sendResolutionEmail
};