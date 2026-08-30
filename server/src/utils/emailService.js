const nodemailer = require('nodemailer');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async ({ email, otp, name = 'SetuCare user' }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[EmailService] SMTP is not configured. OTP email was not sent.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'SetuCare verification code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">SetuCare verification</h2>
          <p>Hello ${name},</p>
          <p>Your one-time password is:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #0d9488;">${otp}</div>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send OTP email:', error);
    return false;
  }
};

module.exports = {
  generateOtp,
  sendOtpEmail,
};
