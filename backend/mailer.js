const nodemailer = require('nodemailer');

function getSmtpConfig() {
  let dbSettings = {};
  try {
    const db = require('./db');
    dbSettings = db.getSettings() || {};
  } catch (e) {}

  const rawUser = process.env.SMTP_USER || dbSettings.smtpUser || 'p2pexpertregistration@gmail.com';
  const rawPass = process.env.SMTP_PASS || dbSettings.smtpPass || 'bdne kakd pctf csju';
  const rawHost = process.env.SMTP_HOST || dbSettings.smtpHost || 'smtp.gmail.com';

  const user = rawUser.trim();
  const pass = rawPass.replace(/\s+/g, '');
  const host = rawHost.trim();

  return { user, pass, host };
}

async function sendOtpEmail(email, otp) {
  const { user, pass, host } = getSmtpConfig();
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

  // 1. Try Brevo HTTP API (Port 443 - works 100% on Render/Voroa free tier)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: appName, email: user },
          to: [{ email: email }],
          subject: `[${otp}] Your ${appName} Verification Code`,
          htmlContent: htmlContent
        })
      });
      if (res.ok) {
        console.log(`✅ Email sent via Brevo HTTP API to ${email}`);
        return { sent: true, mode: 'brevo_http' };
      }
    } catch (err) {
      console.error('Brevo API request failed:', err.message);
    }
  }

  // 2. Try Resend HTTP API (Port 443)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${appName} <onboarding@resend.dev>`,
          to: [email],
          subject: `[${otp}] Your ${appName} Verification Code`,
          html: htmlContent
        })
      });
      if (res.ok) {
        console.log(`✅ Email sent via Resend HTTP API to ${email}`);
        return { sent: true, mode: 'resend_http' };
      }
    } catch (err) {
      console.error('Resend API request failed:', err.message);
    }
  }

  // 3. Try Gmail SMTP Port 465 (SSL)
  try {
    console.log(`📡 Connecting to Gmail SMTP port 465 for ${email}...`);
    const transporter465 = nodemailer.createTransport({
      host: host,
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000
    });

    const info = await transporter465.sendMail({
      from: `"${appName}" <${user}>`,
      to: email,
      subject: `[${otp}] Your ${appName} Verification Code`,
      text: `Your ${appName} verification code is: ${otp}. It is valid for 10 minutes.`,
      html: htmlContent
    });

    console.log(`✅ Real Email sent successfully via Port 465 to ${email}. ID: ${info.messageId}`);
    return { sent: true, mode: 'real_465', messageId: info.messageId };

  } catch (err465) {
    console.log(`⚠️ Port 465 failed (${err465.message}). Retrying with Port 587 STARTTLS...`);

    // 4. Retry with Gmail SMTP Port 587 (STARTTLS)
    try {
      const transporter587 = nodemailer.createTransport({
        host: host,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000
      });

      const info587 = await transporter587.sendMail({
        from: `"${appName}" <${user}>`,
        to: email,
        subject: `[${otp}] Your ${appName} Verification Code`,
        text: `Your ${appName} verification code is: ${otp}. It is valid for 10 minutes.`,
        html: htmlContent
      });

      console.log(`✅ Real Email sent successfully via Port 587 to ${email}. ID: ${info587.messageId}`);
      return { sent: true, mode: 'real_587', messageId: info587.messageId };

    } catch (err587) {
      console.error(`❌ Both SMTP ports 465 and 587 failed: ${err587.message}`);
      return {
        sent: false,
        mode: 'error_fallback',
        error: err587.message,
        otp: otp
      };
    }
  }
}

module.exports = {
  sendOtpEmail
};
