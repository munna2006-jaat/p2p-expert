const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user.includes('your-email') || pass.includes('your-app-password')) {
    return null;
  }

  const cleanUser = user.trim();
  const cleanPass = pass.replace(/\s+/g, '');

  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: secure,
    auth: {
      user: cleanUser,
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

async function sendOtpEmail(email, otp) {
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'p2p-expert';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .header { background: #1e2430; padding: 28px 24px; text-align: center; }
        .logo-text { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
        .tagline { color: #94a3b8; font-size: 13px; margin-top: 4px; }
        .content { padding: 32px 28px; text-align: center; }
        .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
        .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 10px 0 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', monospace; }
        .timer-notice { font-size: 13px; color: #e11d48; font-weight: 600; margin-bottom: 24px; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-text">⚡ ${appName}</div>
          <div class="tagline">Trader Verification Portal</div>
        </div>
        <div class="content">
          <span class="badge">Registration OTP</span>
          <h1 class="title">Verification Code</h1>
          <p class="subtitle">Use the one-time code below to verify your email address and activate your trader account.</p>
          <div class="otp-box">
            <span class="otp-code">${otp}</span>
          </div>
          <p class="timer-notice">⏱️ This code will expire in 10 minutes</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 10px;">If you did not request this registration, please ignore this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. Secure Trader Network.
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n==================================================');
    console.log('📧 [MOCK SMTP MODE - NO CREDENTIALS CONFIGURED]');
    console.log(`➡️  To: ${email}`);
    console.log(`🔐  OTP CODE: ${otp}`);
    console.log('💡  To send real Gmail emails, set SMTP_USER and SMTP_PASS in the .env file.');
    console.log('==================================================\n');
    return {
      sent: true,
      mode: 'mock',
      message: 'OTP generated and logged to server console (SMTP credentials pending in .env)',
      otp: otp // returned in mock mode for instant developer convenience
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `[${otp}] Your ${appName} Verification Code`,
      text: `Your ${appName} verification code is: ${otp}. It is valid for 10 minutes.`,
      html: htmlContent
    });

    console.log(`✅ Real Email sent successfully to ${email}. Message ID: ${info.messageId}`);
    return {
      sent: true,
      mode: 'real',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending email via SMTP:', error);
    // Fallback so user can still test even if SMTP throws authentication error
    console.log(`⚠️  FALLBACK OTP for ${email}: ${otp}`);
    return {
      sent: false,
      mode: 'error_fallback',
      error: error.message,
      otp: otp
    };
  }
}

module.exports = {
  sendOtpEmail
};
