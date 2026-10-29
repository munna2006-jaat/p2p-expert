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

// Helper to determine the true public Base URL
function getBaseUrl(req) {
  if (process.env.MAIN_SITE_URL && !process.env.MAIN_SITE_URL.includes('localhost:')) {
    return process.env.MAIN_SITE_URL;
  }
  const host = req.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `http://localhost:${PORT_MAIN}`;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  // Strip register. or reg. subdomain
  const cleanHost = host.replace(/^(register|reg)\./i, '');
  return `${proto}://${cleanHost}`;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

registerApp.use(cors());
registerApp.use(express.json({ limit: '25mb' }));
registerApp.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Path definitions
const MAIN_SITE_DIR = path.join(__dirname, '../main-site');
const REGISTER_SITE_DIR = path.join(__dirname, '../registration-site');
const ADMIN_SITE_DIR = path.join(__dirname, '../admin-site');

// Helper to validate email
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ----------------- API ROUTES -----------------
const router = express.Router();

// System Status & Config info
router.get('/status', (req, res) => {
  const isSmtpReady = Boolean(
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    !process.env.SMTP_USER.includes('your-email') &&
    !process.env.SMTP_PASS.includes('your-app-password')
  );

  const baseUrl = getBaseUrl(req);

  res.json({
    status: 'online',
    appName: process.env.APP_NAME || 'p2p-expert',
    smtpConfigured: isSmtpReady,
    smtpUser: isSmtpReady ? process.env.SMTP_USER : 'Not configured (Mock mode active)',
    mainSiteUrl: baseUrl,
    registerSiteUrl: process.env.REGISTER_SITE_URL || `${baseUrl}/register`
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

    // Send email via Gmail SMTP
    const emailResult = await sendOtpEmail(email, otp);

    return res.json({
      success: true,
      message: `Verification code sent to ${email}`,
      email: email.trim().toLowerCase()
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

    const mainSiteUrl = getBaseUrl(req);

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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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

// ----------------- PAYMENT / USDT DEPOSIT ROUTES -----------------

// Public config for USDT deposit screen (dynamic wallet addresses & amount)
router.get('/payment/config', (req, res) => {
  const settings = db.getSettings();
  res.json({
    success: true,
    usdtAmount: settings.usdtAmount || '2000',
    trc20Address: settings.trc20Address,
    bep20Address: settings.bep20Address,
    trc20QrImage: settings.trc20QrImage || '',
    bep20QrImage: settings.bep20QrImage || ''
  });
});

// User submits deposit proof / payment confirmation
router.post('/deposit/submit', (req, res) => {
  try {
    const { email, network, amount, walletAddress, txHash } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Trader email is required.' });
    }

    const deposit = db.createDeposit({
      email,
      network: network || 'TRC20',
      amount: amount || '2000',
      walletAddress,
      txHash: txHash || ''
    });

    console.log(`📥 New USDT Deposit submitted: ${deposit.amount} USDT (${deposit.network}) by ${deposit.userEmail} [ID: ${deposit.id}]`);

    res.json({
      success: true,
      message: 'Deposit submitted successfully. Verification in progress.',
      deposit
    });
  } catch (err) {
    console.error('Error in /deposit/submit:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Real-time polling for deposit verification status
router.get('/deposit/status/:id', (req, res) => {
  try {
    const deposit = db.getDepositById(req.params.id);
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }

    res.json({
      success: true,
      id: deposit.id,
      status: deposit.status, // 'pending' | 'approved' | 'rejected'
      rejectionReason: deposit.rejectionReason || '', // e.g. "Your USDT is Flash"
      amount: deposit.amount,
      network: deposit.network,
      walletAddress: deposit.walletAddress,
      createdAt: deposit.createdAt,
      updatedAt: deposit.updatedAt
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------- ADMIN PANEL ROUTES -----------------

// Admin Login
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const check = db.verifyAdmin(username, password);
    if (!check.success) {
      return res.status(401).json({ success: false, message: check.message });
    }

    // Generate simple bearer token
    const token = 'adm_' + Buffer.from(`${check.username}:${Date.now()}`).toString('base64');

    return res.json({
      success: true,
      message: 'Admin authenticated successfully',
      token,
      username: check.username
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get all deposits
router.get('/admin/deposits', (req, res) => {
  try {
    const deposits = db.getDeposits();
    res.json({ success: true, deposits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Action on deposit (Approve or Reject/Cancel as Flash USDT)
router.post('/admin/deposit/action', (req, res) => {
  try {
    const { depositId, action, reason } = req.body;

    if (!depositId || !action) {
      return res.status(400).json({ success: false, message: 'depositId and action are required.' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const finalReason = action === 'reject' ? (reason || 'Your USDT is Flash') : '';

    const result = db.updateDepositStatus(depositId, status, finalReason);

    if (!result.success) {
      return res.status(404).json(result);
    }

    console.log(`⚖️ Admin action: Deposit [${depositId}] set to ${status.toUpperCase()} ${finalReason ? `(${finalReason})` : ''}`);

    res.json({
      success: true,
      message: `Deposit ${status} successfully`,
      deposit: result.deposit
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get settings (wallet addresses, amount, credentials)
router.get('/admin/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    // Don't send raw admin password to client
    const { adminPassword, ...safeSettings } = settings;
    res.json({ success: true, settings: safeSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get live active OTPs
router.get('/admin/otps', (req, res) => {
  try {
    const otps = db.getActiveOtps();
    res.json({ success: true, otps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Update settings (wallet addresses, custom QR images, credentials)
router.post('/admin/settings', (req, res) => {
  try {
    const {
      usdtAmount,
      trc20Address,
      bep20Address,
      trc20QrImage,
      bep20QrImage,
      adminUsername,
      adminPassword,
      smtpUser,
      smtpPass,
      smtpPort
    } = req.body;

    const updated = db.updateSettings({
      usdtAmount,
      trc20Address,
      bep20Address,
      trc20QrImage,
      bep20QrImage,
      adminUsername,
      adminPassword,
      smtpUser,
      smtpPass,
      smtpPort
    });

    console.log(`⚙️ Admin updated settings: TRC20=${updated.trc20Address}, BEP20=${updated.bep20Address}, CustomQRs: TRC20=${Boolean(updated.trc20QrImage)}, BEP20=${Boolean(updated.bep20QrImage)}`);

    const { adminPassword: _, ...safeSettings } = updated;
    res.json({
      success: true,
      message: 'Wallet and system settings updated successfully!',
      settings: safeSettings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Test send email
router.post('/admin/test-email', async (req, res) => {
  try {
    const { targetEmail } = req.body;
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return res.status(400).json({ success: false, message: 'Valid target email is required' });
    }
    const result = await sendOtpEmail(targetEmail, '123456');
    res.json({ success: result.sent, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Get all registered users
router.get('/admin/users', (req, res) => {
  try {
    const users = db.getAllUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mount API on both apps
app.use('/api/auth', router);
app.use('/api', router); // also mount on /api so /api/payment/config etc work smoothly
registerApp.use('/api/auth', router);
registerApp.use('/api', router);

// Anti-caching middleware
const noCacheMiddleware = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
};

app.use(noCacheMiddleware);
registerApp.use(noCacheMiddleware);

// Smart Subdomain Routing (for register.yourdomain.com)
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
app.use('/admin', express.static(ADMIN_SITE_DIR, staticOpts));
registerApp.use('/admin', express.static(ADMIN_SITE_DIR, staticOpts));
registerApp.use(express.static(REGISTER_SITE_DIR, staticOpts));
app.use(express.static(MAIN_SITE_DIR, staticOpts));

// Start servers
const mainServer = app.listen(PORT_MAIN, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [p2p-expert Main Platform] running on port ${PORT_MAIN}`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT_MAIN}/admin`);
  console.log(`======================================================\n`);
});

let registerServer;
if (PORT_REGISTER !== PORT_MAIN) {
  try {
    registerServer = registerApp.listen(PORT_REGISTER, () => {
      console.log(`⚡ [p2p-expert Registration Subdomain] running on port ${PORT_REGISTER}`);
    });
    registerServer.on('error', (err) => {
      console.log('ℹ️ Cloud single-port mode active: registration served on /register');
    });
  } catch (err) {
    console.log('ℹ️ Registration served on main port.');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  mainServer.close();
  if (registerServer) registerServer.close();
});

module.exports = { app, registerApp };
