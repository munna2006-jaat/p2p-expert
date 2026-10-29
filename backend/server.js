require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { sendOtpEmail } = require('./mailer');

const app = express();
const registerApp = express();

const PORT_MAIN = parseInt(process.env.PORT_MAIN || process.env.PORT || '3000', 10);
const PORT_REGISTER = parseInt(process.env.PORT_REGISTER || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

registerApp.use(cors());
registerApp.use(express.json());
registerApp.use(express.urlencoded({ extended: true }));

// Path definitions
const MAIN_SITE_DIR = path.join(__dirname, '../main-site');
const REGISTER_SITE_DIR = path.join(__dirname, '../registration-site');

// Helper to validate email
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ----------------- AUTH API ROUTES -----------------
const router = express.Router();

// System Status & Config info
router.get('/status', (req, res) => {
  const isSmtpReady = Boolean(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    !process.env.SMTP_USER.includes('your-email') &&
    !process.env.SMTP_PASS.includes('your-app-password')
  );

  res.json({
    status: 'online',
    appName: process.env.APP_NAME || 'p2p-expert',
    smtpConfigured: isSmtpReady,
    smtpUser: isSmtpReady ? process.env.SMTP_USER : 'Not configured (Mock mode active)',
    mainSiteUrl: process.env.MAIN_SITE_URL || `http://localhost:${PORT_MAIN}`,
    registerSiteUrl: process.env.REGISTER_SITE_URL || `http://localhost:${PORT_REGISTER}`
  });
});

// Step 1: Send OTP for Registration
router.post('/register-send-otp', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Gmail / email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please go to the main login portal.'
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in DB with password waiting for confirmation
    db.saveOtp(email, otp, password, 10);

    // Send email via Gmail SMTP (or fallback logger)
    const emailResult = await sendOtpEmail(email, otp);

    return res.json({
      success: true,
      message: `Verification code sent to ${email}`,
      email: email.trim().toLowerCase(),
      mode: emailResult.mode
    });
  } catch (error) {
    console.error('Error in /register-send-otp:', error);
    res.status(500).json({ success: false, message: 'Server error while generating OTP: ' + error.message });
  }
});

// Step 2: Verify OTP and finalize registration
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const verification = db.verifyOtp(email, otp);

    if (!verification.success) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    // Create user in database
    const newUser = db.createUser({
      email: email.trim().toLowerCase(),
      password: verification.tempPassword
    });

    const mainSiteUrl = process.env.MAIN_SITE_URL || `http://localhost:${PORT_MAIN}`;

    return res.json({
      success: true,
      message: 'Registration successful! Your trader account has been created.',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      },
      mainSiteUrl: mainSiteUrl
    });
  } catch (error) {
    console.error('Error in /verify-otp:', error);
    res.status(500).json({ success: false, message: 'Error verifying OTP: ' + error.message });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    // Check if there was a pending registration
    const otps = require('./db');
    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // We update with null password or keep existing password from previous save
    db.saveOtp(email, otp, null, 10);

    const emailResult = await sendOtpEmail(email, otp);

    res.json({
      success: true,
      message: `A fresh OTP has been sent to ${email}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Main Login Route (Used by main-site "Trader's account login")
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email and password.' });
    }

    const user = db.verifyCredentials(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please check your credentials or register first.'
      });
    }

    return res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ success: false, message: 'Server login error: ' + error.message });
  }
});

// Mount API on both apps
app.use('/api/auth', router);
registerApp.use('/api/auth', router);

// Anti-caching middleware so browsers and CDNs never serve stale 304 cached files
const noCacheMiddleware = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};

app.use(noCacheMiddleware);
registerApp.use(noCacheMiddleware);

// Smart Subdomain Routing (for Render / custom domains like register.yourdomain.com)
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host || '';
  if (host.startsWith('register.') || host.startsWith('reg.')) {
    return express.static(REGISTER_SITE_DIR, { etag: false })(req, res, next);
  }
  next();
});

// Serve static frontend files
const staticOpts = { etag: false, lastModified: false };
app.use('/register', express.static(REGISTER_SITE_DIR, staticOpts));
app.use('/registration', express.static(REGISTER_SITE_DIR, staticOpts));
app.use(express.static(MAIN_SITE_DIR, staticOpts));
registerApp.use(express.static(REGISTER_SITE_DIR, staticOpts));

// Start servers
const mainServer = app.listen(PORT_MAIN, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [p2p-expert Main Login Website] running on:`);
  console.log(`👉 http://localhost:${PORT_MAIN}`);
  console.log(`======================================================\n`);
});

let registerServer;
if (PORT_REGISTER !== PORT_MAIN) {
  registerServer = registerApp.listen(PORT_REGISTER, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ [p2p-expert Registration Website (Subdomain)] running on:`);
    console.log(`👉 http://localhost:${PORT_REGISTER}`);
    console.log(`======================================================\n`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  mainServer.close();
  if (registerServer) registerServer.close();
});

module.exports = { app, registerApp };
